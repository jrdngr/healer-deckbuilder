# Sim harness

A permanent, deterministic "good player" simulation of whole runs (shopping +
fights). It is the trustworthy way to judge balance; every balance gate in the
issue backlog runs through it.

- `policy.ts` — the living good-player policy (taunt/heal/race fight line + a
  sensible buyer/fork policy). Structured as a prioritized tactic list so later
  issues register per-boss reactions (#12–#14) and relic-aware shopping (#21).
- `run-sim.ts` — `runSingleRun(seed)` / `runSim(n, firstSeed)`, a formatted
  report, and the `npm run sim` CLI (default N=1000).

```
npm run sim            # N=1000 from seed 1
npm run sim -- 2000 1  # N=2000 from seed 1
```

Determinism and a locked aggregate are guarded by `test/sim.test.ts`.

> **Superseded by the 3-act / 9-fight structure (#10).** The table below is the
> post-P1 baseline for the old flat 5-fight run. Since #10 the run is 9 fights in
> 3 acts with placeholder Act 2/3 bosses (scaled BOSS_ENEMY_DEF, 200/280 HP) that
> the current policy can't beat, so full-run is 0% by design — the full-run band is
> tuned once the real bosses land (#12–#14). Clean-sample normals (F0/F1/F3/F4)
> clear ≥95%. See the progression table in `run-sim.ts` for the current numbers.

## Canonical baseline (issue 06 — post-P1 re-anchor, pre-#10)

Measured at **N = 1000** seeds (from seed 1) with the P1 balance repair (#02–#05)
merged. This supersedes the pre-repair historical reference (~100/100/83/67/60 /
~35%), which came from a since-deleted throwaway AI. **Judge every later change by
the delta this harness reports against these numbers, not the historical ones.**

| Fight | Winrate (95% CI) | Mean turns |
|-------|------------------|------------|
| F0            | 100.0% ± 0.0 | 4.1 |
| F1            | 100.0% ± 0.0 | 5.3 |
| F2            |  90.7% ± 1.8 | 7.3 |
| F3            |  69.9% ± 3.0 | 8.9 |
| F4 (boss)     |  75.6% ± 3.3 | 10.1 |
| **Full run**  | **47.9% ± 3.1** | — |

Per-fight winrates are conditional on reaching the fight. The N=200 slice
(full-run 104/200, per-fight wins `[200,200,183,128,104]`) is locked in
`test/sim.test.ts` as the bit-identical regression #07's plumbing refactor diffs
against.

### How the baseline moved through P1

| After | F0 | F1 | F2 | F3 | boss | full-run |
|-------|----|----|----|----|------|----------|
| #01 (harness)               | 100 | 99.7 | 71.6 | 42.6 | 38.2 | 11.6% |
| #03 (Taunt retarget priced) | 100 | 99.8 | 67.1 | 37.0 | 37.1 |  9.2% |
| #04 (turn-1 single + sweep) | 100 | 99.8 | 70.7 | 38.4 | 45.0 | 12.2% |
| #05 (decaying Rest + reprice)| 100 | 100 | 90.7 | 69.9 | 75.6 | 47.9% |

#05's decaying Rest fixed the documented MP bottleneck and the hidden-magnitude
reveal let good play react precisely, so the run is now winnable with good play.

### `ENEMY_ATTACK_BONUS` decision

Left at `[0, 1, 2, 2, 0]`. The suggested `[1, 1, 2, 2, 0]` de-tedium nudge was
measured and produced **identical** winrates (F0 stays 100%): +1 damage on the
50-HP fight-0 enemy does not threaten good play, so it would only affect
engagement (which the sim does not measure) while churning engine tests. The
9-fight per-act curve (#10) is the proper home for de-tedium and supersedes this
array, so no change is made here. Any future difficulty valve must be run-shaped
(e.g. one "second wind" per run), never HP-shaped.
