import datetime as dt

from backend import store as S


def new_session(client, kind="client", id_="CL-1001"):
    return client.post("/api/agent/sessions", json={"kind": kind, "id": id_}).json()["id"]


def send(client, sid, text, **extra):
    return client.post(f"/api/agent/sessions/{sid}/message", json={"text": text, **extra}).json()


def cards(session):
    return [c for m in session["messages"] for c in m.get("cards", [])]


def future(days=3, hh=15):
    d = dt.datetime.fromisoformat(S.now_ist()) + dt.timedelta(days=days)
    if d.weekday() == 6:
        d += dt.timedelta(days=1)
    return d.replace(hour=hh, minute=0).isoformat(timespec="minutes")


def test_session_lifecycle(client):
    sid = new_session(client)
    assert client.get("/api/agent/sessions?kind=client&id=CL-1001").json()[0]["id"] == sid
    client.post(f"/api/agent/sessions/{sid}/archive")
    assert client.get("/api/agent/sessions?kind=client&id=CL-1001").json() == []
    assert client.get("/api/agent/sessions?kind=client&id=CL-1001&archived=true").json()[0]["id"] == sid


def test_empty_message_rejected(client):
    sid = new_session(client)
    assert client.post(f"/api/agent/sessions/{sid}/message", json={"text": " "}).status_code == 400


def test_fake_agent_full_loop_schedule_approve_lands_in_outbox(client):
    sid = new_session(client)
    s = send(client, sid, "Schedule a follow-up with him")
    [card] = cards(s)
    assert card["action"] == "schedule_meeting" and card["status"] == "pending"
    before = len(client.get("/api/c/outbox").json())
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"}).json()
    card = cards(s)[0]
    assert card["status"] == "approved" and card["result"]["meeting"].startswith("MT-")
    ob = client.get("/api/c/outbox").json()
    assert len(ob) == before + 1
    new = next(o for o in ob if o["id"] == card["result"]["outbox"])
    assert new["source"]["card_id"] == card["id"] and new["source"]["said"] == "Schedule a follow-up with him"
    assert s["messages"][-1]["role"] == "event"


def test_card_cannot_be_decided_twice_and_reject(client):
    sid = new_session(client)
    card = cards(send(client, sid, "schedule a meeting"))[0]
    client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "reject", "reason": "wrong day"})
    r = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"})
    assert r.status_code == 400


def test_approve_with_edits_is_recorded(client):
    sid = new_session(client)
    card = cards(send(client, sid, "schedule a meeting"))[0]
    args = {**card["args"], "title": "Edited title"}
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve", "args": args}).json()
    c = cards(s)[0]
    assert c["edited"] is True and c["args"]["title"] == "Edited title"


def test_validation_past_time(client, script_llm):
    seen = script_llm([("propose_schedule_meeting", {"with_kind": "client", "with_id": "CL-1001", "title": "x", "start": "2020-01-01T10:00"})], "ok")
    s = send(client, new_session(client), "book it")
    assert cards(s) == []
    tool_msg = [m for m in seen[1]["messages"] if m["role"] == "tool"][0]
    assert "past" in tool_msg["content"]


