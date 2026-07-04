# Healer Deckbuilder — Issue Backlog

Derived from the multi-agent design review (`docs/design-review-2026-07-02.md`). Each issue is a
self-contained file in [`issues/`](./issues/) with why / acceptance criteria / implementation
notes (code anchors) / tests / out-of-scope.

**Ordering is implementation sequence, not severity.** Numbers reflect the dependency chain from
the review's unified roadmap (P0 → P11 → post-demo). Severity is intentionally not tracked. Every
maintainer-facing open question has been **accepted** and folded into its home issue (see the map
below) — no issue asks you to choose.

**Ground rules baked into the issues:** all winrate gates run at N = 1000 seeds with 95% CIs;
every damage-modifying card/relic/boss mechanic must keep the telegraph preview (`attackTargets()`)
equal to applied damage (a property test); the engine stays pure/DOM-free; each issue ends in a
`jj` commit with its own tests per `CLAUDE.md`.

**Keep this file current:** when an issue lands, flip its row to ✅ Done and update the
[Progress](#progress) line (and the playtest-gate notes, if one just unlocked) **in the same
commit** — or, at latest, a docs commit immediately after. This table is the single source of
truth for where the project stands; a stale Status column costs the next session real time.

## Legend

- **Phase** — the roadmap milestone the issue belongs to (P0–P11, or post-demo).
- **Depends** — issues that must land first.
- **Addresses** — flaw numbers / open questions / review sections it resolves.

## Progress

**Done: 01–24 — every committed demo issue has landed** (P0–P11; nothing was cut at the Q1 cut
line). Remaining rows are the #25 experiment and post-demo work (#26–#32). Highlights: all card
work + the ward pipeline; the Q5 poison decision (**measured and left at 5×5**); events 3 → 8;
act-2/3 named rosters; **relics phase A** (10 relics, spoils after fights 3 & 6, Reliquary twice
per run) and **phase B** (Aegis Font / First-Light Taper / Dusk Chime / Martyr's Icon + the
three curses, with Chime/Icon **once per run** via spent-relic plumbing). Relic power twice
lifted the run out of band and was absorbed by relic tuning + boss HP: Hexweaver 135→146,
Devourer 165→198 — per-relic gate numbers and the tuning history live in `sim/run-sim.ts`. The
bosses hit their gates (Gatewarden ~89% / Hexweaver ~70% / Devourer ~53%) and the **full run is
winnable end to end at ~31%** (N=1000, the designed 25–35% band); **Story reads 96% at N=1000** (Q8 gate ≥60%), Brutal is dev-only
(`?dev`) and ungated; local stats (wins per difficulty, best act) persist beside the save — no
meta-progression. **#25 (hand-size experiment) landed as a measured REVERT**: hand-4 + carryover
is behind an inert `HealerConfig.carryover` flag (default 0); the demo stays hand-3 because hand
size is a +22pp/card lever that would break the band, and carryover measured *worse* than plain
hand-4 (see the issue file for the N=1000 table). **#26 (full turn-1 reorder) landed player-first
ordering**: the party now acts before the enemy's opening blow (the #04 turn-1-single patch is
retired). That free planning turn was a ~30pp systemic buff, re-anchored entirely on boss HP
(Gatewarden 130→155, Hexweaver 158→184, Devourer 182→208) — F2 87.2% / F5 70.2% / F8 52.7% /
full-run 31.7% at N=1000, all dead-center in-band; Story 95.5%. **NOTE:** this HP re-anchor shifts
the #22 per-relic gate baseline again — re-run that battery before leaning on its deltas. #24's hardening batch: status tooltips, modifier text on cards, the in-fight
deck viewer (order-hiding), fork previews (encounters now derive from per-fight sub-seeds —
peekable and stream-independent), the end-of-run score with a hoarded-gold penalty, and DevPanel
gated to dev builds. **The automated ship gate is green** (suite + Standard 32.7% / Story 96.4%
at N=1000 + clean build). **➤ What remains is human: playtests #2 and #3 (maintainer, manual) —
the final ship call.**

## Issues (implementation order)

