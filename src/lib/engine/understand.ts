import type { Answers, Category, Txn } from '../types';
import { addDays, weekday } from './dates';
import { ESSENTIAL } from './categorise';

export interface Summary {
  windowDays: number;
  monthlyIn: number;
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
  const from = addDays(today, -WINDOW);
  const recent = txns.filter((t) => t.date >= from && t.date < today && t.source !== 'receipt');
  const k = 30.4 / WINDOW;
  let inc = 0;
  let out = 0;
  const cat = new Map<Category, number>();
  for (const t of recent) {
    if (t.amount > 0) inc += t.amount;
    else {
      out += -t.amount;
      cat.set(t.category, (cat.get(t.category) || 0) - t.amount);
    }
  }
  const byCategory = [...cat.entries()]
    .map(([category, v]) => ({ category, monthly: v * k }))
    .sort((a, b) => b.monthly - a.monthly);
  const essentialsMonthly = byCategory.filter((c) => ESSENTIAL.includes(c.category)).reduce((a, c) => a + c.monthly, 0);
  // For lump-sum income (student loans) the 91-day window can mislead, so blend with the stated income.
  const monthlyIn = answers.incomeTypes.includes('student_loan') ? Math.max(answers.monthlyIncome, 1) : inc * k || answers.monthlyIncome;

  // weekly income volatility (coefficient of variation)
  const weeks = new Array(13).fill(0);
  for (const t of recent) {
    if (t.amount <= 0) continue;
    const idx = Math.floor((new Date(t.date).getTime() - new Date(from).getTime()) / (7 * 86400000));
    if (idx >= 0 && idx < 13) weeks[idx] += t.amount;
  }
  const mean = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  const sd = Math.sqrt(weeks.reduce((a, b) => a + (b - mean) ** 2, 0) / weeks.length);
  const last30from = addDays(today, -30);
  const last30 = recent
    .filter((t) => t.date >= last30from)
    .reduce((a, t) => (t.amount > 0 ? { ...a, in: a.in + t.amount } : { ...a, out: a.out - t.amount }), { in: 0, out: 0 });
  return {
    windowDays: WINDOW,
    monthlyIn,
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

export function fingerprint(s: Summary, a: Answers, bufferDays: number, premiumAnnual: number): FingerprintDim[] {
  let steady = 100 - s.incomeWeeklyCV * 110;
  if (a.incomeTypes.includes('gig') || a.incomeTypes.includes('zero_hours')) steady = Math.min(steady, 45);
  if (a.incomeTypes.includes('student_loan')) steady = Math.min(steady, 40);
  if (a.incomeTypes.includes('salary') || a.incomeTypes.includes('pension')) steady = Math.max(steady, 80);
  else if (a.incomeTypes.includes('four_weekly') || a.incomeTypes.includes('benefits')) steady = Math.max(steady, 70);
  const debtShare = s.monthlyIn ? s.debtMonthly / s.monthlyIn : 0;
  let debt = 100 - debtShare * 400;
  if (a.debts.includes('payday') || a.debts.includes('arrears')) debt -= 25;
  return [
    { id: 'steady', label: 'Steady income', score: clamp(steady), detail: `Weekly income varies by ${Math.round(s.incomeWeeklyCV * 100)}%` },
    { id: 'room', label: 'Room left', score: clamp((1 - s.essentialsRatio) * 200), detail: `Essentials take ${Math.round(s.essentialsRatio * 100)}% of income` },
    { id: 'debt', label: 'Low debt', score: clamp(debt), detail: `Debt repayments £${Math.round(s.debtMonthly)}/month` },
    { id: 'buffer', label: 'Buffer', score: clamp((bufferDays / 60) * 100), detail: `${Math.round(bufferDays)} days of essentials covered` },
    { id: 'fair', label: 'Fair prices', score: clamp(100 - premiumAnnual / 6), detail: `£${Math.round(premiumAnnual)}/year in extra costs` },
    { id: 'access', label: 'Easy access', score: clamp(100 - a.barriers.length * 25), detail: a.barriers.length ? `${a.barriers.length} barrier(s) noted` : 'No barriers noted' },
  ];
}

export function groups(s: Summary, a: Answers, bufferDays: number): Group[] {
  const g: Group[] = [];
  if (a.debts.includes('payday') || a.debts.includes('arrears') || s.debtMonthly > s.monthlyIn * 0.15 || (s.feesMonthly > 5 && a.debts.length > 0))
    g.push({ id: 'catching_up', label: 'Catching up', why: 'Debt repayments or fees are eating into your money', adapts: 'We put the cheapest way out of debt first and point you to free advice' });
  const scheduled = ['salary', 'four_weekly', 'benefits', 'pension', 'student_loan'].some((t) => a.incomeTypes.includes(t as never));
  if (a.incomeTypes.includes('gig') || a.incomeTypes.includes('zero_hours') || (!scheduled && s.incomeWeeklyCV > 0.35))
    g.push({ id: 'juggler', label: 'Juggler', why: 'Your income changes from week to week', adapts: 'Weekly budgets and a "pay yourself a steady wage" smoother' });
  if (a.incomeTypes.includes('student_loan'))
    g.push({ id: 'lump_sum', label: 'Lump-sum', why: 'Most of your money arrives in big chunks', adapts: 'We show how many weeks your money will last' });
  if (s.essentialsRatio > 0.7)
    g.push({ id: 'stretched', label: 'Stretched', why: `Essentials take ${Math.round(s.essentialsRatio * 100)}% of your income`, adapts: 'We hunt for savings on essentials and support you may be missing' });
  if (a.barriers.includes('language') || a.barriers.includes('new_to_uk') || a.barriers.includes('no_bank_history'))
    g.push({ id: 'newcomer', label: 'Newcomer', why: 'New to the UK systems or more comfortable in another language', adapts: 'Your language, plain words, and how UK bills and rights work' });
  if (a.incomeTypes.includes('pension') || a.barriers.includes('low_digital') || a.barriers.includes('disability'))
    g.push({ id: 'fixed_cautious', label: 'Fixed & cautious', why: 'Fixed income or less confident online', adapts: 'Bigger text, fewer screens, and an optional trusted helper' });
  if (!g.length || (bufferDays >= 30 && s.essentialsRatio < 0.6 && !a.debts.includes('payday')))
    g.push({ id: 'builder', label: 'Builder', why: 'You have some room to grow your safety net', adapts: 'Saving goals and, once ready, a first look at investing' });
  return g;
}

export function weekdayName(d: string) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(d)];
}
