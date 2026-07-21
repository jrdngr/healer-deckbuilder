// The test runner. Discovers every suite under test/ and runs them all.
//
// This replaces a hand-maintained `a && b && c && …` chain of ~30 tsx invocations in
// package.json, which had two problems that both bite hardest during content work:
//
//   1. `&&` short-circuits. The first failing suite hid every suite after it, so one
//      broken content file reported one failure and concealed the rest — exactly when
//      you most want the full picture.
//   2. A new test file had to be hand-added to the chain, and a file that was never
//      added simply never ran. Silence looked like success.
//
// Discovery is by convention now (*.test.ts / *.test.tsx), so a new suite runs the
// moment it exists, and every suite runs even when an earlier one fails.
//
// Usage:
//   tsx scripts/run-tests.ts                 all suites
//   tsx scripts/run-tests.ts content         only suites whose path contains "content"
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = 'test';

function findSuites(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...findSuites(path));
    else if (/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const filter = process.argv[2];
const suites = findSuites(ROOT).filter((p) => !filter || p.includes(filter));

if (suites.length === 0) {
  console.error(filter ? `No suites match ${JSON.stringify(filter)}.` : 'No suites found.');
  process.exit(1);
}

const failed: string[] = [];
const started = Date.now();

for (const suite of suites) {
  // stdio inherit: each suite prints its own "name: N passed, M failed" line, and the
  // failure detail above it is the useful part — don't capture and re-print it.
  // `tsx`, not `npx tsx` — npm puts node_modules/.bin on PATH, and paying npx's
  // resolution once per suite cost ~5s across the suite set.
  const r = spawnSync('tsx', [suite], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(suite);
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${'─'.repeat(60)}`);
if (failed.length === 0) {
  console.log(`✓ ${suites.length} suites passed in ${secs}s`);
} else {
  // Reprint the failing suite names together at the end. With ~30 suites of scrolling
  // output, "which ones actually failed" is otherwise genuinely hard to answer.
  console.log(`✗ ${failed.length} of ${suites.length} suites FAILED in ${secs}s:`);
  for (const f of failed) console.log(`    ${f}`);
}
process.exit(failed.length === 0 ? 0 : 1);
