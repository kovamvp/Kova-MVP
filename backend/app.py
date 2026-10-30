from __future__ import annotations

import os
import traceback
from datetime import datetime, timedelta
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from . import actions, expenses
from .store import LIST_COLLECTIONS, SINGLETONS, new_id, now_ist, put_singleton, singleton, store

app = FastAPI(title="KOVA Work API", version="0.1.0")

READABLE = set(LIST_COLLECTIONS) | {"layouts"}


@app.exception_handler(Exception)
async def on_error(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"error": str(exc) or exc.__class__.__name__})


@app.get("/api/health")
def health():
    from .migrations import applied
    from .store import SEED_VERSION, table_prefix
    return {"ok": True, "store": store().__class__.__name__, "tables": table_prefix(), "time": now_ist(), "seed": SEED_VERSION,
            "migrations": applied(store()),
            "commit": (os.environ.get("VERCEL_GIT_COMMIT_SHA") or "local")[:7],
            "groq": bool(os.environ.get("GROQ_API_KEY_AGENT") or os.environ.get("GROQ_API_KEY_SPEECH"))}


@app.post("/api/reset")
def reset():
    store().snapshot("before_reset")  # Preferences → Reset can always be undone with scripts/restore_snapshot.py
    store().reset()
    return {"ok": True}


# ------------------------------------------------------------ generic JSON documents
@app.get("/api/c/{coll}")
def list_coll(coll: str):
    if coll not in READABLE:
        raise HTTPException(404, "Unknown collection")
    docs = store().list(coll)
    if coll == "requests":
        for r in docs:
            if actions.advance(r):
                store().put("requests", r["id"], r)
    return docs


@app.get("/api/c/{coll}/{id_}")
def get_doc(coll: str, id_: str):
    if coll not in READABLE:
        raise HTTPException(404, "Unknown collection")
    d = store().get(coll, id_)
    if d is None and coll == "layouts":
        return {"id": id_, "items": None}  # no saved layout yet: the app shows the default board
    if d is None:
        raise HTTPException(404, f"{id_} not found")
    if coll == "requests" and actions.advance(d):
        store().put("requests", d["id"], d)
    return d


@app.put("/api/c/{coll}/{id_}")
def put_doc(coll: str, id_: str, doc: dict = Body(...)):
    if coll not in READABLE:
        raise HTTPException(404, "Unknown collection")
    doc["id"] = id_
    return store().put(coll, id_, doc)


@app.get("/api/s/{name}")
def get_single(name: str):
    if name not in SINGLETONS:
        raise HTTPException(404)
    return singleton(name)


@app.patch("/api/s/{name}")
def patch_single(name: str, patch: dict = Body(...)):
    if name not in SINGLETONS:
        raise HTTPException(404)
    d = singleton(name)
    d.update(patch)
    return put_singleton(name, d)


# ------------------------------------------------------------ actions (manual or approved agent cards)
# ------------------------------------------------------------ shared reference data
@app.get("/api/taxonomy")
def get_taxonomy():
    from .taxonomy import ASSET_CLASSES, tree
    return {"asset_classes": ASSET_CLASSES, "tree": tree(store().list("products"))}


@app.get("/api/tiers")
def get_tiers():
    from .tiers import TIERS
    fams = store().list("families")
    return [{**t, "families": sum(1 for f in fams if f.get("tier") == t["key"])} for t in TIERS]


@app.get("/api/book/history")
def book_history():
    from .history import book, fy_label, fy_start
    from .store import today_ist
    return {"months": book(store().list("clients")), "fy_start": fy_start(today_ist()).isoformat()[:7], "fy": fy_label(today_ist()),
            "note": "Illustrative sample history for the demo."}


@app.post("/api/actions/{action}")
def run_action(action: str, args: dict = Body(...)):
    try:
        return actions.run(action, args, {"via": "manual"})
    except KeyError as e:
        raise HTTPException(400, f"Missing {str(e).strip(chr(39)).replace('_', ' ')}") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


# ------------------------------------------------------------ expenses (policy set by the branch head)
@app.get("/api/expenses/policy")
def get_expense_policy():
    return expenses.policy()


@app.put("/api/expenses/policy")
def put_expense_policy(patch: dict = Body(...)):
    try:
        return expenses.update_policy(patch)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@app.post("/api/expenses/check")
