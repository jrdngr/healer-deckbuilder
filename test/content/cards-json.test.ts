// cards.json <-> TypeScript agreement (#101).
//
// The JSON is a faithful copy of the TS card tables, and this test is what proves it
// BEFORE anything depends on the JSON. It is migration scaffolding: it disappears in
// #106 when CARD_DEFS does, and until then it is the safety net that lets the JSON
// exist alongside the TS without either silently drifting.
//
// The desc check is the load-bearing one. Descs are TS template literals today, so a
// renamed constant is a compile error — a property the JSON loses. 30 of the 65 descs
// are therefore kept as LIVE TEMPLATES (`{SHIELD_TURNS}`) rather than frozen literals,
// and this asserts every one renders byte-identical to what ships.
import { CARDS, CARD_TYPE, CARD_RARITY, TUNING } from '../../src/constants';
import { CARD_JSON, CARD_DESCS, CARD_ACTIONS, CARD_JSON_IDS } from '../../src/content';
import { renderTemplate } from '../../src/content/interpreter/template';
import { check, eq, finish } from '../harness';

const tsIds = Object.keys(CARDS).sort();

// --- the id sets match exactly ---------------------------------------------
{
  eq('cards.json declares the same number of cards', CARD_JSON_IDS.length, tsIds.length);
  const missing = tsIds.filter((id) => !CARD_JSON_IDS.includes(id));
  const extra = CARD_JSON_IDS.filter((id) => !tsIds.includes(id));
  eq('no card is missing from cards.json', missing.join(','), '');
  eq('cards.json invents no card', extra.join(','), '');
}

// --- every scalar field agrees ---------------------------------------------
{
  const FIELDS = ['name', 'cost', 'target', 'heal', 'regen', 'draw', 'refresh', 'refreshCap',
    'selfDamage', 'ability', 'exhaust', 'engine', 'needsRegen', 'needsPoison',
    'needsChannel', 'needsBoar', 'noDefense', 'noTaunt', 'noPotent'];
  let mismatches = 0;
  for (const id of tsIds) {
    const ts = CARDS[id as keyof typeof CARDS] as unknown as Record<string, unknown>;
    const js = CARD_JSON[id] as unknown as Record<string, unknown>;
    for (const f of FIELDS) {
      if (ts[f] === undefined && js[f] === undefined) continue;
      if (ts[f] !== js[f]) {
        mismatches += 1;
        console.error(`  ${id}.${f}: ts=${JSON.stringify(ts[f])} json=${JSON.stringify(js[f])}`);
      }
    }
  }
  eq('every scalar card field agrees between TS and JSON', mismatches, 0);
}
{ // channel is an object, so it needs its own comparison
  let bad = 0;
  for (const id of tsIds) {
    const ts = (CARDS[id as keyof typeof CARDS] as { channel?: unknown }).channel;
    const js = (CARD_JSON[id] as { channel?: unknown }).channel;
    if (JSON.stringify(ts ?? null) !== JSON.stringify(js ?? null)) {
      bad += 1;
      console.error(`  ${id}.channel: ts=${JSON.stringify(ts)} json=${JSON.stringify(js)}`);
    }
  }
  eq('channel configs agree', bad, 0);
}

// --- descs render byte-identical -------------------------------------------
{
  let bad = 0, errored = 0;
  for (const id of tsIds) {
    const want = CARDS[id as keyof typeof CARDS].desc;
    if (CARD_DESCS[id] !== want) {
      bad += 1;
      console.error(`  ${id} desc\n    json: ${CARD_DESCS[id]}\n    ts:   ${want}`);
    }
    const r = renderTemplate(CARD_JSON[id].desc, { fields: CARD_JSON[id], tuning: TUNING });
    if (r.errors.length) { errored += 1; console.error(`  ${id}: ${r.errors.join('; ')}`); }
  }
  eq('every desc renders byte-identical to the TS one', bad, 0);
  eq('no desc has an unresolvable placeholder', errored, 0);
}
{ // a meaningful number of descs are LIVE TEMPLATES, not frozen literals — otherwise
  // the drift protection the TS template literals gave us is quietly gone
  const templated = CARD_JSON_IDS.filter((id) => CARD_JSON[id].desc.includes('{'));
  check(`descs keep their tuning references live (${templated.length} templated)`,
    templated.length >= 25);
  // and a spot check that one really is dynamic
  const guard = CARD_JSON.guard.desc;
  check('the Guard desc references its constants rather than inlining them',
    guard.includes('{GUARD_DR}') && guard.includes('{GUARD_TURNS}'), guard);
}

// --- the side tables folded into the JSON ----------------------------------
{
  let bad = 0;
  for (const id of tsIds) {
    if (CARD_JSON[id].type !== CARD_TYPE[id as keyof typeof CARD_TYPE]) {
      bad += 1;
      console.error(`  ${id}.type: json=${CARD_JSON[id].type} ts=${CARD_TYPE[id as keyof typeof CARD_TYPE]}`);
    }
  }
  eq('card types agree', bad, 0);
}
{
  let bad = 0;
  for (const id of tsIds) {
    const ts = CARD_RARITY[id as keyof typeof CARD_RARITY];
    if (ts !== undefined && CARD_JSON[id].rarity !== ts) {
      bad += 1;
      console.error(`  ${id}.rarity: json=${CARD_JSON[id].rarity} ts=${ts}`);
    }
  }
  eq('card rarities agree', bad, 0);
}
{ // family and buyValue moved INTO the JSON (#101) so a JSON-only card is not blocked
  // by a TS side table — the change that makes #106's acceptance test passable
  const noFamily = CARD_JSON_IDS.filter((id) => !CARD_JSON[id].family);
  const noBuy = CARD_JSON_IDS.filter((id) => CARD_JSON[id].buyValue === undefined);
  eq('every card declares a family', noFamily.join(','), '');
  eq('every card declares a buy value', noBuy.join(','), '');
  check('families are from the known set',
    CARD_JSON_IDS.every((id) => ['heal', 'ward', 'mana', 'power'].includes(CARD_JSON[id].family!)));
}

// --- migration state --------------------------------------------------------
{
  // CARD_ACTIONS holds only MIGRATED cards; the rest still run through the switch.
  // This asserts the dual-dispatch invariant rather than a fixed count, so the number
  // moves as batches land without the test needing an edit.
  const migrated = Object.keys(CARD_ACTIONS);
  check('every migrated card exists in the JSON',
    migrated.every((id) => CARD_JSON[id] !== undefined));
  check('every migrated card has a non-empty action list',
    migrated.every((id) => CARD_ACTIONS[id].length > 0));
  console.log(`  (migration: ${migrated.length}/${tsIds.length} cards on the interpreter)`);
}

finish('content/cards-json');
