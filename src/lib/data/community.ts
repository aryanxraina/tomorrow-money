// Sample community posts for Community Financial Pulse, used when Reddit isn't connected or in
// on-device mode. Every post is made up for the demo and is labelled as a sample in the UI.
import { addDays, TODAY } from '../engine/dates';
import { classify, type PulsePost } from '../community/topics';

const RAW: { ago: number; title: string; text: string; score: number; comments: number; replies?: string[] }[] = [
  { ago: 2, title: 'Prepayment meter eating £15 a week and it’s not even cold yet', text: 'Single parent, two kids. Is it worth asking to switch to a normal meter? I owe a bit of debt on it.', score: 84, comments: 41, replies: ['Ask your supplier about the Warm Home Discount first, then ask for a smart meter in credit mode.', 'I switched last year after paying the debt off over 6 months. Standing charges were lower.'] },
  { ago: 4, title: 'Council tax reduction while working, has anyone been accepted?', text: 'I work 25 hours and get some Universal Credit. Didn’t realise I could apply until a friend told me.', score: 52, comments: 23, replies: ['Yes, took about 3 weeks. Have your UC statement ready.'] },
  { ago: 5, title: 'Rent going up £75 a month in January', text: 'Landlord sent the notice today. Already spending most of my wages on rent and bills.', score: 120, comments: 66, replies: ['Check the notice is valid. Shelter has a page on rent increases.', 'You can challenge it at a tribunal if it’s above local market rent.'] },
  { ago: 7, title: 'Car repair quote £400 and I have no savings', text: 'Need the car for work. Garage wants it all up front. Thinking of putting it on a credit card.', score: 38, comments: 29, replies: ['Ask if they’ll split it over two paydays, many garages do.'] },
  { ago: 9, title: 'Weekly food shop for 3 under £50, what’s your list?', text: 'Trying to stop going to the express shop every day. Moved my main shop to Aldi.', score: 210, comments: 88, replies: ['Batch cook on Sunday. Frozen veg is cheaper and lasts.', 'Yellow sticker shopping after 7pm saves me about £10 a week.'] },
  { ago: 11, title: 'Zero hours contract, hours cut again this month', text: 'Got 12 hours this week instead of 30. How do people budget when pay changes every week?', score: 47, comments: 31, replies: ['Pay yourself a fixed amount from a separate pot in good weeks.'] },
  { ago: 13, title: 'Overdraft fees every month, how do I get out of this cycle?', text: 'I go into my overdraft a few days before payday every month and pay about £20 in interest.', score: 66, comments: 34, replies: ['Ask the bank for a repayment plan. Some will freeze interest if you ask.'] },
  { ago: 16, title: 'Self assessment bill in January, I haven’t saved for it', text: 'First year as a delivery rider. Estimated bill is around £1,700 and I have about £300.', score: 73, comments: 40, replies: ['HMRC Time to Pay is easy to set up online if you owe under £30k.'] },
  { ago: 19, title: 'Paying ATM fees every week for cash', text: 'I get paid partly in cash and send money home. The machine near me charges £1.99.', score: 22, comments: 12, replies: ['Post Office counters let you take cash from most bank accounts for free.'] },
  { ago: 22, title: 'Student, being charged council tax, is that right?', text: 'I live with other full-time students. The council has sent a bill for the year.', score: 31, comments: 15, replies: ['Full-time students are exempt. Send them your student certificate and ask for a refund.'] },
  { ago: 27, title: 'Food bank for the first time, felt embarrassed', text: 'Got a voucher from my GP. Everyone was kind. Just wanted to say it’s okay to ask.', score: 340, comments: 52 },
  { ago: 31, title: 'Universal Credit deductions for an advance, any way to reduce?', text: 'They’re taking back a lot each month for the advance I took when I started.', score: 44, comments: 19, replies: ['You can ask to reduce the deduction if it causes hardship.'] },
  { ago: 36, title: 'Boiler broke and the landlord is slow to fix it', text: 'Using electric heaters and worried about the electricity bill.', score: 58, comments: 27 },
  { ago: 41, title: 'Buy now pay later, I have 5 plans running', text: 'Missed one payment and got a late fee. How do I track them all?', score: 49, comments: 30, replies: ['Put every due date in your calendar the day after payday.'] },
  { ago: 47, title: 'Energy price cap going up, how are you preparing?', text: 'Trying to work out what our bill will be in winter.', score: 95, comments: 61 },
  { ago: 55, title: 'Made redundant, what should I do first?', text: 'Got my notice today. Have about a month of savings.', score: 130, comments: 74, replies: ['Claim Universal Credit straight away, don’t wait for the money to run out.'] },
  { ago: 63, title: 'Money transfer fees adding up', text: 'Sending £200 home every month. Fees plus the rate cost me about £12.', score: 18, comments: 9 },
  { ago: 70, title: 'Rent arrears letter, panicking', text: 'Two months behind after my hours were cut.', score: 77, comments: 45, replies: ['Talk to the landlord and a free adviser now. Shelter and Citizens Advice can help.'] },
  { ago: 78, title: 'Grocery prices are up again, cheapest swaps?', text: 'Our weekly shop has gone from £60 to £75 this year.', score: 160, comments: 90 },
  { ago: 86, title: 'Healthy Start card, does it help?', text: 'Pregnant and on a low income. Is it worth applying?', score: 26, comments: 11, replies: ['Yes, it adds money for milk, fruit and veg every week.'] },
  { ago: 95, title: 'Credit card at 34%, balance transfer or pay down?', text: 'About £2,000 on the card. Minimum payments barely touch it.', score: 61, comments: 38 },
  { ago: 104, title: 'Emergency fund, how much do you keep?', text: 'Starting from zero. Aiming for £500 first.', score: 88, comments: 57 },
  { ago: 116, title: 'Council tax arrears, the whole year is now due', text: 'Missed two instalments and the council wants the full amount.', score: 40, comments: 22, replies: ['Call them and ask to go back on instalments. Many councils agree.'] },
  { ago: 128, title: 'Gig work, how do you budget with unsteady pay?', text: 'Some weeks £500, some weeks £150.', score: 54, comments: 33 },
  { ago: 141, title: 'Rent takes 60% of my income', text: 'Is this normal now? Looking at moving further out.', score: 102, comments: 70 },
  { ago: 152, title: 'Prepayment meter debt, supplier taking a lot each top up', text: 'Half of each top up goes to old debt.', score: 35, comments: 18 },
  { ago: 165, title: 'PIP claim taking months', text: 'Struggling with bills while I wait.', score: 29, comments: 16 },
  { ago: 176, title: 'Unpaid item fees from my bank', text: 'Three direct debits bounced and each one cost me.', score: 24, comments: 14 },
];

export const SAMPLE_COMMUNITY_POSTS: PulsePost[] = RAW.map((p, i) => ({
  id: `sample-${i + 1}`,
  title: p.title,
  text: p.text,
  community: 'Sample community',
  author: null,
  url: null,
  date: addDays(TODAY, -p.ago),
  postedAt: null,
  score: p.score,
  comments: p.comments,
  topics: classify(`${p.title}\n${p.text}`),
  replies: (p.replies ?? []).map((text) => ({ author: null, text })),
}));
