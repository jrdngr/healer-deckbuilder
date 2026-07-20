// Validation error collection and reporting (#100).
//
// Two rules, both non-negotiable:
//   1. COLLECT ALL ERRORS. Never fail fast. Fixing content one error per run is the
//      difference between a usable system and an unusable one.
//   2. Every error names file -> JSON path -> what was wrong, and suggests the nearest
//      known identifier. That last part is ~20 lines and is what makes a stringly-typed
//      content system tolerable day to day.
//
// Pure and DOM-free: this module formats strings and never touches the console itself.

export type ErrorCategory = 'schema' | 'ref' | 'coverage' | 'template';

export interface ContentError {
  category: ErrorCategory;
  /** e.g. 'cards.json' */
  file: string;
  /** e.g. 'transfusion.actions[1].then[0]' — empty for whole-file errors. */
  path: string;
  message: string;
  /** Optional second line, typically a nearest-match suggestion. */
  hint?: string;
}

/** Levenshtein distance, iterative two-row. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/**
 * The closest candidate to `input`, or null when nothing is close enough. The
 * threshold scales with length so short ids don't match everything: a 4-character
 * name accepts 1 edit, a 12-character name accepts 4.
 */
export function nearest(input: string, candidates: readonly string[]): string | null {
  if (candidates.length === 0) return null;
  const limit = Math.max(1, Math.floor(input.length / 3));
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(input.toLowerCase(), c.toLowerCase());
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= limit ? best : null;
}

/** Build the standard "did you mean" hint, or undefined when nothing is close. */
export function suggest(input: string, candidates: readonly string[]): string | undefined {
  const n = nearest(input, candidates);
  return n ? `nearest: ${n}` : undefined;
}

/** Accumulates errors across every check so the report can show all of them at once. */
export class ErrorCollector {
  readonly errors: ContentError[] = [];

  add(e: ContentError): void { this.errors.push(e); }

  /** Convenience: an unknown identifier with an automatic nearest-match hint. */
  unknown(
    category: ErrorCategory, file: string, path: string,
    what: string, value: string, candidates: readonly string[],
  ): void {
    this.errors.push({
      category, file, path,
      message: `unknown ${what} ${JSON.stringify(value)}`,
      hint: suggest(value, candidates),
    });
  }

  get ok(): boolean { return this.errors.length === 0; }
  get count(): number { return this.errors.length; }
}

const ORDER: ErrorCategory[] = ['schema', 'ref', 'template', 'coverage'];

/** Render the full report. Returns '' when there are no errors. */
export function formatReport(errors: readonly ContentError[]): string {
  if (errors.length === 0) return '';
  const sorted = [...errors].sort((a, b) => {
    const c = ORDER.indexOf(a.category) - ORDER.indexOf(b.category);
    if (c !== 0) return c;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });

  const n = errors.length;
  const lines = [`Content validation failed — ${n} error${n === 1 ? '' : 's'}:`, ''];
  for (const e of sorted) {
    const where = e.path ? `${e.file} → ${e.path}` : e.file;
    lines.push(`  [${e.category}] ${where}`);
    lines.push(`    ${e.message}`);
    if (e.hint) lines.push(`    ${e.hint}`);
    lines.push('');
  }
  lines.push('Refusing to start.');
  return lines.join('\n');
}

/**
 * Refuse to start. Under node (tests, sim) this exits non-zero so a broken content
 * file fails the suite loudly; in the browser there is no process to exit, so it
 * throws and the error surfaces in the console.
 */
export function failStartup(): never {
  if (typeof process !== 'undefined' && typeof process.exit === 'function') process.exit(1);
  throw new Error('Content validation failed — see console for details.');
}
