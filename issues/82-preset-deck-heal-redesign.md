# Issue 82 — Heal-forward preset decks, unified to size 6

- **Status:** ✅ Complete
- **Phase:** rules (constant, balance-relevant)   **Size:** S
- **Depends on:** —   **Blocks:** none (feeds the between-fight-healing balance pass)
- **Addresses:** intake 2026-07-11 — "Starting decks should have a reasonable number of healing
  cards. Redesign them; choose the cards first, then set a good deck size."

## Why

The three starter presets should each carry a **reasonable healing density**. Preserver is already
6 pure-heal cards and is the **heal baseline** (kept as-is). Reaper and Warden are heal-light; each
is rebuilt to add healing while keeping its identity, and **all three presets land at size 6**
(decision: keep Preserver, all presets same size). The card selections below are **maintainer-locked**
(chosen card-by-card at intake), not sim-derived.

## Decided lists (maintainer, intake 2026-07-11)

- **Preserver** *(unchanged)* — `aoeHeal`, `lowHeal`, `lowHeal`, `lowHeal`, `highHeal`, `highHeal`
  (this is `DECK_LIST`).
- **Reaper** — `shadowBolt`, `siphonLife`, `grimHarvest`, `lowHeal`, `highHeal`, **`transfusion`**
  · **cut:** one `shadowBolt`, `bloodTithe`.
- **Warden** — `shield`, `brace`, `refresh`, `lowHeal`, `highHeal`, **`mendingStream`**
  · **cut:** `phalanx`, `channel`.

## Acceptance criteria

- [ ] `STARTER_DECKS.reaper.list` == `['shadowBolt', 'siphonLife', 'grimHarvest', 'lowHeal',
      'highHeal', 'transfusion']` (exactly; no `bloodTithe`, one `shadowBolt`).
- [ ] `STARTER_DECKS.warden.list` == `['shield', 'brace', 'refresh', 'lowHeal', 'highHeal',
      'mendingStream']` (exactly; no `phalanx`, no `channel`).
- [ ] `STARTER_DECKS.preserver.list` unchanged (== `DECK_LIST`).
- [ ] **All three preset lists have length 6.**
- [ ] The cut cards (`bloodTithe`, `phalanx`, `channel`, the extra `shadowBolt`) remain defined and
      acquirable via rewards/shops — only their starter copies go.
- [ ] Typecheck/build clean; tests pass.

## Implementation notes (anchors)

- `src/constants.ts:1512-1531` `STARTER_DECKS` — rewrite the `reaper.list` and `warden.list` arrays;
  leave `preserver` pointing at `DECK_LIST` (`:1263`). `buildStarterDeck()` (`:1535`) is unchanged.
- Card ids all exist: `transfusion` (`:1102`), `mendingStream` (`:1152`), `siphonLife` (`:1071`),
  `grimHarvest` (`:1031`), `shadowBolt` (`:1069`), `shield`/`brace`/`refresh`/`lowHeal`/`highHeal`.
- Watch any test/fixture that hard-codes the old 7-card Reaper/Warden lists.
- The deck-selection **UI copy** (preset/ability descriptions) is owned by #81; this issue changes
  only the card data, and #81 does not depend on the list contents.

## Tests

- Assert each preset list is exactly the decided six ids (per-card counts, size 6). Reaper contains
  `transfusion` and neither `bloodTithe` nor a second `shadowBolt`; Warden contains `mendingStream`
  and neither `phalanx` nor `channel`; Preserver unchanged.

## Out of scope

- Retuning card costs/effects; the downstream between-fight-healing balance/sim number (a later pass
  owns it — this only fixes the maintainer-chosen composition and size).
- The deck-selection screen text (#81).
