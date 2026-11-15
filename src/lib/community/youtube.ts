// YouTube source for Community Pulse. Server only. Needs YOUTUBE_API_KEY (YouTube Data API v3).
//
// Same flow as the brand-monitoring YouTube scraper: search each topic -> video details -> top
// comments for the leading videos -> tag by the same word rules as Reddit.
// Quota: the free daily allowance is 10,000 units. One collection costs about 910
// (9 searches x 100, 1 details call, up to 5 comment calls), and collections are at least 3 hours
// apart, so a day can never use it up.
import { cachedSource, decodeEntities } from './cache';
import { classify, cleanText, TOPICS, type PulsePost, type PulseReply } from './topics';

const key = () => process.env.YOUTUBE_API_KEY?.trim() || '';
export const youtubeOn = () => !!key();

const API = 'https://www.googleapis.com/youtube/v3';
const REPLY_TOPICS = 5;

async function yt<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}/${endpoint}?${new URLSearchParams({ ...params, key: key() })}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[]; status?: string } } | null;
    const reason = j?.error?.errors?.[0]?.reason || j?.error?.status || '';
    // Never include the URL in errors: it holds the key.
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new Error('YouTube’s daily quota is used up. It resets at midnight Pacific time.');
    throw new Error(`YouTube ${res.status}${reason ? ` (${reason})` : ''}`);
  }
  return (await res.json()) as T;
}

interface SearchItem {
  id: { videoId?: string };
  snippet: { title: string; description: string; channelTitle: string; publishedAt: string; liveBroadcastContent?: string };
}
interface VideoItem {
  id: string;
  statistics?: { likeCount?: string; commentCount?: string };
}
interface CommentThread {
  snippet: { topLevelComment: { snippet: { textDisplay: string; authorDisplayName?: string } } };
}

const IGNORE = /#shorts|\b(?:giveaway|promo code|referral|sponsored)\b/i;
/** Dollar amounts with no pound sign: almost always US advice, which doesn't apply here. */
const isUS = (s: string) => /\$\s?\d/.test(s) && !/£/.test(s);
const num = (s?: string) => (s === undefined ? null : Number(s));

async function collect(): Promise<PulsePost[]> {
  const after = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const found = new Map<string, PulsePost>();
  const seenTitles = new Set<string>(); // channels sometimes upload the same video twice

  // 1. Search each topic (YouTube uses | for OR). regionCode alone still returns US videos, so
  //    every term gets "UK" added. Last year, safe search.
  for (const topic of TOPICS) {
    const { items = [] } = await yt<{ items?: SearchItem[] }>('search', {
      part: 'snippet',
      type: 'video',
      q: topic.query
        .split(' OR ')
        .map((t) => `${t.trim()} UK`)
        .join('|'),
      maxResults: '20',
      order: 'relevance',
      regionCode: 'GB',
      relevanceLanguage: 'en',
      safeSearch: 'strict',
      publishedAfter: after,
    });
    for (const it of items) {
      const id = it.id.videoId;
      if (!id || found.has(`yt-${id}`) || it.snippet.liveBroadcastContent === 'upcoming') continue;
      const title = decodeEntities(it.snippet.title);
      const description = decodeEntities(it.snippet.description);
      if (IGNORE.test(`${title}\n${description}`) || isUS(`${title}\n${description}`)) continue;
      const titleKey = `${it.snippet.channelTitle}|${title.toLowerCase()}`;
      if (seenTitles.has(titleKey)) continue;
      // 2. Tag by the same word rules as Reddit; a video that matches no topic is dropped.
      const topics = classify(`${title}\n${description}`);
      if (!topics.length) continue;
      seenTitles.add(titleKey);
      found.set(`yt-${id}`, {
        id: `yt-${id}`,
        title: cleanText(title, 200),
        text: cleanText(description, 400),
        community: 'YouTube',
        author: it.snippet.channelTitle || null,
        url: `https://www.youtube.com/watch?v=${id}`,
        date: it.snippet.publishedAt.slice(0, 10),
        postedAt: it.snippet.publishedAt,
        score: null,
        comments: null,
        topics,
        replies: [],
        source: 'youtube',
      });
    }
  }

  // 3. Likes and comment counts, 50 videos per call.
  const ids = [...found.keys()].map((k) => k.slice(3));
  for (let i = 0; i < ids.length; i += 50) {
    const { items = [] } = await yt<{ items?: VideoItem[] }>('videos', { part: 'statistics', id: ids.slice(i, i + 50).join(','), maxResults: '50' });
    for (const v of items) {
      const p = found.get(`yt-${v.id}`);
      if (p) Object.assign(p, { score: num(v.statistics?.likeCount), comments: num(v.statistics?.commentCount) });
    }
  }

  // 4. Top comments for the most-discussed video of the biggest topics.
  const all = [...found.values()];
  const counts = TOPICS.map((t) => ({ id: t.id, n: all.filter((x) => x.topics[0] === t.id).length })).sort((a, b) => b.n - a.n);
  for (const { id } of counts.slice(0, REPLY_TOPICS)) {
    const pick = all.filter((x) => x.topics[0] === id && (x.comments ?? 0) > 0).sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0))[0];
    if (!pick) continue;
    try {
      const { items = [] } = await yt<{ items?: CommentThread[] }>('commentThreads', { part: 'snippet', videoId: pick.id.slice(3), order: 'relevance', maxResults: '8', textFormat: 'plainText' });
      pick.replies = items
        .map((c) => c.snippet.topLevelComment.snippet)
        .filter((c) => c.textDisplay?.trim())
        .slice(0, 3)
        .map((c): PulseReply => ({ author: c.authorDisplayName || null, text: cleanText(decodeEntities(c.textDisplay), 300) }));
    } catch (e) {
      // Comments can be turned off on a video; that's fine.
      console.warn('[youtube] comments skipped', (e as Error).message);
    }
  }

  return all.sort((a, b) => (b.postedAt ?? b.date).localeCompare(a.postedAt ?? a.date));
}

export const youtube = cachedSource('youtube', { freshMs: 6 * 3600_000, minGapMs: 3 * 3600_000, collect });
