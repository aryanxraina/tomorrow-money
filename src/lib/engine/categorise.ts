import type { Category } from '../types';

// Rules first (fast, works offline). The AI only sees what rules can't place.
const RULES: [RegExp, Category][] = [
  [/WAGES|SALARY|PAYOUT|AGENCY PAY|DWP|UC\b|CHB|SLC|STUDENT LOAN|PENSION|REFUND/i, 'income'],
  [/RENT|MORTGAGE|LETS|HOMES/i, 'housing'],
  [/CTAX|COUNCIL TAX/i, 'council_tax'],
  [/PAYPOINT|ENERGY|GAS|ELECTRIC|OCTOPUS|EDF|EON|BRITISH GAS/i, 'energy'],
  [/WATER/i, 'water'],
  [/BROADBAND|\bBB\b|FIBRE|MOBILE|SIM|PHONE/i, 'broadband_phone'],
  [/ALDI|LIDL|TESCO|SAINSBURY|ASDA|MORRISONS|CO-OP|COOP|ICELAND|SKLEP|SUPERMARKET|GROCER|WAITROSE|M&S FOOD/i, 'groceries'],
  [/ESSO|SHELL|\bBP\b|FUEL|PETROL|BUS|TRAIN|RAIL|TFL|EBIKE|UBER TRIP|PARKING/i, 'transport'],
  [/INSURANCE|\bINS\b|MOTORCOVER/i, 'insurance'],
  [/KLARNA|CLEARPAY|LOAN|CASHNOW|CREDIT CARD|LAYBUY/i, 'debt'],
  [/FEE|INTEREST|CHARGE|PENALTY/i, 'fees'],
  [/STREAM|NETFLIX|SPOTIFY|DISNEY|GYM|STORAGE|GAMING|SUBS|PRIME/i, 'subscriptions'],
  [/JUST EAT|DELIVEROO|FOODAPP ORDER|TAKEAWAY|KFC|MCDONALD|GREGGS|CAFE|BAR\b|PUB/i, 'eating_out'],
  [/PRIMARK|AMAZON|ARGOS|SHOP|CLOTH|BOOTS/i, 'shopping'],
  [/PARENTPAY|SCHOOL|NURSERY|CHILD/i, 'kids'],
  [/ATM|CASH WITHDRAWAL/i, 'cash'],
  [/TRANSFER|QUICKSEND|TO [A-Z]+ [A-Z]? ?-/i, 'transfers'],
  [/UNI |PRINT|BOOKS|TUITION/i, 'education'],
  [/HMRC|TAX POT/i, 'tax'],
];

export function categorise(description: string, amount: number): Category {
  if (amount > 0 && !/REFUND/i.test(description)) {
    return 'income';
  }
  // Fees must win over the merchant they relate to ("KLARNA LATE FEE", "ATM FEE").
  if (/FEE|INTEREST|UNPAID ITEM/i.test(description)) return 'fees';
  for (const [re, cat] of RULES) {
    if (cat === 'income') continue;
    if (re.test(description)) return cat;
  }
  return 'other';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  income: 'Income',
  housing: 'Rent / housing',
  council_tax: 'Council tax',
  energy: 'Energy',
  water: 'Water',
  broadband_phone: 'Phone & broadband',
  groceries: 'Groceries',
  transport: 'Transport & fuel',
  insurance: 'Insurance',
  debt: 'Debt repayments',
  fees: 'Fees & interest',
  subscriptions: 'Subscriptions',
  eating_out: 'Takeaways & eating out',
  shopping: 'Shopping',
  kids: 'Children',
  cash: 'Cash',
  transfers: 'Transfers',
  education: 'Education',
  tax: 'Tax',
  savings: 'Savings',
  other: 'Other',
};

export const ESSENTIAL: Category[] = [
  'housing',
  'council_tax',
  'energy',
  'water',
  'broadband_phone',
  'groceries',
  'transport',
  'insurance',
  'debt',
  'kids',
];
