# Issue 48 — "View deck" button in the top status bar

- **Phase:** fix (quick UI)   **Size:** S
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "Add a button to view your deck in the top status bar"

## Why

There is no persistent way to inspect the full run deck from the run layer. Add a button in the
topbar that opens a read-only view of the current deck (grouped, counted) so the player can plan.

## Acceptance criteria

- [ ] A **View Deck** control sits in the topbar next to the existing run status.
- [ ] Clicking it opens a read-only deck view: every card in `run.deck`, grouped by name with
      counts, dismissable (click-away / close button / Esc).
- [ ] The view is purely informational — no selection, no reordering, no card-order leak.
- [ ] Available on every run-layer screen where the topbar shows (not just in a fight).
- [ ] Typecheck/build clean; tests pass.

## Implementation notes (anchors)

- `src/components/Topbar.tsx:15` `Topbar`; existing controls at `:36-55` (Speed, Seed, New Run) —
  add the button alongside. Gold element (`:24`) stays put.
- Reuse the DOM-free grouping already built for the in-fight deck viewer:
  `src/deckView.ts:14` `groupPile(cards)` → `PileGroup[]`. Render groups as `Card`s, or reuse
  `src/components/DeckPicker.tsx:15` `DeckPicker` with `canPick` returning `false` everywhere
  (read-only mode).
- `run.deck` (`DeckCard[]`) is already in scope in `src/App.tsx`; thread it (or a viewer toggle)
  down to the topbar, or hold the open/closed state in `App.tsx`.

## Tests

- UI-only; if a small selector/grouping helper is added, unit-test it. Otherwise rely on existing
  `deckView` tests.

## Out of scope

- Card upgrade/removal from this view (those already have their own shop screens).
