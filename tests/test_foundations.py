"""Sprint 1 foundations: one product classification, holdings with accounts, client tiers, monthly history."""
import datetime as dt

from backend import history, migrations, taxonomy, tiers
from backend import store as S

CR = 1_00_00_000


def docs(client, coll):
    return client.get(f"/api/c/{coll}").json()


# ---------------------------------------------------------------- taxonomy
def test_every_investment_product_sits_on_the_tree(client):
    for p in docs(client, "products"):
        if p["id"] in taxonomy.CREDIT_PRODUCTS:
            assert p["asset_class"] is None
            continue
        assert p["asset_class"] in taxonomy.ASSET_CLASSES, p["id"]
        assert p["subcategory"] in taxonomy.TREE[p["asset_class"]][p["product_type"]], p["id"]
        assert p["product_type"] == p["category"]  # the old field still says the same thing


def test_holding_class_matches_its_product(client):
    prods = {p["id"]: p for p in docs(client, "products")}
    for c in docs(client, "clients"):
        for h in c["holdings"]:
            assert h["asset_class"] == prods[h["product_id"]]["asset_class"], (c["id"], h["product_id"])


def test_taxonomy_endpoint_counts_products_and_lists_what_kova_doesnt_sell(client):
    t = client.get("/api/taxonomy").json()
    assert t["asset_classes"] == ["Equity", "Debt", "Gold", "Cash"]
    equity = next(a for a in t["tree"] if a["name"] == "Equity")
    mf = next(x for x in equity["types"] if x["name"] == "Mutual fund")
    assert mf["on_shelf"] and next(s for s in mf["subcategories"] if s["name"] == "Flexi cap")["products"] == ["PD-101"]
    sif = next(x for x in equity["types"] if x["name"] == "SIF")
    assert sif["on_shelf"] is False and sif["count"] == 0
    assert sum(a["count"] for a in t["tree"]) == len(docs(client, "products")) - len(taxonomy.CREDIT_PRODUCTS)


def test_products_link_to_a_benchmark_index(client):
    bms = {b["id"] for b in docs(client, "benchmarks")}
    for p in docs(client, "products"):
        if p.get("benchmark"):
            assert p["benchmark_id"] in bms, p["id"]


# ---------------------------------------------------------------- accounts on holdings
def test_every_holding_says_where_it_is_held(client):
    for c in docs(client, "clients"):
        ids = {a["id"] for a in c["holding_accounts"]}
        assert c["holding_accounts"][0]["held_at"] == "Kova"
        for h in c["holdings"]:
            assert h["account_id"] in ids and h["held_at"] == "Kova" and h["on_shelf"] is True


# ---------------------------------------------------------------- tiers
def test_tier_thresholds():
    assert tiers.tier_for(0) == "rise"
    assert tiers.tier_for(5 * CR - 1) == "rise"
    assert tiers.tier_for(5 * CR) == "ascent"
    assert tiers.tier_for(10 * CR) == "summit"
    assert tiers.tier_for(20 * CR) == "zenith"
    assert [t["label"] for t in tiers.TIERS] == ["Rise", "Ascent", "Summit", "Zenith"]


def test_households_are_tiered_and_members_carry_the_family_tier(client):
    fams = {f["id"]: f for f in docs(client, "families")}
    for c in docs(client, "clients"):
        assert c["tier"] == fams[c["family_id"]]["tier"]
    by = {f["name"]: f["tier"] for f in fams.values()}
    assert by["Wadia family"] == "zenith" and by["Patil family"] == "summit"
    assert by["Kapadia family"] == "ascent" and by["Khanna family"] == "rise"
    t = client.get("/api/tiers").json()
    assert [x["key"] for x in t] == ["rise", "ascent", "summit", "zenith"] and sum(x["families"] for x in t) == len(fams)


def test_tier_follows_the_household_value():
    st = S.store()
    c = st.get("clients", "CL-1022")  # Fernandes family, below ₹5 Cr
    st.put("clients", c["id"], {**c, "aum": 6 * CR})
    tiers.refresh(st, [c["family_id"]])
    assert st.get("families", c["family_id"])["tier"] == "ascent"
    assert st.get("clients", "CL-1023")["tier"] == "ascent"  # the other member too


def test_agent_brief_includes_the_tier():
    from backend.agent import client_brief
    assert client_brief(S.store().get("clients", "CL-1001"))["tier"] == "zenith"


# ---------------------------------------------------------------- history
def test_fiscal_year_helpers():
    assert history.fy_start(dt.date(2026, 10, 30)) == dt.date(2026, 4, 1)
    assert history.fy_start(dt.date(2027, 2, 1)) == dt.date(2026, 4, 1)
    assert history.fy_label(dt.date(2026, 10, 30)) == "FY 2026-27"
    assert history.history_start(dt.date(2026, 10, 30)) == dt.date(2024, 4, 1)


def test_client_history_ends_at_todays_figures(client):
    today = S.today_ist()
    fy = history.month_key(history.fy_start(today))
    for c in docs(client, "clients"):
        h = c["history"]
        if not c["holdings"]:
            assert h == []
            continue
        assert h[-1]["month"] == history.month_key(today)
        assert h[-1]["value"] == round(c["aum"]) and h[-1]["invested"] == round(c["invested"])
        assert sum(r["revenue"] for r in h if r["month"] >= fy) == round(c["revenue_ytd"])
        assert h[0]["month"] >= history.month_key(history.history_start(today))
        assert all(r["value"] > 0 and r["invested"] > 0 for r in h)
        months = [r["month"] for r in h]
        assert months == sorted(set(months))


def test_history_starts_when_the_client_first_invested(client):
    latest = max((c for c in docs(client, "clients") if c["holdings"]), key=lambda c: min(h["since"] for h in c["holdings"]))
    first = min(h["since"] for h in latest["holdings"])[:7]
    assert latest["history"][0]["month"] == max(first, history.month_key(history.history_start(S.today_ist())))


def test_book_history_adds_up_the_clients(client):
    b = client.get("/api/book/history").json()
    last = b["months"][-1]
    cl = docs(client, "clients")
    assert last["value"] == sum(round(c["aum"]) for c in cl)
    assert abs(sum(last["by_class"].values()) - last["value"]) <= len(cl) * 10  # per-holding rounding
    assert b["fy"].startswith("FY ") and len(b["months"]) >= 25


def test_benchmarks_are_monthly_indices(client):
    for bm in docs(client, "benchmarks"):
        s = bm["series"]
        assert len(s) == history.MARKET_MONTHS and s[-1]["month"] == history.month_key(S.today_ist())
        assert all(x["value"] > 0 for x in s)


def test_history_is_the_same_every_time():
    st = S.store()
    before = st.get("clients", "CL-1001")["history"]
    migrations.history_and_benchmarks(st)
    migrations.product_taxonomy(st)
    migrations.client_tiers(st)
    assert st.get("clients", "CL-1001")["history"] == before


def test_new_client_from_a_prospect_starts_in_rise_with_a_kova_account(client):
    from tests.test_prospects import CONSENT
    c = client.post("/api/actions/convert_prospect", json={"prospect_id": "PR-2006", "consent": CONSENT}).json()["client"]
    assert c["tier"] == "rise" and c["holding_accounts"][0]["held_at"] == "Kova" and c["history"] == []
    assert S.store().get("families", c["family_id"])["tier"] == "rise"
