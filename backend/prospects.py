"""Prospect stages and becoming a client.

Stages follow Krishna's model. Moving forward needs the readiness steps behind that stage; moving back is
always allowed. A prospect becomes a client only through `convert()`, which the RM confirms (a manual form
or an approved agent card), with the consent the client gave recorded on the new client.
"""
from __future__ import annotations

import datetime as dt

from .store import new_id, now_ist, store

STAGES = ["Lead", "Prospect", "Registered", "KYC in progress", "Investing client", "Investing and trading client"]
RISK_ORDER = ["Conservative", "Moderately conservative", "Moderate", "Moderately aggressive", "Aggressive"]

STEPS = ["Mobile and email verified", "PAN and KYC (KRA)", "Bank account", "FATCA declaration", "Nominee", "Risk profile",
         "Demat and trading account", "Exchange registration (UCC)", "DDPI"]
INVESTING = STEPS[:6]
NEEDS = {
    "Lead": [],
    "Prospect": [],  # qualification, checked separately below
    "Registered": STEPS[:1],
    "KYC in progress": STEPS[:1],
    "Investing client": INVESTING,
    "Investing and trading client": STEPS,
}
CONSENT_KEYS = ["whatsapp", "email", "profile_enrichment", "marketing", "data_sharing_with_partners"]


def _done(p: dict) -> set[str]:
    return {s["step"] for s in p.get("kyc_steps", []) if s.get("done")}


def missing_for(p: dict, stage: str) -> list[str]:
    out: list[str] = []
    if STAGES.index(stage) >= STAGES.index("Prospect"):
        if not str(p.get("need") or "").strip():
            out.append("What they need")
        if not p.get("estimated_investable"):
            out.append("Investable amount")
        if not (p.get("phone") or p.get("email")):
            out.append("Phone or email")
    done = _done(p)
    out += [s for s in NEEDS[stage] if s not in done]
    return out


def gates(p: dict) -> list[dict]:
    return [{"stage": s, "ok": not missing_for(p, s), "missing": missing_for(p, s)} for s in STAGES]


def check_move(p: dict, stage: str) -> str | None:
    """None if the move is allowed, otherwise what's wrong in words."""
    if p.get("converted"):
        return f"{p['name']} is already a client ({p['converted']['client_id']}); the prospect record is kept as history."
    if stage not in STAGES:
        return f"Unknown stage {stage}"
    cur = p.get("stage")
    if cur in STAGES and STAGES.index(stage) <= STAGES.index(cur):
        return None  # back or same: always allowed
    miss = missing_for(p, stage)
    return f"Can't move {p['name']} to {stage} yet. Still needed: {', '.join(miss)}." if miss else None


def _log(p: dict, title: str, body: str, kind: str = "system") -> None:
    tl = p.setdefault("timeline", [])
    tl.insert(0, {"id": f"e{len(tl) + 1}-{now_ist()}", "kind": kind, "at": now_ist(), "title": title, "body": body})


def move(p: dict, stage: str, by_agent: bool = False) -> dict:
    err = check_move(p, stage)
    if err:
        raise ValueError(err)
    prev = p["stage"]
    if prev != stage:
        p["stage"] = stage
        _log(p, "Stage changed", f"{prev} → {stage}", "agent" if by_agent else "system")
    return p


def mark_step(p: dict, step: str, done: bool, risk_profile: str | None = None) -> dict:
    """Demo control: in the real product Operations confirms these; here the RM plays that part."""
    if p.get("converted"):
        raise ValueError("This prospect is already a client.")
    if step not in STEPS:
        raise ValueError(f"Unknown readiness step {step}")
    if step == "Risk profile" and done:
        if risk_profile not in RISK_ORDER:
            raise ValueError("Record the risk profile result: " + ", ".join(RISK_ORDER))
        p["risk_profile"] = risk_profile
        p["risk_indication"] = risk_profile
    for s in p["kyc_steps"]:
        if s["step"] == step:
            s["done"] = done
            s["at"] = now_ist() if done else None
    _log(p, "Readiness updated", f"{step}: {'done' if done else 'not done'}" + (f" ({risk_profile})" if step == "Risk profile" and done else "")
         + ". Confirmed for Operations in this demo.")
    return p


