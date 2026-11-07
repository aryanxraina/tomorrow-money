import type { Answers, Category, ConfirmedSupport, Txn } from '../types';
import { addDays, addMonths, diffDays } from './dates';
import { detectProblems, estimateSelfAssessment, type Problem, type TaxEstimate } from './detect';
import { buildDayPool, runForecast, type Adjust, type Forecast, type KnownItem } from './forecast';
import { buildActions, combineAdjust, type Action } from './plan';
import { prepareTxns } from './prepare';
import { detectRecurring, paysCouncilTaxOver12, txnKey, type Recurring } from './recurring';
import { findSupport, type SupportItem } from './support';
import { fingerprint, groups, summarise, type FingerprintDim, type Group, type Summary } from './understand';

export interface Analysis {
  today: string;
  balance: number;
  /** Transactions after corrections and clean-up: what every figure here is worked out from. */
  txns: Txn[];
  summary: Summary;
  recurring: Recurring[];
  fingerprint: FingerprintDim[];
  groups: Group[];
  problems: Problem[];
  premiumAnnual: number;
  support: SupportItem[];
  tax: TaxEstimate | null;
  known: KnownItem[];
  forecast: Forecast;
  upcoming: { date: string; label: string; amount: number; category?: Category }[];
  actions: Action[];
  /** Safe days now, or null when we don't know enough to say. */
  bufferDays: number | null;
  dailyEssentials: number;
  ctAlready12: boolean;
  gaps: Gaps;
  inputs: { recurring: Recurring[]; pool: ReturnType<typeof buildDayPool>; known: KnownItem[] };
}

export interface AnalyseOptions {
  /** The person's own category corrections, by merchant. */
  rules?: Record<string, Category>;
  /** Help they've confirmed getting. The only support money the forecast counts. */
  confirmed?: ConfirmedSupport[];
  /** Which answers they actually gave, as opposed to fields that were left blank. */
  known?: string[];
  /** True when the transactions are worked out from their answers because there's no bank data. */
  estimated?: boolean;
}

/** What we don't know yet. A blank answer would otherwise read as £0, and £0 is a claim. */
export interface Gaps {
  balance: boolean;
  income: boolean;
  /** Costs that are missing from an estimate, so it may look better than it really is. */
  costs: string[];
  /** Without a starting balance and income, there's nothing to say about going below £0. */
  canJudge: boolean;
  /** Safe days need a balance and, in an estimate, the two biggest essentials. */
  safeDays: boolean;
}

const NO_GAPS: Gaps = { balance: false, income: false, costs: [], canJudge: true, safeDays: true };

export function findGaps(a: Answers, known: string[], estimated: boolean): Gaps {
  const balance = !known.includes('balance');
  const income = estimated && !known.includes('monthlyIncome');
  return {
    balance,
    income,
    costs: estimated ? missingCosts(a, known) : [],
    canJudge: !balance && !income,
    safeDays: !balance && (!estimated || (known.includes('housingCost') && known.includes('foodWeekly'))),
  };
}

/** Monthly and one-off amounts from confirmed help, as dated items in the 90-day forecast. */
function confirmedItems(confirmed: ConfirmedSupport[], today: string): KnownItem[] {
  const items: KnownItem[] = [];
  for (const c of confirmed) {
    if (c.monthly > 0) {
      for (let i = 1; i <= 3; i++) items.push({ date: addMonths(today, i, 1), amount: c.monthly, label: `${c.title} (confirmed)`, category: 'income' });
    }
    if (c.oneOff > 0 && c.oneOffDate && c.oneOffDate >= today) items.push({ date: c.oneOffDate, amount: c.oneOff, label: `${c.title} (confirmed)`, category: 'income' });
  }
  return items;
}

