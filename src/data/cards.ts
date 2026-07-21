import type { CardId, CardType, CardDef, AbilityId, MemberId } from './tuning';
// #106: the card table is read from cards.json. Imported DIRECTLY rather than through
// src/content — content imports data/run, which imports this module, so the other
// direction would close a cycle. A raw JSON import has no imports of its own.
import CARD_JSON_RAW from '../content/cards.json';
import ABILITY_JSON from '../content/abilities.json';
import MEMBER_JSON from '../content/members.json';
import { renderTemplate } from '../content/interpreter/template';
import { TUNING } from './tuning-table';
import { MOD_EFFICIENT_COST, MOD_POTENT_STRENGTH, MOD_LINGERING_TURNS, REFRESH_MP_CAP, REFRESH_TURNS } from './tuning';
import type { DeckCard, ResolvedCard } from './run';


// Card definitions. `target` drives the UI's targeting flow.
//   'single' -> one living member, 'all' -> no pick, 'dead' -> one dead member,
//   'none'   -> no pick. Per-member ability cards (#44) are 'none' + an `ability`
//   binding: they auto-resolve on the deployed member who carries that ability.
//
// These raw defs omit `type`; CARDS (below the table) folds in each card's type
// from the exhaustive CARD_TYPE map, so the taxonomy lives in one legible place
// while CardDef.type stays a required field on the assembled table.

// ---------------------------------------------------------------------------

// The assembled card table: each raw def with its type folded in. Every card in
// CARDS therefore carries a type (typecheck-enforced by CARD_TYPE's exhaustiveness).
// #106: the card table is READ FROM cards.json, not declared here. The JSON is
// imported directly rather than through src/content — content imports data/run, which
// imports this module, so going the other way would close a cycle. A raw JSON import
// has no imports of its own and is always safe.
//
// Desc templates are resolved here, once, so every consumer (Card.tsx, KeywordText,
// the tooltip tests) sees the same plain strings it always has.
export const CARDS: Record<CardId, CardDef> = Object.freeze(
  Object.fromEntries(Object.entries(CARD_JSON_RAW).map(([id, raw]) => {
    const def = raw as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // Only engine-facing fields cross over; family/buyValue/rarity are authoring and
    // presentation metadata read from the JSON directly by their own consumers.
    for (const [k, v] of Object.entries(def)) {
      if (k === 'actions' || k === 'family' || k === 'buyValue' || k === 'rarity') continue;
      out[k] = v;
    }
    out.desc = renderTemplate(String(def.desc), { fields: def, tuning: TUNING }).text;
    return [id, out as unknown as CardDef];
  })),
) as Record<CardId, CardDef>;

/** Card type, straight off the JSON. */
export const CARD_TYPE: Record<CardId, CardType> = Object.freeze(
  Object.fromEntries(Object.entries(CARD_JSON_RAW).map(([id, raw]) =>
    [id, (raw as { type: CardType }).type])),
) as Record<CardId, CardType>;

// A card's primary type (#63). Single source read by pools, starter decks, and the
// engine's per-type synergy counters.
export const cardType = (id: CardId): CardType => CARD_TYPE[id];

// The card ids of a given type (ability cards included — their type counts for
// in-fight synergies even though they are excluded from shop/starter pools).
export const cardsOfType = (type: CardType): CardId[] =>
  (Object.keys(CARD_TYPE) as CardId[]).filter((id) => CARD_TYPE[id] === type);

// Per-type grouping (built once) for pool building and tests.
export const CARDS_BY_TYPE: Record<CardType, CardId[]> = {
  holy: cardsOfType('holy'), nature: cardsOfType('nature'), shadow: cardsOfType('shadow'),
  blood: cardsOfType('blood'), arcane: cardsOfType('arcane'), iron: cardsOfType('iron'),
};

