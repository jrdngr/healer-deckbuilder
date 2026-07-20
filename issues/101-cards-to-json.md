# Issue 101 — Cards to JSON (`cards.json` + dual dispatch, five batches, delete the `_applyCard` switch)

- **Status:** 📋 Planned
- **Phase:** content-migration (phase 1 of 6)
- **Depends:** **#99** (the characterization suite is the regression gate for this and every
  issue in #100–#106 — every batch below is proven by re-running it unchanged), then **#100**
  (schemas, interpreter, validator, `TUNING`, `sim/trace.ts`).
- **Addresses:** approved migration plan 2026-07-20, phase 1.

## Why

`src/engine/effects.ts:86` is `switch (card.id)` — **33 case labels, 32 arms**
(`lowHeal`/`highHeal` share a body at `:86-87`). It runs from `:86` to `:460`, ~375 lines of
per-card behavior that a content author cannot touch without editing TypeScript. It is the
largest of the six dispatch surfaces and the one the whole project exists to remove: cards
are the content the maintainer actually wants to author.

> **Arm-count correction.** The plan document says "31 arms (32 labels)". Verified against
> the source on 2026-07-20: `effects.ts:86-460` contains **33** `case` labels, exactly one of
> which (`lowHeal`, `:86`) falls through to a shared body. The real figure is **32 arms**.
> An earlier draft's batch list summed to 33 by double-counting the shared pair. The batches
> below sum to **exactly 32**; if your count disagrees, recount before writing code — the sum
> is the acceptance criterion.

## Approach (decisions locked — do not re-ask)

**Dual dispatch. The tests are never rewritten.** Interpreter and switch coexist while
content migrates in batches:

```ts
const actions = CONTENT_ACTIONS[card.id];
if (actions) { runActions(this, actions, { card, target }); return; }
switch (card.id) { /* shrinking */ }
```

This is verified sound for this switch specifically: dispatch is per-id,
`noFallthroughCasesInSwitch` is on (`tsconfig.json`), no arm depends on switch position, and
the one shared label still catches an unmigrated twin — migrate `lowHeal` and `highHeal`
**together, in the same batch**, or the survivor silently takes the other's body.

