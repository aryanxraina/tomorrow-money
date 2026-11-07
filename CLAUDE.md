# CLAUDE.md: Tomorrow

Read `AGENTS.md` too (Next.js 16 notes). On 7 Nov 2026 this stopped being a hackathon demo: it's now a real app, built to public standard. The demo is preserved at the git tag `hackathon-demo`.

**Ask the owner about product decisions, in small batches with researched options.** Decide routine engineering yourself, and log it in `PROGRESS.md`.

## 1. What this is

**Tomorrow** helps people under money pressure see problems coming: a 90-day forecast, day by day, plus help they may be missing and a short plan. One number runs through it: **Safe days**, how long money covers essentials if income stops.

The owner's five steps are the main tabs: **Home** (summary), **Spending** (understand and detect), **Forecast** (predict), **Help** (find support), **Plan** (act).

## 2. Decisions the owner has made

| Area | Decision |
| --- | --- |
| Goal | Eventual public launch, no date, quality first. Legal owner today is just the owner, with no company. Funding undecided |
| Budget | £0: free tiers only |
| Platform | Phone web app (installable), hosted on Vercel + Supabase free plans |
| Look | "Pine": deep green and lime, Bricolage Grotesque numbers, DM Sans text. Dark mode follows the phone, with an override. Mockups: https://claude.ai/artifact/9iRyGTwnUXbts3ne4NwYYR |
| Labels | Quiet: a small note on AI-written text only, and an info control explaining numbers. No "computed by code" pills |
| Sign-in | Email link and Google |
| Storage | Device first. Cloud sync is opt-in |
| AI | QVAC on a computer, with the browser talking to it directly so nothing passes through the server. Phones use app rules. Cloud AI is built but off until there's a key, and needs consent |
| Bank data | Statement upload now. Live connection on TrueLayer, in test mode only, until the FCA route is decided on legal advice |
| Gmail | Read in the browser, never through the server. 100 named test users until Google's review |
| Check-in | About 2 minutes, then one question at a time, only when the answer would change a result |
| Entitlements | "Likely, check" with official links and no £ estimates. Only counted once the person enters a confirmed amount. England and Wales rules first |
| Removed | Demo people, pinned date, grocery price comparison. Invest is education only, with no share prices or named funds. Fuel prices are real, from Fuel Finder |
| Languages | English first. Others return only after native-speaker review |
| Audience | Low-income workers and families, gig and zero-hours workers, students, people new to the UK |
| Reminders | Phone notifications and email. The server holds dates only, never amounts or bill names |
| Money Circle | A real anonymous board. The owner approves every post. Crisis and debt-help contacts always shown |
| Receipts | Computers: QVAC OCR. Phones: Tesseract.js in the browser. Prices always come from code, checked against the printed total |
| Later | Shared-house bills (`src/p2p` stays in the repo) |

## 3. Rules

1. **Numbers by code, words by AI.** All maths lives in `src/lib/engine`, in plain TypeScript. AI only explains, and its text passes `ai/guard.ts`. Verdicts come from code.
2. **The app must always work with no AI at all.**
3. **Privacy.** In On-device mode nothing goes to the cloud or to Google. Bank statements are parsed in the browser.
4. **Never read the owner's real data.** Anything read in a session is sent to Anthropic. Real statements and emails are tested with scripts that print counts only (`scripts/check-statement.mts`). Don't read `.env.local`.
5. **Honesty.** Never invent a number. Unanswered questions stay unknown, not guessed. Estimates say so. This is guidance, not regulated financial or debt advice. Scores are never used for credit or pricing. Never imply it's launch-ready: see section 6.
6. **Design.** Use the tokens in `globals.css` and the components in `components/ui.tsx`. No raw colours, no emoji icons (use `lucide-react`). Look at rendered screenshots, in light and dark, before calling UI work done.
7. **Never print, log or commit secrets.** `.env.local` is git-ignored.
8. After any change in `src/lib/engine`: `npm run check` and `npm run audit`.
9. `npm run build` must pass before every commit. Never push: the owner pushes from GitHub Desktop.
10. Few dependencies, small focused changes.

## 4. Gotchas

- **Next.js 16 with `cacheComponents`:** a GET route that reads env vars must call `await connection()`. The dev-only instant-navigation check is deliberately set to manual in `next.config.ts`, because pages render after mount.
- **Zustand selectors must not return a new array or object:** it causes an infinite re-render. Select the stable slice, then derive with `useMemo`.
- Pages are client components rendered after mount (`AppShell` gates on `useMounted`), because state lives in localStorage. That makes `window` safe in a page's initial state.
- Fonts are self-hosted through `@fontsource`, so the build and app work offline. Don't use `next/font/google`.
- QVAC chat silently drops images, so never send one a photo. Reasoning is off with `reasoning_budget: false`. Windows: `%APPDATA%\npm\qvac.cmd`, port 11435 because Ollama holds 11434.
- PowerShell treats a curly apostrophe (’) as a quote, so don't put UI text in PowerShell strings. Use the Edit tool.
- Tax rates in `engine/tax.ts` change each April. Check them on GOV.UK.

## 5. Commands

```bash
npm run dev            # http://localhost:3000
npm run build          # must pass before commits
npm run check          # engine, importer, tax, parser and guard tests
npm run audit          # independent Python check of the engine
npx tsx scripts/export-seeds.mts && node scripts/smoke-ui.mjs   # browser pass; needs a running server
node scripts/smoke-api.mjs [baseUrl] [mode]                     # API routes
npx tsx scripts/check-statement.mts "statement.csv"             # real statement; prints counts only
qvac serve --openai -p 11435                                    # on-device AI, from this folder
```

## 6. What a public launch still needs, beyond code

A company, an FCA route for live bank data (own registration or agent status), Google's review and security assessment for Gmail, ICO registration, legal review of the privacy policy, terms and the guidance/advice boundary, native-speaker translation review, a back-test on real outcomes, and money. Say so plainly whenever launch comes up.
