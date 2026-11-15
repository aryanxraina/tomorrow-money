'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiWriting, Button, Card, Chip, Muted, SectionTitle, Stat, TopBar, Why } from '@/components/ui';
import { topicById, topicsForUser, type Pulse, type PulsePost } from '@/lib/community/topics';
import { niceDate } from '@/lib/engine/dates';
import { postJSON, useEffectiveMode, useMoney } from '@/lib/hooks';

interface CommunityResponse {
  source: 'reddit' | 'sample';
  note: string | null;
  posts: PulsePost[];
  pulse: Pulse;
  fetchedAt?: string;
  subreddits?: string[];
  via?: 'api' | 'rss';
  /** Set while a background collection is still adding posts. */
  progress: { done: number; total: number } | null;
}

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

  // While Reddit posts are still being collected, check again every few seconds.
  useEffect(() => {
    if (!collecting || loading) return;
    const t = setTimeout(() => setPoll((n) => n + 1), POLL_MS);
    return () => clearTimeout(t);
  }, [collecting, loading]);

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

  const live = data?.source === 'reddit';
  const help = active ? topicById(active) : undefined;

  return (
    <div className="space-y-3">
      <TopBar title="Community Pulse" back="/more" />
      <Muted className="px-1">What money problems people are talking about, how that changes over time, and where to get help.</Muted>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {data && (live ? <Chip tone="good">From Reddit</Chip> : <Chip tone="warn">Sample posts</Chip>)}
          {live && data?.subreddits && <span className="text-xs text-mut">{data.subreddits.map((s) => `r/${s}`).join(', ')}</span>}
        </div>
        {data?.source === 'sample' && <p className="text-sm">Every post below is a made-up sample. {data.note}</p>}
        {live && data?.fetchedAt && (
          <p className="text-sm text-mut">
            Collected {new Date(data.fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {data.via === 'api' ? ' with the official Reddit API.' : ' from Reddit’s public feeds.'} {data.note}
          </p>
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
            Collect again from Reddit
          </Button>
        )}
      </Card>

      {loading && !data && <AiWriting what="Reading community posts" />}

      {pulse && (
        <>
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Posts analysed" value={pulse.total} sub={live ? 'from Reddit' : 'samples'} />
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
              <p>These are counts of the posts collected here, not of all of Reddit. How much people talk about a problem is not a measure of how many people have it.</p>
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
            <Muted>Posts per month. {live ? 'Reddit search returns the most relevant posts from the last year, so months are not evenly covered.' : 'Sample data.'}</Muted>
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
                      {p.community}
                      {p.author && (
                        <>
                          {' · '}
                          <a className="font-medium text-ink hover:underline" href={`https://www.reddit.com/user/${encodeURIComponent(p.author)}`} target="_blank" rel="noreferrer">
                            u/{p.author}
                          </a>
                        </>
                      )}
                      {' · '}
                      <time dateTime={p.postedAt ?? p.date}>{postedLabel(p)}</time>
                    </span>
                    {(p.score !== null || p.comments !== null) && (
                      <span className="num">
                        {p.score !== null && `▲ ${p.score}`}
                        {p.score !== null && p.comments !== null && ' · '}
                        {p.comments !== null && `${p.comments} replies`}
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
                      {r.author && <div className="mt-0.5 text-xs text-mut">u/{r.author}</div>}
                    </div>
                  ))}
                  {p.url && (
                    <a className="mt-2 inline-block text-sm font-medium text-link underline" href={p.url} target="_blank" rel="noreferrer">
                      Read on Reddit
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
        Posts are people’s own experiences, not financial advice. Usernames are shown as they appear publicly on Reddit; emails, phone numbers and postcodes in posts are hidden. For debt problems, free regulated advisers such as StepChange,
        National Debtline or Citizens Advice can help.
      </Muted>
    </div>
  );
}
