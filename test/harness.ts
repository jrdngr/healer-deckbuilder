// Shared micro-harness for the test suites. Each suite runs as its own `tsx`
// process (see package.json `test`), so `results` is per-process state — a suite
// calls check()/eq() to accumulate, then finish() (or reads `results` directly for
// a custom summary line, as coverage/sim do).
//
// The GameEvent/LogEntry imports are TYPE-ONLY on purpose: they erase at runtime, so
// suites that deliberately load no game content (tooltip, goldFx) keep loading none.
import type { GameEvent, LogEntry } from '../src/engine';

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

// --- behavior capture (characterization suites) -----------------------------
// The content suites assert three things per item: resulting state, the exact log
// text, and the emitted events. State is plain eq(); the other two come from
// capture().

export interface Captured {
  events: GameEvent[];
  log: LogEntry[];
}

interface Recordable {
  events: GameEvent[];
  log: LogEntry[];
}

/**
 * Run one game action and collect everything it emitted.
 *
 *   const cap = capture(g, () => g.playCard(idx, SLOT.CENTER));
 *   expectEvent('heal fired', cap, 'heal', { slot: 1, amount: 4 });
 *   expectLog('heal logged', cap, 'Quick Heal: Mage heals 4. (8/12)');
 *
 * ONE ACTION AT A TIME. `game.events` is an animation feed for the most recent
 * action — every public entry point clears it on the way in (core.ts:344) — so if
 * `fn` performs two actions, only the second one's events survive. The log is
 * captured by length-slicing and is exact regardless of how many actions run.
 */
export function capture(game: Recordable, fn: () => void): Captured {
  const logStart = game.log.length;
  game.events = [];
  fn();
  return { events: game.events.slice(), log: game.log.slice(logStart) };
}

type OfKind<K extends GameEvent['kind']> = Extract<GameEvent, { kind: K }>;

const fmt = (v: unknown): string => (Array.isArray(v) ? JSON.stringify(v) : String(v));

// Flat comparison: event payloads are primitives plus the occasional Slot[].
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
}

function mismatches(actual: unknown, expected: object): string[] {
  const act = actual as Record<string, unknown>;
  return Object.keys(expected)
    .filter((k) => !sameValue(act[k], (expected as Record<string, unknown>)[k]))
    .map((k) => `${k}: expected ${fmt((expected as Record<string, unknown>)[k])}, got ${fmt(act[k])}`);
}

/**
 * Assert an event of `kind` was emitted, optionally matching a partial payload.
 * Returns the matched event so callers can drill further. On failure, reports
 * which fields differed rather than just "not found".
 */
export function expectEvent<K extends GameEvent['kind']>(
  name: string,
  cap: Captured,
  kind: K,
  expected: Partial<OfKind<K>> = {},
): OfKind<K> | undefined {
  const candidates = cap.events.filter((e) => e.kind === kind) as OfKind<K>[];
  if (candidates.length === 0) {
    const saw = cap.events.length === 0 ? '(no events)' : cap.events.map((e) => e.kind).join(', ');
    check(name, false, `no '${kind}' event — saw: ${saw}`);
    return undefined;
  }
  const keys = Object.keys(expected);
  if (keys.length === 0) { check(name, true); return candidates[0]; }

  const scored = candidates.map((c) => ({ c, diffs: mismatches(c, expected) }));
  const hit = scored.find((s) => s.diffs.length === 0);
  if (hit) { check(name, true); return hit.c; }

  // Report the nearest miss — the candidate differing in the fewest fields.
  const nearest = scored.reduce((a, b) => (b.diffs.length < a.diffs.length ? b : a));
  const plural = candidates.length > 1 ? ` (${candidates.length} '${kind}' events; nearest shown)` : '';
  check(name, false, `${nearest.diffs.join('; ')}${plural}`);
  return undefined;
}

/** Assert NO event of `kind` was emitted — the edge-case counterpart. */
export function expectNoEvent(name: string, cap: Captured, kind: GameEvent['kind']): void {
  const found = cap.events.filter((e) => e.kind === kind);
  check(name, found.length === 0, found.length ? `${found.length} '${kind}' event(s) emitted` : '');
}

export function expectEventCount(
  name: string, cap: Captured, kind: GameEvent['kind'], count: number,
): void {
  const n = cap.events.filter((e) => e.kind === kind).length;
  check(name, n === count, `expected ${count} '${kind}' event(s), got ${n}`);
}

/**
 * Assert an exact log line was produced. Exact, not substring: the migration
 * rewrites every log string through a template engine, and substring matching is
 * what would let that drift through silently.
 */
export function expectLog(name: string, cap: Captured, text: string, kind?: string): void {
  const hit = cap.log.some((e) => e.text === text && (kind === undefined || e.kind === kind));
  if (hit) { check(name, true); return; }
  const saw = cap.log.length === 0
    ? '      (no log lines)'
    : cap.log.map((e) => `      [${e.kind}] ${e.text}`).join('\n');
  const want = kind === undefined ? text : `[${kind}] ${text}`;
  check(name, false, `no log line matched\n    expected: ${want}\n    saw:\n${saw}`);
}

/** Assert the full ordered log an action produced, line for line. */
export function expectLogSeq(name: string, cap: Captured, texts: string[]): void {
  const actual = cap.log.map((e) => e.text);
  const same = actual.length === texts.length && actual.every((t, i) => t === texts[i]);
  if (same) { check(name, true); return; }
  check(name, false,
    `log sequence differs\n    expected:\n${texts.map((t) => '      ' + t).join('\n')}` +
    `\n    got:\n${actual.map((t) => '      ' + t).join('\n')}`);
}