export function analyse(answers: Answers, rawTxns: Txn[], today: string, opts: AnalyseOptions = {}): Analysis {
  const confirmed = opts.confirmed ?? [];
  const txns = prepareTxns(rawTxns, opts.rules ?? {}, today);
  const balance = answers.balance;
  const summary = summarise(txns, today, answers);
  const recurring = detectRecurring(txns, today);
  const recKeys = new Set(recurring.map((r) => r.key));
  const pool = buildDayPool(txns, today, recKeys, txnKey);
  const gaps = opts.known ? findGaps(answers, opts.known, !!opts.estimated) : NO_GAPS;
  const dailyEssentials = Math.max(1, summary.essentialsMonthly / 30.4);
  const bufferDays = gaps.safeDays && summary.essentialsMonthly > 0 ? Math.max(0, balance + answers.savings) / dailyEssentials : null;
  const tax = estimateSelfAssessment(txns, today, answers);
  const ctAlready12 = answers.ctInstalments === 12 || paysCouncilTaxOver12(txns);

  const known: KnownItem[] = [
    ...answers.yearlyBills.map((b) => ({ date: b.date, amount: -Math.abs(b.amount), label: b.label })),
    ...answers.futureIncome.map((b) => ({ date: b.date, amount: Math.abs(b.amount), label: b.label, category: 'income' as const })),
    ...confirmedItems(confirmed, today),
  ];
  if (tax && tax.total > 0) known.push({ date: tax.due, amount: -tax.total, label: 'Self Assessment tax bill (estimate)', category: 'tax' });

  const problems = detectProblems(txns, today, answers, summary, recurring, bufferDays, tax);
  const premiumAnnual = problems.filter((p) => p.premium && p.annualCost).reduce((x, p) => x + (p.annualCost || 0), 0);
  const support = findSupport(answers, summary, problems, txns, opts.known ?? []);
  const forecast = runForecast({ start: today, balance, recurring, pool, known, days: 90, ctAlready12 });
  const upcoming = forecast.days
    .slice(0, 60)
    .flatMap((d) => d.events.map((e) => ({ date: d.date, label: e.label, amount: e.amount, category: e.category })))
    .filter((e) => e.amount < 0 || Math.abs(e.amount) > 500)
    .filter((e) => Math.abs(e.amount) >= 8);
  const actions = buildActions(answers, problems, support, recurring, tax, confirmed, ctAlready12);
  const regularIncome = recurring.some((r) => r.direction === 'in' && r.category === 'income');
  const fp = fingerprint(summary, answers, bufferDays, premiumAnnual, regularIncome);
  const g = groups(summary, answers, bufferDays, regularIncome);
  return {
    today,
    balance,
    txns,
    summary,
    recurring,
    fingerprint: fp,
    groups: g,
    problems,
    premiumAnnual,
    support,
    tax,
    known,
    forecast,
    upcoming,
    actions,
    bufferDays,
    dailyEssentials,
    ctAlready12,
    gaps,
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
    ctAlready12: an.ctAlready12,
  });
}

export function planForecast(an: Analysis, selected: Action[]) {
  return whatIf(an, combineAdjust(selected));
}

/** "Safe days": how long savings + balance could cover essentials if income stopped. Null if we can't say yet. */
export function safeDays(an: Analysis, f: Forecast, savings: number, atDay = 89): number | null {
  if (an.bufferDays === null) return null;
  const v = f.days[Math.min(atDay, f.days.length - 1)].p50 + savings;
  return Math.max(0, v) / an.dailyEssentials;
}

