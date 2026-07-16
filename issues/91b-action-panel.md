# Issue 91b — Action Panel (Pay-on-Play) — proposal B

- **Status:** 📋 Open
- **Phase:** post-demo (healing availability)   **Size:** L
- **Depends on:** —   **Blocks:** —
- **Addresses:** planning session 2026-07-16 — a 5-reviewer design tournament on "make healing
  available when needed without the 4-heal attractor" among three action-panel variants. Final
  ranking **P2 (Pay-on-Play) > P1 (Pay-on-Stage) > P3 (Rent)**; this issue is the winner, P2.

> **This is design proposal B**, the competing alternative to **issue 91a (Card Bank Slot,
> "The Reserve")**. Both are prototyped on their own branches and playtested **head-to-head**
> before either ships — 91a tests *penalize-to-hold* (a bank with escalating upkeep), 91b tests
> *free-to-hold* (a panel you stock for free and pay for at fire). This issue is buildable as a
> prototype, but is **not unconditionally greenlit for final ship**: do the head-to-head first, and
> do not tear out Retain "for real" until the comparison lands (see Approach).

## Why

Healing is often unavailable the exact turn it's needed. Hand size is 3 (`HAND_SIZE`,
`src/data/tuning.ts:465`), drawn fresh at the start of each player phase (`_drawTo` in
`_startPlayerPhase`, `src/engine/core.ts:1959`), and **unplayed cards are discarded at end of turn**
(`_endTurnInternal`, `src/engine/core.ts:2210`). Turn order is player-first — you see one telegraph a
turn ahead and it resolves at the end of your current turn — and hidden attacks conceal their target.
There is no tutor/scry/mulligan (all cut). The result: the right answer routinely arrives a turn early
and vanishes, so the safe play is to flood the deck with a few premium heals — the **"4 solid heal
cards is the only correct deck"** attractor the maintainer wants gone, without trivializing the
MP-scarcity + spike-lethality + randomness tension (the MP economy is deliberately tuned to run the
player "hard-dry" in 69–90% of fights).

91b's answer is a persistent 3-slot **action panel you stock for free** and **pay for at fire**.
Because placement and holding cost nothing, an answer drawn a turn (or more) early can wait in the
panel until its blow lands — fixing availability **without touching MP** — while paying each card's
cost **at activation** keeps MP the binding constraint on the spike turn, so spike lethality and the
#90 starvation band survive. It is the most heal-flood-**neutral** of the tournament variants: free
positioning makes a *diverse* toolkit (shield/taunt/cleanse/heal) as convenient as stacking duplicate
premium heals, without buffing heals.

The panel splits the player turn into two phases. **Phase 1 (stage):** draw to hand size, place cards
into the panel for free, then discard the rest of the hand. **Phase 2 (act):** activate panel cards,
paying each card's normal MP cost as you fire it, then end the turn. The panel persists across turns,
so a staged answer waits — free — for exactly the telegraphed blow you positioned it against, and you
choose *who* it targets at fire time (the payoff against hidden-target attacks).

**Acknowledged limitation (by design):** this does not by itself kill the tiny-all-heals-deck being
optimal. That is deferred to a later pass introducing attacks raw healing can't keep up with (a
separate issue). Do not try to solve it here.

## Approach (tournament outcome + maintainer decisions, 2026-07-16)

Build the mechanic exactly as specified below. Key decisions already settled (do not relitigate):

- **Two-phase player turn.** `turnStep: 'stage' | 'act'`. Phase 1 (`stage`): draw to `handSize`, stage
  cards into the panel (**free**), optionally unstage one (see swap), then a **commit** step
  (`advanceToAct`) discards the remaining hand. Phase 2 (`act`): activate panel cards, **paying each
  card's MP cost at fire**, then end the turn.
- **Persistent panel, free to hold.** `panel` (default **3** slots, upgradeable) carries staged cards
  across turns at **no cost** — no upkeep, no rent. Per-fight state only.
