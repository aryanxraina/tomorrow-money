import type { Answers, Txn } from '../types';
import { addDays, addMonths } from './dates';
import type { Problem, TaxEstimate } from './detect';
import type { Adjust } from './forecast';
import type { Recurring } from './recurring';
import type { SupportItem } from './support';

export interface Action {
  id: string;
  title: string;
  detail: string;
  saveMonthly: number;
  oneOff?: number;
  effort: string;
  effortMins: number;
  kind: 'claim' | 'cut' | 'switch' | 'protect';
  adjust: Adjust;
  link?: string;
}

const perDay = (monthly: number) => monthly / 30.4;

export function buildActions(
  a: Answers,
  today: string,
  problems: Problem[],
  support: SupportItem[],
  recurring: Recurring[],
  txns: Txn[],
  tax: TaxEstimate | null,
): Action[] {
  const acts: Action[] = [];
  const startIn = (days: number) => addDays(today, days);

  for (const s of support) {
    if (s.id === 'ct-student') {
      acts.push({
        id: s.id,
        title: 'Claim your student council tax exemption',
        detail: `Send your council a student certificate for everyone in the house. Future bills stop, and you can ask for £${Math.round(s.oneOff || 0)} back.`,
        saveMonthly: s.estMonthly || 0,
        oneOff: s.oneOff,
        effort: '15 min',
        effortMins: 15,
        kind: 'claim',
        adjust: { ctMultiplier: 0, extra: s.oneOff ? [{ date: startIn(21), amount: s.oneOff, label: 'Council tax refund' }] : [] },
        link: s.link,
      });
    } else if (s.id === 'ctr') {
      acts.push({
        id: s.id,
        title: 'Apply for Council Tax Reduction',
        detail: `Estimated £${s.estMonthly}/month off (it varies by council). Apply on your council’s website.`,
        saveMonthly: s.estMonthly || 0,
        effort: '20 min',
        effortMins: 20,
        kind: 'claim',
        adjust: { ctMultiplier: 0.5 },
        link: s.link,
      });
    } else if (s.estMonthly && ['social-tariff', 'healthy-start', 'spd'].includes(s.id)) {
      acts.push({
        id: s.id,
        title: s.id === 'social-tariff' ? 'Switch to a broadband social tariff' : s.id === 'healthy-start' ? 'Apply for a Healthy Start card' : 'Claim the single person discount',
        detail: s.why,
        saveMonthly: s.estMonthly,
        effort: s.id === 'social-tariff' ? '30 min call' : '15 min',
        effortMins: s.id === 'social-tariff' ? 30 : 15,
        kind: 'claim',
        adjust: { dailyDelta: perDay(s.estMonthly) },
        link: s.link,
      });
    } else if (s.id === 'whd' && s.oneOff) {
      acts.push({
        id: s.id,
        title: 'Check the Warm Home Discount',
        detail: '£150 off winter energy for many people on benefits. Often automatic, but check.',
        saveMonthly: 0,
        oneOff: 150,
        effort: '10 min',
        effortMins: 10,
        kind: 'claim',
        adjust: { extra: [{ date: startIn(35), amount: 150, label: 'Warm Home Discount' }] },
        link: s.link,
      });
    }
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
      detail: 'Instant cash-out costs £1 each time. Your forecast shows when you can safely wait.',
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
      detail: 'Take out cash at free machines: shops and banks nearby usually have one.',
      saveMonthly: atm.annualCost / 12,
      effort: '0 min',
      effortMins: 1,
      kind: 'switch',
      adjust: { dailyDelta: perDay(atm.annualCost / 12) },
    });
  }
  const fx = fee('fee-fx');
  if (fx?.annualCost) {
    const save = fx.annualCost / 12 + 3; // fee plus a typical exchange-rate margin difference (estimate)
    acts.push({
      id: 'fx',
      title: 'Compare money transfer providers',
      detail: 'Compare the total cost (fee plus exchange rate) before your next transfer home. Estimated saving shown.',
      saveMonthly: save,
      effort: '10 min',
      effortMins: 10,
      kind: 'switch',
      adjust: { dailyDelta: perDay(save) },
    });
  }
  const conv = fee('convenience');
  if (conv?.annualCost) {
    acts.push({
      id: 'shop-switch',
      title: 'Do your main shop at the cheaper store nearby',
      detail: 'Keep the express store for top-ups only. The Pay tab tells you at checkout when a trip is worth it.',
      saveMonthly: conv.annualCost / 12,
      effort: 'each shop',
      effortMins: 10,
      kind: 'switch',
      adjust: { dailyDelta: perDay(conv.annualCost / 12) },
    });
  }
  const trend = fee('trend-eating_out');
  if (trend) {
    const m = trend.detail.match(/£(\d+) in the last 30 days vs your usual £(\d+)/);
    const save = m ? Number(m[1]) - Number(m[2]) : 20;
    acts.push({
      id: 'takeaways',
      title: 'Bring takeaways back to your usual level',
      detail: `You've spent more on takeaways this month. Going back to normal saves about £${save} a month.`,
      saveMonthly: save,
      effort: 'ongoing',
      effortMins: 20,
      kind: 'cut',
      adjust: { dailyDelta: perDay(save) },
    });
  }
  if ((a.councilTaxMonthly || 0) > 0 && !a.allStudents) {
    acts.push({
      id: 'ct12',
      title: 'Spread council tax over 12 months',
      detail: 'You can ask your council for 12 smaller payments instead of 10. It costs nothing and eases December and January.',
      saveMonthly: 0,
      effort: '5 min',
      effortMins: 5,
      kind: 'protect',
      adjust: { ctSpread12: true },
      link: 'https://www.gov.uk/council-tax',
    });
  }
  if (tax) {
    const instalment = Math.round(tax.total / 6);
    acts.push({
      id: 'tax-plan',
      title: 'Ask HMRC to spread your tax bill',
      detail: `Instead of £${tax.total.toLocaleString('en-GB')} in one go on 31 Jan, a payment plan could mean about £${instalment}/month for 6 months. Also start a weekly tax pot from your payouts.`,
      saveMonthly: 0,
      effort: '30 min',
      effortMins: 30,
      kind: 'protect',
      adjust: {
        dropKnownLabels: ['Self Assessment tax bill (estimate)'],
        extra: [0, 1, 2, 3, 4, 5].map((i) => ({ date: addMonths('2027-01-31', i, 28), amount: -instalment, label: 'HMRC payment plan (estimate)' })),
      },
      link: 'https://www.gov.uk/difficulties-paying-hmrc',
    });
  }
  // rank: biggest monthly impact per minute of effort; protective steps count as high value
  const score = (x: Action) => (x.saveMonthly + (x.oneOff || 0) / 6 + (x.kind === 'protect' ? 40 : 0)) / Math.max(5, x.effortMins);
  return acts.sort((x, y) => score(y) - score(x));
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
