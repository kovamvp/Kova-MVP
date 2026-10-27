import datetime as dt

from backend import migrations
from backend import store as S


def test_seed_dates_move_to_today(fresh_store):
    # meeting MT-501 is "day 0, 11:00" in the sample data
    m = fresh_store.get("meetings", "MT-501")
    assert m["start"][:10] == S.today_ist().isoformat()


def test_shift_handles_dates_datetimes_and_leaves_other_strings():
    out = S._shift({"a": "2026-10-26", "b": "2026-10-26T11:00", "c": "PF-2026-000118", "d": ["2026-10-27"]}, 2)
    assert out == {"a": "2026-10-28", "b": "2026-10-28T11:00", "c": "PF-2026-000118", "d": ["2026-10-29"]}


def test_reseed_only_moves_forward():
    assert S.needs_reseed(None, "2026-10-23.5")
    assert S.needs_reseed("2026-10-23.4", "2026-10-23.5")
    assert not S.needs_reseed("2026-10-23.5", "2026-10-23.5")
    assert not S.needs_reseed("2026-10-23.6", "2026-10-23.5")


def test_table_prefix(monkeypatch):
    monkeypatch.delenv("KOVA_TABLE_PREFIX", raising=False)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    assert S.table_prefix() == "kova"
    monkeypatch.setenv("VERCEL_ENV", "production")
    assert S.table_prefix() == "kova"
    monkeypatch.setenv("VERCEL_ENV", "preview")
    assert S.table_prefix() == "kova_preview"
    monkeypatch.setenv("KOVA_TABLE_PREFIX", "kova_test")
    assert S.table_prefix() == "kova_test"


def test_sequences_increase(fresh_store):
    a = S.new_id("X-", "seq_x", 10)
    b = S.new_id("X-", "seq_x", 10)
    assert (a, b) == ("X-11", "X-12")


def test_migrations_run_once_with_snapshot(fresh_store, monkeypatch):
    calls = []

    def add_flag(st):
        calls.append(1)
        for c in st.list("clients"):
            c.setdefault("flag_x", True)
            st.put("clients", c["id"], c)

    monkeypatch.setattr(migrations, "MIGRATIONS", [("0001_flag", "test", add_flag)])
    assert migrations.apply_pending(fresh_store) == ["0001_flag"]
    assert migrations.apply_pending(fresh_store) == []
    assert calls == [1]
    assert all(c["flag_x"] for c in fresh_store.list("clients"))
    assert "before_0001_flag" in fresh_store.snapshots
    fresh_store.restore("before_0001_flag")
    assert "flag_x" not in fresh_store.get("clients", "CL-1001")


def test_reset_is_undoable_via_snapshot(client, fresh_store):
    client.put("/api/c/clients/CL-1001", json={**fresh_store.get("clients", "CL-1001"), "name": "Changed"})
    client.post("/api/reset")
    assert fresh_store.get("clients", "CL-1001")["name"] == "Rajesh Mehta"
    fresh_store.restore("before_reset")
    assert fresh_store.get("clients", "CL-1001")["name"] == "Changed"
    _ = dt
