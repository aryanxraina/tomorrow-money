import type { Category } from '../types';

// Plain rules first, so this is fast and works offline. Every pattern has word boundaries:
// without them "COFFEE" reads as a fee, "PARENT" as rent and "BUSINESS" as a bus.
const w = (words: string) => new RegExp(`(?:^|[^A-Z0-9])(?:${words})(?:$|[^A-Z0-9])`, 'i');

const INTERNAL = w(`POT TRANSFER|SAVINGS POT|(?:TO|FROM) (?:POT|SPACE)|SAVINGS SPACE|FROM SAVINGS|TO SAVINGS|SAVINGS TRANSFER|TRANSFER (?:TO|FROM) (?:MY |OWN )?(?:ACCOUNT|SAVINGS|ISA)|OWN ACCOUNT|ISA TRANSFER`);
const FEES = w(`FEES?|CHARGES?|OVERDRAFT|ARRANGED OD|UNARRANGED|O/D|INTEREST|UNPAID ITEM|RETURNED (?:ITEM|PAYMENT|DD)|PENALTY|LATE PAYMENT`);
const REFUND = w(`REFUND|REFUNDED|REVERSAL|CASHBACK|CASH BACK|CHARGEBACK`);

const INCOME = w(
  `WAGES?|SALARY|PAYROLL|NET PAY|PAYSLIP|BGC|PAYOUTS?|AGENCY PAY|DWP|UNIVERSAL CREDIT|UC|CHB|CHILD BENEFIT|TAX CREDITS?|PIP|ESA|JSA|PENSION|SLC|STUDENT LOANS? COMPANY|STUDENT FINANCE|MAINTENANCE LOAN|HMRC NTC|DELIVEROO|UBER PAYMENTS|UBER BV|BOLT OPERATIONS|STUART DELIVERY|EVRI|AMAZON FLEX`,
);

