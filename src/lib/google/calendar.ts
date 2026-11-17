'use client';

// Bill reminders in the person's own Google Calendar. Every event Tomorrow makes is tagged, so the app
// only ever lists, changes or removes its own events, never anything else in someone's calendar.
import { addDays, gbp } from '../engine/dates';
import { gfetch } from './client';

const EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
/** All-day events start at midnight, so 15 hours before is 9am the day before. */
const REMIND_MINUTES_BEFORE = 15 * 60;

export interface Reminder {
  id: string;
  /** The bill, e.g. "Leeds Homes Rent". */
  title: string;
  /** What's due, as a positive number, or null if not given. */
  amount: number | null;
  date: string; // YYYY-MM-DD
  /** Which bill it was made for, so the same bill isn't added twice. */
  key: string;
}

interface GEvent {
  id: string;
  start?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

const summaryOf = (title: string, amount: number | null) => (amount !== null ? `${title} due: ${gbp(amount, 2)}` : `${title} due`);

function body(r: Omit<Reminder, 'id'>) {
  return {
    summary: summaryOf(r.title, r.amount),
    description: 'Added by Tomorrow so you have the money ready. Amounts are based on your past bills, so check the real bill.',
    start: { date: r.date },
    end: { date: addDays(r.date, 1) },
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: REMIND_MINUTES_BEFORE }] },
    extendedProperties: { private: { tomorrowApp: '1', tomorrowKey: r.key, tomorrowTitle: r.title, tomorrowAmount: r.amount === null ? '' : String(r.amount) } },
  };
}

async function check(r: Response, what: string) {
  if (r.ok || r.status === 204) return;
  const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
  throw new Error(`${what} (${r.status}${j?.error?.message ? `: ${j.error.message}` : ''})`);
}

/** Tomorrow's own reminders from `from` onwards, soonest first. */
export async function listReminders(from: string): Promise<Reminder[]> {
  const q = new URLSearchParams({ privateExtendedProperty: 'tomorrowApp=1', timeMin: `${from}T00:00:00Z`, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const r = await gfetch(`${EVENTS}?${q}`);
  await check(r, 'Couldn’t read your calendar');
  const items = ((await r.json()) as { items?: GEvent[] }).items ?? [];
  return items.map((e) => {
    const p = e.extendedProperties?.private ?? {};
    const amount = p.tomorrowAmount ? Number(p.tomorrowAmount) : null;
    return { id: e.id, title: p.tomorrowTitle || 'Bill', amount: Number.isFinite(amount) ? amount : null, date: e.start?.date ?? e.start?.dateTime?.slice(0, 10) ?? '', key: p.tomorrowKey ?? '' };
  });
}

export async function addReminder(r: Omit<Reminder, 'id'>): Promise<void> {
  const res = await gfetch(EVENTS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(r)) });
  await check(res, 'Couldn’t add the reminder');
}

export async function updateReminder(r: Reminder): Promise<void> {
  const { id, ...rest } = r;
  const res = await gfetch(`${EVENTS}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(rest)) });
  await check(res, 'Couldn’t change the reminder');
}

export async function removeReminder(id: string): Promise<void> {
  const res = await gfetch(`${EVENTS}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (res.status === 410 || res.status === 404) return; // already gone
  await check(res, 'Couldn’t remove the reminder');
}
