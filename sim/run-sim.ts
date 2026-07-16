// Sim harness — plays whole runs (shopping + fights) with the "good player"
// policy in policy.ts and reports per-fight and full-run winrates with 95%
// confidence intervals. This is the trustworthy way to judge balance; every
// downstream issue's winrate gate runs through it.
//
// Run it:  npm run sim            (default N = 1000 seeds from seed 1)
//          npm run sim -- 2000 1  (N=2000 seeds starting at seed 1)
//
// It only reads the pure engine + run layer, so it stays out of the Vite bundle.
// The baseline history — and how the "living measuring stick" policy moved through
// the P1 repair, the 3-act restructure, and the roster campaign — lives in
// sim/README.md. Judge changes by the DELTA this harness reports, not against any
// historical number.

import { Game } from '../src/engine';
import { Run } from '../src/run';
import type { RunStatus } from '../src/run';
import { FIGHT_COUNT, isActBoss, actOfFight } from '../src/constants';
import type { MemberId } from '../src/constants';
import { playFight, resolveNode, chooseBranch, chooseSpoil, chooseCardReward, chooseHealerBoon, advanceBranch, draftPick, deployBest, newMpTelemetry } from './policy';
import type { FightMpTelemetry } from './policy';
import { STICK, type SkillProfile } from './profile';
import { fightSeed, pct, runIfMain } from './util';

// Options that steer a whole run for the balance-tier / party-size matrix. All default to
// today's behavior (STICK profile, field 3, no forced members), so `runSim(n)` with no
// opts reproduces the pinned measuring stick byte-for-byte.
export interface RunOptions {
  profile?: SkillProfile;         // skill tier (default STICK)
  maxDeploy?: number;             // deployment cap 1/2/3 (default 3)
  forceStarter?: MemberId;        // pin the opening draft pick
  forcedDeployMember?: MemberId;  // pin this member to the field every deploy
}

export interface FightOutcome {
  fightIndex: number;
  win: boolean;
  turns: number;   // enemy turns elapsed when the fight ended
  deaths: number;  // members that died this fight (DR1) — scars accrue on a win
  mp: FightMpTelemetry; // #90: MP-economy telemetry for the "runs dry" pillar
}
export interface RunOutcome {
  seed: number;
  status: RunStatus;
  fights: FightOutcome[];
  injuriesAtEnd: number;  // total unhealed scars across the roster when the run ended (DR1)
}

