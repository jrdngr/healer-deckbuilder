# Issue 50 — Remember party member positions between fights

- **Status:** ✅ Complete
- **Phase:** fix (small run-state)   **Size:** S
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "Remember the party member positions between fights"

## Why

Every fight re-seats the party to the default L/C/R order (first three roster members), discarding
the player's chosen deployment. Positioning matters (adjacency, targeting), so the player's last
seating should persist into the next deploy step instead of resetting.

## Acceptance criteria

- [ ] The deployment (which roster member sits in each battle slot, and where) **persists across
      fights** — the next deploy step defaults to the player's previous seating, not `[0,1,2]`.
- [ ] Persisted ordering survives save/resume (`toJSON`/`fromJSON`).
- [ ] After a permadeath roster splice, the seating is reconciled sanely (no dangling index, no
      crash) — surviving members keep their relative positions where possible.
- [ ] The player can still freely re-seat at the deploy step.
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- `src/run.ts:111-115` `roster` + `deployment: (number|null)[]`; `:269-271` `_defaultDeployment()`
  (`[0,1,2]`); `:276-283` `_enterDeploy()` — **overwrites `this.deployment` with the default every
  fight** (the reset to fix); `:288-297` `confirmDeployment()` (stores the choice).
- `src/run.ts:537-558` `recordInjuries()` — sets `deployment = [null,null,null]` and splices the
  roster on permadeath (indices shift → reconcile here).
- `src/run.ts:143 / 181 / 205` deployment default + `toJSON`/`fromJSON` persistence.
- `src/components/DeployScreen.tsx:18` seeds UI state from `run.deployment`.

**Approach:** in `_enterDeploy`, keep the prior `deployment` (validated against the current roster
size) instead of calling `_defaultDeployment()`; only fall back to the default when there is no
valid prior seating (first fight, or after a splice invalidates it).

## Tests

- `test/run.test.ts`: seat a non-default deployment, advance to the next fight, assert the deploy
  step still reflects it; round-trip through save/resume; and assert a permadeath splice leaves a
  valid deployment (no out-of-range index).

## Out of scope

- Auto-optimizing positions for the player — this only *remembers* their choice.
