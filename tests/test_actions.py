import pytest


def outbox(client):
    return client.get("/api/c/outbox").json()


def test_schedule_meeting_creates_everything(client):
    before = len(outbox(client))
    r = client.post("/api/actions/schedule_meeting", json={"with_kind": "client", "with_id": "CL-1001", "title": "Check-in",
                                                            "start": "2030-01-07T11:00", "agenda": ["a", "b"]}).json()
    m = r["meeting"]
    assert m["end"] == "2030-01-07T11:45" and m["status"] == "scheduled"
    assert client.get(f"/api/c/meetings/{m['id']}").status_code == 200
    assert len(outbox(client)) == before + 1
    assert "- a" in r["outbox"]["body"]
    cl = client.get("/api/c/clients/CL-1001").json()
    assert cl["timeline"][0]["title"].startswith("Meeting scheduled")
    assert any(u["link"] == {"kind": "meeting", "id": m["id"]} for u in client.get("/api/c/updates").json())


def test_product_feedback_goes_to_pm(client):
    r = client.post("/api/actions/product_feedback", json={"product_id": "PD-202", "feedback": "Fee too high", "client_id": "CL-1001"}).json()
    req = r["request"]
    assert req["type"] == "product_feedback" and req["team"].startswith("Product")
    assert r["outbox"]["to"]["name"] == "Siddharth Rao"
    assert len(req["sim"]) == 2


def test_whatsapp_blocked_without_consent(client):
    no_wa = next(c for c in client.get("/api/c/clients").json() if not c["consent"]["whatsapp"])
    r = client.post("/api/actions/send_message", json={"to_kind": "client", "to_id": no_wa["id"], "channel": "WhatsApp", "body": "hi"})
    assert r.status_code == 400 and "consented" in r.json()["detail"]


def test_email_message_logs_timeline(client):
    r = client.post("/api/actions/send_message", json={"to_kind": "client", "to_id": "CL-1001", "channel": "Email", "subject": "Hello", "body": "hi"}).json()
    assert r["outbox"]["to"]["address"].endswith(".com") or "@" in r["outbox"]["to"]["address"]
    assert client.get("/api/c/clients/CL-1001").json()["timeline"][0]["kind"] == "comm"


def test_log_mom_attaches_to_meeting_needing_mom(client):
    r = client.post("/api/actions/log_mom", json={"with_kind": "client", "with_id": "CL-1006", "summary": "Discussed education plan",
                                                   "promises": ["Send tax note"]}).json()
    assert r["meeting"]["id"] == "MT-511" and r["meeting"]["status"] == "completed"
    assert r["meeting"]["promises"][-1]["text"] == "Send tax note"
    assert r["request"]["type"] == "mom_ack"


def _yday():
    import datetime as dt

    from backend import store as S
    return (dt.date.fromisoformat(S.now_ist()[:10]) - dt.timedelta(days=1)).isoformat()


def test_reimbursement_and_service_request_and_note(client):
    body = {"client_id": "CL-1001", "category": "Client meeting meals", "amount": 3478, "merchant": "Global Fusion", "bill_date": _yday()}
    assert client.post("/api/actions/reimbursement", json=body).status_code == 400  # no bill above the line
    r = client.post("/api/actions/reimbursement", json=body | {"bill_image": "data:image/jpeg;base64,AAAA"}).json()
    assert r["request"]["team"] == "Accounts" and r["request"]["payload"]["amount"] == 3478
    r = client.post("/api/actions/service_request", json={"client_id": "CL-1001", "title": "Address change", "details": "New address"}).json()
    assert r["request"]["team"] == "Client Experience"
    client.post("/api/actions/add_note", json={"about_kind": "client", "about_id": "CL-1001", "text": "secret"})
    assert client.get("/api/c/clients/CL-1001").json()["timeline"][0]["kind"] == "note"


def test_update_prospect_and_ticket(client):
    r = client.post("/api/actions/update_prospect", json={"prospect_id": "PR-2003", "stage": "KYC in progress"}).json()
    assert r["prospect"]["stage"] == "KYC in progress"
    t = client.post("/api/actions/create_ticket", json={"subject": "SIP failed", "team": "Operations", "priority": "high"}).json()
    assert t["request"]["type"] == "ticket" and t["request"]["priority"] == "high"


def test_unknown_action(client):
    assert client.post("/api/actions/launch_rocket", json={}).status_code == 400


def test_simulated_replies_advance_with_time(client, clock):
    req = client.post("/api/actions/reimbursement", json={"client_id": "CL-1001", "category": "Local travel", "amount": 500,
                                                           "merchant": "Uber", "bill_date": _yday()}).json()["request"]
    assert client.get(f"/api/c/requests/{req['id']}").json()["status"] == "sent"
    clock.advance(minutes=2)
    assert client.get(f"/api/c/requests/{req['id']}").json()["status"] == "in_review"
    clock.advance(minutes=5)
    r = client.get(f"/api/c/requests/{req['id']}").json()
    assert r["status"] == "approved" and r["direction"] == "completed" and len(r["trail"]) == 3


@pytest.mark.parametrize("op", ["nudge", "escalate", "reminders", "close"])
def test_request_ops(client, op):
    r = client.post(f"/api/requests/RQ-3107/{op}", json={}).json()
    if op == "escalate":
        assert r["escalations"] == 1
    if op == "close":
        assert r["direction"] == "completed"


def test_respond_moves_request_back_to_team(client, clock):
    r = client.post("/api/requests/RQ-3108/respond", json={"text": "Mandate signed"}).json()
    assert r["direction"] == "waiting_on_others" and len(r["sim"]) == 1
