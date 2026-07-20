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
import { VALUE_HOOKS, EVENT_HOOKS } from '../../src/content/hooks';
import { check, eq, finish } from '../harness';

// Every file that may host a hook seam. The run layer is included because #103's
// run-layer bus fires its own hook set from src/run.ts.
const SOURCES = ['src/engine/core.ts', 'src/engine/effects.ts', 'src/run.ts'];

const source = SOURCES.map((f) => `// ==== ${f}\n${readFileSync(f, 'utf8')}`).join('\n');

// A seam is any `_hookEvent('name'` / `_hookValue('name'` / `_hookAnswer('name'` /
// `_hookConsume('name'` / `_runHook('name'` call with a literal first argument. Literal
// names are required precisely so this scan can see them; a computed hook name would be
// invisible here and is not worth the flexibility.
const CALL = /_(?:hookEvent|hookValue|hookAnswer|hookConsume|runHook)\(\s*'([A-Za-z]+)'/g;
const fired = new Set<string>();
for (const m of source.matchAll(CALL)) fired.add(m[1]);

// Sanity-check the scanner itself before trusting its verdict. A regex that silently
// matched nothing would make every assertion below pass vacuously.
check('hook-sites: the scanner finds seams at all', fired.size > 0,
  'no hook call sites found — the scan regex is broken, not the engine');
check('hook-sites: the scanner sees a known seam', fired.has('onAbilityCast'),
  'onAbilityCast is fired from effects.ts; not seeing it means the scan is wrong');

const declared: readonly string[] = [...VALUE_HOOKS, ...EVENT_HOOKS];

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

finish('content/hook-sites');
