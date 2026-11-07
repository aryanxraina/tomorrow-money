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

export function merchantKey(description: string) {
  return description
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    if (t.category === 'fees') continue;
    const k = merchantKey(t.description) + (t.amount > 0 ? '|in' : '|out');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    if (list.length < 2) continue;
    const last = list[list.length - 1];
    if (diffDays(today, last.date) > 45) continue; // stopped
    const dates = list.map((t) => t.date);
    const amounts = list.map((t) => Math.abs(t.amount));
    const intervals = dates.slice(1).map((d, i) => diffDays(d, dates[i]));
    const medInt = median(intervals);
    const doms = dates.map(dayOfMonth);
    const medDom = Math.round(median(doms));
    const domSteady = doms.filter((d) => Math.abs(d - medDom) <= 3).length / doms.length >= 0.75;
    const monthlyGaps = intervals.every((i) => i >= 27 && i <= 32) || (medInt >= 27 && medInt <= 32 && domSteady);
    let cadence: Recurring['cadence'] | null = null;
    let everyDays: number | undefined;
    if (monthlyGaps && domSteady) {
      cadence = 'monthly';
    } else if (list.length >= 4 && medInt >= 5 && medInt <= 35) {
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
      label: titleCase(last.description),
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
