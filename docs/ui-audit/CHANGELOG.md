# Kova Work UI changelog

One entry per UI batch. Each batch is its own `ui/<name>` branch and pull request, merged only after the
validation checklist (section 6 of the UI brief) passes. Findings and IDs (S1, A1, D2 …) refer to
`docs/ui-audit/REPORT.md`. Before/after screenshots for each batch are in `docs/ui-audit/screens/<batch>/`.

How every batch is checked
- `cd web && npx tsc -b && npm run build`
- Feature regression (Playwright, local servers on in-memory data, 18 journeys): Home customise (add, pick,
  drag, resize, persist, reset), Updates done/snooze/undo, client Portfolio and Actions panels (and the
  deep link), schedule meeting and product feedback forms, agent new session / send / archive, card edit /
  approve / reject, bill chip, prospect create / stage / close / reopen / proposal → Studio prefilled, Studio
  recommended / scratch / import / lines / amount and % / tag / export / send for approval, learning panel and
  quiz, Growth goals add / edit / achieve / remove, Requests tabs / drawer / nudge / escalate / resolve / ticket /
  outbox edit and review marks, search palette, profile photo, sign out and in, keyboard (focus into drawers,
  modal focus trap, Escape).
- Route walk of 78 states at 1440, 1280 and 390 px: console errors, horizontal overflow, focus hidden by the dock.
- Contrast scan of every visible text element on 23 routes (from batch 2 on).

---

## 1 · `ui/stability` — no white screens, honest states, keyboard-safe panels

What changed and why
- **S1** A deep link to a client's Portfolio panel no longer blanks the app: `Status` ignores an empty value
  and the panel waits for products.
- **S2** An error boundary around every page keeps the dock and top bar usable after a render error.
- **S3/S4** Lists show skeleton rows while loading and an inline "Couldn't load … Retry" on failure, instead
  of a false "No clients match" while data is on its way.
- **S5** One `useAction` helper for writes: busy state, no double submits, and failures say what didn't happen.
- **S6** Undo (5 s) for Home layout reset, widget removal, goal removal, prospect stage change and resolving a
  request. Pending writes still go out if the RM leaves the page.
- **S7** The request drawer's "Close" (which closed the request) is now "Mark as resolved".
- **S8** Detail pages load into a skeleton of their real layout (flat stone bars, no shimmer).
- **A1** Drawers and modals move focus in, modals keep Tab inside, focus returns to the opener; Escape closes
  only the top layer.
- **A2** Only headline figures are keyboard stops (36 number stops on Clients down to 6).
- **A3** `scroll-padding-bottom` so focused elements never sit under the dock; skip link.
- **A4–A7** Accessible names for icon-only controls (dock at narrow widths, context bar, Studio sparkles), labelled
  search fields, the stage tracker as an ordered list of buttons with `aria-current`, month days as buttons,
  toggles with `aria-pressed`, profile menu closes on Escape and is a plain list.
- **A8** Overdue next steps and promises say "Overdue", not colour alone.
- Removed the unused `recharts` dependency.

Checked
- tsc and build clean; feature regression 18/18; walk of 234 states (78 × 3 widths): 0 console errors,
  0 page overflow. Elements past the right edge appear only at 390 px inside sideways-scrolling rows and are
  identical to the baseline.
- Not changed here: the side panels still cover part of the context bar (that is the D1-lite batch).

Not done: **S9** (layout 404 for a new RM) needs the backend to return the default layout; it is with the other chat.

## 2 · `ui/tokens-contrast` — text that passes 4.5:1 everywhere (D3)

What changed and why
- `--muted` is darker (`#6A665D`), so secondary text passes on cream, paper and stone, not only on paper.
- `--faint` is no longer used for words (it failed at about 2.5:1); it stays for rules and decorative marks.
- Words and pills in status colours use new ink tones (`--gain-ink`, `--loss-ink`, `--warn-ink`); bars and marks keep
  the original hues. Brass buttons use `brass-deep`, so white text passes.
- No opacity dimming of text: rejected cards, the timeline legend's off state, completed calendar events,
  out-of-month days, products already in a portfolio ("Added") and handbook cards ("Coming soon") stay readable.
- Updates panel meta text raised from 50% to 68% cream.

Checked
- Contrast scan of every visible text element on 23 routes: 381 failures at baseline, 6 after; all 6 are on the
  full-brass rewards card, which batch 3 replaces.
- tsc and build clean; feature regression 18/18; walk of 234 states: 0 console errors, 0 page overflow.

## 3 · `ui/brass-budget` — brass back to the agent, attention and rewards (D2, D4, D5, C1, C2)

What changed and why
- Brass had spread to hovers, note cards, bullets, progress bars, pills and chart series, so it no longer pointed at
  anything. It now marks three things only: the agent, something that needs the RM, and rewards.
- Hovers use the forest wash. Note cards are paper with a forest rule on the left; `note-card attention` keeps the
  brass wash for things that need a reply.
- **C1** "Waiting on you" counts carry a brass ring instead of brass digits; High priority is an outline pill;
  "Changes requested" and "Needs your input" share one attention pill (brass dot, ink text).
