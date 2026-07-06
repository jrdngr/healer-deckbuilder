# Issue 51 — Change the starting deck's heal mix

- **Phase:** rules (quick constant, balance-relevant)   **Size:** XS
- **Depends on:** —   **Blocks:** none (folds into the #58 balance pass)
- **Addresses:** intake 2026-07-06 — "Change the starting deck to be 1x group heal, 3x quick heal,
  2x heal"

## Why

Rebalance the opening hand toward cheap single-target healing: fewer expensive Group Heals, more
Quick Heals. This is a one-constant change but it shifts early-fight economy, so it lands before
the #58 between-fight-healing balance pass rather than after.

## Interpretation (assumed)

The intake names only the three heal cards. Read as: adjust the **heal portion** of `DECK_LIST`
to **1× Group Heal (`aoeHeal`) / 3× Quick Heal (`lowHeal`) / 2× Heal (`highHeal`)**, leaving the
utility cards (regen / refresh / shield / resurrect) as they are. Net deck size is unchanged (the
current heal portion is 2/2/2, so +1 `lowHeal`, −1 `aoeHeal`). If the maintainer instead wants the
*entire* starting deck reduced to those six cards, that's a one-line variant — flag at review.

## Acceptance criteria

- [ ] `DECK_LIST` yields 1× `aoeHeal`, 3× `lowHeal`, 2× `highHeal` in the heal portion.
- [ ] Utility cards unchanged unless the maintainer chooses the "six cards only" variant.
- [ ] Any deck-count test/snapshot updated to match.
- [ ] Typecheck/build clean; tests pass.

## Implementation notes (anchors)

- `src/constants.ts:772-780` `DECK_LIST` — currently 2× `lowHeal`, 2× `highHeal`, 2× `aoeHeal`,
  2× `regen`, 2× `refresh`, 1× `shield`, 1× `resurrect`.
- Card ids/names: `lowHeal` = "Quick Heal" (`:702`), `highHeal` = "Heal" (`:704`), `aoeHeal` =
  "Group Heal" (`:706`). Consumed by `defaultDeck()`.

## Tests

- `test/run.test.ts` / `test/engine.test.ts`: assert the starting deck's card counts.

## Out of scope

- Retuning card costs or effects; the #58 pass owns the downstream balance number.
