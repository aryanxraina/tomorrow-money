# Tomorrow: pitch pack

Two submissions from one codebase. Every figure below comes from the app's engine with the demo date pinned to 7 Nov 2026. All demo people and their data are synthetic. Say so.

**Before any demo:** More → "Delete all my data on this device", then pick the person fresh. Snapping a receipt that is not matched adds spending, which changes the forecast.

## Numbers to have in your head

| Person | Situation | Forecast | Safe days: now → 90 days → with plan | Other |
| --- | --- | --- | --- | --- |
| Amara, Leeds | Single parent, prepayment meter, BNPL | 34% risk on 6 Dec, **reaching 100% by 12 Dec** | 5 → 0 → 6 | £417/yr poverty premium. May be missing about £106/month plus £150 one-off. Risky days 25 → 8 |
| Jordan, Birmingham | Gig rider | Fine until an estimated £1,770 Self Assessment bill on 31 Jan | 6 → 0 → 24 | Risky days 5 → 0, if HMRC agrees a payment plan |
| Kacper, Peterborough | New to UK, Polish, zero hours | 48% risk on 3 Dec, 42% with plan | 12 → 24 → 26 | £164/yr in cash machine and transfer fees |
| Priya, Manchester | Student, termly loan | 100% on 1 Jan before the loan arrives | 24 → 25 → 44 | Paying about £980/yr council tax she may not owe. Risky days 18 → 4 |

Amara's plan is not a magic fix: her peak risk only falls to 85%. Say that if asked. It is more credible than claiming she is safe.

---

# Submission A: bank challenge (AI-Powered Financial Inclusion & Resilience)

## Slides

**1. Being poor costs more, and nobody tells you**
- Fees, prepayment meters and monthly insurance add up without anyone showing the total
- Amara, a demo single parent, pays £417 a year extra
- Most money apps show the past. People under pressure need to see next month

**2. Tomorrow: financial time travel**
- A check-in in 4 short sections, in 4 languages, every question optional
- Five steps: Understand, Detect, Predict, Find support, Plan
- One number throughout: Safe days, the days your money covers essentials if income stops

**3. Predictive, not just descriptive**
- 400 simulated futures, 90 days ahead, built from the person's own spending
- The exact day risk appears and the bill behind it: 34% on 6 Dec around rent, reaching 100% by 12 Dec
- What-if shocks. Each plan step re-runs the forecast

**4. A coach you can check**
- Numbers by code, words by AI, enforced: AI text with a number the app didn't supply is rejected
- Every sentence is labelled: cloud AI, on-device AI, or app rules
- "Why am I seeing this?" on every insight. Entitlements say "likely, check" and link to official sources

**5. Built for people others miss, and feasible now**
- Polish, Hindi, Urdu with right-to-left, bigger text, plain words
- Works with no AI, no internet and no bank connection
- Groups and scores are never used for credit or pricing
- Next: open banking in place of demo data, a pilot with a debt charity or housing association

## 3-minute script

**0:00 Hook.** "Low-income households often pay more for the same essentials. This is Amara, a made-up single parent in Leeds, using made-up bank data." Open Amara → Detect. "She pays £417 a year extra and nobody has ever shown her that total."

**0:30 Time travel.** Predict. "This is her next 90 days, simulated 400 times from her own spending. There's a 34% chance she goes below zero on 6 December, around her rent, and by 12 December it reaches 100%." Tap "£400 car repair". "One surprise, and her risky days go from 25 to 35."

**1:10 Support and plan.** Support. "She may be missing about £106 a month. These are estimates, so each one links to the official check." Plan. "Each step re-runs the forecast. Risky days go from 25 to 8, and Safe days from 0 to 6. That isn't fixed, but it's a real start."

**1:50 The coach.** Ask → "Can I afford £60 this week?" "A generic chatbot could say yes: she has £236. Our code runs the purchase through the forecast. Risk goes from 52% to 84%, so the answer is no. The AI explains that, and it can't overrule it."

