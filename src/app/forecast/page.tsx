'use client';

import { BellRing, CalendarPlus, ChevronDown, CircleCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ForecastChart, RiskLegend, RiskStrip } from '@/components/charts';
import { Button, ButtonLink, Card, Explain, Money, Muted, NoProfile, Row, SectionTitle, SourceTag, Stat, Summary, TopBar, Why } from '@/components/ui';
import { safeDays, whatIf } from '@/lib/engine/analyse';
import { addDays, gbp, niceDate, shortDate } from '@/lib/engine/dates';
import { useMoney } from '@/lib/hooks';
import { billsToIcs, downloadFile } from '@/lib/ics';
import { missingBasics } from '@/lib/narrative';
import { useNarration } from '@/lib/use-narration';

const riskyDays = (fc: { days: { pBelow0: number }[] }) => fc.days.filter((d) => d.pBelow0 >= 0.25).length;

/** The most likely balance a number of days from now, with the likely range around it. */
function Ahead({ label, day }: { label: string; day: { p10: number; p50: number; p90: number } | undefined }) {
  if (!day) return null;
  return (
    <div className="ahead-tile min-w-0 rounded-2xl bg-card-2 p-3">
      <div className="text-[12.5px] font-medium text-mut">{label}</div>
      <div className={`num mt-0.5 font-display text-[22px] font-semibold leading-tight tracking-tight ${day.p50 < 0 ? 'text-risk' : ''}`}>
        <Money value={day.p50} dp={0} />
      </div>
      <div className="num text-[11.5px] text-mut">
        likely {gbp(day.p10)} to {gbp(day.p90)}
      </div>
    </div>
  );
}

