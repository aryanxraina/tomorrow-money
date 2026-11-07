# PROGRESS: Tomorrow

## Where things stand

Real-app rebuild in progress. The hackathon version is preserved at the git tag `hackathon-demo`, and its log and pitch are in git history and `docs/archive/`.

| Milestone | Status |
| --- | --- |
| 1. Real foundation and redesign | Done |
| 2. Accuracy: progressive check-in, back-test | Next |
| 3. On-device reading: browser to QVAC, phone OCR | To do |
| 4. Install, Gmail in browser, real fuel prices | To do |
| 5. Accounts, cloud sync | To do |
| 6. Bank connection on TrueLayer, test mode | To do |
| 7. Reminders, Money Circle | To do |
| 8. Security, legal drafts, setup and deployment | To do |

## Log

### 7 Nov 2026: Milestone 1, real foundation and redesign

**Product:** the owner chose a real app over the hackathon submission (see `CLAUDE.md` section 2 for every decision).

**Removed:** demo people (moved to `tests/fixtures`), sample inbox and receipts, sample shop prices and places, share prices, unreviewed translations, the pinned date.

**Accuracy bugs found by treating it as real money, now fixed and tested:**
- Any money in counted as income, including transfers from savings and friends paying back. Now income means income: regular money from an unknown name is treated as income, and the person can correct it.
- Skipping a question silently assumed £1,200 income and £600 rent. Now unanswered stays unknown.
- "FEE" matched inside "COFFEE", "RENT" inside "PARENT" and "BUS" inside "BUSINESS". All category rules now match whole words, and a much wider UK merchant list was added.
- A short statement was averaged over 91 days (understating spending by two thirds), and an old statement read as spending having stopped. Averages now use the period the data covers.
- Recurring bills "stopped" if the statement was over 45 days old. Now judged from the newest data held.
- The single person discount estimate was a third of the bill, not 25%. Estimates are gone entirely, by the owner's decision.
- The tax date was hard-coded to one January. It also ignored higher rates and any job using up the personal allowance. Rewritten from GOV.UK's 2026 to 2027 rates, with worked checks.
- The poverty premium included assumed figures (18% at convenience stores, 10% on monthly insurance). It now only adds charges actually in the person's transactions.
- Council tax always assumed 10 instalments. Now recognises people paying over 12.

**New:** a statement importer that recognises columns by meaning and checks itself against the file's running balance, a screen for matching columns by hand, a transaction list with category corrections, confirming awarded help so the forecast counts it, data export, and the Pine design system with dark mode.

**Real statement formats are unverified.** Public sources contradict each other (for example on whether Nationwide offers CSV at all), so `tests/fixtures/statements.ts` is my best understanding of each. `scripts/check-statement.mts` tests real files and prints counts only. Until the owner runs it, treat bank detection as untested on real files.

## Decisions

- **Grocery comparison removed, not faked.** No official UK price feed exists. Scraping may break retailers' terms. The price tracker from a person's own receipts stays.
- **Radar chart replaced with score bars.** Easier to read on a phone, and each score says what it means.
- **Plan separates claims from steps.** Claims can't change the forecast until confirmed, so tick boxes on them would do nothing.
- **Help shows the top 4 first**, ranked by how much each could change someone's position. Debt advice comes first when it applies.
- **Forecast stays at 400 runs for now,** with the ±5 point margin stated. To be revisited in milestone 2 with a back-test.
- **Python audit kept** as an independent check of the engine, at the owner's request.
