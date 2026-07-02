# Issue 30 — Party W4: full draft + weight-surfacing UI

- **Roadmap phase:** post-demo (party wave 4)   **Size:** M
- **Depends on:** #29   **Blocks:** #31
- **Addresses:** review §3.4 (draft flow)

## Why
With all 8 members built, ship the real draft: three 1-of-2 picks then slot assignment, with the
placement weights **surfaced** so the choice is informed rather than hidden.

## Scope / acceptance criteria
- [ ] **Draft at run start:** three 1-of-2 picks from the pool of 8, then L/C/R slot assignment on a
      confirm screen.
- [ ] **Surface the weights:** the 25/50/25 primary and 40/20/40 hidden placement weights are shown.
- [ ] The **classic trio is pre-selected**; one click accepts it (returning players lose nothing).
- [ ] **Generator constraints:** total conservative damage ≥ 8 with one member ≥ 4 (ratings: Ranger
      4, Tank 2, Mage 5, Warlock 7, Berserker 2, Skald 3, Warden 3, Augur 4); assert ≥ 2
      conventionally healable members. Taunt-less drafts are intended variance — if taunt-less boss
      winrate < ~15% in sims, add a purchasable **Taunt-lite card** rather than forcing the Tank.

## Implementation notes
- Draft location + generator in `src/run.ts`; confirm/weight UI in `src/components/DeckPicker.tsx`
  (or a new draft screen). Constraints enforced in the generator with asserts.

## Tests (required per CLAUDE.md)
- Generator honors the damage-floor and healable-count constraints across many seeds; trio
  pre-selection path; weight display values.

## Out of scope / follow-ups
- The per-composition balance pass is #31; the deferred "Wanderer" swap node stays deferred.
