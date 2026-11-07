# Tomorrow: financial time travel for people under pressure

An AI money coach that **understands** your money, **detects** hidden costs, **predicts** problems before they happen, finds **support** you may be owed, and gives a short **plan**. It runs with a cloud AI (Claude or OpenAI) or **fully on-device** with a small local model (QVAC), and switches to on-device automatically when there is no internet.

> Rule of the app: **numbers by code, words by AI.** Forecasts, fees and totals come from plain TypeScript in `src/lib/engine`. The AI only explains, reads receipts and emails, and answers questions, using the numbers the code gives it.

## Quick start (2 minutes)

```bash
npm install
cp .env.example .env.local   # add keys if you have them; everything works without keys
npm run dev                  # http://localhost:3000
```

Pick a demo person on the home page (Amara, Jordan, Kacper, Priya) or do the check-in.

With **no keys at all** the app still works end to end: AI text falls back to rule-based wording (labelled "Written by app rules (no AI)"), receipts fall back to the sample parse, places fall back to sample places.

## AI modes (header switch: Auto / Cloud / On-device)

| Mode | What happens |
| --- | --- |
| Auto | Cloud AI if a key is set and you're online; on-device if offline |
| Cloud | Claude (`ANTHROPIC_API_KEY`) or OpenAI (`OPENAI_API_KEY`); falls back to on-device if the cloud call fails |
| On-device | Only the local model. **Nothing is sent to the cloud or to Google.** |

**Local model with QVAC (Tether challenge):**