- **Pay at fire, not at stage.** `stageCard` spends **0 MP**; `activatePanelCard` deducts the card's
  `cost` at activation. Unlimited activations per turn — bounded naturally by MP (this is what keeps
  spikes lethal: you still cannot fire more than you can afford on the spike turn).
- **Soft single-swap per turn.** Staging is otherwise one-way (a staged card leaves a slot only by
  being played). Escape valve: **once per turn**, in the `stage` step, `unstageCard(i)` sends one
  staged card to the discard pile for a **small fixed cost** (default **`UNSTAGE_COST = 1` MP**;
  alternate lever: discard a hand card instead), freeing the slot for a fresh stage. This is the
  *only* friction on re-filtering the panel — a balance knob (tune in sim, ~1–2 MP). It replaces the
  harder "dump the whole panel" escape (rejected as a UX trap).
- **Rest is a Phase-1 action that forbids activation.** Rest is offered only in `stage`; taking it
  grants full `restRegen` MP, **skips Phase 2**, ends the turn, and leaves the panel loaded. Because
  firing lives in Phase 2, "recover MP" and "fire the reserve" are mutually exclusive by construction.
  **Free staging does NOT reduce Rest** (positioning is free), so the healthy loop is: quiet turns
  rest to bank MP + position answers for free; spike turn spend the banked MP firing the right
  answers. The `SKIP_REGEN_DECAYED` "played-then-rest" path is **retired** — the two-phase structure
  removes that case (you cannot activate and then Rest).
- **Target chosen at activation.** Cost is flat (`effectiveCost` returns `card.cost`), so staging
  needs no target; you pick who a shield/cleanse protects when you fire it.
- **Any card is stageable**, including member-ability and channel cards. Staging a channel card parks
  it; **activating** it STARTS the channel. Activating an `exhaust` card removes it from play (not
  discard). Ability-stacking on a burst turn is an accepted **balance watch-item** (MP-at-fire caps
  it), not a blocker.
- **Retain is removed** and replaced by the panel as the single hand-holding mechanism. **Gate the
  irreversible Retain teardown on the proposal-A-vs-B decision** — for a pure prototype the teardown
  can be branch-local; for the real ship it is included (save bump v18→19).
- **Count-reading cards read activations.** Reuse `cardsPlayedThisPhase` to mean *activations* (the
  actual effect-firings), so count-reading cards keep working; the passive-MP suppression gate also
  keys off activations (staging is free and must not suppress passive income). No separate staged-MP
  counter is needed — track only a `swappedThisPhase` flag for the once-per-turn unstage.

## Acceptance criteria

- [ ] **Stage (free).** `turnStep === 'stage'`, panel has a free slot, card X in hand → `stageCard(i)`:
      X moves from `hand` into `panel`, **0 MP spent**, no effect fires, `cardsPlayedThisPhase`
      **unchanged**, the hand does **not** redraw (draw only happens at phase start).
      - panel full → rejected
      - not `stage` step → rejected
- [ ] **Single-swap (once per turn).** `stage` step, `!swappedThisPhase`, `mp >= UNSTAGE_COST` →
      `unstageCard(i)`: pays `UNSTAGE_COST`, X → discard pile, slot frees, `swappedThisPhase = true`.
      A second unstage the same turn → rejected. `mp < UNSTAGE_COST` → rejected.
- [ ] **Commit → Phase 2.** `advanceToAct()` from `stage`: the remaining hand is discarded (whole
      hand — Retain gone, `carryover` stays default-off), `turnStep = 'act'`; no further staging or
      unstaging is allowed.
- [ ] **Panel persists.** Cards left in `panel` survive `_endTurnInternal` with **no** holding cost
      charged; next player phase the hand redraws to `handSize` and the panel is unchanged.
- [ ] **Activate (pay at fire, unlimited).** `act` step, panel slot = X, `mp >= cost(X)`, target valid
      → `activatePanelCard(i, target)`: pays `cost(X)`, applies X's effect via the same `resolveCard`
      path as a hand play, X → discard (unless `exhaust`), **counts as a card played**
      (`cardsPlayedThisPhase++`), and **any number** of panel cards may be activated in one turn while
      MP lasts. `mp < cost(X)` → rejected.
      - **Shared-tail ordering preserved:** the per-type tally increments *after* `_applyCard` (the
        invariant at `src/engine/core.ts:2116–2122`), so a count-reading card sees only prior plays.
