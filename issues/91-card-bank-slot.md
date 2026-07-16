# Issue 91 — Card Bank Slot ("The Reserve") — proposal A

- **Status:** 📋 Open
- **Phase:** post-demo (healing availability)   **Size:** L
- **Depends on:** —   **Blocks:** —
- **Addresses:** planning session 2026-07-16 — a 5-design tournament on "make healing available
  when needed without the 4-heal attractor" picked the maintainer's bank slot; the maintainer then
  refined it into the harsher, MP-pressure-positive variant below.

> **This is design proposal A.** The maintainer has a second, more dramatic proposal (out of scope,
> a future planning session) and wants to **compare the two — possibly prototyping both — before
> committing to either.** So this issue is buildable as a prototype, but is **not unconditionally
> greenlit for final ship**: do the head-to-head first. Do not delete Retain "for real" (see Approach)
> until the comparison lands, unless prototyping specifically calls for it.

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

A one-card **bank slot** lets the player *reserve* one card across turns instead of discarding it — so
they can pre-commit an answer for a blow they predict, rather than stacking copies to guarantee a draw.
Crucially, this variant makes banking **cost escalating MP**, so it *deepens* the starvation pillar
rather than eroding it.

**Acknowledged limitation (by design):** this does not by itself kill the tiny-all-heals-deck being
optimal. That is deferred to a later pass introducing attacks raw healing can't keep up with (a
separate issue). Do not try to solve it here.

## Approach (maintainer decision, planning 2026-07-16)

Build the mechanic exactly as specified below — the maintainer refined it past the tournament's
hardened version. Key decisions already settled (do not relitigate):

- **Banking is free and NOT an action.** No bank-time MP fee. Banking does not suppress passive MP or
  weaken Rest. (This differs from the tournament's D1 "simple core," which had a 1-MP fee and counted
  banking as an action — that is **rejected**.)
- **The cost is an escalating end-of-turn upkeep**, charged only while a card sits in the slot: **1** MP
  at the end of the turn it was banked, **2** the next turn, **3** the next… no cap. It **resets** when a
  fresh card is banked.
- **Can't pay → auto-discard** the banked card to the discard pile (no effect, logged). No free holding.
- **Two exits:** *play it* (normal MP cost + effect, → discard, allowed even after other plays) or
  *unbank→discard* (free, but your whole turn; only if no card played this turn; → discard, 0 MP, no
  effect — the escape valve).
- **Retain is removed** and replaced by this as the single hand-holding mechanism. But **gate the
  irreversible Retain teardown on the proposal-A-vs-B decision** — for a pure prototype, the teardown
  can be stubbed/branch-local; for the real ship it is included (save bump v18→19).
- **Any card is bankable**, including member-ability cards. Ability-stacking on a burst turn is an
  accepted **balance watch-item**, not a blocker.
- **Escalation stays reset-per-bank** for now; the sustainable ~1-MP/turn "hold next turn's answer"
  cycle is accepted.

## Acceptance criteria

- [ ] **Bank action (free, not an action).** Player phase, slot empty, card X in hand → `bankCard(i)`:
      X leaves the hand into `bankCard`, the hand redraws to 3, **0 MP spent**, `cardsPlayedThisPhase`
      **unchanged**, passive-MP and Rest restraint **not** affected by the bank.
      - slot already full → bank rejected
      - not player phase → rejected
- [ ] **Banked card survives the discard.** With a card banked, `_endTurnInternal` discards the hand as
      normal but the banked card stays in the slot; next player phase the hand still redraws to 3.
- [ ] **Escalating end-of-turn upkeep, reset per bank.** Truth table (starting MP high enough to pay):
      - bank on turn T, hold → end of T charges **1**, end of T+1 charges **2**, end of T+2 charges **3**
      - resolve the slot then bank a **fresh** card → its first end-of-turn charge is **1** again
      - a turn where the slot is resolved *before* end of turn (played or unbanked) charges **0** that turn
- [ ] **Can't pay → auto-discard.** At end-of-turn upkeep, if `mp < charge`: the banked card goes to the
      **discard pile**, slot clears, **no MP charged**, a log line fires. (No MP goes negative.)
- [ ] **Play from bank.** Slot = X, `mp >= cost(X)` → `playBankedCard(target)`: pays `cost(X)`, applies
      X's effect via the same path as a hand play, X → discard (unless `exhaust`), **counts as a card
      played** (`cardsPlayedThisPhase++`), and is **allowed even after** another card was played this
      turn. Modifiers resolve via `resolveCard` exactly as a hand play.
