'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Field, inputCls, Muted } from '@/components/ui';
import { useAiStatus, useProfile } from '@/lib/hooks';
import { useStore } from '@/lib/store';

const LINKS = [
  { href: '/subscriptions', title: 'Subscriptions', desc: 'Find renewals, trials and price rises in your inbox' },
  { href: '/invest', title: 'Invest (when ready)', desc: 'Readiness check, time-travel simulator, share prices' },
  { href: '/onboarding', title: 'Redo my check-in', desc: 'Update your answers or upload a bank statement' },
  { href: '/', title: 'Switch person', desc: 'Try another demo person' },
];

export default function More() {
  const router = useRouter();
  const profile = useProfile();
  const status = useAiStatus();
  const busFare = useStore((s) => s.busFare);
  const setBusFare = useStore((s) => s.setBusFare);
  const reset = useStore((s) => s.reset);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">More</h1>
      <div className="grid gap-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="hover:ring-violet-300">
              <div className="font-semibold">{l.title}</div>
              <Muted>{l.desc}</Muted>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="space-y-3">
        <h2 className="font-semibold">Settings</h2>
        <Field label="Bus fare for trips over 15 minutes (£)">
          <input type="number" step="0.1" className={inputCls} value={busFare} onChange={(e) => setBusFare(Number(e.target.value))} />
        </Field>
        <div className="text-sm text-slate-600">
          <div>Cloud AI: {status?.cloud ? status.cloudName : 'not set (add a key in .env.local)'}</div>
          <div>
            On-device AI: {status?.localModel} at {status?.localUrl}
          </div>
          <div>Google Maps: {status?.google ? 'connected' : 'not set, using sample places'}</div>
          <div>Share prices: {status?.finnhub ? 'Finnhub connected' : 'sample prices'}</div>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            reset();
            router.push('/');
          }}
        >
          Delete all my data on this device
        </Button>
        {profile && <Muted>Currently viewing: {profile.name}</Muted>}
      </Card>
    </div>
  );
}
