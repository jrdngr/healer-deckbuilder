# Issue 25 — Hand-size experiment: hand 4 + 1-card carryover (Q6)

- **Roadmap phase:** experimental (must precede #22 if adopted, per Q6)   **Size:** S–M
- **Depends on:** #06 (needs a stable sim baseline)   **Blocks:** #22 *if* adopted
- **Addresses:** flaw #16; **Open Q6 (accepted: explore it)**

## Why
Hand 3 with no carryover makes it hard to plan sequences and count outs. Worth testing whether hand
4 with a 1-card carryover improves decision texture — but it interacts with First-Light Taper's
draw-1-fewer penalty (#22) and the +1 Hand Size upgrade, so if we adopt it, it must land **before**
Taper.

## Scope / acceptance criteria
- [ ] Implement **hand 4 with 1-card carryover** behind a flag/constant.
- [ ] Sim it against the #06 baseline; specifically check the interaction with the +1 Hand Size
      upgrade and (theoretically) Taper's penalty.
- [ ] **Decision:** keep (make default, and it becomes a hard dependency of #22) or revert (record
      why). This issue is the experiment + the call, not a commitment to ship.

## Implementation notes
- `HAND_SIZE` and draw/discard logic in `src/engine.ts` + `src/constants.ts`. Carryover = don't
  discard the full hand at end of turn; keep 1.

## Tests (required per CLAUDE.md)
- If adopted: hand refills to 4 with exactly 1 carried; interaction with the +1 Hand Size upgrade.

## Out of scope / follow-ups
- If adopted, thread the ordering constraint into #22 (Taper).
