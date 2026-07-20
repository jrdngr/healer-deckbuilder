// Tests for the content validator and its reporter (#100).
//
// The validator is the thing that decides whether content ships, so it is checked the
// same way the assertion helpers were: it must accept what is valid AND reject what is
// not. A validator that only ever passes is indistinguishable from no validator.
import { z } from 'zod';
import {
  ActionSchema, ActionListSchema, AmountSchema, ConditionSchema, SelectorSchema,
  OP_NAMES, STATUS_TAGS, describeAmountBranch,
} from '../../src/content/schema/dsl';
import type { Action } from '../../src/content/schema/dsl';
import {
  ErrorCollector, formatReport, editDistance, nearest, suggest,
} from '../../src/content/validate/report';
import { validateActions } from '../../src/content/validate/actions';
import { TUNING_KEYS } from '../../src/constants';
import { check, eq, finish } from '../harness';

const CTX = {
  file: 'cards.json',
  basePath: 'testCard.actions',
  tuningKeys: TUNING_KEYS,
  natives: ['hexApply', 'tauntApply'],
  declaredFields: ['heal', 'selfDamage', 'name'],
};
function validate(actions: unknown[], extra: Partial<typeof CTX> = {}) {
  const errs = new ErrorCollector();
  validateActions(actions as Action[], { ...CTX, ...extra }, errs);
  return errs;
}
const ACCEPTS = (name: string, actions: unknown[]) => {
  const e = validate(actions);
  eq(name, e.count, 0);
  if (e.count) console.error('   ', e.errors.map((x) => x.message).join(' | '));
};
const REJECTS = (name: string, actions: unknown[], needle: string) => {
  const e = validate(actions);
  check(name, e.count > 0 && e.errors.some((x) => (x.message + (x.hint ?? '')).includes(needle)),
    e.count === 0 ? 'accepted an invalid action list' : e.errors.map((x) => x.message).join(' | '));
};

// --- Levenshtein and suggestions -------------------------------------------
{
  eq('distance of identical strings', editDistance('abc', 'abc'), 0);
  eq('distance of one substitution', editDistance('abc', 'abd'), 1);
  eq('distance of one insertion', editDistance('abc', 'abcd'), 1);
  eq('distance to empty', editDistance('abc', ''), 3);
  eq('distance is symmetric', editDistance('kitten', 'sitting'), editDistance('sitting', 'kitten'));
  eq('the classic case', editDistance('kitten', 'sitting'), 3);
}
{
  eq('finds the obvious near miss',
    nearest('SPOREBUST_POISON', ['SPOREBURST_POISON', 'POISON_BASE']), 'SPOREBURST_POISON');
  eq('returns null when nothing is close',
    nearest('completelyunrelated', ['heal', 'draw']), null);
  eq('a short id will not match everything', nearest('abc', ['xyz']), null);
  check('suggest formats a hint', (suggest('heaal', ['heal']) ?? '').startsWith('nearest: '));
  eq('suggest is undefined with no near match', suggest('zzzzzzzz', ['heal']), undefined);
}

// --- the reporter ----------------------------------------------------------
{
  eq('an empty error list produces no report', formatReport([]), '');
}
{
  const errs = new ErrorCollector();
  errs.add({ category: 'schema', file: 'cards.json', path: 'a.actions[1]', message: 'boom' });
  errs.unknown('ref', 'cards.json', 'b.actions[0].tune', 'tuning key', 'SPOREBUST_POISON', TUNING_KEYS);
  errs.add({ category: 'coverage', file: 'CARD_TYPE', path: '', message: 'missing 2 cards' });
  const out = formatReport(errs.errors);

  check('the header counts every error', out.startsWith('Content validation failed — 3 errors:'));
  check('it refuses to start at the end', out.trimEnd().endsWith('Refusing to start.'));
  check('it names the category', out.includes('[schema]'));
  check('it names file and path', out.includes('cards.json → a.actions[1]'));
  check('it includes the nearest-match hint', out.includes('nearest: SPOREBURST_POISON'));
  check('a pathless error omits the arrow', out.includes('[coverage] CARD_TYPE\n'));
  // schema errors sort before ref, ref before coverage
  check('errors are grouped by category',
    out.indexOf('[schema]') < out.indexOf('[ref]') && out.indexOf('[ref]') < out.indexOf('[coverage]'));
}
{
  const out = formatReport([{ category: 'ref', file: 'f', path: 'p', message: 'one' }]);
  check('a single error is not pluralized', out.startsWith('Content validation failed — 1 error:'));
}

