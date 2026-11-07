import { buildPulse, type PulsePost } from '@/lib/community/topics';
import { getReddit, readCache, subreddits } from '@/lib/community/reddit';
import { SAMPLE_COMMUNITY_POSTS } from '@/lib/data/community';
import { TODAY } from '@/lib/engine/dates';

// Community Pulse.
// - Online: Reddit posts collected in the background (public feeds, or the official API with keys).
//   The first collection takes a few minutes because Reddit allows few requests a minute; the page
//   shows progress and fills in as posts arrive.
// - On-device mode: Reddit is never contacted; the last saved Reddit posts are shown, else samples.
export async function POST(req: Request) {
  const { mode = 'auto', refresh = false } = (await req.json().catch(() => ({}))) as { mode?: 'auto' | 'cloud' | 'local'; refresh?: boolean };

  const reply = (source: 'reddit' | 'sample', posts: PulsePost[], extra: Record<string, unknown>) =>
    Response.json({
      source,
      posts,
      pulse: buildPulse(posts, source === 'sample' ? TODAY : new Date().toISOString().slice(0, 10)),
      ...extra,
    });

  if (mode === 'local') {
    const saved = await readCache();
    const note = 'On-device mode: Reddit was not contacted.';
    if (saved?.posts.length) return reply('reddit', saved.posts, { note, fetchedAt: saved.fetchedAt, subreddits: saved.subreddits, via: saved.via, progress: null });
    return reply('sample', SAMPLE_COMMUNITY_POSTS, { note, progress: null });
  }

  const { result, progress, via } = await getReddit(refresh);
  const live = progress.running ? progress : null;
  if (result?.posts.length) {
    return reply('reddit', result.posts, { note: progress.error, fetchedAt: result.fetchedAt, subreddits: result.subreddits, via: result.via, progress: live });
  }
  const note = !via
    ? 'Reddit is turned off (REDDIT_DISABLED=1).'
    : progress.running
      ? `Collecting from Reddit (${subreddits().map((s) => `r/${s}`).join(', ')}). Showing samples until the first posts arrive.`
      : progress.error
        ? `Reddit: ${progress.error}`
        : 'Starting Reddit collection.';
  return reply('sample', SAMPLE_COMMUNITY_POSTS, { note, progress: live });
}
