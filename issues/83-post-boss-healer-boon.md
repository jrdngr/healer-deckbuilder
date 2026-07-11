# Issue 83 — Post-boss healer boon (remove the Sanctum node)

- **Status:** ✅ Complete
- **Phase:** run structure   **Size:** M
- **Depends on:** —   **Blocks:** —   **Note:** bumps the save version
- **Addresses:** intake 2026-07-11 — "Healer upgrades should no longer happen in nodes. After each
  boss the player selects one healer upgrade from a list; options adjusted to ~equal strength."

## Why

Healer upgrades are currently a gold-bought map node (**Sanctum** / `healerUpgrade`). Move them to a
**free post-boss pick**: after each boss the player chooses one of **all four** healer upgrades. The
Sanctum node is **removed entirely** (decision). Picks are **free and repeatable/stackable** across
bosses (the same four are offered each time; you may re-pick to stack), and the four upgrades are
**retuned to roughly equal value** as free picks.

## Acceptance criteria

- [ ] After an act-boss win, a **healer-boon step** offers all four `HEALER_UPGRADES`
      (`mana` / `rest` / `passive` / `hand`); picking one applies it **free**; skipping is allowed.
- [ ] **Repeatable/stackable:** offers are not removed across bosses; re-picking stacks the stat
      (respect existing caps, e.g. `PASSIVE_MP_CAP`).
- [ ] The `healerUpgrade` **node type is removed**: gone from `NON_FIGHT_NODES` and
      `NODE_TYPE_WEIGHTS` (its weight redistributed), the `nodeMeta` Sanctum entry removed, the
      `HealerUpgradeShopScreen` node route removed, and `rollHealerShop` / `buyHealerUpgrade` /
      `SHOP_SIZE.healerUpgrade` removed. `applyHealerUpgrade()` **stays** (the boon uses it).
- [ ] The four `HEALER_UPGRADES` amounts/wording are retuned so they are **roughly equal-value** free
      picks (the note's "approximately equal in strength"); exact numbers land against the sim/balance
      harness in a follow-up — this issue just makes them comparable and free.
- [ ] Run flow: `cardReward → (spoils — acts 1 & 2) → healerBoon → fork`. Save/resume handles the new
      location + node content (bump the save version; discard incompatible old saves per the existing
      versioning policy).
- [ ] Typecheck/build clean; tests pass.

## Open decision (confirm during build)

The **act-3 boss ends the run** in `winFight`, so a boon after it has no use — mirroring spoils
(which fires only after the act-1/act-2 bosses, "fights 3/6"). Recommended: fire the boon after
**bosses 1 & 2 only** (2 effective picks). If a 3rd pick is wanted, it must be granted **before** the
final-boss win. Flagged because the note says "after each boss."

## Implementation notes (anchors)

- **Flow** `src/run.ts`: the boss reward chain is `_leaveCardReward` (`:661`) → `spoils`
  (`:667-668`) → `_leaveSpoils` (`:705`) → `_enterForkChoice` (`:683`). Only bosses reach spoils, so
  insert the boon at the **end of `_leaveSpoils`** (before the fork). Add a location kind
  `{ kind: 'healerBoon'; fightIndex }` (near `:60`) and node content
  `{ type: 'healerBoon'; offers: HealerUpgradeOffer[] }` (near `:75`). Mirror the spoils quartet
  (`rollSpoils` `:976`, `pickSpoils` `:712`, `skipSpoils` `:720`, `_leaveSpoils` `:705`) as
  `rollHealerBoon` (returns all four, price 0), `pickHealerBoon`, `skipHealerBoon`,
  `_leaveHealerBoon → _enterForkChoice`. `applyHealerUpgrade` is `run.ts:1085`.
- **UI**: new `HealerBoonScreen` mirroring `src/components/SpoilsScreen.tsx`; route it in
  `src/components/NodeScreen.tsx:30` and drop the `healerUpgrade` case (`:30-31`).
- **Remove** the node type: `constants.ts` `NodeType` (`:1689`), `NON_FIGHT_NODES` (`:1698`),
  `NODE_TYPE_WEIGHTS` (`:1706`), `SHOP_SIZE.healerUpgrade` (`:1819`); `nodeMeta.ts:10`
  (`healerUpgrade` Sanctum); `run.ts` `rollHealerShop` (`:923`) and `buyHealerUpgrade` (`:1132`).
- **Defs**: `HEALER_UPGRADES` at `constants.ts:1913` (retune amounts here).

## Tests

- After an act-1/act-2 boss the flow reaches a `healerBoon` offering all four upgrades; picking
  applies the stat and **stacks on a repeat** (honoring caps); skipping proceeds to the fork.
- `healerUpgrade` never appears as a map node (absent from `NODE_TYPE_WEIGHTS` / `NON_FIGHT_NODES`);
  no gold-buy path remains.
- Save/resume round-trips the `healerBoon` location + content.

## Out of scope

- Designing brand-new upgrade options (the pool stays the four).
- The final equalized numbers (sim/balance pass owns them).
- A post-final-boss boon unless the open decision above resolves to grant one.
