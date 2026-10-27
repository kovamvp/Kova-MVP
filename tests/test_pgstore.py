"""Runs only when KOVA_TEST_PG_URL points at a throwaway Postgres (CI starts one)."""
import os

import pytest

from backend import migrations
from backend import store as S

URL = os.environ.get("KOVA_TEST_PG_URL")
pytestmark = pytest.mark.skipif(not URL, reason="needs KOVA_TEST_PG_URL")


@pytest.fixture
def pg(monkeypatch):
    monkeypatch.setenv("KOVA_TABLE_PREFIX", "kova_t")
    st = S.PgStore(URL)
    for t in ("kova_t_docs", "kova_t_meta"):
        st._exec(f"drop table if exists {t} cascade")
    st = S.PgStore(URL)
    yield st
    for t in ("kova_t_docs", "kova_t_meta"):
        st._exec(f"drop table if exists {t} cascade")


def test_prefix_tables_seeded(pg):
    assert pg.docs_t == "kova_t_docs"
    assert len(pg.list("clients")) == 24
    assert pg.get_meta("seed_version") == S.SEED_VERSION


def test_crud_and_sequence(pg):
    doc = pg.get("clients", "CL-1001")
    doc["name"] = "X"
    pg.put("clients", "CL-1001", doc)
    assert pg.get("clients", "CL-1001")["name"] == "X"
    assert pg.next_seq("seq_t", 5) == 6 and pg.next_seq("seq_t", 5) == 7
    pg.delete("clients", "CL-1001")
    assert pg.get("clients", "CL-1001") is None


def test_second_cold_start_does_not_reseed(pg):
    doc = pg.get("clients", "CL-1001")
    doc["name"] = "Kept"
    pg.put("clients", "CL-1001", doc)
    again = S.PgStore(URL)
    assert again.get("clients", "CL-1001")["name"] == "Kept"


def test_other_prefix_tables_untouched(pg, monkeypatch):
    monkeypatch.setenv("KOVA_TABLE_PREFIX", "kova_other")
    other = S.PgStore(URL)
    before = other._exec("select count(*), max(updated_at) from kova_other_docs", fetch="one")
    monkeypatch.setenv("KOVA_TABLE_PREFIX", "kova_t")
    doc = pg.get("clients", "CL-1003")
    doc["x"] = 1
    pg.put("clients", "CL-1003", doc)
    pg.reset()
    after = other._exec("select count(*), max(updated_at) from kova_other_docs", fetch="one")
    assert before == after
    for t in ("kova_other_docs", "kova_other_meta"):
        other._exec(f"drop table if exists {t} cascade")


def test_migration_snapshot_and_restore(pg, monkeypatch):
    def tag(st):
        c = st.get("clients", "CL-1002")
        c["migrated"] = True
        st.put("clients", "CL-1002", c)

    monkeypatch.setattr(migrations, "MIGRATIONS", [("0001_t", "t", tag)])
    assert migrations.apply_pending(pg) == ["0001_t"]
    assert pg.get("clients", "CL-1002")["migrated"] is True
    assert migrations.apply_pending(pg) == []
    pg.restore("before_0001_t")
    assert "migrated" not in pg.get("clients", "CL-1002")
    pg._exec("drop table if exists kova_t_docs_snap_before_0001_t, kova_t_meta_snap_before_0001_t")
