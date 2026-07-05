# Issue 39 — Warlock under the roster campaign: trap starter, permadeath magnet

- **Roadmap phase:** post-campaign balance   **Size:** M (member tune + re-measure)
- **Depends on:** the 2026-07 roster campaign (single mode)   **Blocks:** #44-style re-baseline
- **Addresses:** playtest 2026-07-05 — the headline balance finding

## Why

The roster campaign changed what a member has to survive: act 1 is fought **solo/duo**, and every
death is now a **permanent scar with a permadeath cliff at 4**. The Warlock's identity — Soul Tithe
burns him −2 HP *every turn*, Dark Bargain spends more of his HP — was tuned for a trio where two
other bodies split the enemy's attention and death cost one fight's output. Under the campaign those
same numbers make him a trap at every acquisition point, and the instrumented playtest
(2026-07-05, N=1000 per line) measured it:

| line | full-run | F2 solo | permadeaths/1000 runs |
|---|---|---|---|
| starter = ranger | 54.4% | 72.4% | 386 — **all Warlock** (1 other) |
| starter = mage | 48.7% | 77.9% | 360 — all Warlock (2 others) |
| starter = warlock | **21.8%** | **3.1%** | 302 — all Warlock (1 other) |
| ranger start, **Warlock banned from every draft/recruit** | **66.2%** | — | **0** |

- **As a starter he is a 2.5× worse pick** than the Ranger (21.8% vs 54.4%), driven by act 1:
  solo Gatewarden is 3.1% for him vs 72–78% for Ranger/Mage (a 15-HP body losing 2 HP/turn to its
  own tithe cannot survive a channel boss that also aims everything at it). F0/F1 read 97/90% vs
  100/99.5% for the others.
- **As a recruit he is a net negative**: banning him from every draft/recruit offer *raises* the
  ranger-start winrate by **+11.8pp** (54.4 → 66.2%), lifts the Hexweaver from 86.7 → 97.5%, and
  zeroes permadeaths. A member the roster is better off never hiring is miscosted.
- **He is the permadeath system**: 300–386 Warlock permadeaths per 1000 runs vs ≤2 for the other
  seven members *combined*. Soul Tithe converts his identity directly into death-scars, so the
  4-death removal in practice fires only for him (see issue 42 for the system-side view).
- The sim's own rating-greedy draft picks him every time (rating 7 = highest), so the stock
  `npm run sim` baseline (21.8%) is really the Warlock-trap line — see the ISSUES.md playtest
  section for the re-baseline consequence.

Stick caveat: these are fixed-policy numbers, and #38 already gave the Warlock his best-known lines
(tithe-aware healing, front-loaded Bargain, Provoke-sink exclusion). The magnitude (+11.8pp from
merely refusing to hire him) and the permadeath concentration are structural, not piloting noise.

## Acceptance criteria

- [ ] Decide the shape of the fix (maintainer call — options, cheapest first):
  1. **Remove him from `STARTER_MEMBERS`.** He passes "can win F0 solo" (97%) but not "can survive
     act 1 solo" (F2 3.1%). Smallest change; leaves the recruit-side problem open.
  2. **Retune the identity for small parties**: e.g. Soul Tithe pauses while he is the only living
     member, or tithe damage cannot reduce him below 1 HP (mirror of the Blood-card clamp), or
     TITHE_AMOUNT 2→1 with a damage trim to keep the HP-bottleneck fantasy.
  3. **Scar-side fix**: self-inflicted deaths (tithe/bargain) scar at half rate or never permakill —
     narrows the fix to the permadeath interaction without touching his fight math.
- [ ] Whatever lands, re-measure at N=1000: starter spread (ranger/mage/warlock), the
      banned-vs-allowed delta (must move toward 0), and permadeaths-by-member (must spread or drop).
- [ ] Gate: the Warlock is no longer a strictly-dominated hire — the ban delta within ±3pp of 0 —
      and starter-warlock full-run within ~10pp of the other starters.

## Notes

- Evidence harness: the playtest's instrumented campaign runner (scratchpad `campaign-exp.ts`,
  2026-07-05 session) — re-create from the numbers above or promote a trimmed version into `sim/`
  alongside `injury-exp.ts` if this becomes a recurring gate.
- `MEMBER_BASE_SALARY.warlock = 20` (most expensive member) adds insult: the trap pick also charges
  the highest wage. Reprice with the tune.
- History rhyme: #31 nerfed him off a phantom measurement and #34/#38 restored him — do not re-nerf
  his *trio-context* numbers blindly; the problem is specifically the solo/small-party + scar
  context the campaign added.

## Tests

- Engine tests for whichever mechanic changes (tithe clamp / pause / scar rule) in
  `test/engine.test.ts`; run-layer tests if `STARTER_MEMBERS` changes (start draft never offers
  him) in `test/run.test.ts`.
- Sim pins updated in `test/sim.test.ts` (any of these changes moves the campaign stream).

## Out of scope

- The permadeath pool-return exploit (issue 40) and the act-1 roster-variance question (issue 41) —
  both interact with this issue but are independently fixable.
- Re-baselining the campaign band (tracked in the ISSUES.md playtest section).
