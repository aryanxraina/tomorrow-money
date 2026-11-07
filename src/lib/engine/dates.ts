// Fixed "today" so the demo is reproducible. Override with NEXT_PUBLIC_TODAY=YYYY-MM-DD.
export const TODAY: string = process.env.NEXT_PUBLIC_TODAY || '2026-11-07';

export function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86400000);
}

export function weekday(s: string): number {
  return toDate(s).getUTCDay(); // 0 Sun .. 6 Sat
}

export function dayOfMonth(s: string): number {
  return toDate(s).getUTCDate();
}

export function month(s: string): number {
  return toDate(s).getUTCMonth() + 1;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Same day-of-month in the month after s (clamped to month length). */
export function addMonths(s: string, n: number, dom?: number): string {
  const d = toDate(s);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const day = Math.min(dom ?? d.getUTCDate(), daysInMonth(ty, tm + 1));
  return fmt(new Date(Date.UTC(ty, tm, day)));
}

export function niceDate(s: string): string {
  return toDate(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function shortDate(s: string): string {
  return toDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const gbp = (n: number, dp = 0) =>
  (n < 0 ? '-£' : '£') + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
