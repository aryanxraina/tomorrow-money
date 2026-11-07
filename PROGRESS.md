# PROGRESS: Tomorrow

Running log for the hackathon (Sat 7 Nov 2026). Feature freeze 17:45, submission 18:30 (Europe/London).

## READY TO DEMO (work plan finished at 15:40)

**Do these two things before going on stage. Neither could be tested here:**

1. **Rehearse with Wi-Fi really off.** Offline was only simulated in the browser. Whether QVAC starts with no internet is unknown, so start QVAC and the app *before* turning Wi-Fi off.
2. **Test with a real cloud key if you are demoing cloud AI (bank submission).** No key was available. Only the fallback was tested, using a deliberately invalid key. Cloud narration, agent and receipt reading have never run for real.

### How to start

```bash
npm install                       # first time only
cp .env.example .env.local        # first time only; add keys if you have them

# Terminal 1, from this folder. On Windows: %APPDATA%\npm\qvac.cmd serve --openai -p 11435
qvac serve --openai -p 11435      # ready in about 20s once models are downloaded

# Terminal 2
npm run build && npm start        # http://localhost:3000

# Terminal 3, Tether demo only
cd src/p2p && npm install && npm run demo    # opens on ports 4101 and 4102
```

Before each demo: More → "Delete all my data on this device". An unmatched receipt adds spending and changes the forecast. Scripts and figures are in `PITCH.md`.

### What was checked (cold start, 15:35)

| Check | Result |
| --- | --- |
| `npm run build`, eslint | Pass |
| `npm run check` (personas, receipt parser, number guard, moderation, calendar, trends) | Pass |
| `npm run audit` (independent Python check of the engine, pitch figures included) | Pass |
| `scripts/smoke-api.mjs` in on-device mode | All routes OK |
| `scripts/smoke-ui.mjs`: every page × every persona + questionnaire + flows, 390px | Clean with QVAC, with no AI, and under both `npm run dev` and `npm start` |
| `src/p2p` `npm test` and `scripts/smoke-p2p.mjs` | Pass |
| Fresh `git clone`: install, build, check, audit, P2P test | Pass |

### What works

- **Everything with no keys and no AI:** forecast, plan, support, detect, snap, pay, ask, subscriptions, invest, in English, Polish, Hindi and Urdu.
- **On-device with QVAC:** coach chat, English narration, and receipt OCR. Receipts took 10 to 17 seconds here, so warn the audience. The two sample receipts read correctly and reconcile with their printed totals.
- **Peer-to-peer:** shared-house ledger with offline merge, on Pears modules.

### What's mocked or sample

- People, transactions, receipts, emails, shop and fuel prices, nearby places (without a Google key), share prices (without a Finnhub key). All labelled.
- Money Circle: sample posts we wrote, with nothing from Reddit or anywhere else. The shared board isn't built; only the on-device rules filter is real.
- Subscriptions: a demo inbox. There is no real Gmail connection.

### Known issues

- **On-device coach answers can be wrong in meaning.** The number guard only catches numbers. One test answer said "wait until next month" with no basis for it. The verdict above the answer comes from code, and answers are labelled as AI.
- **Non-English chat on-device is weak.** A freer rewrite turned Polish "cash machine fees" into something about casinos. Dashboard narration avoids this, but the chat still uses the model. Be careful demoing Polish chat live.
- **On-device narration shows a mix of badges,** often "app rules". That is accurate, because rejected or unchanged rewrites keep the rules badge.
- **Forecast risks carry about ±5 points of sampling noise** from 400 runs. Amara's 34% is about 36% at 10,000 runs. Stated in the app and pitch. No verdict changes.
- **Amara's plan doesn't make her safe:** her peak risk only falls from 100% to 85%. The pitch says so.
- **Real receipt photos are untested.** OCR was only run on the two clean sample images.
- **Translations were not reviewed by native speakers,** and much of the UI outside the dashboard is still English, including dates. Kacper's plan sentence reads "1 to 1" risky days.
- **Google Places and Finnhub were not tested with real keys.** Their fallbacks were.
- **P2P limits:** runs on Node, not the Pear runtime. Not connected to the main app's screens. No encryption at rest. Only run on one machine (local and public DHT), never across two devices.
- **The forecast has never been back-tested on real outcomes.** The Python audit shows the sums are right, not that the predictions are.

