import type { Answers, ConfirmedSupport } from '../types';
import { addMonths, shortDate } from './dates';
import type { Problem, TaxEstimate } from './detect';
import type { Adjust } from './forecast';
import type { Recurring } from './recurring';
import type { SupportItem } from './support';

export interface Action {
  id: string;
  title: string;
  detail: string;
  saveMonthly: number;
  effort: string;
  effortMins: number;
  kind: 'claim' | 'cut' | 'switch' | 'protect';
  /** Empty for claims: help isn't counted until the person has been awarded it and enters the amount. */
  adjust: Adjust;
  link?: string;
  supportId?: string;
}

const perDay = (monthly: number) => monthly / 30.4;

const CLAIM_EFFORT: Record<string, { title: string; mins: number; effort: string }> = {
  'ct-student': { title: 'Claim your student council tax exemption', mins: 15, effort: '15 min' },
  ctr: { title: 'Apply for Council Tax Reduction', mins: 20, effort: '20 min' },
  spd: { title: 'Claim the single person discount', mins: 10, effort: '10 min' },
  'ct-disability': { title: 'Check council tax help for disabled people', mins: 15, effort: '15 min' },
  uc: { title: 'Do a free benefits check', mins: 10, effort: '10 min' },
  'social-tariff': { title: 'Ask about a broadband social tariff', mins: 30, effort: '30 min call' },
  'healthy-start': { title: 'Apply for a Healthy Start card', mins: 15, effort: '15 min' },
  whd: { title: 'Check the Warm Home Discount', mins: 10, effort: '10 min' },
  water: { title: 'Ask about a cheaper water tariff', mins: 15, effort: '15 min' },
  hardship: { title: 'Ask your university about its hardship fund', mins: 15, effort: '15 min' },
  'pension-credit': { title: 'Check Pension Credit', mins: 15, effort: '15 min' },
  pip: { title: 'Check Personal Independence Payment', mins: 30, effort: '30 min' },
  daf: { title: 'Check the Discretionary Assistance Fund', mins: 15, effort: '15 min' },
};

