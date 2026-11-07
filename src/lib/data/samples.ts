// Demo-only sample data. Every sample is clearly labelled in the UI.

export interface SampleEmail {
  id: string;
  from: string;
  subject: string;
  date: string;
  body: string;
}

const shared: SampleEmail[] = [
  {
    id: 'e1',
    from: 'billing@videostream.example',
    subject: 'Your VideoStream receipt',
    date: '2026-10-14',
    body: 'Thanks for being a member. We charged £10.99 for your Standard plan on 14 October 2026. Your next payment of £10.99 will be taken on 14 November 2026. Manage or cancel your membership any time in Account settings.',
  },
  {
    id: 'e2',
    from: 'hello@musicstream.example',
    subject: 'A change to your MusicStream price',
    date: '2026-10-28',
    body: 'From 8 December 2026 your Individual plan will cost £12.99 per month (currently £11.99). You do not need to do anything. If you want to cancel, you can do so before your next billing date.',
  },
  {
    id: 'e3',
    from: 'team@photocloud.example',
    subject: 'Your free trial ends soon',
    date: '2026-11-05',
    body: 'Your 30-day PhotoCloud Plus free trial ends on 12 November 2026. After that you will be charged £4.99 every month unless you cancel before the trial ends.',
  },
  {
    id: 'e4',
    from: 'orders@shop.example',
    subject: 'Your order has shipped',
    date: '2026-11-02',
    body: 'Good news! Your order #48213 (phone case, £8.49) is on its way and should arrive on Wednesday.',
  },
  {
    id: 'e5',
    from: 'members@fitlife.example',
    subject: 'Your FitLife membership',
    date: '2026-11-03',
    body: 'Your monthly membership of £24.99 renewed today. Your next renewal is on 3 December 2026. Freeze your membership for up to 3 months in the app.',
  },
];

const byPersona: Record<string, SampleEmail[]> = {
  amara: [
    {
      id: 'a1',
      from: 'hello@kidslearn.example',
      subject: 'KidsLearn: trial ending',
      date: '2026-11-04',
      body: 'Your family trial of KidsLearn ends on 15 November 2026. Your plan will then renew at £7.99 a month. Cancel any time before 15 November to avoid being charged.',
    },
  ],
  jordan: [
    {
      id: 'j1',
      from: 'noreply@gamezone.example',
      subject: 'GameZone Pass renewal',
      date: '2026-10-16',
      body: 'Your GameZone Pass renewed for £8.99. Next renewal: 16 November 2026.',
    },
  ],
  kacper: [
    {
      id: 'k1',
      from: 'kontakt@polskatv.example',
      subject: 'Twoja subskrypcja PolskaTV',
      date: '2026-10-20',
      body: 'Dziękujemy! Pobraliśmy £6.99 za miesięczną subskrypcję. Następna płatność: 20 listopada 2026. (Your monthly subscription of £6.99 renews on 20 November 2026.)',
    },
  ],
  priya: [
    {
      id: 'p1',
      from: 'billing@videostream.example',
      subject: 'VideoStream Plus add-on',
      date: '2026-10-21',
      body: 'Your VideoStream Plus add-on (£5.99/month) renews on 21 November 2026. You can remove the add-on in Account settings.',
    },
  ],
};

export function sampleInbox(personaId: string): SampleEmail[] {
  return [...shared, ...(byPersona[personaId] || [])];
}

export interface ParsedReceipt {
  merchant: string;
  date: string;
  items: { name: string; qty: number; price: number; category?: string }[];
  total: number;
  paymentMethod?: string;
}

export const SAMPLE_RECEIPTS: Record<string, { image: string; label: string; parsed: ParsedReceipt }> = {
  express: {
    image: '/samples/receipt-express.png',
    label: 'Sample receipt: corner shop',
    parsed: {
      merchant: 'QuickStop Express',
      date: '2026-11-06',
      items: [
        { name: 'Semi-skimmed milk 4pt', qty: 1, price: 1.95, category: 'groceries' },
        { name: 'White bread 800g', qty: 1, price: 1.45, category: 'groceries' },
        { name: 'Free range eggs x6', qty: 1, price: 2.35, category: 'groceries' },
        { name: 'Bananas x5', qty: 1, price: 1.25, category: 'groceries' },
        { name: 'Pasta 500g', qty: 2, price: 2.3, category: 'groceries' },
        { name: 'Washing up liquid', qty: 1, price: 1.85, category: 'household' },
      ],
      total: 11.15,
      paymentMethod: 'Card',
    },
  },
  budget: {
    image: '/samples/receipt-budget.png',
    label: 'Sample receipt: supermarket',
    parsed: {
      merchant: 'BudgetMart',
      date: '2026-11-05',
      items: [
        { name: 'Semi-skimmed milk 4pt', qty: 1, price: 1.55, category: 'groceries' },
        { name: 'Pasta 500g', qty: 2, price: 1.5, category: 'groceries' },
        { name: 'Chicken breast 1kg', qty: 1, price: 5.49, category: 'groceries' },
        { name: 'Basmati rice 1kg', qty: 1, price: 1.39, category: 'groceries' },
        { name: 'Chopped tomatoes 4pk', qty: 1, price: 1.4, category: 'groceries' },
        { name: 'Cheddar 400g', qty: 1, price: 2.89, category: 'groceries' },
        { name: 'Apples x6', qty: 1, price: 1.29, category: 'groceries' },
        { name: 'Nappies size 4', qty: 1, price: 3.95, category: 'baby' },
        { name: 'Toilet roll 9pk', qty: 1, price: 3.49, category: 'household' },
      ],
      total: 22.95,
      paymentMethod: 'Card',
    },
  },
};
