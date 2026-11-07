// Turns OCR text into a receipt with plain code, so prices never depend on a model.
// OCR on small print commonly reads "£" as E, { or 1 and "1" as l, so "£3.49" can arrive as "13 .49".
// The printed TOTAL is used to settle those cases: the line prices must add up to it.

export interface ReadItem {
  name: string;
  qty: number;
  price: number;
}

export interface ReadReceipt {
  merchant: string;
  date: string | null;
  items: ReadItem[];
  total: number;
  /** True when the line prices add up to the printed total. */
  reconciled: boolean;
}

const SKIP = /\b(card|cash|change|contactless|visa|mastercard|debit|credit|vat|sub\s?total|balance|tender|savings?)\b/i;
const TOTAL = /\b(total|to pay|amount due)\b/i;

/** Reads a price from an OCR fragment. `alt` is the reading if a leading "1" was really a "£". */
export function readPrice(fragment: string): { price: number; alt?: number } | null {
  // A trailing VAT marker such as "1.95 A" is not part of the price.
  const s = fragment.replace(/\s+/g, '').replace(/(\d[.,][\dO]{2})[A-Z*]$/, '$1');
  const m = s.match(/^([£E€{}([C$]?)([\dlIO]+)[.,]([\dO]{2})$/);
  if (!m) return null;
  const digits = (x: string) => x.replace(/[lI]/g, '1').replace(/O/g, '0');
  const whole = digits(m[2]);
  const price = Number(`${whole}.${digits(m[3])}`);
  if (!Number.isFinite(price)) return null;
  // No currency sign was seen and the number starts with 1: that 1 may be a misread "£".
  const alt = !m[1] && whole.length > 1 && whole.startsWith('1') ? Number(`${whole.slice(1)}.${digits(m[3])}`) : undefined;
  return alt === undefined ? { price } : { price, alt };
}

function tidyName(parts: string[]) {
  return parts
    .join(' ')
    .replace(/\bl(kg|g|l|pk)\b/g, '1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isoDate(text: string): string | null {
  const m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (!m) return null;
  const [d, mo] = [Number(m[1]), Number(m[2])];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const pence = (n: number) => Math.round(n * 100);

/**
 * Parses OCR lines (fields on a line separated by two or more spaces). Returns null if no priced
 * items were found, so the caller can ask the user to type them.
 */
export function parseReceiptText(text: string): ReadReceipt | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const merchant = lines.find((l) => /[a-z]{3}/i.test(l) && !/\d/.test(l) && !/^(demo|receipt)/i.test(l)) || '';
  const items: (ReadItem & { alt?: number })[] = [];
  let total = 0;
  for (const line of lines) {
    const parts = line.split(/\s{2,}/);
    if (parts.length < 2) continue;
    const read = readPrice(parts[parts.length - 1]);
    if (!read) continue;
    const name = tidyName(parts.slice(0, -1));
    if (TOTAL.test(name)) {
      if (!/sub/i.test(name)) total = read.price;
      continue;
    }
    if (SKIP.test(name) || !/[a-z]{2}/i.test(name)) continue;
    const q = name.match(/^(\d+)\s*x\s+(.+)$/i);
    items.push({ name: q ? q[2] : name, qty: q ? Number(q[1]) : 1, price: read.price, alt: read.alt });
  }
  if (!items.length) return null;

  // Try the alternative readings until the lines add up to the printed total.
  const flexible = items.map((it, i) => (it.alt !== undefined ? i : -1)).filter((i) => i >= 0);
  const prices = items.map((it) => it.price);
  const sum = (ps: number[]) => ps.reduce((s, p) => s + pence(p), 0);
  let reconciled = total > 0 && sum(prices) === pence(total);
  if (total > 0 && !reconciled && flexible.length <= 10) {
    for (let mask = 1; mask < 1 << flexible.length && !reconciled; mask++) {
      const tryPrices = prices.map((p, i) => {
        const bit = flexible.indexOf(i);
        return bit >= 0 && mask & (1 << bit) ? items[i].alt! : p;
      });
      if (sum(tryPrices) === pence(total)) {
        tryPrices.forEach((p, i) => (prices[i] = p));
        reconciled = true;
      }
    }
  }
  return {
    merchant: titleCase(merchant.replace(/\s{2,}/g, ' ')),
    date: isoDate(text),
    items: items.map((it, i) => ({ name: it.name, qty: it.qty, price: prices[i] })),
    total: total || sum(prices) / 100,
    reconciled,
  };
}
