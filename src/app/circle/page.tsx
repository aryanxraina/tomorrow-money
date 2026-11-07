'use client';

import { useMemo, useState } from 'react';
import { Button, Card, inputCls, Muted, Pill, Why } from '@/components/ui';
import { SAMPLE_POSTS } from '@/lib/data/circle';
import { useAnalysis, useProfile } from '@/lib/hooks';
import { moderationProblem } from '@/lib/moderate';

export default function Circle() {
  const profile = useProfile();
  const an = useAnalysis(profile);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const myGroups = useMemo(() => new Set(an?.groups.map((g) => g.id) ?? []), [an]);
  const relevant = SAMPLE_POSTS.filter((p) => p.groups.some((g) => myGroups.has(g)));
  const posts = showAll || !relevant.length ? SAMPLE_POSTS : relevant;

  const submit = () => {
    const why = moderationProblem(draft);
    setProblem(why);
    if (why) return;
    setMine([draft.trim(), ...mine]);
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Money Circle</h1>
        <Muted>People in a similar spot, sharing what helped. Anonymous, with no names and no profiles.</Muted>
      </div>

      <Card className="bg-amber-50 text-sm text-amber-950 ring-amber-100">
        <b>This is a preview.</b> Every post below is a made-up sample. The shared board isn’t built yet, so anything you write stays on this screen and disappears when you leave.
      </Card>

      <Card className="space-y-2">
        <label htmlFor="circle-post" className="block font-semibold">
          Share what helped you
        </label>
        <textarea id="circle-post" rows={3} className={inputCls} value={draft} placeholder="Don’t include names, numbers or addresses" onChange={(e) => setDraft(e.target.value)} />
        {problem && (
          <p role="alert" className="text-sm font-medium text-rose-800">
            {problem}
          </p>
        )}
        <Button onClick={submit} disabled={!draft.trim()}>
          Check and add
        </Button>
        <Why>
          <p>The app’s rules check your post on this device for personal details and for loan or quick-money offers. No AI is involved, and nothing is sent anywhere.</p>
          <p>The rules catch obvious cases, not everything. A real board would also need human moderators.</p>
        </Why>
      </Card>

      {mine.map((text, i) => (
        <Card key={`${i}-${text}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">You, just now</span>
            <Pill tone="green">Only on this screen</Pill>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[15px]">{text}</p>
        </Card>
      ))}

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{showAll || !relevant.length ? 'All topics' : 'For people in your groups'}</h2>
        {relevant.length > 0 && (
          <Button variant="ghost" className="!px-2 !py-1" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show mine' : 'Show all'}
          </Button>
        )}
      </div>
      {posts.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill tone="violet">{p.topic}</Pill>
            <Pill>Sample post</Pill>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed">{p.text}</p>
          <div className="mt-1 text-xs text-slate-500">
            Anonymous · {p.area} · {p.ago}
          </div>
          {p.replies.map((r) => (
            <div key={r.text} className="mt-2 rounded-xl bg-slate-50 p-2.5 text-sm">
              <p>{r.text}</p>
              <div className="mt-0.5 text-xs text-slate-500">Anonymous · {r.ago}</div>
            </div>
          ))}
        </Card>
      ))}
      <Muted>Posts are people’s own experience, not financial advice. For debt problems, free regulated advisers such as StepChange, National Debtline or Citizens Advice can help.</Muted>
    </div>
  );
}
