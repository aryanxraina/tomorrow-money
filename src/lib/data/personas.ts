import type { Answers, BasketItem, Category, Persona, Txn } from '../types';
import { addDays, addMonths, month, toDate, fmt, TODAY } from '../engine/dates';
import { categorise } from '../engine/categorise';
import { rng, round2 } from '../engine/rng';

// Six months of synthetic bank history ending yesterday. Every pattern the app
// should find is planted on purpose, so the demo is deterministic.
export const HISTORY_START = addDays(TODAY, -183);
export const HISTORY_END = addDays(TODAY, -1);

function builder(pid: string, seed: number) {
  const r = rng(seed);
  const txns: Txn[] = [];
  let n = 0;
  const add = (date: string, description: string, amount: number, category?: Category) => {
    if (date < HISTORY_START || date > HISTORY_END) return;
    txns.push({
      id: `${pid}-${n++}`,
      date,
      description,
      amount: round2(amount),
      category: category ?? categorise(description, amount),
      source: 'bank',
    });
  };
  const monthly = (dom: number, fn: (date: string) => void) => {
    const firstOfStart = fmt(new Date(Date.UTC(toDate(HISTORY_START).getUTCFullYear(), toDate(HISTORY_START).getUTCMonth(), 1)));
    for (let i = 0; i < 8; i++) {
      const date = addMonths(firstOfStart, i, dom);
      if (date >= HISTORY_START && date <= HISTORY_END) fn(date);
    }
  };
  const every = (anchor: string, step: number, fn: (date: string) => void) => {
    for (let d = anchor; d <= HISTORY_END; d = addDays(d, step)) if (d >= HISTORY_START) fn(d);
  };
  const daily = (fn: (date: string, daysAgo: number) => void) => {
    for (let d = HISTORY_START; d <= HISTORY_END; d = addDays(d, 1)) fn(d, Math.round((toDate(TODAY).getTime() - toDate(d).getTime()) / 86400000));
  };
  const weekdayOf = (d: string) => toDate(d).getUTCDay();
  return { r, add, monthly, every, daily, weekdayOf, txns };
}

const baseAnswers: Answers = {
  name: '',
  adults: 1,
  children: 0,
  childUnder4: false,
  incomeTypes: [],
  monthlyIncome: 0,
  housing: 'rent_private',
  housingCost: 0,
  energyPayment: 'direct_debit',
  foodWeekly: 50,
  debts: [],
  debtRepayMonthly: 0,
  savings: 0,
  balance: 0,
  postcode: '',
  councilTaxMonthly: 0,
  ctSingleDiscount: false,
  ctReduction: false,
  allStudents: false,
  onBenefits: false,
  barriers: [],
  language: 'en',
  worry: '',
  yearlyBills: [],
  futureIncome: [],
};

