'use client';

import { useState } from 'react';
import { AiBadge, Button, Card, Muted, Pill, Why, type Used } from '@/components/ui';
import { sampleInbox } from '@/lib/data/samples';
import { addMonths, gbp, niceDate, TODAY } from '@/lib/engine/dates';
import { postJSON, useEffectiveMode, useProfile } from '@/lib/hooks';
import { useStore } from '@/lib/store';

interface Sub {
  service: string;
  amount: number;
  cycle: 'monthly' | 'yearly' | 'weekly';
  nextDate: string | null;
  status: 'active' | 'trial' | 'price_rise';
  note: string;
}

export default function Subscriptions() {
  const profile = useProfile();
  const mode = useEffectiveMode();
  const addBills = useStore((s) => s.addBills);
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [used, setUsed] = useState<Used | null>(null);
  const [model, setModel] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  if (!profile)
    return (
      <Card>
        <p>Pick a demo person or do your check-in first.</p>
      </Card>
    );
  const inbox = sampleInbox(profile.id);

  const scan = async () => {
    setBusy(true);
    setAdded(false);
    try {
      const r = await postJSON<{ subs: Sub[]; used: Used; model?: string }>('/api/subscriptions', { mode, emails: inbox });
      setSubs(r.subs);
      setUsed(r.used);
      setModel(r.model);
    } finally {
      setBusy(false);
    }
  };

  const addToForecast = () => {
    if (!subs) return;
    const bills = subs.flatMap((s) => {
      if (!s.nextDate || s.nextDate < TODAY) return [];
      const n = s.cycle === 'monthly' ? 3 : 1;
      return Array.from({ length: n }, (_, i) => ({ label: `${s.service} (from email)`, date: i ? addMonths(s.nextDate!, i) : s.nextDate!, amount: s.amount }));
    });
    addBills(profile.id, bills);
    setAdded(true);
  };

  const monthly = subs?.reduce((x, s) => x + (s.cycle === 'monthly' ? s.amount : s.cycle === 'yearly' ? s.amount / 12 : s.amount * 4.33), 0) || 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Subscriptions from your inbox</h1>
        <Muted>We read receipts and renewal emails to find what renews, when, and what’s about to cost more.</Muted>
      </div>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Demo inbox</div>
            <div className="text-xs text-slate-500">{inbox.length} sample emails. In a launch: read-only email connection, processed on your device.</div>
          </div>
          <Button onClick={scan} disabled={busy}>
            {busy ? 'Scanning…' : 'Scan inbox'}
          </Button>
        </div>
        <Why label="See the emails">
          {inbox.map((e) => (
            <div key={e.id} className="border-b border-slate-200 pb-2">
              <div className="font-medium">{e.subject}</div>
              <div className="text-xs">{e.from}</div>
              <div className="text-xs">{e.body}</div>
            </div>
          ))}
        </Why>
      </Card>

      {subs && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Found {subs.length}</div>
              <div className="text-2xl font-bold">{gbp(monthly, 2)} a month</div>
            </div>
            <AiBadge used={used} model={model} />
          </div>
          <div className="divide-y divide-slate-100">
            {subs.map((s, i) => (
              <div key={i} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.service}</span>
                  <span className="font-semibold">{gbp(s.amount, 2)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  {s.status === 'trial' && <Pill tone="amber">Free trial ending</Pill>}
                  {s.status === 'price_rise' && <Pill tone="red">Price going up</Pill>}
                  {s.status === 'active' && <Pill>{s.cycle}</Pill>}
                  <span>{s.note}</span>
                  {s.nextDate && <span className="text-xs text-slate-400">next: {niceDate(s.nextDate)}</span>}
                </div>
                {s.status === 'trial' && <p className="mt-1 text-sm text-violet-800">Cancel before {s.nextDate ? niceDate(s.nextDate) : 'the trial ends'} if you won’t use it.</p>}
              </div>
            ))}
          </div>
          <Button variant="soft" onClick={addToForecast} disabled={added}>
            {added ? '✓ Added to your forecast' : 'Add these renewals to my forecast'}
          </Button>
        </Card>
      )}
    </div>
  );
}
