// Writes the raw inputs and the engine's results to .audit/engine.json for scripts/audit_engine.py.
// Run both with: npm run audit
import { mkdirSync, writeFileSync } from 'node:fs';
import { getPersonas } from '../src/lib/data/personas';
import { affordability, analyse, planForecast, safeDays, whatIf, type Analysis } from '../src/lib/engine/analyse';
import { ESSENTIAL } from '../src/lib/engine/categorise';
import { addDays, TODAY } from '../src/lib/engine/dates';
import { runForecast, type Adjust, type Forecast } from '../src/lib/engine/forecast';
import { combineAdjust } from '../src/lib/engine/plan';
import { merchantKey, nextDates, type Recurring } from '../src/lib/engine/recurring';

const forecastSummary = (f: Forecast) => ({
  pBelow0: f.days.map((d) => d.pBelow0),
  p50: f.days.map((d) => d.p50),
  firstRisk: f.firstRisk ? { date: f.firstRisk.date, p: f.firstRisk.p } : null,
  maxRisk: f.maxRisk,
  lowestP50: f.lowestP50,
});

/** The dates each recurring item falls due. The audit checks their spacing, then simulates from them. */
function schedule(recurring: Recurring[], ctSpread12: boolean) {
  const end = addDays(TODAY, 90);
  return recurring.map((r) => ({ key: r.key, dates: nextDates(r, addDays(TODAY, -1), end, { ctSpread12 }) }));
}

const adjustOf = (a: Adjust) => ({
  dailyDelta: a.dailyDelta ?? 0,
  dropKeys: a.dropKeys ?? [],
  extra: a.extra ?? [],
  dropKnownLabels: a.dropKnownLabels ?? [],
  ctSpread12: !!a.ctSpread12,
  ctMultiplier: a.ctMultiplier ?? 1,
  scale: a.scale ?? {},
});

/** The engine's own code at the audit's run count, so a real bug can be told apart from sampling noise. */
const LARGE_RUNS = 10_000;
const large = (an: Analysis, adjust?: Adjust) => {
  const f = runForecast({ start: an.today, balance: an.balance, recurring: an.inputs.recurring, pool: an.inputs.pool, known: an.inputs.known, adjust, days: 90, runs: LARGE_RUNS });
  return { pBelow0: f.days.map((d) => d.pBelow0), p50: f.days.map((d) => d.p50) };
};

const people = getPersonas().map((p) => {
  const an = analyse(p.answers, p.txns, TODAY);
  const selected = an.actions.slice(0, 6);
  const adjust = combineAdjust(selected);
  const plan = planForecast(an, selected);
  const carRepair = whatIf(an, { extra: [{ date: addDays(TODAY, 7), amount: -400, label: 'Car repair' }] });
  const afford = affordability(an, 60, TODAY);
  return {
    id: p.id,
    name: p.name,
    answers: { balance: p.answers.balance, savings: p.answers.savings, incomeTypes: p.answers.incomeTypes, monthlyIncome: p.answers.monthlyIncome },
    txns: p.txns.map((t) => ({ date: t.date, description: t.description, amount: t.amount, category: t.category, source: t.source, key: `${merchantKey(t.description)}${t.amount > 0 ? '|in' : '|out'}` })),
    recurring: an.recurring.map((r) => ({ key: r.key, label: r.label, category: r.category, direction: r.direction, cadence: r.cadence, everyDays: r.everyDays, dayOfMonth: r.dayOfMonth, lastDate: r.lastDate, last: r.last, variable: r.variable, amounts: r.amounts })),
    schedule: schedule(an.recurring, false),
    known: an.known,
    planAdjust: adjustOf(adjust),
    planSchedule: schedule(an.recurring, !!adjust.ctSpread12),
    engine: {
      monthlyIn: an.summary.monthlyIn,
      monthlyOut: an.summary.monthlyOut,
      essentialsMonthly: an.summary.essentialsMonthly,
      essentialsRatio: an.summary.essentialsRatio,
      byCategory: an.summary.byCategory,
      dailyEssentials: an.dailyEssentials,
      bufferDays: an.bufferDays,
      safeDaysBase: safeDays(an, an.forecast, p.answers.savings),
      safeDaysPlan: safeDays(an, plan, p.answers.savings),
      tax: an.tax,
      premiumAnnual: an.premiumAnnual,
      problems: an.problems.map((x) => ({ id: x.id, annualCost: x.annualCost ?? null, premium: !!x.premium })),
      pool: an.inputs.pool,
      supportMonthly: an.supportMonthly,
      supportOneOff: an.supportOneOff,
      forecast: forecastSummary(an.forecast),
      plan: forecastSummary(plan),
      carRepair: forecastSummary(carRepair),
      afford60: { riskBefore: afford.riskBefore, riskAfter: afford.riskAfter },
      large: {
        runs: LARGE_RUNS,
        forecast: large(an),
        plan: large(an, adjust),
        carRepair: large(an, { extra: [{ date: addDays(TODAY, 7), amount: -400, label: 'Car repair' }] }),
        bought60: large(an, { extra: [{ date: TODAY, amount: -60, label: 'Planned purchase' }] }),
      },
    },
  };
});

mkdirSync('.audit', { recursive: true });
writeFileSync('.audit/engine.json', JSON.stringify({ today: TODAY, essential: ESSENTIAL, people }));
console.log(`Exported ${people.length} people to .audit/engine.json`);
