import type { Category, Txn } from '../types';
import { addDays, addMonths, dayOfMonth, diffDays, month, weekday } from './dates';

export interface Recurring {
  key: string;
  label: string;
  category: Category;
  direction: 'in' | 'out';
  cadence: 'monthly' | 'days';
  everyDays?: number;
  dayOfMonth?: number;
  amounts: number[]; // absolute values, oldest first
  dates: string[];
  lastDate: string;
  avg: number;
  last: number;
  variable: boolean;
  priceRise?: { from: number; to: number };
}

// Spending that is frequent but not a "bill": treated as everyday spending instead.
const NOT_BILLS: Category[] = ['groceries', 'eating_out', 'shopping', 'cash', 'other', 'kids'];

// Words banks add around the merchant's name, which would otherwise split one merchant into many.
const BANK_WORDING =
  /\b(?:CARD PAYMENT TO|CARD PAYMENT|CARD PURCHASE|PURCHASE AT|CONTACTLESS|POS|VISA|DEBIT CARD|DIRECT DEBIT PAYMENT TO|DIRECT DEBIT TO|DIRECT DEBIT|STANDING ORDER TO|STANDING ORDER|FASTER PAYMENTS? RECEIPT FROM|FASTER PAYMENTS? RECEIPT|FASTER PAYMENTS? TO|FASTER PAYMENTS? FROM|FASTER PAYMENTS?|BILL PAYMENT VIA FASTER PAYMENT TO|BILL PAYMENT TO|BILL PAYMENT|BANK GIRO CREDIT|BANK CREDIT|PAYMENT TO|PAYMENT FROM|GOOGLE PAY|APPLE PAY|DD|SO|FPI|FPO|BGC|BP|DEB|REF|REFERENCE|MANDATE NO|ON|GBP|GB|CD|RATE)\b/g;

export function merchantKey(description: string) {
  const letters = description.toUpperCase().replace(/[^A-Z ]/g, ' ');
  const cleaned = letters.replace(BANK_WORDING, ' ').replace(/\s+/g, ' ').trim();
  // A description that was nothing but bank wording keeps its original words.
  return cleaned || letters.replace(/\s+/g, ' ').trim();
}

/** A readable merchant name for lists, without the bank's extra wording. */
export const merchantLabel = (description: string) => {
  const key = merchantKey(description);
  // "NETFLIX.COM" reads better as "Netflix", as long as something is left.
  const trimmed = key.replace(/(?:\s(?:COM|CO UK|ORG UK|UK|LTD|LIMITED|PLC))+$/, '');
  return titleCase(trimmed || key);
};

/** The key a person's category correction is stored under. */
export const txnKey = (t: { description: string; amount: number }) => `${merchantKey(t.description)}${t.amount > 0 ? '|in' : '|out'}`;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function detectRecurring(txns: Txn[], today: string): Recurring[] {
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.source === 'receipt') continue;
    if (NOT_BILLS.includes(t.category)) continue;
    if (t.category === 'fees' || t.category === 'internal' || t.category === 'refund') continue;
    const k = merchantKey(t.description) + (t.amount > 0 ? '|in' : '|out');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  // Judged from the newest data held, not from today, or an older statement would look like everything stopped.
  const newest = txns.reduce((m, t) => (t.date > m && t.date <= today ? t.date : m), '0000-00-00');
  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    if (list.length < 2) continue;
    const last = list[list.length - 1];
    const dates = list.map((t) => t.date);
    const amounts = list.map((t) => Math.abs(t.amount));
    const intervals = dates.slice(1).map((d, i) => diffDays(d, dates[i]));
    const medInt = median(intervals);
    if (diffDays(newest, last.date) > Math.max(10, medInt * 1.6 + 7)) continue; // stopped
    const doms = dates.map(dayOfMonth);
    const medDom = Math.round(median(doms));
    const domSteady = doms.filter((d) => Math.abs(d - medDom) <= 3).length / doms.length >= 0.75;
    const monthlyGaps = intervals.every((i) => i >= 27 && i <= 32) || (medInt >= 27 && medInt <= 32 && domSteady);
    let cadence: Recurring['cadence'] | null = null;
    let everyDays: number | undefined;
    if (monthlyGaps && domSteady) {
      cadence = 'monthly';
    } else if (list.length >= 3 && medInt >= 5 && medInt <= 35) {
      // Three payments is enough: a 3-month statement only shows three 4-weekly wages.
      const steady = intervals.filter((i) => Math.abs(i - medInt) <= Math.max(1, medInt * 0.2)).length / intervals.length;
      if (steady >= 0.75) {
        cadence = 'days';
        everyDays = Math.round(medInt);
      }
    }
    if (!cadence) continue;
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - avg) ** 2, 0) / amounts.length);
    const variable = sd / avg > 0.04;
    let priceRise: Recurring['priceRise'];
    if (!variable || ['subscriptions', 'broadband_phone', 'insurance', 'water'].includes(last.category)) {
      const first = amounts[0];
      const lastAmt = amounts[amounts.length - 1];
      if (lastAmt > first * 1.05 && ['subscriptions', 'broadband_phone', 'insurance', 'water', 'housing'].includes(last.category)) {
        priceRise = { from: first, to: lastAmt };
      }
    }
    out.push({
      key,
      label: merchantLabel(last.description),
      category: last.category,
      direction: last.amount > 0 ? 'in' : 'out',
      cadence,
      everyDays,
      dayOfMonth: cadence === 'monthly' ? medDom : undefined,
      amounts,
      dates,
      lastDate: last.date,
      avg,
      last: amounts[amounts.length - 1],
      variable,
      priceRise,
    });
  }
  return out;
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bUc\b/, 'UC')
    .replace(/\bDwp\b/, 'DWP')
    .replace(/\bChb\b/, 'Child Benefit')
    .replace(/\bCc Ctax\b/, 'Council Tax')
    .replace(/\bSlc\b/, 'SLC')
    .replace(/\bPl\b/, 'PL');
}

/** Did the person pay council tax in February or March? Then they pay over 12 months, not the usual 10. */
export function paysCouncilTaxOver12(txns: Txn[]): boolean {
  return txns.some((t) => t.category === 'council_tax' && t.amount < 0 && [2, 3].includes(month(t.date)));
}

/** Next due dates of a recurring item between (from, to]. */
export function nextDates(r: Recurring, from: string, to: string, opts?: { ctSpread12?: boolean }): string[] {
  const res: string[] = [];
  if (r.cadence === 'monthly') {
    for (let k = 1; k <= 14; k++) {
      const d = addMonths(r.lastDate, k, r.dayOfMonth);
      if (d > to) break;
      if (d <= from) continue;
      if (r.category === 'council_tax' && !opts?.ctSpread12) {
        const m = month(d);
        if (m === 2 || m === 3) continue; // 10 instalments, Apr-Jan
      }
      res.push(d);
    }
  } else if (r.everyDays) {
    for (let d = addDays(r.lastDate, r.everyDays); d <= to; d = addDays(d, r.everyDays)) {
      if (d > from) res.push(d);
    }
  }
  return res;
}

export function cadenceLabel(r: Recurring) {
  if (r.cadence === 'monthly') return `monthly on the ${ordinal(r.dayOfMonth || 1)}`;
  if (r.everyDays === 7) return `weekly (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(r.lastDate)]})`;
  if (r.everyDays === 14) return 'every 2 weeks';
  if (r.everyDays === 28) return 'every 4 weeks';
  return `every ${r.everyDays} days`;
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
