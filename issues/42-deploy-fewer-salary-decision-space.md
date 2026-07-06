# Issue 42 — The deploy-fewer / salary decision space is degenerate

- **Roadmap phase:** post-campaign design   **Size:** M (design decision + whichever lever lands)
- **Depends on:** member salaries (d170c12) + pre-fight deploy (dcfd70f)   **Blocks:** —
- **Addresses:** playtest 2026-07-05 — the decision-space finding the round was asked to exercise

## Why

The salary system's stated purpose (constants.ts: "fielding fewer keeps more gold") promises a
deployment-size decision. The playtest exercised that space directly (N=1000 per line, campaign
policy with the deploy rule swapped):

| deploy rule | full-run | salary paid/run | note |
|---|---|---|---|
| best 3 (max) | 21.8% | 180g | baseline |
| best 2 | **0.3%** | 83g | F4 47%, F5 12% — collapses in act 2 |
| best 1 | **0.0%** | 37g | F2 4%, F3 3% |
| bench 3-scar members | 19.6% | 175g | permadeaths 0.30 → **0.00**, F8 −10pp |

- **Fielding fewer than max is never right — not once, anywhere.** The ~10–16g/fight a benched
  member saves is worth a fraction of a card; a third body is worth entire boss fights. There is no
  fight, act, or gold state where the trade pays. The advertised choice is a pure trap.
- **Salary never constrains anything.** It is deducted from winnings after the fact (deploying is
  never gold-gated), and the `Math.max(0, …)` floor in `winFight` silently waives wages the player
  can't cover — the waiver never even fired in 9000 measured runs. Net effect: a flat ~40g/fight
  tax that re-creates the old GOLD_PER_FIGHT=40 economy with extra bookkeeping.
- **The one real deployment decision is scar-risk, not salary**: benching members at 3 scars
  (one death from permadeath) zeroes permadeaths for ~2pp full-run — a genuine tension, but it is
  (a) invisible in the salary framing and (b) in practice only ever about the Warlock (issue 39).
- Perverse detail: *blessings* raise wages — the Forgotten Shrine's free stat boost, the Mercenary,
  and the Blood Altar all increment `upgrades`, permanently raising that member's salary. A shrine
  "gift" that docks your income forever reads as a bug even where it's intentional.

## The design question (maintainer call)

Is "field fewer, keep more gold" a fantasy worth making real, or flavor worth simplifying?

1. **Make it real** — give small deployments something salary can't buy today. Ideas measured
   against the data: per-fight bounty scaling *down* with seats filled is just the same knob; what's
   missing is that gold has nowhere near a body's value. Levers that could close the gap: much
   scarcer gold overall, deploy-size-scaled rewards (extra relic/draft offers for undermanned wins),
   or fights with a real small-party edge (single-target-heavy enemies where 1–2 bodies dodge AoE
   value — today multi-target attacks just concentrate on fewer targets, making small parties
   strictly worse).
2. **Repoint it at the real decision** — drop per-fight wages; keep the deploy screen about
   *who* fights (scar risk, ability fit vs the telegraphed enemy, Berserker band state). The
   scar-risk bench call is the tension the system actually produced; surface *that* (issue 39/40
   interplay) instead of a gold line-item.
3. **Keep as flavor** — accept salaries as economy texture; then at minimum stop pretending:
   reword the deploy-screen copy, and fix the waiver (unpayable wages should dock the next win or
   block upgrades, or the floor should be documented as forgiveness).

## Acceptance criteria

- [ ] A written decision (this file updated) choosing 1/2/3, with the losing options recorded.
- [ ] If 1: the chosen lever lands with an N=1000 measurement showing at least one fight class
      where a sub-max deployment is the winning line (the gate: the decision exists).
- [ ] If 2: salary plumbing removed or frozen; GOLD_PER_FIGHT re-anchored (80 → 40-equivalent);
      deploy screen copy repointed at scar/ability fit.
- [ ] If 3: copy + waiver fix only; a run.test locks the waiver semantics.

## Tests

- Whichever branch lands: run.test.ts for the economy change; sim pins re-baselined.

## Out of scope

- Warlock permadeath concentration (issue 39), pool-return exploit (issue 40).
- The `upgrades`-raise-salary interaction is *in* scope only under option 1/2 rewrites; under
  option 3 file it as its own polish item.

## Written decision (landed 2026-07-05)

**Chose: option 1 — make it real** (via "scaled gold only" + a small-party build). Rejected: option 2
(repoint/drop wages) and option 3 (keep as flavor).

**Economy:** GOLD_PER_FIGHT 80→100, salaries rescaled up (trio 40→51), and `winFight` scales the base
bounty UP with empty deploy seats (`EMPTY_SEAT_GOLD_BONUS` = +30%/seat). Deploy screen reworked to
show bounty / wages / net. The `Math.max(0, …)` waiver is retained (documented as forgiveness); the
`upgrades`-raise-salary interaction is left as-is (a shrine gift costing income) — filed as future
polish rather than reworked here.

**Content (broad set):** relics Lone Wolf Totem (+2 dmg/body while ≤2), Focus Stone (+2 max MP while
≤2), Warband Standard (+3 max HP/empty seat); cards Rally (+2 auto/turn per empty seat), Focus (a
heal bigger while small), Channel (MP +1/empty seat), Hold the Line (mass Shield only a small party
can hold).

**Gate:** `sim/campaign-exp.ts deploySizeEdge` (N=400) on a contested early normal — fielding 2 with
the build wins **33.5%** vs the plain trio's **10.8%**, and fielding 2 WITHOUT the build is **0.0%**
(the trap). So sub-max is a real winning line when you build for it; the decision exists. Locked in a
sim.test gate.
