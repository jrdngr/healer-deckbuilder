// Injury-mode experiment harness (2026-07-04 playtest). Measures how the DR1
// scar system behaves at its limit under each INJURY_RULES mode:
//   cap          — today's rule (scars stop at 3; further deaths are FREE)
//   escalate     — scars never cap (the 3-tier penalty cycle repeats)
//   incapacitate — the 4th death removes the member from every following fight
//                  until a scar is healed (unresurrectable in-fight)
//
// Run it:  npx tsx sim/injury-exp.ts            (N = 1000 per mode)
//          npx tsx sim/injury-exp.ts 500        (N = 500 per mode)
//
// The key telemetry is `past-cap deaths`: deaths landing on a member who already
// carries MAX_INJURIES scars. Under 'cap' these cost NOTHING — each one is the
// nullified-system signal the playtest was asked to investigate.

import { Game } from '../src/engine';
import { Run } from '../src/run';
import { INJURY_RULES, MAX_INJURIES } from '../src/constants';
import type { InjuryMode } from '../src/constants';
import { playFight, resolveNode, chooseBranch, chooseSpoil, advanceBranch } from './policy';

// Mirrors run-sim's per-fight sub-seed so results line up with the main harness.
const fightSeed = (runSeed: number, fightIndex: number): number =>
  (Math.imul(runSeed, 0x9e3779b1) + fightIndex * 0x85ebca77) >>> 0;

interface ModeReport {
  mode: InjuryMode;
  n: number;
  wins: number;
  bossWins: number[]; bossAttempts: number[]; // [F2, F5, F8]
  totalDeaths: number;
  pastCapDeaths: number;      // deaths on members already at >= MAX_INJURIES scars
  runsWithCappedMember: number; // runs where any member reached MAX_INJURIES
  incapacitations: number;    // members that reached the incapacitation scar (mode-inc only)
  maxScarSeen: number;
  scarsAtEnd: number;
  goldHealing: number;
  stalls: number;             // fights that hit the turn cap (policy wedge signal)
}

// `healScars: false` models the DEGENERATE line — a player who banks the gold and
// keeps sacrificing, betting on the 3-scar cap to make further deaths free. The
// Infirmary is skipped outright (Field Hospital / Mending Totem stay — they are
// windfalls, not a spend decision).
function runMode(mode: InjuryMode, n: number, firstSeed = 1, healScars = true): ModeReport {
  INJURY_RULES.mode = mode;
  const r: ModeReport = {
    mode, n, wins: 0, bossWins: [0, 0, 0], bossAttempts: [0, 0, 0],
    totalDeaths: 0, pastCapDeaths: 0, runsWithCappedMember: 0,
    incapacitations: 0, maxScarSeen: 0, scarsAtEnd: 0, goldHealing: 0, stalls: 0,
  };
  const bossIndex: Record<number, number> = { 2: 0, 5: 1, 8: 2 };
  for (let i = 0; i < n; i++) {
    const seed = firstSeed + i;
    const run = new Run(seed);
    run.beginRun();
    let guard = 0;
    let cappedThisRun = false;
    const incapSeen = new Set<number>();
    while (run.status === 'playing' && guard < 1000) {
      guard++;
      switch (run.location.kind) {
        case 'fight': {
          const fi = run.location.fightIndex;
          const game = new Game(fightSeed(seed, fi), run.toBattleConfig());
          playFight(game);
          if (game.status === 'playing') r.stalls++; // turn-capped
          run.markRelicsSpent(game.spentRelicIds());
          const died = game.diedThisFightSlots();
          r.totalDeaths += died.length;
          for (const s of died) if ((run.party[s]?.injuries ?? 0) >= MAX_INJURIES) r.pastCapDeaths++;
          const win = game.status === 'win';
          if (fi in bossIndex) {
            r.bossAttempts[bossIndex[fi]]++;
            if (win) r.bossWins[bossIndex[fi]]++;
          }
          if (win) { run.recordInjuries(died); run.winFight(); } else run.loseFight();
          for (const [s, p] of run.party.entries()) {
            r.maxScarSeen = Math.max(r.maxScarSeen, p.injuries);
            if (p.injuries >= MAX_INJURIES) cappedThisRun = true;
            if (mode === 'incapacitate' && p.injuries > MAX_INJURIES) incapSeen.add(s);
          }
          break;
        }
        case 'spoils': run.pickSpoil(chooseSpoil(run)); break;
        case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
        case 'branch': advanceBranch(run); break;
        case 'node': {
          const wasInfirmary = run.nodeContent?.type === 'infirmary';
          if (wasInfirmary && !healScars) { run.completeNode(); break; } // the degenerate line walks past
          const before = run.gold;
          resolveNode(run);
          if (wasInfirmary) r.goldHealing += before - run.gold;
          run.completeNode();
          break;
        }
        case 'start': run.beginRun(); break;
        default: run.status = 'lost'; break;
      }
    }
    if (run.status === 'won') r.wins++;
    if (cappedThisRun) r.runsWithCappedMember++;
    r.incapacitations += incapSeen.size;
    r.scarsAtEnd += run.party.reduce((s, p) => s + p.injuries, 0);
  }
  INJURY_RULES.mode = 'incapacitate'; // restore the module default (#33), never leave it flipped
  return r;
}

const pct = (x: number, n: number): string => ((100 * x) / Math.max(1, n)).toFixed(1);

function report(r: ModeReport): void {
  console.log(`\n=== mode: ${r.mode} (N=${r.n}) ===`);
  console.log(`full-run ${pct(r.wins, r.n)}%  ·  bosses F2 ${pct(r.bossWins[0], r.bossAttempts[0])}% / F5 ${pct(r.bossWins[1], r.bossAttempts[1])}% / F8 ${pct(r.bossWins[2], r.bossAttempts[2])}%`);
  console.log(`deaths/run ${(r.totalDeaths / r.n).toFixed(2)}  ·  PAST-CAP deaths/run ${(r.pastCapDeaths / r.n).toFixed(2)} (${pct(r.pastCapDeaths, r.totalDeaths)}% of all deaths)`);
  console.log(`runs with a capped member ${pct(r.runsWithCappedMember, r.n)}%  ·  max scars seen ${r.maxScarSeen}  ·  scars at end/run ${(r.scarsAtEnd / r.n).toFixed(2)}`);
  console.log(`incapacitations/run ${(r.incapacitations / r.n).toFixed(3)}  ·  gold healing/run ${(r.goldHealing / r.n).toFixed(1)}  ·  turn-cap stalls ${r.stalls}`);
}

const invokedDirectly = process.argv[1] && /injury-exp\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const n = Number(process.argv[2] ?? 1000);
  console.log('--- honest line (policy heals scars at the Infirmary) ---');
  for (const mode of ['cap', 'escalate', 'incapacitate'] as InjuryMode[]) report(runMode(mode, n));
  console.log('\n--- degenerate line (never heals a scar; banks the gold) ---');
  for (const mode of ['cap', 'escalate', 'incapacitate'] as InjuryMode[]) report(runMode(mode, n, 1, false));
}

export { runMode };
export type { ModeReport };
