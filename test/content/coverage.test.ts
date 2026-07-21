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
import { CARDS, RELIC_IDS, MEMBER_POOL, CARD_RARITY, CARD_TYPE, DRAFT_FALLBACK_PAIRS, draftOfferViable } from '../../src/constants';
import { CARD_JSON, CARD_JSON_IDS, RELIC_JSON_IDS, MEMBER_JSON_IDS, ABILITY_JSON_IDS, CARD_FAMILY, CARD_FAMILIES, MEMBER_JSON } from '../../src/content';
import { MEMBER_STRIKE } from '../../src/animations';
import { HERO_ART_IDS } from '../../src/characterArt';
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
  // Card.tsx renders `family-${CARD_FAMILY[id]}`, matched by four .card.family-* rules
  // in styles.css. This used to be a second hand-maintained table in the component, so
  // a card missing from it rendered `family-undefined` — untinted, and silent. The map
  // is derived from the JSON now; this pins that every card lands on a real CSS rule.
  const badFamily = cardIds.filter((id) => !(CARD_FAMILIES as readonly string[]).includes(CARD_FAMILY[id]));
  eq('every card tints to a known family', badFamily.join(','), '');
}

// --- presentation coverage (this file is the only place it can live) -------
{
  const memberIds = Object.keys(MEMBER_POOL).sort();
  eq('members.json is the hero table', MEMBER_JSON_IDS.join(','), memberIds.join(','));

  // Presentation is the one place a JSON-authored hero still needs TypeScript: a strike
  // animation in animations.ts and signature art in characterArt.ts. Both read sites
  // carry a fallback, so a gap degrades rather than crashing — which is exactly why it
  // needs to be loud here.
  //
  // But "loud" must not mean "blocked": requiring finished art before a hero can be
  // played would put the whole roster back behind a TypeScript edit, which is the thing
  // being fixed. So a hero may instead DECLARE `artPlaceholder: true` (plus a `color` to
  // generate a blob from). That keeps the honest distinction the passiveNative check
  // makes: intentionally-not-done is fine, accidentally-not-done is not — and either way
  // it is written down.
  const placeholder = (id: string) => MEMBER_JSON[id]?.artPlaceholder === true;
  const noStrike = memberIds.filter((id) => MEMBER_STRIKE[id] === undefined && !placeholder(id));
  eq('every hero has a strike animation (or declares artPlaceholder)', noStrike.join(','), '');
  const noArt = memberIds.filter((id) => !HERO_ART_IDS.includes(id) && !placeholder(id));
  eq('every hero has signature art (or declares artPlaceholder)', noArt.join(','), '');
  // A declared placeholder still has to be renderable, or it is a promise of art that
  // produces nothing at all.
  const unrenderable = memberIds.filter((id) => placeholder(id) && !MEMBER_JSON[id]?.color);
  eq('every artPlaceholder hero declares a color to generate from', unrenderable.join(','), '');
}
{
  eq('relics.json is the relic table', RELIC_JSON_IDS.join(','), [...RELIC_IDS].sort().join(','));
}

// --- draft data integrity ---------------------------------------------------
// The per-hero draft data (draftRating / conventionallyHealable / conventionalStriker)
// lives in members.json and is validated at startup. What startup CANNOT see is whether
// the hand-written fallback offer still holds up against it: DRAFT_FALLBACK_PAIRS is the
// guarantee that rollDraft always returns something viable, and cutting or re-rating a
// hero could quietly reference a member who no longer exists, or leave the fallback
// itself non-viable. Both would only surface as a wedged run.
{
  const known = new Set(Object.keys(MEMBER_POOL));
  const unknown = DRAFT_FALLBACK_PAIRS.flat().filter((id) => !known.has(id));
  eq('the draft fallback names only real heroes', unknown.join(','), '');
  check('the draft fallback offer is itself viable', draftOfferViable(DRAFT_FALLBACK_PAIRS));
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
