// Help the person may be able to get. These rules are a screen, not a decision: they say "likely, check"
// and link to the official source, with no pound estimates. Written for England and Wales. Money only
// reaches the forecast once the person enters what they've actually been awarded.
import type { Answers, Nation, Txn } from '../types';
import type { Problem } from './detect';
import type { Summary } from './understand';

export interface SupportItem {
  id: string;
  title: string;
  why: string;
  kind: 'entitlement' | 'discount' | 'advice';
  link: string;
  linkLabel: string;
  /** Can the person enter a confirmed amount, so that the forecast counts it? */
  confirmable: boolean;
}

export const coversNation = (n: Nation | null) => n === null || n === 'england' || n === 'wales';

export const OTHER_NATION_HELP: Record<'scotland' | 'ni', { label: string; link: string }> = {
  scotland: { label: 'mygov.scot benefits', link: 'https://www.mygov.scot/browse/benefits' },
  ni: { label: 'nidirect money and benefits', link: 'https://www.nidirect.gov.uk/information-and-services/money-tax-and-benefits' },
};

// Holding £16,000 or more in savings rules out Universal Credit. See gov.uk/universal-credit/eligibility.
const UC_SAVINGS_LIMIT = 16000;

// Roughly how much each could change someone's position, so the most useful are seen first.
const RANK = ['debt-advice', 'hmrc-plan', 'ct-student', 'uc', 'pension-credit', 'ctr', 'spd', 'pip', 'hardship', 'healthy-start', 'school-meals', 'ct-disability', 'daf', 'whd', 'water', 'social-tariff', 'rights', 'help-to-save', 'budgeting', 'free-atm'];

/** Income low enough to be worth a look. Deliberately generous: the official check gives the real answer. */
const lowIncome = (a: Answers, s: Summary) => s.monthlyIn < 1400 * Math.max(1, a.adults) + 300 * a.children;

