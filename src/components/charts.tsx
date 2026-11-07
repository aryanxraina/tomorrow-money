'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { gbp, shortDate } from '@/lib/engine/dates';
import type { Forecast } from '@/lib/engine/forecast';
import type { FingerprintDim } from '@/lib/engine/understand';
import type { SimYear } from '@/lib/engine/invest';

export function ForecastChart({ base, plan, height = 240 }: { base: Forecast; plan?: Forecast | null; height?: number }) {
  const data = base.days.map((d, i) => ({
    date: d.date,
    band: [Math.round(d.p10), Math.round(d.p90)] as [number, number],
    p50: Math.round(d.p50),
    plan: plan ? Math.round(plan.days[i].p50) : undefined,
    risk: Math.round(d.pBelow0 * 100),
  }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => shortDate(d)} tick={{ fontSize: 11, fill: '#64748b' }} interval={14} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v: number) => gbp(v)} tick={{ fontSize: 11, fill: '#64748b' }} width={60} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v, name) => {
              if (Array.isArray(v)) return [`${gbp(v[0] as number)} to ${gbp(v[1] as number)}`, 'Likely range'];
              if (name === 'risk') return [`${v}%`, 'Chance below £0'];
              return [gbp(v as number), name === 'plan' ? 'With your plan' : 'Most likely'];
            }}
            labelFormatter={(d) => shortDate(String(d))}
          />
          <ReferenceLine y={0} stroke="#e11d48" strokeDasharray="4 4" />
          <Area dataKey="band" stroke="none" fill="#c4b5fd" fillOpacity={0.45} isAnimationActive={false} />
          <Line dataKey="p50" stroke="#6d28d9" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          {plan && <Line dataKey="plan" stroke="#059669" strokeWidth={2.5} strokeDasharray="6 3" dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FingerprintRadar({ dims }: { dims: FingerprintDim[] }) {
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={dims} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
          <Radar dataKey="score" stroke="#6d28d9" fill="#8b5cf6" fillOpacity={0.35} isAnimationActive={false} />
          <Tooltip formatter={(v) => [`${v}/100`, 'Score']} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimChart({ data }: { data: SimYear[] }) {
  const rows = data.map((d) => ({ year: `Yr ${d.year}`, band: [Math.round(d.p10), Math.round(d.p90)] as [number, number], p50: Math.round(d.p50), cash: Math.round(d.cash), paid: Math.round(d.paidIn) }));
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f4" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v: number) => gbp(v)} tick={{ fontSize: 11, fill: '#64748b' }} width={64} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v, name) => {
              if (Array.isArray(v)) return [`${gbp(v[0] as number)} to ${gbp(v[1] as number)}`, 'Bad to good years'];
              return [gbp(v as number), name === 'p50' ? 'Typical' : name === 'cash' ? 'Cash savings' : 'You paid in'];
            }}
          />
          <Area dataKey="band" stroke="none" fill="#a7f3d0" fillOpacity={0.6} isAnimationActive={false} />
          <Line dataKey="p50" stroke="#059669" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line dataKey="cash" stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line dataKey="paid" stroke="#cbd5e1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
