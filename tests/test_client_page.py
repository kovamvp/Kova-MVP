"""Sprint 3: client page — profile sections (locked vs editable), custom fields, flags with reasons and
next steps, key actionables, comparisons, and service requests by category."""
import datetime as dt

from backend import insights
from backend import store as S


def act(client, name, **args):
    return client.post(f"/api/actions/{name}", json=args)


def get(client, cid="CL-1001"):
    return client.get(f"/api/c/clients/{cid}").json()


# ---------------------------------------------------------------- profile
def test_sample_clients_have_profile_sections(client):
    c = get(client)
    assert c["profile"]["occupation"]["occupation"] == c["occupation"]
    assert c["profile"]["traits"]["notes"] == c["notes_summary"]
    assert c["custom_fields"] == []


def test_editing_a_profile_section_records_who_what_and_when(client):
    r = act(client, "update_profile", client_id="CL-1001", section="occupation", changes={"organisation": "Mehta Textiles", "occupation": "Textile exports, 3 units"})
    assert r.status_code == 200
    c = get(client)
    assert c["profile"]["occupation"]["organisation"] == "Mehta Textiles"
    assert c["occupation"] == "Textile exports, 3 units"  # the top-level field the agent reads stays in step
    ch = c["profile_changes"][-1]
    assert ch["section"] == "occupation" and ch["field"] in ("organisation", "occupation") and ch["by"] and ch["at"]
    assert c["timeline"][0]["title"].startswith("Profile updated")


def test_locked_fields_go_through_a_service_request(client):
    for section, field in (("identity", "phone"), ("identity", "pan_masked"), ("occupation", "phone")):
        r = act(client, "update_profile", client_id="CL-1001", section=section, changes={field: "x"})
        assert r.status_code == 400 and "service request" in r.json()["detail"], (section, field)
    assert get(client)["phone"] != "x"


def test_unknown_section_or_field_is_refused(client):
    assert act(client, "update_profile", client_id="CL-1001", section="nope", changes={"a": 1}).status_code == 400
    assert act(client, "update_profile", client_id="CL-1001", section="family", changes={"shoe_size": 9}).status_code == 400


def test_lifestyle_needs_profile_enrichment_consent(client):
    no = next(c for c in S.store().list("clients") if not c["consent"]["profile_enrichment"])
    r = act(client, "update_profile", client_id=no["id"], section="lifestyle", changes={"clubs": "Willingdon"})
    assert r.status_code == 400 and "consent" in r.json()["detail"]


# ---------------------------------------------------------------- custom fields
def test_custom_fields_add_edit_remove_with_history(client):
    r = act(client, "add_custom_field", client_id="CL-1001", label="Preferred golf course", type="text", value="Willingdon", section="lifestyle", save_to_library=True)
    assert r.status_code == 200
    f = get(client)["custom_fields"][0]
    assert f["label"] == "Preferred golf course" and f["value"] == "Willingdon" and f["added_by"] and f["at"]
    assert any(x["label"] == "Preferred golf course" for x in client.get("/api/profile/library").json()["fields"])
    act(client, "update_custom_field", client_id="CL-1001", field_id=f["id"], value="Bombay Presidency")
    assert get(client)["custom_fields"][0]["value"] == "Bombay Presidency"
    act(client, "remove_custom_field", client_id="CL-1001", field_id=f["id"])
    c = get(client)
    assert c["custom_fields"] == [] and any(x.get("field") == "Preferred golf course" for x in c["profile_changes"])


def test_custom_field_types_are_checked(client):
    assert act(client, "add_custom_field", client_id="CL-1001", label="Kids", type="number", value="two", section="family").status_code == 400
    assert act(client, "add_custom_field", client_id="CL-1001", label="X", type="colour", value="red", section="family").status_code == 400
    assert act(client, "add_custom_field", client_id="CL-1001", label="Kids", type="number", value=2, section="family").status_code == 200


def test_field_library_has_sensible_defaults(client):
    lib = client.get("/api/profile/library").json()
    assert {s["key"] for s in lib["sections"]} >= {"identity", "family", "occupation", "lifestyle", "owns", "preferences", "traits"}
    assert len(lib["fields"]) >= 8 and "Demographic update" in lib["service_categories"]


