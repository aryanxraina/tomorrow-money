/**
 * How long money could last, as a ring that fills up over a month (a useful first target for a
 * safety net). `light` draws it for a white card instead of the deep green hero.
 */
export function SafeDaysDial({ days, light = false, size = 78 }: { days: number | null; light?: boolean; size?: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const filled = Math.min(1, Math.max(0, days ?? 0) / 30) * circumference;
  const track = light ? 'var(--card-2)' : 'var(--hero-soft)';
  const fill = light ? (days !== null && days < 7 ? 'var(--strip-warn)' : 'var(--strip-good)') : 'var(--lime)';
  return (
    <div className="dial relative flex-none" style={{ width: size, height: size }} role="img" aria-label={days === null ? 'How long your money could last: we need more information' : `Your money could last about ${days} days`}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={track} strokeWidth="3.5" />
        {days !== null && days > 0 && <circle className="dial-fill" cx="18" cy="18" r="15.5" fill="none" stroke={fill} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} />}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        <b className="num font-display font-semibold" style={{ fontSize: size * 0.31 }}>
          {days ?? '–'}
        </b>
        <span className={`mt-0.5 text-[9.5px] ${light ? 'text-mut' : 'text-hero-mut'}`}>{days === 1 ? 'day' : 'days'}</span>
      </div>
    </div>
  );
}
