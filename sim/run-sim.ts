// Sim harness — plays whole runs (shopping + fights) with the "good player"
// policy in policy.ts and reports per-fight and full-run winrates with 95%
// confidence intervals. This is the trustworthy way to judge balance; every
// downstream issue's winrate gate runs through it.
//
// Run it:  npm run sim            (default N = 1000 seeds from seed 1)
//          npm run sim -- 2000 1  (N=2000 seeds starting at seed 1)
//
// It only reads the pure engine + run layer, so it stays out of the Vite bundle.
//
// ---------------------------------------------------------------------------
// BASELINE
//
// Historical reference (memory/balance-pass-2026-06, the June good-AI pass):
//   per-fight ~100 / 100 / 83 / 67 / 60 %   full-run ~35 %   (N ~ 1500)
// That number came from a hand-tuned throwaway AI (sim_tmp.ts, since deleted).
//
// This harness's own reading with the reconstructed policy (policy.ts), N=1000:
//   after #01:            per-fight ~100 / 99.7 / 71.6 / 42.6 / 38.2 %  full-run ~11.6 %
//   after #03 (surcharge): per-fight ~100 / 99.8 / 67.1 / 37.0 / 37.1 %  full-run ~9.2 %
//   after #04 (turn-1 single + softer enraged sweep):
//                          per-fight ~100 / 99.8 / 70.7 / 38.4 / 45.0 %  full-run ~12.2 %
//   after #05 (decaying Rest + economy repricing):
//                          per-fight ~100 / 100 / 90.7 / 69.9 / 75.6 %   full-run ~47.9 %
//   after #09 (four named normals + encounter tables):
//                          per-fight ~100 / 100 / 90.1 / 71.5 / 72.0 %   full-run ~46.4 %
//                          (variety, not a spike — every fight within +-5pp of #06)
//   after #12 (Gatewarden as the Act-1 boss): Act-1 boss (F2) ~90% (>= 85% gate).
//     The Act 2/3 bosses are still placeholders, so full-run stays ~0% (deferred to #14).
//   after the issues-01-12 playtest fixes (Crushing Blow 20->12 + channel-aware
//     policy: tryBraceChannel and wind-up MP banking):
//                          per-fight ~100 / 100 / 88.9 / 99.4 / 98.3 / 16.7 / 89.7 / 21.5 / 0 %
//     F2 stays in the ~90% band, but the channel is now *answered* (tank survives
//     or Shield blocks) in ~53% of boss fights instead of killing a member in 82%
//     — the boss teaches reading, not sacrifice. Winrate parity hides that shift;
//     judge channel changes by the death/answered split, not F2 alone.
//
//   after #10 (3-act / 9-fight structure):  full-run ~0 %  (per-fight below)
//     F0 100 | F1 100 | F2 A1boss 78 | F3 99 | F4 99 | F5 A2boss 17 | F6 91 | F7 21 | F8 A3boss 0
//     The Act 2/3 bosses are placeholders (scaled BOSS_ENEMY_DEF, 200/280 HP) with no
//     boss-specific counterplay yet, so they wall the sim and full-run is 0% — this is
//     expected and the full-run band is deferred to #14. Clean-sample normals (F0/F1/
//     F3/F4) clear >= 95%; late-normal (F6/F7) samples are tiny and biased by the
//     placeholder bosses.
//   after #13 (Hexweaver as the Act-2 boss, 135 HP):  full-run still ~0 % (A3 placeholder)
//     F0 100 | F1 100 | F2 A1boss 88.9 | F3 99.6 | F4 98.1 | F5 A2boss 70.7 | F6 91.5 | F7 24.6 | F8 A3boss 0
//     Hexweaver lands at 70.7% ±3.0 (65-75% gate). Its heal-denial makes it a wall
//     far below the placeholder's HP — 135 is the sweet spot (150->48%, 125->84%).
//     Cleanse joined the pool; the policy buys/plays it (tryCleanse). A turtle policy
//     (funnel + heal-tank only, never Cleanse) wins 0% where the adaptive policy wins
//     ~69% — the Piercing Bolt bypasses the taunt funnel by design (see sim.test.ts).
//   after #14 (Devourer as the Act-3 boss, 165 HP; full-run tuned):  full-run ~32 %
//     F0 100 | F1 100 | F2 A1boss 88.9 | F3 99.6 | F4 98.1 | F5 A2boss 70.7 | F6 95.3 | F7 95.9 | F8 A3boss 57.4
//     All three bosses hit their gates: ~85 / ~70 / ~55%. Two levers landed the
//     25-35% full-run band: (a) the Act-3 normals dropped to 150 HP / attackBonus 1
//     — F7 was a 190-HP/+2 enrage cliff (~25%), now ~96%; (b) the Devourer at 165 HP
//     (phase-2 Maw + Consume) reads ~57%. Devourer HP is a steep lever: 160->60%,
//     170->49%. Full-run 32.2% ±2.9 at N=1000.
//   after #15 (card set phase A: Overgrowth / Cultivate / Bloom / Font of Mana /
//     Inspiration join CARD_POOL):  full-run 32.3 % ±2.9 at N=1000 — unmoved.
//     F0 100 | F1 100 | F2 A1boss 89.3 | F3 99.3 | F4 98.2 | F5 A2boss 71.2 | F6 94.7 | F7 96.3 | F8 A3boss 57.2
//     Every offer roll shifts (pool 8 -> 13 ids) but the bands hold. The policy
//     buys/plays Font of Mana via tryRefresh; the other four sit below its buy
//     threshold until a tactic exists for them (Regen-line play is #16's problem).
//   after #16 (card set phase B: Lifebloom / Surge / Battle Hymn / Barrier /
//     Blood Tithe / Martyr's Gift / Grim Harvest):  full-run 34.1 % ±2.9 at N=1000.
//     F0 100 | F1 100 | F2 A1boss 89.0 | F3 99.2 | F4 98.0 | F5 A2boss 73.9 | F6 95.3 | F7 96.7 | F8 A3boss 57.9
//     Pool 13 -> 20 ids; bands hold (top edge of 25-35%). None of the seven has a
//     fight tactic yet, so all sit below the policy's buy threshold — a
//     Regen/Blood-aware policy line is future work if their winrates matter later.
//   after #17 (card set phase C: Phalanx / Brace + the Defense->Brace->Shield
//     pipeline, per-member Defense strength):  full-run 33.8 % ±2.9 at N=1000.
//     F0 100 | F1 100 | F2 A1boss 88.8 | F3 99.4 | F4 98.5 | F5 A2boss 74.3 | F6 95.0 | F7 97.1 | F8 A3boss 56.7
//     Pool 20 -> 22 ids; bands hold. The preview==applied invariant now runs the
//     whole ward pipeline (property-tested in engine.test.ts).
//   after #18 (Resurrect 6->4 MP + revive-behind-a-Shield; poison MEASURED and
//     left at 5x5):  sim unchanged from #17 (the policy stick has no resurrect
//     tactic, so the N=200 pins pass bit-identical; full-run stays 33.8%).
//   after #19 (events 3 -> 8: Cursed Chest / Mercenary / Duplicator / Purge Well /
//     Blood Altar):  full-run 32.6 % ±2.9 at N=1000.
//     F0 100 | F1 100 | F2 A1boss 88.9 | F3 99.3 | F4 98.2 | F5 A2boss 73.9 | F6 95.0 | F7 96.9 | F8 A3boss 55.3
//     The policy walks away from all five new events (they are player decisions,
//     not free value), so the shift is pure event-roll RNG; bands hold.
//   after #20 (act 2/3 named rosters — boss tech at small scale):
//     full-run 31.2 % ±2.9 at N=1000.
//     F0 100 | F1 100 | F2 A1boss 88.9 | F3 99.6 | F4 97.7 | F5 A2boss 73.6 | F6 94.2 | F7 94.2 | F8 A3boss 55.2
//     Tuning lesson (two rounds of retune baked in): a rotation normal's budget
//     must count the +1 attackBonus PER TARGET (multi-target steps run hot), and
//     pierce-at-lowest / Gorge are worth far more than their raw numbers — one
//     pierce per cycle and a light cycle around a Gorge is what fits the ~5.5-6
//     party-wide dmg/turn envelope. First draft (2 pierces, aoe-heavy cycles)
//     read F6 75% / F7 82% / full-run 20% — far out of the ±5pp gate.
//   after #21 (relics phase A: 10 relics + spoils after fights 3 & 6 + the
//     Reliquary twice per run; relic-aware policy):  full-run 33.9 % ±2.9 at N=1000.
//     F0 100 | F1 100 | F2 A1boss 88.8 | F3 99.8 | F4 98.5 | F5 A2boss 70.6 | F6 97.2 | F7 97.5 | F8 A3boss 58.0
//     Relics are real player power: as first specced they read full-run 65.4%
//     (+34pp!). Landed back in band via (a) relic tuning — Tithe Candle capped
//     at 4 MP/fight (the flaw-#7 "every MP engine is bounded" law), Vanguard's
//     Banner +2 -> +1, Prayer Beads +3 -> +2 — and (b) the act-2/3 bosses
//     absorbing the rest: Hexweaver 135 -> 142, Devourer 165 -> 190. The
//     Gatewarden is untouched (spoils come after it, so F2 is relic-free).
//   after #22 (relics phase B: 4 rule-changers + 3 curses; the designated cut
//     line SHIPPED instead of cut):  full-run 30.9 % ±2.9 at N=1000.
//     F0 100 | F1 100 | F2 A1boss 88.8 | F3 99.7 | F4 98.6 | F5 A2boss 70.4 | F6 97.4 | F7 97.3 | F8 A3boss 53.0
//     Per-relic gates (N=600, injected at the fight-2 boundary — relics cannot
//     exist earlier in a real run; deltas vs that battery's 39.3% baseline):
//       aegisFont +5.9 | firstLightTaper +2.0 | duskChime +9.2 | martyrsIcon +4.4
//       pact alone -6.0, but +6.8 WITHIN its passive-MP build (vs a passive-only
//       control at 74.0%) | crackedHourglass -5.6 | rustyCrown +0.4
//     What it took to land: Dusk Chime and Martyr's Icon are once-per-RUN
//     (spent-relic plumbing through BattleConfig) — once-per-fight versions
//     read +13/+19pp and solved the Hexweaver outright; Chime threshold 6->13;
//     Ward cap 4->2; Taper's ceiling 2->3 with the hand penalty made
//     conditional on the discount firing (the unconditional -1 hand was a
//     -18pp trap); Hourglass enrage 8->9; Rusty Crown exempts bosses and pays
//     +15g (boss-inclusive at +40g was a -17.5pp trap; boss-exempt at +40g a
//     +10pp freebie). The pool growth lifted the baseline out of band again,
//     absorbed by Hexweaver 142->146 and Devourer 190->198. The N=200 pinned
//     sample reads 35.5% (seeds 1-200 run hot); the in-test band check now
//     carries the sample CI, with N=1000 as the authoritative gate.
//   after #31 (per-composition pass + Provoke card):  full-run 32.1% at N=1000
//     (F2 85.9 / F5 71.5 / F8 53.6 — all in-band). Provoke ("Taunt-lite") joined
//     CARD_POOL (23->24); the trio doesn't buy it, so this is pure roll drift and
//     the bands held (31.7 -> 32.1%). The composition SWEEP (runCompositionSweep,
//     `npm run sim -- sweep <N>`) drove the one real balance action: at Warlock 7
//     every Warlock comp cleared 86-93% (10 comps >85% at F8). Warlock 7->5 caps
//     it — 0 comps >85% at F8, full-run range 0-75%. The ceiling lever was the
//     MEMBER, not the (comp-agnostic) boss HP, so the trio baseline is untouched.
//     The low-DPS/no-tank floor is a fixed-stick limitation (a per-comp policy is
//     future work); the generator's striker requirement + Provoke are the remedies.
//   after the 2026-07-04 playtest (identity fix + Warlock revert + injury modes):
//     full-run 32.1% at N=1000 (F2 85.9 / F5 71.5 / F8 53.6 — in-band); Story 96.6%.
//     toBattleConfig had been DROPPING drafted identity since #27 — every drafted
//     fight ran trio abilities on drafted stats, so #31's sweep was measuring a
//     phantom. Fix + regression test landed; the Warlock 7->5 nerf is REVERTED
//     (real-ability warlock comps read 2.5-3% even at 7 — no ceiling; see issue 34
//     for the re-baseline). Injury modes ('escalate'/'incapacitate') landed behind
//     INJURY_RULES with sim/injury-exp.ts: all modes identical on the honest line
//     (the trio pins are mode-independent); see issue 33. The #22 per-relic battery
//     was re-run (stale after two re-anchors): Taper +10.8pp / Font +10.0 / Icon
//     +8.2 / Chime +4.8 / Pact -23.5 / Hourglass -5.2 / Crown -1.7 vs a 31.2%
//     baseline — re-tune tracked in issue 35.
//   after #33 (injury default -> 'incapacitate'):  winrate-neutral (Standard 32.1%,
//     Story 96.4%, N=200 pin bit-identical) — the honest policy never reaches a 4th
//     death; a legibility change, not a balance one.
//   after #35 (relic re-tune, battery promoted to sim/relic-exp.ts):  the two
//     out-of-band phase-B relics were nerfed inside the <=+9pp band, re-measured at
//     N=1000 (baseline ~31.5%): Taper +8.8pp (full-zero -> -2 PARTIAL discount;
//     TAPER_DISCOUNT=2), Font +7.2 (WARD_MAX 2->1), Chime +5.9 (DUSK_CHIME_MIN 13->10,
//     it had drifted below a slot's cost), Icon +7.8 (untouched). Pact stays a hard
//     trap: -23.9pp standalone, but the passive-MP lever swings ~±23pp PER POINT
//     (+2 -> +23.2pp, absurd for a curse) so no in-band buff exists; the sim values
//     curses at 0 and never takes one. The full-run drifts 32.1 -> 31.5% (the trio
//     naturally picks Taper/Font), dead-center in the 25-35% band. Battery: Hourglass
//     -5.6 / Crown -1.4 (pre-existing traps, unchanged).
//   after #34 (composition re-baseline, real policy lines):  the five new abilities
//     got real LINES not gates (Dark Bargain front-loads capped at 2 casts; Crescendo
//     turn-shaping; Berserker band-riding — tryHeal won't heal him out of a band;
//     Provoke bought+played on taunt-less comps). Authoritative SWEEP at N=300: trio
//     29.3% is the reference ceiling (F8 50.9), next tier 9.3/9.0%, full-run range
//     0-29.3%, 0 comps >85% anywhere, 27/56 floor at 0%. JUDGMENT: every zero-comp
//     loses the F8 Devourer RACE (F8=0 for all) and lacks BOTH poison (ranger) and
//     bolt (mage) — a burst-DPS gap vs a trio-tuned boss, not a survival or mitigation
//     gap. ENEMY_ATTACK_BONUS is comp-agnostic (#31) so the boss can't move; buffing
//     members off a stick that under-pilots them is miscalibration -> deferred to
//     human calibration (issue 34). The trio's numbers were never touched (its
//     identity IS the fallback); the taunt-less Provoke line lifted 15/35 comps >0%.
//   after #38 (per-identity damage lines):  tested whether the #34 floor was a stick
//     artifact by FIXING the measurement — value-based saveOrder (was trio-slot
//     hardcoded), Soul-Tithe folded into the Warlock's incoming, Provoke sink excludes
//     the tithe-drained Warlock, Skald tempo line (play a cheap card / Battle Hymn over
//     a Rest that banks nothing). N=300: trio 29.3% byte-identical; comps at 0% 27->26;
//     taunt-less >0 15->16; non-trio F8 ceiling 50.9->60.0. VERDICT: the floor is REAL
//     balance, NOT a stick artifact — with correct lines the deep no-poison/no-bolt comps
//     still can't race the Devourer. The stick is no longer the confound; member balance
//     is cleanly deferred to human calibration. No member/card/boss change.
//   after #23 (difficulty presets + local stats):  Standard unchanged (it IS
//     the tuned curve — the preset is the identity, and the N=200 pins pass
//     bit-identical). Story (HP x0.8, attack -1 floor 0, enrage +2, +25g/win)
//     reads full-run 96.1% ±1.2 at N=1000 (gate: >=60%) — a cruise for the
//     reference policy, which is the point. Brutal is untuned, dev-flag-only
//     (?dev), and carries no gate by design.
//   after #24 (hardening & UX; encounters derived from per-fight sub-seeds for
//     peekable fork previews):  full-run 32.7 % ±2.9 at N=1000; Story 96.4%.
//     F0 100 | F1 100 | F2 A1boss 89.5 | F3 99.8 | F4 98.3 | F5 A2boss 70.4 | F6 97.1 | F7 97.7 | F8 A3boss 55.8
//     The sub-seed change re-rolled every fight's foe (hence the re-pin); the
//     bands hold. SHIP GATE: full suite green, Standard+Story sweeps in-band,
//     clean npm run build. Human playtest #3 (maintainer, manual) is the final
//     call — it cannot be automated from here.
//     The Q5 poison measurement (all N=1000, on the #17 baseline):
//       baseline (poison 5x5):        F2 88.8 | F5 74.3 | F8 56.7 | full-run 33.8%
//       policy never poisons:         F2 70.2 | F5 40.5 | F8 71.4 | full-run 14.5%
//       poison 4x4:                   F2 82.9 | F5 61.3 | F8 61.6 | full-run 27.1%
//       poison 4x4 + Bolt execute 1.5x below 25% HP:
//                                     F2 83.0 | F5 61.2 | F8 63.2 | full-run 27.8%
//     Verdict: the Devourer's Consume already tamed poison — it is a genuine
//     decision now (feeding Consume costs ~15pp; a poison-skipping line wins
//     ~71% there), while 5x5 remains load-bearing for the Gatewarden/Hexweaver
//     tuning. A 4x4 nerf breaks the >=85% and 65-75% gates and would force a
//     three-boss retune, which #18 does not own. Poison stays 5x5; the policy
//     stick stays poison-blind vs the Devourer on purpose (fixed measuring
//     stick) — a Consume-aware policy line is future work alongside any retune.
//   after DR1 (injuries/scars: a death now leaves a persistent, escalating stat
//     scar, cleared for gold at an Infirmary node / free at a Field Hospital event
//     / by the Mending Totem relic):  full-run 30.8 % ±2.9 at N=1000; Story 97.2%.
//     F0 100 | F1 100 | F2 A1boss 88.3 | F3 99.7 | F4 98.9 | F5 A2boss 70.6 | F6 96.9 | F7 97.1 | F8 A3boss 53.3
//     Deaths per WON fight (the DR1 sacrifice signal): F2 0.92 | F5 1.65 | F8 0.97;
//     ~1.0 residual scar/run, ~38g/run spent healing. The system reproduces the
//     DR1 finding exactly (the fixed policy sacrifices ~1 member/boss), and as
//     first added it CRATERED the run to 12.4% (scars compound across fights: F2
//     unchanged since act 1 has no prior scars, but F5 70->61 and F8 56->33). What
//     landed it back in band: (a) scar magnitudes softened to -2 HP / -1 dmg / -1
//     ability (cumulative-by-tier); (b) the Infirmary cheapened to 20g at weight 24
//     and the Mending Totem valued as a top defensive pick, so a wounded party pays
//     its scars down instead of hoarding; (c) a tryResurrect tactic — the old stick
//     never revived, but a dead DPS is lost output and the scar is already paid, so
//     reviving to win is strictly good play the stick was missing (it alone lifted
//     16.8->23.1% and is a legit measuring-stick improvement, not a paper-over);
//     (d) the smarter stick re-anchored the act-2/3 boss HP — Hexweaver 146->158
//     (tryResurrect had pushed it to 81%, above its 65-75% band) and Devourer
//     198->182 (the scar handicap dropped it to ~35%; 172 read 65%, 182 reads 53%).
//     The Gatewarden is untouched (act 1 is scar-free, so F2 holds at 88%). NOTE
//     for the maintainer: the boss-HP re-anchor shifts the #22 per-relic gate
//     baseline (those were measured at Devourer 198 / Hexweaver 146); re-run that
//     battery before leaning on its deltas. The injury system is 100%-avoidable
//     (a member that never dies never scars), self-capping at 3, and recoverable —
//     the intended shape: it punishes the sacrifice line without ending the run.
//   after #26 (full turn-1 phase reorder — PLAYER-FIRST ordering):  full-run 31.7 %
//     ±2.9 at N=1000; Story 95.5%.
//     F0 100 | F1 100 | F2 A1boss 87.2 | F3 99.9 | F4 99.6 | F5 A2boss 70.2 | F6 99.2 | F7 99.4 | F8 A3boss 52.7
//     The party now acts BEFORE the enemy's opening blow (start() no longer resolves
//     an enemy phase on mount; the turn counter moved into _runEnemyPhase, which owns
//     the advance and still ticks across channel/Chime wind-ups so enrage/rotation
//     timing is bit-identical). This retired the #04 turn-1-single patch. The free
//     planning turn is a systemic +~30pp buff (pre-tune it read full-run 66.5%, bosses
//     99.1 / 90.8 / 75.3%), re-anchored ENTIRELY on boss HP — the one lever that keeps
//     ENEMY_ATTACK_BONUS composition-agnostic for #31: Gatewarden 130->155, Hexweaver
//     158->184, Devourer 182->208. All three land dead-center in their gates and the
//     act-3 normals also eased (F6/F7 ~99%). NOTE for the maintainer: this HP re-anchor
//     again shifts the #22 per-relic gate baseline (last measured at Devourer 198 /
//     Hexweaver 146) — re-run that battery before leaning on its deltas.
// (#03 priced the Taunt retarget. #04 forced the turn-1 blow to single. #05's
//  decaying Rest (+2 MP even after a card) fixes the documented MP bottleneck and
//  the hidden-magnitude reveal lets good play react precisely — the run is now
//  winnable with good play. Later content (harder bosses #12-14, the 3-act
//  structure #10, difficulty presets #23) re-hardens toward the 25-35% target.)
// The reconstructed policy is a heuristic "good player", intentionally a *living*
// stick: it reads below the old hand-tuned line but is deterministic and is the
// fixed measuring stick every downstream gate compares against. Later issues
// strengthen it (per-boss reactions #12-#14) and re-anchor the baseline after the
// P1 balance repair (#06). Judge changes by the delta this harness reports, not
// against the historical number.
// ---------------------------------------------------------------------------

