# Issue 23 — Difficulty presets + local stats (P10)

- **Status:** ✅ Complete
- **Roadmap phase:** P10   **Size:** S–M
- **Depends on:** #14 (Standard band anchored there)   **Blocks:** none
- **Addresses:** review §4 P10 (roadmap M7); **Open Q8 (accepted: 25–35% Standard, Story ≥60%)**

## Why
One tuned difficulty can't serve both new and returning players. Presets widen the audience without
new content; local stats give a lightweight sense of progression **without** meta-progression
(explicitly rejected: it fights the seed-determinism contract, adds a second economy, and masks
thin content).

## Scope / acceptance criteria
- [ ] **Story:** HP ×0.8, attack bonus −1 (floor 0), enrage +2 turns, gold +25/fight. **Gate: ≥60%**
      full-run at N=1000.
- [ ] **Standard:** the tuned demo. **Gate: 25–35%** full-run at N=1000.
- [ ] **Brutal:** untuned, behind a dev flag, **no gate**.
- [ ] Local stats: wins per difficulty, best act reached.
- [ ] **Meta-progression: NO.**

## Implementation notes
- Difficulty modifiers applied as multipliers/offsets over the per-act curve in `src/constants.ts` /
  `src/run.ts`; selection on the start screen. Stats persisted locally alongside the save (#11).

## Tests (required per CLAUDE.md)
- Each preset's modifiers apply correctly; Story and Standard sim gates.

## Out of scope / follow-ups
- A tuned Brutal is a standing cut; meta-progression revisit is post-demo (#32).
