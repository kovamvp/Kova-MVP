# KOVA — full project context

Last updated: 24 October 2026. Written at the hand-over from the build session to local Claude Code. Repo `kovamvp/Kova-MVP`, last commit `6080b11` ("Reseed demo data after testing"), live at `https://kova-seven-omega.vercel.app`.

---

## 1. What KOVA is

KOVA is an Indian wealth management company being built from scratch.

- **Clients:** mass affluent and HNI individuals and families (UHNIs and family offices later, likely on advisory). The bet: as India's economy grows, money moves from real assets (property, gold) to financial assets, pushing more people into this segment.
- **Licences:** a SEBI Registered Investment Adviser (RIA) **and** a distributor (earns commission from AMCs and manufacturers) in the same entity. Most clients are expected to be distribution clients. KOVA will also hold broking and depository participant licences (its own broker, its own dealing desk for bonds and equity), and offer loans against securities through its own NBFC and partner lenders. Insurance is not in scope.
- **The hook: portfolio-first.** KOVA sells a client a **portfolio**, not a product. If a client wants to talk about a single product, the conversation still nudges, gently and without pushing, toward the portfolio view. Competitors like Dezerv do a version of this; KOVA's edge is to combine it with business expertise and an AI-native platform.
- **Three businesses over time:** B2C (RM-led, split by region or product), B2B (IFAs and CAs as partners; Kova never poaches partner clients), and digital/DIY (later). No NRI or GIFT City for now.
- **Platform shape (3-year vision):** three apps on one backend — **Kova Client**, **Kova Work** (all employees: RMs, CX, Ops, product managers, CIO, finance, heads, CEO) and **Kova Partner**. One login per person; role-based access down to field level; customisable dashboards but standard transaction and reporting journeys.
- **North star:** *Kova is an AI-native wealth company. Every client gets a portfolio, not a product, and complete visibility of their money. Every employee works in one system that remembers everything, so their time goes to clients, not admin.*

**Differentiators the platform must deliver**
1. AI-native employee operating system: one login, a copilot on every page, no manual data entry, **AI drafts and humans approve**.
2. Portfolio-first, branded proposition (model portfolios from the CIO, proposals, approvals, rebalancing).
3. Client transparency: order tracker, money calendar, "My vs Recommended", a recommendation ledger.
4. Proactive relationship engine: events become ranked reasons to call; **the RM always hears first**.
5. One consent-aware source of client truth (DPDP Act, Account Aggregator).
6. Built new: one data model, every action an event, roles by configuration.

**Hard constraints from leadership:** client data and Kova's IP must never train or leak to model vendors (real product: Claude on Amazon Bedrock with India-only inference); Indian data residency for real data; no recording of client meetings (RMs speak a voice note afterwards instead).

## 2. People

- **Divyansh (Dhruv):** building the MVP alone with AI. Software engineering background, strong in Python/FastAPI, newer to TypeScript and to the wealth industry. Owns platform decisions and KOVA's branding.
- **Krishna:** KOVA leadership and the decision-maker on the MVP. Former SDE (10–12 years ago); persuaded by logic, facts and statistics. Has approved the JSON export of portfolios, the stage model for prospects, and the MVP budget and timeline.
- Other names in the mock data (Rohan Kapoor branch head, Anand Iyer CIO, Meera Joshi / Siddharth Rao / Farah Khan product managers) are fictional.

## 3. History of the work so far