### Repo state

This agent never ran `git push`, as the brief says. But `origin/main` has been updated by pushes from this machine a few minutes after most commits, most likely through GitHub Desktop, so assume commits here reach `github.com/aryanxraina/tomorrow-money`. Tracked files were scanned for API keys and none were found, and `.env.local` is ignored. The brief's `qvac serve openai` command is deprecated: use the README's.

## Log

### 14:10 Step 1: Baseline
- No git repo existed: ran `git init` in `moneysense/` on branch `main`.
- `npm install` OK. `npm run check` OK; the persona figures match the brief (Amara £418 and 34% on 6 Dec, Jordan £1,770 tax bill, Kacper 48% on 3 Dec).
- `npm run build` passes.

### 14:15 Step 2: Smoke test
- Added `scripts/smoke-api.mjs`. All API routes responded and fell back cleanly.
- Found: every local AI call returned empty, because `qwen3:4b` on Ollama spent its budget on thinking.

### Step 3: Cloud AI (skipped live tests)
- `/api/status` shows `cloud: false`: no API key on this machine. **Cloud narration, agent and receipt reading were not tested live.** The cloud code path is unchanged in shape but unverified.
- Hardening done anyway: balanced-bracket `extractJson`, tolerant of chatter and trailing commas; malformed bodies return 400.

### Step 4: Local AI on QVAC
- `@qvac/cli` installed globally. Server: `qvac serve --openai -p 11435`, models in `qvac.config.json`.
- Chat tested with `qwen3-600m` and `qwen3-4b`. OCR tested on both sample receipts. All AI routes tested in `mode: "local"`.

### 14:30 Steps 5 and 6: UX polish and quality pass
- Added loading states, on-device banner, translated labels, "Why" panels everywhere, stacked receipt rows on phones.
- `scripts/smoke-ui.mjs` (playwright-core with installed Chrome): every page × every persona + questionnaire + flows + offline, at 390px, checking console errors, 5xx, crash text, `undefined`/`NaN`, overflow and external requests. **All clean with QVAC running and with no AI at all.**
- Tested with a deliberately invalid cloud key: cloud fails, on-device takes over, and the on-device run made no cloud attempts (4 failures logged, all from the auto run).
- Note: at 14:24 a commit "Tomorrow: hackathon build" appeared under the user's identity (GitHub Desktop is open) and `origin` was added. It is the user's snapshot of work in progress. History left alone and nothing pushed by this agent.

### 14:55 Step 7: Pitch
- `PITCH.md` written with figures taken from the engine. README updated.

### 15:00 Step 8: Extras
- (a) Spending trend small multiples on Understand. (b) `.ics` export for upcoming bills. Both are client-side only.
- (c) `src/p2p`: shared-house ledger on Hyperswarm, Corestore and Autobase, with a two-process stage demo on a local DHT. The README's two-device commands were also run on one machine over the public DHT.
- (d) `/circle` Money Circle preview: labelled sample posts plus an on-device rules filter.

### 15:20 Python audit (requested by the user mid-run)
- Added `scripts/audit_engine.py`, run with `npm run audit`. It recomputes figures from the raw transactions and re-implements the forecast. Largest daily risk gap against the engine at 10,000 runs each: 1.1 points.
- It found one real error: `PITCH.md` said Kacper's risk with the plan was 41%, but it is 42%. Corrected.

### 15:30 Finish
- `npm run dev` showed a console error on every route (dev-only instant-navigation check). Fixed in `next.config.ts`.
- A fresh-clone install, build and test run passed. A cold start of the documented commands passed.

