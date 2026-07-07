# Issue 64 — Channeled cards

- **Status:** 📋 Open
- **Phase:** systems (cards)   **Size:** L
- **Depends on:** #63 (soft — channeled cards carry a `type`; Sap→Doom pairs with #63's Doom)   **Blocks:** none
- **Addresses:** intake 2026-07-07 — "A channeled card holds its effect across turns but is cancelled
  the moment the player plays another card; while channeling the player doesn't recover MP; each
  channel has a max number of turns. Example: a Shadow card **Drain** that damages the enemy each turn
  and returns 1–2 MP when it deals damage. **Refresh** could be channeled instead of an MP-over-time
  buff. Add 2–3 more channeled cards."

## Why

Every card today resolves the instant it's played. **Channeled cards** add a new tempo primitive: a
card whose effect repeats each turn *for as long as the player does nothing else*, trading away MP
recovery and their whole turn for a sustained effect. It rewards patient, commit-to-a-plan play and
gives several types (Shadow, Arcane, Holy, Iron) a distinct "turtle and pour it on" option.

## Design decisions (intake 2026-07-07)

- **One active channel at a time.** Starting a channel while one runs cancels the old (that's a card
  play — see below).
- **Cancelled by playing any other card.** While channeling, playing *any* card ends the channel
  immediately; it does not tick that turn. Holding the channel means ending your turn without playing a
  card.
