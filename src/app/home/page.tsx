'use client';

import { Camera, ChevronRight, FileSpreadsheet, MessageCircle, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ForecastChart, RiskStrip } from '@/components/charts';
import { SafeDaysDial } from '@/components/SafeDaysDial';
import { Button, ButtonLink, Card, Chip, GoCircle, HeroCard, LimeCard, Money, Muted, NoProfile, PoundInput, Row, SectionTitle, TopBar, Why } from '@/components/ui';
import { diffDays, gbp, niceDate, shortDate, todayISO } from '@/lib/engine/dates';
import { useMoney } from '@/lib/hooks';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

function QuickAction({ href, icon, label, main }: { href: string; icon: React.ReactNode; label: string; main?: boolean }) {
  return (
    <Link href={href} className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13.5px] font-medium ${main ? 'bg-lime text-lime-ink' : 'bg-hero-soft text-hero-ink'}`}>
      {icon}
      {label}
    </Link>
  );
}

function BalanceEditor({ current, onDone }: { current: number; onDone: () => void }) {
  const saveAnswers = useStore((s) => s.saveAnswers);
  const [value, setValue] = useState(Math.abs(current).toFixed(2));
  const [overdrawn, setOverdrawn] = useState(current < 0);
  return (
    <form
      className="mt-2 space-y-2 text-ink"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (!Number.isNaN(n)) saveAnswers({ balance: overdrawn ? -Math.abs(n) : n, balanceDate: todayISO() }, ['balance']);
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

export default function Home() {
  const money = useMoney();
  const [editing, setEditing] = useState(false);
  if (!money) return <NoProfile />;
  const { profile, an, selectedActions } = money;
  const f = an.forecast;
  const today = todayISO();
  const safe = Math.round(an.bufferDays);
  const next = an.actions.find((a) => a.kind === 'claim') ?? selectedActions[0];
  const coming = an.upcoming.filter((u) => u.amount > 0 || u.amount <= -30).slice(0, 4);
  const staleBank = profile.newestBankDate ? diffDays(today, profile.newestBankDate) : 0;
  const balanceDate = profile.answers.balanceDate;
  const balanceAge = balanceDate ? diffDays(today, balanceDate) : null;

  return (
    <div className="space-y-3">
      <TopBar title={`Hi ${profile.name}`} />

      <HeroCard>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 text-[13.5px] text-hero-mut" aria-expanded={editing}>
              You have <Pencil size={12} aria-label="Update balance" />
            </button>
            <div className="mt-0.5 font-display text-[50px] font-semibold leading-[1.02] tracking-tight">
              <Money value={an.balance} />
            </div>
            {balanceAge !== null && balanceAge > 2 && <div className="text-xs text-hero-mut">Updated {balanceAge} days ago</div>}
          </div>
          <SafeDaysDial days={safe} />
        </div>
        {editing && <BalanceEditor current={an.balance} onDone={() => setEditing(false)} />}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <QuickAction main href="/snap" label="Snap" icon={<Camera size={16} aria-hidden />} />
          <QuickAction href="/ask" label="Ask" icon={<MessageCircle size={16} aria-hidden />} />
          <QuickAction href="/spending?view=transactions" label="Add" icon={<FileSpreadsheet size={16} aria-hidden />} />
        </div>
      </HeroCard>

      {profile.estimated && (
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">This is an estimate from your answers</div>
            <Muted>Add a bank statement to base it on what really happens.</Muted>
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
          action={f.firstRisk ? <Chip tone="risk">Tight around {shortDate(f.firstRisk.date)}</Chip> : f.maxRisk.p >= 0.1 ? <Chip tone="warn">Watch {shortDate(f.maxRisk.date)}</Chip> : <Chip tone="good">Looks steady</Chip>}
        >
          Next 90 days
        </SectionTitle>
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
        <Why label="What are safe days?">
          <p>{t('safeDaysHint')}. It’s your balance plus savings, divided by what your essentials cost each day. The ring fills up at 30 days.</p>
        </Why>
      </Card>

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
