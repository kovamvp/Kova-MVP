"""What the client page needs to tell the RM: red flags (with why and a next step), key actionables,
and comparisons (return vs benchmark, revenue vs last year, how often you've met). All rules, no AI."""
from __future__ import annotations

import datetime as dt
from typing import Any

from .expenses import rupees
from .history import add_months, fy_start, month_key

RISK_BANDS = {"Conservative": (0, 25), "Moderately conservative": (15, 40), "Moderate": (35, 60),
              "Moderately aggressive": (50, 75), "Aggressive": (65, 95)}  # same as EQUITY_BAND in web/src/lib/data.ts
CLASS_BENCHMARK = {"Equity": "Nifty 500 TRI", "Debt": "CRISIL Corporate Bond A-II", "Gold": "Domestic gold price", "Cash": "CRISIL Liquid Debt A-I"}
SEVERITY = {"high": 0, "medium": 1, "low": 2}


def _d(s: str | None) -> dt.date | None:
    return dt.date.fromisoformat(s[:10]) if s else None


def _cr(x: float) -> str:
    x = abs(x)
    return f"₹{x / 1e7:.2f} Cr" if x >= 1e7 else f"₹{x / 1e5:.1f} L" if x >= 1e5 else rupees(x)


def flags(c: dict, products: dict[str, dict], meetings: list[dict], today: dt.date) -> list[dict]:
    out: list[dict] = []
    first = c.get("first_name") or c["name"].split(" ")[0]
    if c.get("nominee") == "Missing" and c.get("aum"):
        out.append({"id": "nominee", "severity": "high", "text": "No nominee registered on the folios",
                    "why": f"If something happens to {first}, the family faces a long legal process to claim {_cr(c['aum'])}.",
                    "cta": {"label": "Raise a nominee update", "do": "service", "category": "Nominee update"}})
    band = RISK_BANDS.get(c.get("risk_profile", ""))
    eq = (c.get("allocation") or {}).get("Equity", 0)
    if band and c.get("holdings") and eq > band[1]:
        out.append({"id": "equity_band", "severity": "high", "text": "Equity above the risk-profile band",
                    "why": f"Equity is {eq:g}% against a {band[0]}–{band[1]}% band for a {c['risk_profile'].lower()} profile. A fall would hurt more than {first} signed up for.",
                    "cta": {"label": "Rebalance in Studio", "href": f"/studio?new=1&tag=client:{c['id']}"}})
    rp = _d(c.get("risk_profile_date"))
    if rp and (today - rp).days > 548:
        out.append({"id": "risk_profile", "severity": "medium", "text": "Risk profile older than 18 months",
                    "why": f"Profiled on {rp.strftime('%d %b %Y').lstrip('0')}. Advice must rest on a current profile; an old one is a suitability risk.",
                    "cta": {"label": "Book a profile review", "do": "schedule", "title": "Risk profile review"}})
    lc = _d(c.get("last_contact"))
    if lc and (today - lc).days > 180 and c.get("segment") != "lost":
        out.append({"id": "no_contact", "severity": "medium", "text": "No contact in over 6 months",
                    "why": f"Last spoke {(today - lc).days // 30} months ago. Quiet clients are the ones who move money out without telling you.",
                    "cta": {"label": "Schedule a check-in", "do": "schedule", "title": "Check-in"}})
    for h in c.get("holdings", []):
        p = products.get(h["product_id"]) or {}
        if (p.get("cio_view") or {}).get("stance") == "Under review":
            out.append({"id": f"cio_review:{p['id']}", "severity": "low", "text": f"Holds a fund under CIO review ({p['name']})",
                        "why": f"{_cr(h['value'])} is in {p['name']}, which the CIO has under review: {(p['cio_view'].get('comment') or '').split('.')[0]}.",
                        "cta": {"label": "Read the CIO note", "href": f"/products/{p['id']}"}})
    soon = [f for f in c.get("cash_flows", []) if f["kind"] == "Maturity" and 0 <= ((_d(f["date"]) or today) - today).days <= 30]
    booked = any(m["with"]["id"] == c["id"] and m["status"] == "scheduled" for m in meetings)
    for f in soon:
        if not booked:
            p = products.get(f["product_id"]) or {}
            out.append({"id": f"maturity:{f['product_id']}", "severity": "medium", "text": f"{_cr(f['amount'])} matures with no meeting booked",
                        "why": f"{p.get('name', 'A holding')} matures on {_d(f['date']).strftime('%d %b')}. Without a plan the money sits idle or leaves.",
                        "cta": {"label": "Plan the reinvestment", "do": "schedule", "title": "Reinvestment plan"}})
    return sorted(out, key=lambda f: SEVERITY[f["severity"]])


