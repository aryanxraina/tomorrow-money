// API smoke test: node scripts/smoke-api.mjs [baseUrl] [mode]
// Hits every API route with a realistic body and prints status, who answered and a short summary.
// mode defaults to "local". Exits non-zero if a route errors. Never prints keys (status returns booleans only).
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3000';
const mode = process.argv[3] || 'local';
const img = (f) => `data:image/png;base64,${readFileSync(`public/samples/${f}`).toString('base64')}`;

const facts = {
  name: 'Amara', today: '2026-11-07', groups: ['Catching up', 'Stretched'], balance: 212, monthlyIn: 1708, monthlyOut: 1752,
  essentialsPercentOfIncome: 92, problems: [{ title: 'No safety buffer' }, { title: 'Prepayment meter' }], extraCostsPerYear: 418,
  firstRisk: { date: '6 Dec', chanceBelowZero: '34%', around: 'Leeds Homes Rent' }, highestRiskNext90Days: '100%',
  supportPerMonth: 107, supportOneOff: 150, supportTop: ['Council Tax Reduction'], planSteps: ['Apply for Council Tax Reduction'],
  highestRiskWithPlan: '85%', riskyDaysNext90: 40, riskyDaysWithPlan: 20, safeDaysNow: 5, safeDaysIn90DaysWithoutPlan: 0, safeDaysIn90DaysWithPlan: 6,
};
const draft = {
  understand: 'About £1,708 comes in and £1,752 goes out each month. Essentials take 92% of your income.',
  detect: 'We found 2 things to look at, starting with "No safety buffer". Extra costs add up to about £418 a year.',
  predict: 'There is a 34% chance your balance goes below £0 on 6 Dec, around Leeds Homes Rent.',
  support: 'You may be missing about £107 a month plus £150 one-off. Start with Council Tax Reduction.',
  plan: 'With these steps, risky days in the next 3 months go from 40 to 20, and your safe days go from 0 to 6.',
};
const emails = [
  { from: 'billing@streamly.example', subject: 'Your free trial ends soon', date: '2026-11-05', body: 'Your free trial ends on 12 November 2026, then £4.99 a month.' },
  { from: 'orders@shop.example', subject: 'Your order has shipped', date: '2026-11-04', body: 'Your order of £12.00 is on its way.' },
];

const tests = [
  ['status', 'GET', '/api/status'],
  ['quote', 'GET', '/api/quote?symbols=VWRL,AAPL'],
  ['places grocery', 'POST', '/api/places', { lat: 53.8, lng: -1.55, scenario: 'grocery', currentName: 'Tesco Express', mode }],
  ['places fuel', 'POST', '/api/places', { lat: 53.8, lng: -1.55, scenario: 'fuel', currentName: 'Esso', mode }],
  ['narrate en', 'POST', '/api/ai/narrate', { mode, lang: 'en', facts, draft }],
  ['narrate pl', 'POST', '/api/ai/narrate', { mode, lang: 'pl', facts, draft }],
  ['agent', 'POST', '/api/ai/agent', { mode, lang: 'en', question: 'Can I afford £60 this week?', context: facts, facts: { verdict: 'not a safe time to buy this', amount: '£60', riskNext30DaysWithout: '55%', riskNext30DaysIfBoughtToday: '84%' } }],
  ['receipt express', 'POST', '/api/receipt', { mode, image: img('receipt-express.png'), sampleId: 'express' }],
  ['receipt budget', 'POST', '/api/receipt', { mode, image: img('receipt-budget.png'), sampleId: 'budget' }],
  ['subscriptions', 'POST', '/api/subscriptions', { mode, emails }],
];

let failed = 0;
for (const [name, method, path, body] of tests) {
  const t0 = Date.now();
  try {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${name.padEnd(16)} ${r.status} ${String(Date.now() - t0).padStart(6)}ms ${JSON.stringify(j).slice(0, 1100)}`);
    if (!r.ok) failed++;
  } catch (e) {
    failed++;
    console.log(`FAIL ${name.padEnd(16)} ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
