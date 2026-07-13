# Issue 86 — Resurrect in the Standard deck and every drafted deck

- **Status:** ✅ Complete (2026-07-13 — Standard grew to 7 with Resurrect; Draft base seeds it, picks 4→3; sim baseline re-pinned, re-anchor left to a later balance pass)
- **Phase:** rules (starter-deck composition)   **Size:** S
- **Depends on:** —   **Blocks:** none (feeds the between-fight-healing balance picture)
- **Addresses:** intake 2026-07-13 — "Resurrect should be in the Standard deck and all drafted
  decks. Reduce number of drafted cards by 1 to compensate. I expect heroes to die fairly often in
  combat."

## Why

Heroes are expected to **die fairly often** in combat, so a revive should be in every player's
opening kit rather than something they might never draft. `resurrect` already exists (Holy, 4 MP,
revives a dead member to 50% max HP — `src/data/cards.ts:63`). This issue seeds it into both starter
paths: the **Standard** deck gains it outright (**grows to 7 cards**), and the **Draft** deck seeds
it as a base card while **dropping one draft pick** so the drafted deck still finishes at 6.

## Decided composition (maintainer, intake 2026-07-13)

- **Standard** — **grow to 7**: current `DECK_LIST` (`aoeHeal`, 3×`lowHeal`, 2×`highHeal`) **plus**
  `resurrect`. Cut nothing. (Decision: grow Standard to 7 rather than trade out a heal.)
- **Draft** — add `resurrect` to the base seed and **reduce picks by 1**: base becomes
  `lowHeal`, `highHeal`, `resurrect` (3) and `STARTER_DRAFT_PICKS` goes `4 → 3`, so the finished
  drafted deck is still **6 cards** (3 base + 3 picks).

Per-fight ability cards (one per deployed member, #44) are still injected on top at lock-in and are
unaffected.

## Acceptance criteria

- [ ] `DECK_LIST` == `['aoeHeal', 'lowHeal', 'lowHeal', 'lowHeal', 'highHeal', 'highHeal',
      'resurrect']` (length **7**, exactly one `resurrect`).
- [ ] `DRAFT_BASE_HEALS` seeds `resurrect` (== `['lowHeal', 'highHeal', 'resurrect']`).
- [ ] `STARTER_DRAFT_PICKS` == **3** (was 4), so `buildDraftBaseDeck()` (3) + picks (3) = a **6-card**
      finished drafted deck.
- [ ] The Draft picker UI still reads correctly: the "Base:" hint lists the three base cards and the
      round header counts `pick N of 3` (both derive from the constants — verify no hard-coded "4").
- [ ] `resurrect` remains its current def (Holy, 4 MP, revive-to-50%); no card retune here.
- [ ] Typecheck/build clean; `npm test` passes; ends in its own `jj` commit.

## Implementation notes (anchors)

- **Standard deck:** `DECK_LIST` at `src/data/cards.ts:230-234` — append `'resurrect'`. Update the
  block comment (currently "fixed 6-card core" / "heal-only six") to say 7 and note the revive.
- **Draft base + picks:** `DRAFT_BASE_HEALS` (`src/data/run.ts:255`) — add `'resurrect'`;
  `STARTER_DRAFT_PICKS` (`src/data/run.ts:256`) — `4 → 3`. `buildDraftBaseDeck()` (`:260`) and
  `buildStandardDeck()` (`:250`) need no code change (they map the constants).
- **UI:** `src/components/StarterDeckScreen.tsx` reads `DRAFT_BASE_HEALS` and `STARTER_DRAFT_PICKS`
  (`:4-5`, `:34-38`, `:58`) — the "Base:" summary and `pick N of M` header flow from the constants,
  so confirm nothing is hard-coded to 4/6.
- **Run wiring:** `src/run.ts` — `buildStandardDeck()` (`:315`), `buildDraftBaseDeck()` +
  `picksLeft: STARTER_DRAFT_PICKS` (`:321-326`) already read the constants; no change expected.
- **Tests to update (they hard-code the old sizes):**
  - `test/engine.test.ts:35` `eq('deck has 6 core cards', DECK_LIST.length, 6)` → **7**, and the
    per-card count assertion at `:38` (now includes one `resurrect`).
  - `test/run.test.ts:1806-1809` — Standard-deck-is-`DECK_LIST` and `DRAFT_BASE_HEALS` assertions
    now reflect the 7-card Standard and the 3-card base seed.

## Tests

- Assert `DECK_LIST` is exactly the 7 ids above (length 7, one `resurrect`).
- Assert `DRAFT_BASE_HEALS` == `['lowHeal', 'highHeal', 'resurrect']` and `STARTER_DRAFT_PICKS` == 3.
- Assert a fully-drafted deck lands at 6 cards (3 base + 3 picks) and a Standard deck at 7.
- Play-level sanity: with a dead member and 4 MP, `resurrect` is present in the opening Standard
  deck and revives to 50% (existing resurrect behavior — just confirm it's now in the seed).

## Out of scope

- Retuning `resurrect` (cost/percentage) — composition only.
- A winrate/sim gate: the composition is **maintainer-locked** (per the #82 precedent). Note that
  growing Standard to 7 and reseeding Draft shifts the sim/quick-play baseline slightly; a later
  balance pass owns re-anchoring the numbers, not this issue.
- Reward/shop pools and Retain rules for `resurrect` (unchanged).
