'use client';

import { CalendarClock, ChevronRight, Cloud, CloudOff, LayoutGrid, Loader2, LogOut, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { reconnect, signOut, useAccount, type GoogleUser } from '@/lib/account';
import { currentToken, googleConfigured } from '@/lib/google/client';
import { useStore } from '@/lib/store';

/** The person's Google photo, or their first initial if there isn't one (or it won't load). */
export function Avatar({ user, size = 36 }: { user: GoogleUser; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = ((user.given || user.name).trim()[0] || '?').toUpperCase();
  if (user.picture && !broken) {
    // Google's photo host refuses some requests that carry a referrer, so none is sent.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} className="block rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid place-items-center rounded-full bg-lime font-display font-semibold text-lime-ink" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {initial}
    </span>
  );
}

/**
 * Profile picture in the top-right corner. Tapping it opens the account menu: who's signed in,
 * whether their data is saved, and the way to sign out. Shows nothing when nobody is signed in.
 */
export function ProfileMenu({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  const router = useRouter();
  const { user, status, dirty, error } = useAccount();
  const mode = useStore((s) => s.mode);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Close on a tap outside or the Escape key.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!googleConfigured() || !user) return null;

  const needsReconnect = mode !== 'local' && (status === 'reconnect' || (dirty && !currentToken()));
  const state = mode === 'local' ? 'paused' : status === 'saving' ? 'saving' : needsReconnect || status === 'error' ? 'warn' : 'ok';
  const line = state === 'paused' ? 'Saving paused: kept on this device' : state === 'saving' ? 'Saving to your Google Drive…' : needsReconnect ? error || 'Reconnect to save your latest changes' : status === 'error' ? error : dirty ? 'Changes waiting to be saved' : 'Saved to your Google Drive';

  const run = async (fn: () => Promise<void>) => {
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

  const doSignOut = (force: boolean) =>
    run(async () => {
      if (await signOut(force)) {
        setOpen(false);
        router.push('/');
      } else setProblem('Your latest changes aren’t saved yet. Reconnect first, or sign out anyway and lose them.');
    });

  return (
    <div ref={box} className={`relative flex-none ${className}`}>
      <button
        type="button"
        aria-label={`Account: ${user.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen(!open);
          setConfirm(false);
          setProblem(null);
        }}
        className={`profile-btn relative block rounded-full p-[3px] ${onDark ? 'bg-hero-soft' : 'bg-card shadow-[0_4px_14px_-10px_rgba(0,0,0,.45)]'} ${state === 'saving' ? 'is-saving' : ''}`}
      >
        <Avatar user={user} size={34} />
        <span
          aria-hidden
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 ${onDark ? 'border-[var(--hero)]' : 'border-[var(--card)]'}`}
          style={{ background: state === 'ok' ? 'var(--strip-good)' : state === 'warn' ? 'var(--strip-warn)' : state === 'saving' ? 'var(--link)' : 'var(--mut)' }}
        />
      </button>

      {open && (
        <div role="menu" className="profile-menu absolute right-0 top-[calc(100%+10px)] z-50 w-[min(300px,calc(100vw-28px))] overflow-hidden rounded-[22px] bg-card text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,.55)] ring-1 ring-[var(--hair)]">
          <div className="hero-gradient flex items-center gap-3 px-4 py-4 text-hero-ink">
            <Avatar user={user} size={46} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{user.name}</div>
              <div className="truncate text-[13px] text-hero-mut">{user.email}</div>
            </div>
          </div>

          <div className={`mx-3 mt-3 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[13px] font-medium ${state === 'warn' ? 'chip-warn' : state === 'paused' ? 'chip-plain' : 'chip-good'}`}>
            {state === 'saving' ? <Loader2 size={15} className="mt-0.5 flex-none animate-spin" aria-hidden /> : state === 'warn' || state === 'paused' ? <CloudOff size={15} className="mt-0.5 flex-none" aria-hidden /> : <Cloud size={15} className="mt-0.5 flex-none" aria-hidden />}
            <span>{line}</span>
          </div>
          {needsReconnect && (
            <button type="button" role="menuitem" disabled={busy} onClick={() => void run(reconnect)} className="mx-3 mt-2 flex w-[calc(100%-24px)] items-center justify-center gap-2 rounded-full bg-lime px-4 py-2.5 text-sm font-semibold text-lime-ink">
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <RefreshCw size={16} aria-hidden />}
              {error ? 'Allow saving' : 'Reconnect Google'}
            </button>
          )}

          <div className="mt-2 px-2 pb-2">
            <Link role="menuitem" href="/more" onClick={() => setOpen(false)} className="menu-item flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14.5px] font-medium">
              <LayoutGrid size={18} className="text-mut" aria-hidden /> <span className="flex-1">More tools and settings</span> <ChevronRight size={16} className="text-mut" aria-hidden />
            </Link>
            <Link role="menuitem" href="/reminders" onClick={() => setOpen(false)} className="menu-item flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14.5px] font-medium">
              <CalendarClock size={18} className="text-mut" aria-hidden /> <span className="flex-1">Calendar reminders</span> <ChevronRight size={16} className="text-mut" aria-hidden />
            </Link>

            {!confirm ? (
              <button type="button" role="menuitem" onClick={() => setConfirm(true)} className="menu-item flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[14.5px] font-medium text-risk">
                <LogOut size={18} aria-hidden /> Sign out
              </button>
            ) : (
              <div className="menu-confirm mx-1 mt-1 space-y-2 rounded-2xl bg-card-2 p-3 text-[13.5px]">
                <p>We’ll save your data to your Google account first, then clear this device.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void doSignOut(false)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--risk)] px-3.5 py-2 text-[13px] font-semibold text-white">
                    {busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Sign out
                  </button>
                  {problem && (
                    <button type="button" disabled={busy} onClick={() => void doSignOut(true)} className="rounded-full px-3 py-2 text-[13px] font-semibold text-risk">
                      Sign out anyway
                    </button>
                  )}
                  <button type="button" onClick={() => setConfirm(false)} className="rounded-full px-3 py-2 text-[13px] font-semibold text-mut">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {problem && <p className="px-2.5 pt-2 text-[13px] text-risk">{problem}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