1. Install the QVAC CLI (see https://docs.qvac.tether.io, CLI → HTTP server): `npm i -g @qvac/cli`. On Windows, if `qvac` isn't found, run `%APPDATA%\npm\qvac.cmd`.
2. From this folder, start the server: `qvac serve --openai -p 11435`. It reads `qvac.config.json` and downloads the models on first run (`qwen3-4b` about 2.5 GB, plus OCR).
3. Copy `.env.example` to `.env.local`. It already points at port 11435 with `LOCAL_AI_MODEL=qwen3-4b`.

Use port 11435 if Ollama is holding QVAC's default port, 11434. `qwen3-600m` is also in the config for low-end machines, but in our testing it gave unsafe answers (see `PROGRESS.md`).

Other OpenAI-compatible servers such as Ollama work for text, but receipt OCR needs QVAC. Small models don't reliably call tools, so the app never asks them to: the "agent" is deterministic code and the model only fills in text and JSON.

**How on-device AI is kept honest:** receipts go through QVAC OCR and then plain code, with the printed total settling misreads. AI text with a number the app didn't supply is rejected. Purchase verdicts come from code. Dashboard narration on-device is English-only, and non-English uses the app's own translated sentences, because small models changed the meaning of money terms in testing. A step whose rewrite is rejected or unchanged shows the rules badge, so expect a mix of badges.

**Offline demo:** run the app on your laptop, keep mode on Auto, switch Wi-Fi off. The dot in the header turns amber and a banner says nothing leaves your device. Start QVAC and the app before going offline, and rehearse this on the demo machine.

## Other keys (optional)

- `GOOGLE_MAPS_API_KEY`: Places API (New) Nearby Search for the Pay screen ("Use my real location"). Needs a Google Cloud billing account; Nearby Search has a monthly free allowance. Without it, sample places are laid out around you.
- `FINNHUB_API_KEY`: live share prices on the Invest screen (free tier). Without it, sample prices.
- `REDDIT_SUBREDDITS`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`: Community Pulse reads Reddit's public feeds with no key; API keys are optional (see below).
- `NEXT_PUBLIC_TODAY`: the demo is pinned to 2026-11-07 so forecasts are reproducible. Remove it to use the real date with your own data.

## Community Pulse (Reddit)

More → **Community Pulse** shows which money problems people are talking about on Reddit (rent, energy, food, debt, unexpected costs, benefits, job loss, tax, bank fees), how that changes month by month, real posts (username, title, text, posting time, link) with their top replies, and free official help for each topic. Topics you're most likely to face are marked **For you**, based on your own analysis.

**Works with no setup.** It reads Reddit's public RSS feeds (`/r/<sub>/search.rss`, `/r/<sub>/comments/<id>/.rss`), which Reddit publishes for programs to read. Reddit allows only a few anonymous requests a minute, so:

- Collection runs **in the background** and follows Reddit's rate-limit headers. The first run takes a few minutes; the page shows progress and fills in as posts arrive.
- Results are saved to `.cache/reddit-pulse.json` and refreshed every 6 hours (1 hour with the API). They still show offline and in On-device mode, which never contacts Reddit.

Optional, faster, adds upvotes and reply counts: once Reddit approves your Data API access (see https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy), create a **script** app at https://www.reddit.com/prefs/apps and set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` in `.env.local`.

Settings in `.env.local`: `REDDIT_SUBREDDITS` (default `UKPersonalFinance,UKFrugal`), `REDDIT_USERNAME` (added to the user agent), `REDDIT_DISABLED=1` to turn it off.

No browser automation: Reddit blocks automated browsers, and its terms don't allow disguising one.

How it works (`src/lib/community/`): one search per topic → drop megathreads, adult and removed posts → tag topics with word rules (code, no AI) → hide emails, phone numbers and postcodes in text → top replies for the biggest topics → counts by topic and month. Only fixed topic searches are sent to Reddit, never anything about the user.

Honesty: these are counts of the posts collected, not of all of Reddit, and how much people discuss a problem is not a measure of how many people have it.

## What's in it

| Screen | Challenge point | What it does |
| --- | --- | --- |
| Check-in (`/onboarding`) | Personalised, inclusive | 4 short sections, every question optional, any language. Builds a 13-week estimated history so the forecast works before any bank data. Optional CSV statement upload. |
| Money → 1 Understand | Understand & budget | Money in/out, categories, recurring bills found automatically, **Money Fingerprint** (6 scores) and **groups** (Juggler, Lump-sum, Stretched, Catching up, Newcomer, Fixed & cautious, Builder) that change how the app behaves |
| Money → 2 Detect | Fairness | Fees, prepayment meter, monthly insurance, high-cost loans, BNPL, subscriptions, convenience-store prices, student council tax, missing tax pot. Totals the **poverty premium** in £/year with the evidence transactions |
| Money → 3 Predict | Financial time travel | 400-run Monte Carlo of the next 90 days: chance of going below £0 for each day, the bill that triggers it, upcoming bills (council tax 10 instalments, Self Assessment estimate, yearly bills), winter energy, what-if shocks |
| Money → 4 Support | Inclusion | Council Tax Reduction, student exemption, single person discount, social tariffs, Healthy Start, Warm Home Discount, UC check, hardship funds, free debt advice, HMRC payment plan, help nearby |
| Money → 5 Plan | Proactive, tailored | Actions ranked by £ saved per minute of effort; each one re-runs the forecast. **Safe days** (how long money covers essentials) before vs after |
| Snap | Budget tracker | Photo → structured receipt → user edits → **asks permission** → added. Matches card payments so nothing is counted twice. Price tracker across shops |
| Pay | Location | At checkout: finds the shop you're in and a cheaper one nearby, after counting walking time / bus fare. Fuel too. Help nearby (free cash machine, advice, food bank) |
| Ask | Context-based agent | Knows forecast, bills, plan. "Can I afford £60?" runs the purchase through the forecast and finds a safer date |
| More → Subscriptions | Email scan | Finds renewals, free trials and price rises in emails (demo inbox), adds them to the forecast |
| More → Community Pulse | Inclusion, trends | Money problems people discuss on Reddit, monthly trends, real experiences, official help per topic |
| More → Invest | Long-term resilience | Readiness check (buffer, no high-cost debt), investing simulator, plain-English ISA/pension, share prices |

Accessibility: 4 languages (English, Polski, हिन्दी, اردو with right-to-left), bigger text (Aa), plain words, "Why am I seeing this?" on every insight, AI badges on every AI sentence.

## Code map

```
src/lib/engine/      pure TypeScript, no AI (unit-testable)
  analyse.ts         orchestrates everything; whatIf(), affordability(), safeDays()
  forecast.ts        Monte Carlo forecast
  recurring.ts       finds bills and income and their schedules
  understand.ts      summary, Money Fingerprint, groups
  detect.ts          problems + poverty premium + Self Assessment estimate
  support.ts         entitlements and help (always "likely, check")
  plan.ts            ranked actions, each with a forecast adjustment
  location.ts        nearby comparison (sample price index), sample places
  invest.ts          readiness + simulator
src/lib/ai/          provider switch (cloud / local / fallback) and prompts
src/lib/data/        4 demo personas (6 months of synthetic transactions), sample inbox, sample receipts
src/app/api/         narrate, agent, receipt, subscriptions, places, quote, status
src/app/*            screens
scripts/check-engine.ts   npm run check: prints every persona's results, tests the receipt parser and number guard
scripts/audit_engine.py   npm run audit: independent Python check of the engine (standard library only, not used by the app)
scripts/smoke-api.mjs     hits every API route: node scripts/smoke-api.mjs [baseUrl] [mode]
scripts/smoke-ui.mjs      browser pass, every page and persona at phone width (uses installed Chrome)
scripts/check-narration.mts, debug-narration.mts   live on-device narration checks
```

## 3-minute demo

Full scripts for both submissions are in `PITCH.md`. Before demoing, use More → "Delete all my data on this device" so earlier receipts don't change the numbers.

1. **Hook (Amara):** "Low-income households pay hundreds a year more for the same essentials. Amara pays £417 and doesn't know it." → Detect.
2. **Time travel:** Predict → "34% chance she's below £0 on 6 December, reaching 100% by the 12th." Tap "£400 car repair": risky days go from 25 to 35.
3. **Support + Plan:** Council Tax Reduction, Healthy Start… Plan shows risky days and safe days improving.
4. **Snap** the corner-shop sample → it matches her card payment, so it isn't counted twice. **Pay** at Tesco Express → "Lidl is 6 min away, about £4.78 cheaper."
5. **Ask:** "Can I afford £60 this week?" The verdict comes from code, and the AI explains it.
6. **Switch persona** (Jordan: tax bill in January; Kacper: Polish + cash fees; Priya: council tax she doesn't owe).
7. **Turn Wi-Fi off:** same app, on-device AI.

## Checking the maths

`npm run audit` needs Python 3 on your PATH as `python`. On macOS or Linux, run `npx tsx scripts/export-audit-data.mts && python3 scripts/audit_engine.py`. It takes about 25 seconds.

It recomputes spending, fees, tax and safe days from the raw transactions, and re-implements the forecast in Python to compare against the TypeScript engine at 10,000 runs each. It also fails if a figure quoted in `PITCH.md` no longer matches the engine.

It shows the sums are done as designed. It doesn't show that the forecast predicts real life, which would need a back-test with real outcomes. It also takes the detected bill schedule as an input, checking the spacing but not re-detecting the bills.

## Honesty notes (say these if asked)

- Forecast risk figures come from 400 simulations, so they can move by about 5 points. At 10,000 runs, Amara's 34% is about 36%. No "Can I afford it?" verdict changes for any demo person.

- Demo people, receipts, emails and shop prices are **synthetic and labelled as samples**.
- Entitlement amounts are **estimates**; links go to official sources. This is guidance, not regulated financial or debt advice.
- Groups and scores are shown to the user, editable, and never used for credit or pricing.

## Next steps for the Tether submission

- Wrap the app in a Pear desktop app (`hello-pear-electron` template) and call `@qvac/sdk` directly (completion, OCR for receipts, embeddings for categories, transcription for voice).
- P2P with Autobase + Hyperswarm: a shared-house bill ledger, or a community price board where receipts share prices with nearby peers (no central server).
