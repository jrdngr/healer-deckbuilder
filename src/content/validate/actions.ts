// Referential validation of DSL action lists (#100).
//
// zod checks SHAPE. This checks MEANING — the class of mistake that shape cannot
// catch and that would otherwise surface as `undefined` mid-fight:
//
//   - {"tune": "SPOREBUST_POISON"}   a typo'd balance key
//   - {"var": "pais"}                a binding that no prior let/bind created
//   - {"op": "native", fn: "hexAply"} a native that is not registered
//   - {"status", tag: "regeneration"} a status tag with no writer
//   - an unknown filter or an unresolvable path inside a log template
//
// The scope walk is the valuable half: bindings are lexical, so a {"var"} is only
// legal if some earlier op in the same list — or an enclosing one — bound that name.
import type { Action, Amount, Condition, Selector } from '../schema/dsl';
import { AMOUNT_KEYS, CONDITION_KEYS, SELECTOR_NAMES, STATUS_TAGS, describeAmountBranch } from '../schema/dsl';
import { templateRefs, TEMPLATE_FILTERS } from '../interpreter/template';
import type { ErrorCollector } from './report';

export interface ActionValidationContext {
  file: string;
  /** e.g. 'transfusion.actions' — every error path is built under this. */
  basePath: string;
  /** Valid {"tune"} keys. */
  tuningKeys: readonly string[];
  /** Registered native function names. */
  natives: readonly string[];
  /** Fields the owning def declares, for {"card": "heal"} checks. */
  declaredFields?: readonly string[];
  /** Names bound before this list runs (a forEach alias, or the caller's context). */
  initialBindings?: readonly string[];
  /** Names always available to templates (target, self, card…). */
  ambientTemplatePaths?: readonly string[];
}

const AMBIENT = ['card', 'self', 'target', 'enemy', 'intent', 'enemyName',
  'holder', 'partner', 'ally', 'lifted', 'member'];

function validateSelector(
  sel: Selector, path: string, ctx: ActionValidationContext, errs: ErrorCollector,
): void {
  if (typeof sel === 'string') {
    if (!(SELECTOR_NAMES as readonly string[]).includes(sel)) {
      errs.unknown('ref', ctx.file, path, 'selector', sel, SELECTOR_NAMES);
    }
    return;
  }
  validateSelector(sel.sel, `${path}.sel`, ctx, errs);
  validateCondition(sel.where, `${path}.where`, ctx, errs, []);
}

function validateAmount(
  amt: Amount, path: string, ctx: ActionValidationContext, errs: ErrorCollector,
  bound: readonly string[],
): void {
  if (typeof amt === 'number') return;
  const branch = describeAmountBranch(amt);
  if (branch == null) {
    const keys = Object.keys(amt as object);
    errs.add({
      category: 'ref', file: ctx.file, path,
      message: keys.length === 0
        ? 'amount object is empty'
        : `amount must name exactly one of its forms, got ${JSON.stringify(keys)}`,
      hint: keys.length === 1 ? (nearestOf(keys[0], AMOUNT_KEYS) ?? undefined) : undefined,
    });
    return;
  }
  const a = amt as Record<string, unknown>;
  switch (branch) {
    case 'tune':
      if (!ctx.tuningKeys.includes(a.tune as string)) {
        errs.unknown('ref', ctx.file, `${path}.tune`, 'tuning key', a.tune as string, ctx.tuningKeys);
      }
      break;
    case 'card':
      if (ctx.declaredFields && !ctx.declaredFields.includes(a.card as string) && a.else === undefined) {
        errs.add({
          category: 'ref', file: ctx.file, path: `${path}.card`,
          message: `field ${JSON.stringify(a.card)} is not declared on this def and has no "else" fallback`,
          hint: nearestOf(a.card as string, ctx.declaredFields) ?? undefined,
        });
      }
      if (a.else !== undefined) validateAmount(a.else as Amount, `${path}.else`, ctx, errs, bound);
      break;
    case 'var':
      if (!bound.includes(a.var as string)) {
        errs.add({
          category: 'ref', file: ctx.file, path: `${path}.var`,
          message: `binding ${JSON.stringify(a.var)} is not bound by any earlier op in scope`,
          hint: nearestOf(a.var as string, bound) ?? undefined,
        });
      }
      break;
    case 'stat': case 'auto': case 'abilityPower': case 'missingHp':
      if ('of' in a) validateSelector(a.of as Selector, `${path}.of`, ctx, errs);
      else validateSelector(a[branch] as Selector, `${path}.${branch}`, ctx, errs);
      break;
    case 'vulnerable': case 'floor':
      validateAmount(a[branch] as Amount, `${path}.${branch}`, ctx, errs, bound);
      break;
    case 'clampMin':
      validateAmount(a.clampMin as Amount, `${path}.clampMin`, ctx, errs, bound);
      break;
    case 'if':
      validateCondition(a.if as Condition, `${path}.if`, ctx, errs, bound);
      validateAmount(a.then as Amount, `${path}.then`, ctx, errs, bound);
      validateAmount(a.else as Amount, `${path}.else`, ctx, errs, bound);
      break;
    case 'sum': case 'mul': case 'max': case 'min': {
      const list = a[branch] as Amount[];
      if (!Array.isArray(list) || list.length === 0) {
        errs.add({ category: 'ref', file: ctx.file, path: `${path}.${branch}`, message: `${branch} needs at least one operand` });
      } else list.forEach((x, i) => validateAmount(x, `${path}.${branch}[${i}]`, ctx, errs, bound));
      break;
    }
    default: break; // enemyStat / gameStat / telegraphStat / the three boolean forms
  }
}