| # | Status | Issue | Phase | Depends | Addresses |
|---|--------|-------|-------|---------|-----------|
| 01 | ✅ Done | [Sim harness as infrastructure](./issues/01-sim-harness.md) | P0 | — | §4 P0 |
| 02 | ✅ Done | [Shield lifetime + bug-class fixes](./issues/02-shield-lifetime-bugfixes.md) | P1a | 01 | flaws #4, #19, #20 |
| 03 | ✅ Done | [Dominant-line breakers: Taunt + engine-tag rules](./issues/03-taunt-engine-tag-rules.md) | P1b | 01 | flaws #1, #3; Q3 |
| 04 | ✅ Done | [Boss enrage race: countdown + tuning + turn-1 single](./issues/04-enrage-race-and-turn1.md) | P1c | 01 | flaws #2, #12; Q7-partial |
| 05 | ✅ Done | [Rest rework + economy repricing](./issues/05-rest-rework-economy-repricing.md) | P1d | 01 | flaws #5–7,9–11,17,18; Q4 |
| 06 | ✅ Done | [Re-anchor the post-P1 sim baseline](./issues/06-reanchor-sim-baseline.md) | P1 | 02–05 | flaw #8 |
| 07 | ✅ Done | [Data-driven EnemyDef + intent names](./issues/07-enemydef-plumbing.md) | P2a | 06 | §4 P2 |
| 08 | ✅ Done | [Member-identity refactor](./issues/08-member-identity-refactor.md) | P2b | 06 | §3.2 party-M0; Q2 |
| 09 | ✅ Done | [Four named normal enemies + encounter tables](./issues/09-named-normal-enemies.md) | P2c | 07 | §4 P2 |
| 10 | ✅ Done | [3-act / 9-fight structure + per-act curve](./issues/10-three-act-structure.md) | P3a | 09 | §4 P3 |
| 11 | ✅ Done | [Save/resume + long-run ergonomics](./issues/11-save-resume-ergonomics.md) | P3b | 10 | §4 P3 |
| 12 | ✅ Done | [Boss 1 — Gatewarden ("learn to read")](./issues/12-boss-gatewarden.md) | P4 | 10 | §4 P4 |
| 13 | ✅ Done | [Boss 2 — Hexweaver ("you can't turtle") + Cleanse](./issues/13-boss-hexweaver.md) | P5 | 12 | §4 P5; flaw #1 |
| 14 | ✅ Done | [Boss 3 — Devourer ("race or die") + phase system](./issues/14-boss-devourer.md) | P6 | 13 | §4 P6 |
| 15 | ✅ Done | [Card set phase A: existing-field cards](./issues/15-cards-phase-a.md) | P7a | 14 | §3.2 |
| 16 | ✅ Done | [Card set phase B: small-new-state cards](./issues/16-cards-phase-b.md) | P7b | 15 | §3.2 |
| 17 | ✅ Done | [Card set phase C: Bulwark / Defense pipeline](./issues/17-cards-phase-c-bulwark.md) | P7c | 16 | §3.2; Q10 |
| 18 | ✅ Done | [Resurrect rework + poison decision + Second Wind](./issues/18-resurrect-poison-secondwind.md) | P7d | 14, 16 | flaws #13, #14; Q5 |
| 19 | ✅ Done | [Events expansion 3 → 8](./issues/19-events-expansion.md) | P7e | 10 | §4 P7 |
| 20 | ✅ Done | [Act 2/3 named rosters](./issues/20-act23-rosters.md) | P8 | 14, 09 | §4 P8 |
| 21 | ✅ Done | [Relics phase A: infra + 10 legible relics](./issues/21-relics-phase-a.md) | P9a | 14, 17 | §3.3; Q9 |
| 22 | ✅ Done | [Relics phase B: rule-changers + curses](./issues/22-relics-phase-b.md) | P9b | 21 | §3.3, §3.5–6; Q1 |
| 23 | ✅ Done | [Difficulty presets + local stats](./issues/23-difficulty-presets.md) | P10 | 14 | §4 P10; Q8 |
| 24 | ✅ Done | [Hardening & UX batch](./issues/24-hardening-ux.md) | P11 | 23 | flaws #15, #16, #20, #21 |
| 25 | ✅ Done | [Hand-size experiment (hand 4 + carryover)](./issues/25-hand-size-experiment.md) | exp. | 06 | flaw #16; Q6 |
| 26 | ✅ Done | [Full turn-1 phase reorder](./issues/26-turn1-phase-reorder.md) | post-demo | 04 | flaw #12; Q7-full |
| 27 | ✅ Done | [Party W1 — Warlock + Skald + draft skeleton](./issues/27-party-w1-warlock-skald.md) | post-demo | 08 | §3.4 |
| 28 | ✅ Done | [Party W2 — Berserker + Grave Augur](./issues/28-party-w2-berserker-augur.md) | post-demo | 27 | §3.4 |
| 29 | ✅ Done | [Party W3 — Beast Warden + pet subsystem](./issues/29-party-w3-beast-warden.md) | post-demo | 28 | §3.4 |
| 30 | ✅ Done | [Party W4 — full draft + weight-surfacing UI](./issues/30-party-w4-draft-ui.md) | post-demo | 29 | §3.4 |
| 31 | ✅ Done | [Party W5 — per-composition balance pass](./issues/31-party-w5-balance-pass.md) | post-demo | 30 | §3.4 |
| 32 | ⬜ Todo | [Post-demo backlog](./issues/32-post-demo-backlog.md) | post-demo | 24 | §4 post-demo |

