# Issue 09 — Four named normal enemies + encounter tables (P2c)

- **Roadmap phase:** P2 (c)   **Size:** M
- **Depends on:** #07   **Blocks:** #10
- **Addresses:** review §4 P2 (roadmap M1b)

## Why
Every non-boss fight currently feels the same. Four differentiated normals + encounter tables give
runs texture and let the 3-act curve draw from a real pool.

## Scope / acceptance criteria
- [ ] Four named normals with distinct behavior, each expressed as an `EnemyDef` (#07):
      **single-spammer**, **swarm**, **stalker**, **cleaver**.
- [ ] Encounter tables selecting normals per fight slot.
- [ ] **Gate:** per-fight winrates within **±5 pp** of the #06 baseline (variety, not a difficulty
      spike).

## Implementation notes
- Pure data in `src/constants.ts` + selection in `src/run.ts`. No new engine mechanics — reuse the
  existing attack-type vocabulary (single/two/aoe/hidden/heavy/sweep).

## Tests (required per CLAUDE.md)
- Each normal's attack profile; encounter-table determinism by seed; per-fight winrate band.

## Out of scope / follow-ups
- Act 2/3 rosters that reuse boss tech at small scale are #20.
