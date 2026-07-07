# Issue 03 — Dominant-line breakers: Taunt pricing + unified engine-tag rules (P1b)

- **Status:** ✅ Complete
- **Roadmap phase:** P1 (b)   **Size:** M
- **Depends on:** #01   **Blocks:** #06; establishes the tag reused by #15, #16, #22
- **Addresses:** flaws #1, #3; review §3.5; **Open Q3 (accepted)**

## Why
Casting Taunt is never a decision: for 2 MP it grants 4 turns of taunt+defense **and instantly
retargets the standing telegraph** (`engine.ts:612` → `_retargetTelegraphToTank`), so ~3 Ability
copies buy permanent safety at ~0.5 MP/turn and the healer fantasy collapses into tank-babysitting.
Retain-on-Ability then makes that line deterministic. Restoring a cost to the retarget and gating
Retain are the two biggest levers for turning turns back into decisions.

## Scope / acceptance criteria
- [ ] **Taunt retarget pricing (flaw #1, Open Q3 — prototype both, pick by feel):**
      (A) retarget only affects **future** telegraphs (the standing one still lands), OR
      (B) retargeting the **standing** telegraph costs **+1 MP**. Ship both behind a flag for the
      P1 sim/playtest, then keep one.
- [ ] **Engine-card tag (review §3.5):** introduce one shared tag = any card that generates MP or
      draws cards. Wire the eligibility rules:
  - Retain: ineligible for the **Ability** card, all 0-MP cards, and all engine-tagged cards.
    (Documented alternative if Retain feels gutted: retained cards cost +1 MP per re-play.)
  - Efficient: ineligible for 0-MP cards and Inspiration (cost floor already from #02).
- [ ] Re-run the sim; the permanent-taunt line must stop being a strictly-dominant solve.

## Implementation notes
- Retarget call site: `engine.ts:612`; helper `_retargetTelegraphToTank()` `engine.ts:284-288`.
  For option B, add the standing-telegraph surcharge in the taunt resolution path.
- Tag lives in `src/constants.ts` on the card definitions; eligibility checks read it wherever
  Retain/Efficient are applied in `src/engine.ts`.

## Tests (required per CLAUDE.md)
- Taunt no longer redirects a standing telegraph for free (per chosen option).
- Retain refuses the Ability card and every engine-tagged card; Efficient refuses Inspiration.

## Out of scope / follow-ups
- Taper's engine-tag gate is added with #22 (must extend the same tag).
- The Hexweaver (#13) is the systemic, content-side answer to the taunt line.
