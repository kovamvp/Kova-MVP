# CLAUDE.md — Kova Work (mini MVP)

You are working on **Kova Work**, the relationship manager (RM) workspace for **KOVA**, an Indian wealth management company. This repo is a *mini MVP*: a full, polished interface on sample data where only selected features really work. It was built in one long session with Claude and is now handed to you so Divyansh can test it, fix small things and extend it with you.

Read `docs/KOVA_CONTEXT.md` before your first task in any session. It holds the full story: what KOVA is, the vision for the MVP, every decision taken, what is built, what is only designed, what is left, and the known issues.

@docs/KOVA_CONTEXT.md

---

## 0. Branch and release rules (read first)

- **`main` is production.** Every push to `main` deploys to the live site. Never commit or push directly to `main`.
- Work on a branch (`feat/…`, `fix/…`, `ui/…`, `test/…`), open a pull request, and merge only when **all CI checks are green** (lint, backend tests incl. Postgres, web typecheck/unit/build, end-to-end) and the branch's Vercel preview has been checked.
- **Preview deployments use their own tables** (`kova_preview_*`) in the same Neon database, chosen automatically from `VERCEL_ENV=preview`. Production uses `kova_*`. A branch can't touch live data.
- **Restore points:** branch `baseline-v1` (commit `6080b11`) is the known-good version before this phase; Vercel can roll back to deployment `dpl_DoL9nzpK39nYfkFfzLrc2LJURXgt`. Data changes go only through `backend/migrations.py`, which snapshots every table before running; `scripts/restore_snapshot.py` puts data back. Preferences → Reset demo data also snapshots first (`before_reset`).
- **Never bump `SEED_VERSION`** in `backend/store.py` unless Divyansh explicitly asks: it wipes and reseeds production on the next cold start. Change data with a migration instead.
- Don't change Vercel settings, environment variables, domains or protection unless asked.

## 1. Who you work with

- **Divyansh (also "Dhruv")** builds this alone with AI. He is strong in Python and FastAPI, newer to TypeScript/React, and newer to the wealth industry. Explain TypeScript and React changes in plain words; explain wealth terms when they matter.
- **Krishna** is the decision-maker at KOVA. He judges by logic, facts and numbers. Anything written for him should lead with reasons and evidence.
- Divyansh works on **Windows** (VS Code, PowerShell). Give Windows commands (`.venv\Scripts\activate`, `$env:NAME="..."`), not only bash.
- Tone: straightforward, no filler. Ask when something is genuinely ambiguous; otherwise make the sensible call and say what you chose.

## 2. How to work: the loop

For every task, run this loop and do not skip steps:

1. **Understand.** Restate the task in one or two lines. Find the code involved (`backend/…`, `web/src/…`) and read it before changing anything. Check `docs/KOVA_CONTEXT.md` for the decision behind it.
2. **Reproduce.** For a bug, reproduce it first: a failing test, a curl/PowerShell request, or a Playwright run. No reproduction, no fix; say what you tried.
3. **Write the test first (TDD).** Add a failing test that captures the expected behaviour (see section 3). Then make the smallest change that makes it pass.
4. **Change minimally.** Match the existing patterns and naming. No drive-by refactors, no renames, no new dependencies, no reformatting of untouched code, unless asked.
5. **Verify — all of these, every time:**
   - Backend: `ruff check backend api` (if ruff is installed) and `pytest -q`
   - Frontend: `cd web; npx tsc -b; npm run build`
   - Integration: the API test suite against the in-memory store
   - UI: open the affected page (dev server or Playwright), click through the changed flow, check the browser console for errors, and look at a screenshot at 1440px and 1280px wide
6. **Iterate.** If anything fails, go back to step 2. Loop up to three times on the same failure; after that, stop and report what you know, what you tried, and the options.
7. **Report.** In plain words: what changed (files and why), how you tested it (commands and results), what you did *not* test, and any risk. Never claim something works without having run it.

## 3. Testing (TDD, integration, end-to-end)

Everything runs without a database or an API key: the backend uses the in-memory store, and `KOVA_LLM=fake` swaps the Groq models for a deterministic fake (`backend/llm_fake.py`).

| Layer | Where | Run |
|---|---|---|
| Lint | `ruff.toml` | `ruff check backend api tests scripts` |
| Backend unit + API integration (actions, simulation, portfolios, goals, prospects, outbox, agent loop with scripted model replies, validation rules) | `tests/` | `pytest -q` |
| Postgres store (prefix tables, seeding lock, migrations, snapshot/restore) | `tests/test_pgstore.py` | set `KOVA_TEST_PG_URL` to a **throwaway** Postgres, then `pytest -q tests/test_pgstore.py` |
| Front-end unit (formatting, suitability, learning stats) | `web/src/lib/__tests__/` | `cd web; npm test` |
| Typecheck + build | `web/` | `npx tsc -b; npm run build` |
| End-to-end journeys (every route, every working feature, agent card approve → outbox) | `e2e/tests/` | `cd e2e; npm install; npx playwright install chromium; npx playwright test` (starts both servers itself; ports 8000 and 5173 must be free) |