- [ ] **Unbank → discard (free, whole turn).** Slot = X, `cardsPlayedThisPhase === 0` →
      `unbankDiscard()`: X → discard pile, **0 MP** gained/spent, the turn advances (enemy phase runs)
      just like Rest but **without** the +5 MP. Truth table:
      - no card played this turn → enabled
      - a card already played this turn → **disabled** (but `playBankedCard` is still allowed)
      - choosing unbank→discard means no card can be played that turn (turn ends)
- [ ] **Retain removed.** `'retain'` gone from `ModifierId`/`MODIFIERS`/`MODIFIER_IDS`/`retainEligible`
      and the `resolveCard` branch; both `_endTurnInternal` retain reads gone; the dormant `carryover`
      config left untouched (already default 0/off) OR removed — either is fine, but do not leave a
      half-referenced `retain`. `RUN_SAVE_VERSION` bumped **18→19** (save wipe acceptable). *(For a
      prototype build only, this teardown may be branch-local — see Approach.)*
- [ ] **State must NOT persist mid-fight.** `bankCard`/`bankHoldTurns` are per-fight engine state (like
      `channelCard`), never serialized in `Run.toJSON`. No new fields in the save beyond the Retain
      removal's version bump.
- [ ] **Standing gates:** engine stays pure/DOM-free; `npm test` green; `npm run typecheck` /
      `npm run build` clean. Winrate/sim gates below at N=1000 with 95% CIs.

## Implementation notes (anchors)

- **State** — add to the `Game` class beside `channelCard: CardId | null` (`src/engine/core.ts:289`,
  the "per-fight, never serialized" cluster): `bankCard: DeckCard | null` and `bankHoldTurns: number`.
  Init `null`/`0` in the fight-setup constructor block (near `src/engine/core.ts:411–437`, where
  `drawPile`/`discardPile`/`hand`/`channelCard` are initialized). Keep them OUT of `Run.toJSON`
  (`src/run.ts:223`) — battle state is never persisted mid-fight.
- **Constant** (optional) — `BANK_UPKEEP_PER_TURN = 1` in `src/data/tuning.ts` so the charge is
  `bankHoldTurns * BANK_UPKEEP_PER_TURN`; the escalation is just the held-turn count.
- **Bank action** — add `bankCard(handIndex)` near `playCard` (`src/engine/core.ts:2090`): guard player
  phase + empty slot + valid index; splice the card out of `hand` into `bankCard`; set `bankHoldTurns =
  0`; do **not** touch `mp` or `cardsPlayedThisPhase`; emit an event/log. Eligibility is "any card in
  hand" — no type ban (unlike the tournament D1 which excluded ability/engine cards; here it's
  intentionally unrestricted).
- **Shared tail** — extract the post-`resolveCard` tail of `playCard` (mp spend → splice/discard-unless-
  `exhaust` → `cardsPlayedThisPhase++` → channel break/START → `_applyCard` → **then** the per-type tally)
  into a helper both `playCard` and `playBankedCard` call. **Preserve the ordering at
  `src/engine/core.ts:2116–2122`**: the type-played counter increments *after* `_applyCard`, because a
  count-reading card must see only the plays *before* it. `playBankedCard(target)` resolves `bankCard`
  via `resolveCard`, runs the shared tail, then clears the slot + `bankHoldTurns`.
- **Upkeep** — in the end-of-turn path (`_endTurnInternal`, `src/engine/core.ts:2210`), while `bankCard`
  is set: `bankHoldTurns++`; `charge = bankHoldTurns * BANK_UPKEEP_PER_TURN`; if `mp < charge` → discard
  the banked card + clear slot + log "The Reserve slips away."; else `mp -= charge` + emit. Charge once
  per turn-end; a slot resolved during the player phase never reaches this.
- **Unbank→discard** — add `unbankDiscard()` mirroring `rest()`/`skipTurn()` (`src/engine/core.ts:2166`)
  and its gate `canSkip` (`src/engine/core.ts:2151`): guard player phase + slot non-empty +
  `cardsPlayedThisPhase === 0`; push `bankCard` to `discardPile`; clear slot + `bankHoldTurns`; grant **no
  MP**; then run the same turn-advance the Rest path uses (`_endTurnInternal` → enemy phase → next player
  phase). Add a `canUnbankDiscard()` predicate for the UI mirroring the guard.
