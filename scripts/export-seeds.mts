// Writes made-up people as saved app state, so the browser tests can open the app as if they'd used it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_TODAY, getPersonas } from '../tests/fixtures/personas';
import { STATEMENTS } from '../tests/fixtures/statements';

mkdirSync('.audit', { recursive: true });
const seeds = getPersonas().map((p) => ({
  id: p.id,
  state: { answers: { ...p.answers, balanceDate: FIXTURE_TODAY }, known: ['adults', 'nation', 'balance', 'monthlyIncome'], skipped: [], txns: p.txns, accounts: [], rules: {}, confirmed: [], bills: [], selected: null, mode: 'auto', theme: 'system', bigText: false },
}));
writeFileSync('.audit/seeds.json', JSON.stringify({ today: FIXTURE_TODAY, seeds }));
const lloyds = STATEMENTS.find((s) => s.name.startsWith('Lloyds'))!;
writeFileSync('.audit/sample-statement.csv', lloyds.text);
console.log(`Exported ${seeds.length} seeds`);
