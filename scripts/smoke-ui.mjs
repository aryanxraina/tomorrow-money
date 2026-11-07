// Browser quality pass: npx tsx scripts/export-seeds.mts && node scripts/smoke-ui.mjs [baseUrl] [screenshotDir]
// Uses the installed Chrome at phone width. Made-up people are seeded with the clock set to match their data.
// Fails on console errors, page errors, failed requests, broken text or sideways scrolling.
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://localhost:3000';
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const { today, seeds } = JSON.parse(readFileSync('.audit/seeds.json', 'utf8'));
const STORE = 'tomorrow-v2';
const PAGES = ['/home', '/spending', '/forecast', '/help', '/plan', '/ask', '/snap', '/more', '/subscriptions', '/learn', '/nearby'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const problems = [];

async function open(name, { state, colorScheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(`${today}T10:00:00Z`));
  let where = '';
  const note = (kind, msg) => problems.push(`${name} ${where} [${kind}] ${String(msg).slice(0, 260)}`);
  page.on('console', (m) => m.type() === 'error' && note('console', m.text()));
  page.on('pageerror', (e) => note('pageerror', e.message));
  page.on('response', (r) => r.status() >= 500 && note('http', `${r.status()} ${r.url()}`));
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (r.url().startsWith('data:') || r.url().startsWith('blob:') || host === new URL(base).hostname) return;
    note('external request', r.url());
  });
  await page.goto(`${base}/nearby`);
  if (state) await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify({ state: s, version: 0 })), [STORE, state]);
  const check = async (path) => {
    where = path;
    const text = await page.locator('body').innerText();
    if (/couldn.t load|Application error|Unhandled Runtime|Maximum update depth/i.test(text)) note('crash', text.slice(0, 120));
    if (/undefined|\bNaN\b|\[object Object\]/.test(text)) note('bad text', text.match(/.{0,50}(undefined|\bNaN\b|\[object Object\]).{0,50}/)?.[0]);
    if (/Computed by code|sample|demo\b|Amara|Jordan|Kacper|Priya/i.test(text.replace(/Sample/g, 'sample')) && !path.startsWith('/nearby')) {
      const hit = text.match(/.{0,40}(Computed by code|sample|demo\b|Amara|Jordan|Kacper|Priya).{0,40}/i)?.[0];
      if (!/Priya|Amara|Jordan|Kacper/.test(hit ?? '')) note('leftover demo wording', hit);
    }
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) note('overflow', `scrollWidth ${w}`);
  };
  const snap = async (label) => shots && page.screenshot({ path: `${shots}/${name}-${label}.png`, fullPage: true });
  const go = async (path) => {
    where = path;
    await page.goto(base + path);
    await page.waitForTimeout(500);
  };
  return { ctx, page, check, snap, go, note, setWhere: (w) => (where = w) };
}

// Every person, every page.
for (const seed of seeds) {
  const { ctx, go, check, snap } = await open(seed.id, { state: seed.state });
  for (const path of PAGES) {
    await go(path);
    await check(path);
    if (seed.id === 'amara') await snap(path.slice(1));
  }
  await ctx.close();
  console.log(`done ${seed.id}`);
}

// Dark mode, for the screens that matter most.
{
  const { ctx, go, check, snap } = await open('dark', { state: seeds[0].state, colorScheme: 'dark' });
  for (const path of ['/home', '/spending', '/forecast', '/help', '/plan', '/ask', '/more']) {
    await go(path);
    await check(path);
    await snap(path.slice(1));
  }
  await ctx.close();
  console.log('done dark');
}

// A new person answering questions, from the very start.
{
  const { ctx, page, check, snap, setWhere } = await open('new', {});
  setWhere('landing');
  await page.goto(`${base}/`);
  await page.getByRole('link', { name: 'Get started' }).waitFor();
  await check('/');
  await snap('landing');
  await page.getByRole('link', { name: 'Get started' }).click();
  await page.getByLabel('What should we call you?').fill('Sam');
  await page.getByRole('button', { name: 'England' }).click();
  await snap('checkin-1');
  await page.getByRole('button', { name: 'Continue' }).click();
  await snap('checkin-2');
  await page.getByRole('button', { name: /Answer a few questions/ }).click();
  await page.getByRole('button', { name: 'Monthly salary' }).click();
  await page.getByLabel('Usual income a month').fill('1600');
  await snap('checkin-3');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Balance today').fill('320.50');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Rent or mortgage a month').fill('700');
  await page.getByLabel('Council tax a month').fill('120');
  await page.getByLabel('Food shopping a week').fill('55');
  await page.getByRole('button', { name: /See my next 90 days/ }).click();
  await page.waitForURL('**/home');
  await page.getByText('This is an estimate from your answers').waitFor();
  await check('/home after questions');
  await snap('home-estimate');
  await ctx.close();
  console.log('done new person, questions');
}

