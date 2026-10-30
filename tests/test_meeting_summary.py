"""Sprint 6: after a meeting, a summary in up to six sections. Each part goes where it belongs (pipeline,
product team, service requests, what the client owes, tasks, profile, a chained follow-up), the summary
stays editable with changes flowing on, and a client-ready MoM is drafted from it."""
from backend import store as S
from tests.test_meetings import at


def past_meeting(client_id="CL-1001"):
    return next(m for m in S.store().list("meetings") if m["status"] == "needs_mom" and m["with"]["id"] == client_id) \
        if any(m["status"] == "needs_mom" and m["with"]["id"] == client_id for m in S.store().list("meetings")) \
        else next(m for m in S.store().list("meetings") if m["status"] == "needs_mom")


FULL = {
    "portfolio": {"discussed": "Equity is above band after the rally", "reaction": "Happy with returns, worried about fees", "changes": ["Move ₹25 L from mid cap to balanced advantage"]},
    "products": [{"product_id": "PD-301", "interest": "Interested", "amount": 5000000},
                 {"product_id": "PD-202", "interest": "Follow up", "feedback": "Client finds the 2.5% fee steep versus peers"}],
    "service": [{"category": "Nominee update", "details": "Add Kavita as nominee on all folios"}],
    "engagement": {"notes": "Daughter's wedding in March; likes Willingdon", "profile": {"family": {"children": "Rhea (24)"}}},
    "regulatory": [{"kind": "Risk profile review", "note": "Profile is from Feb 2025"}],
    "to_get": [{"text": "Latest Kotak statement", "due": None}, {"text": "Signed nominee form"}],
    "outcome": "Proposal requested",
}


def record(client, m, **over):
    return client.post("/api/actions/record_summary", json={"meeting_id": m["id"], **FULL, **over})


def test_summary_is_saved_and_versioned(client):
    m = past_meeting()
    r = record(client, m)
    assert r.status_code == 200, r.text
    saved = client.get(f"/api/c/meetings/{m['id']}").json()
    assert saved["summary"]["outcome"] == "Proposal requested" and saved["summary"]["version"] == 1
    assert saved["summary"]["portfolio"]["changes"] == FULL["portfolio"]["changes"]


def test_each_part_goes_where_it_belongs(client):
    m = past_meeting()
    out = record(client, m).json()
    routed = out["routed"]
    kinds = {r["kind"] for r in routed}
    assert {"pipeline", "product_feedback", "service_request", "owed", "task", "profile"} <= kinds
    pipe = [p for p in client.get("/api/c/pipeline").json() if p["source"]["meeting_id"] == m["id"]]
    assert {(p["product_id"], p["stage"]) for p in pipe} == {("PD-301", "Interested"), ("PD-202", "Follow-up")}
    assert next(p for p in pipe if p["product_id"] == "PD-301")["value"] == 5000000
    reqs = client.get("/api/c/requests").json()
    assert any(r["type"] == "product_feedback" and "fee" in r["payload"]["feedback"] for r in reqs)
    assert any(r["type"] == "service_request" and r["payload"].get("category") == "Nominee update" for r in reqs)
    c = client.get("/api/c/clients/CL-1001").json() if m["with"]["id"] == "CL-1001" else client.get(f"/api/c/clients/{m['with']['id']}").json()
    owed = [o for o in c["owed"] if o["from_meeting"] == m["id"]]
    assert {o["text"] for o in owed} == {"Latest Kotak statement", "Signed nominee form"} and all(o["status"] == "open" for o in owed)
    assert c["profile"]["family"]["children"] == "Rhea (24)"
    ups = client.get("/api/c/updates").json()
    assert any("Risk profile review" in u["title"] for u in ups)


def test_irrelevant_sections_can_be_left_out(client):
    m = past_meeting()
    r = client.post("/api/actions/record_summary", json={"meeting_id": m["id"], "portfolio": {"discussed": "Quick check-in"}, "outcome": "Neutral"})
    assert r.status_code == 200 and [x["kind"] for x in r.json()["routed"]] == []


def test_summary_is_checked(client):
    m = past_meeting()
    assert record(client, m, outcome="Brilliant").status_code == 400
    assert record(client, m, products=[{"product_id": "PD-999", "interest": "Interested"}]).status_code == 400
    assert record(client, m, service=[{"category": "Haircut", "details": "x"}]).status_code == 400
    future = client.post("/api/actions/schedule_meeting", json={"with_kind": "client", "with_id": "CL-1001", "title": "Later", "start": at(days=6)}).json()["meeting"]
    r = record(client, future)
    assert r.status_code == 400 and "hasn't happened" in r.json()["detail"]


