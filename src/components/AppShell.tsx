'use client';

import { CircleCheckBig, Home, LayoutGrid, LifeBuoy, MessageCircle, ReceiptText, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AccountSync } from '@/components/Account';
import { Logo } from '@/components/Logo';
import { ProfileMenu } from '@/components/ProfileMenu';
import { useEffectiveMode, useMounted, useOnline } from '@/lib/hooks';
import { useStore } from '@/lib/store';

// The five main tabs, named in everyday words. The routes keep their original names so every
// existing link still works.
const NAV = [
  { href: '/home', label: 'Home', sub: 'Overview', icon: Home },
  { href: '/spending', label: 'Spending', sub: 'Your money', icon: ReceiptText },
  { href: '/forecast', label: 'Future', sub: 'What’s ahead', icon: TrendingUp },
  { href: '/help', label: 'Support', sub: 'Get help', icon: LifeBuoy },
  { href: '/plan', label: 'Actions', sub: 'What to do', icon: CircleCheckBig },
];

/** Pages reached from More tools, so it shows as the current section on them. */
const MORE_PAGES = ['/more', '/community', '/nearby', '/learn', '/details', '/subscriptions', '/reminders'];

// Wide screens (iPad landscape, desktop): how each page uses the width. Phones are unchanged.
// - columns: the page's cards flow into two columns
// - wide: one wider column (chat, forms)
// - anything else stays a single phone-width column, centred
const COLUMNS = ['/home', '/spending', '/forecast', '/help', '/plan', '/more', '/community', '/nearby', '/learn', '/subscriptions'];
const WIDE = ['/ask', '/snap', '/details', '/reminders'];
const under = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

/** Says plainly when nothing leaves the device. */
function PrivacyBanner() {
  const mode = useEffectiveMode();
  const online = useOnline();
  if (mode !== 'local') return null;
  return (
    <div role="status" className="chip-good px-4 py-1.5 text-center text-xs font-medium">
      {!online && 'You’re offline. '}On-device mode: nothing leaves your device.
    </div>
  );
}

/** Top navigation for wide screens. The lime pill slides to the current tab. */
function DesktopNav({ path }: { path: string }) {
  const activeIndex = NAV.findIndex((n) => path.startsWith(n.href));
  const moreActive = under(path, MORE_PAGES);
  return (
    <nav aria-label="Main" className="desk-nav sticky top-0 z-30 hidden px-8 pt-4 lg:block">
      <div className="hero-gradient mx-auto flex max-w-[1180px] items-center gap-6 rounded-[24px] px-4 py-2.5 text-hero-ink shadow-[0_16px_40px_-22px_rgba(0,0,0,.6)]">
        <Link href="/home" className="flex flex-none items-center gap-2.5 rounded-full pr-2" aria-label="Tomorrow, home">
          <span className="logo-float">
            <Logo size={34} />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Tomorrow</span>
        </Link>

        <div className="relative mx-auto grid w-full max-w-[680px] grid-cols-5 rounded-full bg-hero-soft p-1">
          {activeIndex >= 0 && (
            <span aria-hidden className="nav-pill absolute inset-y-1 left-1 rounded-full bg-lime" style={{ width: 'calc((100% - 8px) / 5)', transform: `translateX(${activeIndex * 100}%)` }} />
          )}
          {NAV.map((n, i) => {
            const active = i === activeIndex;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                title={`${n.label}: ${n.sub}`}
                className={`nav-link relative z-10 flex items-center justify-center gap-2 rounded-full px-3 py-1.5 ${active ? 'text-lime-ink' : 'text-hero-mut hover:text-hero-ink'}`}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                <span className="flex flex-col leading-tight">
                  <span className="text-[14px] font-semibold">{n.label}</span>
                  <span className={`nav-sub text-[11px] font-medium ${active ? 'opacity-75' : 'opacity-70'}`}>{n.sub}</span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-none items-center gap-2">
          <Link
            href="/ask"
            aria-current={path.startsWith('/ask') ? 'page' : undefined}
            className="nav-link flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-[14px] font-semibold text-lime-ink"
          >
            <MessageCircle size={18} aria-hidden />
            Ask
          </Link>
          <Link
            href="/more"
            aria-current={moreActive ? 'page' : undefined}
            className={`nav-link flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold ${moreActive ? 'bg-lime text-lime-ink' : 'bg-hero-soft text-hero-mut hover:text-hero-ink'}`}
          >
            <LayoutGrid size={18} aria-hidden className="nav-gear" />
            More tools
          </Link>
          <ProfileMenu onDark />
        </div>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const path = usePathname();
  const hasData = useStore((s) => !!s.answers);
  const bigText = useStore((s) => s.bigText);
  const theme = useStore((s) => s.theme);
  const storageFull = useStore((s) => s.storageFull);
  const showNav = mounted && hasData && path !== '/' && path !== '/onboarding';
  // Without a check-in, pages show a short "Let's get started" message, which stays narrow.
  const layout = !showNav ? 'narrow' : under(path, COLUMNS) ? 'columns' : under(path, WIDE) ? 'wide' : 'narrow';
  const width = layout === 'columns' ? 'lg:max-w-[1180px] lg:px-8' : layout === 'wide' ? 'lg:max-w-3xl lg:px-8' : 'lg:pt-10';

  useEffect(() => {
    // "System" means no attribute, so the phone's setting decides.
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!mounted) return <div className="min-h-screen bg-pg" />;

  return (
    <div className={`app-bg min-h-screen bg-pg ${bigText ? 'text-[1.12rem] [&_.text-sm]:text-base [&_.text-xs]:text-sm' : ''}`}>
      <PrivacyBanner />
      <AccountSync />
      {storageFull && (
        <div role="alert" className="chip-risk px-4 py-2 text-center text-sm font-medium">
          This browser is out of storage, so your latest changes aren’t saved. Free up space, or export your data under More tools.
        </div>
      )}
      {showNav && <DesktopNav path={path} />}
      <main className={`mx-auto max-w-xl px-3.5 md:max-w-2xl pt-[max(12px,env(safe-area-inset-top))] ${showNav ? 'pb-28 lg:pb-14 lg:pt-6' : 'pb-10'} ${width}`}>
        <div className="page" data-layout={layout}>
          {children}
        </div>
      </main>
      {showNav && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 px-3.5 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto grid max-w-xl grid-cols-5 rounded-[22px] bg-hero md:max-w-2xl shadow-[0_8px_24px_-12px_rgba(0,0,0,.5)]">
            {NAV.map((n) => {
              const active = path.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={`flex flex-col items-center gap-[3px] py-[9px] text-[11px] font-medium ${active ? 'text-lime' : 'text-hero-mut'}`}>
                  <Icon size={21} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
