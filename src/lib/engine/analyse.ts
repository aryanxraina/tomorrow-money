import type { Answers, Txn } from '../types';
import { addDays, diffDays } from './dates';
import { detectProblems, estimateSelfAssessment, type Problem, type TaxEstimate } from './detect';
import { buildDayPool, runForecast, type Adjust, type Forecast, type KnownItem } from './forecast';
import { buildActions, combineAdjust, type Action } from './plan';
import { detectRecurring, merchantKey, type Recurring } from './recurring';
import { findSupport, type SupportItem } from './support';
import { fingerprint, groups, summarise, type FingerprintDim, type Group, type Summary } from './understand';

export interface Analysis {
  today: string;
  balance: number;
  summary: Summary;
  recurring: Recurring[];
  fingerprint: FingerprintDim[];
  groups: Group[];
  problems: Problem[];
  premiumAnnual: number;
  support: SupportItem[];
  supportMonthly: number;
  supportOneOff: number;
  tax: TaxEstimate | null;
  known: KnownItem[];
  forecast: Forecast;
  upcoming: { date: string; label: string; amount: number }[];
  actions: Action[];
  bufferDays: number;
  dailyEssentials: number;
  inputs: { recurring: Recurring[]; pool: ReturnType<typeof buildDayPool>; known: KnownItem[] };
}

export function analyse(answers: Answers, txns: Txn[], today: string): Analysis {
  const balance = answers.balance;
  const summary = summarise(txns, today, answers);
  const recurring = detectRecurring(txns, today);
  const recKeys = new Set(recurring.map((r) => r.key));
  const keyOf = (t: Txn) => merchantKey(t.description) + (t.amount > 0 ? '|in' : '|out');
  const pool = buildDayPool(txns, today, recKeys, keyOf);
  const dailyEssentials = Math.max(1, summary.essentialsMonthly / 30.4);
  const bufferDays = Math.max(0, balance + answers.savings) / dailyEssentials;
  const tax = estimateSelfAssessment(txns, today, answers);

  const known: KnownItem[] = [
    ...answers.yearlyBills.map((b) => ({ date: b.date, amount: -Math.abs(b.amount), label: b.label })),
    ...answers.futureIncome.map((b) => ({ date: b.date, amount: Math.abs(b.amount), label: b.label, category: 'income' as const })),
  ];
  if (tax && tax.total > 0) known.push({ date: tax.due, amount: -tax.total, label: 'Self Assessment tax bill (estimate)', category: 'tax' });

  const problems = detectProblems(txns, today, answers, summary, recurring, bufferDays, tax);
  const premiumAnnual = problems.filter((p) => p.premium && p.annualCost).reduce((x, p) => x + (p.annualCost || 0), 0);
  const support = findSupport(answers, summary, problems, txns);
  const supportMonthly = support.reduce((x, s) => x + (s.estMonthly || 0), 0);
  const supportOneOff = support.reduce((x, s) => x + (s.oneOff || 0), 0);
  const forecast = runForecast({ start: today, balance, recurring, pool, known, days: 90 });
  const upcoming = forecast.days
    .slice(0, 60)
    .flatMap((d) => d.events.map((e) => ({ date: d.date, label: e.label, amount: e.amount })))
    .filter((e) => e.amount < 0 || Math.abs(e.amount) > 500)
    .filter((e) => Math.abs(e.amount) >= 8);
  const actions = buildActions(answers, today, problems, support, recurring, txns, tax);
  const fp = fingerprint(summary, answers, bufferDays, premiumAnnual);
  const g = groups(summary, answers, bufferDays);
  return {
    today,
    balance,
    summary,
    recurring,
    fingerprint: fp,
    groups: g,
    problems,
    premiumAnnual,
    support,
    supportMonthly,
    supportOneOff,
    tax,
    known,
    forecast,
    upcoming,
    actions,
    bufferDays,
    dailyEssentials,
    inputs: { recurring, pool, known },
  };
}

/** Re-run the forecast with changes (a plan, a purchase, a shock). */
export function whatIf(an: Analysis, adjust: Adjust, extraBalance = 0): Forecast {
  return runForecast({
    start: an.today,
    balance: an.balance + extraBalance,
    recurring: an.inputs.recurring,
    pool: an.inputs.pool,
    known: an.inputs.known,
    adjust,
    days: 90,
  });
}

export function planForecast(an: Analysis, selected: Action[]) {
  return whatIf(an, combineAdjust(selected));
}

/** "Safe days": how long savings + balance could cover essentials if income stopped. */
export function safeDays(an: Analysis, f: Forecast, savings: number, atDay = 89) {
  const v = f.days[Math.min(atDay, f.days.length - 1)].p50 + savings;
  return Math.max(0, v) / an.dailyEssentials;
}

