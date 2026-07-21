// Emits JSON Schema for the content files, so the editor can autocomplete and
// error-check them as you type. Run: `npm run schema`.
//
// WHY THIS EXISTS. The DSL is deliberately key-discriminated — `{"tune": "X"}`,
// `{"card": "heal"}`, `{"sum": [...]}` — rather than tagged, because tagging would
// roughly double the size of every content file (see the note atop schema/dsl.ts). That
// is the right call for authoring, but it means you cannot guess the vocabulary from
// context: ~25 amount branches, ~14 selectors and 30 ops, none of them announced by a
// discriminator the editor can key off. Without a schema you author with dsl.ts open in
// a second window. With one, the editor offers the branches.
//
// The zod schemas in schema/dsl.ts already describe all of this at runtime, so the
// action/hook halves are GENERATED rather than restated — they cannot drift from the
// validator. Only the per-file envelopes (which fields a card has, versus a relic) are
// hand-written here, because zod never described them: CardJson ends in
// `[key: string]: unknown`, which is exactly why a typo'd `"healing": 3` has always
// validated cleanly and done nothing.
//
// The envelopes set `additionalProperties: false`. That is the whole point — it turns
// that class of typo from a silent no-op into a red squiggle at the keystroke.
//
// NOT wired up via a `$schema` key inside the files: they are flat id-keyed maps, so a
// `"$schema"` key would parse as a card/relic/hero named `$schema` and fail the
// key-matches-id check. The mapping lives in .vscode/settings.json instead.
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ActionListSchema } from '../src/content/schema/dsl';
import { HookBlockSchema } from '../src/content/hooks';
import { CONTENT_TUNING_KEYS } from '../src/content/tuning';
import { NATIVE_NAMES } from '../src/content/natives';
import { CARD_JSON_IDS, CARD_FAMILIES } from '../src/content/cards';
import { ABILITY_JSON_IDS } from '../src/content/abilities';

type Json = Record<string, any>;

const CARD_TYPES = ['holy', 'nature', 'shadow', 'blood', 'arcane', 'iron'];
const RARITIES = ['common', 'uncommon', 'rare'];
const TARGETS = ['single', 'dead', 'all', 'none'];

/**
 * zod emits `tune` and `fn` as bare strings — it only knows they are strings, not that
 * they must name something in a registry. Tightening them to enums is where most of the
 * day-to-day value is: it makes {"tune": …} autocomplete every balance constant, and it
 * turns a mistyped constant into an editor error instead of a startup one. Everything
 * else (op, tag, mode) already emits as a proper enum from z.enum/z.literal.
 */
function tightenRegistryStrings(node: any): void {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(tightenRegistryStrings); return; }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && value && typeof value === 'object') {
      const props = value as Json;
      if (props.tune?.type === 'string' && !props.tune.enum) props.tune.enum = [...CONTENT_TUNING_KEYS];
      if (props.fn?.type === 'string' && !props.fn.enum) props.fn.enum = [...NATIVE_NAMES];
    }
    tightenRegistryStrings(value);
  }
}

/**
 * Emit one zod schema, and lift its internal `$defs` up to the output file's root.
 *
 * zod emits recursive schemas as a root `$defs` of `__schema0..N` plus `$ref`s written
 * as `#/$defs/__schema0` — always resolved against the DOCUMENT root. Nesting the result
 * under our own `$defs.actions` therefore silently breaks every one of those refs, since
 * `#/$defs/__schema0` no longer exists at the root. (Silently to a reader; ajv says
 * "can't resolve reference", which is how this was caught.)
 *
 * So the generated defs are hoisted to the root and namespaced per source schema — both
 * ActionListSchema and HookBlockSchema number their defs from zero, and merging them
 * unprefixed would have one silently overwrite the other's `__schema0`.
 */
function emit(schema: z.ZodType, prefix: string): { body: Json; defs: Json } {
  const js = z.toJSONSchema(schema as any, { io: 'input', unrepresentable: 'any' }) as Json;
  tightenRegistryStrings(js);
  const { $defs = {}, ...body } = js;
  const rename = (s: string) => `${prefix}_${s}`;
  const retarget = (node: any): any => {
    if (node == null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(retarget);
    const out: Json = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === '$ref' && typeof v === 'string' && v.startsWith('#/$defs/')
        ? `#/$defs/${rename(v.slice('#/$defs/'.length))}`
        : retarget(v);
    }
    return out;
  };
  const defs: Json = {};
  for (const [k, v] of Object.entries($defs as Json)) defs[rename(k)] = retarget(v);
  return { body: retarget(body), defs };
}

const actionsEmit = emit(ActionListSchema, 'act');
const hooksEmit = emit(HookBlockSchema, 'hook');
const actions = actionsEmit.body;
const hooks = hooksEmit.body;

/**
 * Wrap a per-entry envelope as the id-keyed map the file actually is. `propertyNames`
 * pins ids to the identifier shape the loaders assume; the key-matches-id rule itself
 * stays in the validator, which can report it far better than a schema can.
 */
function idMap(title: string, entry: Json): Json {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title,
    type: 'object',
    propertyNames: { pattern: '^[a-zA-Z][a-zA-Z0-9]*$' },
    additionalProperties: entry,
  };
}

