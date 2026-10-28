"""Reimbursement policy and the checks every claim goes through.

The policy is a single JSON document (`_single/expense_policy`) that the branch head can change.
Nothing is stored until someone edits it: the defaults below apply, so existing databases need
no reseed or migration.

Checks have three levels:
- block     the claim can't be submitted (no bill above the line, duplicate, future or stale date, no client)
- approval  the claim goes to the branch head before Accounts (over a category limit or the monthly cap)
- info      advice only (GSTIN missing on a large bill)
"""
from __future__ import annotations

import copy
import datetime as dt

from .store import now_ist, put_singleton, singleton, store

CATEGORIES = ["Client meeting meals", "Local travel", "Outstation travel", "Client gifts", "Events", "Phone and internet"]
CLIENT_COSTS = {"Client meeting meals", "Client gifts", "Events"}  # must name the client they were for

DEFAULT_POLICY = {
    "monthly_cap": 10000,
    "bill_required_above": 500,
    "gst_advised_above": 5000,
    "claim_within_days": 60,
    "category_limits": {  # per claim, in rupees
        "Client meeting meals": 5000,
        "Local travel": 2000,
        "Outstation travel": 15000,
        "Client gifts": 3000,
        "Events": 10000,
        "Phone and internet": 1500,
    },
    "approver": "Rohan Kapoor, Branch Head",
    "set_by": "Rohan Kapoor, Branch Head",
    "history": [],
}

NUMBER_FIELDS = ("monthly_cap", "bill_required_above", "gst_advised_above", "claim_within_days")


def rupees(x: float | int) -> str:
    """₹12,34,567 (Indian grouping), whole rupees unless there are paise."""
    neg = x < 0
    x = abs(x)
    whole = int(x)
    paise = round((x - whole) * 100)
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    return ("-" if neg else "") + "₹" + s + (f".{paise:02d}" if paise else "")


def policy() -> dict:
    stored = singleton("expense_policy") or {}
    p = copy.deepcopy(DEFAULT_POLICY)
    p.update({k: v for k, v in stored.items() if k != "category_limits"})
    p["category_limits"] = {**DEFAULT_POLICY["category_limits"], **(stored.get("category_limits") or {})}
    return p


def update_policy(patch: dict) -> dict:
    """Manager edit. Validates numbers, keeps a history line per change."""
    p = policy()
    by = str(patch.get("by") or p["set_by"])
    changes = []
    for k in NUMBER_FIELDS:
        if k in patch:
            v = patch[k]
            if not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0:
                raise ValueError(f"{k.replace('_', ' ')} must be a number of zero or more")
            if v != p[k]:
                label = k.replace("_", " ").capitalize()
                changes.append(f"{label}: {fmt(k, p[k])} → {fmt(k, v)}")
                p[k] = v
    for cat, v in (patch.get("category_limits") or {}).items():
        if cat not in CATEGORIES:
            raise ValueError(f"Unknown category {cat}")
        if not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0:
            raise ValueError(f"The limit for {cat} must be a number of zero or more")
        if v != p["category_limits"][cat]:
            changes.append(f"{cat} limit: {rupees(p['category_limits'][cat])} → {rupees(v)}")
            p["category_limits"][cat] = v
    if changes:
        p["set_by"] = by
        p["history"] = p.get("history", []) + [{"at": now_ist(), "by": by, "text": "; ".join(changes)}]
    put_singleton("expense_policy", p)
    return p


def fmt(k: str, v: float) -> str:
    return f"{int(v)} days" if k == "claim_within_days" else rupees(v)


def _claims() -> list[dict]:
    return [r for r in store().list("requests") if r.get("type") == "reimbursement"]


def month_total(exclude: str | None = None) -> float:
    month = now_ist()[:7]
    return sum(float((r.get("payload") or {}).get("amount") or 0) for r in _claims()
               if r.get("created", "")[:7] == month and r.get("status") != "rejected" and r["id"] != exclude)