**2:20 Everyday tools.** Snap → corner-shop sample → "It matches her card payment, so it isn't counted twice." Pay → Tesco Express → "Lidl is 6 minutes away, about £4.78 cheaper. These shop prices are samples for the demo."

**2:45 Inclusion.** Switch to Kacper, in Polish. "Language, fees, a new country. And it runs on the device with no internet. Numbers by code, words by AI, and nothing used for credit. That's a coach people can trust."

## Criteria → features

| Criterion | What to show |
| --- | --- |
| Customer focus & user-centric design | Optional questions, plain words, one headline number, asks permission before adding a receipt |
| Innovation & creativity | Financial time travel, Safe days, checkout comparison that counts the trip, poverty premium total |
| Social impact & inclusivity (ethical, transparent) | 4 languages with right-to-left, offline, badges on every sentence, "Why am I seeing this?", no credit or pricing use |
| Use of AI & data | Monte Carlo forecast, recurring bill detection, number guard, code-decided verdicts, AI reading receipts and emails, independent Python audit of the engine (`npm run audit`) |
| Feasibility & demo clarity | Runs today with no keys, 4 distinct stories, plain TypeScript engine with `npm run check` |

---

# Submission B: Tether challenge (AI that runs 100% locally)

## Slides

**1. The people who need money advice can least afford to give up their data**
- Our community: students, new arrivals and shift workers in the UK
- Financial data is sensitive, and data and connections aren't free
- So the coach has to run on the device, with no account and no cloud

**2. Tomorrow, Wi-Fi off**
- Same 90-day forecast, plan and coach with the network switched off
- The chat model and OCR both run through QVAC on this laptop
- The forecast and plan are plain code, so they never needed a server

**3. QVAC in the stack**
- `qvac serve --openai`: `qwen3-4b` for the coach, `OCR_LATIN` through `/qvac/v1/ocr` for receipts
- Receipt photo → QVAC OCR → our parser, which repairs misreads using the printed total
- Reasoning turned off per request with `reasoning_budget: false`; local calls are queued and health-checked

**4. Built for small models being wrong**
- We tested the small model and it said "yes, you can afford it" when risk rose from 55% to 84%
- So code decides, and the model explains
- Guards reject invented numbers, wrong language and changed payment terms, then fall back to labelled app wording

**5. Peer-to-peer with Pears: bills with no server**
- Working shared-house ledger: Hyperswarm finds housemates, Autobase merges their logs
- Add bills offline on two devices, reconnect, and they agree to the penny
- Next: package on the Pear runtime, call `@qvac/sdk` directly, add a community price board

## 3-minute script

**0:00 Problem.** "Financial coaching apps want your bank data on their servers. For someone on a zero-hours contract, that's a lot to ask. This is Tomorrow, and I'm turning Wi-Fi off now." Turn it off. Point at the amber dot and the banner: "On-device mode: nothing leaves your device."

**0:30 It still works.** Open Priya, a made-up student. "No server. She's paying about £980 a year in council tax she may not owe. Her student loan runs out around 1 January." Predict, then Plan: "Risky days from 18 to 4."

**1:10 QVAC: the coach.** Ask → "Can I afford £60 this week?" Wait for the answer. "That's Qwen running through QVAC on this laptop. The verdict above it comes from our forecast. We tested this: the small model alone said yes to a purchase that made things much worse. So the model explains and the code decides."

**1:50 QVAC: receipts.** Snap → supermarket sample. "QVAC OCR reads this on the device. It misread £3.49 as 13.49, which would be a £10 error. Our parser catches it because the lines have to add up to the printed total." Point at £22.95.

**2:25 Pears.** Two windows, Ana and Ben, already open. Press "Go offline" on both, then add a bill on each. Press "Reconnect" on both. "Housemates share bills directly, with no server in the middle. They were apart, and now they agree to the penny. Pears modules running on Node, as two separate processes on this laptop."

