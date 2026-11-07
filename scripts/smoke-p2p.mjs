// Drives the P2P stage demo in two browser pages, exactly as a presenter would: node scripts/smoke-p2p.mjs [screenshotDir]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const shots = process.argv[2];
const demo = spawn(process.execPath, ['demo.mjs'], { cwd: 'src/p2p', stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  let out = '';
  demo.stdout.on('data', (c) => {
    out += c;
    if (out.includes('Press Ctrl+C')) resolve();
  });
  demo.on('exit', (code) => reject(new Error(`demo exited ${code}`)));
  setTimeout(() => reject(new Error('demo did not start')), 90000);
});

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const problems = [];
const open = async (url) => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  p.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  p.on('pageerror', (e) => problems.push(e.message));
  await p.goto(url);
  return p;
};
const add = async (p, label, amount) => {
  await p.getByLabel('What for').fill(label);
  await p.getByLabel('Amount in pounds').fill(amount);
  await p.getByRole('button', { name: 'Add', exact: true }).click();
};
const settleText = (p) => p.locator('#settle').innerText();
const see = (p, text) => p.getByText(text).first().waitFor({ timeout: 60000 });

let code = 0;
try {
  const ana = await open('http://127.0.0.1:4101');
  const ben = await open('http://127.0.0.1:4102');
  await see(ana, 'Broadband (sample)');
  await see(ben, 'Electric (sample)');
  await see(ana, /Connected to/);
  console.log('ok   both pages show both sample bills, connected');

  await add(ana, 'Pizza', '12.50');
  await see(ben, 'Pizza');
  console.log('ok   a bill added on Ana appears on Ben');

  await ana.getByRole('button', { name: 'Go offline' }).click();
  await ben.getByRole('button', { name: 'Go offline' }).click();
  await ana.getByRole('button', { name: 'Reconnect' }).waitFor();
  await ben.getByRole('button', { name: 'Reconnect' }).waitFor();
  await add(ana, 'Water', '20');
  await add(ben, 'Cleaning', '10.01');
  await see(ana, 'Water');
  await see(ben, 'Cleaning');
  if ((await ana.getByText('Cleaning').count()) || (await ben.getByText('Water').count())) throw new Error('Peers shared bills while offline');
  if (shots) await ana.screenshot({ path: `${shots}/p2p-offline.png`, fullPage: true });
  console.log('ok   each adds a bill offline, and neither sees the other yet');

  await ana.getByRole('button', { name: 'Reconnect' }).click();
  await ben.getByRole('button', { name: 'Reconnect' }).click();
  await see(ana, 'Cleaning');
  await see(ben, 'Water');
  await ana.waitForTimeout(1500);
  const [a, b] = [await settleText(ana), await settleText(ben)];
  if (a !== b) throw new Error(`Peers disagree: ${a} vs ${b}`);
  // Ana paid £92.50 and Ben £40.01. Ana's share of the £132.51 is £66.26 including the spare penny, so Ben owes £26.24.
  if (!/Ben pays Ana\s*£26\.24/.test(a)) throw new Error(`Wrong total: ${a}`);
  console.log(`ok   they converge and agree: ${a.replace(/\s+/g, ' ')}`);
  if (shots) await ben.screenshot({ path: `${shots}/p2p-converged.png`, fullPage: true });
  if (problems.length) throw new Error(problems.join(' | '));
  console.log('\nALL PASSED');
} catch (e) {
  console.error('FAIL', e.message);
  code = 1;
} finally {
  await browser.close();
  demo.removeAllListeners('exit');
  demo.kill();
}
process.exit(code);
