import { aiStatus, ask, extractJson, readBody, safeMode, type Mode } from '@/lib/ai/provider';
import { narrateSystem } from '@/lib/ai/prompts';
import { droppedNumbers, inventedNumbers, matchesLanguage, poundsOnly } from '@/lib/ai/guard';
import type { Lang } from '@/lib/types';

const KEYS = ['understand', 'detect', 'predict', 'support', 'plan'] as const;
type Key = (typeof KEYS)[number];

export async function POST(req: Request) {
  const body = await readBody<{ mode: Mode; lang: Lang; facts: unknown; draft: Record<Key, string> }>(req);
  if (!body?.facts || !body.draft) return Response.json({ texts: null, used: 'rules', error: 'bad request' }, { status: 400 });
  const { lang, facts, draft } = body;
  const mode = safeMode(body.mode);
  // Small local models mistranslated money terms in testing ("cash machine fees" became casinos in Polish).
  // The app's own translated sentences are used instead, so on-device narration is English-only.
  if (lang !== 'en' && (mode === 'local' || !aiStatus().cloud)) return Response.json({ texts: null, used: 'rules', note: 'app wording' });
  try {
    const r = await ask({
      mode,
      system: narrateSystem(lang),
      prompt: `FACTS: ${JSON.stringify(facts)}\nDRAFT: ${JSON.stringify(draft)}\nReword the five DRAFT values.`,
      maxOutputTokens: 1000,
    });
    const raw = extractJson<Record<string, unknown>>(r.text);
    if (!raw) return Response.json({ texts: null, used: 'rules', error: 'unparseable' });
    // Keep a rewrite only if it is in the right language, adds no number and drops none.
    // Anything else falls back, step by step, to the app's own sentence (with the rules badge).
    const texts: Partial<Record<Key, string>> = {};
    const rejected: Key[] = [];
    for (const k of KEYS) {
      const v = typeof raw[k] === 'string' ? poundsOnly((raw[k] as string).trim()) : '';
      // An unchanged copy isn't AI writing, so it keeps the rules badge rather than claiming to be AI.
      const ok = v && v !== draft[k]?.trim() && matchesLanguage(v, lang) && !inventedNumbers(v, facts, draft).length && !droppedNumbers(v, draft[k] || '').length;
      if (ok) texts[k] = v;
      else rejected.push(k);
    }
    if (rejected.length) console.warn(`[narrate] rules wording used for: ${rejected.join(', ')}`);
    if (rejected.length === KEYS.length) return Response.json({ texts: null, used: 'rules', error: 'no usable text' });
    return Response.json({ texts, rejected, used: r.used, model: r.model });
  } catch (e) {
    return Response.json({ texts: null, used: 'rules', error: (e as Error).message });
  }
}
