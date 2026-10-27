def test_create_without_tag_is_practice_and_tagging_makes_draft(client):
    pf = client.post("/api/portfolios", json={"name": "P", "amount": 1000000}).json()
    assert pf["status"] == "practice" and pf["id"].startswith("PF-")
    pf = client.put(f"/api/portfolios/{pf['id']}", json={"tag": {"kind": "client", "id": "CL-1001"}}).json()
    assert pf["status"] == "draft"
    pf = client.put(f"/api/portfolios/{pf['id']}", json={"tag": None}).json()
    assert pf["status"] == "practice"


def test_submit_requires_tag(client):
    pf = client.post("/api/portfolios", json={"name": "P", "amount": 1000000}).json()
    assert client.post(f"/api/portfolios/{pf['id']}/submit", json={"flags": []}).status_code == 400


def _submit(client, flags):
    pf = client.post("/api/portfolios", json={"name": "P", "amount": 1000000, "tag": {"kind": "client", "id": "CL-1001"},
                                              "lines": [{"product_id": "PD-101", "amount": 1000000}]}).json()
    r = client.post(f"/api/portfolios/{pf['id']}/submit", json={"flags": flags}).json()
    return pf["id"], r["request"]["id"]


def test_clean_portfolio_gets_approved(client, clock):
    pid, rid = _submit(client, [])
    assert client.get(f"/api/c/portfolios/{pid}").json()["status"] == "awaiting_approval"
    clock.advance(minutes=6)
    assert client.get(f"/api/c/requests/{rid}").json()["status"] == "approved"
    assert client.get(f"/api/c/portfolios/{pid}").json()["status"] == "approved"


def test_high_flag_gets_changes_requested_and_editing_returns_to_draft(client, clock):
    pid, rid = _submit(client, [{"severity": "high", "text": "Equity too high"}])
    clock.advance(minutes=6)
    client.get(f"/api/c/requests/{rid}")
    assert client.get(f"/api/c/portfolios/{pid}").json()["status"] == "changes_requested"
    pf = client.put(f"/api/portfolios/{pid}", json={"lines": []}).json()
    assert pf["status"] == "draft"


def test_resubmit_supersedes_open_request(client):
    pid, rid = _submit(client, [])
    client.put(f"/api/portfolios/{pid}", json={"note": "x"})
    client.post(f"/api/portfolios/{pid}/submit", json={"flags": []})
    assert client.get(f"/api/c/requests/{rid}").json()["status"] == "superseded"
