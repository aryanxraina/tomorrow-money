// Stage demo: npm run demo
// Starts a local DHT and two housemates as separate processes with separate storage, so it works with
// Wi-Fi off. Open the two printed links side by side. Sample bills and names, fresh on every run.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import createTestnet from 'hyperdht/testnet.js';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'tomorrow-house-'));
const testnet = await createTestnet(3);
const bootstrap = JSON.stringify(testnet.bootstrap);
const children = [];

function startPeer(name, port, extra = []) {
  const child = spawn(process.execPath, [join(here, 'peer.mjs'), '--name', name, '--port', String(port), '--house', 'Ana,Ben', '--dir', join(dir, name), '--bootstrap', bootstrap, ...extra], { stdio: ['ignore', 'pipe', 'inherit'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/READY (\{.*\})/);
      if (m) resolve(JSON.parse(m[1]));
    });
    child.on('exit', (code) => reject(new Error(`${name} exited with code ${code}`)));
  });
}

const post = (url, path, body) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const state = async (url) => (await fetch(url + '/state')).json();

async function shutdown() {
  for (const c of children) {
    c.removeAllListeners('exit');
    c.kill();
  }
  await testnet.destroy().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 300));
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // a temp folder left behind is harmless
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const ana = await startPeer('Ana', 4101);
const ben = await startPeer('Ben', 4102, ['--join', ana.houseKey]);
await post(ana.url, '/invite', { writerKey: ben.writerKey });
await post(ana.url, '/bill', { label: 'Electric (sample)', pounds: 60 });

for (let i = 0; i < 300; i++) {
  const b = await state(ben.url);
  if (b.canWrite && b.bills.length) break;
  await new Promise((r) => setTimeout(r, 200));
}
await post(ben.url, '/bill', { label: 'Broadband (sample)', pounds: 30 });

console.log(`
Shared-house ledger: no server, no internet needed.
  Ana's device: ${ana.url}
  Ben's device: ${ben.url}

Try this:
  1. Add a bill on Ana's page. It appears on Ben's page.
  2. Press "Go offline" on both. Add a different bill on each.
  3. Press "Reconnect" on both. They agree, to the penny.

Press Ctrl+C to stop.`);
