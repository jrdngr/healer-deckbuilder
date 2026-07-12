# Issue 84 — Split `src/constants.ts` into `src/data/*` modules behind a barrel

- **Status:** 📋 Open
- **Phase:** refactor / navigability   **Size:** L
- **Depends on:** —   **Blocks:** —   **Note:** behavior-preserving; no balance change
- **Addresses:** cleanup pass 2026-07-11 — the constants split was **attempted and reverted** because a
  naive contiguous split crashes at runtime with a module-init cycle. This issue captures exactly why
  and how to do it correctly.

## Why

`src/constants.ts` is **2356 lines / 354 top-level exports** and must be loaded wholesale to answer
almost any question — the single worst file for agent-context after the engine (which was split in the
same pass, see `src/engine/`). Goal: split the tunable data + types into focused `src/data/*` modules,
with `constants.ts` reduced to a **re-export barrel** so the ~150 `from './constants'` import sites
(and the pure engine boundary) are **unchanged**. This is purely a navigability refactor — **no number
changes**.

## ⚠️ What went wrong last time (read this first)

A naive split — five contiguous, order-preserving modules (`types` / `enemies` / `cards` / `run` /
`relics`) behind a barrel — **typechecks clean** but **crashes the moment a suite runs**:

```
ReferenceError: Cannot access 'HERO_HEAL_PCT' before initialization
```

Two independent traps caused this:

1. **Typecheck is not sufficient.** `tsc --noEmit` passes even with a fatal init cycle, because the
   cycle is a *runtime* TDZ, not a type error. **You must run `npm test`** (which executes the modules
   via `tsx`) after every step. `npm run build` also masks it (esbuild tree-shakes past the read).

2. **Computing imports from raw text manufactures spurious cycles.** The split script imported every
   exported name that *appeared anywhere* in a segment — **including inside comments**. `constants.ts`
   comments mention symbols liberally (e.g. the members section's comments name `CARDS`, `CARD_TYPE`,
   `EN_GARDE_TURNS`, `REFRESH_MP_CAP` at lines 38/122–124/144; the cards section comments name
   `abilityCardsForParty` at line 1247). Those comment matches created **module-load edges that do not
   exist in the code** (`types → cards`, `cards → run`), which is what closed the cycle. Most of the
   cross-module edges in the failed attempt were **fake**.

### The actual init-time cross-module reads (the real constraints)

After ignoring comments, the genuinely load-bearing top-level (init-time) reads across section
boundaries are few:

- **`CARD_POOL`** (line 1874, in the "run" region) does `Object.keys(CARDS)` — a real init-time read of
  a **cards**-region value. (`CARD_RARITY` at 1817 is a hand-written literal — it does **not** read
  `CARDS`.)
- **`RELICS`** (line 2200, "relics" region) builds `desc` strings at init using **`HERO_HEAL_PCT`**
  (line 1733, "run" region) and `SURGEON_THREAD_HEAL_PCT` (relics-local).
- **`resolveCard`** (line 2310, the file's last export) is a **function** — deferred, so its reads run
  after all modules load. It references `CARDS` and `MODIFIERS` but **no relic symbols** (verified), so
  it does **not** actually depend on the relics region; it's just placed last.

The fatal chain was: barrel imports `types` first → (spurious comment edge) loads `cards` → (spurious
comment edge) loads `run` → `run` imports `resolveCard` from `relics` (real edge, but only used inside
a function) → `relics` top-level `RELICS` table reads `HERO_HEAL_PCT`, which `run` has not initialized
yet → **TDZ**.

## Correct approach — an acyclic layered graph

Design the modules so that **no module reads another module's value at top-level init unless that
module is loaded earlier**. Function-level references across modules are fine (they run after load),
even in a cycle. Concretely:

### 1. A true leaf: `src/data/tuning.ts`
Pure scalar constants + type unions/interfaces, importing **nothing**. This is where every value that
is *read at init by a later module's table* must live. At minimum move **`HERO_HEAL_PCT`** here (the
`RELICS` desc reads it). Put the shared numeric constants and all `export type` / `export interface`
declarations here too — types are erased and never cause runtime cycles, so hoisting them removes a
whole class of forward-reference worry.

### 2. Data-table modules, each importing only from earlier layers *at init*
Suggested layering (adjust as the dependency audit dictates):

- `data/members.ts` — `MEMBER_DEFS`, `MEMBER_POOL`, draft helpers. (reads only `tuning`)
- `data/enemies.ts` — `TYPE_WEIGHTS`, `EnemyDef`s, factories (`aw`/`normalDef`/`bossDef`/`pierceStep`),
  `ENCOUNTER_TABLE`. (reads only `tuning`)