/** Shared sub-schemas, plus the hoisted generated defs their $refs point at. */
const defs = { actions, hooks, ...actionsEmit.defs, ...hooksEmit.defs };
const ACTIONS_REF = { $ref: '#/$defs/actions' };
const HOOKS_REF = { $ref: '#/$defs/hooks' };

const cards = idMap('cards.json — the card table', {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'cost', 'target', 'type', 'rarity', 'family', 'buyValue', 'desc', 'actions'],
  properties: {
    id: { type: 'string', description: 'Must equal this entry\'s key.' },
    name: { type: 'string' },
    cost: { type: 'integer', minimum: 0, description: 'MP cost.' },
    target: { type: 'string', enum: TARGETS },
    type: { type: 'string', enum: CARD_TYPES, description: 'The card\'s one primary type — a theme, not a rulebook.' },
    rarity: { type: 'string', enum: RARITIES },
    family: { type: 'string', enum: [...CARD_FAMILIES], description: 'Edge tint only. Each value is a .card.family-* rule in styles.css.' },
    buyValue: { type: 'integer', minimum: 0 },
    desc: { type: 'string', description: 'Supports {field}, {tune}, {x|s}, {x|pct}, {cond ? a : b}, {$selector.field}.' },
    actions: ACTIONS_REF,
    // Engine-facing optional fields, as used by the current table.
    ability: { type: 'string', enum: [...ABILITY_JSON_IDS], description: 'Marks this a per-member ability card, auto-resolved on the deployed member carrying that ability.' },
    heal: { type: 'integer' },
    regen: { type: 'integer' },
    draw: { type: 'integer' },
    selfDamage: { type: 'integer' },
    refresh: { type: 'integer' },
    refreshTurns: { type: 'integer' },
    refreshCap: { type: 'integer' },
    exhaust: { type: 'boolean', description: 'Leaves play after one use.' },
    noDefense: { type: 'boolean' },
    noTaunt: { type: 'boolean' },
    needsBoar: { type: 'boolean' },
    needsRegen: { type: 'boolean' },
    needsPoison: { type: 'boolean' },
    engine: { type: 'boolean', description: 'Marks a mana-economy card (isEngineCard) — the "engine" of the deck, not an engine-code escape hatch.' },
    channel: {
      type: 'object',
      additionalProperties: false,
      required: ['maxTurns'],
      properties: {
        maxTurns: { type: 'integer', minimum: 1 },
        single: { type: 'boolean', description: 'Channel ends early if its remembered target dies.' },
      },
      description: 'A channel ALSO needs an arm in Game._tickChannel and a name in CHANNEL_TICK_CARDS, or it ticks down doing nothing. The validator enforces this.',
    },
  },
});

const abilities = idMap('abilities.json — hero abilities', {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'card', 'actions'],
  properties: {
    id: { type: 'string' },
    card: { type: 'string', enum: [...CARD_JSON_IDS], description: 'The card a deployed member carrying this ability contributes to the deck.' },
    actions: ACTIONS_REF,
  },
});

const relics = idMap('relics.json — relics and curses', {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'rarity', 'icon', 'desc'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    rarity: { type: 'string', enum: RARITIES },
    icon: { type: 'string', description: 'Rendered as a literal glyph.' },
    curse: { type: 'boolean' },
    desc: { type: 'string' },
    hooks: HOOKS_REF,
  },
});

const members = idMap('members.json — the hero roster', {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slot', 'maxHP', 'damage', 'ability',
    'draftRating', 'conventionallyHealable', 'conventionalStriker'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slot: { type: 'integer', minimum: 0, maximum: 2, description: 'Default slot only — any hero can occupy any slot.' },
    maxHP: { type: 'integer', minimum: 1 },
    damage: { type: 'integer', minimum: 0, description: 'In-fight auto damage. NOT the draft rating.' },
    ability: { type: 'string', enum: [...ABILITY_JSON_IDS] },
    draftRating: { type: 'integer', minimum: 0, description: 'Conservative damage rating the draft viability check sums. NOT in-fight damage.' },
    conventionallyHealable: { type: 'boolean', description: 'Counts toward the draft\'s healable floor. False for heroes healing works oddly on.' },
    conventionalStriker: { type: 'boolean', description: 'Deals reliable self-sufficient damage; a viable draft needs at least one.' },
    learned: { type: 'array', items: { type: 'string', enum: [...ABILITY_JSON_IDS] }, description: 'The abilities the Training Dojo can teach this hero.' },
    passiveFlavor: {
      type: 'object', additionalProperties: false, required: ['name', 'desc'],
      properties: { name: { type: 'string' }, desc: { type: 'string' } },
      description: 'Promises the player a passive — so it needs either hooks or passiveNative behind it, which the validator enforces.',
    },
    hooks: HOOKS_REF,
    passiveNative: { type: 'string', description: 'Declares a passive that is DELIBERATELY still engine code.' },
  },
});

const TARGETS_OUT: Array<[string, Json]> = [
  ['cards', cards], ['abilities', abilities], ['relics', relics], ['members', members],
];

for (const [name, schema] of TARGETS_OUT) {
  const out = { ...schema, $defs: defs };
  writeFileSync(`src/content/schema/${name}.schema.json`, `${JSON.stringify(out, null, 2)}\n`);
}

console.log(`wrote ${TARGETS_OUT.length} schemas to src/content/schema/`);
console.log(`  ${CONTENT_TUNING_KEYS.length} tuning keys and ${NATIVE_NAMES.length} natives inlined as enums`);
