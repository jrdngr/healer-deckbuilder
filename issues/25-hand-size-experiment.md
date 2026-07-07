# Issue 25 — Hand-size experiment: hand 4 + 1-card carryover (Q6)

- **Status:** ✅ Complete
- **Roadmap phase:** experimental (must precede #22 if adopted, per Q6)   **Size:** S–M
- **Depends on:** #06 (needs a stable sim baseline)   **Blocks:** #22 *if* adopted
- **Addresses:** flaw #16; **Open Q6 (accepted: explore it)**

## Why
Hand 3 with no carryover makes it hard to plan sequences and count outs. Worth testing whether hand
4 with a 1-card carryover improves decision texture — but it interacts with First-Light Taper's
draw-1-fewer penalty (#22) and the +1 Hand Size upgrade, so if we adopt it, it must land **before**
Taper.

## Scope / acceptance criteria
- [x] Implement **hand 4 with 1-card carryover** behind a flag/constant.
      (`HealerConfig.carryover`, default 0; the engine keeps the costliest non-retain card
      across the end-of-turn discard when it is > 0.)
- [x] Sim it against the baseline; check the interaction with the +1 Hand Size upgrade.
- [x] **Decision: REVERT** (mechanism kept behind the flag, `carryover` defaults to 0; the demo
      ships hand-3, no carryover). Record why (below).

## Decision — REVERT (measured 2026-07-04, N=1000 on the current DR1 baseline)

| variant | full-run |
|---|---|
| baseline (hand 3, no carryover) | **30.8%** |
| hand 4 + carryover 1 (the experiment) | 47.7% (+16.9pp) |
| hand 4, no carryover (control) | 52.7% (+21.9pp) |
| hand 5 + carryover 1 (stacks with the +1 Hand upgrade) | 65.5% |

Two findings kill adoption:
1. **Carryover is strictly worse than plain hand-4** (47.7% vs 52.7%). Keeping the costliest card
   trades a *fresh* draw for a stale one you may not be able to afford — it shrinks draw variety
   rather than improving sequencing. The mechanic does not earn its complexity.
2. **Hand size is a massive power lever** (+22pp per card). Adopting hand-4 would throw the run far
   out of the tuned 25–35% band and force a full three-boss re-tune. It also had to land *before*
   #22 (Taper depends on hand size) per Q6 — but #22 has already shipped on hand-3, so adoption is
   now out of order.

The `carryover` field stays in `HealerConfig` (inert at 0) as a documented, tested seam for any
future +Hand-Size build or re-tune, but it is **not** a dependency of #22 and the demo does not use
it.

## Implementation notes
- `HAND_SIZE` and draw/discard logic in `src/engine.ts` + `src/constants.ts`. Carryover = don't
  discard the full hand at end of turn; keep 1.

## Tests (required per CLAUDE.md)
- [x] Hand refills to 4 with exactly 1 carried (the costliest non-retain card); Retain + carryover
      stack; `carryover 0` is bit-identical to the classic full discard. (`test/engine.test.ts`.)

## Out of scope / follow-ups
- Not adopted, so no ordering constraint threads into #22. If a future re-tune revisits hand size,
  prefer **plain hand-4** over carryover (the control beat the experiment) and budget a three-boss
  re-tune.