export function affordability(an: Analysis, amount: number, date: string) {
  // Risk is judged over the purchase date plus the 30 days after it, so a later date can't "hide" a crunch.
  const offset = (d: string) => Math.max(0, diffDays(d, an.today));
  const riskOver = (f: Forecast, d: string) => Math.max(...f.days.slice(0, Math.min(f.days.length, offset(d) + 31)).map((x) => x.pBelow0));
  const buyOn = (d: string) => whatIf(an, { extra: [{ date: d, amount: -Math.abs(amount), label: 'Planned purchase' }] });
  const after = buyOn(date);
  const riskAfter = riskOver(after, date);
  // Trying every date in full would be slow on a phone, so search quickly, then check the best one in full.
  let candidate: string | null = null;
  let lowest = riskAfter;
  for (let i = 1; i <= 30; i += 1) {
    const d = addDays(an.today, i);
    const quick = runForecast({ start: an.today, balance: an.balance, recurring: an.inputs.recurring, pool: an.inputs.pool, known: an.inputs.known, adjust: { extra: [{ date: d, amount: -Math.abs(amount), label: 'Planned purchase' }] }, days: 90, runs: 200, ctAlready12: an.ctAlready12 });
    const risk = riskOver(quick, d);
    if (risk < lowest) {
      lowest = risk;
      candidate = d;
    }
  }
  const confirmed = candidate ? riskOver(buyOn(candidate), candidate) : null;
  const saferDate = candidate && confirmed !== null && confirmed + 0.03 < riskAfter ? { date: candidate, risk: confirmed } : null;
  return {
    amount,
    date,
    riskBefore: riskOver(an.forecast, date),
    riskAfter,
    lowestAfter: after.lowestP50,
    saferDate,
    daysUntilSafer: saferDate ? diffDays(saferDate.date, an.today) : 0,
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
  const paying = types.filter((x) => x !== 'student_loan').length;
  const share = inc > 0 && paying > 0 ? inc / paying : 0;
  if (share > 0) {
    for (const ty of types) {
      if (ty === 'salary' || ty === 'pension' || ty === 'benefits') monthlyOn(a.payDay ?? (ty === 'benefits' ? 14 : 28), (d) => add(d, `${ty.toUpperCase()} INCOME`, share, 'income'));
      if (ty === 'four_weekly') for (let d = addDays(start, 3); d < today; d = addDays(d, 28)) add(d, 'WAGES', share * (28 / 30.4), 'income');
      if (ty === 'gig' || ty === 'zero_hours') weeklyOn(2, (d, i) => add(d, `${ty === 'gig' ? 'GIG' : 'AGENCY'} PAYOUT`, ((share * 7) / 30.4) * (0.7 + ((i * 37) % 60) / 100), 'income'));
    }
  }
  if (a.housingCost) monthlyOn(a.rentDay ?? 1, (d) => add(d, 'RENT', -a.housingCost, 'housing'));
  if (a.councilTaxMonthly && !a.allStudents) monthlyOn(1, (d) => add(d, 'COUNCIL TAX', -a.councilTaxMonthly, 'council_tax'));
  // Only what the person told us. An unknown cost stays out, and the app says the forecast may look too good.
  if (a.energyMonthly && a.energyPayment === 'prepayment') weeklyOn(1, (d) => add(d, 'ENERGY TOPUP', -(a.energyMonthly * 7) / 30.4, 'energy'));
  else if (a.energyMonthly && a.energyPayment !== 'included') monthlyOn(10, (d) => add(d, 'ENERGY', -a.energyMonthly, 'energy'));
  if (a.billsMonthly) monthlyOn(12, (d) => add(d, 'PHONE AND OTHER BILLS', -a.billsMonthly, 'broadband_phone'));
  if (a.debtRepayMonthly) monthlyOn(20, (d) => add(d, 'DEBT REPAYMENTS', -a.debtRepayMonthly, 'debt'));
  if (a.foodWeekly) {
    weeklyOn(0, (d, i) => add(d, 'FOOD SHOP', -a.foodWeekly * (0.65 + ((i * 13) % 20) / 100), 'groceries'));
    weeklyOn(3, (d, i) => add(d, 'FOOD TOP-UP', -a.foodWeekly * (0.25 + ((i * 7) % 10) / 100), 'groceries'));
  }
  if (a.otherWeekly) weeklyOn(5, (d, i) => add(d, 'EVERYDAY SPENDING', -a.otherWeekly * (0.8 + ((i * 11) % 40) / 100), 'shopping'));
  return t;
}

/** Costs the person hasn't told us about yet, so an estimated forecast may look better than it really is. */
export function missingCosts(a: Answers, known: string[]): string[] {
  const costs: [string, string][] = [
    ['housingCost', 'rent or mortgage'],
    ['councilTaxMonthly', 'council tax'],
    ['foodWeekly', 'food'],
    ['energyMonthly', 'energy'],
    ['billsMonthly', 'phone and other bills'],
    ['otherWeekly', 'everyday spending'],
  ];
  return costs.filter(([field]) => !known.includes(field) && !(field === 'energyMonthly' && a.energyPayment === 'included')).map(([, label]) => label);
}
