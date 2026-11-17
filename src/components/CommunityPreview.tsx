'use client';

import { ChevronRight, ExternalLink, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, Chip, Muted } from '@/components/ui';
import { topicById, type PulsePost } from '@/lib/community/topics';
import { postJSON, useEffectiveMode } from '@/lib/hooks';

const SOURCE_NAME = { reddit: 'Reddit', youtube: 'YouTube', news: 'News' } as const;

/** "today", "3 days ago", "2 weeks ago"… from when it was posted. */
function ago(p: PulsePost) {
  const when = Date.parse(p.postedAt ?? `${p.date}T12:00:00Z`);
  const days = Math.max(0, Math.floor((Date.now() - when) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/**
 * A short look at what people are talking about, on Home, so Community isn't hidden away.
 * People's posts only (Reddit and YouTube): news is reporting, not conversation.
 */
export function CommunityPreview() {
  const mode = useEffectiveMode();
  const [data, setData] = useState<{ source: 'live' | 'sample'; posts: PulsePost[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    postJSON<{ source: 'live' | 'sample'; posts: PulsePost[] }>('/api/community', { mode })
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [mode]);

  if (failed) return null;
  // People's own discussions first (Reddit, or the samples); videos only fill any gaps.
  const all = data?.posts ?? [];
  const discussions = all.filter((p) => !p.source || p.source === 'reddit');
  const videos = all.filter((p) => p.source === 'youtube');
  const posts = [...discussions, ...videos].slice(0, 3);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl text-lime-ink" style={{ background: 'var(--strip-warn)' }}>
          <MessagesSquare size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">What people are saying</h2>
          <p className="text-[13.5px] text-mut">Real conversations about money: rent, food prices, bills and getting help.</p>
        </div>
      </div>

      {!data && <Muted className="mt-3">Loading conversations…</Muted>}
      {data?.source === 'sample' && <p className="mt-3 text-[13px] text-mut">These are made-up examples until real posts have been collected.</p>}

      <div className="mt-2 divide-y divide-hair">
        {posts.map((p) => {
          const topic = p.topics[0] ? topicById(p.topics[0])?.label : null;
          const source = p.source ? SOURCE_NAME[p.source] : data?.source === 'sample' ? 'Example' : 'Reddit';
          return (
            <div key={p.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-mut">
                {topic && <Chip>{topic}</Chip>}
                <span>
                  {source} · {ago(p)}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 font-semibold leading-snug">{p.title}</p>
              {p.text && <p className="mt-0.5 line-clamp-2 text-[14px] text-mut">{p.text}</p>}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13.5px] font-medium text-link">
                  Read the discussion <ExternalLink size={13} aria-hidden />
                </a>
              )}
            </div>
          );
        })}
        {data && !posts.length && <Muted className="py-3">No conversations to show yet.</Muted>}
      </div>

      <p className="mt-1 text-[12.5px] text-mut">People’s own experiences, not checked financial advice. A few posts can’t speak for everyone.</p>
      <Link href="/community" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-link">
        See all conversations and trends <ChevronRight size={16} aria-hidden />
      </Link>
    </Card>
  );
}