def check(args: dict, has_bill: bool | None = None, bill_amount: float | None = None) -> dict:
    """Run every policy check on a claim. Returns checks plus totals; nothing is written."""
    p = policy()
    amount = float(args.get("amount") or 0)
    cat = args.get("category") or ""
    has_bill = bool(args.get("bill_image")) if has_bill is None else has_bill
    out: list[dict] = []

    def add(id_: str, ok: bool, level: str, text: str) -> None:
        out.append({"id": id_, "ok": ok, "level": level, "text": text})

    add("amount", amount > 0, "block", f"Amount {rupees(amount)}" if amount > 0 else "Add the amount")
    add("category", cat in CATEGORIES, "block", cat if cat in CATEGORIES else "Pick a category")
    if cat in CLIENT_COSTS:
        ok = bool(args.get("client_id")) and store().get("clients", args.get("client_id") or "") is not None
        add("client", ok, "block", "Linked to a client" if ok else f"{cat} must name the client they were for")

    line = p["bill_required_above"]
    need_bill = amount > line
    if has_bill:
        add("bill", True, "block", "Bill attached")
    elif need_bill:
        add("bill", False, "block", f"Attach the bill: it's required above {rupees(line)}")
    else:
        add("bill", True, "block", f"No bill needed under {rupees(line)}")

    if has_bill and bill_amount:
        same = abs(float(bill_amount) - amount) < 1
        add("bill_amount", same, "info", "Matches the bill" if same
            else f"The bill shows {rupees(float(bill_amount))}; the claim is {rupees(amount)}. Fine if you're claiming part of it")

    today = dt.date.fromisoformat(now_ist()[:10])
    try:
        d = dt.date.fromisoformat(str(args.get("bill_date") or "")[:10])
        if d > today:
            add("date", False, "block", "The bill date is in the future")
        elif (today - d).days > p["claim_within_days"]:
            add("date", False, "block", f"Bills older than {p['claim_within_days']} days can't be claimed")
        else:
            add("date", True, "block", "Within the claim window")
    except ValueError:
        add("date", False, "block", "Add the bill date")

    merchant = str(args.get("merchant") or "").strip().lower()
    dup = next((r for r in _claims() if r.get("status") != "rejected"
                and float((r.get("payload") or {}).get("amount") or 0) == amount
                and str((r.get("payload") or {}).get("bill_date") or "")[:10] == str(args.get("bill_date") or "")[:10]
                and str((r.get("payload") or {}).get("merchant") or "").strip().lower() == merchant), None)
    add("duplicate", dup is None, "block", "Not claimed before" if dup is None else f"This bill was already claimed in {dup['id']}")

    limit = p["category_limits"].get(cat)
    if limit is not None:
        ok = amount <= limit
        add("category_limit", ok, "approval",
            f"Within the {cat.lower()} limit of {rupees(limit)}" if ok else f"Above the {cat.lower()} limit of {rupees(limit)}: goes to {p['approver'].split(',')[0]} first")

    total = month_total()
    cap = p["monthly_cap"]
    left = max(cap - total, 0)
    ok = total + amount <= cap
    add("monthly_cap", ok, "approval",
        f"{rupees(left)} left of your {rupees(cap)} monthly limit" if ok
        else f"Over your {rupees(cap)} monthly limit ({rupees(left)} left this month): goes to {p['approver'].split(',')[0]} first")

    if amount > p["gst_advised_above"]:
        ok = bool(str(args.get("gst") or "").strip()) and str(args.get("gst")).upper() not in ("NA", "N/A", "NONE")
        add("gst", ok, "info", "GSTIN on the bill" if ok else f"Add the GSTIN: Accounts asks for it above {rupees(p['gst_advised_above'])}")

    blocking = any(not c["ok"] and c["level"] == "block" for c in out)
    needs_manager = any(not c["ok"] and c["level"] == "approval" for c in out)
    return {"checks": out, "blocking": blocking, "needs_manager": needs_manager, "month_total": total,
            "monthly_cap": cap, "approver": p["approver"]}


def blocking_reason(result: dict) -> str | None:
    bad = [c["text"] for c in result["checks"] if not c["ok"] and c["level"] == "block"]
    return "; ".join(bad) or None
