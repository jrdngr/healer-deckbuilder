// `npm run content:ls [filter]` — print the content vocabulary from the LIVE registries.
//
// Everything here is read from the same constants the validator and interpreter use, so
// it cannot describe a vocabulary the engine does not actually have. That is the point:
// a hand-written reference drifts, and a drifted reference is worse than none, because
// you trust it.
//
// The editor schema (npm run schema) covers this while you are typing inside a content
// file. This covers the other case — "what selectors exist again?" — without opening
// dsl.ts, and it greps: `npm run content:ls poison`.
import {
  OP_NAMES, SELECTOR_NAMES, AMOUNT_KEYS, CONDITION_KEYS, STATUS_TAGS, WRITE_MODES,
  PARTY_BUFF_FIELDS,
} from '../src/content/schema/dsl';
import { CONTENT_TUNING, CONTENT_TUNING_KEYS } from '../src/content/tuning';
import { NATIVE_NAMES, CHANNEL_TICK_CARDS } from '../src/content/natives';
import { VALUE_HOOKS, EVENT_HOOKS, RUN_HOOKS } from '../src/content/hooks';
import { CARD_JSON_IDS, CARD_FAMILIES } from '../src/content/cards';
import { CARD_KNOWN_FIELDS } from '../src/content/card-fields';
import { ABILITY_JSON_IDS } from '../src/content/abilities';
import { MEMBER_JSON_IDS, RELIC_JSON_IDS, ENEMY_JSON_IDS } from '../src/content/entities';

const filter = process.argv[2]?.toLowerCase();

type Section = { title: string; note?: string; items: readonly string[] };

const SECTIONS: Section[] = [
  { title: 'ops', note: 'the "op" of an action', items: OP_NAMES },
  { title: 'selectors', note: 'who an action targets', items: SELECTOR_NAMES },
  { title: 'amounts', note: 'keys of an amount object, e.g. {"tune": "X"}', items: AMOUNT_KEYS },
  { title: 'conditions', note: 'keys of a "when"/"if" object', items: CONDITION_KEYS },
  { title: 'status tags', note: 'needs a STATUS_WRITERS entry to be new', items: STATUS_TAGS },
  { title: 'write modes', note: 'the "mode" of a status write', items: WRITE_MODES },
  { title: 'party buff fields', items: PARTY_BUFF_FIELDS },
  { title: 'value hooks', note: 'take {when,set,mul,add,answer}', items: VALUE_HOOKS },
  { title: 'event hooks', note: 'take an action list', items: EVENT_HOOKS },
  { title: 'run hooks', note: 'read by Run; amounts must be static', items: RUN_HOOKS },
  { title: 'natives', note: 'the {"op":"native"} escape hatch', items: NATIVE_NAMES },
  { title: 'card fields', note: 'anything else is rejected', items: CARD_KNOWN_FIELDS },
  { title: 'card families', note: 'edge tint', items: CARD_FAMILIES },
  { title: 'channel cards', note: 'have a _tickChannel arm', items: CHANNEL_TICK_CARDS },
  // Tuning shows its VALUE — when you are picking a constant, the number is the question.
  {
    title: 'tuning constants', note: 'usable as {"tune": "NAME"}',
    items: CONTENT_TUNING_KEYS.map((k) => `${k} = ${(CONTENT_TUNING as Record<string, number>)[k]}`),
  },
  { title: 'card ids', items: CARD_JSON_IDS },
  { title: 'ability ids', items: ABILITY_JSON_IDS },
  { title: 'member ids', items: MEMBER_JSON_IDS },
  { title: 'relic ids', items: RELIC_JSON_IDS },
  { title: 'enemy ids', items: ENEMY_JSON_IDS },
];

let shown = 0;
for (const { title, note, items } of SECTIONS) {
  // Filtering keeps a section when its NAME matches, so `content:ls ops` lists them all,
  // and otherwise narrows to matching items, so `content:ls poison` finds them anywhere.
  const hit = filter && title.includes(filter);
  const matched = filter && !hit ? items.filter((i) => i.toLowerCase().includes(filter)) : items;
  if (matched.length === 0) continue;
  shown += matched.length;
  console.log(`\n${title} (${matched.length}${matched.length !== items.length ? ` of ${items.length}` : ''})${note ? ` — ${note}` : ''}`);
  // One per line when values are attached, otherwise wrapped — a 235-line tuning dump
  // and a 30-item op list want different shapes.
  if (matched.some((m) => m.includes(' = '))) {
    for (const m of matched) console.log(`  ${m}`);
  } else {
    let line = ' ';
    for (const m of matched) {
      if (line.length + m.length + 2 > 88) { console.log(line); line = ' '; }
      line += `  ${m}`;
    }
    if (line.trim()) console.log(line);
  }
}

if (filter && shown === 0) {
  console.log(`Nothing matches ${JSON.stringify(filter)}.`);
  console.log(`Sections: ${SECTIONS.map((s) => s.title).join(', ')}`);
}
