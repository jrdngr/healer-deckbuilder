# Issue 07 — Data-driven EnemyDef + intent names (P2a)

- **Status:** ✅ Complete
- **Roadmap phase:** P2 (a)   **Size:** M
- **Depends on:** #06   **Blocks:** #09, #12
- **Addresses:** review §4 P2 (roadmap M1a)

## Why
Enemies are largely hardcoded. To ship named normals and three distinct bosses, the engine needs a
data-driven `EnemyDef` describing HP, attack weights, bonuses, and (later) rotations/phases. This
is pure plumbing: it must change **no** behavior.

## Scope / acceptance criteria
- [ ] Introduce/extend an `EnemyDef` structure in `src/constants.ts` covering the fields current
      enemies use (maxHP, boss flag, attack bonus, type weights), consumed by the engine.
- [ ] Surface human-readable **intent names** in the UI (the telegraph already carries the numbers;
      give each attack type a display name).
- [ ] **Gate:** sim output is **bit-identical** to the #06 baseline (this refactor is behavior-
      neutral). This is the acceptance test.

## Implementation notes
- Enemy config currently threads through `src/engine.ts` (see `EnemyConfig` usage) and
  `src/constants.ts`. Keep the engine reading from the def; don't fork logic.
- Intent-name display: `src/components/EnemyPanel.tsx` / `AttackLines.tsx`.

## Tests (required per CLAUDE.md)
- Bit-identical sim assertion vs recorded baseline; existing engine tests stay green unchanged.

## Out of scope / follow-ups
- Rotation/channel fields are added by the Gatewarden (#12); `'cast'` telegraph by Hexweaver (#13);
  phase system by Devourer (#14).