export function affordability(an: Analysis, amount: number, date: string) {
  // Risk is judged over the purchase date plus the 30 days after it, so a later date can't "hide" a crunch.
  const offset = (d: string) => Math.max(0, diffDays(d, an.today));
  const riskOver = (f: Forecast, d: string) => Math.max(...f.days.slice(0, Math.min(f.days.length, offset(d) + 31)).map((x) => x.pBelow0));
  const buyOn = (d: string) => whatIf(an, { extra: [{ date: d, amount: -Math.abs(amount), label: 'Planned purchase' }] });
  const after = buyOn(date);
  let best = { date, risk: riskOver(after, date) };
  for (let i = 1; i <= 30; i += 1) {
    const d = addDays(an.today, i);
    const risk = riskOver(buyOn(d), d);
    if (risk + 0.03 < best.risk) best = { date: d, risk };
  }
  return {
    amount,
    date,
    riskBefore: riskOver(an.forecast, date),
    riskAfter: riskOver(after, date),
    lowestAfter: after.lowestP50,
    saferDate: best.date !== date ? best : null,
    daysUntilSafer: best.date !== date ? diffDays(best.date, an.today) : 0,
  };
}

/** Build a 13-week history from questionnaire answers when no bank data is connected. */
export function estimateFromAnswers(a: Answers, today: string): Txn[] {
  const t: Txn[] = [];
  let n = 0;
  const add = (date: string, description: string, amount: number, category: Txn['category']) => {
    if (date >= today) return;
    t.push({ id: `est-${n++}`, date, description, amount, category, source: 'estimate' });
  };
  const start = addDays(today, -91);
  const monthlyOn = (dom: number, fn: (d: string) => void) => {
    for (let d = start; d < today; d = addDays(d, 1)) if (Number(d.slice(8, 10)) === dom) fn(d);
  };
  const weeklyOn = (offset: number, fn: (d: string, i: number) => void) => {
    let i = 0;
    for (let d = addDays(start, offset); d < today; d = addDays(d, 7)) fn(d, i++);
  };
  const inc = a.monthlyIncome;
  const types = a.incomeTypes.length ? a.incomeTypes : ['salary'];
  const share = inc / types.filter((x) => x !== 'student_loan').length || 0;
  for (const ty of types) {
    if (ty === 'salary' || ty === 'pension' || ty === 'benefits') monthlyOn(ty === 'benefits' ? 14 : 28, (d) => add(d, `${ty.toUpperCase()} INCOME`, share, 'income'));
    if (ty === 'four_weekly') for (let d = addDays(start, 3); d < today; d = addDays(d, 28)) add(d, 'WAGES', share * (28 / 30.4), 'income');
    if (ty === 'gig' || ty === 'zero_hours') weeklyOn(2, (d, i) => add(d, `${ty === 'gig' ? 'GIG' : 'AGENCY'} PAYOUT`, ((share * 7) / 30.4) * (0.7 + ((i * 37) % 60) / 100), 'income'));
  }
  if (a.housingCost) monthlyOn(1, (d) => add(d, 'RENT', -a.housingCost, 'housing'));
  if (a.councilTaxMonthly && !a.allStudents) monthlyOn(1, (d) => add(d, 'COUNCIL TAX', -a.councilTaxMonthly, 'council_tax'));
  if (a.energyPayment === 'prepayment') weeklyOn(1, (d) => add(d, 'ENERGY TOPUP', -22, 'energy'));
  if (a.energyPayment === 'direct_debit') monthlyOn(10, (d) => add(d, 'ENERGY DD', -95, 'energy'));
  monthlyOn(12, (d) => add(d, 'PHONE', -20, 'broadband_phone'));
  if (a.debtRepayMonthly) monthlyOn(20, (d) => add(d, 'DEBT REPAYMENT', -a.debtRepayMonthly, 'debt'));
  weeklyOn(0, (d, i) => add(d, 'GROCERIES', -a.foodWeekly * (0.65 + ((i * 13) % 20) / 100), 'groceries'));
  weeklyOn(3, (d, i) => add(d, 'GROCERIES TOP-UP', -a.foodWeekly * (0.25 + ((i * 7) % 10) / 100), 'groceries'));
  // assumption: other everyday spending (travel, toiletries, clothes) about 12% of income, shown as an estimate
  weeklyOn(5, (d, i) => add(d, 'EVERYDAY SPENDING (ESTIMATE)', -((inc * 0.12 * 7) / 30.4) * (0.8 + ((i * 11) % 40) / 100), 'shopping'));
  return t;
}