- [ ] **Rest (Phase-1 only, full regen, forbids activation).** Offered only in `stage`; grants full
      `restRegen` MP, **skips Phase 2**, ends the turn, leaves the panel loaded; blocked under Pact of
      Silence and while channeling. Prior staging does **not** reduce it. No card can be activated on a
      Rest turn (Phase 2 is skipped).
- [ ] **Passive-MP suppression** keys off `cardsPlayedThisPhase` (activations), **not** staging.
- [ ] **State must NOT persist mid-fight.** `panel` / `turnStep` / `swappedThisPhase` are per-fight
      engine state (like `channelCard`), never serialized in `Run.toJSON`. No new fields in the save
      beyond the Retain removal's version bump.
- [ ] **Retain removed.** `'retain'` gone from `ModifierId`/`MODIFIERS`/`MODIFIER_IDS`/`retainEligible`
      and the `resolveCard` branch; both `_endTurnInternal` retain reads gone; the dormant `carryover`
      config left untouched (already default 0/off) OR removed — but do not leave a half-referenced
      `retain`. `RUN_SAVE_VERSION` bumped **18→19** (save wipe acceptable). *(For a prototype build
      only, this teardown may be branch-local — see Approach.)*
- [ ] **Standing gates:** engine stays pure/DOM-free; `npm test` green; `npm run typecheck` /
      `npm run build` clean. Winrate/sim gates below at N=1000 with 95% CIs.

## Implementation notes (anchors)

- **State** — add to the `Game` class beside `channelCard: CardId | null` (`src/engine/core.ts:289`,
  the "per-fight, never serialized" cluster): `panel: DeckCard[]`, `turnStep: 'stage' | 'act'`, and
  `swappedThisPhase: boolean`. Init `[]` / `'stage'` / `false` in the fight-setup constructor block
  (near `src/engine/core.ts:411–437`, where `drawPile`/`discardPile`/`hand`/`channelCard` are
  initialized). Keep them OUT of `Run.toJSON` (`src/run.ts:223`) — battle state is never persisted
  mid-fight.
- **Constants** — `PANEL_SIZE = 3` and `UNSTAGE_COST = 1` in `src/data/tuning.ts` (near `HAND_SIZE`,
  :465). Add a healer **+1 Panel Slot** upgrade mirroring `+1 Hand Size` (`src/data/run.ts:667–670`,
  `HealerStat` :648, config default :201); copy it to a `panelSize` field like `handSize` is copied.
- **Split `playCard`** (`src/engine/core.ts:2090`): today's three consecutive lines — MP spend (:2097),
  hand→discard-unless-`exhaust` (:2098–2101), `_applyCard` (:2114) — divide cleanly:
  - `stageCard(handIndex)`: guard (`canStage`) → splice the card out of `hand` into `panel`.
    **No `mp` change, no `_applyCard`, no `cardsPlayedThisPhase` change.** Emit an event/log.
  - `unstageCard(panelIndex)`: guard (`canUnstage`) → `mp -= UNSTAGE_COST` → push `panel[i]` to
    `discardPile` → `swappedThisPhase = true`. Emit/log.
  - `advanceToAct()`: run the current end-of-turn discard loop (`src/engine/core.ts:2218–2233`, now
    Retain-free) on the leftover hand; set `turnStep = 'act'`.
  - `activatePanelCard(panelIndex, target)`: guard (`canActivate`, incl. `mp >= cost`) →
    `mp -= effectiveCost(card)` → **shared tail** (the post-`resolveCard` tail of `playCard`):
    splice/discard-unless-`exhaust` from `panel`, channel break/START, `_applyCard`, **then** the
    per-type tally. Extract that tail into a helper both `playCard` and `activatePanelCard` call, and
    **preserve the ordering at `src/engine/core.ts:2116–2122`** (tally after `_applyCard`).
  - Predicates for the UI: `canStage(handIndex)`, `canUnstage(panelIndex)`, `canActivate(panelIndex)`.