export default function Forecast() {
  const money = useMoney();
  const predict = useNarration(money?.facts ?? null, money?.rulesText ?? null, 'predict');
  const [shock, setShock] = useState<{ label: string; daily?: number; extra?: number } | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const an = money?.an;
  const shocked = useMemo(() => {
    if (!an || !shock) return null;
    return whatIf(an, { dailyDelta: shock.daily, extra: shock.extra ? [{ date: addDays(an.today, 7), amount: -shock.extra, label: shock.label }] : [] });
  }, [an, shock]);

  if (!money || !an) return <NoProfile />;
  const { profile, plan } = money;
  const f = an.forecast;
  const savings = profile.answers.savings;
  const now = an.bufferDays;
  const later = safeDays(an, f, savings);
  const withPlan = safeDays(an, plan, savings);
  const coming = an.upcoming.filter((u) => u.amount > 0 || u.amount <= -30);
  const dayAt = (n: number) => f.days[Math.min(n, f.days.length - 1)];
  const shocks = [
    { label: 'A £400 surprise bill next week', extra: 400 },
    { label: 'Income drops by 20%', daily: (-0.2 * an.summary.monthlyIn) / 30.4 },
    { label: 'Rent goes up £50 a month', daily: -50 / 30.4 },
  ];

  return (
    <div className="space-y-3">
      <TopBar title="Future" subtitle="What might happen next with your money." />
      <Summary text={predict.text} used={predict.used} writing={predict.writing} />

      {!an.gaps.canJudge && (
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Your forecast will show here</div>
            <Muted>It needs {missingBasics(money.facts)}. It only takes a moment on the Home tab.</Muted>
          </div>
          <ButtonLink variant="soft" href="/home" className="flex-none !px-4 !py-2.5">
            Add
          </ButtonLink>
        </Card>
      )}

      {an.gaps.canJudge && (
        <>
          <Card>
            <SectionTitle action={profile.estimated ? <SourceTag kind="estimate" /> : null}>Your balance ahead</SectionTitle>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <Ahead label="In 7 days" day={dayAt(7)} />
              <Ahead label="In 30 days" day={dayAt(30)} />
              <Ahead label="In 90 days" day={dayAt(89)} />
            </div>
            <div className={`mt-3 flex items-start gap-2.5 rounded-2xl p-3 ${f.firstRisk ? 'chip-risk' : f.maxRisk.p >= 0.1 ? 'chip-warn' : 'chip-good'}`}>
              {f.firstRisk || f.maxRisk.p >= 0.1 ? <TriangleAlert size={18} className="mt-0.5 flex-none" aria-hidden /> : <CircleCheck size={18} className="mt-0.5 flex-none" aria-hidden />}
              <p className="text-sm font-medium">
                {f.firstRisk
                  ? `You might run short around ${niceDate(f.firstRisk.date)}${f.firstRisk.trigger ? `, when ${f.firstRisk.trigger.label} is due` : ''}.`
                  : f.maxRisk.p >= 0.1
                    ? `Money could get tight around ${niceDate(f.maxRisk.date)}. It’s not likely, but worth watching.`
                    : 'No day in the next 90 looks likely to go below £0.'}
              </p>
            </div>
            <Explain
              label="What do these numbers mean?"
              means="Your most likely balance on each of those days, with the range it will probably fall in. They’re predictions, not promises."
              from={profile.estimated ? 'Your answers, so it’s an estimate. A bank statement makes it much more accurate.' : 'Your balance, your regular bills and income, and your usual everyday spending from your statement.'}
              todo="If a date looks tight, the Actions tab shows steps that help, and Support shows help you may be missing."
            />
          </Card>

          <Card>
            <SectionTitle
              action={
                <button type="button" className="flex items-center gap-1 text-sm font-semibold text-link" aria-expanded={showGraph} onClick={() => setShowGraph(!showGraph)}>
                  {showGraph ? 'Hide graph' : 'Show graph'}
                  <ChevronDown size={16} className={`transition-transform ${showGraph ? 'rotate-180' : ''}`} aria-hidden />
                </button>
              }
            >
              Your next 90 days
            </SectionTitle>
            {!showGraph && <Muted className="mt-0.5">Each bar is a day: green looks fine, amber is tight, red could go below £0.</Muted>}
            {showGraph && (
              <div className="graph-open mt-2">
                <ForecastChart base={shocked || f} plan={plan} height={240} />
              </div>
            )}
            {showGraph && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mut">
              <span className="inline-flex items-center gap-1.5">
                <i className="block h-[3px] w-4 rounded-full" style={{ background: 'var(--chart-line)' }} /> Most likely
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="block h-2.5 w-4 rounded-[2px]" style={{ background: 'var(--chart-band)' }} /> Likely range
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="block w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--chart-plan)' }} /> With your actions
              </span>
            </div>
            )}
            <div className="mt-4">
              <RiskStrip forecast={shocked || f} />
              <div className="mt-2">
                <RiskLegend />
              </div>
            </div>
            <Why label="How does the forecast work?">
              <p>We replay your pattern 1,000 times: bills and income on their usual dates, and everyday spending sampled from your own recent days.</p>
              <p>Money that comes in unevenly and small transfers are sampled the same way. Big one-offs are left out unless the same payer keeps paying.</p>
              <p>Energy that follows your usage is assumed to cost more in winter, while a fixed Direct Debit stays the same. Council tax follows your payment pattern. Known bills and any help you’ve confirmed are included.</p>
              <p>Risk figures are estimates and can move by about 3 points either way. The shaded range shows the middle 80% of outcomes. An AI never does this maths.</p>
            </Why>
          </Card>

          <Card>
            <SectionTitle>What if…</SectionTitle>
            <Muted className="mt-0.5">See how a change would affect your next 90 days.</Muted>
            <div className="mt-2 flex flex-wrap gap-2">
              {shocks.map((s) => (
                <Button
                  key={s.label}
                  variant={shock?.label === s.label ? 'primary' : 'soft'}
                  className="!px-3.5 !py-2 !text-sm"
                  onClick={() => {
                    setShock(shock?.label === s.label ? null : s);
                    setShowGraph(true);
                  }}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            {shocked && (
              <p className="mt-3 text-sm">
                Risky days go from {riskyDays(f)} to <b className="font-semibold text-risk">{riskyDays(shocked)}</b>, and your lowest likely balance goes from {gbp(f.lowestP50.value)} to <b className="font-semibold text-risk">{gbp(shocked.lowestP50.value)}</b>. The graph above shows this. Tap again to clear it.
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle>How long your money could last</SectionTitle>
            {now !== null && later !== null && withPlan !== null ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Stat label="Now" value={Math.round(now)} />
                <Stat label="In 90 days" value={Math.round(later)} sub="if nothing changes" tone={Math.round(later) < Math.round(now) ? 'risk' : undefined} />
                <Stat label="With your actions" value={Math.round(withPlan)} sub="in 90 days" tone="good" />
              </div>
            ) : (
              <Muted className="mt-1">We need your rent and what you spend on food to work these out.</Muted>
            )}
            <Muted className="mt-1">Days your money could cover essentials if no more came in.</Muted>
            <Explain
              label="How is this worked out?"
              means="How many days your money could pay for essentials like rent, bills and food if your income stopped."
              from="Your balance plus savings, divided by what your essentials cost each day. It counts your money only, not income that may arrive."
              todo="Ticking steps on the Actions tab shows how much longer it could last."
            />
          </Card>
        </>
      )}

      <Card>
        <SectionTitle
          action={
            coming.length > 0 && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-link"
                onClick={() => downloadFile('tomorrow-bills.ics', billsToIcs(an.upcoming.filter((u) => u.amount <= -30), `${an.today.replace(/-/g, '')}T090000Z`), 'text/calendar;charset=utf-8')}
              >
                <CalendarPlus size={16} aria-hidden /> Add to calendar
              </button>
            )
          }
        >
          Upcoming payments
        </SectionTitle>
        <div className="mt-1 divide-y divide-hair">
          {coming.slice(0, 14).map((u, i) => (
            <Row key={`${u.date}-${i}`} icon={<CategoryIcon category={u.category} />} title={u.label} sub={niceDate(u.date)} right={<span className={u.amount > 0 ? 'text-good' : ''}>{u.amount > 0 ? '+' : ''}{gbp(u.amount, 2)}</span>} />
          ))}
          {!coming.length && <Muted className="py-3">No bills or income spotted yet.</Muted>}
        </div>
        {coming.length > 0 && (
          <Link href="/reminders" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-link">
            <BellRing size={16} aria-hidden /> Get reminders in Google Calendar
          </Link>
        )}
      </Card>

      {an.tax && (
        <Card>
          <SectionTitle>Your tax bill</SectionTitle>
          <div className="mt-1 font-display text-[30px] font-semibold tracking-tight">{gbp(an.tax.total)}</div>
          <Muted>A rough estimate of what’s due on {shortDate(an.tax.due)}.</Muted>
          <Why label="How is this estimated?">
            <p>
              Self-employed income of about {gbp(an.tax.income)} a year, minus work costs of about {gbp(an.tax.expenses)}, gives a profit of {gbp(an.tax.profit)}.
              {an.tax.otherIncome > 0 ? ` Your other income of about ${gbp(an.tax.otherIncome)} a year uses up your tax-free allowance first.` : ''} That means about {gbp(an.tax.bill)} in Income Tax and Class 4 National Insurance.
            </p>
            {an.tax.paymentOnAccount > 0 && <p>Because the bill is £1,000 or more, HMRC usually also asks for a first payment on account of {gbp(an.tax.paymentOnAccount)} on the same date.</p>}
            <p>This uses this year’s rates for England and Wales and your recent income as a guide to the whole year. It’s an estimate, not tax advice.</p>
          </Why>
        </Card>
      )}
    </div>
  );
}
