"""Sprint 4: prospects — structured needs, consent at capture, unverified contact details,
duplicates across RMs, and WhatsApp only with consent."""
from backend import prospects
from backend import store as S

NEW = {"name": "Kiran Rao", "phone": "+91 98200 11223", "email": "kiran.rao@example.com", "source": "Referral",
       "needs": {"goal": "Regular income", "horizon": "3–5 years", "asset_classes": ["Debt"]}, "need": "Retiring; wants monthly income",
       "consent": {"whatsapp": True, "email": True, "marketing": False}, "estimated_investable": 8000000}


def make(client, **over):
    return client.post("/api/prospects", json={**NEW, **over})


# ---------------------------------------------------------------- capture
def test_structured_needs_and_consent_are_kept(client):
    p = make(client).json()
    assert p["needs"] == {"goal": "Regular income", "horizon": "3–5 years", "asset_classes": ["Debt"]}
    assert p["consent"]["whatsapp"] is True and p["consent"]["marketing"] is False and p["consent"]["captured_on"]
    assert p["contact_verified"] == {"mobile": False, "email": False}


def test_mobile_or_email_is_needed(client):
    r = make(client, phone="", email="")
    assert r.status_code == 400 and "mobile or email" in r.json()["detail"]
    assert make(client, phone="", email="only.email@example.com").status_code == 200


def test_needs_are_checked(client):
    assert make(client, needs={"goal": "Get rich quick"}).status_code == 400
    assert make(client, needs={"goal": "Grow wealth", "asset_classes": ["Crypto"]}).status_code == 400


def test_sample_prospects_have_needs_consent_and_verification(client):
    for p in client.get("/api/c/prospects").json():
        assert p["needs"]["goal"] in prospects.GOALS, p["id"]
        assert set(p["consent"]) >= {"whatsapp", "email", "marketing", "captured_on"}
        verified = next(s["done"] for s in p["kyc_steps"] if s["step"] == "Mobile and email verified")
        assert p["contact_verified"] == {"mobile": verified, "email": verified}


def test_verifying_contact_details_follows_the_readiness_step(client):
    p = make(client).json()
    client.post(f"/api/prospects/{p['id']}/kyc_step", json={"step": "Mobile and email verified", "done": True})
    assert client.get(f"/api/c/prospects/{p['id']}").json()["contact_verified"] == {"mobile": True, "email": True}


# ---------------------------------------------------------------- duplicates
def test_your_own_client_or_prospect_is_not_added_twice(client):
    c = S.store().get("clients", "CL-1001")
    r = make(client, phone=c["phone"], email="")
    assert r.status_code == 409 and "already your client" in r.json()["detail"] and "CL-1001" in r.json()["detail"]
    p = S.store().get("prospects", "PR-2001")
    r = make(client, phone="", email=p["email"].upper())  # emails match regardless of case
    assert r.status_code == 409 and "PR-2001" in r.json()["detail"]


def test_someone_with_another_rm_goes_to_the_branch_head(client):
    other = prospects.DIRECTORY[0]
    r = make(client, phone=other["phone"].replace(" ", ""), email="")
    assert r.status_code == 200
    p = r.json()
    assert p["ownership"]["status"] == "pending" and p["ownership"]["with_rm"] == other["rm"] and p["ownership"]["matched_on"] == "mobile"
    req = next(x for x in client.get("/api/c/requests").json() if x["id"] == p["ownership"]["request_id"])
    assert "Branch head" in req["team"] and p["name"] in req["title"]


def test_check_endpoint_warns_while_typing(client):
    c = S.store().get("clients", "CL-1002")
    hits = client.post("/api/prospects/check", json={"phone": c["phone"]}).json()["matches"]
    assert hits[0]["kind"] == "client" and hits[0]["id"] == "CL-1002" and hits[0]["matched_on"] == "mobile"
    assert client.post("/api/prospects/check", json={"phone": "+91 90000 00000"}).json()["matches"] == []
    other = prospects.DIRECTORY[1]
    hits = client.post("/api/prospects/check", json={"email": other["email"]}).json()["matches"]
    assert hits[0]["kind"] == "other_rm" and hits[0]["rm"] == other["rm"] and "name" not in hits[0]  # another RM's prospect stays private


# ---------------------------------------------------------------- editing needs and consent
def test_update_prospect_changes_needs_and_consent(client):
    r = client.post("/api/actions/update_prospect", json={"prospect_id": "PR-2004", "needs": {"goal": "Grow wealth", "horizon": "5+ years", "asset_classes": ["Equity"]},
                                                           "consent": {"whatsapp": True}})
    assert r.status_code == 200
    p = client.get("/api/c/prospects/PR-2004").json()
    assert p["needs"]["goal"] == "Grow wealth" and p["consent"]["whatsapp"] is True
    assert any("needs" in e["body"].lower() or "consent" in e["body"].lower() for e in p["timeline"][:2])


# ---------------------------------------------------------------- consent is enforced
def no_whatsapp_prospect():
    return next(p for p in S.store().list("prospects") if not p["consent"]["whatsapp"] and p["stage"] != "Closed")


def test_no_whatsapp_to_a_prospect_without_consent(client):
    p = no_whatsapp_prospect()
    r = client.post("/api/actions/send_message", json={"to_kind": "prospect", "to_id": p["id"], "channel": "WhatsApp", "body": "Hi"})
    assert r.status_code == 400 and "consent" in r.json()["detail"]
    assert client.post("/api/actions/send_message", json={"to_kind": "prospect", "to_id": p["id"], "channel": "Email", "subject": "Hello", "body": "Hi"}).status_code == 200


def test_agent_is_told_to_use_email_for_a_prospect_without_whatsapp_consent(client, script_llm):
    p = no_whatsapp_prospect()
    seen = script_llm([("propose_send_message", {"to_kind": "prospect", "to_id": p["id"], "channel": "WhatsApp", "body": "Hi"})], "ok")
    sid = client.post("/api/agent/sessions", json={"kind": "prospect", "id": p["id"]}).json()["id"]
    s = client.post(f"/api/agent/sessions/{sid}/message", json={"text": "whatsapp them"}).json()
    assert [c for m in s["messages"] for c in m.get("cards", [])] == []
    assert "consented to WhatsApp" in [x for x in seen[1]["messages"] if x["role"] == "tool"][0]["content"]


def test_agent_brief_has_needs_and_consent():
    from backend.agent import prospect_brief
    b = prospect_brief(S.store().get("prospects", "PR-2001"))
    assert b["needs"]["goal"] and "whatsapp" in b["consent"]
