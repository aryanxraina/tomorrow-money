import type { Answers, Category, Txn } from '../types';
import { addDays, weekday } from './dates';
import { ESSENTIAL } from './categorise';
import { dataWindow } from './prepare';

export interface Summary {
  windowDays: number;
  monthlyIn: number;
  /** Refunds and money from other people. Shown separately, because it isn't income. */
  otherMoneyIn: number;
  monthlyOut: number;
  byCategory: { category: Category; monthly: number }[];
  essentialsMonthly: number;
  essentialsRatio: number;
  incomeWeeklyCV: number;
  debtMonthly: number;
  feesMonthly: number;
  last30: { in: number; out: number };
}

const WINDOW = 91;

export function summarise(txns: Txn[], today: string, answers: Answers): Summary {
  const { from, to, days } = dataWindow(txns, today, WINDOW);
  const recent = txns.filter((t) => t.date >= from && t.date < to && t.source !== 'receipt' && t.category !== 'internal');
  const k = 30.4 / days;
  let inc = 0;
  let other = 0;
  let out = 0;
  const cat = new Map<Category, number>();
  for (const t of recent) {
    if (t.amount > 0) {
      if (t.category === 'income') inc += t.amount;
      else other += t.amount; // refunds, or money from people: not income
    } else {
      out += -t.amount;
      cat.set(t.category, (cat.get(t.category) || 0) - t.amount);
    }
  }
  const byCategory = [...cat.entries()]
    .map(([category, v]) => ({ category, monthly: v * k }))
    .sort((a, b) => b.monthly - a.monthly);
  const essentialsMonthly = byCategory.filter((c) => ESSENTIAL.includes(c.category)).reduce((a, c) => a + c.monthly, 0);
  // For lump-sum income (student loans) the window can mislead, so what the person says comes first if they've said.
  const monthlyIn = answers.incomeTypes.includes('student_loan') && answers.monthlyIncome > 0 ? answers.monthlyIncome : inc * k || answers.monthlyIncome;

  // weekly income volatility (coefficient of variation)
  const weekCount = Math.max(1, Math.ceil(days / 7));
  const weeks = new Array(weekCount).fill(0);
  for (const t of recent) {
    if (t.amount <= 0 || t.category !== 'income') continue;
    const idx = Math.floor((new Date(t.date).getTime() - new Date(from).getTime()) / (7 * 86400000));
    if (idx >= 0 && idx < weekCount) weeks[idx] += t.amount;
  }
  const mean = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  const sd = Math.sqrt(weeks.reduce((a, b) => a + (b - mean) ** 2, 0) / weeks.length);
  const last30from = addDays(to, -30);
  const last30 = recent
    .filter((t) => t.date >= last30from)
    .reduce((a, t) => (t.amount > 0 ? { ...a, in: a.in + t.amount } : { ...a, out: a.out - t.amount }), { in: 0, out: 0 });
  return {
    windowDays: days,
    monthlyIn,
    otherMoneyIn: other * k,
    monthlyOut: out * k,
    byCategory,
    essentialsMonthly,
    essentialsRatio: monthlyIn > 0 ? essentialsMonthly / monthlyIn : 1,
    incomeWeeklyCV: mean > 0 ? sd / mean : 1,
    debtMonthly: (cat.get('debt') || 0) * k,
    feesMonthly: (cat.get('fees') || 0) * k,
    last30,
  };
}

export interface CategoryTrend {
  category: Category;
  months: { month: string; amount: number }[];
  /** Change from the month before last to the last full month, in %. Null if there's nothing to compare. */
  changePct: number | null;
}

/** Spending per full calendar month for the biggest categories. The current part-month is left out. */
export function categoryTrends(txns: Txn[], today: string, top = 4, maxMonths = 6): CategoryTrend[] {
  const thisMonth = today.slice(0, 7);
  const totals = new Map<Category, Map<string, number>>();
  const seen = new Set<string>();
  for (const t of txns) {
    const month = t.date.slice(0, 7);
    if (t.source === 'receipt' || t.amount >= 0 || t.category === 'internal' || month >= thisMonth) continue;
    seen.add(month);
    const byMonth = totals.get(t.category) ?? new Map<string, number>();
    byMonth.set(month, (byMonth.get(month) || 0) - t.amount);
    totals.set(t.category, byMonth);
  }
  // The first month of history is often partial, so it is dropped when there's enough to compare.
  const all = [...seen].sort();
  const months = (all.length > 2 ? all.slice(1) : all).slice(-maxMonths);
  const sumOf = (m: Map<string, number>) => months.reduce((s, x) => s + (m.get(x) || 0), 0);
  return [...totals.entries()]
    .sort((a, b) => sumOf(b[1]) - sumOf(a[1]))
    .slice(0, top)
    .map(([category, byMonth]) => {
      const series = months.map((month) => ({ month, amount: Math.round(byMonth.get(month) || 0) }));
      const [prev, last] = [series.at(-2)?.amount, series.at(-1)?.amount];
      return { category, months: series, changePct: prev && last !== undefined ? Math.round(((last - prev) / prev) * 100) : null };
    });
}

export interface FingerprintDim {
  id: string;
  label: string;
  score: number; // 0-100, higher = stronger
  detail: string;
}

