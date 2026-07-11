// Balance-tier + party-size matrix harness (2026-07-07 balance pass).
//
// Measures the game across a SKILL GRADIENT (optimal / average / poor play) and THREE
// party sizes (field 1 / 2 / 3), so balance can be judged against the maintainer's
// per-tier targets instead of the single "good player" stick number.
//
// Run with:  npx tsx sim/experiments/balance-tiers.ts [N] [firstSeed]   (default N=1000, seed 1)
//
// For each cell it prints the full-run winrate, the per-boss CONDITIONAL winrate (among
// runs that reached the boss), and the CUMULATIVE boss-survival milestones — P(a run
// reaches AND beats boss K). Because the run is linear, winning boss K implies every
// earlier boss was beaten, so P(beat bossK) = perFight[bossIdx].wins / N is exactly the
// cumulative milestone the targets are written against.
//
// Targets (trio / field 3): optimal 75% · average 30% (boss1 70%, boss2 50%, F1 >=88%) ·
// poor <=3%. Solo (field 1): optimal Warlock ~25%.

import { runSim, type SimReport } from '../run-sim';
import { OPTIMAL, AVERAGE, POOR, withSmallParty, type SkillProfile } from '../profile';
import { FIGHT_COUNT } from '../../src/constants';
import { pct, runIfMain } from '../util';

const BOSSES = [2, 5, 8]; // fight indices of the act bosses (Gatewarden / Hexweaver / Devourer)

// Cumulative boss-survival milestones: P(reach & beat boss K) over all N runs.
function milestones(r: SimReport): number[] {
  return BOSSES.map((bi) => (r.n ? r.perFight[bi].wins / r.n : 0));
}

interface Cell { label: string; report: SimReport; }

function runCell(label: string, N: number, firstSeed: number, profile: SkillProfile, maxDeploy: number,
                extra: { forceStarter?: 'warlock'; forcedDeployMember?: 'warlock' } = {}): Cell {
  const report = runSim(N, firstSeed, undefined, { profile, maxDeploy, ...extra });
  return { label, report };
}

function printCell(c: Cell): void {
  const r = c.report;
  const [b1, b2, b3] = milestones(r);
  const cond = BOSSES.map((bi) => `${pct(r.perFight[bi].rate)}%`).join(' / ');
  console.log(
    `  ${c.label.padEnd(22)} full ${pct(r.fullRun.rate).padStart(5)}% ±${pct(r.fullRun.ci95)}   ` +
    `milestones ${pct(b1).padStart(5)}% / ${pct(b2).padStart(5)}% / ${pct(b3).padStart(5)}%   ` +
    `boss-cond ${cond}`,
  );
}

// CLI.
runIfMain(import.meta.url, () => {
  const N = Number(process.argv[2] ?? 1000);
  const firstSeed = Number(process.argv[3] ?? 1);
  console.log(`=== balance-tier × party-size matrix (N=${N} per cell, from seed ${firstSeed}) ===`);
  console.log(`(milestones = cumulative P(reach & beat boss1 / boss2 / boss3); boss-cond = conditional-on-reaching)\n`);

  const tiers: Array<[string, SkillProfile]> = [['optimal', OPTIMAL], ['average', AVERAGE], ['poor', POOR]];

  for (const [name, base] of tiers) {
    console.log(`-- ${name} --`);
    for (const size of [3, 2, 1]) {
      // Small-party relics are only live while fielding <= 2; fold them in for the
      // optimal solo/duo cells so that build is actually available to the buyer.
      const profile = name === 'optimal' && size <= 2 ? withSmallParty(base) : base;
      printCell(runCell(`field ${size}`, N, firstSeed, profile, size));
    }
    console.log('');
  }

  // The headline solo challenge: an optimal Warlock, forced as the starter and the only
  // body fielded, with the small-party build available.
  console.log('-- solo Warlock (optimal, forced) --');
  printCell(runCell('warlock solo', N, firstSeed, withSmallParty(OPTIMAL), 1,
    { forceStarter: 'warlock', forcedDeployMember: 'warlock' }));
  console.log('');

  console.log(`(FIGHT_COUNT=${FIGHT_COUNT}; bosses at F${BOSSES.join('/F')})`);
});
