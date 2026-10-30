"""Actions an RM can take, by hand (Actions panel) or through the agent.

Every action writes the real records (meeting, request, note...) and an
outbox entry holding the exact payload that "would have been sent".
Other teams' responses are simulated: each new request carries a short
script of future steps that are applied lazily when requests are read.
"""
from __future__ import annotations

import datetime as dt

from .store import new_id, now_ist, store

RM_NAME = "Priya Sharma"


def _now() -> dt.datetime:
    return dt.datetime.fromisoformat(now_ist())


def _plus(minutes: float) -> str:
    return (_now() + dt.timedelta(minutes=minutes)).isoformat(timespec="minutes")


def entity(kind: str, id_: str) -> dict | None:
    coll = {"client": "clients", "prospect": "prospects", "product": "products", "portfolio": "portfolios",
            "meeting": "meetings", "request": "requests"}.get(kind)
    return store().get(coll, id_) if coll else None


def entity_name(link: dict | None) -> str:
    if not link:
        return ""
    e = entity(link.get("kind", ""), link.get("id", ""))
    return (e or {}).get("name") or (e or {}).get("title") or link.get("id", "")


def add_timeline(link: dict | None, item: dict) -> None:
    """Append an event to a client's or prospect's timeline."""
    if not link or link.get("kind") not in ("client", "prospect"):
        return
    coll = "clients" if link["kind"] == "client" else "prospects"
    e = store().get(coll, link["id"])
    if not e:
        return
    tl = e.get("timeline", [])
    item = {"id": f"e{len(tl) + 1}-{int(_now().timestamp())}", "at": now_ist(), **item}
    e["timeline"] = [item] + tl
    if item.get("kind") == "comm":
        e["last_contact"] = now_ist()[:10]
    store().put(coll, link["id"], e)


def add_outbox(action: str, channel: str, to: dict, subject: str | None, body: str, source: dict | None, payload: dict | None = None) -> dict:
    ob = {
        "id": new_id("OB-", "seq_outbox", 9001),
        "at": now_ist(), "action": action, "channel": channel, "to": to,
        "subject": subject, "body": body, "payload": payload or {},
        "source": source or {}, "review": None, "edited": False,
    }
    store().put("outbox", ob["id"], ob)
    return ob


def add_update(kind: str, title: str, body: str, link: dict | None, priority: int = 2, due: str | None = None, source: str = "Agent") -> None:
    u = {"id": new_id("UP-", "seq_update", 100), "kind": kind, "priority": priority, "title": title, "body": body,
         "due": due, "link": link, "source": source, "done": False, "snoozed_until": None, "created": now_ist()}
    store().put("updates", u["id"], u)


# ---------------------------------------------------------------- simulation
SIM = {
    "product_feedback": [(1.5, "in_review", "{pm}", "Read your note"), (4, "done", "{pm}", "Replied: thanks, a client-ready note goes out this week. I've added your clients' questions to the FAQ.")],
    "reimbursement": [(1, "in_review", "Accounts (Kiran)", "Picked up for verification"), (3, "approved", "Accounts (Kiran)", "Bill verified against policy; will be paid in the next cycle")],
    "reimbursement_manager": [(1, "in_review", "{approver}", "Looking at the claim above your limit"),
                              (3, "in_review", "{approver}", "Approved above the limit; passed to Accounts"),
                              (5, "in_review", "Accounts (Kiran)", "Picked up for verification"),
                              (7, "approved", "Accounts (Kiran)", "Bill verified; will be paid in the next cycle")],
    "service_request": [(1, "in_review", "CX (Asha)", "Acknowledged; working on it"), (5, "done", "CX (Asha)", "Completed and confirmed with the client")],
    "ticket": [(1, "in_review", "{team} team lead", "Assigned within the team"), (6, "done", "{team} team lead", "Resolved; please confirm")],
    "portfolio_approval": [(1.5, "in_review", "CIO Office (Anand Iyer)", "Under review"), (4, "{decision}", "CIO Office (Anand Iyer)", "{decision_text}")],
    "mom_ack": [(3, "done", "{client}", "Acknowledged in Kova Client")],
    "ownership_check": [(2, "in_review", "Branch head (Rohan Kapoor)", "Checking with {rm}"),
                        (6, "done", "Branch head (Rohan Kapoor)", "Spoke to {rm}: no active conversation on their side. The relationship stays with you.")],
}


