# Issue 41 — Act-1 recruit luck decides the Gatewarden (roster-size variance)

- **Roadmap phase:** post-campaign balance   **Size:** S–M (map/structure change + re-anchor)
- **Depends on:** the 2026-07 roster campaign   **Blocks:** honest act-1 tuning
- **Addresses:** playtest 2026-07-05 — the biggest single variance source measured

## Why

The campaign starts the roster at one member, and the only growth before the act-1 boss is finding
a **Recruit node** in the two act-1 forks (weight 20 of 120 per node slot; the player sees 2 of 4
rolled nodes per fork). Whether one appears is structural RNG — and it decides the Gatewarden
(playtest 2026-07-05, N=1000 per starter, F2 winrate by roster size at the fight):

| starter | solo at F2 | duo | trio | % of runs arriving solo |
|---|---|---|---|---|
| ranger | 72.4% | 96.9% | 100% | ~39% |
| mage | 77.9% | 97.1% | 100% | ~39% |
| warlock | 3.1% | 87.2% | 100% | ~33% |

Even on the healthiest line (ranger) the swing is **72 → 97 → 100%** — a ~25pp fight-outcome swing
(and for the Warlock a 3 → 87pp cliff, issue 39) hinging on a map roll made before the player
chooses anything. A third of runs fight the act boss with whatever the dice said, not what they
drafted. The fork preview does show node types, so a player can *chase* a visible Recruit — but
when neither branch rolled one, no play exists.

The Gatewarden's HP (38, "solo/duo" per the ENEMY_HP_BY_FIGHT comment) is currently tuned to
average over this coin flip, which means it is mistuned for both sides of it.

## Acceptance criteria

- [ ] Pick a structure fix (maintainer call — options by increasing invasiveness):
  1. **Guarantee one act-1 Recruit**: inject a Recruit node into a random act-1 fork the way the
     Reliquary is injected into acts 2/3 (`_generateMap` already has the pattern). Cheapest; keeps
     the *which-fork* uncertainty while removing the *whether* coin flip.
  2. **A fixed "first ally" beat**: a pick-one draft after F1 (mirroring the post-boss drafts), so
     every run fights the Gatewarden as a duo and Recruit nodes become pure surplus.
  3. **Tune the Gatewarden for solo** (HP down / channel softened) and treat a duo as the lucky
     case — weakest option; it makes recruit luck a *bonus* swing instead of a survival swing, but
     re-opens the boss band for every starter.
- [ ] Re-anchor F2 (and, if option 2, F1) HP against the new guaranteed roster size at N=1000; the
      per-starter F2 spread by roster size should compress to single digits on the surviving axis.
- [ ] The recruit weight (20) stays for acts 2/3 — the roster-growth texture there is fine
      (F5/F8 winrates varied <10pp across roster sizes 3–6 in the same playtest).

## Tests

- run.test.ts: map-generation guarantee (option 1: exactly/at-least one act-1 recruit across the
  two forks; option 2: the post-F1 draft fires and leads into the F2 deploy).
- Sim pins re-baselined in `test/sim.test.ts`.

## Out of scope

- The Warlock's solo-F2 3.1% (issue 39 — no roster guarantee rescues a member whose solo line is
  structurally dead).
- Full-band re-baseline (ISSUES.md playtest section).

## Resolution (landed 2026-07-05)

**Chose: guarantee one act-1 Recruit (option 1).** `_generateMap` now injects a Recruit node into a
random act-1 fork (0 or 1, the two before the Gatewarden) the way the Reliquary is injected into
acts 2/3 — skipping when a natural roll already placed one there, so fork-uniqueness holds. The
player still chooses which fork to route. The Gatewarden, now fought as a duo far more often, was
re-anchored (HP 38 → 44 at the time; later raised further by the #44/#39/#42 batch). run.test sweeps
300 seeds to confirm every run offers an act-1 Recruit; sim pins re-baselined.
