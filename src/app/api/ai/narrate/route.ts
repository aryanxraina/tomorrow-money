import { ask, extractJson, type Mode } from '@/lib/ai/provider';
import { narrateSystem } from '@/lib/ai/prompts';
import type { Lang } from '@/lib/types';

type Texts = Record<'understand' | 'detect' | 'predict' | 'support' | 'plan', string>;

export async function POST(req: Request) {
  const { mode, lang, facts } = (await req.json()) as { mode: Mode; lang: Lang; facts: unknown };
  try {
    const r = await ask({ mode, system: narrateSystem(lang), prompt: `FACTS: ${JSON.stringify(facts)}\nWrite the five summaries.` });
    const texts = extractJson<Texts>(r.text);
    if (!texts) return Response.json({ texts: null, used: 'rules', error: 'unparseable' });
    return Response.json({ texts, used: r.used, model: r.model });
  } catch (e) {
    return Response.json({ texts: null, used: 'rules', error: (e as Error).message });
  }
}
