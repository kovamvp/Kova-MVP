"""Client profile in sections. Fields that touch identity, KYC, the account or holdings are locked:
they change only through a service request. Everything else the RM edits here, with a change log.
The RM can also add custom fields, from a shared library or new ones (optionally saved to the library)."""
from __future__ import annotations

import datetime as dt
from typing import Any

from .store import new_id, now_ist, put_singleton, singleton, store

SERVICE_CATEGORIES = ["Demographic update", "Family details update", "Nominee update", "Bank account change",
                      "KYC re-verification", "Statement or certificate", "Transaction issue", "SIP or STP change", "Other"]

# locked fields → the service request that changes them
LOCKED: dict[str, dict[str, str]] = {
    "name": {"label": "Name", "category": "KYC re-verification"},
    "dob": {"label": "Date of birth", "category": "KYC re-verification"},
    "pan_masked": {"label": "PAN", "category": "KYC re-verification"},
    "phone": {"label": "Mobile", "category": "Demographic update"},
    "email": {"label": "Email", "category": "Demographic update"},
    "kyc": {"label": "KYC", "category": "KYC re-verification"},
    "accounts": {"label": "Accounts", "category": "Other"},
    "nominee": {"label": "Nominee", "category": "Nominee update"},
    "bank": {"label": "Bank account", "category": "Bank account change"},
    "risk_profile": {"label": "Risk profile", "category": "Other"},
}

SECTIONS: list[dict[str, Any]] = [
    {"key": "identity", "label": "Identity and KYC", "locked": True, "fields": []},
    {"key": "family", "label": "Family", "fields": [
        {"key": "marital_status", "label": "Marital status", "type": "choice", "options": ["Single", "Married", "Widowed", "Divorced"]},
        {"key": "spouse", "label": "Spouse", "type": "text"},
        {"key": "children", "label": "Children", "type": "text"},
        {"key": "dependents", "label": "Other dependents", "type": "text"}]},
    {"key": "occupation", "label": "Work", "fields": [
        {"key": "occupation", "label": "Occupation", "type": "text"},
        {"key": "organisation", "label": "Organisation", "type": "text"},
        {"key": "industry", "label": "Industry", "type": "text"},
        {"key": "role", "label": "Role", "type": "text"},
        {"key": "income_band", "label": "Annual income", "type": "choice", "options": ["Below ₹50 L", "₹50 L–1 Cr", "₹1–5 Cr", "Above ₹5 Cr"]}]},
    {"key": "lifestyle", "label": "Lifestyle and interests", "consent": "profile_enrichment", "fields": [
        {"key": "interests", "label": "Interests", "type": "tags"},
        {"key": "clubs", "label": "Clubs and associations", "type": "text"},
        {"key": "travel", "label": "Travel", "type": "text"},
        {"key": "causes", "label": "Causes they support", "type": "text"}]},
    {"key": "owns", "label": "What they own outside Kova", "fields": [
        {"key": "property", "label": "Property", "type": "text"},
        {"key": "business", "label": "Business stake", "type": "text"},
        {"key": "outside_investments", "label": "Investments elsewhere", "type": "text"},
        {"key": "insurance", "label": "Insurance", "type": "text"}]},
    {"key": "preferences", "label": "Preferences", "fields": [
        {"key": "channel", "label": "Best way to reach", "type": "choice", "options": ["WhatsApp", "Call", "Email", "In person"]},
        {"key": "best_time", "label": "Best time", "type": "text"},
        {"key": "language", "label": "Language", "type": "text"},
        {"key": "meeting_place", "label": "Where they like to meet", "type": "text"},
        {"key": "review_frequency", "label": "Review frequency", "type": "choice", "options": ["Monthly", "Quarterly", "Half-yearly", "Yearly"]}]},
    {"key": "traits", "label": "How they decide", "fields": [
        {"key": "decision_style", "label": "Decision style", "type": "text"},
        {"key": "notes", "label": "What to know", "type": "text"}]},
]
SECTION = {s["key"]: s for s in SECTIONS}
# profile fields that mirror an older top-level field (the agent brief and list pages read those)
MIRROR = {("occupation", "occupation"): "occupation", ("lifestyle", "interests"): "interests", ("traits", "notes"): "notes_summary"}
TYPES = {"text", "number", "date", "choice", "yes_no", "tags"}

DEFAULT_LIBRARY = [
    {"label": "Children's schools", "type": "text", "section": "family"},
    {"label": "Anniversary", "type": "date", "section": "family"},
    {"label": "Family office", "type": "yes_no", "section": "owns"},
    {"label": "Vehicles", "type": "text", "section": "owns"},
    {"label": "Favourite cuisine", "type": "text", "section": "lifestyle"},
    {"label": "Sports", "type": "text", "section": "lifestyle"},
    {"label": "Do not call before", "type": "text", "section": "preferences"},
    {"label": "Assistant's name", "type": "text", "section": "preferences"},
    {"label": "Tax adviser", "type": "text", "section": "owns"},
    {"label": "Number of employees", "type": "number", "section": "occupation"},
]


def library() -> list[dict]:
    lib = singleton("field_library")
    return lib.get("fields") or [dict(f) for f in DEFAULT_LIBRARY]


def _client(cid: str) -> dict:
    c = store().get("clients", cid)
    if not c:
        raise ValueError("Client not found")
    return c


def _log(c: dict, section: str, field: str, old: Any, new: Any) -> None:
    from .actions import RM_NAME
    c.setdefault("profile_changes", []).append({"at": now_ist(), "by": RM_NAME, "section": section, "field": field, "from": old, "to": new})


def _timeline(c: dict, title: str, body: str) -> None:
    c.setdefault("timeline", []).insert(0, {"id": f"pf-{now_ist()}-{len(c.get('profile_changes', []))}", "kind": "system", "at": now_ist(), "title": title, "body": body})


