"""Versioned, additive data migrations.

Rules:
- A migration only adds or fills fields; it never deletes user-created documents.
- Each migration is idempotent: running it twice gives the same result.
- Before any pending migration runs on a database, the whole store is snapshotted
  (`<table>_snap_before_<id>`), so data can be put back with scripts/restore_snapshot.py.
- After a reseed every migration runs again on the fresh sample data.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

Migration = tuple[str, str, Callable[[Any], None]]

# (id, description, function(store)). Append only; never edit or reorder applied ones.
MIGRATIONS: list[Migration] = []


def applied(store: Any) -> list[str]:
    return list(store.get_meta("migrations") or [])


def pending(store: Any) -> list[Migration]:
    done = set(applied(store))
    return [m for m in MIGRATIONS if m[0] not in done]


def apply_pending(store: Any) -> list[str]:
    todo = pending(store)
    if not todo:
        return []
    store.snapshot(f"before_{todo[0][0]}")
    done = applied(store)
    for mid, _desc, fn in todo:
        fn(store)
        done.append(mid)
        store.set_meta("migrations", done)
    return [m[0] for m in todo]
