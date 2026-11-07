// Made-up statements in each bank's likely layout, written from public descriptions and importer projects.
// Those sources disagree in places, so real files get checked with scripts/check-statement.mts too.

export interface StatementCase {
  name: string;
  fileName: string;
  text: string;
  bank: string | null;
  count: number;
  moneyIn: number;
  moneyOut: number;
  closing: number | null;
  /** Encode as Latin-1 before decoding, as some banks' exports are. */
  latin1?: boolean;
}

export const STATEMENTS: StatementCase[] = [
  {
    name: 'Monzo',
    fileName: 'MonzoDataExport.csv',
    bank: 'Monzo',
    count: 3,
    moneyIn: 1500,
    moneyOut: 123.45,
    closing: null,
    text: `Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency,Local amount,Local currency,Notes and #tags,Address,Receipt,Description,Category split,Money Out,Money In
tx_0001,01/10/2026,09:12:33,Faster payment,Acme Ltd,,Income,1500.00,GBP,1500.00,GBP,,,,ACME PAYROLL,,,1500.00
tx_0002,02/10/2026,18:03:11,Card payment,Tesco,,Groceries,-23.45,GBP,-23.45,GBP,,Leeds,,TESCO STORES 3021,,-23.45,
tx_0003,03/10/2026,07:30:00,Pot transfer,Savings Pot,,Savings,-100.00,GBP,-100.00,GBP,,,,Pot transfer,,-100.00,
`,
  },
  {
    name: 'Starling',
    fileName: 'StarlingStatement_2026-10.csv',
    bank: 'Starling',
    count: 3,
    moneyIn: 1500,
    moneyOut: 33.44,
    closing: 1666.56,
    text: `Date,Counter Party,Reference,Type,Amount (GBP),Balance (GBP),Spending Category,Notes
01/10/2026,Acme Ltd,Wages,FASTER PAYMENT,1500.00,1700.00,INCOME,
02/10/2026,Tesco,TESCO STORES,CONTACTLESS,-23.45,1676.55,GROCERIES,
03/10/2026,Netflix,NETFLIX.COM,ONLINE PAYMENT,-9.99,1666.56,ENTERTAINMENT,
`,
  },
  {
    name: 'Barclays',
    fileName: 'data.csv',
    bank: 'Barclays',
    count: 2,
    moneyIn: 1500,
    moneyOut: 23.45,
    closing: null,
    text: `Number,Date,Account,Amount,Subcategory,Memo
,01/10/2026,20-00-00 12345678,1500.00,Counter Credit,ACME LTD         WAGES
,02/10/2026,20-00-00 12345678,-23.45,PAYMENT,"CARD PAYMENT TO TESCO STORES 3021,23.45 GBP ON 01-10-2026"
`,
  },
  {
    name: 'HSBC with no header row',
    fileName: 'hsbc-transactions.csv',
    bank: 'HSBC',
    count: 3,
    moneyIn: 1500,
    moneyOut: 33.44,
    closing: null,
    text: `01/10/2026,"ACME LTD WAGES",1500.00
02/10/2026,"TESCO STORES 3021 LEEDS",-23.45
03/10/2026,"NETFLIX.COM",-9.99
`,
  },
  {
    name: 'Lloyds, newest first',
    fileName: 'transactions.csv',
    bank: 'Lloyds or Halifax',
    count: 3,
    moneyIn: 1500,
    moneyOut: 33.44,
    closing: 1666.56,
    text: `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
03/10/2026,DEB,'30-00-00,12345678,NETFLIX.COM,9.99,,1666.56
02/10/2026,DEB,'30-00-00,12345678,TESCO STORES 3021,23.45,,1676.55
01/10/2026,BGC,'30-00-00,12345678,ACME LTD WAGES,,1500.00,1700.00
`,
  },
  {
    name: 'NatWest, with a blank line and apostrophes',
    fileName: 'statement.csv',
    bank: 'NatWest or RBS',
    count: 2,
    moneyIn: 1500,
    moneyOut: 23.45,
    closing: 1676.55,
    text: `Date, Type, Description, Value, Balance, Account Name, Account Number

01 Oct 2026,BAC,"'ACME LTD , WAGES , FP 01/10/26",1500.00,1700.00,"'MR S SMITH","'600000-12345678",
02 Oct 2026,POS,"'3021 01OCT26 , TESCO STORES , LEEDS GB",-23.45,1676.55,"'MR S SMITH","'600000-12345678",
`,
  },
  {
    name: 'Santander plain text, in Latin-1',
    fileName: 'Statement.txt',
    bank: 'Santander',
    count: 2,
    moneyIn: 1500,
    moneyOut: 23.45,
    closing: 1676.55,
    latin1: true,
    text: `From: 01/10/2026 to 31/10/2026

Account: XXXX XXXX XXXX 1234

Date: 01/10/2026
Description: BANK GIRO CREDIT REF ACME LTD, WAGES
Amount: 1500.00 GBP
Balance: 1700.00 GBP

Date: 02/10/2026
Description: CARD PAYMENT TO TESCO STORES 3021,23.45 GBP, RATE 1.00/GBP ON 01-10-2026
Amount: -23.45 GBP
Balance: 1676.55 GBP
`,
  },
  {
    name: 'Nationwide, with details above the header, in Latin-1',
    fileName: 'Statement Download.csv',
    bank: 'Nationwide',
    count: 2,
    moneyIn: 1500,
    moneyOut: 23.45,
    closing: 1676.55,
    latin1: true,
    text: `"Account Name:","FlexAccount ****12345"
"Account Balance:","£1,676.55"
"Available Balance: ","£1,676.55"

"Date","Transaction type","Description","Paid out","Paid in","Balance"
"01 Oct 2026","Bank credit","Bank credit ACME LTD WAGES","","£1,500.00","£1,700.00"
"02 Oct 2026","Contactless Payment","TESCO STORES 3021","£23.45","","£1,676.55"
`,
  },
  {
    name: 'Unknown bank, semicolons, oldest first',
    fileName: 'export.csv',
    bank: null,
    count: 2,
    moneyIn: 50,
    moneyOut: 10,
    closing: 140,
    text: `Booking date;Details;Withdrawals;Deposits;Balance
01/09/2026;Friend;;50.00;150.00
05/09/2026;Shop;10.00;;140.00
`,
  },
];
