import { buildPulse, type PulsePost } from '@/lib/community/topics';
import { getReddit, readCache, subreddits } from '@/lib/community/reddit';
import { news, newsOn } from '@/lib/community/news';
import { youtube, youtubeOn } from '@/lib/community/youtube';
import { SAMPLE_COMMUNITY_POSTS, SAMPLE_DATE } from '@/lib/data/community';
import { todayISO } from '@/lib/engine/dates';

// Community Pulse.
// - Online: Reddit posts collected in the background (public feeds, or the official API with keys),
//   plus YouTube videos (YOUTUBE_API_KEY) and UK news articles (NEWS_API_KEY) when keys are set.
//   The first Reddit collection takes a few minutes because Reddit allows few requests a minute;
//   the page shows progress and fills in as posts arrive.
// - On-device mode: nothing is contacted; the last saved posts are shown, else samples.

type Source = 'reddit' | 'youtube' | 'news';

const newestFirst = (a: PulsePost, b: PulsePost) => (b.postedAt ?? b.date).localeCompare(a.postedAt ?? a.date);

export async function POST(req: Request) {
  const { mode = 'auto', refresh = false } = (await req.json().catch(() => ({}))) as { mode?: 'auto' | 'cloud' | 'local'; refresh?: boolean };

  const reply = (bySource: Record<Source, PulsePost[]>, notes: (string | null | undefined)[], extra: Record<string, unknown>) => {
    const posts = [...bySource.reddit.map((p) => ({ ...p, source: 'reddit' as const })), ...bySource.youtube, ...bySource.news].sort(newestFirst);
    const note = notes.filter(Boolean).join(' ') || null;
    if (!posts.length) {
      return Response.json({ source: 'sample', posts: SAMPLE_COMMUNITY_POSTS, pulse: buildPulse(SAMPLE_COMMUNITY_POSTS, SAMPLE_DATE), note, counts: null, ...extra });
    }
    const counts = { reddit: bySource.reddit.length, youtube: bySource.youtube.length, news: bySource.news.length };
    return Response.json({ source: 'live', posts, pulse: buildPulse(posts, todayISO()), note, counts, ...extra });
  };

  if (mode === 'local') {
    const [saved, yt, nw] = await Promise.all([readCache(), youtube.read(), news.read()]);
    return reply(
      { reddit: saved?.posts ?? [], youtube: yt?.posts ?? [], news: nw?.posts ?? [] },
      ['On-device mode: nothing was contacted. Showing the last saved posts.'],
      { fetchedAt: saved?.fetchedAt, subreddits: saved?.subreddits, via: saved?.via, progress: null },
    );
  }

  const [{ result, progress, via }, yt, nw] = await Promise.all([
    getReddit(refresh),
    youtubeOn() ? youtube.get(refresh) : Promise.resolve(null),
    newsOn() ? news.get(refresh) : Promise.resolve(null),
  ]);
  const live = progress.running ? progress : null;
  const redditNote = !via
    ? 'Reddit is turned off (REDDIT_DISABLED=1).'
    : result?.posts.length
      ? progress.error
      : progress.running
        ? `Collecting from Reddit (${subreddits().map((s) => `r/${s}`).join(', ')}).`
        : progress.error
          ? `Reddit: ${progress.error}`
          : 'Starting Reddit collection.';
  return reply(
    { reddit: result?.posts ?? [], youtube: yt?.result?.posts ?? [], news: nw?.result?.posts ?? [] },
    [redditNote, yt?.error && `YouTube: ${yt.error}`, nw?.error && `News: ${nw.error}`],
    {
      fetchedAt: result?.fetchedAt,
      subreddits: result?.subreddits ?? subreddits(),
      via: result?.via,
      progress: live,
      collecting: { youtube: !!yt?.collecting, news: !!nw?.collecting },
    },
  );
}
