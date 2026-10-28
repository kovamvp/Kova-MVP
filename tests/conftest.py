"""Shared fixtures. Tests run on the in-memory store with the fake model: no database, no Groq."""
from __future__ import annotations

import datetime as dt
import os
import sys

import pytest

os.environ.pop("DATABASE_URL", None)
os.environ["KOVA_LLM"] = "fake"
os.environ.pop("GROQ_API_KEY_AGENT", None)
os.environ.pop("GROQ_API_KEY_SPEECH", None)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient  # noqa: E402

from backend import actions, agent, llm_fake  # noqa: E402
from backend import app as app_module
from backend import store as store_module


@pytest.fixture(autouse=True)
def fresh_store():
    st = store_module.store()
    assert isinstance(st, store_module.MemoryStore), "tests must never touch a real database"
    st.reset()
    yield st


@pytest.fixture
def client():
    return TestClient(app_module.app)


class Clock:
    """Moves 'now' for every module that reads it."""

    MODULES = (store_module, actions, agent, app_module, llm_fake)

    def __init__(self, monkeypatch):
        self.mp = monkeypatch
        self.offset = dt.timedelta()
        self._real = store_module.now_ist

        def fake_now() -> str:
            return (dt.datetime.fromisoformat(self._real()) + self.offset).isoformat(timespec="minutes")

        for m in self.MODULES:
            if hasattr(m, "now_ist"):
                monkeypatch.setattr(m, "now_ist", fake_now)

    def advance(self, minutes: float = 0, days: float = 0) -> None:
        self.offset += dt.timedelta(minutes=minutes, days=days)


@pytest.fixture
def clock(monkeypatch):
    return Clock(monkeypatch)


@pytest.fixture
def script_llm(monkeypatch):
    """Replace the model with a fixed list of replies: each item is either a text or a list of (tool, args)."""
    def install(*turns):
        queue = list(turns)
        seen: list[dict] = []

        def chat(messages, tools=None, **_):
            seen.append({"messages": messages, "tools": tools})
            turn = queue.pop(0) if queue else "Done."
            if isinstance(turn, str):
                msg = {"role": "assistant", "content": turn}
            else:
                msg = {"role": "assistant", "content": "", "tool_calls": [
                    llm_fake._call(name, args, i + 1) for i, (name, args) in enumerate(turn)]}
            return {"choices": [{"message": msg}], "_served_by": {"key": "script", "model": "script"}}

        monkeypatch.setattr(agent.llm, "chat", chat)
        return seen
    return install
