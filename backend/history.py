"""Sample history: month-end values for every client and benchmark indices, so pages can compare
this month with last, this quarter with last, and this fiscal year (April to March) with last.

Everything is generated deterministically and ends exactly at today's figures: a client's last month
equals their current value and invested amount, and revenue this fiscal year adds up to `revenue_ytd`.
Illustrative sample data, not real market history.
"""
from __future__ import annotations

import datetime as dt
import math
import random
from typing import Any

from .store import today_ist

MARKET_MONTHS = 150  # benchmark history, enough for 10-year returns later
# monthly mean and volatility per asset class
_CLASS = {"Equity": (0.0105, 0.045), "Debt": (0.0058, 0.006), "Gold": (0.0085, 0.035), "Cash": (0.0054, 0.0006)}
# annual trail/fee earned by Kova, by product type (shapes revenue month to month; scaled to revenue_ytd)
_TRAIL = {"Mutual fund": 0.008, "PMS": 0.015, "AIF": 0.012, "Bond": 0.002, "Fixed deposit": 0.003}

# benchmark → how it moves with the asset classes (weights) plus a small yearly edge
BENCHMARKS: dict[str, dict[str, Any]] = {
    "Nifty 50 TRI": {"class": "Equity", "mix": {"Equity": 0.95}, "edge": 0.0},
    "Nifty 100 TRI": {"class": "Equity", "mix": {"Equity": 0.97}, "edge": 0.002},
    "Nifty 500 TRI": {"class": "Equity", "mix": {"Equity": 1.0}, "edge": 0.004},
    "Nifty Midcap 150 TRI": {"class": "Equity", "mix": {"Equity": 1.2}, "edge": 0.02},
    "Nifty Smallcap 250 TRI": {"class": "Equity", "mix": {"Equity": 1.35}, "edge": 0.015},
    "MSCI ACWI": {"class": "Equity", "mix": {"Equity": 0.55}, "edge": 0.0},
    "Nifty 50 Hybrid Composite Debt 50:50": {"class": "Equity", "mix": {"Equity": 0.5, "Debt": 0.5}, "edge": 0.0},
    "Nifty 500 65% + Debt 25% + Gold 10%": {"class": "Equity", "mix": {"Equity": 0.65, "Debt": 0.25, "Gold": 0.1}, "edge": 0.0},
    "CRISIL Corporate Bond A-II": {"class": "Debt", "mix": {"Debt": 1.0}, "edge": 0.0},
    "CRISIL Short Duration A-II": {"class": "Debt", "mix": {"Debt": 0.85, "Cash": 0.15}, "edge": 0.0},
    "CRISIL Liquid Debt A-I": {"class": "Cash", "mix": {"Cash": 1.0}, "edge": 0.0},
    "Nifty 50 Arbitrage": {"class": "Cash", "mix": {"Cash": 1.0}, "edge": 0.003},
    "Domestic gold price": {"class": "Gold", "mix": {"Gold": 1.0}, "edge": 0.0},
}