// ---------- Amara: single parent on Universal Credit (Leeds) ----------
function amara(): Persona {
  const b = builder('amara', 101);
  const { r, add, monthly, every, daily, weekdayOf } = b;
  every('2026-05-08', 28, (d) => add(d, 'CARECO LTD WAGES', r.between(780, 845)));
  monthly(14, (d) => add(d, 'DWP UC', r.between(705, 725)));
  every('2026-05-11', 28, (d) => add(d, 'DWP CHB', 173.2));
  monthly(1, (d) => add(d, 'LEEDS HOMES RENT', -575));
  monthly(1, (d) => {
    const m = month(d);
    if (m !== 2 && m !== 3) add(d, 'LEEDS CC CTAX', -108.5);
  });
  monthly(18, (d) => add(d, 'YORKSHIRE WATER', -38));
  monthly(22, (d) => add(d, 'HOMEFIBRE BROADBAND', -32));
  monthly(9, (d) => add(d, 'MOBILE PLAN', -15));
  monthly(27, (d) => add(d, 'MOTORCOVER INS MONTHLY', -84));
  monthly(5, (d) => add(d, 'VIDEO STREAM', -10.99));
  every('2026-05-20', 14, (d) => add(d, 'KLARNA', -24.5));
  add('2026-08-17', 'KLARNA LATE FEE', -5);
  add('2026-10-12', 'KLARNA LATE FEE', -5);
  add('2026-09-28', 'UNPAID ITEM FEE', -12);
  ['2026-08-25', '2026-09-25', '2026-10-25'].forEach((d) => add(d, 'OVERDRAFT INTEREST', -r.between(6, 11)));
  every('2026-05-10', 7, (d) => add(d, 'ESSO PETROL', -r.between(18, 32)));
  every('2026-05-09', 6, (d) => add(d, 'PAYPOINT ENERGY TOPUP', month(d) >= 10 ? -25 : -20));
  daily((d, ago) => {
    const wd = weekdayOf(d);
    if (wd === 1 || wd === 4) add(d, 'ALDI STORES', -r.between(24, 40));
    if (r.chance(0.28)) add(d, 'TESCO EXPRESS', -r.between(6, 16));
    if (r.chance(0.07)) add(d, 'CO-OP FOOD', -r.between(6, 14));
    const m = month(d);
    if (wd === 5 && m !== 8 && !(m === 7 && toDate(d).getUTCDate() > 22)) add(d, 'PARENTPAY SCHOOL', -12);
    if (r.chance(ago < 30 ? 0.2 : 0.09)) add(d, 'JUST EAT', -r.between(15, 23));
    if (r.chance(0.07)) add(d, 'CASH ATM', -20);
    if (r.chance(0.035)) add(d, 'PRIMARK', -r.between(12, 38));
  });
  const answers: Answers = {
    ...baseAnswers,
    name: 'Amara',
    adults: 1,
    children: 2,
    childUnder4: true,
    incomeTypes: ['four_weekly', 'benefits'],
    monthlyIncome: 1790,
    housing: 'rent_social',
    housingCost: 575,
    energyPayment: 'prepayment',
    foodWeekly: 110,
    debts: ['bnpl', 'overdraft'],
    debtRepayMonthly: 53,
    savings: 0,
    balance: 236,
    postcode: 'LS9',
    councilTaxMonthly: 108.5,
    ctSingleDiscount: true,
    ctReduction: false,
    onBenefits: true,
    worry: 'I always run short the week before payday and December scares me.',
    yearlyBills: [
      { label: 'MOT and car service', date: '2026-12-03', amount: 180 },
      { label: 'Christmas presents', date: '2026-12-12', amount: 200 },
    ],
  };
  const basket: BasketItem[] = [
    { name: 'Milk 4 pints', qty: 1, basePrice: 1.55 },
    { name: 'Bread', qty: 1, basePrice: 0.75 },
    { name: 'Eggs x12', qty: 1, basePrice: 2.39 },
    { name: 'Nappies', qty: 1, basePrice: 3.95 },
    { name: 'Chicken breast 1kg', qty: 1, basePrice: 5.49 },
    { name: 'Pasta 500g', qty: 2, basePrice: 0.75 },
    { name: 'Baked beans x4', qty: 1, basePrice: 1.3 },
    { name: 'Bananas', qty: 1, basePrice: 0.95 },
    { name: 'Cheddar 400g', qty: 1, basePrice: 2.89 },
  ];
  return {
    id: 'amara',
    name: 'Amara',
    age: 31,
    city: 'Leeds',
    hero: 'Single parent',
    tagline: 'Two kids, part-time care work plus Universal Credit, prepayment meter',
    answers,
    txns: b.txns,
    basket,
    demoLocation: { lat: 53.8072, lng: -1.5175, label: 'Tesco Express, Harehills (demo)' },
  };
}

