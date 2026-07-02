# Issue 28 — Party W2: Berserker + Grave Augur

- **Roadmap phase:** post-demo (party wave 2)   **Size:** M
- **Depends on:** #27   **Blocks:** #29
- **Addresses:** review §3.4 (roster wave 2)

## Why
Two members that fight the healer's instincts. The Berserker is strongest at low HP — healing him is
friendly fire. The Grave Augur shrinks telegraphs, the taunt-less draft's redirection substitute.

## Scope / acceptance criteria
- [ ] **Berserker** — 16 HP, 2 base; **+2 while HP ≤ 8 + fight attackBonus**, **+2 more while ≤ 4 +
      attackBonus** (net 2/4/6; bands fight-relative; live thresholds shown on the MemberCard).
      *Rampage* (2 MP): strike for 2× current damage (+abilityPower), then lose 2 HP.
- [ ] **Grave Augur** — 10 HP, 4 dmg. *Grave Chill* (2 MP): the standing telegraph loses **2
      (+abilityPower)** damage per target (floor 0). Reuses the `_retargetTelegraphToTank`
      precedent (`engine.ts:284-288`).
- [ ] Extend the sim policy for band-riding (Berserker) and Chill timing (Augur).

## Implementation notes
- Berserker thresholds read fight `attackBonus`; MemberCard shows live band. Grave Chill modifies the
  standing telegraph spec (must reflect in `attackTargets()` preview).

## Tests (required per CLAUDE.md)
- Berserker damage per band incl. fight-relative thresholds; Rampage doubles then self-damages;
  Grave Chill reduces per-target telegraph damage (floor 0) and previews correctly.

## Out of scope / follow-ups
- Beast Warden's pet subsystem is #29 (most invasive; ships last).