def actionables(c: dict, products: dict[str, dict], meetings: list[dict], now: dt.datetime) -> list[dict]:
    today = now.date()
    out: list[dict] = []
    for m in sorted((m for m in meetings if m["with"]["id"] == c["id"] and m["status"] == "scheduled"), key=lambda m: m["start"]):
        start = dt.datetime.fromisoformat(m["start"])
        if now <= start <= now + dt.timedelta(hours=24):
            out.append({"kind": "meeting", "title": f"Meeting: {m['title']}", "date": m["start"], "detail": m.get("location"),
                        "cta": {"label": "Open the meeting", "href": f"/meetings?m={m['id']}"}})
    for f in c.get("cash_flows", []):
        d = _d(f["date"])
        if f["kind"] == "Maturity" and d and today <= d <= add_months(today, 6):
            p = products.get(f["product_id"]) or {}
            out.append({"kind": "maturity", "title": f"{p.get('name', 'Holding')} matures", "date": f["date"], "amount": f["amount"],
                        "cta": {"label": "Plan the reinvestment", "href": f"/studio?new=1&tag=client:{c['id']}"}})
    for o in c.get("owed", []):
        if o["status"] == "open":
            out.append({"kind": "owed", "title": o["text"], "owed_id": o["id"], "date": o.get("due"), "detail": "Still to get from them",
                        "from_meeting": o.get("from_meeting")})
    year = [f for f in c.get("cash_flows", []) if (d := _d(f["date"])) and today <= d <= add_months(today, 12)]
    if year:
        inflow = sum(f["amount"] for f in year if f["amount"] > 0)
        outflow = sum(f["amount"] for f in year if f["amount"] < 0)
        out.append({"kind": "cash_flows", "title": "Cash flows in the next 12 months", "inflow": inflow, "outflow": outflow,
                    "detail": f"{sum(1 for f in year if f['kind'] == 'Coupon')} coupons, {sum(1 for f in year if f['kind'] == 'Maturity')} maturities, {sum(1 for f in year if f['kind'] == 'SIP debit')} SIP debits"})
    return out


def _bench_change(benchmarks: dict[str, dict], name: str, months: int, today: dt.date) -> float | None:
    b = benchmarks.get(name)
    if not b:
        return None
    s = {x["month"]: x["value"] for x in b["series"]}
    now, then = s.get(month_key(today)), s.get(month_key(add_months(today.replace(day=1), -months)))
    return (now / then - 1) * 100 if now and then else None


def comparisons(c: dict, benchmarks: dict[str, dict], meetings: list[dict], today: dt.date) -> dict[str, Any]:
    hist = {h["month"]: h for h in c.get("history", [])}
    now_m, then_m = month_key(today), month_key(add_months(today.replace(day=1), -12))
    ret = None
    if now_m in hist and then_m in hist:
        v0, v1 = hist[then_m]["value"], hist[now_m]["value"]
        flow = hist[now_m]["invested"] - hist[then_m]["invested"]
        base = v0 + flow / 2
        ret = round((v1 - v0 - flow) / base * 100, 1) if base > 0 else None  # modified Dietz: return net of money added
    weights = {k: v for k, v in (c.get("allocation") or {}).items() if v}
    bench = None
    if weights and ret is not None:
        parts = [(w, _bench_change(benchmarks, CLASS_BENCHMARK.get(k, ""), 12, today)) for k, w in weights.items()]
        if all(x is not None for _, x in parts):
            bench = round(sum(w * x for w, x in parts) / sum(w for w, _ in parts), 1)
    fy = month_key(fy_start(today))
    fy_before_from, fy_before_to = month_key(add_months(fy_start(today), -12)), month_key(add_months(today.replace(day=1), -12))
    rows = c.get("history", [])
    mine = [m for m in meetings if m["with"]["id"] == c["id"] and m["status"] in ("completed", "needs_mom")]
    days = lambda m: (today - dt.date.fromisoformat(m["start"][:10])).days  # noqa: E731
    return {
        "return_1y": ret, "benchmark_1y": bench,
        "benchmark_name": "Blend of " + ", ".join(CLASS_BENCHMARK[k] for k in weights if k in CLASS_BENCHMARK) if weights else None,
        "revenue": {"fy": sum(r["revenue"] for r in rows if r["month"] >= fy),
                    "fy_before": sum(r["revenue"] for r in rows if fy_before_from <= r["month"] <= fy_before_to),
                    "lifetime": sum(r["revenue"] for r in rows), "since": rows[0]["month"] if rows else None},
        "interactions": {"meetings_90d": sum(1 for m in mine if 0 <= days(m) <= 90), "meetings_prev_90d": sum(1 for m in mine if 90 < days(m) <= 180),
                         "last_contact": c.get("last_contact")},
    }
