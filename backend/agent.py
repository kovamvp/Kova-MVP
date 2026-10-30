"""Page-specific agents (client, prospect, product).

The agent reads through read-tools immediately, but every action it wants to
take becomes an approval card. Nothing leaves until the RM approves the card;
approval runs the same code as the manual Actions panel and lands in the outbox.
"""
from __future__ import annotations

import base64
import datetime as dt
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Body, File, HTTPException, UploadFile

from . import actions, expenses, llm
from .store import new_id, now_ist, singleton, store

router = APIRouter(prefix="/api/agent")
log = logging.getLogger("kova.agent")

RISK_ORDER = ["Conservative", "Moderately conservative", "Moderate", "Moderately aggressive", "Aggressive"]
PRODUCT_RISK = {"Low": 0, "Low to moderate": 1, "Moderate": 2, "Moderately high": 3, "High": 3, "Very high": 4, "—": 2}


def inr(x: float | int | None) -> str:
    if x is None:
        return "-"
    x = float(x)
    if abs(x) >= 1e7:
        return f"₹{x / 1e7:.2f} Cr"
    if abs(x) >= 1e5:
        return f"₹{x / 1e5:.1f} L"
    return expenses.rupees(round(x))


# ------------------------------------------------------------------ compact context builders
def client_brief(c: dict, full: bool = False) -> dict:
    out = {
        "id": c["id"], "name": c["name"], "age": c.get("age"), "family": c.get("family_id"), "role_in_family": c.get("family_role"),
        "occupation": c.get("occupation"), "segment": c["segment"], "tier": c.get("tier"), "risk_profile": c["risk_profile"], "client_since": c.get("client_since"),
        "aum": inr(c.get("aum")), "allocation_pct": c.get("allocation"), "xirr_pct": c.get("xirr"),
        "consent": {k: v for k, v in c.get("consent", {}).items() if k in ("whatsapp", "email", "profile_enrichment", "marketing")},
        "email": c.get("email"), "phone": c.get("phone"), "last_contact": c.get("last_contact"),
        "goals": c.get("goals"), "notes": c.get("notes_summary"), "red_flags": [f["text"] for f in c.get("red_flags", [])],
        "nominee": c.get("nominee"), "accounts": c.get("accounts"),
    }
    if full:
        out["interests"] = c.get("interests")
        out["upcoming_cash_flows"] = [{"date": f["date"], "kind": f["kind"], "product": f["product_id"], "amount": inr(f["amount"])} for f in c.get("cash_flows", [])][:5]
        out["recent_timeline"] = [{"at": e["at"][:10], "kind": e["kind"], "title": e["title"]} for e in c.get("timeline", [])[:5]]
    return out


def holdings_view(c: dict) -> list[dict]:
    prods = {p["id"]: p for p in store().list("products")}
    return [{"product_id": h["product_id"], "name": prods.get(h["product_id"], {}).get("name"), "class": h["asset_class"], "value": inr(h["value"]),
             "invested": inr(h["invested"]), "mode": h.get("mode"), "since": h.get("since"),
             "cio_stance": prods.get(h["product_id"], {}).get("cio_view", {}).get("stance")} for h in c.get("holdings", [])]


def prospect_brief(p: dict) -> dict:
    return {k: p.get(k) for k in ("id", "name", "age", "stage", "source", "source_detail", "estimated_investable", "need", "last_contact",
                                   "next_step", "next_step_date", "risk_indication", "email", "phone", "interests", "app_activity", "needs", "consent", "contact_verified")} | {
        "kyc_pending": [s["step"] for s in p.get("kyc_steps", []) if not s["done"]][:4],
        "closed": p.get("closed"), "recent_timeline": [{"at": e["at"][:10], "title": e["title"], "body": e.get("body", "")[:120]} for e in p.get("timeline", [])[:4]]}


def product_brief(p: dict, full: bool = False) -> dict:
    keys = ["id", "name", "manufacturer", "category", "sub_category", "risk", "returns", "min_investment", "liquidity"]
    out = {k: p.get(k) for k in keys}
    for k in ("expense_ratio", "ytm", "coupon", "rate", "rating", "target_irr", "fee", "maturity", "close_date", "is_new"):
        if p.get(k) is not None:
            out[k] = p[k]
    out["cio"] = f"{p['cio_view']['stance']}: {p['cio_view']['comment']}"
    if full:
        out["highlights"], out["risks"] = p.get("highlights"), p.get("risks")
        out["product_manager"] = p.get("product_manager")
        out["video_url"] = p.get("ld", {}).get("video_url")
    return out


def calendar_window(days: int = 10) -> list[dict]:
    now = now_ist()
    end = (dt.datetime.fromisoformat(now) + dt.timedelta(days=days)).isoformat(timespec="minutes")
    ms = [m for m in store().list("meetings") if m["status"] == "scheduled" and now[:10] <= m["start"] <= end]
    return [{"start": m["start"], "end": m["end"], "title": m["title"]} for m in sorted(ms, key=lambda m: m["start"])]


