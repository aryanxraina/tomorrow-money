import type { Category, Txn } from '../types';
import { addDays, diffDays, month, weekday } from './dates';
import { nextDates, type Recurring } from './recurring';
import { rng } from './rng';

export interface KnownItem {
  date: string;
  amount: number; // + in, - out
  label: string;
  category?: Category;
}

export interface DaySample {
  other: number;
  energy: number;
}

export type DayPool = DaySample[][]; // index by weekday 0..6

export interface Adjust {
  dailyDelta?: number; // + less spending per day (savings), - more
  dropKeys?: string[]; // recurring items cancelled
  scale?: Partial<Record<Category, number>>; // e.g. groceries 0.85
  ctSpread12?: boolean; // council tax over 12 months
  extra?: KnownItem[]; // extra one-offs (purchases, shocks, new income)
  ctMultiplier?: number; // council tax reductions/exemptions (0 = exempt)
  dropKnownLabels?: string[]; // e.g. replace a lump-sum tax bill with instalments
}

export interface ForecastInput {
  start: string; // today
  balance: number;
  days?: number;
  runs?: number;
  seed?: number;
  recurring: Recurring[];
  pool: DayPool;
  poolScaleByCategory?: Record<string, number>;
  known: KnownItem[];
  adjust?: Adjust;
}

export interface ForecastEvent {
  label: string;
  amount: number;
  category?: Category;
}

export interface ForecastDay {
  date: string;
  p10: number;
  p50: number;
  p90: number;
  pBelow0: number;
  events: ForecastEvent[];
}

export interface Forecast {
  days: ForecastDay[];
  firstRisk?: { date: string; p: number; trigger?: ForecastEvent };
  maxRisk: { date: string; p: number };
  risk30: number;
  lowestP50: { date: string; value: number };
  endP50: number;
}

/** Everyday (non-bill) spending per weekday from the last 13 weeks. */
export function buildDayPool(txns: Txn[], today: string, recurringKeys: Set<string>, keyOf: (t: Txn) => string): DayPool {
  const pool: DayPool = [[], [], [], [], [], [], []];
  const byDate = new Map<string, DaySample>();
  const from = addDays(today, -91);
  for (let d = from; d < today; d = addDays(d, 1)) byDate.set(d, { other: 0, energy: 0 });
  for (const t of txns) {
    if (t.amount >= 0 || t.date < from || t.date >= today) continue;
    if (t.source === 'receipt') continue; // receipts enrich, they don't double count
    if (recurringKeys.has(keyOf(t))) continue;
    if (t.category === 'transfers' || t.category === 'savings') continue;
    if (Math.abs(t.amount) > 250) continue; // one-off big items are not "everyday"
    const s = byDate.get(t.date);
    if (!s) continue;
    if (t.category === 'energy') s.energy += -t.amount;
    else s.other += -t.amount;
  }
  for (const [d, s] of byDate) pool[weekday(d)].push(s);
  return pool;
}

const winterFactor = (d: string) => {
  const m = month(d);
  return m === 12 || m === 1 || m === 2 ? 1.3 : m === 11 || m === 3 ? 1.15 : 1;
};

