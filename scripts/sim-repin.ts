// `npm run sim:repin` — re-measure the pinned N=200 wins vector and rewrite it in place.
//
// test/sim.test.ts pins an exact 9-element vector. That pin is worth keeping: it is the
// only thing that catches an accidental engine or policy change, and a band gate would
// not. But it also means every deliberate content addition breaks it, because new cards
// dilute the shop pool — the file carries roughly forty "re-pinned on the new observed
// numbers" comments, each one a hand-transcription of nine integers.
//
// Transcribing nine numbers by hand is exactly the kind of task that is easy to get
// subtly wrong and impossible to notice: a typo'd pin still passes on the next run,
// because it becomes the new truth. So the machine reads them.
//
// It deliberately does NOT write the comment explaining the delta. That is the part that
// requires judgement — whether the movement is an intended balance change or an
// unintended regression is the whole question, and a tool that guessed would be worse
// than one that leaves a blank. It prints the per-fight delta to describe, and stops.
import { writeFileSync, readFileSync } from 'node:fs';
import { runSim } from '../sim/run-sim';

const FILE = 'test/sim.test.ts';
// Matches the pin's array literal, anchored on the assertion's own label so nothing else
// in the file can be rewritten by accident.
const PIN = /(eq\('N=200 per-fight wins', JSON\.stringify\(perFightWins\), JSON\.stringify\(\[)([^\]]*)(\]\)\);)/;

const source = readFileSync(FILE, 'utf8');
const match = source.match(PIN);
if (!match) {
  console.error(`Could not find the N=200 pin in ${FILE}. Has the assertion been renamed?`);
  process.exit(1);
}

const before = match[2].split(',').map((s) => Number(s.trim()));
const after = runSim(200, 1).perFight.map((p) => p.wins);

if (before.join() === after.join()) {
  console.log(`The pin is already correct: [${after.join(', ')}]`);
  process.exit(0);
}

writeFileSync(FILE, source.replace(PIN, `$1${after.join(', ')}$3`));

console.log(`Re-pinned ${FILE}\n`);
console.log(`  before: [${before.join(', ')}]`);
console.log(`  after:  [${after.join(', ')}]\n`);
console.log('  per-fight delta:');
for (let i = 0; i < after.length; i++) {
  const d = after[i] - (before[i] ?? 0);
  if (d !== 0) console.log(`    F${i} ${before[i]} -> ${after[i]}  (${d > 0 ? '+' : ''}${d})`);
}
const unchanged = after.map((_, i) => i).filter((i) => after[i] === before[i]);
if (unchanged.length) console.log(`    unchanged: ${unchanged.map((i) => `F${i}`).join(' ')}`);
console.log('\nNow write the comment above the pin saying WHY it moved — that is the part');
console.log('this script cannot do, and the part a future reader will actually need.');
