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
import { FIGHT_COUNT } from '../src/constants';
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
    const label = i === FIGHT_COUNT - 1 ? `F${i} (boss)` : `F${i}`;
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
