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


# (id, description, function(store)). Append only; never edit or reorder applied ones.
MIGRATIONS: list[Migration] = [
    ("2026-10-28-rupee-sign", "Amounts in text use ₹ and Indian digit grouping (not 'Rs' or 10,000,000)", rupee_sign),
    ("2026-10-30-product-taxonomy", "Products classified asset class → type → subcategory; holdings say which account and where it's held", product_taxonomy),
    ("2026-10-30-client-tiers", "Households tiered Rise / Ascent / Summit / Zenith by assets with Kova", client_tiers),
    ("2026-10-30-history", "Monthly client history since two fiscal years ago, and benchmark indices", history_and_benchmarks),
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
