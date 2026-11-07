# PROGRESS: Tomorrow

Running log for the hackathon (Sat 7 Nov 2026). Feature freeze 17:45, submission 18:30 (Europe/London).

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

## Decisions
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