def test_validation_weekday_mismatch(client, script_llm):
    start = future(days=8)
    wrong = (["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][(dt.datetime.fromisoformat(start).weekday() + 1) % 7])
    seen = script_llm([("propose_schedule_meeting", {"with_kind": "client", "with_id": "CL-1001", "title": "x", "start": start})], "ok")
    send(client, new_session(client), f"meet him next {wrong} at 3")
    tool_msg = [m for m in seen[1]["messages"] if m["role"] == "tool"][0]
    assert wrong.capitalize() in tool_msg["content"]


def test_validation_clash(client, script_llm):
    m = client.post("/api/actions/schedule_meeting", json={"with_kind": "client", "with_id": "CL-1002", "title": "busy", "start": future(4, 15)}).json()["meeting"]
    seen = script_llm([("propose_schedule_meeting", {"with_kind": "client", "with_id": "CL-1001", "title": "x", "start": m["start"]})], "ok")
    send(client, new_session(client), "book it")
    assert "Clashes" in [x for x in seen[1]["messages"] if x["role"] == "tool"][0]["content"]


def test_validation_whatsapp_consent(client, script_llm):
    no_wa = next(c for c in client.get("/api/c/clients").json() if not c["consent"]["whatsapp"])
    seen = script_llm([("propose_send_message", {"to_kind": "client", "to_id": no_wa["id"], "channel": "WhatsApp", "body": "hi"})], "ok")
    s = send(client, new_session(client, id_=no_wa["id"]), "whatsapp him")
    assert cards(s) == []
    assert "not consented" in [x for x in seen[1]["messages"] if x["role"] == "tool"][0]["content"]


def test_tools_are_page_specific(client, script_llm):
    seen = script_llm([("propose_reimbursement", {"client_id": "CL-1001", "category": "Local travel", "amount": 100, "merchant": "x", "bill_date": "2026-10-01"})], "ok")
    s = send(client, new_session(client, "product", "PD-101"), "claim")
    assert cards(s) == []
    assert "isn't available" in [x for x in seen[1]["messages"] if x["role"] == "tool"][0]["content"]
    assert "propose_reimbursement" not in {t["function"]["name"] for t in seen[0]["tools"]}


def test_read_tools_run_and_are_reported(client, script_llm):
    script_llm([("get_holdings", {"client_id": "CL-1001"})], "Here are the holdings.")
    s = send(client, new_session(client), "what does he hold")
    assert s["messages"][-1]["reads"] == ["get_holdings"]


def test_model_failure_is_friendly(client, monkeypatch):
    from backend import agent, llm

    def boom(*a, **k):
        raise llm.LLMError("rate limited")
    monkeypatch.setattr(agent.llm, "chat", boom)
    s = send(client, new_session(client), "hello")
    last = s["messages"][-1]
    assert "couldn't reach the language model" in last["text"]
    assert last["error"] is True
    assert "rate limited" not in last["text"]  # server details stay in the logs


def test_bill_reimbursement_attaches_image_on_approve(client):
    sid = new_session(client)
    bill = {"thumb": "data:image/jpeg;base64,AAAA", "fields": {"merchant": "GLOBAL FUSION", "amount": 3478, "bill_date": yday(), "category": "Client meeting meals"}}
    s = send(client, sid, "claim this lunch", bill=bill)
    card = cards(s)[0]
    assert card["action"] == "reimbursement" and card["args"]["amount"] == 3478
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"}).json()
    req = client.get(f"/api/c/requests/{cards(s)[0]['result']['request']}").json()
    assert req["payload"]["bill_image"].startswith("data:image")


def test_read_bill_and_transcribe_with_fake_models(client):
    r = client.post("/api/agent/read-bill", json={"image": "data:image/png;base64,AAAA"}).json()
    assert r["fields"]["amount"] == 3478.0
    assert client.post("/api/agent/read-bill", json={"image": "nope"}).status_code == 400
    r = client.post("/api/agent/transcribe", files={"audio": ("a.webm", b"\x00" * 3000, "audio/webm")}).json()
    assert r["text"] == "fake transcript"


def test_system_prompt_has_dates_and_scope(client, script_llm):
    seen = script_llm("hi")
    send(client, new_session(client), "hello")
    sysmsg = seen[0]["messages"][0]["content"]
    assert "Dates ahead:" in sysmsg and '"id": "CL-1001"' in sysmsg and "Holdings" in sysmsg


# ---------------------------------------------------------------- reimbursement cards carry their own bill
def yday():
    return (dt.date.fromisoformat(S.now_ist()[:10]) - dt.timedelta(days=1)).isoformat()


def test_bill_goes_to_the_card_with_the_matching_amount(client, script_llm):
    script_llm([("propose_reimbursement", {"client_id": "CL-1004", "category": "Local travel", "amount": 631, "merchant": "Uber", "bill_date": yday()}),
                ("propose_reimbursement", {"client_id": "CL-1004", "category": "Client meeting meals", "amount": 2400, "merchant": "Trishna", "bill_date": yday()})],
               "Two claims ready.")
    sid = new_session(client, id_="CL-1004")
    bill = {"thumb": "data:image/jpeg;base64,LUNCH", "fields": {"merchant": "Trishna", "amount": 2400, "bill_date": yday()}}
    s = send(client, sid, "cab 631 and lunch 2400", bill=bill)
    cab, lunch = cards(s)
    assert lunch["bill"]["thumb"].endswith("LUNCH")
    assert cab["bill"] is None
    # each card carries its own checks: the lunch is ready, the cab (above the ₹500 line) still needs its own receipt
    assert all(c["ok"] for c in lunch["checks"]) and lunch["blocking"] is False
    assert next(c for c in cab["checks"] if c["id"] == "bill")["ok"] is False and cab["blocking"] is True


def test_card_without_bill_asks_for_one_then_approves(client, script_llm):
    script_llm([("propose_reimbursement", {"client_id": "CL-1004", "category": "Client meeting meals", "amount": 2400, "merchant": "Trishna", "bill_date": yday()})], "Ready.")
    sid = new_session(client, id_="CL-1004")
    card = cards(send(client, sid, "lunch was 2400"))[0]
    assert card["blocking"] is True and next(c for c in card["checks"] if c["id"] == "bill")["ok"] is False
    r = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"})
    assert r.status_code == 400 and "bill" in r.json()["detail"].lower()
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}/bill", json={"thumb": "data:image/jpeg;base64,LATE", "fields": {"amount": 2400}}).json()
    card = cards(s)[0]
    assert card["bill"]["thumb"].endswith("LATE") and card["blocking"] is False
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve"}).json()
    req = client.get(f"/api/c/requests/{cards(s)[0]['result']['request']}").json()
    assert req["payload"]["bill_image"].endswith("LATE")


def test_bill_cannot_be_added_to_decided_or_other_cards(client, script_llm):
    script_llm([("propose_add_note", {"about_kind": "client", "about_id": "CL-1001", "text": "x"})], "ok")
    sid = new_session(client)
    card = cards(send(client, sid, "note it"))[0]
    r = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}/bill", json={"thumb": "data:image/jpeg;base64,X"})
    assert r.status_code == 400


