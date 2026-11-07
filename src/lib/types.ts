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
  | 'transfers' // money to or from other people, or unknown money in
  | 'internal' // moves between your own accounts: not income and not spending
  | 'refund'
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
  account?: string;
  items?: ReceiptItem[];
  merchant?: string;
}

export interface Account {
  id: string;
  name: string;
  bank: string | null;
  balance: number | null;
  balanceDate: string | null;
}

export type IncomeType = 'salary' | 'four_weekly' | 'gig' | 'zero_hours' | 'student_loan' | 'benefits' | 'pension';

export type DebtType = 'overdraft' | 'bnpl' | 'credit_card' | 'payday' | 'arrears';

export type Barrier = 'language' | 'new_to_uk' | 'low_digital' | 'disability' | 'no_bank_history';

export type Nation = 'england' | 'wales' | 'scotland' | 'ni';

export type Lang = 'en';

export interface DatedAmount {
  label: string;
  date: string;
  amount: number; // positive number; direction given by context
}

export interface Answers {
  name: string;
  nation: Nation | null;
  ageBand: 'under_25' | '25_to_pension' | 'pension_age' | null;
  adults: number;
  children: number;
  childUnder4: boolean;
  incomeTypes: IncomeType[];
  monthlyIncome: number;
  payDay: number | null; // day of the month, when known
  housing: 'rent_private' | 'rent_social' | 'mortgage' | 'family' | 'student_house' | 'room';
  housingCost: number;
  rentDay: number | null;
  energyPayment: 'prepayment' | 'direct_debit' | 'included';
  energyMonthly: number;
  billsMonthly: number; // phone, broadband, insurance, subscriptions
  foodWeekly: number;
  otherWeekly: number; // travel, shopping and everything else
  debts: DebtType[];
  debtRepayMonthly: number;
  savings: number;
  balance: number;
  balanceDate: string | null; // when the balance was last given or read from a statement
  postcode: string;
  councilTaxMonthly: number;
  ctInstalments: 10 | 12 | null;
  ctSingleDiscount: boolean;
  ctReduction: boolean;
  allStudents: boolean;
  onBenefits: boolean;
  barriers: Barrier[];
  worry: string;
  yearlyBills: DatedAmount[]; // known big bills coming (MOT, insurance renewal, Christmas)
  futureIncome: DatedAmount[]; // known lump sums (student loan instalments)
}

/** Help the person has confirmed they're getting. Only these amounts are counted in the forecast. */
export interface ConfirmedSupport {
  id: string;
  title: string;
  monthly: number;
  oneOff: number;
  oneOffDate: string | null;
  confirmedOn: string;
}
