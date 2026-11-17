// The follow-up questions, asked one at a time after the short check-in. Each is only asked when its
// answer would change a result, and says what it improves. Ordered by how much the answer matters.
import type { Answers, Barrier, DatedAmount, DebtType, IncomeType } from '../types';
import type { Analysis } from './analyse';

export interface QuestionContext {
  a: Answers;
  an: Analysis;
  known: string[];
  skipped: string[];
  estimated: boolean;
}

export type QuestionValue = number | boolean | string | string[] | { date: string; amount: number; label: string } | null;

export interface Question {
  id: string;
  title: string;
  /** What answering improves, in the person's terms. */
  why: string;
  kind: 'money' | 'signed-money' | 'count' | 'day' | 'yesno' | 'one' | 'many' | 'dated';
  options?: { id: string; label: string }[];
  /** Placeholder for the description of a dated item. Left out when the question already says what it is. */
  namePlaceholder?: string;
  /** For a dated question: the way to answer "there aren't any", which counts as an answer. */
  noneLabel?: string;
  /** For a dated question: what's been added so far, and how to take one back out. */
  items?: (a: Answers) => DatedAmount[];
  removeItem?: (item: DatedAmount, a: Answers) => Partial<Answers>;
  applies: (c: QuestionContext) => boolean;
  read: (a: Answers) => QuestionValue;
  write: (value: QuestionValue, a: Answers) => Partial<Answers>;
}

const paysCouncilTax = (c: QuestionContext) => c.a.councilTaxMonthly > 0 || c.an.txns.some((t) => t.category === 'council_tax' && t.amount < 0);
const num = (v: QuestionValue) => (typeof v === 'number' ? v : Number(v) || 0);
const always = () => true;

function money(id: keyof Answers & string, title: string, why: string, applies: Question['applies']): Question {
  return { id, title, why, kind: 'money', applies, read: (a) => a[id] as number, write: (v) => ({ [id]: num(v) }) };
}

function yesNo(id: 'onBenefits' | 'ctSingleDiscount' | 'ctReduction' | 'allStudents' | 'childUnder4', title: string, why: string, applies: Question['applies'], extra?: (yes: boolean) => Partial<Answers>): Question {
  return { id, title, why, kind: 'yesno', applies, read: (a) => a[id], write: (v) => ({ [id]: v === true, ...extra?.(v === true) }) };
}

export const INCOME_OPTIONS: { id: IncomeType; label: string }[] = [
  { id: 'salary', label: 'Monthly salary' },
  { id: 'four_weekly', label: 'Paid every 4 weeks' },
  { id: 'zero_hours', label: 'Zero-hours or agency' },
  { id: 'gig', label: 'Self-employed or gig work' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'student_loan', label: 'Student loan' },
  { id: 'pension', label: 'Pension' },
];

const DEBT_OPTIONS: { id: DebtType; label: string }[] = [
  { id: 'overdraft', label: 'Overdraft' },
  { id: 'credit_card', label: 'Credit card' },
  { id: 'bnpl', label: 'Buy now, pay later' },
  { id: 'payday', label: 'Payday or short-term loan' },
  { id: 'arrears', label: 'Behind on bills' },
];

const BARRIER_OPTIONS: { id: Barrier; label: string }[] = [
  { id: 'disability', label: 'Disability or long-term illness' },
  { id: 'new_to_uk', label: 'New to the UK' },
  { id: 'no_bank_history', label: 'Little or no credit history' },
  { id: 'low_digital', label: 'Not confident online' },
];

const removeFrom = (list: DatedAmount[], item: DatedAmount) => list.filter((x) => !(x.date === item.date && x.amount === item.amount && x.label === item.label));