def suitable(client: dict, product: dict) -> tuple[bool, str]:
    cr = RISK_ORDER.index(client["risk_profile"]) if client["risk_profile"] in RISK_ORDER else 2
    pr = PRODUCT_RISK.get(product["risk"], 2)
    if product["category"] in ("PMS", "AIF") and cr < 3:
        return False, f"{product['category']} needs a moderately aggressive profile or higher; client is {client['risk_profile']}"
    if pr > cr + 2:
        return False, f"product risk {product['risk']} is too far above the client's {client['risk_profile']} profile"
    if product["min_investment"] > 0.25 * max(client.get("aum", 0), 1):
        return False, f"minimum {inr(product['min_investment'])} is over 25% of the client's assets with Kova"
    return True, "fits risk profile and ticket size"


# ------------------------------------------------------------------ tools
def T(name: str, desc: str, props: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {"name": name, "description": desc,
                                             "parameters": {"type": "object", "properties": props, "required": required}}}


S = {"type": "string"}
N = {"type": "number"}
ARR = {"type": "array", "items": {"type": "string"}}

READ_TOOLS = {
    "get_holdings": T("get_holdings", "Current holdings of a client (product, value, CIO stance).", {"client_id": S}, ["client_id"]),
    "get_family": T("get_family", "Members of the client's family with basic details and ids.", {"client_id": S}, ["client_id"]),
    "get_meetings": T("get_meetings", "Past and upcoming meetings with this client or prospect, including MoMs and open promises.", {"kind": S, "id": S}, ["kind", "id"]),
    "get_calendar": T("get_calendar", "The RM's scheduled meetings for the next 10 days, to avoid clashes.", {}, []),
    "find_products": T("find_products", "Search the product shelf by words, category (Mutual fund, PMS, AIF, Bond, Fixed deposit) or risk.", {"query": S, "category": S}, []),
    "get_product": T("get_product", "Full details of one product including the CIO view and the written brief.", {"product_id": S}, ["product_id"]),
    "clients_for_product": T("clients_for_product", "The RM's clients this product suits (risk profile and ticket size), excluding current holders.", {"product_id": S}, ["product_id"]),
    "get_open_requests": T("get_open_requests", "Open requests and tickets linked to this client, prospect or product.", {"kind": S, "id": S}, ["kind", "id"]),
}

PROPOSE_TOOLS = {
    "propose_schedule_meeting": T("propose_schedule_meeting", "Propose a meeting. Creates an approval card; nothing is booked until the RM approves.", {
        "with_kind": {"type": "string", "enum": ["client", "prospect"]}, "with_id": S, "title": S, "type": {"type": "string", "enum": ["Review", "Proposal", "First meeting", "Service", "Family meeting"]},
        "start": {"type": "string", "description": "Local IST datetime YYYY-MM-DDTHH:MM"}, "duration_minutes": N, "location": S,
        "agenda": ARR, "attendees": {"type": "array", "items": {"type": "object", "properties": {"name": S, "title": S}}}}, ["with_kind", "with_id", "title", "start"]),
    "propose_send_message": T("propose_send_message", "Propose a WhatsApp or email message to the client or prospect. Creates an approval card.", {
        "to_kind": {"type": "string", "enum": ["client", "prospect"]}, "to_id": S, "channel": {"type": "string", "enum": ["WhatsApp", "Email"]},
        "subject": S, "body": S, "purpose": S}, ["to_kind", "to_id", "channel", "body"]),
    "propose_log_mom": T("propose_log_mom", "Propose minutes of a meeting from the RM's account, and optionally send them to the client. Creates an approval card.", {
        "with_kind": {"type": "string", "enum": ["client", "prospect"]}, "with_id": S, "meeting_id": S, "title": S, "summary": S,
        "feedback": S, "portfolio_reaction": S, "changes_asked": ARR, "personal": S, "promises": ARR, "promise_due": S,
        "send_to_client": {"type": "boolean"}, "channel": {"type": "string", "enum": ["Email", "WhatsApp"]}}, ["with_kind", "with_id", "summary"]),
    "propose_product_feedback": T("propose_product_feedback", "Propose feedback or a question to the product manager of a product. Creates an approval card.", {
        "product_id": S, "feedback": S, "client_id": S, "priority": {"type": "string", "enum": ["normal", "high"]}}, ["feedback"]),
    "propose_reimbursement": T("propose_reimbursement", "Propose a reimbursement claim for a client-related expense. Creates an approval card for Accounts.", {
        "client_id": S, "category": {"type": "string", "enum": ["Client meeting meals", "Local travel", "Outstation travel", "Client gifts", "Events", "Phone and internet"]},
        "amount": N, "merchant": S, "bill_date": S, "gst": S, "purpose": S}, ["client_id", "category", "amount", "merchant", "bill_date"]),
    "propose_service_request": T("propose_service_request", "Propose a service request to Client Experience (address change, nominee update, statement, SIP change...). Creates an approval card.", {
        "client_id": S, "category": {"type": "string", "enum": ["Demographic update", "Family details update", "Nominee update", "Bank account change", "KYC re-verification", "Statement or certificate", "Transaction issue", "SIP or STP change", "Other"]},
        "title": S, "details": S, "priority": {"type": "string", "enum": ["normal", "high"]}}, ["client_id", "title", "details"]),
    "propose_add_note": T("propose_add_note", "Propose an internal note on the client's or prospect's record. Creates an approval card.", {
        "about_kind": {"type": "string", "enum": ["client", "prospect"]}, "about_id": S, "title": S, "text": S}, ["about_kind", "about_id", "text"]),
    "propose_reschedule_meeting": T("propose_reschedule_meeting", "Propose moving an existing meeting to a new time (optionally a new place, length or agenda). Find its id with get_meetings. Creates an approval card; the client gets an updated invite only after approval.", {
        "meeting_id": S, "start": {"type": "string", "description": "New local IST datetime YYYY-MM-DDTHH:MM"}, "duration_minutes": N, "location": S,
        "agenda": ARR, "reason": {"type": "string", "description": "Internal reason; never shown to the client"}, "notify_client": {"type": "boolean"}}, ["meeting_id", "start"]),
    "propose_cancel_meeting": T("propose_cancel_meeting", "Propose cancelling an existing meeting. Find its id with get_meetings. Needs a reason (kept internal). Creates an approval card.", {
        "meeting_id": S, "reason": S, "notify_client": {"type": "boolean"}}, ["meeting_id", "reason"]),
    "propose_convert_prospect": T("propose_convert_prospect", "Propose making this prospect a client (only from Investing client or later). The RM records the client's consent on the card and confirms. Creates an approval card.", {
        "prospect_id": S}, ["prospect_id"]),
    "propose_update_prospect": T("propose_update_prospect", "Propose changes to a prospect's stage, next step, value, product interest or structured needs (never consent: only the RM records that). Creates an approval card.", {
        "prospect_id": S, "stage": {"type": "string", "enum": ["Lead", "Prospect", "Registered", "KYC in progress", "Investing client", "Investing and trading client"]},
        "next_step": S, "next_step_date": S, "estimated_investable": N, "interest_product_id": S,
        "needs": {"type": "object", "description": "Structured needs", "properties": {
            "goal": {"type": "string", "enum": ["Grow wealth", "Regular income", "Preserve capital", "Plan for a goal", "Invest a windfall", "Save tax", "Retirement", "Not sure yet"]},
            "horizon": {"type": "string", "enum": ["Under 1 year", "1–3 years", "3–5 years", "5+ years"]},
            "asset_classes": {"type": "array", "items": {"type": "string", "enum": ["Equity", "Debt", "Gold", "Cash"]}}}}}, ["prospect_id"]),
}

