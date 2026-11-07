#!/usr/bin/env python3
"""Independent audit of the TypeScript money engine. Standard library only.

Run with:  npm run audit

The app's numbers come from src/lib/engine, and this script is never used by the app. It recomputes
those numbers a second way from the raw transactions, including its own Monte Carlo forecast with a
different random generator and far more runs. A wrong formula in the engine should show up here.

Two limits:
- It takes the detected bill schedule as an input (it checks the spacing but does not re-detect bills).
- Agreeing with the engine shows the sums are done as designed, not that the forecast predicts real
  life. All the data is synthetic, so real-world accuracy still needs a back-test with real outcomes.
"""

from __future__ import annotations

import json
import math
import random
import re
import sys
from datetime import date, timedelta
from pathlib import Path

DATA = Path(".audit/engine.json")
RUNS = 10_000  # the engine uses 400, so its sampling error dominates the comparison
PENCE = 0.01
HORIZON = 90
RISK_THRESHOLD = 0.25
Z_LIMIT = 4.5  # checks 450 daily risks per person, so a lower limit would raise false alarms

failures: list[str] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {label}{f': {detail}' if detail else ''}")
    if not ok:
        failures.append(label)


def close(a: float, b: float, tol: float = PENCE) -> bool:
    return abs(a - b) <= tol


def d(s: str) -> date:
    return date.fromisoformat(s)


def js_weekday(day: date) -> int:
    """0 is Sunday, to match the engine. Python's weekday() has 0 as Monday."""
    return (day.weekday() + 1) % 7


def days_between(a: str, b: str) -> int:
    return (d(a) - d(b)).days


# ---- Spending summary ----------------------------------------------------------------------------


def audit_summary(p: dict, essential: set[str], today: str) -> None:
    window_start = (d(today) - timedelta(days=91)).isoformat()
    recent = [t for t in p["txns"] if window_start <= t["date"] < today and t["source"] != "receipt"]
    k = 30.4 / 91
    money_in = sum(t["amount"] for t in recent if t["amount"] > 0) * k
    money_out = -sum(t["amount"] for t in recent if t["amount"] < 0) * k
    by_category: dict[str, float] = {}
    for t in recent:
        if t["amount"] < 0:
            by_category[t["category"]] = by_category.get(t["category"], 0) - t["amount"] * k
    essentials = sum(v for c, v in by_category.items() if c in essential)
    e = p["engine"]
    check(close(money_out, e["monthlyOut"]), "monthly out", f"£{money_out:.2f}")
    # Students' income is averaged from what they tell us, because their loan arrives in lumps.
    if "student_loan" in p["answers"]["incomeTypes"]:
        expected_in = max(p["answers"]["monthlyIncome"], 1)
    else:
        expected_in = money_in or p["answers"]["monthlyIncome"]
    check(close(expected_in, e["monthlyIn"]), "monthly in", f"£{expected_in:.2f}")
    check(close(essentials, e["essentialsMonthly"]), "essentials", f"£{essentials:.2f}")
    check(all(close(by_category.get(c["category"], 0), c["monthly"]) for c in e["byCategory"]), "every spending category")
    daily = max(1, essentials / 30.4)
    buffer_days = max(0, p["answers"]["balance"] + p["answers"]["savings"]) / daily
    check(close(daily, e["dailyEssentials"]) and close(buffer_days, e["bufferDays"]), "safe days now", f"{buffer_days:.1f}")


# ---- Fees and tax --------------------------------------------------------------------------------

FEES = {
    "fee-od": r"OVERDRAFT INTEREST",
    "fee-unpaid": r"UNPAID ITEM|RETURNED",
    "fee-late": r"LATE FEE",
    "fee-atm": r"ATM FEE|WITHDRAWAL FEE",
    "fee-cashout": r"INSTANT CASHOUT",
    "fee-fx": r"QUICKSEND FEE|TRANSFER FEE",
}