def test_editing_the_summary_flows_on(client):
    m = past_meeting()
    record(client, m)
    edited = {**FULL, "products": [{"product_id": "PD-202", "interest": "Interested", "amount": 7500000, "feedback": FULL["products"][1]["feedback"]}],
              "to_get": [{"text": "Latest Kotak statement"}], "service": []}
    out = client.post("/api/actions/record_summary", json={"meeting_id": m["id"], **edited}).json()
    pipe = {p["product_id"]: p for p in client.get("/api/c/pipeline").json() if p["source"]["meeting_id"] == m["id"]}
    assert pipe["PD-301"]["stage"] == "Closed" and "removed" in pipe["PD-301"]["closed_reason"].lower()
    assert pipe["PD-202"]["stage"] == "Interested" and pipe["PD-202"]["value"] == 7500000
    c = client.get(f"/api/c/clients/{m['with']['id']}").json()
    assert next(o for o in c["owed"] if o["text"] == "Signed nominee form")["status"] == "cancelled"
    # what was already sent can't be unsent: the RM is told
    assert any("already" in n.lower() and "Nominee update" in n for n in out["notes"])
    saved = client.get(f"/api/c/meetings/{m['id']}").json()
    assert saved["summary"]["version"] == 2 and len(saved["summary_history"]) == 2
    # feedback isn't sent twice
    assert sum(1 for r in client.get("/api/c/requests").json() if r["type"] == "product_feedback" and r["payload"].get("meeting_id") == m["id"]) == 1


def test_a_follow_up_meeting_is_chained_with_the_open_items(client):
    m = past_meeting()
    out = record(client, m, next_meeting={"start": at(days=8), "title": "Private credit walk-through"}).json()
    nxt = next(r for r in out["routed"] if r["kind"] == "follow_up")
    f = client.get(f"/api/c/meetings/{nxt['ref']}").json()
    assert f["previous_meeting_id"] == m["id"] and f["title"] == "Private credit walk-through"
    assert set(f["plan"]["products"]) == {"PD-301", "PD-202"} and "Latest Kotak statement" in f["plan"]["notes"]


def test_a_follow_up_without_a_time_becomes_a_prompt(client):
    m = past_meeting()
    out = record(client, m, next_meeting={"title": "Agree the rebalance"}).json()
    assert any(r["kind"] == "follow_up_prompt" for r in out["routed"])
    assert any("Book the follow-up" in u["title"] for u in client.get("/api/c/updates").json())


def test_mom_draft_is_client_ready(client):
    m = past_meeting()
    record(client, m, next_meeting={"start": at(days=8), "title": "Private credit walk-through"})
    d = client.get(f"/api/meetings/{m['id']}/mom-draft").json()
    text = d["summary"]
    assert "Meridian Private Credit Fund III" in text and "Latest Kotak statement" in text
    assert "fee steep" not in text and "Willingdon" not in text and "Profile is from" not in text  # internal stays internal
    assert any("nominee" in p.lower() for p in d["promises"])
    # sending it uses the existing MoM action and closes the meeting
    r = client.post("/api/actions/log_mom", json={"with_kind": "client", "with_id": m["with"]["id"], "meeting_id": m["id"], "summary": text, "promises": d["promises"]})
    assert r.status_code == 200 and client.get(f"/api/c/meetings/{m['id']}").json()["status"] == "completed"


def test_owed_items_can_be_marked_received(client):
    m = past_meeting()
    record(client, m)
    c = client.get(f"/api/c/clients/{m['with']['id']}").json()
    oid = c["owed"][0]["id"]
    r = client.post("/api/actions/update_owed", json={"kind": "client", "id": c["id"], "owed_id": oid, "status": "received"})
    assert r.status_code == 200
    assert next(o for o in client.get(f"/api/c/clients/{c['id']}").json()["owed"] if o["id"] == oid)["status"] == "received"


# ---------------------------------------------------------------- agent sessions anchored to a meeting
def test_session_anchored_to_a_meeting_is_named_and_reopened(client):
    m = past_meeting()
    body = {"kind": "client", "id": m["with"]["id"], "anchor": {"kind": "meeting", "id": m["id"]}}
    s1 = client.post("/api/agent/sessions", json=body).json()
    assert s1["title"].startswith(f"Summary of {m['title']}") and s1["anchor"] == {"kind": "meeting", "id": m["id"]}
    s2 = client.post("/api/agent/sessions", json=body).json()
    assert s2["id"] == s1["id"]  # the meeting reopens its own session


def test_anchored_session_gives_the_agent_the_meeting(client, script_llm):
    m = past_meeting()
    seen = script_llm([("propose_meeting_summary", {"meeting_id": m["id"], "portfolio": {"discussed": "Rebalance agreed"}, "outcome": "Positive"})], "Ready.")
    sid = client.post("/api/agent/sessions", json={"kind": "client", "id": m["with"]["id"], "anchor": {"kind": "meeting", "id": m["id"]}}).json()["id"]
    s = client.post(f"/api/agent/sessions/{sid}/message", json={"text": "We agreed to rebalance"}).json()
    assert m["id"] in seen[0]["messages"][0]["content"] and m["title"] in seen[0]["messages"][0]["content"]
    card = [c for x in s["messages"] for c in x.get("cards", [])][0]
    assert card["action"] == "record_summary"
    client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"})
    assert S.store().get("meetings", m["id"])["summary"]["outcome"] == "Positive"


def test_client_page_lists_what_the_client_owes(client):
    m = past_meeting()
    record(client, m)
    if m["with"]["kind"] != "client":
        return
    acts = client.get(f"/api/clients/{m['with']['id']}/insights").json()["actionables"]
    owed = [a for a in acts if a["kind"] == "owed"]
    assert {a["title"] for a in owed} == {"Latest Kotak statement", "Signed nominee form"} and all(a["owed_id"] for a in owed)


def test_agreeing_to_meet_again_with_no_details_still_prompts(client):
    m = past_meeting()
    out = record(client, m, next_meeting={}).json()
    assert any(r["kind"] == "follow_up_prompt" for r in out["routed"])
