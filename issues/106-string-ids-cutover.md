# Issue 106 — String-id cutover (coverage checks + read-site fallbacks, `RUN_SAVE_VERSION` 19→20, CLAUDE.md authoring guide)

- **Status:** 📋 Planned
- **Phase:** content-migration (phase 6 of 6 — the payoff)
- **Depends:** **#99** (the characterization suite is the regression gate for this and every
  issue in #100–#106 — after this cutover the compiler stops catching a whole class of
  mistake, and the suite is what replaces it), then **#100**, **#101**, **#102**, **#103**,
  **#104**, **#105**.
- **Addresses:** approved migration plan 2026-07-20, phase 6.

## Why

Every phase before this one leaves the id types as unions — `CardId`, `AbilityId`, `RelicId`,
`MemberId`, `EnemyId`, `ModifierId` — so `Record<Id, …>` exhaustiveness still holds and a
JSON-only card still fails to typecheck. Which means the promise is not yet delivered:
**today you still cannot add a card without a TypeScript edit.**

Decision 2 of the plan: content ids become plain `string`, and the lost `Record<Id, …>`
exhaustiveness is replaced by **validator coverage checks**. That trade is only safe if the
replacement lands *with* the removal, which is why the ordering rule below is the whole
issue.

**Do not skip this phase.** It is the one that pays for the previous five.

## Approach (decisions locked — do not re-ask)

### The ordering rule

> **Land the coverage checks and the read-site fallbacks in the SAME commit as the type
> change.** Never in a follow-up.

Between the moment `CardId` becomes `string` and the moment the coverage check exists, the
repo has *no* mechanism catching "added a card, forgot the animation" — and the failure mode
is not a compile error, it is `MEMBER_STRIKE[id]` returning `undefined` and **crashing the
animator at runtime, in front of the player.** A `?? fallback` at every external read site is
the safety net; the coverage test is the alarm. Neither is optional and neither waits.

### Two classes of map, two different treatments

