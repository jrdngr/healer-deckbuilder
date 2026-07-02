# Issue 19 — Events expansion 3 → ~8 (P7e)

- **Roadmap phase:** P7 (e)   **Size:** M
- **Depends on:** #10 (map/node layer)   **Blocks:** none
- **Addresses:** review §4 P7 (roadmap M6a events)

## Why
Three events make map forks feel same-y. Expanding to ~8 gives runs texture and hooks for the
new archetypes and (later) relics.

## Scope / acceptance criteria
- [ ] Grow the event pool from 3 to ~8. Candidates: **Cursed Chest**, **Mercenary**, **Duplicator**,
      **Purge Well**, plus the **reworked Casino** (safe +25g vs the flip, from #05).
- [ ] Each event has clear, seed-deterministic choices/outcomes; none is a strictly positive-EV
      non-decision.

## Implementation notes
- Events live in `src/run.ts` + `src/components/EventScreen.tsx`. Reuse the existing event data
  shape; keep rolls seeded via `makeRng`.
- Duplicator (copy a card) and Purge Well (removal) intersect the 20g removal economy from #05 —
  keep pricing consistent.

## Tests (required per CLAUDE.md)
- Each event's outcomes by seed; the reworked Casino offers both branches; determinism.

## Out of scope / follow-ups
- The Reliquary node (relic fork) is added with #21, not here.
