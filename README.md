# Kova Work (mini MVP)

The relationship manager's workspace for KOVA, built on sample data. One RM persona (Priya Sharma, Mumbai West).

## What works and what is a screen
| Area | Working | Designed (sample data, light inner pages) |
|---|---|---|
| Shell | Sign-in, dock, search (⌘K), profile menu, profile photo | My profile, Preferences, Handbook |
| Home | Widget library, drag/drop/resize, layout saved, reset to default, pick-an-item widgets, fixed Updates & upcoming with done/snooze | Tasks inside updates, research rows |
| Clients | List with sort/filter, **client agent**, schedule meeting + product feedback + note from Actions | Analysis, families view, client page, portfolio panel, onboarding pop-up |
| Prospects | List, create, close/reopen, stage changes, proposal panel → Studio, **prospect agent** | Analysis, suggestions, Kova Client access toggle |
| Meetings | Meetings the agent (or you) schedule appear in the calendar | Prep pack, needs-a-MoM, promises, history, insights |
| Studio | Recommended / scratch / import JSON, canvas, live master panel, suitability flags, send for approval, export JSON | Agent build, field-level agent buttons |
| Products | List with learning status, learning panel with progress and quiz, **product agent** (brief, fitting clients, feedback) | Analysis, product page, research tab |
| Growth | Five goals: add, edit, achieve, remove (manager goals locked) | Points and slabs, KPIs, contests, suggestions |
| Requests | Lists, simulated replies from other teams, nudge/escalate/reminders, ticket form, **outbox with edit and correct/needs-fixing marks** | — |

## The agent
- Page-specific: client, prospect, product. Sessions are kept per page and can be archived, never deleted.
- Speech: the browser shows live text while you speak (Chrome/Edge); the recording goes to Whisper on Groq when you stop and replaces it with the more accurate transcript. Edit before sending.
- Every action is an approval card (approve, edit, reject). Approved cards run the same code as the manual Actions panel and land in **Requests → Outbox** with the exact payload, recipient, time, what you said and the card it came from.
- Reimbursement: attach a bill with the paperclip in a client session. `docs/samples/sample-bill.jpg` is a test bill.
- Models (Groq): `openai/gpt-oss-120b` (fallback `openai/gpt-oss-20b`), bills `qwen/qwen3.8-27b`, speech `whisper-large-v3-turbo`. Two keys (`GROQ_API_KEY_AGENT`, `GROQ_API_KEY_SPEECH`) back each other up when one hits a rate limit. `/api/agent/gateway` shows which key served recent calls.

## How it's built
- `web/` React + Vite + TypeScript. `api/index.py` → `backend/` FastAPI on Vercel Functions.
- `backend/store.py`: every entity is a JSON document in one Neon Postgres table; the same JSON is the API response and what the agent reads.
- `data/*.json`: sample data from `scripts/gen_data.py`. Dates move to the current week when the database is seeded. **Preferences → Reset demo data** puts everything back.
- `backend/actions.py`: all RM actions plus the outbox and the simulated team replies. `backend/agent.py`: tools, approval cards, sessions. `backend/llm.py`: Groq gateway.

## Testing hooks (protected deployment)
`/api/health`, `/api/agent/dev/run?kind=client&id=CL-1001&q=...`, `/api/agent/dev/decide?session=AS-…&card=CD-…`, `/api/agent/dev/bill`, `/api/agent/dev/speech`.

## Local
```
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt uvicorn
uvicorn api.index:app --port 8000      # without DATABASE_URL it runs on in-memory data
cd web && npm install && npm run dev  # http://localhost:5173
```