// Play one full run end to end with the policy. Fully deterministic in `seed`.
// `setup` (optional) mutates the fresh Run before it begins — the balance-gate
// hook for forcing a relic/curse into every run (#22's per-relic gates).
// Play one full run of the roster campaign: draft a solo starter, build the roster
// via Recruit nodes (guaranteed after fight 1 and each boss, #56), deploy the best three each fight.
export function runSingleRun(seed: number, setup?: (run: Run) => void, opts: RunOptions = {}): RunOutcome {
  const profile = opts.profile ?? STICK;
  const deployOpts = { maxDeploy: opts.maxDeploy, forcedMember: opts.forcedDeployMember };
  const run = new Run(seed);
  setup?.(run);
  run.beginDraft();
  const fights: FightOutcome[] = [];
  let guard = 0;
  while (run.status === 'playing' && guard < 1000) {
    guard++;
    switch (run.location.kind) {
      case 'fight': {
        const fi = run.location.fightIndex;
        const game = new Game(fightSeed(seed, fi), run.toBattleConfig());
        const mp = newMpTelemetry();
        playFight(game, 40, profile, mp);
        run.markRelicsSpent(game.spentRelicIds()); // once-per-RUN relics (#22)
        const win = game.status === 'win';
        const died = game.diedThisFightSlots();
        fights.push({ fightIndex: fi, win, turns: game.turn, deaths: died.length, mp });
        if (win) {
          run.recordInjuries(died); // scars accrue before winFight (mirrors the driver)
          run.winFight(game.memberHPBySlot()); // carry ending HP back onto the roster (#58)
        } else run.loseFight();
        break;
      }
      case 'cardReward': { const ci = chooseCardReward(run, profile); if (ci >= 0) run.pickCardReward(ci); else run.skipCardReward(); break; } // #57
      case 'spoils': run.pickSpoil(chooseSpoil(run, profile)); break;
      case 'healerBoon': run.pickHealerBoon(chooseHealerBoon(run)); break; // #83
      case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
      case 'branch': advanceBranch(run); break;
      case 'node': {
        resolveNode(run, profile);
        run.completeNode();
        break;
      }
      case 'start': run.beginDraft(); break;
      case 'deploy': deployBest(run, deployOpts); break; // field the best `maxDeploy`
      case 'draft': {
        // Force the opening starter if requested; else the profile's draft line.
        const dc = run.nodeContent;
        if (run.location.post === 'start' && opts.forceStarter && dc?.type === 'draft' && dc.options.includes(opts.forceStarter)) {
          run.chooseDraftMember(opts.forceStarter);
        } else {
          draftPick(run, profile);
        }
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
  // #90 MP-economy telemetry — the "player runs dry in nearly every fight" pillar.
  mp: MpReport;
}

// Aggregate MP-starvation telemetry across every fight in a sim (#90).
export interface MpReport {
  fights: number;             // fights measured
  ranDryRate: number;         // fraction of FIGHTS that hit 0 MP at least once
  starvedFightRate: number;   // fraction of FIGHTS with >=1 hard-dry (no-affordable-card) phase
  restRate: number;           // fraction of player phases that ended in a Rest
  starvedTurnRate: number;    // fraction of player phases that closed hard-dry
  meanMinMp: number;          // mean per-fight lowest end-of-phase MP
  ranDryByFight: number[];    // per-fight fraction of attempts that hit 0 MP (indexed by fight)
  hardDryByFight: number[];   // per-fight fraction of attempts with a hard-dry phase
}

// 95% confidence half-width for a binomial proportion (normal approximation).
export function ci95(rate: number, n: number): number {
  if (n === 0) return 0;
  return 1.96 * Math.sqrt((rate * (1 - rate)) / n);
}

function proportion(wins: number, n: number): Proportion {
  const rate = n === 0 ? 0 : wins / n;
  return { wins, n, rate, ci95: ci95(rate, n) };
}

export function runSim(n: number, firstSeed = 1, setup?: (run: Run) => void, opts: RunOptions = {}): SimReport {
  let fullWins = 0;
  const fightWins = new Array(FIGHT_COUNT).fill(0);
  const fightAttempts = new Array(FIGHT_COUNT).fill(0);
  const fightTurnsTotal = new Array(FIGHT_COUNT).fill(0);
  const fightDeathsOnWin = new Array(FIGHT_COUNT).fill(0); // DR1: deaths summed over WON fights
  let injuriesTotal = 0;
  // #90 MP telemetry accumulators (over every fight played, across all runs).
  let mpFights = 0, mpRanDry = 0, mpStarvedFights = 0, mpPlayerTurns = 0, mpRestTurns = 0, mpStarvedTurns = 0, mpMinSum = 0;
  const mpRanDryF = new Array(FIGHT_COUNT).fill(0);   // per-fight: attempts that hit 0 MP
  const mpHardDryF = new Array(FIGHT_COUNT).fill(0);  // per-fight: attempts with a hard-dry phase
  const mpFightsF = new Array(FIGHT_COUNT).fill(0);   // per-fight: attempts with a closed player phase
  for (let i = 0; i < n; i++) {
    const outcome = runSingleRun(firstSeed + i, setup, opts);
    if (outcome.status === 'won') fullWins++;
    injuriesTotal += outcome.injuriesAtEnd;
    for (const f of outcome.fights) {
      fightAttempts[f.fightIndex]++;
      fightTurnsTotal[f.fightIndex] += f.turns;
      if (f.win) { fightWins[f.fightIndex]++; fightDeathsOnWin[f.fightIndex] += f.deaths; }
      // MP economy: only count fights where at least one player phase closed (a fight
      // decided entirely in the enemy's opening turn has no economy to speak of).
      if (f.mp.playerTurns > 0) {
        mpFights++;
        mpFightsF[f.fightIndex]++;
        if (f.mp.hitZero) { mpRanDry++; mpRanDryF[f.fightIndex]++; }
        if (f.mp.starvedTurns > 0) { mpStarvedFights++; mpHardDryF[f.fightIndex]++; }
        mpPlayerTurns += f.mp.playerTurns;
        mpRestTurns += f.mp.restTurns;
        mpStarvedTurns += f.mp.starvedTurns;
        mpMinSum += f.mp.minMp;
      }
    }
  }
  return {
    n, firstSeed,
    fullRun: proportion(fullWins, n),
    perFight: fightWins.map((w, i) => proportion(w, fightAttempts[i])),
    meanTurns: fightTurnsTotal.map((t, i) => (fightAttempts[i] ? t / fightAttempts[i] : 0)),
    deathsPerWin: fightDeathsOnWin.map((d, i) => (fightWins[i] ? d / fightWins[i] : 0)),
    meanInjuries: injuriesTotal / n,
    mp: {
      fights: mpFights,
      ranDryRate: mpFights ? mpRanDry / mpFights : 0,
      starvedFightRate: mpFights ? mpStarvedFights / mpFights : 0,
      restRate: mpPlayerTurns ? mpRestTurns / mpPlayerTurns : 0,
      starvedTurnRate: mpPlayerTurns ? mpStarvedTurns / mpPlayerTurns : 0,
      meanMinMp: mpFights ? mpMinSum / mpFights : 0,
      ranDryByFight: mpRanDryF.map((c, i) => (mpFightsF[i] ? c / mpFightsF[i] : 0)),
      hardDryByFight: mpHardDryF.map((c, i) => (mpFightsF[i] ? c / mpFightsF[i] : 0)),
    },
  };
}

// ---- reporting ------------------------------------------------------------

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
  // #90 MP-economy pillar: the player should run dry in nearly every fight.
  lines.push('');
  lines.push('MP economy (the "runs dry every fight" pillar):');
  lines.push(`  ran dry (hit 0 MP): ${pct(r.mp.ranDryRate)}% of fights   ` +
    `hard-dry (no affordable card): ${pct(r.mp.starvedFightRate)}% of fights`);
  lines.push(`  Rest rate: ${pct(r.mp.restRate)}% of player phases   ` +
    `hard-dry phases: ${pct(r.mp.starvedTurnRate)}%   mean fight-low MP: ${r.mp.meanMinMp.toFixed(2)}`);
  lines.push('  per-fight ran-dry %: ' + r.mp.ranDryByFight.map((d, i) => `F${i} ${pct(d)}`).join('  '));
  lines.push('  per-fight hard-dry %: ' + r.mp.hardDryByFight.map((d, i) => `F${i} ${pct(d)}`).join('  '));
  return lines.join('\n');
}

// ---- CLI ------------------------------------------------------------------

// Executed only when run directly (npm run sim), never on import.
runIfMain(import.meta.url, () => {
  const n = Number(process.argv[2] ?? 1000);
  const firstSeed = Number(process.argv[3] ?? 1);
  console.log(formatReport(runSim(n, firstSeed)));
});