- **Turn start** — `_startPlayerPhase` (`src/engine/core.ts:1907–1968`): set `turnStep = 'stage'` and
  reset `swappedThisPhase = false` alongside the existing `cardsPlayedThisPhase = 0` (:1965); the
  passive-MP gate (:1946) reads `cardsPlayedThisPhase` (activations). Draw is unchanged
  (`_drawTo(handSize)` :1959).
- **Rest** — refit `skipTurn()` / `canSkip()` / `restRegenNow()` (`src/engine/core.ts:2151–2201`):
  guard `turnStep === 'stage'` (plus the existing not-Pact / not-channeling guards); grant **full**
  `restRegen`; then run the existing turn-advance. Retire the `SKIP_REGEN_DECAYED` branch for this
  design (no "played-then-rest" case remains). Keep `restAmount()` as the UI preview.
- **Retain teardown** — `src/data/run.ts`: drop `'retain'` from the `ModifierId` union (~:20), the
  `MODIFIERS` map (~:398), `MODIFIER_IDS` (~:404), and delete `retainEligible` (~:369) + the no-op
  guard in `canApplyModifier` (~:413); remove `ResolvedCard.retain` (~:330). `src/data/cards.ts`:
  remove the `retain` local, the `u === 'retain'` branch, and the returned `retain` field in
  `resolveCard` (~:339/:344/:381). `src/engine/core.ts`: remove both `resolveCard(dc).retain` reads in
  `_endTurnInternal` (~:2221 filter, ~:2230 keep-guard) — the discard loop keeps only the `carryover`
  path (default-off). Bump `RUN_SAVE_VERSION` 18→19 (`src/run.ts:125`). *(Prototype may keep this
  branch-local.)*
- **useGame** (`src/useGame.ts`): add `stageCard`, `unstageCard`, `advanceToAct`, `activatePanelCard`
  plus `canStage` / `canUnstage` / `canActivate` derivations to the `GameController` interface (~:38–56)
  and the stable `Object.assign` (~:313–316), following `playCard` (~:272–289) / `skipTurn` (~:291–295)
  / `endTurn` (~:297–301). Staging / unstaging / activation are **live** (non-blocking) dispatches like
  `playCard`; `advanceToAct` / `endTurn` / `rest` are **staged** (input-locking) dispatches.
- **UI** — new `<Panel game={...}>` in `src/components/BattleScreen.tsx` beside `<Hand>` (~:270–278),
  reading `game.panel` the way `Hand.tsx` reads `game.hand`. Each panel card gets an **Activate**
  affordance (extend the existing drag-to-target model, `game.dropTargets`, to drag-from-panel) plus,
  in the `stage` step, an **Unstage** (single-swap) affordance disabled once `swappedThisPhase`.
  `Hand.tsx` cards get a **Stage** affordance (drag-to-panel) in `stage`, hidden in `act`.
  `Actions.tsx` (~:19–31): the primary button becomes phase-aware — in `stage`: **"Discard & go to
  Phase 2"** (or **Rest & End Turn (+N MP)** when `canRest`); in `act`: **End Turn**. Add a
  phase/step indicator. Copy should frame staging as reserving a *situational answer* (shield / taunt /
  Cleanse / heal) for the telegraphed blow. Card identity is keyed by `uid`. `ManaBar.tsx` /
  `Card.tsx` need no change (they already reflect `game.mp` and render any card).

## Tests

