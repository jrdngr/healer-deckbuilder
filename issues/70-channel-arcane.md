# Issue 70 — Channel archetype rescue + arcane support

- **Status:** ✅ Complete
- **Phase:** content (cards + relics)   **Size:** M
- **Depends on:** —   **Blocks:** #73 (Hierophant anchors this archetype)
- **Addresses:** intake 2026-07-07 — new-content wave: channels (#64) are currently anti-synergy
  with every other card; give them enablers so a channel deck is a real archetype.

## Why

Playing any card breaks your channel, so the five channel cards (Refresh, Drain, Mending Stream,
Sap, Fortify) fight the rest of the deck. This issue adds the two keep-alive pieces — Chanter's
Idol (first card each turn is free of the break) and Attunement (the card it draws is free of the
break) — so "channel + cheap cards" becomes a deck you can build. Arcane Lens is the splash tool
that makes big single-target heals play like small group heals. MP economy stays honest: channels
still suppress all passive MP; nothing here generates MP.

## Wave ground rules

Per #65: no caps / no per-fight trigger limits on new content (broken combos are fun); Charge is
Mage-only; no new MP generation; preview == applied; relics inert-when-none; mechanic-coverage
rows; `CARD_TYPE` entries; N=1000 sim gates (25–35% band, ≤ +9pp per relic).

## New cards (both Arcane)

| Card | Cost | Rarity | Target | Effect |
|---|---|---|---|---|
| **Attunement** | 1 | uncommon | none | `engine`. Draw 1; **neither Attunement nor the card it draws breaks your channel.** |
| **Arcane Lens** | 2 | rare | none | The **next single-target heal** this turn also applies to the most wounded other member. |

## New relic

| Relic | Rarity | Effect |
|---|---|---|
| **Chanter's Idol** | rare | The **first card you play each turn** doesn't break your channel. |

## Design decisions

- **Break-exemption model:** a play is exempt if (a) it is the first card this turn and Chanter's
  Idol is owned, or (b) its uid is the channel-exempt uid set (Attunement stamps itself at play
  time and the specific card instance it draws). Exemptions skip the cancel-channel step only —
  the channel does **not** tick extra, Rest suppression and passive-MP suppression are unchanged.
- **Composability is intended:** Idol (first card) + Attunement (as that first card) exempts a
  second play — a channel deck can sustain two plays per turn. With #73's Liturgy this is the
  archetype ceiling; no cap.
- **Attunement's exemption is instance-scoped** (the drawn card's uid, playable any later turn —
  the exemption rides the card until played or the fight ends, keeping it simple and testable).
- **Arcane Lens arms a one-shot turn flag** consumed by the next `target 'single'` heal card;
  the copy routes through the normal heal pipeline (Field Triage, Twin Censer #69, Beacon #69 all
  interact). Non-heal single-target cards don't consume it (explicit user narrowing).

## Acceptance criteria

- [ ] Two `CardId`s in union + `CARDS` + `CARD_TYPE` (`arcane`) + `CARD_RARITY` + pools;
      Attunement tagged `engine` (Retain/Efficient-ineligible).
- [ ] Attunement while channeling: channel survives Attunement and survives the drawn card's play
      (this turn or later); a different card still breaks it.
- [ ] Chanter's Idol: first play each turn never breaks; second play breaks (unless exempt via
      Attunement); inert with no relics.
- [ ] Exempt plays don't grant extra channel ticks and don't re-enable Rest/passive MP.
- [ ] Arcane Lens: next single-target heal this turn duplicates onto `_mostWoundedOther` (#68's
      helper); flag expires at end of turn unconsumed; non-heal singles ignore it.
- [ ] Mechanic-coverage rows; N=1000 band; Idol ≤ +9pp.
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Channel cancel path:** the play-card → cancel-channel step near `_startChannel`
  (`src/engine.ts:931`) / `_tickChannel` (`:966`); insert the exemption check where "playing ANY
  card cancels it" is enforced. `cardsPlayedThisPhase` (used by First-Light Taper at `:1585`)
  already identifies "first card this turn" for the Idol.
- **Draw with identity:** `_drawOne` (`src/engine.ts:1552`) returns/exposes the drawn card so
  Attunement can stamp its uid into a per-fight `channelExemptUids` set.
- **Heal duplication:** heal path `src/engine.ts:1035+`; a `lensArmed` turn flag beside Surge's
  next-card-cost flag (Surge's implementation is the one-shot-turn-flag pattern).
- **Cards/relics plumbing:** same anchors as #65.

## Tests

- Drain channel: play Attunement → channel alive; play the drawn card → still alive; play any
  other card → broken.
- Idol: first card exempt each of two consecutive turns; second card breaks.
- Idol + Attunement-first: two plays in one turn, channel alive; third breaks.
- Exempt plays: channel tick count unchanged; passive MP still suppressed while channeling.
- Lens: Heal (4) becomes 4 + 4-to-most-wounded-other; Shadow Bolt doesn't consume the flag;
  flag gone next turn.

## Out of scope

- Liturgy / Hierophant (#73) — the enemy-phase tick cadence.
- New channel cards; retuning existing channels or the decayed-Rest economy.
