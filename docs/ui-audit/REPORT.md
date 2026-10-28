# Kova Work — UI and UX audit

Baseline: commit `6080b11` (`main` = `baseline-v1`), run locally on in-memory sample data, 27 Oct 2026.
Nothing in the app was changed, committed or pushed. Everything below is a proposal.

## How this was done

- **Read every UI file**: `styles.css`, `ui/`, `charts/`, `shell/`, all 15 page files, `agent/`, `widgets/registry.tsx`, `lib/`.
- **Walked 81 states at 1440, 1280, 1024 and 390 px** with a Playwright script (≈ 400 screenshots in `before/`). Every route, every drawer and modal, Home customise and the pick modal, the agent (session list, empty chat, typing, listening, bill chip, pending / approved-with-edits / rejected cards, the model-error reply), Studio create flows and the canvas in each status, the learning panel and quiz, every Requests tab, the outbox, the ticket form, search, profile menu, login.
  - Agent replies were **mocked in the browser** for the screenshots (no Groq key locally), so card states could be seen without touching the backend.
  - `<name>@<width>.png` is what the RM sees on arrival; `-full.png` is the whole page with the dock hidden, for layout review.
- **Measured, not eyeballed**, where possible:
  - horizontal overflow, focus hidden behind the dock, drawer overlap with the context bar (`before/measurements.json`)
  - a keyboard walk: tab order, focus on open/close of drawers and modals, Escape, focus traps
  - WCAG contrast for every text colour in the tokens against every surface it sits on
- **Lenses**: Vercel Web Interface Guidelines, taste-skill (app-screen chapter, since Kova Work is worked in, not read), and the KOVA brand rules in `CLAUDE.md` / `KOVA_CONTEXT.md`, which win wherever they disagree. Two examples of that: the guidelines want Title Case and the taste-skill bans "cream with terracotta"; KOVA keeps sentence case and its cream/terracotta loss colour.

**Severity**: blocker (breaks the app or a core task) · high (a core task is harder or misleading, or an accessibility failure) · medium (clear quality problem) · polish.

Every item says **why it matters**. Anything that was only decoration was left out on purpose.

---

## 1. Summary

| | Count |
|---|---|
| Blocker | 2 |
| High | 20 |
| Medium | 41 |
| Polish | 27 |
| Copy fixes (section 4.7) | 15 |
| Direction proposals (section 2) | 5 |

**What is already good and should stay.**
- The palette, the type pairing and the calm cream/forest feel.
- The consent strip on the client page.
- The CIO card on product pages.
- The approval-card pattern and the outbox's "You said" block.
- The suitability guardrail copy.
- The fixed Updates panel concept.
- The stage tracker.
- No horizontal overflow on any route at any width.
- Reduced motion is already respected globally.

**The two blockers.**
1. **A deep link to a client's Portfolio panel blanks the whole app.** Reloading or sharing `/clients/CL-1001?panel=portfolio` crashes React before products load. There is also no error boundary anywhere, so any render error is a white screen.
2. **Drawers can't be reached by keyboard.** Opening Actions, Portfolio, the agent or Learning leaves focus on the context bar. Tab then walks the page behind and never enters the drawer, because the drawer is portalled to the end of `<body>`.

**The pattern behind most of the rest.**
1. **The bottom of the screen is crowded.** The dock and the context bar sit on top of content. Side panels then cover part of the context bar, including the agent orb.
2. **Brass is no longer rare.** It is the Debt colour in every allocation bar, the Proposal meeting colour, the hover colour of every list row, every "Start learning" button and every suggestion bullet. So it no longer means "this needs you".
3. **Small text fails contrast.**
   - `--faint` fails everywhere it carries words (2.1–2.6:1).
   - `--muted` fails on cream, stone and the washes (3.75–4.2:1).
   - The gain, loss and warn pills fail at 11.5px.
4. **States are thin.**
   - Lists show "No clients match these filters" while they are still loading.
   - API errors are swallowed on list pages.
   - The agent shows three dots for 5–30 s with no other feedback.
   - Several forms can be submitted twice and fail silently.
5. **The same fact is written differently in different places.**
   - "₹1.50 Cr" next to "₹2 Cr"; "Rs 38 L" next to "₹38 L".
   - "2026-10-27" in search but "27 Oct" elsewhere.
   - Home says 2 meetings today; Meetings says 1.
   - Raw `7500000` in amount inputs.

---

## 2. The five biggest direction proposals (need your yes before building)

Each is a set of changes that only makes sense together. Small fixes are in sections 3–5 and don't need this checkpoint.

### D1. One bottom system: dock, context bar and side panels that never cover each other

**Problem, measured.**
- The dock (`.dock-wrap`, fixed, 18 px from the bottom) and the context bar (`.ctxbar-wrap`, fixed at 90 px) float over content. `--dock-space: 104px` and `.has-ctxbar` padding only protect the *end* of the page, not the middle while scrolling.
- On `/clients`, **51 of the first 140 keyboard focus stops landed under the dock** (WCAG 2.4.11, focus not obscured).
- When a side panel opens it covers the right of the context bar by **42–162 px at 1440, 122–242 px at 1280 and 250–370 px at 1024**. With Actions or Learning open, the agent orb is hidden, so the RM must close one panel to reach the agent.
- The forest dock also runs straight into the forest Updates panel on Home (`before/home@1440.png`).

**Proposal.**
1. **Reserve the space.**
   - Add `scroll-padding-bottom` (dock + context bar height) on `html`, so keyboard focus and anchor jumps stop above the bars.
   - Keep the page's bottom padding as it is.
2. **Side panels dock as a column, not an overlay.**
   - On client, prospect and product pages, opening Portfolio, Actions, Agent or Learning narrows the page instead of covering it: `main` gets `padding-right` equal to the panel width at ≥ 1280 px. At 1024 px and below, keep the overlay.
   - The context bar recentres in the remaining area, so the orb is always visible and always switches panels.
   - This is one CSS variable (`--panel-w`) set on `<body>` while a panel is open.
