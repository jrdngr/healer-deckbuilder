import type { CardId, CardType, CardDef, AbilityId } from './tuning';
import { MOD_EFFICIENT_COST, MOD_POTENT_STRENGTH, MOD_LINGERING_TURNS, REFRESH_MP_CAP, REFRESH_TURNS } from './tuning';
import {
  BLOOD_BANNER_BONUS, BLOOD_BANNER_HP, BLOOD_BANNER_TURNS, CONSECRATION_HEAL, CONSECRATION_STRIKE_BONUS, CONSECRATION_STRIKE_TURNS, CRIMSON_PACT_DRAW, CRIMSON_PACT_HP, DREAD_WHISPER_REDUCTION, EMPOWER_BONUS, EN_GARDE_TURNS, FONT_MP_CAP, FORTIFY_MAX_TURNS, GUARD_DR, GUARD_TURNS, MENDING_STREAM_HEAL, MENDING_STREAM_MAX_TURNS, PENANCE_HP, PENANCE_STRIKE_BONUS, SAP_MAX_TURNS, SAP_VULN_CAP, SAP_VULN_PER_TICK, SCARLET_WARD_HP, SHARPEN_BONUS, SHARPEN_TURNS, SPOREBURST_POISON, SUNRISE_VIGIL_HEAL, TRANSFUSION_HEAL, TRANSFUSION_HP
} from './tuning';
import type { DeckCard, ResolvedCard } from './run';


