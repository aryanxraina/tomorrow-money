// Finds subscriptions in real emails with plain code. No model reads these emails, so a message
// can't talk the app into anything, and every amount and date comes straight from the text.
// Anything the code isn't sure about is flagged and left unticked for the person to check.
import { addDays, addMonths, diffDays, niceDate } from './dates';

export interface EmailInput {
  id: string;
  from: string;
  subject: string;
  date: string; // YYYY-MM-DD
  body: string;
}

export type SubStatus = 'active' | 'trial' | 'price_rise' | 'cancelled';
export type SubCycle = 'monthly' | 'yearly' | 'weekly';
export type Currency = 'GBP' | 'USD' | 'EUR';

export interface FoundSub {
  id: string;
  service: string;
  amount: number;
  currency: Currency;
  cycle: SubCycle;
  nextDate: string | null;
  dateEstimated: boolean;
  status: SubStatus;
  note: string;
  /** Reasons to double-check this one. If there are any, it starts unticked. */
  needsCheck: string[];
  evidence: { from: string; subject: string; date: string; quote: string };
}

const CANCELLED =
  /\b(?:subscription|membership|plan|trial)\b[^.]{0,60}\b(?:has been|was|is now|been)\s+(?:cancell?ed|terminated|ended)\b|\byou(?:'|’)?ve cancell?ed\b|\bcancell?ation (?:is )?confirmed\b|\bconfirm(?:ing|ation of)?\s+(?:your )?cancell?ation\b|\bsorry to see you go\b/i;
const TRIAL = /\btrial\b[^.]{0,40}\b(?:ends?|ending|expires?|expiring|is over|finish(?:es)?)\b|\bend of your (?:free )?trial\b/i;
const PRICE_RISE = /\bprice\b[^.]{0,30}\b(?:increase|increasing|change|changing|going up|rise|update)\b|\b(?:will|is going to) (?:now )?cost\b|\bnew price\b/i;
const RENEWAL =
  /\bwill (?:auto(?:matically)?[- ]?)?renew|\bauto(?:matically)?[- ]?renew|\brenews?\s+(?:on|automatically)\b|\b(?:has |was |been )?renewed\b|\brenewal\b|\bnext (?:payment|billing|charge|bill|invoice)\b|\bwill be (?:charged|billed|taken)\b|\bbilling (?:date|period|cycle)\b|\b(?:subscription|membership)\b[^.]{0,80}\b(?:receipt|invoice|payment|charged|billed|paid)\b|\b(?:receipt|invoice|payment|charged|billed)\b[^.]{0,80}\b(?:subscription|membership|(?:monthly|annual|yearly) plan)\b|\b(?:monthly|annual|yearly) (?:subscription|membership)\b/i;
const PERSONAL =
  /\byour (?:next (?:payment|bill|charge|billing)|(?:\w+ ){0,3}(?:subscription|membership|plan) (?:renews|renewed|will|has|of)|(?:\w+ ){0,3}trial (?:ends|expires|is))|\bwe (?:charged|billed)\b|\byou(?:'|’)?ve been (?:charged|billed)\b/i;
const ONE_OFF = /\b(?:order|shipped|dispatched|delivery|on its way|tracking number|parcel|booking|flight|ticket)\b/i;
const MARKETING = /\b(?:subscribe (?:now|today)|start your (?:free )?trial|try (?:it |us )?(?:for )?free|sign up|join (?:now|today)|upgrade (?:now|today)|\d+% off|offer ends|limited[- ]time|last chance|black friday)\b/i;

const MONEY = /(£|\$|€|GBP|USD|EUR)\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)|(\d+\.\d{2})\s?(GBP|USD|EUR)\b/gi;
const CURRENCY: Record<string, Currency> = { '£': 'GBP', $: 'USD', '€': 'EUR', GBP: 'GBP', USD: 'USD', EUR: 'EUR' };
const CYCLE_AFTER = /^\s*(?:\/|per |a |an |each |every )\s*(?:mo\b|month|yr\b|year|annum|week)|^\s*(?:monthly|annually|yearly|weekly)\b/i;
const GOOD_BEFORE = /(?:total|charged|amount|renew\w*|cost|billed|next payment\w*|payment|then|price|to|at|for|of)\W*(?:of|is|at|for)?\W*$/i;
const BAD_BEFORE = /(?:currently|was|previously|from|old price|saved?|discount|credit|refund|vat|tax|sub\s?total)\W*(?:of|is)?\W*$/i;
const BAD_AFTER = /^\s*(?:off\b|discount|credit|vat\b|tax\b|refund|saving|cheaper|voucher)/i;

interface Amount {
  value: number;
  currency: Currency;
  start: number;
  end: number;
}

/** Picks the amount that is the price of the plan, not a discount, an old price or tax. */
function readAmount(text: string): Amount | null {
  let best: (Amount & { score: number }) | null = null;
  for (const m of text.matchAll(MONEY)) {
    const value = Number((m[2] || m[3]).replace(/,/g, ''));
    if (!(value > 0)) continue;
    const start = m.index;
    const end = start + m[0].length;
    const before = text.slice(Math.max(0, start - 45), start);
    const after = text.slice(end, end + 30);
    let score = 0;
    if (CYCLE_AFTER.test(after)) score += 3;
    if (GOOD_BEFORE.test(before)) score += 2;
    if (BAD_BEFORE.test(before)) score -= 4;
    if (BAD_AFTER.test(after)) score -= 4;
    if (!best || score > best.score) best = { value, currency: CURRENCY[(m[1] || m[4]).toUpperCase()], start, end, score };
  }
  return best && best.score >= 0 ? best : null;
}

const MONTH_NAMES = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAMES})\\b\\.?(?:,?\\s+(\\d{4})\\b)?`, 'gi');
const MONTH_FIRST = new RegExp(`\\b(${MONTH_NAMES})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4})\\b)?`, 'gi');
const NUMERIC = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})\b/g;
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const monthIndex = (name: string) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(name.slice(0, 3).toLowerCase()) + 1;

function isoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Every date in the text, with where it was found. Numeric dates are read UK style, day first. */
function readDates(text: string, emailDate: string): { date: string; at: number }[] {
  const out: { date: string; at: number }[] = [];
  const emailYear = Number(emailDate.slice(0, 4));
  const push = (y: number | null, m: number, d: number, at: number) => {
    let date = isoDate(y ?? emailYear, m, d);
    // No year written, and it would be long before the email: it means next year.
    if (date && y === null && diffDays(date, emailDate) < -180) date = isoDate(emailYear + 1, m, d);
    if (date) out.push({ date, at });
  };
  for (const m of text.matchAll(DAY_FIRST)) push(m[3] ? Number(m[3]) : null, monthIndex(m[2]), Number(m[1]), m.index);
  for (const m of text.matchAll(MONTH_FIRST)) push(m[3] ? Number(m[3]) : null, monthIndex(m[1]), Number(m[2]), m.index);
  for (const m of text.matchAll(NUMERIC)) push(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]), m.index);
  for (const m of text.matchAll(ISO)) push(Number(m[1]), Number(m[2]), Number(m[3]), m.index);
  return out;
}

const NEXT_WORDS = /\b(?:renew\w*|next (?:payment|billing|charge|bill)\w*|trial|ends?|expires?|from|starting|effective|billing date|will be (?:charged|billed|taken)|due)\b/i;

/** The date the next payment falls on, if the email says so. */
function readNextDate(text: string, emailDate: string): { date: string; stated: boolean } | null {
  const later = readDates(text, emailDate).filter((d) => d.date > emailDate);
  if (!later.length) return null;
  const stated = later.filter((d) => NEXT_WORDS.test(text.slice(Math.max(0, d.at - 70), d.at)));
  const pool = stated.length ? stated : later;
  const date = pool.map((d) => d.date).sort()[0];
  return { date, stated: stated.length > 0 };
}

function readCycle(text: string, amount: Amount | null, next: string | null, emailDate: string): { cycle: SubCycle; assumed: boolean } {
  const near = amount ? text.slice(Math.max(0, amount.start - 45), amount.end + 30) : '';
  const yearly = /\b(?:per year|a year|every year|annual(?:ly)?|yearly|per annum|12[- ]months?)\b|\/\s?yr\b|\/\s?year\b/i;
  const weekly = /\b(?:per week|a week|every week|weekly)\b|\/\s?(?:wk|week)\b/i;
  const monthly = /\b(?:per month|a month|every month|monthly)\b|\/\s?(?:mo|month)\b/i;
  for (const source of [near, text]) {
    if (yearly.test(source)) return { cycle: 'yearly', assumed: false };
    if (monthly.test(source)) return { cycle: 'monthly', assumed: false };
    if (weekly.test(source)) return { cycle: 'weekly', assumed: false };
  }
  // No wording, so the gap between this email and the next payment is the clue.
  if (next) {
    const gap = diffDays(next, emailDate);
    if (gap >= 25 && gap <= 35) return { cycle: 'monthly', assumed: false };
    if (gap >= 350 && gap <= 380) return { cycle: 'yearly', assumed: false };
    if (gap >= 6 && gap <= 8) return { cycle: 'weekly', assumed: false };
  }
  return { cycle: 'monthly', assumed: true };
}

const GENERIC_NAME = /^(?:no-?reply|do-?not-?reply|billing|team|support|hello|hi|info|mail|email|receipts?|payments?|accounts?|customer (?:service|care|support)|notifications?|news|updates?|members?|orders?|the team)$/i;
const NAME_SUFFIX = /\s+(?:billing|support|team|receipts?|payments?|accounts?|customer (?:service|care|support)|notifications?|updates?|uk|ltd|limited|inc\.?|llc|plc)$/i;
const TWO_PART_TLD = /^(?:co|org|ac|gov|me|net|com)\.(?:uk|au|nz|in|jp|za)$/i;
// These send receipts for many different things, so one sender can be more than one subscription.
const PLATFORM = /^(?:apple|google|paypal|amazon|microsoft)$/i;

function readSender(from: string): { name: string; domainName: string } {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = (address.split('@')[1] ?? '').trim().toLowerCase().replace(/>$/, '');
  const labels = domain.split('.').filter(Boolean);
  const take = labels.length >= 3 && TWO_PART_TLD.test(labels.slice(-2).join('.')) ? 3 : 2;
  const domainName = labels.slice(-take)[0] ?? '';
  let display = from.includes('<') ? from.slice(0, from.indexOf('<')).replace(/["']/g, '').trim() : '';
  display = display.replace(/\s+via\s+.*$/i, '');
  for (let i = 0; i < 3; i++) display = display.replace(NAME_SUFFIX, '').trim();
  const pretty = domainName.replace(/^\w/, (c) => c.toUpperCase());
  const name = display && /[a-z]/i.test(display) && !GENERIC_NAME.test(display) ? display : pretty || 'Unknown sender';
  return { name, domainName };
}

function rollForward(from: string, cycle: SubCycle, today: string): string {
  let date = from;
  for (let i = 1; date < today && i < 600; i++) {
    date = cycle === 'yearly' ? addMonths(from, 12 * i) : cycle === 'weekly' ? addDays(from, 7 * i) : addMonths(from, i);
  }
  return date;
}

export const moneyText = (amount: number, currency: Currency) => `${{ GBP: '£', USD: '$', EUR: '€' }[currency]}${amount.toFixed(2)}`;
const cycleWord = (c: SubCycle) => ({ monthly: 'a month', yearly: 'a year', weekly: 'a week' })[c];

type Read = FoundSub & { key: string; emailDate: string };

function readEmail(e: EmailInput, today: string): Read | 'possible' | null {
  const text = `${e.subject}. ${e.body}`.replace(/\s+/g, ' ').slice(0, 20000);
  const cancelled = CANCELLED.test(text);
  const trial = TRIAL.test(text);
  const rise = PRICE_RISE.test(text);
  const renewal = RENEWAL.test(text);
  if (!cancelled && !trial && !rise && !renewal) return null;

  const personal = PERSONAL.test(text);
  if (ONE_OFF.test(text) && !/subscri|membership|renew/i.test(text)) return null;
  if (MARKETING.test(text) && !personal) return null;
  if (rise && !renewal && !trial && !/\byour\b[^.]{0,40}\b(?:plan|subscription|membership|price)\b/i.test(text)) return null;

  const amount = readAmount(text);
  if (!amount && !cancelled) return personal ? 'possible' : null;

  const next = cancelled ? null : readNextDate(text, e.date);
  const { cycle, assumed } = readCycle(text, amount, next?.date ?? null, e.date);
  const sender = readSender(e.from);
  const platform = PLATFORM.test(sender.domainName);
  const value = amount?.value ?? 0;
  const currency = amount?.currency ?? 'GBP';
  const price = moneyText(value, currency);

  let status: SubStatus = cancelled ? 'cancelled' : trial ? 'trial' : rise ? 'price_rise' : 'active';
  let nextDate = next?.date ?? null;
  let dateEstimated = !next?.stated;
  let note: string;
  const needsCheck: string[] = [];

  if (status === 'cancelled') {
    nextDate = null;
    dateEstimated = false;
    note = `Cancelled, according to an email on ${niceDate(e.date)}.`;
  } else {
    if (status === 'trial' && nextDate && nextDate < today) {
      note = `Free trial ended ${niceDate(nextDate)}, so this is probably ${price} ${cycleWord(cycle)} now.`;
      status = 'active';
    } else if (status === 'trial') {
      note = nextDate ? `Free trial ends ${niceDate(nextDate)}, then ${price} ${cycleWord(cycle)}.` : `Free trial, then ${price} ${cycleWord(cycle)}.`;
    } else if (status === 'price_rise') {
      note = nextDate ? `Price going up to ${price} from ${niceDate(nextDate)}.` : `Price going up to ${price}.`;
    } else {
      note = `${price} ${cycleWord(cycle)}.`;
    }
    // Work out the next payment from the last known one when the email's date has passed or is missing.
    const base = nextDate ?? e.date;
    const rolled = rollForward(nextDate ?? rollForward(base, cycle, addDays(e.date, 1)), cycle, today);
    if (rolled !== nextDate) dateEstimated = true;
    nextDate = rolled;
  }

  if (currency !== 'GBP') needsCheck.push(`This is in ${currency}. The app only forecasts pounds and won’t guess an exchange rate, so it can’t be added.`);
  if (status !== 'cancelled') {
    if (assumed) needsCheck.push('The email doesn’t say how often this is paid. We assumed monthly.');
    const age = diffDays(today, e.date);
    const quiet = cycle === 'yearly' ? 400 : cycle === 'weekly' ? 21 : 62;
    if (age > quiet && !(next && next.date >= today)) needsCheck.push(`The latest email is ${age} days old, so this may have stopped.`);
  }

  const quoteAt = amount?.start ?? Math.max(0, text.search(CANCELLED));
  const quote = text.slice(Math.max(0, quoteAt - 70), quoteAt + 90).trim();
  return {
    key: `${sender.domainName}${platform ? `|${value}` : ''}`,
    emailDate: e.date,
    id: `${sender.domainName}-${e.id}`,
    service: sender.name,
    amount: value,
    currency,
    cycle,
    nextDate,
    dateEstimated,
    status,
    note,
    needsCheck,
    evidence: { from: e.from, subject: e.subject, date: e.date, quote },
  };
}

/** Finds subscriptions, keeping only the newest email per service, so a later cancellation wins. */
export function extractSubscriptions(emails: EmailInput[], today: string): { found: FoundSub[]; possible: number } {
  const newest = new Map<string, Read>();
  let possible = 0;
  for (const e of emails) {
    const r = readEmail(e, today);
    if (r === 'possible') possible++;
    if (!r || r === 'possible') continue;
    const current = newest.get(r.key);
    if (!current || r.emailDate > current.emailDate) newest.set(r.key, r);
  }
  const rank: Record<SubStatus, number> = { trial: 0, price_rise: 1, active: 2, cancelled: 3 };
  const found: FoundSub[] = [...newest.values()].sort((a, z) => rank[a.status] - rank[z.status] || (a.nextDate ?? '9').localeCompare(z.nextDate ?? '9'));
  return { found, possible };
}

/** Only pounds can go into the forecast, and a cancelled plan has no future payments. */
export const canForecast = (s: FoundSub) => s.status !== 'cancelled' && s.currency === 'GBP' && !!s.nextDate;

export const monthlyCost = (s: FoundSub) => (s.cycle === 'monthly' ? s.amount : s.cycle === 'yearly' ? s.amount / 12 : (s.amount * 52) / 12);

/** The future payments to add to the forecast, which looks 90 days ahead. */
export function billsFromSub(s: FoundSub, label: string): { label: string; date: string; amount: number }[] {
  if (!canForecast(s)) return [];
  const count = s.cycle === 'monthly' ? 4 : s.cycle === 'weekly' ? 13 : 1;
  return Array.from({ length: count }, (_, i) => ({
    label,
    date: s.cycle === 'weekly' ? addDays(s.nextDate!, 7 * i) : addMonths(s.nextDate!, i),
    amount: s.amount,
  }));
}

const ENTITIES: Record<string, string> = { pound: '£', euro: '€', nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', hellip: '…', copy: '©' };

export function htmlToText(html: string): string {
  return html
    .slice(0, 300000)
    .replace(/<(style|script|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*(?:br|\/p|\/div|\/tr|\/li|\/h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (all, dec, hex, name) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return ENTITIES[name.toLowerCase()] ?? all;
    })
    .replace(/[ \t\f\r ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
