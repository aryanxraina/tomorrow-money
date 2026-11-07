'use client';

import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { gbp, niceDate, shortDate } from '@/lib/engine/dates';
import type { Forecast } from '@/lib/engine/forecast';
import type { SimYear } from '@/lib/engine/invest';
import type { CategoryTrend, FingerprintDim } from '@/lib/engine/understand';

const axisTick = { fontSize: 11, fill: 'var(--chart-axis)' };
const tooltipBox = 'rounded-2xl bg-card px-3 py-2 text-[13px] leading-snug shadow-lg ring-1 ring-hair';

interface ChartRow {
  date: string;
  band: [number, number];
  p50: number;
  plan?: number;
  risk: number;
}

function ForecastTip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={tooltipBox}>
      <div className="font-semibold">{niceDate(row.date)}</div>
      <div className="num">Most likely {gbp(row.p50)}</div>
      <div className="num text-mut">
        Range {gbp(row.band[0])} to {gbp(row.band[1])}
      </div>
      {row.plan !== undefined && <div className="num text-good">With your plan {gbp(row.plan)}</div>}
      <div className={`num ${row.risk >= 25 ? 'text-risk' : 'text-mut'}`}>{row.risk}% chance below £0</div>
    </div>
  );
}

/** The next 90 days: the likely balance, the range around it and, if given, the plan. */
export function ForecastChart({ base, plan, height = 240, compact = false }: { base: Forecast; plan?: Forecast | null; height?: number; compact?: boolean }) {
  const data: ChartRow[] = base.days.map((d, i) => ({
    date: d.date,
    band: [Math.round(d.p10), Math.round(d.p90)],
    p50: Math.round(d.p50),
    plan: plan ? Math.round(plan.days[i].p50) : undefined,
    risk: Math.round(d.pBelow0 * 100),
  }));
  const first = base.firstRisk;
  const firstRow = first ? data.find((d) => d.date === first.date) : undefined;
  // Month starts make better axis labels than arbitrary 15-day steps.
  const ticks = data.filter((d) => d.date.endsWith('-01')).map((d) => d.date);
  return (
    <div style={{ height }} role="img" aria-label={first ? `Forecast balance for 90 days. The first risky day is ${niceDate(first.date)}.` : 'Forecast balance for 90 days, with no risky days.'}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: compact ? 0 : 6, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" hide={compact} ticks={ticks} tickFormatter={(d: string) => shortDate(d)} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis hide={compact} tickFormatter={(v: number) => gbp(v)} tick={axisTick} width={56} tickLine={false} axisLine={false} tickCount={4} />
          {!compact && <Tooltip content={<ForecastTip />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1, strokeDasharray: '3 3' }} />}
          <ReferenceLine y={0} stroke="var(--chart-axis)" strokeDasharray="3 3" strokeOpacity={0.6} />
          <Area dataKey="band" stroke="none" fill="var(--chart-band)" fillOpacity={1} isAnimationActive={false} />
          {plan && <Line dataKey="plan" stroke="var(--chart-plan)" strokeWidth={1.8} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />}
          <Line dataKey="p50" stroke="var(--chart-line)" strokeWidth={2.6} dot={false} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false} />
          {firstRow && <ReferenceDot x={firstRow.date} y={firstRow.p50} r={5} fill="var(--strip-risk)" stroke="var(--card)" strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const stripColour = (p: number) => (p >= 0.25 ? 'var(--strip-risk)' : p >= 0.1 ? 'var(--strip-warn)' : 'var(--strip-good)');

/** Every one of the next 90 days as a small bar, like a weather forecast for your money. */
export function RiskStrip({ forecast, inHero = false }: { forecast: Forecast; inHero?: boolean }) {
  const risky = forecast.days.filter((d) => d.pBelow0 >= 0.25).length;
  const last = forecast.days[forecast.days.length - 1];
  return (
    <div>
      <div className="grid h-3 gap-px" style={{ gridTemplateColumns: `repeat(${forecast.days.length}, 1fr)` }} role="img" aria-label={`${risky} of the next ${forecast.days.length} days have a real chance of going below £0.`}>
        {forecast.days.map((d) => (
          <i key={d.date} className="block rounded-[1px]" style={{ background: stripColour(d.pBelow0) }} />
        ))}
      </div>
      <div className={`num mt-1.5 flex justify-between text-[11px] ${inHero ? 'text-hero-mut' : 'text-mut'}`}>
        <span>Today</span>
        <span>{shortDate(last.date)}</span>
      </div>
    </div>
  );
}

export function RiskLegend() {
  const items: [string, string][] = [
    ['var(--strip-good)', 'Steady'],
    ['var(--strip-warn)', 'Tight'],
    ['var(--strip-risk)', 'Could go below £0'],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mut">
      {items.map(([colour, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className="block h-2 w-2 rounded-[2px]" style={{ background: colour }} />
          {label}
        </span>
      ))}
    </div>
  );
}

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

/** One small chart per category, so several trends stay readable on a phone. */
export function CategoryTrendChart({ label, trend }: { label: string; trend: CategoryTrend }) {
  const data = trend.months.map((m) => ({ name: monthName(m.month), amount: m.amount }));
  const last = trend.months.at(-1)?.amount ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="num text-mut">
          {gbp(last)}
          {trend.changePct !== null && (
            <span className="ml-1 text-xs">
              ({trend.changePct > 0 ? '+' : ''}
              {trend.changePct}%)
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 68 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} interval={0} height={16} />
            <Tooltip cursor={{ fill: 'var(--card-2)' }} content={({ active, payload }) => (active && payload?.[0] ? <div className={tooltipBox}>{gbp(payload[0].value as number)}</div> : null)} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
              {/* The latest month stands out. Earlier months are quiet context. */}
              {data.map((row, i) => (
                <Cell key={row.name} fill={i === data.length - 1 ? 'var(--chart-line)' : 'color-mix(in srgb, var(--chart-line) 26%, transparent)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Six strengths as simple bars. Easier to read than a radar chart, and it says what each one means. */
export function ScoreBars({ dims }: { dims: FingerprintDim[] }) {
  return (
    <div className="space-y-3">
      {dims.map((d) => (
        <div key={d.id}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="font-medium">{d.label}</span>
            <span className="num text-mut">{d.score}/100</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-card-2">
            <div className="h-2 rounded-full" style={{ width: `${d.score}%`, background: 'var(--chart-line)' }} />
          </div>
          <div className="mt-0.5 text-xs text-mut">{d.detail}</div>
        </div>
      ))}
    </div>
  );
}

export function SimChart({ data }: { data: SimYear[] }) {
  const rows = data.map((d) => ({ year: `Year ${d.year}`, band: [Math.round(d.p10), Math.round(d.p90)] as [number, number], p50: Math.round(d.p50), cash: Math.round(d.cash), paid: Math.round(d.paidIn) }));
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={(v: number) => gbp(v)} tick={axisTick} width={60} tickLine={false} axisLine={false} tickCount={4} />
          <Tooltip
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !r) return null;
              return (
                <div className={tooltipBox}>
                  <div className="font-semibold">{r.year}</div>
                  <div className="num">Typical {gbp(r.p50)}</div>
                  <div className="num text-mut">
                    Bad to good years {gbp(r.band[0])} to {gbp(r.band[1])}
                  </div>
                  <div className="num text-mut">Cash savings {gbp(r.cash)}</div>
                  <div className="num text-mut">You paid in {gbp(r.paid)}</div>
                </div>
              );
            }}
          />
          <Area dataKey="band" stroke="none" fill="var(--chart-band)" fillOpacity={1} isAnimationActive={false} />
          <Line dataKey="p50" stroke="var(--chart-line)" strokeWidth={2.6} dot={false} isAnimationActive={false} />
          <Line dataKey="cash" stroke="var(--chart-plan)" strokeWidth={1.8} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line dataKey="paid" stroke="var(--chart-axis)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
