# Issue 44 — Party abilities become per-member cards the healer plays

- **Status:** ✅ Complete
- **Roadmap phase:** post-campaign architecture   **Size:** M–L
- **Depends on:** the data-driven roster (#27–#31)   **Blocks:** —
- **Addresses:** maintainer request, 2026-07-05 (filed alongside the roster-campaign batch)

## Why

The engine had a single generic **Ability** card: the player played it and chose *which* living
member's ability to fire. The maintainer wanted each member to instead insert their **own** ability
card into the deck — flavored as the healer enabling the move (imbue the Ranger's arrow with poison,
unleash the Mage's charge, bolster the Tank) — so the choice of *which member acts* is tied to the
card itself rather than a target pick. The cards are inserted when the party is locked in for a fight
and stripped at the end. For now, one card per member, reusing the existing abilities.

## Resolution (landed 2026-07-05)

- **Deleted** the generic `ability` card, the `'ability'` `CardTarget`, and its 3 `DECK_LIST` copies
  (core deck 15 → 12). Added one **named, bound** card per ability: `imbuePoison` (Imbue Venom),
  `bolster`, `unleash`, `hex` (authored in #39), `conduct`, `incite`, `hush`, `beckon` — each a
  `target: 'none'` card carrying an `ability` binding; `ABILITY_CARD` maps ability → card,
  `isAbilityCard`/`ABILITY_CARD_IDS` gate them out of the shop pool and Retain.
- **Injection:** `abilityCardsForParty(party)` builds one bound card per seated member (negative
  uids); `toBattleConfig` and `defaultBattleConfig` append them to the **battle-deck copy** only —
  never the persistent run deck — so they vanish when the fight ends. Fielding fewer members ⇒ fewer
  ability cards (a real small-party texture that composes with #42).
- **Engine:** playing a card with an `ability` fires `_fireAbility` on the deployed living member who
  carries it (no member pick); the card is unplayable while that member is dead/absent. `echoLocket`,
  Retain, the shop pool, and the sim policy were repointed off the old `'ability'` id.
- **UI:** the member-selection targeting flow for the old Ability card is gone; the new cards play
  immediately (they are `target: 'none'`).

## Balance

Small parties now field a **leaner, heal-denser** deck (the old redundant Ability cards are gone) and
the buyer no longer loads up on offense, so the run got easier — the enemy walls were re-anchored up
here and again through #39/#42. A full trio still fights with 12 + 3 = 15 cards, so activation count
is ~unchanged; the real shift is that abilities can no longer all be stacked on one member.

## Tests

- engine.test: each card fires the right bound ability, is unredirectable, and is unplayable with a
  dead/absent carrier; every ability card is `target: 'none'`.
- run.test: `toBattleConfig` injects exactly one card per deployed member (solo 1 / trio 3) and the
  persistent run deck is never touched.
- coverage.test: ability cards are covered via their bound abilities (trio Poison/Taunt/Bolt); sim
  pins re-baselined.