- **C2** The Studio banner for a portfolio sent back says what to do: "Edit the portfolio below and send it again."
- Rewards cards are paper with the figure in brass, and sit after "Clients it suits" (suitability before rewards).
- Goal, learning and leaderboard bars are forest. Contest, tag and pick pills are outlines.
- Chart series: Debt is `#848C70`, a warm grey-green chosen by eye beside Equity, Gold and Cash; the 2 px gaps and
  the legends separate the segments. Proposal meetings use the same tone; AIF on Products uses `#B0A98E`.
- Ring bullets became small solid dots; the Me page icons are forest; "Reset demo data" uses the danger button.

Checked
- tsc and build clean; feature regression 18/18; contrast scan 0 failing text elements on 23 routes; walk of
  234 states: 0 console errors, 0 page overflow. The panel still covers the context bar (fixed in D1-lite).

## 4 · `ui/bottom-system` — side panels never hide the context bar (D1-lite)

What changed and why
- With a side panel open (Portfolio, Actions, Agent, Learning, Proposal) the context bar re-centres in the space to
  the panel's left, so the agent orb and the panel buttons stay visible and switch panels directly. The page itself
  is not pushed: its layout is viewport-based, so padding it would squeeze a client page to about 770 px.
- Under 1280 px the quick icons (call, schedule) step aside while a panel is open; under 720 px the panel is full
  screen and the bar is hidden.
- The dock has a thin cream edge so it separates from forest surfaces such as the Updates panel.
- `scroll-padding-bottom` for the dock and context bar landed in batch 1 (A3).

Checked
- tsc and build clean; feature regression 18/18; contrast scan 0 failing; walk of 234 states: 0 console errors,
  0 page overflow, and no state where an open panel covers the context bar (17–20 per width before).

## 5 · `ui/numbers` — numbers, dates, charts and copy (N1–N3, N5–N8, ME1, W1–W15)

What changed and why
- **N1** Amount inputs group Indian digits as you type (75,00,000) and echo the compact value under them, so a
  missing zero is visible: Studio lines and portfolio amount, the Studio create modal, the prospect form.
- **N2** `inr()` and `<Num>` take a `fixed` option. Tables and lists keep two decimals for crores and one for lakhs
  so digits line up; headlines and widgets stay compact.
- **N3** One date language: search results, the bill chip and the timeline go through `format.ts`; the prospect
  form's date field echoes the date in words.
- **N5** The 12-month area chart has a scale (round ticks in a right lane), quarterly labels ending on the latest
  month and a 2 px line. Column charts have square tops.
- **N6** Donuts are thin rings; values live in the legend beside them, not in a hover.
- **N7** One asset-class legend above the model list in Studio create. **N8** The learning ring scales its label.
- **ME1** Preferences: "Large numbers" switches every figure between lakh/crore and full digits; "Show the live
  transcript" turns live text on or off; notification settings are disabled until notifications exist.
- **W1–W15** Copy: "in 8 months", plurals, honorifics in the month view, one count for today's meetings,
  "Overdue · due yesterday", return labels, "Referral from Amit Kapadia, a client", no arrows glued to text, a lock
  icon instead of an emoji, the outbox count shows every item with "To review (n)" as the filter, plain words for how
  a portfolio started, "Reading · 6 min".

Checked
- tsc and build clean; feature regression 18/18; contrast scan 0 failing; walk of 234 states: 0 console errors,
  0 page overflow.

## 6 · `ui/agent` — land on the decision, explain the wait, recover from errors (agent panel, UI parts)

What changed and why
- A session opens at the first card waiting for approval instead of at the bottom.
- While the model works, a line under the dots says what is happening and changes with the wait (4 s, 12 s);
  suggestion chips are disabled.
- A model failure is an error row with Try again (resends the last message), not a normal reply with server
  details. Network failures say the words are back in the box.
- Decisions read as the RM's own ("You approved “…”, with edits"). "Checked: get holdings" reads "Looked at holdings".
- Reject asks for an optional reason (the server already stores it); rejected cards read "Rejected, nothing sent"
  in neutral grey and show the reason.
- No Archive on an empty session; enum values in words; the meeting time echoed in words while editing a card; an
  Enter / Shift+Enter hint before the first message.
- Speech: live-text failures (network, blocked service, missing microphone) are reported instead of restarting
  silently; the recorded transcript still arrives.
- The regression journey "agent session and archive" now accepts the error row as the reply: locally there is no
  model key, and from this batch a failed model call is an error row with Try again instead of a normal reply.

Checked
- tsc and build clean; feature regression 18/18; contrast scan 0 failing; walk of 234 states: 0 console errors,
  0 page overflow.

## 7 · `ui/home` — what needs you today first, a panel that fits the screen (D5)

What changed and why
- Updates & upcoming always ends above the dock, fades at the bottom with "n open · scroll for more" when there is
  more, keeps Done and Snooze visible (quieter until hover or focus), and puts each item's due date and source on
  two lines instead of wrapping into columns.
