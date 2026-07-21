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
import { NATIVE_NAMES, CHANNEL_TICK_CARDS } from './natives';
import { validateActions } from './validate/actions';
import { suggest } from './validate/report';
import { CARD_KNOWN_FIELDS } from './card-fields';
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

/** A card's type, straight off the JSON — used by the `cardType` hook condition. */
export const CARD_TYPE_OF = (id: string): string | undefined => RAW[id]?.type;

/**
 * The visual families, as a closed set: heals green, protective wards gold, mana
 * economy blue, aggressive power plays red-purple. Presentation only — but closed,
 * because each one is a `.card.family-*` rule in styles.css and an unknown value
 * would render an untinted card with no error.
 */
export const CARD_FAMILIES = ['heal', 'ward', 'mana', 'power'] as const;
export type CardFamily = (typeof CARD_FAMILIES)[number];

/**
 * Every card's edge-tint family, read from cards.json. This used to be a second,
 * hand-maintained table in Card.tsx keyed by card id — a card missing from it
 * rendered `family-undefined` silently. The JSON is the one source now, and the
 * check below refuses to start on an unknown value.
 */
export const CARD_FAMILY: Record<string, CardFamily> = Object.freeze(
  Object.fromEntries(Object.entries(RAW).map(([id, def]) => [id, def.family as CardFamily])),
);

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

      // The edge tint is a closed set of CSS rules. An unknown (or missing) family
      // used to render an untinted card with no error at all; now it is a startup
      // failure that names the nearest legal value.
      if (!(CARD_FAMILIES as readonly string[]).includes(def.family as string)) {
        errs.add({
          category: 'ref', file: 'cards.json', path: `${id}.family`,
          message: `unknown card family ${JSON.stringify(def.family ?? null)}`,
          hint: suggest(String(def.family ?? ''), CARD_FAMILIES),
        });
      }

      // An unrecognised field would be dropped by resolveCard and never reach the
      // engine — see CARD_KNOWN_FIELDS. Catches typos ("healing") and genuinely new
      // fields that have not been threaded through yet, which look identical from here.
      for (const field of Object.keys(def)) {
        if (!CARD_KNOWN_FIELDS.includes(field)) {
          errs.add({ category: 'ref', file: 'cards.json', path: `${id}.${field}`,
            message: `unknown card field ${JSON.stringify(field)} — it would be dropped by resolveCard and never reach the engine. If it is new, add it to CARD_KNOWN_FIELDS and thread it through resolveCard.`,
            hint: suggest(field, CARD_KNOWN_FIELDS) });
        }
      }

      // A channel whose per-tick behaviour has no engine arm counts down doing nothing.
      // See CHANNEL_TICK_CARDS — this is the declared-exception check, not a ban.
      if (def.channel && !CHANNEL_TICK_CARDS.includes(id)) {
        errs.add({ category: 'coverage', file: 'cards.json', path: `${id}.channel`,
          message: `declares a channel but has no arm in Game._tickChannel — it would occupy the channel slot and tick down doing nothing. Add the arm, then name it in CHANNEL_TICK_CARDS.` });
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

    // The other direction: an engine arm for a card that no longer channels (or no
    // longer exists) is dead code that reads as live support for a feature.
    for (const id of CHANNEL_TICK_CARDS) {
      if (!RAW[id]) {
        errs.add({ category: 'coverage', file: 'cards.json', path: id,
          message: `CHANNEL_TICK_CARDS names ${JSON.stringify(id)}, which is not a card`,
          hint: suggest(id, CARD_JSON_IDS) });
      } else if (!RAW[id].channel) {
        errs.add({ category: 'coverage', file: 'cards.json', path: `${id}.channel`,
          message: `CHANNEL_TICK_CARDS names ${JSON.stringify(id)}, but it declares no channel — the engine arm is dead` });
      }
    }
  },
});
