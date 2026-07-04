# Issue 26 — Full turn-1 phase reorder (Q7 full)

- **Roadmap phase:** post-demo backlog (schedule after playtest #1)   **Size:** M (test-migration budget)
- **Depends on:** #04 (the cheap patch)   **Blocks:** none
- **Addresses:** flaw #12 (full fix); **Open Q7-full (accepted: defer past the demo)**

## Why
The cheap P1 patch (#04) forces the turn-1 attack to `single` and the Gatewarden's rotation opens on
`single`, which is sufficient for the demo. The *proper* fix — reorder so the **player phase
resolves first** — is a larger change with real test-migration cost, so it's deferred and revisited
after playtest #1 confirms whether the patch feels good enough.

## Scope / acceptance criteria
- [x] Reorder the fight loop so the player acts before the first enemy resolution. `start()` now
      telegraphs turn 1 and opens the player phase directly (no mount-time enemy phase); the turn
      counter moved into `_runEnemyPhase`, which owns the advance and still ticks across channel /
      Dusk-Chime wind-ups so enrage/rotation timing is bit-identical to the pre-#26 order.
- [x] Migrate the affected engine tests — only three assertions keyed on the old order (turn-1-single
      patch + one enrage-timing pin); rewritten to assert player-first behavior. Suite green.
- [x] Confirm no regression in boss telegraph timing: rotations/channels/enrage still land on the
      same turn numbers (this.turn counts identically). The change is a systemic difficulty *buff*
      (the party gets a free planning turn), so all three bosses were re-anchored on HP —
      **Gatewarden 130→155, Hexweaver 158→184, Devourer 182→208** — landing F2 87.2% / F5 70.2% /
      F8 52.7% / full-run 31.7% at N=1000 (all dead-center in-band); Story 95.5% (≥60% gate).

## Implementation notes
- `start()` currently resolves the enemy phase on mount (`engine.ts:313-314`); the turn loop
  ordering lives in `src/engine.ts`. This touches every test that assumes enemy-first.
- Budget explicitly for test churn — this is why it's deferred, not a P1 item.

## Tests (required per CLAUDE.md)
- [x] Player phase precedes the first enemy resolution (party untouched after `start()`, no mount
      'hit' log, `this.turn === 1`); enrage fires when the enemy phase resolves turn `ENRAGE_TURN`;
      the N=200 sim pin re-anchored; full suite migrated and green.

## Out of scope / follow-ups
- The #04 turn-1-single patch is **retired** (removed from `_generateTelegraph`) now that the reorder
  landed — they are not both half-applied.