3. **Make the context bar the panel switcher.** The open panel's button is already `.on`; keep it, and make sure the orb and the two buttons stay clickable while any panel is open. No IA change.
4. Give the dock a 1 px `rgba(243,240,232,.12)` edge on forest surfaces, so it separates from the Updates panel.

**Why.**
- The agent is the product's core working feature, and today the RM can't reach it from the Actions panel.
- Covered rows and hidden focus make the screen feel cramped and fail an accessibility rule.

**Risk.** Layout only. Every button keeps its behaviour. The proposal panel's "Studio prefilled" link is unaffected.

### D2. Brass back to rare: a colour budget with rules

**Where brass is today, beyond the agent, attention and rewards.**

| Where | File |
|---|---|
| Debt in every allocation bar and donut (about 40% of most bars) | `ui/index.tsx:175` |
| Proposal meeting type | `pages/Meetings.tsx:8` |
| AIF category | `pages/Products.tsx:9` |
| Hover fill of every list row, table row, session row, fit row, line, palette item | `styles.css:228, 239, 427, 453, 534, 642, 351` |
| Bullet ring on every "What to do next", "Opportunities" and "Ways to close the gap" item | `Clients.tsx:110`, `Prospects.tsx:83`, `Growth.tsx:128` |
| "Start learning" and "Continue" buttons on ~20 product rows | `styles.css:567` |
| The six CIO/PM suggestion cards on Prospects, the proposal cards, the MoM block, the locked-portfolio notice: all `.note-card` brass wash | `styles.css:543` |
| A brass "coming soon" sparkle on every portfolio line | `StudioCanvas.tsx:183` |
| Five brass goal numbers, three brass contest pills | — |
| Full-brass rewards card | `styles.css:576` |

**Proposal (no new colours, only re-assignment).**

| Use | Now | Proposed |
|---|---|---|
| Debt (asset class) | brass `#9A7A47` | a muted slate `#6E7F86` or sage `#8FA79A` (validated against the other classes for 3:1 adjacency) |
| Gold (asset class) | `#C9A961` | keep: gold is its real colour, and it is a small share |
| Proposal meeting type | brass | `#5F7D6E` (sage). The meeting types also get a shape, not only a colour (see Meetings) |
| Row hover | brass wash | `--forest-wash` or `--stone` at 50% |
| Suggestion bullets | brass ring | none or a neutral 6 px dot. Brass ring only on the one item that is overdue or high priority |
| Learning buttons | brass outline on every row | quiet text action "Start" / "Continue 2 of 5" in forest. Brass tint only for "in progress" if you want one signal |
| Rewards card | full brass fill, white text (4.0:1) | paper card with a brass ring icon and brass-deep figure, placed *below* "Clients it suits" (see Products) |
| CIO/PM suggestion and note cards | brass wash | paper card with a 3 px forest left rule. Keep brass wash only for things the agent made or that wait on the RM |
| Coming-soon sparkles | brass, on every line | one muted icon in the panel header, or remove until it works |

**Keep brass for**:
- the orb, the mic, the agent ring on timeline/calendar/outbox
- the Updates priority mark
- the "today/now" line on the calendar and the current-period bar
- reward points
- focus rings

**Why.** The brand rule says brass marks what needs the RM. Today a client row's allocation bar has more brass than the agent orb. Re-assigning it makes the actually urgent things findable at a glance. That is the whole point of "quiet by default".

### D3. Readable by everyone: text tiers and status colours that pass 4.5:1

**Measured.**

| Text colour | Paper | Cream | Stone | Brass-wash |
|---|---|---|---|---|
| `--muted #77736A` | 4.52 ✓ | 4.15 ✗ | 3.75 ✗ | 4.23 ✗ |
| `--faint #A29E93` | 2.56 ✗ | 2.35 ✗ | 2.13 ✗ | 2.40 ✗ |
| `--brass #9A7A47` as text | 3.83 ✗ | | | |
| `--warn` on `--warn-tint` (pill) | 3.38 ✗ | | | |
| `--gain` on `--gain-tint` (pill) | 4.34 ✗ | | | |
| `--loss` on `--loss-tint` (pill) | 4.31 ✗ | | | |
| white on brass (btn-brass, rewards card) | 4.0 ✗ | | | |

**Opacity dimming drops text below 3:1.**

| Element | Contrast | File |
|---|---|---|
| rejected card | 2.9 | `styles.css:479` |
| timeline legend "off" | 2.2 | `:517` |
| out-of-month days | 2.2 | `:621` |
| shelf item already in portfolio | 1.8 | `:639` |
| completed calendar event | 2.3 | `:616` |
| handbook cards | 2.2 | `:692` |

**Where it shows.**
- The page lede on every page is muted on cream (`styles.css:107`).
- The login demo note, session IDs, chart axis labels, calendar hours, "No flags" and "today · 3 cards" are all `--faint`.

**Proposal (token values only; names stay).**
- `--muted: #6A665D`: 5.5 on paper, 5.0 on cream, 4.54 on stone.
- `--faint` is kept for **non-text** only: rules, disabled icons, decorative marks. Every text use of `.faint` moves to `.muted`. That is about 20 call sites, listed in section 4.
- Status text colours for words and pills (the existing `--gain/--loss/--warn` stay for bars and marks):
  - `--gain-ink #2F6B43` (5.4 on its tint)
  - `--loss-ink #93492F` (5.3)
  - `--warn-ink #835F17` (5.0)
- Brass as text always uses `--brass-deep` (5.5).
- The rewards card stops using white on brass (see D2).
- Replace opacity dimming with colour:
  - rejected and completed items use `--muted` text on their normal surface, plus the word ("Rejected", "Done")
  - out-of-month days use `--muted`
  - the "in portfolio" shelf item gets a check icon and "Added", and stays readable

**Why.** RMs read this all day, often on office monitors in daylight. Grey-on-cream at 11.5 px is exactly the text people stop reading. This also makes a later dark mode easier.

