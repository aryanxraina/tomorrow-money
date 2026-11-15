// News source for Community Pulse. Server only. Needs NEWS_API_KEY (newsapi.org).
//
// Same call as the brand-monitoring NewsAPI ingester (/v2/everything per query), limited to UK
// outlets and tagged by the same word rules as Reddit. News shows what is being reported, not
// what people say, and the page labels it that way.
// Free (Developer) plan: 100 requests a day, articles up to a month old, and for development
// only: a public launch needs a paid plan or a different source. One collection is 9 requests,
// at least 3 hours apart, so a day stays well under the limit.
import { cachedSource, decodeEntities } from './cache';
import { classify, cleanText, TOPICS, type PulsePost } from './topics';

const key = () => process.env.NEWS_API_KEY?.trim() || '';
export const newsOn = () => !!key();

const UK_DOMAINS = [
  'bbc.co.uk',
  'theguardian.com',
  'independent.co.uk',
  'inews.co.uk',
  'news.sky.com',
  'itv.com',
  'mirror.co.uk',
  'express.co.uk',
  'dailymail.co.uk',
  'thisismoney.co.uk',
  'standard.co.uk',
  'telegraph.co.uk',
  'manchestereveningnews.co.uk',
  'walesonline.co.uk',
  'liverpoolecho.co.uk',
  'birminghammail.co.uk',
].join(',');

interface Article {
  source?: { name?: string };
  title?: string;
  description?: string | null;
  url?: string;
  publishedAt?: string;
}

/** A short stable id from the article link. */
function idFor(url: string) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  return `news-${(h >>> 0).toString(36)}`;
}

async function collect(): Promise<PulsePost[]> {
  // The free plan only searches the last month.
  const from = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const found = new Map<string, PulsePost>();

  for (const topic of TOPICS) {
    // NewsAPI reads `rent increase` as rent AND increase anywhere, so phrases are quoted.
    const query = topic.query
      .split(' OR ')
      .map((t) => (t.trim().includes(' ') ? `"${t.trim()}"` : t.trim()))
      .join(' OR ');
    const q = new URLSearchParams({ q: query, language: 'en', sortBy: 'relevancy', pageSize: '30', domains: UK_DOMAINS, from });
    // The key goes in a header, so it never appears in a URL or log.
    const res = await fetch(`https://newsapi.org/v2/everything?${q}`, { headers: { 'X-Api-Key': key() }, signal: AbortSignal.timeout(15_000) });
    const j = (await res.json().catch(() => ({}))) as { status?: string; code?: string; articles?: Article[] };
    if (!res.ok || j.status !== 'ok') {
      if (j.code === 'rateLimited') throw new Error('NewsAPI’s daily limit is used up. It resets after 24 hours.');
      throw new Error(`NewsAPI ${res.status}${j.code ? ` (${j.code})` : ''}`);
    }
    for (const a of j.articles ?? []) {
      if (!a.url || !a.title || !a.publishedAt || a.title === '[Removed]') continue;
      const id = idFor(a.url);
      if (found.has(id)) continue;
      const title = decodeEntities(a.title);
      const text = decodeEntities(a.description ?? '');
      const topics = classify(`${title}\n${text}`);
      if (!topics.length) continue;
      found.set(id, {
        id,
        title: cleanText(title, 200),
        text: cleanText(text, 400),
        community: a.source?.name || 'News',
        author: null,
        url: a.url,
        date: a.publishedAt.slice(0, 10),
        postedAt: a.publishedAt,
        score: null,
        comments: null,
        topics,
        replies: [],
        source: 'news',
      });
    }
  }
  return [...found.values()].sort((a, b) => (b.postedAt ?? b.date).localeCompare(a.postedAt ?? a.date));
}

export const news = cachedSource('news', { freshMs: 12 * 3600_000, minGapMs: 3 * 3600_000, collect });
