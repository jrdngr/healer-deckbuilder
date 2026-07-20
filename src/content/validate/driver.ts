// The validation driver (#100).
//
// Runs every registered check, COLLECTS ALL ERRORS, and only then decides whether to
// refuse startup. Never fails fast — fixing content one error per run is the
// difference between a usable system and an unusable one.
//
// #101–#105 each add their checks by registering here; none of them touches this
// driver. That is the point of the shape: a phase adds content and its checks, and the
// startup path is unchanged.
import { ErrorCollector, formatReport, failStartup } from './report';
import type { ContentError } from './report';

/** A bundle of parsed-but-unvalidated content, keyed by source file name. */
export type ContentBundle = Record<string, unknown>;

/** One registered check. Adds to the collector; returns nothing. */
export interface ContentCheck {
  name: string;
  run(bundle: ContentBundle, errs: ErrorCollector): void;
}

const CHECKS: ContentCheck[] = [];

/** Register a check. Called at module init by each content module. */
export function registerCheck(check: ContentCheck): void {
  CHECKS.push(check);
}

/** Registered check names, for the meta-test that the registry is not silently empty. */
export function registeredChecks(): readonly string[] {
  return CHECKS.map((c) => c.name);
}

export interface ValidationResult {
  ok: boolean;
  errors: readonly ContentError[];
  report: string;
}

/** Run every registered check over the bundle. Pure — decides nothing. */
export function validateContent(bundle: ContentBundle): ValidationResult {
  const errs = new ErrorCollector();
  for (const check of CHECKS) {
    try {
      check.run(bundle, errs);
    } catch (e) {
      // A check that throws is itself a content bug (usually a malformed file that
      // an earlier check should have caught). Report it rather than taking the whole
      // process down with a stack trace — the point is to show every problem at once.
      errs.add({
        category: 'schema', file: check.name, path: '',
        message: `check threw: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
  return { ok: errs.ok, errors: errs.errors, report: formatReport(errs.errors) };
}

/**
 * Validate and, on failure, print the whole report and refuse to start.
 *
 * This is called as a MODULE-INIT SIDE EFFECT of src/content/index.ts, which
 * src/constants.ts re-exports — so it covers main.tsx and every content-touching test
 * and sim entry point with no per-entry wiring. It does NOT cover test/tooltip.test.ts
 * or test/goldFx.test.ts, which import no constants; that is harmless (they touch no
 * content) but should not be claimed as coverage.
 */
export function validateOrExit(bundle: ContentBundle): void {
  const result = validateContent(bundle);
  if (result.ok) return;
  console.error(result.report);
  failStartup();
}
