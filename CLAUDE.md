# CLAUDE.md: project brief for "Tomorrow" (hackathon, Sat 7 Nov 2026)

Read this whole file before doing anything. Also read `AGENTS.md` (Next.js 16 notes) and `README.md`.
You are working **autonomously**: don't ask questions, make sensible decisions, log them in `PROGRESS.md`, keep going.
**Feature freeze 17:45 Europe/London. Submission 18:30.**

---

## 1. What we're building

**Tomorrow**: an AI money coach for underserved people that does "financial time travel": it predicts the next 90 days day by day, finds hidden costs and money people are owed, and gives a short personalised plan. One codebase, two submissions:

| | Submission A: bank challenge | Submission B: Tether challenge |
| --- | --- | --- |
| Brief | "AI-Powered Financial Inclusion & Resilience": help people understand, budget and plan; predictive insights + forecasting ("financial time travel") to anticipate hardship; proactive tailored advice; accessibility for underserved/vulnerable groups; a trusted AI coach/agent | "Solve a real problem for your university or community using AI that runs **100% locally**, no cloud or external APIs. Bonus for peer-to-peer distribution." |
| Judged on | Customer focus & user-centric design · Innovation & creativity · Social impact & inclusivity (ethical, transparent) · Use of AI & data (predictive insights, forecasting) · Feasibility & demo clarity | Problem & impact · **QVAC implementation** · **Pears implementation** · Technical architecture · Creativity, design & presentation |
| AI mode | Cloud API (Claude) with on-device as a feature | On-device only (QVAC local model), Wi-Fi off on stage |

## 2. The team's product vision (from their notes, keep this flow)

**Person opens the app → enters basic info (questionnaire) → AI understands:**
1. How much is coming in? 2. How much is spent? 3. Can they afford essential expenses? 4. Might they run out of money? 5. What financial support can they access? 6. What actions can they take to improve?

**The 5 main things = the 5 dashboard steps:**
1. **Understand** the user's financial situation
2. **Detect** financial problems
3. **Predict** future financial problems (financial time travel)
4. **Find** financial support & recommend solutions
5. **Give** a personalised action plan

One headline number across all steps: **Safe days** = how many days balance + savings cover essentials if income stopped (now → in 90 days → in 90 days with the plan).

**Team feature list → status in this repo:**

| Feature (team notes) | Status | Where |
| --- | --- | --- |
| Cloud / Local AI switch | Built (Auto/Cloud/On-device; Auto goes on-device when offline) | `src/lib/ai/provider.ts`, header |
| Generic questionnaire → segment users (underserved first) | Built: Money Fingerprint (6 scores) + groups | `/onboarding`, `engine/understand.ts` |
| Budget tracker | Built | `/dashboard` step 1, `/snap` |
| Snap & Receipt (photo → structured → ask permission → add to tracker) | Built, with bank-payment matching so nothing is counted twice | `/snap`, `/api/receipt` |
| Predictive insights, future bills, spend-less recommendations (financial time travel) | Built: Monte Carlo forecast, upcoming bills, council tax, Self Assessment estimate, what-if | `engine/forecast.ts`, step 3 |
| Council tax / tax recommendations | Built: CT Reduction, student exemption, 25% discount, 12 instalments, HMRC payment plan | `engine/support.ts`, `engine/plan.ts` |
| Context-based AI agent | Built: knows forecast/bills/plan; "Can I afford £X?" runs through the forecast | `/ask`, `/api/ai/agent` |
| Location-based recommendation (at payment → best alternative nearby) | Built: Google Places when key set, else sample places; counts walking/bus fare | `/pay`, `/api/places`, `engine/location.ts` |
| Price tracker (items you buy, nearby shops, wishlist, share prices) | Built: receipt items + nearby + share prices. **Wishlist = roadmap** | `/snap`, `/pay`, `/invest` |
| Stock management = shares/investing | Built: readiness check + simulator + share prices (Finnhub or sample) | `/invest` |
| Email / SLM for due subscriptions | Built with a demo inbox; **real Gmail connection = roadmap** | `/subscriptions`, `/api/subscriptions` |
| Local language support | Built: en, pl, hi, ur (RTL); AI writes in the chosen language | `src/lib/i18n.ts` |
| Reddit-style discussion | **Not built.** Plan: in-app "Money Circle" board (anonymous threads by group/area, AI moderation) | roadmap |
| SLM for underprivileged without internet | Built: on-device mode + automatic offline fallback | header switch |

## 3. Non-negotiable rules

