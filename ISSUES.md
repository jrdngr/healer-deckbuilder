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
- **Status 📥 Backlog** — a standing holding file (not a buildable issue); its items become their own
  numbered issues when picked up.

## Progress

**Done: 01–44 — the demo (01–24), the experiments, the full post-demo party subsystem, the
2026-07-04 playtest batch, the #34 sim-policy follow-up (#38), and the 2026-07-05 roster-campaign
batch (#39–#44), all landed 2026-07-05.**
The 2026-07-05 batch: **#43** dropped the misleading `rated N` from offers; **#40** added a graveyard
so a permadead member is never re-offered (save v10); **#41** guarantees an act-1 Recruit so a map
roll no longer decides the Gatewarden (re-anchored for the duo); **#44** moved party abilities out of
the generic Ability card into per-member cards the healer plays (Imbue Venom / Bolster / Unleash /
Hex / …), injected per deployed member; **#39** redesigned the Warlock from an HP→mana suicide
striker into a Hex controller whose Vulnerability is stronger with fewer allies (permadeaths 386→0,
starter spread 2.5×→~1.06×, no longer a trap); **#42** made "field fewer, keep more" a real decision
(GOLD_PER_FIGHT 80→100 + rescaled salaries + empty-seat-scaled bounty + a small-party card/relic
build — the campaign-exp gate shows fielding 2 winning 33.5% vs a plain trio's 10.8% when built for).
The abilities-as-cards + Hex + richer economy shifted the whole curve, so the enemy walls were
re-anchored up across the batch to hold the campaign band (**full-run ~22% at N=1000**;
Gatewarden 90 / Hexweaver 208 / Devourer 216).**
#32 (the standing backlog holding file) was
**closed as a tracker row** on 2026-07-04 — it was never buildable; its deferred ideas live on inside
the file and each is promoted to its own numbered issue when picked up. What remains is not tracked
issues but standing *design* questions and human gates — see [Remaining open design questions](#remaining-open-design-questions).
**2026-07-04 playtest batch (#33–#37):** **#33** flipped
the injury default to `incapacitate` (a 4th "Shattered" scar takes the member out until healed;
winrate-neutral — Standard 32.1% / Story 96.4%) with the MemberCard / Infirmary / Resurrect-hint UI;
**#34** re-lined the sim policy for the five new abilities (Dark Bargain front-load, Crescendo
shaping, Berserker band-riding, taunt-less Provoke) and, on the authoritative N=300 sweep, judged the
0% floor a burst-DPS gap vs the trio-tuned Devourer (not a safe stick-driven re-tune — deferred to
human calibration); **#35** re-tuned the two out-of-band phase-B relics into the ≤+9pp band (Taper
partial −2 discount +8.8pp, Aegis WARD_MAX 2→1 +7.2pp, Chime threshold 13→10 +5.9pp; Pact priced as
a hard trap) with the battery promoted to `sim/relic-exp.ts`, full-run steady at 31.5%; **#36** a
`memberDefAt` resolver so every run-layer screen shows drafted names; **#37** the UI polish batch
(draft ability flavor, aria-pressed, "End Turn" at 0-yield, seed input attrs, favicon, Turn-N chip).
Post-demo highlights: **#25** hand-4/carryover measured and REVERTED (behind an inert flag);
**#26** player-first turn ordering (bosses re-anchored on HP to 155/184/208, full-run 32.1%);
**#27–#29** five new members via a data-driven roster — Warlock (Dark Bargain / Soul Tithe), Skald
(Crescendo), Berserker (rage bands / Rampage), Grave Augur (Grave Chill), Beast Warden (a Boar pet
that soaks whole hits); **#30** the full draft (three 1-of-2 picks + slot assignment + surfaced
weights + one-click classic trio, with a striker/damage/healable generator guarantee); **#31** the
56-composition sweep harness that nerfed the Warlock ceiling (7→5, 0 comps >85% at F8) and shipped
the Provoke "Taunt-lite" card. The party subsystem is sim-piloted (every ability found by identity,
not slot) and all trio sim pins stayed in band. Highlights (demo): all card
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

## Remaining open design questions

**#39–#43 are open in the numbered tracker** (2026-07-05 roster-campaign playtest — see that
section). Beyond those, what is still open is *design*, not implementation — decisions that want a
human, not more code:

