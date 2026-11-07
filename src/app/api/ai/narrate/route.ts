import { ask, extractJson, readBody, safeMode, type Mode } from '@/lib/ai/provider';
import { narrateSystem } from '@/lib/ai/prompts';
import { inventedNumbers } from '@/lib/ai/guard';
import type { Lang } from '@/lib/types';

const KEYS = ['understand', 'detect', 'predict', 'support', 'plan'] as const;
type Texts = Partial<Record<(typeof KEYS)[number], string>>;

export async function POST(req: Request) {
  const body = await readBody<{ mode: Mode; lang: Lang; facts: unknown }>(req);
  if (!body?.facts) return Response.json({ texts: null, used: 'rules', error: 'bad request' }, { status: 400 });
  const { lang, facts } = body;
  const mode = safeMode(body.mode);
  try {
    const r = await ask({ mode, system: narrateSystem(lang), prompt: `FACTS: ${JSON.stringify(facts)}\nWrite the five summaries.`, maxOutputTokens: 1000 });
    const raw = extractJson<Record<string, unknown>>(r.text);
    if (!raw) return Response.json({ texts: null, used: 'rules', error: 'unparseable' });
    // Keep only well-formed sentences that use the app's own numbers. Anything else falls back,
    // step by step, to the rules wording on the client (which then shows the rules badge).
    const texts: Texts = {};
    const rejected: string[] = [];
    for (const k of KEYS) {
      const v = raw[k];
      if (typeof v === 'string' && v.trim() && !inventedNumbers(v, facts).length) texts[k] = v.trim();
      else rejected.push(k);
    }
    if (rejected.length) console.warn(`[narrate] rules wording used for: ${rejected.join(', ')}`);
    if (rejected.length === KEYS.length) return Response.json({ texts: null, used: 'rules', error: 'no usable text' });
    return Response.json({ texts, rejected, used: r.used, model: r.model });
  } catch (e) {
    return Response.json({ texts: null, used: 'rules', error: (e as Error).message });
  }
}
