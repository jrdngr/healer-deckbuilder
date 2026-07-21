// The card field vocabulary. A LEAF module: it imports nothing, deliberately.
//
// Both cards.ts (to reject unknown fields) and runlayer.ts (to check the field names a
// modifier's eligibility rule mentions) need this list. Importing it from cards.ts into
// runlayer.ts closes a module-init cycle that ends in
// "Cannot access 'HERO_HEAL_PCT' before initialization" — the same TDZ hazard data/
// tuning.ts is a leaf to avoid. tsc does not catch it; it only shows up at runtime.
//
// So the list lives on its own, importable from anywhere at init.

/**
 * Every field a card entry may carry.
 *
 * This exists because of a specific silent failure. `resolveCard` in data/cards.ts
 * hand-lists the fields it copies from the card table onto the ResolvedCard the engine
 * actually reads — it has to, because most get upgrade math applied on the way across
 * (Potent bumps `heal`, Lingering deepens `regen`, Efficient discounts `cost`). A field
 * that is not in that list reaches CARDS and then stops: `ResolvedCard` is a declared
 * interface, so the extra field is simply absent downstream. No type error, no validator
 * complaint, no test — you author `"lifesteal": 2`, the card validates, and the engine
 * never sees it.
 *
 * A closed field set turns that into a startup error. It does NOT stop you adding a
 * field — it makes you add it in both places, which is the actual requirement.
 *
 * Must track `CardDef` in data/tuning.ts, INCLUDING fields no card currently sets:
 * `noPotent` is declared, read by isPotentEligible, and set by zero cards today, so
 * leaving it out would have rejected the first card to legitimately opt out of Potent.
 */
export const CARD_KNOWN_FIELDS: readonly string[] = Object.freeze([
  // Envelope / presentation.
  'id', 'name', 'cost', 'target', 'type', 'rarity', 'family', 'buyValue', 'desc', 'actions',
  // Engine-facing. Each of these is threaded by resolveCard.
  'ability', 'heal', 'regen', 'draw', 'refresh', 'refreshTurns', 'refreshCap', 'selfDamage',
  'exhaust', 'noDefense', 'noTaunt', 'needsBoar', 'needsRegen', 'needsPoison', 'needsChannel',
  'noPotent', 'engine', 'channel',
]);
