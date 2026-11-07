'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiWriting, Button, Card, CodeBadge, Muted, Pill, Stat, Why } from '@/components/ui';
import { topicById, topicsForUser, type Pulse, type PulsePost } from '@/lib/community/topics';
import { niceDate } from '@/lib/engine/dates';
import { postJSON, useAnalysis, useEffectiveMode, useProfile } from '@/lib/hooks';

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

const LINE_COLOURS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981'];
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
const postedLabel = (p: PulsePost) =>
  p.postedAt ? new Date(p.postedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : niceDate(p.date);
const POLL_MS = 8000;

export default function Community() {
  const profile = useProfile();
  const an = useAnalysis(profile);
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Community Pulse</h1>
        <Muted>What money problems people are talking about, how that changes over time, and where to get help.</Muted>
      </div>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {data && (live ? <Pill tone="green">From Reddit</Pill> : <Pill tone="amber">Sample posts</Pill>)}
          <CodeBadge />
          {live && data?.subreddits && <span className="text-xs text-slate-500">{data.subreddits.map((s) => `r/${s}`).join(', ')}</span>}
        </div>
        {data?.source === 'sample' && <p className="text-sm text-amber-900">Every post below is a made-up sample. {data.note}</p>}
        {live && data?.fetchedAt && (
          <p className="text-sm text-slate-600">
            Collected {new Date(data.fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {data.via === 'api' ? ' with the official Reddit API.' : ' from Reddit’s public feeds.'} {data.note}
          </p>
        )}
        {collecting && (
          <div role="status" className="space-y-1">
            <div className="text-sm font-medium text-violet-800">
              Collecting from Reddit: step {collecting.done} of {collecting.total}. Reddit allows only a few requests a minute, so the first collection takes a few minutes. Posts appear as they arrive.
            </div>
            <div className="h-1.5 rounded-full bg-violet-100">
              <div className="h-1.5 rounded-full bg-violet-600 transition-all" style={{ width: `${Math.round((collecting.done / Math.max(collecting.total, 1)) * 100)}%` }} />
            </div>
          </div>
        )}
        {mode !== 'local' && !collecting && (
          <Button variant="ghost" className="!px-2 !py-1" onClick={refresh} disabled={loading}>
            Collect again from Reddit
          </Button>
        )}
      </Card>

      {loading && !data && <AiWriting what="Reading community posts" />}

      {pulse && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Posts analysed" value={pulse.total} sub={live ? 'from Reddit' : 'samples'} />
            <Stat label="Top topic" value={pulse.topics[0]?.label ?? '–'} sub={pulse.topics[0] ? `${pulse.topics[0].share}% of posts` : undefined} tone="violet" />
          </div>

          <Card className="space-y-3">
            <h2 className="font-semibold">Trending money problems</h2>
            {pulse.topics.map((t) => (
              <button key={t.id} type="button" onClick={() => setTopic(t.id)} className="block w-full cursor-pointer text-left">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={`font-medium ${active === t.id ? 'text-violet-700' : ''}`}>
                    {t.label} {forYou.includes(t.id) && <Pill tone="violet">For you</Pill>}
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {t.share}% · {t.posts} posts
                    {t.change30 !== 0 && <span className={t.change30 > 0 ? 'text-rose-700' : 'text-emerald-700'}> {t.change30 > 0 ? `▲${t.change30}` : `▼${-t.change30}`}</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${active === t.id ? 'bg-violet-600' : 'bg-violet-300'}`} style={{ width: `${Math.max(t.share, 2)}%` }} />
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
            <h2 className="font-semibold">How it changed over 6 months</h2>
            <div className="mt-2" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#eef0f4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {chartTopics.map((id, i) => (
                    <Line key={id} type="linear" dataKey={id} name={topicById(id)?.label ?? id} stroke={LINE_COLOURS[i]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Muted>Posts per month. {live ? 'Reddit search returns the most relevant posts from the last year, so months are not evenly covered.' : 'Sample data.'}</Muted>
          </Card>

          {active && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">What people say: {topicById(active)?.label}</h2>
                {topic && (
                  <Button variant="ghost" className="!px-2 !py-1" onClick={() => setTopic(null)}>
                    {mineAvailable.length ? 'Back to my topics' : 'Reset'}
                  </Button>
                )}
              </div>
              {topicById(active) && (
                <Card className="bg-violet-50 text-sm ring-violet-100">
                  Free official help:{' '}
                  <a className="font-medium text-violet-700 underline" href={topicById(active)!.help.url} target="_blank" rel="noreferrer">
                    {topicById(active)!.help.name}
                  </a>
                </Card>
              )}
              {posts.map((p) => (
                <Card key={p.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {p.community}
                      {p.author && (
                        <>
                          {' · '}
                          <a className="font-medium text-slate-700 hover:underline" href={`https://www.reddit.com/user/${encodeURIComponent(p.author)}`} target="_blank" rel="noreferrer">
                            u/{p.author}
                          </a>
                        </>
                      )}
                      {' · '}
                      <time dateTime={p.postedAt ?? p.date}>{postedLabel(p)}</time>
                    </span>
                    {(p.score !== null || p.comments !== null) && (
                      <span>
                        {p.score !== null && `▲ ${p.score}`}
                        {p.score !== null && p.comments !== null && ' · '}
                        {p.comments !== null && `${p.comments} replies`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold">{p.title}</p>
                  {p.text && <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{p.text}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.topics.map((id) => (
                      <Pill key={id} tone="violet">
                        {topicById(id)?.label ?? id}
                      </Pill>
                    ))}
                    {!live && <Pill>Sample post</Pill>}
                  </div>
                  {p.replies.map((r) => (
                    <div key={r.text} className="mt-2 rounded-xl bg-slate-50 p-2.5 text-sm">
                      <p>{r.text}</p>
                      {r.author && <div className="mt-0.5 text-xs text-slate-500">u/{r.author}</div>}
                    </div>
                  ))}
                  {p.url && (
                    <a className="mt-2 inline-block text-sm font-medium text-violet-700 underline" href={p.url} target="_blank" rel="noreferrer">
                      Read on Reddit
                    </a>
                  )}
                </Card>
              ))}
              {!posts.length && <Muted>No posts on this topic yet.</Muted>}
            </div>
          )}
        </>
      )}

      <Muted>
        Posts are people’s own experiences, not financial advice. Usernames are shown as they appear publicly on Reddit; emails, phone numbers and postcodes in posts are hidden. For debt problems, free regulated advisers such as StepChange,
        National Debtline or Citizens Advice can help.
      </Muted>
    </div>
  );
}
