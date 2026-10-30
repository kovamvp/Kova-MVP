"""Meeting summaries. After a meeting the RM (by voice through the agent, or by form) records what happened in
up to six sections. Each part goes where it belongs, and saving again (an edit) makes the changes flow on:

  portfolio   → kept on the meeting; agreed changes feed the MoM
  products    → interest becomes a pipeline line; feedback goes to the product manager
  service     → a service request to Client Experience
  engagement  → profile fields updated (consent and locks respected), notes kept internal
  regulatory  → a task for the RM (risk profile review, KYC, nominee…)
  to_get      → what the client owes, tracked until received
  next_meeting→ a follow-up meeting chained by previous_meeting_id, carrying the open items (or a prompt to book it)

Everything created is remembered in `meeting.routed` under a stable key, so an edit can close what was
removed (pipeline lines, owed items, tasks, the follow-up) and say plainly what was already sent and can't be unsent.
"""
from __future__ import annotations

import re
from typing import Any

from . import actions
from .store import new_id, now_ist, store

OUTCOMES = ["Positive", "Neutral", "Needs follow-up", "Proposal requested", "Transaction agreed", "Not interested"]
INTEREST = {"Interested": "Interested", "Follow up": "Follow-up", "Not interested": None}
REGULATORY = ["Risk profile review", "KYC update", "Nominee", "Consent", "FATCA", "Other"]


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40]


def _check(args: dict, prods: dict[str, dict]) -> dict:
    from .profile import SERVICE_CATEGORIES
    if args.get("outcome") and args["outcome"] not in OUTCOMES:
        raise ValueError(f"Outcome must be one of: {', '.join(OUTCOMES)}")
    for p in args.get("products") or []:
        if p.get("product_id") not in prods:
            raise ValueError(f"Unknown product {p.get('product_id')} in the summary")
        if p.get("interest", "Interested") not in INTEREST:
            raise ValueError("Product interest must be Interested, Follow up or Not interested")
    for s in args.get("service") or []:
        if s.get("category") not in SERVICE_CATEGORIES:
            raise ValueError(f"Unknown service item {s.get('category')}; use one of: {', '.join(SERVICE_CATEGORIES)}")
    for r in args.get("regulatory") or []:
        if r.get("kind") not in REGULATORY:
            raise ValueError(f"Regulatory item must be one of: {', '.join(REGULATORY)}")
    return {
        "portfolio": args.get("portfolio") or None,
        "products": [{"product_id": p["product_id"], "interest": p.get("interest", "Interested"), "amount": p.get("amount"),
                      "feedback": (p.get("feedback") or "").strip()} for p in args.get("products") or []],
        "service": [{"category": s["category"], "details": (s.get("details") or "").strip()} for s in args.get("service") or []],
        "engagement": args.get("engagement") or None,
        "regulatory": [{"kind": r["kind"], "note": (r.get("note") or "").strip()} for r in args.get("regulatory") or []],
        "to_get": [{"text": t["text"].strip(), "due": t.get("due")} for t in args.get("to_get") or [] if (t.get("text") or "").strip()],
        "outcome": args.get("outcome") or "Neutral",
        "next_meeting": args["next_meeting"] if isinstance(args.get("next_meeting"), dict) else None,  # {} still means "meet again"
    }


def _coll(kind: str) -> str:
    return "clients" if kind == "client" else "prospects"