- New default board led by **Today** (8 of 12 columns): today's meetings beside the MoMs still to write, each with
  one-tap Write MoM. "Assets over 12 months" leaves the default (it repeated the book total) and stays in the
  library. Saved layouts are untouched; Reset to default uses the new one.
- Requests in flight lists what is waiting on you; the portfolio card shows its asset mix, so neither card has an
  empty band.
- The board no longer slides in from a default width on every visit; widgets animate only while customising.
- Under 720 px the board is one column in layout order at natural heights; Customise is for larger screens.
- The phone-width walk can no longer open Customise (hidden under 720 px by design), so its two Customise states
  at 390 px are reported as not reachable; every other state passed.

Checked
- tsc and build clean; feature regression 18/18; contrast scan 0 failing; walk of 234 states: 0 console errors,
  0 page overflow.

## 8 · `ui/pages` — login, shell, Clients, client page, Prospects, Meetings, Products, Growth; DESIGN.md

What changed and why
- **Login** Signing in shows "Signing in…" and can't be pressed twice; the email field is typed and named for
  password managers; the mark, wordmark and story are one lockup centred in the forest field.
- **Shell** Search results are grouped by kind with small headers; with nothing typed, search shows the last five
  clients, prospects and products you opened (on this device). The active dock item has a soft pill behind it.
- **Clients** Timeline legend swatches are visible marks (they were about 1.1:1). Red flags shows the top six with
  "See all n", which sorts the list by flags and scrolls to it. What to do next is one list with its buttons in a
  fixed column. Clients with no flags leave that column empty.
- **Client page** The risk pill is short ("Moderately aggressive · Feb 2025", full wording on hover). The gain
  figure carries ▲ or ▼.
- **Prospects** Suggestions from the product and CIO teams are a list ("{product} for {name}", why, who, when)
  instead of six identical cards; pipeline by stage is horizontal bars with full names; opportunity sentences read
  "Dr. Imran Qureshi viewed …". On a prospect, stage names underline on hover, Kova Client access is text rather
  than a disabled checkbox, readiness shows "2 of 9 done", and Next step no longer stretches.
- **Meetings** Events under 45 minutes show one line (time and name); overlapping events share the column in lanes;
  meeting type is text on the event instead of five similar colours, and brass marks only a meeting that still
  needs a MoM. Empty talking points say "Nothing flagged yet" with a link to the agent. Next up and Needs a MoM
  keep their own heights.
- **Products** Return / yield is one number per row with its basis in its own column (returns 1 dp; yields and
  rates 2 dp, as quoted). Quiz options are full width. The manufacturer sits under the product name. Shelf panels
  align to the top; Details sits in two pairs on wide screens.
- **Growth** Slab names sit under the track, clear of the stats; the projection is a solid lighter forest segment
  labelled at its end ("870 by 31 Dec"). Achieved stays visible but quieter; Edit and Remove are in a "More actions"
  menu, and Remove keeps its Undo. Contest counts carry their unit ("4 new PMS clients"). Goals are 3 + 2 between
  760 and 1100 px.
- **DESIGN.md** at the repo root: the system as shipped, with the Debt colour picked by eye (no adjacency
  contrast claim), side panels that overlay rather than push, and new Motion and Agent card states sections.

Not done here, by decision: ST1, ST3, ST5, ST6, RQ1, RQ3, the Actions panel and CP3 wait for the workflow
branches; MT4 (scroll the now line into view in Day view) was optional and left out because the calendar does not
scroll on its own.
- At 390 px, states with elements past the right edge inside sideways-scrolling rows went from 42 to 26 (Clients
  and Prospects lists).

Checked
- tsc and build clean; feature regression 18/18; contrast scan 0 failing; walk of 234 states: 0 console errors,
  0 page overflow.

## 9 · `ui/polish` — even rows, aligned Requests columns, phone rows inside the screen

Found after batch 8 shipped (Divyansh's review of the live app).

What changed and why
- **Requests** rows are a fixed grid: the last reply, due date, priority and status line up from row to row. They
  were placed by the width of their neighbours, so every row started its columns somewhere else.
- **Rows of panels end on one line** (Meetings, Prospects, Products, Growth). Batch 8 stopped cards stretching over
  holes, which left ragged gaps between cards instead; the fix is to stretch and balance the content:
  Needs a MoM shows five with "Show all n" and the prep boxes fill Next up; the Prospects side column uses one-line
  bars; Most held puts the client count on the name line; the product-type donut is centred and its legend shows
  rupees as well as shares.
- **Phones**: client and prospect rows put the figure on a second line inside the card (it was clipped past the
  right edge, hidden by the page's overflow guard); Products and Growth tables become lists; the Clients filters
  share one line; tab bars scroll sideways; grids no longer widen past the screen for a long pill or heading.
- DESIGN.md rules for rows and phones updated to match.

Checked
- tsc and build clean; feature regression 18/18; contrast scan 0 failing; walk of 234 states: 0 console errors,
  0 page overflow, no open panel over the context bar.
- Elements past the right edge at 390 px: 26 states before, 14 after, all of them tab bars that scroll sideways
  on purpose (Requests and Studio).
