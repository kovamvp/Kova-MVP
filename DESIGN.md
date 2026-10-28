---
version: 1
name: kova-work
description: "Kova Work, the relationship-manager workspace of KOVA, an Indian wealth company. A private-bank document, not a trading terminal: cream paper (#F3F0E8) and paper panels (#FBFAF6), forest ink (#1D3A2E) for structure and primary actions, and brass (#9A7A47) used rarely — only for the agent, for what needs the RM, for rewards and for the 'held O' ring. Jost for display and figures, Instrument Sans for text, tabular numbers in Indian format everywhere."
status: "In use. Tokens live in web/src/styles.css (:root); chart series in web/src/ui/index.tsx (ASSET_COLORS) and the pages that draw charts. Change the code and this file together."

colors:
  forest: "#1D3A2E"
  forest-deep: "#0F1F18"
  forest-2: "#2B4C3D"
  forest-tint: "#E3E9E3"
  forest-wash: "#EEF1EB"
  cream: "#F3F0E8"
  paper: "#FBFAF6"
  stone: "#E9E5DA"
  line: "#E2DFD7"
  line-strong: "#CFCABD"
  brass: "#9A7A47"
  brass-deep: "#7C6136"
  brass-tint: "#F1E9DA"
  brass-wash: "#F7F2E8"
  ink: "#3B3A35"
  ink-strong: "#17231D"
  muted: "#6A665D"        # passes 4.5:1 on cream, paper and stone
  faint: "#A29E93"        # non-text only (rules, disabled icons)
  gain: "#3D7A4E"         # bars and marks
  gain-ink: "#2F6B43"     # words and pills
  loss: "#A4573A"
  loss-ink: "#93492F"
  warn: "#A9761F"
  warn-ink: "#835F17"
  asset-equity: "#1D3A2E"
  asset-debt: "#848C70"   # warm grey-green, picked by eye (see Charts)
  asset-gold: "#C9A961"
  asset-cash: "#A9B8A9"
  asset-alternatives: "#5F7D6E"

typography:
  display: { fontFamily: "Jost Variable", weight: 500, letterSpacing: "-0.01em" }
  body: { fontFamily: "Instrument Sans Variable", size: 14px, lineHeight: 1.5, features: "tnum, lnum" }
  h1: { size: 30px, lineHeight: 1.15 }
  h2: { size: 19px, lineHeight: 1.3 }
  h3: { size: 15px, lineHeight: 1.35 }
  stat-value: { family: display, size: 26px, large: 34px, weight: 450 }
  small: 12.5px
  tiny: 11.5px   # floor; nothing smaller

rounded:
  s: 6px      # buttons, inputs
  m: 10px     # inner boxes, cards inside panels
  l: 16px     # panels, drawers' outer radius, modals
  pill: 999px # status pills, chips, dock, context bar

shadow:
  float: "0 1px 1px rgba(15,31,24,.04), 0 12px 32px -14px rgba(15,31,24,.28)"  # dock, context bar, menus, modals only
  panel: "0 1px 0 rgba(15,31,24,.03)"
  drawer: "-24px 0 48px -24px rgba(15,31,24,.25)"

layout:
  topbar: 60px
  page-max: 1360px
  page-padding: "28px desktop, 16px under 720px"
  gap: 16px
  dock-space: 104px
  side-panel: "520px (wide 640px), overlays the page; never pushes it"
---

## Overview

Kova Work should feel like a well-made private-bank statement that you can work in: calm, solid, legible, and quiet until something needs the relationship manager. The brand story is the logo — **two hands, one foundation**, the K turned into a foundation holding a brass O, the client's whole wealth, held. The interface repeats that idea in one motif: **the brass ring means "held / needs you"**, and almost nothing else is brass.

Three rules carry most of the look:

