import { rng } from './rng';

export interface Readiness {
  ready: boolean;
  checks: { label: string; ok: boolean; detail: string }[];
}

export function investReadiness(opts: { bufferDays: number; highCostDebt: boolean; essentialsRatio: number; riskNext90: number }): Readiness {
  const checks = [
    { label: 'Safety buffer of at least 30 days', ok: opts.bufferDays >= 30, detail: `You have about ${Math.round(opts.bufferDays)} days.` },
    { label: 'No high-cost debt', ok: !opts.highCostDebt, detail: opts.highCostDebt ? 'Paying off a high-cost loan usually beats any investment return.' : 'None found.' },
    { label: 'Low risk of running out in the next 3 months', ok: opts.riskNext90 < 0.1, detail: `Highest risk: ${Math.round(opts.riskNext90 * 100)}%.` },
    { label: 'Some room after essentials', ok: opts.essentialsRatio < 0.8, detail: `Essentials take ${Math.round(opts.essentialsRatio * 100)}% of income.` },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}

export interface SimYear {
  year: number;
  paidIn: number;
  cash: number;
  p10: number;
  p50: number;
  p90: number;
}

/**
 * Monthly investing simulator. ASSUMPTIONS (shown in the UI): a global shares fund returning
 * 5% a year after inflation on average with 15% yearly volatility, 0.3% yearly fees; cash at 1%.
 * Educational illustration only, not advice.
 */
export function simulateInvesting(monthly: number, years: number, runs = 600): SimYear[] {
  const r = rng(42);
  const mu = 0.05 / 12;
  const sigma = 0.15 / Math.sqrt(12);
  const fee = 0.003 / 12;
  const paths: number[][] = [];
  const gauss = () => {
    const u = Math.max(1e-9, r.next());
    const v = r.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  for (let k = 0; k < runs; k++) {
    let v = 0;
    const yearly: number[] = [];
    for (let m = 1; m <= years * 12; m++) {
      v = (v + monthly) * (1 + mu + sigma * gauss() - fee);
      if (m % 12 === 0) yearly.push(v);
    }
    paths.push(yearly);
  }
  const out: SimYear[] = [];
  for (let y = 0; y < years; y++) {
    const vals = paths.map((p) => p[y]).sort((a, b) => a - b);
    const q = (p: number) => vals[Math.floor(p * (vals.length - 1))];
    let cash = 0;
    for (let m = 1; m <= (y + 1) * 12; m++) cash = (cash + monthly) * (1 + 0.01 / 12);
    out.push({ year: y + 1, paidIn: monthly * 12 * (y + 1), cash, p10: q(0.1), p50: q(0.5), p90: q(0.9) });
  }
  return out;
}
