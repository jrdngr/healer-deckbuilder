# Content behavior inventory (issue #99, A2)

Two jobs in one document:

1. **A checklist for the characterization suite** (#99 A3–A11) — what each content item
   must assert. Depth is *state + exact log + events + edges*.
2. **The DSL op-vocabulary audit** for #100 — for each effect arm, whether it can be
   expressed as data or needs a `native`.

Derived by reading all 66 effect arms in `src/engine/effects.ts` and `src/engine/core.ts`.
Every arm below was read; none was inferred.

---

## Headline finding: the native count is a function of the op vocabulary

The plan estimated **10–14** arms would need a `native` escape hatch (revised up from a
first estimate of 5). Having read every arm, the honest answer is that **the number is
almost entirely determined by how rich the amount/condition vocabulary is**, not by the
arms themselves:

| Op vocabulary | Arms needing `native` |
|---|---|
| The original 22 ops | **~14** |
| Ops + `letStr`, `collect`, `strike`, template conditionals (the plan's revision) | **~5** |
| The above + the six derived-amount forms below | **2** |

The six derived amounts that collapse most of the remaining natives:

| Amount | Backing helper | Arms that need it |
|---|---|---|
| `{abilityPower: Sel}` | `m.abilityPower` | poison, taunt, bolt, hex, rampage, callBoar, drainLife, bloodbath, sicEm |
| `{auto: Sel}` | `memberDamage()` `core.ts:509` | rampage, twinShot, finale, duet, whirlwind, flurry, lunge |
| `{vulnerable: Amt}` | `vulnerableAmount()` `:562` | bolt, rampage, drainLife |
| `{sanguineSurcharge: true}` | `_sanguineSurcharge()` `:1388` | **bloodBanner**, penance |
| `{holyHealBonus: true}` | `_holyHealBonus()` `:1209` | lowHeal, highHeal, aoeHeal, consecration |
| `{missingHp: Sel}` | `maxHP - hp` | bloodbath |

**Only two arms are true natives**, and both for the same reason — a lookup or a
control-flow shape that exists exactly once and would warp the schema to encode:

- **`hex`** (`effects.ts:527-540`) — `HEX_VULN_BY_SIZE[min(fieldedPartySize(), len-1)] +
  abilityPower * HEX_VULN_PER_POWER`. An array-table indexed by party size, used once.
- **`taunt`** (`effects.ts:491-512`) — the retarget branch conditions on the
  `tauntRetargetMode` *config mode* AND `mp >= TAUNT_RETARGET_SURCHARGE`, then spends MP,
  retargets the standing telegraph, and emits its own extra log line before the main one.

Plus **two code-backed ops** that are natives under a nicer name, exactly as planned:
`revive` (`resurrect` clears 18 fields, `effects.ts:152-165`) and `purge` (`cleanse`
sweeps the party and returns whether anything was found, `:443-457`).

**`penance` is borderline** (`:609-635`): payment → death check → buff, with the log
switching to a whole different sentence on `died`. Expressible with a template conditional
plus an `{alive: Sel}` condition; if the template language ends up not supporting
sentence-level branching, this becomes the third native.

### Consequences for #100

- **`bloodBanner` is confirmed unexpressible by `{bloodCost}`.** `_bloodCost(card)` is
  `card.selfDamage + _sanguineSurcharge()` (`core.ts:1394-1396`), but `bloodBanner`
  computes `BLOOD_BANNER_HP + this._sanguineSurcharge()` inline (`effects.ts:307`) because
  it has **no `selfDamage` field**. Adding `{sanguineSurcharge: true}` resolves it with no
  behavior change; giving the card a `selfDamage` field would change behavior and needs a
  trace check. **Recommend the amount form.**
- **`bolt` does not need a native.** The log-before-zeroing-Charge ordering
  (`effects.ts:520-522`) is expressible by simply ordering the ops: `let dmg` → `log` →
  `setStat charge 0` → `damage`. It only looked native-ish.
- **`hemorrhage` does not need a native.** `consumeEnemyStatus` + a `damage` op with
  `nuke: true` (routing through `_emitEnemyNuke`, `core.ts:1097`) covers it.
- **Status writers need five modes**, not one: `set`, `add` (regen, lifebloom),
  `keepStronger` (enemy poison, hymnBonus, bigTop), `keepLonger` (barrier shieldTurns,
  shieldWall defense), and `keepStrongerIfActive` — the
  `x.defense > 0 ? max(x.defenseAmount, N) : N` idiom shared by `taunt`, `shieldWall`,
  `holdLine`, and the `strikeTurns > 0 ? …` variant in `consecration`/`sharpen`.
- **`emit` needs a slots-selector**: `battleHymn`, `bloodBanner`, `penance`, and
  `consecration` all emit `slots: livingMembers().map(x => x.slot)` or a collected subset.

---

## Cards — 31 arms (`effects.ts:86`)

`E` = has an edge case that must be asserted. Verdict `data` = expressible; `op` = needs
a named code-backed op; `native` = escape hatch.

| # | Arm | Behaviors to assert | Verdict |
|---|---|---|---|
| 1 | `lowHeal`/`highHeal` `:87` | heal = `card.heal + holyHealBonus`; log `"{name}: {m} heals {n}. ({hp}/{max})"`; `heal` event {slot, amount, hp}; **splash fires** (`_healCardSplash`) | data |
| 2 | `aoeHeal` `:97` | per-member heal + one `heal` event each; single summary log **E**: overheal clamps per member | data |
| 3 | `sunriseVigil` `:106` | pushes `delayedStartEffects`; log only, **no event**; **E**: two casts queue two entries; **E**: fires next player phase *after* Regen tick, *before* draw | data |
| 4 | `consecration` `:114` | party heal + `heal` events; then members at **full HP after healing** get `strikeBonus`/`strikeTurns`; log carries the at-full count; `hymn` event **only if count > 0** | data (`collect`) |
| 5 | `regen` `:134` | `m.regen += card.regen` (**additive**, not set); log shows the new total; `regenApplied` **E**: onto existing Regen; **E**: pending Lifebloom burst rides along | data |
| 6 | `shield` `:144` | `shield=true`, `shieldTurns=SHIELD_TURNS`; **E**: re-raising refreshes the fuse, does not stack | data |
| 7 | `resurrect` `:152` | alive, `hp=ceil(maxHP/2)`, **18 fields cleared**; `resurrect` event **E**: buffs/stance do not survive revive | **op** `revive` |
| 8 | `fontOfMana` `:166` | `refresh` keep-stronger, `refreshTurns`, `refreshRestored=0`, `refreshCap` from the card; `refreshPrimed` **E**: recast resets the per-cast total | data (`primeRefresh`) |
| 9 | `bloom` `:179` | heals the **full remaining Regen**, zeroes it, `_onRegenEnded(m, true)`; `heal` event **E**: Lifebloom burst pays out | data (`consume`) |
| 10 | `inspiration` `:192` | draws `card.draw` **through `_drawOne`** (reshuffle/Fidget Beads fire); log pluralizes; `draw` event carries actual count **E**: deck+discard empty draws fewer | data |
| 11 | `arcaneLens` `:204` | sets `lensArmed`; `lensArmed` event **E**: unconsumed, fizzles at end of turn; **E**: next single-target heal refracts | data |
| 12 | `lifebloom` `:213` | `regen +=`, `bloomBurst = LIFEBLOOM_BURST`; `regenApplied` **E**: re-arming keeps ONE pending burst | data |
| 13 | `battleHymn` `:224` | `hymnBonus` keep-stronger; `hymn` event with **all living slots** **E**: re-singing does not stack | data |
| 14 | `barrier` `:231` | every living member shielded, `shieldTurns` **keep-longer**; one `shieldApplied` each; single log **E**: never downgrades a longer Shield | data |
| 15 | `bloodTithe` `:242` | `_bloodPay`, MP += clamped to `maxMana`; log reports the **actual** delta; `refreshTick` **E**: at full MP the delta is 0 | data |
| 16 | `martyrsGift` `:251` | payer pays; **every other** living member heals; `heal` events; one log **E**: payer never heals | data |
| 17 | `crimsonPact` `:263` | pay, then draw via `_drawOne`; log pluralizes; `draw` event **E**: empty deck+discard | data |
| 18 | `scarletWard` `:279` | pay, then a normal Shield; `shieldApplied` | data |
| 19 | `transfusion` `:289` | pay; `_mostWoundedOther` heals; `heal` event **E**: **no other member alive → different log, no event** | data |
| 20 | `bloodBanner` `:303` | **every** living member pays `BLOOD_BANNER_HP + surcharge`; `bloodBannerTurns`; `hymn` event **E**: clamped to leave 1 HP | data (needs `{sanguineSurcharge}`) |
| 21 | `hemorrhage` `:315` | `total = poison × poisonTurns`; both zeroed; damage **routes through `_damageEnemy`** so Vulnerability multiplies; `_emitEnemyNuke` **E**: uncapped by design | data (`nuke`) |
| 22 | `dreadWhisper` `:327` | telegraph damage reduced, floor 0, **in place** (preview updates); log names the intent; `graveChill` **E**: no-op branch on a cast / zeroed telegraph has its own log | data (`letStr`) |
| 23 | `phalanx` `:343` | `defense`/`defenseAmount`; `defenseApplied` **E**: canPlay blocks with Defense active | data |
| 24 | `provoke` `:352` | `taunt = TAUNT_LITE_TURNS`; `taunt` event; **no bundled Defense**; **E**: standing blow is NOT redirected | data |
| 25 | `feint` `:363` | **every** hit of the telegraph redirected onto one member; `taunt` event **E**: no-op on cast / hidden / `ignoreTaunt` / empty targets — separate log | data (`letStr`) |
| 26 | `sporeburst` `:382` | consumes Regen → `ticks`; `_applyPoison(SPOREBURST_POISON, ticks)`; log pluralizes and shows enemy state; `poisonApplied`; **`_onRegenEnded` fires AFTER the poison** | data (`deferEndHook`) |
| 27 | `guard` `:397` | `guardDR`/`guardTurns`; `defenseApplied` **E**: no self-stack, recast refreshes only | data |
| 28 | `sharpen` `:407` | `strikeBonus` keep-stronger-**if-active**, `strikeTurns`; `hymn` event on one slot | data |
| 29 | `doubleStrike` `:417` | `drumPrimed = true`; log; **no event** **E**: only the basic auto reads it, not abilities | data |
| 30 | `empower` `:425` | `empowerBonus`; `hymn` event **E**: refreshing keeps one charge; consumed once in `_fireAbility` | data |
| 31 | `riposte` `:434` | `riposte = true`; `enGarde` event (turns: 1) **E**: consumed once | data |
| 32 | `cleanse` `:443` | clears `woundTurns`, per-member `poison`/`poisonTurns`/`markTurns`; **log text differs on whether anything was found**; `cleanse` event fires either way | **op** `purge` |

## Abilities — 30 arms (`effects.ts:477`)

Shell behavior to assert once, around every ability: **War Drum primes `drumPrimed`**
(`:465`) and **Empower borrows/restores `abilityPower`** with its own log line
(`:469-474`, `:793`).

| # | Arm | Behaviors to assert | Verdict |
|---|---|---|---|
| 1 | `poison` `:478` | `max(1, POISON_BASE + abilityPower)`; enemy poison **keep-stronger**; turns **set** (not max) + venomGland bonus; `poisonApplied` **E**: floored at 1 with negative power | data (`hasRelic`) |
| 2 | `taunt` `:491` | Defense `max(0, …)` keep-stronger-if-active; taunt/defense turns; **surcharge retarget branch** (config mode + MP + own log); main log; `taunt` event | **native** |
| 3 | `bolt` `:514` | `base = max(1, BOLT_BASE + power)`, `+ BOLT_CHARGE_MULT × charge`; **log prints pre-spend Charge**; charge zeroed; `bolt` event carries `vulnerableAmount(dmg)`; `defeatEnemy` if killed | data (ordering) |
| 4 | `hex` `:527` | `HEX_VULN_BY_SIZE[min(size, len-1)] + power × HEX_VULN_PER_POWER`; keep-stronger; `vulnerableTurns` **E**: stronger solo; **no event** | **native** |
| 5 | `crescendo` `:542` | draws `CRESCENDO_DRAW`; `draw` event **E**: empty deck | data |
| 6 | `rampage` `:556` | `2 × memberDamage + power`; `partyAttack` event; `defeatEnemy`; **then** `_bloodPay(RAMPAGE_SELF_DMG)` **E**: self-damage can drop him into a hotter band | data |
| 7 | `callBoar` `:567` | `boarHp = BOAR_HP + power`, `boarTurns`; `boarSummon` **E**: recast replaces at full HP | data |
| 8 | `stun` `:577` | telegraph `stunned = true`; log + `stun` event carry the **intent string** **E**: no-op branch has its own log | data (`letStr`) |
| 9 | `enGarde` `:595` | `targetOrSelf`; taunt + `riposteTurns`; **two** events (`taunt`, `enGarde`); log uses **conditional prose** (`her own` vs name) | data (template cond) |
| 10 | `penance` `:609` | `PENANCE_HP + surcharge` via **`_drainMember` (unclamped — can kill)**; `died` flag; `penanceBonus`/`penanceTurns`; **log switches sentence on death**; `penance` event carries `died` + living slots | borderline |
| 11 | `twinShot` `:637` | `TWIN_SHOT_HITS` full autos, **break on kill** | data (`strike`) |
| 12 | `concVenom` `:644` | poison **×= mult**, duration unchanged; `poisonApplied` **E**: unpoisoned → no-op log | data |
| 13 | `shieldWall` `:655` | every living member, keep-stronger-if-active + keep-longer; `defenseApplied` each; one log | data |
| 14 | `holdLine` `:665` | Defense + `holdLineTurns`; `defenseApplied`; **E**: Grudge banks **double** while it holds | data |
| 15 | `arcaneSurge` `:674` | `charge + ARCANE_SURGE_CHARGE` capped at `CHARGE_MAX` | data |
| 16 | `drainLife` `:680` | `dealt = vulnerableAmount(DMG + power)`; damage; `partyAttack`; heals **most wounded living, reduce seeded with the caster**; `heal` event only if `healed > 0` **E**: nobody wounded → the caster is healed | data (`$mostWounded`) |
| 17 | `doom` `:692` | `doomTurns = DOOM_DELAY` **E**: recast refreshes; **no event** | data |
| 18 | `sacrifice` `:699` | `targetOrSelf` pays (clamped); `+SACRIFICE_DMG`/`+SACRIFICE_POWER` **for the fight**; conditional prose; **no event** | data (template cond) |
| 19 | `finale` `:708` | `FINALE_MULT × memberDamage` | data |
| 20 | `duet` `:713` | chosen partner makes a **full auto** | data |
| 21 | `bloodbath` `:719` | `missingHp × BLOODBATH_PER_MISSING + power` | data |
| 22 | `whirlwind` `:725` | `WHIRLWIND_HITS`, **+1 in the hottest band** (`berserkerThresholds()[1]`); break on kill | data (`berserkerBandHot`) |
| 23 | `sicEm` `:733` | `SIC_EM_MULT × BOAR_STRIKE_BONUS + power` **E**: `needsBoar` gate | data |
| 24 | `mendBeast` `:738` | `boarHp +=`, `boarTurns += 1`; `boarSummon` | data |
| 25 | `standingOvation` `:746` | **every** living member `drumPrimed` | data |
| 26 | `bigTop` `:752` | `bigTopTurns` keep-stronger; **no event** | data |
| 27 | `lunge` `:758` | `LUNGE_MULT × memberDamage`; taunt keep-longer; `taunt` event | data |
| 28 | `flurry` `:765` | `each = max(1, memberDamage − FLURRY_REDUCTION)`; `FLURRY_HITS`; break on kill | data |
| 29 | `strongest` `:773` | **`_drainMember` unclamped** (Last Stand can catch it); every living member `drumPrimed` | data |
| 30 | `deadlift` `:781` | `targetOrSelf` `untargetable` keep-longer; conditional prose; **no event** **E**: AoE still excludes them | data (template cond) |

## Enemy casts — 5 kinds (`core.ts:1716`)

| Kind | Behaviors to assert |
|---|---|
| `wound` | party healing halved for N turns; `wound` event with living slots; decay at enemy-phase start (`:1541`) |
| `siphon` | MP drained, **clamped to available**; `siphon` event |
| `poison` | hero Poison applied per member; `heroPoisonApplied`; ticks **raw past all mitigation** (`:1363`); Cleanse is the only answer |
| `curse` | `markTurns` set; `curseApplied`; payoff via `targetsMarked`; decay at `:1548` |
| `consume` | enemy self-heals off its own poison; `consume` event |

Also assert `telegraphDetail()` (`core.ts:639-656`) preview text for all five — #104
derives it from the cast def, so it must be pinned first.

---

## Remaining categories (checklist only — no DSL verdict needed)

**Channels + delayed (4):** `mendingStream` tick heal + `channelPulse`; `sap` tick
Vulnerability with `SAP_VULN_CAP`; channel cancel-on-card-play and `chantersIdol`
exemption; `delayedStartEffects` ordering (**zero test references today** — pin
`effects.ts:106-113` exactly).

**Relics (21):** each needs a **not-owned control** plus its effect. Nine are probe-only
today (`loneWolf`, `focusStone`, `warband`, `reliquaryOfLight`, `ossuaryBell`,
`venomGland`, `beaconOfSecondSun`, `twinCenser`, `chantersIdol`); two are log-sniffs only
(`warDrum`, `pilgrimsFlask`). Interaction pairs come from the **20 `hasRelic` sites** —
including the two easy to miss: `effects.ts:486` (the poison ability duplicates
venomGland's extension inline) and `core.ts:2441` (drum-doubling log text).

**Hero passives (11):** Toxicologist `:539`, Grudge read `:540`, **Grudge banking `:1877`
with `HOLD_LINE_BANK_MULT`**, Last Stand `:994`, Dark Bargain `:1044`, Stunt Double
`:1830`, Riposte Master `:1858`, Arcane Battery `:1974`, Opening Act `:1978`, Feral Bond
`:2447`, Grudge reset `:2455`. Berserker/Skald/Beast Warden bands are keyed off
`m.ability` (`:515-528`), not id — assert that a *learned* ability does **not** grant the
passive.

**Enemy defs (12):** rotation ordering per step, phase transition at `hpFraction`, enrage
turn, channel hijack every N cycles, `_resolvedTargets` re-pointing when a target dies,
and the invariant that `attackTargets()` preview == applied damage.

**Events (8) + choice kinds (12):** `apothecary` has nothing; `addCardOffer`,
`removeCard`, `shrineCard`, `shrineParty`, `duplicateCard` have zero references.
`gambleGold` (`src/run.ts:1380-1388`) needs seeds hitting **all four** payout branches.

**Modifiers (3) + upgrades (9):** the modifiers are well covered at the `resolveCard` data
layer but only 4 card ids verify the resolved value reaches the **effect body** — e.g.
nothing asserts that Potent on `regen` actually ticks +1 HP per turn in play. Party/healer
upgrades are covered by a generic "some stat changed" check (`run.test.ts:885`), not
per-id.
