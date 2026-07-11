// Between-fight heal sweep (#58 balance pass). HP now PERSISTS across fights and a
// member recovers only HERO_HEAL_PCT of their max HP between them (Infirmary aside),
// so the whole campaign re-anchors around that fraction. This sweeps HEAL_TUNING.pct
// through the settled system and reports full-run + per-boss winrates with 95% CIs,
// so the shipped HERO_HEAL_PCT is a measured choice, not a guess.
//
// Run it:  npx tsx sim/experiments/heal-exp.ts            (N = 1000 per pct)
//          npx tsx sim/experiments/heal-exp.ts 300         (N = 300 per pct)
//          npx tsx sim/experiments/heal-exp.ts 1000 0.4    (single pct, N = 1000)
//
// It reuses runSim (the authoritative harness) so the numbers line up exactly with
// the pins in sim/run-sim.ts and test/sim.test.ts.

import { HEAL_TUNING, HERO_HEAL_PCT, isActBoss, actOfFight } from '../../src/constants';
import { runSim } from '../run-sim';
import type { SimReport } from '../run-sim';
import { pct as p, runIfMain } from '../util';

// Run the full harness at a fixed between-fight heal fraction, restoring the
// shipped default afterward so an import never leaves the knob flipped.
function sweepAt(pct: number, n: number, firstSeed = 1): SimReport {
  const prev = HEAL_TUNING.pct;
  HEAL_TUNING.pct = pct;
  try {
    return runSim(n, firstSeed);
  } finally {
    HEAL_TUNING.pct = prev;
  }
}

function reportRow(pct: number, r: SimReport): void {
  const boss = (i: number): string => `${p(r.perFight[i].rate)}±${p(r.perFight[i].ci95)}`;
  console.log(
    `pct ${pct.toFixed(2)}  full-run ${p(r.fullRun.rate)}% ±${p(r.fullRun.ci95)}  ` +
    `| F2 ${boss(2)} · F5 ${boss(5)} · F8 ${boss(8)}  ` +
    `| scars/run ${r.meanInjuries.toFixed(2)}`,
  );
}

runIfMain(import.meta.url, () => {
  const n = Number(process.argv[2] ?? 1000);
  const single = process.argv[3] != null ? Number(process.argv[3]) : null;
  const pcts = single != null ? [single] : [0.20, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60];
  console.log(`Between-fight heal sweep — N=${n} per pct (shipped HERO_HEAL_PCT = ${HERO_HEAL_PCT})`);
  console.log('Per-fight labels: ' + Array.from({ length: 9 }, (_, i) => (isActBoss(i) ? `F${i}(A${actOfFight(i) + 1}boss)` : `F${i}`)).join(' '));
  for (const pct of pcts) reportRow(pct, sweepAt(pct, n));
});

export { sweepAt };