def audit_premium(p: dict, today: str) -> None:
    start = (d(today) - timedelta(days=182)).isoformat()
    recent = [t for t in p["txns"] if start <= t["date"] < today and t["source"] != "receipt"]
    problems = {x["id"]: x for x in p["engine"]["problems"]}

    for problem_id, pattern in FEES.items():
        charges = [t for t in recent if t["amount"] < 0 and re.search(pattern, t["description"], re.I)]
        annual = -sum(t["amount"] for t in charges) * 365 / 182
        if charges or problem_id in problems:
            found = problems.get(problem_id, {}).get("annualCost") or 0
            check(close(annual, found), f"{problem_id} per year", f"£{annual:.2f} from {len(charges)} charges")

    # An estimate: the share of shopping at small stores, at 18% above supermarket prices.
    groceries = [t for t in recent if t["category"] == "groceries"]
    small = [t for t in groceries if re.search(r"EXPRESS|LOCAL|CO-OP|COOP|CONVENIENCE", t["description"], re.I)]
    grocery_spend, small_spend = -sum(t["amount"] for t in groceries), -sum(t["amount"] for t in small)
    if grocery_spend > 0 and small_spend / grocery_spend > 0.2:
        check(close(small_spend * 365 / 182 * 0.18, problems["convenience"]["annualCost"]), "convenience-store estimate", f"£{small_spend * 365 / 182 * 0.18:.2f}")

    total = sum(x["annualCost"] or 0 for x in problems.values() if x["premium"])
    check(close(total, p["engine"]["premiumAnnual"]), "poverty premium adds up", f"£{total:.2f}")


def audit_tax(p: dict, today: str) -> None:
    tax = p["engine"]["tax"]
    if "gig" not in p["answers"]["incomeTypes"]:
        check(tax is None, "no tax estimate for non-gig income")
        return
    earliest = min(t["date"] for t in p["txns"])
    span = max(28, min(182, days_between(today, earliest)))
    start = (d(today) - timedelta(days=span)).isoformat()
    recent = [t for t in p["txns"] if start <= t["date"] < today]
    yearly = 365 / span
    income = sum(t["amount"] for t in recent if t["amount"] > 0 and re.search("PAYOUT", t["description"], re.I)) * yearly
    expenses = 0.0
    for t in recent:
        if t["amount"] < 0 and (t["category"] == "transport" or re.search("MOBILE|PHONE", t["description"], re.I)):
            expenses += -t["amount"] if t["category"] == "transport" else -t["amount"] * 0.5
    expenses *= yearly
    profit = max(0, income - expenses)
    taxable = max(0, profit - 12_570)
    bill = round(taxable * 0.26 / 10) * 10  # 20% income tax + 6% Class 4 National Insurance
    payment_on_account = round(bill / 2 / 10) * 10 if bill > 1000 else 0
    check(close(profit, tax["profit"]), "tax: profit", f"£{profit:.2f}")
    check(bill == tax["bill"] and payment_on_account == tax["paymentOnAccount"], "tax: bill and payment on account", f"£{bill} + £{payment_on_account}")
    check(bill + payment_on_account == tax["total"], "tax: total", f"£{bill + payment_on_account}")


# ---- Bill schedule -------------------------------------------------------------------------------


def audit_schedule(p: dict) -> None:
    recurring = {r["key"]: r for r in p["recurring"]}
    bad: list[str] = []
    for item in p["schedule"]:
        r = recurring[item["key"]]
        dates = item["dates"]
        if r["cadence"] == "days":
            gaps = {days_between(b, a) for a, b in zip(dates, dates[1:])}
            if gaps - {r["everyDays"]}:
                bad.append(f"{r['label']} spacing {gaps}")
        else:
            for s in dates:
                last_day = ((d(s).replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)).day
                if d(s).day != min(r["dayOfMonth"], last_day):
                    bad.append(f"{r['label']} on {s}")
        if r["category"] == "council_tax" and any(d(s).month in (2, 3) for s in dates):
            bad.append(f"{r['label']} falls in Feb or Mar")
    check(not bad, "bills fall due on their schedule; council tax skips Feb and Mar", "; ".join(bad))


# ---- Everyday spending pool ----------------------------------------------------------------------