def attach_sim(req: dict, script: str | None = None, **fmt: str) -> None:
    steps = []
    for mins, status, by, text in SIM.get(script or req["type"], []):
        steps.append({"at": _plus(mins), "status": status.format(**fmt), "by": by.format(**fmt), "text": text.format(**fmt)})
    req["sim"] = steps


def advance(req: dict) -> bool:
    """Apply simulated steps whose time has passed. Returns True if changed."""
    changed = False
    now = now_ist()
    rest = []
    for s in req.get("sim", []):
        if s["at"] <= now:
            req["status"] = s["status"]
            req.setdefault("trail", []).append({"at": s["at"], "by": s["by"], "text": s["text"]})
            changed = True
            if s["status"] in ("done", "approved"):
                req["direction"] = "completed"
            if s["status"] in ("changes_requested", "needs_info"):
                req["direction"] = "waiting_on_me"
            if req["type"] == "portfolio_approval":
                pf = store().get("portfolios", req["payload"]["portfolio_id"])
                if pf:
                    pf["status"] = {"approved": "approved", "changes_requested": "changes_requested"}.get(s["status"], "awaiting_approval")
                    pf.setdefault("history", []).append({"at": s["at"], "event": f"{s['by']}: {s['text']}"})
                    store().put("portfolios", pf["id"], pf)
                    if s["status"] in ("approved", "changes_requested"):
                        add_update("approval", f"Portfolio {pf['name']}: {s['status'].replace('_', ' ')}", s["text"], {"kind": "portfolio", "id": pf["id"]}, 1, None, "Requests")
        else:
            rest.append(s)
    req["sim"] = rest
    return changed


def new_request(type_: str, title: str, team: str, payload: dict, link: dict | None, priority: str = "normal", due: str | None = None,
                direction: str = "waiting_on_others", script: str | None = None, **fmt: str) -> dict:
    req = {
        "id": new_id("RQ-", "seq_request", 3200), "type": type_, "title": title, "team": team, "direction": direction,
        "status": "sent", "priority": priority, "created": now_ist(), "due": due, "link": link, "payload": payload,
        "trail": [{"at": now_ist(), "by": RM_NAME, "text": "Sent"}], "escalations": 0, "reminders": True,
    }
    attach_sim(req, script, team=team, **fmt)
    store().put("requests", req["id"], req)
    return req


# ---------------------------------------------------------------- actions
def schedule_meeting(args: dict, source: dict | None = None) -> dict:
    link = {"kind": args.get("with_kind", "client"), "id": args["with_id"]}
    who = entity(link["kind"], link["id"]) or {}
    start = args["start"][:16]
    dur = int(args.get("duration_minutes") or 45)
    end = (dt.datetime.fromisoformat(start) + dt.timedelta(minutes=dur)).isoformat(timespec="minutes")
    m = {
        "id": new_id("MT-", "seq_meeting", 600), "title": args.get("title") or f"Meeting with {who.get('name', '')}",
        "type": args.get("type") or "Review", "with": link, "start": start, "end": end, "status": "scheduled",
        "location": args.get("location") or "To be confirmed", "attendees": args.get("attendees") or [],
        "agenda": args.get("agenda") or [], "mom": None, "promises": [], "created_by": "agent" if source and source.get("card_id") else "rm",
    }
    store().put("meetings", m["id"], m)
    when = dt.datetime.fromisoformat(start).strftime("%a %d %b, %I:%M %p")
    body = (f"Hi {who.get('first_name') or who.get('name', '').split(' ')[0]},\n\nConfirming our meeting on {when} at {m['location']}."
            + ("\n\nAgenda:\n" + "\n".join(f"- {a}" for a in m["agenda"]) if m["agenda"] else "") + f"\n\nRegards,\n{RM_NAME}")
    channel = args.get("channel") or "Calendar invite"
    ob = add_outbox("schedule_meeting", channel, {"name": who.get("name"), "address": who.get("email")}, m["title"], body, {**(source or {}), "kind": link["kind"], "id": link["id"]},
                    {"meeting_id": m["id"], "start": start, "end": end, "location": m["location"], "attendees": m["attendees"]})
    add_timeline(link, {"kind": "agent" if source and source.get("card_id") else "system", "title": f"Meeting scheduled: {when}", "body": m["title"]})
    add_update("meeting", f"{m['title']}", f"{when} · {m['location']}", {"kind": "meeting", "id": m["id"]}, 2, start, "Meetings")
    return {"meeting": m, "outbox": ob}


