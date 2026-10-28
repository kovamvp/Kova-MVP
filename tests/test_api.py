def test_health(client):
    h = client.get("/api/health").json()
    assert h["ok"] and h["store"] == "MemoryStore" and h["tables"] == "kova"


def test_collections_load(client):
    assert len(client.get("/api/c/clients").json()) == 24
    assert len(client.get("/api/c/prospects").json()) == 16
    assert len(client.get("/api/c/products").json()) == 27
    assert client.get("/api/s/rm").json()["name"] == "Priya Sharma"


def test_unknown_collection_and_missing_doc(client):
    assert client.get("/api/c/secrets").status_code == 404
    assert client.get("/api/c/clients/CL-9999").status_code == 404


def test_put_and_singleton_patch(client):
    doc = client.get("/api/c/clients/CL-1001").json()
    doc["notes_summary"] = "updated"
    client.put("/api/c/clients/CL-1001", json=doc)
    assert client.get("/api/c/clients/CL-1001").json()["notes_summary"] == "updated"
    client.patch("/api/s/rm", json={"photo": "data:image/jpeg;base64,AAA"})
    assert client.get("/api/s/rm").json()["photo"].startswith("data:image")


def test_layout_round_trip(client):
    assert client.get("/api/c/layouts/RM-0042").status_code == 404
    client.put("/api/c/layouts/RM-0042", json={"items": [{"i": "w1", "type": "book", "x": 0, "y": 0, "w": 4, "h": 4}]})
    assert client.get("/api/c/layouts/RM-0042").json()["items"][0]["type"] == "book"


def test_search(client):
    res = client.get("/api/search?q=mehta").json()
    kinds = {r["kind"] for r in res}
    assert {"client", "meeting"} <= kinds
    assert client.get("/api/search?q=").json() == []


def test_updates_done_and_snooze(client):
    assert client.post("/api/updates/UP-01/done").json()["done"] is True
    assert client.post("/api/updates/UP-01/done").json()["done"] is False
    assert client.post("/api/updates/UP-02/snooze", json={"until": "2030-01-01T09:30"}).json()["snoozed_until"] == "2030-01-01T09:30"


def test_learning_toggle(client):
    r = client.post("/api/ld/PD-104/toggle", json={"module_id": "m1"}).json()
    assert r["completed"] == ["m1"]
    r = client.post("/api/ld/PD-104/toggle", json={"module_id": "m1"}).json()
    assert r["completed"] == []


def test_goals_rules(client):
    g = client.get("/api/s/growth").json()
    assert len(g["goals"]) == 5
    assert client.post("/api/growth/goals", json={"op": "add", "text": "sixth"}).status_code == 400
    mgr = next(x for x in g["goals"] if x["by"] == "manager")
    assert client.post("/api/growth/goals", json={"op": "remove", "id": mgr["id"]}).status_code == 400
    mine = next(x for x in g["goals"] if x["by"] == "self")
    g2 = client.post("/api/growth/goals", json={"op": "achieve", "id": mine["id"]}).json()
    assert len(g2["goals"]) == 4 and g2["achieved_goals"][0]["id"] == mine["id"]
    g3 = client.post("/api/growth/goals", json={"op": "add", "text": "New goal"}).json()
    assert g3["goals"][-1]["text"] == "New goal"
    g4 = client.post("/api/growth/goals", json={"op": "edit", "id": g3["goals"][-1]["id"], "text": "Edited"}).json()
    assert g4["goals"][-1]["text"] == "Edited"


def test_prospect_create_close_reopen_stage(client):
    p = client.post("/api/prospects", json={"name": "Test Person", "need": "Parking money", "estimated_investable": 5000000}).json()
    assert p["stage"] == "Lead" and len(p["kyc_steps"]) == 9
    c = client.post(f"/api/prospects/{p['id']}/close", json={"reason": "Fees"}).json()
    assert c["stage"] == "Closed" and c["closed"]["previous_stage"] == "Lead"
    r = client.post(f"/api/prospects/{p['id']}/reopen").json()
    assert r["stage"] == "Lead" and r["closed"] is None
    s = client.post(f"/api/prospects/{p['id']}/stage", json={"stage": "Prospect"}).json()
    assert s["stage"] == "Prospect"


def test_outbox_edit_keeps_original_and_review(client):
    o = client.patch("/api/outbox/OB-9001", json={"body": "new body"}).json()
    assert o["edited"] and o["original"]["body"].startswith("Hi Rajesh")
    o = client.patch("/api/outbox/OB-9001", json={"review": "fix", "review_note": "tone"}).json()
    assert o["review"] == "fix" and o["review_note"] == "tone"
