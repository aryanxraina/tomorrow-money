import { ask, extractJson, type Mode } from '@/lib/ai/provider';
import { SUBS_SYSTEM } from '@/lib/ai/prompts';
import type { SampleEmail } from '@/lib/data/samples';

export interface Sub {
  service: string;
  amount: number;
  cycle: 'monthly' | 'yearly' | 'weekly';
  nextDate: string | null;
  status: 'active' | 'trial' | 'price_rise';
  note: string;
}

const nice = (d: string | null) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'soon');
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Rules fallback: works with no AI at all.
function rulesExtract(emails: SampleEmail[]): Sub[] {
  const out: Sub[] = [];
  for (const e of emails) {
    const text = `${e.subject} ${e.body}`;
    if (/order|shipped|delivery|on its way/i.test(text) && !/subscription|membership|renew/i.test(text)) continue;
    if (!/renew|subscription|membership|trial|per month|a month|every month|plan/i.test(text)) continue;
    const amounts = [...text.matchAll(/£(\d+(?:\.\d{2})?)/g)].map((m) => Number(m[1]));
    if (!amounts.length) continue;
    const dates = [...text.matchAll(/(\d{1,2}) (january|february|march|april|may|june|july|august|september|october|november|december) (\d{4})/gi)].map(
      (m) => `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`,
    );
    const status: Sub['status'] = /trial/i.test(text) ? 'trial' : /will cost|price/i.test(text) ? 'price_rise' : 'active';
    const service = (e.from.split('@')[1] || e.from).split('.')[0].replace(/^\w/, (c) => c.toUpperCase());
    const amount = status === 'price_rise' ? amounts[0] : amounts[amounts.length - 1];
    const nextDate = dates.length ? dates[dates.length - 1] : null;
    out.push({
      service,
      amount,
      cycle: /year/i.test(text) ? 'yearly' : 'monthly',
      nextDate,
      status,
      note: status === 'trial' ? `Free trial ends ${nice(nextDate)}, then £${amount.toFixed(2)} a month` : status === 'price_rise' ? `Price going up to £${amount.toFixed(2)} from ${nice(nextDate)}` : `Renews ${nice(nextDate)}`,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const { mode, emails } = (await req.json()) as { mode: Mode; emails: SampleEmail[] };
  const text = emails.map((e) => `FROM: ${e.from}\nSUBJECT: ${e.subject}\nDATE: ${e.date}\n${e.body}`).join('\n---\n');
  try {
    const r = await ask({ mode, system: SUBS_SYSTEM, prompt: text, maxOutputTokens: 900 });
    const subs = extractJson<Sub[]>(r.text);
    if (Array.isArray(subs) && subs.length) return Response.json({ subs, used: r.used, model: r.model });
  } catch (e) {
    console.warn('[subs] AI failed', (e as Error).message);
  }
  return Response.json({ subs: rulesExtract(emails), used: 'rules' });
}
