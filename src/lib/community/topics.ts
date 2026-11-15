// Community Financial Pulse: the money topics we look for in community posts, and the plain-code
// rules that tag a post with them. No AI here: tagging and counting are done by code.
import type { Group } from '../engine/understand';

export interface Topic {
  id: string;
  label: string;
  /** Reddit search query (Reddit supports OR). */
  query: string;
  /** A post belongs to the topic when its title or text matches. */
  match: RegExp;
  /** Problem ids (engine/detect.ts) that make this topic relevant. 'bnpl' also matches 'bnpl-KLARNA…'. */
  problems: string[];
  /** Groups (engine/understand.ts) that make this topic relevant to the user. */
  groups: Group['id'][];
  /** Official, free help for this topic. */
  help: { name: string; url: string };
}

export const TOPICS: Topic[] = [
  {
    id: 'rent',
    label: 'Rent and housing',
    query: 'rent increase OR rent arrears OR landlord rent OR housing costs',
    match: /\brent(?:s|ed|al|ing)?\b|\blandlord\b|\btenan(?:t|cy)\b|\bevict(?:ion|ed)?\b|\bhousing (?:cost|benefit)/i,
    problems: ['essentials'],
    groups: ['stretched'],
    help: { name: 'Shelter: rent and housing advice', url: 'https://england.shelter.org.uk/housing_advice' },
  },
  {
    id: 'energy',
    label: 'Energy bills',
    query: 'energy bill OR prepayment meter OR gas and electric OR energy debt',
    match: /\benergy bills?\b|\bprepay(?:ment)? meter\b|\bgas (?:and|&) electric(?:ity)?\b|\belectric(?:ity)? bill\b|\bheating\b|\bprice cap\b/i,
    problems: ['ppm'],
    groups: ['stretched'],
    help: { name: 'Ofgem: help with energy bills', url: 'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/getting-help-if-you-cant-afford-your-energy-bills' },
  },
  {
    id: 'food',
    label: 'Food and groceries',
    query: 'food shopping budget OR grocery prices OR food bank OR weekly shop',
    match: /\bfood ?bank\b|\bgrocer(?:y|ies)\b|\bfood (?:shop|budget|prices?|costs?)\b|\bweekly shop\b|\bsupermarket\b|\baldi\b|\blidl\b/i,
    problems: ['convenience', 'essentials'],
    groups: ['stretched'],
    help: { name: 'Trussell: find a food bank', url: 'https://www.trussell.org.uk/emergency-food/find-a-food-bank' },
  },
  {
    id: 'debt',
    label: 'Debt and borrowing',
    query: 'credit card debt OR overdraft OR buy now pay later OR debt collector OR payday loan',
    match: /\bdebts?\b|\boverdra(?:ft|wn)\b|\bcredit cards?\b|\bbuy now,? pay later\b|\bbnpl\b|\bklarna\b|\bclearpay\b|\bpayday loans?\b|\bdebt collect|\bbailiffs?\b|\bdefault(?:ed)?\b/i,
    problems: ['hcc', 'bnpl', 'fee-od', 'fee-late', 'fee-unpaid'],
    groups: ['catching_up'],
    help: { name: 'StepChange: free debt advice', url: 'https://www.stepchange.org' },
  },
  {
    id: 'unexpected',
    label: 'Unexpected costs',
    query: 'emergency fund OR unexpected bill OR car repair cost OR boiler broke',
    match: /\bemergency (?:fund|savings)\b|\bunexpected (?:bill|cost|expense)s?\b|\bcar (?:repair|broke|garage)|\bboiler (?:broke|repair|replacement)|\brainy day\b|\bno savings\b/i,
    problems: ['buffer'],
    groups: ['stretched', 'juggler'],
    help: { name: 'MoneyHelper: building an emergency fund', url: 'https://www.moneyhelper.org.uk/en/savings/how-to-save/building-an-emergency-savings-fund' },
  },
  {
    id: 'benefits',
    label: 'Benefits and support',
    query: 'universal credit OR benefits claim OR PIP claim OR council tax reduction',
    match: /\buniversal credit\b|\b(?:uc|pip|esa|jsa)\b|\bbenefits?\b|\bcouncil tax (?:reduction|support)\b|\bhealthy start\b|\bwarm home discount\b|\bhardship fund\b/i,
    problems: [],
    groups: ['stretched', 'newcomer'],
    help: { name: 'Turn2us: benefits calculator', url: 'https://benefits-calculator.turn2us.org.uk' },
  },
  {
    id: 'income',
    label: 'Job loss and unsteady pay',
    query: 'made redundant OR lost my job OR zero hours contract OR hours cut',
    match: /\bredundan(?:t|cy)\b|\blost (?:my|our) jobs?\b|\bzero[- ]hours?\b|\bhours (?:cut|reduced)\b|\blaid off\b|\bunemployed\b|\bgig (?:work|economy)\b/i,
    problems: [],
    groups: ['juggler'],
    help: { name: 'GOV.UK: help if you lose your job', url: 'https://www.gov.uk/browse/working/finding-job' },
  },
  {
    id: 'tax',
    label: 'Council tax and tax bills',
    query: 'council tax arrears OR self assessment bill OR HMRC payment plan OR student council tax',
    match: /\bcouncil tax\b|\bself[- ]assessment\b|\bhmrc\b|\btax bill\b|\bpayments? on account\b|\btime to pay\b/i,
    problems: ['tax', 'ct-student'],
    groups: ['lump_sum'],
    help: { name: 'GOV.UK: if you can’t pay your tax bill', url: 'https://www.gov.uk/difficulties-paying-hmrc' },
  },
  {
    id: 'fees',
    label: 'Bank fees and cash',
    query: 'cash machine fee OR bank charges OR money transfer fee OR unpaid item fee',
    match: /\b(?:atm|cash machine) fees?\b|\bbank charges?\b|\b(?:money )?transfer fees?\b|\bunpaid item\b|\breturned payment\b|\blate (?:payment )?fees?\b/i,
    problems: ['fee-atm', 'fee-fx', 'fee-cashout', 'fee-od', 'fee-unpaid', 'fee-late'],
    groups: ['newcomer', 'catching_up'],
    help: { name: 'Citizens Advice: bank charges', url: 'https://www.citizensadvice.org.uk/debt-and-money/banking/bank-accounts/' },
  },
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);

