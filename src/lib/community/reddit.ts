// Reddit source for Community Pulse. Server only.
//
// Same flow as the brand-monitoring scraper (search each term -> collect posts with author, title,
// text and time -> top comments -> filter -> tag), using the formats Reddit publishes for programs:
//   - Public RSS feeds (default, no key): /r/<sub>/search.rss and /r/<sub>/comments/<id>/.rss
//   - The official Data API, when REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are set (faster, adds upvotes).
// No browser automation: Reddit blocks automated browsers and its terms don't allow disguising one.
//
// Reddit allows very few anonymous requests per minute, so collection runs in the background,
// follows Reddit's rate-limit headers, and saves posts as it goes (.cache/reddit-pulse.json).
// The page shows whatever has been collected so far.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { classify, cleanText, TOPICS, type PulsePost, type PulseReply } from './topics';

const env = (k: string) => process.env[k]?.trim() || '';

export type RedditVia = 'api' | 'rss';

export function redditVia(): RedditVia | null {
  if (env('REDDIT_DISABLED') === '1') return null;
  return env('REDDIT_CLIENT_ID') && env('REDDIT_CLIENT_SECRET') ? 'api' : 'rss';
}

export function subreddits(): string[] {
  const list = (env('REDDIT_SUBREDDITS') || 'UKPersonalFinance,UKFrugal')
    .split(',')
    .map((s) => s.trim().replace(/^r\//i, ''))
    .filter((s) => /^\w{2,21}$/.test(s));
  return list.length ? list : ['UKPersonalFinance'];
}

/** Reddit asks for a unique, honest user agent: <platform>:<app id>:<version> (by /u/<username>). */
function userAgent() {
  const who = env('REDDIT_USERNAME');
  return `web:tomorrow-money:0.2.0${who ? ` (by /u/${who})` : ' (community money-problem trends)'}`;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Polite fetch: follows Reddit's X-Ratelimit headers and backs off on 429 ----
const limiter = { remaining: 1, resetAt: 0 };

async function politeFetch(url: string, headers: Record<string, string> = {}): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (limiter.remaining < 1 && Date.now() < limiter.resetAt) await wait(limiter.resetAt - Date.now() + 500);
    const res = await fetch(url, { headers: { 'User-Agent': userAgent(), ...headers }, signal: AbortSignal.timeout(20_000) });
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    if (Number.isFinite(remaining)) limiter.remaining = Math.floor(remaining);
    if (Number.isFinite(reset)) limiter.resetAt = Date.now() + reset * 1000;
    if (res.status !== 429) return res;
    const retry = Number(res.headers.get('retry-after')) || reset || 30;
    limiter.remaining = 0;
    limiter.resetAt = Date.now() + Math.min(retry, 120) * 1000;
    console.warn(`[reddit] rate limited, waiting ${Math.round(Math.min(retry, 120))}s`);
  }
  throw new Error('Reddit kept rate-limiting; will try again later.');
}

// ---- One shape for both sources ----
interface RawPost {
  id: string;
  title: string;
  text: string;
  author: string | null;
  community: string;
  url: string;
  postedAt: string;
  score: number | null;
  comments: number | null;
}

// ---- RSS (Atom) ----
function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Reddit's HTML body to plain text, without the "submitted by … [link] [comments]" footer. */
export function htmlToText(html: string): string {
  const body = decode(html).split(/<!-- SC_ON -->|&#32; submitted by|\s+submitted by\s+/)[0];
  return decode(
    body
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h\d|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).trim();
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '';

interface AtomEntry {
  id: string;
  author: string | null;
  community: string;
  title: string;
  html: string;
  url: string;
  postedAt: string;
}

export function parseAtom(xml: string): AtomEntry[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: tag(e, 'id'),
    author: tag(tag(e, 'author'), 'name').replace(/^\/?u\//, '') || null,
    community: e.match(/<category[^>]*label="([^"]+)"/)?.[1] ?? '',
    title: decode(decode(tag(e, 'title'))), // Reddit sometimes escapes titles twice
    html: tag(e, 'content'),
    url: decode(e.match(/<link href="([^"]+)"/)?.[1] ?? ''),
    postedAt: tag(e, 'published') || tag(e, 'updated'),
  }));
}

async function rss(pathAndQuery: string): Promise<AtomEntry[]> {
  const res = await politeFetch(`https://www.reddit.com${pathAndQuery}`);
  if (!res.ok) throw new Error(`Reddit feed ${res.status}`);
  const xml = await res.text();
  if (!xml.includes('<feed')) throw new Error('Reddit returned a page instead of a feed');
  return parseAtom(xml);
}

