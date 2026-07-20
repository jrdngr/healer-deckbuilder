// Tests for the template interpolator (#100).
//
// This renders every card desc at load time and every log line at runtime, so a bug
// here is a bug in all content at once. The negative half matters as much as the
// positive: a placeholder that silently blanks would turn a broken desc into
// plausible-looking finished text.
import { renderTemplate, templateRefs, TEMPLATE_FILTERS } from '../../src/content/interpreter/template';
import { TUNING, CARDS } from '../../src/constants';
import { check, eq, finish } from '../harness';

const R = (tpl: string, scope = {}) => renderTemplate(tpl, scope);
const ok = (name: string, tpl: string, scope: object, expected: string) => {
  const r = renderTemplate(tpl, scope);
  eq(name, r.text, expected);
  eq(`${name} — no errors`, r.errors.length, 0);
};

// --- plain text and simple lookups -----------------------------------------
ok('passes plain text through', 'nothing to see', {}, 'nothing to see');
ok('resolves a runtime var', 'heals {amount}', { vars: { amount: 4 } }, 'heals 4');
ok('resolves a def field', 'costs {selfDamage} HP', { fields: { selfDamage: 3 } }, 'costs 3 HP');
ok('resolves a tuning key', 'lasts {SHIELD_TURNS}', { tuning: TUNING },
  `lasts ${TUNING.SHIELD_TURNS}`);
ok('resolves several in one string', '{a} then {b}', { vars: { a: 1, b: 2 } }, '1 then 2');
ok('handles a placeholder at the very start', '{a} tail', { vars: { a: 'x' } }, 'x tail');
ok('handles a placeholder at the very end', 'head {a}', { vars: { a: 'x' } }, 'head x');
ok('handles adjacent placeholders', '{a}{b}', { vars: { a: 'x', b: 'y' } }, 'xy');

// --- resolution ORDER: vars beat fields beat tuning ------------------------
{
  const scope = { vars: { N: 1 }, fields: { N: 2 }, tuning: { N: 3 } };
  ok('vars win over fields and tuning', '{N}', scope, '1');
  ok('fields win over tuning', '{N}', { fields: { N: 2 }, tuning: { N: 3 } }, '2');
  ok('tuning is the last resort', '{N}', { tuning: { N: 3 } }, '3');
}

// --- dotted paths ----------------------------------------------------------
ok('walks a dotted path', '{target.name} heals',
  { vars: { target: { name: 'Tank' } } }, 'Tank heals');
ok('walks a deep path', '{a.b.c}', { vars: { a: { b: { c: 7 } } } }, '7');
{
  const r = R('{target.missing}', { vars: { target: { name: 'Tank' } } });
  eq('a missing leaf is reported', r.errors.length, 1);
  check('the error names the path', r.errors[0].includes('target.missing'));
}
{ // a dotted path is never looked up in TUNING
  const r = R('{POISON_BASE.x}', { tuning: TUNING });
  eq('a dotted path does not resolve against tuning', r.errors.length, 1);
}

// --- unresolved refs are REPORTED and left visible -------------------------
{
  const r = R('heals {nope}', {});
  eq('an unknown reference is reported', r.errors.length, 1);
  check('the error names the reference', r.errors[0].includes('nope'));
  eq('the placeholder is left visible, not blanked', r.text, 'heals {nope}');
}
{
  const r = R('{a} and {b}', { vars: { a: 1 } });
  eq('each unknown reference is reported once', r.errors.length, 1);
  eq('the resolved half still renders', r.text, '1 and {b}');
}

// --- the |s plural filter --------------------------------------------------
ok('|s is empty for exactly one', 'turn{n|s}', { vars: { n: 1 } }, 'turn');
ok('|s pluralizes zero', 'turn{n|s}', { vars: { n: 0 } }, 'turns');
ok('|s pluralizes two', 'turn{n|s}', { vars: { n: 2 } }, 'turns');
ok('|s treats -1 as singular', 'turn{n|s}', { vars: { n: -1 } }, 'turn');
ok('|s renders the suffix only, not the number', '{n} turn{n|s}', { vars: { n: 3 } }, '3 turns');

