'use client';

import { CircleCheckBig, LifeBuoy, MessagesSquare, ShieldCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { ButtonLink, Card, HeroCard, Muted, Row } from '@/components/ui';
import { useStore } from '@/lib/store';

// A picture of the idea, not anyone's numbers: mostly steady days with a tight patch.
const EXAMPLE_STRIP = Array.from({ length: 90 }, (_, i) => {
  if ((i >= 29 && i <= 33) || (i >= 62 && i <= 65)) return 'var(--strip-risk)';
  if ((i >= 25 && i < 29) || (i > 33 && i <= 36) || (i >= 58 && i < 62)) return 'var(--strip-warn)';
  return 'var(--strip-good)';
});

export default function Landing() {
  const router = useRouter();
  const hasData = useStore((s) => !!s.answers);

  useEffect(() => {
    if (hasData) router.replace('/home');
  }, [hasData, router]);

  if (hasData) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 px-1 py-1">
        <Logo />
        <span className="font-display text-xl font-semibold tracking-tight">Tomorrow</span>
      </div>

      <HeroCard className="!p-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-lime">Welcome to Tomorrow</p>
        <h1 className="mt-2 text-balance font-display text-[40px] font-semibold leading-[1.04] tracking-tight">Let’s make understanding your money easier.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-hero-mut">See how long your money could last, what’s coming up, help you may be missing, and simple things you can do next.</p>
        <div className="mt-5" aria-hidden>
          <div className="grid h-3.5 gap-px" style={{ gridTemplateColumns: 'repeat(90, 1fr)' }}>
            {EXAMPLE_STRIP.map((colour, i) => (
              <i key={i} className="block rounded-[1px]" style={{ background: colour }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-hero-mut">
            <span>Today</span>
            <span>Your next 90 days (example)</span>
          </div>
        </div>
        <ButtonLink href="/onboarding" className="mt-5 w-full">
          Get started
        </ButtonLink>
        <p className="mt-2.5 text-center text-[13px] text-hero-mut">Free. About 2 minutes. No bank login needed.</p>
        <p className="mt-1 text-center text-[13px] text-hero-mut">
          Used Tomorrow before?{' '}
          <Link href="/onboarding" className="font-semibold text-lime underline underline-offset-2">
            Sign in to carry on
          </Link>
        </p>
      </HeroCard>

      <Card className="!py-2">
        <Row icon={<TrendingUp size={20} aria-hidden />} title="Know what’s coming" sub="Your money and bills over the next 90 days" />
        <Row icon={<LifeBuoy size={20} aria-hidden />} title="Find help you may be missing" sub="With links to the official checks" />
        <Row icon={<CircleCheckBig size={20} aria-hidden />} title="Know what to do next" sub="Three simple steps, explained" />
        <Row icon={<MessagesSquare size={20} aria-hidden />} title="Hear from people like you" sub="Real conversations about money" />
        <Row icon={<ShieldCheck size={20} aria-hidden />} title="Private by default" sub="Your data stays on this device" />
      </Card>

      <Muted className="px-1">Tomorrow never sells your data or uses it for credit decisions. It gives guidance to help you decide, not regulated financial or debt advice. For adults aged 18 and over.</Muted>
    </div>
  );
}
