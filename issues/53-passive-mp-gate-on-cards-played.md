# Issue 53 — Passive MP gain only when ≤1 card was played

- **Status:** ✅ Complete
- **Phase:** rules (engine, balance-relevant)   **Size:** S
- **Depends on:** —   **Blocks:** none (folds into the #58 balance pass)
- **Addresses:** intake 2026-07-06 — "Passive MP gain upgrades should only trigger when 0 or 1 card
  is played"

## Why

Passive MP regen currently ticks unconditionally at the start of every player phase, so it rewards
a busy turn just as much as a restrained one. Gate it to turns where the player played **0 or 1
card** — passive MP becomes a reward for holding back, mirroring the existing Rest gate.

## Acceptance criteria

- [ ] Passive MP is added at the start of a player phase **only if the turn that just ended played
      ≤ 1 card**; otherwise no passive MP that turn.
- [ ] Uses the same "cards played this phase" signal the Rest gate uses — one consistent rule.
- [ ] The Pact of Silence passive bonus is gated the same way (it flows through the same add).
- [ ] Turn-1 / opening behaves sensibly (no phantom count from before the first player turn).
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- `src/engine.ts:1215-1223` (`_startPlayerPhase`) — the unconditional passive add; note
  `cardsPlayedThisPhase` from the *previous* turn is still readable here (`:1217`) **before** it's
  reset at `:1233`. Gate the add on `cardsPlayedThisPhase <= 1`.
- Existing pattern to mirror: `src/engine.ts:1764-1773` `canSkip()` / `restRegenNow()` already gate
  Rest on `cardsPlayedThisPhase <= 1`.
- Fields/config: `passiveMp` `src/engine.ts:208` (set `:305`); `PACT_PASSIVE_MP` bonus
  `src/constants.ts:1529`; `PASSIVE_MP_CAP` `:555`.
- Upgrade that grants it: `src/run.ts:850-856` `applyHealerUpgrade`; offer def `src/constants.ts:1310`.

## Tests

- `test/engine.test.ts`: play 0 cards → passive granted; play 1 → granted; play 2+ → not granted;
  confirm the Pact bonus obeys the same gate; confirm the count resets correctly across turns.

## Out of scope

- Changing the passive MP cap or upgrade price.
