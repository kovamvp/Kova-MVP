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
    assert "couldn't reach the language model" in s["messages"][-1]["text"]


def test_bill_reimbursement_attaches_image_on_approve(client):
    sid = new_session(client)
    bill = {"thumb": "data:image/jpeg;base64,AAAA", "fields": {"merchant": "GLOBAL FUSION", "amount": 3478, "bill_date": "2026-10-21", "category": "Client meeting meals"}}
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
