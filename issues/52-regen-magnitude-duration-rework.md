# Issue 52 — Regen rework: magnitude == duration, additive stacking

- **Status:** ✅ Complete
- **Phase:** rules (engine, balance-relevant)   **Size:** M
- **Depends on:** —   **Blocks:** none (folds into the #58 balance pass)
- **Addresses:** intake 2026-07-06 — regen rework

## Why

Return Regen to the older model where one number is **both** magnitude and duration, decaying each
tick. Regen 5 heals 5 on its first tick, then decays to Regen 4 (heals 4), Regen 3, … down to 0 —
a front-loaded heal-over-time that self-expires. The current Regen spell starts at **Regen 2**.
Re-casting **adds to the total**: casting Regen 2 on a member already at Regen 3 yields Regen 5.

## Behaviour spec

- A member's regen is a single value `R`. On each tick: heal `R`, then `R -= 1`; at `R == 0` it's
  gone. Duration is implicit (`R` ticks remain).
- The Regen card applies **+2** (start Regen 2 on a clean target).
- Applying regen to a member who already has `R` **adds** the card's amount: `R' = R + amount`
  (Regen 2 onto Regen 3 → Regen 5). No separate duration field to reconcile — magnitude *is*
  duration.
- Ticking cadence unchanged (start of player phase, after the enemy blow).

## Acceptance criteria

- [ ] Regen card starts a clean target at Regen 2; ticks 2→1→0 healing 2 then 1.
- [ ] Re-cast is additive (Regen 3 + card → Regen 5) and re-derives the remaining ticks from the
      new total.
- [ ] The separate `regenTurns` duration is collapsed into the single magnitude (or kept in lockstep
      so `regenTurns == regen` always) — no path can desync them.
- [ ] Lingering modifier (`MOD_LINGERING_TURNS`) is reconciled to the new model (adds magnitude, or
      is dropped for regen) — document which.
- [ ] Overgrowth / Cultivate / Bloom / Lifebloom, which read `regen`/`regenTurns`, still behave
      coherently under the collapsed model.
- [ ] Preview/telegraph and combat-log text reflect the decaying value.

## Implementation notes (anchors)

- Card def `src/constants.ts:708-709` (base `regen: 1` → make the applied amount 2); duration
  `REGEN_TURNS = 3` (`:573`) — collapse; magnitude/duration bumps in `resolveCard`
  (`:1625`, `:1636`).
- Apply logic `src/engine.ts:1387-1397` (`case 'regen'` — currently `Math.max`, **no stacking**;
  change to additive) and the pending-burst pay via `_endRegenBurst`.
- Tick logic `src/engine.ts:1200-1214` (`_startPlayerPhase`) — heal `m.regen`, decrement, clear at 0.
- Member fields `src/engine.ts:66-68` (`regen`, `regenTurns`, `bloomBurst`).
- Related consumers to keep coherent: `overgrowth` `:1437-1448`, `cultivate` `:1449-1459`,
  `bloom` `:1460-1471`, `lifebloom` `:1484-1495`.

## Tests

- `test/engine.test.ts`: single-cast decay curve (2 then 1 then gone); additive re-cast
  (3 + card → 5, then decays 5→…→0 healing the triangular total); interaction with Cultivate/Bloom;
  preview==applied for any regen-derived numbers.

## Out of scope

- Rebalancing regen's cost against the new power — defer the number to the #58 pass.
