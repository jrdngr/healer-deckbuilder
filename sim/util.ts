// Shared sim helpers. The whole-run harness (run-sim.ts), the campaign harness
// (campaign-exp.ts), and the hand-run experiments in sim/experiments/ all derived
// the same per-fight seed, formatted the same percentages, and hand-rolled the same
// "only when invoked directly" CLI guard. They live here once.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Deterministic per-fight sub-seed derived from the run seed + fight index, so a
// whole run reproduces from a single seed. Every harness must use THIS so their
// numbers line up with the pinned baseline.
export function fightSeed(runSeed: number, fightIndex: number): number {
  return (Math.imul(runSeed, 0x9e3779b1) + fightIndex * 0x85ebca77) >>> 0;
}

// A rate in [0,1] as a 1-decimal percentage string WITHOUT the % sign (e.g. 0.315 -> "31.5").
export const pct = (x: number): string => (x * 100).toFixed(1);

// Run `fn` only when this module is the process entry point (a hand-run `tsx`
// invocation), never on import. Pass `import.meta.url` from the calling module.
export function runIfMain(metaUrl: string, fn: () => void): void {
  const entry = process.argv[1];
  if (entry && resolve(entry) === fileURLToPath(metaUrl)) fn();
}
