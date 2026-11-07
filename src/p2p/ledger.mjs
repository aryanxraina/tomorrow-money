// A shared-house bill ledger with no server. Each housemate keeps their own append-only log (Hypercore,
// managed by Corestore). Autobase merges the logs into one agreed order. Hyperswarm finds housemates and
// connects them, encrypted. Numbers by code: balances are a pure function of the agreed entries.
import Autobase from 'autobase';
import b4a from 'b4a';
import Corestore from 'corestore';
import Hyperswarm from 'hyperswarm';

const isName = (s) => typeof s === 'string' && s.length > 0 && s.length <= 40;

/** Peers can send anything, so an entry only counts if it is well formed. Must be deterministic. */
export function validBill(v) {
  return (
    v?.type === 'bill' &&
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    Number.isSafeInteger(v.pence) &&
    v.pence > 0 &&
    isName(v.paidBy) &&
    Array.isArray(v.split) &&
    v.split.length > 0 &&
    v.split.every(isName)
  );
}

/**
 * What each person is up or down, in whole pence, from bills in their agreed order.
 * Positive means they are owed money. Spare pence from a split go to names in alphabetical
 * order, so every peer gets the same answer and the total is always exactly zero.
 */
export function balances(entries) {
  const out = {};
  const change = (name, pence) => (out[name] = (out[name] || 0) + pence);
  for (const bill of entries) {
    if (!validBill(bill)) continue;
    const people = [...new Set(bill.split)].sort();
    const share = Math.floor(bill.pence / people.length);
    let spare = bill.pence - share * people.length;
    change(bill.paidBy, bill.pence);
    for (const person of people) {
      change(person, -share - (spare > 0 ? 1 : 0));
      if (spare > 0) spare--;
    }
  }
  return out;
}

/** The fewest simple payments that settle up: largest debtor pays largest creditor. */
export function settleUp(bal) {
  const sorted = (sign) =>
    Object.entries(bal)
      .filter(([, v]) => v * sign > 0)
      .map(([name, v]) => ({ name, left: Math.abs(v) }))
      .sort((a, z) => z.left - a.left || a.name.localeCompare(z.name));
  const owe = sorted(-1);
  const owed = sorted(1);
  const payments = [];
  while (owe.length && owed.length) {
    const pence = Math.min(owe[0].left, owed[0].left);
    payments.push({ from: owe[0].name, to: owed[0].name, pence });
    owe[0].left -= pence;
    owed[0].left -= pence;
    if (!owe[0].left) owe.shift();
    if (!owed[0].left) owed.shift();
  }
  return payments;
}

export const pounds = (pence) => `£${(pence / 100).toFixed(2)}`;

export class HouseLedger {
  /** `bootstrap` is the DHT to use: a local testnet for offline demos, or undefined for the public one. */
  constructor({ dir, name, houseKey = null, bootstrap }) {
    this.name = name;
    this.dhtBootstrap = bootstrap;
    this.store = new Corestore(dir);
    this.base = new Autobase(this.store, houseKey ? b4a.from(houseKey, 'hex') : null, {
      valueEncoding: 'json',
      ackInterval: 500,
      open: (store) => store.get({ name: 'bills', valueEncoding: 'json' }),
      apply: async (nodes, view, host) => {
        for (const { value } of nodes) {
          if (typeof value?.addWriter === 'string') await host.addWriter(b4a.from(value.addWriter, 'hex'), { indexer: true });
          else if (validBill(value)) await view.append(value);
        }
      },
    });
    this.swarm = null;
    this.counter = 0;
  }

  async ready() {
    await this.base.ready();
    return this;
  }

  /** Share this with housemates so they can join. */
  get houseKey() {
    return b4a.toString(this.base.key, 'hex');
  }

  /** A new housemate gives this to someone already in the house, who runs invite() with it. */
  get writerKey() {
    return b4a.toString(this.base.local.key, 'hex');
  }

  get canWrite() {
    return this.base.writable;
  }

  get peers() {
    return this.swarm ? this.swarm.connections.size : 0;
  }

  async connect() {
    if (this.swarm) return;
    this.swarm = new Hyperswarm(this.dhtBootstrap ? { bootstrap: this.dhtBootstrap } : {});
    this.swarm.on('connection', (socket) => {
      socket.on('error', () => undefined); // a housemate going offline is normal
      this.store.replicate(socket);
    });
    await this.swarm.join(this.base.discoveryKey, { server: true, client: true }).flushed();
  }

  /** Goes offline. Bills can still be added and they sync on the next connect(). */
  async disconnect() {
    if (!this.swarm) return;
    const swarm = this.swarm;
    this.swarm = null;
    await swarm.destroy();
  }

  async invite(writerKey) {
    await this.base.append({ addWriter: writerKey });
  }

  async addBill({ label, pence, paidBy = this.name, split, date }) {
    const bill = { type: 'bill', id: `${this.writerKey.slice(0, 8)}-${this.counter++}-${this.base.local.length}`, label, pence, paidBy, split, date };
    if (!validBill(bill)) throw new Error('That bill is not valid: check the amount and names.');
    await this.base.append(bill);
    return bill;
  }

  async bills() {
    await this.base.update();
    const view = this.base.view;
    const out = [];
    for (let i = 0; i < view.length; i++) out.push(await view.get(i));
    return out;
  }

  async balances() {
    return balances(await this.bills());
  }

  async close() {
    await this.disconnect();
    await this.base.close();
    await this.store.close();
  }
}

/** Waits for something to become true, for sync across peers. */
export async function until(check, { timeout = 60000, every = 200, what = 'sync' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, every));
  }
  throw new Error(`Timed out waiting for ${what}`);
}
