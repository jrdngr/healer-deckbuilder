// The `native` escape hatch registry (#100).
//
// A handful of effect arms are deliberately NOT modelled in the DSL, because doing so
// would warp the schema around a shape used exactly once. They live here as ordinary
// TypeScript and content references them by name: {"op": "native", "fn": "hexApply"}.
//
// The validator enforces the registry in BOTH directions: every referenced fn must
// exist here, and every key here must be referenced by some content. An unreferenced
// native is dead code that looks alive.
//
// SIZE EXPECTATION. #99's A2 audit read all 67 arms and found the native count is a
// function of the op vocabulary, not of the arms: ~14 with a bare 22-op vocabulary,
// ~5 once letStr/collect/strike/template-conditionals exist, and 2 once the six
// derived amount forms do. With the vocabulary this migration actually ships, only
// `hex` (an array-table lookup indexed by party size) and `taunt` (a config-mode and
// MP-gated telegraph retarget with its own extra log line) are true natives. Arms are
// added here in #101/#102 as they are migrated; if this file grows past ~6 entries,
// that is a signal the vocabulary is missing something, not that the hatch is working.
//
// Imports only TYPES from the engine — see the note in interpreter/run.ts.
import type { NativeFn } from './interpreter/run';

export const NATIVES: Record<string, NativeFn> = {
  // Populated by #101 (cards) and #102 (abilities).
};

export const NATIVE_NAMES: readonly string[] = Object.freeze(Object.keys(NATIVES).sort());