1. **Numbers by code, words by AI.** All maths lives in `src/lib/engine` (pure TypeScript). The AI only explains, reads receipts/emails, and answers using numbers the code passes in. Never let a model calculate.
2. **The app must always work with no AI at all.** Every AI call has a rules fallback, labelled "Written by app rules (no AI)". Keep them.
3. **Privacy:** in On-device mode nothing goes to the cloud or to Google. `ask()` in `provider.ts` enforces this; don't break it.
4. **Honesty:** demo people, receipts, emails and shop/fuel prices are synthetic and must stay labelled "sample/demo". Entitlements are "likely, check" with official links. Guidance, not regulated financial/debt advice. Groups/scores are never used for credit or pricing.
5. **Never print, log or commit secrets.** `.env.local` is git-ignored.
6. After any change in `src/lib/engine`: run `npm run check` and confirm all 4 personas still give sensible output.
7. `npm run build` must pass before every commit. If something breaks and can't be fixed in 10 minutes, revert it.
8. Commit after every working milestone (clear messages). **Never push.**
9. No heavy new dependencies. Small focused changes.

## 4. Gotchas already hit (don't repeat)

- **Next.js 16 with `cacheComponents: true`:** a GET route handler that reads env vars must call `await connection()` (from `next/server`), otherwise it's prerendered at build time (see `/api/status`).
- **Zustand selectors must not return a new array/object** (e.g. `s.added[id] || []`): it causes an infinite re-render ("page couldn't load"). Select the stable slice, then derive with `useMemo`.
- All pages are client components rendered after mount (`AppShell` gates on `useMounted`) because state lives in localStorage.
- No `next/font/google`: the build must work offline.
- Local llama.cpp servers (QVAC/Ollama) reject concurrent requests: `provider.ts` queues local calls and health-checks the server first (1.5s). Qwen3 models get `/no_think`; `<think>` blocks are stripped.
- Small local models don't reliably do tool calling, so the agent is deterministic code and the model only fills text/JSON. Use `extractJson()` for model JSON.
- **This machine is Windows.** In PowerShell use `curl.exe` (plain `curl` is an alias for Invoke-WebRequest), or write small Node scripts. Start long-running servers as background processes.
- **Ollama and LM Studio appear to be installed on this machine.** If QVAC won't install, use Ollama (port 11434, OpenAI-compatible at `/v1`) and set `LOCAL_AI_MODEL` to an installed model (`ollama list`). LM Studio's server is usually on port 1234 (`/v1`).

## 5. Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # must pass before commits
npm run check        # engine sanity: prints every persona's analysis
```

Env (`.env.local`, template in `.env.example`): `ANTHROPIC_API_KEY`, `CLOUD_MODEL` (default claude-sonnet-5-5) or `OPENAI_API_KEY`/`OPENAI_MODEL`; `LOCAL_AI_BASE_URL` (default http://127.0.0.1:11434/v1), `LOCAL_AI_MODEL`; optional `GOOGLE_MAPS_API_KEY` (Places API New), `FINNHUB_API_KEY`; `NEXT_PUBLIC_TODAY=2026-11-07` pins the demo date.

QVAC (Tether): `npm i -g @qvac/cli`, then `qvac serve openai` (default port 11434). Docs: https://docs.qvac.tether.io. Get the model name from `GET /v1/models`.

## 6. File structure

```
CLAUDE.md                     this brief
PROGRESS.md                   your running log (create it)
README.md                     setup, features, demo script, honesty notes
AGENTS.md                     Next.js 16 notes (read)
.env.example                  env template
scripts/check-engine.ts       npm run check: runs the engine on all personas
public/samples/               2 labelled sample receipt images
src/app/
  layout.tsx, globals.css     root layout, AppShell
  page.tsx                    home: hero, 4 demo personas, how it works
  onboarding/page.tsx         questionnaire (4 sections, optional answers, CSV statement upload)
  dashboard/page.tsx          the 5 steps + Safe days headline + AI narration + what-if + plan toggles
  snap/page.tsx               Snap & Receipt + price tracker
  pay/page.tsx                location check at checkout (grocery + fuel + real location) + help nearby
  ask/page.tsx                context agent chat ("Can I afford £60?")
  subscriptions/page.tsx      demo inbox scan → renewals/trials/price rises → add to forecast
  invest/page.tsx             readiness, simulator, plain-English ISA/pension, share prices
  more/page.tsx               links, settings (bus fare), AI/key status, delete data
  api/status                  which AI/keys are configured
  api/ai/narrate              5 step summaries (JSON) in the user's language
  api/ai/agent                coach answer from context + affordability facts
  api/receipt                 image → receipt JSON (AI), sample fallback
  api/subscriptions           emails → subscriptions JSON (AI), regex fallback
  api/places                  Google Places Nearby Search or sample places
  api/quote                   Finnhub quotes or sample
