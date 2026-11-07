// "Numbers by code, words by AI", enforced in code: AI text may only contain numbers the app gave it.

// Time spans and counts that plain sentences use ("3 months", "2 steps", "90 days").
const EVERYDAY = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 24, 30, 90, 100]);

/** Converts Devanagari and (Extended) Arabic-Indic digits so Hindi and Urdu text is checked too. */
function asciiDigits(s: string) {
  return s
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Every number in a text, reading "1,770", "1 770" and "1.770,50" as one number. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const re = /\d{1,3}(?:[,.  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;
  for (const raw of asciiDigits(text).match(re) || []) {
    const decimal = raw.match(/[.,](\d{1,2})$/);
    const whole = (decimal ? raw.slice(0, decimal.index) : raw).replace(/[,.  ]/g, '');
    const n = Number(`${whole}${decimal ? `.${decimal[1]}` : ''}`);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Numbers in `text` the app never supplied. Allows the source numbers, plus the same number rounded
 * or written with pence ("£418.00" for 418), and everyday counts. An empty list means the text is clean.
 */
export function inventedNumbers(text: string, ...sources: unknown[]): number[] {
  const allowed = new Set<number>();
  for (const src of sources) {
    for (const n of numbersIn(typeof src === 'string' ? src : JSON.stringify(src ?? ''))) {
      allowed.add(n);
      allowed.add(Math.round(n));
    }
  }
  return numbersIn(text).filter((n) => !EVERYDAY.has(n) && !allowed.has(n) && !allowed.has(Math.round(n)));
}
