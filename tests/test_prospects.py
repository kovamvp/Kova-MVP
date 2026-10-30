"""Prospect stages are gated by what's actually done, and a prospect becomes a client only when the RM confirms."""
from backend import store as S

CONSENT = {"whatsapp": True, "email": True, "profile_enrichment": False, "marketing": False, "data_sharing_with_partners": False}


def gates(client, pid):
    return {g["stage"]: g for g in client.get(f"/api/prospects/{pid}/gates").json()["stages"]}


def mark(client, pid, step, **extra):
    return client.post(f"/api/prospects/{pid}/kyc_step", json={"step": step, "done": True, **extra})


# ---------------------------------------------------------------- gates
def test_gates_list_what_is_missing(client):
    g = gates(client, "PR-2002")  # KYC in progress: mobile/email and bank done
    assert g["Registered"]["ok"] and g["KYC in progress"]["ok"]
    assert not g["Investing client"]["ok"]
    assert set(g["Investing client"]["missing"]) == {"PAN and KYC (KRA)", "FATCA declaration", "Nominee", "Risk profile"}
    assert "DDPI" in g["Investing and trading client"]["missing"]


def test_forward_move_is_refused_until_the_steps_are_done(client):
    r = client.post("/api/prospects/PR-2003/stage", json={"stage": "Investing client"})
    assert r.status_code == 400 and "PAN and KYC" in r.json()["detail"]
    assert client.get("/api/c/prospects/PR-2003").json()["stage"] == "Registered"


def test_backward_move_is_always_allowed_and_logged(client):
    p = client.post("/api/prospects/PR-2002/stage", json={"stage": "Prospect"}).json()
    assert p["stage"] == "Prospect"
    assert "KYC in progress → Prospect" in p["timeline"][0]["body"]


def test_lead_needs_need_and_amount_to_qualify(client):
    # a mobile or email is required at capture since Sprint 4, so the gate checks need and amount
    p = client.post("/api/prospects", json={"name": "Test Lead", "email": "test.lead@example.com", "estimated_investable": 0}).json()
    r = client.post(f"/api/prospects/{p['id']}/stage", json={"stage": "Prospect"})
    assert r.status_code == 400
    missing = gates(client, p["id"])["Prospect"]["missing"]
    assert {"What they need", "Investable amount"} <= set(missing) and "Phone or email" not in missing


def test_marking_steps_opens_the_gate(client):
    for step in ("PAN and KYC (KRA)", "FATCA declaration", "Nominee"):
        assert mark(client, "PR-2002", step).status_code == 200
    assert mark(client, "PR-2002", "Risk profile").status_code == 400  # needs the result
    p = mark(client, "PR-2002", "Risk profile", risk_profile="Moderate").json()
    assert p["risk_profile"] == "Moderate"
    assert p["timeline"][0]["title"].startswith("Readiness")
    assert gates(client, "PR-2002")["Investing client"]["ok"]
    assert client.post("/api/prospects/PR-2002/stage", json={"stage": "Investing client"}).json()["stage"] == "Investing client"


def test_unknown_step_is_refused(client):
    assert client.post("/api/prospects/PR-2002/kyc_step", json={"step": "Moon landing", "done": True}).status_code == 400


def test_update_prospect_action_respects_gates(client):
    r = client.post("/api/actions/update_prospect", json={"prospect_id": "PR-2003", "stage": "Investing client"})
    assert r.status_code == 400
    r = client.post("/api/actions/update_prospect", json={"prospect_id": "PR-2003", "next_step": "Collect PAN"})
    assert r.status_code == 200


# ---------------------------------------------------------------- becoming a client
def test_only_investing_prospects_can_become_clients(client):
    r = client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2003", "consent": CONSENT})
    assert r.status_code == 400 and "Investing client" in r.json()["detail"]


def test_convert_creates_client_family_and_welcome(client):
    before = len(client.get("/api/c/clients").json())
    out = client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2006", "consent": CONSENT}).json()
    c = out["client"]
    assert c["id"].startswith("CL-") and c["converted_from"] == "PR-2006"
    assert c["segment"] == "engaged" and c["holdings"] == [] and c["aum"] == 0
    assert c["consent"]["whatsapp"] is True and c["consent"]["marketing"] is False and c["consent"]["captured_on"]
    assert c["risk_profile"] in ("Conservative", "Moderately conservative", "Moderate", "Moderately aggressive", "Aggressive")
    assert c["accounts"]["investing"] is True and c["accounts"]["demat"] is False  # PR-2006 has no demat yet
    assert any("Became a client" in e["title"] for e in c["timeline"])
    assert len(client.get("/api/c/clients").json()) == before + 1
    fam = client.get(f"/api/c/families/{c['family_id']}").json()
    assert fam["head"] == c["id"] and fam["members"] == [c["id"]]
    p = client.get("/api/c/prospects/PR-2006").json()
    assert p["converted"]["client_id"] == c["id"]
    assert out["outbox"]["channel"] == "Email" and "Welcome" in out["outbox"]["subject"]


def test_convert_twice_is_refused(client):
    client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2011", "consent": CONSENT})
    r = client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2011", "consent": CONSENT})
    assert r.status_code == 400 and "already" in r.json()["detail"]


def test_converted_prospect_cannot_be_reopened_or_moved(client):
    client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2011", "consent": CONSENT})
    assert client.post("/api/prospects/PR-2011/stage", json={"stage": "Lead"}).status_code == 400
    assert client.post("/api/prospects/PR-2011/reopen", json={}).status_code == 400


def test_consent_must_be_given_explicitly(client):
    r = client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2006"})
    assert r.status_code == 400 and "consent" in r.json()["detail"].lower()


def test_converted_client_is_searchable(client):
    c = client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2006", "consent": CONSENT}).json()["client"]
    hits = client.get(f"/api/search?q={c['first_name']}").json()
    assert any(h.get("id") == c["id"] for h in hits)


# ---------------------------------------------------------------- the agent
def new_session(client, pid):
    return client.post("/api/agent/sessions", json={"kind": "prospect", "id": pid}).json()["id"]


def cards(s):
    return [c for m in s["messages"] for c in m.get("cards", [])]


def test_agent_stage_move_is_checked_against_gates(client, script_llm):
    seen = script_llm([("propose_update_prospect", {"prospect_id": "PR-2003", "stage": "Investing client"})], "ok")
    s = client.post(f"/api/agent/sessions/{new_session(client, 'PR-2003')}/message", json={"text": "move her to investing"}).json()
    assert cards(s) == []
    tool = [m for m in seen[1]["messages"] if m["role"] == "tool"][0]["content"]
    assert "PAN and KYC" in tool


def test_agent_proposes_conversion_and_rm_confirms(client, script_llm):
    script_llm([("propose_convert_prospect", {"prospect_id": "PR-2006"})], "Ready for your confirmation.")
    sid = new_session(client, "PR-2006")
    card = cards(client.post(f"/api/agent/sessions/{sid}/message", json={"text": "make him a client"}).json())[0]
    assert card["action"] == "convert_prospect"
    assert card["args"]["consent"] == {"whatsapp": False, "email": False, "profile_enrichment": False, "marketing": False, "data_sharing_with_partners": False}
    assert S.store().get("prospects", "PR-2006").get("converted") is None  # nothing happens before approval
    args = dict(card["args"], consent=CONSENT)
    s = client.post(f"/api/agent/sessions/{sid}/cards/{card['id']}", json={"decision": "approve", "args": args}).json()
    assert cards(s)[0]["result"]["client"].startswith("CL-")