import { Game } from '../src/engine';
import { Run } from '../src/run';
import type { RunStatus } from '../src/run';
import { FIGHT_COUNT, isActBoss, actOfFight, DRAFT_POOL, MEMBER_POOL, partyFromMembers } from '../src/constants';
import type { MemberId } from '../src/constants';
import { playFight, resolveNode, chooseBranch, chooseSpoil, advanceBranch } from './policy';

export interface FightOutcome {
  fightIndex: number;
  win: boolean;
  turns: number;   // enemy turns elapsed when the fight ended
  deaths: number;  // members that died this fight (DR1) — scars accrue on a win
}
export interface RunOutcome {
  seed: number;
  status: RunStatus;
  fights: FightOutcome[];
  injuriesAtEnd: number;  // total unhealed scars across the roster when the run ended (DR1)
}

// Deterministic per-fight seed derived from the run seed + fight index, so the
// whole run reproduces from a single seed.
function fightSeed(runSeed: number, fightIndex: number): number {
  return (Math.imul(runSeed, 0x9e3779b1) + fightIndex * 0x85ebca77) >>> 0;
}

// Play one full run end to end with the policy. Fully deterministic in `seed`.
// `setup` (optional) mutates the fresh Run before it begins — the balance-gate
// hook for forcing a relic/curse into every run (#22's per-relic gates).
export function runSingleRun(seed: number, setup?: (run: Run) => void): RunOutcome {
  const run = new Run(seed);
  setup?.(run);
  run.beginRun();
  const fights: FightOutcome[] = [];
  let guard = 0;
  while (run.status === 'playing' && guard < 1000) {
    guard++;
    switch (run.location.kind) {
      case 'fight': {
        const fi = run.location.fightIndex;
        const game = new Game(fightSeed(seed, fi), run.toBattleConfig());
        playFight(game);
        run.markRelicsSpent(game.spentRelicIds()); // once-per-RUN relics (#22)
        const win = game.status === 'win';
        const died = game.diedThisFightSlots();
        fights.push({ fightIndex: fi, win, turns: game.turn, deaths: died.length });
        if (win) {
          run.recordInjuries(died); // scars accrue before winFight (mirrors the driver)
          run.winFight();
        } else run.loseFight();
        break;
      }
      case 'spoils': run.pickSpoil(chooseSpoil(run)); break;
      case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
      case 'branch': advanceBranch(run); break;
      case 'node': {
        resolveNode(run);
        run.completeNode();
        break;
      }
      case 'start': run.beginRun(); break;
      // Pre-fight deploy (2026-07): field the default seating (the first three roster
      // members). A smarter deploy policy — bench a fragile/expensive member — is C7.
      case 'deploy': run.confirmDeployment(run.deployment); break;
      // Post-boss member draft (2026-07): take the first offered member. (A smarter
      // roster/deploy policy — pick the strongest, bench to save salary — is C7.)
      case 'draft': {
        const c = run.nodeContent;
        if (c?.type === 'draft' && c.options.length) run.chooseDraftMember(c.options[0]);
        else run.status = 'lost';
        break;
      }
      default: run.status = 'lost'; break; // unreachable safety net
    }
  }
  const injuriesAtEnd = run.roster.reduce((s, p) => s + p.injuries, 0);
  return { seed, status: run.status, fights, injuriesAtEnd };
}