**2:50 Close.** "Private by design, useful offline, and honest about what a small model can and can't do."

## Criteria → features

| Criterion | What to show |
| --- | --- |
| Problem & impact | Students, new arrivals and shift workers; council tax case; privacy as a real barrier |
| QVAC implementation | Chat and OCR through QVAC, `qvac.config.json`, reasoning control, queue and health check, guards |
| Pears implementation | Hyperswarm, Corestore and Autobase ledger; offline merge shown live. See "P2P status" for its limits |
| Technical architecture | Pure engine, one provider switch, `ask()` enforces on-device, rules fallback on every AI call |
| Creativity, design & presentation | Safe days, Wi-Fi-off moment, OCR error caught by arithmetic |

## P2P status

**Works today:** a shared-house bill ledger in `src/p2p`, using Hyperswarm, Corestore and Autobase. Two separate processes sync through a local DHT, with no internet. Bills added while offline merge on reconnect, and both sides agree to the penny. Tested by `npm test` and by driving the pages in a browser.

**Say this plainly if asked:** it runs on Node with Pears modules, not on the Pear runtime. It is a separate demo, not yet connected to the main app's screens. It has only been run on one machine, not across two devices. It isn't ready for real use: no encryption at rest and no approval step for bills (see `src/p2p/README.md`).

**To demo:** before going on stage, run `cd src/p2p && npm run demo` and open the two links side by side.

---

# Judge Q&A

**1. How accurate is the forecast?**
Two separate answers. Is the maths right? We checked it: a separate Python audit recomputes the figures from the raw transactions and re-implements the simulation, and at 10,000 runs each the two agree closely. Does it predict real life? We don't know yet. It has not been back-tested against real outcomes, because all our data is synthetic, and a pilot would need to measure that.

The app runs 400 simulations, so its risk figures can move by about 5 points. Amara's 34% is about 36% at 10,000 runs, and her £60 check of 52% to 84% is about 60% to 88%. No verdict changes for any demo person. We kept 400 so the check stays quick on a phone, and the app states the margin.

**2. Is this regulated financial advice?**
No. It is guidance, and the app says so. For debt problems it points to free regulated advisers such as StepChange, National Debtline and Citizens Advice. A real launch would need legal review of that boundary.

**3. What stops the AI giving a wrong number?**
Code calculates every number. AI text containing a number the app didn't supply is rejected, and the app's own wording is shown with a "no AI" badge. It is not perfect: this catches wrong numbers, not every wrong meaning. So the verdicts come from code, and the coach's chat answers are labelled as AI.

**4. How good is the on-device model, honestly?**
Good enough to explain, not good enough to trust alone. In testing, freer rewriting turned "one-off" into "once a year", and in Polish it turned "cash machine fees" into something about casinos. So on-device narration on the dashboard is English only and often shows the app's own wording, with the right badge. The coach chat still uses the model in every language, and those answers can contain mistakes.

**5. Is the data real? Are the shop prices real?**
No. People, transactions, receipts, emails, shop and fuel prices are synthetic and labelled. Nothing comes from Reddit or any other community site: the Money Circle posts are samples we wrote, and the shared board itself isn't built. Share prices and Google Places are live only if keys are set. Entitlement amounts are estimates based on the person's answers, with links to official checks.

**6. Does it really work offline?**
The forecast, plan, rules wording and translated text need no network. The model has to be downloaded once, and shop locations fall back to samples offline. Say this only after rehearsing with Wi-Fi off on the demo machine.

**7. Could scores be used against people?**
Groups and the Money Fingerprint are shown to the user, can be changed by redoing the check-in, and are never used for credit or pricing. That rule would have to be contractual in any partnership with a lender. In on-device mode there is no server holding them.

**8. What's the hardest part of making this real?**
Real data and trust. We would need open banking consent flows, back-testing on real outcomes, native-speaker review of the translations (ours have not had it), adviser review of the entitlement rules as they change, and a partner such as a debt charity to reach people who would never download a finance app.
