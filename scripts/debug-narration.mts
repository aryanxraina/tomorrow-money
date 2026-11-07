// Shows why the guard rejects each on-device rewrite. Talks to QVAC directly: npx tsx scripts/debug-narration.mts amara
import { getPersonas } from '../src/lib/data/personas';
import { analyse, planForecast } from '../src/lib/engine/analyse';
import { TODAY } from '../src/lib/engine/dates';
import { buildFacts, templates } from '../src/lib/narrative';
import { narrateSystem } from '../src/lib/ai/prompts';
import { droppedNumbers, inventedNumbers, keepsMoneyTerms, matchesLanguage } from '../src/lib/ai/guard';

const p = getPersonas().find((x) => x.id === (process.argv[2] || 'amara'))!;
const an = analyse(p.answers, p.txns, TODAY);
const acts = an.actions.slice(0, 6);
const facts = buildFacts({ ...p, isDemo: true } as never, an, planForecast(an, acts), acts.map((a) => a.title));
const draft = templates(facts, 'en');
const r = await fetch('http://127.0.0.1:11435/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3-4b',
    max_tokens: 1000,
    reasoning_budget: false,
    messages: [
      { role: 'system', content: narrateSystem('en') },
      { role: 'user', content: `FACTS: ${JSON.stringify(facts)}\nDRAFT: ${JSON.stringify(draft)}\nReword the five DRAFT values.` },
    ],
  }),
});
const text: string = (await r.json()).choices[0].message.content;
console.log(text);
const raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
for (const k of Object.keys(draft) as (keyof typeof draft)[]) {
  const v: string = raw[k] ?? '';
  console.log(k, { identical: v === draft[k], lang: matchesLanguage(v, 'en'), invented: inventedNumbers(v, facts, draft), dropped: droppedNumbers(v, draft[k]), terms: keepsMoneyTerms(v, draft[k]) });
}
