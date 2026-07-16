// #90 re-anchor tuning harness — the four headline cells the maintainer set targets
// against, plus the MP-economy pillar, so a tuning step can be judged in one fast run.
//
// Targets (2026-07-16, maintainer): optimal trio 60% · average trio 30% · poor trio ~0% ·
// smaller parties somewhat harder. Pull the curve down (esp. early); ALL fights MP-taxing.
//
// Run:  npx tsx sim/experiments/reanchor-90.ts [N] [firstSeed]   (default N=1000, seed 1)

import { runSim } from '../run-sim';
import { OPTIMAL, AVERAGE, POOR, withSmallParty } from '../profile';
import { pct, runIfMain } from '../util';

runIfMain(import.meta.url, () => {
  const N = Number(process.argv[2] ?? 1000);
  const firstSeed = Number(process.argv[3] ?? 1);
  console.log(`=== #90 re-anchor headline cells (N=${N}, seed ${firstSeed}) ===`);
  console.log(`targets: optimal 60% · average 30% · poor ~0% · solo Warlock (context)\n`);

  const cells: Array<[string, ReturnType<typeof runSim>]> = [
    ['optimal trio', runSim(N, firstSeed, undefined, { profile: OPTIMAL, maxDeploy: 3 })],
    ['average trio', runSim(N, firstSeed, undefined, { profile: AVERAGE, maxDeploy: 3 })],
    ['poor trio', runSim(N, firstSeed, undefined, { profile: POOR, maxDeploy: 3 })],
    ['optimal duo', runSim(N, firstSeed, undefined, { profile: withSmallParty(OPTIMAL), maxDeploy: 2 })],
    ['solo Warlock', runSim(N, firstSeed, undefined,
      { profile: withSmallParty(OPTIMAL), maxDeploy: 1, forceStarter: 'warlock', forcedDeployMember: 'warlock' })],
  ];

  for (const [label, r] of cells) {
    const m = r.mp;
    console.log(
      `  ${label.padEnd(14)} full ${pct(r.fullRun.rate).padStart(5)}% ±${pct(r.fullRun.ci95)}   ` +
      `bosses ${pct(r.perFight[2].wins / r.n).padStart(5)}/${pct(r.perFight[5].wins / r.n).padStart(5)}/${pct(r.perFight[8].wins / r.n).padStart(5)}   ` +
      `MP ran-dry ${pct(m.ranDryRate).padStart(5)}% hard-dry ${pct(m.starvedFightRate).padStart(5)}% lowMP ${m.meanMinMp.toFixed(2)}`,
    );
    console.log('  ' + ''.padEnd(14) + ' per-fight hard-dry%: ' + m.hardDryByFight.map((d, i) => `F${i} ${pct(d)}`).join(' '));
  }
});