## Decisions
- **Python is an auditor, not part of the app.** The user asked for Python. The brief puts all maths in `src/lib/engine` in TypeScript, so Python does not supply any figure the app shows. Standard library only, per "no heavy dependencies". The app runs without Python.
- **Forecast stays at 400 runs.** At 10,000 runs Amara's 34% is about 36%, and her £60 check is 60% to 88% rather than 52% to 84%. More runs would change the story figures and slow the £60 check (31 forecasts), and no verdict flips for any persona. The app and pitch state the ±5 point margin instead.
- **`instantInsights.validationLevel: 'manual-warning'`.** The dev check flags every route because `AppShell` holds pages back until mount. That gating is required because state lives in localStorage. The check is dev-only, so production is unaffected.
- **`playwright-core` as a dev dependency,** using the installed Chrome, so no browser download.
- **P2P has its own `package.json`,** so the app takes on no heavy dependencies. Peer data is rendered with `textContent`, and the local server binds to loopback only.
- **Money Circle is a clearly labelled preview,** with no invented community activity presented as real and nothing taken from Reddit.
- **Amara's closest recent corner-shop payment now matches the corner-shop sample receipt** (£11.15, 6 Nov). Before this, the "not counted twice" match never fired for any sample on any persona, so it could not be demoed. A new payment moved her risk to 37%, so an existing one was changed instead. Risk stays 34%; premium is now **£417** (was £418) and support **£106/month** (was £107). The brief's "~£418" is close, and `PITCH.md` and the README use the new figures.
- **What-if shows risky days and lowest balance**, not peak risk. Amara's peak is already 100%, so it read "100% (from 100%)".
- No `.env.local` was present at the start, so the first test run uses the no-keys rules fallback.
- **QVAC on port 11435, not 11434.** Ollama already holds 11434 on this machine. `.env.example` now uses 11435.
- **Default local model is `qwen3-4b`, not `qwen3-600m`.** The 600M model wrote `$` for `£`, echoed English when asked for Polish, and answered "Yes, you can" to a purchase that raised risk from 55% to 84%. It stays in the config for low-end machines, with those limits.
- **Thinking is turned off with QVAC's `reasoning_budget: false`.** `/no_think` is unreliable. On Ollama `qwen3:4b` could not be stopped from thinking, which is another reason to use QVAC.
- **Receipts on-device use QVAC OCR, then code, not the chat model.** QVAC chat silently drops images, so a chat model would invent a receipt. `engine/receipt.ts` parses the OCR text, repairs misread glyphs and uses the printed TOTAL to settle ambiguous prices (real case: £3.49 read as `13 .49`). The model is only tried if the code finds no items, and its prices must appear in the OCR text.
- **Image requests are never sent to a local chat model** (`cloudOnly` in `ask()`).
- **Number guard (`ai/guard.ts`).** AI text with a number the app did not supply is rejected. Hindi and Urdu digits are checked too. This enforces rule 1 in code.
- **Narration rewords code-written sentences**, rather than writing from raw facts. A rewrite must keep every number. Writing from facts produced a false claim ("paying more for your rent because it's a prepayment meter").
- **A rewrite identical to the draft shows the rules badge**, so the app doesn't claim AI wrote it. Consequence: on-device, several steps often show the rules badge. That is accurate.
- **On-device narration is English-only.** Freer rewriting changed meaning in ways no number check catches: "one-off" became "once a year", and Polish "cash machine fees" became casinos. Non-English on-device uses the app's own translated sentences. Cloud narration can still write in any language. The Ask chat still uses the model in every language.
- **Rules wording translated into pl, hi, ur** (`narrative.ts`), so the no-AI path is inclusive too. These translations were not reviewed by native speakers. Bill and problem names stay in English.
- **"Can I afford" verdict is decided by code and always shown** above the AI's text (safe = 30-day risk after buying under 25% and rising by under 10 points).
- **Subscriptions from AI are checked against the emails** (amounts and dates must appear, no duplicates, at least as many as the rules find), because they feed the forecast.
- **Predict now shows peak risk.** Amara's first risky day is 34% on 6 Dec, but the risk reaches 100% by 12 Dec. Showing only 34% understated it, so the pitch must say both.
