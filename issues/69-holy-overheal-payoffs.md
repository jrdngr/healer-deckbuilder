# Issue 69 — Holy overheal & board-state payoffs

- **Status:** ✅ Complete
- **Phase:** content (cards + relics)   **Size:** L
- **Depends on:** —   **Blocks:** #76 (Lightkeeper deepens the overheal seam)
- **Addresses:** intake 2026-07-07 — new-content wave: excess healing and buff density should be
  payoffs, not waste; heals should have reasons beyond the HP bar.

## Why

A topped-off party currently makes heal cards dead draws (only Aegis Font and Vanguard's Banner
care). This issue makes "my party is healthy" a plan: overheal converts to mitigation
(Absolution), full HP converts to offense (Consecration), topping someone off pays cards
(Beacon), heals splash (Twin Censer), and buff *density* itself is a stat that every buff card in
the game feeds (Benediction — sharing #67's effect-count helper). Sunrise Vigil adds the wave's
timing tool (heal *after* the blow), and Rootbind is the generic duration extender that makes
every timed effect — old and new — worth more.

## Wave ground rules

Per #65: no caps / no per-fight trigger limits on new content (broken combos are fun); Charge is
Mage-only; no new MP generation; preview == applied; relics inert-when-none; mechanic-coverage
rows; `CARD_TYPE` entries; N=1000 sim gates (25–35% band, ≤ +9pp per relic).

## New cards

| Card | Type | Cost | Rarity | Target | Effect |
|---|---|---|---|---|---|
| **Benediction** | holy | 2 | uncommon | single | Heal 2, **+1 per active buff on the target**. No cap. |
| **Sunrise Vigil** | holy | 2 | common | none | **At the start of your next turn**, heal every living member 2. (Lands after the enemy blow — after regen ticks is fine; before draw.) |
| **Consecration** | holy | 3 | rare | all | Heal all 1; members **at full HP afterward** gain **+1 auto for 2 enemy turns**. |
| **Absolution** | holy | 2 | uncommon | single | Heal 3; **any overheal becomes Brace** on the target. No cap. |
| **Rootbind** | nature | 2 | rare | none | **All friendly timed effects** (Regen, Shield/Brace timers, Guard, Defense, strike buffs) last **+1 turn**. |

## New relics

| Relic | Rarity | Effect |
|---|---|---|
| **Beacon of the Second Sun** | rare | **Whenever** a card heals a member to full, **draw 1**. (No per-fight cap.) |
| **Twin Censer** | rare | Single-target heal **cards** also heal the most wounded other member 1. |

## Design decisions

- **Benediction reuses `_activeEffectCount`'s per-member half** (built in #67; whichever issue
  lands first owns the helper). Buffs counted: Shield, Brace, Guard, Defense, Taunt, Regen,
  strike/sharpen bonus, Empower, Riposte, Ward, Boar.
- **Overheal capture is a card-level effect** (Absolution), distinct from Aegis Font's relic-level
  overheal→Ward: Absolution converts to **Brace** and both can coexist (Font sees only the overheal
  Absolution didn't convert — Absolution converts first, Font gets nothing from that cast; note in
  code).
- **Sunrise Vigil needs the wave's delayed-effect queue**: entries fire at player-phase start
  after the Regen tick, before draw. The queue is generic (one entry kind for now).
- **Rootbind sweeps member timed effects only** — not enemy statuses (that's #67's territory), not
  channels (turn-gated), not once-armed flags (Empower/Riposte/drumPrimed have no timers).
  Publish the exact field list in the implementation.
- **Beacon is uncapped** (user verdict): heal-to-full → draw can chain (drawn heal tops the next
  member). Bounded by MP and deck contents; that's the fun.
- **Twin Censer reads *cards*** (`target 'single'` heals) — not regen ticks, not ability heals —
  and routes its splash through the normal heal pipeline (Field Triage applies; it can itself
  trigger Beacon).

## Acceptance criteria

- [x] Five `CardId`s in union + `CARDS` + `CARD_TYPE` (4 holy, Rootbind nature) + `CARD_RARITY` +
      pools; magnitudes as named constants.
- [x] Benediction heals 2 + exact buff count; count source is the shared helper.
- [x] Sunrise Vigil: queue entry fires next player-phase start (post-regen, pre-draw); fires even
      if cast twice (two entries); dead members skipped at fire time; fight end clears the queue.
- [x] Consecration: the +1/2-turn strike buff applies only to members at full HP *after* its heal.
- [x] Absolution: overheal → Brace amount (respecting Brace-replaces-Shield rules); no cap.
- [x] Rootbind: every listed timer +1; effects at 0 (absent) are untouched; a test pins the field list.
- [x] Beacon: draw on every card-driven heal-to-full (direct heals, Twin Censer splash, Radiance
      later in #76); regen ticks do NOT trigger it; inert with no relics.
- [x] Twin Censer: splash 1 to most wounded other (shared `_mostWoundedOther` from #68); no
      splash on `all`/`none` heals or ability heals; inert with no relics.
- [x] Mechanic-coverage rows; N=1000 band; ≤ +9pp per relic.
- [x] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Heal pipeline:** `src/engine.ts:1035-1059` (Reliquary of Light `:1035`, Field Triage `:1049`,
  Aegis Font overheal `:1059`) — overheal capture and heal-to-full detection live here; give the
  heal path a result struct ({healed, overheal, reachedFull}) so Absolution / Beacon / #76
  Radiance all read one source.
- **Player-phase start:** `_startPlayerPhase` `src/engine.ts:1508` (regen tick, then queue, then
  draw at `_drawTo` `:1570`).
- **Timers for Rootbind:** `Member` fields (`src/engine.ts:61`): `regen`, `shieldTurns`,
  `braceTurns`, `guardTurns`, `defense` duration, `strikeTurns`, `taunt` duration.
- **Strike buff:** Sharpen/Embolden's `strikeBonus`/`strikeTurns` for Consecration.
- **Cards/relics plumbing:** same anchors as #65.

## Tests

- Benediction on a member with Shield+Regen+Guard → heal 5.
- Sunrise Vigil: cast, take the enemy blow, next turn all living members +2 HP before draw.
- Consecration: mixed party — only post-heal-full members get the strike buff.
- Absolution at full HP → Brace 3; at 1 missing → heal 1 + Brace 2; with Aegis Font owned,
  Font does not double-convert.
- Rootbind: Regen 2 → 3 ticks-equivalent; Shield timer 1 → 2; absent effects untouched.
- Beacon chain: heal-to-full draws a card; a second full-top draws again (no cap).
- Twin Censer: splash routes through Field Triage (+2 below half) and can trigger Beacon.

## Out of scope

- Radiance / Lightkeeper (#76) — reuses the heal-result struct and Brace stacking carve-out.
- Retuning Aegis Font / Reliquary of Light.