### D4. The agent panel: land on what needs a decision, explain the wait, recover from errors

Ordered by impact:

1. **Open a session at the first pending card, not the bottom.**
   - Today `AgentPanel.tsx:127` scrolls to the end on open. A session with a pending MoM card opens on two grey event pills; the card with Approve is above the fold (`before/client-agent-chat@1440.png`).
   - Fix: on open, scroll the first `.acard.pending` into view. Keep auto-scroll-to-end only after the RM sends.
2. **Say what's happening during slow calls.** Calls take 5–30 s, and up to 6 tool rounds with rate-limit waits. Today the RM sees three dots (`AgentPanel.tsx:205`).
   - Keep the dots, add one line of text that changes with elapsed time. The backend already returns `reads`, so the words can be honest and generic:
     - 0–4 s: "Thinking…"
     - 4–12 s: "Looking at Rajesh's holdings, calendar and requests…"
     - after 12 s: "The model is busy; this can take up to half a minute. Your message is saved."
   - Show the suggestion chips as disabled while busy. They already do nothing then (`send` returns early), but they still look clickable.
3. **Errors look like errors and offer Try again.**
   - The model-error reply is styled as a normal agent message, shows "No Groq API key is configured on the server", and leaves the composer empty (`before/client-agent-llm-error@1440.png`).
   - Fix: a small error row with a Try again button that resends the last RM message.
   - Needs one backend flag: see section 7.
4. **Speak to the RM as "you".**
   - "RM approved card CD-7002 (Follow-up with Rajesh Mehta) with edits" becomes "You approved the follow-up meeting, with edits."
   - "Checked: get holdings, get calendar" becomes "Looked at holdings and calendar".
   - The UI can map the tool names now (`AgentPanel.tsx:200`). The event text is written by the backend (section 7).
5. **Rejected cards are not red.** Rejecting is a normal, deliberate choice. Grey "Rejected, nothing was sent" instead of the terracotta loss pill (`ui/index.tsx:37` maps `rejected` to `loss`). Keep red for real failures.
6. **Optional reason on reject.** The backend already stores `reason` (`agent.py:468`) and the UI never sends one. A one-line "What was wrong? (optional)" after Reject feeds the eval set the outbox marks are building.
7. **Small fixes.**
   - Show the bill chip date as "24 Oct" (`AgentPanel.tsx:216`).
   - Hide Archive on an empty new session.
   - Show raw values like `priority: normal` as "Normal".
   - Add an "Enter to send, Shift+Enter for a new line" hint under the composer the first time.
   - Surface speech errors other than `not-allowed` (`useSpeech.ts:86`; known issue 11.1) as "Live text isn't available in this browser; your words appear when you stop."

**Why.** The agent is the working feature leadership will judge the MVP on. A 20-second silent wait and a buried Approve button make it feel broken even when it works.

### D5. Home answers "what needs me today" before it shows a grid

**Problems.**
- **Uneven heights.** The Updates panel stops at `100vh - 190px` (`styles.css:394`) and clips its last item mid-line with no sign it scrolls. The board runs about 90 px further, so the two columns end at different heights.
- **Broken item meta.** The "Overdue · 22 Oct, 6:00 pm | Meetings: promises" line wraps into two columns (`Updates.tsx:78-81`, `.u-meta` has no wrap rules).
- **Hidden actions.** Done and Snooze are invisible until hover (`styles.css:409`) and take width even while invisible.
- **Equal-size cards with holes.** Nine identical 4×4 cards, several with 100–150 px empty bands: Today's meetings, Malhotra plan, the client card, Requests in flight.
- **The same total twice.** ₹142 Cr appears in two widgets side by side.
- **Broken at 390 px.** The grid keeps 12 columns, so three 120 px wide cards per row truncate every title (`before/home@390-full.png`). "Phone polish is out of scope" covers untidy, not broken.

**Proposal.**
1. The Updates panel takes the full available height (sticky, `max-height: calc(100vh - topbar - dock-space - 16px)`).
   - Add a fade at the bottom of its scroll area plus "12 open · scroll for more".
   - Show Done and Snooze at 60% opacity on every item (full on hover and focus).
   - Lay out the meta as two fixed lines: due on one, source on the other.
2. **Default layout with one lead.**
   - The lead is "Today's meetings + needs-a-MoM" at 8 columns, or Book at a glance at 6. The rest at 4.
   - Drop "Assets over 12 months" from the default; it repeats ₹142 Cr and is illustrative. It stays in the library.
3. Widgets keep their own content height in the default layout (pick `h` per widget so there is no void). Where content is short, pin the footer link and let the card be shorter.
4. **Below 720 px, render the board as one column in layout order**, with no drag/resize. Only the render changes; the saved layout is untouched.
5. **Requests in flight.** The "2 waiting on you" figure is terracotta (`registry.tsx:183`). Terracotta means loss in this system; use ink plus a brass mark if it needs attention.

**Why.** Home is the first screen every morning. Right now the most important panel is the one that's cut off.

---

## 3. Stability and states (do first; no design decision needed)

- **S1 · Blocker: Portfolio deep link crashes the app.**
  - Evidence: `before/client-portfolio@1440.png` is blank. Console: "Cannot read properties of undefined (reading 'replace')" in `<Status>`. Reproduced on reload of `/clients/CL-1001?panel=portfolio`; works when opened by click.
  - Cause: `ClientDetail.tsx:208` renders `<Status s={p?.cio_view.stance}/>` before products load. `Status` calls `label(undefined)` (`ui/index.tsx:44`).
  - Fix: `Status` returns nothing for an empty `s`, and `PortfolioPanel` waits for products.
  - Why: Clients' "Plan the reinvestment" links here, and any reload or shared link white-screens.
- **S2 · High: no error boundary.**
  - `App.tsx` has none, so any render error blanks every page including the dock.
  - Fix: one boundary around `<Outlet/>` in `Shell.tsx`: "This page hit a problem. Go back or reload. Nothing you saved was lost." The shell stays usable.
