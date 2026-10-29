"""Meetings can be rescheduled, edited, cancelled and marked as no-show, with a change history and the client told."""
import datetime as dt

from backend import store as S


def at(days=3, hh=15, mm=0):
    """A start time on that day at or after hh that leaves 2 hours free around it (sample data has meetings)."""
    from backend.actions import clash_with
    d = dt.datetime.fromisoformat(S.now_ist()) + dt.timedelta(days=days)
    if d.weekday() == 6:
        d += dt.timedelta(days=1)
    for h in list(range(hh, 20)) + list(range(9, hh)):
        t = d.replace(hour=h, minute=mm)
        if not clash_with((t - dt.timedelta(minutes=60)).isoformat(timespec="minutes"), (t + dt.timedelta(minutes=120)).isoformat(timespec="minutes")):
            return t.isoformat(timespec="minutes")
    raise AssertionError("no free slot")


def book(client, start=None, with_id="CL-1001"):
    return client.post("/api/actions/schedule_meeting", json={"with_kind": "client", "with_id": with_id, "title": "Review",
                                                            "start": start or at(), "duration_minutes": 45, "location": "Their office"}).json()["meeting"]


def act(client, name, **args):
    return client.post(f"/api/actions/{name}", json=args)


# ---------------------------------------------------------------- reschedule
def test_reschedule_moves_the_meeting_and_keeps_history(client):
    m = book(client)
    new = at(days=4, hh=11)
    out = act(client, "reschedule_meeting", meeting_id=m["id"], start=new, reason="Client travelling").json()
    r = out["meeting"]
    assert r["start"] == new and r["end"] == (dt.datetime.fromisoformat(new) + dt.timedelta(minutes=45)).isoformat(timespec="minutes")
    ch = r["changes"][-1]
    assert ch["what"] == "rescheduled" and ch["from"]["start"] == m["start"] and ch["to"]["start"] == new
    assert ch["reason"] == "Client travelling" and ch["by"]
    assert out["outbox"]["channel"] == "Calendar invite" and "Updated" in out["outbox"]["subject"]
    assert "Client travelling" not in out["outbox"]["body"]  # internal reason stays internal
    c = client.get("/api/c/clients/CL-1001").json()
    assert c["timeline"][0]["title"].startswith("Meeting moved")


def test_reschedule_can_change_length_and_place(client):
    m = book(client)
    r = act(client, "reschedule_meeting", meeting_id=m["id"], start=at(days=5, hh=10), duration_minutes=90, location="Kova office").json()["meeting"]
    assert r["location"] == "Kova office"
    assert (dt.datetime.fromisoformat(r["end"]) - dt.datetime.fromisoformat(r["start"])).seconds == 90 * 60


def test_reschedule_without_telling_the_client(client):
    m = book(client)
    out = act(client, "reschedule_meeting", meeting_id=m["id"], start=at(days=4, hh=12), notify_client=False).json()
    assert "outbox" not in out


def test_reschedule_refuses_past_time_and_clash(client):
    m = book(client)
    past = (dt.datetime.fromisoformat(S.now_ist()) - dt.timedelta(hours=2)).isoformat(timespec="minutes")
    r = act(client, "reschedule_meeting", meeting_id=m["id"], start=past)
    assert r.status_code == 400 and "past" in r.json()["detail"]
    other = book(client, start=at(days=6, hh=15), with_id="CL-1002")
    r = act(client, "reschedule_meeting", meeting_id=m["id"], start=other["start"])
    assert r.status_code == 400 and "Clashes" in r.json()["detail"]
    # moving within its own slot (e.g. 15 minutes later) doesn't clash with itself
    shifted = (dt.datetime.fromisoformat(m["start"]) + dt.timedelta(minutes=15)).isoformat(timespec="minutes")
    assert act(client, "reschedule_meeting", meeting_id=m["id"], start=shifted).status_code == 200


# ---------------------------------------------------------------- edit
def test_edit_details_without_moving(client):
    m = book(client)
    out = act(client, "edit_meeting", meeting_id=m["id"], agenda=["Fees", "Rebalance"], attendees=[{"name": "Rohan Kapoor", "title": "Branch Head"}]).json()
    r = out["meeting"]
    assert r["start"] == m["start"] and r["agenda"] == ["Fees", "Rebalance"] and r["attendees"][0]["name"] == "Rohan Kapoor"
    assert r["changes"][-1]["what"] == "edited" and "outbox" not in out  # nothing the client needs to know
    out = act(client, "edit_meeting", meeting_id=m["id"], location="Kova office, BKC").json()
    assert out["outbox"]["subject"].startswith("Updated")  # a new place is worth telling them


