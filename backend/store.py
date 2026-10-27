"""Document store for KOVA Work.

Every entity is a JSON document in one Postgres table (Neon), keyed by
collection + id. The same JSON is what the API returns and what the agent's
tools read and write. Without DATABASE_URL (local dev) it falls back to memory.
"""
from __future__ import annotations

import copy
import datetime as dt
import json
import os
import re
import threading
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ANCHOR = dt.date(2026, 10, 26)
SEED_VERSION = "2026-10-23.5"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))

# collections stored as lists of documents with an "id"
LIST_COLLECTIONS = [
    "clients", "families", "prospects", "products", "model_portfolios", "portfolios", "meetings",
    "requests", "updates", "research", "ld_progress", "outbox", "agent_sessions", "handbook",
]
# single documents
SINGLETONS = ["rm", "growth"]

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$")


def table_prefix() -> str:
    """Production and local use `kova_*` tables. Vercel preview deployments get their own
    `kova_preview_*` tables in the same database, so a branch can never touch live data."""
    explicit = os.environ.get("KOVA_TABLE_PREFIX")
    if explicit:
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,30}", explicit):
            raise ValueError("KOVA_TABLE_PREFIX must be lowercase letters, digits or _")
        return explicit
    return "kova_preview" if os.environ.get("VERCEL_ENV") == "preview" else "kova"


def needs_reseed(stored: str | None, code: str) -> bool:
    """Reseed only when the stored seed is missing or older than the code's: never move backwards."""
    return not stored or str(stored) < code


def today_ist() -> dt.date:
    return dt.datetime.now(IST).date()


def now_ist() -> str:
    return dt.datetime.now(IST).replace(tzinfo=None).isoformat(timespec="minutes")


def _shift(obj: Any, days: int) -> Any:
    if isinstance(obj, dict):
        return {k: _shift(v, days) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_shift(v, days) for v in obj]
    if isinstance(obj, str):
        if _DATE.match(obj):
            return (dt.date.fromisoformat(obj) + dt.timedelta(days=days)).isoformat()
        if _DATETIME.match(obj):
            return (dt.datetime.fromisoformat(obj) + dt.timedelta(days=days)).isoformat(timespec="minutes")
    return obj


def load_seed() -> dict[str, Any]:
    """Read data/*.json and move every date so the demo is anchored on this week."""
    days = (today_ist() - ANCHOR).days  # day 0 of the mock data becomes the seeding day
    out: dict[str, Any] = {}
    for name in LIST_COLLECTIONS + SINGLETONS:
        p = DATA_DIR / f"{name}.json"
        out[name] = _shift(json.loads(p.read_text()), days) if p.exists() else ([] if name in LIST_COLLECTIONS else {})
    return out


class MemoryStore:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        seed = load_seed()
        self.docs: dict[str, dict[str, Any]] = {}
        for c in LIST_COLLECTIONS:
            self.docs[c] = {d["id"]: d for d in seed[c]}
        for s in SINGLETONS:
            self.docs.setdefault("_single", {})[s] = seed[s]
        self.meta: dict[str, Any] = {}
        self.snapshots: dict[str, Any] = getattr(self, "snapshots", {})
        from .migrations import apply_pending
        apply_pending(self)

    def list(self, coll: str) -> list[dict]:
        return [copy.deepcopy(d) for d in self.docs.get(coll, {}).values()]

    # -- migrations support
    def get_meta(self, key: str) -> Any:
        return copy.deepcopy(self.meta.get(key))

    def set_meta(self, key: str, value: Any) -> None:
        self.meta[key] = copy.deepcopy(value)

    def snapshot(self, tag: str) -> str:
        self.snapshots[tag] = copy.deepcopy({"docs": self.docs, "meta": self.meta})
        return tag

    def restore(self, tag: str) -> None:
        snap = copy.deepcopy(self.snapshots[tag])
        self.docs, self.meta = snap["docs"], snap["meta"]

    def all_docs(self) -> list[tuple[str, str, dict]]:
        return [(c, i, copy.deepcopy(d)) for c, docs in self.docs.items() for i, d in docs.items()]

    def get(self, coll: str, id_: str) -> dict | None:
        d = self.docs.get(coll, {}).get(id_)
        return copy.deepcopy(d) if d is not None else None

    def put(self, coll: str, id_: str, doc: dict) -> dict:
        with self.lock:
            self.docs.setdefault(coll, {})[id_] = copy.deepcopy(doc)
        return doc

    def delete(self, coll: str, id_: str) -> None:
        self.docs.get(coll, {}).pop(id_, None)

    def next_seq(self, key: str, start: int) -> int:
        with self.lock:
            v = self.meta.get(key, start) + 1
            self.meta[key] = v
            return v


