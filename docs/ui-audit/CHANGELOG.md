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