export function runForecast(input: ForecastInput): Forecast {
  const days = input.days ?? 90;
  const runs = input.runs ?? 400;
  const r = rng(input.seed ?? 7);
  const adj = input.adjust || {};
  const end = addDays(input.start, days);

  // Scheduled events (bills, income, known one-offs) by day offset.
  type Sched = { offset: number; label: string; category: Category; dir: 1 | -1; fixed?: number; samples?: number[] };
  const sched: Sched[] = [];
  for (const rec of input.recurring) {
    if (adj.dropKeys?.includes(rec.key)) continue;
    const dates = nextDates(rec, addDays(input.start, -1), end, { ctSpread12: adj.ctSpread12 });
    let fixed = rec.variable ? undefined : rec.last;
    if (rec.category === 'council_tax') {
      const mult = adj.ctMultiplier ?? 1;
      fixed = rec.last * mult * (adj.ctSpread12 ? 10 / 12 : 1);
      if (fixed === 0) continue;
    }
    const scale = rec.direction === 'out' ? adj.scale?.[rec.category] ?? 1 : 1;
    for (const d of dates) {
      sched.push({
        offset: diffDays(d, input.start),
        label: rec.label,
        category: rec.category,
        dir: rec.direction === 'in' ? 1 : -1,
        fixed: fixed !== undefined ? fixed * scale : undefined,
        samples: rec.variable ? rec.amounts.slice(-12).map((a) => a * scale) : undefined,
      });
    }
  }
  const known = input.known.filter((k) => !adj.dropKnownLabels?.includes(k.label));
  for (const k of [...known, ...(adj.extra || [])]) {
    const off = diffDays(k.date, input.start);
    if (off < 0 || off >= days) continue;
    sched.push({ offset: off, label: k.label, category: k.category || 'other', dir: k.amount >= 0 ? 1 : -1, fixed: Math.abs(k.amount) });
  }
  const byOffset: Sched[][] = Array.from({ length: days }, () => []);
  for (const s of sched) if (s.offset >= 0 && s.offset < days) byOffset[s.offset].push(s);

  const dateOf = (i: number) => addDays(input.start, i);
  const wd = Array.from({ length: days }, (_, i) => weekday(dateOf(i)));
  const wf = Array.from({ length: days }, (_, i) => winterFactor(dateOf(i)));
  const groceryScale = adj.scale?.groceries ?? 1;
  const dailyDelta = adj.dailyDelta ?? 0;

  const values: Float64Array[] = Array.from({ length: days }, () => new Float64Array(runs));
  for (let run = 0; run < runs; run++) {
    let bal = input.balance;
    for (let i = 0; i < days; i++) {
      for (const s of byOffset[i]) {
        const amt = s.fixed ?? (s.samples && s.samples.length ? s.samples[Math.floor(r.next() * s.samples.length)] : 0);
        bal += s.dir * amt;
      }
      const pool = input.pool[wd[i]];
      if (pool.length) {
        const day = pool[Math.floor(r.next() * pool.length)];
        bal -= day.other * groceryScale + day.energy * wf[i];
      }
      bal += dailyDelta;
      values[i][run] = bal;
    }
  }

  const out: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    const v = Array.from(values[i]).sort((a, b) => a - b);
    const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    const below = v.filter((x) => x < 0).length / v.length;
    out.push({
      date: dateOf(i),
      p10: q(0.1),
      p50: q(0.5),
      p90: q(0.9),
      pBelow0: below,
      events: byOffset[i].map((s) => ({
        label: s.label,
        amount: s.dir * (s.fixed ?? (s.samples ? s.samples.reduce((a, b) => a + b, 0) / s.samples.length : 0)),
        category: s.category,
      })),
    });
  }

  let firstRisk: Forecast['firstRisk'];
  const idx = out.findIndex((d) => d.pBelow0 >= 0.25);
  if (idx >= 0) {
    // the biggest bill on that day or the 5 days before is the likely trigger
    let trigger: ForecastEvent | undefined;
    for (let j = Math.max(0, idx - 5); j <= idx; j++) {
      for (const e of out[j].events) if (e.amount < 0 && (!trigger || e.amount < trigger.amount)) trigger = e;
    }
    firstRisk = { date: out[idx].date, p: out[idx].pBelow0, trigger };
  }
  let maxRisk = { date: out[0].date, p: 0 };
  let lowest = { date: out[0].date, value: Infinity };
  out.forEach((d) => {
    if (d.pBelow0 > maxRisk.p) maxRisk = { date: d.date, p: d.pBelow0 };
    if (d.p50 < lowest.value) lowest = { date: d.date, value: d.p50 };
  });
  const risk30 = Math.max(...out.slice(0, 30).map((d) => d.pBelow0));
  return { days: out, firstRisk, maxRisk, risk30, lowestP50: lowest, endP50: out[out.length - 1].p50 };
}