- `data/cards.ts` — `CARD_DEFS`, `CARDS`, `CARD_TYPE`, `resolveCard`. (reads `tuning`, `members`)
- `data/run.ts` — config interfaces, injuries, starter decks, rarity/modifiers, run structure, economy,
  events, `CARD_POOL`. (reads `tuning`, `cards`, `members`, `enemies`)
- `data/relics.ts` — `RELICS` and relic magnitudes. (reads `tuning`, `cards`, `run`)

### 3. Break the two real forward edges by **relocating declarations** (not just moving line ranges)
- **`resolveCard`** has no relic dependency — move it into `data/cards.ts`. Then `run.ts` no longer
  imports a *value* from `relics.ts`; it only needs `type RelicId`, which must be an
  `import type` (erased). This removes the `run → relics` value edge entirely.
- **`abilityCardsForParty`** (line 1535) is only *used* by `defaultBattleConfig` (also a function) and
  is only *named* in the cards region inside a comment. Confirm no code in `cards.ts` calls it at init;
  if the audit shows a real `cards → run` code edge, move `abilityCardsForParty` (and its helpers) into
  a layer at or below `cards`.
- **`CARD_POOL`** reads `CARDS` at init and lives in the `run` layer, which loads *after* `cards` — so
  this is already safe in the layering above. Just don't accidentally pull `run` in *before* `cards`.

### 4. The barrel
`src/constants.ts` becomes only:
```ts
export * from './data/tuning';
export * from './data/members';
export * from './data/enemies';
export * from './data/cards';
export * from './data/run';
export * from './data/relics';
```
Barrel import order should match the layer order (leaf first). Each name is defined in exactly one
module, so `export *` produces no duplicate-export conflicts.

### Computing each module's imports
Do **not** grep raw text. Either (a) curate imports by hand guided by the compiler (add the module, run
`tsc`, add each "Cannot find name X" from the earlier layer, repeat), or (b) if scripting, **strip line
comments, block comments, and string literals before scanning for identifiers**. tsconfig has **no
`noUnusedLocals`** and **no `verbatimModuleSyntax`**, so over-importing values is harmless and plain
`import` works for types — but over-importing still risks re-creating a spurious load edge, so prefer
the compiler-driven curation.

## Acceptance criteria

- [ ] `src/constants.ts` is a re-export barrel only; all data/types live in `src/data/*`. Largest data
      module is comfortably under ~1000 lines.
- [ ] **Zero import churn** elsewhere: no file outside `src/data/` changes its `from './constants'` /
      `from '../constants'` specifiers. All 354 exports remain importable from `./constants`, including
      the mutable sim holders **`INJURY_RULES`** and **`HEAL_TUNING`** (mutated by
      `sim/experiments/{injury,heal}-exp.ts`).
- [ ] `npm test` passes **in full** (all 11 suites) — this is the real cycle gate, not just typecheck.
      `npm run typecheck` and `npm run build` also clean.
- [ ] The **`#07` bit-identical gate holds**: enemy `EnemyDef`s still reference the *same*
      `TYPE_WEIGHTS` objects (don't clone them), so `weightedPick` draw order is unchanged. The
      determinism tests in `test/sim.test.ts` (same-seed → identical run) confirm this.
- [ ] No behavior/number changes anywhere — this is a pure move + re-export.

## Gotchas / constraints

- **Run the suite, not just the typechecker.** A green `tsc` with a red `tsx` is the exact failure this
  issue exists to prevent.
- **Comments and string literals are not dependencies.** Ignore them when deciding imports.
- **Types are free.** `export type`/`export interface` cross-references never cause runtime cycles;
  use `import type` for them and don't let them dictate layer order.
- **Only relocate what you must.** The two genuine edge-breaks are `resolveCard` and (if the audit
  confirms it) `abilityCardsForParty`. Everything else can stay in original relative order within its
  layer, preserving the bit-identical gate.
- **Preset decks / `defaultBattleConfig`** are functions — their cross-layer reads are deferred and
  safe wherever they land.

## Verification

1. `npm run typecheck` — clean.
2. `npm test` — **all suites green** (the load-cycle gate; `test/sim.test.ts` also guards `#07`).
3. `npm run build` — bundle builds.
4. `npm run sim` (spot check) — the harness still runs.
5. Grep confirms no consumer changed its `./constants` specifier.
