# Issue 47 — Enemy targets dead players; telegraph ≠ applied hit

- **Status:** ✅ Complete
- **Phase:** fix (bug)   **Size:** S
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "Enemy is targeting dead players … telegraph aimed at a dead
  player but a living player still gets hit sometimes"

## Why

A stored telegraph can point at a slot whose member has since died (e.g. killed by the opening
strike or a prior hit in the same turn). Two symptoms result: (1) the enemy "attacks" a corpse
and the blow whiffs instead of hitting a living member, and (2) the preview and the applied damage
**disagree** — the telegraph preview filters dead slots but the two-target geometry and retarget
paths don't, so a two-target swing can display one target yet land on a different living neighbor.

This violates the project's standing invariant: **`attackTargets()` preview must equal applied
damage.** Fix so the two always match, and so a dead-slot target is re-validated (re-pointed to a
living member or dropped consistently in both preview and resolution).

## Acceptance criteria

- [ ] The telegraph preview (`attackTargets()`) is **bit-equal** to what `_resolveAttack` applies,
      including after a member dies mid-turn and after Taunt/retarget.
- [ ] The enemy never spends an attack whiffing on a dead slot when a valid living target exists
      (decide and implement one rule: re-target to a living member, consistently reflected in the
      preview).
- [ ] Two-target geometry (`_geometry` `'second'`) never selects a dead slot in a way that diverges
      from the preview.
- [ ] A property test asserts preview == applied across a randomized batch of turns that include
      mid-turn deaths.

## Implementation notes (anchors)

- `src/engine.ts:608-632` `attackTargets()` — preview filters to `members[slot]?.alive` (`:624`).
- `src/engine.ts:499-513` `_pickPrimary` (re-rolls against **living** slots) and `:516-525`
  `_geometry` — the `'two'`/`'second'` branch picks an adjacent slot by position **with no alive
  check** (the divergence source).
- `src/engine.ts:565-603` `_generateTelegraph` (targets locked at telegraph time), `:636-640`
  `_retargetTelegraphTo` (Taunt path — also doesn't re-validate liveness).
- `src/engine.ts:1127-1196` `_resolveAttack` — a dead/absent target just **whiffs** (`:1136-1139`)
  rather than re-targeting.

**Approach:** make preview and resolution share one target-resolution helper that validates
liveness at the same moment, so there is a single source of truth. Either re-point a dead target
to a living member (and reflect it in the stored telegraph) or drop it — but do it in one place
that both the preview and `_resolveAttack` read.

## Tests

- `test/engine.test.ts`: kill a targeted member (opening strike / prior hit), then assert
  `attackTargets()` equals the damage `_resolveAttack` deals; add the randomized preview==applied
  property test with mid-turn deaths and a Taunt retarget case.

## Out of scope

- Redesigning enemy target *selection* AI — this is a correctness/consistency fix only.
