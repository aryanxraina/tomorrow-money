// Reads bank statement files in the browser. Nothing here touches the network.
// Banks change their formats and public descriptions of them disagree, so this recognises columns by
// meaning rather than by exact layout, then checks itself using the statement's own running balance.
import type { Txn } from '../types';
import { categorise } from './categorise';
import { merchantKey } from './recurring';

export interface ColumnMap {
  date: number;
  description: number;
  amount: number | null;
  moneyOut: number | null;
  moneyIn: number | null;
  balance: number | null;
  hint: number | null; // the bank's own category or type column
  flipSign: boolean;
}

export interface ParsedStatement {
  bank: string | null;
  columns: string[];
  rows: string[][];
  mapping: ColumnMap | null;
  txns: Txn[];
  skipped: number;
  from: string | null;
  to: string | null;
  closingBalance: number | null;
  moneyIn: number;
  moneyOut: number;
  /** How many neighbouring rows agree with the running balance, when the file has one. */
  balanceCheck: { checked: number; matched: number } | null;
  /** Things the person should look at before importing. Empty means no doubts. */
  problems: string[];
}

/** Decodes a file. Some banks still export Latin-1, where a "£" isn't valid UTF-8. */
export function decodeStatement(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** Reads a UK-style date. `monthFirst` is only set when a whole file proves it is written that way. */
export function parseDate(raw: string, monthFirst = false): string | null {
  const s = (raw || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/);
  if (m) return monthFirst ? iso(fullYear(m[3]), Number(m[1]), Number(m[2])) : iso(fullYear(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})[\s-,]+(\d{4}|\d{2})\b/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return month < 0 ? null : iso(fullYear(m[3]), month + 1, Number(m[1]));
  }
  return null;
}

/** Reads money: "£1,234.56", "-12.00", "(12.00)", "12.00 DR", and a mangled "Â£" from a wrong encoding. */
export function parseMoney(raw: string): number | null {
  let s = (raw || '').replace(/[\s ]/g, '');
  if (!s) return null;
  const debit = /DR$/i.test(s);
  s = s.replace(/(?:DR|CR)$/i, '').replace(/GBP/gi, '');
  const negative = debit || /^\(.*\)$/.test(s) || s.startsWith('-') || s.endsWith('-') || /^[^\d]*-/.test(s);
  const digits = s.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}

