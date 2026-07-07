# Issue 18 — Resurrect rework + poison decision + optional Second Wind (P7d)

- **Status:** ✅ Complete
- **Roadmap phase:** P7 (d)   **Size:** M
- **Depends on:** #14 (Devourer's Consume informs poison), #16   **Blocks:** none
- **Addresses:** flaws #13, #14; **Open Q5 (accepted: defer, then decide)**

## Why
Two dead-ish rares and the deferred poison call. Resurrect is near-worthless against telegraphed
bosses (members rarely die). Poison is out-of-band (12.5 dmg/MP) and decisionless — but it's the
player's main race lever, so its nerf was held until the enrage-visibility fix (#04) and the
Devourer's Consume (#14) could be measured.

## Scope / acceptance criteria
- [ ] **Resurrect rework (flaw #14):** **4 MP, revive at 50% HP + grant a Shield.**
- [ ] **Poison decision (flaw #13, Open Q5 — accepted deferral):** with #04 and #14 shipped,
      **re-measure** poison's effect on boss winrate. If still dominant, apply **poison 4×4 (16
      total)** — or make recast forfeit remaining duration — and give Bolt a closing niche
      (bonus vs enemies below 25% HP). If Consume already tames it, leave poison as-is and record why.
- [ ] If poison changes to 4×4, **re-cost Cracked Hourglass** (#22) alongside (its +2 → 24 total,
      not 35).
- [ ] **Optional Second Wind** — heal = missing HP/2, expensive — as a 16th-card body if the pool
      needs one.

## Implementation notes
- Poison constants: `POISON_BASE = 5`, `POISON_TURNS = 5` in `src/constants.ts`; Bolt: `BOLT_BASE`,
  `BOLT_CHARGE_MULT = 3`. Resurrect definition in `src/constants.ts`; revive path in `src/engine.ts`.
- This is a **measurement-gated** decision — run the sim before touching poison.

## Tests (required per CLAUDE.md)
- Resurrect revives at 50% + Shield for 4 MP; whichever poison outcome ships has a matching test;
  if 4×4, the Cracked Hourglass re-cost test moves with it.

## Out of scope / follow-ups
- Cracked Hourglass itself is #22; coordinate the re-cost there.