def _check(type_: str, value: Any, options: list | None = None) -> Any:
    if value in (None, ""):
        return None
    if type_ == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            try:
                value = float(str(value).replace(",", ""))
            except ValueError:
                raise ValueError("That field takes a number") from None
        return value
    if type_ == "date":
        try:
            dt.date.fromisoformat(str(value)[:10])
        except ValueError:
            raise ValueError("That field takes a date (YYYY-MM-DD)") from None
        return str(value)[:10]
    if type_ == "yes_no":
        return bool(value)
    if type_ == "tags":
        return [str(v).strip() for v in (value if isinstance(value, list) else str(value).split(",")) if str(v).strip()]
    if type_ == "choice" and options and value not in options:
        raise ValueError(f"Choose one of: {', '.join(options)}")
    return str(value)


def update_profile(args: dict, source: dict | None = None) -> dict:
    c = _client(args["client_id"])
    sec = SECTION.get(args.get("section", ""))
    changes = args.get("changes") or {}
    for field in changes:
        if field in LOCKED:
            lk = LOCKED[field]
            raise ValueError(f"{lk['label']} can't be edited here. Raise a service request ({lk['category']}) to change it.")
    if not sec:
        raise ValueError("Unknown profile section")
    if sec.get("locked"):
        raise ValueError("Identity and KYC details change only through a service request.")
    if sec.get("consent") and not c.get("consent", {}).get(sec["consent"]):
        raise ValueError("No profile-enrichment consent: lifestyle details can't be recorded for this client.")
    fields = {f["key"]: f for f in sec["fields"]}
    prof = c.setdefault("profile", {}).setdefault(sec["key"], {})
    done = []
    for field, value in changes.items():
        if field not in fields:
            raise ValueError(f"Unknown field '{field}' in {sec['label']}")
        new = _check(fields[field]["type"], value, fields[field].get("options"))
        old = prof.get(field)
        if new == old:
            continue
        prof[field] = new
        if (sec["key"], field) in MIRROR:
            c[MIRROR[(sec["key"], field)]] = new if new is not None else ([] if field == "interests" else "")
        _log(c, sec["key"], field, old, new)
        done.append(fields[field]["label"].lower())
    if done:
        _timeline(c, f"Profile updated: {sec['label']}", f"Changed {', '.join(done)}.")
    store().put("clients", c["id"], c)
    return {"client": c["id"], "changed": done}


def add_custom_field(args: dict, source: dict | None = None) -> dict:
    from .actions import RM_NAME
    c = _client(args["client_id"])
    label = (args.get("label") or "").strip()
    type_ = args.get("type", "text")
    if not label:
        raise ValueError("Give the field a name")
    if type_ not in TYPES:
        raise ValueError(f"Field type must be one of {', '.join(sorted(TYPES))}")
    section = args.get("section") if args.get("section") in SECTION and args.get("section") != "identity" else "traits"
    value = _check(type_, args.get("value"), args.get("options"))
    f = {"id": new_id("CF-", "seq_custom_field", 100), "label": label, "type": type_, "value": value, "section": section,
         "options": args.get("options"), "added_by": RM_NAME, "at": now_ist()}
    c.setdefault("custom_fields", []).append(f)
    _log(c, section, label, None, value)
    _timeline(c, f"Profile updated: added '{label}'", f"Custom field in {SECTION[section]['label']}.")
    store().put("clients", c["id"], c)
    if args.get("save_to_library"):
        lib = library()
        if not any(x["label"].lower() == label.lower() for x in lib):
            lib.append({"label": label, "type": type_, "section": section, "options": args.get("options")})
            put_singleton("field_library", {"fields": lib})
    return {"client": c["id"], "field": f}


def _field(c: dict, fid: str) -> dict:
    f = next((x for x in c.get("custom_fields", []) if x["id"] == fid), None)
    if not f:
        raise ValueError("Custom field not found")
    return f


def update_custom_field(args: dict, source: dict | None = None) -> dict:
    c = _client(args["client_id"])
    f = _field(c, args["field_id"])
    new = _check(f["type"], args.get("value"), f.get("options"))
    _log(c, f["section"], f["label"], f["value"], new)
    f["value"] = new
    store().put("clients", c["id"], c)
    return {"client": c["id"], "field": f}


def remove_custom_field(args: dict, source: dict | None = None) -> dict:
    c = _client(args["client_id"])
    f = _field(c, args["field_id"])
    c["custom_fields"] = [x for x in c["custom_fields"] if x["id"] != f["id"]]
    _log(c, f["section"], f["label"], f["value"], None)  # kept in the change log
    _timeline(c, f"Profile updated: removed '{f['label']}'", "Custom field removed; the old value stays in the change log.")
    store().put("clients", c["id"], c)
    return {"client": c["id"], "removed": f["id"]}


def seed_profile(c: dict) -> dict:
    """Build the sectioned profile from what the sample data already says (used by the migration)."""
    p = c.get("profile") or {}
    p.setdefault("occupation", {}).setdefault("occupation", c.get("occupation") or None)
    p.setdefault("lifestyle", {}).setdefault("interests", list(c.get("interests") or []))
    p.setdefault("traits", {}).setdefault("notes", c.get("notes_summary") or None)
    p.setdefault("family", {}).setdefault("marital_status", "Married" if c.get("family_role") in ("Head", "Spouse") else None)
    p.setdefault("preferences", {})
    p.setdefault("owns", {})
    notes = (c.get("notes_summary") or "").lower()
    if "whatsapp" in notes:
        p["preferences"].setdefault("channel", "WhatsApp")
    if "quarterly" in notes:
        p["preferences"].setdefault("review_frequency", "Quarterly")
    return p