/** Splits delimited text, handling quotes and line breaks inside quotes. */
function splitTable(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

function readTable(text: string): string[][] {
  const sample = text.split(/\r?\n/).slice(0, 40).join('\n');
  // The right delimiter gives the most rows with the same, larger number of columns.
  let best = ',';
  let bestScore = -1;
  for (const d of [',', ';', '\t', '|']) {
    const counts = splitTable(sample, d).map((r) => r.length);
    const widest = Math.max(0, ...counts);
    const score = widest > 1 ? counts.filter((c) => c === widest).length * widest : 0;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return splitTable(text, best);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// In order of preference within each role.
const ROLE = {
  date: [/^date$/, /^transaction date$/, /^posting date$/, /^posted date$/, /^completed date$/, /^value date$/, /\bdate\b/],
  description: [/^name$/, /^transaction description$/, /^description$/, /^counter party$/, /^counterparty$/, /^memo$/, /^details$/, /^narrative$/, /^merchant$/, /^payee$/, /^reference$/, /\bdescription\b/, /\bdetails\b/],
  amount: [/^amount$/, /^amount gbp$/, /^value$/, /^transaction amount$/, /^amount \w{3}$/],
  moneyOut: [/^debit amount$/, /^money out$/, /^paid out$/, /^debit$/, /^debits$/, /^withdrawals?$/, /^out$/, /^payments?$/, /\bpaid out\b/, /\bdebit\b/],
  moneyIn: [/^credit amount$/, /^money in$/, /^paid in$/, /^credit$/, /^credits$/, /^deposits?$/, /^in$/, /^receipts?$/, /\bpaid in\b/, /\bcredit\b/],
  balance: [/^balance$/, /^balance gbp$/, /^running balance$/, /^account balance$/, /\bbalance\b/],
  hint: [/^category$/, /^spending category$/, /^type$/, /^transaction type$/, /^subcategory$/],
};

function findColumn(headers: string[], patterns: RegExp[], taken: number[] = []): number | null {
  for (const p of patterns) {
    const i = headers.findIndex((h, n) => p.test(h) && !taken.includes(n));
    if (i >= 0) return i;
  }
  return null;
}

function mapFromHeader(cells: string[]): ColumnMap | null {
  const headers = cells.map(norm);
  const date = findColumn(headers, ROLE.date);
  if (date === null) return null;
  const amount = findColumn(headers, ROLE.amount);
  const moneyOut = amount === null ? findColumn(headers, ROLE.moneyOut) : null;
  const moneyIn = amount === null ? findColumn(headers, ROLE.moneyIn) : null;
  if (amount === null && (moneyOut === null || moneyIn === null)) return null;
  const description = findColumn(headers, ROLE.description, [date]);
  if (description === null) return null;
  return { date, description, amount, moneyOut, moneyIn, balance: findColumn(headers, ROLE.balance), hint: findColumn(headers, ROLE.hint, [description]), flipSign: false };
}

/** For files with no header row, such as some HSBC exports: works columns out from what's in them. */
function mapFromContents(rows: string[][]): ColumnMap | null {
  const body = rows.filter((r) => r.length >= 2).slice(0, 50);
  if (body.length < 2) return null;
  const width = Math.max(...body.map((r) => r.length));
  const share = (test: (s: string) => boolean, c: number) => body.filter((r) => test(r[c] ?? '')).length / body.length;
  const columns = Array.from({ length: width }, (_, c) => c);
  const date = columns.find((c) => share((s) => !!parseDate(s), c) >= 0.8);
  if (date === undefined) return null;
  const money = columns.filter((c) => c !== date && share((s) => parseMoney(s) !== null, c) >= 0.8);
  if (!money.length) return null;
  const text = columns.filter((c) => c !== date && !money.includes(c));
  if (!text.length) return null;
  const description = text.sort((a, z) => body.reduce((s, r) => s + (r[z]?.length ?? 0), 0) - body.reduce((s, r) => s + (r[a]?.length ?? 0), 0))[0];
  return { date, description, amount: money[0], moneyOut: null, moneyIn: null, balance: money.length > 1 ? money[money.length - 1] : null, hint: null, flipSign: false };
}

function detectBank(headers: string[], text: string, fileName: string): string | null {
  const h = new Set(headers.map(norm));
  if (h.has('transaction id') && (h.has('emoji') || h.has('local amount'))) return 'Monzo';
  if (h.has('counter party') || h.has('spending category')) return 'Starling';
  if (h.has('memo') && h.has('subcategory')) return 'Barclays';
  if (h.has('paid out') && h.has('paid in')) return 'Nationwide';
  const name = fileName.match(/monzo|starling|barclays|hsbc|lloyds|halifax|natwest|nat west|rbs|santander|nationwide/i)?.[0];
  if (name) return name.replace(/^\w|\s\w/g, (c) => c.toUpperCase()).replace('Rbs', 'RBS').replace('Hsbc', 'HSBC').replace('Natwest', 'NatWest').replace('Nat West', 'NatWest');
  if (h.has('sort code') && h.has('debit amount')) return 'Lloyds or Halifax';
  if (h.has('account name') && h.has('value')) return 'NatWest or RBS';
  if (/^\s*from:.*\n\s*account:/im.test(text.slice(0, 500))) return 'Santander';
  return null;
}

/** Santander's plain text export: blocks of "Date:", "Description:", "Amount:" and "Balance:" lines. */
function parseLabelledBlocks(text: string): string[][] | null {
  if (!/^\s*Description:/im.test(text) || !/^\s*Amount:/im.test(text)) return null;
  const rows: string[][] = [['Date', 'Description', 'Amount', 'Balance']];
  let row: string[] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.replace(/ /g, ' ').match(/^\s*(Date|Description|Amount|Balance)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'date') {
      if (row?.[0] && row[2]) rows.push(row);
      row = [value, '', '', ''];
    } else if (row) row[{ description: 1, amount: 2, balance: 3 }[key as 'description' | 'amount' | 'balance']] = value;
  }
  if (row?.[0] && row[2]) rows.push(row);
  return rows.length > 1 ? rows : null;
}

// Summary lines some statements include as if they were transactions.
const NOT_A_TXN = /\b(?:balance (?:brought|carried) forward|brought forward|carried forward|opening balance|closing balance|b\/f|c\/f)\b/i;

const pence = (n: number) => Math.round(n * 100);

/** Applies a column mapping, so the "match the columns yourself" screen can re-run it. */
export function applyMapping(parsed: Pick<ParsedStatement, 'bank' | 'columns' | 'rows'>, mapping: ColumnMap, account: string): ParsedStatement {
  const { rows, columns, bank } = parsed;
  // Numeric dates are day-first, unless a value can only be month-first (a "day" of 13 in the second place).
  const numeric = rows.map((r) => (r[mapping.date] ?? '').match(/^(\d{1,2})[/.-](\d{1,2})[/.-]/)).filter(Boolean) as RegExpMatchArray[];
  const monthFirst = numeric.some((m) => Number(m[2]) > 12) && !numeric.some((m) => Number(m[1]) > 12);

  type Row = { date: string; amount: number; description: string; balance: number | null; hint?: string };
  const good: Row[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = parseDate(r[mapping.date] ?? '', monthFirst);
    const description = (r[mapping.description] ?? '').replace(/\s+/g, ' ').trim();
    let amount: number | null;
    if (mapping.amount !== null) amount = parseMoney(r[mapping.amount] ?? '');
    else {
      const out = parseMoney(r[mapping.moneyOut ?? -1] ?? '');
      const inn = parseMoney(r[mapping.moneyIn ?? -1] ?? '');
      amount = out === null && inn === null ? null : (inn ?? 0) - Math.abs(out ?? 0);
    }
    if (!date || amount === null || NOT_A_TXN.test(description)) {
      skipped++;
      continue;
    }
    if (amount === 0) continue; // declined or pending card checks
    good.push({
      date,
      amount: mapping.flipSign ? -amount : amount,
      description: description || 'Transaction',
      balance: mapping.balance !== null ? parseMoney(r[mapping.balance] ?? '') : null,
      hint: mapping.hint !== null ? r[mapping.hint] : undefined,
    });
  }

  // Files run oldest-first or newest-first. The running balance settles it, then the dates do.
  const dates = good.map((g) => g.date);
  const newestFirst = dates.length > 1 && dates[0] > dates[dates.length - 1];
  const ordered = newestFirst ? [...good].reverse() : good;

  let balanceCheck: ParsedStatement['balanceCheck'] = null;
  let flippedMatches = 0;
  for (let i = 1; i < ordered.length; i++) {
    const [a, b] = [ordered[i - 1].balance, ordered[i].balance];
    if (a === null || b === null) continue;
    balanceCheck ??= { checked: 0, matched: 0 };
    balanceCheck.checked++;
    if (pence(b - a) === pence(ordered[i].amount)) balanceCheck.matched++;
    if (pence(b - a) === pence(-ordered[i].amount)) flippedMatches++;
  }

  const seen = new Map<string, number>();
  const txns: Txn[] = ordered.map((g) => {
    const key = `${account}|${g.date}|${pence(g.amount)}|${merchantKey(g.description)}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const description = g.description.toUpperCase();
    return { id: `${key}|${n}`, date: g.date, description, amount: g.amount, category: categorise(description, g.amount, g.hint), source: 'bank', account };
  });

  const problems: string[] = [];
  if (!txns.length) problems.push('No transactions could be read from this file.');
  if (skipped > Math.max(3, txns.length * 0.2)) problems.push(`${skipped} rows couldn’t be read.`);
  if (monthFirst) problems.push('Dates look like they are written month first, which is unusual for a UK bank. Please check the date range.');
  if (txns.length >= 5 && (txns.every((t) => t.amount > 0) || txns.every((t) => t.amount < 0))) problems.push('Every amount has the same sign, so money in and out may be mixed up. Check the totals, or if this is a credit card statement, it isn’t supported yet.');
  if (balanceCheck && balanceCheck.checked >= 3) {
    const ratio = balanceCheck.matched / balanceCheck.checked;
    if (flippedMatches / balanceCheck.checked > 0.8) problems.push('Money in and out look swapped, compared with the balance column.');
    else if (ratio < 0.8) problems.push(`Only ${balanceCheck.matched} of ${balanceCheck.checked} rows agree with the file’s running balance, so some amounts may be misread.`);
  }

  const lastWithBalance = [...ordered].reverse().find((o) => o.balance !== null);
  const moneyIn = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = -txns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const sorted = [...dates].sort();
  return {
    bank,
    columns,
    rows,
    mapping,
    txns,
    skipped,
    from: sorted[0] ?? null,
    to: sorted[sorted.length - 1] ?? null,
    closingBalance: lastWithBalance?.balance ?? null,
    moneyIn,
    moneyOut,
    balanceCheck,
    problems,
  };
}

/** Reads a whole file. If the columns can't be worked out, `mapping` is null and the person is asked. */
export function parseStatement(text: string, fileName: string, account: string): ParsedStatement {
  const blocks = parseLabelledBlocks(text);
  const table = blocks ?? readTable(text);

  // The header isn't always the first line: some banks put account details above it.
  let headerAt = -1;
  let mapping: ColumnMap | null = null;
  for (let i = 0; i < Math.min(40, table.length); i++) {
    mapping = mapFromHeader(table[i]);
    if (mapping) {
      headerAt = i;
      break;
    }
  }

  let columns: string[];
  let rows: string[][];
  if (mapping) {
    columns = table[headerAt];
    rows = table.slice(headerAt + 1);
  } else {
    mapping = mapFromContents(table);
    const width = Math.max(0, ...table.map((r) => r.length));
    columns = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
    rows = mapping ? table.filter((r) => r.length >= 2) : table;
  }

  const bank = detectBank(headerAt >= 0 ? columns : [], text, fileName);
  if (!mapping) {
    return { bank, columns, rows, mapping: null, txns: [], skipped: 0, from: null, to: null, closingBalance: null, moneyIn: 0, moneyOut: 0, balanceCheck: null, problems: ['We couldn’t work out the columns in this file.'] };
  }
  return applyMapping({ bank, columns, rows }, mapping, account);
}

/** Adds new transactions, ignoring any already held, so overlapping statements are safe to upload. */
export function mergeTxns(existing: Txn[], incoming: Txn[]): { txns: Txn[]; added: number; duplicates: number } {
  const ids = new Set(existing.map((t) => t.id));
  const fresh = incoming.filter((t) => !ids.has(t.id));
  return { txns: [...existing, ...fresh].sort((a, z) => a.date.localeCompare(z.date)), added: fresh.length, duplicates: incoming.length - fresh.length };
}
