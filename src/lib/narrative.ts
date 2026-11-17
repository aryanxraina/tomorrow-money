import type { Analysis } from './engine/analyse';
import { safeDays } from './engine/analyse';
import { gbp, niceDate } from './engine/dates';
import type { Forecast } from './engine/forecast';
import { CATEGORY_LABEL } from './engine/categorise';
import type { Profile } from './hooks';

export type StepKey = 'understand' | 'detect' | 'predict' | 'support' | 'plan';

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** "energy, food or travel". */
export const listOf = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`);

/** Compact, numbers-only context the AI is allowed to use (and nothing else). Anything we don't know is null. */
export function buildFacts(profile: Profile, an: Analysis, plan: Forecast, selectedTitles: string[]) {
  const f = an.forecast;
  const { gaps } = an;
  const judged = gaps.canJudge;
  const safe = (x: Forecast) => {
    const days = safeDays(an, x, profile.answers.savings);
    return days === null ? null : Math.round(days);
  };
  return {
    name: profile.name,
    today: an.today,
    estimated: profile.estimated,
    notKnownYet: { balance: gaps.balance, income: gaps.income, costs: gaps.costs },
    groups: an.groups.map((g) => g.label),
    worry: profile.answers.worry || undefined,
    balance: gaps.balance ? null : Math.round(an.balance),
    monthlyIn: gaps.income ? null : Math.round(an.summary.monthlyIn),
    monthlyOut: Math.round(an.summary.monthlyOut),
    essentialsPercentOfIncome: an.summary.monthlyIn > 0 ? Math.round(an.summary.essentialsRatio * 100) : null,
    topSpending: an.summary.byCategory.slice(0, 4).map((c) => ({ category: CATEGORY_LABEL[c.category], perMonth: Math.round(c.monthly) })),
    problems: an.problems.slice(0, 4).map((p) => ({ title: p.title, perYear: p.annualCost ? Math.round(p.annualCost) : undefined })),
    feesPerYear: Math.round(an.premiumAnnual),
    firstRisk: judged && f.firstRisk ? { date: niceDate(f.firstRisk.date), chanceBelowZero: pct(f.firstRisk.p), around: f.firstRisk.trigger?.label } : null,
    highestRiskNext90Days: judged ? pct(f.maxRisk.p) : null,
    highestRiskDate: judged ? niceDate(f.maxRisk.date) : null,
    upcomingBigBills: an.upcoming
      .filter((u) => u.amount < -50)
      .slice(0, 4)
      .map((u) => ({ date: niceDate(u.date), what: u.label, amount: Math.round(-u.amount) })),
    supportTop: an.support.slice(0, 3).map((s) => s.title),
    planSteps: selectedTitles.slice(0, 5),
    planStepsAvailable: an.actions.filter((a) => a.kind !== 'claim').length,
    highestRiskWithPlan: judged ? pct(plan.maxRisk.p) : null,
    riskyDaysNext90: judged ? f.days.filter((d) => d.pBelow0 >= 0.25).length : null,
    riskyDaysWithPlan: judged ? plan.days.filter((d) => d.pBelow0 >= 0.25).length : null,
    safeDaysNow: an.bufferDays === null ? null : Math.round(an.bufferDays),
    safeDaysIn90DaysWithoutPlan: safe(f),
    safeDaysIn90DaysWithPlan: safe(plan),
  };
}

export type Facts = ReturnType<typeof buildFacts>;

/** What's stopping us judging the risk of going below £0, in words. Empty when nothing is. */
export function missingBasics(x: Pick<Facts, 'notKnownYet'>) {
  return [x.notKnownYet.balance && 'your balance', x.notKnownYet.income && 'your income'].filter(Boolean).join(' and ');
}

const costsNote = (x: Facts) => (x.notKnownYet.costs.length ? `We don’t know your ${listOf(x.notKnownYet.costs)} yet, so this may look better than it really is.` : '');

function planSentence(x: Facts) {
  const help = x.supportTop.length ? ' The help you may be able to get could change this most, so check that too.' : '';
  const basics = missingBasics(x);
  if (!x.planSteps.length) {
    if (x.supportTop.length) return 'Your biggest opportunity right now is the help you may be able to get.';
    if (x.planStepsAvailable) return 'Pick a step below to see how it changes your forecast.';
    return basics ? `Once we know ${basics}, we can suggest what to do next.` : 'We don’t have anything to suggest right now. We’ll look again as things change.';
  }
  if (basics) return `Once we know ${basics}, we can show how these steps change your forecast.${help}`;
  const safeMoved = x.safeDaysIn90DaysWithPlan !== x.safeDaysIn90DaysWithoutPlan;
  if (x.riskyDaysWithPlan === x.riskyDaysNext90 && !safeMoved) return `These steps don’t change your forecast much on their own.${help}`;
  const safeWords = x.safeDaysIn90DaysWithoutPlan !== null ? `, and how long your money could last goes from ${x.safeDaysIn90DaysWithoutPlan} to ${x.safeDaysIn90DaysWithPlan} days` : '';
  return `With these steps, risky days in the next 3 months go from ${x.riskyDaysNext90} to ${x.riskyDaysWithPlan}${safeWords}.${help}`;
}

function predictSentence(x: Facts) {
  const basics = missingBasics(x);
  if (basics) return `We can’t work out your chance of going below £0 until we know ${basics}.`;
  const risk = x.firstRisk;
  const costs = costsNote(x);
  if (risk) {
    const peak = x.highestRiskDate !== risk.date && x.highestRiskNext90Days !== risk.chanceBelowZero ? ` The risk reaches ${x.highestRiskNext90Days} by ${x.highestRiskDate}.` : '';
    return `There’s a ${risk.chanceBelowZero} chance your balance goes below £0 on ${risk.date}${risk.around ? `, around ${risk.around}` : ''}.${peak}${costs ? ` ${costs}` : ''}`;
  }
  if (costs) return `Nothing looks risky so far. ${costs}`;
  return `Your money looks steady for the next 90 days. The highest risk of going below £0 is ${x.highestRiskNext90Days}.`;
}

function understandSentence(x: Facts) {
  if (x.monthlyIn) return `About ${gbp(x.monthlyIn)} comes in and ${gbp(x.monthlyOut)} goes out each month. Essentials take ${x.essentialsPercentOfIncome}% of your income.`;
  if (x.monthlyOut) return `About ${gbp(x.monthlyOut)} goes out each month. We can’t see what comes in yet.`;
  return 'Add a statement or answer a few more questions, and we’ll show where your money goes.';
}

/** The app's own wording, used whenever no AI is running. Bill and problem names come from the engine. */
export function templates(x: Facts): Record<StepKey, string> {
  return {
    understand: understandSentence(x),
    detect: x.problems.length
      ? `We found ${x.problems.length} ${x.problems.length === 1 ? 'thing' : 'things'} to look at, starting with “${x.problems[0].title}”.${x.feesPerYear ? ` Fees and charges come to about ${gbp(x.feesPerYear)} a year.` : ''}`
      : x.estimated
        ? 'Nothing stands out so far. A bank statement would let us look properly.'
        : 'No big problems found. Nice work.',
    predict: predictSentence(x),
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
  /** Costs missing from an estimate, which would make "looks OK" too confident on its own. */
  unknownCosts?: string[];
}

/** The verdict on a purchase. Decided here by code and always shown, whatever an AI then writes. */
export function affordVerdict(a: AffordFacts) {
  const costs = a.unknownCosts?.length ? ` We don’t know your ${listOf(a.unknownCosts)} yet, so this may be too hopeful.` : '';
  const verdict = a.safe
    ? `${a.amount} looks OK so far. Your chance of going below £0 in the next 30 days goes from ${a.riskBefore} to ${a.riskAfter}.`
    : `Not a safe time for ${a.amount}. Buying it today moves your chance of going below £0 in the next 30 days from ${a.riskBefore} to ${a.riskAfter}.`;
  return `${verdict}${a.saferDate ? ` A safer date: ${a.saferDate}.` : ''}${costs}`;
}

/** When there's no balance or income to go on, the honest answer to "can I afford it?" is that we can't say. */
export const cantJudgeYet = (basics: string) => `We can’t say yet, because we don’t know ${basics}. Add ${basics.includes(' and ') ? 'them' : 'it'} on the Home tab, then ask again.`;

export const SET_QUESTIONS = ['Can I afford £60 this week?', 'When could I run out of money?', 'What big bills are coming?', 'What should I do first?', 'What help could I get?', 'What are my subscriptions?'];

/**
 * The coach's answers when no AI is running, which is always the case on a phone. It answers set
 * questions from the person's own numbers, and says so plainly rather than pretending to chat.
 */
export function rulesAnswer(question: string, x: Facts, subscriptions: { label: string; last: number }[]): string {
  const q = question.toLowerCase();
  if (/run out|below|overdrawn|risk|when/.test(q)) {
    if (!x.firstRisk) return predictSentence(x);
    return `Your first risky day is ${x.firstRisk.date} (${x.firstRisk.chanceBelowZero} chance of going below £0${x.firstRisk.around ? `, around ${x.firstRisk.around}` : ''}). The highest risk is ${x.highestRiskNext90Days} on ${x.highestRiskDate}. With your plan, the highest risk is ${x.highestRiskWithPlan}.`;
  }
  if (/bill|coming|due|pay next/.test(q)) {
    return x.upcomingBigBills.length ? `Coming up: ${x.upcomingBigBills.map((b) => `${b.what}, ${gbp(b.amount)} on ${b.date}`).join('; ')}.` : 'No big bills in the next couple of months, from what we can see.';
  }
  if (/help|support|benefit|claim|entitle/.test(q)) {
    return x.supportTop.length ? `You may be able to get: ${x.supportTop.join(', ')}. The Support tab links to the official check for each one.` : 'We didn’t find extra support for you right now.';
  }
  if (/subscri|netflix|spotify|gym/.test(q)) {
    if (!subscriptions.length) return 'We haven’t spotted any regular subscriptions in your transactions yet.';
    return `We can see ${subscriptions.length}: ${subscriptions.map((r) => `${r.label} (${gbp(r.last, 2)})`).join(', ')}. See them all under More tools, in Regular payments.`;
  }
  if (/safe days|how long|last|buffer|sav/.test(q)) {
    if (x.safeDaysNow === null) return 'We can’t work out how long your money could last until we know your balance and what your essentials cost.';
    return `Your money could last about ${x.safeDaysNow} days: that’s how long it could cover essentials if income stopped. In 90 days that’s ${x.safeDaysIn90DaysWithoutPlan}, or ${x.safeDaysIn90DaysWithPlan} with your plan.`;
  }
  if (/first|start|do|plan|should/.test(q)) {
    return x.planSteps.length ? `Start with: ${x.planSteps[0]}. The Actions tab shows every step, and how each one changes your forecast.` : 'Your plan is empty right now. Add a statement or answer a few more questions, and we’ll look again.';
  }
  const basics = missingBasics(x);
  if (basics) return `I can answer that once we know ${basics}. You can add ${basics.includes(' and ') ? 'them' : 'it'} on the Home tab.`;
  return 'No AI is running, so I can only answer set questions from your numbers. Try one of the suggestions above, or ask whether you can afford something, with an amount, such as “Can I afford £20?”';
}
