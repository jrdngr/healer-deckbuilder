# Issue 102 — Abilities to JSON (`abilities.json` + dual dispatch, four batches, delete the `_fireAbility` switch)

- **Status:** 📋 Planned
- **Phase:** content-migration (phase 2 of 6)
- **Depends:** **#99** (the characterization suite is the regression gate for this and every
  issue in #100–#106 — in particular **A5**, which rewires all 30 ability tests through
  `playCard`), then **#100** (machinery) and **#101** (`cards.json`, dual-dispatch pattern
  proven, validator live).
- **Addresses:** approved migration plan 2026-07-20, phase 2.

## Why

`src/engine/effects.ts:477` is `switch (ability)` — **30 arms**, running from `:477` to the
close of `Game.prototype._fireAbility` at `:794`. It is the second-largest dispatch surface
and the one most entangled with hero identity: since #40, abilities are per-member cards, so
a hero can fire several. The switch already reflects that — it dispatches on *the ability
being fired*, not on `m.ability` (`effects.ts:474-476`).

Abilities are also where the DSL's harder constructs earn their keep: `strike` (break-on-kill
loops), `letStr` (capturing a string before mutating state), and the template conditional
(`holder === m ? 'her own' : …`) all exist because ability arms needed them.

## Approach (decisions locked — do not re-ask)

**Same dual dispatch as #101**, per-ability:

```ts
const actions = CONTENT_ABILITY_ACTIONS[ability];
if (actions) { runActions(this, actions, { member: m, target, ability }); }
else switch (ability) { /* shrinking */ }
```

Unlike `_applyCard`, `_fireAbility` has a **prologue and epilogue that must stay in the
interpreter shell, outside the actions**:

- **Prologue** (`effects.ts:465-475`): War Drum priming
  (`if (this.hasRelic('warDrum')) m.drumPrimed = true;`) and the Empower borrow — `m.empowerBonus`
  is temporarily folded into `m.abilityPower`, with a log line, because **every arm reads
  `m.abilityPower` synchronously inside the switch**.
- **Epilogue** (`effects.ts:791-793`): `if (empower > 0) m.abilityPower -= empower;` restores
  the base value so the bonus is consumed exactly once.

Do **not** try to express these as ops. They bracket the dispatch, they are relic/upgrade
plumbing rather than content, and #99's A5 pins them. The War Drum priming becomes an
`onAbilityCast` event hook in **#103**, not here.

**No ability test is rewritten in this issue.** #99's A5 already moved the 19 learned-ability
tests off direct `_fireAbility` calls (`engine.archetypes.test.ts:1010-1174`) and onto
`playCard` via the `giveAbility` factory. That is exactly what lets the same test file pass
against the switch and then against the interpreter. If a batch requires editing an A5 test,
the migration of that arm is wrong.

## Acceptance criteria

- [ ] **Scaffold commit** — `src/content/abilities.json` holds all 30 abilities' metadata
      (id, name, desc template, power/cost fields) with **zero `actions`**; `_fireAbility`'s
      switch untouched; validator extended to abilities. `ABILITY_CARD` bijection and
      `LEARNED_CARDS_BY_MEMBER` coverage assert against the JSON.
- [ ] **Four migration batches summing to exactly 30 arms**, each its own commit, each
      leaving `npm test` green and `npm run typecheck` clean:
  - [ ] **Batch 1 — signature control (8):** `poison` (`effects.ts:478`), `taunt` (`:491`),
        `bolt` (`:514`), `hex` (`:527`), `crescendo` (`:542`), `rampage` (`:556`),
        `callBoar` (`:567`), `stun` (`:577`). This batch carries **four of the five confirmed
        natives** — `taunt`, `bolt`, `hex`, and `stun`'s `letStr` capture — so it is the batch
        that proves the `native` registry and the `NATIVES`-key-is-referenced check.
  - [ ] **Batch 2 — stances and sustained pressure (7):** `enGarde` (`:595`), `penance`
        (`:609`), `twinShot` (`:637`), `concVenom` (`:644`), `shieldWall` (`:655`),
        `holdLine` (`:665`), `arcaneSurge` (`:674`). Proves `strike` (break-on-kill,
        `twinShot` at `:638-640`) and the template conditional (`enGarde` at `:603`).
  - [ ] **Batch 3 — damage and curses (8):** `drainLife` (`:680`), `doom` (`:692`),
        `sacrifice` (`:699`), `finale` (`:708`), `duet` (`:713`), `bloodbath` (`:719`),
        `whirlwind` (`:725`), `sicEm` (`:733`). Proves the `$mostWounded` selector
        (`drainLife`'s reduce at `:687`) and conditional strike counts (`whirlwind`'s extra
        hit in the hottest rage band, `:727`).
  - [ ] **Batch 4 — support and the remainder (7):** `mendBeast` (`:738`),
        `standingOvation` (`:746`), `bigTop` (`:752`), `lunge` (`:758`), `flurry` (`:765`),
        `strongest` (`:773`), `deadlift` (`:781`).