class PgStore:
    def __init__(self, url: str) -> None:
        import psycopg  # noqa: F401
        self.url = url
        self._conn = None
        p = table_prefix()
        self.docs_t, self.meta_t = f"{p}_docs", f"{p}_meta"
        self._ensure()

    def conn(self):
        import psycopg
        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(self.url, autocommit=True, connect_timeout=10)
        return self._conn

    def _exec(self, sql: str, params: tuple = (), fetch: str | None = None):
        import psycopg
        for attempt in range(2):
            try:
                with self.conn().cursor() as cur:
                    cur.execute(sql, params)
                    if fetch == "one":
                        return cur.fetchone()
                    if fetch == "all":
                        return cur.fetchall()
                    return None
            except psycopg.OperationalError:
                self._conn = None
                if attempt:
                    raise

    def _ensure(self) -> None:
        from .migrations import apply_pending
        self._exec(f"""
            create table if not exists {self.docs_t} (
              collection text not null,
              id text not null,
              doc jsonb not null,
              updated_at timestamptz not null default now(),
              primary key (collection, id)
            )""")
        self._exec(f"create table if not exists {self.meta_t} (key text primary key, value jsonb not null)")
        # one cold start at a time may seed or migrate (other instances wait on the lock)
        self._exec("select pg_advisory_lock(hashtext(%s))", (self.docs_t,))
        try:
            row = self._exec(f"select value from {self.meta_t} where key = 'seed_version'", fetch="one")
            if needs_reseed(row[0] if row else None, SEED_VERSION):
                self.reset()
            else:
                apply_pending(self)
        finally:
            self._exec("select pg_advisory_unlock(hashtext(%s))", (self.docs_t,))

    def reset(self) -> None:
        from psycopg.types.json import Jsonb

        from .migrations import apply_pending
        seed = load_seed()
        rows = []
        for c in LIST_COLLECTIONS:
            rows += [(c, d["id"], Jsonb(d)) for d in seed[c]]
        for s in SINGLETONS:
            rows.append(("_single", s, Jsonb(seed[s])))
        with self.conn().transaction():
            with self.conn().cursor() as cur:
                cur.execute(f"delete from {self.docs_t}")
                cur.execute(f"delete from {self.meta_t} where key <> 'seed_version'")
                cur.executemany(f"insert into {self.docs_t} (collection, id, doc) values (%s, %s, %s)", rows)
                cur.execute(f"insert into {self.meta_t} (key, value) values ('seed_version', %s) on conflict (key) do update set value = excluded.value",
                            (Jsonb(SEED_VERSION),))
        apply_pending(self)

    def list(self, coll: str) -> list[dict]:
        rows = self._exec(f"select doc from {self.docs_t} where collection = %s order by id", (coll,), fetch="all") or []
        return [r[0] for r in rows]

    def get(self, coll: str, id_: str) -> dict | None:
        row = self._exec(f"select doc from {self.docs_t} where collection = %s and id = %s", (coll, id_), fetch="one")
        return row[0] if row else None

    def put(self, coll: str, id_: str, doc: dict) -> dict:
        from psycopg.types.json import Jsonb
        self._exec(f"""insert into {self.docs_t} (collection, id, doc, updated_at) values (%s, %s, %s, now())
                      on conflict (collection, id) do update set doc = excluded.doc, updated_at = now()""",
                   (coll, id_, Jsonb(doc)))
        return doc

    def delete(self, coll: str, id_: str) -> None:
        self._exec(f"delete from {self.docs_t} where collection = %s and id = %s", (coll, id_))

    def next_seq(self, key: str, start: int) -> int:
        from psycopg.types.json import Jsonb
        row = self._exec(f"""insert into {self.meta_t} (key, value) values (%s, %s)
                            on conflict (key) do update set value = to_jsonb(({self.meta_t}.value::text)::int + 1)
                            returning value""", (key, Jsonb(start + 1)), fetch="one")
        return int(row[0])

    # -- migrations support
    def get_meta(self, key: str) -> Any:
        row = self._exec(f"select value from {self.meta_t} where key = %s", (key,), fetch="one")
        return row[0] if row else None

    def set_meta(self, key: str, value: Any) -> None:
        from psycopg.types.json import Jsonb
        self._exec(f"insert into {self.meta_t} (key, value) values (%s, %s) on conflict (key) do update set value = excluded.value",
                   (key, Jsonb(value)))

    def snapshot(self, tag: str) -> str:
        """Copy every document and meta row into side tables before a migration, so data can be put back."""
        safe = re.sub(r"[^a-z0-9_]", "_", tag.lower())[:40]
        for src in (self.docs_t, self.meta_t):
            self._exec(f"drop table if exists {src}_snap_{safe}")
            self._exec(f"create table {src}_snap_{safe} as table {src}")
        return safe

    def restore(self, tag: str) -> None:
        safe = re.sub(r"[^a-z0-9_]", "_", tag.lower())[:40]
        with self.conn().transaction():
            with self.conn().cursor() as cur:
                for src in (self.docs_t, self.meta_t):
                    cur.execute(f"delete from {src}")
                    cur.execute(f"insert into {src} select * from {src}_snap_{safe}")

    def all_docs(self) -> list[tuple[str, str, dict]]:
        rows = self._exec(f"select collection, id, doc from {self.docs_t}", fetch="all") or []
        return [(r[0], r[1], r[2]) for r in rows]


_store = None


def store():
    global _store
    if _store is None:
        url = os.environ.get("DATABASE_URL")
        _store = PgStore(url) if url else MemoryStore()
    return _store


def singleton(name: str) -> dict:
    return store().get("_single", name) or {}


def put_singleton(name: str, doc: dict) -> dict:
    return store().put("_single", name, doc)


def new_id(prefix: str, key: str, start: int, width: int = 0) -> str:
    n = store().next_seq(key, start)
    return f"{prefix}{str(n).zfill(width) if width else n}"