async function searchRss(subs: string, query: string): Promise<RawPost[]> {
  const q = new URLSearchParams({ q: query, restrict_sr: 'on', sort: 'relevance', t: 'year', limit: '25' });
  return (await rss(`/r/${subs}/search.rss?${q}`))
    .filter((e) => e.id.startsWith('t3_'))
    .map((e) => ({ id: e.id.slice(3), title: e.title, text: htmlToText(e.html), author: e.author, community: e.community, url: e.url, postedAt: e.postedAt, score: null, comments: null }));
}

async function repliesRss(post: RawPost): Promise<PulseReply[]> {
  const q = new URLSearchParams({ limit: '8', sort: 'top', depth: '1' });
  const entries = await rss(`/r/${post.community.replace(/^r\//, '')}/comments/${post.id}/.rss?${q}`);
  return entries
    .filter((e) => e.id.startsWith('t1_'))
    .map((e) => ({ author: e.author, text: htmlToText(e.html) }))
    .filter((r) => r.text && r.text !== '[removed]' && r.text !== '[deleted]' && !/bot|helper|automoderator/i.test(r.author ?? ''))
    .slice(0, 3)
    .map((r) => ({ author: r.author, text: cleanText(r.text, 300) }));
}

// ---- Official Data API (OAuth, application-only) ----
let token: { value: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (token && Date.now() < token.expires - 60_000) return token.value;
  const basic = Buffer.from(`${env('REDDIT_CLIENT_ID')}:${env('REDDIT_CLIENT_SECRET')}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent() },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Reddit sign-in failed (${res.status}). Check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!j.access_token) throw new Error(`Reddit sign-in failed: ${j.error || 'no token'}`);
  token = { value: j.access_token, expires: Date.now() + (j.expires_in || 3600) * 1000 };
  return token.value;
}

async function api<T>(pathAndQuery: string): Promise<T> {
  const res = await politeFetch(`https://oauth.reddit.com${pathAndQuery}`, { Authorization: `Bearer ${await getToken()}` });
  if (res.status === 401) token = null;
  if (!res.ok) throw new Error(`Reddit ${res.status} on ${pathAndQuery.split('?')[0]}`);
  return (await res.json()) as T;
}

interface ApiPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit_name_prefixed: string;
  permalink: string;
  created_utc: number;
  score: number;
  num_comments: number;
  over_18: boolean;
  stickied: boolean;
  removed_by_category?: string | null;
}
interface Listing<T> {
  data: { children: { kind: string; data: T }[] };
}

async function searchApi(subs: string, query: string): Promise<RawPost[]> {
  const q = new URLSearchParams({ q: query, restrict_sr: '1', sort: 'relevance', t: 'year', limit: '40', raw_json: '1', type: 'link' });
  const listing = await api<Listing<ApiPost>>(`/r/${subs}/search?${q}`);
  return listing.data.children
    .filter((c) => c.kind === 't3' && !c.data.over_18 && !c.data.stickied && !c.data.removed_by_category)
    .map(({ data: p }) => ({
      id: p.id,
      title: p.title,
      text: p.selftext,
      author: p.author && p.author !== '[deleted]' ? p.author : null,
      community: p.subreddit_name_prefixed,
      url: `https://www.reddit.com${p.permalink}`,
      postedAt: new Date(p.created_utc * 1000).toISOString(),
      score: p.score,
      comments: p.num_comments,
    }));
}

async function repliesApi(post: RawPost): Promise<PulseReply[]> {
  const q = new URLSearchParams({ limit: '8', depth: '1', sort: 'top', raw_json: '1' });
  const [, comments] = await api<[unknown, Listing<{ body?: string; author?: string; stickied?: boolean; distinguished?: string | null }>]>(`/comments/${post.id}?${q}`);
  return comments.data.children
    .filter((c) => c.kind === 't1' && c.data.body && !c.data.stickied && !c.data.distinguished && c.data.body !== '[removed]' && c.data.body !== '[deleted]')
    .slice(0, 3)
    .map((c) => ({ author: c.data.author && c.data.author !== '[deleted]' ? c.data.author : null, text: cleanText(c.data.body!, 300) }));
}

// ---- Filtering and tagging (like the old scraper's ignore_terms / entity_name filters) ----
const IGNORE = /\b(?:megathread|weekly thread|daily thread|ama|survey|giveaway|referral|promo code)\b/i;

function toPulsePost(p: RawPost): PulsePost | null {
  if (IGNORE.test(p.title) || p.text === '[removed]' || p.text === '[deleted]') return null;
  const topics = classify(`${p.title}\n${p.text}`);
  if (!topics.length) return null;
  return {
    id: p.id,
    title: cleanText(p.title, 200),
    text: cleanText(p.text, 600),
    community: p.community,
    author: p.author,
    url: p.url,
    date: p.postedAt.slice(0, 10),
    postedAt: p.postedAt,
    score: p.score,
    comments: p.comments,
    topics,
    replies: [],
  };
}

