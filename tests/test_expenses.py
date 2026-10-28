"""Reimbursements: the bill, the policy checks and the manager's monthly cap."""
import datetime as dt

from backend import store as S

BILL = "data:image/jpeg;base64,AAAA"


def day(n: int = -1) -> str:
    return (dt.date.fromisoformat(S.now_ist()[:10]) + dt.timedelta(days=n)).isoformat()


def claim(client, **kw):
    body = {"client_id": "CL-1001", "category": "Client meeting meals", "amount": 2400, "merchant": "Trishna",
            "bill_date": day(-1), "bill_image": BILL, "purpose": "Lunch after the review"} | kw
    return client.post("/api/actions/reimbursement", json=body)


def checks_of(client, **kw):
    body = {"client_id": "CL-1001", "category": "Client meeting meals", "amount": 2400, "merchant": "Trishna",
            "bill_date": day(-1), "has_bill": True} | kw
    r = client.post("/api/expenses/check", json=body).json()
    return {c["id"]: c for c in r["checks"]}, r


# ---------------------------------------------------------------- policy
def test_default_policy_has_ten_thousand_monthly_cap(client):
    p = client.get("/api/expenses/policy").json()
    assert p["monthly_cap"] == 10000
    assert p["bill_required_above"] == 500
    assert p["category_limits"]["Client meeting meals"] > 0
    assert p["set_by"]


def test_manager_can_change_the_cap_and_it_is_logged(client):
    p = client.put("/api/expenses/policy", json={"monthly_cap": 15000, "by": "Rohan Kapoor"}).json()
    assert p["monthly_cap"] == 15000
    assert p["history"][-1]["by"] == "Rohan Kapoor" and "15,000" in p["history"][-1]["text"]
    assert client.get("/api/expenses/policy").json()["monthly_cap"] == 15000


def test_policy_rejects_nonsense(client):
    assert client.put("/api/expenses/policy", json={"monthly_cap": -5}).status_code == 400
    assert client.put("/api/expenses/policy", json={"bill_required_above": "lots"}).status_code == 400


# ---------------------------------------------------------------- checks
def test_all_green_claim(client):
    cs, r = checks_of(client)
    assert all(c["ok"] for c in cs.values()), cs
    assert r["blocking"] is False and r["needs_manager"] is False
    assert r["monthly_cap"] == 10000 and r["month_total"] >= 0


def test_bill_required_above_threshold(client):
    cs, r = checks_of(client, has_bill=False)
    assert cs["bill"]["ok"] is False and cs["bill"]["level"] == "block" and r["blocking"]
    cs, r = checks_of(client, has_bill=False, amount=400, category="Local travel")
    assert cs["bill"]["ok"] is True  # small local rides don't need a bill


def test_claim_without_bill_is_refused(client):
    r = claim(client, bill_image=None)
    assert r.status_code == 400 and "bill" in r.json()["detail"].lower()


def test_future_and_stale_dates_block(client):
    cs, _ = checks_of(client, bill_date=day(2))
    assert cs["date"]["ok"] is False and cs["date"]["level"] == "block"
    cs, _ = checks_of(client, bill_date=day(-75))
    assert cs["date"]["ok"] is False


def test_duplicate_is_blocked(client):
    assert claim(client).status_code == 200
    cs, r = checks_of(client)
    assert cs["duplicate"]["ok"] is False and r["blocking"]
    assert claim(client).status_code == 400


def test_over_category_limit_needs_manager(client):
    cs, r = checks_of(client, amount=7000)
    assert cs["category_limit"]["ok"] is False and cs["category_limit"]["level"] == "approval"
    assert r["needs_manager"] and not r["blocking"]


def test_monthly_cap_counts_this_months_claims(client):
    base = checks_of(client)[1]["month_total"]  # sample data may already hold claims this month
    client.put("/api/expenses/policy", json={"monthly_cap": base + 10000, "by": "Rohan Kapoor"})
    assert claim(client, amount=4500, merchant="A").status_code == 200
    assert claim(client, amount=4500, merchant="B").status_code == 200
    cs, r = checks_of(client, amount=2000, merchant="C")
    assert r["month_total"] == base + 9000
    assert cs["monthly_cap"]["ok"] is False and r["needs_manager"]
    assert "1,000" in cs["monthly_cap"]["text"]  # what's left this month


def test_gstin_advised_on_large_bills(client):
    cs, _ = checks_of(client, amount=4800, category="Events")
    assert "gst" not in cs  # below the GST line there is nothing to say
    cs, _ = checks_of(client, amount=6000, category="Events", gst="")
    assert cs["gst"]["ok"] is False and cs["gst"]["level"] == "info"


# ---------------------------------------------------------------- routing
def test_within_limits_goes_straight_to_accounts(client, clock):
    req = claim(client).json()["request"]
    assert req["team"] == "Accounts" and req["payload"]["checks"]
    assert req["payload"]["bill_image"] == BILL
    clock.advance(minutes=4)
    assert client.get(f"/api/c/requests/{req['id']}").json()["status"] == "approved"


def test_month_total_ignores_rejected_and_other_months(client):
    base = checks_of(client)[1]["month_total"]
    req = claim(client, amount=1000, merchant="X").json()["request"]
    assert checks_of(client)[1]["month_total"] == base + 1000
    r = S.store().get("requests", req["id"])
    r["status"] = "rejected"
    S.store().put("requests", r["id"], r)
    assert checks_of(client)[1]["month_total"] == base


def test_over_limit_goes_to_branch_head_first(client, clock):
    out = claim(client, amount=7000).json()
    req = out["request"]
    assert req["payload"]["needs_manager"] is True
    assert "Rohan Kapoor" in req["sim"][0]["by"]
    clock.advance(minutes=10)
    r = client.get(f"/api/c/requests/{req['id']}").json()
    assert r["status"] == "approved"
    whos = [t["by"] for t in r["trail"]]
    assert any("Rohan Kapoor" in w for w in whos) and any("Accounts" in w for w in whos)
    assert whos.index(next(w for w in whos if "Rohan" in w)) < whos.index(next(w for w in whos if "Accounts" in w))


def test_outbox_says_rupees_and_bill_attached(client):
    ob = claim(client).json()["outbox"]
    assert "₹2,400" in ob["body"] and "Rs " not in ob["body"]
    assert ob["payload"]["bill_attached"] is True and "bill_image" not in ob["payload"]


def test_phone_bill_needs_no_client(client):
    r = client.post("/api/actions/reimbursement", json={"category": "Phone and internet", "amount": 799, "merchant": "Jio",
                                                       "bill_date": day(-3), "bill_image": BILL})
    assert r.status_code == 200 and r.json()["request"]["link"] is None


def test_client_costs_need_a_client(client):
    r = client.post("/api/actions/reimbursement", json={"category": "Client meeting meals", "amount": 900, "merchant": "Cafe",
                                                       "bill_date": day(-1), "bill_image": BILL})
    assert r.status_code == 400 and "client" in r.json()["detail"].lower()


def test_bill_amount_mismatch_is_flagged_not_blocked(client):
    cs, r = checks_of(client, amount=2400, bill_amount=3478)
    assert cs["bill_amount"]["ok"] is False and cs["bill_amount"]["level"] == "info"
    assert "₹3,478" in cs["bill_amount"]["text"] and not r["blocking"]
    cs, _ = checks_of(client, amount=3478, bill_amount=3478)
    assert cs["bill_amount"]["ok"] is True
    cs, _ = checks_of(client)
    assert "bill_amount" not in cs  # nothing read from a bill, nothing to compare