// Card definitions. `target` drives the UI's targeting flow.
//   'single' -> one living member, 'all' -> no pick, 'dead' -> one dead member,
//   'none'   -> no pick. Per-member ability cards (#44) are 'none' + an `ability`
//   binding: they auto-resolve on the deployed member who carries that ability.
//
// These raw defs omit `type`; CARDS (below the table) folds in each card's type
// from the exhaustive CARD_TYPE map, so the taxonomy lives in one legible place
// while CardDef.type stays a required field on the assembled table.
const CARD_DEFS: Record<CardId, Omit<CardDef, 'type'>> = {
  // --- per-member ability cards (#44): the healer enables the member's move ----
  // One is inserted into the battle deck for each deployed member; cost mirrors the
  // old generic Ability card (2 MP). Unplayable while the bound member is down.
  imbuePoison: { id: 'imbuePoison', name: 'Poison Tip', cost: 2, target: 'none', ability: 'poison',
    desc: 'Dip the Ranger\'s arrows — Poison the enemy.' },
  bolster: { id: 'bolster', name: 'Bolster', cost: 2, target: 'none', ability: 'taunt',
    desc: 'Steel the Tank — they Taunt the enemy and brace.' },
  unleash: { id: 'unleash', name: 'Unleash', cost: 2, target: 'none', ability: 'bolt',
    desc: 'Unleash the Mage\'s stored Charge as a Lightning Bolt.' },
  hex: { id: 'hex', name: 'Evil Eye', cost: 2, target: 'none', ability: 'hex',
    desc: 'The Warlock gives the enemy the Evil Eye — it takes more damage (more with fewer allies).' },
  conduct: { id: 'conduct', name: 'Conduct', cost: 2, target: 'none', ability: 'crescendo',
    desc: 'Cue the Busker\'s Crescendo — draw cards.' },
  incite: { id: 'incite', name: 'Rile Up', cost: 2, target: 'none', ability: 'rampage',
    desc: 'Rile up the Berserker — a doubled strike at an HP cost.' },
  beckon: { id: 'beckon', name: 'Beckon', cost: 2, target: 'none', ability: 'callBoar',
    desc: 'Beckon the Beast Warden\'s Boar to soak hits at her side.' },
  // Halt! (#61) costs 5 MP — the higher price (vs the 2 MP other ability cards) is
  // the balance lever: no once-per-fight cap, the MP burn plus the tempo lost toward
  // enrage is what limits stunning.
  stagger: { id: 'stagger', name: 'Halt!', cost: 5, target: 'none', ability: 'stun',
    desc: 'Through the Showstopper, Stun the enemy — cancel its telegraphed action.' },
  // En Garde (#74): the Duelist Provokes a chosen member (Taunt) and grants them the
  // persistent Riposte stance (herself included).
  enGarde: { id: 'enGarde', name: 'En Garde', cost: 2, target: 'single', ability: 'enGarde',
    desc: `Through the Duelist, a chosen member Provokes (enemy aims at them) and gains Riposte for ${EN_GARDE_TURNS} enemy turns — they counter every hit that strikes them.` },
  // Feat of Strength (#75) is a Blood ability card (incite precedent — target 'none', counts
  // toward the blood type counters). It carries NO selfDamage field: the payment is not the
  // clamped canPlay Blood gate but a raw lethal drain in _fireAbility (this ability is meant to
  // be castable at any HP — a lethal Feat is a legal, informed sacrifice, so there is no
  // ">N HP" playability gate). The Sanguine surcharge is applied in the engine, not via _bloodCost.
  penance: { id: 'penance', name: 'Feat of Strength', cost: 2, target: 'none', ability: 'penance',
    desc: `Through the Strongman, pay ${PENANCE_HP} HP (no clamp — it can kill him); every living member's auto deals +${PENANCE_STRIKE_BONUS} for 2 enemy turns.` },
  lowHeal: { id: 'lowHeal', name: 'Quick Heal', cost: 1, target: 'single', heal: 2,
    desc: 'Heal a member for 2.' },
  highHeal: { id: 'highHeal', name: 'Heal', cost: 3, target: 'single', heal: 4,
    desc: 'Heal a member for 4.' },
  aoeHeal: { id: 'aoeHeal', name: 'Group Heal', cost: 3, target: 'all', heal: 2,
    desc: 'Heal all living members for 2.' },
  regen: { id: 'regen', name: 'Regen', cost: 2, target: 'single', regen: 2,
    desc: 'Regen +2: heal 2, then 1, decaying each turn. Adds to an existing Regen.' },
  shield: { id: 'shield', name: 'Shield', cost: 3, target: 'single',
    desc: 'Fully block the next attack instance on a member.' },
  // Resurrect reworked (#18, flaw #14): 6 MP -> 4. Revives to 50% max HP (the earlier
  // return-behind-a-Shield rider was removed in the content-cut pass).
  resurrect: { id: 'resurrect', name: 'Resurrect', cost: 4, target: 'dead',
    desc: 'Revive a dead member to 50% max HP.' },
  cleanse: { id: 'cleanse', name: 'Cleanse', cost: 1, target: 'none',
    desc: 'Remove all negative status effects from the party.' },
  bloom: { id: 'bloom', name: 'Bloom', cost: 2, target: 'single', needsRegen: true,
    desc: 'Consume a member\'s Regen: heal them for its full remaining amount at once.' },
  fontOfMana: { id: 'fontOfMana', name: 'Refresh', cost: 3, target: 'none',
    refresh: 3, refreshCap: FONT_MP_CAP, engine: true,
    desc: 'Restore 3 MP per turn for 3 enemy turns.' },
  inspiration: { id: 'inspiration', name: 'Inspiration', cost: 2, target: 'none', draw: 2, engine: true,
    desc: 'Draw 2 cards.' },
  // --- card set phase B (#16): cards with small new engine state -------------
  lifebloom: { id: 'lifebloom', name: 'Lifebloom', cost: 3, target: 'single', regen: 2,
    desc: 'Regen +2 (decays each turn); when it ends while the target lives, burst-heal 3.' },
  battleHymn: { id: 'battleHymn', name: 'Fight Song', cost: 1, target: 'none',
    desc: 'Every living member\'s attack this turn deals +2.' },
  barrier: { id: 'barrier', name: 'Barrier', cost: 4, target: 'all',
    desc: 'Every living member gains a Shield; unused ones fade after the next enemy phase.' },
  bloodTithe: { id: 'bloodTithe', name: 'Elbow Grease', cost: 0, target: 'single', selfDamage: 4, engine: true,
    desc: 'A member with more than 4 HP pays 4 HP; restore 2 MP.' },
  martyrsGift: { id: 'martyrsGift', name: 'Helping Hand', cost: 2, target: 'single', selfDamage: 3, heal: 4,
    desc: 'A member with more than 3 HP pays 3 HP; every other living member heals 4.' },
  // --- card set phase C (#17): the Bulwark / Defense pipeline ----------------
  phalanx: { id: 'phalanx', name: 'Turtle Up', cost: 2, target: 'single', noDefense: true, noTaunt: true,
    desc: 'Defense 2 for 2 enemy turns. Cannot target a defended or taunting member.' },
  // Taunt-lite (#31): make any member the enemy's aim — the taunt-less draft's
  // redirection tool, so the Tank isn't mandatory in every party.
  provoke: { id: 'provoke', name: 'Provoke', cost: 1, target: 'single',
    desc: 'The target Taunts (enemy aims at them) for 2 enemy turns.' },
  // --- Iron mitigation web (#65): steer hits onto one member ------------------
  // Feint redirects EVERY hit of the standing telegraph onto one member (a
  // multi-hit blow stacks all its hits on them) — reuses the taunt-retarget path,
  // but as a card effect with no MP surcharge (the card's cost is the price).
  feint: { id: 'feint', name: 'Feint', cost: 1, target: 'single',
    desc: 'Redirect every hit of the standing telegraph onto the target member.' },
  // --- Regen conversions (#66): spend Regen across domains --------------------
  // Sporeburst consumes the whole remaining Regen and converts every consumed tick
  // into a turn of enemy Poison (via the wave-wide poison stacking rule). needsRegen-gated.
  sporeburst: { id: 'sporeburst', name: 'Sporeburst', cost: 2, target: 'single', needsRegen: true,
    desc: `Consume the target's Regen; Poison the enemy ${SPOREBURST_POISON}/turn for as many turns as ticks consumed.` },
  // --- Status-window management (#67): Poison / Vulnerability as resources -----
  // Hemorrhage cashes the enemy's whole Poison out in one uncapped hit (per-turn ×
  // turns left) through _damageEnemy, so Vulnerability multiplies the cash-out (the
  // poison ticks it consumes stay unmultiplied). needsPoison-gated.
  hemorrhage: { id: 'hemorrhage', name: 'Goo Burst', cost: 3, target: 'none', needsPoison: true,
    desc: `Consume the enemy's Poison and deal its whole remaining damage (per-turn × turns left) at once.` },
  // Trash Talk shaves the standing telegraph by 1 per target (floor 0) — stacks
  // with every other reduction to zero out a sweep.
  dreadWhisper: { id: 'dreadWhisper', name: 'Trash Talk', cost: 1, target: 'none',
    desc: `The standing telegraph deals ${DREAD_WHISPER_REDUCTION} less per target (min 0).` },
  // --- Blood + cycling (#68): HP as a spendable resource ---------------------
  // Paper Cuts draws 2 through the normal draw path (a reshuffle mid-draw fires
  // Fidget Beads); like Inspiration it is `engine`-tagged (draw effect), so
  // Retain/Efficient are ineligible. 0-MP — the HP is the cost (Elbow Grease precedent).
  crimsonPact: { id: 'crimsonPact', name: 'Paper Cuts', cost: 0, target: 'single', selfDamage: CRIMSON_PACT_HP, draw: CRIMSON_PACT_DRAW, engine: true,
    desc: `A member with more than ${CRIMSON_PACT_HP} HP pays ${CRIMSON_PACT_HP} HP; draw ${CRIMSON_PACT_DRAW}.` },
  scarletWard: { id: 'scarletWard', name: 'Thick Skin', cost: 1, target: 'single', selfDamage: SCARLET_WARD_HP,
    desc: `A member with more than ${SCARLET_WARD_HP} HP pays ${SCARLET_WARD_HP} HP; gain a Shield.` },
  transfusion: { id: 'transfusion', name: 'Blood Drive', cost: 1, target: 'single', selfDamage: TRANSFUSION_HP, heal: TRANSFUSION_HEAL,
    desc: `A member with more than ${TRANSFUSION_HP} HP pays ${TRANSFUSION_HP} HP; the most wounded other member heals ${TRANSFUSION_HEAL}.` },
  // Pep Rally has no ">N HP" gate (clamped, target 'none'): every living member
  // pays, and the payment leaves each at 1 HP minimum.
  bloodBanner: { id: 'bloodBanner', name: 'Pep Rally', cost: 2, target: 'none',
    desc: `Every living member pays ${BLOOD_BANNER_HP} HP (clamps to 1); the party's autos deal +${BLOOD_BANNER_BONUS} for ${BLOOD_BANNER_TURNS} enemy turns.` },
  // --- Holy board-state payoffs (#69) ----------------------------------------
  // Special Delivery queues a delayed party heal: at the START of your next turn (after the
  // enemy blow and the Regen tick, before the draw) every living member heals. Cast twice,
  // it queues twice. The wave's timing tool — heal AFTER the blow lands.
  sunriseVigil: { id: 'sunriseVigil', name: 'Special Delivery', cost: 2, target: 'none',
    desc: `At the start of your next turn, heal every living member ${SUNRISE_VIGIL_HEAL}.` },
  // Glow Up heals the whole party a little; members at FULL HP afterward turn the
  // surplus into offense — a standing +auto for a couple enemy turns.
  consecration: { id: 'consecration', name: 'Glow Up', cost: 3, target: 'all', heal: CONSECRATION_HEAL,
    desc: `Heal all ${CONSECRATION_HEAL}; members at full HP afterward gain +${CONSECRATION_STRIKE_BONUS} auto for ${CONSECRATION_STRIKE_TURNS} enemy turns.` },
  // --- arcane support (#70) --------------------------------------------------
  // Arcane Lens: arm a one-shot turn flag — the NEXT single-target heal this turn also
  // applies its full amount to the most wounded other member (routes through the normal
  // heal pipeline, so Field Triage / Twin Censer / Beacon all interact). Splash-heal tool.
  arcaneLens: { id: 'arcaneLens', name: 'Arcane Lens', cost: 2, target: 'none',
    desc: 'Your next single-target heal this turn also heals the most wounded other member for the same amount.' },
  // --- channeled cards (#64): sustained effects that end when you play a card ------
  mendingStream: { id: 'mendingStream', name: 'Mending Stream', cost: 2, target: 'single',
    channel: { maxTurns: MENDING_STREAM_MAX_TURNS, single: true },
    desc: `Channel: heal a member for ${MENDING_STREAM_HEAL} each turn (up to ${MENDING_STREAM_MAX_TURNS} turns). Ends if they die or you play a card.` },
  sap: { id: 'sap', name: 'Sap', cost: 2, target: 'none',
    channel: { maxTurns: SAP_MAX_TURNS },
    desc: `Channel: each turn make the enemy more Vulnerable (+${Math.round(SAP_VULN_PER_TICK * 100)}% up to +${Math.round(SAP_VULN_CAP * 100)}%), for up to ${SAP_MAX_TURNS} turns. Playing any card ends it.` },
  fortify: { id: 'fortify', name: 'Fortify', cost: 2, target: 'single',
    channel: { maxTurns: FORTIFY_MAX_TURNS, single: true },
    desc: `Channel: grant a member a Shield each turn (up to ${FORTIFY_MAX_TURNS} turns). Ends if they die or you play a card.` },
  // --- hero buff card batch (#62): proactive per-hero buffs -------------------
  guard: { id: 'guard', name: 'Guard', cost: 1, target: 'single',
    desc: `A hero takes ${GUARD_DR} less damage per hit for ${GUARD_TURNS} enemy turns. Stacks with Defense, not with itself.` },
  sharpen: { id: 'sharpen', name: 'Sharpen', cost: 1, target: 'single',
    desc: `A hero's attacks deal +${SHARPEN_BONUS} for ${SHARPEN_TURNS} enemy turns.` },
  // Encore (rare): doubles the chosen hero's next basic auto (not an ability).
  doubleStrike: { id: 'doubleStrike', name: 'Encore', cost: 2, target: 'single',
    desc: 'A hero\'s next basic attack lands doubled, then is spent.' },
  empower: { id: 'empower', name: 'Empower', cost: 1, target: 'single',
    desc: `A hero's next ability fires at +${EMPOWER_BONUS} ability power, then is spent.` },
  riposte: { id: 'riposte', name: 'Riposte', cost: 2, target: 'single',
    desc: 'The next attack that hits a hero, they counterattack for their damage.' },
};

