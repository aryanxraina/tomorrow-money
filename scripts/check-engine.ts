import { inventedNumbers } from '../src/lib/ai/guard';
import { extractJson } from '../src/lib/ai/provider';
import { analyse, estimateFromAnswers, missingCosts, planForecast, safeDays, affordability } from '../src/lib/engine/analyse';
import { backtest } from '../src/lib/engine/backtest';
import { categorise } from '../src/lib/engine/categorise';
import { addDays, todayISO } from '../src/lib/engine/dates';
import { accuracy, nextQuestion, QUESTIONS } from '../src/lib/engine/questions';
import { affordVerdict, buildFacts, cantJudgeYet, missingBasics, rulesAnswer, templates } from '../src/lib/narrative';
import { parseReceiptText } from '../src/lib/engine/receipt';
import { merchantKey } from '../src/lib/engine/recurring';
import { decodeStatement, mergeTxns, parseDate, parseMoney, parseStatement } from '../src/lib/engine/statements';
import { extractSubscriptions, billsFromSub } from '../src/lib/engine/subscriptions';
import { class4NI, estimateSelfAssessment, incomeTaxOnProfit, nextTaxDeadline } from '../src/lib/engine/tax';
import { categoryTrends } from '../src/lib/engine/understand';
import { billsToIcs } from '../src/lib/ics';
import { moderationProblem } from '../src/lib/moderate';
import { buildPulse, classify, cleanText, topicsForUser } from '../src/lib/community/topics';
import { SAMPLE_COMMUNITY_POSTS } from '../src/lib/data/community';
import { htmlToText, parseAtom } from '../src/lib/community/reddit';
import { BLANK_ANSWERS } from '../src/lib/answers';
import { FIXTURE_TODAY as TODAY, getPersonas } from '../tests/fixtures/personas';
import { sampleInbox } from '../tests/fixtures/samples';
import { STATEMENTS } from '../tests/fixtures/statements';
import type { Txn } from '../src/lib/types';

for (const p of getPersonas()) {
  const t0 = Date.now();
  const an = analyse(p.answers, p.txns, TODAY, { known: ['adults', 'balance'] });
  const sel = an.actions.filter((a) => a.kind !== 'claim');
  const pf = planForecast(an, sel);
  console.log(`\n=== ${p.name} (${p.txns.length} txns, ${Date.now() - t0}ms)`);
  console.log('in/out monthly', Math.round(an.summary.monthlyIn), Math.round(an.summary.monthlyOut), 'other in', Math.round(an.summary.otherMoneyIn), 'ess ratio', an.summary.essentialsRatio.toFixed(2), 'cv', an.summary.incomeWeeklyCV.toFixed(2));
  console.log('groups', an.groups.map((g) => g.label).join(', '));
  console.log('fingerprint', an.fingerprint.map((f) => `${f.label}:${f.score}`).join(' | '));
  console.log('recurring', an.recurring.map((r) => `${r.label}(${r.direction}${r.cadence === 'monthly' ? ' m' + r.dayOfMonth : ' ' + r.everyDays + 'd'} £${r.last.toFixed(0)})`).join('; '));
  console.log('problems', an.problems.map((x) => `${x.title}${x.annualCost ? ` [£${Math.round(x.annualCost)}/yr]` : ''}`).join(' || '));
  console.log('fees/yr', Math.round(an.premiumAnnual));
  console.log('support', an.support.map((s) => s.title).join('; '));
  const f = an.forecast;
  console.log('base: firstRisk', f.firstRisk?.date, f.firstRisk?.p.toFixed(2), f.firstRisk?.trigger?.label, '| risk30', f.risk30.toFixed(2), '| max', f.maxRisk.date, f.maxRisk.p.toFixed(2), '| lowest', f.lowestP50.date, Math.round(f.lowestP50.value), '| end', Math.round(f.endP50));
  console.log('plan actions', sel.map((a) => `${a.title} (£${a.saveMonthly.toFixed(0)}/m)`).join('; '));
  console.log('plan: firstRisk', pf.firstRisk?.date, pf.firstRisk?.p.toFixed(2), '| risk30', pf.risk30.toFixed(2), '| max', pf.maxRisk.p.toFixed(2), '| end', Math.round(pf.endP50));
  console.log('safe days now', an.bufferDays?.toFixed(1), 'in90 base', safeDays(an, f, p.answers.savings)?.toFixed(1), 'plan', safeDays(an, pf, p.answers.savings)?.toFixed(1));
  const t1 = Date.now();
  const af = affordability(an, 60, TODAY);
  console.log('afford £60 today', af.riskBefore.toFixed(2), '->', af.riskAfter.toFixed(2), 'safer', af.saferDate?.date, af.saferDate?.risk.toFixed(2), `${Date.now() - t1}ms`);
  console.log('upcoming', an.upcoming.slice(0, 8).map((u) => `${u.date} ${u.label} ${Math.round(u.amount)}`).join('; '));
  if (an.tax) console.log('tax', an.tax);
}