- **Campaign re-baseline (new, blocks band judgments).** The old 25–35% Standard band was tuned for
  the fixed trio; under the campaign the honest number is draft-line-dependent (21.8% trap line /
  54.4% ranger / 66.2% warlock-banned — playtest 2026-07-05). Once #39 (Warlock) and #41 (act-1
  variance) land, re-pin `npm run sim` and decide what the band even means when the player's draft
  line moves the number by 40+pp. Until then every sim gate is a provisional pin, not a band check.

- **Human ship gates (the actual blockers).** Playtest **#2** (post-Devourer / full-run band — ready)
  and **#3** (final ship call) are maintainer-manual. Plus the #33 feel-check: one deliberately-spent
  (4-death → Incapacitated) member, to confirm the new default *feels* right. These gate shipping.
- **DR2 — "race or die" reads as "die on schedule."** On bosses the enrage now fires ~89% (Hexweaver)
  / ~98% (Devourer) of fights, so the countdown promises a race the HP no longer allows. Legibility
  call, **low urgency**: either reframe the boss "enrage" as an announced phase, or restore pre-enrage
  race headroom. Not a bug — the tuning is sound; the *promise* is stale.
- **DR3 — Brutal is a cliff, not a difficulty.** 0% full-run, Gatewarden alone ~0.3%. **By design**
  (dev-only, ungated) — but if Brutal ever ships visibly it needs the standing "tuned Brutal" cut,
  not the current placeholder multipliers.
