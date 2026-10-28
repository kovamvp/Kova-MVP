"""Data migrations that run on the live database (snapshot first) and again after every reset."""
import json

from backend import migrations
from backend import store as S


def all_text(coll: str) -> str:
    return json.dumps(S.store().list(coll), ensure_ascii=False)


def test_rupee_sign_and_indian_grouping_in_sample_data():
    assert "2026-10-28-rupee-sign" in migrations.applied(S.store())  # ran on the fresh seed
    for coll in ("clients", "products", "meetings", "updates"):
        txt = all_text(coll)
        assert "Rs " not in txt and "Rs." not in txt, coll
    products = all_text("products")
    assert "Minimum: ₹1,00,00,000." in products  # was "Rs 10,000,000"


def test_rupee_text_rules():
    f = migrations.rupee_text
    assert f("Minimum: Rs 10,000,000. Liquidity") == "Minimum: ₹1,00,00,000. Liquidity"
    assert f("increased by Rs 25,000. Discussed") == "increased by ₹25,000. Discussed"
    assert f("about Rs 1.26 Cr of reallocation") == "about ₹1.26 Cr of reallocation"
    assert f("above Rs 1 Cr a written plan") == "above ₹1 Cr a written plan"
    assert f("cab for Rs. 631") == "cab for ₹631"
    assert f("Rs 45 L") == "₹45 L"
    assert f("Mrs Shah and Rs") == "Mrs Shah and Rs"  # no amount, no change
    assert f("Hrs 10") == "Hrs 10"


def test_rupee_migration_leaves_what_was_said_and_sent_alone():
    st = S.store()
    st.put("outbox", "OB-1", {"id": "OB-1", "body": "Claim of Rs 631"})
    st.put("agent_sessions", "AS-1", {"id": "AS-1", "messages": [{"role": "rm", "text": "cab for Rs. 631"}]})
    st.put("clients", "CL-X", {"id": "CL-X", "notes": "Rs 5,00,000 SIP"})
    migrations.rupee_sign(st)
    migrations.rupee_sign(st)  # idempotent
    assert st.get("outbox", "OB-1")["body"] == "Claim of Rs 631"
    assert st.get("agent_sessions", "AS-1")["messages"][0]["text"] == "cab for Rs. 631"
    assert st.get("clients", "CL-X")["notes"] == "₹5,00,000 SIP"