def product_feedback(args: dict, source: dict | None = None) -> dict:
    pid = args.get("product_id")
    prod = store().get("products", pid) if pid else None
    pm = (prod or {}).get("product_manager") or {"name": "Product team", "title": "Product"}
    link = {"kind": "product", "id": pid} if pid else None
    title = args.get("title") or (f"Feedback: {prod['name']}" if prod else "Product feedback")
    req = new_request("product_feedback", title, f"Product: {pm['title'].replace('Product Manager, ', '')}",
                      {"feedback": args["feedback"], "client_id": args.get("client_id"), "product_id": pid},
                      link, args.get("priority", "normal"), None, pm=pm["name"])
    ob = add_outbox("product_feedback", "Kova Work", {"name": pm["name"], "address": pm["title"]}, title, args["feedback"], source, {"request_id": req["id"]})
    if args.get("client_id"):
        add_timeline({"kind": "client", "id": args["client_id"]}, {"kind": "note", "title": "Product feedback sent", "body": args["feedback"], "by": RM_NAME})
    return {"request": req, "outbox": ob}


def send_message(args: dict, source: dict | None = None) -> dict:
    link = {"kind": args.get("to_kind", "client"), "id": args["to_id"]}
    who = entity(link["kind"], link["id"]) or {}
    channel = args.get("channel", "Email")
    if channel == "WhatsApp" and not who.get("consent", {}).get("whatsapp"):
        raise ValueError(f"{who.get('name')} has not consented to WhatsApp. Use email instead.")
    ob = add_outbox("send_message", channel, {"name": who.get("name"), "address": who.get("phone") if channel == "WhatsApp" else who.get("email")},
                    args.get("subject"), args["body"], {**(source or {}), "kind": link["kind"], "id": link["id"]})
    add_timeline(link, {"kind": "comm", "channel": channel, "title": args.get("subject") or f"{channel} message", "body": args["body"], "by": RM_NAME})
    return {"outbox": ob}


