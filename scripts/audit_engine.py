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
import statistics
import sys
from datetime import date, timedelta
from pathlib import Path

DATA = Path(".audit/engine.json")
RUNS = 10_000  # far more than the app uses, so the app's sampling error dominates the comparison
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


def data_window(p: dict, today: str, max_days: int) -> tuple[str, str, int]:
    """The period to average over: up to max_days, but only as far as there is data, ending at the newest."""
    dates = [t["date"] for t in p["txns"] if t["source"] != "receipt" and t["date"] < today]
    to = (d(max(dates)) + timedelta(days=1)).isoformat()
    days = max(7, min(max_days, days_between(to, min(dates))))
    return (d(to) - timedelta(days=days)).isoformat(), to, days


def audit_summary(p: dict, essential: set[str], today: str) -> None:
    start, to, days = data_window(p, today, 91)
    recent = [t for t in p["txns"] if start <= t["date"] < to and t["source"] != "receipt" and t["category"] != "internal"]
    k = 30.4 / days
    money_in = sum(t["amount"] for t in recent if t["amount"] > 0 and t["category"] == "income") * k  # refunds and friends are not income
    money_out = -sum(t["amount"] for t in recent if t["amount"] < 0) * k
    by_category: dict[str, float] = {}
    for t in recent:
        if t["amount"] < 0:
            by_category[t["category"]] = by_category.get(t["category"], 0) - t["amount"] * k
    essentials = sum(v for c, v in by_category.items() if c in essential)
    e = p["engine"]
    check(close(money_out, e["monthlyOut"]), "monthly out", f"£{money_out:.2f}")
    # Students' income is averaged from what they tell us, because their loan arrives in lumps.
    if "student_loan" in p["answers"]["incomeTypes"] and p["answers"]["monthlyIncome"] > 0:
        expected_in = p["answers"]["monthlyIncome"]
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
    "fee-od": r"OVERDRAFT|ARRANGED OD|\bO/D\b",
    "fee-unpaid": r"UNPAID ITEM|RETURNED (?:ITEM|PAYMENT|DD)",
    "fee-late": r"LATE (?:PAYMENT )?FEE|LATE PAYMENT",
    "fee-atm": r"ATM FEE|WITHDRAWAL FEE|CASH MACHINE FEE",
    "fee-cashout": r"INSTANT CASHOUT|CASH ?OUT FEE",
    "fee-fx": r"QUICKSEND FEE|TRANSFER FEE",
}


def audit_premium(p: dict, today: str) -> None:
    start, to, days = data_window(p, today, 182)
    recent = [t for t in p["txns"] if start <= t["date"] < to and t["source"] != "receipt"]
    problems = {x["id"]: x for x in p["engine"]["problems"]}

    for problem_id, pattern in FEES.items():
        charges = [t for t in recent if t["amount"] < 0 and re.search(pattern, t["description"], re.I)]
        annual = -sum(t["amount"] for t in charges) * 365 / days
        if charges or problem_id in problems:
            found = problems.get(problem_id, {}).get("annualCost") or 0
            check(close(annual, found), f"{problem_id} per year", f"£{annual:.2f} from {len(charges)} charges")

    total = sum(x["annualCost"] or 0 for x in problems.values() if x["premium"])
    check(close(total, p["engine"]["premiumAnnual"]), "fees and charges add up", f"£{total:.2f}")


def audit_tax(p: dict, today: str) -> None:
    tax = p["engine"]["tax"]
    if "gig" not in p["answers"]["incomeTypes"]:
        check(tax is None, "no tax estimate for non-gig income")
        return
    start, to, days = data_window(p, today, 182)
    recent = [t for t in p["txns"] if start <= t["date"] < to and t["source"] != "receipt"]
    yearly = 365 / days
    gig_pattern = "PAYOUT|DELIVEROO|UBER|JUST ?EAT|STUART|EVRI|BOLT|AMAZON FLEX|STRIPE|SUMUP|ZETTLE|PAYPAL"
    money = [t for t in recent if t["amount"] > 0 and t["category"] == "income"]
    income = sum(t["amount"] for t in money if re.search(gig_pattern, t["description"], re.I)) * yearly
    other = sum(t["amount"] for t in money if not re.search(gig_pattern, t["description"], re.I)) * yearly
    expenses = 0.0
    for t in recent:
        if t["amount"] < 0 and (t["category"] == "transport" or re.search("MOBILE|PHONE", t["description"], re.I)):
            expenses += -t["amount"] if t["category"] == "transport" else -t["amount"] * 0.5
    expenses *= yearly
    profit = max(0, income - expenses)
    top = other + profit
    def band(lower: float, upper: float) -> float:
        return max(0.0, min(top, upper) - max(other, lower))
    income_tax = band(12_570, 50_270) * 0.20 + band(50_270, 125_140) * 0.40 + band(125_140, math.inf) * 0.45
    national_insurance = max(0.0, min(profit, 50_270) - 12_570) * 0.06 + max(0.0, profit - 50_270) * 0.02
    bill = round((income_tax + national_insurance) / 10) * 10
    payment_on_account = round(bill / 2 / 10) * 10 if bill >= 1000 else 0
    check(tax["due"] > today and tax["due"].endswith("-01-31"), "tax: due on the next 31 January", tax["due"])
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


# ---- Everyday cash flow pool ---------------------------------------------------------------------


def winter_factor(day: date) -> float:
    if day.month in (12, 1, 2):
        return 1.3
    return 1.15 if day.month in (11, 3) else 1.0