- **Retain teardown** — `src/data/run.ts`: drop `'retain'` from the `ModifierId` union (~:20), the
  `MODIFIERS` map (~:398), `MODIFIER_IDS` (~:404), and delete `retainEligible` (~:369) + the no-op guard
  in `canApplyModifier` (~:413); remove `ResolvedCard.retain` (~:330). `src/data/cards.ts`: remove the
  `retain` local, the `u === 'retain'` branch, and the returned `retain` field in `resolveCard`
  (~:339/:344/:381). `src/engine/core.ts`: remove both `resolveCard(dc).retain` reads in
  `_endTurnInternal` (~:2221 filter, ~:2230 keep-guard) — the discard loop keeps only the `carryover`
  path (which stays default-off). Bump `RUN_SAVE_VERSION` 18→19 (`src/run.ts:125`).
- **UI** — `src/components/Hand.tsx` / `Actions.tsx`: a "Bank" affordance on a hand card, and a Reserve
  zone (in `BattleScreen.tsx`) showing the banked card, its **next upkeep** (forecast the 1→2→3 ramp), a
  **Play** button, and an **Unbank→discard** button that disables once any card is played this turn.
  Thread `bankCard`/`playBankedCard`/`unbankDiscard` + the derived `canUnbankDiscard` through
  `src/useGame.ts` (beside `playCard`/`skipTurn`/`endTurn`, ~:50). Copy should frame banking as reserving
  a *situational answer* (shield/taunt/Cleanse/heal) for the telegraphed blow. Card identity is keyed by
  `uid`; the existing drag-to-target model (`game.dropTargets`) can extend to drag-to-bank.

## Tests

- `test/engine.test.ts` (new bank suite): banked card survives `_endTurnInternal` and hand redraws to 3;
  bank spends 0 MP and does not bump `cardsPlayedThisPhase`; upkeep ramps 1→2→3 across held turns and
  **resets** after a fresh bank; `mp < charge` at end of turn → auto-discard to pile (assert
  `discardPile` membership + slot cleared + MP not negative); `playBankedCard` pays cost, applies effect,
  → discard, bumps `cardsPlayedThisPhase`, and works **after** another play in the same turn; the
  **shared-tail ordering** test — a count-reading card played after two same-type plays reads count `2`
  on **both** the hand and banked paths (a regression that moves the tally before `_applyCard` fails it);
  `unbankDiscard` is free, whole-turn, blocked when `cardsPlayedThisPhase > 0`, sends the card to discard,
  grants 0 MP, and advances to the next player phase; banking a channel card then playing it STARTS the
  channel; banking an `exhaust` card then playing it exhausts (not discard), but unbank→discard sends it
  to discard.
- Retain-removal edits: delete/retarget the existing retain assertions in `test/engine.test.ts` (the
  eligibility, no-op-second-retain, and "retain keeps card in hand" cases) and
  `test/run.test.ts:624` (`cfg.deck[0].upgrades.push('retain')`). Confirm `MODIFIER_IDS` shrinks to
  `lingering`/`efficient`/`potent`.
- `sim/` gates (N=1000, 95% CIs): `starvedTurnRate` stays in the 69–90% band **and ideally ticks up**
  (banking is pressure-positive); the #90 tier band (~opt 59 / avg 34 / poor 4) holds. Add `bankRate` and
  mean-hold-turns telemetry to `MpReport` (`sim/run-sim.ts`) + a bank tactic in `sim/policy.ts` to confirm
  banking is used but never free. Pure-logic changes belong in engine/unit tests, not browser tests.

## Out of scope

- **The anti-conveyor apparatus from the tournament's hardened D1** (escalating per-answer surcharge,
  hard per-fight answer cap, `mitigation` answer-tag). Explicitly rejected for this version — the
  escalating hold cost + whole-turn unbank + no-cap auto-discard are the only pressure levers. Revisit
  only if the sim shows a degenerate line.
- **Solving the tiny-all-heals-deck optimum.** Deferred to a future pass adding heal-resistant attacks
  (its own issue). Do not add heal-nerfs or deck-composition gates here.
- **Multi-slot banking / banking more than one card.** One slot only.
- **A bank-time fee or counting banking as an action.** Rejected (see Approach) — banking is free and
  invisible to the restraint gates; only *playing* from the bank and *unbank→discard* interact with the
  turn economy.
- **A replacement rare modifier for the freed Retain slot.** None ships (a double-resolve modifier would
  re-incentivize stacking one premium heal). Leave the rare pool at three modifiers.
- **Final go/no-go.** This is proposal A; the head-to-head against proposal B (and the decision to fully
  tear out Retain vs. keep it) is the maintainer's, in a later session.