def log_mom(args: dict, source: dict | None = None) -> dict:
    link = {"kind": args.get("with_kind", "client"), "id": args["with_id"]}
    who = entity(link["kind"], link["id"]) or {}
    mid = args.get("meeting_id")
    m = store().get("meetings", mid) if mid else None
    if not m:
        cands = [x for x in store().list("meetings") if x["with"] == link and x["status"] in ("needs_mom", "scheduled") and x["start"] <= now_ist()]
        m = sorted(cands, key=lambda x: x["start"])[-1] if cands else None
    mom = {"summary": args["summary"], "feedback": args.get("feedback", ""), "portfolio_reaction": args.get("portfolio_reaction", ""),
           "changes_asked": args.get("changes_asked", []), "personal": args.get("personal", ""), "approved_at": now_ist()}
    promises = [{"text": p, "due": args.get("promise_due"), "done": False} for p in args.get("promises", [])]
    if m:
        m["mom"] = mom
        m["status"] = "completed"
        m["promises"] = m.get("promises", []) + promises
        store().put("meetings", m["id"], m)
    else:
        m = {"id": new_id("MT-", "seq_meeting", 600), "title": args.get("title") or f"Conversation with {who.get('name')}", "type": "Service",
             "with": link, "start": now_ist(), "end": now_ist(), "status": "completed", "location": args.get("location", "Not recorded"),
             "attendees": [], "agenda": [], "mom": mom, "promises": promises, "created_by": "agent"}
        store().put("meetings", m["id"], m)
    bullets = "\n".join(f"- {p}" for p in args.get("promises", []))
    body = (f"Hi {who.get('first_name') or who.get('name', '').split(' ')[0]},\n\nThank you for your time. A short summary:\n\n{args['summary']}"
            + (f"\n\nNext steps:\n{bullets}" if bullets else "") + f"\n\nRegards,\n{RM_NAME}")
    out = {"meeting": m}
    add_timeline(link, {"kind": "agent", "title": "MoM recorded", "body": args["summary"]})
    if args.get("send_to_client", True):
        channel = args.get("channel", "Email")
        if channel == "WhatsApp" and not who.get("consent", {}).get("whatsapp"):
            channel = "Email"
        out["outbox"] = add_outbox("send_mom", channel, {"name": who.get("name"), "address": who.get("email") if channel == "Email" else who.get("phone")},
                                   f"Notes from our meeting: {m['title']}", body, {**(source or {}), "kind": link["kind"], "id": link["id"]}, {"meeting_id": m["id"], "mom": mom})
        if link["kind"] == "client":
            out["request"] = new_request("mom_ack", f"MoM acknowledgement: {m['title']}", "Client", {"meeting_id": m["id"]}, link, client=who.get("name", "Client"))
    if args.get("personal") and link["kind"] == "client" and not who.get("consent", {}).get("profile_enrichment"):
        out["warning"] = "Personal details were kept in the MoM only; the client hasn't consented to profile enrichment."
    return out


def reimbursement(args: dict, source: dict | None = None) -> dict:
    from . import expenses
    result = expenses.check(args)
    reason = expenses.blocking_reason(result)
    if reason:
        raise ValueError(reason)
    link = {"kind": "client", "id": args["client_id"]} if args.get("client_id") else None
    payload = {k: args.get(k) for k in ("category", "amount", "merchant", "bill_date", "gst", "bill_image", "purpose")}
    payload |= {"checks": result["checks"], "needs_manager": result["needs_manager"], "month_total_before": result["month_total"]}
    title = f"{args.get('category', 'Expense')}: {entity_name(link) or args.get('merchant', '')}"
    approver = result["approver"].split(",")[0]
    req = new_request("reimbursement", title, "Branch head, then Accounts" if result["needs_manager"] else "Accounts", payload, link,
                      script="reimbursement_manager" if result["needs_manager"] else None, approver=f"Branch head ({approver})")
    when = dt.date.fromisoformat(str(args["bill_date"])[:10]).strftime("%d %b %Y")
    body = (f"Reimbursement claim of {expenses.rupees(float(args['amount']))} at {args.get('merchant') or 'not given'} on {when} ({args.get('category')})."
            + (f" For {entity_name(link)}." if link else "") + (f" Purpose: {args['purpose']}." if args.get("purpose") else "")
            + (f" Above policy limits, so {approver} approves it first." if result["needs_manager"] else ""))
    ob = add_outbox("reimbursement", "Kova Work", {"name": "Accounts team", "address": "accounts@kova.in"}, title, body,
                    source, {"request_id": req["id"], **{k: v for k, v in payload.items() if k not in ("bill_image", "checks")},
                             "bill_attached": bool(payload.get("bill_image"))})
    return {"request": req, "outbox": ob}


