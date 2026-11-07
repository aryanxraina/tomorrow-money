'use client';

import { Check, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SimChart } from '@/components/charts';
import { Card, Chip, Muted, NoProfile, SectionTitle, TopBar, Why } from '@/components/ui';
import { gbp } from '@/lib/engine/dates';
import { investReadiness, simulateInvesting } from '@/lib/engine/invest';
import { useMoney } from '@/lib/hooks';

// Education only: no named funds or shares and no prices, so this isn't promoting any investment.
export default function Learn() {
  const money = useMoney();
  const [monthly, setMonthly] = useState(25);
  const [years, setYears] = useState(10);
  const sim = useMemo(() => simulateInvesting(monthly, years), [monthly, years]);
  if (!money) return <NoProfile />;
  const { an } = money;
  const ready = investReadiness({
    bufferDays: an.bufferDays,
    highCostDebt: an.problems.some((p) => p.id === 'hcc'),
    essentialsRatio: an.summary.monthlyIn > 0 ? an.summary.essentialsRatio : null,
    riskNext90: an.gaps.canJudge ? an.forecast.maxRisk.p : null,
  });
  const last = sim[sim.length - 1];

  return (
    <div className="space-y-3">
      <TopBar title="Learn about investing" back="/more" />
      <Muted className="px-1">For learning only. Investing usually only makes sense once you have a safety net, and your money can go down as well as up.</Muted>

      <Card>
        <SectionTitle action={<Chip tone={ready.ready ? 'good' : 'warn'}>{ready.ready ? 'Looks ready' : 'Not yet'}</Chip>}>Is it the right time?</SectionTitle>
        <ul className="mt-2 space-y-2.5">
          {ready.checks.map((c) => (
            <li key={c.label} className="flex gap-2.5 text-sm">
              <span className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${c.ok ? 'bg-lime text-lime-ink' : 'bg-card-2 text-mut'}`}>{c.ok ? <Check size={13} strokeWidth={3} aria-hidden /> : <Minus size={13} strokeWidth={3} aria-hidden />}</span>
              <span>
                <b className="font-semibold">{c.label}.</b> <span className="text-mut">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <Why>
          <p>These four checks run on your own numbers. They’re a general rule of thumb, not personal investment advice.</p>
        </Why>
      </Card>

      <Card>
        <SectionTitle>How money could grow</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <label className="block">
            <span className="num font-medium">{gbp(monthly)} a month</span>
            <input type="range" min={5} max={150} step={5} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} className="mt-1 w-full accent-[var(--chart-line)]" />
          </label>
          <label className="block">
            <span className="num font-medium">for {years} years</span>
            <input type="range" min={1} max={25} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-1 w-full accent-[var(--chart-line)]" />
          </label>
        </div>
        <div className="mt-2">
          <SimChart data={sim} />
        </div>
        <p className="mt-2 text-sm">
          You’d pay in <b className="font-semibold">{gbp(last.paidIn)}</b>. A typical outcome here is <b className="font-semibold text-good">{gbp(last.p50)}</b>, with a range of {gbp(last.p10)} to {gbp(last.p90)}, compared with {gbp(last.cash)} in cash savings.
        </p>
        <Why label="What does this assume?">
          <p>A broad mix of shares averaging 5% a year after inflation, with ups and downs, minus 0.3% in fees, and cash savings at 1%. Real results will differ and could be lower than you paid in. This is an illustration, not a forecast or advice.</p>
        </Why>
      </Card>

      <Card>
        <SectionTitle>The basics</SectionTitle>
        <ul className="mt-2 space-y-2.5 text-sm">
          <li>
            <b className="font-semibold">Workplace pension.</b> <span className="text-mut">If you’re employed, your employer usually adds money too, so staying in is often a good first step.</span>
          </li>
          <li>
            <b className="font-semibold">Stocks and Shares ISA.</b> <span className="text-mut">A tax-free wrapper for investing, with a yearly limit on what you can pay in.</span>
          </li>
          <li>
            <b className="font-semibold">Lifetime ISA.</b> <span className="text-mut">For people aged 18 to 39 saving for a first home or later life. The government adds a bonus, but check the withdrawal rules first.</span>
          </li>
        </ul>
        <a href="https://www.moneyhelper.org.uk/en/savings/how-to-save/investing-beginners-guide" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-link">
          MoneyHelper’s beginner’s guide
        </a>
      </Card>
    </div>
  );
}
