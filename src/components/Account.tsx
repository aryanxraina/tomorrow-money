'use client';

import { CalendarClock, Cloud, CloudOff, HardDrive, Loader2, LogOut, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Muted, SectionTitle } from '@/components/ui';
import { deleteCloudCopy, pullIfNewer, reconnect, resolveChoice, signInWithGoogle, signOut, startAutoSave, syncNow, useAccount, type SignInResult } from '@/lib/account';
import { currentToken, googleConfigured } from '@/lib/google/client';
import type { SavedFile } from '@/lib/google/drive';
import { useStore } from '@/lib/store';

/** Google's own multi-colour G, as their sign-in branding asks. */
function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="flex-none">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}

export function GoogleButton({ onClick, busy, label = 'Continue with Google' }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="google-btn flex w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white px-5 py-3.5 text-[15.5px] font-semibold text-[#1f1f1f] shadow-[0_6px_18px_-10px_rgba(0,0,0,.45)] transition active:scale-[.98] disabled:opacity-60"
    >
      {busy ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <GoogleG />}
      {busy ? 'Waiting for Google…' : label}
    </button>
  );
}

/** "Saved 2 minutes ago" */
function savedAgo(iso: string | null) {
  if (!iso) return 'Not saved yet';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'Saved just now';
  if (mins < 60) return `Saved ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Saved ${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `Saved on ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function Initial({ name }: { name: string }) {
  return <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-lime font-display text-[20px] font-semibold text-lime-ink">{(name.trim()[0] || '?').toUpperCase()}</span>;
}

/**
 * The sign-in step at the start of the check-in. `onDone` gets whether this is someone new
 * (carry on with the questions) or someone whose saved data is now loaded (go to Home).
 */
export function SignInStep({ onDone }: { onDone: (kind: 'new' | 'returning') => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<SavedFile | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r: SignInResult = await signInWithGoogle();
      if (r.kind === 'choose') setChoice(r.saved);
      else onDone(r.kind);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = async (keep: 'drive' | 'device') => {
    if (!choice) return;
    setBusy(true);
    try {
      await resolveChoice(keep, choice);
      onDone('returning');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (choice) {
    return (
      <Card className="space-y-3">
        <SectionTitle>Which money data should we keep?</SectionTitle>
        <Muted>There’s money data on this device, and a saved copy in your Google account from {new Date(choice.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</Muted>
        <Button className="w-full" disabled={busy} onClick={() => void choose('drive')}>
          Use my saved copy
        </Button>
        <Button variant="soft" className="w-full" disabled={busy} onClick={() => void choose('device')}>
          Use what’s on this device
        </Button>
        <p className="text-[12.5px] text-mut">The one you don’t pick is replaced.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hero-card signin-hero relative overflow-hidden rounded-[28px] bg-hero p-6 text-hero-ink">
        <span className="signin-orb" aria-hidden />
        <span className="onboard-icon relative grid h-14 w-14 place-items-center rounded-2xl bg-lime text-lime-ink">
          <ShieldCheck size={28} aria-hidden />
        </span>
        <h1 className="relative mt-4 text-balance font-display text-[30px] font-semibold leading-tight tracking-tight">Let’s keep your money safe and in one place</h1>
        <p className="relative mt-2 text-[15px] leading-relaxed text-hero-mut">Sign in with Google so your progress is saved. You can leave at any time and carry on later, on any device.</p>
        <div className="relative mt-5">
          <GoogleButton onClick={() => void go()} busy={busy} />
        </div>
        {error && (
          <p role="alert" className="relative mt-3 rounded-2xl bg-[color-mix(in_srgb,var(--strip-risk)_25%,transparent)] px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </div>

      <Card className="space-y-3.5">
        {[
          { icon: HardDrive, title: 'Saved in your own Google Drive', sub: 'In a private app folder only you and Tomorrow can open.' },
          { icon: Smartphone, title: 'Carry on where you left off', sub: 'Sign out, come back later, or use another device.' },
          { icon: CalendarClock, title: 'Bill reminders on your phone', sub: 'Upcoming bills go into your Google Calendar automatically. Untick it on Google’s screen if you’d rather not.' },
        ].map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-card-2">
              <Icon size={19} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="font-medium leading-snug">{title}</div>
              <div className="text-[13px] leading-snug text-mut">{sub}</div>
            </div>
          </div>
        ))}
      </Card>
      <p className="px-1 text-center text-[12.5px] text-mut">We never see your Google password. Tomorrow doesn’t keep your money data on its own servers.</p>
      <Link href="/" className="block text-center text-sm font-medium text-link">
        Back to the start
      </Link>
    </div>
  );
}

/** Account, saving status and sign-out, for the settings area. */
export function AccountCard() {
  const router = useRouter();
  const { user, lastSync, dirty, status, error } = useAccount();
  const mode = useStore((s) => s.mode);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'signout' | 'delete' | null>(null);
  if (!googleConfigured()) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Card className="space-y-3">
        <SectionTitle>Your account</SectionTitle>
        <Muted>Sign in to save your money data in your own Google Drive and carry on from any device.</Muted>
        <GoogleButton busy={busy} onClick={() => void run(async () => (await signInWithGoogle()).kind === 'new' && router.push('/onboarding'))} />
        {problem && <p className="text-sm text-risk">{problem}</p>}
      </Card>
    );
  }

  const needsReconnect = status === 'reconnect' || (!currentToken() && dirty);
  const line =
    mode === 'local' ? 'Saving is paused while everything is kept on this device.' : status === 'saving' ? 'Saving…' : needsReconnect ? error || 'Reconnect to save your latest changes.' : status === 'error' ? error : dirty ? 'Changes waiting to be saved' : savedAgo(lastSync);

  return (
    <Card className="space-y-3">
      <SectionTitle>Your account</SectionTitle>
      <div className="flex items-center gap-3">
        <Initial name={user.given || user.name} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{user.name}</div>
          <div className="truncate text-[13.5px] text-mut">{user.email}</div>
        </div>
      </div>
      <div className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[13.5px] font-medium ${needsReconnect || status === 'error' ? 'chip-warn' : mode === 'local' ? 'chip-plain' : 'chip-good'}`}>
        {status === 'saving' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : needsReconnect || mode === 'local' ? <CloudOff size={16} aria-hidden /> : <Cloud size={16} aria-hidden />}
        <span>{line}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {needsReconnect ? (
          <Button variant="soft" className="!px-4 !py-2.5 !text-sm" disabled={busy} onClick={() => void run(reconnect)}>
            <RefreshCw size={16} aria-hidden /> {error ? 'Allow saving' : 'Reconnect Google'}
          </Button>
        ) : (
          <Button variant="soft" className="!px-4 !py-2.5 !text-sm" disabled={busy || mode === 'local'} onClick={() => void run(async () => (dirty ? syncNow() : pullIfNewer()))}>
            <RefreshCw size={16} aria-hidden /> Save now
          </Button>
        )}
        <Link href="/reminders" className="inline-flex items-center gap-2 rounded-full bg-card-2 px-4 py-2.5 text-sm font-semibold">
          <CalendarClock size={16} aria-hidden /> Calendar reminders
        </Link>
        <Button variant="soft" className="!px-4 !py-2.5 !text-sm" disabled={busy} onClick={() => setConfirm('signout')}>
          <LogOut size={16} aria-hidden /> Sign out
        </Button>
      </div>

      {confirm === 'signout' && (
        <div className="space-y-2 rounded-2xl bg-card-2 p-3 text-sm">
          <p>Your data is saved to your Google account first, then removed from this device. Sign in again any time to carry on.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="!px-4 !py-2 !text-sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (await signOut()) router.push('/');
                  else setProblem('Your latest changes aren’t saved yet. Reconnect Google first, or sign out anyway and lose them.');
                })
              }
            >
              Sign out
            </Button>
            {problem && (
              <Button variant="danger" className="!px-3 !py-2 !text-sm" disabled={busy} onClick={() => void run(async () => (await signOut(true)) && router.push('/'))}>
                Sign out anyway
              </Button>
            )}
            <Button variant="ghost" className="!px-3 !py-2 !text-sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {confirm === 'delete' ? (
        <div className="chip-risk space-y-2 rounded-2xl p-3 text-sm">
          <p className="font-medium">This deletes the copy saved in your Google Drive. The data on this device stays until you delete it too.</p>
          <div className="flex gap-2">
            <Button className="!bg-[var(--risk)] !px-4 !py-2 !text-sm !text-white" disabled={busy} onClick={() => void run(async () => (await deleteCloudCopy(), setConfirm(null)))}>
              Delete saved copy
            </Button>
            <Button variant="ghost" className="!px-3 !py-2 !text-sm" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" className="!px-0 !py-1 !text-sm" onClick={() => setConfirm('delete')}>
          Delete my saved copy from Google Drive
        </Button>
      )}
      {problem && <p className="text-sm text-risk">{problem}</p>}
    </Card>
  );
}

/** Starts saving changes, catches up with other devices, and asks to reconnect when Google's session ends. */
export function AccountSync() {
  const user = useAccount((s) => s.user);
  const dirty = useAccount((s) => s.dirty);
  const status = useAccount((s) => s.status);
  const mode = useStore((s) => s.mode);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!googleConfigured()) return;
    const stop = startAutoSave();
    void pullIfNewer();
    return stop;
  }, []);

  if (!googleConfigured() || !user || mode === 'local' || !dirty || (status !== 'reconnect' && currentToken())) return null;
  return (
    <div role="status" className="chip-warn flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px] font-medium">
      <span>Your latest changes are on this device only.</span>
      <button
        type="button"
        disabled={busy}
        className="rounded-full bg-[var(--warn)] px-3 py-1 text-[12.5px] font-semibold text-white"
        onClick={async () => {
          setBusy(true);
          try {
            await reconnect();
          } catch {
            /* the account card shows details */
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Connecting…' : 'Reconnect Google to save'}
      </button>
    </div>
  );
}