- [ ] **Delete-the-switch commit** — `effects.ts:477`–`:790` is gone; `_fireAbility` is the
      prologue, `runActions`, and the epilogue; the dual-dispatch fallback removed.
      `Game.prototype._fireAbility` keeps its exact signature
      (`(m, target = null, ability = m.ability)`).
- [ ] The Empower borrow/restore is **provably still exactly-once**: an ability fired with
      `m.empowerBonus > 0` reads the boosted `abilityPower` and leaves `m.abilityPower`
      unchanged afterward (#99 A5 asserts this; it must not need a new test here).
- [ ] `$mostWounded` reproduces `drainLife`'s tie-break bit-exactly — the reduce at
      `effects.ts:687` is **seeded with the caster**, so with nobody wounded the caster is
      healed. Not "the most wounded living member".
- [ ] Every batch commit ships an empty `sim/trace.ts` diff **and** an empty `exerciseAll()`
      log diff against its parent (per #100's procedure, including the large-event-count
      assertion).
- [ ] `npm run sim` wall time recorded at the end of this phase, compared against the phase-0
      and phase-1 baselines.
- [ ] `npm test` green and `npm run typecheck` clean at **every** commit.

## Implementation notes (anchors)

- **The switch:** `src/engine/effects.ts:477` → `:790`. `Game.prototype._fireAbility` opens
  at `:463`, closes at `:794`.
- **Prologue/epilogue:** `effects.ts:465-475` (War Drum prime + Empower borrow),
  `effects.ts:791-793` (Empower restore). Both stay in the shell.
- **Dispatch is on the fired ability, not the signature** — `effects.ts:474-476` documents
  this explicitly ("one hero can now fire several abilities"). Keep it.
- **`bolt` logs before zeroing Charge** (`effects.ts:520-522`) so the line prints pre-spend
  Charge. That ordering is the reason `bolt` is a `native` rather than a `log` + `addStat`
  pair — the arm reads a value it is about to destroy.
- **`stun` captures `telegraphIntent()` before mutating** (`effects.ts:584-586`) — this is the
  `letStr` motivating case.
- **`taunt` is genuinely conditional plumbing** (`effects.ts:503-511`): it branches on
  `this.tauntRetargetMode === 'surcharge'` **and** `_standingTelegraphRedirectable(m.slot)`
  **and** `this.mp >= TAUNT_RETARGET_SURCHARGE`, then spends MP and retargets. It is a
  `native`, not an `if`-chain — don't try to be clever.
- **`poison` duplicates a relic effect inline** — `effects.ts:486` extends `poisonTurns` with
  `venomGland` itself, separate from `_applyPoison`'s `core.ts:1343`. Leave the inline read
  in place for now; **#103 folds it into the `modifyPoisonTurns` hook.** Flagging it here so
  the arm isn't migrated in a way that hides it.
- **Ability floors:** several arms floor at 1 because a Broken member (DR1) can carry negative
  `abilityPower` (`effects.ts:479-481`). Use `{max: [1, …]}`; do not drop the floor.
- The interpreter imports only *types* from the engine — `src/data/cards.ts:335` documents a
  prior TDZ cycle (#84).

## Tests

- **No new behavioral tests.** #99's A5 (all 30 ability arms, driven through `playCard`) is
  the oracle; the unmodified test files must pass before and after each batch.
- New tests only for validator checks this issue adds: every card `ability` field resolves to
  an ability in `abilities.json`; `ABILITY_CARD` is a bijection over the JSON;
  `LEARNED_CARDS_BY_MEMBER` references only known abilities; every `NATIVES` key introduced
  by batch 1 is referenced by at least one arm.
- Per-commit verification: `npm test`, `npm run typecheck`, empty `sim/trace.ts` diff, empty
  `exerciseAll()` log diff.
- Visual/UI confirmation is maintainer-verified manually per `CLAUDE.md`.

## Out of scope

- The War Drum `onAbilityCast` hook and the `effects.ts:486` venomGland duplication — both
  are **#103**. This issue preserves them as-is.
- Relics, hero passives — #103. Enemy casts, channel ticks, delayed effects — #104.
  Run layer — #105. String ids — #106.
- Rebalancing any ability. Tuning moves by reference (`{tune: "K"}`), never by value.
- Changing which hero owns which ability, or the `giveAbility`/`LEARNED_CARDS_BY_MEMBER`
  model.
