# Issue 72 — Plaguewright: a second poison member and Ferment

- **Status:** 📋 Open
- **Phase:** content (roster + ability)   **Size:** M
- **Depends on:** #67 (shared `_applyPoison` helper + poison-window web)   **Blocks:** none
- **Addresses:** intake 2026-07-07 — new-content wave: a second poison hero whose ability changes
  how poison *behaves*, not just its numbers (first-draft flat doubling rejected as lazy).

## Why

Poison is a flat drip the player fires and forgets. The Plaguewright turns it into an
**investment**: while Ferment runs, each poison tick deals its damage, then the per-turn value
*grows* and the duration *doesn't count down* — compounding instead of expiring. A fresh Ranger
poison (5×5 = 25 total) fermented once becomes 5+7+9 during the window, then 11×5 after: **76
total**, or an inflated 11×5 = 55 **Hemorrhage** (#67) cash-out. Against the Devourer (which eats
its own poison) fermenting is a deliberate race. Approved design, redesign round 2026-07-07.

## The member

- **`plaguewright`**, name "Plaguewright" — `maxHP 10`, `damage 3`, salary **17**, ability
  `'ferment'`. Mid-line caster body (Ranger-adjacent stats, one less HP).

## The ability — Ferment (ability card)

- **Card:** cost **2**, `target 'none'`, `ability 'ferment'`, type **nature** (poison/toxin lives
  in nature per the #63 mapping — `imbuePoison` precedent). Counts toward nature type counters.
- **Effect:** for the next **3 enemy turns**, the enemy's Poison **compounds**: each tick it deals
  its current per-turn damage, then per-turn **+2** and remaining **duration does not decrement**.
- **Recasts extend the window** (+3 enemy turns per cast, additive). No caps on window length,
  per-turn growth, or resulting totals.
- Ferment with no active poison: the window still opens (it ferments whatever poison arrives
  during it) — poison applied mid-window compounds from its application turn.
- Ability power (Empower / injury `injuryAbilityPenalty`) modifies the **+2 growth per tick**.

## Design decisions

- **Fermentation is enemy state** (`fermentTurns`), decremented in the enemy-phase tail like other
  enemy timers; the tick-order rule is *damage → grow → (skip duration decrement)*.
- **Interactions (all intended):** Venom Gland (#67) makes each poison application longer → more
  compounding room; Sporeburst (#66) adds per-turn via the stacking rule and ferments too;
  Hemorrhage (#67) reads the inflated per-turn × frozen duration; the Devourer's consume eats the
  whole investment (counterplay both ways); Doom counts poison as a debuff, unchanged.
- **Cracked Hourglass's Poison power bonus** (+2 on apply) composes upstream; no special-casing.

## Acceptance criteria

- [ ] `AbilityId 'ferment'`; `plaguewright` in `MEMBER_POOL`, `DRAFT_POOL`, `MEMBER_BASE_SALARY`
      (17), `MEMBER_ABILITY_FLAVOR`; ability card in `ABILITY_CARD` + the ability-cards block
      (cost 2, `target 'none'`) + `CARD_TYPE` (`nature`); excluded from shop/starter pools like
      all ability cards; unplayable while the Plaguewright is down.
- [ ] While fermenting: tick deals damage, per-turn +2 (×ability power), duration frozen; window
      decrements once per enemy phase; after it closes, normal decay resumes at the inflated rate.
- [ ] Recast adds +3 to the remaining window.
- [ ] Poison applied mid-window compounds; a window with no poison does nothing until poison lands.
- [ ] No enemy-telegraph surface (party→enemy only) — property test untouched but still green.
- [ ] Mechanic-coverage row; N=1000 sim with the Plaguewright fieldable stays in the 25–35% band.
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Member/ability plumbing:** #61 (Sentinel) is the template — `AbilityId` union
  (`src/constants.ts:21` area), `MEMBER_POOL` (`:140-198`), `ABILITY_CARD` map (`:795-815`),
  salary table, flavor table; `_fireAbility` case in `src/engine.ts` (~`:1700-2160`).
- **Poison tick:** the enemy-phase poison tick site; add the ferment branch there, reading
  `Enemy.fermentTurns` (new field near `poison`/`poisonTurns`, `src/engine.ts:104`).
- **Shared helper:** `_applyPoison` from #66/#67 needs no change — Ferment mutates tick behavior,
  not application.

## Tests

- Fresh 5×5 poison + Ferment: per-turn sequence 5,7,9 dealt; after window, 11×5 remaining;
  fight total 76.
- Recast mid-window: 6-turn window, duration still frozen throughout.
- Hemorrhage during fermentation reads per-turn × frozen turns (e.g. 9×5 = 45 mid-window).
- Empower on the Plaguewright: growth becomes +3/tick.
- Devourer consume during fermentation clears everything (window keeps running, empty).
- Ferment before any poison, Imbue Venom next turn → compounding starts from that tick.

## Out of scope

- More poison sources or multi-poison tracks; retuning Imbue Venom's 5×5.
- Plaguewright-specific relics.
