# Issue 06 — Re-anchor the post-P1 sim baseline

- **Status:** ✅ Complete
- **Roadmap phase:** P1 (close)   **Size:** S
- **Depends on:** #02, #03, #04, #05   **Blocks:** #07 (needs a stable reference)
- **Addresses:** flaw #8

## Why
The P1 balance repair (#02–#05) invalidates the old ~100/100/83/67/60 / ~35% baseline. Before any
plumbing or content lands, re-measure and record the new reference so every later gate compares
against reality, not a pre-repair meta. Curve retuning is deliberately withheld until this
measurement exists.

## Scope / acceptance criteria
- [ ] Run the #01 harness at N = 1000 with the P1 changes merged; record new per-fight and full-run
      winrates + 95% CIs as the canonical baseline (in the harness README/output).
- [ ] Only **after** measuring, decide whether `ENEMY_ATTACK_BONUS` needs a nudge (likely toward
      `[1,1,…]` to de-tedium fights 0–1). Any difficulty valve must be **run-shaped** (e.g. one
      "second wind" per run at 1 HP), never HP-shaped.
- [ ] Commit the recorded baseline numbers so #07's bit-identical gate has something to diff against.

## Implementation notes
- No new mechanics; this is a measurement + a possibly-tiny `ENEMY_ATTACK_BONUS` tweak in
  `src/constants.ts` (current `[0, 1, 2, 2, 0]`).

## Tests (required per CLAUDE.md)
- If `ENEMY_ATTACK_BONUS` changes, update the affected engine tests; otherwise none new.

## Out of scope / follow-ups
- The 9-fight curve (#10) supersedes this per-fight bonus array once the 3-act structure lands.