**Class 1 — folded into the content JSON (already done in #101).** `CARD_FAMILY`
(`src/components/Card.tsx:11`) and `CARD_BUY_VALUE` (`sim/policy.ts:641`) moved **into the
card def** in #101. This was not tidiness: coverage-asserting those two TypeScript maps would
make the acceptance criterion below **unpassable**, because a JSON-only card would fail
`npm test` for want of a TS edit — the exact thing being abolished. Verify in this issue that
both are genuinely gone and nothing has grown back.

**Class 2 — stays external, covered by registration.** These are presentation and sim-policy
concerns, not content, and the engine must **not** import the animator:

| Map | Site |
|---|---|
| `MEMBER_STRIKE` | `src/animations.ts:156` |
| `RELIC_PROBES` (and `RELIC_VALUE`) | `sim/exercise.ts:234` |
| `MEMBER_PASSIVE_FLAVOR` | `src/data/members.ts` |
| `S2F` / `S2_OPTS` character-art tables | `src/characterArt.ts:55`, `:233` |

Each module calls `registerCoverage(…)` **at its own init**; `test/content-coverage.test.ts`
asserts the registrations cover the content id sets. These checks stay **out of the startup
validator** — pulling `src/animations.ts` into the engine's import graph to validate it would
break the DOM-free rule in `CLAUDE.md` and reintroduce exactly the kind of import cycle
`src/data/cards.ts:335` documents (#84).

### Save version

`RUN_SAVE_VERSION` **19 → 20** at `src/run.ts:129`. Per the repo's standing position, save
compatibility is not required at this phase — **bump, don't migrate.** The bump covers:

- `currentEnemyDef`, embedded **by value** in the save at `src/run.ts:150`, whose shape moved
  in #104;
- `nodeContent`/`branchContent`, which cache rolled offers holding content **ids** — so any
  id removed or renamed across #101–#105 could otherwise leave a dangling reference in an old
  save under the same version. Bump on id removals too.

`src/run.ts:299` (`if (!s || s.version !== RUN_SAVE_VERSION) return null;`) already discards
mismatched saves cleanly, so no migration code is needed.

## Acceptance criteria

- [ ] **Commit 1 — the cutover (all of this in one commit):**
  - [ ] `CardId`, `AbilityId`, `RelicId`, `MemberId`, `EnemyId`, `ModifierId` and the upgrade
        id types become `export type X = string`, kept **as names** so existing signatures
        compile unchanged.
  - [ ] Coverage checks land in the startup validator for every content id set: every id in
        each set is fully covered by the tables that must know about it, and every card is
        reachable (in `DECK_LIST`, a shop pool, or `ABILITY_CARD`).
  - [ ] `registerCoverage(…)` calls added to `src/animations.ts`, `sim/exercise.ts`,
        `src/data/members.ts` and `src/characterArt.ts`, with
        `test/content-coverage.test.ts` asserting them. **Not** wired into the startup
        validator.
  - [ ] **A `?? fallback` at every Class-2 read site** — `MEMBER_STRIKE[id] ?? genericStrike`,
        the character-art lookups, `MEMBER_PASSIVE_FLAVOR`, `RELIC_VALUE`. An unknown id must
        degrade visibly-but-safely, never throw.
- [ ] **Commit 2 — save version.** `RUN_SAVE_VERSION` 19 → 20 (`src/run.ts:129`). No
      migration code; old saves are discarded by the existing check at `src/run.ts:299`.
- [ ] **Commit 3 — the authoring guide.** A new `CLAUDE.md` section documenting how to author
      content in JSON: the file layout under `src/content/`, the amount/selector/condition/op
      vocabulary, how to reference `TUNING` keys, how desc templates resolve (`{NAME}`, `|s`,
      `|pct`, `{cond ? a : b}`), when a `native` is warranted and how to register one, and how
      to read the validator's error report. Also update `CLAUDE.md`'s **Layout** section:
      `src/engine/effects.ts` no longer holds "the big card/ability effect methods", and
      `src/content/` is now where content lives.
- [ ] **The acceptance test — and it must be run for real, not asserted in prose:** add a
      brand-new card to `cards.json`, composed only of existing ops and existing tuning keys,
      with **no TypeScript edit anywhere**, and see it appear in a run with `npm test` green.
      Document the result in the commit message.
      > Honest caveat to record alongside it: this is only true because `family` and
      > `buyValue` moved into the JSON in #101. A card needing a **new magnitude** still needs
      > a one-line `src/data/tuning.ts` edit — or can inline the number. That is the intended,
      > acknowledged boundary of the promise, not a gap to paper over.
- [ ] Each commit ships an empty `sim/trace.ts` diff **and** an empty `exerciseAll()` log diff
      against its parent, per #100's procedure.
- [ ] `npm test` green and `npm run typecheck` clean at **every** commit.
- [ ] Final `npm run sim` wall time recorded against the phase-0/1/2/3 baselines.

## Implementation notes (anchors)

- **Id type declarations** live in `src/data/cards.ts`, `src/data/relics.ts`,
  `src/data/members.ts`, `src/data/enemies.ts` and `src/data/run.ts`; they are re-exported
  through `src/constants.ts`, which **keeps its exact shape** — that is why ~58 import sites
  don't break.
- **`RUN_SAVE_VERSION`:** declared `src/run.ts:129`, written `src/run.ts:237`, checked
  `src/run.ts:299`. `currentEnemyDef` embedded by value at `src/run.ts:150`.
- **Class-2 read sites to fallback:** `src/animations.ts:156` (`MEMBER_STRIKE`),
  `sim/exercise.ts:234` (`RELIC_PROBES`), `src/characterArt.ts:55` (`S2F`), `:233`
  (`S2_OPTS`).
- **Class-1 verification:** grep for `CARD_FAMILY` and `CARD_BUY_VALUE` — both must be gone,
  with `src/components/Card.tsx` and `sim/policy.ts` reading the fields off the card def.
- **Log-text drift risk.** `RELIC_PROBES` (`sim/exercise.ts:234`) string-matches log lines,
  and several `test/engine.test.ts` assertions do too. The #85 naming-pass memory flags
  log-substring probes as brittle. After #99 these are exact assertions, so drift is loud
  rather than silent — but expect this issue to surface any that were missed.
- **What the compiler stops catching.** Be explicit about the trade in the CLAUDE.md guide:
  "added a card, forgot the animation" is no longer a compile error; it is a
  `test/content-coverage.test.ts` failure one `npm test` later, and a visible fallback in the
  meantime. That is the deal, and it should be written down where the next author will read
  it.

## Tests

- `test/content-coverage.test.ts`: every content id set is covered by its registered external
  tables; a deliberately unregistered id fails the test with a useful message (assert the
  failure path too, not just the pass).
- Fallback tests: `MEMBER_STRIKE`, character art, `MEMBER_PASSIVE_FLAVOR` and `RELIC_VALUE`
  each return their fallback for an unknown id **without throwing**.
- Validator tests: the new coverage checks report through #100's multi-error reporter, grouped
  under `[coverage]`, with Levenshtein suggestions.
- A save-version test: a v19 save is rejected and returns `null` (the existing
  `src/run.ts:299` path), and a fresh v20 save round-trips.
- The new-card acceptance test above, exercised end-to-end.
- Visual/UI confirmation is maintainer-verified manually per `CLAUDE.md`.

## Out of scope

- Any further content migration — #101–#105 are complete before this starts.
- Writing save **migrations**. The repo's standing position is bump-don't-migrate; wiping old
  saves is acceptable at this phase.
- Moving `src/data/tuning.ts` to JSON (decision 6 — it stays TS) or the difficulty arrays at
  `src/data/run.ts:535-554` (same argument).
- Moving `MEMBER_STRIKE`, `RELIC_PROBES`, `MEMBER_PASSIVE_FLAVOR` or the `characterArt.ts`
  tables into content JSON — they are presentation/sim-policy, and the engine must never
  import the animator.
- Authoring actual new content beyond the single acceptance-test card.
- Rebalancing anything.
