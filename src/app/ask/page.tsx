'use client';

import { ArrowUp } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AiNote, AiWriting, Card, inputCls, Muted, NoProfile, TopBar, Why, type Used } from '@/components/ui';
import { affordability } from '@/lib/engine/analyse';
import { gbp, niceDate } from '@/lib/engine/dates';
import { postJSON, useEffectiveMode, useMoney } from '@/lib/hooks';
import { affordVerdict, rulesAnswer, SET_QUESTIONS } from '@/lib/narrative';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  verdict?: string;
  safe?: boolean;
  used?: Used;
  facts?: Record<string, unknown>;
}

const FACT_LABEL: Record<string, string> = {
  amount: 'Amount',
  riskNext30DaysWithout: 'Chance of going below £0 in 30 days, without it',
  riskNext30DaysIfBoughtToday: 'With it, if bought today',
  lowestLikelyBalanceAfter: 'Lowest likely balance after',
  saferDate: 'A safer date',
};

export default function Ask() {
  const money = useMoney();
  const mode = useEffectiveMode();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => {
    if (!money) return null;
    return {
      ...money.facts,
      bills: money.an.recurring.filter((r) => r.direction === 'out').map((r) => ({ what: r.label, amount: Math.round(r.last) })),
      nextPayments: money.an.upcoming.slice(0, 10).map((u) => ({ date: niceDate(u.date), what: u.label, amount: Math.round(u.amount) })),
    };
  }, [money]);

  if (!money || !context) return <NoProfile />;
  const { an, facts } = money;
  const subscriptions = an.recurring.filter((r) => r.category === 'subscriptions' && r.direction === 'out');

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const amountMatch = text.match(/£\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s?(?:pounds|quid|gbp)/i);
    const isAfford = /afford|buy|spend/i.test(text) && amountMatch;
    let priceFacts: Record<string, unknown> | undefined;
    let verdict: string | undefined;
    let safe: boolean | undefined;
    if (isAfford) {
      const amount = Number(amountMatch![1] || amountMatch![2]);
      const a = affordability(an, amount, an.today);
      // Safe means: the purchase leaves the 30-day risk low and doesn't noticeably raise it. Decided here, never by an AI.
      safe = a.riskAfter < 0.25 && a.riskAfter - a.riskBefore < 0.1;
      const saferDate = a.saferDate ? niceDate(a.saferDate.date) : undefined;
      const riskBefore = `${Math.round(a.riskBefore * 100)}%`;
      const riskAfter = `${Math.round(a.riskAfter * 100)}%`;
      verdict = affordVerdict({ amount: gbp(amount), riskBefore, riskAfter, safe, saferDate: safe ? undefined : saferDate });
      priceFacts = {
        verdict: safe ? 'looks OK' : 'not a safe time to buy this',
        amount: gbp(amount),
        riskNext30DaysWithout: riskBefore,
        riskNext30DaysIfBoughtToday: riskAfter,
        lowestLikelyBalanceAfter: `${gbp(a.lowestAfter.value)} on ${niceDate(a.lowestAfter.date)}`,
        saferDate: a.saferDate ? `${saferDate} (risk ${Math.round(a.saferDate.risk * 100)}%)` : 'none in the next 30 days',
      };
    }
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: text }]);
    setQ('');
    // A purchase is answered entirely by code. In testing, a model added claims with no basis, such as
    // "wait until next month", to a verdict that already said everything the numbers support.
    if (verdict) {
      const next = !safe ? (an.actions.find((a) => a.kind === 'claim') ?? an.actions[0]) : undefined;
      const content = next ? `One thing that could help: ${next.title}.` : '';
      setMsgs((m) => [...m, { role: 'assistant', content, verdict, safe, used: 'rules', facts: priceFacts }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }
    setBusy(true);
    try {
      let r: { text: string | null; used: Used };
      try {
        r = await postJSON('/api/ai/agent', { mode, lang: 'en', question: text, context, history });
      } catch {
        r = { text: null, used: 'rules' };
      }
      setMsgs((m) => [...m, { role: 'assistant', content: r.text ?? rulesAnswer(text, facts, subscriptions), used: r.text ? r.used : 'rules' }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col gap-3">
      <TopBar title="Ask" back="/home" />
      {!msgs.length && (
        <Card>
          <h2 className="font-display text-xl font-semibold tracking-tight">What’s on your mind?</h2>
          <Muted className="mt-0.5">Answers come from your own numbers, and purchase checks run through your forecast.</Muted>
          <div className="mt-3 flex flex-wrap gap-2">
            {SET_QUESTIONS.map((x) => (
              <button key={x} type="button" className="rounded-full bg-card-2 px-3.5 py-2 text-left text-sm font-medium" onClick={() => send(x)}>
                {x}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex-1 space-y-3">
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-[22px] rounded-br-md bg-hero px-4 py-2.5 text-[15px] text-hero-ink">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="max-w-[92%] rounded-[22px] rounded-bl-md bg-card p-4">
              {m.verdict && <p className={`text-[15px] font-semibold leading-relaxed ${m.safe ? 'text-good' : 'text-risk'}`}>{m.verdict}</p>}
              {m.content && <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${m.verdict ? 'mt-2' : ''}`}>{m.content}</p>}
              <AiNote used={m.used} />
              {m.facts && (
                <Why label="The numbers behind this">
                  {Object.entries(m.facts)
                    .filter(([k]) => FACT_LABEL[k])
                    .map(([k, v]) => (
                      <div key={k} className="num flex justify-between gap-3">
                        <span>{FACT_LABEL[k]}</span>
                        <b className="font-medium">{String(v)}</b>
                      </div>
                    ))}
                </Why>
              )}
            </div>
          ),
        )}
        {busy && <AiWriting what="Thinking" />}
        <div ref={endRef} />
      </div>

      {msgs.length > 0 && (
        <div className="no-bar -mx-3.5 flex gap-2 overflow-x-auto px-3.5">
          {SET_QUESTIONS.slice(1).map((x) => (
            <button key={x} type="button" className="flex-none rounded-full bg-card px-3.5 py-2 text-sm font-medium" onClick={() => send(x)}>
              {x}
            </button>
          ))}
        </div>
      )}

      <form
        className="sticky bottom-[92px] flex items-center gap-2 rounded-full bg-card p-1.5 shadow-[0_8px_24px_-14px_rgba(0,0,0,.45)]"
        onSubmit={(e) => {
          e.preventDefault();
          send(q);
        }}
      >
        <input aria-label="Ask a question" className={`${inputCls} !rounded-full !bg-transparent !py-2`} placeholder="Ask about your money" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" disabled={busy || !q.trim()} aria-label="Send" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-lime text-lime-ink disabled:opacity-40">
          <ArrowUp size={20} aria-hidden />
        </button>
      </form>
    </div>
  );
}
