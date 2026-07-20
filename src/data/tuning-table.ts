// The tuning constants as a lookup record, so content JSON can reference a balance
// number by name: {"tune": "POISON_BASE"}.
//
// WHY THIS IS ITS OWN MODULE (a deliberate deviation from #100's acceptance criterion,
// which said `tuning.ts` exports TUNING):
//
// Building the record inside tuning.ts requires that module to import ITSELF
// (`import * as SELF from './tuning'`) to enumerate its own exports. That works only
// while the record is the very last statement in the file — any `const` declared after
// it is still in the temporal dead zone when `Object.entries` walks the namespace, and
// reading it throws at import time. src/data/cards.ts:335 documents a prior TDZ
// import-cycle bite (#84) in this exact dependency layer, and #100 itself warns that
// re-introducing one is the easiest way to break startup.
//
// A separate leaf module has no cycle at all: tuning-table -> tuning -> (nothing).
// A const added anywhere in tuning.ts is picked up automatically, in any position.
import * as T from './tuning';

// Only the numeric exports are addressable from JSON. The table also holds arrays and
// records (HEX_VULN_BY_SIZE, SLOT, TYPE_WEIGHTS…); those are structural, not balance
// dials, and an amount expression that resolved to one would be a type error waiting
// to happen. The validator rejects a {"tune"} reference to anything not in here.
export const TUNING: Record<string, number> = Object.freeze(
  Object.fromEntries(
    Object.entries(T as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  ),
);

// Sorted key list — the corpus the validator's nearest-key suggestions search.
export const TUNING_KEYS: readonly string[] = Object.freeze(Object.keys(TUNING).sort());