1. **Quiet by default, brass for meaning.** Brass appears on the agent (orb, mic, agent-made marks), on what needs the RM now (the Updates priority mark, today's line on the calendar, the current period), on rewards, and on focus rings. Not on data categories, not on hover, not on decoration. *When everything is brass, nothing stands out.*
2. **Cream paper, forest ink.** Structure and primary actions are forest; surfaces step from cream (page) to paper (panels) to stone (sunk wells). Separation is a 1px line or one tone step, rarely a shadow.
3. **Numbers are first-class.** Indian format through `lib/format.ts` (₹12,34,567; ₹1.2 Cr; ₹45 L), tabular figures, right-aligned in columns, and every figure can say where it came from (`<Num src asOf>`).

## Colours

### Brand
- **Forest** — primary buttons, the dock, the Updates panel, selected chips and tabs, the CIO view card, equity in charts.
- **Deep forest** — toasts, tooltips, JSON blocks.
- **Brass** — see the budget below. As **text**, always `brass-deep` (5.5:1 on paper); `brass` itself is for marks and rings (3.8:1, fine for non-text). Brass buttons use `brass-deep` so white text passes.

### Surfaces
- **Cream** page, **paper** panels and inputs, **stone** sunk wells and neutral pills, **line** borders, **line-strong** for controls that must read as controls.
- Washes (`forest-wash`, `brass-wash`) are for a whole block that carries meaning, never for hover. Row hover is `forest-wash`.

### Text (every tier that carries words passes 4.5:1 on cream, paper and stone)
- `ink-strong` headings and key figures · `ink` body · `muted` secondary and meta · `faint` is **not** for words.

### Semantic
- Gains: `gain` with ▲; losses: `loss` with ▼. **Never colour alone** — always the glyph or the word.
- Terracotta means money lost or something failed. A request waiting on the RM, a high priority or a rejected card is **not** a loss: use ink with the brass attention mark, or a neutral pill.
- Pills are a pale tint with the matching `-ink` text. `pill attn` (brass-wash, ink text, brass dot) is the one attention pill: "Changes requested", "Needs your input". High priority and "Rejected" are `outline` pills.
- No opacity dimming of text. Something done, off or out of range uses `muted`, never `opacity`.

### Charts
- Series colours are categorical and come from the brand family: Equity `forest`, Debt `#848C70`, Gold `#C9A961`, Cash `#A9B8A9`, Alternatives `#5F7D6E`. Never brass.
- Adjacent segments are **not** guaranteed 3:1 against each other (Debt is about 1.6:1 next to Gold, 1.7:1 next to Cash and 3.5:1 next to Equity). Debt was chosen by eye in screenshots of the sample portfolios: a warm grey-green that sits with the palette instead of a cold blue-slate. What separates segments is the **2 px gap** between donut segments and the **legend with values** beside every donut; charts never rely on hue alone.
- Donuts are thin rings (10 px) with the total or label in the middle. Column tops are square. The area chart has light gridlines, ticks on a right-hand lane and quarterly x labels.

### Brass budget
| Allowed | Not allowed |
|---|---|
| Agent orb, mic, agent-made marks (timeline, calendar ring, outbox "Agent" pill) | Asset classes, meeting types, product categories |
| Updates priority bar, overdue/needs-you mark | Row and list hover |
| Calendar "now" line, current-period bar | Bullets on every suggestion |
| Reward points (as a figure or ring, not a full brass block) | Buttons on every row |
| "Waiting on you" counts (a ring beside an ink number), `note-card attention`, `pill attn` | Progress bars, contest pills, client tags |
| Focus ring | Disabled or "coming soon" controls |

## Typography

- **Jost** for headings, stat values and large figures; **Instrument Sans** for everything else. Two faces, no third.
- Sentence case everywhere. No all-caps labels, no eyebrow labels above headings, no tracked small caps.
- Scale in use: 30 / 26 (34 large stat) / 19 / 15 / 14 / 12.5 / 11.5. Nothing under 11.5px.
- Figures: tabular and lining (`font-feature-settings: 'tnum', 'lnum'` on body). Money in tables and lists has fixed precision (crores 2 dp, lakhs 1 dp); headline figures may drop trailing zeros.
- Dates: "27 Oct", "Today, 11:00 am", "Tue 28 Oct" via `format.ts`. No ISO strings in the interface.

## Layout

- Bottom forest **dock** with eight sections (Home, Clients, Prospects, Meetings, Studio, Products, Growth, Requests); top bar with wordmark, search (⌘K) and profile photo. No bell: alerts live in Home's fixed **Updates & upcoming** panel.
- Client, prospect and product pages carry the floating **context bar** (panel buttons, quick actions, the brass agent orb). Side panels (Portfolio, Actions, Agent, Learning, Proposal) open on the right **over** the page; they never push it with padding (the page's media queries are viewport-based, so a pushed client page would squeeze to about 770 px). While a panel is open the context bar re-centres in the free space to its left, so the orb and panel buttons are never covered. Nothing fixed may cover focused content: `scroll-padding-bottom` reserves the dock and context bar.
- Page: max 1360px, 28px padding, one 16px gap between panels. Main + side column grids at 340 or 380px.
- Cards that share a row end on one line (`.grid.row-even`): the shorter card stretches and its content stays at the top. Balance the content so the space left inside is small: cap long lists ("Show all n"), use one-line bars in narrow columns, and centre a chart in its card. Page layouts with a long main column and a side column keep their own heights.
- List rows with several trailing fields (Requests) use fixed grid columns so each field lines up from row to row; nothing is aligned by the width of its neighbours.

## Elevation and shape

- Panels: paper, 1px `line`, radius 16, near-zero shadow. Inner boxes radius 10. Buttons and inputs radius 6. Pills, chips, dock and context bar fully round.
- Real shadows only on what floats: dock, context bar, menus, modals, drawers, toasts.

## Components

- **Buttons**: primary forest (one per view), quiet (paper + line), ghost (forest text), danger (loss text). Labels say exactly what happens ("Schedule and send invite", "Send for approval"). No arrows glued to the text.
- **Status pill**: dot + word, pale tint + `-ink` text. One status mark per row.
- **Num**: figure with a provenance tooltip (source · as of date), reachable on hover and on focus of its row or card.
- **Approval card** (agent): action label, one-line summary, ordered fields, Approve / Edit / Reject. States are listed under *Agent card states* below.
- **Note card**: paper, 1 px line, 3 px forest rule on the left. `note-card attention` (brass wash, brass rule) only when the note asks the RM to act.
- **Menus**: a "More actions" icon button opens a small paper menu (`role="menu"`, arrow keys, Escape returns focus to the button). Use one when a row has secondary actions so the primary one can stay visible (Growth goals: Achieved visible, Edit and Remove in the menu).
- **Timeline**: colour-coded by who acted (internal note brass + lock icon, sent to client forest, client action outline, agent brass ring, system stone); the legend shows each kind's real mark.
- **Updates item**: icon, title, one-line body, due (with "Overdue" in words) and source on two fixed lines, Done and Snooze always visible.
- **Empty, loading, error**: empty states keep the block's frame and say what to do; loading shows the final layout in flat stone bars (no shimmer); errors sit inside the block that failed with a Retry.
- **Undo**: removing, resetting, resolving or moving something that is hard to rebuild waits 5 s (`UNDO_MS`) behind a toast with Undo; the write still goes out if the RM leaves the page.
- **Amounts**: inputs group Indian digits as you type and echo the compact figure ("₹25,00,000 · ₹25 L"). Tables and lists use fixed decimals (`inr(x, { fixed: true })`); headlines and widgets use the compact form.

## Motion

Motion explains where something came from or that work is happening. It is never decoration.

| What | How | Duration |
|---|---|---|
| Side panel (drawer) opens | slides 24 px from the right and fades in | 220 ms, `cubic-bezier(.2, .8, .2, 1)` |
| Context bar while a panel opens or closes | its right edge moves with the panel | 220 ms, same curve |
| Modal | rises 8 px and fades in | 180 ms ease |
| Menus, palette | pop and fade | 140–200 ms ease |
| Scrim, toasts | fade | 150 ms |
| Hover and press on buttons, rows, chips | colour and background only | 150 ms |
| Agent thinking | three brass dots blinking in turn; the line under them changes after 4 s and 12 s | 1 s loop |
| Voice capture | mic ring pulses; the wave follows the input level | 1.6 s loop / 80 ms |
| A pending step in a trail | the hollow brass dot blinks | 1.4 s loop |

Rules
- Enter only; things leave instantly. Nothing bounces, nothing staggers, no parallax, no shimmer on skeletons.
- Never animate layout that the RM is reading (no reflowing lists, no counting-up numbers).
- `prefers-reduced-motion: reduce` turns every animation and transition off; states must still read without them.

## Agent card states

The agent never acts alone: every write is a card the RM approves. A card's state must be readable at a glance, in text, without colour.

| State | Rule and head | Status line | Actions |
|---|---|---|---|
| Pending | 3 px **brass** left rule, brass-wash head | none (the buttons are the status) | Approve · Edit · Reject. The panel scrolls to the first pending card when it opens. Reject opens an optional reason field with "Reject card" and "Keep it". |
| Editing | as pending; fields become inputs, dates echo in words ("Wed 4 Nov, 4:00 pm") | none | Approve edited · Stop editing · Reject |
| Working | as pending, all three buttons disabled until the decision is saved | none | none |
| Approved | **gain** left rule, forest-wash head | pill "Approved", or "Approved with edits" | links to what it made (outbox item, meeting, request) |
| Rejected | neutral `line-strong` rule, stone head, muted fields | pill "Rejected, nothing sent"; the reason, if given, under the fields | none |

Around the cards
- **Decisions in the thread** read as sentences: "You approved “Follow-up with Rajesh Mehta”, with edits", "You rejected … : fee comparison not ready".
- **What the agent read** is one muted line ("Looked at holdings and the calendar"), never tool names.
- **Waiting**: "Thinking…", then "Looking at {client}…" after 4 s, then "The model is busy; this can take up to half a minute. Your message is saved." after 12 s. Suggestion chips are disabled while it works.
- **Error**: when the model can't be reached, the reply is an error row (paper, 3 px loss rule, no card) with **Try again**, which resends the same message. Nothing was written.
- **Voice**: live transcript when the browser supports it and the RM has it on in Preferences. Without it the panel says "live text isn't available here, so your words appear when you stop"; when capture fails the message says why (no network, not allowed, language not supported, no microphone).

## Do

- Use brass only from the budget table.
- Put the one thing the RM must do next where they look first, with its action next to it.
- Format every number and date through `lib/format.ts`; group Indian digits in inputs too.
- Write to the RM as "you"; name people and products, not IDs.

## Don't

- Gradients (except the ≤16% fade under the area chart), glows, glass, emoji, eyebrow labels, ALL CAPS.
- Colour as the only signal.
- Ragged rows of cards, or cards stretched over large holes: fix the content balance instead.
- Controls that do nothing; "coming soon" belongs in one muted line, not on every row.

## Responsive behaviour

- All widths: side panels overlay the page from the right; the context bar re-centres in the space left of the panel.
- < 1280: the context bar drops its quick icons (call, schedule) and keeps the panel buttons and the orb.
- 1024–1279: grids drop to two columns. Growth goals are 3 + 2 up to 1100 px.
- < 860: dock shows icons only (with accessible names); page head stacks.
- < 720: the context bar is hidden while a panel fills the screen; Home renders its widgets as one list (no customising on a phone); tables become lists (Products, Growth) and rows put the figure on a second line inside the card, never past the edge; tab bars scroll sideways; Studio lines stack the name above the amount inputs. Phone polish beyond "tidy" is out of scope for the MVP.

## Known gaps

- No dark theme yet; tokens are named by role so a dark set can follow.
- Notification preferences on the Me page are shown but disabled until notifications exist.