- **No MP recovery while channeling.** Base passive MP income and any MP-over-time (a Refresh buff, Font
  of Mana, Prayer Beads reshuffle income, etc.) are **suppressed** while a channel is active — the only
  MP you get is what the channel itself returns (e.g. Drain's 1–2). This is the cost that balances a
  sustained effect.
- **Max channel length.** Each channeled card has a per-card `maxTurns` cap; after that many ticks the
  channel ends on its own. (Tunable constants; a later balance pass owns the numbers.)
- **Enemy attacks do not break a channel** in this first cut (kept simple). "Getting hit interrupts the
  channel" is a possible future twist — out of scope.
- **First tick is immediate.** Playing a channeled card starts the channel and applies its first tick
  that turn (like a cast); it then re-ticks at the start of each subsequent player phase until cancelled
  or capped.

### Open question for the balance pass (flag, don't block)

- Do **reactive** relic MP sources that are triggered by combat events rather than passive regen — the
  Tithe Candle (+MP when a member is hit) — still fire during a channel? Recommended default: **yes**
  (they're event-triggered, not passive regen), while all *passive/over-time* MP income is suppressed.
  Confirm during tuning.

## The mechanic

- A channeled card is marked by a `channel` descriptor on `CardDef` (per-turn effect params + `maxTurns`).
- Engine holds a single **channel state** (per-fight, like the Refresh state): which card, its target,
  ticks remaining. Model it on the existing `refresh`/`refreshTurns`/`refreshCap` fields.
- **Tick** fires at the same start-of-player-phase boundary where Refresh/passive MP tick today
  (`src/engine.ts:971-1006`, passive at `:1266-1277`) — the channel tick runs there and the passive-MP
  grant is skipped while a channel is active.
- **Cancel on play:** in the card-play path, if a channel is active and a card is played, cancel it
  (mirror the `cardsPlayedThisPhase` bookkeeping at `src/engine.ts:1287`). Starting a new channel cancels
  the old first.
- **Cap:** decrement ticks each turn; end at 0 (mirror `refreshTurns` decay at `:1002-1006`).
- Expose the active channel + ticks-remaining as engine state/events so the UI can show it (a channel
  badge, turns left, and that playing a card cancels it). Visual polish is the maintainer's per
  `CLAUDE.md`; this issue only exposes the state and emits events.

## The cards (5)

1. **Drain** (Shadow, channeled) — each tick: deal direct damage to the enemy; **if it dealt damage,
   return 1–2 MP**. `target 'none'`. Reuses `_damageEnemy`.
2. **Refresh — reworked to channeled** (Arcane) — convert today's "restore N MP/turn for 3 enemy turns"
   buff into a channel: each tick restore N MP, up to `maxTurns`, cancelled if you play a card. Net MP =
   channel return minus the base regen you forgo — must be tuned to be worth idling.
   - **Keep Font of Mana as the non-channel buff-style MP engine** so a fire-and-forget option remains.
     (Whether Font *also* becomes channeled is a later call; default: leave Font as-is.)
3. **Mending Stream** (Holy, channeled) — each tick: heal a chosen member for X. A sustained
   single-target heal. `target 'single'` (channel remembers the target; ends early if that member dies).
4. **Sap** (Shadow, channeled) — each tick: apply +1 Vulnerability to the enemy (stacking up to a cap).
   Feeds **#63's Doom** (whose damage scales with enemy Vulnerability). `target 'none'`.
5. **Fortify** (Iron, channeled) — each tick: grant a Shield to a chosen member (sustained protection
   while you turtle). `target 'single'`.

That's the two intake examples (Drain, channeled Refresh) plus three more (Mending Stream, Sap, Fortify),
spanning Shadow / Arcane / Holy / Iron.

## Acceptance criteria

- [ ] `CardDef.channel` descriptor exists; the engine tracks one active channel (card + target + ticks
      remaining) per fight and emits events for start / tick / cancel / end.
- [ ] **Cancel-on-play:** playing any card while channeling ends the channel that turn (it does not
      tick); starting a second channel cancels the first.
- [ ] **MP suppression:** while a channel is active, base passive MP and all MP-over-time income are not
      granted; only the channel's own MP return (Drain) applies. (Reactive relic MP per the open
      question's default.)
- [ ] **Cap:** each channel ends after its `maxTurns` ticks; the first tick lands on the cast turn.
- [ ] All 5 cards defined with tunable costs/magnitudes and correct targets; each carries a `type`
      (#63). Drain and Sap read as **Shadow**, Refresh as **Arcane**, Mending Stream as **Holy**,
      Fortify as **Iron**. Shop/reward-eligible as appropriate.
- [ ] **Refresh reworked** from the MP-over-time buff to a channel; Font of Mana left as the buff-style
      MP engine. No `RUN_SAVE_VERSION` bump needed (channel state is per-fight, never serialized; cards
      are referenced by id).
- [ ] **Sap → Doom** verified: Sap's stacked Vulnerability increases Doom's damage (cross-check with #63).
- [ ] Telegraph invariant intact: Drain/Sap affect party→enemy damage / enemy Vulnerability and never
      change `attackTargets()`.
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean. Lands as focused `jj` commits — suggest:
      (1) the channel mechanic + Refresh rework; (2) the four new channeled cards.

## Implementation notes (anchors)

- **CardDef:** `src/constants.ts:51-88` — add `channel?: { maxTurns: number; ... }`.
- **Channel state:** model on Refresh's engine fields (`src/engine.ts:209-212`, reset `:308-312`); tick
  beside the Refresh tick (`:991-1006`); suppress passive MP at `:1266-1277` while active.
- **Cancel-on-play / restrained-turn signal:** `cardsPlayedThisPhase` (`src/engine.ts:1272,1287`); the
  card-play path resolves in `playCard` (`:1371+`).
- **Hold-the-channel turn:** `endTurn` / `_endTurnInternal` (`:1850-1857`); the "rest" MP path is
  `skipTurn` + `restRegenNow()` (`:1839-1846`) — channeling suppresses that regen too.
- **Refresh today:** buff fields + tick (`:209-212`, `:991-1006`), card def `src/constants.ts:719-720`,
  `refreshCap`/`FONT_MP_CAP` plumbing (`constants.ts:69`). Rework Refresh's def to a `channel`; keep
  `fontOfMana` (`constants.ts:730-732`) as the buff.
- **Drain damage / Sap Vulnerability:** `_damageEnemy` and the Hex `vulnerableAmount` path (used by
  the Warlock's Hex ability); Sap adds Vulnerability the same way Hex does.
- **New CardIds:** extend the `CardId` union + `CARDS` (`src/constants.ts:22-35`, `:684-769`).

## Tests (`test/engine.test.ts`)

- Channel ticks each turn while no card is played; ends exactly at `maxTurns`.
- Playing any card mid-channel cancels it (no tick that turn); starting a new channel cancels the old.
- MP is not restored by passive regen while channeling; Drain's per-tick MP return is the only income
  and only when it dealt damage.
- Drain damages each tick (and obeys Vulnerability); Mending Stream heals its remembered target each
  tick and ends if that member dies; Fortify shields each tick; Sap stacks Vulnerability to its cap.
- **Sap + Doom** (with #63): channeling Sap for K turns raises Doom's damage by the expected amount.
- Reworked Refresh restores MP per tick up to its cap and cancels on a card play.
- No channeled card changes `attackTargets()` (telegraph == applied).

## Out of scope

- Enemy attacks interrupting a channel; channels surviving across fights.
- Deep balancing of channel magnitudes / `maxTurns` (tunable constants; a later balance pass owns them).
- Converting Font of Mana (or other buffs) to channels; heavy channel-specific card-face visuals
  (a channel badge is welcome, but the maintainer verifies visuals per `CLAUDE.md`).