**`family` and `buyValue` move INTO the card JSON.** `CARD_FAMILY`
(`src/components/Card.tsx:11`) and `CARD_BUY_VALUE` (`sim/policy.ts:641`) are TypeScript
`Record<CardId, …>` maps. Coverage-asserting them would make #106's acceptance criterion
**unpassable**: a card added in JSON alone would fail `npm test` for want of a TS edit,
which is precisely the thing this migration promises you never have to do again. Move both
fields into the card def; `Card.tsx` and `sim/policy.ts` read from there. (This is carried
forward into #106's coverage-check design — see that issue.)

`MEMBER_STRIKE` (`src/animations.ts:156`), `RELIC_VALUE`/`RELIC_PROBES`
(`sim/exercise.ts:234`), `MEMBER_PASSIVE_FLAVOR` and the `characterArt.ts` tables (`:55`,
`:233`) **stay external** — they are presentation and sim-policy concerns, not content.

**Descs become templates** resolved at load by #100's interpolator: `{NAME}` → the def's own
field, else `TUNING[NAME]`, else a validation error. Consumers keep seeing plain strings, so
`Card.tsx`, `channelView.ts` and the #98 keyword tokenizer are unaffected.

## Open decision — `bloodBanner` (settle it here, with #99's characterization test in hand)

`bloodBanner` (`src/engine/effects.ts:307`) pays `BLOOD_BANNER_HP + this._sanguineSurcharge()`
for every living member, but the card has **no `selfDamage` field**. `_bloodCost`
(`core.ts:1394-1396`) returns `0` when `selfDamage == null`, so `{bloodCost: true}` **cannot
express this arm**. Two options:

1. Give `bloodBanner` a real `selfDamage` field. This is a **behavior change** — `selfDamage`
   is read elsewhere (playability gating, desc templating) — and must be trace-checked with
   `sim/trace.ts` and `exerciseAll()` before it is accepted.
2. Add a `{sanguineSurcharge: true}` amount to the DSL and compose
   `{sum: [{tune: "BLOOD_BANNER_HP"}, {sanguineSurcharge: true}]}`. Purely additive, no
   behavior change, one more amount kind.

Option 2 is the conservative default. Decide when writing batch 3, using #99's `bloodBanner`
characterization test as the oracle — it is one of the ten zero-coverage cards, so that test
is the first thing that has ever pinned this arm's behavior.

## Acceptance criteria

- [ ] **Scaffold commit** — `src/content/cards.json` holds all 65 cards' **metadata only**
      (id, name, cost, target, type, rarity, desc template, `heal`/`regen`/`refresh`/
      `selfDamage`/`draw`/… fields, **plus `family` and `buyValue`**) and **zero `actions`
      arrays. `_applyCard`'s switch is untouched.** `src/content/index.ts` re-exports `CARDS`
      etc. with byte-identical shape; the validator goes live for cards.
- [ ] `src/components/Card.tsx` reads `family` from the card def; `CARD_FAMILY` deleted.
- [ ] `sim/policy.ts` reads `buyValue` from the card def; `CARD_BUY_VALUE` deleted.
- [ ] Card-specific validator checks live: every card `ability` exists; `ABILITY_CARD` is a
      **bijection**; every `{tune: K}` resolves; every `{card: F}` names a real declared field
      (or carries an `else`); every desc placeholder resolves; every `emit.kind` and payload
      matches a `GameEvent` variant (`core.ts:212`…); every `{var}` is bound by a prior
      `let`/`letStr`/`bind` **in scope** (a scope walk — this catches the typos that are
      otherwise just `undefined` at runtime); every card is reachable (in `DECK_LIST`, a shop
      pool, or `ABILITY_CARD`).
- [ ] **Five migration batches summing to exactly 32 arms**, each its own commit, each
      leaving `npm test` green and `npm run typecheck` clean:
  - [ ] **Batch 1 — plain heals and wards (7 arms):** `lowHeal`+`highHeal` (one shared body,
        migrate together), `aoeHeal`, `regen`, `bloom`, `lifebloom`, `barrier`, `shield`.
        Proves `heal` with **separate `direct` and `splash` flags** — only `lowHeal`/
        `highHeal` call `_healCardSplash` (`effects.ts:94`).
  - [ ] **Batch 2 — holy, delayed and party-wide (6 arms):** `sunriseVigil`, `consecration`,
        `battleHymn`, `inspiration`, `arcaneLens`, `fontOfMana`. Proves `queueDelayed`
        (`effects.ts:106-113`) and `collect` (`consecration`'s `atFullSlots`,
        `effects.ts:122-131`, which emits **one** `hymn` event carrying the whole list).
  - [ ] **Batch 3 — the Blood archetype (7 arms):** `bloodTithe`, `martyrsGift`,
        `crimsonPact`, `scarletWard`, `transfusion`, `bloodBanner`, `hemorrhage`. Proves
        `bloodPay` and `{bloodCost: true}`; settles the `bloodBanner` decision above;
        `hemorrhage` (`effects.ts:320-325`) is expected to land as a `native`.
  - [ ] **Batch 4 — martial stances and buffs (7 arms):** `phalanx`, `provoke`, `feint`,
        `guard`, `sharpen`, `doubleStrike`, `riposte`. Proves `status`, `addStat` and
        `partyBuff`.
  - [ ] **Batch 5 — the remainder (5 arms):** `dreadWhisper`, `sporeburst`, `empower`,
        `resurrect`, `cleanse`. Proves `telegraph` (`dreadWhisper` edits the standing
        telegraph in place so `attackTargets()` previews it immediately), the
        `consume`-with-`deferEndHook` ordering for `sporeburst`, and the `revive`/`purge` ops.
- [ ] **Delete-the-switch commit** — `effects.ts:86-460` is gone, `_applyCard` is the
      interpreter shell plus the `_resolvePlayedCard` contract around it, and
      `CONTENT_ACTIONS` covers all 32 arms. The dual-dispatch fallback is removed with it.
- [ ] Every batch commit ships an empty `sim/trace.ts` diff **and** an empty `exerciseAll()`
      log diff against its parent commit (per #100's documented procedure, including the
      large-event-count assertion).
- [ ] `npm run sim` wall time recorded at the end of this phase, compared against #100's
      phase-0 baseline.
- [ ] `npm test` green and `npm run typecheck` clean at **every** commit, not just the last.

## Implementation notes (anchors)

- **The switch:** `src/engine/effects.ts:86` → `:460`. `Game.prototype._applyCard` opens at
  `:68` and closes at `:461`; `_fireAbility` starts at `:463` (that's #102).
- **The shared label:** `case 'lowHeal':` at `:86` falls through to `case 'highHeal': {` at
  `:87`. This is the only label in the switch without its own brace.
- **`resolveCard` runs first:** `src/data/cards.ts:337-382` applies Potent/Lingering/
  Efficient to `heal`/`regen`/`refresh` before `_applyCard` sees the card. Every
  `card.heal ?? CONSTANT` read in the switch (e.g. `consecration` at `effects.ts:117,119`)
  **must** become `{card: "heal", else: {tune: "CONSECRATION_HEAL"}}`. Inlining the constant
  silently deletes upgrades — and #99's A4 asserts the upgrade interaction reaches the
  effect body, so it will be caught, loudly.
- **`_resolvePlayedCard` tallies per-type counters AFTER `_applyCard`** (`core.ts:2151`) — a
  count-based card reads only the plays before it. That ordering lives in the caller and must
  not move into the interpreter.
- **`sporeburst` fires `_onRegenEnded` after the poison** (`effects.ts:393`) — express as
  `consume` with `deferEndHook: true` plus an explicit `regenEnded` op.
- **`transfusion` reference shape** (from the plan, for the DSL's expected feel):
  ```json
  { "op": "bloodPay", "from": "$target", "amount": { "bloodCost": true }, "bind": "paid" },
  { "op": "if", "when": { "exists": "$mostWoundedOther" }, "then": [ … ], "else": [ … ] }
  ```
  Note both log branches are explicit `log` ops — the "no other member remains" branch is
  real behavior, and #99 pins its exact text.
- **Import cycles:** the interpreter imports only *types* from the engine.
  `src/data/cards.ts:335` documents a prior TDZ cycle (#84).

## Tests

- **No new behavioral tests are written in this issue.** #99's suite is the oracle: the
  *identical, unmodified* test files must pass against the switch before each batch and
  against the interpreter after it. That is the entire safety argument — if a batch requires
  editing a #99 test, the migration of that arm is wrong, not the test.
- New tests are added only for the *validator* checks this issue introduces (bijection,
  reachability, `{var}` scope walk, desc placeholder resolution), plus a `family`/`buyValue`
  round-trip test proving `Card.tsx` and `sim/policy.ts` read the JSON values.
- Per-commit verification: `npm test`, `npm run typecheck`, empty `sim/trace.ts` diff, empty
  `exerciseAll()` log diff.
- Visual/UI confirmation is maintainer-verified manually per `CLAUDE.md` — do not drive a
  browser.

## Out of scope

- Abilities (`effects.ts:477`, 30 arms) — that is #102.
- Relics, hooks and hero passives — #103. Enemies and the remaining dispatch surfaces — #104.
- Run-layer content — #105. `CardId` becoming `string` — #106; through this issue the ids
  stay a union and `Record<CardId, …>` exhaustiveness still holds.
- Any behavior change, with the single scoped exception of the `bloodBanner` decision above,
  which must be explicitly trace-checked if option 1 is chosen.
- Rebalancing. Tuning values move by reference (`{tune: "K"}`), never by value.
