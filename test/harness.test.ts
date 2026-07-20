// Tests for the assertion helpers themselves.
//
// The characterization suites (phase A) rest entirely on capture/expectEvent/
// expectLog. A helper that silently always-passes would green-light every one of
// those cases, so each helper is checked BOTH ways: it passes when it should, and
// it actually FAILS when it should. The negative half is the point.
import { Game } from '../src/engine';
import type { GameEvent, LogEntry } from '../src/engine';
import { SLOT } from '../src/constants';
import { giveCard } from './factories';
import {
  results, check, eq, finish,
  capture, expectEvent, expectNoEvent, expectEventCount, expectLog, expectLogSeq,
} from './harness';

// Run an assertion that is SUPPOSED to fail, swallow its console noise, and roll
// the counters back so the deliberate failure doesn't pollute this suite's tally.
function expectFailure(name: string, fn: () => void): void {
  const p = results.passed, f = results.failed;
  const err = console.error;
  console.error = () => {};
  try { fn(); } finally { console.error = err; }
  const dp = results.passed - p, df = results.failed - f;
  results.passed = p; results.failed = f;
  check(name, df === 1 && dp === 0, `expected exactly 1 failure, got ${df} failed / ${dp} passed`);
}

// A bare Recordable — capture() only needs {events, log}, so the helpers can be
// exercised without booting a Game.
function stub() {
  return { events: [] as GameEvent[], log: [] as LogEntry[] };
}
const ev = (e: GameEvent) => e;
const line = (text: string, kind = 'info'): LogEntry => ({ text, kind, turn: 0 });

// --- capture ---------------------------------------------------------------
{
  const s = stub();
  s.log.push(line('before'));
  const cap = capture(s, () => {
    s.events.push(ev({ kind: 'heal', slot: SLOT.CENTER, amount: 4, hp: 12 }));
    s.log.push(line('during one'), line('during two'));
  });
  eq('capture returns the action events', cap.events.length, 1);
  eq('capture slices out pre-existing log lines', cap.log.length, 2);
  eq('capture log is in order', cap.log[0].text, 'during one');

  // The returned arrays are snapshots — later activity must not mutate them.
  s.events.push(ev({ kind: 'wipe' }));
  s.log.push(line('after'));
  eq('captured events are a snapshot', cap.events.length, 1);
  eq('captured log is a snapshot', cap.log.length, 2);
}
{
  const s = stub();
  s.events.push(ev({ kind: 'wipe' }));
  const cap = capture(s, () => {});
  eq('capture clears stale events first', cap.events.length, 0);
}

// --- expectEvent -----------------------------------------------------------
{
  const s = stub();
  const cap = capture(s, () => {
    s.events.push(ev({ kind: 'heal', slot: SLOT.CENTER, amount: 4, hp: 12 }));
    s.events.push(ev({ kind: 'draw', count: 2 }));
  });

  expectEvent('finds an event by kind alone', cap, 'draw');
  expectEvent('matches a full payload', cap, 'heal', { slot: SLOT.CENTER, amount: 4, hp: 12 });
  expectEvent('matches a partial payload', cap, 'heal', { amount: 4 });

  const got = expectEvent('returns the matched event', cap, 'draw', { count: 2 });
  eq('returned event carries its payload', got?.count, 2);

  expectFailure('fails when the kind is absent', () =>
    expectEvent('x', cap, 'wipe'));
  expectFailure('fails when a payload field differs', () =>
    expectEvent('x', cap, 'heal', { amount: 5 }));
  expectFailure('fails when one of several fields differs', () =>
    expectEvent('x', cap, 'heal', { amount: 4, hp: 99 }));
}
// Array payloads (slots) compare element-wise, not by reference.
{
  const s = stub();
  const cap = capture(s, () => {
    s.events.push(ev({ kind: 'hymn', bonus: 2, slots: [SLOT.LEFT, SLOT.CENTER] }));
  });
  expectEvent('matches an array payload', cap, 'hymn', { slots: [SLOT.LEFT, SLOT.CENTER] });
  expectFailure('fails on array order', () =>
    expectEvent('x', cap, 'hymn', { slots: [SLOT.CENTER, SLOT.LEFT] }));
  expectFailure('fails on array length', () =>
    expectEvent('x', cap, 'hymn', { slots: [SLOT.LEFT] }));
}
// With several events of one kind, a match on ANY of them passes.
{
  const s = stub();
  const cap = capture(s, () => {
    s.events.push(ev({ kind: 'heal', slot: SLOT.LEFT, amount: 3, hp: 9 }));
    s.events.push(ev({ kind: 'heal', slot: SLOT.RIGHT, amount: 5, hp: 11 }));
  });
  expectEvent('matches the second of two same-kind events', cap, 'heal', { slot: SLOT.RIGHT, amount: 5 });
  expectFailure('fails when no same-kind event matches', () =>
    expectEvent('x', cap, 'heal', { slot: SLOT.CENTER }));
}