- **S3 · High: false empty states while loading.**
  - Lists default to `[]` (`Clients.tsx:11`, `Prospects.tsx:11`, `Requests.tsx:25`, `Studio.tsx:24`, `Products.tsx:16`). So on first load they show "No clients match these filters.", "Nothing here right now.", "No drafts" before data arrives.
  - Fix: render skeleton rows while `loading`, and the empty sentence only when loaded and empty.
- **S4 · High: API errors on list pages are invisible.**
  - `useApi` returns `error`, but no list page reads it. A failed `/c/clients` looks like an empty book.
  - Fix: an inline error inside the block that failed: "Couldn't load clients. Retry". Detail pages already handle 404.
- **S5 · High: double submits and silent failures.** Buttons stay enabled during the request and several handlers have no `try/catch`.
  - `NoteForm` `shared.tsx:121`
  - `FeedbackForm` `shared.tsx:95` (no busy state)
  - `CreateProspect` `Prospects.tsx:180`
  - `TicketForm` `Requests.tsx:132`
  - `CloseProspect` `ProspectDetail.tsx:179`
  - stage change `ProspectDetail.tsx:33`
  - Updates done/snooze `Updates.tsx:46-56`
  - photo upload `ProfileMenu.tsx:27`
  - goal ops (has `try` but no busy) `Growth.tsx:19`
  - Fix: one small `useAction` helper (busy flag + toast on error). `ScheduleForm` already does this right (`shared.tsx:63-72`).
  - Why: a second click creates a duplicate ticket, prospect or note, and lands in the outbox and timeline twice.
- **S6 · Medium: destructive actions with no confirm or undo.**
  - "Reset to default" wipes the custom Home layout in one click (`Home.tsx:74`).
  - Removing a goal (`Growth.tsx:59`) and removing a widget (`Home.tsx:136`) are immediate.
  - A stage click moves the prospect immediately (`ProspectDetail.tsx:66`); the stage dots are big, adjacent targets.
  - Fix: Undo in the toast for all four (the toast already supports a button, see `Updates.tsx:49`). Undo restores the previous layout, goal list or stage.
- **S7 · Medium: Requests drawer "Close" is ambiguous.**
  - The footer button "Close" closes the *request* (`Requests.tsx:93`), right beside the drawer's own close ✕. An RM wanting to dismiss the panel will resolve the request.
  - Fix: rename to "Mark as resolved" plus Undo.
- **S8 · Medium: skeletons.** One full-width 300 px shimmer block stands in for whole detail pages (`ClientDetail.tsx:32`, etc.), and the shimmer is a moving gradient (`styles.css:382`).
  - Fix: skeletons in the final layout (header block, stat line, two columns) as flat stone bars, no shimmer. The layout doesn't jump when data lands.
- **S9 · Polish: the layout 404 for a new RM logs a console error** (`/api/c/layouts/RM-0042`, then default). See section 7.

---

## 4. Shared system findings

### 4.1 Accessibility and keyboard

- **A1 · Blocker: focus never enters drawers or modals.** Measured.
  - After opening Actions, 6 of 6 Tabs stayed outside the drawer. In the create-prospect modal, 11 of 25 Tabs escaped behind it.
  - Fix in `ui/index.tsx` `Drawer`/`Modal`:
    - move focus to the panel on open (title or first field)
    - trap Tab inside modals
    - return focus to the opener on close
    - add `aria-labelledby` to the title
  - Drawers without a scrim (`scrim=false`) are non-modal, so drop `aria-modal="true"` there and just move focus in.
- **A2 · High: every `<Num>` is a tab stop** (`ui/index.tsx:21`, `tabIndex={0}`).
  - On `/clients` it takes **35 Tabs** to reach the first client row; 36 of the first 140 stops are numbers.
  - Fix: make the provenance tooltip available on hover and on focus of the *row or card*, or keep one focusable "source" affordance per stat line. Numbers inside links and table rows should not be stops.
- **A3 · High: focus hidden under the dock.** 51 of 140 stops on `/clients` (see D1). Fix with `scroll-padding-bottom`.
- **A4 · High: icon-only controls without names at narrow widths.**
  - Below 860 px the dock hides its labels with `display:none` (`styles.css:700`), and the search button hides its text the same way (`:717`). Both lose their accessible names.
  - Fix: visually-hidden class instead of `display:none`, or `aria-label` on each link.
  - Also missing names:
    - the Studio sparkle buttons (`StudioCanvas.tsx:183, 195`; title only)
    - the context-bar icon buttons (title only; `ClientDetail.tsx:158-162`, `ProspectDetail.tsx:139-140`)
- **A5 · High: search inputs have no label.**
  - Toolbar searches are `<label class="searchbox">` with an icon and a placeholder only: `Clients.tsx:124`, `Prospects.tsx:116`, `Products.tsx:99`, `Meetings.tsx:138`, `StudioCanvas.tsx:144`, `Home.tsx:89`. Measured accessible name: empty.
  - Fix: `aria-label="Search clients"` etc.
- **A6 · Medium: semantics.**
  - Stage buttons have `role="listitem"` (`ProspectDetail.tsx:66`), so they lose their button role. Use `<ol>` with `<li><button>`.
  - Month cells are `<div onClick>` (`Meetings.tsx:93`); use a `<button>` per day.
  - Tabs and segmented controls lack `role="tab"` and `aria-selected`. `Clients.tsx:120` declares `tablist` with plain buttons. Either complete the pattern or use `aria-pressed`.
  - Filter chips lack `aria-pressed`.
- **A7 · Medium: profile menu.**
  - It doesn't close on Escape (measured).
  - It declares `role="menu"` without arrow-key support (`ProfileMenu.tsx:35`). Use a plain list of links (simpler) or add arrow keys.
