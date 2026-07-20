// cards.json loader and its validation checks (#101).
//
// The JSON is the authoring surface; this module parses it, resolves every desc
// template once, and exposes the action lists the engine dispatches on.
//
// MIGRATION STATE. `CARD_ACTIONS` starts empty for every card and fills in batch by
// batch. `_applyCard` consults it first and falls through to the legacy switch for any
// card that has not moved yet, so each batch is independently revertible and #99's
// characterization suite proves each one behaviour-identical.
import rawCards from './cards.json';
import { ActionListSchema } from './schema/dsl';
import type { Action } from './schema/dsl';
import { renderTemplate } from './interpreter/template';
import { registerCheck } from './validate/driver';
import { CONTENT_TUNING as TUNING, CONTENT_TUNING_KEYS } from './tuning';
import { NATIVE_NAMES } from './natives';
import { validateActions } from './validate/actions';
import type { ErrorCollector } from './validate/report';

export interface CardJson {
  id: string;
  name: string;
  cost: number;
  target: string;
  type: string;
  rarity?: string;
  family?: string;
  buyValue?: number;
  desc: string;
  actions: Action[];
  [key: string]: unknown;
}

const RAW = rawCards as unknown as Record<string, CardJson>;

/** Every card id declared in JSON. */
export const CARD_JSON_IDS: readonly string[] = Object.freeze(Object.keys(RAW).sort());

/**
 * Descs with their placeholders resolved, once, at load. Consumers (Card.tsx,
 * KeywordText, the tooltip tests) see plain strings exactly as they do today.
 */
export const CARD_DESCS: Record<string, string> = Object.freeze(
  Object.fromEntries(Object.entries(RAW).map(([id, def]) =>
    [id, renderTemplate(def.desc, { fields: def, tuning: TUNING }).text])),
);

/**
 * The action list per card. Empty means "not migrated yet — use the switch".
 * Frozen so a stray mutation cannot rewrite content at runtime.
 */
export const CARD_ACTIONS: Record<string, Action[]> = Object.freeze(
  Object.fromEntries(Object.entries(RAW)
    .filter(([, def]) => Array.isArray(def.actions) && def.actions.length > 0)
    .map(([id, def]) => [id, Object.freeze(def.actions) as Action[]])),
);

export const CARD_JSON: Record<string, CardJson> = Object.freeze(RAW);

/** Card fields an action may reference via {"card": "…"}. */
const CARD_AMOUNT_FIELDS = ['heal', 'regen', 'draw', 'refresh', 'refreshTurns', 'refreshCap', 'selfDamage', 'cost'];

// --- validation -------------------------------------------------------------

registerCheck({
  name: 'cards.json',
  run(_bundle, errs: ErrorCollector) {
    for (const [id, def] of Object.entries(RAW)) {
      // The def's own key and its `id` must agree, or every lookup by id silently
      // reaches a different card than the file says.
      if (def.id !== id) {
        errs.add({ category: 'ref', file: 'cards.json', path: id,
          message: `key ${JSON.stringify(id)} does not match its id field ${JSON.stringify(def.id)}` });
      }

      // Every desc placeholder must resolve. This is strictly stronger than the TS
      // template literals it replaces: a renamed constant used to be a compile error,
      // but a WRONG one was invisible. Now both are caught.
      const rendered = renderTemplate(def.desc, { fields: def, tuning: TUNING });
      for (const e of rendered.errors) {
        errs.add({ category: 'template', file: 'cards.json', path: `${id}.desc`, message: e });
      }

      // Shape, then meaning.
      const parsed = ActionListSchema.safeParse(def.actions ?? []);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errs.add({
            category: 'schema', file: 'cards.json',
            path: `${id}.actions${issue.path.map((p) => `[${String(p)}]`).join('')}`,
            message: issue.message,
          });
        }
        continue; // referential checks on a malformed list would be noise
      }
      validateActions(parsed.data as Action[], {
        file: 'cards.json',
        basePath: `${id}.actions`,
        tuningKeys: CONTENT_TUNING_KEYS,
        natives: NATIVE_NAMES,
        declaredFields: CARD_AMOUNT_FIELDS.filter((f) => def[f] !== undefined),
      }, errs);
    }
  },
});