// --- expectNoEvent / expectEventCount --------------------------------------
{
  const s = stub();
  const cap = capture(s, () => {
    s.events.push(ev({ kind: 'heal', slot: SLOT.LEFT, amount: 1, hp: 2 }));
    s.events.push(ev({ kind: 'heal', slot: SLOT.RIGHT, amount: 1, hp: 2 }));
  });
  expectNoEvent('passes when the kind is absent', cap, 'wipe');
  expectEventCount('counts repeated events', cap, 'heal', 2);
  expectEventCount('counts absent events as zero', cap, 'draw', 0);
  expectFailure('expectNoEvent fails when the kind is present', () =>
    expectNoEvent('x', cap, 'heal'));
  expectFailure('expectEventCount fails on the wrong count', () =>
    expectEventCount('x', cap, 'heal', 1));
}

// --- expectLog -------------------------------------------------------------
{
  const s = stub();
  const cap = capture(s, () => {
    s.log.push(line('Quick Heal: Mage heals 4. (8/12)', 'heal'));
    s.log.push(line('Shield raised on Tank.', 'status'));
  });

  expectLog('matches an exact line', cap, 'Quick Heal: Mage heals 4. (8/12)');
  expectLog('matches with the right kind', cap, 'Shield raised on Tank.', 'status');

  expectFailure('rejects a substring — exactness is the whole point', () =>
    expectLog('x', cap, 'Quick Heal'));
  expectFailure('rejects a trailing-whitespace near-miss', () =>
    expectLog('x', cap, 'Shield raised on Tank. '));
  expectFailure('rejects the right text under the wrong kind', () =>
    expectLog('x', cap, 'Shield raised on Tank.', 'heal'));
  expectFailure('fails when the line is absent', () =>
    expectLog('x', cap, 'nothing like this'));
}
{
  const s = stub();
  const cap = capture(s, () => { s.log.push(line('a'), line('b')); });
  expectLogSeq('matches the full ordered sequence', cap, ['a', 'b']);
  expectFailure('expectLogSeq fails on order', () => expectLogSeq('x', cap, ['b', 'a']));
  expectFailure('expectLogSeq fails on a missing line', () => expectLogSeq('x', cap, ['a']));
  expectFailure('expectLogSeq fails on an extra line', () => expectLogSeq('x', cap, ['a', 'b', 'c']));
}

// --- against a real Game ---------------------------------------------------
// The stubs above prove the matching logic; this proves capture() is pointed at
// the fields a live Game actually writes.
{
  const g = new Game(7);
  g.start();
  const m = g.members[SLOT.CENTER];
  m.hp = 1;
  const before = g.log.length;
  const cap = capture(g, () => g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER));

  check('real game: a heal event was captured', cap.events.some((e) => e.kind === 'heal'));
  check('real game: at least one log line was captured', cap.log.length > 0);
  eq('real game: log slice matches the game log delta', cap.log.length, g.log.length - before);
  const heal = cap.events.find((e) => e.kind === 'heal') as Extract<GameEvent, { kind: 'heal' }>;
  eq('real game: heal event reports the resulting hp', heal.hp, m.hp);
  expectEvent('real game: expectEvent matches the live payload', cap, 'heal', { slot: SLOT.CENTER, hp: m.hp });
}
// A second action's events replace the first's — the documented one-action-at-a-time
// constraint. Pinning it here so the constraint can't quietly change.
{
  const g = new Game(7);
  g.start();
  g.members[SLOT.CENTER].hp = 1;
  const cap = capture(g, () => {
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    g.endTurn(); // not skipTurn: one played card now forbids Rest, so it would no-op
  });
  check('capture across two actions keeps only the last action\'s events',
    !cap.events.some((e) => e.kind === 'heal'));
  check('capture across two actions still collects every log line',
    cap.log.some((e) => e.kind === 'heal'));
}

finish('harness');