1. **Discovery** from two recorded conversations between Divyansh and Krishna, research on Indian and global wealth platforms (360 ONE, Zerodha, Groww, Dezerv, private banks), DPDP Act and Account Aggregator.
2. **KOVA Platform Blueprint** and **System Map** (interactive pages) — the 3-year capability map.
3. **KOVA MVP Plan v2** (Word document, 23 Oct 2026) — the plan for the real MVP. Summarised in section 4.
4. **This repo: the mini MVP** of Kova Work for RMs only (sections 5–9). Built 23 Oct 2026, deployed on Vercel.
5. **Logo/brand:** the green "Two hands, one foundation" logo — the K of KOVA turned on its side as a foundation holding a brass O (the client's whole wealth, held). Story: security, stability, symbiosis between client and Kova. Never flashy.

## 4. The real MVP we are working towards (capabilities, not infrastructure)

The real MVP is an **internal working pilot for learning and confidence**: test Kova's concepts in real use (RM efficiency, workflows, data flow between roles, client transparency) before the full product is built.

**Stages**
- Stage 1 (internal, synthetic data): Krishna and stakeholders (leadership alpha), then 3–5 design-partner RMs, one CX/Ops person, one product manager.
- Stage 2 (client pilot, real data in a separate environment): plus 10–20 consenting clients transacting per product, DIY or RM-assisted; Ops records execution manually until live connections exist.
- Stage 3: more RMs and clients; live Account Aggregator, KYC and order platforms.
- Not in MVP: partners, DIY-only clients, corporate teams, Kova's own trading core.
- Timeline: start first week of November 2026; leadership alpha late December; RM beta late January 2027; Stage 2 go-live March; decision gate mid-May 2027. Budget cap ₹50,000–1,00,000 for tools, cloud and AI.
- Build approach: **keep-grade** modules (built properly, carried over: approval-card pattern, permissions, workflows, points ledger, design tokens, context layer) vs **probe-grade** modules (fast, to learn, may be thrown away).

**Kova Work capabilities (RM and internal teams)**
- **Client 360 and family:** layered visibility, family setup (head, members, delegates), RM-assisted risk profile, consented social profiling (Stage 2), family balance sheet later.
- **Leads and prospects:** capture by voice or form (PAN as key; duplicates across RMs go to the head), consent at capture, prospect profile with AI (CAS/AA one-time with consent), pipeline and stages, target lists, call plans, AI next-best action, referral credit; PM and CIO teams see prospect needs and suggest funds as opportunity notes.
- **Meetings (full module):** schedule from client page, Today or voice; meeting types; auto prep pack (holdings and performance since last meeting, last MoM and open promises, cash flows, CIO talking points, fitting products, open tickets, risk profile status); suggested agenda; client-ready view during the meeting; **after the meeting the RM speaks a voice note → AI transcribes (Hinglish eventually), asks follow-up questions, drafts approval cards** (MoM for the client, internal note, profile/goal updates, product interest, product feedback, follow-up tasks, next meeting, service request, re-profiling flag, proposal draft); outcome from a fixed list; promise tracker; meeting analytics feeding KPI points.
- **Today workspace, copilot and nudges:** the RM copilot (floating mic, page-aware, approval cards); nudge engine with AI routing and RM-first timeout ("Reliance −5%, 20 of your clients exposed, here's a draft message").
- **Advice and portfolio:** versioned CIO model portfolios, proposal studio with approval, recommendation ledger, rebalancing later.
- **Products (PM module):** product master with structured terms and visibility, fit rules and opportunity notes, rewards and contests per product, holder lists and funnel analytics, learning content, product alerts to RMs of holders, feedback inbox.
- **Research:** light house view and a market event desk.
- **Account opening and operations:** RM-assisted account opening (simulated in Stage 1), order lifecycle, **AI maker-checker with a human checker-checker**, OTP consent capture, service requests to CX.
- **Holdings and lifecycle:** holdings, lifecycle engine, money calendar, basic performance.
- **Communication:** in-app and email; **WhatsApp (Meta Cloud API) is a Stage 1 must-have** in the real MVP (test numbers only), replies captured to the timeline.
- **RM growth:** KRA/KPI and points engine (credit split by hierarchy and transaction, slabs and gates, clawback, append-only ledger), incentives dashboard with contests and leaderboards, earning guide that never pushes mis-selling, RM profile with shareable card.
- **Management:** org, coverage, approval matrix; CEO drill-down analytics.

**Kova Client capabilities (Stage 2):** DIY account opening, in-app risk profile, consents and Privacy Centre, home and portfolio, My vs Recommended, money calendar, holdings via CAS/AA, proposal review and approval, DIY orders, RM-assisted order approval by OTP, order tracker, meetings and MoMs, one-tap contact with RM, service requests, notifications, explore page whose digital signals reach the RM.

**Platform capabilities:** fine-grained permissions and admin role templates, workflows/events/timeline/rules/audit log, agent orchestrator + **Kova Context Layer** (Kova's IP: domain graph, prompts, tool registry, per-client memory, feedback store) + model gateway, consent and privacy, AA sandbox, **simulation engine** (time machine, event injector, plain-language scenarios), notifications, compliance check on outgoing messages.

**AI split:** AI (voice note → MoM and cards, meeting prep, product Q&A, message drafting, proposal rationale, next-best action, earning guide); hybrid (AI classifies, rules route; rules rank nudges, AI writes; rules decide fit, AI explains; maker-checker); pure rules (suitability, risk scoring, proposals from CIO models, drift, timeouts, points and slabs). **Guardrails: every output is an approval card; agents act with the user's permissions; every number links to its source; prompts, outputs and decisions logged; a test set per agent.**

## 5. The mini MVP (this repo): purpose and decisions

**Why it exists.** Divyansh was asked to build, alone and fast, a mini version of the MVP as a starting point: **Kova Work for RMs only**, with the complete interface — every page, every redirect, every feature *visible* — on mock data, with only certain features genuinely working. It is a test of the concepts and of the agent, and a reference for the real build.

**Decisions taken (with Divyansh)**
| Topic | Decision |
|---|---|
| Users | One RM persona: Priya Sharma, Senior RM, Mumbai West (`RM-0042`). Mock sign-in. |
| Look and feel | Classy, subtle, user-friendly, based on the green logo; research on private-bank and Indian wealth apps. Cream light mode; dark mode later. |
| Data | Everything (clients, portfolios, communications, products) is JSON, used as API responses and by the agent, shown beautified in the UI. |
| Saving | Hosted Postgres (Neon) so the demo looks the same on every device. |
| Agent actions | Never really sent. Every approved action goes to a **mock outbox** showing exactly what would have been sent, to whom, when, from which card. Editable, with "correct / needs fixing" marks to build a test set. No WhatsApp this phase. |
| Speech | Free, English only. **Hybrid:** browser Web Speech API for live text while speaking (Chrome/Edge desktop) + recording sent to Groq Whisper on stop, which replaces the live text. Tap to start, tap to stop, transcript editable before sending. No iPhone target. |
| Mic behaviour | Tap/tap, live transcript, edit before sending. |
| Product "10-minute download" | A written brief (or the PM's video link if one exists). No audio. |
| Working features | Client agent (top priority), prospect agent, product agent, L&D progress, dashboard drag-and-drop, Studio flows, Five Goals, Requests. Onboarding is screens only. |
| Agents | Page-specific only (client, prospect, product). **No global agent** — Divyansh never asked for one. Reimbursements go through the client agent with a bill upload. |
| Sessions | Kept per client/prospect/product; list of past sessions + "New session"; archive, never delete. |
| Other teams | Their approvals and replies are simulated. |
| LLM | Groq (not Claude) for this mini version: `openai/gpt-oss-120b` for agents (fallback `gpt-oss-20b`), `qwen/qwen3.8-27b` for reading bills, `whisper-large-v3-turbo` for speech. Two keys (`GROQ_API_KEY_AGENT`, `GROQ_API_KEY_SPEECH`) back each other up. |
| Hosting | Vercel (Hobby plan; Pro recommended before anyone outside the team uses it — Hobby is non-commercial). Neon Postgres and Vercel Blob connected (Blob not used yet; images are stored as small data URLs). |
| Profile menu names | My profile · Preferences · **Handbook** (not "Help"/"Guide") · Sign out. No notification bell: alerts live in Home's fixed panel. |
| Prospect stages (Krishna) | Lead → Prospect → Registered (mobile + email) → KYC in progress → Investing client (MF, bonds, FDs: KYC, PAN, bank, FATCA, nominee, risk profile) → Investing and trading client (demat, trading, exchange UCC, DDPI) → product add-ons (PMS/AIF, advisory agreement, LAS) → Closed (kept, reopenable). |
| Client segments | Active (transacted in 6 months), Engaged (in touch, no transaction), Dormant (no contact or transaction in 6 months), Lost (fully redeemed). |
| Portfolio JSON export | Approved by Krishna. |

## 6. Final scope of the mini MVP and status

W = working · D = designed with mock data (inner pages light) · O = out of this iteration. All items below are built to the status shown.

**Shell (S):** S1 sign-in, one persona — W · S2 bottom dock with 8 sections (Home, Clients, Prospects, Meetings, Studio, Products, Growth, Requests) — W · S3 top bar: mark, search, profile photo — W · S4 global search ⌘K over clients/prospects/products/portfolios/meetings — W · S5 bell/inbox — removed · S6 profile menu — W (Handbook page D) · S7 My profile — D · S8 Preferences — D (with a working "Reset demo data") · S9 upload profile photo — W.

**Home (H):** H1 widget library — W (18 types; "pick" widgets reusable per client/prospect/product/portfolio/meeting/goal/contest/request, plus summaries) · H2 drag, drop, resize, layout saved in the database — W · H3 default layout with one component from each page — W · H4 pin any item as a widget — W · H5 fixed **Updates & upcoming** panel (not movable), ranked by priority and deadline, fed from every page — W · H6 done/snooze with undo — W · H7 tasks inside updates — D · H8 research widget — D.

**Clients (C):** C1 analysis (stats, health donut with segment rules, assets by risk profile, red flags, "what to do next" with one-click actions) — D · C2 list with search, segment chips, risk filter, sort — W · C3 families view — D · C4 "Onboard a client" pop-up with prospect-to-client step-through (screens only) — D · C5 client page with colour-coded timeline (notes brass with lock, sent-to-client forest, client actions outlined, agent actions brass ring, system grey; filterable legend) — D · C6 consent strip, prominent — D · C7 portfolio side panel (allocation vs band, holdings by class, CIO stance, maturities, "worth a conversation" suitable products) — D · C8 Actions panel: every item works by hand (schedule, message with consent, MoM, feedback, note, reimbursement, service request; prospect stage) through the same `actions.py` code as agent cards — W (Phase 1) · C9 quick actions Call, Schedule, MoM on WhatsApp, Feedback, Reimbursement (opens the claim form) — D + W · **C10 client agent — W**.

**Prospects (P):** P1 analysis with opportunities and one-click actions — D · P2 list — W · P3 prospect page — D · P4 stage tracker — W (Phase 2: forward moves gated by the readiness steps behind each stage, back moves always allowed; readiness steps marked done by the RM as a demo stand-in for Operations; prospect → client only when the RM confirms, recording consent; creates the client + family, carries the timeline, welcome email to the outbox; agent can only propose it as a card) · P5 closed list at the bottom with toggle and reopen — W · P6 PM/CIO suggestions — D · P7 Proposal panel; no portfolio → link to Studio with the prospect pre-tagged — W · P8 Actions panel — W (Phase 1: every item works by hand) · **P9 prospect agent — W** · P10 create prospect — W · P11 "Create Kova Client access" toggle, inactive — D.

**Meetings (M):** M1 calendar day/week/month — D · **M2 meetings scheduled by the agent (or by hand) appear in the calendar, with a brass ring when the agent set them up — W** · M2b reschedule / edit details / cancel (reason kept internal) / mark didn't attend, from the meeting drawer or an agent card, with a change history on the meeting, a timeline entry, and an updated invite or cancellation in the outbox — W (Phase 3) · M3 next up with prep pack — D · M4 needs-a-MoM list, one tap opens the agent pre-filled — D/W · M5 promises — D · M6 history and search — D · M7 insights — D · M8 MoM to attendees, silent update to seniors (copy only) — D · M9 online meeting links — O.

**Portfolio Studio (F):** F1 landing lists Drafts / Awaiting approval / Approved / Practice — D/W · F2 create from a recommended (CIO model) portfolio — W · F3 from scratch — W · F4 import JSON — W · F5 with the agent — D (screen only) · F6 unique ID (`PF-2026-000123`), name, starting amount — W · F7 canvas: shelf by category, add products, amount or % per line — W · F8 constant right panel: tag, amount, allocated/remaining, asset mix vs equity band, illustrative return, weighted cost, illiquid share, deviation from CIO model, overlap with holdings, suitability flags — W · F9 tag client or prospect — W · F10 send for approval → Requests, CIO decision simulated (high flags → changes requested) — W · F11 field-level agent buttons say "coming soon" — D · F12 JSON export — W.

**Products (R):** R1 analysis (book by product type, most held, fits your clients) — D · R2 list with learning status (Start / Continue n/m / Completed) — W · R3 product page (CIO view in forest, rewards card in brass with guardrail, highlights/risks, details, PM comments, holders, clients it suits) — D · **R4 learning side panel with steps (reading, video placeholder, documents, quiz) and progress — W** · **R5 product agent: questions, 10-minute brief, clients who fit, feedback to the PM — W** · R6 house view & research tab — D.

**Growth (G):** **G1 Five Goals at the top (add, edit, mark achieved, remove; manager goals labelled and locked; achieved list) — W** · G2 points, slab track with projection, projected payout — D · G3 KPI breakdown — D · G4 contests (auto-enrolled, leaderboards) — D · G5 ways to close the gap with the suitability guardrail — D.

**Requests (Q):** Q1 waiting on me / with other teams / completed — W · Q2 portfolio approvals — W · Q3 simulated replies from other teams (requests advance on a short script as they're read; page polls every 15 s) — W · **Q4 outbox: exact payload of every approved action, what the RM said, source card/session, editable (original kept), JSON view, correct/needs-fixing marks with note — W** · Q5 raise a ticket (team lead as assignee, client, priority, subject, summary, attachments, due date) — W · Q6 nudge, escalate, auto-reminders — W (simple) · Q7 ticket by mic or AI — O (chips say coming soon) · Q8 expenses — W (Phase 1): policy checks, bill slot, branch-head step above limits; payment cycle and gift register not built.

**Out of this iteration:** real onboarding/KYC, WhatsApp sending, real calendar sync, online meeting links, prospect app access, AI/mic tickets, full expenses flow, dark mode, phone polish, other roles' apps (PM, CIO, CX, CEO), real data of any kind.

**Expenses (Phase 1, built 28 Oct).** `backend/expenses.py` holds the policy (`_single/expense_policy`, defaults when unset: ₹10,000 monthly cap set by Divyansh's decision, bill required above ₹500, claims within 60 days, per-category limits, GSTIN advised above ₹5,000) and `check()` (block / approval / info). Claims above a category limit or the monthly cap go to the branch head (Rohan Kapoor, simulated) before Accounts. Each agent reimbursement card holds its own bill (`card.bill`) and checks; a bill sent with a message goes to the card with the matching amount; cards without one show an Add bill slot and can't be approved until it's attached (older cards are upgraded when opened). The branch head edits the policy in Preferences (demo role). Reset demo data restores the defaults.

**Original proposal (agreed in principle):** categories (client meals, local travel, outstation travel, client gifts with a compliance gift register, events, phone/internet); limits per category and grade; receipt mandatory above a threshold; GST details; client link for client costs; automatic policy and duplicate checks; RM submits (agent reads bill) → manager approves above a limit → Accounts verifies → paid in the cycle.

**Prospects (Phase 2, built 28 Oct).** `backend/prospects.py`: `gates()` per stage (Prospect needs need + investable + phone or email; Registered and KYC in progress need mobile/email verified; Investing client adds PAN/KYC, bank, FATCA, nominee, risk profile; Investing and trading client adds demat, UCC, DDPI), `move()`, `mark_step()` (risk profile records the result), `convert()` (action `convert_prospect`). Converted prospects keep `converted: {client_id, date}`, leave the open list and can't be moved or reopened. New clients start `engaged` with no holdings; their page offers "Build their first portfolio".

**Meetings (Phase 3, built 29 Oct).** Actions `reschedule_meeting`, `edit_meeting`, `cancel_meeting`, `mark_no_show` in `actions.py`; `clash_with()` is the one overlap check. Completed, cancelled and no-show meetings can't be changed. Each change appends `{at, what, by, from, to, reason}` to `meeting.changes`. Reasons never reach the client. The agent has `propose_reschedule_meeting` and `propose_cancel_meeting` (client and prospect pages), validated for ownership, weekday, past time and clashes.

**Cycle 2, Sprint 1: foundations (built 30 Oct).** From the feedback meeting with Krishna, a new cycle of 14 sprints (foundations → drill-down cards → client page → prospects → meetings plan/list → meeting summary/MoM/chains → pipeline → approval matrix → Studio ×3 → products → learning → home). Sprint 1 adds shared data only:
- `backend/taxonomy.py`: one classification, asset class (Equity, Debt, Gold, Cash) → product type → subcategory → product, including types Kova doesn't sell (SIF, direct equity, ETF, REIT/InvIT…) for outside holdings later. Products carry `asset_class`, `product_type`, `subcategory`, `benchmark_id`. `GET /api/taxonomy`.
- Holdings carry `account_id`, `held_at` ("Kova") and `on_shelf`; clients carry `holding_accounts` (one Kova account each for now; outside accounts come with Studio statement import).
- `backend/tiers.py`: client tiers by **household** assets with Kova, beside the activity segments. **Rise** below ₹5 Cr · **Ascent** ₹5–10 Cr · **Summit** ₹10–20 Cr · **Zenith** ₹20 Cr and above (Divyansh chose the names; thresholds set from the sample book: 3 Zenith, 2 Summit, 4 Ascent, 3 Rise families). Stored as `tier` on families and every member; `tiers.refresh()` recomputes. New clients start in Rise. `GET /api/tiers`.
- `backend/history.py`: illustrative month-end `history` on every client from two fiscal years back (`{month, value, invested, revenue, by_class}`), ending exactly at today's AUM, invested and `revenue_ytd`; a `benchmarks` collection of 13 indices (150 months each). Fiscal year April–March (`fy_start`, `fy_label`). `GET /api/book/history` sums the book.
- UI: tier pill (four steps filled to the tier, plus the name) on the client list, families and client page; tier filter that combines with segments; client code beside every client name and searchable.
- "Active" still means transacted in 6 months (redefinition not confirmed).

**Cycle 2, Sprint 2: drill-down and comparison cards (built 30 Oct).** One card pattern for every analysis card, in `web/src/ui/Drill.tsx` (`DrillCard`, `Change`) with the logic in `web/src/lib/drill.ts` (`drill`, `comparePoint`, `pointLabel`, `revenueSoFar`, unit-tested).
- Levels: asset class → product type → category → product → the clients who hold it (client lines open the client page; product lines also link to the product page). Breadcrumb and back arrow to go up. A card can start at any level (the Products page starts at product type).
- Comparison: Month (vs a month ago), Quarter (vs three months ago), FY (vs 31 March). "Now" is current holdings; the earlier figure is the client history's `by_product` split (new migration). Lines that didn't exist then say "New"; sold-out lines say "Exited". The chosen period is remembered per viewer (localStorage `kova.period`).
- Live on Home "Book at a glance" (with revenue this fiscal year vs the same months last year) and Products "Your book by product type" (replaces the donut). Default Home layout gives the book card more height (only applies to layouts not yet saved).
- Sample market path changed to a calmer one (`kova-market-v245`, equity volatility 4% a month): equity ~14% over a year, ~12% a year over ten. The book grows from ~₹46 Cr (Apr 2024) to ₹142 Cr because of when the sample holdings started; revenue growth follows.

**Cycle 2, Sprint 3: client page (built 30 Oct).**
- `backend/profile.py`: profile in sections (Identity and KYC, Family, Work, Lifestyle and interests, What they own outside Kova, Preferences, How they decide) stored as `client.profile[section][field]`. **Locked** (change only by service request, each mapped to a category): name, date of birth, PAN, mobile, email, KYC, accounts, nominee, bank, risk profile. Lifestyle needs profile-enrichment consent. Edits log to `profile_changes` `{at, by, section, field, from, to}` and the timeline; occupation, interests and notes mirror the older top-level fields the agent reads. Actions `update_profile`, `add_custom_field`, `update_custom_field`, `remove_custom_field` (removed values stay in the change log). `custom_fields: [{id, label, type, value, section, options, added_by, at}]`; types text, number, date, choice, yes/no, tags. Field library in `_single/field_library` (defaults + RM-added). `GET /api/profile/library`.
- `backend/insights.py` (rules, no AI): **flags** with `why` and a `cta` (no nominee → nominee update request; equity above band → Studio; risk profile over 18 months → book a review; no contact in 6 months → check-in; holding under CIO review → product page; maturity within 30 days with no meeting → plan reinvestment). **Actionables**: meetings in the next 24 hours (else the next meeting), maturities in 6 months, cash flows in 12 months. **Comparisons**: 12-month return (modified Dietz, net of money added) vs a benchmark blend by allocation, revenue this FY vs the same months last year and since history starts, meetings in the last 90 days vs the 90 before. `GET /api/clients/{id}/insights`; it also stores the flags on `client.red_flags` so the list page stays in step.
- Service requests have categories (Demographic update, Family details update, Nominee update, Bank account change, KYC re-verification, Statement or certificate, Transaction issue, SIP or STP change, Other); the form can open pre-filled from a flag or a locked field. The agent's service request tool takes the category too.
- Client page: comparison stats, "Needs you" (flags + actionables, each with its button), holdings on the drill card (asset class → product), profile panel with an edit button per section and "Add a field". Client list: "Last contact" filter (30 days, 3 or 6 months) combining with tier, segment and risk.

**Cycle 2, Sprint 4: prospects (built 30 Oct).** In `backend/prospects.py`:
- **Structured needs** `needs: {goal, horizon, asset_classes}` beside the free-text `need`. Goals: Grow wealth, Regular income, Preserve capital, Plan for a goal, Invest a windfall, Save tax, Retirement, Not sure yet. Horizons: under 1 year, 1–3, 3–5, 5+ years. Editable by the RM (Needs and consent panel) and proposable by the agent (`propose_update_prospect.needs`).
- **Capture** (`create()`): a mobile or email is required; both start `contact_verified: false` and flip when the "Mobile and email verified" readiness step is marked. **Consent at capture** `consent: {whatsapp, email, marketing, captured_on, version}`; only the RM changes it (the agent can't). WhatsApp to a prospect without consent is refused by the action and by the agent's validation (closes known issue 7).
- **Duplicates** (`duplicates()`, `POST /api/prospects/check`): matches mobile (last 10 digits), email (any case) or PAN against your clients, your prospects and a sample directory of other RMs' books (`DIRECTORY`; the real product queries the firm's book). Your own client/prospect → refused (409) with the record to open; another RM's → created with `ownership: {status, with_rm, matched_on, request_id}` and a simulated "Ownership check" request to the branch head (who settles it for you). Another RM's person is never shown by name.
- Prospects page: "Pipeline by stage" and "Where they come from" bars open the list at that stage or source, with one line on why. The add form has goal, horizon, asset classes, consent and a live duplicate warning.

## 7. How the agent works (the core working feature)

**Flow.** RM opens a client/prospect/product page → brass orb in the floating bar → session list (past sessions + "New session"; archived toggle) → chat. The RM types, or taps the mic (live words appear; on stop Whisper's transcript replaces them; the text is editable) → `POST /api/agent/sessions/{sid}/message`.

**Server loop (`backend/agent.py`).** Builds a compact system prompt: RM identity, current IST time, a list of the next 15 dates with weekdays, rules, and a JSON brief of the scoped entity (client brief + holdings line, prospect brief, or product brief + learning progress). Sends the last 10 session messages. Up to 6 tool rounds.
- **Read tools** (run immediately): `get_holdings`, `get_family`, `get_meetings`, `get_calendar`, `find_products`, `get_product`, `clients_for_product`, `get_open_requests`.
- **Propose tools** (create an approval card, never execute): `propose_schedule_meeting`, `propose_send_message`, `propose_log_mom`, `propose_product_feedback`, `propose_reimbursement`, `propose_service_request`, `propose_add_note`, `propose_update_prospect`. Tools available differ by page (`SCOPE_TOOLS`).
- **Validation** before a card is created (errors go back to the model so it corrects itself): unknown ids; meeting time in the past; **weekday mismatch** with what the RM said; calendar clash; WhatsApp without consent; reimbursement without client or amount.
- **Prompt rules:** never claim something was sent; propose all needed cards together; attendees are Kova colleagues only; for MoMs fill summary/feedback/portfolio reaction/changes/promises and **end with one or two questions about what's missing**; respect consent; suitability first, never push for points; warm Indian-English client copy signed by the RM; short replies to the RM; Indian amounts.
- **Cards:** shown with ordered, editable fields; Approve / Edit / Reject. Approve calls `POST /api/agent/sessions/{sid}/cards/{cid}` → `actions.run()` (same code as the manual Actions panel) → real records + outbox entry + timeline entry + Updates entry (+ simulated request where relevant). An event line is added to the session so the model knows what was approved.
- **Bills:** paperclip in client sessions → image resized in the browser → `POST /api/agent/read-bill` (Qwen vision) → merchant, date, total, GSTIN, category, confidence → chip above the composer → sent with the message → reimbursement card; the bill image is attached to the Accounts request on approval.
- **Gateway (`backend/llm.py`):** tries the agent key then the speech key, then the smaller model; on rate limits from all keys waits once for the suggested time. `/api/agent/gateway` shows recent calls and which key served them.
- **Speech (`web/src/agent/useSpeech.ts`):** `getUserMedia` → audio level meter for the waveform; `MediaRecorder` records; `SpeechRecognition` (`en-IN`, continuous, interim results, auto-restart on `onend`) shows live text; on stop the recording goes to `POST /api/agent/transcribe` (Whisper); punctuation-only results are ignored; fallbacks either way.

**Verified on the live deployment (23 Oct):** multi-intent client request → three correct cards (feedback, MoM, follow-up on the right Wednesday after the weekday fix); approving the MoM attached it to that day's meeting, created the outbox email and a MoM-acknowledgement request; prospect WhatsApp nudge + stage change; product 10-minute brief + two suitable clients; bill read exactly (₹3,478, GSTIN, date) and turned into a reimbursement card; Whisper path returns 200. Rate limits hit the agent key repeatedly; the second key took over each time.

## 8. Data and simulation

- **Collections** (each a list of JSON docs with `id`): `clients` (24, in 12 `families`, ~₹142 Cr), `prospects` (16), `products` (27, fictional manufacturers, with CIO view, rewards, learning modules, brief), `model_portfolios` (6 CIO models), `portfolios` (RM portfolios), `meetings`, `requests`, `updates` (fixed Home panel), `research`, `ld_progress`, `outbox`, `agent_sessions`, `handbook`, `layouts` (Home layout per RM). **Singletons:** `rm`, `growth`.
- Client documents carry: identity, family role, segment, risk profile and date, KYC, accounts (demat/trading/DDPI), nominee, **consent** (WhatsApp, email, profile enrichment, marketing, partner sharing, version, date), AUM, invested, XIRR, allocation, holdings (product, class, invested, value, since, SIP), goals, interests, notes, timeline, cash flows, red flags, revenue.
- **Dates:** sample data is written relative to 26 Oct 2026; on seeding every date shifts so "day 0" becomes the seeding day. Preferences → Reset demo data reseeds to the current day.
- **Seeding rule:** the database reseeds when the stored seed version is older than `SEED_VERSION` (forward only). Bumping it wipes production data on the next deploy.
- **Simulation of other teams:** new requests carry a short `sim` script (e.g. Accounts picks up in 1 min, approves in 3); steps apply when requests are read. Portfolio approvals: high-severity flags → "changes requested", otherwise approved.
- **Mock figures** hard-coded in the UI (net new money ₹6.9 Cr, 32% conversion, 41 days to convert, 71% follow-up rate, 12-month AUM history shape) are illustrative.

## 9. Infrastructure (for orientation only)

Vercel project `kova` (team `kova-f811`), framework none; `vercel.json` builds `web/` (Vite) into `web/dist` and serves `api/index.py` as one Python function with `/api/*` rewritten to it; SPA fallback for other paths; function region `iad1`. Env vars (names only): `DATABASE_URL` (+ Neon variants), `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `GROQ_API_KEY_AGENT`, `GROQ_API_KEY_SPEECH`, all for development, preview and production. Vercel login protection is on for `*.vercel.app` URLs. Every push to `main` deploys to production. Testing hooks (GET, side effects, protected deployment only): `/api/health`, `/api/agent/dev/run`, `/api/agent/dev/decide`, `/api/agent/dev/bill`, `/api/agent/dev/speech`.

The real MVP will move to: Python/FastAPI modular monolith, Postgres + pgvector, Temporal for workflows, OpenFGA permissions, React + TanStack, React Native client app, AWS Mumbai, Claude on Bedrock India. The mini MVP's carry-overs are the **design language, interaction patterns (approval cards, outbox, sessions, fixed updates panel, floating context bar), data shapes, prompts and the agent test set**, not its infrastructure.

## 10. Where we are against the real MVP vision

| Capability (real MVP) | Mini MVP today |
|---|---|
| RM copilot with voice → approval cards | **Working** on client, prospect and product pages (English; live text issue below) |
| Meetings: prep, voice MoM with follow-up questions, promises | Prep pack and promises designed; MoM by agent working; outcome list and analytics not built |
| Proposal studio and approval | **Working** (simulated CIO approval); no versioning or recommendation ledger |
| Model portfolios | Six static CIO models; not versioned |
| Nudge engine with RM-first timeout | Not built; Updates panel shows ranked static and action-generated items |
| Client 360 + consent | Designed and data-rich; consent enforced in the agent |
| Leads & prospects pipeline | Working list/stages/create/close; no PAN dedupe, call plans or NBA |
| Products, learning, rewards | Learning working; rewards and contests designed |
| Points engine, slabs, contests | Designed only (static numbers); Five Goals working |
| Requests, tickets, service desk | Working with simulation |
| Account opening, orders, maker-checker | Screens only (onboarding pop-up); orders and maker-checker not started |
| WhatsApp | Not sent (outbox only) by decision for this phase |
| Permissions / roles / other apps | Not started (one RM) |
| Simulation engine (time machine, events) | Only date shifting and request scripts |
| Kova Client app | Not started |
| Agent test set and feedback loop | Outbox review marks exist; no eval harness yet |
| Automated tests | Phase 0 safety net: backend, front-end unit and end-to-end suites in CI |

## 10b. Data migrations applied

| Id | What |
|---|---|
| `2026-10-31-prospect-capture` | Prospects get structured `needs`, `consent` (WhatsApp off for PR-2004, PR-2010, PR-2016) and `contact_verified` from their readiness step. |
| `2026-10-31-client-profiles` | Clients get `profile` sections from the sample data, empty `custom_fields` and `profile_changes`; `red_flags` recomputed with `id`, `why` and `cta`. |
| `2026-10-30-history-by-product` | Re-generates client history with a `by_product` split per month (and the calmer market path) and the benchmark indices. |
| `2026-10-30-product-taxonomy` | Products get asset class / product type / subcategory / benchmark id; holdings get account, held at, on shelf; clients get `holding_accounts`. |
| `2026-10-30-client-tiers` | Families and clients get `tier` (Rise / Ascent / Summit / Zenith); family `aum` recomputed from members. |
| `2026-10-30-history` | Clients get monthly `history`; new `benchmarks` collection. |
| `2026-10-28-rupee-sign` | "Rs 5,000" / "Rs 10,000,000" in sample text → "₹5,000" / "₹1,00,00,000". Agent sessions and outbox are left exactly as they were (audit trail). Snapshot: `kova_docs_snap_before_2026_10_28_rupee_sign`. |

## 11. Known issues and open questions

1. **Live speech-to-text is not working (reported by Divyansh, 24 Oct).** Do not change code until asked. Things to check when asked to investigate:
   - Which browser. **Brave** exposes `webkitSpeechRecognition` but blocks Google's speech service, so it fails with a `network` error; only Chrome and Edge on desktop work. Firefox has no support.
   - `useSpeech.ts` only surfaces the `not-allowed` error; `network`, `no-speech`, `audio-capture`, `aborted` errors are swallowed, and `onend` restarts silently, so failures look like "nothing happens". Logging `onerror` and `onstart` to the console is the first diagnostic.
   - Microphone permission and whether both `MediaRecorder` and `SpeechRecognition` can hold the mic together on the user's machine/headset.
   - Whether the final Whisper transcript still arrives after stop (if yes, only the live layer is broken).
   - Windows privacy settings for microphone access; corporate or VPN network blocking Google's speech endpoint.
2. **Automated tests** exist since Phase 0 (27 Oct): ~57 backend tests, 10 front-end unit tests, 34 end-to-end journeys, all run in CI on every pull request.
3. **Dev GET endpoints** (`/api/agent/dev/*`) write data; remove or guard before anyone outside the team gets access.
4. **Reseed on deploy:** bumping `SEED_VERSION` deletes all sessions, outbox items and changes in production. A deploy that switches versions while requests are in flight can wipe sessions created seconds earlier.
5. **Groq free-tier limits** (~8K tokens/minute per organisation); each agent turn uses roughly 3–12K tokens across tool rounds. Two people using agents at once can see waits.
6. "By Friday" said on a Friday: prompt rule added (means next week) but not re-tested on the live site.
7. ~~Prospects have no consent fields~~ Fixed in Sprint 4: prospect consent recorded at capture and enforced for WhatsApp.
8. Card fields that are ids (`with_id`, `client_id`…) are not editable in the card editor.
9. Server time is IST; the browser uses its local time zone for "today".
10. Phone layouts don't break but aren't polished. No code splitting (one ~300 KB JS bundle).
11. Vercel Hobby is for non-commercial use; move to Pro before external users. Krishna needs a Vercel share link or protection turned off to see the site (Divyansh's call).
12. English only; Hinglish is a requirement for the real product.

## 12. Suggested next steps (each needs Divyansh's go-ahead)

1. Full manual test pass of every page against section 6, logging issues (Divyansh), with you reproducing and writing tests for each.
2. Set up `pytest` + API integration tests with a fake LLM, then Playwright journeys (section 3 of CLAUDE.md).
3. Diagnose live speech (section 11.1).
4. Agent evaluation set from real RM phrasing, including Hinglish samples for later.
5. Remove or guard the dev endpoints; decide on Vercel Pro and access for Krishna.

## 13. Glossary

AUM assets under management · RM relationship manager · MoM minutes of meeting · CIO chief investment officer · PM product manager (here) · PMS portfolio management service (₹50 L minimum) · AIF alternative investment fund (₹1 Cr minimum; Cat II private credit/real estate, Cat III long-short) · NCD non-convertible debenture · G-Sec government security · SGB sovereign gold bond · FD fixed deposit · ELSS tax-saving equity fund · SIP / STP systematic investment / transfer plan · XIRR annualised return with irregular cash flows · YTM yield to maturity · KYC/KRA know-your-customer / KYC registration agency · FATCA US tax declaration · UCC unique client code at the exchange · DDPI demat debit and pledge instruction · LAS loan against securities · CAS consolidated account statement · AA Account Aggregator (RBI consent-based data sharing) · DPDP India's Digital Personal Data Protection Act 2023 · ARN/EUIN distributor registration numbers · NISM securities-market certifications · lakh = 1,00,000 · crore = 1,00,00,000.
