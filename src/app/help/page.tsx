'use client';

import { CircleCheck, ExternalLink, HandCoins, House, LifeBuoy, Phone, Scale, ShoppingBasket } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonLink, Card, Chip, Field, inputCls, Muted, NoProfile, PoundInput, Row, SectionTitle, Summary, TopBar, Why } from '@/components/ui';
import { gbp, shortDate, todayISO } from '@/lib/engine/dates';
import { coversNation, OTHER_NATION_HELP, type SupportItem } from '@/lib/engine/support';
import { useMoney } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { useNarration } from '@/lib/use-narration';
import type { ConfirmedSupport } from '@/lib/types';

// The three reasons people come here, so each person can go straight to theirs.
// Ids not listed under urgent or debt are ways to get more money in (benefits, grants, discounts).
const URGENT = ['daf', 'hardship', 'budgeting'];
const DEBT = ['debt-advice', 'hmrc-plan'];

const SECTIONS = [
  { id: 'urgent', title: 'I need help urgently', sub: 'Food, housing and emergency money', icon: LifeBuoy, tone: 'var(--strip-risk)' },
  { id: 'income', title: 'I want more money coming in', sub: 'Benefits, grants and discounts', icon: HandCoins, tone: 'var(--strip-good)' },
  { id: 'debt', title: 'I need help with debt', sub: 'Free advice and payment plans', icon: Scale, tone: 'var(--strip-warn)' },
] as const;

function SectionHead({ id }: { id: (typeof SECTIONS)[number]['id'] }) {
  const sec = SECTIONS.find((x) => x.id === id)!;
  const Icon = sec.icon;
  return (
    <div id={id} className="flex scroll-mt-28 items-center gap-3 px-1 pt-2">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl text-white" style={{ background: sec.tone }}>
        <Icon size={20} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-[20px] font-semibold leading-tight tracking-tight">{sec.title}</h2>
        <p className="text-[13.5px] text-mut">{sec.sub}</p>
      </div>
    </div>
  );
}

const KIND = { entitlement: { label: 'You may qualify', tone: 'good' }, discount: { label: 'Possible discount', tone: 'good' }, advice: { label: 'Free advice', tone: 'plain' } } as const;
// Shown with each item so it's clear this is a match to check, not a promise.

function ConfirmForm({ item, onDone }: { item: SupportItem; onDone: () => void }) {
  const confirmSupport = useStore((s) => s.confirmSupport);
  const [monthly, setMonthly] = useState('');
  const [oneOff, setOneOff] = useState('');
  const [date, setDate] = useState('');
  const today = todayISO();
  const m = Number(monthly) || 0;
  const o = Number(oneOff) || 0;
  return (
    <form
      className="mt-3 space-y-3 rounded-2xl bg-card-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        confirmSupport({ id: item.id, title: item.title, monthly: m, oneOff: o, oneOffDate: o ? date || null : null, confirmedOn: today });
        onDone();
      }}
    >
      <p className="text-sm font-semibold">What were you awarded?</p>
      <Field label="Amount a month" hint="Leave blank if it’s a single payment">
        <PoundInput value={monthly} onChange={setMonthly} />
      </Field>
      <Field label="Or a single payment">
        <PoundInput value={oneOff} onChange={setOneOff} />
      </Field>
      {o > 0 && (
        <Field label="When will you get it?">
          <input type="date" required min={today} className={`${inputCls} bg-card`} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!m && !o} className="flex-1">
          Add to my forecast
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ConfirmedRow({ c }: { c: ConfirmedSupport }) {
  const removeConfirmed = useStore((s) => s.removeConfirmed);
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <CircleCheck size={20} className="mt-0.5 flex-none text-good" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{c.title}</div>
        <div className="num text-[13px] text-mut">
          {c.monthly > 0 && `${gbp(c.monthly, 2)} a month`}
          {c.monthly > 0 && c.oneOff > 0 && ' and '}
          {c.oneOff > 0 && `${gbp(c.oneOff, 2)}${c.oneOffDate ? ` on ${shortDate(c.oneOffDate)}` : ''}`}
        </div>
      </div>
      <button type="button" className="text-sm font-medium text-mut" onClick={() => removeConfirmed(c.id)}>
        Remove
      </button>
    </div>
  );
}

function SupportCard({ item }: { item: SupportItem }) {
  const [confirming, setConfirming] = useState(false);
  const kind = KIND[item.kind];
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{item.title}</h3>
        <Chip tone={kind.tone}>{kind.label}</Chip>
      </div>
      <p className="mt-1 text-sm text-mut">
        <span className="font-medium text-ink">Why we suggest it: </span>
        {item.why}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ButtonLink external variant="soft" href={item.link} className="!px-4 !py-2.5 !text-sm">
          {item.linkLabel} <ExternalLink size={14} aria-hidden />
        </ButtonLink>
        {item.confirmable && !confirming && (
          <button type="button" className="text-sm font-medium text-link" onClick={() => setConfirming(true)}>
            I’ve been awarded this
          </button>
        )}
      </div>
      {confirming && <ConfirmForm item={item} onDone={() => setConfirming(false)} />}
    </Card>
  );
}

