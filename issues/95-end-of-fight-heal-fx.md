# Issue 95 — Animate heroes healing at end of fight, concurrent with the gold burst

- **Status:** ✅ Complete (2026-07-17 — non-mutating `winHealPreview` + a `HealFx` overlay that floats each member's between-fight HP gain concurrently with the gold burst)
- **Phase:** ui (juice)   **Size:** M
- **Depends on:** —   **Blocks:** —
- **Addresses:** intake 2026-07-17 — "Animate heroes healing at the end of a fight at the same time
  gold is being distributed."

## Why

On a win, two things already happen but only one is animated. Gold is awarded and animated as a coin
burst that flies to the topbar counter and to member seats (`onWinFx`, `App.tsx:103-135`, via
`goldFx.ts` / `GoldFx.tsx`). Meanwhile every roster member recovers a fraction of max HP between
fights (`_healBetweenFights`, `run.ts:631-640`, called from `winFight`, `run.ts:666-693`) — but that
HP change just snaps into place with **no animation**. The heroes should visibly heal (bars filling /
heal numbers) at the same beat the coins are distributed, so the post-fight reward reads as one
moment.

## Approach (straw-man, intake 2026-07-17)

Fire a **heal FX on each member card concurrent with the existing gold burst**. Because
`_healBetweenFights` mutates HP inside `winFight`, add a non-mutating **heal preview** (mirroring how
`winBountyPreview`, `run.ts:648-664`, previews gold without mutating) so the UI knows each member's
pre-heal and post-heal HP, then animate the delta on the member cards while `GoldFx` plays. Exact
visual (bar fill, green heal float, glow) is maintainer-owned polish per `CLAUDE.md`; this issue
wires the data + timing and provides a functional heal animation.

## Acceptance criteria

- [ ] **Heal preview exists (non-mutating).** A method mirroring `winBountyPreview` returns each
      healed member's `{ slot, fromHP, toHP }` for the fight-end heal, without mutating run state —
      so the UI can animate from→to before/while the engine banks the heal.
- [ ] **Heal animates on the member cards.** On a win, members that gained HP show a heal animation
      (HP bar filling from `fromHP` to `toHP` and/or a floating heal amount) on their party slot.
      Members at full HP (no delta) show nothing.
- [ ] **Concurrent with gold.** The heal FX and the gold burst (`onWinFx`) play in the **same**
      post-win beat, not sequentially — both kick off together after the enemy-defeated moment.
      The topbar gold counter still holds at the pre-win total until the coins arrive (existing
      `goldOverride` behavior, `App.tsx:131-135`) — do not regress that.
- [ ] **Correct on edge cases.** A revived-from-0 member (heal brings a 0-HP member up to the
      recovered amount, per the `_healBetweenFights` comment, `run.ts:631-640`) animates from 0.
      The **final boss** path skips healing/gold and returns early (`winFight`, boss branch) — no
      heal FX there, matching the skipped gold burst.
- [ ] Reads/derives from run state only; no change to heal **amounts** or `HEAL_TUNING` /
      `SURGEON_THREAD_HEAL_PCT`. `npm test`, `npm run typecheck`, `npm run build` clean; focused `jj`
      commit.

## Implementation notes (anchors)

- **Heal source (engine):** `run.ts:631-640` `_healBetweenFights()` — recovers `HEAL_TUNING.pct`
  (or `SURGEON_THREAD_HEAL_PCT`) of max HP per member, clamped. Called inside `winFight`
  (`run.ts:666-693`) after `_captureFightHP`, before gold. Add a preview alongside it that computes
  the same from→to without mutating (model on `winBountyPreview`, `run.ts:648-664`).
- **Gold FX to run alongside:** `App.tsx:103-135` `onWinFx` returns a duration and fires
  `setGoldFxJob`; geometry via `measureGoldGeometry` (`App.tsx:75-87`) reads member slot centers —
  reuse those same slot centers to anchor heal floats. `GoldFx` overlay rendered `App.tsx:209-213`.
- **Win seam:** `FightScreen.tsx:47-58` `onBattleEnd` → App `onWin` (wired to `run.winFight`) runs in
  parallel with `onWinFx`. Kick the heal FX from the same place `onWinFx` is fired so they share the
  beat.
- **Member HP capture already present:** `onWin(memberHPBySlot())` and `_captureFightHP` give ending
  (pre-heal) HP; the preview gives post-heal HP — the animation interpolates between them.
- **Member card / HP bar:** party slots render in `Party.tsx` (member cards, `styles.css:270-274`);
  the HP bar element within the member card is the fill target. Follow the existing FX-overlay
  pattern rather than animating engine state directly.

## Tests

- `test/engine.test.ts` (run-level): assert the new heal-preview method returns the same post-heal
  HP that `_healBetweenFights` produces (preview == applied), including a from-0 revive case and a
  full-HP member (from == to). No FX assertion (visual, maintainer-verified).

## Resolution (2026-07-17)

Delivered close to the straw-man, with these specifics/divergences:

- **Engine:** added `Run.winHealPreview(hpBySlot?)` (`src/run.ts`, right after
  `winBountyPreview`). It mirrors `_captureFightHP` + `_healBetweenFights` for each
  DEPLOYED battle slot without mutating: `fromHP` is the slot's ending HP clamped to
  max (else the member's persisted HP), `toHP` adds `round(pct·max)` under the same
  Surgeon's Thread / `HEAL_TUNING` rule, clamped. Returns `[]` off a fight and on the
  final boss, so the FX is skipped there — matching the gold burst. Indexed by battle
  slot like `winBountyPreview`.
- **UI:** new `HealFx` overlay (`src/components/HealFx.tsx`), a sibling of `GoldFx` —
  a fixed, click-through layer that floats `+N` green heal numbers on each healed
  party card. Fired from `App.onWinFx` in the **same** call as the gold burst, off a
  single `measureGoldGeometry` read so both reuse the same slot centers; `onWinFx`
  now returns `max(goldHold, healHold)` so the result overlay waits for whichever
  burst runs longer. The `goldOverride` topbar hold is untouched (only set when the
  gold burst plays). To feed the heal its `fromHP`, `onWinFx` now receives the
  fight's ending `hpBySlot` (threaded through `BattleScreen`/`FightScreen` from
  `game.memberHPBySlot()`). Reduced motion still returns 0 (skips both), with a
  belt-and-braces `.heal-fx-layer { display: none }` guard.
- **Tests:** the run-level assertions live in `test/run.test.ts` (the actual
  run-layer harness, which `npm test` runs) rather than `test/engine.test.ts` — the
  latter is the DOM-free engine harness and does not import `Run`. Covers preview ==
  applied for a hurt survivor, a from-0 revive, and a full-HP (no-delta) member, plus
  the off-a-fight and final-boss empty-preview guards.

## Out of scope

- Changing heal amounts, timing of the actual heal, or `_healBetweenFights` logic.
- The Infirmary full-heal node (`run.ts:1363`) — separate flow.
- Reworking the gold burst itself (only running the heal FX alongside it).
- Final-boss victory screen juice.
