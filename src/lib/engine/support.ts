import type { Answers, Txn } from '../types';
import type { Problem } from './detect';
import type { Summary } from './understand';

export interface SupportItem {
  id: string;
  title: string;
  why: string;
  estMonthly?: number; // estimate, always "check"
  oneOff?: number;
  kind: 'entitlement' | 'discount' | 'advice' | 'local';
  link?: string;
  linkLabel?: string;
}

// Eligibility is always phrased as "likely worth checking": rules here are a screen, not a decision.
export function findSupport(a: Answers, s: Summary, problems: Problem[], txns: Txn[]): SupportItem[] {
  const out: SupportItem[] = [];
  const ct = a.councilTaxMonthly || 0;
  const lowIncome = s.monthlyIn < 1400 * Math.max(1, a.adults) + 300 * a.children;
  const has = (id: string) => problems.some((p) => p.id === id || p.id.startsWith(id));

  if (a.allStudents && ct > 0) {
    const paid = txns.filter((t) => t.category === 'council_tax').reduce((x, t) => x - t.amount, 0);
    out.push({
      id: 'ct-student',
      title: 'Council tax student exemption',
      why: 'Everyone in your home is a full-time student, so the home is usually exempt.',
      estMonthly: ct,
      oneOff: paid,
      kind: 'discount',
      link: 'https://www.gov.uk/council-tax',
      linkLabel: 'Council tax on GOV.UK',
    });
  }
  if (ct > 0 && !a.allStudents && !a.ctReduction && (a.onBenefits || lowIncome)) {
    out.push({
      id: 'ctr',
      title: 'Council Tax Reduction',
      why: 'You are on a low income or benefits and not getting a reduction yet. Councils can cut bills by up to 100%.',
      estMonthly: Math.round(ct * 0.5),
      kind: 'entitlement',
      link: 'https://www.gov.uk/council-tax',
      linkLabel: 'Apply through your council',
    });
  }
  if (ct > 0 && a.adults === 1 && !a.ctSingleDiscount && !a.allStudents) {
    out.push({
      id: 'spd',
      title: '25% single person discount',
      why: 'You are the only adult at home.',
      estMonthly: Math.round(ct / 3),
      kind: 'discount',
      link: 'https://www.gov.uk/council-tax',
      linkLabel: 'Council tax discounts',
    });
  }
  if (!a.onBenefits && !a.incomeTypes.includes('student_loan') && lowIncome && !a.barriers.includes('new_to_uk')) {
    out.push({
      id: 'uc',
      title: 'Universal Credit check',
      why: 'Your income is low enough that a top-up may be possible. A free benefits calculator takes about 10 minutes.',
      kind: 'entitlement',
      link: 'https://www.gov.uk/benefits-calculators',
      linkLabel: 'Free benefits calculators',
    });
  }
  if (a.barriers.includes('new_to_uk')) {
    out.push({
      id: 'rights',
      title: 'Your rights and support (depends on immigration status)',
      why: 'Some help, like Universal Credit, depends on your status. Free advisers can check in your language.',
      kind: 'advice',
      link: 'https://www.citizensadvice.org.uk',
      linkLabel: 'Citizens Advice',
    });
  }
  const bb = txns.filter((t) => /BROADBAND|FIBRE/i.test(t.description)).slice(-1)[0];
  if (a.onBenefits && bb && -bb.amount > 20) {
    out.push({
      id: 'social-tariff',
      title: 'Broadband social tariff',
      why: `You pay £${(-bb.amount).toFixed(2)} a month. People on Universal Credit can usually get cheaper "social tariff" broadband.`,
      estMonthly: Math.round(-bb.amount - 16),
      kind: 'discount',
      link: 'https://www.ofcom.org.uk',
      linkLabel: 'Social tariffs (Ofcom)',
    });
  }
  if (a.onBenefits && a.childUnder4) {
    out.push({
      id: 'healthy-start',
      title: 'Healthy Start card',
      why: 'For families on benefits with a child under 4: a prepaid card for milk, fruit and veg. Check the current amount.',
      estMonthly: 18,
      kind: 'entitlement',
      link: 'https://www.healthystart.nhs.uk',
      linkLabel: 'Healthy Start (NHS)',
    });
  }
  if (a.onBenefits) {
    out.push({
      id: 'whd',
      title: 'Warm Home Discount',
      why: 'A one-off £150 off winter energy bills for many people on benefits. Prepayment customers usually get a voucher or credit.',
      oneOff: 150,
      kind: 'entitlement',
      link: 'https://www.gov.uk/the-warm-home-discount-scheme',
      linkLabel: 'Warm Home Discount',
    });
  }
  if (a.incomeTypes.includes('student_loan')) {
    out.push({
      id: 'hardship',
      title: 'University hardship fund',
      why: 'Most universities have grants that you don’t pay back, for students who run short before the next loan.',
      kind: 'entitlement',
      linkLabel: 'Ask your student money advice team',
    });
  }
  if (has('hcc') || has('bnpl') || a.debts.includes('arrears') || a.debts.includes('payday')) {
    out.push({
      id: 'debt-advice',
      title: 'Free, regulated debt advice',
      why: 'Free advisers can help you deal with high-cost loans and payment plans. They never charge.',
      kind: 'advice',
      link: 'https://www.stepchange.org',
      linkLabel: 'StepChange',
    });
  }
  if (has('tax')) {
    out.push({
      id: 'hmrc-plan',
      title: 'HMRC payment plan',
      why: 'If you can’t pay your Self Assessment bill in full, you can ask HMRC to spread it. Ask before the deadline.',
      kind: 'advice',
      link: 'https://www.gov.uk/difficulties-paying-hmrc',
      linkLabel: 'Difficulties paying HMRC',
    });
  }
  if (has('fee-atm')) {
    out.push({
      id: 'free-atm',
      title: 'Free cash machines nearby',
      why: 'You pay about £2 every time you take out cash. Free machines are usually close by.',
      estMonthly: Math.round(problems.find((p) => p.id === 'fee-atm')!.annualCost! / 12),
      kind: 'local',
    });
  }
  if (has('convenience')) {
    out.push({
      id: 'cheaper-shop',
      title: 'Cheaper shop nearby',
      why: 'The Pay tab checks where you are at checkout and shows a cheaper shop if the trip is worth it.',
      estMonthly: Math.round((problems.find((p) => p.id === 'convenience')!.annualCost || 0) / 12),
      kind: 'local',
    });
  }
  return out;
}
