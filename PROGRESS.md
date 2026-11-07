# PROGRESS: Tomorrow

## Where things stand

Real-app rebuild in progress. The hackathon version is preserved at the git tag `hackathon-demo`, and its log and pitch are in git history and `docs/archive/`.

| Milestone | Status |
| --- | --- |
| 1. Real foundation and redesign | Done |
| 2. Accuracy: progressive check-in, back-test | Done, except the back-test on real statements, which only the owner can run |
| 3. On-device reading: browser to QVAC, phone OCR | Next |
| 4. Install, Gmail in browser, real fuel prices | To do |
| 5. Accounts, cloud sync | To do |
| 6. Bank connection on TrueLayer, test mode | To do |
| 7. Reminders, Money Circle | To do |
| 8. Security, legal drafts, setup and deployment | To do |

## Log

### 7 Nov 2026: Milestone 2, accuracy

**Unknown now stays unknown.** A blank answer used to read as £0, which is a claim. The engine reports what it doesn't know (`Analysis.gaps`) and every screen uses that. With no balance or income there's no risk figure, no chart and no purchase verdict, and the AI isn't called, because its checks only cover numbers and a warm rewording could imply more than we know.

**False statements this removed:**
- 100% risk of going below £0 for anyone who skipped their income.
- About 1,200 "safe days" for someone with a balance and no known costs, because the daily cost fell back to £1.
- "Essentials take 100% of your income" and "Looks steady" for people with no data.
- "No safety buffer" for someone whose balance we didn't know.
- "Juggler: your income changes from week to week" and "varies by 183%" for anyone paid monthly who hadn't said how they're paid.
- Invented energy of £95, phone of £20 and everyday spending of 12% of income in check-in estimates.

**Forecast bugs found by looking at who the app is for:**
- Income at uneven dates was in neither the schedule nor the daily sampling, so an agency worker's forecast could show no income at all. Repeat payers are now sampled, however large the payment, unless they've stopped paying.
- A 4-weekly wage with only 3 payments, which is what a 3-month statement shows, wasn't spotted.
- Irregular transfers and refunds were ignored in both directions. Those of £250 or less are now sampled. Larger one-offs stay out.
- Winter energy was counted twice for winter samples, and wasn't applied to regular meter top-ups. Samples are now held at a base level, and a fixed Direct Debit stays flat.
- The grocery scale in the plan code scaled all everyday spending. Nothing used it any more, so it's gone.
- Forecast runs went from 400 to 1,000 (about 3 points either way, down from 5). The safer-date search uses 200 and then confirms in full.

**New:**
- One-at-a-time follow-up questions on Home (`engine/questions.ts`), each saying what it improves and only asked when it applies. "Not now" puts them away until the app is next opened, rather than needing 25 dismissals.
- Your details (`/details`): see and change every answer, and remove a mistyped bill.
- `scripts/backtest.mts`: stands at past dates, forecasts using only what was known then, and compares with what happened. It prints percentages and counts only: typical miss, direction of the miss, a simple guess to beat, how often the range held, warnings given and missed, and whether stated risks mean what they say.

**Not yet known: real-world accuracy.** The back-test has only run on made-up people, where its figures check the tool and say nothing about real life. It also uses statements alone, so a student's loan the person would normally tell us about can't be seen coming (Priya's 60-day miss of 46% is this). The owner needs to run it on real statements.

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
- **Forecast at 1,000 runs,** with the ±3 point margin stated. Timed at about 250 to 300ms for a purchase check on this computer, so a slow phone could take a second or two: Ask now shows the question before working it out.
- **Python audit kept** as an independent check of the engine, at the owner's request.
- **Big one-offs stay out of the forecast,** even though real life keeps producing them. Sampling a past car repair would suggest another is coming, which people find baffling. This may make forecasts too hopeful, so the back-test reports the direction of the miss and how much one-offs account for. Revisit with real results.
- **Daily sampling treats each day separately,** which probably makes the range too narrow further ahead, because real spending runs in good and bad weeks. Left alone until the real back-test shows whether it matters.
- **Safe days need rent and food in an estimate.** Below that, the figure would be wildly high, so it shows a dash.
- **Follow-up order:** balance and income first, because nothing can be judged without them. Once there's a forecast, a real next step sits above the next question.
