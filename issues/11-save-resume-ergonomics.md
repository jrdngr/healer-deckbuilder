# Issue 11 — Save/resume + long-run ergonomics (P3b)

- **Roadmap phase:** P3 (b)   **Size:** M
- **Depends on:** #10   **Blocks:** none (quality-of-life for long runs)
- **Addresses:** review §4 P3 (roadmap M2 ergonomics)

## Why
A 9-fight run is long enough that losing progress on a refresh is unacceptable, and the pacing needs
a speed control. Save/resume at **fight boundaries** (not mid-fight) is cheap because the run layer
is already pure and seed-deterministic.

## Scope / acceptance criteria
- [ ] Boundary-only serialization: `Run.toJSON()` / `Run.fromJSON()`; persist and restore between
      fights/nodes.
- [ ] `makeRng` gains **get/set state** so a resumed run continues the same deterministic stream.
- [ ] **Continue** button on the start screen when a save exists.
- [ ] Animation-speed toggle.
- [ ] Copy sweep: Topbar / StartScreen / Map / RunOver reflect 3 acts / 9 fights (StartScreen still
      hardcodes "Five fights").

## Implementation notes
- `src/run.ts` (serialization), `src/rng.ts` (state get/set), `src/useRun.ts` (persistence hook),
  `src/components/StartScreen.tsx` / `Topbar.tsx` / `MapScreen.tsx` / `RunOverScreen.tsx`.
- Serialize only at boundaries — no in-fight engine snapshotting (that's a standing cut).

## Tests (required per CLAUDE.md)
- Save round-trip: `fromJSON(toJSON(run))` reproduces state; a resumed run's RNG stream matches an
  uninterrupted run of the same seed.

## Out of scope / follow-ups
- Mid-fight saves are a standing cut (post-demo, if ever).
