// Coverage checks that replace the compile-time exhaustiveness lost with the id unions
// (#106).
//
// `Record<CardId, X>` used to be exhaustive: forget a card and the build failed. With
// CardId a plain string those maps compile with holes, so the holes have to be caught
// somewhere. Two places, split by who is allowed to import what:
//
//   - CONTENT coverage (family, buyValue, type, rarity) lives in the startup validator,
//     because it is content checking itself.
//   - PRESENTATION and SIM-POLICY coverage lives HERE. The engine must never import the
//     animator or the sim policy, so those tables cannot be checked at startup without
//     creating exactly the import cycle this migration has spent its whole length
//     avoiding. A test can import both sides freely.
import { CARDS, RELIC_IDS, MEMBER_POOL, CARD_RARITY, CARD_TYPE } from '../../src/constants';
import { CARD_JSON, CARD_JSON_IDS, RELIC_JSON_IDS, MEMBER_JSON_IDS, ABILITY_JSON_IDS } from '../../src/content';
import { MEMBER_STRIKE } from '../../src/animations';
import { check, eq, finish } from '../harness';

const cardIds = Object.keys(CARDS).sort();

// --- content coverage (also enforced at startup) ---------------------------
{
  eq('cards.json is the card table', CARD_JSON_IDS.join(','), cardIds.join(','));
  const missing = (pick: (id: string) => unknown) => cardIds.filter((id) => pick(id) === undefined);
  eq('every card declares a type', missing((id) => CARD_TYPE[id]).join(','), '');
  eq('every card declares a rarity', missing((id) => CARD_RARITY[id]).join(','), '');
  eq('every card declares a family', missing((id) => CARD_JSON[id].family).join(','), '');
  eq('every card declares a buy value', missing((id) => CARD_JSON[id].buyValue).join(','), '');
}

// --- presentation coverage (this file is the only place it can live) -------
{
  const memberIds = Object.keys(MEMBER_POOL).sort();
  eq('members.json is the hero table', MEMBER_JSON_IDS.join(','), memberIds.join(','));
  const missing = memberIds.filter((id) => MEMBER_STRIKE[id] === undefined);
  eq('every hero has a strike animation', missing.join(','), '');
  // The read sites carry a fallback so a gap degrades rather than crashing, but the
  // gap itself is still a bug — this is what makes it loud.
}
{
  eq('relics.json is the relic table', RELIC_JSON_IDS.join(','), [...RELIC_IDS].sort().join(','));
}

// --- referential integrity across content files ----------------------------
{
  // Every ability a hero names must have an action list, or that hero fires nothing.
  const missing = Object.values(MEMBER_POOL)
    .map((m) => m.ability)
    .filter((a) => !ABILITY_JSON_IDS.includes(a));
  eq('every hero signature ability exists in abilities.json', missing.join(','), '');
}
{
  // Every ability CARD names an ability that exists.
  const missing = cardIds
    .map((id) => (CARDS[id] as { ability?: string }).ability)
    .filter((a): a is string => a !== undefined && !ABILITY_JSON_IDS.includes(a));
  eq('every ability card points at a real ability', missing.join(','), '');
}
{
  // ...and every ability is reachable from some card, or it can never be fired.
  const cardAbilities = new Set(cardIds
    .map((id) => (CARDS[id] as { ability?: string }).ability)
    .filter(Boolean));
  const orphans = ABILITY_JSON_IDS.filter((a) => !cardAbilities.has(a));
  eq('every ability is reachable from an ability card', orphans.join(','), '');
}

finish('content/coverage');