src/components/
  AppShell.tsx                header (Auto/Cloud/On-device, online dot, language, Aa) + bottom nav
  charts.tsx                  ForecastChart (band + median + plan), FingerprintRadar, SimChart
  ui.tsx                      Card, Pill, Button, AiBadge, CodeBadge, Why ("Why am I seeing this?"), Stat, Field
src/lib/
  types.ts                    Txn, Answers, Persona, ...
  store.ts                    zustand + localStorage (profile, added receipts, bills, mode, lang, plan selection)
  hooks.ts                    useProfile, useAnalysis, useEffectiveMode, useOnline, postJSON, APP_NAME
  narrative.ts                buildFacts (the only numbers AI may use) + rules templates
  i18n.ts                     UI strings en/pl/hi/ur
  ai/provider.ts              cloud/local switch, queue, health check, extractJson
  ai/prompts.ts               system prompts (narrate, agent, receipt, subscriptions)
  data/personas.ts            Amara, Jordan, Kacper, Priya: 6 months of synthetic transactions with planted patterns
  data/samples.ts             demo inbox emails, sample receipt parses
  engine/analyse.ts           orchestrator: analyse(), whatIf(), planForecast(), safeDays(), affordability(), estimateFromAnswers()
  engine/forecast.ts          Monte Carlo (400 runs × 90 days), winter energy, council tax 10 instalments
  engine/recurring.ts         detects bills/income + schedules
  engine/understand.ts        summary, fingerprint, groups
  engine/detect.ts            problems, poverty premium, Self Assessment estimate
  engine/support.ts           entitlements & help
  engine/plan.ts              ranked actions with forecast adjustments
  engine/location.ts          sample chain price index, fuel index, nearby comparison, sample places
  engine/invest.ts            readiness + investing simulator
  engine/categorise.ts, dates.ts, rng.ts
```

## 7. Demo personas (all synthetic)

- **Amara**, 31, Leeds: single parent, 4-weekly wages + Universal Credit, prepayment meter, BNPL, overdraft fees. Story: ~£418/yr poverty premium, 34% risk on 6 Dec around rent, Council Tax Reduction + Healthy Start.
- **Jordan**, 26, Birmingham: gig rider. Story: fine until a ~£1,770 Self Assessment bill on 31 Jan; HMRC payment plan fixes it.
- **Kacper**, 38, Peterborough: new to UK, Polish, zero-hours, remittances, ATM fees. Story: language, fees, 48% risk on 3 Dec.
- **Priya**, 20, Manchester: student, termly loan. Story: paying council tax she doesn't owe (student exemption + refund), loan runs out before 19 Jan.

## 8. Work plan (do in order, commit after each)

1. **Baseline:** `git init` if needed; `npm install`; `npm run check`; `npm run build`; commit.
2. **Smoke test:** run dev server in background; hit every API route (receipt with `public/samples/receipt-express.png` as a base64 data URL + `sampleId: "express"`); fix errors in the server log.
3. **Cloud AI** (if `/api/status` shows `cloud: true`): test narration (en + pl), agent, and receipt reading of both sample images via AI. Harden JSON parsing; tighten prompts.
4. **Local AI** (Tether): QVAC CLI → `qvac serve openai`, else Ollama. Set `LOCAL_AI_MODEL`. Test all AI routes with `mode: "local"`.
5. **UX polish (≤60 min):** "AI is writing…" loading states (dashboard narration, Ask); offline banner ("On-device mode: nothing leaves your device"); mobile pass at 390px on /dashboard, /pay, /snap; graceful Google Places fallback.
6. **Quality pass:** every page × every persona + a questionnaire user: no crashes, no console errors. Add a Playwright smoke test in `scripts/` if Playwright is available.
7. **Pitch:** `PITCH.md`: 5 slides per submission (titles + bullets), 3-minute script per submission, criteria → feature table, 8 judge Q&As with honest answers. Update README.
8. **If time before 17:45:** (a) category trend chart on Understand; (b) "Add to calendar" .ics for upcoming bills; (c) `src/p2p/`: README + minimal local Hyperswarm/Autobase example for a shared-house bill ledger / community price board (Pears bonus for Tether); (d) in-app "Money Circle" community board stub with seeded, clearly-labelled sample posts.
9. **Finish:** build passes, final commit, and a "READY TO DEMO" summary at the top of `PROGRESS.md` (how to start, what works, what's mocked, known issues).

## 9. Definition of done

- `npm run build` passes; all pages load for all personas; no console errors.
- The demo works with no keys (rules fallback), with a cloud key, and with Wi-Fi off (on-device).
- Every AI sentence shows its badge; every insight has "Why am I seeing this?".
- `PROGRESS.md` and `PITCH.md` exist and are accurate.
