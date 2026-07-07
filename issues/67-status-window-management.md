# Issue 67 — Status-window management: Poison and Vulnerability as managed resources

- **Status:** 📋 Open
- **Phase:** content (cards + relics)   **Size:** L
- **Depends on:** —   **Blocks:** #72 (Ferment builds on the poison helpers)
- **Addresses:** intake 2026-07-07 — new-content wave: enemy statuses should be a resource you
  amplify, cash out, or get paid on when the window closes — not fire-and-forget debuffs.

## Why

Poison (5×5 from the Ranger) and Vulnerability (Hex/Sap) currently run out on their own schedule.
This issue gives the player agency over the windows: extend them (Venom Gland), cash poison out
early in one hit (Hemorrhage — also the first real counter to the Devourer eating its own poison),
get paid when Vulnerability expires (Embermark), convert board-wide effect density into damage
(Umbral Feast), and shave the incoming telegraph (Dread Whisper). Doom already scales on debuffs,
so it sits downstream of everything here without being named.

## Wave ground rules

Per #65: no caps / no per-fight trigger limits on new content (broken combos are fun); Charge is
Mage-only; no new MP generation; preview == applied; relics inert-when-none; mechanic-coverage
rows; `CARD_TYPE` entries; N=1000 sim gates (25–35% band, ≤ +9pp per relic).

## New cards (all Shadow)

| Card | Cost | Rarity | Target | Effect |
|---|---|---|---|---|
| **Hemorrhage** | 3 | rare | none | **Consume** the enemy's Poison: deal its **remaining total damage** (per-turn × turns left) now. No cap. |
| **Umbral Feast** | 2 | uncommon | none | Deal **1 per active effect in play** — every party-member buff and every enemy debuff counts. No cap. |
| **Dread Whisper** | 1 | common | none | The standing telegraph deals **−1 per target**. |

## New relics

| Relic | Rarity | Effect |
|---|---|---|
| **Venom Gland** | uncommon | Poison you apply lasts **+1 turn**. |
| **Embermark** | uncommon | **Whenever** the enemy's Vulnerability expires, deal **4**. (Every expiry — no per-fight limit.) |

## Design decisions

- **Hemorrhage is uncapped by explicit user verdict** — with #72 Ferment inflating the per-turn
  value it is the wave's payoff spike (a fermented Ranger poison cashes for 50+). Its damage goes
  through `_damageEnemy`, so Vulnerability multiplies it (poison *ticks* stay unmultiplied; the
  cash-out is a normal hit).
- **Umbral Feast's count** — party side: Shield, Brace, Guard, Defense, Taunt, Regen, strike/
  sharpen bonus, Empower, Riposte, Ward, Boar (each active effect on each member counts 1);
  enemy side: Poison, Vulnerability. Enraged is not a debuff. Publish the list as a helper
  (`_activeEffectCount()`) — #69's Benediction reuses the per-member buff-count logic.
- **Dread Whisper stacks with everything** (Guard, Brace, Grounding Rod) — small reductions
  compound superlinearly against multi-hit sweeps; zeroing a sweep is intended play.
- **Venom Gland applies at poison-apply time** (Imbue Venom, Sporeburst #66) via the shared
  `_applyPoison` helper — not retroactively to a running poison.
- **Embermark fires on natural expiry only** (turns reaching 0), not on Sap re-upping the timer.

## Acceptance criteria

- [ ] Three `CardId`s in union + `CARDS` + `CARD_TYPE` (`shadow`) + `CARD_RARITY` + pools; all
      three count toward the Shadow type counters (Nightfall reads them); magnitudes as constants.
- [ ] Hemorrhage: consumes poison entirely (per-turn and turns → 0), deals per-turn × turns via
      `_damageEnemy` (Vulnerability applies); unplayable/no-op decision: **gate playability on the
      enemy being poisoned** (mirrors `needsRegen`'s UX); Deep Roots(#66)-style end-hooks don't
      apply (enemy poison has no member hooks).
- [ ] Umbral Feast: damage equals the helper's count at cast time; the helper's inventory matches
      the published list exactly (test pins it).
- [ ] Dread Whisper: −1 per target on the standing telegraph; `attackTargets()` preview reflects
      it immediately; floors at 0; property test green.
- [ ] Venom Gland: +1 turn on every poison application while owned; inert with no relics.
- [ ] Embermark: 4 damage on every Vulnerability expiry; nothing when Sap keeps it alive; inert
      with no relics.
- [ ] Relic plumbing + mechanic-coverage rows + N=1000 band + ≤ +9pp each.
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Poison state:** `Enemy.poison`/`poisonTurns` (`src/engine.ts:104`); tick in the enemy/turn
  loop; share `_applyPoison(perTurn, turns)` with #66 (stacking rule: per-turn adds, duration
  takes the max) and let Venom Gland add +1 inside it.
- **Hemorrhage:** new `_applyCard` case; total = `poison * poisonTurns`; route through
  `_damageEnemy` (`_doomDamage` at `src/engine.ts:905` shows the damage-calc pattern).
- **Umbral Feast:** new `_activeEffectCount()` reading `Member` fields (`src/engine.ts:61`) and
  `Enemy` fields (`:104`).
- **Dread Whisper:** the telegraph damage shave — Grave Chill (Hush) in `_fireAbility` is the
  existing per-target shave; reuse its mechanism and preview handling (`attackTargets()` `:556`).
- **Embermark:** the Vulnerability decay site (where `vulnerableTurns` decrements to 0) in the
  enemy-phase tail; `hasRelic` branch there.
- **Cards/relics plumbing:** same anchors as #65.

## Tests

- Hemorrhage on 5×3 poison → 15 damage (×Vulnerability if hexed), poison cleared; unplayable with
  no poison.
- Umbral Feast: empty board → 0-effect count baseline; add Shield + Regen + Poison + Vuln → 4.
- Dread Whisper on a 3-target sweep: preview drops by 1 per target before end-turn; applied matches.
- Venom Gland: Imbue Venom lands 5×6; Sporeburst duration also +1.
- Embermark: Hex expires → 4 damage; Sap re-up → no trigger until final expiry.

## Out of scope

- Ferment / Plaguewright (#72).
- Multi-enemy encounters (single-enemy assumptions stand).
