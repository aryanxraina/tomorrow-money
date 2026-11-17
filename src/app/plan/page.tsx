'use client';

import { CalendarClock, CalendarDays, Check, ChevronRight, ExternalLink, Sun } from 'lucide-react';
import Link from 'next/link';
import { ForecastChart } from '@/components/charts';
import { Card, Chip, Explain, Muted, NoProfile, SectionTitle, Stat, Summary, TopBar } from '@/components/ui';
import { safeDays } from '@/lib/engine/analyse';
import { gbp } from '@/lib/engine/dates';
import type { Action } from '@/lib/engine/plan';
import { useMoney } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { useNarration } from '@/lib/use-narration';

const riskyDays = (fc: { days: { pBelow0: number }[] }) => fc.days.filter((d) => d.pBelow0 >= 0.25).length;

const WHEN = [
  { label: 'Do today', icon: Sun },
  { label: 'This week', icon: CalendarDays },
  { label: 'This month', icon: CalendarClock },
] as const;

/** What doing it would change, in plain words. Help is never given a £ figure until it's awarded. */
function benefit(a: Action) {
  if (a.kind === 'claim') return 'Help you may be missing';
  if (a.saveMonthly > 0) return `Saves about ${gbp(a.saveMonthly)} a month`;
  if (a.kind === 'protect') return 'Eases the tight days';
  return null;
}

function ActionCard({ a, when, on, toggle }: { a: Action; when?: (typeof WHEN)[number]; on: boolean; toggle: () => void }) {
  const gain = benefit(a);
  const When = when?.icon;
  return (
    <Card className={on ? 'action-done' : ''}>
      {when && When && (
        <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-link">
          <When size={14} aria-hidden /> {when.label}
        </div>
      )}
      <div className="flex items-start gap-3">
        {a.kind !== 'claim' && (
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={a.title}
            onClick={toggle}
            className={`check-box mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg transition ${on ? 'bg-lime text-lime-ink' : 'bg-card-2 text-transparent ring-1 ring-inset ring-[var(--hair)]'}`}
          >
            <Check size={17} strokeWidth={3} aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{a.title}</h3>
          <p className="mt-1 text-sm text-mut">{a.detail}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {gain && <Chip tone="good">{gain}</Chip>}
            <Chip>About {a.effort}</Chip>
            {a.link && (
              <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-link">
                How to do it <ExternalLink size={13} aria-hidden />
              </a>
            )}
          </div>
          {a.kind === 'claim' ? (
            <Link href="/help" className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-link">
              Check on the Support tab <ChevronRight size={15} aria-hidden />
            </Link>
          ) : (
            <p className={`mt-2.5 text-[13px] font-medium ${on ? 'text-good' : 'text-mut'}`}>{on ? 'In your plan. Your forecast includes it.' : 'Tick the box to add it to your plan and see the difference.'}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Plan() {
  const money = useMoney();
  const setSelected = useStore((s) => s.setSelected);
  const summary = useNarration(money?.facts ?? null, money?.rulesText ?? null, 'plan');
  if (!money) return <NoProfile />;
  const { an, plan, profile, selectedIds } = money;
  const card = (a: Action, when?: (typeof WHEN)[number]) => {
    const on = selectedIds.includes(a.id);
    return <ActionCard key={a.id} a={a} when={when} on={on} toggle={() => setSelected(on ? selectedIds.filter((x) => x !== a.id) : [...selectedIds, a.id])} />;
  };
  const f = an.forecast;
  const savings = profile.answers.savings;
  const sdBase = safeDays(an, f, savings);
  const sdPlan = safeDays(an, plan, savings);
  const riskyNow = riskyDays(f);
  const riskyPlan = riskyDays(plan);

  // Three priorities, not fifteen: something quick for today, then one for the week and one for the month.
  const quick = an.actions.find((a) => a.effortMins <= 30) ?? an.actions[0];
  const rest = an.actions.filter((a) => a !== quick);
  const top = [quick, rest[0], rest[1]].filter((a): a is Action => !!a);
  const more = an.actions.filter((a) => !top.includes(a));

  return (
    <div className="space-y-3">
      <TopBar title="Actions" subtitle="Things you can do next, and why each one helps." />
      <Summary text={summary.text} used={summary.used} writing={summary.writing} />

      {an.gaps.canJudge && (
        <Card>
          <SectionTitle>What your plan changes</SectionTitle>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat label="Days that could go below £0, next 90" value={`${riskyNow} → ${riskyPlan}`} tone={riskyPlan < riskyNow ? 'good' : undefined} />
            {sdBase !== null && sdPlan !== null && <Stat label="How long your money could last, in 90 days" value={`${Math.round(sdBase)} → ${Math.round(sdPlan)} days`} tone={Math.round(sdPlan) > Math.round(sdBase) ? 'good' : undefined} />}
          </div>
          <div className="mt-2">
            <ForecastChart base={f} plan={plan} height={170} compact />
          </div>
          <Explain
            label="What do these numbers mean?"
            means="The first number is today’s forecast. The second is what happens if you do the steps you’ve ticked."
            from="A risky day has at least a 25% chance of your balance going below £0. The dashed line on the chart is your forecast with your plan."
            todo="Tick or untick a step below, and these update straight away."
          />
        </Card>
      )}

      {top.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="px-1 pt-1 font-display text-[20px] font-semibold tracking-tight">Your top three</h2>
          {top.map((a, i) => card(a, WHEN[i]))}
        </div>
      )}

      {more.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="px-1 pt-1 font-semibold">More ideas</h2>
          <Muted className="-mt-1 px-1">When you’re ready. There’s no need to do them all.</Muted>
          {more.map((a) => card(a))}
        </div>
      )}

      {!an.actions.length && (
        <Card>
          <SectionTitle>No steps to suggest yet</SectionTitle>
          <Muted className="mt-1">Add a statement or answer a few more questions, and we’ll look again.</Muted>
        </Card>
      )}

      <Muted className="px-1">This is guidance to help you decide, not regulated financial or debt advice. For debt problems, free regulated advisers such as StepChange, National Debtline or Citizens Advice can help.</Muted>
    </div>
  );
}