- **A8 · Medium: colour alone carries meaning in four places.**
  - Overdue next step on prospect rows is only red text (`Prospects.tsx:165`).
  - Overdue promises (`Meetings.tsx:133`).
  - Meeting type in the calendar (five 8 px squares; Review `#1D3A2E` and Family `#2C4E63` are indistinguishable at that size).
  - The timeline legend swatches (see Clients).
  - Fix: add the word "Overdue". Meeting type also in text on day and week events; the legend shows the mark itself.
- **A9 · Polish.**
  - No skip link.
  - Drawer bodies don't set `overscroll-behavior: contain`, so scrolling past the end scrolls the page.
  - No `text-wrap: balance` on headings.

### 4.2 Colour and brass

See D2 and D3. Plus:

- **C1 · Medium: terracotta used for things that aren't losses.** Two red marks on almost every "Waiting on me" row: High plus Changes requested (`before/requests@1440.png`).
  - Where: "Waiting on you" counts (`Requests.tsx:47`, `registry.tsx:183`), the High priority pill, the "Changes requested" pill, the rejected card, and "Needs your input".
  - Fix: keep terracotta for money lost and real failures. "Needs you" states use ink text plus the brass attention mark. Priority uses a neutral outline pill with the word "High".
- **C2 · Medium: `.closed-banner` (loss tint) is used for "CIO asked for changes"** (`StudioCanvas.tsx:135`), which is a to-do, not a failure. Use the attention style with the action "Edit the portfolio below".

### 4.3 Numbers and data presentation

- **N1 · High: amount inputs show raw digits.**
  - `7500000`, `25000000` in Studio (`StudioCanvas.tsx:181, 204`), and the prospect form (`Prospects.tsx:195`).
  - Fix: show grouped Indian format (`75,00,000`) with an `inputmode="numeric"` text input that parses on change, plus the compact helper (`₹75 L`) the create modal already shows (`Studio.tsx:131`).
  - Why: a misplaced zero on a ₹75 L line is a real-money error. This is the one number control RMs type into most.
- **N2 · Medium: compact format precision is inconsistent.**
  - `inr()` gives two decimals for crores and one for lakhs, and strips only `.00` (`format.ts:7-8`). So "₹2 Cr" sits above "₹2.10 Cr", "₹1.50 Cr" next to "₹1.9 L", and digits don't line up in the pipeline widget.
  - Fix: one rule per context.
    - Tables and lists: crores always 2 dp (`₹2.00 Cr`), lakhs always 1 dp (`₹95.0 L`), right-aligned.
    - Headlines: strip trailing zeros.
  - This is a `format.ts` option, not a rewrite.
- **N3 · Medium: one date language.**
  - Search shows `2026-10-27` (backend string).
  - The bill chip shows `2026-10-24`.
  - The timeline uses `toLocaleDateString` (`shared.tsx:159`) while everything else uses `format.ts`.
  - Native date/time inputs follow browser locale (mm/dd/yyyy in the screenshots).
  - Fix: everything through `format.ts`; native inputs stay but get a formatted echo below them ("Wed 28 Oct, 11:00 am").
- **N4 · Medium: "Rs" in sample text** (53 occurrences in `data/`) next to "₹" in figures. See section 7; data is not in this chat's scope.
- **N5 · Medium: no y-scale on Area and Columns.**
  - "Assets over 12 months" shows a line with only "Nov" and "Oct" (`registry.tsx:66-67`).
  - Points by month has values on bars but uses rounded tops and the brass highlight.
  - Fix: 3–4 faint gridlines with labels in `--muted`, x labels every quarter, straight-segment line at 2 px, square bar tops (`charts/index.tsx:76`).
- **N6 · Medium: donuts are thick (18/140 px) with hover-only values** (`charts/index.tsx`). Values aren't reachable by keyboard or touch.
  - Fix: thin ring (8–10 px). The legend beside it already lists values; make the legend the readable part and drop the hover swap. Client health and product type both have a legend.
- **N7 · Polish: allocation bars have no legend in the Studio model picker** (`Studio.tsx:166`) or on client rows. On client rows it's fine (the portfolio panel explains it). In the model picker add the four class labels under each bar, or one legend above the list.
- **N8 · Polish: the learning ring is crude at larger sizes.** The learning ring is a `conic-gradient` with a fixed 26 px inner hole (`styles.css:333-334`). At 54 px (`registry.tsx:159`) it becomes a thick wedge with 10 px text. Scale the hole with the ring.

### 4.4 Type, spacing, layout

- **T1 · Medium: meta strings joined with "·" where layout would be clearer.** The brief names this as a tell. The worst offenders:
  - Updates item meta (`Updates.tsx:78-81`)
  - pipeline widget subline "14 open · ₹19.25 Cr potential · ₹8.43 Cr w…" truncated (`registry.tsx:107`)
  - request rows "Portfolio approval · RQ-3106 · CIO Office · PF-2026-000102" (`Requests.tsx:68`)
  - history rows with name · date · MoM excerpt (`Meetings.tsx:142`)
  - canvas meta "PF-2026-000118 · recommended · Draft · Updated…" (`StudioCanvas.tsx:131`)
  - Fix: move the one fact that matters into its own column or line (team as a column, ID in muted mono-free text after the title, status as its pill). Keep "·" only for two short items.
- **T2 · Medium: cards stretched beyond their content.** Holes of 100–200 px in:
  - Home widgets (D5)
  - Prospect "Next step" (`before/prospect@1440-full.png`)
  - Products "Your book by product type" and "Fits your clients" beside the taller "Most held"
  - the Meetings "Next up" card beside "Needs a MoM" (ragged bottoms)
  - Fix: `align-items: start` on those rows, and pair blocks of similar height. Example: Fits your clients shows 6 rows to match.
- **T3 · Medium: narrow content spanning the full width.**
  - Product "Details" key-value list (5 rows across 900 px)
  - Studio landing (2 cards then 900 px of nothing)
  - Requests list rows with a 280 px truncated "last reply" (`styles.css:673`)
  - Fix in each page section.