// ---- aggregation ----------------------------------------------------------

export interface Proportion { wins: number; n: number; rate: number; ci95: number; }
export interface SimReport {
  n: number;
  firstSeed: number;
  fullRun: Proportion;
  perFight: Proportion[]; // indexed by fight
  meanTurns: number[];    // mean enemy-turns per fight (won or lost)
  // DR1 injury telemetry.
  deathsPerWin: number[]; // mean member deaths per WON fight, indexed by fight
  meanInjuries: number;   // mean unhealed scars per run at run end
}

// 95% confidence half-width for a binomial proportion (normal approximation).
function ci95(rate: number, n: number): number {
  if (n === 0) return 0;
  return 1.96 * Math.sqrt((rate * (1 - rate)) / n);
}

function proportion(wins: number, n: number): Proportion {
  const rate = n === 0 ? 0 : wins / n;
  return { wins, n, rate, ci95: ci95(rate, n) };
}

export function runSim(n: number, firstSeed = 1, setup?: (run: Run) => void): SimReport {
  let fullWins = 0;
  const fightWins = new Array(FIGHT_COUNT).fill(0);
  const fightAttempts = new Array(FIGHT_COUNT).fill(0);
  const fightTurnsTotal = new Array(FIGHT_COUNT).fill(0);
  const fightDeathsOnWin = new Array(FIGHT_COUNT).fill(0); // DR1: deaths summed over WON fights
  let injuriesTotal = 0;
  for (let i = 0; i < n; i++) {
    const outcome = runSingleRun(firstSeed + i, setup);
    if (outcome.status === 'won') fullWins++;
    injuriesTotal += outcome.injuriesAtEnd;
    for (const f of outcome.fights) {
      fightAttempts[f.fightIndex]++;
      fightTurnsTotal[f.fightIndex] += f.turns;
      if (f.win) { fightWins[f.fightIndex]++; fightDeathsOnWin[f.fightIndex] += f.deaths; }
    }
  }
  return {
    n, firstSeed,
    fullRun: proportion(fullWins, n),
    perFight: fightWins.map((w, i) => proportion(w, fightAttempts[i])),
    meanTurns: fightTurnsTotal.map((t, i) => (fightAttempts[i] ? t / fightAttempts[i] : 0)),
    deathsPerWin: fightDeathsOnWin.map((d, i) => (fightWins[i] ? d / fightWins[i] : 0)),
    meanInjuries: injuriesTotal / n,
  };
}