def service_request(args: dict, source: dict | None = None) -> dict:
    from .profile import SERVICE_CATEGORIES
    link = {"kind": "client", "id": args["client_id"]}
    cat = args.get("category")
    if cat and cat not in SERVICE_CATEGORIES:
        raise ValueError(f"Unknown service category. Use one of: {', '.join(SERVICE_CATEGORIES)}")
    title = (args.get("title") or "").strip()
    title = f"{cat}: {title}" if cat and title and not title.startswith(cat) else (title or cat or "Service request")
    req = new_request("service_request", title, "Client Experience", {"request": args["details"], "category": cat or "Other"}, link, args.get("priority", "normal"))
    ob = add_outbox("service_request", "Kova Work", {"name": "Client Experience team", "address": "cx@kova.in"}, title, args["details"], source, {"request_id": req["id"]})
    add_timeline(link, {"kind": "system", "title": f"Service request raised: {title}", "body": args["details"]})
    return {"request": req, "outbox": ob}


def add_note(args: dict, source: dict | None = None) -> dict:
    link = {"kind": args.get("about_kind", "client"), "id": args["about_id"]}
    add_timeline(link, {"kind": "note", "title": args.get("title") or "Internal note", "body": args["text"], "by": RM_NAME})
    return {"ok": True}


def update_prospect(args: dict, source: dict | None = None) -> dict:
    p = store().get("prospects", args["prospect_id"])
    if not p:
        raise ValueError("Prospect not found")
    from . import prospects
    changes = []
    if args.get("stage") not in (None, "", p.get("stage")):
        prev = p["stage"]
        prospects.move(p, args["stage"], by_agent=bool(source and source.get("card_id")))  # raises if the stage's steps aren't done
        changes.append(f"stage: {prev} → {args['stage']}")
    for k in ("next_step", "next_step_date", "estimated_investable", "risk_indication"):
        if args.get(k) not in (None, ""):
            changes.append(f"{k.replace('_', ' ')}: {p.get(k)} → {args[k]}")
            p[k] = args[k]
    if args.get("interest_product_id"):
        p["interests"] = list(dict.fromkeys(p.get("interests", []) + [args["interest_product_id"]]))
        changes.append(f"interested in {args['interest_product_id']}")
    if args.get("needs"):
        p["needs"] = prospects.check_needs({**(p.get("needs") or {}), **args["needs"]})
        n = p["needs"]
        changes.append(f"needs: {n['goal']}" + (f", {n['horizon']}" if n.get("horizon") else "") + (f", {', '.join(n['asset_classes'])}" if n.get("asset_classes") else ""))
    if args.get("consent"):
        cur = p.get("consent") or {}
        new = {k: bool(v) for k, v in args["consent"].items() if k in prospects.PROSPECT_CONSENT}
        diff = [f"{k} {'given' if v else 'withdrawn'}" for k, v in new.items() if bool(cur.get(k)) != v]
        p["consent"] = {**cur, **new, "captured_on": now_ist()[:10]}
        if diff:
            changes.append("consent: " + ", ".join(diff))
    store().put("prospects", p["id"], p)
    add_timeline({"kind": "prospect", "id": p["id"]}, {"kind": "agent" if source else "system", "title": "Prospect updated", "body": "; ".join(changes)})
    return {"prospect": p}


def create_ticket(args: dict, source: dict | None = None) -> dict:
    link = {"kind": "client", "id": args["client_id"]} if args.get("client_id") else None
    team = args.get("team", "Operations")
    req = new_request("ticket", args["subject"], team, {"summary": args.get("summary", ""), "assignee": f"{team} team lead", "attachments": args.get("attachments", [])},
                      link, args.get("priority", "normal"), args.get("due"))
    return {"request": req}


# ---------------------------------------------------------------- changing a meeting
def _when(s: str) -> str:
    return dt.datetime.fromisoformat(s[:16]).strftime("%a %d %b, %I:%M %p")


def clash_with(start: str, end: str, exclude: str | None = None) -> dict | None:
    """The first scheduled meeting that overlaps start-end, other than `exclude`."""
    s, e = dt.datetime.fromisoformat(start[:16]), dt.datetime.fromisoformat(end[:16])
    for m in store().list("meetings"):
        if m["id"] == exclude or m["status"] != "scheduled":
            continue
        if dt.datetime.fromisoformat(m["start"]) < e and dt.datetime.fromisoformat(m["end"]) > s:
            return m
    return None


