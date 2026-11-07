'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CategoryTrendChart, FingerprintRadar, ForecastChart } from '@/components/charts';
import { AiBadge, AiWriting, Button, Card, CodeBadge, Muted, Pill, Severity, Stat, Why, type Used } from '@/components/ui';
import { planForecast, safeDays, whatIf } from '@/lib/engine/analyse';
import { CATEGORY_LABEL, ESSENTIAL } from '@/lib/engine/categorise';
import { addDays, gbp, niceDate, shortDate } from '@/lib/engine/dates';
import { cadenceLabel } from '@/lib/engine/recurring';
import { categoryTrends } from '@/lib/engine/understand';
import { billsToIcs, downloadIcs } from '@/lib/ics';
import { postJSON, useAnalysis, useEffectiveMode, useLang, useProfile } from '@/lib/hooks';
import { isRtl, t } from '@/lib/i18n';
import { buildFacts, templates, type StepKey } from '@/lib/narrative';
import { useStore } from '@/lib/store';

const STEPS: StepKey[] = ['understand', 'detect', 'predict', 'support', 'plan'];
const riskyDays = (fc: { days: { pBelow0: number }[] }) => fc.days.filter((d) => d.pBelow0 >= 0.25).length;
type Narration = { texts: Partial<Record<StepKey, string>>; used: Used; model?: string };
const narrationCache = new Map<string, Narration>();