def check_expense(args: dict = Body(...)):
    """Dry run of every policy check, for the form and the agent card. Nothing is written."""
    has_bill = args.pop("has_bill", None)
    bill_amount = args.pop("bill_amount", None)
    return expenses.check(args, has_bill, bill_amount)


# ------------------------------------------------------------ updates panel
@app.post("/api/updates/{id_}/done")
def update_done(id_: str):
    u = store().get("updates", id_) or {}
    u["done"] = not u.get("done", False)
    return store().put("updates", id_, u)


@app.post("/api/updates/{id_}/snooze")
def update_snooze(id_: str, body: dict = Body(...)):
    u = store().get("updates", id_) or {}
    u["snoozed_until"] = body.get("until")
    return store().put("updates", id_, u)


# ------------------------------------------------------------ requests
@app.post("/api/requests/{id_}/{op}")
def request_op(id_: str, op: str, body: dict = Body(default={})):
    r = store().get("requests", id_)
    if not r:
        raise HTTPException(404)
    t = now_ist()
    if op == "nudge":
        r.setdefault("trail", []).append({"at": t, "by": "Priya Sharma", "text": "Nudged " + (r.get("team") or "")})
    elif op == "escalate":
        r["escalations"] = r.get("escalations", 0) + 1
        r.setdefault("trail", []).append({"at": t, "by": "Priya Sharma", "text": f"Escalated to {r.get('team')} head (level {r['escalations']})"})
    elif op == "reminders":
        r["reminders"] = not r.get("reminders", True)
    elif op == "respond":
        r.setdefault("trail", []).append({"at": t, "by": "Priya Sharma", "text": body.get("text") or "Responded"})
        r["status"], r["direction"] = "in_review", "waiting_on_others"
        actions.attach_sim(r, team=r.get("team", ""), pm="Product manager", client="Client",
                           decision="approved", decision_text="Approved after your changes")
        r["sim"] = r["sim"][-1:]
        r["sim"][0]["at"] = (datetime.fromisoformat(t) + timedelta(minutes=2)).isoformat(timespec="minutes")
    elif op == "close":
        r["status"], r["direction"] = "done", "completed"
        r.setdefault("trail", []).append({"at": t, "by": "Priya Sharma", "text": "Closed"})
    else:
        raise HTTPException(400, "Unknown operation")
    return store().put("requests", id_, r)


# ------------------------------------------------------------ outbox
@app.patch("/api/outbox/{id_}")
def outbox_patch(id_: str, patch: dict = Body(...)):
    o = store().get("outbox", id_)
    if not o:
        raise HTTPException(404)
    for k in ("subject", "body"):
        if k in patch and patch[k] != o.get(k):
            o.setdefault("original", {}).setdefault(k, o.get(k))
            o[k] = patch[k]
            o["edited"] = True
    if "review" in patch:
        o["review"] = patch["review"]
        o["review_note"] = patch.get("review_note", "")
    return store().put("outbox", id_, o)


# ------------------------------------------------------------ portfolios
@app.post("/api/portfolios")
def portfolio_create(body: dict = Body(...)):
    from datetime import date
    pid = new_id(f"PF-{date.today().year}-", "seq_portfolio", 130, 6)
    pf = {"id": pid, "name": body.get("name") or "Untitled portfolio", "amount": body.get("amount", 0), "status": "draft" if body.get("tag") else "practice",
          "tag": body.get("tag"), "lines": body.get("lines", []), "created": now_ist(), "updated": now_ist(),
          "source": body.get("source", "scratch"), "model_id": body.get("model_id"), "note": body.get("note", ""),
          "history": [{"at": now_ist(), "event": f"Created ({body.get('source', 'scratch')})"}]}
    return store().put("portfolios", pid, pf)


@app.put("/api/portfolios/{id_}")
def portfolio_save(id_: str, body: dict = Body(...)):
    pf = store().get("portfolios", id_) or {}
    for k in ("name", "amount", "tag", "lines", "note"):
        if k in body:
            pf[k] = body[k]
    if pf.get("status") == "changes_requested" and body.get("lines") is not None:
        pf["status"] = "draft"
    if pf.get("status") == "practice" and pf.get("tag"):
        pf["status"] = "draft"
    elif pf.get("status") == "draft" and not pf.get("tag"):
        pf["status"] = "practice"
    pf["updated"] = now_ist()
    return store().put("portfolios", id_, pf)


