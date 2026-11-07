import type { Analysis } from './engine/analyse';
import { safeDays } from './engine/analyse';
import { gbp, niceDate } from './engine/dates';
import type { Forecast } from './engine/forecast';
import { CATEGORY_LABEL } from './engine/categorise';
import type { Profile } from './hooks';

export type StepKey = 'understand' | 'detect' | 'predict' | 'support' | 'plan';

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Compact, numbers-only context the AI is allowed to use (and nothing else). */
export function buildFacts(profile: Profile, an: Analysis, plan: Forecast, selectedTitles: string[]) {
  const f = an.forecast;
  return {
    name: profile.name,
    today: an.today,
    groups: an.groups.map((g) => g.label),
    worry: profile.answers.worry || undefined,
    balance: Math.round(an.balance),
    monthlyIn: Math.round(an.summary.monthlyIn),
    monthlyOut: Math.round(an.summary.monthlyOut),
    essentialsPercentOfIncome: Math.round(an.summary.essentialsRatio * 100),
    topSpending: an.summary.byCategory.slice(0, 4).map((c) => ({ category: CATEGORY_LABEL[c.category], perMonth: Math.round(c.monthly) })),
    problems: an.problems.slice(0, 4).map((p) => ({ title: p.title, perYear: p.annualCost ? Math.round(p.annualCost) : undefined })),
    extraCostsPerYear: Math.round(an.premiumAnnual),
    firstRisk: f.firstRisk
      ? { date: niceDate(f.firstRisk.date), chanceBelowZero: pct(f.firstRisk.p), around: f.firstRisk.trigger?.label }
      : null,
    highestRiskNext90Days: pct(f.maxRisk.p),
    upcomingBigBills: an.upcoming
      .filter((u) => u.amount < -50)
      .slice(0, 4)
      .map((u) => ({ date: niceDate(u.date), what: u.label, amount: Math.round(-u.amount) })),
    supportPerMonth: Math.round(an.supportMonthly),
    supportOneOff: Math.round(an.supportOneOff),
    supportTop: an.support.slice(0, 3).map((s) => s.title),
    planSteps: selectedTitles.slice(0, 5),
    highestRiskWithPlan: pct(plan.maxRisk.p),
    riskyDaysNext90: f.days.filter((d) => d.pBelow0 >= 0.25).length,
    riskyDaysWithPlan: plan.days.filter((d) => d.pBelow0 >= 0.25).length,
    safeDaysNow: Math.round(an.bufferDays),
    safeDaysIn90DaysWithoutPlan: Math.round(safeDays(an, f, profile.answers.savings)),
    safeDaysIn90DaysWithPlan: Math.round(safeDays(an, plan, profile.answers.savings)),
  };
}

export type Facts = ReturnType<typeof buildFacts>;

/** Rule-based wording, used when no AI is available. */
export function templates(x: Facts): Record<StepKey, string> {
  return {
    understand: `About ${gbp(x.monthlyIn)} comes in and ${gbp(x.monthlyOut)} goes out each month. Essentials take ${x.essentialsPercentOfIncome}% of your income.`,
    detect: x.problems.length
      ? `We found ${x.problems.length} things to look at, starting with "${x.problems[0].title}".${x.extraCostsPerYear ? ` Extra costs add up to about ${gbp(x.extraCostsPerYear)} a year.` : ''}`
      : 'No big problems found. Nice work.',
    predict: x.firstRisk
      ? `There is a ${x.firstRisk.chanceBelowZero} chance your balance goes below £0 on ${x.firstRisk.date}${x.firstRisk.around ? `, around ${x.firstRisk.around}` : ''}.`
      : `Your money looks steady for the next 90 days. The highest risk of going below £0 is ${x.highestRiskNext90Days}.`,
    support: x.supportTop.length
      ? `You may be missing about ${gbp(x.supportPerMonth)} a month${x.supportOneOff ? ` plus ${gbp(x.supportOneOff)} one-off` : ''}. Start with ${x.supportTop[0]}.`
      : 'We did not find extra support for you right now. We will check again as things change.',
    plan: x.planSteps.length
      ? `With these steps, risky days in the next 3 months drop from ${x.riskyDaysNext90} to ${x.riskyDaysWithPlan}, and your safe days go from ${x.safeDaysIn90DaysWithoutPlan} to ${x.safeDaysIn90DaysWithPlan}.`
      : 'Pick a step below to see how it changes your forecast.',
  };
}