def counts_as_everyday(t: dict, paid_in: dict[str, list[str]], to: str) -> bool:
    """Spending of £250 or less; money in of £250 or less, or more if the same payer keeps paying; never from a payer who has stopped."""
    if t["source"] == "receipt" or t["category"] in ("savings", "internal"):
        return False
    if t["amount"] < 0:
        return -t["amount"] <= 250
    dates = sorted(paid_in.get(t["key"], []))
    if len(dates) >= 2:
        gaps = [days_between(b, a) for a, b in zip(dates, dates[1:])]
        if days_between(to, dates[-1]) > max(14, statistics.median(gaps) * 2 + 7):
            return False
    return t["amount"] <= 250 or len(dates) >= (2 if t["category"] == "income" else 3)


def build_pool(p: dict, today: str) -> list[list[dict]]:
    first, to, days = data_window(p, today, 91)
    start = d(first)
    recurring = {r["key"] for r in p["recurring"]}
    by_date = {(start + timedelta(days=i)).isoformat(): {"other": 0.0, "energy": 0.0} for i in range(days)}
    paid_in: dict[str, list[str]] = {}
    for t in p["txns"]:
        if t["amount"] > 0 and t["date"] in by_date and t["source"] != "receipt" and t["category"] not in ("savings", "internal"):
            paid_in.setdefault(t["key"], []).append(t["date"])
    for t in p["txns"]:
        if t["date"] not in by_date or t["key"] in recurring or not counts_as_everyday(t, paid_in, to):
            continue
        if t["amount"] < 0 and t["category"] == "energy":
            by_date[t["date"]]["energy"] += -t["amount"] / winter_factor(d(t["date"]))  # held at its base level
        else:
            by_date[t["date"]]["other"] += -t["amount"]
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
    check(same, "everyday cash flow pool matches, day by day")


# ---- Monte Carlo forecast ------------------------------------------------------------------------


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
            fixed = r["last"] * ct_multiplier * (10 / 12 if spread and not p["ctAlready12"] else 1)
            if fixed == 0:
                continue
        sign = 1 if r["direction"] == "in" else -1
        # Energy that follows usage moves with the season; a fixed Direct Debit doesn't.
        seasonal = r["category"] == "energy" and r["direction"] == "out" and (r["cadence"] == "days" or r["variable"])
        base_fixed = fixed / winter_factor(d(r["lastDate"])) if seasonal and fixed is not None else fixed
        base_samples = None
        if r["variable"]:
            base_samples = [a / winter_factor(d(x)) if seasonal else a for a, x in zip(r["amounts"], r["dates"])][-12:]
        for s in item["dates"]:
            offset = days_between(s, today)
            if 0 <= offset < HORIZON:
                season = winter_factor(d(s)) if seasonal else 1
                events[offset].append((sign, base_fixed * season if base_fixed is not None else None, [a * season for a in base_samples] if base_samples else None))

    dropped = set(adjust.get("dropKnownLabels", []))
    for k in [x for x in p["known"] if x["label"] not in dropped] + adjust.get("extra", []):
        offset = days_between(k["date"], today)
        if 0 <= offset < HORIZON:
            events[offset].append((1 if k["amount"] >= 0 else -1, abs(k["amount"]), None))

    days = [start + timedelta(days=i) for i in range(HORIZON)]
    day_pool = [pool[js_weekday(x)] for x in days]
    winter = [winter_factor(x) for x in days]
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
                balance -= sample["other"] + sample["energy"] * winter[i]
            balance += daily_delta
            columns[i][run] = balance
            if balance < 0:
                below[i] += 1
    medians = [sorted(c)[RUNS // 2] for c in columns]
    return {"pBelow0": [b / RUNS for b in below], "p50": medians}


def sampling_margin(prob: float, runs: int) -> float:
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

    # What the app shows comes from fewer runs, so it should sit within sampling error of the steadier figure.
    shown_runs = e["shownRuns"]
    compare_forecast(f"shown in app ({shown_runs} runs)", base, e["forecast"], shown_runs)
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
    shown_text = "none" if not shown_first else f"{shown_first['date']} at {shown_first['p'] * 100:.1f}% (±{sampling_margin(shown_first['p'], shown_runs):.0f} points from sampling)"
    print(f"  info first risky day: shown {shown_text}; at {RUNS:,} runs {first_text}")
    print(f"  info risky days: shown {risky_days(e['forecast']['pBelow0'])} to {risky_days(e['plan']['pBelow0'])}; at {RUNS:,} runs {risky_days(base['pBelow0'])} to {risky_days(plan['pBelow0'])}")


def main() -> int:
    if not DATA.exists():
        print(f"{DATA} not found. Run: npm run audit")
        return 2
    data = json.loads(DATA.read_text(encoding="utf-8"))
    today, essential = data["today"], set(data["essential"])
    print(f"Independent audit in Python: {RUNS:,} runs per forecast, dated {today}")
    for index, p in enumerate(data["people"]):
        print(f"\n=== {p['name']}")
        audit_summary(p, essential, today)
        audit_premium(p, today)
        audit_tax(p, today)
        audit_schedule(p)
        pool = build_pool(p, today)
        audit_pool(p, pool)
        audit_forecast(p, pool, today, seed=1000 + index * 10)
    print(f"\n{'ALL AGREED' if not failures else f'{len(failures)} DISAGREEMENT(S): ' + '; '.join(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
