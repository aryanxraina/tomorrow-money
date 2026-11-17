'use client';

// Puts upcoming bills into the person's Google Calendar by itself, once they've allowed it.
// It only adds what's missing (matched by bill and date), never re-adds one they removed, and
// never touches anything else in their calendar.
import { useEffect } from 'react';
import { useAccount } from '../account';
import { addDays } from '../engine/dates';
import { useStore } from '../store';
import { addReminder, listReminders } from './calendar';
import { CALENDAR_SCOPE, hasScope } from './client';

export interface BillLike {
  label: string;
  date: string;
  amount: number;
}

export const reminderKey = (label: string, date: string) => `${label}|${date}`;

/** Bills worth a reminder: money going out (£30 or more) in the next 60 days. */
export const billsForReminders = <T extends BillLike>(upcoming: T[], today: string) => upcoming.filter((u) => u.amount <= -30 && u.date >= today && u.date <= addDays(today, 60));

let running = false;
let lastDone = '';

/** Adds any upcoming bill that isn't in the calendar yet. Returns how many were added. */
export async function addMissingReminders(upcoming: BillLike[], today: string): Promise<number> {
  const { user, autoCalendar, skippedReminders } = useAccount.getState();
  if (!user || !autoCalendar || running || useStore.getState().mode === 'local' || !hasScope(CALENDAR_SCOPE)) return 0;
  const bills = billsForReminders(upcoming, today);
  const signature = `${user.sub}|${bills.map((b) => `${reminderKey(b.label, b.date)}:${b.amount}`).join(',')}|${skippedReminders.join(',')}`;
  if (signature === lastDone) return 0; // nothing has changed since the last check
  running = true;
  try {
    const existing = new Set((await listReminders(today)).map((r) => r.key));
    const missing = bills.filter((b) => {
      const k = reminderKey(b.label, b.date);
      return !existing.has(k) && !skippedReminders.includes(k);
    });
    for (const b of missing) await addReminder({ title: b.label, amount: Math.abs(b.amount), date: b.date, key: reminderKey(b.label, b.date) });
    lastDone = signature;
    return missing.length;
  } catch {
    return 0; // tried again next time the app opens
  } finally {
    running = false;
  }
}

/** Keeps the calendar up to date while a screen with the person's bills is open. */
export function useAutoReminders(upcoming: BillLike[] | undefined, today: string | undefined, onAdded?: (n: number) => void) {
  const user = useAccount((s) => s.user);
  const auto = useAccount((s) => s.autoCalendar);
  const skipped = useAccount((s) => s.skippedReminders);
  useEffect(() => {
    if (!upcoming || !today || !user || !auto) return;
    let live = true;
    void addMissingReminders(upcoming, today).then((n) => {
      if (live && n > 0) onAdded?.(n);
    });
    return () => {
      live = false;
    };
  }, [upcoming, today, user, auto, skipped, onAdded]);
}

export const skipReminder = (key: string) => useAccount.setState((s) => ({ skippedReminders: [...new Set([...s.skippedReminders, key])] }));
export const unskipReminder = (key: string) => useAccount.setState((s) => ({ skippedReminders: s.skippedReminders.filter((k) => k !== key) }));
export const setAutoCalendar = (on: boolean) => useAccount.setState({ autoCalendar: on });