export interface Group {
  id: 'juggler' | 'lump_sum' | 'stretched' | 'catching_up' | 'newcomer' | 'fixed_cautious' | 'builder';
  label: string;
  why: string;
  adapts: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Scores are only given for what we can see: no income means no income scores, rather than a score of zero. */
export function fingerprint(s: Summary, a: Answers, bufferDays: number | null, premiumAnnual: number, regularIncome = false): FingerprintDim[] {
  const uneven = a.incomeTypes.includes('gig') || a.incomeTypes.includes('zero_hours') || a.incomeTypes.includes('student_loan');
  let steady = 100 - s.incomeWeeklyCV * 110;
  if (a.incomeTypes.includes('gig') || a.incomeTypes.includes('zero_hours')) steady = Math.min(steady, 45);
  if (a.incomeTypes.includes('student_loan')) steady = Math.min(steady, 40);
  if (a.incomeTypes.includes('salary') || a.incomeTypes.includes('pension')) steady = Math.max(steady, 80);
  else if (a.incomeTypes.includes('four_weekly') || a.incomeTypes.includes('benefits') || (regularIncome && !uneven)) steady = Math.max(steady, 70);
  const debtShare = s.monthlyIn ? s.debtMonthly / s.monthlyIn : 0;
  let debt = 100 - debtShare * 400;
  if (a.debts.includes('payday') || a.debts.includes('arrears')) debt -= 25;
  const dims: FingerprintDim[] = [];
  if (s.monthlyIn > 0) {
    // Weekly variation is meaningless for someone paid monthly: their pay lands in one week out of four.
    dims.push({ id: 'steady', label: 'Steady income', score: clamp(steady), detail: uneven || !(regularIncome || isScheduled(a)) ? `Weekly income varies by ${Math.round(s.incomeWeeklyCV * 100)}%` : 'Paid on a regular schedule' });
    dims.push({ id: 'room', label: 'Room left', score: clamp((1 - s.essentialsRatio) * 200), detail: `Essentials take ${Math.round(s.essentialsRatio * 100)}% of income` });
  }
  dims.push({ id: 'debt', label: 'Low debt', score: clamp(debt), detail: `Debt repayments £${Math.round(s.debtMonthly)}/month` });
  if (bufferDays !== null) dims.push({ id: 'buffer', label: 'Buffer', score: clamp((bufferDays / 60) * 100), detail: `${Math.round(bufferDays)} days of essentials covered` });
  dims.push({ id: 'fair', label: 'Low fees', score: clamp(100 - premiumAnnual / 6), detail: `£${Math.round(premiumAnnual)}/year in fees and charges` });
  dims.push({ id: 'access', label: 'Easy access', score: clamp(100 - a.barriers.length * 25), detail: a.barriers.length ? `${a.barriers.length} barrier(s) noted` : 'No barriers noted' });
  return dims;
}

const isScheduled = (a: Answers) => (['salary', 'four_weekly', 'benefits', 'pension', 'student_loan'] as const).some((t) => a.incomeTypes.includes(t));

export function groups(s: Summary, a: Answers, bufferDays: number | null, regularIncome = false): Group[] {
  const g: Group[] = [];
  if (a.debts.includes('payday') || a.debts.includes('arrears') || s.debtMonthly > s.monthlyIn * 0.15 || (s.feesMonthly > 5 && a.debts.length > 0))
    g.push({ id: 'catching_up', label: 'Catching up', why: 'Debt repayments or fees are eating into your money', adapts: 'We put the cheapest way out of debt first and point you to free advice' });
  const scheduled = regularIncome || isScheduled(a);
  if (a.incomeTypes.includes('gig') || a.incomeTypes.includes('zero_hours') || (s.monthlyIn > 0 && !scheduled && s.incomeWeeklyCV > 0.35))
    g.push({ id: 'juggler', label: 'Juggler', why: 'Your income changes from week to week', adapts: 'Weekly budgets and a "pay yourself a steady wage" smoother' });
  if (a.incomeTypes.includes('student_loan'))
    g.push({ id: 'lump_sum', label: 'Lump-sum', why: 'Most of your money arrives in big chunks', adapts: 'We show how many weeks your money will last' });
  if (s.monthlyIn > 0 && s.essentialsRatio > 0.7)
    g.push({ id: 'stretched', label: 'Stretched', why: `Essentials take ${Math.round(s.essentialsRatio * 100)}% of your income`, adapts: 'We hunt for savings on essentials and support you may be missing' });
  if (a.barriers.includes('language') || a.barriers.includes('new_to_uk') || a.barriers.includes('no_bank_history'))
    g.push({ id: 'newcomer', label: 'Newcomer', why: 'New to UK systems', adapts: 'Plain words, and how UK bills and rights work' });
  if (a.incomeTypes.includes('pension') || a.barriers.includes('low_digital') || a.barriers.includes('disability'))
    g.push({ id: 'fixed_cautious', label: 'Fixed & cautious', why: 'Fixed income or less confident online', adapts: 'Bigger text, fewer screens, and an optional trusted helper' });
  if ((!g.length && s.monthlyIn > 0) || (bufferDays !== null && bufferDays >= 30 && s.monthlyIn > 0 && s.essentialsRatio < 0.6 && !a.debts.includes('payday')))
    g.push({ id: 'builder', label: 'Builder', why: 'You have some room to grow your safety net', adapts: 'Saving goals and, once ready, learning how investing works' });
  return g;
}

export function weekdayName(d: string) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(d)];
}
