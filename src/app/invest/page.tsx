'use client';

import { useEffect, useMemo, useState } from 'react';
import { SimChart } from '@/components/charts';
import { Card, Muted, Pill } from '@/components/ui';
import { gbp } from '@/lib/engine/dates';
import { investReadiness, simulateInvesting } from '@/lib/engine/invest';
import { useAnalysis, useProfile } from '@/lib/hooks';

export default function Invest() {
  const profile = useProfile();
  const an = useAnalysis(profile);
  const [monthly, setMonthly] = useState(25);
  const [years, setYears] = useState(10);
  const [quotes, setQuotes] = useState<{ symbol: string; price: number; change: number; source: string }[]>([]);
  const sim = useMemo(() => simulateInvesting(monthly, years), [monthly, years]);
  useEffect(() => {
    fetch('/api/quote?symbols=VWRL,VUSA,AAPL')
      .then((r) => r.json())
      .then((j) => setQuotes(j.quotes || []))
      .catch(() => undefined);
  }, []);

  if (!profile || !an)
    return (
      <Card>
        <p>Pick a demo person or do your check-in first.</p>
      </Card>
    );

  const ready = investReadiness({
    bufferDays: an.bufferDays,
    highCostDebt: an.problems.some((p) => p.id === 'hcc'),
    essentialsRatio: an.summary.essentialsRatio,
    riskNext90: an.forecast.maxRisk.p,
  });
  const last = sim[sim.length - 1];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Growing money, when you’re ready</h1>
        <Muted>The last step on your plan. Investing only makes sense once you have a safety buffer.</Muted>
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ready to invest?</h2>
          <Pill tone={ready.ready ? 'green' : 'amber'}>{ready.ready ? 'Ready' : 'Not yet'}</Pill>
        </div>
        <ul className="mt-2 space-y-1.5">
          {ready.checks.map((c) => (
            <li key={c.label} className="flex gap-2 text-sm">
              <span>{c.ok ? '✅' : '⬜'}</span>
              <span>
                <b>{c.label}.</b> {c.detail}
              </span>
            </li>
          ))}
        </ul>
        {!ready.ready && <p className="mt-2 text-sm text-violet-800">Follow your plan first. You can still explore the simulator below.</p>}
      </Card>

      <Card>
        <h2 className="font-semibold">Time-travel simulator</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <label>
            {gbp(monthly)} a month
            <input type="range" min={5} max={150} step={5} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} className="w-full accent-violet-700" />
          </label>
          <label>
            for {years} years
            <input type="range" min={1} max={25} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full accent-violet-700" />
          </label>
        </div>
        <SimChart data={sim} />
        <p className="text-sm">
          You’d pay in <b>{gbp(last.paidIn)}</b>. In a typical outcome that becomes <b className="text-emerald-700">{gbp(last.p50)}</b> (bad years {gbp(last.p10)}, good years{' '}
          {gbp(last.p90)}), compared with {gbp(last.cash)} in cash savings.
        </p>
        <Muted className="mt-2">
          Assumptions: a global shares fund averaging 5% a year after inflation, with ups and downs, minus 0.3% fees. Values can fall. This is an illustration to help you
          learn, not advice.
        </Muted>
      </Card>

      <Card>
        <h2 className="font-semibold">Plain English</h2>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          <li>
            <b>Workplace pension:</b> if you’re employed, your employer usually adds money too. Staying in is often the best first step.
          </li>
          <li>
            <b>Stocks & Shares ISA:</b> a tax-free wrapper for investing. Many apps let you start small.
          </li>
          <li>
            <b>Lifetime ISA:</b> if you’re 18–39 and saving for a first home, the government adds a 25% bonus. Check the withdrawal rules first.
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold">Share price tracker</h2>
        <div className="mt-2 divide-y divide-slate-100">
          {quotes.map((q) => (
            <div key={q.symbol} className="flex justify-between py-1.5 text-sm">
              <span className="font-medium">{q.symbol}</span>
              <span>
                {q.price.toFixed(2)} <span className={q.change >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%</span>
                {q.source === 'sample' && <span className="ml-1 text-xs text-slate-400">sample</span>}
              </span>
            </div>
          ))}
        </div>
        <Muted className="mt-1">Live prices when FINNHUB_API_KEY is set (free tier). Prices shown for learning, not recommendations.</Muted>
      </Card>
    </div>
  );
}