def test_decision_events_are_structured(client, script_llm):
    script_llm([("propose_add_note", {"about_kind": "client", "about_id": "CL-1001", "text": "x"})], "ok")
    sid = new_session(client)
    card = cards(send(client, sid, "note it"))[0]
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "reject", "reason": "not needed"}).json()
    ev = s["messages"][-1]
    assert ev["role"] == "event" and ev["decision"] == {"decision": "reject", "card_id": card["id"], "summary": card["summary"], "edited": False, "reason": "not needed"}
    assert ev["text"].startswith("RM rejected card")  # the model still reads the sentence


def test_validation_blocks_duplicate_reimbursement(client, script_llm):
    client.post("/api/actions/reimbursement", json={"client_id": "CL-1004", "category": "Local travel", "amount": 631, "merchant": "Uber",
                                                    "bill_date": yday(), "bill_image": "data:image/jpeg;base64,A"})
    seen = script_llm([("propose_reimbursement", {"client_id": "CL-1004", "category": "Local travel", "amount": 631, "merchant": "Uber", "bill_date": yday()})], "ok")
    s = send(client, new_session(client, id_="CL-1004"), "claim the cab")
    assert cards(s) == []
    assert "already claimed" in [x for x in seen[1]["messages"] if x["role"] == "tool"][0]["content"]


def test_older_cards_get_a_bill_slot_when_opened(client):
    """Cards made before per-card bills (like CD-7006 on the live site) show checks and take a bill."""
    sid = new_session(client, id_="CL-1004")
    s = S.store().get("agent_sessions", sid)
    old = {"id": "CD-6001", "action": "reimbursement", "status": "pending", "summary": "Claim lunch", "at": S.now_ist(),
           "args": {"gst": "NA", "amount": 2400, "category": "Client meeting meals", "merchant": "Restaurant", "bill_date": yday(), "client_id": "CL-1004"}}
    with_bill = dict(old, id="CD-6002", args=dict(old["args"], merchant="Cafe"))
    s["messages"] = [
        {"id": "m1", "role": "rm", "text": "lunch 2400", "at": S.now_ist()},
        {"id": "m2", "role": "agent", "text": "ok", "at": S.now_ist(), "cards": [old]},
        {"id": "m3", "role": "rm", "text": "and this one", "at": S.now_ist(), "bill": {"thumb": "data:image/jpeg;base64,OLD", "fields": {}}},
        {"id": "m4", "role": "agent", "text": "ok", "at": S.now_ist(), "cards": [with_bill]},
    ]
    S.store().put("agent_sessions", sid, s)
    s = client.get(f"/api/agent/sessions/{sid}").json()
    a, b = cards(s)
    assert a["bill"] is None and a["blocking"] is True
    assert b["bill"]["thumb"].endswith("OLD") and b["blocking"] is False
    assert client.post(f"/api/agent/sessions/{sid}/cards/CD-6001", json={"decision": "approve"}).status_code == 400
    s = client.post(f"/api/agent/sessions/{sid}/cards/CD-6002", json={"decision": "approve"}).json()
    req = client.get(f"/api/c/requests/{cards(s)[1]['result']['request']}").json()
    assert req["payload"]["bill_image"].endswith("OLD")


def test_card_flags_a_bill_that_shows_a_different_amount(client, script_llm):
    script_llm([("propose_reimbursement", {"client_id": "CL-1004", "category": "Client meeting meals", "amount": 2400, "merchant": "Trishna", "bill_date": yday()})], "Ready.")
    sid = new_session(client, id_="CL-1004")
    card = cards(send(client, sid, "lunch was 2400"))[0]
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}/bill", json={"thumb": "data:image/jpeg;base64,X", "fields": {"amount": 3478}}).json()
    flag = next(c for c in cards(s)[0]["checks"] if c["id"] == "bill_amount")
    assert flag["ok"] is False and cards(s)[0]["blocking"] is False
