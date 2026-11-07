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
    feesPerYear: Math.round(an.premiumAnnual),
    firstRisk: f.firstRisk ? { date: niceDate(f.firstRisk.date), chanceBelowZero: pct(f.firstRisk.p), around: f.firstRisk.trigger?.label } : null,
    highestRiskNext90Days: pct(f.maxRisk.p),
    highestRiskDate: niceDate(f.maxRisk.date),
    upcomingBigBills: an.upcoming
      .filter((u) => u.amount < -50)
      .slice(0, 4)
      .map((u) => ({ date: niceDate(u.date), what: u.label, amount: Math.round(-u.amount) })),
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

function planSentence(x: Facts) {
  const moved = x.riskyDaysWithPlan !== x.riskyDaysNext90 || x.safeDaysIn90DaysWithPlan !== x.safeDaysIn90DaysWithoutPlan;
  const help = x.supportTop.length ? ' The help you may be able to get could change this most, so check that too.' : '';
  if (!x.planSteps.length) return x.supportTop.length ? 'Your biggest opportunity right now is the help you may be able to get.' : 'Pick a step below to see how it changes your forecast.';
  if (!moved) return `These steps don’t change your forecast much on their own.${help}`;
  return `With these steps, risky days in the next 3 months go from ${x.riskyDaysNext90} to ${x.riskyDaysWithPlan}, and your safe days go from ${x.safeDaysIn90DaysWithoutPlan} to ${x.safeDaysIn90DaysWithPlan}.${help}`;
}

/** The app's own wording, used whenever no AI is running. Bill and problem names come from the engine. */
export function templates(x: Facts): Record<StepKey, string> {
  const risk = x.firstRisk;
  const peak = risk && x.highestRiskDate !== risk.date && x.highestRiskNext90Days !== risk.chanceBelowZero ? ` The risk reaches ${x.highestRiskNext90Days} by ${x.highestRiskDate}.` : '';
  return {
    understand: `About ${gbp(x.monthlyIn)} comes in and ${gbp(x.monthlyOut)} goes out each month. Essentials take ${x.essentialsPercentOfIncome}% of your income.`,
    detect: x.problems.length
      ? `We found ${x.problems.length} ${x.problems.length === 1 ? 'thing' : 'things'} to look at, starting with “${x.problems[0].title}”.${x.feesPerYear ? ` Fees and charges come to about ${gbp(x.feesPerYear)} a year.` : ''}`
      : 'No big problems found. Nice work.',
    predict: risk
      ? `There’s a ${risk.chanceBelowZero} chance your balance goes below £0 on ${risk.date}${risk.around ? `, around ${risk.around}` : ''}.${peak}`
      : `Your money looks steady for the next 90 days. The highest risk of going below £0 is ${x.highestRiskNext90Days}.`,
    support: x.supportTop.length ? `There’s help you may be able to get. Start with ${x.supportTop[0]}, and use the official check to find out for sure.` : 'We didn’t find extra support for you right now. We’ll check again as things change.',
    plan: planSentence(x),
  };
}

export interface AffordFacts {
  amount: string;
  riskBefore: string;
  riskAfter: string;
  safe: boolean;
  saferDate?: string;
}

/** The verdict on a purchase. Decided here by code and always shown, whatever an AI then writes. */
export function affordVerdict(a: AffordFacts) {
  const verdict = a.safe
    ? `${a.amount} looks OK. Your chance of going below £0 in the next 30 days goes from ${a.riskBefore} to ${a.riskAfter}.`
    : `Not a safe time for ${a.amount}. Buying it today moves your chance of going below £0 in the next 30 days from ${a.riskBefore} to ${a.riskAfter}.`;
  return `${verdict}${a.saferDate ? ` A safer date: ${a.saferDate}.` : ''}`;
}

export const SET_QUESTIONS = ['Can I afford £60 this week?', 'When could I run out of money?', 'What big bills are coming?', 'What should I do first?', 'What help could I get?', 'What are my subscriptions?'];

/**
 * The coach's answers when no AI is running, which is always the case on a phone. It answers set
 * questions from the person's own numbers, and says so plainly rather than pretending to chat.
 */
export function rulesAnswer(question: string, x: Facts, subscriptions: { label: string; last: number }[]): string {
  const q = question.toLowerCase();
  if (/run out|below|overdrawn|risk|when/.test(q)) {
    return x.firstRisk
      ? `Your first risky day is ${x.firstRisk.date} (${x.firstRisk.chanceBelowZero} chance of going below £0${x.firstRisk.around ? `, around ${x.firstRisk.around}` : ''}). The highest risk is ${x.highestRiskNext90Days} on ${x.highestRiskDate}. With your plan, the highest risk is ${x.highestRiskWithPlan}.`
      : `Your money looks steady for the next 90 days. The highest risk of going below £0 is ${x.highestRiskNext90Days}.`;
  }
  if (/bill|coming|due|pay next/.test(q)) {
    return x.upcomingBigBills.length ? `Coming up: ${x.upcomingBigBills.map((b) => `${b.what}, ${gbp(b.amount)} on ${b.date}`).join('; ')}.` : 'No big bills in the next couple of months, from what we can see.';
  }
  if (/help|support|benefit|claim|entitle/.test(q)) {
    return x.supportTop.length ? `You may be able to get: ${x.supportTop.join(', ')}. The Help tab links to the official check for each one.` : 'We didn’t find extra support for you right now.';
  }
  if (/subscri|netflix|spotify|gym/.test(q)) {
    if (!subscriptions.length) return 'We haven’t spotted any regular subscriptions in your transactions yet.';
    return `We can see ${subscriptions.length}: ${subscriptions.map((r) => `${r.label} (${gbp(r.last, 2)})`).join(', ')}. See them all under More, in Subscriptions.`;
  }
  if (/safe days|how long|last|buffer|sav/.test(q)) {
    return `You have about ${x.safeDaysNow} safe days now: how long your money could cover essentials if income stopped. In 90 days that’s ${x.safeDaysIn90DaysWithoutPlan}, or ${x.safeDaysIn90DaysWithPlan} with your plan.`;
  }
  if (/first|start|do|plan|should/.test(q)) {
    return x.planSteps.length ? `Start with: ${x.planSteps[0]}. The Plan tab shows every step, and how each one changes your forecast.` : 'Your plan is empty right now. Add a statement or answer a few more questions, and we’ll look again.';
  }
  return 'No AI is running, so I can only answer set questions from your numbers. Try one of the suggestions above, or ask whether you can afford something, with an amount, such as “Can I afford £20?”';
}