def convert(args: dict, source: dict | None = None) -> dict:
    """RM-confirmed: create the client and a family, carry the history, place a welcome email in the outbox."""
    from . import actions
    st = store()
    p = st.get("prospects", args.get("prospect_id") or "")
    if not p:
        raise ValueError("Prospect not found")
    if p.get("converted"):
        raise ValueError(f"{p['name']} is already a client ({p['converted']['client_id']}).")
    if p.get("closed") or p.get("stage") not in ("Investing client", "Investing and trading client"):
        raise ValueError(f"{p['name']} needs to reach Investing client first (now {p.get('stage')}).")
    consent_in = args.get("consent")
    if not isinstance(consent_in, dict):
        raise ValueError("Record what the client consented to before converting.")
    profile = p.get("risk_profile") or p.get("risk_indication")
    if profile not in RISK_ORDER:
        raise ValueError("Record the risk profile result first.")

    today = now_ist()[:10]
    done = _done(p)
    cid = new_id("CL-", "seq_client", 1100)
    fid = new_id("FM-", "seq_family", 100)
    first = p["name"].replace("Dr. ", "").replace("Mrs. ", "").replace("Mr. ", "").split(" ")[0]
    surname = p["name"].split(" ")[-1]
    carried = [dict(e, title=f"As a prospect: {e.get('title', '')}") for e in p.get("timeline", [])]
    client = {
        "id": cid, "name": p["name"], "first_name": first, "gender": p.get("gender"), "age": p.get("age"), "dob": None,
        "family_id": fid, "family_role": "Head", "city": p.get("city") or "Mumbai", "locality": p.get("city") or "Mumbai",
        "occupation": p.get("occupation") or "", "segment": "engaged", "risk_profile": profile, "risk_profile_date": today,
        "client_since": today, "phone": p.get("phone"), "email": p.get("email"), "pan_masked": "On file",
        "kyc": {"status": "Verified", "validated_on": today, "registration_agency": "KRA (simulated)"},
        "accounts": {"investing": True, "demat": "Demat and trading account" in done, "trading": "Demat and trading account" in done,
                     "ddpi": "DDPI" in done},
        "nominee": "Registered" if "Nominee" in done else "Not registered",
        "consent": {**{k: bool(consent_in.get(k)) for k in CONSENT_KEYS}, "captured_on": today, "version": "DPDP consent v1.2"},
        "aum": 0, "invested": 0, "xirr": 0, "allocation": {}, "holdings": [], "last_contact": p.get("last_contact") or today,
        "last_transaction": None, "photo": None, "tags": ["New client"], "goals": [], "interests": [],
        "product_interests": p.get("interests", []), "estimated_investable": p.get("estimated_investable"),
        "notes_summary": p.get("need") or "", "revenue_ytd": 0.0, "cash_flows": [], "red_flags": [],
        "converted_from": p["id"], "tier": "rise", "history": [],
        "holding_accounts": [{"id": f"AC-{cid}-K", "provider": "Kova", "held_at": "Kova", "kind": "kova", "label": "Kova account", "opened": today}],
        "timeline": [{"id": f"c1-{now_ist()}", "kind": "agent" if source and source.get("card_id") else "system", "at": now_ist(),
                      "title": "Became a client", "body": f"Converted from prospect {p['id']} at {p['stage']}. Consent recorded on {dt.date.fromisoformat(today).strftime('%d %b %Y').lstrip('0')}."}] + carried,
    }
    st.put("clients", cid, client)
    st.put("families", fid, {"id": fid, "name": f"{surname} family", "locality": client["locality"], "head": cid, "members": [cid],
                             "aum": 0, "business": client["occupation"], "tier": "rise"})
    p["converted"] = {"client_id": cid, "date": today}
    _log(p, "Became a client", f"Now client {cid}. This prospect record is kept as history.")
    st.put("prospects", p["id"], p)
    actions.add_update("client", f"{p['name']} is now a client", "Set up their first portfolio from a CIO model in Studio.",
                       {"kind": "client", "id": cid}, 2, None, "Prospects")
    out: dict = {"client": client}
    if client["consent"]["email"] and client.get("email"):
        body = (f"Dear {first},\n\nWelcome to Kova. Your account is ready, and I'll be your relationship manager.\n\n"
                "Next, we'll put together your first portfolio around what you told me you need. I'll share it for your approval before anything is invested.\n\n"
                f"Regards,\n{actions.RM_NAME}")
        out["outbox"] = actions.add_outbox("welcome", "Email", {"name": client["name"], "address": client["email"]}, "Welcome to Kova", body,
                                           {**(source or {}), "kind": "client", "id": cid}, {"client_id": cid, "from_prospect": p["id"]})
    return out
