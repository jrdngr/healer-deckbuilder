// Campaign experiment harness (#39, promoted from the 2026-07-05 playtest session).
//
// Measures the structural balance the roster campaign cares about but the aggregate
// winrate hides: how a FORCED starter performs, how much BANNING a member from every
// offer moves the winrate (a strictly-dominated hire is one the roster is better off
// never taking), and WHICH members the permadeath system actually removes.
//
// Run with: npx tsx sim/campaign-exp.ts [N]   (default N=1000)
//
// It reuses the real campaign policy (draftPick / deployBest / …) and the real Run,
// so the numbers are the campaign the game actually plays — only the starter choice
// and the offer pool are overridden.

import { Game } from '../src/engine';
import { Run } from '../src/run';
import { FIGHT_COUNT, DRAFT_POOL } from '../src/constants';
import type { MemberId } from '../src/constants';
import { playFight, resolveNode, chooseBranch, chooseSpoil, advanceBranch, draftPick, deployBest } from './policy';

// Same per-fight sub-seed the real runner uses (run-sim.ts), recreated here so this
// harness doesn't need to reach into that module's internals.
function fightSeed(runSeed: number, fightIndex: number): number {
  return (Math.imul(runSeed, 0x9e3779b1) + fightIndex * 0x85ebca77) >>> 0;
}

interface RunResult {
  won: boolean;
  wonByFight: boolean[];   // did the run win fight i (false if it never reached it)
  reachedFight: boolean[]; // did the run reach fight i
  permadeaths: MemberId[]; // members removed by the 4th-death rule this run
}

interface Options {
  forceStarter?: MemberId; // choose this member at the start draft instead of the policy
  ban?: MemberId[];        // members excluded from every post-boss draft and Recruit offer
}

// One full campaign run. Mirrors run-sim's runSingleRun, with two overrides: a forced
// starter, and a banned set (seeded into the graveyard so availableMembers — which
// every post-boss draft and Recruit roll keys on — never offers them).
function runCampaign(seed: number, opts: Options = {}): RunResult {
  const run = new Run(seed);
  const ban = opts.ban ?? [];
  const banSet = new Set(ban);
  run.graveyard = [...ban]; // exclude the banned members from availableMembers()

  run.beginDraft();
  const wonByFight = new Array(FIGHT_COUNT).fill(false);
  const reachedFight = new Array(FIGHT_COUNT).fill(false);
  let guard = 0;
  while (run.status === 'playing' && guard < 1000) {
    guard++;
    switch (run.location.kind) {
      case 'fight': {
        const fi = run.location.fightIndex;
        reachedFight[fi] = true;
        const game = new Game(fightSeed(seed, fi), run.toBattleConfig());
        playFight(game);
        run.markRelicsSpent(game.spentRelicIds());
        const win = game.status === 'win';
        if (win) {
          wonByFight[fi] = true;
          run.recordInjuries(game.diedThisFightSlots());
          run.winFight();
        } else run.loseFight();
        break;
      }
      case 'spoils': run.pickSpoil(chooseSpoil(run)); break;
      case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
      case 'branch': advanceBranch(run); break;
      case 'node': resolveNode(run); run.completeNode(); break;
      case 'start': run.beginDraft(); break;
      case 'deploy': deployBest(run); break;
      case 'draft': {
        // Force the starter at the opening draft; otherwise let the policy pick.
        const opts2 = run.nodeContent?.type === 'draft' ? run.nodeContent.options : [];
        if (run.location.post === 'start' && opts.forceStarter && opts2.includes(opts.forceStarter)) {
          run.chooseDraftMember(opts.forceStarter);
        } else {
          draftPick(run);
        }
        break;
      }
      default: run.status = 'lost'; break;
    }
  }
  // Permadeaths = graveyard entries that were NOT part of the initial ban (banned
  // members never enter the roster, so they can't permadie).
  const permadeaths = run.graveyard.filter((id) => !banSet.has(id));
  return { won: run.status === 'won', wonByFight, reachedFight, permadeaths };
}

// Aggregate over a seed range.
interface Agg {
  n: number;
  fullRun: number;                 // full-run winrate
  f2Conditional: number;           // Gatewarden winrate among runs that reached it
  f2Solout: number;                // (informational) reached-F2 count
  permadeathsByMember: Record<string, number>;
}

function aggregate(n: number, firstSeed: number, opts: Options = {}): Agg {
  let full = 0, f2Reached = 0, f2Won = 0;
  const permaByMember: Record<string, number> = {};
  for (const id of DRAFT_POOL) permaByMember[id] = 0;
  for (let s = firstSeed; s < firstSeed + n; s++) {
    const r = runCampaign(s, opts);
    if (r.won) full++;
    if (r.reachedFight[2]) { f2Reached++; if (r.wonByFight[2]) f2Won++; }
    for (const id of r.permadeaths) permaByMember[id] = (permaByMember[id] ?? 0) + 1;
  }
  return {
    n,
    fullRun: full / n,
    f2Conditional: f2Reached === 0 ? 0 : f2Won / f2Reached,
    f2Solout: f2Reached,
    permadeathsByMember: permaByMember,
  };
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

// CLI report.
if (process.argv[1] && process.argv[1].endsWith('campaign-exp.ts')) {
  const N = Number(process.argv[2] ?? 1000);
  console.log(`=== campaign experiment (N=${N} per line) ===\n`);

  console.log('-- per-starter (forced) --');
  for (const starter of ['ranger', 'mage', 'warlock'] as MemberId[]) {
    const a = aggregate(N, 1, { forceStarter: starter });
    console.log(`  start=${starter.padEnd(8)} full-run ${pct(a.fullRun)}   F2 ${pct(a.f2Conditional)} (reached ${a.f2Solout})`);
  }

  console.log('\n-- ban delta (ranger start) --');
  const allowed = aggregate(N, 1, { forceStarter: 'ranger' });
  const banned = aggregate(N, 1, { forceStarter: 'ranger', ban: ['warlock'] });
  const delta = banned.fullRun - allowed.fullRun;
  console.log(`  warlock allowed: ${pct(allowed.fullRun)}`);
  console.log(`  warlock banned:  ${pct(banned.fullRun)}`);
  console.log(`  ban delta:       ${(delta * 100).toFixed(1)}pp  ${Math.abs(delta) <= 0.03 ? '(within +/-3pp — not strictly dominated ✓)' : '(OUT of +/-3pp band)'}`);

  console.log('\n-- permadeaths by member (per ' + N + ' runs, ranger start) --');
  const byMember = allowed.permadeathsByMember;
  const total = Object.values(byMember).reduce((s, v) => s + v, 0);
  for (const id of DRAFT_POOL) {
    if (byMember[id] > 0) console.log(`  ${id.padEnd(11)} ${byMember[id]}`);
  }
  console.log(`  total permadeaths: ${total}`);
}

export { runCampaign, aggregate };
export type { Options, Agg, RunResult };
