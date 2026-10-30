"""Meeting plans: what a meeting is for, set when it's scheduled. Products to discuss, the portfolio intent
and service items. The plan is internal (never sent to the client) and rolls up for the CIO and product teams."""
from __future__ import annotations

import datetime as dt
from typing import Any

from .store import store

PORTFOLIO_INTENTS = ["Review", "Rebalance", "New portfolio", "Maturity reinvestment"]
EMPTY = {"products": [], "portfolio": None, "service": [], "notes": ""}


def check_plan(plan: dict | None) -> dict:
    from .profile import SERVICE_CATEGORIES
    plan = plan or {}
    prods = {p["id"] for p in store().list("products")}
    products = list(dict.fromkeys(plan.get("products") or []))
    bad = [p for p in products if p not in prods]
    if bad:
        raise ValueError(f"Unknown product {bad[0]} in the meeting plan")
    if plan.get("portfolio") and plan["portfolio"] not in PORTFOLIO_INTENTS:
        raise ValueError(f"Portfolio intent must be one of: {', '.join(PORTFOLIO_INTENTS)}")
    service = list(dict.fromkeys(plan.get("service") or []))
    bad = [s for s in service if s not in SERVICE_CATEGORIES]
    if bad:
        raise ValueError(f"Unknown service item {bad[0]}; use one of: {', '.join(SERVICE_CATEGORIES)}")
    return {"products": products, "portfolio": plan.get("portfolio") or None, "service": service, "notes": str(plan.get("notes") or "")}


def summary(days: int = 30, now: str | None = None) -> dict[str, Any]:
    """What's planned across upcoming meetings: products (for product heads), portfolio intents (for the CIO), service items."""
    from .store import now_ist
    now = now or now_ist()
    until = (dt.datetime.fromisoformat(now) + dt.timedelta(days=days)).isoformat(timespec="minutes")
    st = store()
    names = {c["id"]: c["name"] for c in st.list("clients")} | {p["id"]: p["name"] for p in st.list("prospects")}
    prods = {p["id"]: p for p in st.list("products")}
    ms = [m for m in st.list("meetings") if m["status"] == "scheduled" and now <= m["start"] <= until]
    rows: dict[str, dict] = {}
    portfolio: dict[str, int] = {}
    service: dict[str, int] = {}
    for m in ms:
        plan = m.get("plan") or EMPTY
        for pid in plan["products"]:
            r = rows.setdefault(pid, {"product_id": pid, "name": prods.get(pid, {}).get("name", pid), "meetings": 0, "with": [], "next": m["start"]})
            r["meetings"] += 1
            r["next"] = min(r["next"], m["start"])
            who = names.get(m["with"]["id"], m["with"]["id"])
            if who not in r["with"]:
                r["with"].append(who)
        if plan.get("portfolio"):
            portfolio[plan["portfolio"]] = portfolio.get(plan["portfolio"], 0) + 1
        for s in plan["service"]:
            service[s] = service.get(s, 0) + 1
    return {"days": days, "meetings": len(ms), "meeting_ids": [m["id"] for m in ms],
            "products": sorted(rows.values(), key=lambda r: (-r["meetings"], r["next"])), "portfolio": portfolio, "service": service}


# words in an agenda or title → plan items (used to give the sample meetings a plan)
_SERVICE_WORDS = {"nominee": "Nominee update", "address": "Demographic update", "mobile": "Demographic update", "statement": "Statement or certificate",
                  "bank": "Bank account change", "kyc": "KYC re-verification", "sip": "SIP or STP change", "stp": "SIP or STP change",
                  "dormant": "Other", "family details": "Family details update"}
_TYPE_WORDS = {"pms": "PMS", "aif": "AIF", "private credit": "AIF", "bond": "Bond", "ncd": "Bond", "fd": "Fixed deposit", "sgb": "Bond", "gold": "Mutual fund"}


def infer_plan(m: dict, products: dict[str, dict], who: dict | None) -> dict:
    text = " ".join([m.get("title", "")] + list(m.get("agenda") or [])).lower()
    held = [h["product_id"] for h in (who or {}).get("holdings", [])]
    interests = list((who or {}).get("interests") or []) if m["with"]["kind"] == "prospect" else []
    pool = [p for p in products.values() if p.get("asset_class")]
    picked: list[str] = []
    for p in pool:  # products named outright
        if p["name"].lower().split(" fund")[0] in text or p.get("subcategory", "").lower() in text:
            picked.append(p["id"])
    for word, ptype in _TYPE_WORDS.items():  # or by type: prefer what they hold or are interested in
        if word in text:
            key, want = ("asset_class", "Gold") if word == "gold" else ("product_type", ptype)
            cands = [x for x in held + interests if products.get(x, {}).get(key) == want] or [p["id"] for p in pool if p.get(key) == want]
            if word == "sgb":
                cands = ["PD-601"]
            if cands:
                picked.append(cands[0])
    if not picked and m.get("type") == "Review":  # a review covers what the CIO has under review
        picked = [x for x in held if (products.get(x, {}).get("cio_view") or {}).get("stance") == "Under review"][:1]
    if m["with"]["kind"] == "prospect":
        picked += interests[:2]
    portfolio = ("Rebalance" if "rebalanc" in text else "Maturity reinvestment" if any(w in text for w in ("maturity", "reinvest", "parking"))
                 else "New portfolio" if m.get("type") == "Proposal" or "proposal" in text else "Review" if m.get("type") in ("Review", "Family meeting") else None)
    service = list(dict.fromkeys(v for k, v in _SERVICE_WORDS.items() if k in text))
    if m.get("type") == "Service" and not service:
        service = ["Other"]
    return {"products": list(dict.fromkeys(picked))[:3], "portfolio": portfolio, "service": service, "notes": ""}
