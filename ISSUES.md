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

**Done: 01–15** (P0–P6 plus card set phase A). Each landed as its own commit with tests and a
sim gate. The three bosses hit their gates (Gatewarden ~89% / Hexweaver ~71% / Devourer ~57%)
and the **full run is winnable end to end at ~32%** (the designed 25–35% band — re-checked at
N=1000 after #15's five shop cards joined the pool; unmoved). **Next up: #16 (card set phase
B).** **➤ Human playtest #2** is ready now (the Devourer / full-run band landed).

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
| 16 | ⬜ Todo | [Card set phase B: small-new-state cards](./issues/16-cards-phase-b.md) | P7b | 15 | §3.2 |
| 17 | ⬜ Todo | [Card set phase C: Bulwark / Defense pipeline](./issues/17-cards-phase-c-bulwark.md) | P7c | 16 | §3.2; Q10 |
| 18 | ⬜ Todo | [Resurrect rework + poison decision + Second Wind](./issues/18-resurrect-poison-secondwind.md) | P7d | 14, 16 | flaws #13, #14; Q5 |
| 19 | ⬜ Todo | [Events expansion 3 → ~8](./issues/19-events-expansion.md) | P7e | 10 | §4 P7 |
| 20 | ⬜ Todo | [Act 2/3 named rosters](./issues/20-act23-rosters.md) | P8 | 14, 09 | §4 P8 |
| 21 | ⬜ Todo | [Relics phase A: infra + 10 legible relics](./issues/21-relics-phase-a.md) | P9a | 14, 17 | §3.3; Q9 |
| 22 | ⬜ Todo | [Relics phase B: rule-changers + curses](./issues/22-relics-phase-b.md) | P9b | 21 | §3.3, §3.5–6; Q1 |
| 23 | ⬜ Todo | [Difficulty presets + local stats](./issues/23-difficulty-presets.md) | P10 | 14 | §4 P10; Q8 |
| 24 | ⬜ Todo | [Hardening & UX batch](./issues/24-hardening-ux.md) | P11 | 23 | flaws #15, #16, #20, #21 |
| 25 | ⬜ Todo | [Hand-size experiment (hand 4 + carryover)](./issues/25-hand-size-experiment.md) | exp. | 06 | flaw #16; Q6 |
| 26 | ⬜ Todo | [Full turn-1 phase reorder](./issues/26-turn1-phase-reorder.md) | post-demo | 04 | flaw #12; Q7-full |
| 27 | ⬜ Todo | [Party W1 — Warlock + Skald + draft skeleton](./issues/27-party-w1-warlock-skald.md) | post-demo | 08 | §3.4 |
| 28 | ⬜ Todo | [Party W2 — Berserker + Grave Augur](./issues/28-party-w2-berserker-augur.md) | post-demo | 27 | §3.4 |
| 29 | ⬜ Todo | [Party W3 — Beast Warden + pet subsystem](./issues/29-party-w3-beast-warden.md) | post-demo | 28 | §3.4 |
| 30 | ⬜ Todo | [Party W4 — full draft + weight-surfacing UI](./issues/30-party-w4-draft-ui.md) | post-demo | 29 | §3.4 |
| 31 | ⬜ Todo | [Party W5 — per-composition balance pass](./issues/31-party-w5-balance-pass.md) | post-demo | 30 | §3.4 |
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