// --- zod schemas: shape --------------------------------------------------
{
  check('a plain number is an amount', AmountSchema.safeParse(7).success);
  check('a tune ref is an amount', AmountSchema.safeParse({ tune: 'POISON_BASE' }).success);
  check('a nested sum is an amount',
    AmountSchema.safeParse({ sum: [1, { tune: 'POISON_BASE' }, { var: 'x' }] }).success);
  check('an unknown amount key is rejected', !AmountSchema.safeParse({ nope: 1 }).success);
  check('an extra key on a known form is rejected',
    !AmountSchema.safeParse({ tune: 'X', extra: 1 }).success);
}
{
  check('a bare selector name parses', SelectorSchema.safeParse('$target').success);
  check('an unknown selector is rejected', !SelectorSchema.safeParse('$nobody').success);
  check('a filtered selector parses',
    SelectorSchema.safeParse({ sel: '$allLiving', where: { hpFull: '$self' } }).success);
}
{
  check('a condition parses', ConditionSchema.safeParse({ hasRelic: 'lantern' }).success);
  check('a nested condition parses',
    ConditionSchema.safeParse({ all: [{ hasRelic: 'lantern' }, { not: { alive: '$self' } }] }).success);
  check('an unknown condition is rejected', !ConditionSchema.safeParse({ nope: true }).success);
}
{
  check('a heal op parses',
    ActionSchema.safeParse({ op: 'heal', to: '$target', amount: 4, direct: true }).success);
  check('an unknown op is rejected', !ActionSchema.safeParse({ op: 'nope' }).success);
  const bad = ActionSchema.safeParse({ op: 'heal', to: '$target', ammount: 4 });
  check('a typo\'d key is rejected', !bad.success);
  const issues = JSON.stringify(bad.error?.issues ?? []);
  check('the error names the unrecognized key', issues.includes('ammount'));
}
{ // recursion works through if/forEach
  check('a nested action list parses', ActionListSchema.safeParse([
    { op: 'if', when: { alive: '$target' },
      then: [{ op: 'forEach', over: '$allLiving', do: [{ op: 'heal', to: '$target', amount: 1 }] }],
      else: [{ op: 'log', text: 'nope', kind: 'status' }] },
  ]).success);
}
{ // emit is the one loose op — its payload varies by GameEvent kind
  check('emit accepts extra payload keys',
    ActionSchema.safeParse({ op: 'emit', kind: 'heal', slot: 1, amount: 4, hp: 12 }).success);
}
{
  eq('every op name has a schema branch', OP_NAMES.length, 29);
  check('describeAmountBranch names a branch', describeAmountBranch({ tune: 'X' }) === 'tune');
  check('describeAmountBranch rejects two keys', describeAmountBranch({ tune: 'X', var: 'y' }) === null);
  check('describeAmountBranch handles numbers', describeAmountBranch(3) === 'number');
}

// --- referential validation: the checks zod cannot do ---------------------
ACCEPTS('a valid tuning reference', [{ op: 'heal', to: '$target', amount: { tune: 'POISON_BASE' } }]);
REJECTS('a typo\'d tuning key', [{ op: 'heal', to: '$target', amount: { tune: 'SPOREBUST_POISON' } }],
  'SPOREBURST_POISON');
REJECTS('an unknown selector', [{ op: 'heal', to: '$nobody', amount: 1 }], 'selector');
REJECTS('an unknown status tag', [{ op: 'status', on: '$target', tag: 'regeneration', mode: 'set' }],
  'regen');
REJECTS('an unregistered native', [{ op: 'native', fn: 'hexAply' }], 'hexApply');
ACCEPTS('a registered native', [{ op: 'native', fn: 'hexApply' }]);

