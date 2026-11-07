import { getPersonas } from '../src/lib/data/personas';
import { analyse, planForecast, safeDays, affordability } from '../src/lib/engine/analyse';
import { TODAY } from '../src/lib/engine/dates';
import { parseReceiptText } from '../src/lib/engine/receipt';
import { categoryTrends } from '../src/lib/engine/understand';
import { billsToIcs } from '../src/lib/ics';
import { moderationProblem } from '../src/lib/moderate';
import { inventedNumbers } from '../src/lib/ai/guard';
import { extractJson } from '../src/lib/ai/provider';
for (const p of getPersonas()) {
  const t0 = Date.now();
  const an = analyse(p.answers, p.txns, TODAY);
  const sel = an.actions.slice(0, 6);
  const pf = planForecast(an, sel);
  console.log(`\n=== ${p.name} (${p.txns.length} txns, ${Date.now()-t0}ms)`);
  console.log('in/out monthly', Math.round(an.summary.monthlyIn), Math.round(an.summary.monthlyOut), 'ess ratio', an.summary.essentialsRatio.toFixed(2), 'cv', an.summary.incomeWeeklyCV.toFixed(2));
  console.log('groups', an.groups.map(g=>g.label).join(', '));
  console.log('fingerprint', an.fingerprint.map(f=>`${f.label}:${f.score}`).join(' | '));
  console.log('recurring', an.recurring.map(r=>`${r.label}(${r.direction}${r.cadence==='monthly'?' m'+r.dayOfMonth:' '+r.everyDays+'d'} £${r.last.toFixed(0)})`).join('; '));
  console.log('problems', an.problems.map(x=>`${x.title}${x.annualCost?` [£${Math.round(x.annualCost)}/yr]`:''}`).join(' || '));
  console.log('premium/yr', Math.round(an.premiumAnnual), 'support £/m', an.supportMonthly, 'oneoff', an.supportOneOff);
  console.log('support', an.support.map(s=>s.title).join('; '));
  const f = an.forecast;
  console.log('base: firstRisk', f.firstRisk?.date, f.firstRisk?.p.toFixed(2), f.firstRisk?.trigger?.label, '| risk30', f.risk30.toFixed(2), '| max', f.maxRisk.date, f.maxRisk.p.toFixed(2), '| lowest', f.lowestP50.date, Math.round(f.lowestP50.value), '| end', Math.round(f.endP50));
  console.log('plan actions', sel.map(a=>`${a.title} (£${a.saveMonthly.toFixed(0)}/m)`).join('; '));
  console.log('plan: firstRisk', pf.firstRisk?.date, pf.firstRisk?.p.toFixed(2), '| risk30', pf.risk30.toFixed(2), '| max', pf.maxRisk.p.toFixed(2), '| end', Math.round(pf.endP50));
  console.log('safe days now', an.bufferDays.toFixed(1), 'in90 base', safeDays(an, f, p.answers.savings).toFixed(1), 'plan', safeDays(an, pf, p.answers.savings).toFixed(1));
  const t1=Date.now(); const af = affordability(an, 60, TODAY); console.log('afford £60 today', af.riskBefore.toFixed(2), '->', af.riskAfter.toFixed(2), 'safer', af.saferDate?.date, af.saferDate?.risk.toFixed(2), `${Date.now()-t1}ms`);
  console.log('upcoming', an.upcoming.slice(0,8).map(u=>`${u.date} ${u.label} ${Math.round(u.amount)}`).join('; '));
  if (an.tax) console.log('tax', an.tax);
}

// ---- Receipt parser: text recorded from real QVAC OCR runs on the two sample receipts ----
const expect = (name: string, ok: boolean) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) process.exitCode = 1;
};
const budget = parseReceiptText(
  'BUDGETMART\nRetail Park,  Unit  (sample)\nDEMO  SAMPLE  NOT  REAL  RECEIPT\nDate:  05/11/2026  10  15  Till\nSemi  skimmed  milk 4pt  El. 55\nPasta 500g  {l.50\nChicken  breast  lkg  E5 .49\nBasmati  rice  lkg  El.39\nChopped  tomatoes  4pk  El.40\nCheddar 400g  {2.89\nApples  x6  El.29\nNappies  size  {3 .95\nToilet  roll  9pk  13 .49\nTOTAL  {22 . 95\nCARD  (CONTACTLESS)  {22 .95\nThank  you  for  shopping  with  Us',
);
console.log('\n=== Receipt parser and number guard');
expect('budget: 9 items, total 22.95, reconciled', budget?.items.length === 9 && budget.total === 22.95 && budget.reconciled);
expect('budget: misread 13.49 corrected to 3.49', budget?.items.find((i) => i.name.startsWith('Toilet'))?.price === 3.49);
expect('budget: date and merchant', budget?.date === '2026-11-05' && budget.merchant === 'Budgetmart');
const express = parseReceiptText(
  'QUICKSTOP  EXPRESS\n12 High  Street  ( sample)\nDate:  06/11/2026  18:42  Till\nSemi  skimmed  milk 4pt  El.95\nWhite  bread  800g  El.45\nFree  range  eggs  x6  E2 .35\nBananas  x5  El.25\nPasta  500g  E2.30\nWashing  up  liquid  El.85\nTOTAL  Ell. 15\nCARD  (CONTACTLESS )  {ll.15',
);
expect('express: 6 items, total 11.15, reconciled', express?.items.length === 6 && express.total === 11.15 && express.reconciled);
expect('no prices: returns null', parseReceiptText('Hello\nNo  prices  here') === null);
expect('guard: invented number caught', inventedNumbers('You pay £999 a year.', { x: 418 }).join() === '999');
expect('guard: supplied numbers pass', inventedNumbers('You pay £418 a year, 34% on 6 Dec, about £1,770.', { a: 418, b: '34%', c: '6 Dec', d: 1770 }).length === 0);
expect('guard: Hindi digits read', inventedNumbers('₹ ९९९', { a: 1 }).join() === '999');
for (const [text, blocked] of [
  ['The Post Office lets you take out cash with no fee.', false],
  ['Council tax was £109 a month, now £55 after my claim on 12 December.', false],
  ['My card is 4111 1111 1111 1111', true],
  ['Sort code 12-34-56', true],
  ['Call me on 07700 900123', true],
  ['Email me at someone@example.com', true],
  ['I live near LS9 8AB', true],
  ['I can lend you money, no credit check', true],
  ['Guaranteed returns, double your money!', true],
] as const) {
  expect(`moderate: ${blocked ? 'blocks' : 'allows'} "${text}"`, !!moderationProblem(text) === blocked);
}
const ics = billsToIcs([{ date: '2026-12-31', label: 'Rent, flat; 2', amount: -575 }], '20261107T090000Z');
expect('ics: all-day, escaped, ends next year, CRLF', ics.includes('DTSTART;VALUE=DATE:20261231') && ics.includes('DTEND;VALUE=DATE:20270101') && ics.includes('Rent\\, flat\\; 2') && ics.includes('\r\n'));
for (const p of getPersonas()) {
  const tr = categoryTrends(p.txns, TODAY);
  console.log(`trend ${p.name}: ${tr.map((t) => `${t.category} ${t.months.map((m) => m.amount).join('/')}`).join(' | ')}`);
  expect(`trend ${p.name}: no current month, up to 6 full months`, tr.length > 0 && tr.every((t) => t.months.length <= 6 && t.months.every((m) => m.month < '2026-11')));
}
expect('json: chatter around JSON', extractJson<{ a: number }>('Sure {not json} here: {"a": 1,} done')?.a === 1);
