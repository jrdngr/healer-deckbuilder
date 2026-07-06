# Issue 54 — Disable ability cards on death; remove them on permanent death

- **Phase:** rules (engine)   **Size:** S–M
- **Depends on:** —   **Blocks:** none (resurrect in #58 re-enables disabled cards)
- **Addresses:** intake 2026-07-06 — "When a party member dies, disable their ability cards but
  still allow them to be drawn. If they permanently die due to injuries, remove their ability cards
  from the deck for the rest of the fight."

## Why

A dead member's ability cards should still be *drawn* (so hand flow and deck cycling are
unaffected) but be **unplayable** while they're down — recoverable if the member is resurrected. A
member who cannot return this fight (unresurrectable / incapacitated) is different: their ability
cards are dead weight the player keeps drawing, so remove them from the draw pile for the rest of
the fight.

## Current behaviour (partly already there)

On death, the bound ability card **stays in hand and is refused by `canPlay`** ("that member is
unavailable") — that already matches "drawn but disabled". Two gaps: (1) the disabled state should
read clearly in the UI (not just a refusal on click), and (2) there is no path that *removes* an
unresurrectable member's ability cards from the fight.

## Acceptance criteria

- [ ] Normal in-fight death: the member's ability card(s) remain drawable but unplayable, and the
      card renders in a clearly **disabled** state (not merely a click-time refusal).
- [ ] Resurrecting the member re-enables their ability card(s).
- [ ] A member who is **unresurrectable this fight** (incapacitated / permanently dead by injuries)
      has their ability card(s) **removed from the deck and hand** for the remainder of the fight —
      they stop being drawn.
- [ ] Never removes another member's cards; empty-seat / smaller-deployment fielding unaffected.
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- Injection: `src/constants.ts:1000-1008` `abilityCardsForParty(party)` (per non-empty seat, negative
  uid), `:784-793` `ABILITY_CARD`, `:797-798` `ABILITY_CARD_IDS` / `isAbilityCard`; injected per-fight
  at `src/run.ts:436` (`toBattleConfig`).
- Playability today: `src/engine.ts:1285-1287` `canPlay` refuses when `!_abilityMember(card.ability)`;
  `:1358-1360` `_abilityMember` requires `alive && ability === …`; apply `:1362-1369`.
- Unresurrectable definition: incapacitated members are seated dead and `canPlay 'dead'` already
  excludes them (`src/engine.ts:1302-1309`, `:1307`). Use that state as the "permanent this fight"
  trigger: either skip injecting their ability cards in `abilityCardsForParty`/`toBattleConfig`, or
  purge them from deck+hand at fight start.
- Disabled-card rendering: `src/components/Card.tsx` + `Hand.tsx` (surface the `canPlay` refusal as a
  disabled visual).

## Tests

- `test/engine.test.ts`: dead member's ability card still drawn but `canPlay` false; resurrect →
  playable again; incapacitated member's ability card absent from deck/hand for the whole fight;
  other members' cards untouched.

## Out of scope

- Mid-fight *permanent* death that isn't the incapacitated state — if #58 introduces a new
  in-fight permadeath trigger, extend this removal there.