// ---------- Jordan: gig delivery rider (Birmingham) ----------
function jordan(): Persona {
  const b = builder('jordan', 202);
  const { r, add, monthly, every, daily, weekdayOf } = b;
  every('2026-05-11', 7, (d) => add(d, 'FOODAPP PAYOUT', r.between(170, 380)));
  every('2026-05-14', 7, (d) => add(d, 'RIDEAPP PAYOUT', r.between(50, 150)));
  monthly(1, (d) => add(d, 'ROOM RENT - M KHAN', -520, 'housing'));
  every('2026-05-10', 7, (d) => add(d, 'EBIKE HIRE', -35));
  monthly(15, (d) => add(d, 'MOBILE PLAN', -22));
  monthly(20, (d) => {
    if (d >= '2026-06-01') add(d, 'CASHNOW LOANS', -145);
  });
  monthly(3, (d) => add(d, 'FITLIFE GYM', -24.99, 'subscriptions'));
  monthly(10, (d) => add(d, 'MUSIC STREAM', -11.99));
  monthly(12, (d) => add(d, 'VIDEO STREAM', -10.99));
  monthly(16, (d) => add(d, 'GAMING SUBS', -8.99));
  daily((d, ago) => {
    const wd = weekdayOf(d);
    if (wd === 3 || wd === 6) add(d, 'FOODAPP INSTANT CASHOUT FEE', -1);
    if (wd === 2 || wd === 6) add(d, 'LIDL GB', -r.between(15, 32));
    if (r.chance(0.42)) add(d, 'TESCO EXPRESS', -r.between(4, 11));
    if (r.chance(ago < 30 ? 0.55 : 0.28)) add(d, 'FOODAPP ORDER', -r.between(11, 22));
    if (r.chance(0.03)) add(d, 'PRIMARK', -r.between(18, 35));
  });
  add('2026-10-29', 'OVERDRAFT INTEREST', -4.2);
  const answers: Answers = {
    ...baseAnswers,
    name: 'Jordan',
    adults: 3,
    incomeTypes: ['gig'],
    monthlyIncome: 1620,
    housing: 'room',
    housingCost: 520,
    energyPayment: 'included',
    foodWeekly: 85,
    debts: ['payday', 'overdraft'],
    debtRepayMonthly: 145,
    savings: 0,
    balance: 212,
    postcode: 'B12',
    councilTaxMonthly: 0,
    worry: 'Some weeks are great, some are terrible. I have no idea what I owe in tax.',
  };
  const basket: BasketItem[] = [
    { name: 'Rice 1kg', qty: 1, basePrice: 1.39 },
    { name: 'Chicken breast 1kg', qty: 1, basePrice: 5.49 },
    { name: 'Eggs x12', qty: 1, basePrice: 2.39 },
    { name: 'Bread', qty: 1, basePrice: 0.75 },
    { name: 'Milk 4 pints', qty: 1, basePrice: 1.55 },
    { name: 'Pasta 500g', qty: 2, basePrice: 0.75 },
    { name: 'Energy drinks x4', qty: 1, basePrice: 2.59 },
    { name: 'Bananas', qty: 1, basePrice: 0.95 },
  ];
  return {
    id: 'jordan',
    name: 'Jordan',
    age: 26,
    city: 'Birmingham',
    hero: 'Gig worker',
    tagline: 'Food delivery rider, income changes every week, self-employed tax',
    answers,
    txns: b.txns,
    basket,
    demoLocation: { lat: 52.4583, lng: -1.8862, label: 'Tesco Express, Balsall Heath (demo)' },
  };
}

// ---------- Kacper: new to the UK, Polish speaker (Peterborough) ----------
function kacper(): Persona {
  const b = builder('kacper', 303);
  const { r, add, monthly, every, daily, weekdayOf } = b;
  every('2026-05-08', 7, (d) => add(d, 'TEMPRA AGENCY PAY', r.between(250, 460)));
  monthly(1, (d) => add(d, 'ROOM RENT', -450));
  monthly(1, (d) => add(d, 'CITY BUS MONTHLY', -68));
  monthly(3, (d) => {
    add(d, 'QUICKSEND TRANSFER PL', -250, 'transfers');
    add(d, 'QUICKSEND FEE', -4.99);
  });
  every('2026-05-09', 7, (d) => {
    add(d, 'CASH WITHDRAWAL', -40, 'cash');
    add(d, 'ATM FEE', -1.99);
  });
  every('2026-05-12', 15, (d) => add(d, 'PREPAY SIM TOPUP', -10));
  daily((d) => {
    const wd = weekdayOf(d);
    if (wd === 2 || wd === 5) add(d, 'POLSKI SKLEP', -r.between(12, 28), 'groceries');
    if (wd === 0) add(d, 'LIDL GB', -r.between(18, 38));
    if (r.chance(0.14)) add(d, 'TESCO EXPRESS', -r.between(5, 12));
    if (r.chance(0.04)) add(d, 'CAFE', -r.between(4, 9));
  });
  add('2026-06-15', 'WORKWEAR SHOP', -45, 'shopping');
  const answers: Answers = {
    ...baseAnswers,
    name: 'Kacper',
    adults: 2,
    incomeTypes: ['zero_hours'],
    monthlyIncome: 1540,
    housing: 'room',
    housingCost: 450,
    energyPayment: 'included',
    foodWeekly: 75,
    debts: [],
    savings: 150,
    balance: 188,
    postcode: 'PE1',
    barriers: ['language', 'new_to_uk', 'no_bank_history'],
    language: 'pl',
    worry: 'Moje godziny się zmieniają. Wysyłam pieniądze do rodziny i nie wiem, jakie mam prawa.',
  };
  const basket: BasketItem[] = [
    { name: 'Bread', qty: 1, basePrice: 0.75 },
    { name: 'Kielbasa sausage', qty: 1, basePrice: 2.49 },
    { name: 'Potatoes 2.5kg', qty: 1, basePrice: 1.25 },
    { name: 'Milk 4 pints', qty: 1, basePrice: 1.55 },
    { name: 'Eggs x12', qty: 1, basePrice: 2.39 },
    { name: 'Cheese 400g', qty: 1, basePrice: 2.89 },
    { name: 'Coffee', qty: 1, basePrice: 2.99 },
    { name: 'Cabbage', qty: 1, basePrice: 0.79 },
  ];
  return {
    id: 'kacper',
    name: 'Kacper',
    age: 38,
    city: 'Peterborough',
    hero: 'New to the UK',
    tagline: 'Zero-hours warehouse work, sends money home, prefers Polish',
    answers,
    txns: b.txns,
    basket,
    demoLocation: { lat: 52.5795, lng: -0.2425, label: 'Tesco Express, Peterborough (demo)' },
  };
}

