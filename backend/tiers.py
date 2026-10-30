"""Client tiers by value: what the whole household holds with Kova.

Tiers sit beside the activity segments (active / engaged / dormant / lost): a tier says how big the
relationship is, a segment says how alive it is. Every member of a family carries the family's tier.
"""
from __future__ import annotations

from typing import Any

CR = 1_00_00_000
# lowest first; `min` is the household value (₹) at which the tier starts
TIERS: list[dict[str, Any]] = [
    {"key": "rise", "label": "Rise", "min": 0, "rule": "Household assets with Kova below ₹5 Cr"},
    {"key": "ascent", "label": "Ascent", "min": 5 * CR, "rule": "Household assets with Kova of ₹5 Cr to ₹10 Cr"},
    {"key": "summit", "label": "Summit", "min": 10 * CR, "rule": "Household assets with Kova of ₹10 Cr to ₹20 Cr"},
    {"key": "zenith", "label": "Zenith", "min": 20 * CR, "rule": "Household assets with Kova of ₹20 Cr and above"},
]


def tier_for(value: float) -> str:
    key = TIERS[0]["key"]
    for t in TIERS:
        if (value or 0) >= t["min"]:
            key = t["key"]
    return key


def refresh(store: Any, family_ids: list[str] | None = None) -> None:
    """Recompute family values from their members and stamp the tier on the family and each member."""
    clients = {c["id"]: c for c in store.list("clients")}
    for fam in store.list("families"):
        if family_ids is not None and fam["id"] not in family_ids:
            continue
        members = [clients[m] for m in fam.get("members", []) if m in clients]
        value = round(sum(m.get("aum") or 0 for m in members), 2)
        tier = tier_for(value)
        if fam.get("aum") != value or fam.get("tier") != tier:
            store.put("families", fam["id"], {**fam, "aum": value, "tier": tier})
        for m in members:
            if m.get("tier") != tier:
                store.put("clients", m["id"], {**m, "tier": tier})
