# Issue 21 — Relics phase A: infrastructure + 10 legible relics (P9a)

- **Status:** ✅ Complete
- **Roadmap phase:** P9 (a) — **committed demo scope**   **Size:** M
- **Depends on:** #14 (bands), #17 (preview==applied precedent)   **Blocks:** #22
- **Addresses:** review §3.3; **Open Q9 (accepted: spoils after 3 & 6, Reliquary in acts 2/3)**

## Why
The game has no passive run-long items. Relics are now the primary vehicle for anti-taunt pressure
and the only track touching the telegraph design space. Phase A is the committed, legible subset:
plumbing + spoils + Reliquary + 10 relics that don't require rule-changing engine hooks.

## Scope / acceptance criteria
- [ ] **Plumbing:** `Run.relics` threaded into `BattleConfig`; **inert when empty** (regression
      gate). Topbar icon row + tooltips.
- [ ] **Acquisition (Open Q9):** spoils screens after **fights 3 and 6** (act-1 & act-2 bosses).
      Fight-3 roll guarantees ≥1 rare offer; fight-6 roll weights act-3-boss counters ×2 and
      **recomputes the 9-fight exclusion list** (e.g. Haggler's Charm is **not** boss-dead now —
      act-3 shops exist). **Reliquary** node replaces one rolled node in one mid-act fork of act 2
      **and** act 3 (exactly twice/run; never in `NODE_TYPE_WEIGHTS`); stock = 3 relics (60/30/10) +
      1 cursed at 25g + removal at 20g (max 2/visit).
- [ ] **Ship these 10 relics** (prices: C 50g / U 75g / R 100g):
  - **Lantern of Foresight** (C) — hidden attacks reveal their **target** (composes with #05's
    magnitude reveal).
  - **Haggler's Charm** (C) — all shop prices −15g (floor 5).
  - **Tithe Candle** (U) — +1 MP each time a member takes damage **from an enemy attack**
    (post-mitigation; 0-damage gives nothing; nothing at MP cap).
  - **Field Triage Kit** (U) — heals on a member below 50% max HP heal **+2**.
  - **War Drum** (U) — after a member's Ability cast, their next auto deals **double** (consumed).
  - **Grounding Rod** (C) — aoe/sweep **−1 per hit**, applied to the **final** per-hit number,
    floor 0, **preview-visible** (this relic forces the preview==applied property test into
    existence day one).
  - **Prayer Beads** (C) — +3 MP on each draw-pile reshuffle.
  - **Echo Locket** (U) — once per fight, the first **Poison or Bolt** Ability returns to hand
    (MP still paid on replay).
  - **Stormglass Mirror** (U) — once per fight, the first 6+ single-target hit is negated (after
    Defense, before Shield; preview-visible).
  - **Vanguard's Banner** (R) — members at **full HP** deal +2 on their auto.
- [ ] **Gate:** re-run the #14 full-run band (25–35%) with a **relic-aware shop policy**; relic code
      inert with no relics.

## Implementation notes
- `src/run.ts` (relics on Run, spoils, Reliquary node, exclusion list), `src/engine.ts`
  (per-relic hooks — most are constant tweaks or a single trigger), `src/components/Topbar.tsx`
  (icon row), a new spoils screen component.
- Grounding Rod / Stormglass Mirror must flow through `attackTargets()` so the telegraph preview
  matches applied damage (invariant from #17).

## Tests (required per CLAUDE.md)
- Each relic's effect; **preview==applied** property test (driven by Grounding Rod); spoils fire
  after fights 3 & 6; Reliquary appears exactly twice; relic-inert regression.

## Out of scope / follow-ups
- Rule-changers + curses are #22 (the demo's designated cut line).
