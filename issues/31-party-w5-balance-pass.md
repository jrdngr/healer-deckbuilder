# Issue 31 — Party W5: per-composition balance pass

- **Roadmap phase:** post-demo (party wave 5)   **Size:** M
- **Depends on:** #30   **Blocks:** none
- **Addresses:** review §3.4 (per-comp balance)

## Why
8-choose-3 = 56 compositions × 3 bosses is the largest tuning surface in the project. Once the draft
exists, sweep it so no composition is broken or dead.

## Scope / acceptance criteria
- [x] Sim across all 56 compositions via `runCompositionSweep` (`sim/run-sim.ts`; `npm run sim -- sweep
      <N>`). `ENEMY_ATTACK_BONUS` and boss HP stay **composition-agnostic** — no per-comp boss tuning.
- [x] Ceiling handled at the MEMBER, not the boss: the sweep showed every Warlock comp cleared at
      86–93% (10 comps > 85% at F8) — a +34pp outlier. **Warlock 7 → 5 damage** caps it (post-nerf:
      **0 comps clear F8 > 85%**), so the "widen boss HP bands" condition never triggers and the
      comp-agnostic trio baseline is preserved (raising boss HP would have wrecked it).
- [x] Taunt-less floor: added the purchasable **Provoke ("Taunt-lite") card** (per #30's provision) so
      any member can become the enemy's aim without forcing the Tank into every party. Also tightened
      #30's generator to require a **conventional striker** (ranger/mage/warlock) — the sweep showed
      striker-less comps floor out, so a certified-viable offer now guarantees a party that can
      actually kill the bosses.

## Findings (N=100 sweep, measured 2026-07-04)
- **Before:** full-run range 0–93%, F8 0–97%, 10 comps > 85% at F8 (all Warlock).
- **After the Warlock 7→5 nerf:** full-run range 0–75%, F8 0–81.5%, **0 comps > 85% at F8**. Top comp
  ranger/mage/warlock 75% full / 81.5% F8; classic trio ~22% full at N=100 (32.1% at the
  authoritative N=1000).
- **The floor is a fixed-stick limitation, not a boss-tuning one.** Comps carried by the
  Skald/Warden/Berserker (who need card-sequencing the fixed measuring-stick policy doesn't do) and
  no-tank squishy comps floor toward 0%. This is inherent to the *fixed* stick; a per-comp policy is
  future work. The generator's striker requirement + Provoke are the shipped remedies; a human
  pilots these comps far better than the stick.

## Implementation notes
- Extend the sim harness to iterate compositions; tune boss HP bands / enrage in `src/constants.ts`
  rather than per-comp enemy logic.

## Tests (required per CLAUDE.md)
- [x] `test/sim.test.ts`: `allCompositions()` = 56; `seatComposition` puts the tankiest in center; the
      Warlock ceiling nerf is pinned (damage 5); a tiny sweep runs over all 56 comps without stalling
      and shows a real spread. The classic-trio N=200 pin re-anchored for the Provoke pool growth
      (bands hold: N=1000 F2 85.9 / F5 71.5 / F8 53.6 / full 32.1%).
- [x] `test/run.test.ts`: the generator requires a conventional striker — a striker-less party fails
      the bar, and every certified-viable offer contains a striker across 500 seeds.
- [x] `test/engine.test.ts` + `coverage`: Provoke grants Taunt + light Defense to any (non-Tank)
      member and is exercised as the 24th card.
- Note: the authoritative per-comp band check is the manual N=100 sweep (documented above), not a
  test-time assertion — the same policy the whole project measures against (N=1000 gate is manual).

## Out of scope / follow-ups
- Everything else roster-related is complete; remaining ideas live in #32.
