// How accurate would the forecast have been on your own past statements? Runs on your computer and prints
// percentages and counts only: never a description, an amount, a date or a balance.
//
//   npx tsx scripts/backtest.mts "C:\path\to\statement.csv" ["more of the same account.csv"]
//   npx tsx scripts/backtest.mts --separate "current.csv" "joint.csv"     (different accounts)
//   npx tsx scripts/backtest.mts --fixtures                               (made-up people, to check the tool)
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { backtest, type Backtest } from '../src/lib/engine/backtest';
import { decodeStatement, mergeTxns, parseStatement } from '../src/lib/engine/statements';
import type { Txn } from '../src/lib/types';
import { getPersonas } from '../tests/fixtures/personas';

function show(label: string, result: Backtest) {
  console.log(`\n${label}`);
  if (!result.horizons.length) {
    console.log('  Not enough history. This needs at least about 3 months of statements.');
    return;
  }
  console.log('  looking ahead | tested | typical miss | too hopeful by | simple guess | inside range (aim: about 80%)');
  for (const r of result.horizons) {
    const row = [`${r.horizon} days`.padEnd(13), String(r.points).padEnd(6), `${r.medianErrorPct}%`.padEnd(12), `${r.biasPct}%`.padEnd(14), `${r.naiveErrorPct}%`.padEnd(12), `${r.insideRangePct}%`];
    console.log(`  ${row.join(' | ')}`);
  }
  console.log('  Misses are a percentage of one month’s spending. The typical miss should beat the simple guess.');
  console.log('  "Too hopeful by" should be near 0. Above 0 means forecasts looked better than what happened.');

  if (result.unseen) console.log(`\n  Not predicted, in a typical 30 days: big one-offs ${result.unseen.oneOffsPct}%, moves to your own savings or accounts ${result.unseen.movesPct}%`);

  const risk = result.risk;
  if (!risk) {
    console.log('\n  Risk of going below £0: not tested, because this file has no running balance.');
    return;
  }
  console.log(`\n  Risk of going below £0, from ${risk.points} past dates${risk.alreadyBelow ? ` (${risk.alreadyBelow} more left out, already below £0)` : ''}`);
  console.log(`    Went below £0 within 30 days, from ${risk.wentBelow} of those dates. We had warned about ${risk.hits} of them.`);
  console.log(`    Warned of a risky day within 30 days, from ${risk.warnings} of those dates. ${risk.hits} of those warnings came true.`);
  console.log('    Stated risk on a day  | days | really below £0');
  for (const b of risk.buckets) console.log(`    ${b.label.padEnd(21)} | ${String(b.days).padEnd(4)} | ${b.days ? `${b.happenedPct}%` : '-'}`);
  if (risk.points < 10) console.log(`    With only ${risk.points} past dates, treat these as rough.`);
}

const args = process.argv.slice(2);
if (args[0] === '--fixtures') {
  console.log('Made-up people, so this checks the tool, not real-world accuracy.');
  for (const p of getPersonas()) show(p.name, backtest(p.txns, { closing: p.answers.balance }));
} else {
  const separate = args[0] === '--separate';
  const files = separate ? args.slice(1) : args;
  if (!files.length) {
    console.log('Give me one or more statement files. Only percentages and counts are printed.');
    process.exit(2);
  }
  let txns: Txn[] = [];
  // The closing balance of each account: the one from whichever of its files ends last.
  const closings = new Map<string, { to: string; balance: number | null }>();
  files.forEach((file, i) => {
    const account = separate ? `account-${i}` : 'account';
    const parsed = parseStatement(decodeStatement(new Uint8Array(readFileSync(file))), basename(file), account);
    txns = mergeTxns(txns, parsed.txns).txns;
    const held = closings.get(account);
    if (parsed.to && (!held || parsed.to > held.to)) closings.set(account, { to: parsed.to, balance: parsed.closingBalance });
  });
  const known = [...closings.values()];
  const closing = known.length && known.every((c) => c.balance !== null) ? known.reduce((sum, c) => sum + (c.balance ?? 0), 0) : null;
  show(`${files.length} file(s), ${txns.length} transactions`, backtest(txns, { closing }));
}