def build_pool(p: dict, today: str) -> list[list[dict]]:
    start = d(today) - timedelta(days=91)
    recurring = {r["key"] for r in p["recurring"]}
    by_date = {(start + timedelta(days=i)).isoformat(): {"other": 0.0, "energy": 0.0} for i in range(91)}
    for t in p["txns"]:
        if t["amount"] >= 0 or t["date"] not in by_date or t["source"] == "receipt":
            continue
        if t["key"] in recurring or t["category"] in ("transfers", "savings") or abs(t["amount"]) > 250:
            continue
        by_date[t["date"]]["energy" if t["category"] == "energy" else "other"] += -t["amount"]
    pool: list[list[dict]] = [[] for _ in range(7)]
    for key in sorted(by_date):
        pool[js_weekday(d(key))].append(by_date[key])
    return pool


def audit_pool(p: dict, pool: list[list[dict]]) -> None:
    engine = p["engine"]["pool"]
    same = all(
        len(mine) == len(theirs) and all(close(a["other"], b["other"]) and close(a["energy"], b["energy"]) for a, b in zip(mine, theirs))
        for mine, theirs in zip(pool, engine)
    )
    check(same, "everyday spending pool matches, day by day")


# ---- Monte Carlo forecast ------------------------------------------------------------------------


def winter_factor(day: date) -> float:
    if day.month in (12, 1, 2):
        return 1.3
    return 1.15 if day.month in (11, 3) else 1.0


