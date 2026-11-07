'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { APP_NAME, useAiStatus, useLang, useMounted, useOnline, useProfile } from '@/lib/hooks';
import { isRtl, LANGS, t } from '@/lib/i18n';
import { useStore, type Mode } from '@/lib/store';
import type { Lang } from '@/lib/types';

const NAV = [
  { href: '/dashboard', key: 'money', icon: '◔' },
  { href: '/snap', key: 'snap', icon: '⌗' },
  { href: '/pay', key: 'pay', icon: '⌖' },
  { href: '/ask', key: 'ask', icon: '✦' },
  { href: '/more', key: 'more', icon: '≡' },
];

function ModeSwitch() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const online = useOnline();
  const status = useAiStatus();
  const opts: { id: Mode; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'cloud', label: 'Cloud' },
    { id: 'local', label: 'On-device' },
  ];
  const effective = mode === 'auto' ? (online && status?.cloud ? 'cloud' : 'local') : mode;
  return (
    <div className="flex items-center gap-2">
      <span
        title={online ? 'Online' : 'Offline: using the on-device model'}
        className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`}
      />
      <div className="flex rounded-full bg-slate-100 p-0.5 text-xs">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            className={`rounded-full px-2.5 py-1 font-medium ${mode === o.id ? 'bg-white text-violet-800 shadow' : 'text-slate-600'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="hidden text-xs text-slate-500 sm:inline">{effective === 'cloud' ? 'AI: cloud' : 'AI: on your device'}</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const path = usePathname();
  const profile = useProfile();
  const lang = useLang(profile);
  const setLang = useStore((s) => s.setLang);
  const bigText = useStore((s) => s.bigText);
  const setBigText = useStore((s) => s.setBigText);
  const showNav = path !== '/' && path !== '/onboarding';

  if (!mounted) return <div className="min-h-screen bg-slate-50" />;

  return (
    <div className={`min-h-screen bg-slate-50 ${bigText ? 'text-[1.12rem] [&_.text-sm]:text-base [&_.text-xs]:text-sm' : ''}`}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-700 text-sm font-bold text-white">T</span>
            <span className="font-semibold text-slate-900">{APP_NAME}</span>
            {profile && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
                {profile.name}
                {profile.isDemo ? ' (demo)' : ''}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <ModeSwitch />
            <select
              aria-label="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              aria-label="Bigger text"
              onClick={() => setBigText(!bigText)}
              className={`rounded-lg px-2 py-1 text-xs font-bold ${bigText ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Aa
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
        {children}
      </main>
      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-2xl grid-cols-5">
            {NAV.map((n) => {
              const active = path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={`flex flex-col items-center py-2 text-xs ${active ? 'text-violet-700' : 'text-slate-500'}`}>
                  <span className="text-lg leading-none">{n.icon}</span>
                  <span className="mt-0.5 font-medium">{t(lang, n.key)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