# ---------------------------------------------------------------- flags
def test_flags_say_why_and_what_to_do(client):
    no_nominee = next(c for c in S.store().list("clients") if c["nominee"] == "Missing")
    ins = client.get(f"/api/clients/{no_nominee['id']}/insights").json()
    f = next(x for x in ins["flags"] if x["id"] == "nominee")
    assert f["severity"] == "high" and f["why"] and f["cta"]["category"] == "Nominee update"


def test_old_risk_profile_and_cio_review_flags():
    st = S.store()
    today = S.today_ist()
    prods = {p["id"]: p for p in st.list("products")}
    c = st.get("clients", "CL-1001")
    c["risk_profile_date"] = (today - dt.timedelta(days=600)).isoformat()
    ids = {f["id"] for f in insights.flags(c, prods, [], today)}
    assert "risk_profile" in ids
    under = [p for p in prods.values() if p["cio_view"]["stance"] == "Under review"]
    assert under and any(i.startswith("cio_review") for i in ids) == any(h["product_id"] in {p["id"] for p in under} for h in c["holdings"])


def test_equity_above_band_flag_links_to_studio():
    st = S.store()
    c = st.get("clients", "CL-1001")
    c["risk_profile"] = "Conservative"
    f = next(x for x in insights.flags(c, {p["id"]: p for p in st.list("products")}, [], S.today_ist()) if x["id"] == "equity_band")
    assert f["severity"] == "high" and "/studio" in f["cta"]["href"]


def test_flags_are_kept_on_the_client_for_the_list(client):
    no_nominee = next(c for c in S.store().list("clients") if c["nominee"] == "Missing")
    client.get(f"/api/clients/{no_nominee['id']}/insights")
    stored = get(client, no_nominee["id"])["red_flags"]
    assert any(f.get("id") == "nominee" and f["text"] and f["why"] for f in stored)


# ---------------------------------------------------------------- actionables and comparisons
def test_actionables_include_maturities_and_cash_flows(client):
    ins = client.get("/api/clients/CL-1001/insights").json()
    kinds = {a["kind"] for a in ins["actionables"]}
    assert "maturity" in kinds and "cash_flows" in kinds
    cf = next(a for a in ins["actionables"] if a["kind"] == "cash_flows")
    assert cf["inflow"] > 0 and cf["outflow"] < 0


def test_meetings_in_the_next_day_are_actionable(client):
    start = (dt.datetime.fromisoformat(S.now_ist()) + dt.timedelta(hours=3)).replace(minute=0)
    from backend.actions import clash_with
    while clash_with(start.isoformat(timespec="minutes"), (start + dt.timedelta(minutes=45)).isoformat(timespec="minutes")):
        start += dt.timedelta(hours=1)
    act(client, "schedule_meeting", with_kind="client", with_id="CL-1003", title="Quick catch-up", start=start.isoformat(timespec="minutes"), duration_minutes=30, location="Phone")
    ins = client.get("/api/clients/CL-1003/insights").json()
    assert any(a["kind"] == "meeting" and "Quick catch-up" in a["title"] for a in ins["actionables"])


def test_comparisons(client):
    c = get(client)
    cmp = client.get("/api/clients/CL-1001/insights").json()["comparisons"]
    assert cmp["revenue"]["fy"] == round(c["revenue_ytd"]) and cmp["revenue"]["fy_before"] >= 0
    assert cmp["revenue"]["lifetime"] >= cmp["revenue"]["fy"]
    assert -50 < cmp["return_1y"] < 100 and -50 < cmp["benchmark_1y"] < 100 and cmp["benchmark_name"]
    assert "meetings_90d" in cmp["interactions"]


def test_new_client_without_history_has_no_return_figures(client):
    from tests.test_prospects import CONSENT
    cid = act(client, "convert_prospect", prospect_id="PR-2006", consent=CONSENT).json()["client"]["id"]
    cmp = client.get(f"/api/clients/{cid}/insights").json()["comparisons"]
    assert cmp["return_1y"] is None and cmp["revenue"]["fy"] == 0


# ---------------------------------------------------------------- service requests
def test_service_request_carries_its_category(client):
    out = act(client, "service_request", client_id="CL-1001", category="Nominee update", details="Add Kavita as nominee on all folios").json()
    assert out["request"]["payload"]["category"] == "Nominee update"
    assert out["request"]["title"].startswith("Nominee update")
    assert act(client, "service_request", client_id="CL-1001", category="Haircut", details="x").status_code == 400
