// abilities.json loader and its validation checks (#102).
//
// Abilities are keyed by AbilityId, not by card: one hero can fire several (a signature
// plus anything learned at the Dojo), and `_fireAbility` switches on the ability being
// FIRED rather than the member's signature.
//
// The interpreter context differs from a card's: `self` is the carrier, `target` is the
// picked slot for the handful of target-'single' ability cards, and there is no `card`
// — so {"card": …} amounts are unavailable here by construction.
import rawAbilities from './abilities.json';
import { ActionListSchema } from './schema/dsl';
import type { Action } from './schema/dsl';
import { registerCheck } from './validate/driver';
import { CONTENT_TUNING_KEYS } from './tuning';
import { NATIVE_NAMES } from './natives';
import { validateActions } from './validate/actions';
import type { ErrorCollector } from './validate/report';

export interface AbilityJson { id: string; actions: Action[] }

const RAW = rawAbilities as unknown as Record<string, AbilityJson>;

export const ABILITY_JSON_IDS: readonly string[] = Object.freeze(Object.keys(RAW).sort());

/** Action list per ability. Absent means "not migrated yet — use the switch". */
export const ABILITY_ACTIONS: Record<string, Action[]> = Object.freeze(
  Object.fromEntries(Object.entries(RAW)
    .filter(([, def]) => Array.isArray(def.actions) && def.actions.length > 0)
    .map(([id, def]) => [id, Object.freeze(def.actions) as Action[]])),
);

// Every ability a hero or an ability card names must exist here, or the hero fires
// nothing and the card is a dead draw. Checked from this side because abilities.json is
// the file that would be missing an entry.
registerCheck({
  name: 'abilities.json',
  run(_bundle, errs: ErrorCollector) {
    for (const [id, def] of Object.entries(RAW)) {
      if (def.id !== id) {
        errs.add({ category: 'ref', file: 'abilities.json', path: id,
          message: `key ${JSON.stringify(id)} does not match its id field ${JSON.stringify(def.id)}` });
      }
      const parsed = ActionListSchema.safeParse(def.actions ?? []);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errs.add({ category: 'schema', file: 'abilities.json',
            path: `${id}.actions${issue.path.map((p) => `[${String(p)}]`).join('')}`,
            message: issue.message });
        }
        continue;
      }
      validateActions(parsed.data as Action[], {
        file: 'abilities.json',
        basePath: `${id}.actions`,
        tuningKeys: CONTENT_TUNING_KEYS,
        natives: NATIVE_NAMES,
        declaredFields: [], // no card in scope: {"card": …} is unavailable to abilities
      }, errs);
    }
  },
});
