# Issue 08 — Member-identity refactor (P2b / party W0)

- **Roadmap phase:** P2 (b)   **Size:** M–L (1–2 days + test churn)
- **Depends on:** #06   **Blocks:** #27 (party roster waves)
- **Addresses:** review §3.2 party-M0; **Open Q2 (accepted: do it in-demo)**

## Why
The engine hardcodes the ranger/tank/mage identities by slot. The post-demo party roster needs the
engine to treat members as data (any member can taunt, bolt, poison, etc.). Doing this refactor
**now** — before three boss milestones multiply the test surface — means the test migration happens
once instead of four times. Zero player-visible payoff until post-demo; that's accepted.

## Scope / acceptance criteria
- [ ] `MEMBER_POOL` / per-member definitions replace slot-hardcoded identity.
- [ ] Per-member **charge** (not mage-only), **caster-keyed Taunt/Defense** (statuses attributed to
      the member who cast, not a slot), and a `memberDamage(m)` accessor.
- [ ] Migrate the existing engine tests to the new member model.
- [ ] **Gate:** behavior-neutral for the current fixed trio — sim output matches the #06 baseline.

## Implementation notes
- Hardcoded slot-identity anchors to generalize (verified @ current tree):
  `engine.ts:143, 231, 327, 401-403, 467-468, 576, 610-611, 685`.
- Keep `ENEMY_ATTACK_BONUS` and boss tuning comp-agnostic.

## Tests (required per CLAUDE.md)
- Migrated member tests pass; trio behaves identically (charge, taunt attribution, damage).

## Out of scope / follow-ups
- The five new members, draft flow, and generator constraints are post-demo (#27–#31).
