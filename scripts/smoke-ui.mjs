// Browser quality pass: node scripts/smoke-ui.mjs [baseUrl] [screenshotDir]
// Visits every page for every persona and a questionnaire user at phone width, using the installed
// Chrome (playwright-core downloads no browser). Fails on console errors, page errors, failed
// requests, crash screens or sideways scrolling.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://localhost:3000';
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const PAGES = ['/dashboard', '/snap', '/pay', '/ask', '/more', '/subscriptions', '/invest'];
const PERSONAS = ['amara', 'jordan', 'kacper', 'priya'];
const STEPS = ['Understand', 'Detect', 'Predict', 'Support', 'Plan'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const problems = [];

async function session(name, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let where = '';
  const note = (kind, msg) => problems.push(`${name} ${where} [${kind}] ${String(msg).slice(0, 300)}`);
  page.on('console', (m) => m.type() === 'error' && note('console', m.text()));
  page.on('pageerror', (e) => note('pageerror', e.message));
  page.on('response', (r) => r.status() >= 500 && note('http', `${r.status()} ${r.url()}`));
  // Privacy: with no keys set the browser must never talk to anything except this app.
  page.on('request', (r) => new URL(r.url()).hostname !== new URL(base).hostname && !r.url().startsWith('data:') && note('external request', r.url()));
  await page.goto(base + '/');
  if (seed) await page.evaluate((s) => localStorage.setItem('tomorrow-money-v1', JSON.stringify({ state: s, version: 0 })), seed);

  const check = async (path) => {
    where = path;
    const text = await page.locator('body').innerText();
    if (/couldn.t load|Application error|Unhandled Runtime|Maximum update depth/i.test(text)) note('crash', text.slice(0, 120));
    if (/undefined|NaN|\[object Object\]/.test(text)) note('bad text', text.match(/.{0,50}(undefined|NaN|\[object Object\]).{0,50}/)?.[0]);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) note('overflow', `scrollWidth ${w}`);
  };
  const snap = async (label) => shots && page.screenshot({ path: `${shots}/${name}-${label}.png`, fullPage: true });

  for (const path of PAGES) {
    where = path;
    await page.goto(base + path);
    await page.waitForTimeout(600);
    await check(path);
    await snap(path.slice(1));
    if (path === '/dashboard') {
      for (const s of STEPS) {
        // By position, because the labels are translated for personas who use another language.
        await page.locator('main button:has(span.h-5.w-5)').nth(STEPS.indexOf(s)).click();
        await page.waitForTimeout(250);
        await check(`/dashboard#${s}`);
        await snap(`dashboard-${s}`);
      }
    }
  }
  return { ctx, page, check, snap, setWhere: (w) => (where = w), note };
}

// Every persona, every page.
for (const id of PERSONAS) {
  const { ctx } = await session(id, { profileId: id });
  await ctx.close();
  console.log(`done ${id}`);
}

// Flows for one persona: receipt, pay, what-if, ask, inbox scan.
{
  const { ctx, page, check, snap, setWhere, note } = await session('flow', { profileId: 'amara' });
  setWhere('/snap flow');
  await page.goto(base + '/snap');
  await page.getByRole('button', { name: /Sample receipt: corner shop/ }).click();
  await page.getByText('Is this right?').waitFor({ timeout: 90000 });
  await check('/snap read');
  await snap('snap-read');
  await page.getByRole('button', { name: /Yes, add to my tracker/ }).click();
  await page.getByText(/Not counted twice|Added to your tracker/).waitFor();

  setWhere('/pay flow');
  await page.goto(base + '/pay');
  await page.getByRole('button', { name: /paying at/ }).click();
  await page.getByText('Other options').waitFor({ timeout: 20000 });
  await check('/pay grocery');
  await snap('pay-grocery');
  await page.getByRole('button', { name: /filling up/ }).click();
  await page.getByText('Other options').waitFor({ timeout: 20000 });
  await check('/pay fuel');

  setWhere('/ask flow');
  await page.goto(base + '/ask');
  await page.getByRole('button', { name: /Can I afford £60/ }).click();
  await page.getByText('Computed by code').first().waitFor({ timeout: 120000 });
  await page.getByText(/Written by/).first().waitFor({ timeout: 120000 });
  await check('/ask afford');
  await snap('ask');

  setWhere('/subscriptions flow');
  await page.goto(base + '/subscriptions');
  await page.getByRole('button', { name: /scan|check/i }).first().click();
  await page.getByText(/Written by/).first().waitFor({ timeout: 120000 });
  await check('/subscriptions scan');
  await snap('subscriptions');

  setWhere('/dashboard what-if');
  await page.goto(base + '/dashboard');
  await page.getByRole('button', { name: /Predict$/ }).first().click();
  await page.getByRole('button', { name: /£400 car repair/ }).click();
  await page.getByText(/risky days go from/).waitFor();
  await check('/dashboard what-if');

  setWhere('rtl');
  await page.getByLabel('Language').selectOption('ur');
  await page.waitForTimeout(400);
  await check('/dashboard urdu');
  await snap('dashboard-urdu');
  if (!(await page.locator('main[dir=rtl]').count())) note('rtl', 'main is not right-to-left');
  await ctx.close();
  console.log('done flows');
}

// A real user: fill in nothing but go through the questionnaire to the end.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '/onboarding');
  for (let i = 0; i < 8 && !page.url().includes('/dashboard'); i++) {
    await page.waitForTimeout(300);
    const next = page.getByRole('button', { name: /next|continue|see my|finish|done/i }).last();
    if (!(await next.count())) break;
    await next.click();
  }
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => errs.push(`questionnaire did not reach dashboard, at ${page.url()}`));
  await page.waitForTimeout(500);
  const text = await page.locator('body').innerText();
  if (/undefined|NaN|\[object Object\]/.test(text)) errs.push(`bad text: ${text.match(/.{0,50}(undefined|NaN|\[object Object\]).{0,50}/)?.[0]}`);
  if (shots) await page.screenshot({ path: `${shots}/me-dashboard.png`, fullPage: true });
  for (const path of PAGES.slice(1)) {
    await page.goto(base + path);
    await page.waitForTimeout(400);
    const t = await page.locator('body').innerText();
    if (/undefined|NaN|\[object Object\]/.test(t)) errs.push(`${path} bad text`);
  }
  errs.forEach((e) => problems.push(`questionnaire ${String(e).slice(0, 300)}`));
  await ctx.close();
  console.log('done questionnaire');
}

// Offline: Auto mode must switch to on-device and say so.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
  await page.goto(base + '/');
  await page.evaluate(() => localStorage.setItem('tomorrow-money-v1', JSON.stringify({ state: { profileId: 'amara', mode: 'auto' }, version: 0 })));
  await page.goto(base + '/dashboard');
  await page.getByText('On-device mode: nothing leaves your device').waitFor({ timeout: 10000 }).catch(() => problems.push('offline: banner not shown'));
  if (shots) await page.screenshot({ path: `${shots}/offline-dashboard.png` });
  await ctx.close();
  console.log('done offline');
}

await browser.close();
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n${[...new Set(problems)].join('\n')}` : '\nALL CLEAN');
process.exit(problems.length ? 1 : 0);
