// Tests the importer on your real statement files, on your computer, and prints only what's safe to share:
// the file's column names, counts, pass or fail, and how many rows agree with the running balance.
// It never prints a description, an amount, a date or a balance.
//
//   npx tsx scripts/check-statement.mts "C:\path\to\statement.csv" [more files...]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { decodeStatement, parseStatement } from '../src/lib/engine/statements';
import { CATEGORY_LABEL } from '../src/lib/engine/categorise';

const files = process.argv.slice(2);
if (!files.length) {
  console.log('Give me one or more statement files. Nothing from inside them is shown except column names and counts.');
  process.exit(2);
}

let failed = 0;
files.forEach((file, index) => {
  const label = `File ${index + 1}`;
  const r = parseStatement(decodeStatement(new Uint8Array(readFileSync(file))), basename(file), 'check');
  const months = r.from && r.to ? Math.round((new Date(r.to).getTime() - new Date(r.from).getTime()) / (30.4 * 86400000)) : 0;
  const positive = r.txns.filter((t) => t.amount > 0).length;
  const counts = new Map<string, number>();
  for (const t of r.txns) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  const unplaced = (counts.get('other') ?? 0) + r.txns.filter((t) => t.amount > 0 && t.category === 'transfers').length;

  console.log(`\n${label}`);
  console.log(`  bank recognised:    ${r.bank ?? 'no'}`);
  // Headerless files get made-up column names, so real column names are only ever a file's header row.
  console.log(`  columns:            ${r.columns.join(' | ')}`);
  console.log(`  mapped:             ${r.mapping ? Object.entries(r.mapping).filter(([k, v]) => typeof v === 'number' && k !== 'flipSign').map(([k, v]) => `${k}=${r.columns[v as number]}`).join(', ') : 'NOT WORKED OUT'}`);
  console.log(`  transactions read:  ${r.txns.length} (${positive} in, ${r.txns.length - positive} out), over about ${months} months`);
  console.log(`  rows skipped:       ${r.skipped}`);
  console.log(`  has closing balance: ${r.closingBalance !== null ? 'yes' : 'no'}`);
  if (r.balanceCheck) console.log(`  running balance:    ${r.balanceCheck.matched} of ${r.balanceCheck.checked} rows agree`);
  console.log(`  couldn't place:     ${unplaced} of ${r.txns.length}`);
  console.log(`  categories:         ${[...counts.entries()].sort((a, z) => z[1] - a[1]).map(([c, n]) => `${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]} ${n}`).join(', ')}`);
  // Problem messages are written by the importer and contain counts only.
  if (r.problems.length) console.log(`  doubts:             ${r.problems.join(' / ')}`);
  const pass = r.mapping && r.txns.length > 0 && r.problems.length === 0;
  console.log(`  result:             ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) failed++;
});
process.exit(failed ? 1 : 0);