// --- the |pct filter -------------------------------------------------------
ok('|pct scales a fraction', '+{v|pct}% damage', { vars: { v: 0.35 } }, '+35% damage');
ok('|pct rounds', '{v|pct}', { vars: { v: 0.336 } }, '34');
ok('|pct handles a whole number', '{v|pct}', { vars: { v: 1 } }, '100');
{
  const r = R('{v|pct}', { vars: { v: 'x' } });
  eq('|pct on a non-number is reported', r.errors.length, 1);
  check('the error names the filter', r.errors[0].includes('pct'));
}
{
  const r = R('{v|nope}', { vars: { v: 1 } });
  eq('an unknown filter is reported', r.errors.length, 1);
  check('the error names the unknown filter', r.errors[0].includes('nope'));
}
eq('the known filter list is exported for the validator', TEMPLATE_FILTERS.join(','), 'pct,s');

// --- conditionals ----------------------------------------------------------
ok('takes the then-branch when truthy', '{flag ? yes : no}', { vars: { flag: true } }, 'yes');
ok('takes the else-branch when falsy', '{flag ? yes : no}', { vars: { flag: false } }, 'no');
ok('treats 0 as falsy', '{n ? yes : no}', { vars: { n: 0 } }, 'no');
ok('treats a non-zero number as truthy', '{n ? yes : no}', { vars: { n: 3 } }, 'yes');
ok('treats an empty string as falsy', '{s ? yes : no}', { vars: { s: '' } }, 'no');
{ // the branches are themselves templates — this is the enGarde/sacrifice shape
  const scope = { vars: { isSelf: false, holder: { name: 'Tank' } } };
  ok('a branch may contain its own placeholder',
    "sets {isSelf ? her own : {holder.name}'s} guard", scope, "sets Tank's guard");
  ok('and the other branch is plain text',
    "sets {isSelf ? her own : {holder.name}'s} guard",
    { vars: { isSelf: true, holder: { name: 'Tank' } } }, 'sets her own guard');
}
{ // the UNTAKEN branch must not raise errors for refs it would have needed
  const r = R('{flag ? {a} : {b}}', { vars: { flag: true, a: 'A' } });
  eq('the taken branch renders', r.text, 'A');
  eq('the untaken branch is not evaluated', r.errors.length, 0);
}
{
  const r = R('{missingFlag ? a : b}', {});
  eq('an unknown condition is reported', r.errors.length, 1);
  check('the error names the condition', r.errors[0].includes('missingFlag'));
  eq('an unknown condition falls to the else branch', r.text, 'b');
}
ok('nests conditionals', '{a ? {b ? both : first} : neither}',
  { vars: { a: true, b: true } }, 'both');

// --- malformed input is reported, not thrown -------------------------------
{
  const r = R('an {unbalanced', { vars: { unbalanced: 1 } });
  eq('an unbalanced brace is reported', r.errors.length, 1);
  check('the text is still produced', r.text.length > 0);
}
ok('a bare closing brace is literal text', 'a } b', {}, 'a } b');
ok('an empty template renders empty', '', {}, '');

// --- templateRefs: static analysis without a scope --------------------------
{
  const refs = templateRefs('{a} and {b.c|s} and {t ? {d} : e}');
  check('collects plain paths', refs.paths.includes('a'));
  check('collects dotted paths', refs.paths.includes('b.c'));
  check('collects branch paths', refs.paths.includes('d'));
  check('collects conditions', refs.conditions.includes('t'));
  check('collects filters', refs.filters.includes('s'));
  check('does not treat a condition as a value path', !refs.paths.includes('t'));
}
{
  const refs = templateRefs('no placeholders here');
  eq('a plain string references nothing', refs.paths.length, 0);
}

// --- the real corpus: every card desc renders against fields + TUNING ------
// This is the check that matters for #101 — every existing desc must survive the
// grammar before any of them move into JSON.
{
  // Descs are currently produced by TS template literals, so they contain no
  // placeholders at all. Rendering them must therefore be a no-op with no errors —
  // proving the interpolator never mangles ordinary prose (apostrophes, parentheses,
  // percent signs, em dashes).
  let mangled = 0, errored = 0;
  for (const id of Object.keys(CARDS)) {
    const desc = CARDS[id as keyof typeof CARDS].desc;
    const r = renderTemplate(desc, { tuning: TUNING });
    if (r.text !== desc) { mangled += 1; console.error(`  mangled: ${id}\n    ${desc}\n    ${r.text}`); }
    if (r.errors.length > 0) { errored += 1; console.error(`  errors on ${id}: ${r.errors.join('; ')}`); }
  }
  eq('no existing card desc is mangled by the interpolator', mangled, 0);
  eq('no existing card desc produces an error', errored, 0);
}

finish('content/template');
