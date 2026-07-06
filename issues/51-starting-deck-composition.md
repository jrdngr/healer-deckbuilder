# Issue 51 — Replace the starting deck with the heal-only six

- **Phase:** rules (constant, balance-relevant)   **Size:** S
- **Depends on:** —   **Blocks:** none (folds into the #58 balance pass)
- **Addresses:** intake 2026-07-06 — "Change the starting deck to be 1x group heal, 3x quick heal,
  2x heal"

## Why

The starting deck should contain **exactly** the six cards the maintainer listed and nothing else:
**1× Group Heal (`aoeHeal`) / 3× Quick Heal (`lowHeal`) / 2× Heal (`highHeal`)**. The current
starter (2× `lowHeal`, 2× `highHeal`, 2× `aoeHeal`, 2× `regen`, 2× `refresh`, 1× `shield`,
1× `resurrect` = 12 cards) drops to a 6-card, pure-heal opener. Everything else (regen, refresh,
shield, resurrect) is **removed from the starter** — those cards still exist and are acquired later
via card rewards (#57) and shops.

This is more than a count tweak: a 6-card deck cycles twice as fast, and removing the starter
Resurrect / Shield / Refresh / Regen is a real early-game power cut, so it lands before the #58
between-fight-healing balance pass, which must account for it.

## Acceptance criteria

- [ ] `DECK_LIST` (the starter deck) is **exactly** `[aoeHeal, lowHeal, lowHeal, lowHeal, highHeal,
      highHeal]` — 1× `aoeHeal`, 3× `lowHeal`, 2× `highHeal`, and no other cards.
- [ ] `regen`, `refresh`, `shield`, `resurrect` are no longer in the starting deck (they remain
      reachable via rewards/shops).
- [ ] Deck size is 6; any deck-count test/snapshot and any code that assumed a 12-card start is
      updated (draw/reshuffle behaviour still correct with the smaller pile).
- [ ] Typecheck/build clean; tests pass.

## Implementation notes (anchors)

- `src/constants.ts:772-780` `DECK_LIST` — rewrite to the six-card list above. Consumed by
  `defaultDeck()`.
- Card ids/names: `lowHeal` = "Quick Heal" (`:702`), `highHeal` = "Heal" (`:704`), `aoeHeal` =
  "Group Heal" (`:706`). The removed cards (`regen` `:708`, `refresh`, `shield`, `resurrect` `:715`)
  stay defined and in the acquirable pools — only their starter copies go.
- Sanity-check anything that leans on the old opener: the in-fight deck viewer / draw pile, and any
  test fixture that hard-codes the 12-card starting deck.

## Tests

- `test/run.test.ts` / `test/engine.test.ts`: assert the starting deck is exactly the six-card
  heal-only list (correct per-card counts, size 6, none of the removed cards present); confirm draw
  and reshuffle behave with the 6-card pile.

## Out of scope

- Retuning card costs or effects; the #58 pass owns the downstream balance number. Card
  availability in rewards/shops is unchanged — only the starter list shrinks.
