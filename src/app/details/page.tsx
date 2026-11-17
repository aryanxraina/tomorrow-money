'use client';

import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { QuestionForm } from '@/components/QuestionForm';
import { Card, Muted, NoProfile, TopBar } from '@/components/ui';
import { gbp, shortDate } from '@/lib/engine/dates';
import { accuracy, QUESTIONS, type Question } from '@/lib/engine/questions';
import { useMoney } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import type { Answers } from '@/lib/types';

function describe(q: Question, a: Answers, known: boolean): string {
  if (q.kind === 'dated') {
    const added = q.items?.(a).length ?? 0;
    return added ? `${added} added` : known ? 'None' : 'Not answered';
  }
  if (!known) return 'Not answered';
  const v = q.read(a);
  switch (q.kind) {
    case 'money':
    case 'signed-money':
      return gbp(Number(v), 2);
    case 'count':
    case 'day':
      return v === null ? 'Not answered' : String(v);
    case 'yesno':
      return v ? 'Yes' : 'No';
    case 'one':
      return q.options?.find((o) => o.id === v)?.label ?? 'Not answered';
    case 'many': {
      const chosen = (v as string[]) ?? [];
      return chosen.length ? chosen.map((id) => q.options?.find((o) => o.id === id)?.label ?? id).join(', ') : 'None';
    }
  }
  return '';
}

export default function Details() {
  const money = useMoney();
  const known = useStore((s) => s.known);
  const skipped = useStore((s) => s.skipped);
  const answers = useStore((s) => s.answers);
  const saveAnswers = useStore((s) => s.saveAnswers);
  const [open, setOpen] = useState<string | null>(null);
  if (!money || !answers) return <NoProfile />;
  const { an, profile } = money;
  const context = { a: answers, an, known, skipped, estimated: profile.estimated };
  const relevant = QUESTIONS.filter((q) => q.applies(context));
  const { answered, total } = accuracy(context);

  return (
    <div className="space-y-3">
      <TopBar title="Your details" back="/more" subtitle="Everything you’ve told us. Change anything at any time." />
      <Muted className="px-1">
        You’ve answered {answered} of {total}. The more we know, the more accurate your forecast and help checks are. Tap any of these to change it.
      </Muted>
      <Card className="!py-1.5">
        <div className="divide-y divide-hair">
          {relevant.map((q) => {
            const isOpen = open === q.id;
            return (
              <div key={q.id} className="py-2.5">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : q.id)} className="flex w-full items-center gap-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{q.title}</span>
                    <span className="num mt-0.5 block text-[13px] text-mut">{describe(q, answers, known.includes(q.id))}</span>
                  </span>
                  <ChevronDown size={18} className={`flex-none text-mut transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {isOpen && (
                  <div className="mt-3 space-y-2">
                    <Muted>{q.why}</Muted>
                    {q.items?.(answers).map((item) => (
                      <div key={`${item.label}-${item.date}-${item.amount}`} className="flex items-center gap-2 rounded-2xl bg-card-2 py-1.5 pl-3.5 pr-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}, {shortDate(item.date)}
                        </span>
                        <span className="num flex-none font-semibold">{gbp(item.amount, 2)}</span>
                        <button type="button" aria-label={`Remove ${item.label}`} onClick={() => saveAnswers(q.removeItem?.(item, answers) ?? {}, [q.id])} className="grid h-8 w-8 flex-none place-items-center rounded-full text-mut">
                          <X size={16} aria-hidden />
                        </button>
                      </div>
                    ))}
                    <QuestionForm key={q.id} question={q} onDone={() => setOpen(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