SCOPE_TOOLS = {
    "client": ["get_holdings", "get_family", "get_meetings", "get_calendar", "find_products", "get_product", "get_open_requests",
               "propose_schedule_meeting", "propose_send_message", "propose_log_mom", "propose_product_feedback", "propose_reimbursement",
               "propose_service_request", "propose_add_note", "propose_reschedule_meeting", "propose_cancel_meeting"],
    "prospect": ["get_meetings", "get_calendar", "find_products", "get_product", "get_open_requests",
                 "propose_schedule_meeting", "propose_send_message", "propose_log_mom", "propose_product_feedback", "propose_add_note", "propose_update_prospect", "propose_convert_prospect",
                 "propose_reschedule_meeting", "propose_cancel_meeting"],
    "product": ["get_product", "clients_for_product", "get_holdings", "find_products", "get_open_requests", "get_calendar",
                "propose_product_feedback", "propose_send_message", "propose_schedule_meeting", "propose_add_note"],
}

ACTION_OF = {
    "propose_schedule_meeting": "schedule_meeting", "propose_send_message": "send_message", "propose_log_mom": "log_mom",
    "propose_product_feedback": "product_feedback", "propose_reimbursement": "reimbursement", "propose_service_request": "service_request",
    "propose_add_note": "add_note", "propose_update_prospect": "update_prospect", "propose_convert_prospect": "convert_prospect",
    "propose_reschedule_meeting": "reschedule_meeting", "propose_cancel_meeting": "cancel_meeting",
}


def run_read(name: str, a: dict, scope: dict) -> Any:
    st = store()
    if name == "get_holdings":
        c = st.get("clients", a.get("client_id", ""))
        return holdings_view(c) if c else {"error": "client not found"}
    if name == "get_family":
        c = st.get("clients", a.get("client_id", ""))
        if not c:
            return {"error": "client not found"}
        return [{"id": m["id"], "name": m["name"], "role": m["family_role"], "aum": inr(m["aum"]), "segment": m["segment"],
                 "consent_whatsapp": m["consent"]["whatsapp"]} for m in st.list("clients") if m["family_id"] == c["family_id"]]
    if name == "get_meetings":
        ms = [m for m in st.list("meetings") if m["with"] == {"kind": a.get("kind"), "id": a.get("id")}]
        return [{"id": m["id"], "title": m["title"], "start": m["start"], "status": m["status"], "location": m["location"],
                 "mom": (m.get("mom") or {}).get("summary"), "open_promises": [p["text"] for p in m.get("promises", []) if not p.get("done")]}
                for m in sorted(ms, key=lambda m: m["start"], reverse=True)[:6]]
    if name == "get_calendar":
        return calendar_window()
    if name == "find_products":
        q = (a.get("query") or "").lower()
        cat = (a.get("category") or "").lower()
        res = []
        for p in st.list("products"):
            hay = f"{p['name']} {p['sub_category']} {p['category']} {p['manufacturer']} {p['risk']}".lower()
            if (not q or any(w in hay for w in q.split())) and (not cat or cat in p["category"].lower()):
                res.append({"id": p["id"], "name": p["name"], "category": p["category"], "sub": p["sub_category"], "risk": p["risk"],
                            "cio": p["cio_view"]["stance"], "min": inr(p["min_investment"])})
        return res[:10]
    if name == "get_product":
        p = st.get("products", a.get("product_id", ""))
        if not p:
            return {"error": "product not found"}
        return product_brief(p, True) | {"brief": p.get("brief")}
    if name == "clients_for_product":
        p = st.get("products", a.get("product_id", ""))
        if not p:
            return {"error": "product not found"}
        fits = []
        for c in st.list("clients"):
            if c["segment"] == "lost" or any(h["product_id"] == p["id"] for h in c["holdings"]):
                continue
            ok, why = suitable(c, p)
            if ok:
                fits.append({"id": c["id"], "name": c["name"], "risk_profile": c["risk_profile"], "aum": inr(c["aum"]), "why": why,
                             "consent_whatsapp": c["consent"]["whatsapp"], "marketing_consent": c["consent"]["marketing"]})
        return {"product": p["name"], "clients": fits[:8], "note": "Suitability only; never rank by incentive points."}
    if name == "get_open_requests":
        link = {"kind": a.get("kind"), "id": a.get("id")}
        return [{"id": r["id"], "type": r["type"], "title": r["title"], "status": r["status"], "team": r["team"]}
                for r in st.list("requests") if r.get("link") == link and r["direction"] != "completed"]
    return {"error": "unknown tool"}


WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def validate_proposal(name: str, a: dict, scope: dict, said: str = "") -> str | None:
    st = store()
    now = now_ist()
    if name == "propose_schedule_meeting":
        days = [d for d in WEEKDAYS if re.search(rf"\b{d}\b", said.lower())]
        try:
            wd = WEEKDAYS[dt.datetime.fromisoformat(a["start"][:16]).weekday()]
        except Exception:
            wd = ""
        if len(days) == 1 and wd and wd != days[0]:
            return f"{a['start'][:10]} is a {wd.capitalize()}, but the RM said {days[0].capitalize()}. Use the dates list in your instructions."
        if not st.get("clients" if a.get("with_kind") == "client" else "prospects", a.get("with_id", "")):
            return "Unknown client/prospect id."
        try:
            s = dt.datetime.fromisoformat(a["start"][:16])
        except Exception:
            return "start must be YYYY-MM-DDTHH:MM"
        if a["start"][:16] < now:
            return "That time is in the past. Ask the RM for a future time."
        e = s + dt.timedelta(minutes=int(a.get("duration_minutes") or 45))
        for m in calendar_window(60):
            if dt.datetime.fromisoformat(m["start"]) < e and dt.datetime.fromisoformat(m["end"]) > s:
                return f"Clashes with '{m['title']}' at {m['start']}. Suggest another time to the RM."
    if name == "propose_send_message":
        e = st.get("clients" if a.get("to_kind") == "client" else "prospects", a.get("to_id", ""))
        if not e:
            return "Unknown recipient id."
        if a.get("channel") == "WhatsApp" and not e.get("consent", {}).get("whatsapp"):
            return f"{e['name']} has not consented to WhatsApp. Propose Email instead and tell the RM why."
    if name == "propose_reimbursement":
        if not st.get("clients", a.get("client_id", "")):
            return "Reimbursements must be linked to a client id."
        if float(a.get("amount") or 0) <= 0:
            return "Amount missing. Ask the RM or use the bill."
        # the bill can be added on the card, so only the other blocking checks stop the card here
        reason = expenses.blocking_reason(expenses.check(a, has_bill=True))
        if reason:
            return f"Can't propose this claim: {reason}. Tell the RM."
    if name in ("propose_reschedule_meeting", "propose_cancel_meeting"):
        m = st.get("meetings", a.get("meeting_id", ""))
        if not m:
            return "Unknown meeting id. Use get_meetings to find it."
        if m["with"] != {"kind": scope["kind"], "id": scope["id"]}:
            return "That meeting isn't with this client or prospect."
        if m["status"] not in ("scheduled", "needs_mom") or m.get("mom"):
            return f"That meeting is {m['status'].replace('_', ' ')}; it can't be changed."
        if name == "propose_cancel_meeting" and not str(a.get("reason") or "").strip():
            return "Ask the RM why it's cancelled (kept internal)."
        if name == "propose_reschedule_meeting":
            try:
                s = dt.datetime.fromisoformat(str(a.get("start", ""))[:16])
            except ValueError:
                return "start must be YYYY-MM-DDTHH:MM"
            days = [d for d in WEEKDAYS if re.search(rf"\b{d}\b", said.lower())]
            wd = WEEKDAYS[s.weekday()]
            if len(days) == 1 and wd != days[0]:
                return f"{a['start'][:10]} is a {wd.capitalize()}, but the RM said {days[0].capitalize()}. Use the dates list in your instructions."
            if a["start"][:16] < now:
                return "That time is in the past. Ask the RM for a future time."
            dur = int(a.get("duration_minutes") or (dt.datetime.fromisoformat(m["end"]) - dt.datetime.fromisoformat(m["start"])).seconds // 60 or 45)
            other = actions.clash_with(a["start"][:16], (s + dt.timedelta(minutes=dur)).isoformat(timespec="minutes"), exclude=m["id"])
            if other:
                return f"Clashes with '{other['title']}' at {other['start']}. Suggest another time to the RM."
    if name in ("propose_update_prospect", "propose_convert_prospect"):
        from . import prospects
        p = st.get("prospects", a.get("prospect_id", ""))
        if not p:
            return "Unknown prospect id."
        if name == "propose_update_prospect" and a.get("stage"):
            err = prospects.check_move(p, a["stage"])
            if err:
                return err + " Tell the RM what's still needed instead of proposing the move."
        if name == "propose_convert_prospect":
            if p.get("converted"):
                return f"{p['name']} is already a client."
            if p.get("stage") not in ("Investing client", "Investing and trading client"):
                miss = prospects.missing_for(p, "Investing client")
                return f"{p['name']} can't become a client yet: still needed {', '.join(miss) or 'the move to Investing client'}."
    if name == "propose_product_feedback" and a.get("product_id") and not st.get("products", a["product_id"]):
        return "Unknown product id."
    return None


def card_summary(action: str, a: dict) -> str:
    who = actions.entity_name({"kind": a.get("with_kind") or a.get("to_kind") or a.get("about_kind") or ("client" if a.get("client_id") else "prospect"),
                               "id": a.get("with_id") or a.get("to_id") or a.get("about_id") or a.get("client_id") or a.get("prospect_id") or ""})
    if action == "schedule_meeting":
        when = dt.datetime.fromisoformat(a["start"][:16]).strftime("%a %d %b, %I:%M %p")
        return f"Schedule '{a.get('title')}' with {who} on {when}"
    if action == "send_message":
        return f"Send {a.get('channel')} to {who}"
    if action == "log_mom":
        return f"Record MoM for {who}" + (" and send it to them" if a.get("send_to_client", True) else "")
    if action == "product_feedback":
        p = store().get("products", a.get("product_id", "")) if a.get("product_id") else None
        return f"Send feedback to {(p or {}).get('product_manager', {}).get('name', 'the product team')}"
    if action == "reimbursement":
        return f"Claim {inr(a.get('amount'))} ({a.get('category')}) linked to {who}"
    if action == "service_request":
        return f"Raise service request for {who}: {a.get('title')}"
    if action == "add_note":
        return f"Add internal note on {who}"
    if action in ("reschedule_meeting", "cancel_meeting"):
        m = store().get("meetings", a.get("meeting_id", "")) or {}
        if action == "cancel_meeting":
            return f"Cancel '{m.get('title')}' on {dt.datetime.fromisoformat(m['start']).strftime('%a %d %b, %I:%M %p')}" if m else "Cancel meeting"
        to = dt.datetime.fromisoformat(a["start"][:16]).strftime("%a %d %b, %I:%M %p")
        return f"Move '{m.get('title')}' to {to}"
    if action == "convert_prospect":
        return f"Make {who} a client"
    if action == "update_prospect":
        bits = [f"stage to {a['stage']}" if a.get("stage") else "", f"next step: {a['next_step']}" if a.get("next_step") else ""]
        return f"Update {who}: " + ", ".join(b for b in bits if b) if any(bits) else f"Update prospect {who}"
    return action


# ------------------------------------------------------------------ prompts
def system_prompt(scope: dict) -> str:
    rm = singleton("rm")
    now = dt.datetime.fromisoformat(now_ist())
    st = store()
    base = f"""You are the {scope['kind']} agent inside Kova Work, the workspace of {rm.get('name')} ({rm.get('title')}, {rm.get('branch')}) at KOVA, an Indian wealth management firm (SEBI investment adviser and mutual fund distributor).
Now: {now.strftime('%A %d %B %Y, %H:%M')} IST. Business hours 09:30-19:30 Mon-Sat.
Dates ahead: {', '.join((now + dt.timedelta(days=i)).strftime('%a %d %b') for i in range(0, 15))}. "Next <weekday>" or "by <weekday>" means the first such day after today (if today is that weekday, use the one a week later). "Tomorrow" is the next date in the list.

How you work:
- The RM speaks or types short instructions, often from voice, so expect informal phrasing and transcription slips (e.g. "MOM" = minutes of meeting).
- Use read tools to check facts before acting. Never invent holdings, numbers, ids, emails or times.
- To DO anything (schedule, reschedule or cancel a meeting, message, MoM, feedback, reimbursement, service request, note, prospect update, making a prospect a client) call the matching propose_* tool. To move or cancel a meeting, find it with get_meetings first. Each creates an approval card the RM approves, edits or rejects. Never say anything was sent, scheduled or booked: it is "ready for your approval" until the RM approves the card.
- One request can need several cards (e.g. log a MoM, schedule the follow-up, send feedback to the product team). Propose them all, calling the tools together in one step where you can.
- Meeting attendees are other Kova colleagues joining (a head or specialist). The RM always attends and the client is implied: never list either. Leave attendees empty unless the RM names a colleague.
- MoMs: fill summary, feedback, portfolio_reaction, changes_asked, promises from what the RM said. RMs tend to say little, so after preparing the card always end with one or two short, specific questions about what's missing (e.g. did the proposal land, any changes asked, anything personal worth noting) so the RM can add it.
- If a detail is genuinely missing (time, amount), ask one short question instead of guessing. Resolve relative dates ("next Tuesday 4pm") yourself from today's date.
- Respect consent: no WhatsApp without WhatsApp consent; personal details go into MoMs only if profile-enrichment consent is given, otherwise mention they were left out.
- Suitability first: never push a product because it earns more points. Flag when a product's risk is above the client's profile.
- Write client-facing text in a warm, professional Indian-English tone, short, signed "{rm.get('name')}". Internal notes are crisp.
- Before you reply, check: if you prepared a MoM card and the RM didn't mention feedback, changes asked, how the proposal landed, or anything personal, end your reply with one or two short questions about exactly those.
- Reply to the RM in 1-4 short sentences or a few bullets (a product brief can be longer, with short headings and bullets; avoid tables); don't sign replies to the RM or repeat card ids. Amounts in Indian format with the rupee sign (₹12,34,567; ₹1.2 Cr; ₹45 L).
"""
    if scope["kind"] == "client":
        c = st.get("clients", scope["id"])
        base += "\nThis session is about the client below (JSON). Use their id for tools.\n" + json.dumps(client_brief(c, True), ensure_ascii=False)
        base += "\nHoldings (product: value, CIO stance): " + "; ".join(f"{h['name']} ({h['product_id']}): {h['value']}, {h['cio_stance']}" for h in holdings_view(c))
    elif scope["kind"] == "prospect":
        p = st.get("prospects", scope["id"])
        base += "\nThis session is about the prospect below (JSON). A prospect has no holdings; everything known was entered by the RM.\n" + json.dumps(prospect_brief(p), ensure_ascii=False)
    else:
        p = st.get("products", scope["id"])
        ld = st.get("ld_progress", scope["id"]) or {"completed": []}
        mods = p.get("ld", {}).get("modules", [])
        base += ("\nThis session is about the product below. The RM may ask questions, want a 10-minute brief (write a structured written brief: what it is, who it suits, "
                 "returns and costs, risks, how to pitch, objections and answers; link the product manager's video if video_url is set), want clients who fit, or want to send feedback to the product manager.\n"
                 + json.dumps(product_brief(p, True), ensure_ascii=False)
                 + f"\nRM's L&D on this product: {len(ld['completed'])} of {len(mods)} modules done.")
    return base


def history_messages(sess: dict, limit: int = 10) -> list[dict]:
    out = []
    for m in sess["messages"][-limit:]:
        if m["role"] == "rm":
            txt = m["text"]
            if m.get("bill"):
                txt += "\n[Attached bill, read as: " + json.dumps(m["bill"].get("fields", {}), ensure_ascii=False) + "]"
            out.append({"role": "user", "content": txt})
        elif m["role"] == "agent":
            txt = m.get("text") or ""
            for c in m.get("cards", []):
                txt += f"\n[Card {c['id']}: {c['summary']} — status {c['status']}]"
            out.append({"role": "assistant", "content": txt.strip() or "(prepared cards)"})
        elif m["role"] == "event":
            out.append({"role": "user", "content": f"[System note: {m['text']}]"})
    return out


# ------------------------------------------------------------------ reimbursement cards: each card holds its own bill
def refresh_checks(card: dict) -> None:
    bill = card.get("bill") or {}
    r = expenses.check(card["args"], has_bill=bool(bill.get("thumb")), bill_amount=(bill.get("fields") or {}).get("amount"))
    card.update(checks=r["checks"], blocking=r["blocking"], needs_manager=r["needs_manager"])


def assign_bill(cards: list[dict], bill: dict | None) -> None:
    """A bill sent with a message goes to the claim it matches (same amount), else to the first claim without one."""
    claims = [c for c in cards if c["action"] == "reimbursement"]
    if bill and bill.get("thumb") and claims:
        amt = (bill.get("fields") or {}).get("amount")
        match = next((c for c in claims if amt is not None and float(c["args"].get("amount") or 0) == float(amt)), None)
        target = match or next((c for c in claims if not c.get("bill")), None)
        if target is not None:
            target["bill"] = {"thumb": bill["thumb"], "fields": bill.get("fields") or {}}
    for c in claims:
        c.setdefault("bill", None)
        refresh_checks(c)


def find_card(s: dict, cid: str) -> tuple[int, dict]:
    for i, m in enumerate(s["messages"]):
        for c in m.get("cards", []):
            if c["id"] == cid:
                return i, c
    raise HTTPException(404, "Card not found")


def upgrade_claim_cards(s: dict) -> bool:
    """Cards made before per-card bills have no `bill` key: give them the bill sent with the message that produced them
    (or none), and fresh checks for pending ones. Returns True if anything changed."""
    changed = False
    for i, m in enumerate(s["messages"]):
        for c in m.get("cards", []):
            if c["action"] != "reimbursement":
                continue
            if "bill" not in c:
                prev = next((x for x in reversed(s["messages"][:i]) if x["role"] == "rm"), None)
                b = (prev or {}).get("bill") or {}
                c["bill"] = {"thumb": b["thumb"], "fields": b.get("fields") or {}} if b.get("thumb") else None
                changed = True
            if c["status"] == "pending":
                refresh_checks(c)
                changed = True
    return changed


# ------------------------------------------------------------------ sessions
def get_session(sid: str) -> dict:
    s = store().get("agent_sessions", sid)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.get("/sessions")
def list_sessions(kind: str, id: str, archived: bool = False):
    ss = [s for s in store().list("agent_sessions") if s["scope"] == {"kind": kind, "id": id} and bool(s.get("archived")) == archived]
    for s in ss:
        s["preview"] = next((m["text"] for m in s["messages"] if m["role"] == "rm"), "")
        s["card_count"] = sum(len(m.get("cards", [])) for m in s["messages"])
        s.pop("messages", None)
    return sorted(ss, key=lambda s: s["updated"], reverse=True)


@router.post("/sessions")
def create_session(body: dict = Body(...)):
    sid = new_id("AS-", "seq_session", 4000)
    s = {"id": sid, "scope": {"kind": body["kind"], "id": body["id"]}, "title": "New session", "created": now_ist(), "updated": now_ist(),
         "archived": False, "messages": []}
    return store().put("agent_sessions", sid, s)


@router.get("/sessions/{sid}")
def read_session(sid: str):
    s = get_session(sid)
    upgrade_claim_cards(s)  # checks are recomputed on every open (month totals move); not written back
    return s


@router.post("/sessions/{sid}/archive")
def archive_session(sid: str):
    s = get_session(sid)
    s["archived"] = not s.get("archived")
    return store().put("agent_sessions", sid, s)


@router.post("/sessions/{sid}/message")
def send(sid: str, body: dict = Body(...)):
    s = get_session(sid)
    scope = s["scope"]
    text = (body.get("text") or "").strip()
    bill = body.get("bill")
    if not text and not bill:
        raise HTTPException(400, "Say or type something first.")
    rm_msg = {"id": f"m{len(s['messages']) + 1}", "role": "rm", "text": text or "Here's a bill for reimbursement.", "at": now_ist(),
              "via": body.get("via", "text"), "transcript": body.get("transcript")}
    if bill:
        rm_msg["bill"] = bill
        if bill.get("thumb"):
            s["last_bill"] = bill["thumb"]
    s["messages"].append(rm_msg)
    if s["title"] == "New session":
        s["title"] = (text or "Reimbursement from a bill")[:60]

    tool_names = SCOPE_TOOLS[scope["kind"]]
    tools = [READ_TOOLS.get(n) or PROPOSE_TOOLS[n] for n in tool_names]
    msgs = [{"role": "system", "content": system_prompt(scope)}] + history_messages(s)
    cards: list[dict] = []
    reads: list[str] = []
    final = ""
    served = None
    try:
        for _ in range(6):
            resp = llm.chat(msgs, tools)
            served = resp.get("_served_by")
            choice = resp["choices"][0]["message"]
            calls = choice.get("tool_calls") or []
            if not calls:
                final = choice.get("content") or ""
                break
            msgs.append({"role": "assistant", "content": choice.get("content") or "", "tool_calls": calls})
            for call in calls:
                name = call["function"]["name"]
                try:
                    args = json.loads(call["function"].get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                if name in READ_TOOLS and name in tool_names:
                    result = run_read(name, args, scope)
                    reads.append(name)
                elif name in PROPOSE_TOOLS and name in tool_names:
                    err = validate_proposal(name, args, scope, text)
                    if err:
                        result = {"error": err}
                    else:
                        action = ACTION_OF[name]
                        args.pop("purpose", None)
                        if name == "propose_convert_prospect":  # the RM records consent; the agent never guesses it
                            from . import prospects
                            args["consent"] = {k: False for k in prospects.CONSENT_KEYS}
                        card = {"id": new_id("CD-", "seq_card", 7000), "action": action, "args": args, "summary": card_summary(action, args),
                                "status": "pending", "at": now_ist()}
                        cards.append(card)
                        result = {"ok": True, "card_id": card["id"], "status": "awaiting RM approval"}
                else:
                    result = {"error": f"Tool {name} isn't available on this page."}
                msgs.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result, ensure_ascii=False)[:6000]})
        else:
            final = final or "I've prepared what I could. Check the cards below."
    except llm.LLMError as e:
        log.warning("model unreachable in %s: %s", sid, e)  # details stay in the server log, not in the chat
        final = "I couldn't reach the language model just now. Your message is saved; try again in a minute."
        failed = True
    else:
        failed = False
    final = re.sub(r"<\|.*?\|>", "", final or "").strip()
    if not final and cards:
        final = "Prepared for your approval:"
    assign_bill(cards, bill)
    msg = {"id": f"m{len(s['messages']) + 1}", "role": "agent", "text": final, "at": now_ist(), "cards": cards,
           "reads": sorted(set(reads)), "served_by": served}
    if failed:
        msg["error"] = True
    s["messages"].append(msg)
    s["updated"] = now_ist()
    store().put("agent_sessions", sid, s)
    return s


