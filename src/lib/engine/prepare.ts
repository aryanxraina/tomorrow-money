// Cleans transactions before anything is worked out from them.
import type { Category, Txn } from '../types';
import { addDays, diffDays } from './dates';
import { detectRecurring, txnKey } from './recurring';

/** Puts the person's own category corrections first: they always beat the app's guess. */
function applyRules(txns: Txn[], rules: Record<string, Category>): Txn[] {
  if (!Object.keys(rules).length) return txns;
  return txns.map((t) => {
    const category = rules[txnKey(t)];
    return category ? { ...t, category } : t;
  });
}

/** A payment out of one of your accounts and the same amount into another, within 3 days, is a move between them. */
function markInternal(txns: Txn[], rules: Record<string, Category>): Txn[] {
  const accounts = new Set(txns.map((t) => t.account).filter(Boolean));
  if (accounts.size < 2) return txns;
  const byAmount = new Map<number, Txn[]>();
  for (const t of txns) {
    if (t.amount > 0 && t.account) {
      const key = Math.round(t.amount * 100);
      byAmount.set(key, [...(byAmount.get(key) ?? []), t]);
    }
  }
  const internal = new Set<string>();
  for (const out of txns) {
    if (out.amount >= 0 || !out.account || rules[txnKey(out)]) continue;
    const match = (byAmount.get(Math.round(-out.amount * 100)) ?? []).find(
      (i) => i.account !== out.account && !internal.has(i.id) && !rules[txnKey(i)] && Math.abs(diffDays(i.date, out.date)) <= 3,
    );
    if (match) {
      internal.add(out.id);
      internal.add(match.id);
    }
  }
  return internal.size ? txns.map((t) => (internal.has(t.id) ? { ...t, category: 'internal' as const } : t)) : txns;
}

/**
 * Regular money coming in is treated as income even if its name isn't recognised. An employer can be
 * called anything, whereas a one-off payment from a friend isn't regular. The person can correct it.
 */
function promoteRegularIncome(txns: Txn[], today: string, rules: Record<string, Category>): Txn[] {
  const regular = detectRecurring(txns, today).filter((r) => r.direction === 'in' && r.category === 'transfers' && r.amounts.length >= 3 && !rules[r.key]);
  if (!regular.length) return txns;
  const keys = new Set(regular.map((r) => r.key));
  return txns.map((t) => (t.amount > 0 && t.category === 'transfers' && keys.has(txnKey(t)) ? { ...t, category: 'income' as const } : t));
}

export function prepareTxns(txns: Txn[], rules: Record<string, Category>, today: string): Txn[] {
  return promoteRegularIncome(markInternal(applyRules(txns, rules), rules), today, rules);
}

export interface DataWindow {
  from: string;
  /** The day after the newest data, so an older statement doesn't read as a sudden stop in spending. */
  to: string;
  days: number;
}

/** The period to average over: up to `maxDays`, but only as far as there's actually data. */
export function dataWindow(txns: Txn[], today: string, maxDays: number): DataWindow {
  let newest: string | null = null;
  let oldest: string | null = null;
  for (const t of txns) {
    if (t.source === 'receipt' || t.date >= today) continue;
    if (!newest || t.date > newest) newest = t.date;
    if (!oldest || t.date < oldest) oldest = t.date;
  }
  if (!newest || !oldest) return { from: addDays(today, -maxDays), to: today, days: maxDays };
  const to = addDays(newest, 1);
  const span = Math.max(1, diffDays(to, oldest));
  const days = Math.max(7, Math.min(maxDays, span));
  return { from: addDays(to, -days), to, days };
}
