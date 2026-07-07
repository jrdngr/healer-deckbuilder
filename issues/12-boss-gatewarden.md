# Issue 12 — Boss 1: Gatewarden — "learn to read" (P4)

- **Status:** ✅ Complete
- **Roadmap phase:** P4   **Size:** M
- **Depends on:** #10 (and #04 enrage fix, #07 EnemyDef)   **Blocks:** #13 (strict boss order)
- **Addresses:** review §4 P4 (roadmap M3)

## Why
The first boss teaches telegraph-reading. It uses a **fixed, learnable rotation** and one big
**channelled** attack whose wind-up *is* the standing telegraph — preserving the single-telegraph
invariant while introducing multi-turn threats.

## Scope / acceptance criteria
- [ ] Fixed rotation: **single → two → heavy → sweep**, repeating.
- [ ] Every 2nd cycle, the heavy becomes **Crushing Blow**: a **2-turn channel** at ~**20** (≈3×
      heavy). While channelling, the enemy takes no other action (the wind-up is the telegraph).
- [ ] Taunt-retarget re-checks **at resolve**, not only at cast (so late taunt still redirects it).
- [ ] UI: countdown badge + cast bar for the channel.
- [ ] **Gate:** Act-1 clear ≥ **85%**. **➤ Human playtest #1** after this lands.

## Implementation notes
- Engine: add `rotation` to `EnemyDef` (#07); add `turnsUntilResolve` to the Telegraph; resolve
  channels in the enemy phase. Emit the appropriate `GameEvent`s so `src/animations.ts` /
  `src/useGame.ts` drive the cast-bar (explicit line item — don't skip the event plumbing).
- Rotation naturally opens on `single`, complementing the #04 turn-1 rule.
- UI: `src/components/EnemyPanel.tsx` (badge), `AttackLines.tsx` (cast bar).

## Tests (required per CLAUDE.md)
- Rotation order is exact; Crushing Blow resolves after 2 turns for ~20; late taunt redirects the
  channel at resolve; Act-1 sim gate.

## Out of scope / follow-ups
- `'cast'` telegraph kind and healing-denial mechanics arrive with Hexweaver (#13).
