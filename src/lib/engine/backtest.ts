// How good would past forecasts have been? Stands at earlier dates in someone's history, forecasts forward
// using only what was known then, and compares that with what really happened. Results are percentages
// and counts only, so they're safe to share without revealing anyone's money.
//
// It uses statements alone, with no answers from the person. Lump sums the person would normally tell us
// about, such as a student loan, can't be seen coming here, so those results understate the real app.
import { BLANK_ANSWERS } from '../answers';
import type { Txn } from '../types';
import { analyse } from './analyse';
import { addDays, diffDays } from './dates';
import { everydayRule } from './forecast';
import { prepareTxns } from './prepare';
import { txnKey } from './recurring';

export interface HorizonResult {
  horizon: number;
  /** How many past dates this was tested from. */
  points: number;
  /** Typical miss, as a percentage of a month's spending. */
  medianErrorPct: number;
  /** Typical direction of the miss. Above zero means forecasts were too hopeful, which is the dangerous way round. */
  biasPct: number;
  /** The same miss for a simple guess: "the recent average daily change continues". The forecast should beat this. */
  naiveErrorPct: number;
  /** How often what really happened fell inside the shaded range. The range is meant to catch about 80%. */
  insideRangePct: number;
}

export interface RiskResult {
  /** Past dates tested, starting with money in the account. */
  points: number;
  /** Past dates left out because the account was already below £0. */
  alreadyBelow: number;
  /** Dates when the balance really did go below £0 in the next 30 days. */
  wentBelow: number;
  /** Dates when we warned of a risky day in the next 30 days. */
  warnings: number;
  /** Dates when both happened: so hits out of `wentBelow` were caught, and hits out of `warnings` came true. */
  hits: number;
  /** Does a stated risk mean what it says? Of the days given about this risk, how many really were below £0. */
  buckets: { label: string; days: number; happenedPct: number }[];
}

export interface Backtest {
  horizons: HorizonResult[];
  /** Needs a closing balance. Null without one. */
  risk: RiskResult | null;
  /** Typical amounts in a 30-day period that the forecast doesn't try to predict, as a percentage of a month's spending. */
  unseen: { oneOffsPct: number; movesPct: number } | null;
}

const EMPTY: Backtest = { horizons: [], risk: null, unseen: null };
const RISKY = 0.25; // what the app calls a risky day
const BUCKETS = [
  { label: 'under 10%', below: 0.1 },
  { label: '10% to 25%', below: 0.25 },
  { label: '25% to 50%', below: 0.5 },
  { label: 'over 50%', below: Infinity },
];

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, z) => a - z);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface BacktestOptions {
  horizons?: number[];
  stepDays?: number;
  minHistoryDays?: number;
  /** The balance after the newest transaction, which lets real balances be worked out for every past day. */
  closing?: number | null;
}

export function backtest(raw: Txn[], { horizons = [7, 14, 30, 60], stepDays = 14, minHistoryDays = 60, closing = null }: BacktestOptions = {}): Backtest {
  const usable = raw.filter((t) => t.source !== 'receipt').sort((a, z) => a.date.localeCompare(z.date));
  if (!usable.length) return EMPTY;
  const oldest = usable[0].date;
  const newest = usable[usable.length - 1].date;
  const prepared = prepareTxns(usable, {}, addDays(newest, 1));
  const changeBetween = (from: string, to: string) => usable.reduce((sum, t) => (t.date >= from && t.date < to ? sum + t.amount : sum), 0);

  const byHorizon = new Map(horizons.map((h) => [h, { errors: [] as number[], signed: [] as number[], naive: [] as number[], inside: 0 }]));
  const oneOffs: number[] = [];
  const moves: number[] = [];
  const risk: RiskResult = { points: 0, alreadyBelow: 0, wentBelow: 0, warnings: 0, hits: 0, buckets: [] };
  const bucketDays = BUCKETS.map(() => ({ days: 0, below: 0 }));

  for (let cut = addDays(oldest, minHistoryDays); diffDays(newest, cut) >= Math.min(...horizons); cut = addDays(cut, stepDays)) {
    const before = usable.filter((t) => t.date < cut);
    if (!before.length) continue;
    const start = closing === null ? 0 : closing - changeBetween(cut, addDays(newest, 1));
    const an = analyse({ ...BLANK_ANSWERS, balance: start }, before, cut);
    const monthlySpend = Math.max(1, an.summary.monthlyOut);
    const share = (amount: number) => (amount / monthlySpend) * 100;
    const pastDays = Math.max(1, Math.min(91, diffDays(cut, oldest)));
    const pastChange = changeBetween(addDays(cut, -pastDays), cut);

    for (const h of horizons) {
      if (diffDays(newest, cut) < h) continue;
      const tally = byHorizon.get(h)!;
      const day = an.forecast.days[h - 1];
      const actual = changeBetween(cut, addDays(cut, h));
      const predicted = day.p50 - start;
      tally.errors.push(share(Math.abs(predicted - actual)));
      tally.signed.push(share(predicted - actual));
      tally.naive.push(share(Math.abs((pastChange / pastDays) * h - actual)));
      if (actual >= day.p10 - start && actual <= day.p90 - start) tally.inside++;
    }

    if (diffDays(newest, cut) < 30) continue;

    // What the forecast doesn't try to predict, so a large miss can be traced to its cause.
    const scheduled = new Set(an.recurring.map((r) => r.key));
    const isEveryday = everydayRule(an.txns, cut, txnKey);
    const next = prepared.filter((t) => t.date >= cut && t.date < addDays(cut, 30));
    const isMove = (t: Txn) => t.category === 'internal' || t.category === 'savings';
    oneOffs.push(share(next.filter((t) => !isMove(t) && !scheduled.has(txnKey(t)) && !isEveryday(t)).reduce((s, t) => s + Math.abs(t.amount), 0)));
    moves.push(share(Math.abs(next.filter(isMove).reduce((s, t) => s + t.amount, 0))));

    if (closing === null) continue;
    if (start < 0) {
      risk.alreadyBelow++;
      continue;
    }
    risk.points++;
    const days = an.forecast.days.slice(0, 30);
    const warned = days.some((d) => d.pBelow0 >= RISKY);
    let wentBelow = false;
    days.forEach((d, i) => {
      const below = start + changeBetween(cut, addDays(cut, i + 1)) < 0;
      wentBelow ||= below;
      const bucket = bucketDays[BUCKETS.findIndex((b) => d.pBelow0 < b.below)];
      bucket.days++;
      if (below) bucket.below++;
    });
    if (wentBelow) risk.wentBelow++;
    if (warned) risk.warnings++;
    if (wentBelow && warned) risk.hits++;
  }

  const results: HorizonResult[] = [];
  for (const [horizon, tally] of byHorizon) {
    if (!tally.errors.length) continue;
    results.push({
      horizon,
      points: tally.errors.length,
      medianErrorPct: Math.round(median(tally.errors)),
      biasPct: Math.round(median(tally.signed)),
      naiveErrorPct: Math.round(median(tally.naive)),
      insideRangePct: Math.round((tally.inside / tally.errors.length) * 100),
    });
  }
  risk.buckets = BUCKETS.map((b, i) => ({ label: b.label, days: bucketDays[i].days, happenedPct: bucketDays[i].days ? Math.round((bucketDays[i].below / bucketDays[i].days) * 100) : 0 }));
  return {
    horizons: results,
    risk: closing === null || !(risk.points + risk.alreadyBelow) ? null : risk,
    unseen: oneOffs.length ? { oneOffsPct: Math.round(median(oneOffs)), movesPct: Math.round(median(moves)) } : null,
  };
}
