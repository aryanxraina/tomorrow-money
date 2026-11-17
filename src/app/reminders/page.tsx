'use client';

import { BellRing, CalendarCheck, CalendarPlus, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GoogleButton } from '@/components/Account';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button, ButtonLink, Card, inputCls, Muted, NoProfile, PoundInput, SectionTitle, Switch, TopBar } from '@/components/ui';
import { billsForReminders, reminderKey, setAutoCalendar, skipReminder, unskipReminder, useAutoReminders } from '@/lib/google/autoReminders';
import { signInWithGoogle, useAccount } from '@/lib/account';
import { CALENDAR_SCOPE, googleConfigured, hasScope, NeedsReconnect, requestToken } from '@/lib/google/client';
import { addReminder, listReminders, removeReminder, updateReminder, type Reminder } from '@/lib/google/calendar';
import { gbp, niceDate } from '@/lib/engine/dates';
import { useMoney } from '@/lib/hooks';
import { useStore } from '@/lib/store';

const keyOf = reminderKey;

function EditForm({ r, onSave, onCancel, busy }: { r: Reminder; onSave: (r: Reminder) => void; onCancel: () => void; busy: boolean }) {
  const [date, setDate] = useState(r.date);
  const [amount, setAmount] = useState(r.amount === null ? '' : r.amount.toFixed(2));
  const [title, setTitle] = useState(r.title);
  return (
    <form
      className="mt-2 space-y-2 rounded-2xl bg-card-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = amount.trim() === '' ? null : Math.abs(Number(amount));
        onSave({ ...r, title: title.trim() || r.title, date, amount: n === null || Number.isNaN(n) ? null : n });
      }}
    >
      <label className="block text-sm font-medium">
        <span className="mb-1 block">What’s it for?</span>
        <input className={`${inputCls} bg-card`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        <span className="mb-1 block">Due date</span>
        <input type="date" required className={`${inputCls} bg-card`} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="text-sm font-medium">
        <span className="mb-1 block">Amount</span>
        <PoundInput label="Reminder amount" value={amount} onChange={setAmount} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={busy} className="flex-1 !py-2.5">
          Save changes
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function Reminders() {
  const money = useMoney();
  const user = useAccount((s) => s.user);
  const mode = useStore((s) => s.mode);
  const [connected, setConnected] = useState(() => hasScope(CALENDAR_SCOPE));
  const [items, setItems] = useState<Reminder[] | null>(null);
  const auto = useAccount((s) => s.autoCalendar);
  const [autoAdded, setAutoAdded] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = money?.an.today ?? '';

  const onAutoAdded = useCallback(
    (n: number) => {
      setAutoAdded(n);
      void listReminders(today).then(setItems).catch(() => undefined);
    },
    [today],
  );

  const load = useCallback(async () => {
    try {
      setItems(await listReminders(today));
    } catch (e) {
      if (e instanceof NeedsReconnect) setConnected(false);
      else setError((e as Error).message);
    }
  }, [today]);

  useEffect(() => {
    if (!connected || !today || mode === 'local') return;
    let live = true;
    listReminders(today)
      .then((r) => live && setItems(r))
      .catch((e: Error) => {
        if (!live) return;
        if (e instanceof NeedsReconnect) setConnected(false);
        else setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [connected, today, mode]);

  useAutoReminders(connected ? money?.an.upcoming : undefined, today || undefined, onAutoAdded);

  if (!money) return <NoProfile />;

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      if (e instanceof NeedsReconnect) setConnected(false);
      else setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy('connect');
    setError(null);
    try {
      if (!useAccount.getState().user) await signInWithGoogle();
      await requestToken(CALENDAR_SCOPE, { hint: useAccount.getState().user?.email });
      setConnected(hasScope(CALENDAR_SCOPE));
      if (!hasScope(CALENDAR_SCOPE)) setError('Calendar access wasn’t allowed. Tick the calendar box on Google’s screen to turn reminders on.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const bills = billsForReminders(money.an.upcoming, today);
  const added = new Set((items ?? []).map((r) => r.key));
  const notAdded = bills.filter((b) => !added.has(keyOf(b.label, b.date)));

  return (
    <div className="space-y-3">
      <TopBar title="Calendar reminders" back="/forecast" subtitle="A reminder on your phone the day before a bill is due." />

      <Card className="flex items-start gap-3">
        <span className="onboard-icon grid h-11 w-11 flex-none place-items-center rounded-2xl bg-lime text-lime-ink">
          <BellRing size={22} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="font-semibold">How it works</div>
          <Muted>
            We add each bill to your Google Calendar on the day it’s due, like “Rent due: £575.00”. Google Calendar then reminds you at 9am the day before, on any phone signed in to your Google account with notifications on.
          </Muted>
          <p className="mt-1.5 text-[12.5px] text-mut">We only ever see, change or remove the reminders Tomorrow added. The rest of your calendar is left alone.</p>
        </div>
      </Card>

      {!googleConfigured() ? (
        <Card>
          <SectionTitle>Not set up yet</SectionTitle>
          <Muted className="mt-1">Google sign-in hasn’t been set up on this copy of the app, so reminders can’t be added. You can still download your bills from the Future tab.</Muted>
          <ButtonLink variant="soft" href="/forecast" className="mt-3 !px-4 !py-2.5 !text-sm">
            Go to Future
          </ButtonLink>
        </Card>
      ) : mode === 'local' ? (
        <Card>
          <SectionTitle>Paused</SectionTitle>
          <Muted className="mt-1">“Keep everything on this device” is on, so nothing is sent to Google. Turn it off under More tools to use calendar reminders.</Muted>
        </Card>
      ) : !connected ? (
        <Card className="space-y-3">
          <SectionTitle>Turn on calendar reminders</SectionTitle>
          <Muted>{user ? `Google will ask whether Tomorrow can add events to the calendar of ${user.email}.` : 'Sign in with Google, then allow Tomorrow to add events to your calendar.'}</Muted>
          <GoogleButton busy={busy === 'connect'} onClick={() => void connect()} label={user ? 'Connect Google Calendar' : 'Continue with Google'} />
        </Card>
      ) : (
        <>
          <Card className="space-y-2">
            <Switch label="Add bills automatically" hint="New bills go into your Google Calendar by themselves. Anything you remove stays removed." checked={auto} onChange={setAutoCalendar} />
            {autoAdded > 0 && (
              <p role="status" className="reminder-note chip-good rounded-2xl px-3 py-2 text-[13px] font-medium">
                Added {autoAdded} {autoAdded === 1 ? 'bill' : 'bills'} to your calendar.
              </p>
            )}
          </Card>
          <Card>
            <SectionTitle
              action={
                notAdded.length > 1 && (
                  <button
                    type="button"
                    disabled={!!busy}
                    className="flex items-center gap-1.5 text-sm font-semibold text-link"
                    onClick={() => void run('all', async () => void (await Promise.all(notAdded.map((b) => (unskipReminder(keyOf(b.label, b.date)), addReminder({ title: b.label, amount: Math.abs(b.amount), date: b.date, key: keyOf(b.label, b.date) }))))))}
                  >
                    <CalendarPlus size={16} aria-hidden /> Add all {notAdded.length}
                  </button>
                )
              }
            >
              Upcoming bills
            </SectionTitle>
            <Muted className="mt-0.5">The next 60 days, from your regular payments.</Muted>
            <div className="mt-1 divide-y divide-hair">
              {bills.map((b) => {
                const k = keyOf(b.label, b.date);
                const done = added.has(k);
                return (
                  <div key={k} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-card-2">
                      <CategoryIcon category={b.category} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{b.label}</div>
                      <div className="text-[13px] text-mut">
                        {niceDate(b.date)} · {gbp(Math.abs(b.amount), 2)}
                      </div>
                    </div>
                    {done ? (
                      <span className="inline-flex flex-none items-center gap-1 rounded-full chip-good px-3 py-1.5 text-[13px] font-semibold">
                        <Check size={14} aria-hidden /> Added
                      </span>
                    ) : (
                      <Button variant="soft" className="flex-none !px-3.5 !py-2 !text-[13px]" disabled={!!busy || items === null} onClick={() => void run(k, async () => (unskipReminder(k), await addReminder({ title: b.label, amount: Math.abs(b.amount), date: b.date, key: k })))}>
                        {busy === k ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <CalendarPlus size={15} aria-hidden />} Remind me
                      </Button>
                    )}
                  </div>
                );
              })}
              {!bills.length && <Muted className="py-3">No bills found in the next 60 days. Add a statement and they’ll show up here.</Muted>}
            </div>
          </Card>

          <Card>
            <SectionTitle>Your reminders</SectionTitle>
            {items === null && !error && <Muted className="mt-1">Loading your reminders…</Muted>}
            <div className="mt-1 divide-y divide-hair">
              {(items ?? []).map((r) => (
                <div key={r.id} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-card-2 text-link">
                      <CalendarCheck size={19} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="text-[13px] text-mut">
                        {niceDate(r.date)}
                        {r.amount !== null && ` · ${gbp(r.amount, 2)}`}
                      </div>
                    </div>
                    <button type="button" aria-label={`Change ${r.title}`} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-card-2" onClick={() => setEditing(editing === r.id ? null : r.id)}>
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button type="button" aria-label={`Remove ${r.title}`} disabled={!!busy} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-card-2 text-risk" onClick={() => void run(r.id, async () => (skipReminder(r.key), await removeReminder(r.id)))}>
                      {busy === r.id ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Trash2 size={16} aria-hidden />}
                    </button>
                  </div>
                  {editing === r.id && (
                    <EditForm
                      r={r}
                      busy={busy === r.id}
                      onCancel={() => setEditing(null)}
                      onSave={(next) =>
                        void run(r.id, async () => {
                          await updateReminder(next);
                          setEditing(null);
                        })
                      }
                    />
                  )}
                </div>
              ))}
              {items && !items.length && <Muted className="py-3">No reminders yet. Tap “Remind me” on a bill above.</Muted>}
            </div>
          </Card>
        </>
      )}

      {error && (
        <p role="alert" className="chip-risk rounded-2xl px-4 py-3 text-sm font-medium">
          {error}
        </p>
      )}
      <Muted className="px-1">
        Amounts come from your past bills, so they’re a guide. Removing a reminder here also removes it from your calendar. You can also{' '}
        <Link href="/forecast" className="font-medium text-link underline">
          download your bills as a calendar file
        </Link>
        .
      </Muted>
    </div>
  );
}