// The fixed 7-card core starting deck (#86): the heal-only six (#51) —
// 1× Group Heal / 3× Quick Heal / 2× Heal — plus Resurrect, since heroes are
// expected to die fairly often. This is the "Standard" starter deck; the Draft
// alternative seeds Quick Heal + Heal + Resurrect and drafts the rest.
// The per-member ability cards are still inserted per deployed member at fight
// lock-in (see abilityCardsForParty), so a full trio fights with 7 + 3 = 10.
export const DECK_LIST: CardId[] = [
  'aoeHeal',
  'lowHeal', 'lowHeal', 'lowHeal',
  'highHeal', 'highHeal',
  'resurrect',
];

// The bound ability card for each ability (#44). Each member contributes exactly
// this card to the battle deck while deployed. Read from each ability's `card` field
// in abilities.json — for the learned (Training Dojo) abilities the card id happens to
// equal the ability id, but that is a coincidence the data states rather than a rule
// the code assumes.
export const ABILITY_CARD: Record<AbilityId, CardId> = Object.freeze(
  Object.fromEntries(Object.entries(ABILITY_JSON)
    .map(([id, raw]) => [id, (raw as { card: CardId }).card])),
) as Record<AbilityId, CardId>;

// Which member (by id) owns each learned ability card — the Dojo offers a hero only
// their own two. Signature ability cards are keyed off the member's `ability`, not here.
// Read from each hero's `learned` field in members.json.
export const LEARNED_CARDS_BY_MEMBER: Partial<Record<MemberId, AbilityId[]>> = Object.freeze(
  Object.fromEntries(Object.entries(MEMBER_JSON)
    .map(([id, raw]) => [id, (raw as { learned?: AbilityId[] }).learned ?? []])),
);

// The set of per-member ability card ids — excluded from the shop pool
// (they are inserted per-fight, never bought, upgraded, or removed from the run deck).
export const ABILITY_CARD_IDS: ReadonlySet<CardId> = new Set(Object.values(ABILITY_CARD));
export const isAbilityCard = (id: CardId): boolean => ABILITY_CARD_IDS.has(id);


// resolveCard (moved here from the relics region so no later layer imports a value
// from a module that itself reads CARDS at init — breaks the old TDZ cycle, #84).
export function resolveCard(card: DeckCard): ResolvedCard {
  const base = CARDS[card.id];
  let efficient = 0, potent = 0, lingering = 0;
  for (const u of card.upgrades) {
    if (u === 'efficient') efficient++;
    else if (u === 'potent') potent++;
    else if (u === 'lingering') lingering++;
  }
  const bump = (v: number | undefined): number | undefined =>
    v == null ? undefined : v + potent * MOD_POTENT_STRENGTH;
  return {
    id: base.id,
    name: base.name,
    // Efficient never drives a card below cost 1: a free card opens degenerate
    // edge cases (e.g. it would not count as "played" against Rest). Cards whose
    // BASE cost is 0 (Blood Tithe pays in HP) keep it — the floor only guards
    // against Efficient discounting a card to free, and Efficient is ineligible
    // on 0-cost cards anyway.
    cost: Math.max(Math.min(1, base.cost), base.cost - efficient * MOD_EFFICIENT_COST),
    target: base.target,
    desc: base.desc,
    heal: bump(base.heal),
    // Regen magnitude IS its duration (#52), so Lingering adds to the applied
    // amount here rather than to a separate turn count — Potent and Lingering both
    // deepen the same value. Refresh keeps its own turn count below.
    regen: base.regen == null
      ? undefined
      : base.regen + potent * MOD_POTENT_STRENGTH + lingering * MOD_LINGERING_TURNS,
    refresh: bump(base.refresh),
    draw: base.draw,
    needsRegen: base.needsRegen === true,
    needsPoison: base.needsPoison === true,
    needsChannel: base.needsChannel === true,
    needsBoar: base.needsBoar === true,
    // The cap is the BASE card's designed lifetime — Potent/Lingering change the
    // tempo of a Refresh-slot cast, never its total (flaw #7).
    refreshCap: base.refreshCap ?? REFRESH_MP_CAP,
    selfDamage: base.selfDamage,
    noDefense: base.noDefense === true,
    noTaunt: base.noTaunt === true,
    ability: base.ability,
    channel: base.channel,
    refreshTurns: REFRESH_TURNS + lingering * MOD_LINGERING_TURNS,
    upgrades: card.upgrades,
  };
}
