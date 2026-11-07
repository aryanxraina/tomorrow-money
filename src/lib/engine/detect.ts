import type { Answers, Txn } from '../types';
import { addDays } from './dates';
import type { Recurring } from './recurring';
import type { Summary } from './understand';

export interface Problem {
  id: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  annualCost?: number;
  premium?: boolean; // counts towards the "poverty premium" total
  estimate?: boolean;
  evidence: Txn[];
  fix: string;
}

export interface TaxEstimate {
  due: string;
  bill: number;
  paymentOnAccount: number;
  total: number;
  income: number;
  expenses: number;
  profit: number;
}

const PERSONAL_ALLOWANCE = 12570;
const BASIC_RATE = 0.2;
const CLASS4_NI = 0.06;

/** Rough Self Assessment estimate for self-employed gig income. Not tax advice. */
export function estimateSelfAssessment(txns: Txn[], today: string, a: Answers): TaxEstimate | null {
  if (!a.incomeTypes.includes('gig')) return null;
  if (txns.some((t) => t.category === 'tax')) return null; // already setting money aside
  const earliest = txns.reduce((m, t) => (t.date < m ? t.date : m), today);
  const span = Math.max(28, Math.min(182, Math.round((new Date(today).getTime() - new Date(earliest).getTime()) / 86400000)));
  const from = addDays(today, -span);
  const yearly = 365 / span;
  const recent = txns.filter((t) => t.date >= from && t.date < today);
  const income = recent.filter((t) => t.amount > 0 && /PAYOUT/i.test(t.description)).reduce((s, t) => s + t.amount, 0) * yearly;
  const expenses =
    recent
      .filter((t) => t.amount < 0 && (t.category === 'transport' || /MOBILE|PHONE/i.test(t.description)))
      .reduce((s, t) => s + (t.category === 'transport' ? -t.amount : -t.amount * 0.5), 0) * yearly;
  const profit = Math.max(0, income - expenses);
  const taxable = Math.max(0, profit - PERSONAL_ALLOWANCE);
  const bill = Math.round((taxable * (BASIC_RATE + CLASS4_NI)) / 10) * 10;
  const poa = bill > 1000 ? Math.round(bill / 2 / 10) * 10 : 0;
  return { due: '2027-01-31', bill, paymentOnAccount: poa, total: bill + poa, income, expenses, profit };
}

const FEE_TYPES: { re: RegExp; id: string; title: string; fix: string }[] = [
  { re: /OVERDRAFT INTEREST/i, id: 'od', title: 'Overdraft interest', fix: 'A small buffer stops this. Your plan builds one.' },
  { re: /UNPAID ITEM|RETURNED/i, id: 'unpaid', title: 'Unpaid payment fees', fix: 'Move bill dates to just after payday.' },
  { re: /LATE FEE/i, id: 'late', title: 'Late payment fees', fix: 'Line up buy-now-pay-later dates with payday.' },
  { re: /ATM FEE|WITHDRAWAL FEE/i, id: 'atm', title: 'Cash machine fees', fix: 'Use free cash machines. The Pay tab shows ones nearby.' },
  { re: /INSTANT CASHOUT/i, id: 'cashout', title: 'Instant cash-out fees', fix: 'Wait for the free weekly payout when you can.' },
  { re: /QUICKSEND FEE|TRANSFER FEE/i, id: 'fx', title: 'Money transfer fees', fix: 'Compare providers on fee plus exchange rate.' },
];

