// Shared micro-harness for the test suites. Each suite runs as its own `tsx`
// process (see package.json `test`), so `results` is per-process state — a suite
// calls check()/eq() to accumulate, then finish() (or reads `results` directly for
// a custom summary line, as coverage/sim do).

export const results = { passed: 0, failed: 0 };

export function check(name: string, cond: boolean, extra: string = ''): void {
  if (cond) { results.passed++; }
  else { results.failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}

export function eq(name: string, a: unknown, b: unknown): void {
  check(name, a === b, `expected ${b}, got ${a}`);
}

// Print the standard "<label>N passed, M failed" summary and exit non-zero on any
// failure. Pass a label (e.g. 'components') for the prefixed variant.
export function finish(label = ''): void {
  const prefix = label ? `${label}: ` : '';
  console.log(`\n${prefix}${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed === 0 ? 0 : 1);
}