Rules:
- Write the failing test first, then the change. Every bug fixed gets a test that would have caught it.
- Use the fixtures in `tests/conftest.py`: `client` (API), `clock` (move time to drive simulated team replies), `script_llm` (script the model's tool calls to test the agent deterministically).
- Never call the real Groq models in the normal test run. A separate, opt-in agent evaluation set may use them when Divyansh asks.
- A known bug that isn't fixed yet is recorded as `test.fixme` / `pytest.mark.xfail` with a note, never deleted.

## 4. Running it locally (Windows)

```powershell
# backend (from repo root)
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt uvicorn pytest ruff
# no DATABASE_URL → in-memory sample data. Never point local dev at the production Neon database.
# optional, only to try the agent locally:
$env:GROQ_API_KEY_AGENT="..." ; $env:GROQ_API_KEY_SPEECH="..."
uvicorn api.index:app --port 8000 --reload

# frontend (second terminal)
cd web
npm install
npm run dev          # http://localhost:5173 ; /api is proxied to :8000
```

- Never print, log, echo or commit secrets. Do not run `vercel env pull` into the repo; it would bring the production `DATABASE_URL`.
- The live site is `https://kova-seven-omega.vercel.app` (Vercel login protection is on). Production data lives in Neon and is shared by every deployment.

## 5. Map of the code

| Path | What it is |
|---|---|
| `api/index.py` | Vercel Python entry; imports `backend.app:app` |
| `backend/app.py` | FastAPI routes: generic JSON docs, updates, requests ops, outbox, portfolios, learning, goals, prospects, search, reset, health |
| `backend/store.py` | JSON document store: `PgStore` (Neon, one table `kova_docs` + `kova_meta`) or `MemoryStore`; seeding from `data/` with date shift; `SEED_VERSION` |
| `backend/actions.py` | Every RM action (schedule meeting, product feedback, message, MoM, reimbursement, service request, note, prospect update, ticket) + outbox + timeline + simulated team replies |
| `backend/agent.py` | Page agents (client, prospect, product): system prompt, read tools, propose tools → approval cards, validation, sessions, decide, transcribe, read-bill, dev test routes |
| `backend/llm.py` | Groq gateway: two keys with fallback, model fallback, rate-limit wait, call log |
| `data/*.json` | Sample data, generated by `scripts/gen_data.py` (anchor date 2026-10-26) |
| `web/src/App.tsx` | Routes |
| `web/src/shell/` | Login, Shell (top bar, dock), SearchPalette (⌘K), ProfileMenu (+ `resizeImage`) |
| `web/src/pages/` | One file per page; `shared.tsx` has ContextBar, ActionsPanel, forms, Timeline; `Updates.tsx` is the fixed Home panel |
| `web/src/agent/` | `AgentPanel.tsx` (sessions, chat, approval cards, bill attach), `useSpeech.ts` (hybrid speech) |
| `web/src/widgets/registry.tsx` | Home widget library and default layout |
| `web/src/ui/index.tsx` | Avatar, Num (number with source tooltip), Status pills, Panel, Drawer, Modal, Toasts, links |
| `web/src/charts/index.tsx` | Hand-drawn SVG charts: Donut, HBars, Columns, Area, AllocBar |
| `web/src/lib/` | `api.ts` (fetch + cache + `invalidate`), `format.ts` (₹ lakh/crore, dates), `data.ts` (hooks, segments, stages, suitability), `session.ts` |
| `web/src/styles.css` | The whole design system (tokens at the top) |

## 6. Rules that must not be broken

**Product and compliance**
- Every agent action is an **approval card**. Nothing is "sent" until the RM approves; approved actions go through `backend/actions.py` and land in the **outbox** with the exact payload, recipient, time, what the RM said and the card id. Never bypass this.
- Agents are **page-specific** (client, prospect, product). There is no global agent. Do not add one.
- **Consent** is respected in code: no WhatsApp to a client without WhatsApp consent; personal details only with profile-enrichment consent.
- **Suitability before rewards.** Never rank or suggest products by incentive points. One suitability rule (`fitsProfile` in `web/src/lib/data.ts`, `suitable()` in `backend/agent.py`): diversified products up to two risk levels above the profile, PMS/AIF only for moderately aggressive and above. Keep both sides in sync.
- **Sample data only.** No real client data, ever. Product manufacturers are deliberately fictional so made-up returns can't be mistaken for real funds.
- Sessions are **archived, never deleted** (audit trail).

**Code**
- All entities are JSON documents. The same JSON is the API response and what the agent reads. Keep that shape; extend fields rather than invent parallel structures.
- New RM actions go into `backend/actions.py` (`ACTIONS` map) so the manual Actions panel and the agent share one code path.
- Frontend data goes through `useApi` / hooks in `lib/data.ts`; after a write call `invalidate('/c/<collection>')`.
- Money and dates only through `lib/format.ts` (`inr`, `when`, `date`, `ago`). Indian format (₹12,34,567; ₹1.2 Cr; ₹45 L).
- Changing sample data: edit `scripts/gen_data.py`, run it, and bump `SEED_VERSION` only when Divyansh agrees (it resets production data on deploy).
- No new npm/pip dependencies without asking. TypeScript must pass `tsc -b` with `strict`.

**Design (KOVA brand)**
- Colours only from the tokens in `styles.css`: forest `#1D3A2E`, deep forest `#0F1F18`, cream `#F3F0E8` page, paper `#FBFAF6` panels, stone, line, **brass `#9A7A47` used sparingly** (agent, attention, rewards — the "held O" ring motif), ink `#3B3A35`. Gains leaf green with ▲, losses terracotta with ▼; never colour alone.
- Type: Jost (display), Instrument Sans (body), tabular numbers.
- Copy: sentence case, plain verbs, no all-caps labels, no eyebrow labels, no hype. Buttons say exactly what happens. Errors say what happened and what to do.
- Every number shown should be able to say where it came from (`<Num src asOf>`).
- Calm and classy: quiet by default, brass only where something needs the RM.

## 7. When you finish a task

Reply with: what changed, why, the exact checks you ran and their results, screenshots or URLs checked, what's untested, and the next step you'd suggest. Keep it short. If you changed nothing because you need a decision, say exactly what decision.
