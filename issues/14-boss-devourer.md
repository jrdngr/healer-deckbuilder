# Issue 14 — Boss 3: Devourer — "race or die" + phase system (P6)

- **Roadmap phase:** P6   **Size:** M–L
- **Depends on:** #13 (strict boss order; needs `'cast'`)   **Blocks:** #20; anchors #21/#22 gates
- **Addresses:** review §4 P6 (roadmap M5); the enrage race designed on purpose

## Why
The final demo boss turns the invisible enrage race into an explicit, fair one, and introduces a
**phase system** (a threshold that fires once and changes the fight). Its Consume mechanic makes
poison a decision rather than fire-and-forget — feeding the deferred poison call (#18).

## Scope / acceptance criteria
- [ ] **Phase 1 (100→50% HP):** heavy/sweep pool + **Consume** — cleanses its own poison and heals
      for the remaining ticks (poison stops being free value).
- [ ] **Phase 2 (≤50% HP):** an announced **transformation beat**, then **Maw** — a 2-turn
      channelled sweep ~**7×3** every 4 turns — plus tighter enrage.
- [ ] Phase threshold fires **exactly once**, even if crossed mid-DoT.
- [ ] Enemy **self-heal** mechanic (Consume) supported in the engine.
- [ ] **Gates:** bosses ~**85 / 70 / 55%** (Gatewarden/Hexweaver/Devourer). **Full-run band
      25–35% tuned here, once, against real content.** **➤ Human playtest #2.**

## Implementation notes
- Engine: phase field on `EnemyDef` (#07) with an HP-threshold trigger; ensure the trigger is
  edge-detected (fires once). Reuse the `'cast'` telegraph (#13) for Maw's channel.
- Consume interacts with the poison status on the enemy — cleanse + heal-for-remaining.

## Tests (required per CLAUDE.md)
- Phase transition fires once at 50% incl. when a poison tick crosses it; Consume removes poison and
  heals by remaining ticks; Maw resolves for ~7×3; boss + full-run sim gates.

## Out of scope / follow-ups
- The poison rebalance decision itself is executed in #18 (informed by Consume's measured effect).
