// Per-relic power battery (2026-07-04 playtest, promoted to a permanent tool for
// #35). Two boss-HP re-anchors (DR1, then #26's player-first reorder) invalidated
// the #22 per-relic gate baseline twice over, so this re-measures each relic's
// marginal full-run winrate the same way #22 did:
//
//   * the run plays with the NORMAL policy (natural relics and all) — the baseline
//     is the ordinary full-run (~31%);
//   * the tested relic is force-injected at the FIGHT-2 boundary (active from fight
//     3 on), ADDED on top of whatever the run naturally holds — so the delta is the
//     marginal value of GUARANTEEING that relic, exactly as #22 measured it;
//   * `runRelicLine(null)` is the baseline (no injection).
//
// (A curse like pactOfSilence reads as a negative delta — the harm of being handed
// it "alone", i.e. as the only forced addition.)
//
// Run it:  npx tsx sim/relic-exp.ts              (N = 600 per line)
//          npx tsx sim/relic-exp.ts 1000         (N = 1000 per line)
//          npx tsx sim/relic-exp.ts 600 aegisFont firstLightTaper   (subset)

import { Game } from '../src/engine';
import { Run } from '../src/run';
import type { RelicId } from '../src/constants';
import { playFight, resolveNode, chooseBranch, chooseSpoil, chooseCardReward, advanceBranch, draftPick, deployBest } from './policy';

// Mirrors run-sim's per-fight sub-seed so results line up with the main harness.
const fightSeed = (runSeed: number, fightIndex: number): number =>
  (Math.imul(runSeed, 0x9e3779b1) + fightIndex * 0x85ebca77) >>> 0;

const INJECT_AFTER_FIGHT = 2; // active from fight 3 on (the #22 injection point)

export interface RelicLine { relic: RelicId | null; n: number; wins: number; rate: number; }

// One winrate line: `relic` null = the ordinary-policy baseline; otherwise that
// relic force-added on top of the natural loadout at the fight-2 boundary.
export function runRelicLine(relic: RelicId | null, n: number, firstSeed = 1): RelicLine {
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const seed = firstSeed + i;
    const run = new Run(seed);
    run.beginDraft();
    let guard = 0;
    while (run.status === 'playing' && guard < 1000) {
      guard++;
      switch (run.location.kind) {
        case 'fight': {
          const fi = run.location.fightIndex;
          const game = new Game(fightSeed(seed, fi), run.toBattleConfig());
          playFight(game);
          run.markRelicsSpent(game.spentRelicIds());
          const died = game.diedThisFightSlots();
          const win = game.status === 'win';
          if (win) { run.recordInjuries(died); run.winFight(game.memberHPBySlot()); } else run.loseFight();
          // Inject at the fight-2 boundary: active from fight 3 on.
          if (win && fi === INJECT_AFTER_FIGHT && relic) run.addRelic(relic);
          break;
        }
        case 'cardReward': { const ci = chooseCardReward(run); if (ci >= 0) run.pickCardReward(ci); else run.skipCardReward(); break; } // #57
        case 'spoils': run.pickSpoil(chooseSpoil(run)); break;
        case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
        case 'branch': advanceBranch(run); break;
        case 'node': resolveNode(run); run.completeNode(); break;
        case 'start': run.beginDraft(); break;
        case 'deploy': deployBest(run); break;
        case 'draft': draftPick(run); break;
        default: run.status = 'lost'; break;
      }
    }
    if (run.status === 'won') wins++;
  }
  return { relic, n, wins, rate: wins / n };
}

// The relics the #35 battery tracks (the phase-B rule-changers + curses, plus the
// two phase-A passives the playtest flagged as drifted traps).
const BATTERY: RelicId[] = [
  'aegisFont', 'firstLightTaper', 'duskChime', 'martyrsIcon',
  'pactOfSilence', 'crackedHourglass', 'rustyCrown',
  // Iron mitigation web relics (#65) — gated ≤ +9pp.
  'whetstone', 'bulwarkCore',
  // Regen conversions relics (#66) — gated ≤ +9pp.
  'deepRoots', 'ossuaryBell',
];

const pct = (x: number): string => (100 * x).toFixed(1);
const signed = (x: number): string => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}`;

const invokedDirectly = process.argv[1] && /relic-exp\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const n = Number(process.argv[2] ?? 600);
  const which = process.argv.slice(3).filter((a): a is RelicId => (BATTERY as string[]).includes(a));
  const relics = which.length > 0 ? which : BATTERY;
  const base = runRelicLine(null, n);
  console.log(`\nRelic power battery — N=${n}, relic force-added after fight ${INJECT_AFTER_FIGHT} on top of the natural loadout`);
  console.log(`baseline (no relics): ${pct(base.rate)}%  (${base.wins}/${base.n})\n`);
  console.log('relic'.padEnd(20) + 'full-run'.padEnd(12) + 'delta');
  for (const r of relics) {
    const line = runRelicLine(r, n);
    console.log(r.padEnd(20) + `${pct(line.rate)}%`.padEnd(12) + `${signed(line.rate - base.rate)}pp`);
  }
}
