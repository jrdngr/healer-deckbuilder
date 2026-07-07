# Issue 33 — Injuries past the cap: adopt a harder scar mode (playtest 2026-07-04)

- **Status:** ✅ Complete
- **Roadmap phase:** post-demo (DR1 follow-up)   **Size:** S (mechanics landed; the flip + UI remain)
- **Depends on:** DR1 (landed)   **Blocks:** none
- **Addresses:** the maintainer's playtest question — "the third death nullifies the system"

## Why

The DR1 scar system stops at 3 scars, so once a member is Broken every further death is **free**
and the sacrifice line returns for that member. The 2026-07-04 playtest built the infrastructure
and measured two harder variants. Both are **already implemented and tested** behind
`INJURY_RULES.mode` in `src/constants.ts` (default `'cap'`, today's rule):

- **`escalate`** — scars never cap; the 3-tier penalty cycle repeats (4th −2 max HP, 5th −1 damage,
  6th −1 ability, …).
- **`incapacitate`** — the 4th death takes the member **out of the run**: they enter every fight
  dead, cannot be Resurrected in-fight, and are restored by healing a scar at the Infirmary /
  Field Hospital / Mending Totem (recoverable, like the rest of DR1).

`sim/injury-exp.ts` (committed) measures both, on the honest line and on a **degenerate line**
(never heals a scar; banks the gold — the exploit the cap invites).

## Measurements (N=1000 per cell)

| line | cap (today) | escalate | incapacitate |
|---|---|---|---|
| honest (policy heals scars) | **32.1%** | 32.1% | 32.1% |
| degenerate (never heals) | **18.3%** | 18.1% | 18.0% |

Supporting telemetry (honest line): past-cap deaths **0.01/run** (0.2% of deaths), only **2.4%**
of runs ever see a capped member, ~33g/run spent healing. Degenerate line: past-cap deaths
0.16/run, 13.9% of runs cap a member, incapacitations fire in 4% of runs; **zero** turn-cap
stalls in any cell (no softlock — a fight can never *start* with all three incapacitated, because
a fight in which everyone died was a loss).

## What the numbers mean

1. **The nullification is real but rare, and it is not a winrate exploit.** Never healing already
   costs −13.8pp — the first three scars carry the deterrent. The "free deaths past the cap" tail
   is only ~3% of the degenerate line's deaths.
2. **Both harder modes are winrate-free on the honest line** (statistically identical at N=1000) —
   adopting one requires **no re-tune** of bosses, Infirmary pricing, or the Mending Totem.
3. So this is a **fantasy/legibility decision, not a balance one**: today a player can *see* that
   a Broken member is free to spend, and that undercuts the DR1 promise ("death always costs").

## Recommendation

Adopt **`incapacitate`** as the default. It is the legible, dramatic answer (a 4th death visibly
takes the member off the field), it bites exactly and only the sacrifice line, and it keeps the
DR1 recoverability shape (heal a scar → they return). `escalate` is the quieter alternative but
its extra tiers almost never materialize (max 6 scars seen across 1000 degenerate runs) — it
punishes on paper more than in play.

## Scope / acceptance criteria (the remaining work)

- [x] Flip `INJURY_RULES.mode` default to `'incapacitate'` (one line).
- [x] UI affordances: an **Incapacitated** state on the MemberCard (distinct DEAD overlay —
      "☠ Incapacitated / heal a scar to restore", its own class), the 4th-scar name `'Shattered'`
      in `INJURY_NAMES`, and Infirmary copy that says healing restores them (member flagged
      "☠ Incapacitated" + a hint line).
- [x] The Resurrect card's "target is incapacitated" refusal is surfaced in the hand prompt:
      selecting Resurrect when every corpse is Incapacitated reads "can't reach the Incapacitated —
      heal a scar at an Infirmary to restore them" instead of a silent no-op.
- [x] N=1000 Standard **32.1%** (dead-center) + Story **96.4%** after the flip — both unchanged
      from the table; the N=200 pin stayed bit-identical (the honest policy never reaches a 4th death).
- [ ] Playtest feel check: a maintainer run where a member is deliberately spent to 4 deaths.
      *(maintainer-manual — left for the human gate.)*

## Implementation notes (already landed)

- `INJURY_RULES` / `injuryRecordCap()` / `injuryIncapacitates()` in `src/constants.ts`; the
  `escalate` penalty cycle in `injuryPenalty`. `Run.recordInjuries` respects the mode cap;
  `Run.toBattleConfig` marks `incapacitated`; the engine seats such members dead
  (`diedThisFight` stays false — no new scar for a fight never stood in) and `canPlay` refuses
  Resurrect on them; the sim policy skips them (`tryResurrect`).
- Tests: `test/run.test.ts` (mode caps, escalate penalty cycle, incapacitation round-trip through
  `toBattleConfig`, Infirmary restore) and `test/engine.test.ts` (starts dead, unresurrectable,
  plain corpses still revivable, wipe interplay).

## Out of scope / follow-ups

- Difficulty-linked modes (e.g. Brutal always `escalate`) — decide after the default flips.
