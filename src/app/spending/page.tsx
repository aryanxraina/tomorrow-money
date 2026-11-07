'use client';

import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryTrendChart, ScoreBars } from '@/components/charts';
import { StatementImport } from '@/components/StatementImport';
import { Card, inputCls, Money, Muted, NoProfile, Row, SectionTitle, Segmented, Stat, Summary, TopBar, Why } from '@/components/ui';
import type { Analysis } from '@/lib/engine/analyse';
import { CATEGORY_LABEL, ESSENTIAL } from '@/lib/engine/categorise';
import { gbp, niceDate, shortDate } from '@/lib/engine/dates';
import { cadenceLabel, merchantLabel, txnKey } from '@/lib/engine/recurring';
import { categoryTrends } from '@/lib/engine/understand';
import { useMoney } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { useNarration } from '@/lib/use-narration';
import type { Category, Txn } from '@/lib/types';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

function TransactionRow({ t, open, onToggle }: { t: Txn; open: boolean; onToggle: () => void }) {
  const setRule = useStore((s) => s.setRule);
  const name = merchantLabel(t.description);
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="block w-full text-left">
        <Row
          icon={<CategoryIcon category={t.category} />}
          title={name}
          sub={CATEGORY_LABEL[t.category]}
          right={
            <span className={t.amount > 0 ? 'text-good' : ''}>
              {t.amount > 0 ? '+' : ''}
              {gbp(t.amount, 2)}
            </span>
          }
        />
      </button>
      {open && (
        <div className="mb-2 space-y-2 rounded-2xl bg-card-2 p-3 text-sm">
          <p className="break-words text-mut">{t.description}</p>
          <label className="block font-medium">
            <span className="mb-1 block">Category</span>
            <select className={`${inputCls} bg-card`} value={t.category} onChange={(e) => setRule(txnKey(t), e.target.value as Category)}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[13px] text-mut">This applies to every {t.amount > 0 ? 'payment from' : 'payment to'} {name}, and your forecast updates straight away.</p>
        </div>
      )}
    </div>
  );
}

