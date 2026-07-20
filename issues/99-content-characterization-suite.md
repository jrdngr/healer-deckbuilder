# Issue 99 — Characterization test suite for all game content (the gate for the JSON content migration)

- **Status:** 🔨 In progress (2026-07-20)
- **Phase:** testing (gates the content-as-JSON migration, #100–#106)
- **Depends:** —
- **Addresses:** maintainer directive 2026-07-20 — "I want to make sure we catch any regressions that this causes. Every item being moved into JSON should have tests that assert all of its behaviors. Development of this feature can begin once all of the test cases are written and passing."

## Why

Issues #100–#106 move every piece of game content into JSON and replace six id-keyed
`switch` statements with a data-driven interpreter. That migration's entire safety
argument is **"a correctly-migrated item produces bit-identical state, logs, and
events."** Nothing currently enforces that claim.

A coverage audit of the existing ~8000 lines of tests against all **147 content items**
found:

| Bucket | Count |
|---|---|
| Zero behavioral coverage | **22** |
| Shallow (fires, or 1–2 state asserts; no log, no events, no edges) | **~78** |
| Well-covered (state + events *or* real edge cases) | **~47** |
| At full state + log + events + edges depth | **0** |

**Nothing in the repo asserts log text as a first-class contract**, and the migration
rewrites every log string through a template engine. `test/coverage.test.ts` plays every
card in a live fight, but that is a *no-crash + was-played* guarantee with zero
behavioral assertion. Nine relics exist only as a boolean probe in `sim/exercise.ts`
that reports `never fired: twinCenser` with no expected/got.

So: write the characterization suite **first**, prove it green against today's code, and
only then start moving content. The suite is the oracle the whole migration is measured
against.

## Zero-coverage items (write these first — they have never been verified by anything)

- **Cards (10):** `sunriseVigil`, `consecration`, `arcaneLens`, `crimsonPact`,
  `scarletWard`, `transfusion`, `bloodBanner`, `hemorrhage`, `feint`, `sporeburst` —
  note the entire Blood archetype is behaviorally untested.
- **Abilities (3):** `rampage`, `crescendo` (only a tagging assert at
  `engine.test.ts:2873`), `callBoar` (incidental setup for `sicEm`, never asserted).
- **Engine (2):** `delayedStartEffects` and `sunriseVigil`'s delayed heal — **zero
  references in the entire test directory**, despite a documented ordering contract at
  `effects.ts:106-113`.
- **Run layer (6):** the `apothecary` event; choice kinds `addCardOffer`, `removeCard`,
  `shrineCard`, `shrineParty`, `duplicateCard`.
- **Relics (2):** `warDrum` and `pilgrimsFlask` are log-substring sniffs only.

## Approach (maintainer decisions 2026-07-20 — do not re-ask)

- **Depth = state + exact log text + emitted events + edge cases.** Exact log text, not
  substring: `sim/exercise.ts:234` `RELIC_PROBES` string-matches logs, and the migration's
  template engine will rewrite every one of them. Substring matching is what would let
  that drift through silently.
- **Explicit hand-written assertions**, matching the existing suite's style. No golden
  files — a failure should name what broke, not present a diff to re-bless.
- **Interactions come from the code's real branch points, not the cross product.** The
  interaction set is enumerable by grep: the 20 `hasRelic` sites, the 11 `m.id ===`
  passive sites, and `resolveCard`'s upgrade fields each name exactly which content they
  touch. Test those pairs; 65 cards × 21 relics is not a test plan.

## Two rules that make or break this issue

1. **Public surface only.** Tests drive `playCard`, `skipTurn`, `act`, and read member/
   enemy state, `game.log`, and captured events. **No underscore methods.** This is what
   lets the identical test file pass against the switch today and the interpreter after
   #101 — the entire point. The 19 learned-ability tests at
   `engine.archetypes.test.ts:1010-1174` currently call `_fireAbility` directly, bypassing
   cost, targeting and the log; their replacements go through `playCard` via `giveAbility`.
2. **Characterize, don't fix.** These tests assert what the code *does*, not what it
   should do. 22 items have never been verified, so some current behavior will look wrong.
   **File a follow-up issue, assert the existing behavior, move on.** Fixing a bug here
   silently moves the baseline the whole migration is measured against. Behavior changes
   happen deliberately, later, against a green suite.

## Acceptance criteria

- [x] **A1** — `test/harness.ts` gains `capture(game, fn)` (returns `{events, log}`),
      `expectEvent(name, cap, kind, partial?)`, `expectNoEvent`, `expectEventCount`,
      `expectLog(name, cap, text, kind?)` (exact), `expectLogSeq`. Self-tested in
      `test/harness.test.ts` **both ways** — each helper passes when it should and
      genuinely fails when it should.
- [ ] **A2** — a per-item behavior inventory for all 147 items committed to the repo,
      recording for each arm whether it fits the #100 op vocabulary or needs a `native`,
      with a total native count. (This doubles as the DSL audit — see Notes.)
- [ ] **A3** — the 10 zero-coverage cards, at depth.
- [ ] **A4** — the remaining 22 card arms brought to depth, including upgrade
      (Potent/Lingering/Efficient) interaction reaching the *effect body*, not just
      `resolveCard`.
- [ ] **A5** — all 30 ability arms, rewired through `playCard`.
- [ ] **A6** — 5 enemy cast kinds, `mendingStream`/`sap` channel ticks, and
      `delayedStartEffects` (pin the `effects.ts:106-113` ordering contract: fires at
      start of next player phase, after the Regen tick, before the draw, stacking per cast).
- [ ] **A7** — all 21 relics, each with a not-owned control case; the 9 probe-only relics
      promoted out of `sim/exercise.ts` booleans into real tests with expected/got.
- [ ] **A8** — all 11 hero passives, including the Tank Grudge *banking* site at
      `core.ts:1877` with `HOLD_LINE_BANK_MULT`.
- [ ] **A9** — 12 enemy defs: rotation ordering, phase transitions, telegraph generation.
- [ ] **A10** — 8 events and 12 choice kinds; `gambleGold`'s weighted outcomes
      (`src/run.ts:1380-1388`) seeded across all four payout branches.
- [ ] **A11** — 3 MODIFIERS reaching the effect body; 5 PARTY_UPGRADES + 4
      HEALER_UPGRADES per-id (today a generic "some stat changed" check at
      `run.test.ts:885`).
- [ ] `npm test` green, `npm run typecheck` clean.
- [ ] Follow-up issues filed for every "this looks wrong" found while characterizing.

## Implementation notes (anchors)

- **The six dispatch surfaces** the suite must pin, because #100–#106 replace all of them:
  `effects.ts:86` (`switch (card.id)`, **32 arms** — 33 `case` labels with one
  fall-through, `lowHeal`→`highHeal`), `effects.ts:477` (`switch (ability)`,
  30 arms), `core.ts:1716` (`switch (cast)`, 5), `core.ts:1182-1200` (channel ticks, 2),
  `core.ts:1943-1950` (delayed start effects), `core.ts:639-656` (cast preview text).
- **`game.events` is an animation feed for the most recent action** — every public entry
  point clears it on the way in (`core.ts:344`, and the `this.events = []` at `:951`,
  `:2118`, `:2173`, …). Only `game.log` persists (`:466`). Hence `capture()` snapshots
  events but length-slices the log; capture **one action at a time**.
- **Ordering subtleties to pin explicitly** (documented in comments today, so they will
  regress silently otherwise): `sporeburst` fires `_onRegenEnded` *after* the poison
  (`effects.ts:393`); `bolt` logs *before* zeroing Charge (`:520-522`);
  `_resolvePlayedCard` tallies type counters *after* `_applyCard` (`core.ts:2151`);
  `_fireAbility`'s War Drum priming and Empower borrow/restore bracket the switch
  (`:465-475`, `:791-793`).
- **`drainLife`'s heal target** is a reduce seeded with the *caster* (`effects.ts:687`) —
  with nobody wounded, the caster is healed. Pin this; #101's `$mostWounded` selector must
  reproduce the tie-break bit-exactly.
- **A2 doubles as the #100 DSL audit.** You cannot write an arm's behavior tests without
  reading it closely enough to judge whether it fits the op vocabulary. The native-count
  estimate (plan says 10–14; a first pass said 5 and was wrong by 2–3×) is settled here,
  before anything is built on it.

## Tests

This issue *is* tests. Structure: one file per category under `test/content/`, each
`finish()`-ing with its own label, all added to the `npm test` chain. `test/harness.test.ts`
runs **first** in the chain — if the assertion helpers are broken, every downstream green
is meaningless.

## Out of scope

- Any JSON migration work — that is #100–#106, gated on this.
- **Fixing** any bug this surfaces (see rule 2). File it; don't fix it here.
- Rewriting existing passing tests that already assert state, unless they reach into
  underscore methods (A5's 19 ability tests) or their item needs log/event depth added.
- Visual/UI confirmation — maintainer-verified manually per `CLAUDE.md`.
