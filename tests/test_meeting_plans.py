"""Sprint 5: meetings carry a plan (products, portfolio intent, service items) set when scheduling,
editable later, and rolled up for the CIO and product teams."""
import datetime as dt

from backend import meetings as M
from backend import store as S
from tests.test_meetings import at


def book(client, plan=None, with_id="CL-1001", days=3):
    return client.post("/api/actions/schedule_meeting", json={"with_kind": "client", "with_id": with_id, "title": "Review", "start": at(days=days),
                                                             "duration_minutes": 45, "location": "Their office", "plan": plan})


PLAN = {"products": ["PD-202", "PD-301"], "portfolio": "Rebalance", "service": ["Nominee update"], "notes": "Bring the PMS fee comparison"}


def test_plan_is_saved_with_the_meeting(client):
    m = book(client, PLAN).json()["meeting"]
    assert m["plan"] == PLAN


def test_a_meeting_without_a_plan_has_an_empty_one(client):
    m = book(client).json()["meeting"]
    assert m["plan"] == {"products": [], "portfolio": None, "service": [], "notes": ""}


def test_plan_is_checked(client):
    assert book(client, {"products": ["PD-999"]}).status_code == 400
    assert book(client, {"portfolio": "Buy everything"}).status_code == 400
    assert book(client, {"service": ["Haircut"]}).status_code == 400


def test_plan_never_reaches_the_client(client):
    out = book(client, PLAN).json()
    assert "Bring the PMS fee" not in out["outbox"]["body"] and "Rebalance" not in out["outbox"]["body"]


def test_plan_can_be_edited_and_the_change_is_kept(client):
    m = book(client, PLAN).json()["meeting"]
    out = client.post("/api/actions/edit_meeting", json={"meeting_id": m["id"], "plan": {"products": ["PD-101"], "portfolio": "Review", "service": [], "notes": ""}}).json()
    r = out["meeting"]
    assert r["plan"]["products"] == ["PD-101"] and r["changes"][-1]["what"] == "edited" and "plan" in r["changes"][-1]["to"]
    assert "outbox" not in out  # the client isn't told about an internal plan


def test_sample_meetings_have_plans(client):
    ms = client.get("/api/c/meetings").json()
    assert all(set(m["plan"]) == {"products", "portfolio", "service", "notes"} for m in ms)
    assert sum(1 for m in ms if m["plan"]["products"] or m["plan"]["portfolio"] or m["plan"]["service"]) >= len(ms) // 2


def test_plan_summary_rolls_up_upcoming_meetings(client):
    book(client, {"products": ["PD-202"], "portfolio": "Rebalance"}, with_id="CL-1001", days=2)
    book(client, {"products": ["PD-202"], "portfolio": "Review"}, with_id="CL-1002", days=4)
    s = client.get("/api/meetings/plan-summary?days=30").json()
    row = next(p for p in s["products"] if p["product_id"] == "PD-202")
    assert row["meetings"] >= 2 and {"Rajesh Mehta", "Kavita Mehta"} <= set(row["with"])
    assert s["portfolio"]["Rebalance"] >= 1 and s["days"] == 30
    # only meetings still to come count
    assert all(m["start"] >= S.now_ist() for m in [x for x in S.store().list("meetings") if x["id"] in s["meeting_ids"]])


def test_agent_can_propose_a_plan(client, script_llm):
    script_llm([("propose_schedule_meeting", {"with_kind": "client", "with_id": "CL-1001", "title": "Review", "start": at(days=5),
                                              "plan": {"products": ["PD-202"], "portfolio": "Review"}})], "ok")
    sid = client.post("/api/agent/sessions", json={"kind": "client", "id": "CL-1001"}).json()["id"]
    s = client.post(f"/api/agent/sessions/{sid}/message", json={"text": "book a review about the PMS"}).json()
    card = [c for m in s["messages"] for c in m.get("cards", [])][0]
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"}).json()
    mid = [c for m in s["messages"] for c in m.get("cards", [])][0]["result"]["meeting"]
    assert S.store().get("meetings", mid)["plan"]["products"] == ["PD-202"]


def test_infer_plan_from_agenda():
    prods = {p["id"]: p for p in S.store().list("products")}
    m = {"type": "Review", "title": "Quarterly review", "agenda": ["Rebalance after equity drift", "PMS fee question", "Nominee update"], "with": {"kind": "client", "id": "CL-1001"}}
    p = M.infer_plan(m, prods, S.store().get("clients", "CL-1001"))
    assert p["portfolio"] == "Rebalance" and "Nominee update" in p["service"]
    assert any(prods[x]["product_type"] == "PMS" for x in p["products"])
    assert dt.date  # keep import used