function Transactions({ an, estimated }: { an: Analysis; estimated: boolean }) {
  const accounts = useStore((s) => s.accounts);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'in' | 'check'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);

  const matching = useMemo(() => {
    const q = query.trim().toUpperCase();
    return an.txns
      .filter((t) => t.source !== 'estimate')
      .filter((t) => (filter === 'in' ? t.amount > 0 : filter === 'check' ? t.category === 'other' || (t.amount > 0 && t.category === 'transfers') : true))
      .filter((t) => !q || t.description.includes(q))
      .slice()
      .reverse();
  }, [an.txns, query, filter]);
  const shown = matching.slice(0, limit);

  return (
    <div className="space-y-3">
      <StatementImport />
      {accounts.length > 0 && (
        <Card className="!py-2">
          {accounts.map((a) => (
            <Row key={a.id} title={a.name} sub={a.balanceDate ? `Balance given on ${shortDate(a.balanceDate)}` : 'No balance given'} right={a.balance !== null ? gbp(a.balance, 2) : undefined} />
          ))}
        </Card>
      )}

      {!estimated && (
        <>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mut" aria-hidden />
            <input aria-label="Search transactions" placeholder="Search" className={`${inputCls} bg-card pl-11`} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'All' },
              { id: 'in', label: 'Money in' },
              { id: 'check', label: 'To check' },
            ]}
          />
          {filter === 'check' && <Muted className="px-1">Payments we couldn’t place, and money in that might not be income. Tap one to correct it.</Muted>}
          <Card className="!py-2">
            {shown.map((t, i) => {
              const newDay = i === 0 || shown[i - 1].date !== t.date;
              return (
                <div key={t.id}>
                  {newDay && <div className={`text-[13px] font-medium text-mut ${i === 0 ? 'pt-1.5' : 'pt-3'}`}>{niceDate(t.date)}</div>}
                  <TransactionRow t={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
                </div>
              );
            })}
            {!shown.length && <Muted className="py-4 text-center">Nothing here.</Muted>}
          </Card>
          {matching.length > limit && (
            <button type="button" className="block w-full py-2 text-center text-sm font-medium text-link" onClick={() => setLimit(limit + 100)}>
              Show more
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Overview({ an }: { an: Analysis }) {
  const money = useMoney();
  const understand = useNarration(money?.facts ?? null, money?.rulesText ?? null, 'understand');
  const detect = useNarration(money?.facts ?? null, money?.rulesText ?? null, 'detect');
  const trends = useMemo(() => categoryTrends(an.txns, an.today), [an.txns, an.today]);
  const left = an.summary.monthlyIn - an.summary.monthlyOut;
  const top = an.summary.byCategory[0]?.monthly ?? 1;

  // With nothing to go on, a page of £0 would be a claim. The sentence says what would fill it in.
  if (!an.txns.length) return <Summary text={understand.text} used={understand.used} writing={understand.writing} />;

  return (
    <div className="space-y-3">
      <Summary text={understand.text} used={understand.used} writing={understand.writing} />

      <Card>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="In a month" value={an.gaps.income ? '–' : gbp(an.summary.monthlyIn)} />
          <Stat label="Out a month" value={gbp(an.summary.monthlyOut)} />
          <Stat label="Left" value={an.gaps.income ? '–' : gbp(left)} tone={an.gaps.income ? undefined : left < 0 ? 'risk' : 'good'} />
        </div>
        {an.summary.otherMoneyIn >= 1 && <Muted className="mt-2">Plus about {gbp(an.summary.otherMoneyIn)} a month in refunds and money from other people, which we don’t count as income.</Muted>}
        <div className="mt-4 space-y-3">
          {an.summary.byCategory.slice(0, 9).map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-card-2">
                <CategoryIcon category={c.category} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{CATEGORY_LABEL[c.category]}</span>
                  <span className="num font-medium">{gbp(c.monthly)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-card-2">
                  <div className="h-1.5 rounded-full" style={{ width: `${(c.monthly / top) * 100}%`, background: ESSENTIAL.includes(c.category) ? 'var(--chart-line)' : 'var(--strip-warn)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-mut">
          <span className="inline-flex items-center gap-1.5">
            <i className="block h-2 w-2 rounded-[2px]" style={{ background: 'var(--chart-line)' }} /> Essential
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="block h-2 w-2 rounded-[2px]" style={{ background: 'var(--strip-warn)' }} /> Everything else
          </span>
        </div>
        <Why label="How is this worked out?">
          <p>These are averages from the last {an.summary.windowDays} days of your data, as a monthly figure. Moves between your own accounts aren’t counted.</p>
        </Why>
      </Card>

      {trends.length > 0 && trends[0].months.length > 1 && (
        <Card>
          <SectionTitle>How your spending is changing</SectionTitle>
          <Muted className="mt-0.5">The figure is your last full month.</Muted>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {trends.map((tr) => (
              <CategoryTrendChart key={tr.category} label={CATEGORY_LABEL[tr.category]} trend={tr} />
            ))}
          </div>
        </Card>
      )}

      <Summary text={detect.text} used={detect.used} />

      {an.premiumAnnual > 0 && (
        <Card>
          <div className="text-sm text-mut">Fees and charges you’re paying</div>
          <div className="mt-0.5 font-display text-[34px] font-semibold leading-tight tracking-tight text-risk">
            <Money value={an.premiumAnnual} dp={0} /> <span className="font-sans text-base font-medium">a year</span>
          </div>
          <Why>
            <p>Added up from charges in your own transactions, as a yearly figure. People with less money are often charged more for the same things, which is sometimes called the poverty premium.</p>
          </Why>
        </Card>
      )}

      {an.problems.length > 0 && (
        <Card className="!py-1.5">
          <div className="pb-1 pt-1.5 font-semibold">Things to look at</div>
          <div className="divide-y divide-hair">
            {an.problems.map((p) => (
              <details key={p.id} className="group py-2.5">
                <summary className="flex cursor-pointer items-center gap-2.5">
                  <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: p.severity === 'high' ? 'var(--strip-risk)' : p.severity === 'medium' ? 'var(--strip-warn)' : 'var(--hair)' }} />
                  <span className="min-w-0 flex-1 font-medium leading-snug">
                    {p.title}
                    {p.severity === 'high' && <span className="sr-only"> (urgent)</span>}
                  </span>
                  {p.annualCost ? <span className="num flex-none text-sm font-semibold text-risk">{gbp(p.annualCost)}/yr</span> : null}
                  <ChevronDown size={18} className="flex-none text-mut transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="mt-2 space-y-2 pl-5 text-sm">
                  <p className="text-mut">{p.detail}</p>
                  <p>{p.fix}</p>
                  {p.evidence.length > 0 && (
                    <div className="space-y-1 rounded-2xl bg-card-2 p-3 text-[13px] text-mut">
                      {p.evidence.slice(-6).map((e) => (
                        <div key={e.id} className="num flex justify-between gap-3">
                          <span className="truncate">
                            {shortDate(e.date)}, {merchantLabel(e.description)}
                          </span>
                          <span>{gbp(e.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}

      {an.recurring.length > 0 && (
        <Card>
          <SectionTitle>Regular bills and income</SectionTitle>
          <div className="mt-1 divide-y divide-hair">
            {an.recurring.map((r) => (
              <Row key={r.key} icon={<CategoryIcon category={r.category} />} title={r.label} sub={cadenceLabel(r)} right={<span className={r.direction === 'in' ? 'text-good' : ''}>{r.direction === 'in' ? '+' : '−'}{gbp(r.last, 2)}</span>} />
            ))}
          </div>
          <Why label="Something wrong here?">
            <p>We spot these from repeating payments. If one is wrong, find it under Transactions and change its category.</p>
          </Why>
        </Card>
      )}

      {!an.gaps.income && (
        <Card>
          <SectionTitle>Your money strengths</SectionTitle>
          <Muted className="mb-3 mt-0.5">Scored 0 to 100, and for you only. These are never used for credit or pricing.</Muted>
          <ScoreBars dims={an.fingerprint} />
          <div className="mt-4 space-y-2">
            {an.groups.map((g) => (
              <div key={g.id} className="rounded-2xl bg-card-2 p-3 text-sm">
                <div className="font-semibold">{g.label}</div>
                <div className="text-mut">{g.why}</div>
                <div className="mt-0.5">{g.adapts}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function Spending() {
  const money = useMoney();
  const [view, setView] = useState<'overview' | 'transactions'>(() => (new URLSearchParams(window.location.search).get('view') === 'transactions' ? 'transactions' : 'overview'));
  if (!money) return <NoProfile />;
  return (
    <div className="space-y-3">
      <TopBar title="Spending" />
      <Segmented
        label="Spending view"
        value={view}
        onChange={setView}
        options={[
          { id: 'overview', label: 'Overview' },
          { id: 'transactions', label: 'Transactions' },
        ]}
      />
      {view === 'overview' ? <Overview an={money.an} /> : <Transactions an={money.an} estimated={money.profile.estimated} />}
    </div>
  );
}