// --- the scope walk --------------------------------------------------------
ACCEPTS('a binding used after it is created', [
  { op: 'bloodPay', from: '$target', amount: 2, bind: 'paid' },
  { op: 'heal', to: '$target', amount: { var: 'paid' } },
]);
REJECTS('a binding used BEFORE it is created', [
  { op: 'heal', to: '$target', amount: { var: 'paid' } },
  { op: 'bloodPay', from: '$target', amount: 2, bind: 'paid' },
], 'not bound');
REJECTS('a typo\'d binding', [
  { op: 'bloodPay', from: '$target', amount: 2, bind: 'paid' },
  { op: 'heal', to: '$target', amount: { var: 'pais' } },
], 'paid');
REJECTS('a binding that refers to itself', [
  { op: 'let', bind: 'x', value: { var: 'x' } },
], 'not bound');
ACCEPTS('an inner scope inherits outer bindings', [
  { op: 'let', bind: 'n', value: 3 },
  { op: 'if', when: { alive: '$target' }, then: [{ op: 'heal', to: '$target', amount: { var: 'n' } }] },
]);
REJECTS('a binding made inside an if does NOT leak out', [
  { op: 'if', when: { alive: '$target' }, then: [{ op: 'let', bind: 'inner', value: 1 }] },
  { op: 'heal', to: '$target', amount: { var: 'inner' } },
], 'not bound');
ACCEPTS('a forEach alias is visible in its body', [
  { op: 'forEach', over: '$allLiving', as: 'm',
    do: [{ op: 'log', text: '{m.name} healed', kind: 'heal' }] },
]);

// --- {card: …} field checks -------------------------------------------------
ACCEPTS('a declared card field', [{ op: 'heal', to: '$target', amount: { card: 'heal' } }]);
REJECTS('an undeclared card field with no fallback',
  [{ op: 'heal', to: '$target', amount: { card: 'regen' } }], 'not declared');
ACCEPTS('an undeclared card field WITH a fallback', [
  { op: 'heal', to: '$target', amount: { card: 'regen', else: { tune: 'POISON_BASE' } } },
]);

// --- log templates ---------------------------------------------------------
ACCEPTS('a log referencing a binding', [
  { op: 'bloodPay', from: '$target', amount: 2, bind: 'paid' },
  { op: 'log', text: 'paid {paid} HP', kind: 'status' },
]);
REJECTS('a log referencing an unbound name',
  [{ op: 'log', text: 'paid {paid} HP', kind: 'status' }], 'not bound');
ACCEPTS('a log referencing an ambient path',
  [{ op: 'log', text: '{target.name} heals', kind: 'heal' }]);
ACCEPTS('a log referencing a tuning key',
  [{ op: 'log', text: 'for {SHIELD_TURNS} turns', kind: 'status' }]);
REJECTS('a log with an unknown filter',
  [{ op: 'log', text: '{SHIELD_TURNS|nope}', kind: 'status' }], 'filter');

// --- errors ACCUMULATE rather than stopping at the first ------------------
{
  const e = validate([
    { op: 'heal', to: '$nobody', amount: { tune: 'NOPE_ONE' } },
    { op: 'native', fn: 'alsoMissing' },
    { op: 'status', on: '$target', tag: 'notATag', mode: 'set' },
  ]);
  check(`every independent error is collected (got ${e.count})`, e.count >= 4);
  const msgs = e.errors.map((x) => x.message).join(' | ');
  check('the bad selector is reported', msgs.includes('selector'));
  check('the bad tuning key is reported', msgs.includes('NOPE_ONE'));
  check('the bad native is reported', msgs.includes('alsoMissing'));
  check('the bad status tag is reported', msgs.includes('notATag'));
}
{ // paths point at the offending action, not the list
  const e = validate([
    { op: 'log', text: 'ok', kind: 'status' },
    { op: 'heal', to: '$nobody', amount: 1 },
  ]);
  check('the error path names the failing index',
    e.errors.some((x) => x.path.startsWith('testCard.actions[1]')), e.errors.map((x) => x.path).join(','));
}

finish('content/validate');
