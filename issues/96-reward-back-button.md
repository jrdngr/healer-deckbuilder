# Issue 96 — Back button on reward screens to recover an accidental skip

- **Status:** 📋 Open
- **Phase:** ui (run flow)   **Size:** M
- **Depends on:** —   **Blocks:** —
- **Addresses:** intake 2026-07-17 — "Add a back button on reward screens, particularly after
  bosses. If the player skips the relic reward accidentally, they should be able to go back and
  choose it again."

## Why

Reward screens route strictly **forward**. Both picking and skipping funnel through the same leave
function — `pickCardReward`/`skipCardReward` → `_leaveCardReward` (`run.ts:744-754`),
`takeSpoils`/`skipSpoils` → `_leaveSpoils` (`run.ts:775`) — which advances the run with no way back.
A player who fat-fingers "Take nothing" on a **relic** reward (the shared skip button, `leave-btn`,
`ScreenChrome.tsx:24-39`) permanently loses a relic with no recourse. There should be a Back
affordance that returns to the reward screen with the **same offers** so the choice can be remade.

## Approach (maintainer decision, intake 2026-07-17)

**Add Back to all reward screens** (per-fight card reward *and* post-boss relic spoils), not just the
boss relic. Skipping stashes the screen's location + rolled offers; the next screen shows a Back
control that restores the stashed location and offers, re-presenting the identical choice. Back is a
one-step undo of the most recent skip, not a full history stack.

## Acceptance criteria

- [ ] **Skip is recoverable on both screens.** Skipping the card reward (`CardRewardScreen`) or the
      relic spoils (`SpoilsScreen`) can be undone: the following screen shows a **Back** control that
      returns to the just-skipped screen.
- [ ] **Same offers on return.** Back restores the **exact** offers that were shown (same cards /
      same relics), not a fresh roll — the player re-chooses from what they skipped.
- [ ] **Back only after a skip.** Back appears only when the previous step was a skippable reward the
      player skipped (or, acceptably, whenever there is a stashed prior reward). It does **not** let
      the player undo a reward they actually *took* (taking is a committed choice), and it never
      appears on the very first screen of a run.
- [ ] **One step only.** Back undoes the single most recent skipped reward; chaining further back is
      out of scope. After Back is used (or a reward is taken), the stash clears so Back can't replay a
      stale screen.
- [ ] **Routing stays consistent.** Restoring re-enters the correct `location.kind` with its
      `nodeContent`/offers intact, and forward routing after re-choosing behaves exactly as if the
      skip hadn't happened (boss path still flows cardReward → spoils → healerBoon → fork).
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean; focused `jj` commit with a run-flow
      test (below).

## Implementation notes (anchors)

- **Routing seam:** `App.tsx:177-194` switches on `run.location.kind` — `cardReward` → `CardRewardScreen`
  (`:177-178`), `spoils` → `SpoilsScreen` (`:179-180`), `healerBoon` → `HealerBoonScreen` (`:181-182`).
  Location kinds declared `run.ts:60-62`.
- **Leave functions to intercept:** `skipCardReward` (`run.ts:754`) → `_leaveCardReward`
  (`run.ts:744-749` region, routes to boss `spoils` then fork, `run.ts:713-715`); `skipSpoils`
  (`run.ts:775`) → `_leaveSpoils`. On **skip**, stash `{ location, nodeContent/offers }` before
  advancing; provide a `goBackToReward()` that pops the stash and restores `this.location` +
  offers. Clear the stash on any *take* (`pickCardReward` `run.ts:744-749`, `takeSpoils`) and once
  Back is consumed.
- **Offers to preserve:** card offers rolled by `rollCardReward` (`run.ts:700-704`) and relic offers
  (`SPOILS_OFFER_SIZE`, `run.ts:23`) live on the location/`nodeContent`; stash the actual offer
  arrays so the restored screen renders identical tiles (`RelicTile.tsx`, card tiles in
  `CardRewardScreen`).
- **Back control (UI):** the shared reward shell is `RewardScreen` in `ScreenChrome.tsx:24-39`
  (currently only a skip `leave-btn`). Add an optional Back button there, shown when
  `run.canGoBack()` (new predicate reading the stash). Wire its `onClick` to `act(r => r.goBackToReward())`.
  Both `CardRewardScreen.tsx` and `SpoilsScreen.tsx` render through this shell, so adding it once
  covers both.
- **HealerBoon** (`HealerBoonScreen`, `run.ts:762/788`) also routes through the boss sequence — Back
  from the healer-boon screen returning to the just-skipped spoils is a natural consequence of
  stashing on `skipSpoils`; ensure it restores `spoils`, not something stale.

## Tests

- `test/engine.test.ts` (run-level): drive a win → `cardReward` → `skipCardReward()` → assert
  `canGoBack()` is true and `goBackToReward()` restores `location.kind === 'cardReward'` with the
  **same** offer array; then `pickCardReward(i)` succeeds and clears the stash (`canGoBack()` false).
  Repeat for the boss `spoils` → `skipSpoils` → back → take path. Assert taking a reward directly
  leaves `canGoBack()` false (no undo of a committed take).

## Out of scope

- Multi-step / full history back navigation (one-step undo of the last skip only).
- Undoing a reward the player actually **took** (rerolling / returning a taken relic or card).
- Back on non-reward screens (fork choice, map nodes, infirmary) — reward screens only.
- Re-rolling offers or changing reward contents/odds.
