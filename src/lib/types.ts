export type Category =
  | 'income'
  | 'housing'
  | 'council_tax'
  | 'energy'
  | 'water'
  | 'broadband_phone'
  | 'groceries'
  | 'transport'
  | 'insurance'
  | 'debt'
  | 'fees'
  | 'subscriptions'
  | 'eating_out'
  | 'shopping'
  | 'kids'
  | 'cash'
  | 'transfers'
  | 'education'
  | 'tax'
  | 'savings'
  | 'other';

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number; // line total in £
  category?: string;
}

export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // + money in, - money out
  category: Category;
  source: 'bank' | 'receipt' | 'manual' | 'email' | 'estimate';
  items?: ReceiptItem[];
  merchant?: string;
}

export type IncomeType =
  | 'salary'
  | 'four_weekly'
  | 'gig'
  | 'zero_hours'
  | 'student_loan'
  | 'benefits'
  | 'pension';

export type DebtType = 'overdraft' | 'bnpl' | 'credit_card' | 'payday' | 'arrears';

export type Barrier = 'language' | 'new_to_uk' | 'low_digital' | 'disability' | 'no_bank_history';

export type Lang = 'en' | 'pl' | 'hi' | 'ur';

export interface DatedAmount {
  label: string;
  date: string;
  amount: number; // positive number; direction given by context
}

export interface Answers {
  name: string;
  adults: number;
  children: number;
  childUnder4: boolean;
  incomeTypes: IncomeType[];
  monthlyIncome: number;
  housing: 'rent_private' | 'rent_social' | 'mortgage' | 'family' | 'student_house' | 'room';
  housingCost: number;
  energyPayment: 'prepayment' | 'direct_debit' | 'included';
  foodWeekly: number;
  debts: DebtType[];
  debtRepayMonthly: number;
  savings: number;
  balance: number;
  postcode: string;
  councilTaxMonthly: number;
  ctSingleDiscount: boolean;
  ctReduction: boolean;
  allStudents: boolean;
  onBenefits: boolean;
  barriers: Barrier[];
  language: Lang;
  worry: string;
  yearlyBills: DatedAmount[]; // known big bills coming (MOT, insurance renewal, Christmas)
  futureIncome: DatedAmount[]; // known lump sums (student loan instalments)
}

export interface BasketItem {
  name: string;
  qty: number;
  basePrice: number; // price at the cheapest chain (index 1.00)
}

export interface Persona {
  id: string;
  name: string;
  age: number;
  city: string;
  hero: string;
  tagline: string;
  answers: Answers;
  txns: Txn[];
  basket: BasketItem[];
  demoLocation: { lat: number; lng: number; label: string };
}