// ---------------------------------------------------------------------------
// Card types (#63): the exhaustive taxonomy. This map IS the mapping table — being
// a Record<CardId, CardType> it is typecheck-exhaustive: every card must appear (a
// missing one is a compile error), and CARDS folds each type onto its def below. A
// type is a THEME, not a rulebook — the outliers are called out inline.
// ---------------------------------------------------------------------------
export const CARD_TYPE: Record<CardId, CardType> = {
  // Holy — one-shot heals, resurrect, purify (the current starter core).
  lowHeal: 'holy', highHeal: 'holy', aoeHeal: 'holy', resurrect: 'holy', cleanse: 'holy',
  mendingStream: 'holy', /* channeled Holy heal (#64) */
  sunriseVigil: 'holy', consecration: 'holy', /* Holy board-state payoffs (#69) */
  // Nature — the regen family, and buffs generally (incl. combat buffs).
  regen: 'nature', bloom: 'nature', lifebloom: 'nature',
  sporeburst: 'nature', /* Regen conversion (#66) */
  battleHymn: 'nature', /* outlier: offense buff */
  imbuePoison: 'nature', /* outlier: venom/toxin DoT */ beckon: 'nature', /* outlier: summon */
  sharpen: 'nature', doubleStrike: 'nature', empower: 'nature', riposte: 'nature',
  // Shadow — enemy debuffs and direct damage to the enemy.
  unleash: 'shadow', hex: 'shadow', stagger: 'shadow', /* Stun: enemy control */
  sap: 'shadow', /* channeled Shadow (#64) */
  hemorrhage: 'shadow', dreadWhisper: 'shadow', /* Status-window management (#67) */
  // Blood — sacrifice something (usually HP) to gain something.
  bloodTithe: 'blood', martyrsGift: 'blood',
  incite: 'blood', /* outlier: HP-cost doubled strike */
  crimsonPact: 'blood', scarletWard: 'blood', transfusion: 'blood', bloodBanner: 'blood', /* Blood + cycling (#68) */
  penance: 'blood', /* Flagellant's lethal-blood ability card (#75); counts toward blood counters */
  // Arcane — the mana / card-draw economy.
  fontOfMana: 'arcane', inspiration: 'arcane', conduct: 'arcane',
  arcaneLens: 'arcane', /* arcane support (#70) */
  // Iron — protection: shields, Defense, Taunt/Provoke.
  shield: 'iron', barrier: 'iron', phalanx: 'iron', provoke: 'iron',
  bolster: 'iron', guard: 'iron',
  fortify: 'iron', /* channeled Iron shield (#64) */
  feint: 'iron', /* Iron mitigation web (#65) */
  enGarde: 'iron', /* Duelist's Provoke + persistent-Riposte stance (#74); Iron Ward's first-iron discount applies */
};