- **T4 · Polish: odd counts orphan a cell in the stat line on phone.** Five stats in a 2-column grid leave one alone (`styles.css:153-156`, seen on Clients, Prospects, Meetings at 390). Let the last odd cell span both columns.
- **T5 · Polish: eyebrow label above a heading.** "Banyan Mutual Fund · Mutual fund" above the product h1 (`ProductDetail.tsx:52`). Move the manufacturer under the title with the pills.

### 4.5 Motion

- Mostly right and restrained. Keep it.
- **M1 · Polish: entry animations repeat.** Drawers replay `slidein` every time a panel is switched, because each is a new portal. With D1 (docked panels) switching should crossfade content, not slide the frame again.
- **M2 · Polish: the "pending" trail dot blinks forever** (`styles.css:679`). That's fine under reduced motion, but in normal motion a 1.4 s blink on every open request drawer is distracting. Pulse twice, then hold.

### 4.6 Responsiveness (keep tidy at 390; 1024 is real)

- **R1 · High: Home grid at 390 and narrow tablets** (D5.4).
- **R2 · High: Studio canvas lines at 390 break one word per line** (`before/canvas@390-full.png`). The `.line` row keeps name, amount, %, sparkle and delete in one flex row (`styles.css:641-645`). Below 720 px, stack the name above the inputs.
- **R3 · Medium: Growth's five goals become 2 + 2 + 1 at 1024–1100 px** and take a whole screen (`before/growth@1024.png`). Use a 3 + 2 grid, or a compact list with the five numbered rows.
- **R4 · Medium: client header pills overflow the card at 390** (`before/client@390.png`, the risk pill). Let pills wrap and shorten "Risk: Moderately aggressive, profiled 25 Feb 2025" to "Moderately aggressive · Feb 2025".
- **R5 · Polish: the search box shows an empty pill at 390** (placeholder hidden). Show the icon only, with a visible focus ring and `aria-label`.

### 4.7 Copy

| # | Where | Now | Proposed | Why |
|---|---|---|---|---|
| W1 | `Clients.tsx:42` | "hasn't heard from you since 8 months ago" | "hasn't heard from you in 8 months" | Grammar |
| W2 | `Products.tsx:86, 120` | "1 clients" | plural rule ("1 client") | Grammar |
| W3 | `Meetings.tsx:95` | month view "1:00 pm Dr." (first word of "Dr. Imran Qureshi") | strip honorifics as `initials()` already does (`format.ts:65`) | Readable |
| W4 | `Meetings.tsx:52` vs `Home.tsx:56` | Meetings: "1 today"; Home: "2 meetings today" (same moment) | Meetings: "2 today, 1 still to come" | One fact, one value |
| W5 | `Requests.tsx:95` | "Due Yesterday" | "Overdue · due yesterday" | Case and meaning |
| W6 | `ProductDetail.tsx:37-38` | "3 years, a year" / "5 years, a year" | "3-year return (a year)" | Clear label |
| W7 | Onboard step 2 | "Referral (Amit Kapadia (client))" | data has "(client)" inside `source_detail`; render "Referral from Amit Kapadia, a client" | Double brackets |
| W8 | Arrows glued to text: `Prospects.tsx:106`, `Studio.tsx:140`, `Requests.tsx:188`, and ArrowRight icons after every suggestion button (`Clients.tsx:112`, `Prospects.tsx:85`) | "Vivek Malhotra → Coastline PMS", "← Other ways to start" | "For Vivek Malhotra: Coastline PMS"; "Other ways to start" with a back chevron as a separate icon | Brief rule |
| W9 | Timeline (`shared.tsx:158`) | 🔒 emoji on internal notes | lucide `Lock` icon at 12 px | No emoji; renders the same on every OS |
| W10 | Pick modal (`Home.tsx:159`) | "Moderate · active" (raw lowercase) | "Moderate · Active" via `label()` | Consistency |
| W11 | Agent | "Checked: get holdings, get calendar" | "Looked at holdings and calendar" | Jargon |
| W12 | Agent events (backend text) | "RM approved card CD-7002 …" | "You approved …" | Second person (section 7) |
| W13 | Outbox tab count | "Outbox 0" when 1 item exists (count = unreviewed) | "Outbox 1" with "1 to review" in the filter chip | Count shouldn't read as empty |
| W14 | Canvas meta | "recommended" (raw `source`) | "From the Balanced Compounder model" / "Started from scratch" / "Imported" | Plain words |
| W15 | Learning steps | "reading · 6 min" lowercase | "Reading · 6 min" | Case |

---

## 5. Page by page

### Login
- **L1 · Medium:** the demo note is `--faint` on cream (2.35:1). Use `--muted`.
- **L2 · Polish:** "Sign in" has no busy state. It's instant today, but SSO will not be. Add the busy pattern now.
- **L3 · Polish:** the mark sits small at the top of a 660 px forest panel with a large empty middle. Consider centring the mark vertically with the wordmark and story under it, or the "two hands" mark larger at the bottom-left as a quiet field. Decide with D-series sign-off; it's the first thing Krishna sees.

### Shell (top bar, dock, search, profile)
- **SH1 · Medium:** search results show the kind in muted text only, with no grouping. For "mehta" there are 3 clients and 2 meetings mixed. Group by kind with small headers ("Clients", "Meetings"), and format meeting dates (N3).
- **SH2 · Polish:** the empty search shows "Jump to" plus 4 actions. Add a "Recent" group (last 5 opened clients and prospects from local state). This is the single most common jump an RM makes.
- **SH3 · Polish:** the profile menu's camera badge covers the avatar initials (`ProfileMenu.tsx:39`). Move it to sit outside the circle at the bottom-right.
- **SH4 · Polish:** the dock's active state is a 7 px brass ring at the icon's top-right (`styles.css:123-126`). On a 66% cream label it's hard to see at a glance. Add a subtle `rgba(243,240,232,.08)` pill behind the active item. The ring stays.

