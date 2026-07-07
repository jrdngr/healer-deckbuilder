# Issue 10 — 3-act / 9-fight structure + per-act curve (P3a)

- **Status:** ✅ Complete
- **Roadmap phase:** P3 (a)   **Size:** M–L
- **Depends on:** #09   **Blocks:** #11, #12
- **Addresses:** review §4 P3 (roadmap M2); supersedes `FIGHT_COUNT = 5`

## Why
The demo is "complete runs with multiple bosses." That requires a real 3-act, 9-fight map with a
per-act difficulty curve, replacing the flat 5-fight run (`FIGHT_COUNT = 5`).

## Scope / acceptance criteria
- [ ] `act` / `fightInAct` structure; **8 forks** across the map; 3 acts, each ending in a boss
      (fights 3, 6, 9).
- [ ] Per-act HP / attackBonus curve **with an explicit enrage column** (placeholders, sim-tuned):
      A1 50/75 + Boss 130 e11; A2 105/130 + Boss 200 e10; A3 160/190 + Boss 280 per-def.
- [ ] Gold economy ~**40g × 8 non-boss fights ≈ 320g** per run.
- [ ] **Gates:** progression correctness, gold totals, seed determinism; normals ≥ 95%. **No
      full-run band yet** — that is tuned once real bosses exist (#14).
- [ ] Acts 2–3 may temporarily reuse scaled act-1 defs + a placeholder boss until #12–#14 land.

## Implementation notes
- `src/run.ts` owns map generation, node weights (`NODE_TYPE_WEIGHTS`), and fight sequencing;
  `src/constants.ts` holds `FIGHT_COUNT`, `GOLD_PER_FIGHT` (50 today → ~40), per-act curves.
- Keep everything seed-deterministic via `makeRng`.

## Tests (required per CLAUDE.md)
- 9-fight progression; boss at each act end; gold accrual; map determinism by seed.

## Out of scope / follow-ups
- Save/resume and ergonomics are #11 (same phase, separated for reviewability).