- `test/engine.test.ts` (new panel suite): `stageCard` spends 0 MP, moves hand→panel, fires no effect,
  and does not bump `cardsPlayedThisPhase`; rejects on full panel and wrong step. `unstageCard` pays
  `UNSTAGE_COST`, sends the card to discard, frees the slot, and is once-per-turn (second rejected).
  `advanceToAct` discards the leftover hand and blocks further staging; the panel persists across
  `_endTurnInternal` with **no** holding-cost MP charged, and the hand redraws to `handSize`.
  `activatePanelCard` deducts `cost` at fire, applies the effect, → discard (or exhausts), bumps
  `cardsPlayedThisPhase`, is rejected when `mp < cost`, and **multiple** activations succeed in one
  turn while MP lasts. The **shared-tail ordering** test — a count-reading card activated after two
  same-type activations reads count `2` (a regression that moves the tally before `_applyCard` fails
  it). Staging a channel card then activating it STARTS the channel; activating an `exhaust` card
  removes it from play. **Rest**: offered only in `stage`, full regen, un-reduced by prior staging,
  skips Phase 2, leaves the panel loaded; no card can be activated on a Rest turn.
- Retain-removal edits: delete/retarget the existing retain assertions in `test/engine.test.ts` (the
  eligibility, no-op-second-retain, and "retain keeps card in hand" cases) and
  `test/run.test.ts:624` (`cfg.deck[0].upgrades.push('retain')`). Confirm `MODIFIER_IDS` shrinks to
  `lingering`/`efficient`/`potent`.
- `sim/` gates (N=1000, 95% CIs): `starvedTurnRate` stays in the **69–90%** band and the **#90 tier
  band (~opt 59 / avg 34 / poor 4) holds**. The load-bearing claim is that **pay-at-fire leaves the MP
  economy undisturbed**, so these should hold with little or no re-tuning (the swap cost is the only
  new lever). Add panel telemetry to `MpReport` (`sim/run-sim.ts`): mean panel occupancy, stage rate,
  swap rate, activations-per-turn. Add a two-phase staging policy to `sim/policy.ts` (stage answers
  free, hold for telegraphs, fire when affordable, swap sparingly). Pure-logic changes belong in
  engine/unit tests, not browser tests.

## Alternatives considered / fast-follow

- **P1 "Pay-on-Stage" (runner-up, shelved fast-follow).** Pay MP at placement, free activation — the
  "reserve as pre-paid burst battery." Most novel and best on UX / implementation-cost / differentiation
  from 91a, but tournament-**last on balance and problem-fit**: firing a free pre-loaded burst on the
  telegraphed spike turn was judged a **structural, un-tunable** negation of spike lethality, and its
  non-refundable up-front cost mildly *worsens* the 4-heal attractor (players hedge toward always-useful
  premium heals). **Kept on the shelf** — revisit only if the 91b playtest shows players want holding to
  *feel* like saving rather than storing. Note: capping P1's free activation to fix the spike-burst just
  reintroduces pay-at-fire — i.e. collapses P1 into this issue — so 91b is the stable attractor of this
  design space.
- **P3 "Rent" (eliminated).** Each idle card recharges its own MP cost every turn, on a globally
  inflated MP economy (MP_MAX ~14–16, regen up). Rejected: it violates the standing "MP off-limits"
  constraint and would redo #90's just-landed HP-only re-anchor, its rent disproportionately taxes the
  *waiting* (situational-answer) playstyle we want to reward, and its can't-pay forced-drop needs a
  player-choice **pending-decision state** the engine's fully-synchronous action model does not have.

## Out of scope

- **Per-turn activation cap, upkeep / rent / any holding cost, and global MP changes** — all
  deliberately excluded (they belong to P1 / P3). **MP-at-fire is the only economy lever**; the
  single-swap cost is the only new knob.
- **Solving the tiny-all-heals-deck optimum.** Deferred to a future pass adding heal-resistant attacks
  (its own issue). Do not add heal-nerfs or deck-composition gates here.
- **Multi-swap / re-filtering the whole panel each turn.** One unstage per turn only.
- **A replacement rare modifier for the freed Retain slot.** None ships (a double-resolve modifier
  would re-incentivize stacking one premium heal). Leave the rare pool at three modifiers.
- **Softening the hard Phase-1/Phase-2 boundary** beyond the single-swap escape — revisit only if
  playtests find the two-step flow tedious.
- **Final go/no-go.** This is proposal B; the head-to-head against proposal A (91a) — and the decision
  to fully tear out Retain vs. keep it — is the maintainer's, in a later session.