@app.post("/api/portfolios/{id_}/submit")
def portfolio_submit(id_: str, body: dict = Body(default={})):
    pf = store().get("portfolios", id_)
    if not pf:
        raise HTTPException(404)
    if not pf.get("tag"):
        raise HTTPException(400, "Tag a client or prospect before sending for approval.")
    pf["status"] = "awaiting_approval"
    pf.setdefault("history", []).append({"at": now_ist(), "event": "Sent to CIO Office for approval"})
    store().put("portfolios", id_, pf)
    flags = body.get("flags", [])
    decision = "changes_requested" if any(f.get("severity") == "high" for f in flags) else "approved"
    text = ("Changes requested: " + "; ".join(f["text"] for f in flags if f.get("severity") == "high")) if decision == "changes_requested" else "Approved. Suitable for the tagged profile."
    existing = [r for r in store().list("requests") if r["type"] == "portfolio_approval" and r["payload"].get("portfolio_id") == id_ and r["direction"] != "completed"]
    for r in existing:
        r["direction"], r["status"], r["sim"] = "completed", "superseded", []
        store().put("requests", r["id"], r)
    req = actions.new_request("portfolio_approval", pf["name"], "CIO Office", {"portfolio_id": id_, "amount": pf["amount"], "flags": flags},
                              {"kind": "portfolio", "id": id_}, decision=decision, decision_text=text)
    actions.add_outbox("portfolio_approval", "Kova Work", {"name": "CIO Office", "address": "Anand Iyer"}, f"Approval: {pf['name']}",
                       f"Portfolio {id_} ({pf['name']}) for {actions.entity_name(pf['tag'])}, amount {expenses.rupees(pf['amount'])}. Lines: {len(pf['lines'])}.",
                       {"via": "studio", "kind": "portfolio", "id": id_}, {"portfolio": pf, "flags": flags})
    return {"portfolio": pf, "request": req}


# ------------------------------------------------------------ learning
@app.post("/api/ld/{product_id}/toggle")
def ld_toggle(product_id: str, body: dict = Body(...)):
    rec = store().get("ld_progress", product_id) or {"id": product_id, "product_id": product_id, "completed": []}
    m = body["module_id"]
    if m in rec["completed"]:
        rec["completed"].remove(m)
    else:
        rec["completed"].append(m)
    return store().put("ld_progress", product_id, rec)


# ------------------------------------------------------------ growth goals
@app.post("/api/growth/goals")
def goals_op(body: dict = Body(...)):
    g = singleton("growth")
    op = body["op"]
    if op == "add":
        if len([x for x in g["goals"] if not x.get("achieved")]) >= 5:
            raise HTTPException(400, "Five goals at a time. Mark one achieved or remove it first.")
        g["goals"].append({"id": new_id("G", "seq_goal", 10), "text": body["text"], "by": "self", "achieved": False, "created": now_ist()[:10], "progress": None})
    elif op == "achieve":
        goal = next(x for x in g["goals"] if x["id"] == body["id"])
        g["goals"].remove(goal)
        g.setdefault("achieved_goals", []).insert(0, {"id": goal["id"], "text": goal["text"], "achieved_on": now_ist()[:10], "by": goal["by"]})
    elif op == "remove":
        goal = next(x for x in g["goals"] if x["id"] == body["id"])
        if goal["by"] == "manager":
            raise HTTPException(400, "Goals set by your manager can't be removed here.")
        g["goals"].remove(goal)
    elif op == "edit":
        goal = next(x for x in g["goals"] if x["id"] == body["id"])
        goal["text"] = body["text"]
    return put_singleton("growth", g)