function validateCondition(
  cond: Condition, path: string, ctx: ActionValidationContext, errs: ErrorCollector,
  bound: readonly string[],
): void {
  if (cond == null || typeof cond !== 'object') {
    errs.add({ category: 'ref', file: ctx.file, path, message: 'condition must be an object' });
    return;
  }
  const keys = Object.keys(cond);
  const head = (CONDITION_KEYS as readonly string[]).find((k) => keys.includes(k));
  if (!head) {
    errs.add({
      category: 'ref', file: ctx.file, path,
      message: `condition names no known form, got ${JSON.stringify(keys)}`,
      hint: keys.length ? (nearestOf(keys[0], CONDITION_KEYS) ?? undefined) : undefined,
    });
    return;
  }
  const c = cond as Record<string, unknown>;
  if (head === 'not') validateCondition(c.not as Condition, `${path}.not`, ctx, errs, bound);
  else if (head === 'all' || head === 'any') {
    (c[head] as Condition[]).forEach((x, i) => validateCondition(x, `${path}.${head}[${i}]`, ctx, errs, bound));
  } else {
    if ('of' in c) validateSelector(c.of as Selector, `${path}.of`, ctx, errs);
    if ('on' in c) validateSelector(c.on as Selector, `${path}.on`, ctx, errs);
    if (head === 'hpFull' || head === 'alive' || head === 'exists' || head === 'berserkerBandHot' || head === 'isSelf') {
      validateSelector(c[head] as Selector, `${path}.${head}`, ctx, errs);
    }
    if (head === 'hpAtOrBelow') validateAmount(c.hpAtOrBelow as Amount, `${path}.hpAtOrBelow`, ctx, errs, bound);
    if (head === 'nonZero') validateAmount(c.nonZero as Amount, `${path}.nonZero`, ctx, errs, bound);
    if (head === 'hasStatus' && !(STATUS_TAGS as readonly string[]).includes(c.hasStatus as string)) {
      errs.unknown('ref', ctx.file, `${path}.hasStatus`, 'status tag', c.hasStatus as string, STATUS_TAGS);
    }
  }
}

function validateTemplate(
  tpl: string, path: string, ctx: ActionValidationContext, errs: ErrorCollector,
  bound: readonly string[],
): void {
  const refs = templateRefs(tpl);
  const known = new Set<string>([
    ...bound,
    ...(ctx.declaredFields ?? []),
    ...ctx.tuningKeys,
    ...(ctx.ambientTemplatePaths ?? AMBIENT),
  ]);
  for (const p of [...refs.paths, ...refs.conditions]) {
    const head = p.split('.')[0];
    // A template may address a selector directly ({$mostWoundedOther.name}) — the only
    // way to name a member the action list never bound.
    if (head.startsWith('$')) {
      if (!(SELECTOR_NAMES as readonly string[]).includes(head)) {
        errs.unknown('template', ctx.file, path, 'selector', head, SELECTOR_NAMES);
      }
      continue;
    }
    if (!known.has(head)) {
      errs.add({
        category: 'template', file: ctx.file, path,
        message: `template references ${JSON.stringify(p)}, which is not bound, declared, or a tuning key`,
        hint: nearestOf(head, [...known]) ?? undefined,
      });
    }
  }
  for (const f of refs.filters) {
    if (!TEMPLATE_FILTERS.includes(f)) {
      errs.unknown('template', ctx.file, path, 'template filter', f, TEMPLATE_FILTERS);
    }
  }
}

