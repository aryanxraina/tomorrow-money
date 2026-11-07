'use client';

import { Check, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ForecastChart } from '@/components/charts';
import { Card, Chip, Muted, NoProfile, Row, SectionTitle, Stat, Summary, TopBar, Why } from '@/components/ui';
import { safeDays } from '@/lib/engine/analyse';
import { gbp } from '@/lib/engine/dates';
import { useMoney } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { useNarration } from '@/lib/use-narration';

const riskyDays = (fc: { days: { pBelow0: number }[] }) => fc.days.filter((d) => d.pBelow0 >= 0.25).length;

export default function Plan() {
  const money = useMoney();
  const setSelected = useStore((s) => s.setSelected);
  const summary = useNarration(money?.facts ?? null, money?.rulesText ?? null, 'plan');
  if (!money) return <NoProfile />;
  const { an, plan, profile, selectedIds } = money;
  const f = an.forecast;
  const savings = profile.answers.savings;
  const sdBase = Math.round(safeDays(an, f, savings));
  const sdPlan = Math.round(safeDays(an, plan, savings));
  const riskyNow = riskyDays(f);
  const riskyPlan = riskyDays(plan);
  const claims = an.actions.filter((a) => a.kind === 'claim');
  const steps = an.actions.filter((a) => a.kind !== 'claim');

  return (
    <div className="space-y-3">
      <TopBar title="Plan" />
      <Summary text={summary.text} used={summary.used} writing={summary.writing} />

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Risky days in the next 90" value={`${riskyNow} → ${riskyPlan}`} tone={riskyPlan < riskyNow ? 'good' : undefined} />
          <Stat label="Safe days in 90 days" value={`${sdBase} → ${sdPlan}`} tone={sdPlan > sdBase ? 'good' : undefined} />
        </div>
        <div className="mt-2">
          <ForecastChart base={f} plan={plan} height={170} compact />
        </div>
        <Why label="What counts as a risky day?">
          <p>A day with at least a 25% chance of your balance going below £0. Tick or untick a step below, and this updates straight away.</p>
        </Why>
      </Card>

      {claims.length > 0 && (
        <Card className="!py-2">
          <div className="pt-1.5 font-semibold">Check the help you may be missing</div>
          <Muted className="mt-0.5">Your forecast counts this once you’ve been awarded it and added the amount.</Muted>
          <div className="mt-1 divide-y divide-hair">
            {claims.slice(0, 3).map((a) => (
              <Row key={a.id} title={a.title} sub={`About ${a.effort}`} href="/help" right={<ChevronRight size={18} className="text-mut" aria-hidden />} />
            ))}
          </div>
          {claims.length > 3 && (
            <Link href="/help" className="block py-2.5 text-sm font-medium text-link">
              See all {claims.length} in Help
            </Link>
          )}
        </Card>
      )}

      {steps.length > 0 && <h2 className="px-1 pt-1 font-semibold">Steps that change your forecast</h2>}
      {steps.map((a) => {
        const on = selectedIds.includes(a.id);
        const toggle = () => setSelected(on ? selectedIds.filter((x) => x !== a.id) : [...selectedIds, a.id]);
        return (
          <Card key={a.id}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={a.title}
                onClick={toggle}
                className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-lg transition ${on ? 'bg-lime text-lime-ink' : 'bg-card-2 text-transparent'}`}
              >
                <Check size={16} strokeWidth={3} aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-snug">{a.title}</h3>
                <p className="mt-1 text-sm text-mut">{a.detail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {a.saveMonthly > 0 && <Chip tone="good">Saves {gbp(a.saveMonthly)} a month</Chip>}
                  {a.kind === 'protect' && <Chip tone="good">Eases the tight days</Chip>}
                  <Chip>{a.effort}</Chip>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-link">
                      How to do it <ExternalLink size={13} aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
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