export const QUESTIONS: Question[] = [
  {
    id: 'balance',
    title: 'What’s in your main account today?',
    why: 'Your forecast starts from this number.',
    kind: 'signed-money',
    applies: always,
    read: (a) => a.balance,
    write: (v) => ({ balance: num(v) }),
  },
  {
    id: 'incomeTypes',
    title: 'How are you paid?',
    why: 'Self-employed work can mean a tax bill, and student loans arrive in lumps, so this changes your forecast.',
    kind: 'many',
    options: INCOME_OPTIONS,
    applies: always,
    read: (a) => a.incomeTypes,
    write: (v, a) => {
      const types = v as IncomeType[];
      return { incomeTypes: types, onBenefits: a.onBenefits || types.includes('benefits') };
    },
  },
  money('monthlyIncome', 'Roughly how much comes in each month?', 'After tax. This is the biggest part of an estimated forecast.', (c) => c.estimated),
  money('housingCost', 'How much is your rent or mortgage a month?', 'Usually your biggest bill, so it matters most for your tight days.', (c) => c.estimated),
  money('councilTaxMonthly', 'How much is your council tax a month?', 'Put 0 if it’s included in your rent. It also tells us which discounts to check.', (c) => c.estimated),
  money('foodWeekly', 'Roughly how much do you spend on food a week?', 'Without this, your forecast may look better than it really is.', (c) => c.estimated),
  {
    id: 'energyPayment',
    title: 'How do you pay for energy?',
    why: 'Prepayment meters can’t spread the cost over the year, so winter hits harder.',
    kind: 'one',
    options: [
      { id: 'direct_debit', label: 'Direct Debit' },
      { id: 'prepayment', label: 'Prepayment meter or top-ups' },
      { id: 'included', label: 'Included in my rent' },
    ],
    applies: always,
    read: (a) => a.energyPayment,
    write: (v) => ({ energyPayment: v as Answers['energyPayment'] }),
  },
  money('energyMonthly', 'Roughly how much do gas and electricity cost a month?', 'Without this, your forecast may look better than it really is. We allow for higher bills in winter.', (c) => c.estimated && c.a.energyPayment !== 'included'),
  money('billsMonthly', 'Phone, broadband, insurance and subscriptions: roughly how much a month?', 'Without this, your forecast may look better than it really is.', (c) => c.estimated),
  money('otherWeekly', 'Travel, shopping and everything else: roughly how much a week?', 'Without this, your forecast may look better than it really is.', (c) => c.estimated),
  {
    id: 'payDay',
    title: 'What day of the month are you usually paid?',
    why: 'Knowing when money arrives shows which days will be tight.',
    kind: 'day',
    applies: (c) => c.estimated && c.a.incomeTypes.some((t) => t === 'salary' || t === 'benefits' || t === 'pension'),
    read: (a) => a.payDay,
    write: (v) => ({ payDay: num(v) || null }),
  },
  {
    id: 'rentDay',
    title: 'What day of the month does your rent or mortgage go out?',
    why: 'Bills just before payday are what cause most tight days.',
    kind: 'day',
    applies: (c) => c.estimated && c.a.housingCost > 0,
    read: (a) => a.rentDay,
    write: (v) => ({ rentDay: num(v) || null }),
  },
  {
    id: 'adults',
    title: 'How many adults live in your home, including you?',
    why: 'If you’re the only adult, you can usually get 25% off council tax.',
    kind: 'count',
    applies: always,
    read: (a) => a.adults,
    write: (v) => ({ adults: Math.max(1, num(v)) }),
  },
  yesNo('onBenefits', 'Do you get any benefits, such as Universal Credit?', 'It opens up checks for cheaper bills and other help.', (c) => !c.a.incomeTypes.includes('benefits')),
  yesNo('ctSingleDiscount', 'Do you already get the 25% single person discount on your council tax?', 'So we only suggest what you don’t already have.', (c) => c.a.adults === 1 && c.known.includes('adults') && paysCouncilTax(c)),
  yesNo('ctReduction', 'Do you already get Council Tax Reduction?', 'So we only suggest what you don’t already have.', (c) => paysCouncilTax(c) && c.a.onBenefits),
  yesNo('allStudents', 'Is everyone in your home a full-time student?', 'Homes where everyone is a full-time student usually don’t pay council tax.', (c) => paysCouncilTax(c) && (c.a.incomeTypes.includes('student_loan') || c.a.ageBand === 'under_25')),
  {
    id: 'ctInstalments',
    title: 'How many payments do you make for council tax each year?',
    why: 'Many people pay nothing in February and March, and your forecast needs to know.',
    kind: 'one',
    options: [
      { id: '10', label: '10 payments' },
      { id: '12', label: '12 payments' },
    ],
    applies: (c) => paysCouncilTax(c) && !c.an.ctAlready12,
    read: (a) => (a.ctInstalments ? String(a.ctInstalments) : null),
    write: (v) => ({ ctInstalments: v === '12' ? 12 : 10 }),
  },
  {
    id: 'children',
    title: 'How many children live with you?',
    why: 'It changes which help you may be able to get.',
    kind: 'count',
    applies: always,
    read: (a) => a.children,
    write: (v) => ({ children: Math.max(0, num(v)) }),
  },
  yesNo('childUnder4', 'Is anyone at home pregnant, or is there a child under 4?', 'It may mean help with the cost of healthy food.', (c) => c.a.children > 0 || c.a.onBenefits),
  {
    id: 'debts',
    title: 'Do you have any of these?',
    why: 'We put the cheapest way out first and point you to free advice. Choose none if none apply.',
    kind: 'many',
    options: DEBT_OPTIONS,
    applies: always,
    read: (a) => a.debts,
    write: (v) => ({ debts: v as DebtType[] }),
  },
  money('debtRepayMonthly', 'How much do you repay on debts a month?', 'Without this, your forecast may look better than it really is.', (c) => c.estimated && c.a.debts.length > 0),
  money('savings', 'How much do you have in savings you could use in an emergency?', 'Savings count towards how long your money could last.', always),
  {
    id: 'barriers',
    title: 'Do any of these apply to you?',
    why: 'They can open up other help, and change how we explain things. Choose none if none apply.',
    kind: 'many',
    options: BARRIER_OPTIONS,
    applies: always,
    read: (a) => a.barriers,
    write: (v) => ({ barriers: v as Barrier[] }),
  },
  {
    id: 'ageBand',
    title: 'Which of these is you?',
    why: 'Some help depends on your age, such as Pension Credit.',
    kind: 'one',
    options: [
      { id: 'under_25', label: 'Under 25' },
      { id: '25_to_pension', label: '25 to State Pension age' },
      { id: 'pension_age', label: 'State Pension age or over' },
    ],
    applies: always,
    read: (a) => a.ageBand,
    write: (v) => ({ ageBand: v as Answers['ageBand'] }),
  },
  {
    id: 'studentLoan',
    title: 'When’s your next student loan payment?',
    why: 'Loans arrive in lumps, so this decides how long your money has to last.',
    kind: 'dated',
    applies: (c) => c.a.incomeTypes.includes('student_loan'),
    read: () => null,
    items: (a) => a.futureIncome,
    removeItem: (item, a) => ({ futureIncome: removeFrom(a.futureIncome, item) }),
    write: (v, a) => {
      const item = v as DatedAmount;
      return { futureIncome: [...a.futureIncome, { label: 'Student loan', date: item.date, amount: item.amount }] };
    },
  },
  {
    id: 'bigBill',
    title: 'Any big bill coming in the next 3 months?',
    why: 'One-off costs like an MOT, an insurance renewal or Christmas are what catch people out.',
    kind: 'dated',
    namePlaceholder: 'What’s it for?',
    noneLabel: 'Nothing coming up',
    applies: always,
    read: () => null,
    items: (a) => a.yearlyBills,
    removeItem: (item, a) => ({ yearlyBills: removeFrom(a.yearlyBills, item) }),
    write: (v, a) => {
      const item = v as DatedAmount;
      return { yearlyBills: [...a.yearlyBills, { label: item.label || 'Big bill', date: item.date, amount: item.amount }] };
    },
  },
];

const isOpen = (q: Question, c: QuestionContext) => q.applies(c) && !c.known.includes(q.id) && !c.skipped.includes(q.id);

/** The most useful question still worth asking, or null when there's nothing more to ask. */
export function nextQuestion(c: QuestionContext): Question | null {
  return QUESTIONS.find((q) => isOpen(q, c)) ?? null;
}

/** How much of what matters we know. Skipped questions count as unanswered: they still matter. */
export function accuracy(c: QuestionContext): { answered: number; total: number } {
  const relevant = QUESTIONS.filter((q) => q.applies(c));
  return { answered: relevant.filter((q) => c.known.includes(q.id)).length, total: relevant.length };
}