export function detectProblems(
  txns: Txn[],
  today: string,
  a: Answers,
  s: Summary,
  recurring: Recurring[],
  bufferDays: number,
  tax: TaxEstimate | null,
): Problem[] {
  const p: Problem[] = [];
  const from182 = addDays(today, -182);
  const recent = txns.filter((t) => t.date >= from182 && t.date < today && t.source !== 'receipt');

  if (s.essentialsRatio > 0.7) {
    p.push({
      id: 'essentials',
      title: `Essentials take ${Math.round(s.essentialsRatio * 100)}% of your income`,
      detail: `About £${Math.round(s.essentialsMonthly)} a month goes on rent, bills, food, travel and debt, leaving £${Math.max(0, Math.round(s.monthlyIn - s.essentialsMonthly))} for everything else.`,
      severity: s.essentialsRatio > 0.85 ? 'high' : 'medium',
      evidence: [],
      fix: 'Your plan looks for support you can claim and cheaper essentials.',
    });
  }

  for (const f of FEE_TYPES) {
    const ev = recent.filter((t) => t.amount < 0 && f.re.test(t.description));
    if (!ev.length) continue;
    const annual = (ev.reduce((x, t) => x - t.amount, 0) * 365) / 182;
    p.push({
      id: `fee-${f.id}`,
      title: f.title,
      detail: `${ev.length} charges in the last 6 months.`,
      severity: annual > 60 ? 'medium' : 'low',
      annualCost: annual,
      premium: true,
      evidence: ev,
      fix: f.fix,
    });
  }

  const ppm = recent.filter((t) => /PAYPOINT|ENERGY TOPUP/i.test(t.description));
  if (a.energyPayment === 'prepayment' || ppm.length) {
    p.push({
      id: 'ppm',
      title: 'Prepayment meter',
      detail: `${ppm.length} top-ups in 6 months. Winter top-ups are predicted to be about 30% higher, with no way to spread the cost.`,
      severity: 'medium',
      premium: true,
      evidence: ppm.slice(-6),
      fix: 'Check the Warm Home Discount and ask your supplier about cheaper ways to pay.',
    });
  }

  const insMonthly = recurring.filter((r) => r.category === 'insurance' && r.direction === 'out' && r.cadence === 'monthly');
  for (const r of insMonthly) {
    const est = r.last * 12 * 0.1;
    p.push({
      id: `ins-${r.key}`,
      title: `${r.label}: paying monthly costs extra`,
      detail: `Spreading an insurance premium monthly usually adds interest. Estimate: about £${Math.round(est)} a year.`,
      severity: 'low',
      annualCost: est,
      premium: true,
      estimate: true,
      evidence: recent.filter((t) => t.description.toUpperCase().includes(r.label.toUpperCase().split(' ')[0])).slice(-3),
      fix: 'At renewal, compare the pay-annually price. Your buffer can make that possible.',
    });
  }

  const hcc = recent.filter((t) => /CASHNOW|PAYDAY|QUICKQUID/i.test(t.description));
  if (hcc.length) {
    p.push({
      id: 'hcc',
      title: 'High-cost loan',
      detail: `£${Math.round(-hcc[hcc.length - 1].amount)} a month to a short-term lender.`,
      severity: 'high',
      evidence: hcc,
      fix: 'Free debt advice can help you deal with high-cost credit (see Support).',
    });
  }

  const bnpl = recurring.filter((r) => /KLARNA|CLEARPAY|LAYBUY/i.test(r.key));
  for (const r of bnpl) {
    p.push({
      id: `bnpl-${r.key}`,
      title: 'Buy now, pay later',
      detail: `£${r.last.toFixed(2)} every ${r.everyDays ?? 30} days, with late fees when it lands before payday.`,
      severity: 'medium',
      evidence: recent.filter((t) => /KLARNA|CLEARPAY|LAYBUY/i.test(t.description)).slice(-4),
      fix: 'Avoid new BNPL until your buffer is built.',
    });
  }

  const subs = recurring.filter((r) => r.category === 'subscriptions' && r.direction === 'out');
  const subsMonthly = subs.reduce((x, r) => x + (r.cadence === 'monthly' ? r.last : (r.last * 30.4) / (r.everyDays || 30)), 0);
  if (subs.length >= 3 || subsMonthly > s.monthlyIn * 0.04) {
    p.push({
      id: 'subs',
      title: `${subs.length} subscriptions: £${subsMonthly.toFixed(2)} a month`,
      detail: subs.map((r) => `${r.label} £${r.last.toFixed(2)}`).join(', '),
      severity: subsMonthly > 40 ? 'medium' : 'low',
      evidence: [],
      fix: 'Pause the ones you use least. You can restart any time.',
    });
  }

  const ctPaid = recent.filter((t) => t.category === 'council_tax');
  if (a.allStudents && ctPaid.length) {
    const monthly = -ctPaid[ctPaid.length - 1].amount;
    p.push({
      id: 'ct-student',
      title: 'You may be paying council tax you do not owe',
      detail: `Homes where everyone is a full-time student are usually exempt. You've paid £${Math.round(ctPaid.reduce((x, t) => x - t.amount, 0))} so far.`,
      severity: 'high',
      annualCost: monthly * 10,
      evidence: ctPaid,
      fix: 'Send your council a student certificate for everyone in the house and ask for a refund.',
    });
  }

  const conv = recent.filter((t) => t.category === 'groceries' && /EXPRESS|LOCAL|CO-OP|COOP|CONVENIENCE/i.test(t.description));
  const groc = recent.filter((t) => t.category === 'groceries');
  const convSpend = conv.reduce((x, t) => x - t.amount, 0);
  const grocSpend = groc.reduce((x, t) => x - t.amount, 0);
  if (grocSpend > 0 && convSpend / grocSpend > 0.2) {
    const annual = ((convSpend * 365) / 182) * 0.18;
    p.push({
      id: 'convenience',
      title: 'Convenience-store prices',
      detail: `${Math.round((convSpend / grocSpend) * 100)}% of your food shopping is at small "express" stores, which usually charge more for the same items.`,
      severity: 'low',
      annualCost: annual,
      premium: true,
      estimate: true,
      evidence: conv.slice(-5),
      fix: 'Use the Pay tab at checkout: it shows a cheaper shop nearby when the trip is worth it.',
    });
  }

  if (bufferDays < 7) {
    p.push({
      id: 'buffer',
      title: 'No safety buffer',
      detail: `Your savings and balance cover about ${Math.max(0, Math.round(bufferDays))} days of essentials. One surprise bill could mean fees or borrowing.`,
      severity: 'high',
      evidence: [],
      fix: 'Your plan aims for a 14-day buffer first.',
    });
  }

  // spending trend vs your own past (never vs other people)
  const from30 = addDays(today, -30);
  const from91 = addDays(today, -91);
  for (const cat of ['eating_out', 'shopping'] as const) {
    const last30 = recent.filter((t) => t.category === cat && t.date >= from30 && t.amount < 0).reduce((x, t) => x - t.amount, 0);
    const prev = recent.filter((t) => t.category === cat && t.date >= from91 && t.date < from30 && t.amount < 0).reduce((x, t) => x - t.amount, 0) / (61 / 30.4);
    if (prev > 0 && last30 > prev * 1.3 && last30 - prev > 20) {
      p.push({
        id: `trend-${cat}`,
        title: `${cat === 'eating_out' ? 'Takeaways' : 'Shopping'} up ${Math.round((last30 / prev - 1) * 100)}% this month`,
        detail: `£${Math.round(last30)} in the last 30 days vs your usual £${Math.round(prev)}.`,
        severity: 'low',
        evidence: recent.filter((t) => t.category === cat && t.date >= from30).slice(-5),
        fix: 'Getting back to your usual level is in your plan.',
      });
    }
  }

  if (tax) {
    p.push({
      id: 'tax',
      title: `Tax bill coming: about £${tax.total.toLocaleString('en-GB')} by 31 Jan`,
      detail: `Self Assessment estimate on about £${Math.round(tax.profit).toLocaleString('en-GB')} profit${tax.paymentOnAccount ? `, including a first payment on account of £${tax.paymentOnAccount}` : ''}. Nothing has been set aside yet.`,
      severity: 'high',
      estimate: true,
      evidence: [],
      fix: 'Start a weekly tax pot now, and if you can’t pay in full, ask HMRC about a payment plan before the deadline.',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return p.sort((x, y) => order[x.severity] - order[y.severity] || (y.annualCost || 0) - (x.annualCost || 0));
}