// The assembled card table: each raw def with its type folded in. Every card in
// CARDS therefore carries a type (typecheck-enforced by CARD_TYPE's exhaustiveness).
export const CARDS: Record<CardId, CardDef> = Object.fromEntries(
  (Object.keys(CARD_DEFS) as CardId[]).map((id) => [id, { ...CARD_DEFS[id], type: CARD_TYPE[id] }]),
) as Record<CardId, CardDef>;

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

// The fixed 6-card core starting deck: the heal-only six (#51) —
// 1× Group Heal / 3× Quick Heal / 2× Heal, and nothing else. This is the "Standard"
// starter deck; the Draft alternative seeds Quick Heal + Heal and drafts the rest.
// The per-member ability cards are still inserted per deployed member at fight
// lock-in (see abilityCardsForParty), so a full trio fights with 6 + 3 = 9.
export const DECK_LIST: CardId[] = [
  'aoeHeal',
  'lowHeal', 'lowHeal', 'lowHeal',
  'highHeal', 'highHeal',
];

// The bound ability card for each ability (#44). Each member contributes exactly
// this card to the battle deck while deployed.
export const ABILITY_CARD: Record<AbilityId, CardId> = {
  poison: 'imbuePoison',
  taunt: 'bolster',
  bolt: 'unleash',
  hex: 'hex',
  crescendo: 'conduct',
  rampage: 'incite',
  callBoar: 'beckon',
  stun: 'stagger',
  enGarde: 'enGarde',
  penance: 'penance',
};

