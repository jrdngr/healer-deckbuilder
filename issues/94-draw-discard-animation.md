# Issue 94 — Defer the draw to the player's turn; animate discards out and draws in

- **Status:** 📋 Open
- **Phase:** ui (battle polish) + engine (turn timing)   **Size:** L
- **Depends on:** #93 (draws animate into the overlapping hand) — soft; can build against either
  layout   **Blocks:** —
- **Addresses:** intake 2026-07-17 — "Animate discards moving to the discard deck at the end of the
  turn. Animate drawn cards moving from the draw deck at the start of the turn. Do not draw cards
  until the player's next turn starts."

## Why

The per-turn draw happens at the **tail of `endTurn`**: `_endTurnInternal` discards the hand
(`core.ts:2387-2391`), runs the party phase (`:2395`) and enemy phase (`:2401`), then immediately
calls `_startPlayerPhase()` (`core.ts:2402`) which draws (`_drawTo(this.handSize)`, `core.ts:1973`).
So the next hand materializes *inside the same End-Turn click*, before the enemy phase has even
finished animating on screen — the hand is never visibly empty, and there is no motion for cards
leaving to the discard pile or arriving from the draw pile (drawing just mounts cards with the
`card-in` CSS deal-in; there is no fly-to-pile FX — `animations.ts:616-624` only floats a "+N cards"
text for card-driven draws).

## Approach (maintainer decision, intake 2026-07-17)

**Defer the draw in the engine.** Split the end-of-turn draw out of `_endTurnInternal` so the hand
is **genuinely empty** during the party + enemy phases, and only fills when the UI advances to the
player's turn. Then layer the animations on that honest timing: discards fly to the discard pile as
the turn ends; the enemy phase resolves with an empty hand; cards fly from the draw pile as the
player turn begins.

This is the bigger-but-faithful option (chosen over pure-UI sequencing). It touches turn timing, so
guard the engine change with tests.

## Acceptance criteria

- [ ] **Draw is deferred out of `endTurn`.** After `endTurn()` resolves, `game.hand` is **empty**;
      the new hand is drawn only by a distinct, separately-invoked step that begins the player phase.
      The first hand at `start()` still draws normally (`core.ts:958`).
- [ ] **No double-draw / no skipped draw.** Over a full battle the player draws exactly as many cards
      per turn as before (hand refilled to `handSize`, plus Busker's extra, `core.ts:1975-1978`).
      Reshuffle-on-empty (`core.ts:1987-1988`), Fidget Beads MP (`core.ts:1992-1997`), Mage charge,
      passive MP, Regen tick, and delayed start effects all still fire on the player-phase start in
      the same order (`_startPlayerPhase`, `core.ts:1921-1982`) — only the *timing* of when that step
      runs relative to the UI changes, not its internal sequence.
- [ ] **Discard-out animation.** At end of turn, the discarded hand animates flying from each card's
      hand position to the discard-pile element (`Hand.tsx:87-91`) before the enemy phase visuals.
- [ ] **Empty hand through the enemy phase.** While the party/enemy phases resolve on screen, the
      hand area is visibly empty (matches the now-empty engine `hand`).
- [ ] **Draw-in animation.** As the player's turn begins, the new hand animates flying from the
      draw-pile element (`Hand.tsx:55-59`) into the hand, then settles into the #93 overlap layout.
- [ ] Pile counters (`game.drawPile.length` / `game.discardPile.length`) update consistently with
      the animations (no counter jumping before its cards visibly move).
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean; **engine timing change is covered by a
      new test** (below). Split into logical `jj` commits if the engine change and the animation land
      as separable units (engine defer first, animation second).

## Implementation notes (anchors)

- **Engine split:** `_endTurnInternal` (`core.ts:2363-2402`) currently ends with
  `_runPartyPhase()` → `_runEnemyPhase()` → `_startPlayerPhase()`. Extract the draw (and the rest of
  the player-phase setup, or just the draw) so `endTurn` stops **before** the hand is refilled, and
  add a public entry (e.g. `beginPlayerTurn()` / `drawForTurn()`) the UI calls to run it. Decide
  whether *all* of `_startPlayerPhase` (regen, MP, charge) defers with the draw or only the draw —
  simplest correct choice is to defer the whole `_startPlayerPhase` call, so its ordering is
  preserved; document which you chose in Resolution.
- **UI drive point:** the turn button is in `Actions.tsx` (End Turn); the fight/animation seam is
  `FightScreen.tsx` (`onBattleEnd` at `:47-58`) and `animations.ts`. The UI already sequences enemy
  phase FX; hook the new `beginPlayerTurn()` call to fire after the enemy-phase animation completes,
  then play the draw-in FX.
- **Animation targets:** draw pile button `Hand.tsx:55-59`, discard pile button `Hand.tsx:87-91`;
  pile styles `styles.css:670-690`. Mirror the existing FX plumbing pattern used by GoldFx
  (`src/goldFx.ts` + `GoldFx.tsx`, driven from `App.tsx:103-135`) — measure element geometry, plan
  fly-from/fly-to targets, render an overlay layer. Existing card deal-in `card-in`
  (`styles.css:556-561`) can remain as the settle at the end of the draw-in fly.
- **`useGame` binding:** the hook forces a re-render via a tick after each action (`src/useGame.ts`);
  the deferred `beginPlayerTurn` must go through the same action path so the empty→full hand
  transition re-renders.
- **Beware:** anything that reads `game.hand` between turns (e.g. AI/telemetry, log rendering) now
  sees an empty hand during the enemy phase — audit for assumptions that the hand is always full
  post-endTurn.

## Tests

- `test/engine.test.ts`: add a test asserting that after `endTurn()` the hand is empty and that a
  subsequent `beginPlayerTurn()` (or whatever the entry is named) refills to `handSize`, with pile
  sizes conserved (drawn count = draw-pile decrease, discarded count = discard-pile increase).
  Assert the per-turn draw count is unchanged vs. the old behavior across a couple of turns
  (including a reshuffle when the draw pile empties). Telegraph/`attackTargets()` property test is
  unaffected (no damage mechanic changes) but keep it green.

## Out of scope

- Card sizing (#92) and the overlap layout (#93) — this issue only adds motion + timing.
- Changing `handSize`, draw counts, or any card/relic draw mechanic — timing only.
- The "+N cards" mid-turn draw float (`animations.ts:616-624`) for card-driven draws stays as-is.
- Animating the party/enemy phase itself beyond leaving the hand empty during it.
