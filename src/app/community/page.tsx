'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiWriting, Button, Card, Chip, Muted, SectionTitle, Stat, TopBar, Why } from '@/components/ui';
import { topicById, topicsForUser, type Pulse, type PulsePost } from '@/lib/community/topics';
import { niceDate } from '@/lib/engine/dates';
import { postJSON, useEffectiveMode, useMoney } from '@/lib/hooks';

type Source = 'reddit' | 'youtube' | 'news';

interface CommunityResponse {
  source: 'live' | 'sample';
  note: string | null;
  posts: PulsePost[];
  pulse: Pulse;
  /** Posts per source, when live. */
  counts: Record<Source, number> | null;
  fetchedAt?: string;
  subreddits?: string[];
  via?: 'api' | 'rss';
  /** Set while a background Reddit collection is still adding posts. */
  progress: { done: number; total: number } | null;
  /** True while YouTube or news is collecting for the first time. */
  collecting?: { youtube: boolean; news: boolean };
}

const SOURCE_NAME: Record<Source, string> = { reddit: 'Reddit', youtube: 'YouTube', news: 'UK news' };
const READ_ON: Record<Source, string> = { reddit: 'Read on Reddit', youtube: 'Watch on YouTube', news: 'Read the article' };
const sourceOf = (p: PulsePost): Source => p.source ?? 'reddit';
/** "Reddit, YouTube and UK news" */
const listSources = (ids: Source[]) => {
  const names = ids.map((s) => SOURCE_NAME[s]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
};

const LINE_COLOURS = ['var(--chart-line)', 'var(--link)', 'var(--warn)', 'var(--chart-axis)'];
const axisTick = { fontSize: 11, fill: 'var(--chart-axis)' };
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
const postedLabel = (p: PulsePost) =>
  p.postedAt ? new Date(p.postedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : niceDate(p.date);
const POLL_MS = 8000;

export default function Community() {
  const money = useMoney();
  const an = money?.an ?? null;
  const mode = useEffectiveMode();
  const [topic, setTopic] = useState<string | null>(null);
  // Each request has a key (mode + poll count); loading means the latest key hasn't answered yet.
  const [poll, setPoll] = useState(0);
  const [result, setResult] = useState<{ key: string; data: CommunityResponse | null } | null>(null);
  const key = `${mode}:${poll}`;
  useEffect(() => {
    let live = true;
    postJSON<CommunityResponse>('/api/community', { mode })
      .then((d) => live && setResult({ key, data: d }))
      .catch(() => live && setResult({ key, data: null }));
    return () => {
      live = false;
    };
  }, [key, mode]);
  const data = result?.data ?? null;
  const loading = result?.key !== key;
  const collecting = data?.progress ?? null;
  const othersCollecting = !!(data?.collecting?.youtube || data?.collecting?.news);

  // While posts are still being collected, check again every few seconds.
  useEffect(() => {
    if ((!collecting && !othersCollecting) || loading) return;
    const t = setTimeout(() => setPoll((n) => n + 1), POLL_MS);
    return () => clearTimeout(t);
  }, [collecting, othersCollecting, loading]);

  const refresh = useCallback(async () => {
    await postJSON<CommunityResponse>('/api/community', { mode, refresh: true }).catch(() => null);
    setPoll((n) => n + 1);
  }, [mode]);

  const forYou = useMemo(() => (an ? topicsForUser(an.problems, an.groups.map((g) => g.id)).slice(0, 3) : []), [an]);
  const pulse = data?.pulse;
  const available = useMemo(() => new Set(pulse?.topics.map((t) => t.id) ?? []), [pulse]);
  const mineAvailable = forYou.filter((id) => available.has(id));
  const active = topic ?? mineAvailable[0] ?? pulse?.topics[0]?.id ?? null;
  const posts = (data?.posts ?? []).filter((p) => !active || p.topics.includes(active)).slice(0, 10);

  const chartTopics = useMemo(() => {
    const ids = [...mineAvailable, ...(pulse?.topics.map((t) => t.id) ?? [])];
    return [...new Set(ids)].slice(0, 4);
  }, [mineAvailable, pulse]);
  const chartData = pulse?.months.map((m) => ({ month: monthLabel(m.month), ...Object.fromEntries(chartTopics.map((id) => [id, m.counts[id] ?? 0])) })) ?? [];

  const live = data?.source === 'live';
  const help = active ? topicById(active) : undefined;
  const liveSources = (Object.keys(SOURCE_NAME) as Source[]).filter((s) => (data?.counts?.[s] ?? 0) > 0);

  return (
    <div className="space-y-3">
      <TopBar title="What people are saying" back="/home" subtitle="Real conversations about money, how they change over time, and where to get help." />
      <Muted className="px-1">What money problems people are talking about, how that changes over time, and where to get help.</Muted>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {data &&
            (live ? (
              liveSources.map((s) => (
                <Chip key={s} tone="good">
                  {SOURCE_NAME[s]} · {data.counts?.[s]}
                </Chip>
              ))
            ) : (
              <Chip tone="warn">Sample posts</Chip>
            ))}
          {live && (data?.counts?.reddit ?? 0) > 0 && data?.subreddits && <span className="text-xs text-mut">{data.subreddits.map((s) => `r/${s}`).join(', ')}</span>}
        </div>
        {data?.source === 'sample' && <p className="text-sm">Every post below is a made-up sample. {data.note}</p>}
        {live && (
          <p className="text-sm text-mut">
            {(data?.counts?.reddit ?? 0) > 0 && data?.fetchedAt && (
              <>
                Reddit collected {new Date(data.fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {data.via === 'api' ? ' with the official Reddit API.' : ' from Reddit’s public feeds.'}{' '}
              </>
            )}
            {data?.note}
          </p>
        )}
        {othersCollecting && !collecting && (
          <div role="status" className="text-sm font-medium">
            Collecting from {listSources((['youtube', 'news'] as Source[]).filter((s) => data?.collecting?.[s as 'youtube' | 'news']))}. Posts appear as they arrive.
          </div>
        )}
        {collecting && (
          <div role="status" className="space-y-1">
            <div className="text-sm font-medium">
              Collecting from Reddit: step {collecting.done} of {collecting.total}. Reddit allows only a few requests a minute, so the first collection takes a few minutes. Posts appear as they arrive.
            </div>
            <div className="h-1.5 rounded-full bg-card-2">
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.round((collecting.done / Math.max(collecting.total, 1)) * 100)}%`, background: 'var(--chart-line)' }} />
            </div>
          </div>
        )}
        {mode !== 'local' && !collecting && (
          <Button variant="ghost" className="!px-0 !py-1 !text-sm" onClick={refresh} disabled={loading}>
            Collect again
          </Button>
        )}
      </Card>

      {loading && !data && <AiWriting what="Reading community posts" />}

      {pulse && (
        <>
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Posts analysed" value={pulse.total} sub={live ? `from ${listSources(liveSources)}` : 'samples'} />
              <Stat label="Top topic" value={<span className="text-[20px]">{pulse.topics[0]?.label ?? '–'}</span>} sub={pulse.topics[0] ? `${pulse.topics[0].share}% of posts` : undefined} />
            </div>
          </Card>

          <Card className="space-y-3">
            <SectionTitle>Trending money problems</SectionTitle>
            {pulse.topics.map((t) => (
              <button key={t.id} type="button" onClick={() => setTopic(t.id)} aria-pressed={active === t.id} className="block w-full cursor-pointer text-left">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={`flex items-center gap-1.5 font-medium ${active === t.id ? 'text-link' : ''}`}>
                    {t.label} {forYou.includes(t.id) && <Chip>For you</Chip>}
                  </span>
                  <span className="num text-mut">
                    {t.share}% · {t.posts} posts
                    {t.change30 !== 0 && <span className={t.change30 > 0 ? 'text-risk' : 'text-good'}> {t.change30 > 0 ? `▲${t.change30}` : `▼${-t.change30}`}</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-card-2">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(t.share, 2)}%`, background: active === t.id ? 'var(--chart-line)' : 'var(--chart-band)' }} />
                </div>
              </button>
            ))}
            <Why>
              <p>Each post is tagged with topics by the app’s word rules, not by AI. A post can have more than one topic, so the percentages add up to more than 100.</p>
              <p>▲ / ▼ compares posts in the last 30 days with the 30 days before.</p>
              <p>These are counts of the posts collected here (Reddit posts, YouTube videos and UK news articles), not of everything online. How much people talk about a problem is not a measure of how many people have it.</p>
              <p>News articles show what’s being reported, not what people say. Videos and articles are tagged by the same word rules as posts.</p>
            </Why>
          </Card>

          <Card>
            <SectionTitle>How it changed over 6 months</SectionTitle>
            <div className="mt-2" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--hair)" vertical={false} />
                  <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: 'none', borderRadius: 16, fontSize: 13 }} labelStyle={{ color: 'var(--ink)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {chartTopics.map((id, i) => (
                    <Line key={id} type="linear" dataKey={id} name={topicById(id)?.label ?? id} stroke={LINE_COLOURS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Muted>Posts per month. {live ? 'Reddit and YouTube searches return the most relevant posts from the last year, and news covers only the last month, so months are not evenly covered.' : 'Sample data.'}</Muted>
          </Card>

          {active && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h2 className="font-semibold">What people say: {topicById(active)?.label}</h2>
                {topic && (
                  <Button variant="ghost" className="!px-0 !py-1 !text-sm" onClick={() => setTopic(null)}>
                    {mineAvailable.length ? 'Back to my topics' : 'Reset'}
                  </Button>
                )}
              </div>
              {help && (
                <Card className="text-sm">
                  Free official help:{' '}
                  <a className="font-medium text-link underline" href={help.help.url} target="_blank" rel="noreferrer">
                    {help.help.name}
                  </a>
                </Card>
              )}
              {posts.map((p) => (
                <Card key={p.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mut">
                    <span>
                      {sourceOf(p) === 'news' && live && 'News · '}
                      {p.community}
                      {p.author && sourceOf(p) === 'reddit' && (
                        <>
                          {' · '}
                          <a className="font-medium text-ink hover:underline" href={`https://www.reddit.com/user/${encodeURIComponent(p.author)}`} target="_blank" rel="noreferrer">
                            u/{p.author}
                          </a>
                        </>
                      )}
                      {p.author && sourceOf(p) === 'youtube' && <span className="font-medium text-ink"> · {p.author}</span>}
                      {' · '}
                      <time dateTime={p.postedAt ?? p.date}>{postedLabel(p)}</time>
                    </span>
                    {(p.score !== null || p.comments !== null) && (
                      <span className="num">
                        {p.score !== null && (sourceOf(p) === 'youtube' ? `${p.score.toLocaleString('en-GB')} ${p.score === 1 ? 'like' : 'likes'}` : `▲ ${p.score}`)}
                        {p.score !== null && p.comments !== null && ' · '}
                        {p.comments !== null &&
                          `${p.comments.toLocaleString('en-GB')} ${sourceOf(p) === 'youtube' ? (p.comments === 1 ? 'comment' : 'comments') : p.comments === 1 ? 'reply' : 'replies'}`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold">{p.title}</p>
                  {p.text && <p className="mt-1 text-[15px] leading-relaxed">{p.text}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.topics.map((id) => (
                      <Chip key={id}>{topicById(id)?.label ?? id}</Chip>
                    ))}
                    {!live && <Chip tone="warn">Sample post</Chip>}
                  </div>
                  {p.replies.map((r) => (
                    <div key={r.text} className="mt-2 rounded-2xl bg-card-2 p-3 text-sm">
                      <p>{r.text}</p>
                      {r.author && <div className="mt-0.5 text-xs text-mut">{sourceOf(p) === 'reddit' ? `u/${r.author}` : r.author}</div>}
                    </div>
                  ))}
                  {p.url && (
                    <a className="mt-2 inline-block text-sm font-medium text-link underline" href={p.url} target="_blank" rel="noreferrer">
                      {READ_ON[sourceOf(p)]}
                    </a>
                  )}
                </Card>
              ))}
              {!posts.length && <Muted className="px-1">No posts on this topic yet.</Muted>}
            </div>
          )}
        </>
      )}

      <Muted className="px-1">
        Posts are people’s own experiences, not financial advice. Usernames and channel names are shown as they appear publicly on Reddit and YouTube; emails, phone numbers and postcodes in posts are hidden. For debt problems, free regulated advisers such as StepChange,
        National Debtline or Citizens Advice can help.
      </Muted>
    </div>
  );
}