export function findSupport(a: Answers, s: Summary, problems: Problem[], txns: Txn[], known: string[] = []): SupportItem[] {
  const out: SupportItem[] = [];
  const add = (item: SupportItem) => out.push(item);
  const ct = a.councilTaxMonthly > 0 || txns.some((t) => t.category === 'council_tax' && t.amount < 0);
  const low = lowIncome(a, s);
  const has = (id: string) => problems.some((p) => p.id === id || p.id.startsWith(id));
  const isStudent = a.incomeTypes.includes('student_loan') || a.allStudents;
  const pension = a.ageBand === 'pension_age';
  const covered = coversNation(a.nation);

  // Rules specific to England and Wales. Debt, tax and national benefits below apply more widely.
  if (covered) {
    if (a.allStudents && ct) {
      add({
        id: 'ct-student',
        title: 'Council tax student exemption',
        why: 'Homes where everyone is a full-time student usually don’t pay council tax, and you may be able to get back what you’ve paid.',
        kind: 'discount',
        link: 'https://www.gov.uk/council-tax/full-time-students',
        linkLabel: 'Students on GOV.UK',
        confirmable: true,
      });
    }
    if (ct && !a.allStudents && !a.ctReduction && (a.onBenefits || low)) {
      add({
        id: 'ctr',
        title: 'Council Tax Reduction',
        why: 'You’re on benefits or a lower income, and you don’t get a reduction yet. Each council sets its own rules, and some cover the whole bill.',
        kind: 'entitlement',
        link: 'https://www.gov.uk/apply-council-tax-reduction',
        linkLabel: 'Check with your council',
        confirmable: true,
      });
    }
    if (ct && a.adults === 1 && known.includes('adults') && !a.ctSingleDiscount && !a.allStudents) {
      add({
        id: 'spd',
        title: '25% single person discount',
        why: 'You said you’re the only adult at home, which usually takes 25% off your council tax.',
        kind: 'discount',
        link: 'https://www.gov.uk/apply-for-council-tax-discount',
        linkLabel: 'Apply on GOV.UK',
        confirmable: true,
      });
    }
    if (ct && a.barriers.includes('disability')) {
      add({
        id: 'ct-disability',
        title: 'Council tax help for disabled people',
        why: 'Some homes adapted for a disabled person pay less, and some people aren’t counted towards the bill.',
        kind: 'discount',
        link: 'https://www.gov.uk/council-tax/people-with-disabilities',
        linkLabel: 'Disability on GOV.UK',
        confirmable: true,
      });
    }
    if (a.onBenefits) {
      add({
        id: 'whd',
        title: 'Warm Home Discount',
        why: 'A one-off discount on winter energy bills for many people on benefits. It’s often automatic, but worth checking.',
        kind: 'entitlement',
        link: 'https://www.gov.uk/the-warm-home-discount-scheme',
        linkLabel: 'Warm Home Discount',
        confirmable: true,
      });
      add({
        id: 'water',
        title: 'Help with water bills',
        why: 'Water companies in England and Wales have cheaper rates for people on low incomes or benefits.',
        kind: 'discount',
        link: 'https://www.ccw.org.uk/save-money-on-water/',
        linkLabel: 'Consumer Council for Water',
        confirmable: true,
      });
    }
    if (a.onBenefits && a.childUnder4) {
      add({
        id: 'healthy-start',
        title: 'Healthy Start card',
        why: 'For families on some benefits who are pregnant or have a child under 4: a prepaid card for milk, fruit, veg and vitamins.',
        kind: 'entitlement',
        link: 'https://www.healthystart.nhs.uk',
        linkLabel: 'Healthy Start (NHS)',
        confirmable: true,
      });
    }
    if (a.onBenefits && a.children > 0) {
      add({
        id: 'school-meals',
        title: 'Free school meals',
        why: 'Children in families on some benefits can get free school meals, and your council may offer other help too.',
        kind: 'entitlement',
        link: 'https://www.gov.uk/apply-free-school-meals',
        linkLabel: 'Apply through your council',
        confirmable: false,
      });
    }
    if (a.nation === 'wales') {
      add({
        id: 'daf',
        title: 'Discretionary Assistance Fund',
        why: 'Grants in Wales that you don’t pay back, for emergencies and essential costs.',
        kind: 'entitlement',
        link: 'https://www.gov.wales/discretionary-assistance-fund-daf',
        linkLabel: 'GOV.WALES',
        confirmable: true,
      });
    }
    if (isStudent) {
      add({
        id: 'hardship',
        title: 'University hardship fund',
        why: 'Most universities have money that you don’t pay back, for students who run short before their next loan payment.',
        kind: 'entitlement',
        link: 'https://www.gov.uk/extra-money-pay-university',
        linkLabel: 'Extra money for university',
        confirmable: true,
      });
    }
  }

  // Available more widely.
  if (!a.onBenefits && !isStudent && low && s.monthlyIn > 0 && a.savings < UC_SAVINGS_LIMIT && !pension && !a.barriers.includes('new_to_uk')) {
    add({
      id: 'uc',
      title: 'Universal Credit check',
      why: 'Your income may be low enough for a top-up, even if you work. A free calculator takes about 10 minutes and doesn’t need your bank details.',
      kind: 'entitlement',
      link: 'https://www.gov.uk/benefits-calculators',
      linkLabel: 'Free benefits calculators',
      confirmable: true,
    });
  }
  if (pension && low) {
    add({
      id: 'pension-credit',
      title: 'Pension Credit',
      why: 'If you’ve reached State Pension age on a low income, this can top up your income and unlock other help.',
      kind: 'entitlement',
      link: 'https://www.gov.uk/pension-credit',
      linkLabel: 'Pension Credit',
      confirmable: true,
    });
  }
  if (a.barriers.includes('disability') && !pension) {
    add({
      id: 'pip',
      title: 'Personal Independence Payment',
      why: 'For extra costs from a long-term illness or disability. It isn’t based on your income or savings, and you can get it while working.',
      kind: 'entitlement',
      link: 'https://www.gov.uk/pip',
      linkLabel: 'PIP on GOV.UK',
      confirmable: true,
    });
  }
  if (a.barriers.includes('new_to_uk')) {
    add({
      id: 'rights',
      title: 'Your rights and support',
      why: 'Some help, like Universal Credit, depends on your immigration status. Free advisers can check what applies to you.',
      kind: 'advice',
      link: 'https://www.citizensadvice.org.uk/immigration/',
      linkLabel: 'Citizens Advice',
      confirmable: false,
    });
  }
  if (a.onBenefits) {
    add({
      id: 'social-tariff',
      title: 'Broadband and phone social tariffs',
      why: 'People on Universal Credit and some other benefits can usually get cheaper deals, often from their current provider.',
      kind: 'discount',
      link: 'https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs',
      linkLabel: 'Social tariffs (Ofcom)',
      confirmable: true,
    });
    add({
      id: 'help-to-save',
      title: 'Help to Save',
      why: 'If you get Universal Credit or Working Tax Credit, the government adds a bonus to what you save.',
      kind: 'entitlement',
      link: 'https://www.gov.uk/get-help-savings-low-income',
      linkLabel: 'Help to Save',
      confirmable: false,
    });
    add({
      id: 'budgeting',
      title: 'Budgeting Advance or Budgeting Loan',
      why: 'An interest-free advance on benefits for essential costs. You pay it back from your benefits, so check it’s affordable first.',
      kind: 'entitlement',
      link: 'https://www.gov.uk/budgeting-help-benefits',
      linkLabel: 'Budgeting help',
      confirmable: false,
    });
  }
  if (has('hcc') || has('bnpl') || a.debts.includes('arrears') || a.debts.includes('payday') || a.debts.includes('credit_card')) {
    add({
      id: 'debt-advice',
      title: 'Free, regulated debt advice',
      why: 'Free advisers can talk through your options and payment plans, and they never charge. In England and Wales they can also help you apply for Breathing Space, which pauses most interest and collection action.',
      kind: 'advice',
      link: 'https://www.stepchange.org',
      linkLabel: 'StepChange',
      confirmable: false,
    });
  }
  if (has('tax')) {
    add({
      id: 'hmrc-plan',
      title: 'HMRC payment plan',
      why: 'If you can’t pay your Self Assessment bill in full, you can ask HMRC to spread it. Ask before the deadline.',
      kind: 'advice',
      link: 'https://www.gov.uk/difficulties-paying-hmrc',
      linkLabel: 'Difficulties paying HMRC',
      confirmable: false,
    });
  }
  if (has('fee-atm')) {
    add({
      id: 'free-atm',
      title: 'Free cash machines',
      why: 'Your statements show you pay to take out cash. Free machines are usually close by.',
      kind: 'advice',
      link: 'https://www.link.co.uk/consumers/locator/',
      linkLabel: 'LINK cash machine finder',
      confirmable: false,
    });
  }
  const position = (id: string) => {
    const i = RANK.indexOf(id);
    return i < 0 ? RANK.length : i;
  };
  return out.sort((x, z) => position(x.id) - position(z.id));
}
