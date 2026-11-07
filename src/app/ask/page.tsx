'use client';

import { useMemo, useRef, useState } from 'react';
import { AiBadge, Button, Card, inputCls, Muted, Why, type Used } from '@/components/ui';
import { affordability, planForecast } from '@/lib/engine/analyse';
import { gbp, niceDate } from '@/lib/engine/dates';
import { postJSON, useAnalysis, useEffectiveMode, useLang, useProfile } from '@/lib/hooks';
import { isRtl } from '@/lib/i18n';
import { buildFacts } from '@/lib/narrative';
import { useStore } from '@/lib/store';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  used?: Used;
  model?: string;
  facts?: Record<string, unknown>;
}

const QUICK = ['Can I afford £60 this week?', 'When could I run out of money?', 'What big bills are coming?', 'What should I do first?'];

export default function Ask() {
  const profile = useProfile();
  const an = useAnalysis(profile);
  const lang = useLang(profile);
  const mode = useEffectiveMode();
  const selected = useStore((s) => (profile ? s.selected[profile.id] : undefined));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => {
    if (!profile || !an) return null;
    const ids = selected ?? an.actions.slice(0, 6).map((a) => a.id);
    const acts = an.actions.filter((a) => ids.includes(a.id));
    const plan = planForecast(an, acts);
    return {
      ...buildFacts(profile, an, plan, acts.map((a) => a.title)),
      bills: an.recurring.filter((r) => r.direction === 'out').map((r) => ({ what: r.label, amount: Math.round(r.last) })),
      nextPayments: an.upcoming.slice(0, 10).map((u) => ({ date: niceDate(u.date), what: u.label, amount: Math.round(u.amount) })),
    };
  }, [profile, an, selected]);

  if (!profile || !an || !context)
    return (
      <Card>
        <p>Pick a demo person or do your check-in first.</p>
      </Card>
    );

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const amountMatch = text.match(/£\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s?(?:pounds|quid|zł|gbp)/i);
    const isAfford = /afford|buy|spend|stać|kupić|خرید|खरीद/i.test(text) && amountMatch;
    let facts: Record<string, unknown> | undefined;
    if (isAfford) {
      const amount = Number(amountMatch![1] || amountMatch![2]);
      const a = affordability(an, amount, an.today);
      facts = {
        amount: gbp(amount),
        riskNext30DaysWithout: `${Math.round(a.riskBefore * 100)}%`,
        riskNext30DaysIfBoughtToday: `${Math.round(a.riskAfter * 100)}%`,
        lowestLikelyBalanceAfter: `${gbp(a.lowestAfter.value)} on ${niceDate(a.lowestAfter.date)}`,
        saferDate: a.saferDate ? `${niceDate(a.saferDate.date)} (risk ${Math.round(a.saferDate.risk * 100)}%)` : 'none in the next 30 days',
      };
    }
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: text }]);
    setQ('');
    setBusy(true);
    try {
      const r = await postJSON<{ text: string | null; used: Used; model?: string }>('/api/ai/agent', { mode, lang, question: text, context, facts, history });
      let content = r.text;
      let used = r.used;
      if (!content) {
        used = 'rules';
        content = facts
          ? `Buying ${facts.amount} today changes your chance of going below £0 in the next 30 days from ${facts.riskNext30DaysWithout} to ${facts.riskNext30DaysIfBoughtToday}. Safer date: ${facts.saferDate}.`
          : context.firstRisk
            ? `Your first risky day is ${context.firstRisk.date} (${context.firstRisk.chanceBelowZero} chance of going below £0). Your plan brings the highest risk down to ${context.highestRiskWithPlan}.`
            : `Your money looks steady for the next 90 days. Next big bill: ${context.upcomingBigBills[0]?.what ?? 'none soon'}.`;
      }
      setMsgs((m) => [...m, { role: 'assistant', content: content!, used, model: r.model, facts }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ask your money coach</h1>
        <Muted>It knows your forecast, bills and plan. It explains; the app’s code does the maths.</Muted>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK.map((x) => (
          <Button key={x} variant="soft" className="!px-3 !py-1.5" onClick={() => send(x)}>
            {x}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-violet-700 text-white' : 'bg-white shadow-sm ring-1 ring-black/5'}`} dir={m.role === 'assistant' && isRtl(lang) ? 'rtl' : 'ltr'}>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
              {m.role === 'assistant' && (
                <div className="mt-2">
                  <AiBadge used={m.used} model={m.model} />
                  {m.facts && (
                    <Why label="Numbers the coach used">
                      {Object.entries(m.facts).map(([k, v]) => (
                        <div key={k}>
                          {k}: <b>{String(v)}</b>
                        </div>
                      ))}
                    </Why>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-slate-500">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <form
        className="sticky bottom-20 flex gap-2 rounded-2xl bg-white p-2 shadow ring-1 ring-black/5"
        onSubmit={(e) => {
          e.preventDefault();
          send(q);
        }}
      >
        <input className={`${inputCls} border-0 focus:ring-0`} placeholder="Ask anything, in any language" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" disabled={busy}>
          Send
        </Button>
      </form>
    </div>
  );
}