def _changeable(mid: str) -> dict:
    m = store().get("meetings", mid or "")
    if not m:
        raise ValueError("Meeting not found")
    if m["status"] == "cancelled":
        raise ValueError("This meeting was cancelled; schedule a new one instead.")
    if m["status"] in ("completed", "no_show") or m.get("mom"):
        raise ValueError("This meeting already happened; it can't be changed.")
    return m


def _record(m: dict, what: str, before: dict, after: dict, reason: str | None, source: dict | None) -> None:
    by = "Agent card, approved by " + RM_NAME if source and source.get("card_id") else RM_NAME
    m.setdefault("changes", []).append({"at": now_ist(), "what": what, "by": by, "from": before, "to": after, "reason": reason or ""})


def _tell(m: dict, kind: str, source: dict | None) -> dict:
    """Updated invite or cancellation to the client or prospect. Internal reasons are never included."""
    who = entity(m["with"]["kind"], m["with"]["id"]) or {}
    first = who.get("first_name") or (who.get("name") or "").split(" ")[0]
    if kind == "cancelled":
        subject = f"Cancelled: {m['title']}"
        body = (f"Hi {first},\n\nI need to cancel our meeting on {_when(m['start'])}. I'm sorry for the change; "
                f"I'll be in touch to find a new time that suits you.\n\nRegards,\n{RM_NAME}")
    else:
        subject = f"Updated: {m['title']}"
        body = (f"Hi {first},\n\nA small change to our meeting. It's now on {_when(m['start'])} at {m['location']}."
                + ("\n\nAgenda:\n" + "\n".join(f"- {a}" for a in m["agenda"]) if m.get("agenda") else "")
                + f"\n\nRegards,\n{RM_NAME}")
    return add_outbox(f"{kind}_meeting", "Calendar invite", {"name": who.get("name"), "address": who.get("email")}, subject, body,
                      {**(source or {}), "kind": m["with"]["kind"], "id": m["with"]["id"]},
                      {"meeting_id": m["id"], "start": m["start"], "end": m["end"], "location": m["location"], "status": m["status"]})


