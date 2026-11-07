'use client';

import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-slate-900">{children}</h2>;
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm text-slate-500 ${className}`}>{children}</p>;
}

const pillTone = {
  violet: 'bg-violet-100 text-violet-800',
  red: 'bg-rose-100 text-rose-800',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-100 text-emerald-800',
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-sky-100 text-sky-800',
};

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: keyof typeof pillTone }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${pillTone[tone]}`}>{children}</span>;
}

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
  variant?: 'primary' | 'ghost' | 'soft';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-violet-700 text-white hover:bg-violet-800 disabled:bg-violet-300',
    soft: 'bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-50',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 disabled:opacity-50',
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export type Used = 'cloud' | 'local' | 'rules';

/** Glass-box label: shows who wrote a sentence. */
export function AiBadge({ used, model }: { used?: Used | null; model?: string }) {
  if (!used) return null;
  const map = {
    cloud: { tone: 'blue' as const, text: 'Written by cloud AI' },
    local: { tone: 'green' as const, text: 'Written by on-device AI' },
    rules: { tone: 'slate' as const, text: 'Written by app rules (no AI)' },
  };
  const m = map[used];
  return (
    <span title={model} className="inline-block">
      <Pill tone={m.tone}>{m.text}</Pill>
    </span>
  );
}

export function CodeBadge() {
  return <Pill tone="violet">Computed by code</Pill>;
}

/** "Why am I seeing this?": evidence and assumptions behind an insight. */
export function Why({ children, label = 'Why am I seeing this?' }: { children: ReactNode; label?: string }) {
  return (
    <details className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
      <summary className="cursor-pointer select-none font-medium text-violet-700">{label}</summary>
      <div className="mt-2 space-y-1">{children}</div>
    </details>
  );
}

export function Stat({ label, value, sub, tone = 'slate' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'slate' | 'red' | 'green' | 'violet' }) {
  const c = { slate: 'text-slate-900', red: 'text-rose-700', green: 'text-emerald-700', violet: 'text-violet-700' }[tone];
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${c}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200';

export function Severity({ s }: { s: 'high' | 'medium' | 'low' }) {
  const m = { high: { tone: 'red' as const, t: 'Urgent' }, medium: { tone: 'amber' as const, t: 'Worth fixing' }, low: { tone: 'slate' as const, t: 'Small' } }[s];
  return <Pill tone={m.tone}>{m.t}</Pill>;
}
