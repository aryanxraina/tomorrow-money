// One housemate: a ledger peer plus a small web page on this machine only.
// node peer.mjs --name Ana --port 4101 --house Ana,Ben --dir ./.house-ana [--join HOUSE_KEY] [--bootstrap '[{"host":"127.0.0.1","port":1234}]']
// Leave out --bootstrap to find peers through the public DHT, for example between two laptops.
import { createServer } from 'node:http';
import { parseArgs } from 'node:util';
import { HouseLedger, settleUp } from './ledger.mjs';

const { values: args } = parseArgs({
  options: {
    name: { type: 'string' },
    port: { type: 'string', default: '4101' },
    house: { type: 'string', default: '' },
    dir: { type: 'string' },
    join: { type: 'string' },
    bootstrap: { type: 'string' },
  },
});
if (!args.name || !args.dir) {
  console.error('Usage: node peer.mjs --name Ana --dir ./.house-ana --house Ana,Ben [--port 4101] [--join HOUSE_KEY] [--bootstrap JSON]');
  process.exit(1);
}

const housemates = [...new Set([args.name, ...args.house.split(',').filter(Boolean)])];
const ledger = await new HouseLedger({
  dir: args.dir,
  name: args.name,
  houseKey: args.join ?? null,
  bootstrap: args.bootstrap ? JSON.parse(args.bootstrap) : undefined,
}).ready();
await ledger.connect();

async function state() {
  const bills = await ledger.bills();
  const balances = await ledger.balances();
  return {
    name: ledger.name,
    houseKey: ledger.houseKey,
    writerKey: ledger.writerKey,
    canWrite: ledger.canWrite,
    online: !!ledger.swarm,
    peers: ledger.peers,
    housemates,
    bills,
    balances,
    settle: settleUp(balances),
  };
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<title>Shared house: ${args.name.replace(/[^\w ]/g, '')}</title>
<style>
:root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--brand:#6d28d9;--bg:#f8fafc;--card:#fff;--good:#047857;--bad:#be123c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
main{max-width:560px;margin:0 auto;padding:16px;display:grid;gap:12px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:0 0 8px}
.card{background:var(--card);border-radius:16px;padding:14px;box-shadow:0 0 0 1px rgba(0,0,0,.05)}
.row{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--line)}.row:first-of-type{border-top:0}
.muted{color:var(--muted);font-size:13px}.top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
button{background:var(--brand);color:#fff;border:0;border-radius:10px;padding:9px 14px;font:600 14px system-ui;cursor:pointer}
button.soft{background:#f5f3ff;color:var(--brand)}button:disabled{opacity:.5}
form{display:grid;grid-template-columns:1fr 92px auto;gap:8px}
input{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:10px;font:15px system-ui}
.pos{color:var(--good);font-weight:600}.neg{color:var(--bad);font-weight:600}
.key{font:11px ui-monospace,monospace;word-break:break-all;color:var(--muted)}
</style></head><body><main>
<div class="top"><h1 id="who"></h1><button class="soft" id="net"></button></div>
<div class="muted"><span class="dot" id="dot"></span><span id="status"></span></div>
<section class="card"><h2>Add a bill you paid</h2>
<form id="f"><input id="label" placeholder="What for?" aria-label="What for" required><input id="amount" type="number" min="0.01" step="0.01" placeholder="£" aria-label="Amount in pounds" required><button id="add">Add</button></form>
<div class="muted" id="err"></div></section>
<section class="card"><h2>Who owes what</h2><div id="settle"></div><div class="muted">Worked out by code from the shared bills, on this device.</div></section>
<section class="card"><h2>Bills</h2><div id="bills"></div></section>
<section class="card"><div class="muted">Sample housemates and bills for this demo. There is no server: this device and its peers hold the only copies.</div><div class="key" id="key"></div></section>
</main><script>
const $ = (id) => document.getElementById(id);
const gbp = (p) => '£' + (p / 100).toFixed(2);
const row = (a, b) => { const r = document.createElement('div'); r.className = 'row'; const x = document.createElement('span'); x.textContent = a; const y = document.createElement('b'); y.textContent = b; r.append(x, y); return r; };
const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let s = null;
async function draw() {
  try { s = await (await fetch('/state')).json(); } catch { return; }
  $('who').textContent = s.name + "'s device";
  $('dot').style.background = s.online ? (s.peers ? '#10b981' : '#f59e0b') : '#94a3b8';
  $('status').textContent = !s.online ? 'Offline. Bills you add are kept here and sync when you reconnect.' : s.peers ? 'Connected to ' + s.peers + ' housemate(s), directly and encrypted.' : 'Looking for housemates...';
  $('net').textContent = s.online ? 'Go offline' : 'Reconnect';
  $('add').disabled = !s.canWrite;
  $('err').textContent = s.canWrite ? '' : 'Waiting for a housemate to add you to this house.';
  $('settle').replaceChildren(...(s.settle.length ? s.settle.map((p) => row(p.from + ' pays ' + p.to, gbp(p.pence))) : [row('All square', '')]));
  $('bills').replaceChildren(...[...s.bills].reverse().map((b) => row(b.label + ' (paid by ' + b.paidBy + ')', gbp(b.pence))));
  $('key').textContent = 'House key: ' + s.houseKey;
}
$('net').onclick = async () => { await post('/online', { online: !s.online }); draw(); };
$('f').onsubmit = async (e) => {
  e.preventDefault();
  const r = await post('/bill', { label: $('label').value, pounds: Number($('amount').value) });
  if (r.ok) { $('label').value = ''; $('amount').value = ''; } else { $('err').textContent = (await r.json()).error; }
  draw();
};
draw(); setInterval(draw, 1000);
</script></body></html>`;

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

const readJson = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/state') return send(res, 200, await state());
    if (req.method !== 'POST') return send(res, 404, { error: 'not found' });
    // Blocks other websites from posting to this local server: their requests can't send this content type without permission.
    if (req.headers['content-type'] !== 'application/json') return send(res, 415, { error: 'JSON only' });
    const body = await readJson(req);
    if (!body) return send(res, 400, { error: 'bad request' });
    if (req.url === '/bill') {
      const pence = Math.round(Number(body.pounds) * 100);
      if (!String(body.label || '').trim()) return send(res, 400, { error: 'Say what the bill is for.' });
      if (!ledger.canWrite) return send(res, 403, { error: 'You have not been added to this house yet.' });
      const bill = await ledger.addBill({ label: String(body.label).trim().slice(0, 80), pence, paidBy: body.paidBy || ledger.name, split: housemates });
      return send(res, 200, bill);
    }
    if (req.url === '/online') {
      if (body.online) await ledger.connect();
      else await ledger.disconnect();
      return send(res, 200, { online: !!ledger.swarm });
    }
    if (req.url === '/invite') {
      if (!/^[0-9a-f]{64}$/.test(String(body.writerKey))) return send(res, 400, { error: 'That is not a valid key.' });
      await ledger.invite(body.writerKey);
      return send(res, 200, { invited: true });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
});

// Loopback only: nothing on the network can reach this page.
server.listen(Number(args.port), '127.0.0.1', () => console.log(`READY ${JSON.stringify({ name: ledger.name, url: `http://127.0.0.1:${args.port}`, houseKey: ledger.houseKey, writerKey: ledger.writerKey })}`));

const stop = async () => {
  server.close();
  await ledger.close().catch(() => undefined);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
