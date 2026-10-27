"""Deterministic stand-in for the Groq models, used only when KOVA_LLM=fake.

Lets automated tests and local runs exercise the whole agent loop (tool call → card →
approve → outbox) with no API key and no rate limits. It never runs in production
unless that environment variable is set.
"""
from __future__ import annotations

import datetime as dt
import json
import re

from .store import now_ist

SAMPLE_BILL = {"merchant": "GLOBAL FUSION", "bill_date": "2026-10-21", "amount": 3478.0, "gst": "27AAACG1234F1Z5",
               "category": "Client meeting meals", "items": ["Thai Green Curry"], "confidence": "high", "issues": []}


def _call(name: str, args: dict, n: int = 1) -> dict:
    return {"id": f"fake_{n}", "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


def _next_slot() -> str:
    d = dt.datetime.fromisoformat(now_ist()) + dt.timedelta(days=1)
    if d.weekday() == 6:
        d += dt.timedelta(days=1)
    return d.replace(hour=11, minute=0).isoformat(timespec="minutes")


def _reply(message: dict, served: str = "fake") -> dict:
    return {"choices": [{"message": message}], "usage": {"total_tokens": 0}, "_served_by": {"key": "fake", "model": served}}


def chat(messages: list[dict], tools: list[dict] | None = None, **_: object) -> dict:
    last = messages[-1]
    # vision (bill reading): content is a list with an image
    if isinstance(last.get("content"), list):
        return _reply({"role": "assistant", "content": json.dumps(SAMPLE_BILL)}, "fake-vision")
    if last["role"] == "tool":
        return _reply({"role": "assistant", "content": "Prepared for your approval."})
    system = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
    m = re.search(r'"id": "((?:CL|PR|PD)-\d+)"', system)
    scope_id = m.group(1) if m else ""
    kind = {"CL": "client", "PR": "prospect", "PD": "product"}.get(scope_id[:2], "client")
    text = (last.get("content") or "").lower()
    names = {t["function"]["name"] for t in (tools or [])}
    calls = []
    if ("schedule" in text or "book" in text) and "propose_schedule_meeting" in names:
        calls.append(_call("propose_schedule_meeting", {"with_kind": kind, "with_id": scope_id, "title": "Follow-up review",
                                                        "type": "Review", "start": _next_slot(), "duration_minutes": 45,
                                                        "location": "Client's office", "agenda": ["Portfolio review"]}, len(calls) + 1))
    if "feedback" in text and "propose_product_feedback" in names:
        calls.append(_call("propose_product_feedback", {"product_id": scope_id if kind == "product" else "PD-202",
                                                        "feedback": "Client finds the fee too high.",
                                                        **({"client_id": scope_id} if kind == "client" else {})}, len(calls) + 1))
    if ("mom" in text or "minutes" in text) and "propose_log_mom" in names:
        calls.append(_call("propose_log_mom", {"with_kind": kind, "with_id": scope_id, "summary": "Reviewed the portfolio.",
                                               "promises": ["Send the fee comparison"], "send_to_client": True}, len(calls) + 1))
    if ("claim" in text or "reimburse" in text) and "propose_reimbursement" in names:
        bill = re.search(r"\[attached bill, read as: (\{.*\})\]", last.get("content") or "", re.I | re.S)
        fields = json.loads(bill.group(1)) if bill else {}
        calls.append(_call("propose_reimbursement", {"client_id": scope_id, "category": fields.get("category", "Client meeting meals"),
                                                     "amount": fields.get("amount", 1200), "merchant": fields.get("merchant", "Cafe"),
                                                     "bill_date": fields.get("bill_date", now_ist()[:10])}, len(calls) + 1))
    if "whatsapp" in text and "propose_send_message" in names:
        calls.append(_call("propose_send_message", {"to_kind": kind, "to_id": scope_id, "channel": "WhatsApp",
                                                    "body": "Hello, a quick note from Kova."}, len(calls) + 1))
    if calls:
        return _reply({"role": "assistant", "content": "", "tool_calls": calls})
    return _reply({"role": "assistant", "content": "This is the test agent. Nothing to prepare."})


def transcribe(audio: bytes, filename: str, content_type: str) -> dict:
    return {"text": "fake transcript", "key": "fake"}