# ---------------------------------------------------------------- cancel
def test_cancel_needs_a_reason_and_tells_the_client(client):
    m = book(client)
    assert act(client, "cancel_meeting", meeting_id=m["id"]).status_code == 400
    out = act(client, "cancel_meeting", meeting_id=m["id"], reason="Client unwell").json()
    assert out["meeting"]["status"] == "cancelled" and out["meeting"]["changes"][-1]["what"] == "cancelled"
    assert "Cancelled" in out["outbox"]["subject"] and "unwell" not in out["outbox"]["body"]


def test_finished_or_cancelled_meetings_cant_change(client):
    m = book(client)
    act(client, "cancel_meeting", meeting_id=m["id"], reason="x")
    for name, extra in (("reschedule_meeting", {"start": at(days=7)}), ("edit_meeting", {"location": "y"}), ("cancel_meeting", {"reason": "z"})):
        r = act(client, name, meeting_id=m["id"], **extra)
        assert r.status_code == 400 and "cancelled" in r.json()["detail"]
    done = next(x for x in client.get("/api/c/meetings").json() if x["status"] == "completed")
    r = act(client, "reschedule_meeting", meeting_id=done["id"], start=at(days=7))
    assert r.status_code == 400 and "already happened" in r.json()["detail"]


def test_unknown_meeting(client):
    assert act(client, "cancel_meeting", meeting_id="MT-0", reason="x").status_code == 400


# ---------------------------------------------------------------- no-show
def test_no_show_only_after_the_start(client):
    m = book(client)
    r = act(client, "mark_no_show", meeting_id=m["id"])
    assert r.status_code == 400 and "hasn't started" in r.json()["detail"]
    past = next(x for x in client.get("/api/c/meetings").json() if x["status"] == "needs_mom")
    out = act(client, "mark_no_show", meeting_id=past["id"], note="Didn't pick up").json()
    assert out["meeting"]["status"] == "no_show" and "outbox" not in out
    ups = client.get("/api/c/updates").json()
    assert any(u["title"].startswith("Follow up") and u["link"] == past["with"] for u in ups)


def test_no_show_meetings_leave_the_needs_a_mom_list(client):
    past = next(x for x in client.get("/api/c/meetings").json() if x["status"] == "needs_mom")
    act(client, "mark_no_show", meeting_id=past["id"])
    assert client.get(f"/api/c/meetings/{past['id']}").json()["status"] == "no_show"


# ---------------------------------------------------------------- agent
def new_session(client, id_="CL-1001"):
    return client.post("/api/agent/sessions", json={"kind": "client", "id": id_}).json()["id"]


def cards(s):
    return [c for m in s["messages"] for c in m.get("cards", [])]


def test_agent_proposes_a_reschedule_card(client, script_llm):
    m = book(client)
    new = at(days=5, hh=12)
    script_llm([("propose_reschedule_meeting", {"meeting_id": m["id"], "start": new, "reason": "Client asked"})], "Ready.")
    sid = new_session(client)
    card = cards(client.post(f"/api/agent/sessions/{sid}/message", json={"text": "move the review"}).json())[0]
    assert card["action"] == "reschedule_meeting" and "Move" in card["summary"]
    assert S.store().get("meetings", m["id"])["start"] == m["start"]  # nothing moved yet
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"}).json()
    assert cards(s)[0]["result"]["meeting"] == m["id"]
    assert S.store().get("meetings", m["id"])["start"] == new


def test_agent_reschedule_is_validated(client, script_llm):
    m = book(client)
    other = book(client, start=at(days=6, hh=15), with_id="CL-1002")
    seen = script_llm([("propose_reschedule_meeting", {"meeting_id": m["id"], "start": other["start"]})], "ok")
    s = client.post(f"/api/agent/sessions/{new_session(client)}/message", json={"text": "move it"}).json()
    assert cards(s) == [] and "Clashes" in [x for x in seen[1]["messages"] if x["role"] == "tool"][0]["content"]


def test_agent_cant_touch_another_clients_meeting(client, script_llm):
    m = book(client, with_id="CL-1002")
    seen = script_llm([("propose_cancel_meeting", {"meeting_id": m["id"], "reason": "x"})], "ok")
    s = client.post(f"/api/agent/sessions/{new_session(client)}/message", json={"text": "cancel it"}).json()
    assert cards(s) == [] and "isn't with" in [x for x in seen[1]["messages"] if x["role"] == "tool"][0]["content"]


def test_agent_cancel_card(client, script_llm):
    m = book(client)
    script_llm([("propose_cancel_meeting", {"meeting_id": m["id"], "reason": "Client unwell"})], "ok")
    sid = new_session(client)
    card = cards(client.post(f"/api/agent/sessions/{sid}/message", json={"text": "cancel the review"}).json())[0]
    assert card["action"] == "cancel_meeting" and card["summary"].startswith("Cancel")
    client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"})
    assert S.store().get("meetings", m["id"])["status"] == "cancelled"
