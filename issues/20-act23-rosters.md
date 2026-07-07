# Issue 20 — Act 2/3 named rosters (P8)

- **Status:** ✅ Complete
- **Roadmap phase:** P8   **Size:** M
- **Depends on:** #14 (reuses boss tech), #09   **Blocks:** none
- **Addresses:** review §4 P8 (roadmap M6b)

## Why
Acts 2 and 3 need their own normal enemies so the later map isn't scaled act-1 filler. Reuse the
boss mechanics (channel, pierce, self-heal) at small scale for cheap variety.

## Scope / acceptance criteria
- [ ] 3–4 named normals **per act** reusing boss tech at small scale: a **channeler** (mini
      Crushing Blow), a **piercer** (mini Piercing Bolt), a **self-healer** (mini Consume).
- [ ] Wire them into the act-2/act-3 encounter tables.
- [ ] **Gate:** per-fight curve stays inside the #14 full-run band ±5 pp.

## Implementation notes
- New `EnemyDef`s in `src/constants.ts` reusing rotation/`'cast'`/self-heal fields already added by
  #12–#14; encounter tables in `src/run.ts`.

## Tests (required per CLAUDE.md)
- Each normal's mechanic fires correctly at small scale; per-fight winrate band.

## Out of scope / follow-ups
- Multi-enemy / adds fights are a standing cut (post-demo, #32).
