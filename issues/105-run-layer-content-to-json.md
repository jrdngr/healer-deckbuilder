# Issue 105 — Run-layer content to JSON (outcome ops + `events.json`, `upgrades.json`, `modifiers.json`)

- **Status:** ✅ Complete (2026-07-20 — events/upgrades/modifiers to JSON; the three `eligible` closures are now data predicates)
- **Phase:** content-migration (phase 5 of 6)
- **Depends:** **#99** (the characterization suite is the regression gate for this and every
  issue in #100–#106 — in particular **A10**, the 8 events and 12 choice kinds with
  `gambleGold` seeded across all four payout branches, and **A11**, the 3 modifiers and 9
  upgrades per-id), then **#100**, **#101**, **#102**, **#103**, **#104**.
- **Addresses:** approved migration plan 2026-07-20, phase 5.

## Why

**This whole section was missing from the first draft of the plan.** The adversarial review
found it: the run layer looks like data but a third of it is code.

`EVENTS` (`src/data/run.ts:710-788`) declares 8 events with their choice labels — but the
**outcomes are engine code**, dispatched on `choice.kind` against a closed
`EventChoiceKind` union (`src/data/run.ts:665-677`, 12 members):

- **`gambleGold` hardcodes its odds and payouts** at `src/run.ts:1380-1388`:
  `weightedPick([['big', 50], ['small', 25], ['lose', 25]])` with ±75 / +25 / −25 payouts,
  all inline. A designer cannot retune a gamble without editing `Run`.
- `cursedChest` (`src/run.ts:1461`), `duplicateCard` (`:1484`) and `bloodAltarSacrifice`
  (`:1499`) are `Run` methods.

So adding an event today means: a `data/run.ts` entry, possibly a new `EventChoiceKind` union
member, a `Run` method, and a UI branch. That is four files for what should be one.

`PARTY_UPGRADES` (`src/data/run.ts:628-635`) and `HEALER_UPGRADES` (`:656-661`) are by
contrast **already pure data** — `{ id, stat, amount, rarity, name, desc }` — and are a
mechanical port. The 3 `MODIFIERS` (`src/data/run.ts:380`) are data too, except for three
`eligible` **closures**.

## Approach (decisions locked — do not re-ask)

- **Events need a real outcome vocabulary**, not a native-per-event registry. The weighted-
  payout shape is common enough to be worth actual ops: `{op: "gold", amount}` ·
  `{op: "weighted", outcomes: [{weight, actions}]}` · plus deck/party ops for the
  add/remove/duplicate/shrine kinds. Anything genuinely bespoke falls back to a **declared**
  native-outcome registry, validated the same way `NATIVES` is in #100 (every referenced
  outcome exists; every registered outcome is referenced).
- **`gambleGold`'s 50/25/25 weights and its ±75/25/−25 payouts move into `events.json`.**
  This is the concrete proof the outcome vocabulary works. #99's A10 seeds all four payout
  branches, so any drift in the weights or the rounding is caught.
- **The 3 `MODIFIERS` `eligible` closures become field predicates.** No natives needed:
  - `cardHasStrength` (`src/data/run.ts:347-349`) → `{all: [{not: {hasField: "noPotent"}},
    {any: [{hasField: "heal"}, {hasField: "regen"}, {hasField: "refresh"}]}]}`
  - `cardHasDuration` (`:351-353`) → `{any: [{hasField: "regen"}, {hasField: "refresh"}]}`
  - `efficientEligible` (`:370`) → `{all: [{gt: ["cost", 0]}, {not: {hasField: "draw"}}]}`
    — note this one reads `CARDS[id].cost > 0`, a comparison, not just field presence.
- **`upgrades.json` is a mechanical port.** Do not take the opportunity to restructure it.
- **Leave the difficulty arrays in TypeScript** (`src/data/run.ts:535-554`,
  `ENEMY_HP_BY_FIGHT` and siblings). They are heavily comment-annotated with sim history —
  the same argument that keeps `tuning.ts` in TS (decision 6). Porting them destroys the
  balance record and buys nothing: they are not authored content, they are tuning.

## Acceptance criteria

- [x] **Commit 1 — outcome ops.** The event-outcome vocabulary implemented and unit-tested
      against hand-built outcome lists, wired to nothing. `{op: "weighted"}` draws through the
      existing seeded `weightedPick` (`src/rng.ts`) so runs stay deterministic by seed — it
      must consume the RNG in the **same order and the same number of draws** as the code it
      replaces, or every seeded run diverges.
- [x] **Commit 2 — `events.json`.** All 8 events with their choices and outcomes as data.
      `gambleGold`'s weights (50/25/25) and payouts (+75 / +25 / −25) live in the JSON, not in
      `src/run.ts`. `cursedChest`, `duplicateCard` and `bloodAltarSacrifice` are expressed as
      outcome ops or declared natives; `src/run.ts:1380-1388`, `:1461`, `:1484` and `:1499`
      shrink to thin shells or disappear.
- [x] `EventChoiceKind` stops being the extension point: adding an event with an existing
      outcome shape requires **no** union edit. (The union may survive as a UI hint for which
      picker to show — that is fine and should be stated as such in a comment.)
