'use client';

import { ChevronLeft, ChevronRight, CircleHelp, Settings } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const inputCls =
  'w-full rounded-2xl border border-transparent bg-card-2 px-4 py-3 text-base text-ink outline-none placeholder:text-mut focus:border-[var(--link)]';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ui-card rounded-[26px] bg-card p-4 ${className}`}>{children}</div>;
}

/** Deep green block for the most important thing on a screen. */
export function HeroCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`hero-card rounded-[28px] bg-hero p-[18px] text-hero-ink ${className}`}>{children}</div>;
}

/** The app's one attention colour, used at most once on a screen: the best next thing to do. */
export function LimeCard({ children, href }: { children: ReactNode; href?: string }) {
  const body = <div className="lime-card flex items-center gap-3 rounded-[26px] bg-lime px-4 py-[15px] text-lime-ink">{children}</div>;
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function GoCircle() {
  return (
    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-lime-ink text-lime">
      <ChevronRight size={20} aria-hidden />
    </span>
  );
}

/** Pounds big, pence small. Whole-pound amounts can drop the pence with `dp={0}`. */
export function Money({ value, sign = false, dp = 2, className = '' }: { value: number; sign?: boolean; dp?: 0 | 2; className?: string }) {
  const abs = Math.abs(value);
  const [whole, pence] = abs.toFixed(dp).split('.');
  return (
    <span className={`num ${className}`}>
      {value < 0 ? '−' : sign ? '+' : ''}£{Number(whole).toLocaleString('en-GB')}
      {pence !== undefined && <span className="pence">.{pence}</span>}
    </span>
  );
}

const CHIP = { risk: 'chip-risk', warn: 'chip-warn', good: 'chip-good', plain: 'chip-plain' };

export function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: keyof typeof CHIP }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${CHIP[tone]}`}>{children}</span>;
}

const BUTTON = {
  primary: 'bg-lime text-lime-ink disabled:opacity-50',
  soft: 'bg-card-2 text-ink disabled:opacity-50',
  ghost: 'bg-transparent text-mut disabled:opacity-50',
  danger: 'bg-transparent text-risk disabled:opacity-50',
};
const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition active:scale-[.98]';

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof BUTTON;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${buttonBase} ${BUTTON[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function ButtonLink({ children, href, variant = 'primary', className = '', external }: { children: ReactNode; href: string; variant?: keyof typeof BUTTON; className?: string; external?: boolean }) {
  const cls = `${buttonBase} ${BUTTON[variant]} ${className}`;
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export type Used = 'cloud' | 'local' | 'rules';

/** Small, quiet note on anything an AI wrote. Plain app text has no label. */
export function AiNote({ used }: { used?: Used | null }) {
  if (used !== 'cloud' && used !== 'local') return null;
  return <p className="mt-1.5 text-xs text-mut">{used === 'cloud' ? 'Written by cloud AI, using your numbers' : 'Written by AI on this computer, using your numbers'}</p>;
}

/** Shown while a model is writing, so slow answers don't look broken. */
export function AiWriting({ what = 'Writing' }: { what?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-mut">
      <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--link)]" />
      {what}…
    </div>
  );
}

/** The app's summary sentence for a section, in the person's own numbers. */
export function Summary({ text, used, writing }: { text: string; used?: Used | null; writing?: boolean }) {
  return (
    <div className="px-1">
      <p className="text-[15.5px] leading-relaxed text-ink">{text}</p>
      <AiNote used={used} />
      {writing && (
        <div className="mt-1.5">
          <AiWriting />
        </div>
      )}
    </div>
  );
}

/** A quiet way to see the reasoning or evidence behind something. */
export function Why({ children, label = 'Why am I seeing this?' }: { children: ReactNode; label?: string }) {
  return (
    <details className="mt-2 text-[13.5px]">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 font-medium text-mut">
        <CircleHelp size={15} aria-hidden />
        {label}
      </summary>
      <div className="mt-2 space-y-1.5 rounded-2xl bg-card-2 p-3 leading-relaxed text-mut">{children}</div>
    </details>
  );
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm text-mut ${className}`}>{children}</p>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'risk' }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-mut">{label}</div>
      <div className={`num font-display text-[26px] font-semibold leading-tight tracking-tight ${tone === 'good' ? 'text-good' : tone === 'risk' ? 'text-risk' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-mut">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Row({ icon, title, sub, right, href, external }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; href?: string; external?: boolean }) {
  const body = (
    <div className="flex items-center gap-3 py-2.5">
      {icon && <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-card-2 text-ink">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {sub && <div className="truncate text-[13px] text-mut">{sub}</div>}
      </div>
      {right && <div className="num flex-none font-semibold">{right}</div>}
    </div>
  );
  if (!href) return body;
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {body}
    </a>
  ) : (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-mut">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left text-[15px]">
      <span className="min-w-0">
        {label}
        {hint && <span className="mt-0.5 block text-[13px] text-mut">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 flex-none rounded-full transition-colors ${checked ? 'bg-lime' : 'bg-card-2'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full transition-all ${checked ? 'left-[22px] bg-lime-ink' : 'left-0.5 bg-[var(--mut)]'}`} />
      </span>
    </button>
  );
}

export function PoundInput({ value, onChange, id, label }: { value: string; onChange: (v: string) => void; id?: string; label?: string }) {
  return (
    <div className="relative">
      <span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-mut">
        £
      </span>
      <input id={id} aria-label={label} type="number" inputMode="decimal" step="0.01" min="0" className={`${inputCls} num pl-8`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Choose one of a few options. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-card-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${o.id === value ? 'bg-hero text-hero-ink' : 'text-mut'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Choose any number of options. */
export function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${on ? 'bg-hero text-hero-ink' : 'bg-card-2 text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Page heading with the way back and the way to settings. */
export function TopBar({ title, back, settings = true }: { title: string; back?: string; settings?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-1">
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <Link href={back} aria-label="Back" className="-ml-2 grid h-9 w-9 flex-none place-items-center rounded-full text-ink">
            <ChevronLeft size={24} aria-hidden />
          </Link>
        )}
        <h1 className="truncate font-display text-[26px] font-semibold tracking-tight">{title}</h1>
      </div>
      {settings && (
        <Link href="/more" aria-label="Settings and more" className="grid h-9 w-9 flex-none place-items-center rounded-full text-ink">
          <Settings size={22} aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function NoProfile() {
  return (
    <div className="space-y-3 pt-8 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Let’s get started</h1>
      <Muted>A quick check-in is all it takes to see your next 90 days.</Muted>
      <ButtonLink href="/onboarding">Start my check-in</ButtonLink>
    </div>
  );
}
