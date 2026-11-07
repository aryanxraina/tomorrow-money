// Self Assessment estimate. Rates are for 2026 to 2027 in England and Wales, checked on GOV.UK:
// gov.uk/income-tax-rates and gov.uk/self-employed-national-insurance-rates. Update them each April.
// Scotland has its own income tax bands. Only a rough estimate, and it's labelled that way everywhere.
import type { Answers, Txn } from '../types';
import { dataWindow } from './prepare';

export const TAX_YEAR_LABEL = '2026 to 2027';
const PERSONAL_ALLOWANCE = 12570;
const BASIC_LIMIT = 50270;
const HIGHER_LIMIT = 125140;
const NI_LOWER = 12570;
const NI_UPPER = 50270;

export interface TaxEstimate {
  due: string;
  bill: number;
  paymentOnAccount: number;
  total: number;
  income: number;
  expenses: number;
  profit: number;
  otherIncome: number;
}

const GIG_INCOME = /PAYOUT|DELIVEROO|UBER|JUST ?EAT|STUART|EVRI|BOLT|AMAZON FLEX|STRIPE|SUMUP|ZETTLE|PAYPAL/i;

/** The next 31 January that hasn't passed yet. */
export function nextTaxDeadline(today: string): string {
  const year = Number(today.slice(0, 4));
  const thisYears = `${year}-01-31`;
  return today <= thisYears ? thisYears : `${year + 1}-01-31`;
}

/**
 * Income tax on self-employed profit, sitting on top of any other income. A job uses up the personal
 * allowance first, so someone with wages pays tax on all of their profit, not just the part above £12,570.
 */
export function incomeTaxOnProfit(profit: number, otherIncome: number): number {
  const top = otherIncome + profit;
  const band = (lower: number, upper: number) => Math.max(0, Math.min(top, upper) - Math.max(otherIncome, lower));
  return band(PERSONAL_ALLOWANCE, BASIC_LIMIT) * 0.2 + band(BASIC_LIMIT, HIGHER_LIMIT) * 0.4 + band(HIGHER_LIMIT, Infinity) * 0.45;
}

export function class4NI(profit: number): number {
  return Math.max(0, Math.min(profit, NI_UPPER) - NI_LOWER) * 0.06 + Math.max(0, profit - NI_UPPER) * 0.02;
}

export function estimateSelfAssessment(txns: Txn[], today: string, a: Answers): TaxEstimate | null {
  if (!a.incomeTypes.includes('gig')) return null;
  if (txns.some((t) => /TAX POT/i.test(t.description))) return null; // already setting money aside
  const { from, to, days } = dataWindow(txns, today, 182);
  const yearly = 365 / days;
  const recent = txns.filter((t) => t.date >= from && t.date < to && t.source !== 'receipt');
  const money = recent.filter((t) => t.amount > 0 && t.category === 'income');
  const gig = money.filter((t) => GIG_INCOME.test(t.description));
  const income = gig.reduce((s, t) => s + t.amount, 0) * yearly;
  const otherIncome = money.filter((t) => !GIG_INCOME.test(t.description)).reduce((s, t) => s + t.amount, 0) * yearly;
  const expenses =
    recent
      .filter((t) => t.amount < 0 && (t.category === 'transport' || /MOBILE|PHONE/i.test(t.description)))
      .reduce((s, t) => s + (t.category === 'transport' ? -t.amount : -t.amount * 0.5), 0) * yearly;
  const profit = Math.max(0, income - expenses);
  const bill = Math.round((incomeTaxOnProfit(profit, otherIncome) + class4NI(profit)) / 10) * 10;
  // Payments on account apply when last year's bill was £1,000 or more, unless 80% or more was already taxed at source.
  const poa = bill >= 1000 ? Math.round(bill / 2 / 10) * 10 : 0;
  return { due: nextTaxDeadline(today), bill, paymentOnAccount: poa, total: bill + poa, income, expenses, profit, otherIncome };
}
