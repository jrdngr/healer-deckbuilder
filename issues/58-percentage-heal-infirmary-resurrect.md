# Issue 58 — Partial heal between fights + Infirmary node + resurrect at recovered HP

- **Status:** ✅ Complete
- **Phase:** economy (between-fight healing, **balance pass**)   **Size:** L — land as several commits
- **Depends on:** #54 (ability-card death behaviour), #56 (node/branch machinery), #57 (card
  rewards — a balance-affecting change that must be in before this pass)   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "Party members should no longer fully heal between fights …
  only heal a percentage of their max HP (start 20%, then a balance pass). Add back the infirmary
  node … heal HP for a price and heal injuries for a much larger price. If a party member is dead at
  the end of the fight, resurrect them with the normal amount of recovered HP."

## Why

Today every fight silently re-seats the party at full HP — HP simply isn't tracked across fights.
That makes damage between fights free and removes a whole layer of attrition/economy decisions.
Make HP **persist** across fights, heal only a **percentage** of max HP between fights (start 20%,
tune by sweep), and re-introduce the **Infirmary** node so the player can pay gold to heal HP (and
much more gold to heal an injury/scar). A member dead at the end of a *won* fight is resurrected —
but only to the recovered-HP amount, not full.

This is the batch's biggest balance lever and its balance pass must see the final system, so it
lands **last** among balance-affecting issues (after #51/#52/#53/#57 and the draft/recruit changes).

## Suggested commit split

1. **Persist current HP across fights** — add a per-roster-member HP field, carry it through
   `toBattleConfig`/end-of-fight, bump `RUN_SAVE_VERSION`.
2. **Percentage heal between fights** — replace the implicit full re-seed with a `HERO_HEAL_PCT`
   (start 0.20) heal of max HP; clamp to max.
3. **Resurrect-at-recovered-HP** — a member dead at the end of a won fight returns at the same
   recovered-HP amount (not full, not the in-fight 50%).
4. **Infirmary node** — new node type: pay gold to heal HP, more gold to heal an injury.
5. **Balance pass** — sweep `HERO_HEAL_PCT` (and Infirmary prices) at N=1000 to land the campaign
   band; record the chosen number.

## Acceptance criteria

- [ ] Current HP persists across fights (roster + save/resume); a member who ended a fight at low HP
      starts the next deploy step still hurt.
- [ ] Between fights, members heal `HERO_HEAL_PCT` of max HP (default 0.20), clamped to max — **no**
      implicit full heal remains in the engine constructor path for the run layer.
- [ ] A member dead at the end of a **won** fight is resurrected to the recovered-HP amount (the same
      % heal), not to full or the in-fight resurrect value.
- [ ] Infirmary node: heal HP for gold, heal an injury for a (much larger) gold price; hidden when
      nobody is hurt/injured; can't overspend (gold-clamped).
- [ ] MP still fully restores each fight (intake only changes HP) — leave the MP re-seed as is.
- [ ] Balance pass done: `HERO_HEAL_PCT` chosen from an N=1000 sweep with the campaign band
      restored; the number and the sweep recorded in `sim/`.
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- **Full-heal source:** `src/engine.ts:253-292` `Game` constructor — `hp: down ? 0 : maxHP` (`:271`)
  re-seeds full HP every fight; `:307` re-seeds MP (leave MP). `src/run.ts:407-449` `toBattleConfig`
  emits `maxHP` only (`:422`), no current-HP field — add one to `RosterMember` and thread it in/out.
- **End-of-fight HP capture + between-fight heal:** add to the `winFight` path (`src/run.ts:471-493`)
  — read surviving members' HP back out of the finished `Game`, apply the % heal, store on the roster.
  Resurrect the dead-at-end to the same recovered value here (distinct from the in-fight resurrect
  card `src/engine.ts:1408-1422`, which stays 50% for battlefield revives).
- **Save version:** `RUN_SAVE_VERSION` `src/run.ts:79` — bump; persist HP in `toJSON`/`fromJSON`
  (`:181`,`:205`) and reconcile in `Run.fromJSON` (`:198-223`). Coordinate with #46 (save/resume).
- **Infirmary node (retired — re-add):** comment `src/constants.ts:1139-1140`; `NodeType`
  `:1134-1137` (add `'infirmary'`), `NON_FIGHT_NODES` `:1141-1143`, `NODE_TYPE_WEIGHTS` `:1148-1151`.
  `NodeContent` variant `src/run.ts:60-69`; content roll `_rollNodeContent` `:627-638`; screen
  dispatch `src/components/NodeScreen.tsx:22-39`; `NODE_META` entry `src/components/nodeMeta.ts:4-13`;
  `nodeAvailable` gating `src/run.ts:584` (hide when nobody hurt — see the existing
  `src/components/BranchScreen.tsx:14` "Infirmary with no one injured" reference). Injury-heal action:
  model on `healInjury(slot)` `src/run.ts:966-974` (currently free via the Field Hospital event —
  add a gold price); HP-heal action new. Leftover CSS already exists: `styles.css:798`,`:806-807`
  (`.type-infirmary`).
- Injury pricing metadata: `INJURY_NAMES` `src/constants.ts:872`, penalty helpers `:939-941`.

## Tests

- `test/run.test.ts`: HP persists across fights and through save/resume; between-fight heal is
  `HERO_HEAL_PCT` of max, clamped; dead-at-end-of-won-fight member returns at the recovered amount;
  Infirmary heals HP/injury for the right gold and is gold-clamped and hidden when healthy.
- `sim/`: the balance sweep harness for `HERO_HEAL_PCT` (commit it, like `sim/injury-exp.ts`).

## Out of scope

- Changing the in-fight Resurrect card's 50% (battlefield revive stays as is).
- MP carryover (out of intake scope).
