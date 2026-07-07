// Deploy reducer test harness (#60). Run with: tsx test/deploy.test.ts
import { firstEmptySlot, nextEmptySlot, reduceDeploy, type Deployment } from '../src/deploy';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}
function eqArr(name: string, a: Deployment, b: Deployment): void {
  check(name, a.length === b.length && a.every((x, i) => x === b[i]), `expected [${b}], got [${a}]`);
}
// The one-slot-per-hero invariant: no roster index seated in more than one slot.
function noDupes(d: Deployment): boolean {
  const seated = d.filter((x): x is number => x != null);
  return new Set(seated).size === seated.length;
}

// --- first-empty selection --------------------------------------------------
check('firstEmptySlot: all empty → Left (0)', firstEmptySlot([null, null, null]) === 0);
check('firstEmptySlot: Left filled → Center (1)', firstEmptySlot([5, null, null]) === 1);
check('firstEmptySlot: L+C filled → Right (2)', firstEmptySlot([5, 6, null]) === 2);
check('firstEmptySlot: all full → falls back to Left (0)', firstEmptySlot([5, 6, 7]) === 0);
check('firstEmptySlot: gap in the middle → that gap', firstEmptySlot([5, null, 7]) === 1);

check('nextEmptySlot: stays put when full', nextEmptySlot([5, 6, 7], 2) === 2);
check('nextEmptySlot: advances to first empty', nextEmptySlot([5, 6, null], 0) === 2);

// --- auto-advance seats three heroes across L/C/R ---------------------------
{
  let d: Deployment = [null, null, null];
  let active = firstEmptySlot(d);
  check('auto-advance: starts on Left', active === 0);
  // Seat three heroes (roster indices 10, 11, 12) with three consecutive clicks.
  for (const ri of [10, 11, 12]) {
    d = reduceDeploy(d, { type: 'seat', roster: ri, slot: active });
    active = nextEmptySlot(d, active);
  }
  eqArr('auto-advance: three clicks fill L/C/R', d, [10, 11, 12]);
  check('auto-advance: active stays put once full', active === 2);
  check('auto-advance: no duplicate seats', noDupes(d));
}

// --- toggle out via a second click ------------------------------------------
{
  const d: Deployment = [10, null, null];
  const out = reduceDeploy(d, { type: 'seat', roster: 10, slot: 0 });
  eqArr('seat: clicking the active occupant toggles them out', out, [null, null, null]);
}

// --- seating a hero already seated elsewhere keeps one slot -----------------
{
  const d: Deployment = [10, null, null];
  const out = reduceDeploy(d, { type: 'seat', roster: 10, slot: 2 });
  eqArr('seat: re-seating vacates the old slot', out, [null, null, 10]);
  check('seat: no duplicate after re-seat', noDupes(out));
}

// --- clear ------------------------------------------------------------------
{
  const d: Deployment = [10, 11, 12];
  eqArr('clear: ✕ empties just that slot', reduceDeploy(d, { type: 'clear', slot: 1 }), [10, null, 12]);
}

// --- drop roster → occupied slot displaces the old member to the hand -------
{
  const d: Deployment = [10, 11, 12];
  const out = reduceDeploy(d, { type: 'dropRosterToSlot', roster: 99, slot: 1 });
  eqArr('dropRosterToSlot: new hero takes the slot, old one displaced', out, [10, 99, 12]);
  check('dropRosterToSlot: displaced member no longer seated', !out.includes(11));
  check('dropRosterToSlot: one-slot invariant holds', noDupes(out));
}

// --- drop roster → empty slot seats there -----------------------------------
{
  const d: Deployment = [10, null, 12];
  const out = reduceDeploy(d, { type: 'dropRosterToSlot', roster: 99, slot: 1 });
  eqArr('dropRosterToSlot: empty slot just seats', out, [10, 99, 12]);
}

// --- drop roster hero already seated elsewhere → moves (no dupe) ------------
{
  const d: Deployment = [10, 11, null];
  const out = reduceDeploy(d, { type: 'dropRosterToSlot', roster: 10, slot: 2 });
  eqArr('dropRosterToSlot: already-seated hero moves, prior slot vacated', out, [null, 11, 10]);
  check('dropRosterToSlot: no duplicate after self-move', noDupes(out));
}

// --- drop slot → slot swaps -------------------------------------------------
{
  const d: Deployment = [10, 11, 12];
  const out = reduceDeploy(d, { type: 'dropSlotToSlot', from: 0, to: 2 });
  eqArr('dropSlotToSlot: two occupied slots swap', out, [12, 11, 10]);
  check('dropSlotToSlot: swap keeps invariant', noDupes(out));
}

// --- drop slot → empty slot moves -------------------------------------------
{
  const d: Deployment = [10, null, 12];
  const out = reduceDeploy(d, { type: 'dropSlotToSlot', from: 0, to: 1 });
  eqArr('dropSlotToSlot: onto empty is a move', out, [null, 10, 12]);
}

// --- unseat: seated hero dragged back to the roster -------------------------
{
  const d: Deployment = [10, 11, 12];
  const out = reduceDeploy(d, { type: 'unseat', roster: 11 });
  eqArr('unseat: hero returns to the hand', out, [10, null, 12]);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