const RULES: [RegExp, Category][] = [
  [w(`RENT|MORTGAGE|LETS|LETTINGS?|LANDLORD|HOUSING ASSOCIATION|HOUSING|HOMES`), 'housing'],
  [w(`CTAX|COUNCIL TAX|C TAX|COUNCIL|BOROUGH|CITY OF`), 'council_tax'],
  [w(`PAYPOINT|ENERGY|GAS|ELECTRIC|ELECTRICITY|OCTOPUS|EDF|E\\.?ON|BRITISH GAS|OVO|SCOTTISHPOWER|SCOTTISH POWER|UTILITA|UTILITY WAREHOUSE|BULB|PREPAY POWER`), 'energy'],
  [w(`WATER|THAMES WATER|SEVERN TRENT|UNITED UTILITIES|ANGLIAN|DWR CYMRU|SOUTHERN WATER|WESSEX WATER`), 'water'],
  [
    w(`BROADBAND|BB|FIBRE|MOBILE|SIM|PHONE|VODAFONE|EE LIMITED|EE LTD|O2|THREE UK|THREE MOBILE|H3G|BT GROUP|BT BROADBAND|SKY DIGITAL|SKY UK|VIRGIN MEDIA|TALKTALK|GIFFGAFF|PLUSNET|VOXI|SMARTY|LEBARA|LYCAMOBILE|ID MOBILE|HYPEROPTIC|COMMUNITY FIBRE`),
    'broadband_phone',
  ],
  [
    w(`ALDI|LIDL|TESCO|SAINSBURYS?|SAINSBURY'S|ASDA|MORRISONS|CO-?OP|COOPERATIVE|ICELAND|SKLEP|SUPERMARKET|GROCERS?|GROCERY|WAITROSE|M&S FOOD|M&S SIMPLY FOOD|OCADO|SPAR|NISA|COSTCUTTER|FARMFOODS|BOOTHS|LONDIS|PREMIER STORES?|QUICKSTOP|BUDGENS`),
    'groceries',
  ],
  [
    w(`ESSO|SHELL|BP|TEXACO|GULF|JET|MFG|MOTOR FUEL|FUEL|PETROL|BUS|BUSES|TRAIN|RAIL|TFL|TRAINLINE|STAGECOACH|ARRIVA|FIRST BUS|LNER|AVANTI|GWR|NORTHERN TRAINS|THAMESLINK|MERSEYRAIL|UBER TRIP|BOLT|EBIKE|PARKING|RINGGO|PAYBYPHONE|NCP|MOT|DVLA|HALFORDS|KWIK FIT`),
    'transport',
  ],
  [w(`INSURANCE|INS|MOTORCOVER|AVIVA|ADMIRAL|DIRECT LINE|HASTINGS|CHURCHILL|VITALITY|LV=|MORE THAN|ESURE|SHEILAS WHEELS`), 'insurance'],
  [w(`KLARNA|CLEARPAY|LAYBUY|PAYPAL CREDIT|LOANS?|CASHNOW|CREDIT CARD|BARCLAYCARD|AMERICAN EXPRESS|AMEX|CAPITAL ONE|VANQUIS|AQUA|MBNA|NEWDAY|FLUID|LENDABLE|ZOPA|LENDING STREAM|DRAFTY|PROVIDENT|PAYDAY|STUDENT LOANS?`), 'debt'],
  [
    w(`STREAM|NETFLIX|SPOTIFY|DISNEY|AMAZON PRIME|PRIME VIDEO|PRIME|APPLE\\.COM/BILL|APPLE\\.COM|YOUTUBE|NOW TV|AUDIBLE|PLAYSTATION|XBOX|GAME PASS|MICROSOFT 365|ICLOUD|DROPBOX|GYM|PUREGYM|THE GYM GROUP|DAVID LLOYD|ANYTIME FITNESS|FITLIFE|STORAGE|GAMING|SUBS|SUBSCRIPTION|PATREON`),
    'subscriptions',
  ],
  [
    w(`JUST EAT|JUSTEAT|DELIVEROO|UBER EATS|UBEREATS|FOODAPP ORDER|TAKEAWAY|KFC|MCDONALDS?|MCDONALD'S|BURGER KING|GREGGS|COSTA|STARBUCKS|PRET|NANDOS|NANDO'S|DOMINOS|DOMINO'S|PIZZA HUT|PAPA JOHNS|SUBWAY|WETHERSPOON|CAFE|COFFEE|BAR|PUB|RESTAURANT|FOOD HALL`),
    'eating_out',
  ],
  [w(`PRIMARK|AMAZON|AMZN|EBAY|ARGOS|SHOP|CLOTH|CLOTHING|BOOTS|SUPERDRUG|NEXT|H&M|ZARA|TK MAXX|TKMAXX|B&M|HOME BARGAINS|POUNDLAND|IKEA|JOHN LEWIS|CURRYS|SHEIN|TEMU|VINTED|DUNELM|WILKO|SPORTS DIRECT|JD SPORTS|ASOS`), 'shopping'],
  [w(`PARENTPAY|SCHOOL|NURSERY|CHILDCARE|CHILDMINDER|CHILD`), 'kids'],
  [w(`ATM|CASH WITHDRAWAL|CASH MACHINE|CASHPOINT|LINK|CDM|CASH`), 'cash'],
  [w(`TRANSFER|WISE|TRANSFERWISE|WESTERN UNION|MONEYGRAM|REMITLY|WORLDREMIT|QUICKSEND|TAPTAP|TO [A-Z]+ [A-Z]? ?-`), 'transfers'],
  [w(`UNI|UNIVERSITY|PRINT|BOOKS|TUITION`), 'education'],
  [w(`HMRC|TAX POT|SELF ASSESSMENT`), 'tax'],
];

const HINTS: [RegExp, Category][] = [
  [/grocer/i, 'groceries'],
  [/eating|restaurant|takeaway/i, 'eating_out'],
  [/transport|travel|fuel/i, 'transport'],
  [/bills?/i, 'other'],
  [/shopping|personal care|clothes/i, 'shopping'],
  [/entertainment|subscription/i, 'subscriptions'],
  [/\bcash\b/i, 'cash'],
  [/income|salary|wages/i, 'income'],
  [/transfer|savings|pot/i, 'transfers'],
];

/** Categorises from the description. `hint` is the bank's own category or type column, if it has one. */
export function categorise(description: string, amount: number, hint?: string): Category {
  if (INTERNAL.test(description) || (hint && /pot transfer|space|internal/i.test(hint))) return 'internal';
  if (amount > 0) {
    if (REFUND.test(description)) return 'refund';
    if (INCOME.test(description)) return 'income';
    if (hint && /income|salary|wages/i.test(hint)) return 'income';
    // Unknown money in isn't assumed to be income: it could be a friend paying you back.
    return 'transfers';
  }
  // Fees come first so they beat the merchant they relate to ("KLARNA LATE FEE", "ATM FEE").
  if (FEES.test(description)) return 'fees';
  for (const [re, cat] of RULES) if (re.test(description)) return cat;
  if (hint) for (const [re, cat] of HINTS) if (re.test(hint)) return cat;
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
  transfers: 'Other people',
  internal: 'Between my accounts',
  refund: 'Refund',
  education: 'Education',
  tax: 'Tax',
  savings: 'Savings',
  other: 'Other',
};

export const ESSENTIAL: Category[] = ['housing', 'council_tax', 'energy', 'water', 'broadband_phone', 'groceries', 'transport', 'insurance', 'debt', 'kids'];
