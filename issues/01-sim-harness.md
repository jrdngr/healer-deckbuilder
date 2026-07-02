# Issue 01 — Sim harness as infrastructure

- **Roadmap phase:** P0   **Size:** S–M
- **Depends on:** none   **Blocks:** every other issue (all balance gates run through it)
- **Addresses:** review §4 P0; precondition for flaw #8

## Why
The June balance pass proved out a good-AI simulation as the only trustworthy way to judge
balance, but it lived in a throwaway `sim_tmp.ts` that was deleted. Every downstream issue in this
backlog has a winrate gate; those gates need a permanent, deterministic harness that plays both
shopping and fights. Build it first so nothing after it is tuned by feel.

## Scope / acceptance criteria
- [ ] `sim/policy.ts` — a living "good player" policy: taunt-uptime + heal-the-tank line, buys
      sensibly, plays the known-optimal fight lines. Structured so later issues extend it per boss.
- [ ] `sim/run-sim.ts` — runs full runs from a seed range; reports **per-fight** and **full-run**
      winrates, mean turn counts, and 95% confidence intervals.
- [ ] `"sim"` npm script wired in `package.json` (mirrors `"test"` which runs `tsx`).
- [ ] Determinism smoke test: same seed → identical result across two runs (add to test suite).
- [ ] Record the **current baseline** in the harness output/README comment:
      per-fight ~100/100/83/67/60%, full-run ~35% (from `memory/balance-pass-2026-06`).
- [ ] Default gate size is **N = 1000 seeds** with reported 95% CIs (used verbatim by later issues).

## Implementation notes
- Consume the pure engine (`src/engine.ts`) and run layer (`src/run.ts`) directly — DOM-free, so
  the sim imports them without React. Reuse `makeRng(seed)` from `src/rng.ts` for determinism.
- Keep the policy data-driven enough that P4/P5/P6 can register per-boss reactions without a rewrite.
- No production-code changes required; this is additive tooling. Keep it out of the Vite bundle.

## Tests (required per CLAUDE.md)
- `test/` (or `sim/`) determinism test: `runSim(seed) === runSim(seed)`.
- A tiny fixed-seed regression asserting the harness produces a stable winrate number.

## Out of scope / follow-ups
- Boss-specific policy reactions arrive with each boss (#12, #13, #14).
- Relic-aware shop policy arrives with #21.