### Home
See D5. Plus:
- **H1 · Medium:** pipeline widget labels truncate ("Investing and tradin…") and its bar track is 45 px wide. Show stage short names (the Prospects chart already abbreviates) and give the bar the width.
- **H2 · Medium:** Book at a glance legend wraps one item ("Cash 3%") to a second line. Use fixed mini-columns.
- **H3 · Polish:** customise mode's library description is 5 lines. Cut to one: "Drag onto the board or press +. Cards marked pick can be added once per client, product or portfolio."
- **H4 · Polish:** pick modal list rows have no hover or selected state beyond brass wash (D2), and no empty result text.

### Clients
- **CL1 · High:** the timeline legend swatches are invisible. The swatches are the pale tints (brass-tint, forest-tint, stone) on a paper chip, about 1.1–1.2:1, well under the 3:1 needed for a graphic that carries meaning. Known issue confirmed (`styles.css:515-532`). Show each swatch as the card's real mark: a 3 px left rule in the kind's colour plus the dot shape the timeline uses. Never a pale square.
- **CL2 · Medium:** "Red flags" panel scrolls inside a fixed 214 px with the last row cut mid-line (`Clients.tsx:96`). Show the top 6 with "See all 20" that filters the list below by flags.
- **CL3 · Medium:** "What to do next" grid leaves one orphan in row 2 and each button's text plus arrow is wider than its sentence column. Single column list, actions in a fixed trailing column at the same pitch.
- **CL4 · Medium:** client rows repeat "No flags" in faint text on most rows. Leave the flags column empty instead (an empty cell reads as "nothing to see").
- **CL5 · Polish:** Families view cards are `.sunk` cream on paper with no hover. They're not links, but members are. Fine; add the family total's provenance (`Num`) consistently.

### Client page
- **CP1 · High:** Portfolio panel crash (S1).
- **CP2 · Medium:** with the agent or Actions open, the main column keeps its width under the panel. Goals and stat line are cut by the drawer (D1).
- **CP3 · Medium:** "Coming up" mixes meetings and cash flows with the same styling. SIP debits show as "−₹1 L" in muted; maturities and coupons as positive. Give the list two small groups ("Meetings", "Money in and out"), with the sign carrying direction (not colour).
- **CP4 · Polish:** risk pill text is long (R4).
- **CP5 · Polish:** the gain stat is coloured green with no ▲. The brand rule is "never colour alone", and the header next to it does use ▲. Add ▲ to the stat.

### Prospects
- **PR1 · Medium:** the six "From the product and CIO teams" cards are identical brass washes (D2). Show them as a list (who suggested, for whom, which product, why) with the "For [name]" phrasing (W8).
- **PR2 · Medium:** "Pipeline by stage" column labels truncate ("Prosp…", "Regist…"). Horizontal bars with full stage names fit the 340 px column better.
- **PR3 · Polish:** opportunity sentences start "Dr. Imran Qureshi: Viewed …" (capital after colon). Make them "Dr. Imran Qureshi viewed Meridian Multi Asset Allocation 3 times in Kova Client."

### Prospect page
- **PP1 · Medium:** a stage click is immediate and without undo (S6). Also give the track a hover affordance ("Move to Registered"), so a click isn't a surprise.
- **PP2 · Medium:** the "Kova Client" disabled checkbox in Details reads as a broken control. Show "No access yet" as text with "(arrives with Kova Client)".
- **PP3 · Polish:** "Account readiness" aside repeats the stage description. Make it the count "0 of 9 done".

### Meetings
- **MT1 · High:** short events in week view clip their text. Known issue confirmed: the 5:00 pm Pervez event (`Meetings.tsx:112`; min height 4.5% ≈ 26 px for a two-line block). Events under 45 minutes show one line (time and name) and the title in the tooltip and drawer. Overlapping events at the same time render on top of each other: split the column for overlaps.
- **MT2 · Medium:** the "Talking points" prep box is empty for prospects (no holdings). Show "Nothing flagged yet. Ask the agent to prepare you." with the link.
- **MT3 · Medium:** meeting types use five similar colours (A8). Use type as text on the event plus one accent for the type that needs attention. Proposal meetings use sage instead of brass (D2).
- **MT4 · Polish:** the calendar shows 9 am–7 pm with large empty spans. Fine. Scroll the "now" line into view in Day view.

### Studio and canvas
- **ST1 · High:** on the canvas at 1440×900, the master panel's Suitability flags and "Send for approval" are below the fold *inside* the sticky panel (`styles.css:647`, `before/canvas@1440-full.png`). The main action of the screen is hidden. Pin the allocation summary and the Send button as a sticky footer of the master panel; flags scroll above it.
- **ST2 · High:** raw amount inputs (N1).
- **ST3 · Medium:** five brass sparkle buttons that only say "coming soon" (`StudioCanvas.tsx:183`). Remove from lines; keep one disabled "Ask the agent (coming soon)" in the master header.
- **ST4 · Medium:** shelf items already added are faded to 1.8:1 (D3). Use a check plus "Added".
- **ST5 · Medium:** Studio landing has 2–4 cards then empty space. Show the tabs' four lists as one table (ID, name, for, amount, status, updated), sorted by "needs you" first (changes requested, then drafts). It also gives the "Changes requested" draft the prominence it needs.
- **ST6 · Polish:** "Create a portfolio" modal: show the model allocation legend (N7), and name the path the RM is on in the title ("Create from a recommended portfolio").

### Products
- **PD1 · High (brand):** the rewards card is a full brass block level with the CIO view, the loudest element on the page. Its white text is 4.0:1. That conflicts with "suitability before rewards". Move it below "Clients it suits" as a quiet paper card with a brass ring and points figure (D2).
- **PD2 · Medium:** learning buttons on every row (D2). Also "Your clients" column says "1 clients" (W2).
- **PD3 · Medium:** the Returns / yield column mixes 3-year returns, YTM, IRR ranges and rates, with inconsistent decimals ("15% 3y" vs "15.1% 3y"). Split into two columns: "Return / yield" (number, 1 dp, right-aligned) and "Basis" (3y, YTM, IRR, rate) in muted text.
- **PD4 · Polish:** quiz options are content-width and ragged (`styles.css:593`). Make them full width.