@router.post("/sessions/{sid}/cards/{cid}/bill")
def attach_card_bill(sid: str, cid: str, body: dict = Body(...)):
    """Add or replace the bill on a pending reimbursement card. body: {thumb: data URL, fields?: what the bill reader found}."""
    s = get_session(sid)
    _, c = find_card(s, cid)
    upgrade_claim_cards(s)
    if c["action"] != "reimbursement" or c["status"] != "pending":
        raise HTTPException(400, "Bills can only be added to a reimbursement card that is waiting for approval.")
    thumb = body.get("thumb") or ""
    if not thumb.startswith("data:image"):
        raise HTTPException(400, "Send the bill as an image.")
    c["bill"] = {"thumb": thumb, "fields": body.get("fields") or {}}
    refresh_checks(c)
    s["updated"] = now_ist()
    store().put("agent_sessions", sid, s)
    return s


@router.post("/sessions/{sid}/cards/{cid}")
def decide(sid: str, cid: str, body: dict = Body(...)):
    s = get_session(sid)
    i, c = find_card(s, cid)
    if c["status"] != "pending":
        raise HTTPException(400, "This card was already decided.")
    upgrade_claim_cards(s)
    decision = body.get("decision")
    said = next((x["text"] for x in reversed(s["messages"][:i]) if x["role"] == "rm"), "")
    edited = False
    if decision == "reject":
        c["status"] = "rejected"
        c["reason"] = body.get("reason", "")
        note = f"RM rejected card {cid} ({c['summary']})" + (f": {c['reason']}" if c["reason"] else "")
    elif decision == "approve":
        args = body.get("args") or c["args"]
        edited = args != c["args"]
        if c["action"] == "reimbursement":
            img = (c.get("bill") or {}).get("thumb")
            args = {**args, "bill_image": img} if img else {k: v for k, v in args.items() if k != "bill_image"}
        try:
            result = actions.run(c["action"], args, {"session_id": sid, "card_id": cid, "said": said, "kind": s["scope"]["kind"], "id": s["scope"]["id"]})
        except KeyError as e:
            raise HTTPException(400, f"Missing {str(e).strip(chr(39)).replace('_', ' ')}") from e
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        c.update(status="approved", args={k: v for k, v in args.items() if k != "bill_image"}, edited=edited, decided_at=now_ist(),
                 result={k: (v.get("id") if isinstance(v, dict) else v) for k, v in result.items()})
        note = f"RM approved card {cid} ({c['summary']})" + (" with edits" if edited else "")
    else:
        raise HTTPException(400, "decision must be approve or reject")
    s["messages"].append({"id": f"m{len(s['messages']) + 1}", "role": "event", "text": note, "at": now_ist(),
                          "decision": {"decision": decision, "card_id": cid, "summary": c["summary"], "edited": edited, "reason": c.get("reason", "")}})
    s["updated"] = now_ist()
    store().put("agent_sessions", sid, s)
    return s