def simulate(p: dict, pool: list[list[dict]], today: str, adjust: dict | None, schedule: list[dict], seed: int) -> dict:
    """Returns the daily chance of being below £0 and the daily median balance."""
    adjust = adjust or {}
    start = d(today)
    recurring = {r["key"]: r for r in p["recurring"]}
    events: list[list[tuple[int, float | None, list[float] | None]]] = [[] for _ in range(HORIZON)]
    spread = adjust.get("ctSpread12", False)
    ct_multiplier = adjust.get("ctMultiplier", 1)

    for item in schedule:
        r = recurring[item["key"]]
        if r["key"] in adjust.get("dropKeys", []):
            continue
        fixed = None if r["variable"] else r["last"]
        if r["category"] == "council_tax":
            fixed = r["last"] * ct_multiplier * (10 / 12 if spread else 1)
            if fixed == 0:
                continue
        scale = adjust.get("scale", {}).get(r["category"], 1) if r["direction"] == "out" else 1
        sign = 1 if r["direction"] == "in" else -1
        samples = [a * scale for a in r["amounts"][-12:]] if r["variable"] else None
        for s in item["dates"]:
            offset = days_between(s, today)
            if 0 <= offset < HORIZON:
                events[offset].append((sign, fixed * scale if fixed is not None else None, samples))

    dropped = set(adjust.get("dropKnownLabels", []))
    for k in [x for x in p["known"] if x["label"] not in dropped] + adjust.get("extra", []):
        offset = days_between(k["date"], today)
        if 0 <= offset < HORIZON:
            events[offset].append((1 if k["amount"] >= 0 else -1, abs(k["amount"]), None))

    days = [start + timedelta(days=i) for i in range(HORIZON)]
    day_pool = [pool[js_weekday(x)] for x in days]
    winter = [winter_factor(x) for x in days]
    grocery_scale = adjust.get("scale", {}).get("groceries", 1)
    daily_delta = adjust.get("dailyDelta", 0)

    rng = random.Random(seed)
    below = [0] * HORIZON
    columns = [[0.0] * RUNS for _ in range(HORIZON)]
    for run in range(RUNS):
        balance = p["answers"]["balance"]
        for i in range(HORIZON):
            for sign, fixed, samples in events[i]:
                balance += sign * (fixed if fixed is not None else (rng.choice(samples) if samples else 0))
            if day_pool[i]:
                sample = rng.choice(day_pool[i])
                balance -= sample["other"] * grocery_scale + sample["energy"] * winter[i]
            balance += daily_delta
            columns[i][run] = balance
            if balance < 0:
                below[i] += 1
    medians = [sorted(c)[RUNS // 2] for c in columns]
    return {"pBelow0": [b / RUNS for b in below], "p50": medians}


def sampling_margin(prob: float, runs: int = 400) -> float:
    """95% margin of error, in percentage points, for a risk estimated from `runs` simulations."""
    return 1.96 * math.sqrt(prob * (1 - prob) / runs) * 100


def compare_forecast(label: str, mine: dict, theirs: dict, runs: int) -> None:
    """Both sides are random samples, so daily risks are compared by how many standard errors apart they are."""
    worst_z, worst_day = 0.0, 0
    for i, (a, b) in enumerate(zip(mine["pBelow0"], theirs["pBelow0"])):
        pooled = (a * RUNS + b * runs) / (RUNS + runs)
        error = math.sqrt(max(pooled * (1 - pooled), 1 / (RUNS + runs)) * (1 / RUNS + 1 / runs))
        z = abs(a - b) / error
        if z > worst_z:
            worst_z, worst_day = z, i
    gap = abs(mine["pBelow0"][worst_day] - theirs["pBelow0"][worst_day]) * 100
    check(worst_z < Z_LIMIT, f"{label}: daily risk agrees across {HORIZON} days", f"largest gap {gap:.1f} points on day {worst_day}, z={worst_z:.1f}")
    # A median is much steadier than one risk figure at this many runs, so £25 is a tight limit.
    median_gap = max(abs(a - b) for a, b in zip(mine["p50"], theirs["p50"]))
    check(median_gap <= 25, f"{label}: median balance agrees", f"largest gap £{median_gap:.2f}")


def is_safe(before: float, after: float) -> bool:
    """The rule in src/app/ask/page.tsx that decides the "Can I afford it?" verdict."""
    return after < 0.25 and after - before < 0.1


def risky_days(p_below: list[float]) -> int:
    return sum(1 for x in p_below if x >= RISK_THRESHOLD)


def audit_forecast(p: dict, pool: list[list[dict]], today: str, seed: int) -> None:
    e = p["engine"]
    big = e["large"]
    savings = p["answers"]["savings"]
    daily = e["dailyEssentials"]
    runs = big["runs"]

    # The real test: the TypeScript code and this code, at the same large run count, should match closely.
    base = simulate(p, pool, today, None, p["schedule"], seed)
    compare_forecast("forecast", base, big["forecast"], runs)
    plan = simulate(p, pool, today, p["planAdjust"], p["planSchedule"], seed + 1)
    compare_forecast("forecast with plan", plan, big["plan"], runs)
    car_date = (d(today) + timedelta(days=7)).isoformat()
    car = simulate(p, pool, today, {"extra": [{"date": car_date, "amount": -400, "label": "Car repair"}]}, p["schedule"], seed + 2)
    compare_forecast("forecast with £400 car repair", car, big["carRepair"], runs)
    bought = simulate(p, pool, today, {"extra": [{"date": today, "amount": -60, "label": "Planned purchase"}]}, p["schedule"], seed + 3)
    compare_forecast("forecast after a £60 purchase", bought, big["bought60"], runs)

    # What the app shows comes from 400 runs, so it should sit within sampling error of the steadier figure.
    compare_forecast("shown in app (400 runs)", base, e["forecast"], 400)
    for name, mine, shown in (("in 90 days", base, e["safeDaysBase"]), ("with plan", plan, e["safeDaysPlan"])):
        value = max(0, mine["p50"][-1] + savings) / daily
        check(abs(value - shown) <= 3, f"safe days {name}", f"shown {shown:.1f}, audit {value:.1f}")

    # A verdict is "safe" below 25% after buying and under a 10-point rise. Sampling must not flip it.
    before, after = max(base["pBelow0"][:31]), max(bought["pBelow0"][:31])
    shown_before, shown_after = e["afford60"]["riskBefore"], e["afford60"]["riskAfter"]
    check(is_safe(before, after) == is_safe(shown_before, shown_after), "£60 verdict is the same at both run counts", f"shown {shown_before * 100:.0f}% to {shown_after * 100:.0f}%, at {RUNS:,} runs {before * 100:.0f}% to {after * 100:.0f}%")

    first = next((i for i, x in enumerate(base["pBelow0"]) if x >= RISK_THRESHOLD), None)
    first_text = "none" if first is None else f"{(d(today) + timedelta(days=first)).isoformat()} at {base['pBelow0'][first] * 100:.1f}%"
    shown_first = e["forecast"]["firstRisk"]
    shown_text = "none" if not shown_first else f"{shown_first['date']} at {shown_first['p'] * 100:.1f}% (±{sampling_margin(shown_first['p']):.0f} points from sampling)"
    print(f"  info first risky day: shown {shown_text}; at {RUNS:,} runs {first_text}")
    print(f"  info risky days: shown {risky_days(e['forecast']['pBelow0'])} to {risky_days(e['plan']['pBelow0'])}; at {RUNS:,} runs {risky_days(base['pBelow0'])} to {risky_days(plan['pBelow0'])}")


# ---- Figures quoted in the pitch -----------------------------------------------------------------

# Keep in step with PITCH.md. A failure here means the engine moved and the pitch must be updated.
PITCH = {
    "amara": {"premium": 417, "support": 106, "oneoff": 150, "first": ("2026-12-06", 34), "max": ("2026-12-12", 100), "plan_max": 85, "risky": (25, 8), "car_risky": 35, "safe": (5, 0, 6), "afford": (52, 84)},
    "jordan": {"tax": 1770, "first": ("2027-01-31", 100), "risky": (5, 0), "safe": (6, 0, 24)},
    "kacper": {"premium": 164, "first": ("2026-12-03", 48), "plan_max": 42, "safe": (12, 24, 26)},
    "priya": {"first": ("2027-01-01", 100), "risky": (18, 4), "safe": (24, 25, 44)},
}


def audit_pitch(p: dict) -> None:
    claims = PITCH.get(p["id"], {})
    e = p["engine"]
    actual: dict = {
        "premium": round(e["premiumAnnual"]),
        "support": round(e["supportMonthly"]),
        "oneoff": round(e["supportOneOff"]),
        "tax": e["tax"]["total"] if e["tax"] else None,
        "first": (e["forecast"]["firstRisk"]["date"], round(e["forecast"]["firstRisk"]["p"] * 100)) if e["forecast"]["firstRisk"] else None,
        "max": (e["forecast"]["maxRisk"]["date"], round(e["forecast"]["maxRisk"]["p"] * 100)),
        "plan_max": round(e["plan"]["maxRisk"]["p"] * 100),
        "risky": (risky_days(e["forecast"]["pBelow0"]), risky_days(e["plan"]["pBelow0"])),
        "car_risky": risky_days(e["carRepair"]["pBelow0"]),
        "safe": (round(e["bufferDays"]), round(e["safeDaysBase"]), round(e["safeDaysPlan"])),
        "afford": (round(e["afford60"]["riskBefore"] * 100), round(e["afford60"]["riskAfter"] * 100)),
    }
    wrong = {k: f"pitch {v}, engine {actual[k]}" for k, v in claims.items() if actual[k] != v}
    check(not wrong, f"{len(claims)} pitch figures match the engine", str(wrong) if wrong else "")


def main() -> int:
    if not DATA.exists():
        print(f"{DATA} not found. Run: npm run audit")
        return 2
    data = json.loads(DATA.read_text(encoding="utf-8"))
    today, essential = data["today"], set(data["essential"])
    print(f"Independent audit in Python: {RUNS:,} runs per forecast against the engine's 400, dated {today}")
    for index, p in enumerate(data["people"]):
        print(f"\n=== {p['name']}")
        audit_summary(p, essential, today)
        audit_premium(p, today)
        audit_tax(p, today)
        audit_schedule(p)
        pool = build_pool(p, today)
        audit_pool(p, pool)
        audit_forecast(p, pool, today, seed=1000 + index * 10)
        audit_pitch(p)
    print(f"\n{'ALL AGREED' if not failures else f'{len(failures)} DISAGREEMENT(S): ' + '; '.join(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
