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
- [ ] Reorder the fight loop so the player acts before the first enemy resolution (or an equivalent
      that removes the mount-time hit entirely).
- [ ] Migrate the affected engine tests (turn/phase ordering assumptions are widespread).
- [ ] Confirm no regression in boss telegraph timing (all three bosses assume the current order).

## Implementation notes
- `start()` currently resolves the enemy phase on mount (`engine.ts:313-314`); the turn loop
  ordering lives in `src/engine.ts`. This touches every test that assumes enemy-first.
- Budget explicitly for test churn — this is why it's deferred, not a P1 item.

## Tests (required per CLAUDE.md)
- Player phase precedes the first enemy resolution; all boss rotations still land on the intended
  turns; full suite migrated and green.

## Out of scope / follow-ups
- Keep the #04 patch until this fully lands; they must not both be half-applied.