// The set of per-member ability card ids — excluded from the shop pool and Retain
// (they are inserted per-fight, never bought, upgraded, or removed from the run deck).
export const ABILITY_CARD_IDS: ReadonlySet<CardId> = new Set(Object.values(ABILITY_CARD));
export const isAbilityCard = (id: CardId): boolean => ABILITY_CARD_IDS.has(id);


// resolveCard (moved here from the relics region so no later layer imports a value
// from a module that itself reads CARDS at init — breaks the old TDZ cycle, #84).
export function resolveCard(card: DeckCard): ResolvedCard {
  const base = CARDS[card.id];
  let efficient = 0, potent = 0, lingering = 0, retain = false;
  for (const u of card.upgrades) {
    if (u === 'efficient') efficient++;
    else if (u === 'potent') potent++;
    else if (u === 'lingering') lingering++;
    else if (u === 'retain') retain = true;
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
    // The cap is the BASE card's designed lifetime — Potent/Lingering change the
    // tempo of a Refresh-slot cast, never its total (flaw #7).
    refreshCap: base.refreshCap ?? REFRESH_MP_CAP,
    selfDamage: base.selfDamage,
    noDefense: base.noDefense === true,
    noTaunt: base.noTaunt === true,
    ability: base.ability,
    channel: base.channel,
    refreshTurns: REFRESH_TURNS + lingering * MOD_LINGERING_TURNS,
    retain,
    upgrades: card.upgrades,
  };
}
