# Issue 57 — Card reward after every won fight (pick 1 of 3, free, rarity-weighted)

- **Phase:** economy (reward flow, balance-relevant)   **Size:** M
- **Depends on:** —   **Blocks:** #58 (a balance-affecting change; lands before the #58 pass)
- **Addresses:** intake 2026-07-06 — "Winning a fight should have card rewards. Offer 3 cards and
  the player chooses 1. Cards probabilities are based on rarity. These cards are free."

## Why

Winning a fight should grow the deck. After each victory, offer **3 cards** rolled by rarity
weight; the player picks **1 for free** and it's added to the run deck. This is a real power gain
per fight, so it lands before the #58 between-fight-healing balance pass (which must account for it).

## Acceptance criteria

- [ ] After **every** won fight, a card-reward step offers 3 distinct cards, weighted by rarity.
- [ ] The player picks exactly one; it's added to the deck for free (no gold cost). Decide and
      implement whether a skip is allowed (recommend: skippable, mirroring spoils).
- [ ] On act-boss fights, the card reward and the existing relic spoils both occur in a coherent
      order (recommend: card reward, then spoils).
- [ ] Rewards are deterministic per fight sub-seed and survive save/resume mid-choice.
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- Win flow: `src/run.ts:471-493` `winFight()` — normal fights route to `forkChoice` (`:491`); insert
  the card-reward step before the fork. Add a `NodeContent`/`location` variant (model on
  `src/run.ts:61` `{type:'cardShop'; offers: CardOffer[]}`).
- Reuse the rarity-weighted roll: `src/run.ts:660` `rollCardShop()` and `_pickDistinct` (~`:645`,
  weighted by `RARITY_WEIGHT[CARD_RARITY[id]]`). For a free 3-card reward, roll 3 distinct and drop
  the pricing. Pool `src/constants.ts:1270` `CARD_POOL`; weights `:1052` `RARITY_WEIGHT`; rarity map
  `:1235` `CARD_RARITY`.
- Consume: model on `buyCardOffer` `src/run.ts:862-868` (`addCard`) but free and single-choice (add
  the picked card, clear the whole offer set).
- UI: new screen modeled on `src/components/CardShopScreen.tsx:15` (render `Card`s, no price) and a
  dispatch entry in `src/components/NodeScreen.tsx:22-39`; existing relic reward `SpoilsScreen.tsx`.

## Tests

- `test/run.test.ts`: a won fight produces a 3-card reward; picking adds exactly that card and ends
  the step; rarity weighting is applied; deterministic per seed; boss fights yield both card reward
  and relic spoils in the chosen order; save/resume mid-choice restores the offer.

## Out of scope

- New card *content*; card removal (existing shops own that). The #58 pass owns the resulting
  balance number.
