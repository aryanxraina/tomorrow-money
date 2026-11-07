// Real facts and rules text for every persona and language, sent through the live narrate route.
import { getPersonas } from '../src/lib/data/personas';
import { analyse, planForecast } from '../src/lib/engine/analyse';
import { TODAY } from '../src/lib/engine/dates';
import { buildFacts, templates } from '../src/lib/narrative';

const runs: [string, 'en' | 'pl' | 'hi' | 'ur'][] = [['amara', 'en'], ['jordan', 'en'], ['kacper', 'pl'], ['priya', 'en'], ['amara', 'hi'], ['kacper', 'ur']];
for (const [id, lang] of runs) {
  const p = getPersonas().find((x) => x.id === id)!;
  const an = analyse(p.answers, p.txns, TODAY);
  const acts = an.actions.slice(0, 6);
  const plan = planForecast(an, acts);
  const profile = { ...p, isDemo: true } as never;
  const facts = buildFacts(profile, an, plan, acts.map((a) => a.title));
  const draft = templates(facts, lang);
  const t0 = Date.now();
  const r = await fetch('http://localhost:3000/api/ai/narrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'local', lang, facts, draft }) });
  const j = await r.json();
  console.log(`\n=== ${id}/${lang} ${r.status} ${Date.now() - t0}ms used=${j.used} rejected=${JSON.stringify(j.rejected ?? j.error)}`);
  console.log('DRAFT predict:', draft.predict);
  console.log(JSON.stringify(j.texts, null, 1));
}
