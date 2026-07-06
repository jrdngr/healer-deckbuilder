# Issue 59 — End-of-fight gold particle animation

- **Phase:** fx (cosmetic)   **Size:** M
- **Depends on:** #57 (settled post-fight reward sequence) — soft   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "Add an animation at the end of each fight for gold. One gold
  particle per piece of gold earned, form a swarm, then animate to its destination. Salary gold
  moves to each party member receiving a salary; player gold moves to the gold UI element on the top
  status bar."

## Why

Winning a fight currently mutates gold silently. Give the reward a beat: spawn one gold particle per
gold earned, gather them into a swarm, then fly them to their destinations — salary shares to each
paid party member, the player's take to the topbar gold element. Pure juice; no state/balance change.

## Acceptance criteria

- [ ] On a won fight, a gold-particle burst spawns roughly one particle per gold earned (cap the
      count sensibly for large payouts — and `log()`/comment the cap so it's not mistaken for exact).
- [ ] Particles form a swarm, then split: salary portions fly to each party member receiving a
      salary; the remainder flies to the topbar `.run-gold` element.
- [ ] The topbar gold counter updates as/after the player's particles arrive.
- [ ] Respects reduced-motion and the existing speed toggle; no layout shift; cleans up its FX nodes.
- [ ] Typecheck/build clean; tests pass (this is presentational — no engine test required).

## Implementation notes (anchors)

- **Amounts:** `src/run.ts:471-493` `winFight()` — reward at `:479-480`, salaries paid at `:483`
  (`gold + reward - deployedSalary()`). `deployedSalary()` `:455` and per-member `memberSalary()`
  `src/constants.ts:1192` give the per-recipient split to target particles toward.
- **FX primitives to reuse:** `src/animations.ts` — `burst` (`:26`, the one-particle-per-N swarm,
  rendered `src/components/FxLayer.tsx:112-125` with per-particle `--dx/--dy` from `offsets()`
  `:50-73`; CSS `styles.css:501`,`:508`) and `cardGhost` (`:42`, "spawn at a measured px box, fly to
  an anchor", rendered `FxLayer.tsx:182-201`) — the closest "fly to a target" pattern.
- **Spawning:** `src/useGame.ts:150` `spawnFx(spec)` (auto-removes after duration); one-off spawn
  example at `:283` (cardGhost on card play) — the template for a non-timeline gold burst.
- **Topbar-reach constraint (important):** `FxLayer` is `position:absolute; inset:0` **inside the
  battle container** (`styles.css:439`) and its `anchor()` (`FxLayer.tsx:38-46`) only resolves
  `.enemy`, `.mp-bar`, and `.party` — it **cannot reach the topbar `.run-gold`** (`Topbar.tsx:24`,
  outside the battle container). Flying gold to the topbar needs a new anchor-resolution path or a
  separate full-viewport FX overlay. Salary targets (party slots) *are* reachable by the existing
  anchors.

## Tests

- Presentational — no engine test. Keep any particle-count/offset math in a tiny pure helper and
  unit-test that if extracted.

## Out of scope

- Changing gold amounts, salary math, or the reward sequence (that's #57/#58).
