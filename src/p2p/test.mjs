// Real peers over real encrypted connections, on a local DHT, so it needs no internet: npm test
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import createTestnet from 'hyperdht/testnet.js';
import { balances, HouseLedger, settleUp, until, validBill } from './ledger.mjs';

const ok = (name) => console.log(`ok   ${name}`);

// ---- Pure balance code ----
const bill = (id, pence, paidBy, split) => ({ type: 'bill', id, label: id, pence, paidBy, split });
assert.deepEqual(balances([bill('a', 3000, 'Ana', ['Ana', 'Ben', 'Cy'])]), { Ana: 2000, Ben: -1000, Cy: -1000 });
ok('even split');
const odd = balances([bill('a', 1000, 'Ana', ['Ana', 'Ben', 'Cy'])]);
assert.equal(Object.values(odd).reduce((s, v) => s + v, 0), 0);
assert.deepEqual(odd, { Ana: 666, Ben: -333, Cy: -333 });
ok('uneven split adds up to exactly zero');
assert.deepEqual(settleUp({ Ana: 2000, Ben: -1000, Cy: -1000 }), [
  { from: 'Ben', to: 'Ana', pence: 1000 },
  { from: 'Cy', to: 'Ana', pence: 1000 },
]);
ok('settle up');
for (const bad of [bill('a', -5, 'Ana', ['Ana']), bill('a', 1.5, 'Ana', ['Ana']), bill('a', 100, '', ['Ana']), bill('a', 100, 'Ana', []), { type: 'other' }, null]) assert.equal(validBill(bad), false);
ok('malformed entries rejected');

// ---- Real peers ----
const testnet = await createTestnet(3);
const dir = mkdtempSync(join(tmpdir(), 'tomorrow-p2p-'));
const ana = await new HouseLedger({ dir: join(dir, 'ana'), name: 'Ana', bootstrap: testnet.bootstrap }).ready();
const ben = await new HouseLedger({ dir: join(dir, 'ben'), name: 'Ben', houseKey: ana.houseKey, bootstrap: testnet.bootstrap }).ready();
const sameBalances = async () => JSON.stringify(await ana.balances()) === JSON.stringify(await ben.balances());

try {
  await Promise.all([ana.connect(), ben.connect()]);
  await until(() => ana.peers > 0 && ben.peers > 0, { what: 'peers to connect' });
  ok('peers found each other through the DHT');

  await ana.addBill({ label: 'Electric', pence: 6000, split: ['Ana', 'Ben'] });
  await until(async () => (await ben.bills()).length === 1, { what: 'first bill to reach Ben' });
  ok('a bill replicates to a housemate who cannot write yet');
  assert.equal(ben.canWrite, false);
  await assert.rejects(ben.addBill({ label: 'Sneaky', pence: 100, split: ['Ben'] }));
  ok('non-members cannot add bills');

  await ana.invite(ben.writerKey);
  await until(async () => (await ben.base.update(), ben.canWrite), { what: 'Ben to be able to write' });
  ok('invited housemate can write');

  await ben.addBill({ label: 'Broadband', pence: 3000, split: ['Ana', 'Ben'] });
  await until(async () => (await ana.bills()).length === 2, { what: 'Ben bill to reach Ana' });
  ok('bills flow both ways');

  // The real test: both add bills while apart, then meet again.
  await Promise.all([ana.disconnect(), ben.disconnect()]);
  await ana.addBill({ label: 'Water (added offline)', pence: 2000, split: ['Ana', 'Ben'] });
  await ben.addBill({ label: 'Cleaning (added offline)', pence: 1001, split: ['Ana', 'Ben'] });
  assert.equal((await ana.bills()).length, 3);
  assert.equal((await ben.bills()).length, 3);
  ok('both can add bills while disconnected');

  await Promise.all([ana.connect(), ben.connect()]);
  await until(async () => (await ana.bills()).length === 4 && (await ben.bills()).length === 4 && (await sameBalances()), { what: 'peers to converge' });
  const final = await ana.balances();
  assert.equal(Object.values(final).reduce((s, v) => s + v, 0), 0);
  // Ana paid 6000 + 2000, Ben paid 3000 + 1001, each owes half: Ana is up 1999 or so after the odd penny.
  assert.deepEqual(final, { Ana: 1999, Ben: -1999 });
  ok(`both converge after being apart, on the same balances: ${JSON.stringify(final)}`);
  console.log('\nALL PASSED');
} finally {
  await Promise.allSettled([ana.close(), ben.close()]);
  await testnet.destroy();
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
process.exit(0);