### Growth
- **GR1 · High (known issue):** slab labels crowd the track. "Bronze 0+" sits 18 px under "Silver slab · 6% of variable pay" (`Growth.tsx:88-98`, `styles.css:660-661`). The projected hatch (brass-tint stripes on stone) is nearly invisible. Put slab names *under* the track with their thresholds, 12 px clear of the stats. Draw the projection as a solid lighter forest segment with a label at its end ("870 by 31 Dec").
- **GR2 · Medium:** each goal has edit, delete, and Achieved, so five Achieved buttons sit side by side. Make Achieved a check toggle on the goal number circle, and put edit/delete in a small "…" menu. Delete gets Undo (S6).
- **GR3 · Polish:** contest leaderboards show money and counts with no unit ("4", "3"). Add the unit from the rule ("4 new PMS clients").

### Requests
- **RQ1 · High (known issue):** long rows. The last-reply column is a fixed 280 px with ellipsis, and titles, meta, due, priority and status compete on one line. Two-line rows instead:
  - line 1: title, then the status pill right-aligned
  - line 2: "{team} · {last reply}" in muted, full width, then the due date right-aligned
  - priority as a word only when High
- **RQ2 · Medium:** "Close" vs closing the drawer (S7).
- **RQ3 · Medium:** the ticket form uses an unstyled native file input ("Choose Files"), a full-width two-option segmented control, and "Speak a ticket / Draft with AI" pills that look like buttons but do nothing (`Requests.tsx:146-149`). Use a styled "Attach files" button listing chosen names, a content-width segment, and remove the coming-soon pills (or one muted line).
- **RQ4 · Polish:** the outbox body is an always-editable textarea that looks like a form. Show the message as a read-only email, with "Edit" to switch to the textarea. Fewer accidental edits to a record that should be an audit trail.

### Me, Preferences, Handbook
- **ME1 · High:** Preferences has controls that do nothing. "Large numbers" (lakh/crore vs full), the three Updates toggles and "Show the live transcript" are saved to localStorage but read nowhere (`Me.tsx:54`; no other `pref(` call). A control that does nothing is worse than none.
  - Either wire the two that are cheap and UI-only: number format through `inr()`, live transcript through `useSpeech`.
  - Or label the section "Coming soon" and disable it, the way Dark theme is.
- **ME2 · Polish:** Handbook cards fade the whole card to 85% (2.2:1 text). Use normal text with a "Coming soon" pill.

---

## 6. What I would not change, and why

- **The information architecture, dock, top bar and fixed Updates panel.** All fixed by the brief, and they work.
- **The forest Updates panel.** It's a lot of forest beside paper cards, but it's the one "needs you" stream and should look different. Only its height and meta layout change.
- **Native `<select>` and date inputs.** They're accessible and keyboard-correct out of the box; replacing them is a heavy dependency for little gain. Only their formatted echo changes (N3).
- **The hand-drawn SVG charts.** No chart library swap. `recharts` is in `package.json` but unused (no import anywhere). Dropping it is a free bundle win (known issue 10), but it's a dependency change, so it's listed rather than done.
- **Greeting h1 on Home.** The taste-skill prefers a noun title for app screens, but it allows a greeting on a personal home, and the RM persona benefits from it.
- **Gradient fill under the area chart.** It's ≤ 16% and fades to 0, which the guidelines allow. Not worth touching.

## 7. Needs a backend or data change (for the other chat)

1. **"Rs" in sample data** (53 places in `data/*.json`: updates, clients' timelines, goals, contests, MoM text) should be "₹" in `scripts/gen_data.py`. A reseed is needed, so it's Divyansh's call (`SEED_VERSION`).
2. **Search `sub` strings** build ISO dates (`app.py:301`, "Meeting · 2026-10-27"). Return a `date` field, or format as "27 Oct".
3. **Agent error replies.** Add `"error": true` (and keep the user's text) on the agent message when the LLM call fails (`agent.py:443-444`), so the UI can style it and offer Try again. Don't expose "No Groq API key is configured on the server" to the RM; log it.
4. **Agent event lines.** Store the decision as structured data (`{kind: 'decision', card_id, decision, edited}`) instead of the sentence "RM approved card CD-…" (`agent.py:469, 481`), so the UI can write "You approved …". The model can keep its own text.
5. **Home layout 404 for a new RM** (`/c/layouts/RM-0042`). Return the default layout instead of 404, so the console stays clean.
6. **`source_detail` contains "(client)"**, so it renders as "Referral (Amit Kapadia (client))". Store the relationship separately.
7. **Prospect consent fields** (known issue 7). The UI already has the consent strip pattern ready to reuse on the prospect page once the fields exist.

---

## 8. Suggested batches (after your sign-off)

Each batch is small, on its own `ui/<name>` branch, validated per section 6 of the brief, and merged only with your yes.

| # | Batch | Contents | Needs a decision? |
|---|---|---|---|
| 1 | `ui/stability` | S1–S8, A1, A3–A7 | No |
| 2 | `ui/tokens-contrast` | D3 tokens, `.faint` → `.muted` for text, opacity dimming removed, status ink colours | Token values (D3) |
| 3 | `ui/brass-budget` | D2 colour re-assignment, hover colour, rewards card, learning buttons | Yes: D2 table |
| 4 | `ui/bottom-system` | D1 | Yes |
| 5 | `ui/numbers` | N1–N3, N5–N8, W-series copy | Precision rule (N2) |
| 6 | `ui/agent` | D4 (items 1, 2, 4–7 are UI only; 3 needs the backend flag) | Yes: D4 |
| 7 | `ui/home` | D5 | Yes: default layout |
| 8 | `ui/pages` | page-by-page items in section 5, one page per commit | No |

A draft `DESIGN.md` (the source of truth the brief asked for) is in `docs/ui-audit/DESIGN-draft.md`, written from `styles.css` and the brand rules, with the D2/D3 proposals marked as proposals.