// ---- reporting ------------------------------------------------------------

const pct = (x: number): string => (x * 100).toFixed(1);

export function formatReport(r: SimReport): string {
  const lines: string[] = [];
  lines.push(`Sim: N=${r.n} seeds (from ${r.firstSeed})`);
  lines.push('');
  lines.push('Per-fight winrate (conditional on reaching the fight):');
  r.perFight.forEach((p, i) => {
    const label = isActBoss(i) ? `F${i} A${actOfFight(i) + 1}boss` : `F${i}`;
    lines.push(
      `  ${label.padEnd(9)} ${pct(p.rate).padStart(5)}% ±${pct(p.ci95)}  ` +
      `(${p.wins}/${p.n}, mean ${r.meanTurns[i].toFixed(1)} turns)`,
    );
  });
  lines.push('');
  lines.push(`Full-run winrate: ${pct(r.fullRun.rate)}% ±${pct(r.fullRun.ci95)} (${r.fullRun.wins}/${r.fullRun.n})`);
  // DR1 injury telemetry: deaths per won fight (the sacrifice signal DR1 named),
  // plus how many scars a run carries to the end and what it paid to heal.
  lines.push('');
  lines.push('DR1 — deaths per won fight:');
  lines.push('  ' + r.deathsPerWin.map((d, i) => `F${i} ${d.toFixed(2)}`).join('  '));
  lines.push(`Mean unhealed scars at run end: ${r.meanInjuries.toFixed(2)}`);
  return lines.join('\n');
}

