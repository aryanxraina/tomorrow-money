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

/** Small models sometimes write dollars. Every amount in this app is in pounds. */
export const poundsOnly = (text: string) => text.replace(/\bUS\$|\$\s?(?=\d)/g, '£').replace(/\bUSD\s?(?=\d)/g, '£');

const ENGLISH_WORDS = /\b(the|and|your|you|with|for|have|this|that|money|month|is|are|to|of)\b/gi;

/** Rejects text in the wrong language, for example English echoed back when Polish was requested. */
export function matchesLanguage(text: string, lang: string): boolean {
  if (/[Ѐ-ӿ]/.test(text)) return false; // stray Cyrillic: small models sometimes mix scripts
  const letters = text.replace(/[^\p{L}]/gu, '').length || 1;
  const count = (re: RegExp) => (text.match(re) || []).join('').length;
  if (lang === 'hi') return count(/[ऀ-ॿ]/g) / letters > 0.5;
  if (lang === 'ur') return count(/[؀-ۿ]/g) / letters > 0.5;
  if (lang === 'pl') {
    const words = text.split(/\s+/).length || 1;
    return (text.match(ENGLISH_WORDS) || []).length / words < 0.2;
  }
  return true;
}

/**
 * Numbers in the app's own sentence that a rewrite dropped. A rewrite must keep them all,
 * except small ones, which plain English writes as words ("three months", "four things").
 */
export function droppedNumbers(rewrite: string, draft: string): number[] {
  const kept = new Set(numbersIn(rewrite));
  return numbersIn(draft).filter((n) => n > 12 && !kept.has(n));
}

/** A rewrite must not change how often money is paid: "£150 one-off" once became "£150 once a year". */
export function keepsMoneyTerms(rewrite: string, draft: string): boolean {
  return ['one-off', 'a month', 'a year'].every((term) => !draft.includes(term) || rewrite.includes(term));
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