def reschedule_meeting(args: dict, source: dict | None = None) -> dict:
    m = _changeable(args.get("meeting_id"))
    start = str(args["start"])[:16]
    try:
        dt.datetime.fromisoformat(start)
    except ValueError as e:
        raise ValueError("start must be YYYY-MM-DDTHH:MM") from e
    if start < now_ist():
        raise ValueError("That time is in the past. Pick a future time.")
    dur = int(args.get("duration_minutes") or (dt.datetime.fromisoformat(m["end"]) - dt.datetime.fromisoformat(m["start"])).seconds // 60 or 45)
    end = (dt.datetime.fromisoformat(start) + dt.timedelta(minutes=dur)).isoformat(timespec="minutes")
    other = clash_with(start, end, exclude=m["id"])
    if other:
        raise ValueError(f"Clashes with '{other['title']}' at {_when(other['start'])}.")
    before = {"start": m["start"], "end": m["end"], "location": m["location"]}
    m.update(start=start, end=end)
    for k in ("location", "title"):
        if args.get(k):
            m[k] = args[k]
    if args.get("agenda"):
        m["agenda"] = args["agenda"]
    if m["status"] == "needs_mom":
        m["status"] = "scheduled"
    _record(m, "rescheduled", before, {"start": start, "end": end, "location": m["location"]}, args.get("reason"), source)
    store().put("meetings", m["id"], m)
    add_timeline(m["with"], {"kind": "agent" if source and source.get("card_id") else "system", "title": f"Meeting moved to {_when(start)}",
                             "body": f"{m['title']} (was {_when(before['start'])})" + (f". Reason: {args['reason']}" if args.get("reason") else "")})
    out: dict = {"meeting": m}
    if args.get("notify_client", True):
        out["outbox"] = _tell(m, "updated", source)
    return out


def edit_meeting(args: dict, source: dict | None = None) -> dict:
    m = _changeable(args.get("meeting_id"))
    before, after = {}, {}
    for k in ("title", "location", "agenda", "attendees", "type"):
        if k in args and args[k] not in (None, "") and args[k] != m.get(k):
            before[k], after[k] = m.get(k), args[k]
            m[k] = args[k]
    if not after:
        raise ValueError("Nothing to change.")
    _record(m, "edited", before, after, args.get("reason"), source)
    store().put("meetings", m["id"], m)
    add_timeline(m["with"], {"kind": "system", "title": "Meeting details changed", "body": f"{m['title']}: " + ", ".join(after)})
    out: dict = {"meeting": m}
    if "location" in after and args.get("notify_client", True):  # only a new place is worth telling the client
        out["outbox"] = _tell(m, "updated", source)
    return out


def cancel_meeting(args: dict, source: dict | None = None) -> dict:
    m = _changeable(args.get("meeting_id"))
    reason = str(args.get("reason") or "").strip()
    if not reason:
        raise ValueError("Say why the meeting is cancelled (kept internal).")
    _record(m, "cancelled", {"status": m["status"]}, {"status": "cancelled"}, reason, source)
    m["status"] = "cancelled"
    store().put("meetings", m["id"], m)
    add_timeline(m["with"], {"kind": "system", "title": "Meeting cancelled", "body": f"{m['title']}, {_when(m['start'])}. Reason: {reason}"})
    out: dict = {"meeting": m}
    if args.get("notify_client", True):
        out["outbox"] = _tell(m, "cancelled", source)
    return out


def mark_no_show(args: dict, source: dict | None = None) -> dict:
    m = _changeable(args.get("meeting_id"))
    if m["start"] > now_ist():
        raise ValueError("This meeting hasn't started yet.")
    _record(m, "no_show", {"status": m["status"]}, {"status": "no_show"}, args.get("note"), source)
    m["status"] = "no_show"
    store().put("meetings", m["id"], m)
    who = entity(m["with"]["kind"], m["with"]["id"]) or {}
    add_timeline(m["with"], {"kind": "system", "title": "Didn't attend", "body": f"{m['title']}, {_when(m['start'])}" + (f". {args['note']}" if args.get("note") else "")})
    add_update("followup", f"Follow up with {who.get('name', 'them')}", f"They missed {m['title']}. Find a new time.", m["with"], 2,
               (dt.datetime.fromisoformat(now_ist()) + dt.timedelta(days=2)).isoformat(timespec="minutes"), "Meetings")
    return {"meeting": m}


def convert_prospect(args: dict, source: dict | None = None) -> dict:
    from .prospects import convert  # prospects imports this module, so import late
    return convert(args, source)


ACTIONS = {
    "schedule_meeting": schedule_meeting,
    "product_feedback": product_feedback,
    "send_message": send_message,
    "log_mom": log_mom,
    "reimbursement": reimbursement,
    "service_request": service_request,
    "add_note": add_note,
    "update_prospect": update_prospect,
    "create_ticket": create_ticket,
    "convert_prospect": convert_prospect,
    "reschedule_meeting": reschedule_meeting,
    "edit_meeting": edit_meeting,
    "cancel_meeting": cancel_meeting,
    "mark_no_show": mark_no_show,
}


def _profile_actions() -> None:
    from . import profile
    ACTIONS.update({"update_profile": profile.update_profile, "add_custom_field": profile.add_custom_field,
                    "update_custom_field": profile.update_custom_field, "remove_custom_field": profile.remove_custom_field})


_profile_actions()


def run(action: str, args: dict, source: dict | None = None) -> dict:
    if action not in ACTIONS:
        raise ValueError(f"Unknown action {action}")
    return ACTIONS[action](args, source)