- **Alt-comp member balance (now honestly framed by #38).** #38 gave the fixed policy real
  per-identity damage/survival lines (value-based save order, Soul-Tithe-aware Warlock healing,
  Provoke sink fix, Skald tempo) and re-measured: the floor barely moved (26/56 comps still 0% at
  N=300), which **confirms the floor is real balance, not a stick artifact** — the deep no-poison/
  no-bolt comps genuinely can't race the trio-tuned Devourer. The stick is no longer the confound, so
  whether (and how) to lift those members is a clean **human-calibration** question — a member/card
  tune, never a per-comp boss change (`ENEMY_ATTACK_BONUS` stays composition-agnostic per #31).
- **#32 backlog (closed as a row, ideas still standing).** Telegraph lists · multi-enemy fights /
  adds · meta-progression revisit · overheal-as-ammo card (**reconcile with Aegis Font first**) ·
  hidden-info expansion (normals only, never bosses) · the "Wanderer" mid-run swap node. Promote any
  to a numbered issue when scheduled.

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
| 32 | ✅ Closed | [Post-demo backlog](./issues/32-post-demo-backlog.md) | post-demo | 24 | §4 post-demo |
| 33 | ✅ Done | [Injuries past the cap: adopt a harder scar mode](./issues/33-injury-mode-harder-scars.md) | post-demo | DR1 | playtest 2026-07-04 |
| 34 | ✅ Done | [Composition re-baseline after the identity fix](./issues/34-comp-rebaseline-after-identity-fix.md) | post-demo | 31 | playtest 2026-07-04 |
| 35 | ✅ Done | [Relic power re-tune under player-first ordering](./issues/35-relic-retune-player-first.md) | post-demo | 26 | playtest 2026-07-04 |
| 36 | ✅ Done | [Drafted names in run-layer screens](./issues/36-drafted-names-in-run-screens.md) | post-demo | 27 | UI playtest 2026-07-04 |
| 37 | ✅ Done | [UI polish batch](./issues/37-ui-polish-batch-2026-07-04.md) | post-demo | — | UI playtest 2026-07-04 |
| 38 | ✅ Done | [Sim policy: per-identity damage lines](./issues/38-sim-policy-per-identity-damage-lines.md) | post-demo | 34 | #34 follow-up |
| 39 | ✅ Done | [Warlock: trap starter, permadeath magnet](./issues/39-warlock-roster-campaign-trap.md) | campaign | 44 | playtest 2026-07-05 |
| 40 | ✅ Done | [Permadeath returns the member to the pool](./issues/40-permadeath-pool-return.md) | campaign | — | playtest 2026-07-05 |
| 41 | ✅ Done | [Act-1 recruit luck decides the Gatewarden](./issues/41-act1-recruit-luck-variance.md) | campaign | — | playtest 2026-07-05 |
| 42 | ✅ Done | [Deploy-fewer / salary decision space is degenerate](./issues/42-deploy-fewer-salary-decision-space.md) | campaign | — | playtest 2026-07-05 |
| 43 | ✅ Done | [Draft UI surfaces DRAFT_RATING as a recommendation](./issues/43-draft-rating-legibility.md) | campaign | — | playtest 2026-07-05 |
| 44 | ✅ Done | [Party abilities become per-member cards](./issues/44-abilities-as-per-member-cards.md) | campaign | — | maintainer request 2026-07-05 |

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

## Playtest 2026-07-05 (roster-campaign round)

A full playtest of the 2026-07 roster campaign (roster/deploy model, pick-one drafts + Recruit
nodes, member salaries, permanent injuries with 4th-death removal, single mode). Method: the suite
(green) + `npm run sim` N=1000 + an instrumented campaign harness (9,000 runs across deploy-size,
per-starter, and warlock-ban lines, with permadeath/wipe/salary/roster telemetry) + direct
edge-case probes of `recordInjuries`/`availableMembers`. Findings filed as issues
[39](./issues/39-warlock-roster-campaign-trap.md)–[43](./issues/43-draft-rating-legibility.md);
headlines:

- **The stock baseline is the trap line.** `npm run sim` reads **21.8%** full-run — but the greedy
  policy always drafts the Warlock (rating 7). Forced starters read: **ranger 54.4% / mage 48.7% /
  warlock 21.8%**, and banning the Warlock from every draft/recruit lifts ranger-start to
  **66.2%** (+11.8pp). The 25–35% band is broken in *both* directions depending on draft line —
  re-baselining is blocked on #39/#41 landing (see the open design questions).
- **The Warlock is the finding (#39).** Solo Gatewarden 3.1% (vs 72–78% for ranger/mage); a
  net-negative recruit; and **the entire permadeath system in practice** — 300–386 Warlock
  permadeaths per 1000 runs vs ≤2 for the other seven members combined (Soul Tithe converts his
  identity into scars).
- **Permadeath has a reset button (#40).** `availableMembers()` doesn't track the dead, so a
  permakilled member reappears in the next offer at full stats, zero scars — a 3-scar hero is worth
  more dead than alive. Verified by probe. Roster wipes: **0 in 9,000 runs** (the wipe-loss path
  never fires); multi-death splicing and the driver's scar ordering are correct.
- **Fielding fewer members is never right (#42).** Deploy-2: 0.3% full-run; deploy-1: 0.0%;
  salary never gates anything (paid from winnings; the 0-gold waiver never fired). The advertised
  "field fewer, keep more gold" decision doesn't exist — the one real deploy decision found is
  benching 3-scar members (permadeaths 0.30 → 0.00 for ~2pp full-run), which the salary framing
  hides. Also flagged: shrine/mercenary/altar "blessings" permanently raise the member's wage.
- **Act-1 recruit luck decides the Gatewarden (#41).** F2 by roster size (ranger): solo 72.4% /
  duo 96.9% / trio 100%, with ~⅓–⅖ of runs arriving solo on a pure map roll. Options filed:
  guarantee an act-1 Recruit (Reliquary-style injection), a fixed post-F1 ally beat, or a solo
  Gatewarden tune. Acts 2/3 are healthy (F5/F8 vary <10pp across roster sizes 3–6).
- **The draft UI endorses the trap (#43).** Offers print `rated {DRAFT_RATING}` — a generator-side
  damage rating — so the measured-worst pick shows the best number (`rated 7`). Also: the start
  draft's "roll" is a fixed 3-class choice (`STARTER_MEMBERS` size == offer size).
- Verified-good in the same round: deploy validation can't wedge the run; empty-slot battle parties
  behave (absent members untargetable, solo `allDead` → loss); an emptied roster can still be
  rescued by a Recruit node before the deploy-step loss fires; drafted identity threads through
  `toBattleConfig`; the UI's win path records scars before `winFight` (matching the sim); all
  run-layer screens iterate the full roster (members past slot 3 reachable).

## Playtest 2026-07-04 (balance round)

**Closeout:** all five findings issues (#33–#37) landed. #33 shipped `incapacitate` as the default
injury mode + UI; #35 re-tuned the drifted relics into band (battery now `sim/relic-exp.ts`); #36/#37
fixed the drafted-name display and the UI polish batch; #34 re-lined the sim policy and judged the
comp floor a burst-DPS gap (member balance deferred to human calibration). The one remaining human
gate from the round is the maintainer feel-check on a deliberately-spent (4-death) member (#33).

A maintainer-requested playtest of the post-demo build, focused on the injury system. Everything
measured is recorded in issues [33](./issues/33-injury-mode-harder-scars.md) /
[34](./issues/34-comp-rebaseline-after-identity-fix.md) /
[35](./issues/35-relic-retune-player-first.md); the headline items:

- **BUG (fixed):** `Run.toBattleConfig()` dropped drafted identity — every drafted fight since #27
  ran with classic-trio abilities on drafted stats. Fixed + regression-tested; **#31's sweep
  findings are superseded** (correction note in the issue) and the **Warlock 7→5 nerf is
  reverted** (it was calibrated against the phantom).
- **Injury cap experiments (the round's headline question):** two harder modes are implemented and
  tested behind `INJURY_RULES.mode` ('escalate', 'incapacitate') with a committed harness
  (`sim/injury-exp.ts`). Result: the honest line is *identical* under all modes (32.1% everywhere);
  the degenerate never-heal line is already −13.8pp and past-cap "free" deaths are just 0.16/run.
  Adopting a harder mode is winrate-free — a legibility call. **Recommendation: `incapacitate`**
  (issue 33 has the flip + UI work).
- **Relic battery re-run** (twice-flagged stale): firstLightTaper drifted to **+10.8pp** (strongest
  relic measured) and pactOfSilence to **−23.5pp** standalone under player-first ordering → issue 35.
- Trio baseline holds (N=1000: F2 85.9 / F5 71.5 / F8 53.6 / full 32.1%); Story 96.6%; Brutal's
  DR3 cliff deepened (F2 0.3%) — still dev-only by design.

**UI round (Chrome DevTools, maintainer-authorized):** a drafted run was driven end to end — draft
→ fight → victory → fork → Training Hall → save/resume. Two issues filed:
[36](./issues/36-drafted-names-in-run-screens.md) — **every run-layer screen shows classic-trio
names for drafted parties** (Training Hall offered "Ranger" wearing the Mage's stats; the dev
panel's "Tank" heal button healed the Skald) — and
[37](./issues/37-ui-polish-batch-2026-07-04.md) — polish batch (draft cards leak raw ability ids
with no descriptions, CSS-only pick state, "Rest & End Turn (+0 MP)" label, unlabeled seed input,
favicon 404, no visible turn number). Verified-good in the same round: drafted identity in fights,
Grave Chill's preview==applied on the live attack lines, the Skald's live attack badge, the deck
viewer, save/resume position, and a console clean of errors except the favicon 404.

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