export function buildActions(
  a: Answers,
  problems: Problem[],
  support: SupportItem[],
  recurring: Recurring[],
  tax: TaxEstimate | null,
  confirmed: ConfirmedSupport[] = [],
  ctAlready12 = false,
): Action[] {
  const acts: Action[] = [];
  const done = new Set(confirmed.map((c) => c.id));

  for (const s of support) {
    const claim = CLAIM_EFFORT[s.id];
    if (!claim || done.has(s.id)) continue;
    acts.push({
      id: s.id,
      supportId: s.id,
      title: claim.title,
      detail: s.why,
      saveMonthly: 0,
      effort: claim.effort,
      effortMins: claim.mins,
      kind: 'claim',
      adjust: {},
      link: s.link,
    });
  }

  const subs = recurring.filter((r) => r.category === 'subscriptions' && r.direction === 'out').sort((x, y) => y.last - x.last);
  if (subs.length >= 3) {
    const pause = subs.slice(0, 2);
    const save = pause.reduce((x, r) => x + r.last, 0);
    acts.push({
      id: 'pause-subs',
      title: `Pause ${pause.map((r) => r.label).join(' and ')}`,
      detail: `Keep the subscription you use most. Pausing these two saves £${save.toFixed(2)} a month, and you can restart any time.`,
      saveMonthly: save,
      effort: '5 min',
      effortMins: 5,
      kind: 'cut',
      adjust: { dropKeys: pause.map((r) => r.key) },
    });
  }

  const fee = (id: string) => problems.find((p) => p.id === id);
  const cashout = fee('fee-cashout');
  if (cashout?.annualCost) {
    acts.push({
      id: 'cashout',
      title: 'Wait for the free weekly payout',
      detail: 'Instant cash-out charges a fee each time. Your forecast shows when you can safely wait.',
      saveMonthly: cashout.annualCost / 12,
      effort: '0 min',
      effortMins: 1,
      kind: 'cut',
      adjust: { dailyDelta: perDay(cashout.annualCost / 12) },
    });
  }
  const atm = fee('fee-atm');
  if (atm?.annualCost) {
    acts.push({
      id: 'atm',
      title: 'Use free cash machines',
      detail: 'Free machines are usually close by, and the Nearby tab links to a finder.',
      saveMonthly: atm.annualCost / 12,
      effort: '0 min',
      effortMins: 1,
      kind: 'switch',
      adjust: { dailyDelta: perDay(atm.annualCost / 12) },
    });
  }
  const fx = fee('fee-fx');
  if (fx?.annualCost) {
    const save = fx.annualCost / 12;
    acts.push({
      id: 'fx',
      title: 'Compare money transfer providers',
      detail: 'Compare the total cost (the fee plus the exchange rate) before your next transfer. The saving shown is only the fees you’ve been paying.',
      saveMonthly: save,
      effort: '10 min',
      effortMins: 10,
      kind: 'switch',
      adjust: { dailyDelta: perDay(save) },
    });
  }
  const trend = fee('trend-eating_out');
  if (trend) {
    const m = trend.detail.match(/£(\d+) in the last 30 days vs your usual £(\d+)/);
    const save = m ? Number(m[1]) - Number(m[2]) : 0;
    if (save > 0) {
      acts.push({
        id: 'takeaways',
        title: 'Bring takeaways back to your usual level',
        detail: `You’ve spent more on takeaways this month. Going back to normal saves about £${save} a month.`,
        saveMonthly: save,
        effort: 'ongoing',
        effortMins: 20,
        kind: 'cut',
        adjust: { dailyDelta: perDay(save) },
      });
    }
  }
  const paysCouncilTax = (a.councilTaxMonthly || 0) > 0 || recurring.some((r) => r.category === 'council_tax');
  if (paysCouncilTax && !a.allStudents && !ctAlready12) {
    acts.push({
      id: 'ct12',
      title: 'Spread council tax over 12 months',
      detail: 'You can ask your council for 12 smaller payments instead of 10. It costs nothing, and each payment gets smaller.',
      saveMonthly: 0,
      effort: '5 min',
      effortMins: 5,
      kind: 'protect',
      adjust: { ctSpread12: true },
      link: 'https://www.gov.uk/council-tax',
    });
  }
  if (tax && tax.total > 0) {
    const instalment = Math.round(tax.total / 6);
    acts.push({
      id: 'tax-plan',
      title: 'Ask HMRC to spread your tax bill',
      detail: `Instead of about £${tax.total.toLocaleString('en-GB')} in one go on ${shortDate(tax.due)}, a payment plan could mean about £${instalment} a month for 6 months, if HMRC agrees. Start a weekly tax pot from your payouts too.`,
      saveMonthly: 0,
      effort: '30 min',
      effortMins: 30,
      kind: 'protect',
      adjust: {
        dropKnownLabels: ['Self Assessment tax bill (estimate)'],
        extra: [0, 1, 2, 3, 4, 5].map((i) => ({ date: addMonths(tax.due, i, 28), amount: -instalment, label: 'HMRC payment plan (estimate)' })),
      },
      link: 'https://www.gov.uk/difficulties-paying-hmrc',
    });
  }
  // Claims stay in the order Help ranks them. Other steps go by monthly impact per minute of effort.
  const score = (x: Action) => (x.saveMonthly + (x.kind === 'protect' ? 40 : 0)) / Math.max(5, x.effortMins);
  return [...acts.filter((x) => x.kind === 'claim'), ...acts.filter((x) => x.kind !== 'claim').sort((x, y) => score(y) - score(x))];
}

export function combineAdjust(actions: Action[]): Adjust {
  const out: Adjust = { dailyDelta: 0, dropKeys: [], extra: [], dropKnownLabels: [] };
  for (const a of actions) {
    const j = a.adjust;
    out.dailyDelta! += j.dailyDelta || 0;
    out.dropKeys!.push(...(j.dropKeys || []));
    out.extra!.push(...(j.extra || []));
    out.dropKnownLabels!.push(...(j.dropKnownLabels || []));
    if (j.ctSpread12) out.ctSpread12 = true;
    if (j.ctMultiplier !== undefined) out.ctMultiplier = Math.min(out.ctMultiplier ?? 1, j.ctMultiplier);
  }
  return out;
}
