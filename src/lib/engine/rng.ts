// Small seeded PRNG (mulberry32) so personas and forecasts are reproducible.
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    chance: (p: number) => next() < p,
    pick: <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
  };
}

export type Rng = ReturnType<typeof rng>;

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
