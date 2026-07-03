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
import { FIGHT_COUNT, isActBoss, actOfFight } from '../src/constants';
import { playFight, resolveNode, chooseBranch } from './policy';

export interface FightOutcome {
  fightIndex: number;
  win: boolean;
  turns: number; // enemy turns elapsed when the fight ended
}
export interface RunOutcome {
  seed: number;
  status: RunStatus;
  fights: FightOutcome[];
}

// Deterministic per-fight seed derived from the run seed + fight index, so the
// whole run reproduces from a single seed.
function fightSeed(runSeed: number, fightIndex: number): number {
  return (Math.imul(runSeed, 0x9e3779b1) + fightIndex * 0x85ebca77) >>> 0;
}

// Play one full run end to end with the policy. Fully deterministic in `seed`.
export function runSingleRun(seed: number): RunOutcome {
  const run = new Run(seed);
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
        const win = game.status === 'win';
        fights.push({ fightIndex: fi, win, turns: game.turn });
        if (win) run.winFight();
        else run.loseFight();
        break;
      }
      case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
      case 'node': resolveNode(run); run.completeNode(); break;
      case 'start': run.beginRun(); break;
      default: run.status = 'lost'; break; // unreachable safety net
    }
  }
  return { seed, status: run.status, fights };
}

// ---- aggregation ----------------------------------------------------------

export interface Proportion { wins: number; n: number; rate: number; ci95: number; }
export interface SimReport {
  n: number;
  firstSeed: number;
  fullRun: Proportion;
  perFight: Proportion[]; // indexed by fight
  meanTurns: number[];    // mean enemy-turns per fight (won or lost)
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

export function runSim(n: number, firstSeed = 1): SimReport {
  let fullWins = 0;
  const fightWins = new Array(FIGHT_COUNT).fill(0);
  const fightAttempts = new Array(FIGHT_COUNT).fill(0);
  const fightTurnsTotal = new Array(FIGHT_COUNT).fill(0);
  for (let i = 0; i < n; i++) {
    const outcome = runSingleRun(firstSeed + i);
    if (outcome.status === 'won') fullWins++;
    for (const f of outcome.fights) {
      fightAttempts[f.fightIndex]++;
      fightTurnsTotal[f.fightIndex] += f.turns;
      if (f.win) fightWins[f.fightIndex]++;
    }
  }
  return {
    n, firstSeed,
    fullRun: proportion(fullWins, n),
    perFight: fightWins.map((w, i) => proportion(w, fightAttempts[i])),
    meanTurns: fightTurnsTotal.map((t, i) => (fightAttempts[i] ? t / fightAttempts[i] : 0)),
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
  return lines.join('\n');
}

// ---- CLI ------------------------------------------------------------------

// Executed only when run directly (npm run sim), never on import.
const invokedDirectly = process.argv[1] && /run-sim\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const n = Number(process.argv[2] ?? 1000);
  const firstSeed = Number(process.argv[3] ?? 1);
  console.log(formatReport(runSim(n, firstSeed)));
}