def record_summary(args: dict, source: dict | None = None) -> dict:
    st = store()
    m = st.get("meetings", args.get("meeting_id") or "")
    if not m:
        raise ValueError("Meeting not found")
    if m["status"] == "cancelled":
        raise ValueError("This meeting was cancelled; there's nothing to summarise.")
    if m["start"] > now_ist():
        raise ValueError("This meeting hasn't happened yet. Record the summary after it.")
    prods = {p["id"]: p for p in st.list("products")}
    s = _check(args, prods)
    link = m["with"]
    by = "agent" if source and source.get("card_id") else "rm"
    routed: dict[str, dict] = dict(m.get("routed") or {})
    want: dict[str, Any] = {}
    notes: list[str] = []
    out_routed: list[dict] = []
    who = st.get(_coll(link["kind"]), link["id"]) or {}

    # ---- products: interest → pipeline; feedback → product manager (once)
    for p in s["products"]:
        pid = p["product_id"]
        stage = INTEREST[p["interest"]]
        if stage:
            want[f"interest:{pid}"] = {"stage": stage, "value": p.get("amount")}
        if p["feedback"]:
            want[f"feedback:{pid}"] = p["feedback"]
    for t in s["to_get"]:
        want[f"owed:{_slug(t['text'])}"] = t
    for sv in s["service"]:
        want[f"service:{sv['category']}"] = sv
    for r in s["regulatory"]:
        want[f"task:{r['kind']}"] = r
    nm = s["next_meeting"]
    if nm is not None:
        want["follow_up" if nm.get("start") else "follow_up_prompt"] = nm

    # ---- what was there before and isn't now: close what can be closed, report what was already sent
    for key, r in list(routed.items()):
        if key in want or r.get("status") in ("closed", "cancelled"):
            continue
        kind = r["kind"]
        if kind == "pipeline":
            pl = st.get("pipeline", r["ref"])
            if pl:
                pl.update(stage="Closed", closed_reason="Removed from the meeting summary", updated=now_ist())
                pl.setdefault("history", []).append({"at": now_ist(), "stage": "Closed", "note": "Removed from the meeting summary"})
                st.put("pipeline", pl["id"], pl)
        elif kind == "owed":
            e = st.get(_coll(link["kind"]), link["id"])
            for o in e.get("owed", []):
                if o["id"] == r["ref"] and o["status"] == "open":
                    o["status"] = "cancelled"
            st.put(_coll(link["kind"]), e["id"], e)
        elif kind in ("task", "follow_up_prompt"):
            u = st.get("updates", r["ref"])
            if u:
                u["done"] = True
                st.put("updates", u["id"], u)
        elif kind == "follow_up":
            f = st.get("meetings", r["ref"])
            if f and f["status"] == "scheduled":
                actions.cancel_meeting({"meeting_id": f["id"], "reason": "Removed from the previous meeting's summary", "notify_client": True}, source)
        else:  # service request or product feedback: already with another team
            what = r.get("label", key)
            notes.append(f"{what} was already sent ({r['ref']}); cancel it from Requests if it's no longer needed.")
            continue
        r["status"] = "cancelled" if kind != "pipeline" else "closed"

    # ---- create or update what's wanted now
    for key, val in want.items():
        prev = routed.get(key)
        kind = key.split(":")[0]
        if kind == "interest":
            pid = key.split(":")[1]
            if prev and prev.get("status") != "closed":
                pl = st.get("pipeline", prev["ref"])
                if pl and (pl["stage"] != val["stage"] or pl.get("value") != val["value"]):
                    pl.setdefault("history", []).append({"at": now_ist(), "stage": val["stage"], "note": "Updated from the meeting summary"})
                    pl.update(stage=val["stage"], value=val["value"] or pl.get("value"), updated=now_ist())
                    st.put("pipeline", pl["id"], pl)
                continue
            pl = {"id": new_id("PL-", "seq_pipeline", 100), "with": link, "product_id": pid, "stage": val["stage"], "value": val["value"],
                  "source": {"kind": "meeting", "meeting_id": m["id"]}, "created": now_ist(), "updated": now_ist(), "closed_reason": None,
                  "history": [{"at": now_ist(), "stage": val["stage"], "note": f"From {m['title']}"}]}
            st.put("pipeline", pl["id"], pl)
            routed[key] = {"kind": "pipeline", "ref": pl["id"], "status": "open", "label": f"Interest in {prods[pid]['name']}"}
        elif kind == "feedback":
            if prev:
                continue  # sent once; an edit doesn't resend
            pid = key.split(":")[1]
            r = actions.product_feedback({"product_id": pid, "feedback": val, "client_id": link["id"] if link["kind"] == "client" else None,
                                          "meeting_id": m["id"]}, source)
            routed[key] = {"kind": "product_feedback", "ref": r["request"]["id"], "status": "sent", "label": f"Feedback on {prods[pid]['name']}"}
        elif kind == "service":
            if prev:
                continue
            if link["kind"] != "client":
                notes.append(f"{val['category']}: service requests are for clients; noted on the summary only.")
                continue
            r = actions.service_request({"client_id": link["id"], "category": val["category"], "details": val["details"] or val["category"]}, source)
            routed[key] = {"kind": "service_request", "ref": r["request"]["id"], "status": "sent", "label": f"Service request: {val['category']}"}
        elif kind == "owed":
            e = st.get(_coll(link["kind"]), link["id"])
            items = e.setdefault("owed", [])
            if prev and prev.get("status") == "open":
                for o in items:
                    if o["id"] == prev["ref"]:
                        o["due"] = val.get("due")
            else:
                oid = new_id("OW-", "seq_owed", 100)
                items.append({"id": oid, "text": val["text"], "due": val.get("due"), "from_meeting": m["id"], "status": "open", "at": now_ist()})
                routed[key] = {"kind": "owed", "ref": oid, "status": "open", "label": f"To get: {val['text']}"}
                actions.add_update("task", f"Get from {who.get('name', '')}: {val['text']}", f"Agreed in {m['title']}.", link, 2, val.get("due"), "Meetings")
            st.put(_coll(link["kind"]), e["id"], e)
        elif kind == "task":
            if prev and prev.get("status") == "open":
                continue
            u = actions.add_update("task", f"{val['kind']}: {who.get('name', '')}", val["note"] or f"Raised in {m['title']}.", link, 1, None, "Meetings")
            routed[key] = {"kind": "task", "ref": u["id"], "status": "open", "label": f"Task: {val['kind']}"}
        elif key == "follow_up":
            carry_products = [p["product_id"] for p in s["products"] if INTEREST[p["interest"]]]
            open_owed = [t["text"] for t in s["to_get"]]
            plan = {"products": carry_products, "portfolio": "Rebalance" if (s["portfolio"] or {}).get("changes") else None, "service": [],
                    "notes": ("Still to get: " + "; ".join(open_owed)) if open_owed else ""}
            if prev and prev.get("status") == "open":
                f = st.get("meetings", prev["ref"])
                if f and f["status"] == "scheduled" and f["start"] != val["start"][:16]:
                    actions.reschedule_meeting({"meeting_id": f["id"], "start": val["start"], "reason": "Changed in the previous meeting's summary"}, source)
                if f:
                    f = st.get("meetings", f["id"])
                    f["plan"] = plan
                    st.put("meetings", f["id"], f)
                continue
            r = actions.schedule_meeting({"with_kind": link["kind"], "with_id": link["id"], "title": val.get("title") or f"Follow-up: {m['title']}",
                                          "type": m.get("type") or "Review", "start": val["start"], "duration_minutes": val.get("duration_minutes") or 45,
                                          "location": val.get("location") or m.get("location"), "agenda": val.get("agenda") or [], "plan": plan}, source)
            f = r["meeting"]
            f["previous_meeting_id"] = m["id"]
            st.put("meetings", f["id"], f)
            routed[key] = {"kind": "follow_up", "ref": f["id"], "status": "open", "label": f"Follow-up meeting: {f['title']}"}
        elif key == "follow_up_prompt":
            if prev and prev.get("status") == "open":
                continue
            u = actions.add_update("task", f"Book the follow-up with {who.get('name', '')}", val.get("title") or f"Agreed in {m['title']}.", link, 1, None, "Meetings")
            routed[key] = {"kind": "follow_up_prompt", "ref": u["id"], "status": "open", "label": "Prompt to book the follow-up"}

    # ---- engagement: profile fields (clients only; locks and consent checked by profile.update_profile)
    eng = s["engagement"] or {}
    if eng.get("profile"):
        if link["kind"] == "client":
            from . import profile
            for section, changes in eng["profile"].items():
                try:
                    r = profile.update_profile({"client_id": link["id"], "section": section, "changes": changes}, source)
                    if r["changed"]:
                        out_routed.append({"kind": "profile", "ref": section, "label": f"Profile updated: {', '.join(r['changed'])}"})
                except ValueError as e:
                    notes.append(f"Profile not updated ({section}): {e}")
        else:
            notes.append("Profile details are kept on the summary; prospects don't have a profile yet.")

    m = st.get("meetings", m["id"])  # actions above may have touched it
    version = (m.get("summary") or {}).get("version", 0) + 1
    m["summary"] = {**s, "version": version, "at": now_ist(), "by": by}
    m["routed"] = routed
    m.setdefault("summary_history", []).append({"at": now_ist(), "by": by, "version": version, "summary": s})
    st.put("meetings", m["id"], m)
    actions.add_timeline(link, {"kind": "agent" if by == "agent" else "system", "title": f"Meeting summary {'updated' if version > 1 else 'recorded'}: {m['title']}",
                                "body": f"Outcome: {s['outcome']}. " + "; ".join(r["label"] for r in routed.values() if r.get("status") in ("open", "sent"))})
    created = [{"kind": r["kind"], "ref": r["ref"], "label": r["label"]} for k, r in routed.items() if k in want and r.get("status") in ("open", "sent")]
    return {"meeting": m["id"], "version": version, "routed": created + out_routed, "notes": notes}


