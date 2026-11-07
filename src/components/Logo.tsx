/** The app's mark: a line heading up and to the right, towards tomorrow. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="flex-none">
      <rect width="32" height="32" rx="10" fill="var(--hero)" />
      <path d="M7 21.5l6-6.5 5 4 7-9" fill="none" stroke="var(--lime)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
