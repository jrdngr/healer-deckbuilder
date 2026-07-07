# Issue 65 — Iron mitigation web: steer hits, get paid for blocking

- **Status:** 📋 Open
- **Phase:** content (cards + relics)   **Size:** L
- **Depends on:** —   **Blocks:** #74 (Duelist pays off this web)
- **Addresses:** intake 2026-07-07 — new-content wave: synergies must be systemic (combined
  effects compound through shared state), not card-A-buffs-card-B.

## Why

Iron today is pure damage prevention. This issue makes prevention *productive*: you steer the
enemy's telegraphed hits into prepared members (Feint, plus existing Taunt/Provoke/Goad), and
blocking converts into offense (Anvil Stance, Whetstone) or into more mitigation (Bulwark Core).
The better your telegraph read, the bigger the payoff — a superlinear web that Shield, Brace,
Guard, Barrier, Fortify, and Scarlet Ward (#68) all feed without being named.

## Wave ground rules (apply to every #65–#76 issue)

- **No caps and no per-fight trigger limits on new content. Broken combos are fun.** Tune with
  base magnitudes and costs only. (Existing cards' caps — Doom 18, Nightfall 14, Sap 75% — untouched.)
- **Charge stays Mage-only**; **no new MP generation** anywhere (draw is the economy payoff).
- Standing laws: preview == applied property test, relic code inert-when-none-owned, curses
  bought-only, mechanic-coverage harness rows for every new card/relic, `CARD_TYPE` entry for
  every new card (compile-enforced), N=1000 sim gates (25–35% full-run band; ≤ +9pp per relic).

## New cards (all Iron)

| Card | Cost | Rarity | Target | Effect |
|---|---|---|---|---|
| **Feint** | 1 | uncommon | single | Redirect **all hits of the standing telegraph** onto the target member. |
| **Anvil Stance** | 2 | uncommon | single | While the target holds a Shield or Brace, their autos deal **+2**. |
| **Interlock** | 2 | uncommon | all | Every living member gains **Guard 1 for 2 enemy turns**; stacks freely with existing Guard (this relaxes Guard's no-self-stack rule for Interlock's grant). |

## New relics

| Relic | Rarity | Effect |
|---|---|---|
| **Whetstone of the Patient** | common | Members who took **no damage during the last enemy phase** deal +1 on their auto this turn. |
| **Bulwark Core** | rare | When a Shield **fully blocks** a hit, the member keeps **Brace 2** afterward. |

## Design decisions

- **Feint reuses the taunt-surcharge retarget machinery** (the standing-blow retarget path behind
  `DEFAULT_TAUNT_RETARGET_MODE = 'surcharge'`) but as a card effect with no MP surcharge — the
  card's cost *is* the price. Redirecting a multi-hit telegraph stacks all hits on one member.
- **Anvil Stance is stateful-conditional, not timed**: it marks the member and the +2 is checked at
  auto time against current Shield/Brace state — Fortify (channel) or Rootbind (#69) extending the
  Shield extends the payoff. The mark persists for the fight (no duration; the *condition* gates it).
- **Whetstone** needs a per-member `tookDamageLastEnemyPhase` flag set in the damage pipeline and
  cleared at enemy-phase start. Fully-blocked hits (Shield) deal 0 damage → still "untouched"
  (deliberate: blocking well is the point).
- **Bulwark Core**: Shield and Brace normally replace each other; here the Shield was just consumed,
  so granting Brace is clean. Chains with Radiance's stacking Brace (#76).

## Acceptance criteria

- [ ] Three new `CardId`s in the union + `CARDS` + `CARD_TYPE` (all `iron`) + `CARD_RARITY` +
      shop/reward pool eligibility; magnitudes as named constants.
- [ ] Feint retargets the standing telegraph; `attackTargets()` / `attackLines()` preview the new
      target immediately (preview == applied property test stays green).
- [ ] Anvil Stance: +2 applies on autos only while the member currently holds Shield or Brace;
      dropping/expiring the hold drops the bonus; regaining it restores the bonus.
- [ ] Interlock: Guard 1 for 2 enemy turns on every living member, additive with any existing Guard
      (no stack cap); still additive with Defense per current rules.
- [ ] Whetstone: +1 auto for members untouched last enemy phase; inert with no relics; a fully
      Shield-blocked hit counts as untouched.
- [ ] Bulwark Core: full block → Brace 2 on that member; partial block (Brace/Guard/Defense
      reductions) does not trigger it; inert with no relics.
- [ ] `RelicId` union + `RELICS` entries + magnitude constants + rarity prices; both flow into
      spoils/reliquary rolls automatically.
- [ ] Mechanic-coverage rows for all five; N=1000 sim inside the band; each relic ≤ +9pp.
- [ ] `npm test` / `npm run typecheck` clean; ends in its own `jj` commit.

## Implementation notes (anchors)

- **Cards:** `CardDef` `src/constants.ts:90-135`; `CARD_TYPE` map `:941-963`; `CARD_RARITY` `:1544`;
  `CARD_POOL` `:1588`. Effects as new cases in `_applyCard` (`src/engine.ts:1739-2107`).
- **Feint:** the taunt retarget path in the telegraph code (see `DEFAULT_TAUNT_RETARGET_MODE`
  handling); previews `attackTargets()` / `attackLines()`.
- **Autos:** the auto-attack damage calc around `src/engine.ts:431-451` (Vanguard/Lone Wolf
  branches show the pattern) for Anvil Stance / Whetstone bonuses.
- **Guard:** `guardDR`/`guardTurns` on the `Member` interface (`src/engine.ts:61`); relax the
  self-stack rule only for Interlock's grant.
- **Relics:** `RelicId` union `src/constants.ts:1777`, `RELICS` `:1863`, magnitude constants near
  `:1815`, `hasRelic` `src/engine.ts:416`. Full-block detection in the mitigation pipeline
  `src/engine.ts:1130-1160` (Stormglass/Ward handling shows where a hit resolves as fully absorbed).

## Tests

- Feint: telegraph a two-target attack, Feint onto the Tank → both hits land on the Tank and
  `attackTargets()` predicted exactly that before resolution.
- Anvil Stance on/off with Shield gained → lost → regained (Fortify tick) toggles the +2.
- Interlock stacks Guard 1 + Guard 1 → −2 per hit; timers expire independently.
- Whetstone: member hit last phase gets no bonus; fully-blocked member gets it; relic absent → no code path.
- Bulwark Core: full block grants Brace 2; a Brace-reduced (nonzero) hit doesn't.

## Out of scope

- The Duelist member and multi-trigger Riposte (#74).
- Any retuning of existing Iron cards or Grounding Rod.