def mom_draft(m: dict) -> dict:
    """A client-ready MoM from the summary: what was discussed and agreed, products to follow up, what Kova is doing,
    what we need from them and when we meet next. Internal notes, product feedback, profile and regulatory items stay out."""
    st = store()
    s = m.get("summary") or {}
    who = st.get(_coll(m["with"]["kind"]), m["with"]["id"]) or {}
    prods = {p["id"]: p for p in st.list("products")}
    lines: list[str] = []
    pf = s.get("portfolio") or {}
    if pf.get("discussed"):
        lines.append(f"We reviewed your portfolio: {pf['discussed'].rstrip('.')}.")
    for c in pf.get("changes") or []:
        lines.append(f"Agreed: {c.rstrip('.')}.")
    discussed = [prods[p["product_id"]]["name"] for p in s.get("products") or [] if INTEREST.get(p["interest"])]
    if discussed:
        lines.append(f"We discussed {', '.join(discussed)}. I'll share the details for you to look at.")
    promises = [f"Share details of {n}" for n in discussed]
    for sv in s.get("service") or []:
        promises.append(f"{sv['category']}: raised with our service team")
    owed = [t["text"] for t in s.get("to_get") or []]
    if owed:
        lines.append("Could you please share: " + "; ".join(owed) + ".")
    f = next((st.get("meetings", r["ref"]) for r in (m.get("routed") or {}).values() if r["kind"] == "follow_up" and r.get("status") == "open"), None)
    if f:
        import datetime as dt
        lines.append(f"We'll meet next on {dt.datetime.fromisoformat(f['start']).strftime('%A %d %B at %I:%M %p').replace(' 0', ' ')} ({f['title']}).")
    first = who.get("first_name") or (who.get("name") or "").split(" ")[0]
    return {"to": who.get("name"), "first_name": first, "summary": "\n".join(lines) or "Thank you for your time today.", "promises": promises,
            "portfolio_reaction": pf.get("reaction") or "", "changes_asked": pf.get("changes") or []}


def update_owed(args: dict, source: dict | None = None) -> dict:
    st = store()
    e = st.get(_coll(args.get("kind", "client")), args["id"])
    if not e:
        raise ValueError("Not found")
    o = next((x for x in e.get("owed", []) if x["id"] == args["owed_id"]), None)
    if not o:
        raise ValueError("That item isn't on the list")
    if args.get("status") not in ("open", "received", "cancelled"):
        raise ValueError("Status must be open, received or cancelled")
    o["status"] = args["status"]
    o["updated"] = now_ist()
    st.put(_coll(args.get("kind", "client")), e["id"], e)
    actions.add_timeline({"kind": args.get("kind", "client"), "id": e["id"]}, {"kind": "system", "title": f"{o['text']}: {o['status']}", "body": ""})
    return {"owed": o}