# ------------------------------------------------------------ prospects
@app.post("/api/prospects")
def prospect_create(body: dict = Body(...)):
    pid = new_id("PR-", "seq_prospect", 2100)
    p = {"id": pid, "name": body["name"], "age": body.get("age"), "gender": body.get("gender"), "source": body.get("source", "Cold outreach"),
         "source_detail": body.get("source_detail", ""), "stage": body.get("stage", "Lead"), "estimated_investable": body.get("estimated_investable", 0),
         "need": body.get("need", ""), "last_contact": now_ist()[:10], "meetings_held": 0, "created": now_ist()[:10], "phone": body.get("phone", ""),
         "email": body.get("email", ""), "city": body.get("city", "Mumbai"), "risk_indication": "Not assessed", "probability": 10,
         "next_step": body.get("next_step"), "next_step_date": body.get("next_step_date"), "app_access": False, "kyc_steps": [
             {"step": s, "done": False} for s in ["Mobile and email verified", "PAN and KYC (KRA)", "Bank account", "FATCA declaration", "Nominee", "Risk profile",
                                                   "Demat and trading account", "Exchange registration (UCC)", "DDPI"]],
         "interests": [], "app_activity": [], "suggestions": [], "recommended_portfolio_id": None, "notes": body.get("need", ""),
         "timeline": [{"id": "e1", "kind": "system", "at": now_ist(), "title": "Prospect created", "body": body.get("need", "")}], "closed": None}
    return store().put("prospects", pid, p)


@app.get("/api/prospects/{id_}/gates")
def prospect_gates(id_: str):
    from . import prospects
    p = store().get("prospects", id_)
    if not p:
        raise HTTPException(404)
    return {"stage": p["stage"], "converted": p.get("converted"), "stages": prospects.gates(p)}


@app.post("/api/prospects/{id_}/{op}")
def prospect_op(id_: str, op: str, body: dict = Body(default={})):
    from . import prospects
    p = store().get("prospects", id_)
    if not p:
        raise HTTPException(404)
    try:
        if op == "stage":
            return store().put("prospects", id_, prospects.move(p, body.get("stage", "")))
        if op == "kyc_step":
            return store().put("prospects", id_, prospects.mark_step(p, body.get("step", ""), bool(body.get("done", True)), body.get("risk_profile")))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    if p.get("converted") and op in ("reopen", "close"):
        raise HTTPException(400, f"{p['name']} is already a client; the prospect record is kept as history.")
    if op == "close":
        p["closed"] = {"reason": body.get("reason", ""), "date": now_ist()[:10], "learning": body.get("learning", ""), "previous_stage": p["stage"]}
        p["stage"] = "Closed"
    elif op == "reopen":
        p["stage"] = (p.get("closed") or {}).get("previous_stage") or "Prospect"
        p["closed"] = None
    else:
        raise HTTPException(400, f"Unknown operation {op}")
    p.setdefault("timeline", []).insert(0, {"id": f"e{len(p['timeline']) + 1}", "kind": "system", "at": now_ist(), "title": f"Prospect {op}", "body": body.get("reason") or body.get("stage", "")})
    return store().put("prospects", id_, p)


# ------------------------------------------------------------ search
@app.get("/api/search")
def search(q: str = ""):
    q = q.strip().lower()
    if len(q) < 1:
        return []
    out: list[dict[str, Any]] = []
    for c in store().list("clients"):
        if q in c["name"].lower() or q in c["id"].lower():
            out.append({"kind": "client", "id": c["id"], "title": c["name"], "sub": f"{c['segment'].capitalize()} client · {c['locality']}"})
    for p in store().list("prospects"):
        if q in p["name"].lower() or q in p["id"].lower():
            out.append({"kind": "prospect", "id": p["id"], "title": p["name"], "sub": f"Prospect · {p['stage']}"})
    for p in store().list("products"):
        if q in p["name"].lower() or q in p["sub_category"].lower() or q in p["manufacturer"].lower():
            out.append({"kind": "product", "id": p["id"], "title": p["name"], "sub": f"{p['category']} · {p['sub_category']}"})
    for pf in store().list("portfolios"):
        if q in pf["name"].lower() or q in pf["id"].lower():
            out.append({"kind": "portfolio", "id": pf["id"], "title": pf["name"], "sub": f"Portfolio · {pf['status'].replace('_', ' ')}"})
    for m in store().list("meetings"):
        if q in m["title"].lower():
            out.append({"kind": "meeting", "id": m["id"], "title": m["title"], "sub": f"Meeting · {m['start'][:10]}"})
    return out[:20]


# ------------------------------------------------------------ agent, speech, bills
from . import agent  # noqa: E402

app.include_router(agent.router)
