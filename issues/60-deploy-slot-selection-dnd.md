# Issue 60 — Deploy screen: smart slot selection + drag-and-drop

- **Status:** 📋 Open
- **Phase:** ux (deploy)   **Size:** M
- **Depends on:** #50 (remembers seating between fights) — soft   **Blocks:** none
- **Addresses:** intake 2026-07-07 — "The first empty slot from the left should always be selected
  when choosing party members… If I click three different party members in a row, it should populate
  all three slots… drag and drop party members onto slots. Dropping onto a populated slot swaps the
  two members…"

## Why

The deploy step is a two-click dance: click a slot to make it active, *then* click a hero to seat
them. Seating a fresh trio takes six clicks and constant slot re-selection. Auto-select the first
open slot and auto-advance after each seat so three clicks fill L/C/R, and add drag-and-drop with
swap semantics so the player can rearrange a seating directly.

## Acceptance criteria

- [ ] On entering deploy, the **active slot is the first empty slot from the left**. If every slot is
      already filled (a remembered seating from #50), fall back to the Left slot.
- [ ] Clicking a roster hero seats them in the active slot, then the **active slot auto-advances to
      the next empty slot from the left**; three clicks in a row fill Left → Center → Right. With no
      empty slot left, the active selection stays put.
- [ ] Existing click paths still work: clicking a slot makes it active; clicking the active slot's
      current occupant toggles them back out; the ✕ clears a slot.
- [ ] **Drag a roster hero onto a slot:** empty slot → seat there; occupied slot → the roster hero
      takes the slot and the **displaced member returns to the roster (hand)**.
- [ ] **Drag a seated hero onto another slot:** both seated → the two **swap slots**; onto an empty
      slot → move; dragged back onto the roster list → unseat (moves to hand).
- [ ] No hero can occupy two slots (the existing one-slot-per-hero invariant holds through every
      transition).
- [ ] Non-drag users lose nothing — the click flow above is fully sufficient; touch may degrade to
      click. Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- `src/components/DeployScreen.tsx` — `activeSlot` state (`:19`, currently `useState(0)`), `assign()`
  (`:23-28`), `clearSlot()` (`:29-33`), slot buttons (`:57-70`), roster buttons (`:72-87`).
- **First-empty selection:** seed `activeSlot` from `run.deployment` (first index that is `null`,
  else `0`). **Auto-advance:** after `assign`, set `activeSlot` to the next `null` slot from the left.
- **Extract a pure transition reducer** (e.g. `src/deploy.ts`) that maps
  `(deployment, action)` → `deployment` for: seat-in-active, toggle-out, drop roster→slot (with
  displacement-to-hand), and drop slot→slot (swap/move). Keep it DOM-free so it unit-tests without
  React, per `CLAUDE.md`. `DeployScreen` becomes a thin view over it.
- **Drag-and-drop:** native HTML5 drag events — `draggable` on slot and roster buttons; `onDragStart`
  carries the source `{ kind: 'slot' | 'roster', index }`; `onDrop` runs a reducer transition. No new
  dependency.
- #50 already persists `run.deployment` across fights and save/resume; this issue changes only the
  *selection/seating UX*, not persistence, so `confirmDeployment(deploy)` (`DeployScreen.tsx:52`) is
  unchanged.

## Tests

- `test/deploy.test.ts` (new) against the pure reducer: first-empty selection; auto-advance seats
  three heroes across L/C/R; roster→occupied-slot displaces the old member to the hand; slot→slot
  swaps; one-slot-per-hero holds after every transition.

## Out of scope

- Auto-optimizing positions for the player (this only makes *manual* seating faster).
- Changing salary/bounty math or what `confirmDeployment` stores.
