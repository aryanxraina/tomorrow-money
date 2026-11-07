/** Safe days as a ring that fills up over a month, which is a useful first target for a safety net. */
export function SafeDaysDial({ days }: { days: number | null }) {
  const circumference = 2 * Math.PI * 15.5;
  const filled = Math.min(1, Math.max(0, days ?? 0) / 30) * circumference;
  return (
    <div className="relative h-[78px] w-[78px] flex-none" role="img" aria-label={days === null ? 'Safe days not known yet' : `${days} safe days`}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--hero-soft)" strokeWidth="3.5" />
        {days !== null && days > 0 && <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--lime)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} />}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        <b className="num font-display text-[24px] font-semibold">{days ?? '–'}</b>
        <span className="mt-0.5 text-[9.5px] text-hero-mut">safe days</span>
      </div>
    </div>
  );
}
