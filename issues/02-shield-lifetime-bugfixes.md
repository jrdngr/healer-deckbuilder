# Issue 02 — Shield lifetime + bug-class fixes (P1a)

- **Status:** ✅ Complete
- **Roadmap phase:** P1 (a)   **Size:** M
- **Depends on:** #01   **Blocks:** #06, and #16 (Barrier reuses the shield-expiry field)
- **Addresses:** flaws #4, #19, #20

## Why
Three "the rules leak" bugs. A Shield is a bare boolean that never expires (`engine.ts:38`), so it
is bankable and silently the trivializing answer to the only unreadable attack. A Shield is also
consumed by 0-damage hits because the shield check precedes damage calc. And Efficient can drive a
card to 0 cost, opening degenerate edge cases. Fix the bug-class first so later content sits on
sound rules.

## Scope / acceptance criteria
- [ ] **Shield expiry (flaw #4):** a Shield blocks the next damage **instance within 3 enemy
      turns**, then fades. Add a turns-remaining field alongside `m.shield`.
- [ ] **No 0-damage consume (flaw #20):** the Shield-consumption check must run **after**
      `_effectiveDamage`; a hit that deals 0 (fully mitigated) does not eat the Shield.
- [ ] **Efficient cost floor (flaw #19):** Efficient cannot reduce a card below **cost 1**.
- [ ] The `attackTargets()` preview reflects Shield state so telegraph == applied (invariant).

## Implementation notes
- Shield state & consume: `engine.ts:38` (field), `:148` (init), `:322/:575` (clears),
  `:430-436` (consume path — move the check after damage calc), `:566` (`case 'shield'` apply).
- Efficient modifier resolution: wherever effective cost is computed in `playCard`/cost helpers in
  `src/engine.ts`; clamp to `Math.max(1, …)`.
- Prefer a small integer `shieldTurns` over a boolean so #16's "1-phase fuse" is the strict case.

## Tests (required per CLAUDE.md)
- Shield expires after 3 enemy turns unused; Shield survives a 0-damage hit; Shield blocks exactly
  one damaging instance then clears.
- Efficient on a 1-cost card stays at 1; **0-cost-vs-Rest** interaction test (`canSkip` sees no
  card "played" incorrectly).

## Out of scope / follow-ups
- Shield/Defense **tooltips** are part of the UX batch (#24).
- Barrier card's per-phase fuse is #16.
