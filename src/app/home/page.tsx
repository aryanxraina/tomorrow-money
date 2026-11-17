'use client';

import { ArrowDownLeft, ArrowUpRight, BookOpen, Camera, ChevronRight, FileSpreadsheet, MapPin, MessageCircle, MessagesSquare, Pencil, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CommunityPreview } from '@/components/CommunityPreview';
import { ForecastChart, RiskStrip } from '@/components/charts';
import { QuestionForm } from '@/components/QuestionForm';
import { SafeDaysDial } from '@/components/SafeDaysDial';
import { Button, ButtonLink, Card, Chip, Explain, GoCircle, HeroCard, LimeCard, Money, Muted, NoProfile, PoundInput, Row, SectionTitle, SourceTag, TopBar } from '@/components/ui';
import type { Gaps } from '@/lib/engine/analyse';
import { diffDays, gbp, niceDate, shortDate, todayISO } from '@/lib/engine/dates';
import { accuracy, nextQuestion } from '@/lib/engine/questions';
import { useMoney } from '@/lib/hooks';
import { listOf, missingBasics } from '@/lib/narrative';
import { useStore } from '@/lib/store';
import { WELCOME_FLAG } from '@/lib/welcome';
import { useAutoReminders } from '@/lib/google/autoReminders';

function QuickAction({ href, icon, label, sub, main }: { href: string; icon: React.ReactNode; label: string; sub: string; main?: boolean }) {
  return (
    <Link href={href} className="quick-action block">
      <div className={`flex h-full flex-col items-center gap-1.5 rounded-[20px] px-1.5 py-3 text-center ${main ? 'bg-lime text-lime-ink' : 'bg-card-2 text-ink'}`}>
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${main ? 'bg-lime-ink text-lime' : 'bg-card'}`}>{icon}</span>
        <span className="text-[14px] font-semibold leading-tight">{label}</span>
        <span className={`text-[12px] leading-tight ${main ? 'opacity-80' : 'text-mut'}`}>{sub}</span>
      </div>
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

/** By the device's own clock: morning 5–11, afternoon 12–4, evening 5–9, and a plain hello late at night. */
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Hello';
}

function readWelcome() {
  try {
    return sessionStorage.getItem(WELCOME_FLAG) === '1';
  } catch {
    return false;
  }
}

/** A money-in or money-out figure on the hero card. Unknown stays unknown, never £0. */
function Flow({ label, value, icon }: { label: string; value: number | null; icon: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-hero-soft px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[12.5px] text-hero-mut">
        {icon}
        {label}
      </div>
      <div className="num mt-0.5 font-display text-[22px] font-semibold leading-tight">{value === null ? '–' : <Money value={value} dp={0} />}</div>
      <div className="text-[11.5px] text-hero-mut">{value === null ? 'We need more information' : 'a month'}</div>
    </div>
  );
}

export default function Home() {
  const money = useMoney();
  const known = useStore((s) => s.known);
  const skipped = useStore((s) => s.skipped);
  const [editing, setEditing] = useState(false);
  const [paused, setPaused] = useState(questionsPaused);
  const [welcome, setWelcome] = useState(readWelcome);
  // Bills go into their Google Calendar by themselves once they've allowed it.
  useAutoReminders(money?.an.upcoming, money?.an.today);
  useEffect(() => {
    // Shown once: the flag is cleared as soon as Home has seen it.
    try {
      sessionStorage.removeItem(WELCOME_FLAG);
    } catch {
      /* storage unavailable: nothing to clear */
    }
  }, []);
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
  const nextPayment = an.upcoming.find((u) => u.amount <= -30) ?? null;
  const staleBank = profile.newestBankDate ? diffDays(today, profile.newestBankDate) : 0;
  const balanceDate = profile.answers.balanceDate;
  const balanceAge = balanceDate ? diffDays(today, balanceDate) : null;
  const moneyIn = gaps.income ? null : an.summary.monthlyIn;
  // With nothing entered yet, "£0 going out" would be a claim, so it stays unknown.
  const moneyOut = an.summary.monthlyOut > 0 ? an.summary.monthlyOut : profile.estimated ? null : 0;
  const remaining = progress.total - progress.answered;

  const status = !gaps.canJudge
    ? null
    : f.firstRisk
      ? { tone: 'risk' as const, text: `Could get tight around ${shortDate(f.firstRisk.date)}` }
      : f.maxRisk.p >= 0.1
        ? { tone: 'warn' as const, text: `Worth watching around ${shortDate(f.maxRisk.date)}` }
        : gaps.costs.length
          ? { tone: 'plain' as const, text: 'Estimate so far' }
          : { tone: 'good' as const, text: 'Looking stable' };

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
          <div className="mt-1.5 h-1.5 rounded-full bg-card-2">
            <div className="progress-fill h-1.5 rounded-full" style={{ width: `${(progress.answered / progress.total) * 100}%`, background: 'var(--chart-line)' }} />
          </div>
          <h2 className="mt-3 text-pretty font-semibold leading-snug">{question.title}</h2>
          <Muted className="mt-0.5">
            <span className="font-medium text-ink">Why we ask: </span>
            {question.why}
          </Muted>
        </div>
        <QuestionForm
          key={question.id}
          question={question}
          onSkip={() => {
            pauseQuestions(true);
            setPaused(true);
          }}
        />
        <p className="text-[12.5px] text-mut">Optional. Skip anything you’re not sure about.</p>
      </Card>
    ));

  return (
    <div className="space-y-3">
      <TopBar title={`${greeting()}${profile.name ? `, ${profile.name}` : ''}`} subtitle="Your money at a glance." />

      {/* 1. How much money do I have? 2. Am I okay? */}
      <HeroCard>
        <div>
          <div className="min-w-0">
            <button type="button" onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-hero-mut" aria-expanded={editing}>
              Your money <Pencil size={12} aria-label="Update balance" />
            </button>
            {gaps.balance ? (
              <button type="button" onClick={() => setEditing(true)} className="mt-1 block text-left font-display text-[28px] font-semibold leading-tight tracking-tight underline decoration-1 underline-offset-4">
                Add your balance
              </button>
            ) : (
              <div className="count-up mt-0.5 font-display text-[46px] font-semibold leading-[1.02] tracking-tight sm:text-[52px]">
                <Money value={an.balance} />
              </div>
            )}
            {status && (
              <span className={`status-pill mt-2 inline-block rounded-full px-3 py-1 text-[12.5px] font-semibold ${status.tone === 'good' ? 'bg-lime text-lime-ink' : status.tone === 'risk' ? 'bg-[var(--strip-risk)] text-white' : status.tone === 'warn' ? 'bg-[var(--strip-warn)] text-lime-ink' : 'bg-hero-soft text-hero-ink'}`}>
                {status.text}
              </span>
            )}
            <div className="mt-1.5 text-[12.5px] text-hero-mut">
              {gaps.balance ? 'Tap to add what’s in your main account today.' : balanceDate ? `Balance you entered${balanceAge ? `, ${balanceAge === 1 ? 'yesterday' : `${balanceAge} days ago`}` : ' today'}` : 'Balance you entered'}
            </div>
          </div>
        </div>
        {editing && <BalanceEditor current={gaps.balance ? null : an.balance} onDone={() => setEditing(false)} />}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Flow label="Money coming in" value={moneyIn} icon={<ArrowDownLeft size={14} aria-hidden />} />
          <Flow label="Money going out" value={moneyOut} icon={<ArrowUpRight size={14} aria-hidden />} />
        </div>
        {profile.estimated && (moneyIn !== null || moneyOut !== null) && (
          <div className="mt-2.5">
            <SourceTag kind="estimate" onDark />
            <span className="ml-2 text-[12px] text-hero-mut">Worked out from your answers, not your bank.</span>
          </div>
        )}
      </HeroCard>

      {welcome && (
        <Card className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-lime text-lime-ink">
            <Sparkles size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Your money at a glance is ready</div>
            <Muted>{remaining > 0 ? `Answer ${Math.min(3, remaining)} more ${Math.min(3, remaining) === 1 ? 'question' : 'questions'} below to make it more accurate. You don’t have to do it now.` : 'Everything below comes from your own answers.'}</Muted>
            <div className="mt-2.5 text-[13px] font-semibold">Discover what else you can do</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                ['/ask', 'Ask a question'],
                ['/community', 'See what people are saying'],
                ['/nearby', 'Find help nearby'],
                ['/snap', 'Scan a receipt'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-full bg-card-2 px-3 py-1.5 text-[13px] font-medium">
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <button type="button" aria-label="Dismiss" className="grid h-8 w-8 flex-none place-items-center rounded-full text-mut" onClick={() => setWelcome(false)}>
            <X size={18} aria-hidden />
          </button>
        </Card>
      )}

      {/* How long the money could last, in plain words. */}
      <Card>
        <SectionTitle>How long your money could last</SectionTitle>
        <div className="mt-2 flex items-center gap-4">
          <SafeDaysDial days={safe} light size={84} />
          <div className="min-w-0">
            {safe !== null ? (
              <>
                <div className="font-display text-[26px] font-semibold leading-tight tracking-tight">
                  About {safe} {safe === 1 ? 'day' : 'days'}
                </div>
                <p className="mt-0.5 text-[14px] leading-snug text-mut">If no more money came in, what you have could cover your essentials for about this long.</p>
              </>
            ) : (
              <>
                <div className="font-display text-[22px] font-semibold leading-tight tracking-tight">We need more information</div>
                <p className="mt-0.5 text-[14px] leading-snug text-mut">Tell us your balance, rent and food costs, and we’ll work this out.</p>
              </>
            )}
          </div>
        </div>
        <Explain
          label="How is this worked out?"
          means="How many days your balance (and any savings) could pay for essentials like rent, bills and food if your income stopped. The ring fills up at 30 days, a good first safety net."
          from={profile.estimated ? 'Your balance and the essential costs from your answers. It’s an estimate until you add a bank statement.' : 'Your balance and what your essentials have cost in your bank statement.'}
          todo="Cutting an essential bill or claiming help you’re missing makes this go up. The Actions tab shows how."
        />
        <Link href="/forecast" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-link">
          View your financial outlook <ChevronRight size={16} aria-hidden />
        </Link>
      </Card>

      {/* Home is the starting point: the useful tools are here, not hidden behind a menu. */}
      <Card>
        <SectionTitle
          action={
            <Link href="/more" className="flex items-center text-sm font-medium text-link">
              All tools <ChevronRight size={16} aria-hidden />
            </Link>
          }
        >
          What would you like to do?
        </SectionTitle>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <QuickAction main href="/ask" label="Ask Tomorrow" sub="Ask a money question" icon={<MessageCircle size={20} aria-hidden />} />
          <QuickAction href="/snap" label="Scan a receipt" sub="Track what you spend" icon={<Camera size={20} aria-hidden />} />
          <QuickAction href="/nearby" label="Nearby help" sub="Find local services" icon={<MapPin size={20} aria-hidden />} />
          <QuickAction href="/community" label="Community" sub="What others are saying" icon={<MessagesSquare size={20} aria-hidden />} />
          <QuickAction href="/spending?view=transactions" label="Add statement" sub="Update your data" icon={<FileSpreadsheet size={20} aria-hidden />} />
          <QuickAction href="/learn" label="Learn" sub="Simple money guides" icon={<BookOpen size={20} aria-hidden />} />
        </div>
      </Card>

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

      {/* 4. What should I do next? Until there's a forecast, the question is the next step. */}
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

      {/* 3. What payments are coming up? */}
      <Card>
        <SectionTitle
          action={
            <Link href="/forecast" className="flex items-center text-sm font-medium text-link">
              See all <ChevronRight size={16} aria-hidden />
            </Link>
          }
        >
          Payments coming up
        </SectionTitle>
        {nextPayment && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-card-2 p-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-card">
              <CategoryIcon category={nextPayment.category} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-mut">Your next payment</div>
              <div className="truncate font-semibold">{nextPayment.label}</div>
              <div className="text-[13px] text-mut">
                {niceDate(nextPayment.date)}
                {(() => {
                  const d = diffDays(nextPayment.date, today);
                  return d === 0 ? ', today' : d === 1 ? ', tomorrow' : d > 1 ? `, in ${d} days` : '';
                })()}
              </div>
            </div>
            <span className="num flex-none font-display text-[19px] font-semibold">{gbp(nextPayment.amount, 2)}</span>
          </div>
        )}
        <div className="mt-1 divide-y divide-hair">
          {coming.map((u, i) => (
            <Row key={`${u.date}-${i}`} icon={<CategoryIcon category={u.category} />} title={u.label} sub={niceDate(u.date)} right={<span className={u.amount > 0 ? 'text-good' : ''}>{u.amount > 0 ? '+' : ''}{gbp(u.amount, 2)}</span>} />
          ))}
          {!coming.length && <Muted className="py-3">No bills or income spotted yet. Add a statement and they’ll show up here.</Muted>}
        </div>
        {coming.length > 0 && profile.estimated && !datesKnown && <p className="mt-1 text-[12.5px] text-mut">Dates are our guess until you tell us your pay day and rent day.</p>}
      </Card>

      <CommunityPreview />

      <Card>
        <SectionTitle action={status ? <Chip tone={status.tone}>{status.text}</Chip> : null}>What might happen next</SectionTitle>
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
            <Explain
              label="How do I read this?"
              means="The line is your most likely balance each day. Green days look fine, amber days are tight, and red days could go below £0."
              from="Your balance, your regular bills and income, and your usual everyday spending, replayed many times to see the range of outcomes."
              todo="Tap the chart to see it day by day on the Future tab."
            />
          </>
        ) : (
          <Muted className="mt-1">Your forecast will show here once we know {missingBasics(facts)}.</Muted>
        )}
      </Card>

      {gaps.canJudge && questionCard}
    </div>
  );
}