// A new person starting with a statement, then correcting a category.
{
  const { ctx, page, check, snap, setWhere } = await open('statement', {});
  setWhere('statement');
  await page.goto(`${base}/onboarding`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Add a bank statement/ }).click();
  await page.getByLabel('Choose a statement file').setInputFiles('.audit/sample-statement.csv');
  await page.getByText(/3 transactions/).waitFor();
  await page.getByText(/agree with the running balance/).waitFor();
  await check('/onboarding statement');
  await snap('statement-preview');
  await page.getByRole('button', { name: 'Add these transactions' }).click();
  await page.waitForURL('**/home');
  await page.goto(`${base}/spending?view=transactions`);
  await page.getByRole('button', { name: /Netflix/ }).click();
  await page.getByLabel('Category').selectOption('other');
  await page.getByText('Other').first().waitFor();
  await check('/spending corrected');
  await snap('transactions');
  await ctx.close();
  console.log('done new person, statement');
}

// Flows for an existing person.
{
  const { ctx, page, go, check, snap, setWhere, note } = await open('flow', { state: seeds[0].state });

  setWhere('/snap typed receipt');
  await go('/snap');
  await page.getByRole('button', { name: 'Type it in instead' }).click();
  await page.getByLabel('Shop').fill('Corner Shop');
  await page.getByLabel('Item', { exact: true }).fill('Milk');
  await page.getByLabel('Price').fill('1.65');
  await snap('snap-typed');
  await page.getByRole('button', { name: 'Add it' }).click();
  await page.getByText(/Added\. Your forecast now includes it/).waitFor();
  await page.getByText('Prices you’ve paid').waitFor();
  await check('/snap saved');

  setWhere('/ask');
  await go('/ask');
  await page.getByRole('button', { name: /Can I afford £60/ }).click();
  await page.getByText(/Not a safe time|looks OK/).first().waitFor({ timeout: 120000 });
  await check('/ask afford');
  await snap('ask-afford');
  await page.getByRole('button', { name: 'What big bills are coming?' }).click();
  await page.waitForTimeout(800);
  await check('/ask bills');

  setWhere('/forecast what-if');
  await go('/forecast');
  await page.getByRole('button', { name: /£400 surprise bill/ }).click();
  await page.getByText(/Risky days go from/).waitFor();
  await check('/forecast what-if');
  const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Add to calendar/ }).click()]);
  if (ics.suggestedFilename() !== 'tomorrow-bills.ics') note('calendar', ics.suggestedFilename());

  setWhere('/help confirm');
  await go('/help');
  const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state.confirmed.length, STORE);
  await page.getByRole('button', { name: 'I’ve been awarded this' }).first().click();
  await page.getByLabel('Amount a month').fill('54');
  await snap('help-confirm');
  await page.getByRole('button', { name: 'Add to my forecast' }).click();
  await page.getByText('In your forecast').waitFor();
  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state.confirmed.length, STORE);
  if (after !== before + 1) note('confirm', 'not saved');
  await check('/help confirmed');

  setWhere('/plan toggle');
  await go('/plan');
  await page.getByRole('checkbox').first().click();
  await page.waitForTimeout(300);
  await check('/plan toggled');

  setWhere('/more');
  await go('/more');
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download everything' }).click()]);
  if (!json.suggestedFilename().endsWith('.json')) note('export', json.suggestedFilename());
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (theme !== 'dark') note('theme', `data-theme=${theme}`);
  await page.getByRole('button', { name: 'Automatic' }).click();
  await page.getByText('Keep everything on this device').click();
  await page.getByText('On-device mode: nothing leaves your device').waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: /Delete all my data/ }).click();
  await page.getByRole('button', { name: 'Yes, delete it all' }).click();
  await page.waitForURL(`${base}/`);
  await page.getByRole('link', { name: 'Get started' }).waitFor();
  const left = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state.txns.length, STORE);
  if (left !== 0) note('delete', `${left} transactions left`);
  await ctx.close();
  console.log('done flows');
}

// Offline: everything must behave as on-device and say so.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
  await page.clock.setFixedTime(new Date(`${today}T10:00:00Z`));
  await page.goto(`${base}/nearby`);
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify({ state: s, version: 0 })), [STORE, seeds[0].state]);
  await page.goto(`${base}/home`);
  await page.getByText('On-device mode: nothing leaves your device').waitFor({ timeout: 10000 }).catch(() => problems.push('offline: banner not shown'));
  await ctx.close();
  console.log('done offline');
}

await browser.close();
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n${[...new Set(problems)].join('\n')}` : '\nALL CLEAN');
process.exit(problems.length ? 1 : 0);
