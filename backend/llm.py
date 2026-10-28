"""Groq gateway: key fallback, model fallback, and a log of which key served each call."""
from __future__ import annotations

import os
import re
import time

import httpx

BASE = "https://api.groq.com/openai/v1"
AGENT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
VISION_MODEL = "qwen/qwen3.8-27b"
SPEECH_MODEL = "whisper-large-v3-turbo"

LOG: list[dict] = []  # recent calls (per warm instance), shown at /api/agent/gateway


class LLMError(Exception):
    pass


def _keys(primary: str) -> list[tuple[str, str]]:
    order = ["GROQ_API_KEY_AGENT", "GROQ_API_KEY_SPEECH"] if primary == "agent" else ["GROQ_API_KEY_SPEECH", "GROQ_API_KEY_AGENT"]
    return [(name, os.environ[name]) for name in order if os.environ.get(name)]


def _log(kind: str, key: str, model: str, status: int, ms: int, note: str = "") -> None:
    entry = {"at": time.strftime("%H:%M:%S"), "kind": kind, "key": key, "model": model, "status": status, "ms": ms, "note": note}
    LOG.append(entry)
    del LOG[:-50]
    print(f"[groq] {kind} key={key} model={model} status={status} {ms}ms {note}")


def _fake() -> bool:
    return os.environ.get("KOVA_LLM") == "fake"


def chat(messages: list[dict], tools: list[dict] | None = None, models: list[str] | None = None, temperature: float = 0.3,
         max_tokens: int = 1400, primary: str = "agent") -> dict:
    if _fake():
        from . import llm_fake
        return llm_fake.chat(messages, tools)
    keys = _keys(primary)
    if not keys:
        raise LLMError("No Groq API key is configured on the server.")
    last = ""
    rate_limited: list = []
    for attempt in range(2):
        out = _try_all(messages, tools, models, temperature, max_tokens, keys, rate_limited)
        if isinstance(out, dict):
            return out
        last = out
        # every key was rate-limited: wait for the shortest suggested window once, then retry
        waits = [float(m.group(1)) for _, t in rate_limited for m in [re.search(r"try again in ([0-9.]+)s", t)] if m]
        if attempt == 0 and rate_limited and waits and min(waits) <= 12:
            time.sleep(min(waits) + 0.3)
            rate_limited.clear()
            continue
        break
    raise LLMError(f"All Groq keys and models failed. Last error {last}")


def _try_all(messages, tools, models, temperature, max_tokens, keys, rate_limited):
    last = ""
    for model in models or AGENT_MODELS:
        for name, key in keys:
            body: dict = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
            if tools:
                body["tools"] = tools
                body["tool_choice"] = "auto"
            if model.startswith("openai/gpt-oss"):
                body["reasoning_effort"] = "low"
            t0 = time.time()
            try:
                r = httpx.post(f"{BASE}/chat/completions", json=body, headers={"Authorization": f"Bearer {key}"}, timeout=45)
            except httpx.HTTPError as e:
                _log("chat", name, model, 0, int((time.time() - t0) * 1000), str(e)[:80])
                last = str(e)
                continue
            ms = int((time.time() - t0) * 1000)
            if r.status_code == 200:
                data = r.json()
                _log("chat", name, model, 200, ms, f"tokens={data.get('usage', {}).get('total_tokens')}")
                data["_served_by"] = {"key": name, "model": model}
                return data
            _log("chat", name, model, r.status_code, ms, r.text[:120])
            last = f"{r.status_code}: {r.text[:200]}"
            if r.status_code == 429:
                rate_limited.append((name, r.text))
            if r.status_code == 400 and "tool" in r.text.lower():
                break  # malformed tool call from this model: try the next model
    return last


def transcribe(audio: bytes, filename: str, content_type: str) -> dict:
    if _fake():
        from . import llm_fake
        return llm_fake.transcribe(audio, filename, content_type)
    keys = _keys("speech")
    if not keys:
        raise LLMError("No Groq API key is configured on the server.")
    last = ""
    for name, key in keys:
        t0 = time.time()
        try:
            r = httpx.post(f"{BASE}/audio/transcriptions", headers={"Authorization": f"Bearer {key}"},
                           files={"file": (filename, audio, content_type)},
                           data={"model": SPEECH_MODEL, "language": "en", "response_format": "json", "temperature": "0"}, timeout=45)
        except httpx.HTTPError as e:
            last = str(e)
            continue
        ms = int((time.time() - t0) * 1000)
        _log("speech", name, SPEECH_MODEL, r.status_code, ms)
        if r.status_code == 200:
            return {"text": r.json().get("text", "").strip(), "key": name}
        last = f"{r.status_code}: {r.text[:200]}"
    raise LLMError(f"Transcription failed. {last}")