const expect = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ` [${detail}]` : ''}`);
  if (!ok) process.exitCode = 1;
};
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

// ---- Statement import ----
console.log('\n=== Statement import');
for (const c of STATEMENTS) {
  const bytes = c.latin1 ? Uint8Array.from(Buffer.from(c.text, 'latin1')) : new TextEncoder().encode(c.text);
  const r = parseStatement(decodeStatement(bytes), c.fileName, 'acct');
  const detail = `bank=${r.bank} n=${r.txns.length} in=${r.moneyIn} out=${r.moneyOut} closing=${r.closingBalance} problems=${r.problems.join(' / ')}`;
  expect(`${c.name}: reads every transaction and total`, r.txns.length === c.count && near(r.moneyIn, c.moneyIn) && near(r.moneyOut, c.moneyOut), detail);
  expect(`${c.name}: bank recognised`, r.bank === c.bank, detail);
  expect(`${c.name}: closing balance`, c.closing === null ? r.closingBalance === null : r.closingBalance !== null && near(r.closingBalance, c.closing), detail);
  expect(`${c.name}: no doubts raised`, r.problems.length === 0, detail);
  if (r.balanceCheck) expect(`${c.name}: agrees with its own running balance`, r.balanceCheck.matched === r.balanceCheck.checked, detail);
}
const lloyds = parseStatement(STATEMENTS.find((c) => c.name.startsWith('Lloyds'))!.text, 'x.csv', 'a');
expect('newest-first files end up oldest first', lloyds.txns[0].date === '2026-10-01');
const monzo = parseStatement(STATEMENTS[0].text, 'x.csv', 'a');
expect('Monzo pot transfer is a move between accounts', monzo.txns[2].category === 'internal');
expect('unreadable file asks the person to match columns', parseStatement('hello\nworld\n', 'x.csv', 'a').mapping === null);
const dupes = parseStatement('Date,Description,Amount\n01/10/2026,Coffee,-3.00\n01/10/2026,Coffee,-3.00\n', 'x.csv', 'a');
expect('two identical payments on one day both count', dupes.txns.length === 2 && dupes.txns[0].id !== dupes.txns[1].id);
const merged = mergeTxns(dupes.txns, dupes.txns);
expect('uploading the same statement twice adds nothing', merged.added === 0 && merged.duplicates === 2);
expect('dates: UK, written month, ISO', parseDate('13/01/2026') === '2026-01-13' && parseDate('13 Jan 26') === '2026-01-13' && parseDate('2026-01-13T10:00:00') === '2026-01-13');
expect('dates: impossible dates rejected', parseDate('31/02/2026') === null && parseDate('Pending') === null);
expect('money: signs and symbols', parseMoney('£1,234.56') === 1234.56 && parseMoney('(12.00)') === -12 && parseMoney('12.00 DR') === -12 && parseMoney('-3.50') === -3.5 && parseMoney('hello') === null);
const flipped = parseStatement('Date,Description,Amount,Balance\n01/10/2026,Shop,10.00,90.00\n02/10/2026,Shop,10.00,80.00\n03/10/2026,Shop,10.00,70.00\n04/10/2026,Shop,10.00,60.00\n05/10/2026,Shop,10.00,50.00\n', 'x.csv', 'a');
expect('swapped signs are flagged against the running balance', flipped.problems.some((p) => /swapped/.test(p)));

// ---- Categories: real-world words that used to misfire ----
console.log('\n=== Categories');
const cat = (d: string, a = -5) => categorise(d, a);
expect('coffee is not a bank fee', cat('COSTA COFFEE') === 'eating_out');
expect('parent is not rent', cat('PARENTPAY') === 'kids' && cat('CURRENT ACCOUNT') !== 'housing');
expect('business is not a bus', cat('BUSINESS SUPPLIES') !== 'transport');
expect('a pub called Three is not a phone bill', cat('THREE HORSESHOES PUB') === 'eating_out');
expect('real bank fees are fees', cat('UNARRANGED OVERDRAFT FEE') === 'fees' && cat('KLARNA LATE FEE') === 'fees');
expect('a friend paying you is not income', categorise('J SMITH', 40) === 'transfers');
expect('wages are income', categorise('ACME LTD WAGES', 1500) === 'income');
expect('a refund is not income', categorise('AMAZON REFUND', 12) === 'refund');
expect('moving to savings is not spending', cat('TRANSFER TO SAVINGS', -100) === 'internal');
expect('merchant key ignores bank wording and dates', merchantKey('CARD PAYMENT TO NETFLIX.COM ON 12-11-2026') === merchantKey('NETFLIX.COM'));

// ---- Honest money in, and short or old statements ----
console.log('\n=== Real-data behaviour');
const txn = (date: string, description: string, amount: number, extra: Partial<Txn> = {}): Txn => ({ id: `${date}-${description}-${amount}`, date, description, amount, category: categorise(description, amount), source: 'bank', ...extra });
const friend = [txn('2026-10-01', 'ACME LTD WAGES', 1500), txn('2026-10-10', 'J SMITH', 500), txn('2026-10-15', 'RENT', -600), txn('2026-10-25', 'TESCO', -100)];
const a1 = analyse(BLANK_ANSWERS, friend, '2026-10-30');
expect('money from a friend is not counted as income', near(a1.summary.monthlyIn, (1500 * 30.4) / a1.summary.windowDays), `in=${a1.summary.monthlyIn}`);
expect('and it is shown separately', a1.summary.otherMoneyIn > 0);
const month = Array.from({ length: 28 }, (_, i) => txn(`2026-10-${String(i + 1).padStart(2, '0')}`, 'TESCO', -10));
const a2 = analyse(BLANK_ANSWERS, month, '2026-10-29');
expect('a short statement isn’t averaged over 91 days', a2.summary.monthlyOut > 280 && a2.summary.monthlyOut < 320, `out=${a2.summary.monthlyOut}`);
const a3 = analyse(BLANK_ANSWERS, month, '2026-12-20');
expect('an old statement doesn’t read as spending stopping', a3.summary.monthlyOut > 280, `out=${a3.summary.monthlyOut}`);
const monthly = ['08', '09', '10'].map((m) => txn(`2026-${m}-05`, 'ACME HOLDINGS', 1800));
const a4 = analyse(BLANK_ANSWERS, [...monthly, ...month], '2026-10-29');
expect('regular money from an unknown name becomes income', a4.summary.monthlyIn > 0 && a4.txns.some((t) => t.description === 'ACME HOLDINGS' && t.category === 'income'));
const a5 = analyse(BLANK_ANSWERS, [...monthly, ...month], '2026-10-29', { rules: { 'ACME HOLDINGS|in': 'transfers' } });
expect('and the person’s own correction beats that', a5.txns.every((t) => t.description !== 'ACME HOLDINGS' || t.category === 'transfers'));
const twoAccounts = [txn('2026-10-01', 'MOVE MONEY', -200, { account: 'a' }), txn('2026-10-02', 'MOVE MONEY', 200, { account: 'b' }), txn('2026-10-03', 'TESCO', -10, { account: 'a' })];
const a6 = analyse(BLANK_ANSWERS, twoAccounts, '2026-10-29');
expect('moves between your own accounts count as neither', a6.txns.filter((t) => t.description === 'MOVE MONEY').every((t) => t.category === 'internal'));
const confirmedRun = analyse({ ...BLANK_ANSWERS, balance: 100 }, month, '2026-10-29', { confirmed: [{ id: 'ctr', title: 'Council Tax Reduction', monthly: 50, oneOff: 0, oneOffDate: null, confirmedOn: '2026-10-29' }] });
expect('confirmed help reaches the forecast', confirmedRun.known.some((k) => k.label.includes('Council Tax Reduction') && k.amount === 50));
const unconfirmed = analyse({ ...BLANK_ANSWERS, councilTaxMonthly: 100, onBenefits: true }, month, '2026-10-29');
expect('unconfirmed help has no effect on the forecast', unconfirmed.actions.filter((x) => x.kind === 'claim').every((x) => Object.keys(x.adjust).length === 0));
expect('no support item carries a money estimate', unconfirmed.support.every((s) => !('estMonthly' in s) && !('oneOff' in s)));
expect('single person discount waits until we know the household', !unconfirmed.support.some((s) => s.id === 'spd') && analyse({ ...BLANK_ANSWERS, councilTaxMonthly: 100 }, month, '2026-10-29', { known: ['adults'] }).support.some((s) => s.id === 'spd'));
const scot = analyse({ ...BLANK_ANSWERS, nation: 'scotland', councilTaxMonthly: 100, onBenefits: true, childUnder4: true }, month, '2026-10-29');
expect('Scotland gets no England and Wales rules', !scot.support.some((s) => ['ctr', 'healthy-start', 'whd'].includes(s.id)));
expect('savings of £16,000 rule out the Universal Credit check', !analyse({ ...BLANK_ANSWERS, savings: 20000 }, month, '2026-10-29').support.some((s) => s.id === 'uc'));
expect('12-month council tax is recognised', analyse(BLANK_ANSWERS, [txn('2026-02-01', 'LEEDS COUNCIL TAX', -100)], '2026-10-29').ctAlready12);

// ---- Tax, checked by hand against GOV.UK's 2026 to 2027 rates ----
console.log('\n=== Tax');
expect('nothing on profit under the allowance', incomeTaxOnProfit(12000, 0) === 0 && class4NI(12000) === 0);
expect('basic rate: £20,000 profit', near(incomeTaxOnProfit(20000, 0), (20000 - 12570) * 0.2));
expect('NI: £20,000 profit', near(class4NI(20000), (20000 - 12570) * 0.06));
expect('higher rate: £60,000 profit', near(incomeTaxOnProfit(60000, 0), 37700 * 0.2 + (60000 - 50270) * 0.4));
expect('NI: £60,000 profit', near(class4NI(60000), 37700 * 0.06 + (60000 - 50270) * 0.02));
expect('a job uses the allowance first', near(incomeTaxOnProfit(5000, 20000), 5000 * 0.2));
expect('a good job pushes profit into higher rate', near(incomeTaxOnProfit(5000, 50000), 270 * 0.2 + 4730 * 0.4));
expect('deadline: before and after 31 January', nextTaxDeadline('2026-11-07') === '2027-01-31' && nextTaxDeadline('2027-01-20') === '2027-01-31' && nextTaxDeadline('2027-02-01') === '2028-01-31');
expect('no estimate for people who aren’t self-employed', estimateSelfAssessment(month, '2026-10-29', BLANK_ANSWERS) === null);
expect('today is a real date', /^\d{4}-\d{2}-\d{2}$/.test(todayISO()) && todayISO(new Date('2026-07-01T23:30:00Z')) === '2026-07-02');

// ---- Receipt parser: text recorded from real QVAC OCR runs on the two test receipts ----
console.log('\n=== Receipt parser and number guard');
const budget = parseReceiptText(
  'BUDGETMART\nRetail Park,  Unit  (sample)\nDEMO  SAMPLE  NOT  REAL  RECEIPT\nDate:  05/11/2026  10  15  Till\nSemi  skimmed  milk 4pt  El. 55\nPasta 500g  {l.50\nChicken  breast  lkg  E5 .49\nBasmati  rice  lkg  El.39\nChopped  tomatoes  4pk  El.40\nCheddar 400g  {2.89\nApples  x6  El.29\nNappies  size  {3 .95\nToilet  roll  9pk  13 .49\nTOTAL  {22 . 95\nCARD  (CONTACTLESS)  {22 .95\nThank  you  for  shopping  with  Us',
);
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
expect('json: chatter around JSON', extractJson<{ a: number }>('Sure {not json} here: {"a": 1,} done')?.a === 1);

// ---- Subscriptions in emails, read by code ----
console.log('\n=== Email subscriptions');
const email = (id: string, from: string, subject: string, date: string, body: string) => ({ id, from, subject, date, body });
const sample = extractSubscriptions(sampleInbox('amara'), TODAY);
const byName = (name: string) => sample.found.find((s) => s.service.toLowerCase().includes(name));
expect('finds the trial, with its end date and price', byName('photocloud')?.status === 'trial' && byName('photocloud')?.nextDate === '2026-11-12' && byName('photocloud')?.amount === 4.99);
expect('finds the price rise at the new price', byName('musicstream')?.status === 'price_rise' && byName('musicstream')?.amount === 12.99 && byName('musicstream')?.nextDate === '2026-12-08');
expect('finds the renewal date', byName('fitlife')?.nextDate === '2026-12-03' && byName('fitlife')?.amount === 24.99);
expect('monthly worked out from the gap between dates', byName('videostream')?.cycle === 'monthly' && byName('videostream')?.needsCheck.length === 0);
expect('ignores a one-off order', !sample.found.some((s) => /shop/i.test(s.service)));
const real = extractSubscriptions(
  [
    email('1', '"Netflix" <info@account.netflix.example>', 'Your bill', '2026-10-14', 'Your monthly subscription payment of £10.99 was successful. Your next billing date is 14 November 2026.'),
    email('2', 'Spotify <no-reply@spotify.example>', 'Your plan', '2026-09-01', 'Your subscription has been cancelled. We’re sorry to see you go.'),
    email('3', 'Spotify <no-reply@spotify.example>', 'Your receipt', '2026-08-01', 'Your subscription receipt: £11.99 per month.'),
    email('4', 'Deals <deals@shop.example>', 'Black Friday', '2026-10-20', 'Start your free trial today! Then £5 a month. 50% off everything.'),
    email('5', 'Acme <billing@acme.example>', 'Annual plan renews', '2026-10-01', 'Your annual plan renews on 3 Feb 2027 for £59.00.'),
    email('6', 'US Tool <hello@ustool.example>', 'Receipt', '2026-10-01', 'Your subscription receipt. You were charged $9.99/month. Next payment Nov 1, 2026.'),
    email('7', 'Old <billing@old.example>', 'Receipt', '2026-03-01', 'Your monthly subscription payment of £3.00 was received.'),
    email('8', 'Gym <team@gym.example>', 'Membership', '2026-10-05', 'Your membership renewed. Your subscription costs £20 (was £18, saved £2 last year).'),
  ],
  TODAY,
);
const f2 = (name: string) => real.found.find((s) => s.service.toLowerCase().includes(name));
expect('reads a display name and next date', f2('netflix')?.amount === 10.99 && f2('netflix')?.nextDate === '2026-11-14');
expect('a later cancellation wins', f2('spotify')?.status === 'cancelled');
expect('marketing is ignored', !f2('deals') && !real.found.some((s) => /shop/i.test(s.service)));
expect('yearly plan and American-style date', f2('acme')?.cycle === 'yearly' && f2('acme')?.amount === 59 && f2('acme')?.nextDate === '2027-02-03');
expect('dollars are flagged, not converted, and can’t be forecast', f2('us tool')?.currency === 'USD' && f2('us tool')!.needsCheck.length > 0 && billsFromSub(f2('us tool')!, 'x').length === 0);
expect('an old email is flagged as possibly stopped', f2('old')!.needsCheck.some((r) => /may have stopped/.test(r)));
expect('picks the price over old prices and savings', f2('gym')?.amount === 20);
expect('rolls an old date forward to the next due date', (f2('old')?.nextDate ?? '') >= TODAY);
expect('a cancelled plan adds no bills', billsFromSub(f2('spotify')!, 'x').length === 0);
expect('a monthly plan adds the next payments', billsFromSub(f2('netflix')!, 'x').length === 4 && billsFromSub(f2('netflix')!, 'x')[1].date === '2026-12-14');

// ---- Follow-up questions ----
console.log('\n=== Questions');
const ctx = (a = BLANK_ANSWERS, known: string[] = [], skipped: string[] = [], estimated = true) => ({ a, an: analyse(a, estimateFromAnswers(a, TODAY), TODAY), known, skipped, estimated });
expect('nothing is invented for an unanswered check-in', estimateFromAnswers(BLANK_ANSWERS, TODAY).length === 0);
expect('answered costs appear in the estimate', estimateFromAnswers({ ...BLANK_ANSWERS, energyMonthly: 80, billsMonthly: 40, otherWeekly: 30 }, TODAY).filter((t) => /ENERGY|BILLS|EVERYDAY/.test(t.description)).length > 5);
expect('included energy adds no energy bill', !estimateFromAnswers({ ...BLANK_ANSWERS, energyPayment: 'included', energyMonthly: 80 }, TODAY).some((t) => /ENERGY/.test(t.description)));
expect('missing costs are named', missingCosts(BLANK_ANSWERS, []).includes('energy') && missingCosts(BLANK_ANSWERS, ['energyMonthly']).every((c) => c !== 'energy'));
expect('first question is the balance', nextQuestion(ctx())?.id === 'balance');
expect('answered questions aren’t asked again', nextQuestion(ctx(BLANK_ANSWERS, ['balance']))?.id === 'incomeTypes');
expect('skipped questions aren’t asked again', nextQuestion(ctx(BLANK_ANSWERS, ['balance'], ['incomeTypes']))?.id === 'monthlyIncome');
const withStatement = ctx(BLANK_ANSWERS, ['incomeTypes', 'balance'], [], false);
expect('with a statement, we don’t ask what it already shows', nextQuestion(withStatement)?.id === 'energyPayment' && nextQuestion(ctx(BLANK_ANSWERS, ['incomeTypes', 'balance', 'energyPayment'], [], false))?.id === 'adults');
const energyFirst = QUESTIONS.findIndex((q) => q.id === 'energyPayment') < QUESTIONS.findIndex((q) => q.id === 'energyMonthly');
expect('how you pay for energy comes before how much', energyFirst);
expect('no energy cost asked if it’s in the rent', !QUESTIONS.find((q) => q.id === 'energyMonthly')!.applies(ctx({ ...BLANK_ANSWERS, energyPayment: 'included' })));
const allIds = QUESTIONS.map((q) => q.id);
expect('every question can finish', nextQuestion(ctx(BLANK_ANSWERS, allIds)) === null);
expect('discount question waits until we know you live alone', !QUESTIONS.find((q) => q.id === 'ctSingleDiscount')!.applies(ctx({ ...BLANK_ANSWERS, councilTaxMonthly: 100 })) && QUESTIONS.find((q) => q.id === 'ctSingleDiscount')!.applies(ctx({ ...BLANK_ANSWERS, councilTaxMonthly: 100 }, ['adults'])));
const typesQ = QUESTIONS.find((q) => q.id === 'incomeTypes')!;
expect('saying you get benefits also records it', typesQ.write(['benefits'], BLANK_ANSWERS).onBenefits === true);
expect('progress counts only relevant questions', accuracy(ctx(BLANK_ANSWERS, ['incomeTypes'])).answered === 1 && accuracy(ctx(BLANK_ANSWERS, ['incomeTypes'])).total < QUESTIONS.length);
const billQ = QUESTIONS.find((q) => q.id === 'bigBill')!;
const withBill = { ...BLANK_ANSWERS, ...billQ.write({ date: '2026-11-20', amount: 300, label: 'MOT' }, BLANK_ANSWERS) };
expect('a big bill goes into the forecast', analyse(withBill, month, TODAY).known.some((k) => k.label === 'MOT' && k.amount === -300));
expect('a big bill can be taken back out', billQ.removeItem!(withBill.yearlyBills[0], withBill).yearlyBills?.length === 0 && billQ.items!(withBill).length === 1);
expect('student income falls back to what the data shows', analyse({ ...BLANK_ANSWERS, incomeTypes: ['student_loan'] }, [txn('2026-10-05', 'BAR WAGES', 300), ...month], '2026-10-29').summary.monthlyIn > 1);

// ---- What we don't know stays unknown ----
console.log('\n=== Unknowns');
const seen = (a = BLANK_ANSWERS, known: string[] = []) => analyse(a, estimateFromAnswers(a, TODAY), TODAY, { known, estimated: true });
const nobody = seen();
expect('no balance or income means no judgement on risk', !nobody.gaps.canJudge && nobody.gaps.balance && nobody.gaps.income);
expect('no safe days are invented', nobody.bufferDays === null && safeDays(nobody, nobody.forecast, 0) === null);
expect('a blank person isn’t told they have no safety buffer', !nobody.problems.some((p) => p.id === 'buffer'));
expect('a blank person has no scores for what we can’t see', !nobody.fingerprint.some((d) => ['steady', 'room', 'buffer'].includes(d.id)) && nobody.groups.length === 0);
const balanceOnly = seen({ ...BLANK_ANSWERS, balance: 1200 }, ['balance', 'monthlyIncome']);
expect('a balance with no known costs doesn’t become 1,200 safe days', balanceOnly.gaps.canJudge && balanceOnly.bufferDays === null);
const coreKnown = seen({ ...BLANK_ANSWERS, balance: 1200, housingCost: 600, foodWeekly: 50, monthlyIncome: 1500 }, ['balance', 'monthlyIncome', 'housingCost', 'foodWeekly']);
expect('rent and food known gives safe days, and names what’s still missing', coreKnown.bufferDays !== null && coreKnown.bufferDays > 0 && coreKnown.gaps.costs.includes('energy') && !coreKnown.gaps.costs.includes('food'));
const noIncome = analyse({ ...BLANK_ANSWERS, balance: 500 }, month, TODAY, { known: ['balance'] });
expect('no income seen isn’t “essentials take 100% of your income”', !noIncome.problems.some((p) => p.id === 'essentials') && !noIncome.groups.some((g) => g.id === 'stretched'));
const factsFor = (an: ReturnType<typeof analyse>, estimated = true) => buildFacts({ name: 'Sam', answers: BLANK_ANSWERS, txns: [], estimated, newestBankDate: null, known: [], rules: {}, confirmed: [] }, an, an.forecast, []);
const blankWords = templates(factsFor(nobody));
expect('nothing reassuring is said about nobody', !/steady|nice work/i.test(`${blankWords.predict} ${blankWords.detect}`), blankWords.predict);
expect('and no risk number is given', !/\d+%/.test(blankWords.predict) && /your balance and your income/.test(blankWords.predict));
expect('the coach says the same', !/steady|\d+%/.test(rulesAnswer('when could I run out of money?', factsFor(nobody), [])) && /can’t work out/.test(rulesAnswer('how many safe days?', factsFor(nobody), [])));
const coreWords = templates(factsFor(coreKnown));
expect('with costs missing, it doesn’t say steady', !/steady/i.test(coreWords.predict) && /energy/.test(coreWords.predict), coreWords.predict);
expect('a purchase verdict names the missing costs', /energy/.test(affordVerdict({ amount: '£20', riskBefore: '1%', riskAfter: '2%', safe: true, unknownCosts: ['energy'] })));
expect('and says it can’t judge without the basics', /your income/.test(cantJudgeYet(missingBasics({ notKnownYet: { balance: false, income: true, costs: [] } }))));
const salaried = analyse({ ...BLANK_ANSWERS, balance: 500 }, [...['2026-08-28', '2026-09-28', '2026-10-28'].map((d) => txn(d, 'ACME SALARY', 1500)), ...month], '2026-11-01', { known: ['balance'] });
expect('someone paid monthly isn’t told their income swings', !salaried.groups.some((g) => g.id === 'juggler') && salaried.fingerprint.find((d) => d.id === 'steady')?.detail === 'Paid on a regular schedule');

// ---- Cash flow the forecast can expect ----
console.log('\n=== Everyday cash flow');
const poolOf = (txns: Txn[], today: string) => {
  const an = analyse(BLANK_ANSWERS, txns, today);
  return an.inputs.pool.flat().reduce((s, d) => s + d.other, 0);
};
const daily = Array.from({ length: 60 }, (_, i) => txn(addDays('2026-08-01', i), 'TESCO', -10));
const spendOnly = poolOf(daily, '2026-10-01');
expect('small transfers out are counted', Math.abs(poolOf([...daily, txn('2026-09-10', 'J SMITH', -40)], '2026-10-01') - spendOnly - 40) < 0.01);
expect('small transfers in are counted', Math.abs(poolOf([...daily, txn('2026-09-10', 'J SMITH', 40)], '2026-10-01') - spendOnly + 40) < 0.01);
expect('refunds are counted', Math.abs(poolOf([...daily, txn('2026-09-10', 'ASOS REFUND', 30)], '2026-10-01') - spendOnly + 30) < 0.01);
expect('a big one-off in isn’t expected again', Math.abs(poolOf([...daily, txn('2026-09-10', 'J SMITH', 2000)], '2026-10-01') - spendOnly) < 0.01);
expect('a big one-off out isn’t expected again', Math.abs(poolOf([...daily, txn('2026-09-10', 'GARAGE', -900)], '2026-10-01') - spendOnly) < 0.01);
expect('moves to savings aren’t spending', Math.abs(poolOf([...daily, txn('2026-09-10', 'TO SAVINGS', -100)], '2026-10-01') - spendOnly) < 0.01);
const unevenPay = ['2026-08-03', '2026-08-24', '2026-08-31', '2026-09-19', '2026-09-26'].map((d) => txn(d, 'NORTHERN STAFFING', 420));
const unevenPool = analyse(BLANK_ANSWERS, [...daily, ...unevenPay], '2026-10-01');
expect('agency pay at uneven dates isn’t lost', !unevenPool.recurring.some((r) => r.direction === 'in') && Math.abs(unevenPool.inputs.pool.flat().reduce((s, d) => s + d.other, 0) - spendOnly + 2100) < 0.01);
expect('so the forecast shows that money coming in', unevenPool.forecast.endP50 > analyse(BLANK_ANSWERS, daily, '2026-10-01').forecast.endP50 + 1000);
const namedPay = ['2026-08-20', '2026-09-20'].map((d) => txn(d, 'ACME WAGES', 800));
expect('named wages count from the second payment', Math.abs(poolOf([...daily, ...namedPay.slice(0, 1)], '2026-10-01') - spendOnly) < 0.01);
const stoppedPay = ['2026-08-03', '2026-08-10', '2026-08-17'].map((d) => txn(d, 'OLD JOB WAGES', 200));
expect('money from someone who’s stopped paying isn’t expected', Math.abs(poolOf([...daily, ...stoppedPay], '2026-10-01') - spendOnly) < 0.01);
const threePay = ['2026-08-03', '2026-08-31', '2026-09-28'].map((d) => txn(d, 'ACME WAGES', 1100));
expect('three 4-weekly wages are spotted', analyse(BLANK_ANSWERS, [...daily, ...threePay], '2026-10-01').recurring.some((r) => r.direction === 'in' && r.everyDays === 28));

console.log('\n=== Winter energy');
const flat = (label: string, amounts: [string, number][]) => amounts.map(([d, a]) => txn(d, label, a));
const dd = flat('OCTOPUS ENERGY', [['2026-08-10', -90], ['2026-09-10', -90], ['2026-10-10', -90]]);
const ddRun = analyse(BLANK_ANSWERS, dd, '2026-11-01').forecast.days.flatMap((d) => d.events).filter((e) => e.category === 'energy');
expect('a fixed Direct Debit stays the same in winter', ddRun.length > 0 && ddRun.every((e) => Math.abs(e.amount + 90) < 0.01));
const topUps = Array.from({ length: 12 }, (_, i) => txn(addDays('2026-08-03', i * 7), 'PREPAY POWER', -20));
const topRun = analyse(BLANK_ANSWERS, topUps, '2026-10-26').forecast.days.flatMap((d) => d.events.map((e) => ({ ...e, date: d.date }))).filter((e) => e.category === 'energy');
expect('meter top-ups cost more in winter', topRun.find((e) => e.date.startsWith('2026-12'))!.amount < -25 && topRun.find((e) => e.date.startsWith('2026-10'))!.amount === -20);
const winterTops = analyse(BLANK_ANSWERS, [txn('2026-12-01', 'COFFEE SHOP', -1), txn('2026-12-08', 'EDF ENERGY', -26), txn('2026-12-20', 'COFFEE SHOP', -1)], '2026-12-30').inputs.pool.flat().reduce((s, d) => s + d.energy, 0);
expect('winter spending isn’t counted as winter twice', Math.abs(winterTops - 20) < 0.01, String(winterTops));

// ---- Back-test ----
console.log('\n=== Back-test');
const bt = backtest(getPersonas()[1].txns, { closing: getPersonas()[1].answers.balance });
expect('back-test runs and reports percentages only', bt.horizons.length > 0 && bt.horizons.every((r) => Number.isInteger(r.medianErrorPct) && Number.isInteger(r.biasPct) && r.points > 0));
expect('with too little history it says nothing', backtest(month).horizons.length === 0);
const walk = Array.from({ length: 200 }, (_, i) => txn(addDays('2026-01-01', i), 'TESCO', -20));
const steady = backtest(walk, { horizons: [14] });
expect('a perfectly steady person is forecast closely', steady.horizons.length === 1 && steady.horizons[0].medianErrorPct <= 2 && Math.abs(steady.horizons[0].biasPct) <= 2, JSON.stringify(steady.horizons));
expect('without a balance, risk isn’t tested', steady.risk === null);
// Steady spending from a closing balance that crosses £0 near the end, so warnings can be checked exactly.
const crossing = backtest(walk, { closing: -1000, horizons: [14] });
expect('real balances are worked back from the closing balance', crossing.risk !== null && crossing.risk.points > 0 && crossing.risk.wentBelow > 0);
expect('when money runs out, it was seen coming', crossing.risk !== null && crossing.risk.hits === crossing.risk.wentBelow && crossing.risk.hits <= crossing.risk.warnings);
expect('days already below £0 aren’t counted as predictions', crossing.risk !== null && crossing.risk.alreadyBelow > 0);
const oneOffBig = backtest([...walk, txn('2026-05-20', 'GARAGE', -1500)], { horizons: [30] });
expect('a big one-off shows up as something the forecast didn’t predict', oneOffBig.unseen !== null && oneOffBig.unseen.oneOffsPct >= 0 && oneOffBig.horizons[0].biasPct >= 0, JSON.stringify(oneOffBig.unseen));
// A £9,000 surprise near the end only hurts the few test dates just before it. If forecasts could see it coming, they'd all shift.
const noPeek = backtest([...walk, txn('2026-07-15', 'FUTURE PAY', 9000)], { horizons: [7] });
expect('a forecast can’t see the future', noPeek.horizons[0].points === backtest(walk, { horizons: [7] }).horizons[0].points && noPeek.horizons[0].medianErrorPct <= 2, JSON.stringify(noPeek.horizons));

// ---- Other ----
console.log('\n=== Other');
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
  expect(`trend ${p.name}: no current month, up to 6 full months`, tr.length > 0 && tr.every((t) => t.months.length <= 6 && t.months.every((m) => m.month < '2026-11')));
}
expect('json: chatter around JSON', extractJson<{ a: number }>('Sure {not json} here: {"a": 1,} done')?.a === 1);

// ---- Community Pulse: topic rules, privacy cleaning, counts ----
console.log('\n=== Community Pulse');
expect('topics: prepayment meter -> energy', classify('Prepayment meter eating £15 a week').includes('energy'));
expect('topics: overdraft + credit card -> debt', classify('Overdraft and credit card debt').join() === 'debt');
expect('topics: rent arrears -> rent', classify('Rent arrears letter from my landlord').includes('rent'));
expect('topics: unrelated -> none', classify('What is the best ISA for my holiday?').length === 0);
expect('clean: email, phone, postcode, user, link removed', cleanText('Mail a@b.com or 07700 900123, LS9 8AB, ask u/someone https://x.y/z', 200) === 'Mail [email] or [phone], [postcode], ask [user] [link]');
expect('clean: long text cut', cleanText('a'.repeat(50), 10).length === 10);
expect('samples: every post has a topic', SAMPLE_COMMUNITY_POSTS.every((p) => p.topics.length > 0));
const pulse = buildPulse(SAMPLE_COMMUNITY_POSTS, TODAY);
console.log(`pulse: ${pulse.total} posts; ${pulse.topics.map((t) => `${t.label} ${t.share}% (${t.change30 >= 0 ? '+' : ''}${t.change30})`).join(' | ')}`);
expect('pulse: 6 months, counts add up', pulse.months.length === 6 && pulse.topics.every((t) => t.posts === SAMPLE_COMMUNITY_POSTS.filter((p) => p.topics.includes(t.id)).length));
for (const p of getPersonas()) {
  const an = analyse(p.answers, p.txns, TODAY);
  console.log(`for you ${p.name}: ${topicsForUser(an.problems, an.groups.map((g) => g.id)).join(', ')}`);
}

// Reddit feed reader: an entry in the exact format Reddit's RSS returns (made-up text).
const feed = `<feed><entry><author><name>/u/Some_User_12</name><uri>https://www.reddit.com/user/Some_User_12</uri></author><category term="UKPersonalFinance" label="r/UKPersonalFinance"/><content type="html">&lt;!-- SC_OFF --&gt;&lt;div class=&quot;md&quot;&gt;&lt;p&gt;Energy &amp;amp; rent are up. I&amp;#39;m stuck.&lt;br/&gt; Any tips?&lt;/p&gt; &lt;/div&gt;&lt;!-- SC_ON --&gt; &amp;#32; submitted by &amp;#32; &lt;a href=&quot;https://www.reddit.com/user/Some_User_12&quot;&gt; /u/Some_User_12 &lt;/a&gt; &lt;br/&gt; &lt;span&gt;&lt;a href=&quot;x&quot;&gt;[link]&lt;/a&gt;&lt;/span&gt;</content><id>t3_abc123</id><link href="https://www.reddit.com/r/UKPersonalFinance/comments/abc123/x/" /><updated>2026-05-06T10:37:41+00:00</updated><published>2026-05-06T10:37:41+00:00</published><title>Bills &amp;amp; rent help</title></entry></feed>`;
const [entry] = parseAtom(feed);
expect('feed: id, author, community, time, link', entry?.id === 't3_abc123' && entry.author === 'Some_User_12' && entry.community === 'r/UKPersonalFinance' && entry.postedAt === '2026-05-06T10:37:41+00:00' && entry.url.endsWith('/abc123/x/'));
expect('feed: title decoded', entry?.title === 'Bills & rent help');
expect('feed: body text without footer', htmlToText(entry?.html ?? '') === "Energy & rent are up. I'm stuck.\n Any tips?");
