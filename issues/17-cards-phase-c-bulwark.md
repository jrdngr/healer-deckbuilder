# Issue 17 — Card set phase C: Bulwark / Defense pipeline (P7c)

- **Roadmap phase:** P7 (c)   **Size:** M
- **Depends on:** #16   **Blocks:** none
- **Addresses:** review §3.2 (Bulwark), §3.1.5, §3.1.6 naming (Q10 — accepted)

## Why
The Bulwark archetype protects the members Taunt **can't** (every card is Defense-exclusive), the
scaling answer to sweep spam. It requires a per-member Defense-strength rework and a well-defined
damage pipeline that the telegraph preview must reflect exactly.

## Scope / acceptance criteria
- [ ] **Per-member Defense strength rework** (Defense currently a flat `DEFENSE_AMOUNT = 1`).
- [ ] **Phalanx** (renamed from "Aegis" per Q10 to avoid the Aegis Font relic collision) — 2 MP,
      single without Defense, uncommon 50g. Defense 2 for 2 enemy turns; no stack; **cannot target
      the taunting tank**.
- [ ] **Brace** — 1 MP, single without Defense, common 25g. Next attack instance −2 (consumed;
      a member holds Shield **or** Brace, newest replaces).
- [ ] **Damage pipeline order: Defense → Brace → Shield**, previewed correctly in
      `attackTargets()` (telegraph == applied, enforced by a property test).

## Implementation notes
- Defense: `DEFENSE_AMOUNT` in `src/constants.ts`; per-member strength in the member/status model
  (post-#08 this is per-member). Pipeline resolution in `src/engine.ts` damage application.
- Preview: `attackTargets()` `engine.ts:272` must compute the same reduced numbers the resolver
  applies.
- Naming: card **Aegis → Phalanx** (Q10 accepted); Martyr's Gift (card, #16) coexists with Martyr's
  Icon (relic, #22).

## Tests (required per CLAUDE.md)
- Phalanx refuses the taunting tank; Brace/Shield exclusivity (newest replaces); **property test:
  previewed per-target damage == applied damage** through the full Defense→Brace→Shield pipeline.

## Out of scope / follow-ups
- Grounding Rod (relic, #21) is the party-wide reduction counterpart and shares the preview==applied
  invariant.
