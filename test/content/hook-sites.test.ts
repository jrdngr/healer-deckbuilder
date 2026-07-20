// The declared-but-never-fired trap (#103).
//
// The hook bus has a failure mode the content validator structurally cannot catch. A
// relic declares `"onRest": [...]` in relics.json; the name is in EVENT_HOOKS, so
// validation passes; the JSON is well-formed, so the schema passes — and the relic does
// nothing, forever, because no engine seam ever calls `_hookEvent('onRest', ...)`.
//
// That is not hypothetical: seven of the eight original event hooks shipped with no call
// site at all. Only `onAbilityCast` was ever fired.
//
// So the vocabulary and the seams are cross-checked HERE, against the real sources, in
// both directions:
//
//   1. every name the vocabulary declares is fired somewhere, and
//   2. every name fired somewhere is in the vocabulary.
//
// Direction 2 matters as much as direction 1: a seam calling a name that no longer exists
// in EVENT_HOOKS is dead code that looks live. Scanning the source text rather than
// maintaining a hand-written FIRED_HOOKS constant is deliberate — a hand-written list is
// one more thing that can drift out of sync with the seams it claims to describe, which
// is the very problem being fixed.
import { readFileSync } from 'node:fs';
import { VALUE_HOOKS, EVENT_HOOKS, RUN_HOOKS } from '../../src/content/hooks';
import { check, eq, finish } from '../harness';

// Every file that may host a hook seam. The run layer is included because #103's
// run-layer bus fires its own hook set from src/run.ts.
const SOURCES = ['src/engine/core.ts', 'src/engine/effects.ts', 'src/run.ts'];

const source = SOURCES.map((f) => `// ==== ${f}\n${readFileSync(f, 'utf8')}`).join('\n');

// A seam is any `_hook*('name'` call with a literal first argument — `_hookEvent`,
// `_hookValue`, `_hookAnswer`, `_hookConsume`, `_hookValueConsuming`, and whatever
// dispatcher comes next. Matching the PREFIX rather than an enumerated list is deliberate:
// an enumerated list silently stops seeing new dispatchers, which is how this check first
// failed to notice `modifyAutoStrike`.
//
// Literal names are required precisely so this scan can see them; a computed hook name
// would be invisible here and is not worth the flexibility.
const CALL = /_hook[A-Za-z]*\(\s*'([A-Za-z]+)'/g;
const fired = new Set<string>();
for (const m of source.matchAll(CALL)) fired.add(m[1]);

// Sanity-check the scanner itself before trusting its verdict. A regex that silently
// matched nothing would make every assertion below pass vacuously.
check('hook-sites: the scanner finds seams at all', fired.size > 0,
  'no hook call sites found — the scan regex is broken, not the engine');
check('hook-sites: the scanner sees a known seam', fired.has('onAbilityCast'),
  'onAbilityCast is fired from effects.ts; not seeing it means the scan is wrong');

// Run hooks count as declared: they are fired from src/run.ts, which the scan covers.
const declared: readonly string[] = [...VALUE_HOOKS, ...EVENT_HOOKS, ...RUN_HOOKS];

eq('hook-sites: every declared hook name has a call site',
  declared.filter((n) => !fired.has(n)).join(', '), '');

eq('hook-sites: every fired hook name is declared',
  [...fired].filter((n) => !declared.includes(n)).sort().join(', '), '');

// The split that is easiest to "tidy up" into a bug. onMemberDamaged fires before the
// death veto and onMemberSurvived after it; if a future refactor collapses them, a
// Martyr-saved Tank starts holding a Grudge bank he does not hold today.
check('hook-sites: the damaged/survived split is intact',
  fired.has('onMemberDamaged') && fired.has('onMemberSurvived'),
  'both seams must exist independently');

// --- the status-tag / member-field trap -------------------------------------
//
// A status TAG and the member FIELD holding it do not always share a name: `holdLine`
// lives in `holdLineTurns`, and four other tags are the same shape. A naive `m[tag]` read
// returns undefined for those, which coerces to "no status" — a silent false in a gate
// that is otherwise fully valid content. That bug shipped into this very migration (the
// Tank's Hold the Line double-banking read as single) and only #99's exact-number
// assertion caught it.
//
// So: every tag a member can carry must resolve to a real field through the same lookup
// the condition uses. The enemy-side tags are listed explicitly rather than skipped, so
// adding a member-facing tag to that list is a deliberate act and not an oversight.
import { Game } from '../../src/engine';
import { defaultBattleConfig, STATUS_TAGS } from '../../src/constants';
import { statusFieldFor } from '../../src/content/interpreter/run';

// Tags that live on the ENEMY (or on the Game), never on a Member. `{hasStatus, on}` is
// member-scoped, so these are correctly unresolvable there.
const ENEMY_SIDE = ['vulnerable', 'stun', 'doom', 'heroPoison', 'empower', 'untargetable'];

{
  const g = new Game(1, defaultBattleConfig());
  g.start();
  const m = g.members[1];
  const unresolved = (STATUS_TAGS as readonly string[])
    .filter((t) => !ENEMY_SIDE.includes(t))
    .filter((t) => statusFieldFor(m, t) == null);
  eq('hook-sites: every member-facing status tag resolves to a real field',
    unresolved.join(', '), '');
  // Guard the guard: if the resolver started answering for everything, the check above
  // would pass vacuously and the trap would be wide open again.
  eq('hook-sites: the resolver still says no to a tag that does not exist',
    statusFieldFor(m, 'definitelyNotAStatus'), null);
}

finish('content/hook-sites');