export default function Dashboard() {
  const profile = useProfile();
  const an = useAnalysis(profile);
  const lang = useLang(profile);
  const mode = useEffectiveMode();
  const [step, setStep] = useState<StepKey>('understand');
  const selectedStore = useStore((s) => (profile ? s.selected[profile.id] : undefined));
  const setSelected = useStore((s) => s.setSelected);
  const [shock, setShock] = useState<{ label: string; daily?: number; extra?: number } | null>(null);
  const [finishedKey, setFinishedKey] = useState('');

  const selectedIds = useMemo(() => selectedStore ?? an?.actions.slice(0, 6).map((a) => a.id) ?? [], [selectedStore, an]);
  const selectedActions = useMemo(() => (an ? an.actions.filter((a) => selectedIds.includes(a.id)) : []), [an, selectedIds]);
  const plan = useMemo(() => (an ? planForecast(an, selectedActions) : null), [an, selectedActions]);
  const shocked = useMemo(() => {
    if (!an || !shock) return null;
    return whatIf(an, {
      dailyDelta: shock.daily,
      extra: shock.extra ? [{ date: addDays(an.today, 7), amount: -shock.extra, label: shock.label }] : [],
    });
  }, [an, shock]);
  const facts = useMemo(() => (profile && an && plan ? buildFacts(profile, an, plan, selectedActions.map((a) => a.title)) : null), [profile, an, plan, selectedActions]);
  const rules = useMemo(() => (facts ? templates(facts, lang) : null), [facts, lang]);
  const trends = useMemo(() => (profile && an ? categoryTrends(profile.txns, an.today) : []), [profile, an]);

  const narrationKey = profile ? `${profile.id}|${mode}|${lang}|${selectedIds.join(',')}|${profile.txns.length}` : '';
  const narr = narrationCache.get(narrationKey) ?? null;
  const writing = !!narrationKey && !narr && finishedKey !== narrationKey;

  useEffect(() => {
    if (!facts || !rules || narrationCache.has(narrationKey)) return;
    let alive = true;
    postJSON<{ texts: Partial<Record<StepKey, string>> | null; used: Used; model?: string }>('/api/ai/narrate', { mode, lang, facts, draft: rules })
      .then((r) => {
        if (r.texts) narrationCache.set(narrationKey, { texts: r.texts, used: r.used, model: r.model });
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setFinishedKey(narrationKey);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationKey]);

  if (!profile || !an || !plan || !rules) {
    return (
      <Card>
        <p className="mb-3">Choose a demo person or do your check-in first.</p>
        <Link href="/" className="font-semibold text-violet-700">
          Go to start
        </Link>
      </Card>
    );
  }

  const sdNow = Math.round(an.bufferDays);
  const sdBase = Math.round(safeDays(an, an.forecast, profile.answers.savings));
  const sdPlan = Math.round(safeDays(an, plan, profile.answers.savings));
  const f = an.forecast;

  // A step the AI didn't write acceptably shows the rules wording, with the rules badge.
  const narrate = (k: StepKey) => {
    const ai = narr?.texts?.[k];
    return (
      <div className="rounded-xl bg-violet-50 p-3" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
        <p className="text-[15px] leading-relaxed text-violet-950">{ai || rules[k]}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AiBadge used={ai ? narr?.used : 'rules'} model={ai ? narr?.model : undefined} />
          <CodeBadge />
          {writing && <AiWriting mode={mode} />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Headline: one number across all five steps */}
      <Card className="bg-gradient-to-br from-white to-violet-50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">{profile.isDemo ? `${profile.hero} · ${profile.tagline}` : 'Your money'}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {an.groups.map((g) => (
                <Pill key={g.id} tone="violet">
                  {g.label}
                </Pill>
              ))}
            </div>
          </div>
          <Stat label={t(lang, 'balance')} value={gbp(an.balance)} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white p-3 ring-1 ring-black/5">
          <Stat label={`${t(lang, 'safeDays')} ${t(lang, 'now')}`} value={sdNow} tone={sdNow < 14 ? 'red' : 'slate'} />
          <Stat label={t(lang, 'in90')} value={sdBase} sub={t(lang, 'ifNothing')} tone={sdBase < sdNow ? 'red' : 'slate'} />
          <Stat label={t(lang, 'withPlan')} value={sdPlan} sub={t(lang, 'in90')} tone="green" />
        </div>
        <Muted className="mt-2">{t(lang, 'safeDaysHint')}.</Muted>
        <Why>
          <p>Safe days = your balance plus savings, divided by what your essentials cost each day. They count your money only, not income that may arrive.</p>
          <p>“In 90 days” uses the most likely balance from the forecast, with and without the plan steps you have ticked. Computed by code, not by AI.</p>
        </Why>
      </Card>

      {/* Step tabs */}
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 py-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${step === s ? 'bg-violet-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${step === s ? 'bg-white/20' : 'bg-violet-100 text-violet-800'}`}>{i + 1}</span>
            {t(lang, s)}
          </button>
        ))}
      </div>

      {step === 'understand' && (
        <div className="space-y-4">
          {narrate('understand')}
          <Card>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="In / month" value={gbp(an.summary.monthlyIn)} />
              <Stat label="Out / month" value={gbp(an.summary.monthlyOut)} />
              <Stat label="Left" value={gbp(an.summary.monthlyIn - an.summary.monthlyOut)} tone={an.summary.monthlyIn - an.summary.monthlyOut < 0 ? 'red' : 'green'} />
            </div>
            <div className="mt-4 space-y-2">
              {an.summary.byCategory.slice(0, 9).map((c) => {
                const max = an.summary.byCategory[0].monthly;
                const ess = ESSENTIAL.includes(c.category);
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm">
                      <span>
                        {CATEGORY_LABEL[c.category]} {ess && <span className="text-xs text-slate-400">essential</span>}
                      </span>
                      <span className="font-medium">{gbp(c.monthly)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${ess ? 'bg-violet-600' : 'bg-amber-400'}`} style={{ width: `${(c.monthly / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <Why label="Bills and income we spotted">
              {an.recurring.map((r) => (
                <div key={r.key} className="flex justify-between">
                  <span>
                    {r.label} <span className="text-xs text-slate-400">{cadenceLabel(r)}</span>
                  </span>
                  <span className={r.direction === 'in' ? 'text-emerald-700' : ''}>
                    {r.direction === 'in' ? '+' : '-'}
                    {gbp(r.last, 2)}
                    {r.variable ? ' (varies)' : ''}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-xs">Averages use the last 13 weeks. Categories come from rules first; AI only handles what rules can’t place.</p>
            </Why>
          </Card>
          {trends.length > 0 && trends[0].months.length > 1 && (
            <Card>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">How your spending is changing</h3>
                <CodeBadge />
              </div>
              <Muted>Your biggest categories, month by month. The figure is the last full month.</Muted>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {trends.map((tr) => (
                  <CategoryTrendChart key={tr.category} label={CATEGORY_LABEL[tr.category]} trend={tr} />
                ))}
              </div>
              <Why>
                <p>Added up from your transactions, by calendar month. This month is left out because it isn’t finished.</p>
                <table className="mt-1 w-full text-xs">
                  <tbody>
                    {trends.map((tr) => (
                      <tr key={tr.category}>
                        <th scope="row" className="py-0.5 text-left font-medium">
                          {CATEGORY_LABEL[tr.category]}
                        </th>
                        <td className="py-0.5 text-right">{tr.months.map((m) => gbp(m.amount)).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Why>
            </Card>
          )}
          <Card>
            <h3 className="font-semibold">Your Money Fingerprint</h3>
            <Muted>Six strengths, scored 0–100. Higher is stronger. This is for you only and is never used for credit or pricing.</Muted>
            <FingerprintRadar dims={an.fingerprint} />
            <div className="space-y-2">
              {an.groups.map((g) => (
                <div key={g.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="font-medium">{g.label}</div>
                  <div className="text-sm text-slate-600">{g.why}</div>
                  <div className="text-sm text-violet-800">What changes for you: {g.adapts}</div>
                </div>
              ))}
            </div>
            <Why label="How the scores work">
              {an.fingerprint.map((d) => (
                <div key={d.id}>
                  <b>{d.label}</b>: {d.score}/100. {d.detail}.
                </div>
              ))}
              <p className="pt-1">
                Not you? <Link href="/onboarding" className="font-medium text-violet-700">Update your answers</Link>
              </p>
            </Why>
          </Card>
        </div>
      )}

      {step === 'detect' && (
        <div className="space-y-3">
          {narrate('detect')}
          {an.premiumAnnual > 0 && (
            <Card className="bg-rose-50 ring-rose-100">
              <div className="text-sm text-rose-900">Extra costs you pay for having less money (the “poverty premium”)</div>
              <div className="text-3xl font-bold text-rose-800">{gbp(an.premiumAnnual)} a year</div>
              <Muted>Fees taken from your transactions, plus estimates where marked.</Muted>
            </Card>
          )}
          {an.problems.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{p.title}</div>
                <Severity s={p.severity} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{p.detail}</p>
              {p.annualCost ? (
                <div className="mt-1 text-sm font-medium text-rose-700">
                  {gbp(p.annualCost)} a year{p.estimate ? ' (estimate)' : ''}
                </div>
              ) : null}
              <p className="mt-2 text-sm text-violet-800">Fix: {p.fix}</p>
              <Why>
                {p.evidence.length > 0 ? (
                  p.evidence.slice(-6).map((e) => (
                    <div key={e.id} className="flex justify-between">
                      <span>
                        {shortDate(e.date)} · {e.description}
                      </span>
                      <span>{gbp(e.amount, 2)}</span>
                    </div>
                  ))
                ) : (
                  <p>The app’s code worked this out from your balance, your answers and the last 13 weeks of spending. No AI was involved.</p>
                )}
              </Why>
            </Card>
          ))}
        </div>
      )}

      {step === 'predict' && (
        <div className="space-y-3">
          {narrate('predict')}
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your next 90 days</h3>
              <CodeBadge />
            </div>
            {f.firstRisk ? (
              <p className="mt-1 text-sm">
                <b className="text-rose-700">{Math.round(f.firstRisk.p * 100)}% chance</b> of going below £0 on <b>{niceDate(f.firstRisk.date)}</b>
                {f.firstRisk.trigger ? ` (around ${f.firstRisk.trigger.label}, ${gbp(-f.firstRisk.trigger.amount)})` : ''}.
                {f.maxRisk.p > f.firstRisk.p && (
                  <>
                    {' '}
                    The risk reaches <b className="text-rose-700">{Math.round(f.maxRisk.p * 100)}%</b> by <b>{niceDate(f.maxRisk.date)}</b>.
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-emerald-700">Low risk of running out in the next 90 days.</p>
            )}
            <ForecastChart base={shocked || f} plan={plan} />
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                <span className="inline-block h-2 w-4 rounded bg-violet-300" /> likely range
              </span>
              <span>
                <span className="inline-block h-0.5 w-4 bg-violet-700 align-middle" /> most likely
              </span>
              <span>
                <span className="inline-block h-0.5 w-4 bg-emerald-600 align-middle" /> with your plan
              </span>
            </div>
            <div className="mt-3">
              <div className="mb-1 text-sm font-medium">What if…</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '£400 car repair next week', extra: 400 },
                  { label: 'Hours cut by 20%', daily: (-0.2 * an.summary.monthlyIn) / 30.4 },
                  { label: 'Rent goes up £50', daily: -50 / 30.4 },
                ].map((s) => (
                  <Button key={s.label} variant={shock?.label === s.label ? 'primary' : 'soft'} className="!px-3 !py-1.5" onClick={() => setShock(shock?.label === s.label ? null : s)}>
                    {s.label}
                  </Button>
                ))}
              </div>
              {shocked && (
                <p className="mt-2 text-sm">
                  With “{shock?.label}”, risky days go from {riskyDays(f)} to <b className="text-rose-700">{riskyDays(shocked)}</b>, and your lowest likely balance goes from {gbp(f.lowestP50.value)} to{' '}
                  <b className="text-rose-700">{gbp(shocked.lowestP50.value)}</b>.
                </p>
              )}
            </div>
            <Why label="How the forecast works">
              <p>We replay your real spending 400 times: bills and income on their usual dates, everyday spending sampled from your own past weeks.</p>
              <p>Energy is assumed about 30% higher in winter. Council tax follows 10 monthly payments (April to January). Known bills and lump sums you told us about are included.</p>
              <p>The shaded band shows the middle 80% of outcomes. The AI never does this maths; it only explains the result.</p>
              <p>Risk figures are estimates and can move by about 5 points either way.</p>
            </Why>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Coming up</h3>
              <Button
                variant="soft"
                className="!px-3 !py-1.5"
                onClick={() => {
                  const bills = an.upcoming.filter((u) => u.amount <= -30);
                  downloadIcs(billsToIcs(bills, `${an.today.replace(/-/g, '')}T090000Z`), 'tomorrow-bills.ics');
                }}
              >
                📅 Add to calendar
              </Button>
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              {an.upcoming.filter((u) => u.amount > 0 || u.amount <= -30).slice(0, 12).map((u, i) => (
                <div key={i} className="flex justify-between py-1.5 text-sm">
                  <span>
                    <span className="inline-block w-24 text-slate-500">{niceDate(u.date)}</span>
                    {u.label}
                  </span>
                  <span className={u.amount > 0 ? 'text-emerald-700' : 'font-medium'}>{gbp(u.amount)}</span>
                </div>
              ))}
            </div>
            {an.tax && (
              <Why label="How we estimated your tax bill">
                <p>
                  Income about {gbp(an.tax.income)} a year, minus work costs about {gbp(an.tax.expenses)} = profit {gbp(an.tax.profit)}. Income tax 20% and Class 4 National
                  Insurance 6% above the £12,570 personal allowance = {gbp(an.tax.bill)}.
                </p>
                {an.tax.paymentOnAccount > 0 && <p>Because the bill is over £1,000, HMRC usually also asks for a first payment on account ({gbp(an.tax.paymentOnAccount)}) on the same date.</p>}
                <p>This is an estimate, not tax advice.</p>
              </Why>
            )}
          </Card>
        </div>
      )}

      {step === 'support' && (
        <div className="space-y-3">
          {narrate('support')}
          {an.support.length > 0 && (
            <Card className="bg-emerald-50 ring-emerald-100">
              <div className="text-sm text-emerald-900">Money you may be missing</div>
              <div className="text-3xl font-bold text-emerald-800">
                {gbp(an.supportMonthly)}
                <span className="text-base font-medium"> a month</span>
              </div>
              {an.supportOneOff > 0 && <div className="text-sm text-emerald-900">plus {gbp(an.supportOneOff)} one-off</div>}
              <Muted>Estimates. Always check with the official calculator or adviser linked.</Muted>
            </Card>
          )}
          {an.support.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{s.title}</div>
                <Pill tone={s.kind === 'entitlement' ? 'green' : s.kind === 'advice' ? 'blue' : s.kind === 'local' ? 'amber' : 'violet'}>
                  {s.kind === 'entitlement' ? 'You may be entitled' : s.kind === 'advice' ? 'Free advice' : s.kind === 'local' ? 'Near you' : 'Discount'}
                </Pill>
              </div>
              <p className="mt-1 text-sm text-slate-600">{s.why}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-700">
                  {s.estMonthly ? `about ${gbp(s.estMonthly)}/month` : ''}
                  {s.oneOff ? ` ${s.estMonthly ? '+ ' : ''}${gbp(s.oneOff)} one-off` : ''}
                </span>
                {s.link ? (
                  <a href={s.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-violet-700">
                    {s.linkLabel || 'Check'} →
                  </a>
                ) : s.kind === 'local' ? (
                  <Link href="/pay" className="text-sm font-semibold text-violet-700">
                    Open Pay →
                  </Link>
                ) : (
                  <span className="text-sm text-slate-500">{s.linkLabel}</span>
                )}
              </div>
              <Why>
                <p>The app’s rules matched this to your answers and spending. It means you are likely to qualify, not that you definitely will.</p>
                {(s.estMonthly || s.oneOff) && <p>The amount is an estimate. Only the official check can confirm it.</p>}
              </Why>
            </Card>
          ))}
          {!an.support.length && <Card>No extra support found right now.</Card>}
        </div>
      )}

      {step === 'plan' && (
        <div className="space-y-3">
          {narrate('plan')}
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Risky days, next 90"
                value={`${riskyDays(f)} → ${riskyDays(plan)}`}
                sub="days with a 25%+ chance of going below £0"
                tone={riskyDays(plan) < riskyDays(f) ? 'green' : 'slate'}
              />
              <Stat label="Safe days in 90 days" value={`${sdBase} → ${sdPlan}`} tone="green" />
            </div>
            <ForecastChart base={f} plan={plan} height={200} />
          </Card>
          {an.actions.map((a) => {
            const on = selectedIds.includes(a.id);
            return (
              <Card key={a.id} className={on ? 'ring-2 ring-violet-300' : ''}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setSelected(profile.id, on ? selectedIds.filter((x) => x !== a.id) : [...selectedIds, a.id])}
                    className="mt-1 h-5 w-5 accent-violet-700"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{a.title}</div>
                    <p className="text-sm text-slate-600">{a.detail}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {a.saveMonthly > 0 && <Pill tone="green">saves {gbp(a.saveMonthly)}/month</Pill>}
                      {a.oneOff ? <Pill tone="green">+{gbp(a.oneOff)} one-off</Pill> : null}
                      {a.kind === 'protect' && <Pill tone="blue">protects your cash flow</Pill>}
                      <Pill>{a.effort}</Pill>
                    </div>
                  </div>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-violet-700">
                      Do it →
                    </a>
                  )}
                </label>
                <Why>
                  <p>Steps are ranked by how much they save for the effort they take. Ticking or unticking one re-runs your forecast above.</p>
                  {a.saveMonthly > 0 && <p>The saving is an estimate worked out by the app’s code.</p>}
                </Why>
              </Card>
            );
          })}
          <Card className="bg-slate-50">
            <Muted>
              This is guidance to help you decide, not regulated financial or debt advice. For debt problems, free regulated advisers such as StepChange,
              National Debtline or Citizens Advice can help.
            </Muted>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        {step !== 'plan' && (
          <Button onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}>
            {t(lang, 'next')}: {t(lang, STEPS[STEPS.indexOf(step) + 1])} →
          </Button>
        )}
      </div>
    </div>
  );
}
