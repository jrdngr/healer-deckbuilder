# Issue 04 — Boss enrage race: countdown UI + tuning + turn-1 single (P1c)

- **Status:** ✅ Complete
- **Roadmap phase:** P1 (c)   **Size:** M
- **Depends on:** #01   **Blocks:** #06; assumed by all three bosses (#12–#14)
- **Addresses:** flaws #2, #12 (cheap fix); **Open Q7-partial (accepted: P1 patch suffices for demo)**

## Why
The boss's real difficulty is an **invisible, unwinnable enrage race** the UI never announces:
150 HP vs ~16 party dmg/turn reliably reaches `ENRAGE_TURN = 11`, and enraged sweep
(ceil(4×1.25)×3 = 15 party-wide/turn) beats the ~10 HP/turn sustain ceiling. The player can't see
the clock. Separately, the turn-1 enemy hit resolves on mount before any player input.

## Scope / acceptance criteria
- [ ] **Enrage countdown (flaw #2):** surface an "Enrages in N" pip starting ~turn 7. `ENRAGE_TURN`
      must be legible in the fight UI.
- [ ] **Race tuning (flaw #2):** soften the enraged sweep — sweep type weight 20→10 **or** sweep
      base 4→3 — tuned via the sim so the boss stays hard but the race is winnable with good play.
- [ ] **Turn-1 attack forced `single` (flaw #12, cheap fix):** the mount-time enemy phase must not
      open on a 30%-weighted heavy or a sweep.
- [ ] Re-sim to confirm boss winrate lands in the intended band after tuning.

## Implementation notes
- Enrage logic: `engine.ts:209` (`isEnraged`), `:368` (enrage trigger), `:215` (mult); constant
  `ENRAGE_TURN = 11`, `ENRAGE_MULT = 1.25` in `src/constants.ts`.
- Sweep weighting lives in the boss `TYPE_WEIGHTS` in `src/constants.ts`.
- Turn-1: `start()` resolves the enemy phase on mount (`engine.ts:313-314`); force the first
  telegraph/attack to `single`.
- Countdown pip: small addition to the enemy panel (`src/components/EnemyPanel.tsx`) reading
  turn vs `ENRAGE_TURN`.

## Tests (required per CLAUDE.md)
- Turn-1 attack is always `single`.
- Enrage fires exactly on `ENRAGE_TURN`; tuned sweep numbers match the new constants.

## Out of scope / follow-ups
- The **full** player-phase-first reorder is deferred post-demo (#26, Open Q7-full).
- Content that plays with the race: Grim Harvest / Battle Hymn (#16), Cracked Hourglass (#22),
  Devourer as the race-by-design boss (#14).
