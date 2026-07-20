// Template interpolation for content strings (#100).
//
// Two consumers, one grammar:
//   - card/relic/ability `desc` fields, resolved ONCE at content load
//   - the `log` op's text, resolved per action against live runtime bindings
//
// Pure and DOM-free. Knows nothing about the engine — callers pass a scope.
//
// Grammar
//   {path}              lookup; dotted paths walk objects: {target.name}
//   {path|s}            plural suffix: '' when the value is exactly 1, else 's'
//   {path|pct}          percent: 0.35 -> 35
//   {cond ? a : b}      conditional; `a` and `b` are themselves templates, so
//                       {isSelf ? her own : {holder.name}'s} works
//
// Resolution order for a bare {NAME}: runtime vars, then the def's own fields, then
// TUNING. Anything unresolved is reported — never silently blanked, because a desc
// that quietly loses its number reads as finished content.

export interface TemplateScope {
  /** Runtime bindings — `let`/`bind` results, and objects like `target`. */
  vars?: Record<string, unknown>;
  /** The def's own fields (a card's `heal`, `selfDamage`, …). */
  fields?: Record<string, unknown>;
  /** The balance table; the last place a bare {NAME} is looked for. */
  tuning?: Record<string, number>;
}

export interface RenderResult {
  text: string;
  /** One entry per placeholder that could not be resolved. Empty on success. */
  errors: string[];
}

/** Every identifier a template references, for validation without a runtime scope. */
export interface TemplateRefs {
  /** Bare/dotted paths used as values. */
  paths: string[];
  /** Paths used as a conditional test. */
  conditions: string[];
  /** Filters applied, so an unknown filter is a validation error too. */
  filters: string[];
}

const KNOWN_FILTERS = new Set(['s', 'pct']);

/**
 * Find the index of the `}` matching the `{` at `open`, honouring nesting.
 * Returns -1 when unbalanced.
 */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split a conditional body into [cond, then, else] at its TOP-LEVEL `?` and `:`. */
function splitConditional(body: string): [string, string, string] | null {
  let depth = 0, q = -1, c = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (depth === 0 && ch === '?' && q === -1) q = i;
    else if (depth === 0 && ch === ':' && q !== -1 && c === -1) c = i;
  }
  if (q === -1 || c === -1) return null;
  // Branches are trimmed: authors write `{flag ? yes : no}` with spaces around the
  // separators for readability, and those spaces are punctuation, not content. Literal
  // spacing belongs in the surrounding text.
  return [body.slice(0, q).trim(), body.slice(q + 1, c).trim(), body.slice(c + 1).trim()];
}

function walkPath(root: unknown, path: string): { found: boolean; value: unknown } {
  const parts = path.split('.');
  let cur: unknown = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in (cur as object))) {
      return { found: false, value: undefined };
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return { found: true, value: cur };
}

function lookup(path: string, scope: TemplateScope): { found: boolean; value: unknown } {
  const head = path.split('.')[0];
  if (scope.vars && head in scope.vars) return walkPath(scope.vars, path);
  if (scope.fields && head in scope.fields) return walkPath(scope.fields, path);
  // A bare NAME may be a balance constant. Dotted paths never are.
  if (!path.includes('.') && scope.tuning && path in scope.tuning) {
    return { found: true, value: scope.tuning[path] };
  }
  return { found: false, value: undefined };
}

function applyFilter(value: unknown, filter: string, errors: string[], path: string): string {
  if (filter === 's') {
    return typeof value === 'number' && Math.abs(value) === 1 ? '' : 's';
  }
  if (filter === 'pct') {
    if (typeof value !== 'number') {
      errors.push(`filter |pct applied to a non-number: {${path}}`);
      return String(value);
    }
    return String(Math.round(value * 100));
  }
  errors.push(`unknown filter |${filter} in {${path}}`);
  return String(value);
}

function truthy(v: unknown): boolean {
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return Boolean(v);
}

/** Render `tpl` against `scope`. Never throws; unresolved refs land in `errors`. */
export function renderTemplate(tpl: string, scope: TemplateScope = {}): RenderResult {
  const errors: string[] = [];
  let out = '';
  let i = 0;

  while (i < tpl.length) {
    const open = tpl.indexOf('{', i);
    if (open === -1) { out += tpl.slice(i); break; }
    out += tpl.slice(i, open);

    const close = matchBrace(tpl, open);
    if (close === -1) {
      errors.push(`unbalanced '{' at index ${open}`);
      out += tpl.slice(open);
      break;
    }
    const body = tpl.slice(open + 1, close);

    const cond = splitConditional(body);
    if (cond) {
      const [test, thenTpl, elseTpl] = cond;
      const hit = lookup(test, scope);
      if (!hit.found) errors.push(`unknown condition '${test}'`);
      const branch = truthy(hit.value) ? thenTpl : elseTpl;
      const sub = renderTemplate(branch, scope);
      out += sub.text;
      errors.push(...sub.errors);
    } else {
      const [path, ...filters] = body.split('|').map((s) => s.trim());
      const hit = lookup(path, scope);
      if (!hit.found) {
        errors.push(`unknown reference '${path}'`);
        out += `{${body}}`; // leave it visible rather than silently blanking it
      } else if (filters.length === 0) {
        out += String(hit.value);
      } else {
        let acc = String(hit.value);
        for (const f of filters) acc = applyFilter(hit.value, f, errors, path);
        out += acc;
      }
    }
    i = close + 1;
  }
  return { text: out, errors };
}

/**
 * Collect every identifier a template references, WITHOUT a runtime scope — so the
 * validator can check a log template's bindings at load time rather than discovering
 * a typo mid-fight.
 */
export function templateRefs(tpl: string): TemplateRefs {
  const paths: string[] = [], conditions: string[] = [], filters: string[] = [];
  let i = 0;
  while (i < tpl.length) {
    const open = tpl.indexOf('{', i);
    if (open === -1) break;
    const close = matchBrace(tpl, open);
    if (close === -1) break;
    const body = tpl.slice(open + 1, close);
    const cond = splitConditional(body);
    if (cond) {
      conditions.push(cond[0]);
      for (const branch of [cond[1], cond[2]]) {
        const sub = templateRefs(branch);
        paths.push(...sub.paths);
        conditions.push(...sub.conditions);
        filters.push(...sub.filters);
      }
    } else {
      const [path, ...fs] = body.split('|').map((s) => s.trim());
      paths.push(path);
      filters.push(...fs);
    }
    i = close + 1;
  }
  return { paths, conditions, filters };
}

/** Filters the interpolator understands — the validator rejects anything else. */
export const TEMPLATE_FILTERS: readonly string[] = Object.freeze([...KNOWN_FILTERS].sort());