// ---- composition sweep (#31) ----------------------------------------------
// The draft yields 8-choose-3 = 56 compositions. The sweep runs each through the
// harness with the classic-trio's SAME per-fight curve (ENEMY_ATTACK_BONUS stays
// composition-agnostic — no per-comp boss tuning), so the boss-HP bands must
// absorb the whole power range on their own.

// All 56 compositions (order-independent member triples) from the draft pool.
export function allCompositions(): MemberId[][] {
  const p = DRAFT_POOL;
  const out: MemberId[][] = [];
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++)
      for (let k = j + 1; k < p.length; k++) out.push([p[i], p[j], p[k]]);
  return out;
}

// Seat a composition sensibly for the sweep: the tankiest member takes center
// (slot 1, the most-targeted slot), the other two flank. A fixed, comp-agnostic
// heuristic so the sweep measures the comp, not a placement policy.
export function seatComposition(ids: MemberId[]): MemberId[] {
  const byHp = [...ids].sort((a, b) => MEMBER_POOL[b].maxHP - MEMBER_POOL[a].maxHP);
  return [byHp[1], byHp[0], byHp[2]];
}

export interface CompReport {
  comp: MemberId[];
  hasTaunt: boolean;
  full: Proportion;
  bosses: Proportion[]; // [F2, F5, F8]
}

