'use client';

import { CircleCheckBig, Home, LifeBuoy, ReceiptText, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useEffectiveMode, useMounted, useOnline } from '@/lib/hooks';
import { useStore } from '@/lib/store';

const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/spending', label: 'Spending', icon: ReceiptText },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/help', label: 'Help', icon: LifeBuoy },
  { href: '/plan', label: 'Plan', icon: CircleCheckBig },
];

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

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const path = usePathname();
  const hasData = useStore((s) => !!s.answers);
  const bigText = useStore((s) => s.bigText);
  const theme = useStore((s) => s.theme);
  const storageFull = useStore((s) => s.storageFull);
  const showNav = mounted && hasData && path !== '/' && path !== '/onboarding';

  useEffect(() => {
    // "System" means no attribute, so the phone's setting decides.
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!mounted) return <div className="min-h-screen bg-pg" />;

  return (
    <div className={`min-h-screen bg-pg ${bigText ? 'text-[1.12rem] [&_.text-sm]:text-base [&_.text-xs]:text-sm' : ''}`}>
      <PrivacyBanner />
      {storageFull && (
        <div role="alert" className="chip-risk px-4 py-2 text-center text-sm font-medium">
          This browser is out of storage, so your latest changes aren’t saved. Free up space, or export your data under More.
        </div>
      )}
      <main className={`mx-auto max-w-xl px-3.5 pt-[max(12px,env(safe-area-inset-top))] ${showNav ? 'pb-28' : 'pb-10'}`}>{children}</main>
      {showNav && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 px-3.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-xl grid-cols-5 rounded-[22px] bg-hero shadow-[0_8px_24px_-12px_rgba(0,0,0,.5)]">
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
