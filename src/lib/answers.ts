import type { Answers } from './types';

/**
 * A person who has told us nothing yet. Unanswered amounts are zero, never a guess: inventing someone's
 * rent or income would make the forecast look sure of things it doesn't know. `known` in the store
 * records which fields were really answered.
 */
export const BLANK_ANSWERS: Answers = {
  name: '',
  nation: null,
  ageBand: null,
  adults: 1,
  children: 0,
  childUnder4: false,
  incomeTypes: [],
  monthlyIncome: 0,
  payDay: null,
  housing: 'rent_private',
  housingCost: 0,
  rentDay: null,
  energyPayment: 'direct_debit',
  foodWeekly: 0,
  debts: [],
  debtRepayMonthly: 0,
  savings: 0,
  balance: 0,
  balanceDate: null,
  postcode: '',
  councilTaxMonthly: 0,
  ctInstalments: null,
  ctSingleDiscount: false,
  ctReduction: false,
  allStudents: false,
  onBenefits: false,
  barriers: [],
  worry: '',
  yearlyBills: [],
  futureIncome: [],
};