// Run the whole 56-comp sweep at n runs each; returns per-comp full-run + boss
// winrates. Deterministic in firstSeed. Heavy — call with a modest n.
export function runCompositionSweep(n: number, firstSeed = 1): CompReport[] {
  return allCompositions().map((comp) => {
    const seated = seatComposition(comp);
    const r = runSim(n, firstSeed, (run) => { run.party = partyFromMembers(seated); });
    return {
      comp,
      hasTaunt: comp.includes('tank'),
      full: r.fullRun,
      bosses: [r.perFight[2], r.perFight[5], r.perFight[8]],
    };
  });
}

// ---- CLI ------------------------------------------------------------------

// Executed only when run directly (npm run sim), never on import.
const invokedDirectly = process.argv[1] && /run-sim\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const mode = process.argv[2];
  if (mode === 'sweep') {
    const n = Number(process.argv[3] ?? 100);
    const reps = runCompositionSweep(n, Number(process.argv[4] ?? 1));
    const pf = (p: Proportion) => `${pct(p.rate).padStart(5)}%`;
    reps.sort((a, b) => b.full.rate - a.full.rate);
    for (const r of reps) {
      console.log(`${r.comp.join('/').padEnd(38)} full ${pf(r.full)}  F2 ${pf(r.bosses[0])} F5 ${pf(r.bosses[1])} F8 ${pf(r.bosses[2])}${r.hasTaunt ? '' : '  [taunt-less]'}`);
    }
    const tauntless = reps.filter((r) => !r.hasTaunt);
    const f8 = reps.map((r) => r.bosses[2].rate);
    console.log(`\nComps: ${reps.length}  ·  full-run range ${pct(Math.min(...reps.map((r) => r.full.rate)))}–${pct(Math.max(...reps.map((r) => r.full.rate)))}%`);
    console.log(`F8 (final boss) range ${pct(Math.min(...f8))}–${pct(Math.max(...f8))}%  ·  ceiling comps >85% at F8: ${f8.filter((x) => x > 0.85).length}`);
    console.log(`Taunt-less comps: ${tauntless.length}  ·  min full-run ${pct(Math.min(...tauntless.map((r) => r.full.rate)))}%  ·  min F8 ${pct(Math.min(...tauntless.map((r) => r.bosses[2].rate)))}%`);
  } else {
    const n = Number(process.argv[2] ?? 1000);
    const firstSeed = Number(process.argv[3] ?? 1);
    console.log(formatReport(runSim(n, firstSeed)));
  }
}
