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

1. Install the QVAC CLI (see https://docs.qvac.tether.io, CLI → HTTP server): `npm i -g @qvac/cli`
2. Start the OpenAI-compatible server: `qvac serve openai` (default port 11434)
3. Set `LOCAL_AI_MODEL` in `.env.local` to the model name the server exposes (e.g. `qwen3-600m`)

Teammates without QVAC set up yet can use any OpenAI-compatible local server on the same port (for example Ollama with `LOCAL_AI_MODEL=qwen3:1.7b`). Small models don't reliably call tools, so the app never asks them to: the "agent" is deterministic code and the model only fills in text and JSON.

**Offline demo:** run the app on your laptop, keep mode on Auto, switch Wi-Fi off. The dot in the header turns amber and every AI badge says "on-device".

## Other keys (optional)

- `GOOGLE_MAPS_API_KEY`: Places API (New) Nearby Search for the Pay screen ("Use my real location"). Needs a Google Cloud billing account; Nearby Search has a monthly free allowance. Without it, sample places are laid out around you.
- `FINNHUB_API_KEY`: live share prices on the Invest screen (free tier). Without it, sample prices.
- `NEXT_PUBLIC_TODAY`: the demo is pinned to 2026-11-07 so forecasts are reproducible. Remove it to use the real date with your own data.

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
scripts/check-engine.ts   npx tsx scripts/check-engine.ts  (prints every persona's results)
```

## 3-minute demo

1. **Hook (Amara):** "Low-income households pay hundreds a year more for the same essentials. Amara pays £418 and doesn't know it." → Detect.
2. **Time travel:** Predict → "34% chance she's below £0 on 6 December." Tap "£400 car repair" to show the risk jump.
3. **Support + Plan:** Council Tax Reduction, Healthy Start… Plan shows risky days and safe days improving.
4. **Snap** the sample receipt → confirm → it matches/tracks. **Pay** at Tesco Express → "Lidl is 6 min away, about £4.80 cheaper."
5. **Ask:** "Can I afford £60 this week?"
6. **Switch persona** (Jordan: tax bill in January; Kacper: Polish + cash fees; Priya: council tax she doesn't owe).
7. **Turn Wi-Fi off:** same app, on-device AI.

## Honesty notes (say these if asked)

- Demo people, receipts, emails and shop prices are **synthetic and labelled as samples**.
- Entitlement amounts are **estimates**; links go to official sources. This is guidance, not regulated financial or debt advice.
- Groups and scores are shown to the user, editable, and never used for credit or pricing.

## Next steps for the Tether submission

- Wrap the app in a Pear desktop app (`hello-pear-electron` template) and call `@qvac/sdk` directly (completion, OCR for receipts, embeddings for categories, transcription for voice).
- P2P with Autobase + Hyperswarm: a shared-house bill ledger, or a community price board where receipts share prices with nearby peers (no central server).