/** Topic ids a piece of text belongs to, in TOPICS order. */
export function classify(text: string): string[] {
  return TOPICS.filter((t) => t.match.test(text)).map((t) => t.id);
}

const SEVERITY = { high: 3, medium: 2, low: 1 } as const;

/** Topics most relevant to this user: their most serious matching problem first, then their groups. */
export function topicsForUser(problems: { id: string; severity: keyof typeof SEVERITY }[], groupIds: string[]): string[] {
  const g = new Set(groupIds);
  return TOPICS.map((t) => {
    const worst = Math.max(0, ...problems.filter((p) => t.problems.some((x) => p.id === x || p.id.startsWith(`${x}-`))).map((p) => SEVERITY[p.severity]));
    return { id: t.id, score: worst * 2 + t.groups.filter((x) => g.has(x)).length };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

// ---- Privacy: remove details that could identify someone before anything is stored or shown ----
const REDACT: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/(?:\+44\s?|\b0)\d(?:[\s-]?\d){8,10}\b/g, '[phone]'],
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, '[postcode]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[number]'],
  [/\bu\/[\w-]+/g, '[user]'],
  [/https?:\/\/\S+/g, '[link]'],
];

export function cleanText(text: string, max: number): string {
  let s = text.replace(/\s+/g, ' ').trim();
  for (const [re, to] of REDACT) s = s.replace(re, to);
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// ---- The shapes shared by the API and the page ----
export interface PulsePost {
  id: string;
  title: string;
  text: string;
  /** e.g. r/UKPersonalFinance */
  community: string;
  /** Reddit username without the u/ prefix; null for samples. */
  author: string | null;
  url: string | null;
  date: string; // YYYY-MM-DD, used for monthly counts
  /** Full posting time (ISO), when known. */
  postedAt: string | null;
  /** Upvotes and reply count: only the official API gives these. */
  score: number | null;
  comments: number | null;
  topics: string[];
  /** Up to 3 top replies, cleaned. */
  replies: PulseReply[];
}

export interface PulseReply {
  author: string | null;
  text: string;
}

export interface TopicStat {
  id: string;
  label: string;
  posts: number;
  /** Share of all collected posts that mention this topic (0-100). */
  share: number;
  /** Posts in the last 30 days minus the 30 days before. */
  change30: number;
}

export interface Pulse {
  total: number;
  topics: TopicStat[];
  /** Posts per topic per month, oldest month first. */
  months: { month: string; counts: Record<string, number> }[];
}

const monthKey = (date: string) => date.slice(0, 7);

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Counts by topic and month. Done by code, so the numbers on screen are exact counts of the posts shown. */
export function buildPulse(posts: PulsePost[], today: string, monthsBack = 6): Pulse {
  const total = posts.length;
  const topics: TopicStat[] = TOPICS.map((t) => {
    const mine = posts.filter((p) => p.topics.includes(t.id));
    const recent = mine.filter((p) => daysBetween(p.date, today) >= 0 && daysBetween(p.date, today) < 30).length;
    const before = mine.filter((p) => daysBetween(p.date, today) >= 30 && daysBetween(p.date, today) < 60).length;
    return { id: t.id, label: t.label, posts: mine.length, share: total ? Math.round((mine.length / total) * 100) : 0, change30: recent - before };
  })
    .filter((t) => t.posts > 0)
    .sort((a, b) => b.posts - a.posts);

  const [y, m] = today.split('-').map(Number);
  const months: Pulse['months'] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const counts: Record<string, number> = {};
    for (const t of TOPICS) counts[t.id] = posts.filter((p) => monthKey(p.date) === key && p.topics.includes(t.id)).length;
    months.push({ month: key, counts });
  }
  return { total, topics, months };
}
