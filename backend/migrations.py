"""Versioned, additive data migrations.

Rules:
- A migration only adds or fills fields; it never deletes user-created documents.
- Each migration is idempotent: running it twice gives the same result.
- Before any pending migration runs on a database, the whole store is snapshotted
  (`<table>_snap_before_<id>`), so data can be put back with scripts/restore_snapshot.py.
- After a reseed every migration runs again on the fresh sample data.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

Migration = tuple[str, str, Callable[[Any], None]]


# ---------------------------------------------------------------- 2026-10-28: ₹ instead of "Rs", Indian digit grouping
_RS = re.compile(r"(?<![A-Za-z])Rs\.?\s?(\d[\d,]*(?:\.\d+)?)(\s?(?:Cr|L|lakh|crore)\b)?")
# what was said and sent stays exactly as it was (audit trail)
_KEEP_AS_IS = {"agent_sessions", "outbox"}


def rupee_text(s: str) -> str:
    from .expenses import rupees

    def sub(m: re.Match) -> str:
        num, unit = m.group(1), m.group(2)
        if unit:
            return f"₹{num}{unit}"
        try:
            return rupees(float(num.replace(",", "")))
        except ValueError:
            return m.group(0)
    return _RS.sub(sub, s)


def _walk(x: Any) -> Any:
    if isinstance(x, str):
        return rupee_text(x)
    if isinstance(x, list):
        return [_walk(v) for v in x]
    if isinstance(x, dict):
        return {k: _walk(v) for k, v in x.items()}
    return x


def rupee_sign(store: Any) -> None:
    for coll, id_, doc in store.all_docs():
        if coll in _KEEP_AS_IS:
            continue
        new = _walk(doc)
        if new != doc:
            store.put(coll, id_, new)


# ---------------------------------------------------------------- 2026-10-30: Sprint 1 foundations
def product_taxonomy(store: Any) -> None:
    """Products get asset class → product type → subcategory and a benchmark id; every holding says
    which account it sits in, where that account is held and whether it's on Kova's shelf."""
    from .history import benchmark_id
    from .taxonomy import classify
    for p in store.list("products"):
        new = {**p, **classify(p)}
        if p.get("benchmark"):
            new["benchmark_id"] = benchmark_id(p["benchmark"])
        if new != p:
            store.put("products", p["id"], new)
    for c in store.list("clients"):
        acc_id = f"AC-{c['id']}-K"
        accounts = c.get("holding_accounts") or [{"id": acc_id, "provider": "Kova", "held_at": "Kova", "kind": "kova",
                                                   "label": "Kova account", "opened": c.get("client_since")}]
        holdings = [{**h, "account_id": h.get("account_id") or acc_id, "held_at": h.get("held_at") or "Kova",
                     "on_shelf": h.get("on_shelf", True)} for h in c.get("holdings", [])]
        new = {**c, "holding_accounts": accounts, "holdings": holdings}
        if new != c:
            store.put("clients", c["id"], new)


def client_tiers(store: Any) -> None:
    from .tiers import refresh
    refresh(store)


def history_and_benchmarks(store: Any) -> None:
    """Month-end values for each client since two fiscal years ago, and the benchmark indices."""
    from .history import benchmark_docs, client_history
    for b in benchmark_docs():
        store.put("benchmarks", b["id"], b)
    products = {p["id"]: p for p in store.list("products")}
    for c in store.list("clients"):
        hist = client_history(c, products)
        if c.get("history") != hist:
            store.put("clients", c["id"], {**c, "history": hist})


def client_profiles(store: Any) -> None:
    """Profile sections built from the sample data; red flags recomputed with why and a next step."""
    from .insights import flags
    from .profile import seed_profile
    from .store import today_ist
    prods = {p["id"]: p for p in store.list("products")}
    meetings = store.list("meetings")
    for c in store.list("clients"):
        new = {**c, "profile": seed_profile(dict(c)), "custom_fields": c.get("custom_fields", []), "profile_changes": c.get("profile_changes", [])}
        new["red_flags"] = [{"id": f["id"], "severity": f["severity"], "text": f["text"], "why": f["why"], "cta": f["cta"]}
                            for f in flags(new, prods, meetings, today_ist())]
        if new != c:
            store.put("clients", c["id"], new)


# what each sample prospect told the RM, as structured needs (goal, horizon, asset classes)
_PROSPECT_NEEDS = {
    "PR-2001": ("Invest a windfall", "5+ years", ["Equity", "Debt"]), "PR-2002": ("Regular income", "3–5 years", ["Debt"]),
    "PR-2003": ("Grow wealth", "5+ years", ["Equity", "Debt"]), "PR-2004": ("Grow wealth", "5+ years", ["Equity"]),
    "PR-2005": ("Grow wealth", "3–5 years", ["Equity"]), "PR-2006": ("Regular income", "3–5 years", ["Debt"]),
    "PR-2007": ("Grow wealth", "5+ years", ["Equity"]), "PR-2008": ("Preserve capital", "5+ years", ["Equity", "Debt"]),
    "PR-2009": ("Preserve capital", "1–3 years", ["Debt", "Cash"]), "PR-2010": ("Invest a windfall", "1–3 years", ["Cash", "Equity"]),
    "PR-2011": ("Grow wealth", "5+ years", ["Equity"]), "PR-2012": ("Retirement", "3–5 years", ["Debt", "Equity"]),
    "PR-2013": ("Save tax", "3–5 years", ["Equity"]), "PR-2014": ("Grow wealth", "5+ years", ["Equity"]),
    "PR-2015": ("Preserve capital", "3–5 years", ["Debt"]), "PR-2016": ("Preserve capital", "5+ years", ["Equity", "Debt", "Gold"]),
}
_NO_WHATSAPP = {"PR-2004", "PR-2010", "PR-2016"}  # asked for email only


def prospect_capture(store: Any) -> None:
    """Prospects get structured needs, consent recorded at capture, and whether their contact details are verified."""
    for p in store.list("prospects"):
        g, h, a = _PROSPECT_NEEDS.get(p["id"], ("Not sure yet", None, []))
        verified = next((s["done"] for s in p.get("kyc_steps", []) if s["step"] == "Mobile and email verified"), False)
        new = {**p, "needs": p.get("needs") or {"goal": g, "horizon": h, "asset_classes": a},
               "consent": p.get("consent") or {"whatsapp": p["id"] not in _NO_WHATSAPP, "email": bool(p.get("email")),
                                                "marketing": p["source"] in ("Inbound", "Event"), "captured_on": p.get("created"),
                                                "version": "Prospect consent v1.0"},
               "contact_verified": p.get("contact_verified") or {"mobile": verified, "email": verified}}
        if new != p:
            store.put("prospects", p["id"], new)


def meeting_plans(store: Any) -> None:
    """Sample meetings get a plan (products, portfolio intent, service items) read from their title and agenda."""
    from .meetings import infer_plan
    prods = {p["id"]: p for p in store.list("products")}
    for m in store.list("meetings"):
        if m.get("plan"):
            continue
        who = store.get("clients" if m["with"]["kind"] == "client" else "prospects", m["with"]["id"])
        store.put("meetings", m["id"], {**m, "plan": infer_plan(m, prods, who)})


# (id, description, function(store)). Append only; never edit or reorder applied ones.
MIGRATIONS: list[Migration] = [
    ("2026-10-28-rupee-sign", "Amounts in text use ₹ and Indian digit grouping (not 'Rs' or 10,000,000)", rupee_sign),
    ("2026-10-30-product-taxonomy", "Products classified asset class → type → subcategory; holdings say which account and where it's held", product_taxonomy),
    ("2026-10-30-client-tiers", "Households tiered Rise / Ascent / Summit / Zenith by assets with Kova", client_tiers),
    ("2026-10-30-history", "Monthly client history since two fiscal years ago, and benchmark indices", history_and_benchmarks),
    ("2026-10-30-history-by-product", "Monthly client history also split by product, for drill-down comparisons", history_and_benchmarks),
    ("2026-10-31-client-profiles", "Client profile sections from sample data; red flags recomputed with why and a next step", client_profiles),
    ("2026-10-31-prospect-capture", "Prospects get structured needs, consent and contact verification", prospect_capture),
    ("2026-10-31-meeting-plans", "Meetings get a plan (products, portfolio intent, service items) from their title and agenda", meeting_plans),
]


def applied(store: Any) -> list[str]:
    return list(store.get_meta("migrations") or [])


def pending(store: Any) -> list[Migration]:
    done = set(applied(store))
    return [m for m in MIGRATIONS if m[0] not in done]


def apply_pending(store: Any) -> list[str]:
    todo = pending(store)
    if not todo:
        return []
    store.snapshot(f"before_{todo[0][0]}")
    done = applied(store)
    for mid, _desc, fn in todo:
        fn(store)
        done.append(mid)
        store.set_meta("migrations", done)
    return [m[0] for m in todo]
