# Issue 31 — Party W5: per-composition balance pass

- **Roadmap phase:** post-demo (party wave 5)   **Size:** M
- **Depends on:** #30   **Blocks:** none
- **Addresses:** review §3.4 (per-comp balance)

## Why
8-choose-3 = 56 compositions × 3 bosses is the largest tuning surface in the project. Once the draft
exists, sweep it so no composition is broken or dead.

## Scope / acceptance criteria
- [ ] Sim across compositions; keep `ENEMY_ATTACK_BONUS` **composition-agnostic** (don't special-case
      the boss per comp).
- [ ] Widen boss HP **bands** if ceiling comps (~16–17 dmg/turn) clear > 85%.
- [ ] Confirm taunt-less drafts meet the ~15% floor from #30 (or the Taunt-lite card is available).

## Implementation notes
- Extend the sim harness to iterate compositions; tune boss HP bands / enrage in `src/constants.ts`
  rather than per-comp enemy logic.

## Tests (required per CLAUDE.md)
- Per-composition winrate sweep stays within the target bands; no comp below the floor.

## Out of scope / follow-ups
- Everything else roster-related is complete; remaining ideas live in #32.