def month_key(d: dt.date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def add_months(d: dt.date, n: int) -> dt.date:
    y, m = divmod(d.month - 1 + n, 12)
    return dt.date(d.year + y, m + 1, 1)


def months_between(a: dt.date, b: dt.date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def fy_start(d: dt.date) -> dt.date:
    """1 April of the fiscal year that d falls in."""
    return dt.date(d.year if d.month >= 4 else d.year - 1, 4, 1)


def fy_label(d: dt.date) -> str:
    s = fy_start(d).year
    return f"FY {s}-{str(s + 1)[2:]}"


def history_start(today: dt.date | None = None) -> dt.date:
    """Two full fiscal years before the current one."""
    return add_months(fy_start(today or today_ist()), -24)


def market(today: dt.date | None = None) -> dict[str, dict[str, float]]:
    """Monthly return per asset class for each of the last MARKET_MONTHS months (keyed 'YYYY-MM')."""
    now = (today or today_ist()).replace(day=1)
    rng = random.Random("kova-market-v1")
    out: dict[str, dict[str, float]] = {}
    for k in range(MARKET_MONTHS, 0, -1):  # oldest first, so the shape never depends on today
        m = month_key(add_months(now, -k + 1))
        shock = rng.gauss(0, 1)  # the equity market's move; gold leans slightly the other way
        z = {"Equity": shock, "Debt": rng.gauss(0, 1), "Gold": -0.2 * shock + math.sqrt(0.96) * rng.gauss(0, 1), "Cash": rng.gauss(0, 1)}
        out[m] = {ac: mu + sd * z[ac] for ac, (mu, sd) in _CLASS.items()}
    return out


def benchmark_docs(today: dt.date | None = None) -> list[dict]:
    mk = market(today)
    docs = []
    for name, spec in BENCHMARKS.items():
        v, series = 100.0, []
        for m, r in mk.items():
            ret = sum(w * r[ac] for ac, w in spec["mix"].items()) + (1 - sum(spec["mix"].values())) * r["Cash"] + spec["edge"] / 12
            v *= 1 + ret
            series.append({"month": m, "value": round(v, 2)})
        docs.append({"id": benchmark_id(name), "name": name, "asset_class": spec["class"], "series": series,
                     "note": "Illustrative index built for the demo, not real market data."})
    return docs


def benchmark_id(name: str) -> str:
    return "BM-" + "".join(ch if ch.isalnum() else "-" for ch in name.upper()).strip("-").replace("--", "-")


# ---------------------------------------------------------------- client history
def _path(since: dt.date, now: dt.date, returns: list[float], invested: float, value: float, sip: float) -> list[tuple[float, float]]:
    """(value, invested) at each month-end from `since` to now, ending exactly at today's figures.
    A SIP runs for the last months it can fund; the rest went in as a lump sum at the start."""
    n = len(returns)
    sip_months = 0 if sip <= 0 else min(n, int(invested * 0.9 // sip))
    lump = invested - sip * sip_months

    def run(a: float) -> list[tuple[float, float]]:
        v = inv = 0.0
        out = []
        for i, r in enumerate(returns):
            flow = (lump if i == 0 else 0.0) + (sip if i >= n - sip_months else 0.0)
            v = (v + flow) * (1 + r + a)
            inv += flow
            out.append((v, inv))
        return out

    lo, hi = -0.08, 0.08
    for _ in range(60):  # find the steady edge over the class path that lands on today's value
        mid = (lo + hi) / 2
        if run(mid)[-1][0] < value:
            lo = mid
        else:
            hi = mid
    path = run((lo + hi) / 2)
    if path:
        path[-1] = (value, invested)
    return path


def client_history(client: dict, products: dict[str, dict], today: dt.date | None = None) -> list[dict]:
    today = today or today_ist()
    now = today.replace(day=1)
    start = history_start(today)
    mk = market(today)
    months: dict[str, dict[str, Any]] = {}
    for h in client.get("holdings", []):
        since = dt.date.fromisoformat(h["since"][:10]).replace(day=1)
        since = max(since, add_months(now, -MARKET_MONTHS + 1))
        keys = [month_key(add_months(since, i)) for i in range(months_between(since, now) + 1)]
        rets = [mk[k][h["asset_class"]] for k in keys]
        sip = float(h.get("sip_amount") or 0) if h.get("mode") == "SIP" else 0.0
        path = _path(since, now, rets, float(h["invested"]), float(h["value"]), sip)
        rate = _TRAIL.get(products.get(h["product_id"], {}).get("product_type") or "", 0.006)
        for k, (v, inv) in zip(keys, path):
            if k < month_key(start):
                continue
            e = months.setdefault(k, {"month": k, "value": 0.0, "invested": 0.0, "revenue": 0.0, "by_class": {}})
            e["value"] += v
            e["invested"] += inv
            e["revenue"] += v * rate / 12
            e["by_class"][h["asset_class"]] = e["by_class"].get(h["asset_class"], 0.0) + v
    rows = [months[k] for k in sorted(months)]
    # scale revenue so this fiscal year adds up to the client's revenue so far
    fy = month_key(fy_start(today))
    raw = sum(r["revenue"] for r in rows if r["month"] >= fy)
    scale = (client.get("revenue_ytd") or 0) / raw if raw else 0.0
    for r in rows:
        r["value"] = round(r["value"])
        r["invested"] = round(r["invested"])
        r["revenue"] = round(r["revenue"] * scale)
        r["by_class"] = {k: round(v) for k, v in r["by_class"].items()}
    if rows and rows[-1]["month"] == month_key(now):
        cur = [r for r in rows if r["month"] >= fy]
        drift = round(client.get("revenue_ytd") or 0) - sum(r["revenue"] for r in cur)
        rows[-1]["revenue"] += drift  # rounding lands on the exact figure
        rows[-1]["value"] = round(client.get("aum") or rows[-1]["value"])
        rows[-1]["invested"] = round(client.get("invested") or rows[-1]["invested"])
    return rows


def book(clients: list[dict]) -> list[dict]:
    """The RM's whole book by month: the sum of every client's history."""
    out: dict[str, dict[str, Any]] = {}
    for c in clients:
        for r in c.get("history", []):
            e = out.setdefault(r["month"], {"month": r["month"], "value": 0, "invested": 0, "revenue": 0, "clients": 0, "by_class": {}})
            e["value"] += r["value"]
            e["invested"] += r["invested"]
            e["revenue"] += r["revenue"]
            e["clients"] += 1
            for k, v in r["by_class"].items():
                e["by_class"][k] = e["by_class"].get(k, 0) + v
    return [out[k] for k in sorted(out)]