// ---- Background collection with saved progress ----
export interface RedditResult {
  posts: PulsePost[];
  fetchedAt: string;
  subreddits: string[];
  via: RedditVia;
  /** False while a collection is still adding posts. */
  complete: boolean;
}

export interface Progress {
  running: boolean;
  done: number;
  total: number;
  error: string | null;
}

const CACHE_FILE = path.join(process.cwd(), '.cache', 'reddit-pulse.json');
const FRESH_MS = { api: 60 * 60 * 1000, rss: 6 * 60 * 60 * 1000 }; // how often to collect again
const REPLY_TOPICS = 5; // fetch replies for the top post of this many topics

// Kept on globalThis so dev hot-reloads don't start a second collection.
const g = globalThis as unknown as { __redditPulse?: { memory: RedditResult | null; progress: Progress; lastStart: number } };
const state = (g.__redditPulse ??= { memory: null, progress: { running: false, done: 0, total: 0, error: null }, lastStart: 0 });
const RETRY_AFTER_FAIL_MS = 5 * 60 * 1000;

export async function readCache(): Promise<RedditResult | null> {
  if (state.memory) return state.memory;
  try {
    state.memory = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')) as RedditResult;
    return state.memory;
  } catch {
    return null;
  }
}

async function save(r: RedditResult) {
  state.memory = r;
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(r));
  } catch (e) {
    console.warn('[reddit] could not save', (e as Error).message);
  }
}

async function collect(via: RedditVia) {
  const subs = subreddits();
  const multi = subs.join('+');
  const search = via === 'api' ? searchApi : searchRss;
  const replies = via === 'api' ? repliesApi : repliesRss;
  const previous = await readCache();
  const found = new Map<string, PulsePost>();
  const raw = new Map<string, RawPost>();
  const p = state.progress;
  state.lastStart = Date.now();
  Object.assign(p, { running: true, done: 0, total: TOPICS.length + REPLY_TOPICS, error: null });

  const publish = (complete: boolean) => {
    const posts = [...found.values()].sort((a, b) => (b.postedAt ?? b.date).localeCompare(a.postedAt ?? a.date));
    // Until the new run has found something, keep showing the previous result.
    if (!posts.length && previous && !complete) return Promise.resolve();
    return save({ posts, fetchedAt: new Date().toISOString(), subreddits: subs, via, complete });
  };

  try {
    // Steps 1-2: search each topic, keep matching posts.
    for (const topic of TOPICS) {
      let results: RawPost[];
      try {
        results = await search(multi, topic.query);
      } catch (e) {
        // A misspelt or private community breaks a combined search: retry with the first one only.
        if (subs.length > 1) results = await search(subs[0], topic.query);
        else throw e;
      }
      for (const r of results) {
        if (found.has(r.id)) continue;
        const post = toPulsePost(r);
        if (post) {
          found.set(r.id, post);
          raw.set(r.id, r);
        }
      }
      p.done++;
      await publish(false);
    }

    // Step 3: top replies for the most relevant post of the biggest topics.
    const counts = TOPICS.map((t) => ({ id: t.id, n: [...found.values()].filter((x) => x.topics[0] === t.id).length })).sort((a, b) => b.n - a.n);
    for (const { id } of counts.slice(0, REPLY_TOPICS)) {
      const pick = [...found.values()].find((x) => x.topics[0] === id && (x.comments ?? 1) > 0);
      if (pick) {
        try {
          found.set(pick.id, { ...pick, replies: await replies(raw.get(pick.id)!) });
        } catch (e) {
          console.warn('[reddit] replies failed', (e as Error).message);
        }
      }
      p.done++;
      await publish(false);
    }
    await publish(true);
    console.log(`[reddit] collected ${found.size} posts via ${via}`);
  } catch (e) {
    p.error = (e as Error).message;
    console.warn('[reddit] collection stopped:', p.error);
    if (found.size) await publish(true);
  } finally {
    p.running = false;
  }
}

/** Saved posts straight away; starts a background collection if they are missing or old. */
export async function getReddit(force = false): Promise<{ result: RedditResult | null; progress: Progress; via: RedditVia | null }> {
  const via = redditVia();
  const result = await readCache();
  if (via && !state.progress.running) {
    const stale = !result || result.via !== via || !result.complete || Date.now() - Date.parse(result.fetchedAt) > FRESH_MS[via];
    const coolingDown = !!state.progress.error && Date.now() - state.lastStart < RETRY_AFTER_FAIL_MS;
    if (force || (stale && !coolingDown)) void collect(via);
  }
  return { result: state.memory ?? result, progress: { ...state.progress }, via };
}
