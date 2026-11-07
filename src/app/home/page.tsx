'use client';

import { Camera, ChevronRight, FileSpreadsheet, MessageCircle, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ForecastChart, RiskStrip } from '@/components/charts';
import { QuestionForm } from '@/components/QuestionForm';
import { SafeDaysDial } from '@/components/SafeDaysDial';
import { Button, ButtonLink, Card, Chip, GoCircle, HeroCard, LimeCard, Money, Muted, NoProfile, PoundInput, Row, SectionTitle, TopBar, Why } from '@/components/ui';
import type { Gaps } from '@/lib/engine/analyse';
import { diffDays, gbp, niceDate, shortDate, todayISO } from '@/lib/engine/dates';
import { accuracy, nextQuestion } from '@/lib/engine/questions';
import { useMoney } from '@/lib/hooks';
import { t } from '@/lib/i18n';
import { listOf, missingBasics } from '@/lib/narrative';
import { useStore } from '@/lib/store';

function QuickAction({ href, icon, label, main }: { href: string; icon: React.ReactNode; label: string; main?: boolean }) {
  return (
    <Link href={href} className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13.5px] font-medium ${main ? 'bg-lime text-lime-ink' : 'bg-hero-soft text-hero-ink'}`}>
      {icon}
      {label}
    </Link>
  );
}

function BalanceEditor({ current, onDone }: { current: number | null; onDone: () => void }) {
  const saveAnswers = useStore((s) => s.saveAnswers);
  const [value, setValue] = useState(current === null ? '' : Math.abs(current).toFixed(2));
  const [overdrawn, setOverdrawn] = useState((current ?? 0) < 0);
  return (
    <form
      className="mt-2 space-y-2 text-ink"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (value.trim() && !Number.isNaN(n)) saveAnswers({ balance: overdrawn ? -Math.abs(n) : n, balanceDate: todayISO() }, ['balance']);
        onDone();
      }}
    >
      <PoundInput label="Balance today" value={value} onChange={setValue} />
      <label className="flex items-center gap-2 text-sm text-hero-ink">
        <input type="checkbox" className="h-4 w-4" checked={overdrawn} onChange={(e) => setOverdrawn(e.target.checked)} /> Overdrawn
      </label>
      <Button type="submit" className="w-full !py-2.5">
        Save balance
      </Button>
    </form>
  );
}

// "Not now" puts the questions away until the app is next opened, so nobody has to dismiss them one by one.
let questionsPaused = false;
const pauseQuestions = (paused: boolean) => {
  questionsPaused = paused;
};

function estimateNote(gaps: Gaps, datesKnown: boolean) {
  const dates = datesKnown ? '' : ' Dates are our guess until you tell us.';
  if (gaps.costs.length) return `We don’t know your ${listOf(gaps.costs)} yet, so this may look better than it really is. A bank statement would fill this in.${dates}`;
  return `Add a bank statement to base it on what really happens.${dates}`;
}

export default function Home() {
  const money = useMoney();
  const known = useStore((s) => s.known);
  const skipped = useStore((s) => s.skipped);
  const [editing, setEditing] = useState(false);
  const [paused, setPaused] = useState(questionsPaused);
  if (!money) return <NoProfile />;
  const { profile, an, selectedActions, facts } = money;
  const { gaps } = an;
  const f = an.forecast;
  const today = todayISO();
  const context = { a: profile.answers, an, known, skipped, estimated: profile.estimated };
  const question = nextQuestion(context);
  const progress = accuracy(context);
  const safe = an.bufferDays === null ? null : Math.round(an.bufferDays);
  const datesKnown = (known.includes('payDay') || profile.answers.monthlyIncome <= 0) && (known.includes('rentDay') || profile.answers.housingCost <= 0);
  const next = an.actions.find((a) => a.kind === 'claim') ?? selectedActions[0];
  const coming = an.upcoming.filter((u) => u.amount > 0 || u.amount <= -30).slice(0, 4);
  const staleBank = profile.newestBankDate ? diffDays(today, profile.newestBankDate) : 0;
  const balanceDate = profile.answers.balanceDate;
  const balanceAge = balanceDate ? diffDays(today, balanceDate) : null;

  const questionCard =
    question &&
    (paused ? (
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => {
          pauseQuestions(false);
          setPaused(false);
        }}
      >
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Make this more accurate</div>
            <Muted>
              You’ve answered {progress.answered} of {progress.total}. Answer another when you’re ready.
            </Muted>
          </div>
          <ChevronRight size={20} className="flex-none text-mut" aria-hidden />
        </Card>
      </button>
    ) : (
      <Card className="space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-mut">
            <span>Make this more accurate</span>
            <span className="num">
              {progress.answered} of {progress.total}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-card-2">
            <div className="h-1 rounded-full transition-all" style={{ width: `${(progress.answered / progress.total) * 100}%`, background: 'var(--chart-line)' }} />
          </div>
          <h2 className="mt-3 text-pretty font-semibold leading-snug">{question.title}</h2>
          <Muted className="mt-0.5">{question.why}</Muted>
        </div>
        <QuestionForm
          key={question.id}
          question={question}
          onSkip={() => {
            pauseQuestions(true);
            setPaused(true);
          }}
        />
      </Card>
    ));

  return (
    <div className="space-y-3">
      <TopBar title={`Hi ${profile.name}`} />

      <HeroCard>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 text-[13.5px] text-hero-mut" aria-expanded={editing}>
              {gaps.balance ? 'Your balance' : 'You have'} <Pencil size={12} aria-label="Update balance" />
            </button>
            {gaps.balance ? (
              <button type="button" onClick={() => setEditing(true)} className="mt-1 block text-left font-display text-[28px] font-semibold leading-tight tracking-tight underline decoration-1 underline-offset-4">
                Add your balance
              </button>
            ) : (
              <div className="mt-0.5 font-display text-[50px] font-semibold leading-[1.02] tracking-tight">
                <Money value={an.balance} />
              </div>
            )}
            {balanceAge !== null && balanceAge > 2 && <div className="text-xs text-hero-mut">Updated {balanceAge} days ago</div>}
          </div>
          <SafeDaysDial days={safe} />
        </div>
        {editing && <BalanceEditor current={gaps.balance ? null : an.balance} onDone={() => setEditing(false)} />}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <QuickAction main href="/snap" label="Snap" icon={<Camera size={16} aria-hidden />} />
          <QuickAction href="/ask" label="Ask" icon={<MessageCircle size={16} aria-hidden />} />
          <QuickAction href="/spending?view=transactions" label="Add" icon={<FileSpreadsheet size={16} aria-hidden />} />
        </div>
      </HeroCard>

      {profile.estimated && (
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{gaps.canJudge ? 'This is an estimate from your answers' : 'Add a bank statement'}</div>
            <Muted>{gaps.canJudge ? estimateNote(gaps, datesKnown) : 'It fills in your income and spending for you, and it’s read on this device. Or answer the questions below.'}</Muted>
          </div>
          <ButtonLink variant="soft" href="/spending?view=transactions" className="flex-none !px-4 !py-2.5">
            Add
          </ButtonLink>
        </Card>
      )}
      {!profile.estimated && staleBank > 10 && (
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Your latest transaction is {staleBank} days old</div>
            <Muted>A newer statement will make this more accurate.</Muted>
          </div>
          <ButtonLink variant="soft" href="/spending?view=transactions" className="flex-none !px-4 !py-2.5">
            Add
          </ButtonLink>
        </Card>
      )}

      <Card>
        <SectionTitle
          action={
            !gaps.canJudge ? null : f.firstRisk ? (
              <Chip tone="risk">Tight around {shortDate(f.firstRisk.date)}</Chip>
            ) : f.maxRisk.p >= 0.1 ? (
              <Chip tone="warn">Watch {shortDate(f.maxRisk.date)}</Chip>
            ) : gaps.costs.length ? (
              <Chip>Estimate so far</Chip>
            ) : (
              <Chip tone="good">Looks steady</Chip>
            )
          }
        >
          Next 90 days
        </SectionTitle>
        {gaps.canJudge ? (
          <>
            <Link href="/forecast" className="block" aria-label="See your full forecast">
              <ForecastChart base={f} height={122} compact />
              <div className="mt-1">
                <RiskStrip forecast={f} />
              </div>
            </Link>
            {f.firstRisk && (
              <p className="mt-2.5 text-sm">
                <b className="font-semibold">{Math.round(f.firstRisk.p * 100)}% chance</b> of going below £0 on {niceDate(f.firstRisk.date)}
                {f.firstRisk.trigger ? `, around ${f.firstRisk.trigger.label}` : ''}.
              </p>
            )}
          </>
        ) : (
          <Muted className="mt-1">Your forecast will show here once we know {missingBasics(facts)}.</Muted>
        )}
        <Why label="What are safe days?">
          <p>{t('safeDaysHint')}. It’s your balance plus savings, divided by what your essentials cost each day. The ring fills up at 30 days.</p>
        </Why>
      </Card>

      {/* Until there's a forecast, the question is the next step. After that, doing something comes first. */}
      {!gaps.canJudge && questionCard}
      {next && (
        <LimeCard href={next.kind === 'claim' ? '/help' : '/plan'}>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] opacity-80">Your next step</div>
            <b className="block font-display text-[17px] font-semibold leading-tight">{next.title}</b>
            <span className="text-[13px] opacity-80">About {next.effort}</span>
          </div>
          <GoCircle />
        </LimeCard>
      )}
      {gaps.canJudge && questionCard}

      <Card>
        <SectionTitle
          action={
            <Link href="/forecast" className="flex items-center text-sm font-medium text-link">
              See all <ChevronRight size={16} aria-hidden />
            </Link>
          }
        >
          Coming up
        </SectionTitle>
        <div className="mt-1 divide-y divide-hair">
          {coming.map((u, i) => (
            <Row key={`${u.date}-${i}`} icon={<CategoryIcon category={u.category} />} title={u.label} sub={niceDate(u.date)} right={<span className={u.amount > 0 ? 'text-good' : ''}>{u.amount > 0 ? '+' : ''}{gbp(u.amount, 2)}</span>} />
          ))}
          {!coming.length && <Muted className="py-3">No bills or income spotted yet. Add a statement and they’ll show up here.</Muted>}
        </div>
      </Card>
    </div>
  );
}