// ---------- Priya: student in a shared house (Manchester) ----------
function priya(): Persona {
  const b = builder('priya', 404);
  const { r, add, monthly, every, daily, weekdayOf } = b;
  add('2026-09-22', 'SLC MAINT LOAN', 1612);
  every('2026-05-08', 7, (d) => {
    const m = month(d);
    if (m === 5) add(d, 'THE ALBERT BAR WAGES', r.between(90, 150));
    else if (m >= 6 && m <= 8) add(d, 'SUMMER JOB WAGES', r.between(200, 260));
    else if (d >= '2026-09-25') add(d, 'THE ALBERT BAR WAGES', r.between(115, 175));
  });
  monthly(1, (d) => add(d, 'CAMPUS LETS RENT', -520));
  monthly(5, (d) => add(d, 'TO JAMES P - BILLS', -45, 'energy'));
  add('2026-10-01', 'MANCHESTER CC CTAX', -98);
  add('2026-11-01', 'MANCHESTER CC CTAX', -98);
  monthly(2, (d) => add(d, 'FITLIFE GYM', -24.99, 'subscriptions'));
  monthly(8, (d) => add(d, 'MUSIC STREAM', -11.99));
  monthly(11, (d) => add(d, 'CLOUD STORAGE', -2.99));
  monthly(14, (d) => add(d, 'VIDEO STREAM', -10.99));
  monthly(21, (d) => add(d, 'VIDEO STREAM PLUS', -5.99));
  daily((d, ago) => {
    const wd = weekdayOf(d);
    const term = d >= '2026-09-20' || d <= '2026-06-10';
    if (wd === 6) add(d, 'ALDI STORES', -r.between(20, 35));
    if (r.chance(0.4)) add(d, 'SAINSBURYS LOCAL', -r.between(3, 9));
    if (r.chance(ago < 30 ? 0.42 : 0.25)) add(d, 'FOODAPP ORDER', -r.between(9, 18));
    if (term && wd === 1) add(d, 'CITY BUS', -8);
    if (term && r.chance(0.05)) add(d, 'UNI PRINT SHOP', -r.between(3, 12), 'education');
    if (r.chance(0.035)) add(d, 'AMAZON', -r.between(12, 35));
  });
  const answers: Answers = {
    ...baseAnswers,
    name: 'Priya',
    adults: 4,
    incomeTypes: ['student_loan', 'zero_hours'],
    monthlyIncome: 1050,
    housing: 'student_house',
    housingCost: 520,
    energyPayment: 'included',
    foodWeekly: 55,
    debts: ['overdraft'],
    savings: 0,
    balance: 690,
    postcode: 'M14',
    councilTaxMonthly: 98,
    allStudents: true,
    worry: 'My loan disappears by December every year. How do I make it last?',
    futureIncome: [{ label: 'Student loan (term 2)', date: '2027-01-19', amount: 1612 }],
  };
  const basket: BasketItem[] = [
    { name: 'Pasta 500g', qty: 2, basePrice: 0.75 },
    { name: 'Pesto', qty: 1, basePrice: 1.19 },
    { name: 'Chopped tomatoes x4', qty: 1, basePrice: 1.4 },
    { name: 'Rice 1kg', qty: 1, basePrice: 1.39 },
    { name: 'Red lentils', qty: 1, basePrice: 1.09 },
    { name: 'Oat milk', qty: 1, basePrice: 1.29 },
    { name: 'Bread', qty: 1, basePrice: 0.75 },
    { name: 'Onions', qty: 1, basePrice: 0.89 },
  ];
  return {
    id: 'priya',
    name: 'Priya',
    age: 20,
    city: 'Manchester',
    hero: 'Student',
    tagline: 'Maintenance loan in termly lumps, bar job, house of four students',
    answers,
    txns: b.txns,
    basket,
    demoLocation: { lat: 53.4447, lng: -2.2195, label: "Sainsbury's Local, Fallowfield (demo)" },
  };
}

let cache: Persona[] | null = null;
export function getPersonas(): Persona[] {
  if (!cache) cache = [amara(), jordan(), kacper(), priya()];
  return cache;
}

export function getPersona(id: string): Persona | undefined {
  return getPersonas().find((p) => p.id === id);
}