**Notes on ordering:** #01 blocks everything (all gates run through the sim). #02–#06 (P1 balance
repair) must precede #07 because the bit-identical plumbing gate needs a stable baseline. Bosses
**#12 → #13 → #14 are strictly ordered** (they share the channel/`'cast'`/phase telegraph
machinery). #25 is scheduled experimental but, **if adopted, must precede #22** (it changes hand
size, which Taper's draw penalty depends on). #26–#32 are post-demo.

## Open questions → issues (all 10 accepted)

| Q | Topic | Resolution (accepted) | Issue |
|---|-------|-----------------------|-------|
| Q1 | Relic scope cut line | Rule-changers + curses are in-demo **stretch** (the designated cut line) | [22](./issues/22-relics-phase-b.md) |
| Q2 | Party identity refactor in-demo | **Yes** — do it at P2 so tests migrate once | [08](./issues/08-member-identity-refactor.md) |
| Q3 | Taunt fix flavor | **Prototype both** (future-only vs +1 MP retarget), pick by feel | [03](./issues/03-taunt-engine-tag-rules.md) |
| Q4 | Rest rework | **Decaying Rest +5/+2** (carryover rejected) | [05](./issues/05-rest-rework-economy-repricing.md) |
| Q5 | Poison nerf timing | **Defer**; let #04 enrage fix + Devourer Consume decide | [18](./issues/18-resurrect-poison-secondwind.md) |
| Q6 | Hand size | **Explore** hand-4 + 1-card carryover behind a flag | [25](./issues/25-hand-size-experiment.md) |
| Q7 | Turn-1 reorder | **P1 patch** for the demo; full reorder post-demo | [04](./issues/04-enrage-race-and-turn1.md) + [26](./issues/26-turn1-phase-reorder.md) |
| Q8 | Difficulty target | **25–35% Standard**, Story ≥ 60% at N=1000 | [23](./issues/23-difficulty-presets.md) |
| Q9 | Relic remap | Spoils after fights **3 & 6**; Reliquary in acts 2/3; recompute exclusions | [21](./issues/21-relics-phase-a.md) |
| Q10 | Naming | Card Aegis → **Phalanx**; Martyr's Gift (card) + Martyr's Icon (relic) coexist | [17](./issues/17-cards-phase-c-bulwark.md), [21](./issues/21-relics-phase-a.md)/[22](./issues/22-relics-phase-b.md) |

## Human playtest gates

Three maintainer playtests are called out in the roadmap: **#1** after the Gatewarden ([12](./issues/12-boss-gatewarden.md)) — landed,
**#2** after the Devourer / full-run band ([14](./issues/14-boss-devourer.md)) — **➤ ready now** (issue 14 landed; full-run ~32%),
**#3** the final ship gate ([24](./issues/24-hardening-ux.md)).

## Design review — flagged from the sim playtest (2026-07-03)

A full-mechanic sim playtest after #24 (1,600 runs across all three difficulties; zero crashes,
zero turn-cap stalls, all winrate bands intact) surfaced three **design** questions — not bugs.
The numbers are the fixed measuring-stick policy at N=1000 Standard unless noted. These are
inputs for playtests #2/#3; **none is a committed change yet.**

- **DR1 — the healer game is secretly a sacrifice game.** *(full design pass scheduled — do not
  pre-empt it.)* Because the party is rebuilt at full strength between fights, a mid-fight death
  costs only that fight's lost output — so the optimal line routinely spends members. Deaths per
  **won** fight: Gatewarden **0.87** (only 28% of wins are deathless), Hexweaver **1.35** (16%
  deathless), Devourer **0.83** (41%); the tank dies in ~2/3 of Gatewarden fights. Every winrate
  band was tuned on top of this, so nothing is broken — but "keep your party alive" is not what
  winning play looks like. This is the free-revive death economy (see the balance memory) writ
  across fights. Open question: is free between-fight revival the intended fantasy, or should a
  death carry a scar (HP / gold / next-fight penalty)?
- **DR2 — "race or die" has become "die on schedule."** The enrage countdown telegraphs a race,
  but on bosses it is now a guaranteed phase: enrage fires in **89%** of Hexweaver fights and
  **98%** of Devourer fights (mean ~13.8 turns vs enrage at 10–11). After the relic-absorption HP
  bumps (Devourer 165→198), racing a boss down pre-enrage is arithmetically out of reach. The
  tuning is sound; the *promise the countdown makes* no longer matches boss reality. Options: lean
  in (reframe the boss "enrage" as an announced phase) or restore pre-enrage race headroom. Low
  urgency — a legibility question, not a balance one.
- **DR3 — Brutal is a cliff, not a difficulty.** 0.0% full-run; the Gatewarden alone is **2.7%**
  with near-guaranteed triple wipes, so a Brutal player never even reaches a relic. By design
  (dev-only, ungated per Q8) — but if Brutal ever ships visibly it needs the "tuned Brutal"
  standing cut, not the current placeholder multipliers.