- [x] **Commit 3 — `upgrades.json` + `modifiers.json`.** `PARTY_UPGRADES` (5) and
      `HEALER_UPGRADES` (4) ported unchanged in shape; the 3 `MODIFIERS` ported with their
      `eligible` closures replaced by the field predicates above.
- [x] Validator, run-layer additions: every event choice outcome resolves; every referenced
      native outcome exists **and** every registered one is referenced; every upgrade `stat`
      names a real member/healer stat; every modifier's `eligible` predicate references real
      card fields (this is where a `{hasField: "regne"}` typo gets caught with a Levenshtein
      suggestion instead of silently making a modifier ineligible for every card).
- [x] **Eligibility parity is proven exhaustively, not sampled:** for each of the 3 modifiers,
      the set of eligible cards computed from the JSON predicate equals the set computed by
      the old closure, over **all 65 cards**. Assert set equality; a spot-check is not enough,
      because an over-broad predicate only shows up on the one card it wrongly admits.
- [x] Each commit ships an empty `sim/trace.ts` diff **and** an empty `exerciseAll()` log diff
      against its parent, per #100's procedure.
- [x] `npm test` green and `npm run typecheck` clean at **every** commit.

## Implementation notes (anchors)

- **Events:** `EVENTS` at `src/data/run.ts:710-788`; `EventChoiceKind` union at `:665-677`
  (12 members: `addCardOffer`, `removeCard`, `gambleGold`, `shrineCard`, `shrineParty`,
  `cursedChest`, `mercenary`, `duplicateCard`, `bloodAltar`, `shrineCurse`, `healInjury`,
  `leave`); `EventChoiceDef`/`EventDef` interfaces at `:679-690`.
- **Outcome code:** `Run.gambleGold` `src/run.ts:1380-1388`, `Run.cursedChest` `:1461`,
  `Run.duplicateCard` `:1484`, `Run.bloodAltarSacrifice` `:1499`.
- **Upgrades:** `PARTY_UPGRADES` `src/data/run.ts:628-635`, `HEALER_UPGRADES` `:656-661`.
- **Modifiers:** `MODIFIERS` `src/data/run.ts:380`; closures `cardHasStrength` `:347`,
  `cardHasDuration` `:351`, `efficientEligible` `:370`.
- **Determinism:** `weightedPick` and the seeded PRNG live in `src/rng.ts`; `CLAUDE.md`
  requires the engine (and by extension the run layer's rolls) stay deterministic by seed.
  The `{op: "weighted"}` implementation is the risk point — count the draws.
- **Modifier application reaches the effect body.** `resolveCard`
  (`src/data/cards.ts:337-382`) applies Potent/Lingering/Efficient to `heal`/`regen`/
  `refresh` before the card resolves; #99's A11 asserts the modifiers reach the body, not just
  `resolveCard`. Migrating eligibility must not disturb application.
- **Save/load:** `nodeContent`/`branchContent` (`src/run.ts:150`) cache **rolled offers
  holding content ids**. Editing or removing an event/upgrade/modifier id between saves under
  the same version can produce dangling ids. Per the repo's bump-don't-migrate stance, the
  `RUN_SAVE_VERSION` bump in **#106** covers this — but if this issue removes or renames any
  id, note it in the commit message so the bump is understood as mandatory rather than
  cosmetic.

## Tests

- **No new behavioral tests.** #99's A10 (8 events, 12 choice kinds, `gambleGold` across all
  four payout branches) and A11 (3 modifiers reaching the effect body; 5 party + 4 healer
  upgrades asserted per-id, replacing today's generic "some stat changed" check at
  `test/run.test.ts:885`) are the oracle; the unmodified files must pass before and after
  each commit.
- New tests only for what this issue introduces:
  - outcome-op unit tests, including `{op: "weighted"}` over a fixed seed producing the
    documented distribution and consuming the expected number of RNG draws;
  - the exhaustive modifier-eligibility set-equality test over all 65 cards;
  - validator tests for unresolvable outcomes, unknown upgrade stats, and unknown card fields
    in an `eligible` predicate, each with the right Levenshtein suggestion.
- Per-commit: `npm test`, `npm run typecheck`, empty `sim/trace.ts` diff, empty
  `exerciseAll()` log diff.
- Visual/UI confirmation is maintainer-verified manually per `CLAUDE.md`.

## Out of scope

- The difficulty arrays (`src/data/run.ts:535-554`) — they stay TypeScript, deliberately.
- `EventId`/`ModifierId`/upgrade ids becoming `string`, the `RUN_SAVE_VERSION` 19→20 bump, and
  the CLAUDE.md authoring guide — **#106**.
- Map/node structure, branch hub layout, and shop pricing logic beyond the `modifyShopPrice`
  hook already moved in #103.
- Any balance change: gamble odds, payouts, upgrade magnitudes and modifier strengths move by
  value into JSON **unchanged**. Retuning them is exactly the thing this migration makes easy
  later — do it later.
- Adding new events, upgrades or modifiers.