function nearestOf(input: string, candidates: readonly string[]): string | undefined {
  // Local wrapper so this module does not import `suggest` twice over.
  let best: string | null = null, bestD = Infinity;
  for (const c of candidates) {
    let d = 0;
    // inline distance, small strings
    const a = input.toLowerCase(), b = c.toLowerCase();
    if (a === b) { d = 0; } else {
      let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
      let cur = new Array<number>(b.length + 1);
      for (let i = 1; i <= a.length; i++) {
        cur[0] = i;
        for (let j = 1; j <= b.length; j++) {
          cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        [prev, cur] = [cur, prev];
      }
      d = prev[b.length];
    }
    if (d < bestD) { bestD = d; best = c; }
  }
  return best != null && bestD <= Math.max(1, Math.floor(input.length / 3)) ? `nearest: ${best}` : undefined;
}

/**
 * Walk an action list, checking references and threading lexical bindings.
 * Returns the names bound by the end of the list (the caller does not usually care,
 * but `forEach`/`if` bodies use it to inherit scope).
 */
export function validateActions(
  actions: readonly Action[], ctx: ActionValidationContext, errs: ErrorCollector,
): string[] {
  const bound: string[] = [...(ctx.initialBindings ?? [])];

  actions.forEach((action, i) => {
    const path = `${ctx.basePath}[${i}]`;
    const a = action as Record<string, unknown>;

    // Amount-bearing fields, checked against the bindings visible RIGHT NOW —
    // before this op's own bind is added, so `{let x, value: {var: x}}` is an error.
    for (const key of ['amount', 'count', 'delta', 'times', 'value', 'turns', 'cap', 'hpFraction']) {
      if (key in a && typeof a[key] === 'object' && a[key] !== null) {
        validateAmount(a[key] as Amount, `${path}.${key}`, ctx, errs, bound);
      } else if (key in a && typeof a[key] === 'number') {
        // literal, always fine
      }
    }
    for (const key of ['to', 'from', 'on', 'over', 'primary']) {
      if (key in a) validateSelector(a[key] as Selector, `${path}.${key}`, ctx, errs);
    }
    if ('when' in a) validateCondition(a.when as Condition, `${path}.when`, ctx, errs, bound);
    if ('where' in a) validateCondition(a.where as Condition, `${path}.where`, ctx, errs, bound);

    switch (action.op) {
      case 'native':
        if (!ctx.natives.includes(action.fn)) {
          errs.unknown('ref', ctx.file, `${path}.fn`, 'native', action.fn, ctx.natives);
        }
        break;
      case 'log':
        validateTemplate(action.text, `${path}.text`, ctx, errs, bound);
        break;
      case 'letStr':
        validateTemplate(action.value, `${path}.value`, ctx, errs, bound);
        break;
      case 'strike':
        if (action.label) validateTemplate(action.label, `${path}.label`, ctx, errs, bound);
        break;
      case 'damage':
        if (action.source) validateTemplate(action.source, `${path}.source`, ctx, errs, bound);
        break;
      case 'status':
        if (!(STATUS_TAGS as readonly string[]).includes(action.tag)) {
          errs.unknown('ref', ctx.file, `${path}.tag`, 'status tag', action.tag, STATUS_TAGS);
        }
        break;
      case 'clearStatus':
        action.tags.forEach((t, ti) => {
          if (!(STATUS_TAGS as readonly string[]).includes(t)) {
            errs.unknown('ref', ctx.file, `${path}.tags[${ti}]`, 'status tag', t, STATUS_TAGS);
          }
        });
        break;
      case 'if': {
        validateActions(action.then, { ...ctx, basePath: `${path}.then`, initialBindings: bound }, errs);
        if (action.else) {
          validateActions(action.else, { ...ctx, basePath: `${path}.else`, initialBindings: bound }, errs);
        }
        break;
      }
      case 'forEach': {
        const inner = action.as ? [...bound, action.as] : bound;
        validateActions(action.do, { ...ctx, basePath: `${path}.do`, initialBindings: inner }, errs);
        break;
      }
      default: break;
    }

    // This op's own binding becomes visible to everything AFTER it.
    if (typeof a.bind === 'string') bound.push(a.bind);
  });

  return bound;
}
