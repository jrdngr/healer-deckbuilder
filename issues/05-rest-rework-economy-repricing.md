# Issue 05 — Rest rework + economy repricing (P1d)

- **Status:** ✅ Complete
- **Roadmap phase:** P1 (d)   **Size:** M
- **Depends on:** #01   **Blocks:** #06
- **Addresses:** flaws #5, #6, #7, #9, #10, #11, #17, #18; **Open Q4 (accepted: decaying Rest)**

## Why
The commonest turn is a solved EV check: `canSkip()` requires 0 cards played, so every turn is
"play cards" XOR "+5 MP" and MP over the cap-10 is silently wasted. Around that sit a cluster of
dominated/outlier shop and card values. This issue is the single structural MP fix plus the
repricing pass, all sim-checked together.

## Scope / acceptance criteria
- [ ] **Decaying Rest (flaw #5, Open Q4):** Rest gives **+5 MP if 0 cards played**, **+2 if
      exactly 1** card was played. (Carryover alternative rejected — it deletes Rest and breaks
      Pact of Silence, restRegen, and the post-demo Skald.)
- [ ] **Refresh restack cap (flaw #7):** cap Refresh's restored MP at **6 per cast**, OR make
      Refresh Lingering-ineligible (pick one). Add the missing refresh-restack test.
- [ ] **lowHeal fix (flaw #6):** Quick Heal → **1 MP heal 2**; copies **3 → 2**; drop from the shop
      pool or price at 10g.
- [ ] **restRegen reprice (flaw #9):** the `rest` upgrade → **50g** (keep +1 maxMana at 25g).
- [ ] **Shop outliers (flaw #10):** +2 dmg → **85g+**; **passiveMp capped at +2 total per run**;
      +6 HP → **+7 HP**.
- [ ] **Removal price (flaw #17):** unify card removal at **20g** at the Apothecary (and everywhere
      it's offered) — resolves overlapping proposals; sequence after the lowHeal fix.
- [ ] **Casino (flaw #18):** offer "safe **+25g**" vs "the flip". Do **not** add a −1 max HP loss
      branch.
- [ ] **Hidden attacks (flaw #11):** reveal **magnitude**, hide **target** ("someone takes 6");
      optional cap at target HP−1 pre-enrage.

## Implementation notes
- Rest gate: `canSkip()` `engine.ts:632`, apply path ~`:642`; "cards played this phase" counter
  drives the +5/+2 branch.
- Constants in `src/constants.ts`: healer `passiveMp` cap; `restRegen` upgrade id `rest` (line ~355);
  card costs/heal values; shop prices; `SKIP_REGEN`.
- Hidden reveal: telegraph rendering in `src/components/AttackLines.tsx` / `EnemyPanel.tsx` and the
  spec produced by `attackTargets()` (`engine.ts:272`).
- Apothecary/removal UI: `src/components/EventScreen.tsx` / `CardShopScreen.tsx`.

## Tests (required per CLAUDE.md)
- Decaying Rest: +5 at 0 cards, +2 at 1 card, no rest after 2+; MP clamps at cap.
- Refresh cannot exceed the per-cast cap; lowHeal deck count is 2; casino EV branch present.

## Out of scope / follow-ups
- **Re-anchoring the sim baseline** after all P1 work is #06.
- Poison (#13) is explicitly **held** here — handled in #18.
