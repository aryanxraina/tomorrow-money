'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Muted, Pill } from '@/components/ui';
import { getPersonas } from '@/lib/data/personas';
import { APP_NAME, useLang, useProfile } from '@/lib/hooks';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

const STEPS = [
  ['Understand', 'Money in, money out, and your Money Fingerprint'],
  ['Detect', 'Fees and extra costs you pay without knowing'],
  ['Predict', 'Financial time travel: your next 90 days, day by day'],
  ['Support', 'Money you may be owed and help nearby'],
  ['Plan', 'A few steps that make the forecast safer'],
];

export default function Home() {
  const router = useRouter();
  const profile = useProfile();
  const lang = useLang(profile);
  const setProfile = useStore((s) => s.setProfile);
  const personas = getPersonas();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-lg">
        <Pill tone="violet">Financial time travel</Pill>
        <h1 className="mt-3 text-3xl font-bold leading-tight">See money problems coming. Fix them before they happen.</h1>
        <p className="mt-3 text-violet-100">
          {APP_NAME} predicts your next 90 days, finds money you may be owed, and gives you a short plan. It runs with a cloud AI, or fully on your
          device when you are offline, in your language.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/onboarding" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-violet-800">
            {t(lang, 'startCheckin')}
          </Link>
          {profile && (
            <button onClick={() => router.push('/dashboard')} className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40">
              Continue as {profile.name}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t(lang, 'tryDemo')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProfile(p.id);
                router.push('/dashboard');
              }}
              className="text-left"
            >
              <Card className="h-full transition hover:ring-violet-300">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {p.name}, {p.age}
                  </div>
                  <Pill tone="violet">{p.hero}</Pill>
                </div>
                <div className="text-xs text-slate-500">{p.city}</div>
                <p className="mt-2 text-sm text-slate-700">{p.tagline}</p>
              </Card>
            </button>
          ))}
        </div>
        <Muted className="mt-2">Demo people use made-up bank data. Nothing here is real.</Muted>
      </section>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">How it works</h2>
        <ol className="space-y-2">
          {STEPS.map(([title, desc], i) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">{i + 1}</span>
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-sm text-slate-600">{desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="bg-emerald-50 ring-emerald-100">
        <div className="font-semibold text-emerald-900">Your data, your choice</div>
        <p className="mt-1 text-sm text-emerald-900/80">
          Numbers are worked out by the app’s own code. AI only explains them. In On-device mode nothing leaves your device, and the app never sells data or
          makes credit decisions.
        </p>
      </Card>
      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => router.push('/more')}>
          Settings and more
        </Button>
      </div>
    </div>
  );
}