# ------------------------------------------------------------------ speech and bills
@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    if len(data) > 24 * 1024 * 1024:
        raise HTTPException(400, "Recording too long.")
    try:
        return llm.transcribe(data, audio.filename or "speech.webm", audio.content_type or "audio/webm")
    except llm.LLMError as e:
        raise HTTPException(502, str(e)) from e


@router.post("/read-bill")
def read_bill(body: dict = Body(...)):
    """body: {image: data URL (jpeg/png)} → extracted fields for a reimbursement card."""
    img = body.get("image", "")
    if not img.startswith("data:image/"):
        raise HTTPException(400, "Send the bill as an image.")
    prompt = ("Read this bill or receipt from India. Reply with JSON only: "
              '{"merchant": str, "bill_date": "YYYY-MM-DD", "amount": number (grand total in rupees), "gst": str or null (GSTIN), '
              '"category": one of ["Client meeting meals","Local travel","Outstation travel","Client gifts","Events","Phone and internet"], '
              '"items": [str], "confidence": "high"|"medium"|"low", "issues": [str]}. If it is not a bill, set confidence "low" and explain in issues.')
    try:
        resp = llm.chat([{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": img}}]}],
                        models=[llm.VISION_MODEL], temperature=0, max_tokens=700, primary="agent")
    except llm.LLMError as e:
        raise HTTPException(502, str(e)) from e
    txt = resp["choices"][0]["message"].get("content") or ""
    txt = re.sub(r"<think>.*?</think>", "", txt, flags=re.S)
    m = re.search(r"\{.*\}", txt, re.S)
    try:
        fields = json.loads(m.group(0)) if m else {}
    except json.JSONDecodeError:
        fields = {}
    return {"fields": fields, "raw": txt[:800] if not fields else None, "served_by": resp.get("_served_by")}


@router.get("/gateway")
def gateway_log():
    return {"calls": list(reversed(llm.LOG))}


# ------------------------------------------------------------------ developer checks (GET, for testing a protected deployment)
@router.get("/dev/run")
def dev_run(kind: str, id: str, q: str, session: str | None = None, bill: bool = False):
    sid = session or create_session({"kind": kind, "id": id})["id"]
    body = {"text": q, "via": "text"}
    if bill:
        body["bill"] = {"fields": dev_bill()["fields"]}
    return send(sid, body)


@router.get("/dev/decide")
def dev_decide(session: str, card: str, decision: str = "approve"):
    return decide(session, card, {"decision": decision})


@router.get("/dev/bill")
def dev_bill():
    from .store import DATA_DIR
    img = "data:image/jpeg;base64," + base64.b64encode((DATA_DIR / "sample-bill.jpg").read_bytes()).decode()
    return read_bill({"image": img})


@router.get("/dev/speech")
def dev_speech():
    import io
    import math
    import struct
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / 16000))) for i in range(16000)))
    try:
        return llm.transcribe(buf.getvalue(), "tone.wav", "audio/wav") | {"note": "A pure tone: an empty or nonsense transcript with status 200 means the speech path works."}
    except llm.LLMError as e:
        return {"error": str(e)}
