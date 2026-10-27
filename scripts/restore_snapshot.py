"""Put the database back to a snapshot taken before a migration or a reset.

Usage (PowerShell or bash, with DATABASE_URL set to the database to restore):
    python scripts/restore_snapshot.py --list
    python scripts/restore_snapshot.py before_reset
Set KOVA_TABLE_PREFIX=kova_preview to act on the preview tables instead of production.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.store import PgStore  # noqa: E402


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("Set DATABASE_URL first.")
    st = PgStore.__new__(PgStore)
    st.url, st._conn = url, None
    from backend.store import table_prefix
    p = table_prefix()
    st.docs_t, st.meta_t = f"{p}_docs", f"{p}_meta"
    if len(sys.argv) < 2 or sys.argv[1] == "--list":
        rows = st._exec("select table_name from information_schema.tables where table_name like %s order by 1", (f"{st.docs_t}_snap_%",), fetch="all")
        for (name,) in rows or []:
            print(name.replace(f"{st.docs_t}_snap_", ""))
        return
    tag = sys.argv[1]
    if input(f"Restore {p} tables to snapshot '{tag}'? Everything since then is lost. Type yes: ").strip() != "yes":
        sys.exit("Cancelled.")
    st.restore(tag)
    print("Restored.")


if __name__ == "__main__":
    main()
