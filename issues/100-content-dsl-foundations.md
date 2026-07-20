# Issue 100 — Content DSL foundations (zod, TUNING record, interpolator, validator, interpreter core, trace oracle)

- **Status:** ✅ Complete (2026-07-20 — 6 commits; schemas, interpreter, validator, reporter and trace oracle all built and wired to nothing)
- **Phase:** content-migration (phase 0 of 6)
- **Depends:** **#99** — the characterization suite is the regression gate for this and every
  issue in #100–#106. Nothing here starts until #99 is complete and green. #99's **A2**
  inventory also settles the `native` arm count that #101/#102 are sized against.
- **Addresses:** approved migration plan 2026-07-20 ("Data-driven content migration — all
  game content to JSON"), phase 0.

## Why

The goal is to author new content — cards especially — **without writing code**, and to
validate all content at startup, reporting every problem before refusing to start.

Content is already declarative data; **behavior is not**. `src/data/*.ts` holds clean tables
(65 cards, 21 relics, 17 enemy defs, 10 heroes, 8 events); the effects live in code, spread
across **six** id-keyed dispatch surfaces:

| Surface | Site | Arms |
|---|---|---|
| Card effects | `src/engine/effects.ts:86` `switch (card.id)` | **32** (33 labels; `lowHeal`/`highHeal` share a body at `:86-87`) |
| Abilities | `src/engine/effects.ts:477` `switch (ability)` | 30 |
| Enemy casts | `src/engine/core.ts:1716` `switch (t.cast)` | 5 |
| Channel ticks | `src/engine/core.ts:1182-1200` | 2 (`mendingStream`, `sap`) |
| Delayed start effects | `src/engine/core.ts:1943-1955` | 1, union closed at `core.ts:89` |
| Cast preview text | `src/engine/core.ts:639-656` | 5 (duplicates the cast kinds for the UI) |

Plus **20 `hasRelic` sites** (18 in `core.ts`, 2 in `effects.ts` — `:465` warDrum, `:486`
venomGland) and **11 hardcoded `m.id === '…'` hero passives**.

This issue builds the machinery — schemas, interpreter, validator, reporter, trace oracle —
and wires it to **nothing**. No content moves in this issue. That is deliberate: every
later phase is then a content-only diff whose only risk is the content itself.

## Approach (maintainer decisions 2026-07-20 — do not re-ask)

1. **Full scope** across #100–#106 — cards, abilities, relics, enemy casts, hero passives,
   plus the run layer (events, modifiers, party/healer upgrades).
2. **zod** as a new runtime dependency (verified compatible with `moduleResolution:
   "bundler"` + `strict`, both set in `tsconfig.json`).
3. **Static JSON imports** (`resolveJsonModule`) — identical semantics under Vite and raw
   `tsx`. This is the *only* build-config change the whole migration makes.
4. Validation **collects all errors**, prints details, then refuses to start. Never fail fast.
5. Status effects stay implemented in engine code, referenced from JSON **by tag**.
6. **`src/data/tuning.ts` stays TypeScript.** Its 491 lines carry sim-anchored rationale
   comments that cannot survive JSON, and `test/engine.test.ts` imports ~250 names from it.
   It gains `export const TUNING: Record<string, number>`; JSON refs by key.
7. Tagged unions everywhere (`{"op": "heal", …}`) so zod's `discriminatedUnion` applies —
   plain `z.union` reports every branch's failure and is unusable as a diagnostic.

## The DSL (locked vocabulary — build exactly this)

Three layers, each a JSON object with a discriminating key.

**Amounts** — `7` · `{tune: "K"}` · `{card: "heal", else: …}` · `{stat, of}` · `{auto}` ·
`{var}` · `{enemyStat}` · `{sum|mul|max|min}` · `{floor}` · `{bloodCost: true}`.

> `{card: "heal"}` is load-bearing. `resolveCard` (`src/data/cards.ts:337-382`) applies
> Potent/Lingering/Efficient to `heal`/`regen`/`refresh` **before** `_applyCard` sees the
> card. Inlining a tuning constant where the code reads `card.heal ?? DEFAULT` silently
> deletes card upgrades. Every arm that reads `card.X ?? TUNE` becomes
> `{card: "X", else: {tune: "TUNE"}}`.

**Selectors** — `$target` · `$self` · `$targetOrSelf` · `$allLiving` · `$allLivingOther` ·
`$mostWoundedOther` · `$mostWounded` · `$lowestHp` · `$enemy`, each backed by an existing
helper (`livingMembers` `core.ts:551`, `_mostWoundedOther` `core.ts:1403`, `_lowestHpSlot`
`core.ts:680`, `_abilityMember` `core.ts:2288`). Plus `{sel, where: Cond}`.

> `$mostWounded` must replicate `drainLife`'s reduce **seeded with the caster**
> (`effects.ts:687`): with nobody wounded, the caster is healed. #99's A-suite pins this;
> the selector must reproduce the tie-break bit-exactly.

**Conditions** — `hpFull` · `hpAtOrBelow` · `hpBelowFrac` · `hasStatus` · `enemyHasStatus` ·
`telegraph: "damaging"|"redirectable"|"interruptible"` · `hasRelic` · `berserkerBandHot` ·
`not`/`all`/`any`.

**Ops** — `heal` `damage` `strike` `bloodPay` `drain` `status` `clearStatus` `consume`
`enemyStatus` `consumeEnemyStatus` `partyBuff` `draw` `mp` `primeRefresh` `revive` `purge`
`telegraph` `addStat` `queueDelayed` `let` `letStr` `collect` `forEach` `if` `log` `emit`
`native`.

Four of those exist because the adversarial review found arms the original 22 ops could not
express — **do not drop them as redundant**:

- `strike` — N hits with break-on-kill: `twinShot` (`effects.ts:638`), `whirlwind`
  (`effects.ts:725`), `flurry` (`effects.ts:765`).
- `letStr` — string bindings: `stun` (`effects.ts:584`) captures `telegraphIntent()` *before*
  mutating the telegraph.
- `collect` — list accumulation: `consecration` (`effects.ts:114-131`) gathers `atFullSlots`
  then emits **one** `hymn` event with the whole list.
- Template conditionals `{cond ? a : b}` — `enGarde` (`effects.ts:603`), plus `sacrifice`,
  `duet`, `deadlift`, all print `holder === m ? 'her own' : \`${holder.name}'s\``.

Ops map onto existing engine primitives: `_applyHeal`, `_healMember`, `_damageEnemy`,
`_strikeEnemy`, `_emitEnemyNuke`, `_bloodPay` (clamped), `_drainMember` (lethal), `_drawOne`
(owns reshuffle + Fidget Beads — `draw` **must** route through it), `_applyPoison`,
`_healCardSplash`.

> `heal` needs `direct` and `splash` as **separate** flags. Only `lowHeal`/`highHeal` call
> `_healCardSplash` (`effects.ts:94`); `transfusion` does not. One combined flag loses that.

`StatusTag` is a closed enum reusing `KeywordId` (`src/data/keywords.ts`) plus engine-only
tags, each mapping to a writer in a `STATUS_WRITERS` table. **That table is the code/data
contract for decision 5** — a status tag with no writer is a validator error.

## The `native` escape hatch — sized at **10–14 arms, not 5**

`{ "op": "native", "fn": "hexApply" }` against a `NATIVES` registry in
`src/engine/natives.ts`. Confirmed natives so far: `hex` (array-table lookup by party size),
`penance` (branching log over post-`drain` liveness), `bolt` (logs *before* zeroing Charge,
`effects.ts:520-522`), `taunt` (`effects.ts:503-511` — conditions on `tauntRetargetMode`
*and* MP, then spends MP and retargets), `hemorrhage` (`effects.ts:320-325`, composite
`_emitEnemyNuke`).

**The first draft's estimate of 5 was wrong by 2–3×.** Build the registry to comfortably hold
10–14 without that being a design smell. **#99's A2 inventory settles the final count** —
read it before sizing #101/#102's batches. `resurrect`/`cleanse` become `revive`/`purge` ops
whose field lists live in code — natives under a nicer name.

The validator checks every referenced `fn` exists **and** that every `NATIVES` key is
referenced (an unused native is dead code).

## Acceptance criteria

- [x] `zod` added to `dependencies` in `package.json` (runtime dep, not dev — it runs at
      startup), and `"resolveJsonModule": true` added to `tsconfig.json`. `npm run build`
      and `npm test` both still work; no other compiler option changes.
- [x] `src/data/tuning.ts` exports `TUNING: Record<string, number>` alongside its existing
      ~250 named exports, with a test asserting **every** numeric named export appears in
      `TUNING` under its own name and with an identical value (an agreement test — the record
      must not be allowed to drift from the consts).
- [x] A template interpolator resolving `{NAME}` → the def's own field, else `TUNING[NAME]`,
      else a validation error. Supports the `|s` (plural) and `|pct` (percent) filters and
      the `{cond ? a : b}` conditional form. Pure, DOM-free, unit-tested directly.
- [x] zod schemas for the amount / selector / condition / op unions, recursive via `z.lazy`,
      **`.strict()` everywhere** — an unknown key is almost always a typo and silently
      ignoring it is how content bugs ship.
- [x] A validator skeleton that runs every check, **collects all errors**, and only then
      refuses to start. Structure it so #101–#105 each add their referential/coverage checks
      without touching the driver.
- [x] A multi-error reporter grouping by category and naming file → JSON path → what was
      wrong, in this shape:
      ```
      Content validation failed — 3 errors:

        [schema] cards.json → transfusion.actions[1].then[0]
          op "heal": unrecognized key "ammount" (did you mean "amount"?)

        [ref] cards.json → sporeburst.actions[1].turns
          unknown tuning key "SPOREBUST_POISON"
          nearest: SPOREBURST_POISON

        [coverage] CARD_TYPE
          missing entries for 2 card(s): sporeburst, dreadWhisper

      Refusing to start.
      ```
- [x] **Levenshtein nearest-key suggestions** (~20 lines) wired into the reporter for unknown
      tuning keys, op names, field names, selectors and content ids. This is what makes a
      stringly-typed system usable daily — it is not optional polish.
- [x] The startup failure path is:
      ```ts
      const failStartup = () => {
        if (typeof process !== 'undefined' && process.exit) process.exit(1);
        throw new Error('Content validation failed — see console for details.');
      };
      ```
- [x] `src/content/` scaffolded with `index.ts`, `schema/`, `interpreter/`. Validation runs as
      a **module-init side effect of `src/content/index.ts`**, which `src/constants.ts`
      re-exports — that covers `main.tsx` and every content-touching test and sim entry with
      no per-entry wiring. It does **not** cover `test/tooltip.test.ts` or
      `test/goldFx.test.ts`, which import no constants — harmless, but do not claim it does.
- [x] Interpreter core (`runActions(game, actions, ctx)`) implementing the full op vocabulary
      above, **wired to nothing** — no dispatch site calls it yet. Unit-tested against
      hand-built action lists.
- [x] The interpreter imports **only types** from the engine, never values.
      `src/data/cards.ts:335` documents a prior TDZ import-cycle bite (#84); re-introducing
      one here is the single easiest way to break startup.
- [x] `sim/trace.ts` exists and produces a stable ordered dump (see below).
- [x] `npm test` green, `npm run typecheck` clean. `npm run sim` wall time recorded in the
      commit message as the phase-0 perf baseline.

## `sim/trace.ts` — the second net (mechanics corrected; do not follow the first draft)

A cheap regression differ for drift nobody thought to assert. It is **demoted from
load-bearing** (#99's suite is the primary oracle) but still worth building.

**The first draft misdescribed how the engine works. The corrected facts:**

- **`game.events` is reset at the top of every public action** — it is documented as
  "animation feed for the most recent action" at `core.ts:344`, and cleared by the
  `this.events = []` at `core.ts:466`, `:951`, `:2118`, `:2173`, … It is **not** a fight
  record. Reading `game.events` after a fight yields only the last action's events.
- Only `game.log` persists (`core.ts:466` resets it once, at fight setup).
- **`runSingleRun` (`sim/run-sim.ts:54`) constructs each fight's `Game` internally and
  discards it**, so `trace.ts` cannot simply call it and read anything back.

**Therefore the spec is:** tee `Game.prototype._emit` into a module-global sink, **plus** a
duplicated ~40-line copy of `runSingleRun`'s loop so the trace can straddle fight boundaries.
Dump every log line and event in order, each prefixed by seed / fight / turn.

- [x] `trace.ts` **asserts its captured event count is large** (a floor, e.g. thousands for
      200 seeds) before emitting output. Without that, a capture bug reads as an empty diff,
      i.e. as a pass — the exact failure mode this tool exists to prevent.
- [x] Documented usage, to be run on each migration commit in #101–#106:
      ```
      tsx sim/trace.ts 200 > /tmp/before.txt   # on the parent commit
      tsx sim/trace.ts 200 > /tmp/after.txt
      diff /tmp/before.txt /tmp/after.txt      # must be empty
      ```
- [x] `exerciseAll()` (`sim/exercise.ts`) extended to dump its log trace too, and diffed the
      same way — `trace.ts` only covers what `sim/policy.ts` plays (~6 of 23 shop cards).

## Implementation notes (anchors)

- **`src/constants.ts` keeps its exact shape.** That is why ~58 import sites don't break;
  only what it re-exports changes. `src/content/index.ts` must export the same names with the
  same shapes (`CARDS`, `CARD_TYPE`, `DECK_LIST`, `ABILITY_CARD`, `LEARNED_CARDS_BY_MEMBER`,
  `MEMBER_POOL`, `RELICS`, `RELIC_IDS` (`src/data/relics.ts:179`), `KEYWORDS`,
  `ENCOUNTER_TABLE`, every per-enemy const…). Grep each before deleting the old module.
- Type aliases stay as names (`export type CardId = string`, landed in #106) so existing
  signatures compile unchanged.
- Target layout:
  ```
  src/content/
    cards.json  abilities.json  relics.json  members.json
    enemies.json  casts.json  keywords.json  statusTags.json
    events.json  upgrades.json  modifiers.json
    index.ts       schema/       interpreter/
  ```
- **Ordering subtleties the interpreter shell must preserve** (each is asserted by #99):
  `sporeburst` fires `_onRegenEnded` **after** the poison (`effects.ts:393`); `bolt` logs
  before `m.charge = 0` (`effects.ts:520-522`) to print pre-spend Charge;
  `_resolvePlayedCard` tallies type counters **after** `_applyCard` (`core.ts:2151`);
  `_fireAbility`'s War Drum priming and Empower borrow/restore bracket the switch
  (`effects.ts:465-475`, `:791-793`) and stay in the interpreter shell, outside the actions.
- `{bloodCost: true}` resolves via `_bloodCost` (`core.ts:1394-1396`), preserving the
  Sanguine surcharge.

## Tests

- Unit tests for the interpolator (all three filter/conditional forms, and the error path for
  an unresolvable placeholder).
- Unit tests for the interpreter, driven by hand-built action lists, covering every op at
  least once — including `strike` break-on-kill, `letStr`, `collect`, and `forEach`.
- The `TUNING` agreement test described above.
- Validator tests: a deliberately broken fixture produces **all** its errors in one report,
  in the documented format, with the correct Levenshtein suggestion — and the reporter is
  asserted to never fail fast.
- Levenshtein suggestion unit tests (nearest key, and no suggestion when nothing is close).
- `npm test` green, `npm run typecheck` clean.

## Out of scope

- Migrating any content. `cards.json` is #101, and every dispatch site keeps its `switch`
  through this issue.
- Changing any game behavior. This issue is additive: the interpreter is dead code on merge.
- Removing `src/data/tuning.ts` or converting it to JSON (decision 6 — it stays TS).
- Changing `src/constants.ts`'s exported shape.
- Visual/UI confirmation — maintainer-verified manually per `CLAUDE.md`.

## Resolution (2026-07-20)

Six commits, all green. Nothing calls the interpreter yet, so phase 0 is provably
behavior-neutral: #99's 1,655 characterization cases pass unchanged throughout.

| Commit | What |
|---|---|
| zod + resolveJsonModule | verified against the zod **v4** API, not assumed from v3 |
| `TUNING` record | 165 constants, auto-derived, agreement-tested, frozen |
| Template interpolator | 91 cases; all 65 existing descs render byte-identical |
| Schemas + validator + reporter | 78 cases; scope walk, Levenshtein suggestions |
| Interpreter core | 131 cases; 29 ops against a live Game |
| Scaffold + driver + trace oracle | module-init validation, `sim/trace.ts` |

### Deviations from the acceptance criteria, and why

1. **`TUNING` lives in `src/data/tuning-table.ts`, not `tuning.ts`.** Building it inside
   `tuning.ts` needs a self-import to enumerate its own exports, which only works while
   the record is the file's last statement — a `const` added after it sits in the TDZ and
   throws at import. Given `cards.ts:335` documents a prior TDZ bite (#84) in this exact
   layer, a leaf module with no cycle was the safer call. Re-exported from the barrel, so
   `{"tune": "KEY"}` resolution and every import site are unaffected.
2. **Amounts and conditions stay key-discriminated**, not tagged. Tagging them would give
   better zod errors but doubles every action list for no authoring benefit
   (`{"op":"tune","key":"POISON_BASE"}`). The readable diagnostic comes from the
   validator's own walk instead; zod remains the shape backstop.
3. **`clampMin`'s second field is `atLeast`, not `min`** — the original name collided with
   the variadic `{min: […]}` form, which the interpreter resolved wrongly and
   `describeAmountBranch` reported as unrecognizable.

### Engine changes (behavior-neutral, proven by #99)

`_reviveMember` and `_purgeParty` were extracted from the Resurrect and Cleanse arms so
those arms and the interpreter's `revive`/`purge` ops share one definition. A revive that
forgets a field is a buff surviving death; keeping the list in two places guarantees that
drift.

### Perf baseline

`npm run sim -- 200 1` — **0.46s wall / 0.79s user**. The gate for later phases is a >15%
regression after #103's hook bus.