export default function Help() {
  const money = useMoney();
  const support = useNarration(money?.facts ?? null, money?.rulesText ?? null, 'support');
  const [showAll, setShowAll] = useState(false);
  if (!money) return <NoProfile />;
  const { an, profile } = money;
  const confirmedIds = new Set(profile.confirmed.map((c) => c.id));
  const items = an.support.filter((s) => !confirmedIds.has(s.id));
  const urgent = items.filter((s) => URGENT.includes(s.id));
  const debt = items.filter((s) => DEBT.includes(s.id));
  const income = items.filter((s) => !URGENT.includes(s.id) && !DEBT.includes(s.id));
  const shown = showAll ? income : income.slice(0, 4);
  const nation = profile.answers.nation;

  return (
    <div className="space-y-3">
      <TopBar title="Support" subtitle="Help you may be missing, and where to get it." />
      <Summary text={support.text} used={support.used} writing={support.writing} />
      <nav aria-label="Kinds of support" className="span-all grid gap-2 sm:grid-cols-3">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <a key={sec.id} href={`#${sec.id}`} className="support-tile block">
              <div className="flex h-full items-center gap-3 rounded-[22px] bg-card p-3.5">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl text-white" style={{ background: sec.tone }}>
                  <Icon size={22} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">{sec.title}</span>
                  <span className="block text-[13px] text-mut">{sec.sub}</span>
                </span>
              </div>
            </a>
          );
        })}
      </nav>
      <div className="px-1">
        <Why label="How do we choose these?">
          <p>We match your answers and spending against the rules for each kind of help. It means it’s worth checking, not that you’ll definitely get it. Only the official check can tell you, so we don’t estimate amounts.</p>
          <p>Your forecast counts help only once you’ve been awarded it and added the amount.</p>
        </Why>
      </div>

      {!coversNation(nation) && (nation === 'scotland' || nation === 'ni') && (
        <Card>
          <SectionTitle>Help where you live</SectionTitle>
          <p className="mt-1 text-sm text-mut">Benefits and council support work differently in {nation === 'scotland' ? 'Scotland' : 'Northern Ireland'}, and our checks only cover England and Wales so far.</p>
          <ButtonLink external variant="soft" href={OTHER_NATION_HELP[nation].link} className="mt-3 !px-4 !py-2.5 !text-sm">
            {OTHER_NATION_HELP[nation].label} <ExternalLink size={14} aria-hidden />
          </ButtonLink>
        </Card>
      )}

      {profile.confirmed.length > 0 && (
        <Card className="!py-2">
          <div className="pt-1.5 text-sm font-semibold">In your forecast</div>
          <div className="divide-y divide-hair">
            {profile.confirmed.map((c) => (
              <ConfirmedRow key={c.id} c={c} />
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-2.5">
        <SectionHead id="urgent" />
        <Card className="!py-2">
          <div className="pt-1.5 font-semibold">Help today</div>
          <Muted className="mt-0.5">Free, and you don’t need to have tried anything else first.</Muted>
          <div className="mt-1 divide-y divide-hair">
            <Row icon={<ShoppingBasket size={18} aria-hidden />} title="Find a food bank" sub="Food banks and other help near you" href="/nearby" />
            <Row icon={<House size={18} aria-hidden />} title="Shelter emergency helpline" sub="If you’re homeless or about to be" href="https://england.shelter.org.uk/get_help/helpline" external />
            <Row icon={<Phone size={18} aria-hidden />} title="Samaritans" sub="116 123, day or night, if things feel too much" href="https://www.samaritans.org/how-we-can-help/contact-samaritan/" external />
          </div>
        </Card>
        {urgent.map((s) => (
          <SupportCard key={s.id} item={s} />
        ))}
      </div>

      <div className="space-y-2.5">
        <SectionHead id="income" />
        {shown.map((s) => (
          <SupportCard key={s.id} item={s} />
        ))}
        {income.length > shown.length && (
          <Button variant="soft" className="w-full" onClick={() => setShowAll(true)}>
            Show {income.length - shown.length} more
          </Button>
        )}
        {!income.length && (
          <Card>
            <Muted>We didn’t find any benefits or discounts to check right now. The more you tell us, the more we can look for.</Muted>
          </Card>
        )}
      </div>

      <div className="space-y-2.5">
        <SectionHead id="debt" />
        {debt.map((s) => (
          <SupportCard key={s.id} item={s} />
        ))}
        <Card className="!py-2">
          <div className="pt-1.5 font-semibold">Talk to a debt adviser</div>
          <Muted className="mt-0.5">Talk to someone. These are free and confidential, and they never charge.</Muted>
          <div className="mt-1 divide-y divide-hair">
            <Row icon={<Phone size={18} aria-hidden />} title="National Debtline" sub="Free, regulated debt advice" href="https://nationaldebtline.org/" external />
            <Row icon={<Phone size={18} aria-hidden />} title="StepChange" sub="Free, regulated debt advice" href="https://www.stepchange.org/" external />
            <Row icon={<Phone size={18} aria-hidden />} title="Citizens Advice" sub="Money, benefits and your rights" href="https://www.citizensadvice.org.uk/about-us/contact-us/contact-us/contact-us/" external />
          </div>
        </Card>
      </div>

      <Muted className="px-1">This is guidance to help you decide, not regulated financial or debt advice.</Muted>
    </div>
  );
}
