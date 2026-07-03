// All tunable values from the spec's "Numbers" section live here.
// Slots are 0,1,2 == spec slots 1,2,3 == Ranger (left), Tank (center), Mage (right).

export type Slot = 0 | 1 | 2;
// 'heavy' (big single-target hit) and 'sweep' (strong hit on the whole party) are
// the boss's signature attacks — stronger than the basic ones, but fully telegraphed.
export type AttackType = 'single' | 'two' | 'aoe' | 'hidden' | 'heavy' | 'sweep';
export type CardTarget = 'single' | 'ability' | 'dead' | 'all' | 'none';
export type MemberId = 'ranger' | 'tank' | 'mage';
export type AbilityId = 'poison' | 'taunt' | 'bolt';
export type CardId =
  | 'ability' | 'lowHeal' | 'highHeal' | 'aoeHeal'
  | 'regen' | 'shield' | 'resurrect' | 'refresh';

export interface MemberDef {
  slot: Slot;
  id: MemberId;
  name: string;
  maxHP: number;
  damage: number;
  ability: AbilityId;
}

export interface CardDef {
  id: CardId;
  name: string;
  cost: number;
  target: CardTarget;
  desc: string;
  heal?: number;
  regen?: number;
  refresh?: number;
  // "Engine" cards generate MP or draw cards (they fuel the economy). Retain is
  // ineligible for them, and later economy modifiers (Taper, #22) gate on the
  // same tag. Keep this the single source of the tag.
  engine?: boolean;
}

export const SLOT = { LEFT: 0, CENTER: 1, RIGHT: 2 } as const;

// Fixed party layout. `ability` names which ability the Ability card fires for this member.
export const MEMBER_DEFS: MemberDef[] = [
  { slot: 0, id: 'ranger', name: 'Ranger', maxHP: 11, damage: 4, ability: 'poison' },
  { slot: 1, id: 'tank', name: 'Tank', maxHP: 18, damage: 2, ability: 'taunt' },
  { slot: 2, id: 'mage', name: 'Mage', maxHP: 9, damage: 5, ability: 'bolt' },
];

// Per-member identity keyed by id. The fixed demo trio is laid out by MEMBER_DEFS
// (slot order); MEMBER_POOL is the data-driven source the post-demo roster and
// draft (#27-#31) extend so any member can occupy any slot and carry any ability.
export const MEMBER_POOL: Record<MemberId, MemberDef> = {
  ranger: MEMBER_DEFS[0],
  tank: MEMBER_DEFS[1],
  mage: MEMBER_DEFS[2],
};

export const ENEMY_MAX_HP = 100;

// Base (pre-enrage) per-target damage by attack type.
export const ATTACK_BASE_DAMAGE: Record<AttackType, number> = {
  single: 4, two: 3, aoe: 2, hidden: 4, heavy: 7, sweep: 4,
};

// Attack-type selection weights. Regular enemies never use the boss-only types
// (heavy/sweep weight 0); the boss never uses the untelegraphed 'hidden' type.
export const TYPE_WEIGHTS: Record<'normal' | 'enraged' | 'boss' | 'bossEnraged', Record<AttackType, number>> = {
  normal:      { single: 60, two: 20, aoe: 10, hidden: 10, heavy: 0,  sweep: 0 },
  enraged:     { single: 30, two: 35, aoe: 25, hidden: 10, heavy: 0,  sweep: 0 },
  boss:        { single: 20, two: 20, aoe: 10, hidden: 0,  heavy: 30, sweep: 20 },
  // Enraged sweep softened 20->10 (issue 04): enraged sweep (ceil(4x1.25)x3 = 15
  // party-wide/turn) otherwise beats the sustain ceiling and makes the post-enrage
  // race unwinnable. Halving its weight keeps the boss hard but the race winnable.
  bossEnraged: { single: 10, two: 20, aoe: 15, hidden: 0,  heavy: 35, sweep: 10 },
};

// Primary-slot weights, indexed by slot. Hidden attack uses its own profile.
export const SLOT_WEIGHTS: Record<'normal' | 'hidden', number[]> = {
  normal: [25, 50, 25],
  hidden: [40, 20, 40],
};

// Human-readable intent names for each attack type (the telegraph carries the
// numbers; this labels what the enemy is about to do).
export const ATTACK_INTENT_NAMES: Record<AttackType, string> = {
  single: 'Strike', two: 'Double Strike', aoe: 'Barrage',
  hidden: 'Veiled Strike', heavy: 'Crushing Blow', sweep: 'Sweep',
};

// ---------------------------------------------------------------------------
// Data-driven enemy definition. An EnemyDef describes an enemy's behavior — its
// attack-type selection weights (and, later, rotations/phases for the bosses).
// The per-fight difficulty numbers (maxHP, attackBonus) live on EnemyConfig, so
// the same def can be reused across the fight curve.
// ---------------------------------------------------------------------------
export type AttackWeights = Record<AttackType, number>;

export interface EnemyDef {
  id: string;
  name: string;
  boss: boolean;
  baseWeights: AttackWeights;    // attack-type selection pre-enrage
  enragedWeights: AttackWeights; // attack-type selection while enraged
}

// The two stock behaviors that reproduce the pre-refactor enemies exactly. They
// reference the existing TYPE_WEIGHTS objects so Object.entries order — and thus
// every weightedPick draw — is byte-for-byte unchanged (the #07 bit-identical gate).
export const DEFAULT_ENEMY_DEF: EnemyDef = {
  id: 'enemy', name: 'Enemy', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged,
};
export const BOSS_ENEMY_DEF: EnemyDef = {
  id: 'boss', name: 'Boss', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged,
};

// Attack-weight literal helper — keeps the six-key order consistent across defs.
const aw = (single: number, two: number, aoe: number, hidden: number, heavy: number, sweep: number): AttackWeights =>
  ({ single, two, aoe, hidden, heavy, sweep });

// Four named normals (issue 09). Each is a distinct *shape* of the same total
// threat as the old generic normal (~4.5 party-wide dmg/turn), not a difficulty
// spike — the encounter tables keep per-fight winrates within ±5pp of baseline.
export const ENEMY_SPAMMER: EnemyDef = { // single-spammer: relentless single hits
  id: 'spammer', name: 'Brute', boss: false,
  baseWeights: aw(78, 14, 4, 4, 0, 0), enragedWeights: aw(58, 24, 14, 4, 0, 0),
};
export const ENEMY_SWARM: EnemyDef = { // swarm: leans more on multi-target blows
  id: 'swarm', name: 'Swarm', boss: false,
  baseWeights: aw(52, 26, 17, 5, 0, 0), enragedWeights: aw(35, 33, 27, 5, 0, 0),
};
export const ENEMY_STALKER: EnemyDef = { // stalker: leans on concealed (hidden) blows
  id: 'stalker', name: 'Stalker', boss: false,
  baseWeights: aw(52, 10, 8, 30, 0, 0), enragedWeights: aw(35, 18, 17, 30, 0, 0),
};
export const ENEMY_CLEAVER: EnemyDef = { // cleaver: occasional heavy single hit
  id: 'cleaver', name: 'Cleaver', boss: false,
  baseWeights: aw(58, 12, 7, 5, 18, 0), enragedWeights: aw(42, 18, 12, 5, 23, 0),
};

export const NORMAL_ENEMY_DEFS: EnemyDef[] = [ENEMY_SPAMMER, ENEMY_SWARM, ENEMY_STALKER, ENEMY_CLEAVER];
export const ENEMY_DEF_BY_ID: Record<string, EnemyDef> =
  Object.fromEntries(NORMAL_ENEMY_DEFS.map((d) => [d.id, d]));

// Encounter table: weighted normal picks per fight index (the boss slot, the last
// fight, is excluded — it always uses BOSS_ENEMY_DEF). Gentler shapes early, the
// full roster (diluted) later — texture, not a difficulty spike.
export const ENCOUNTER_TABLE: Array<Array<[string, number]>> = [
  [['spammer', 70], ['swarm', 30]],                                   // fight 0
  [['spammer', 45], ['swarm', 30], ['stalker', 25]],                  // fight 1
  [['spammer', 30], ['swarm', 30], ['stalker', 25], ['cleaver', 15]], // fight 2
  [['spammer', 25], ['swarm', 25], ['stalker', 25], ['cleaver', 25]], // fight 3
];

export const ENRAGE_TURN = 11; // first enraged enemy turn (turn 11 onward)
export const ENRAGE_MULT = 1.25;

export const MP_START = 10;
export const MP_MAX = 10; // hard cap; MP never exceeds this
export const SKIP_REGEN = 5;          // Rest MP when no card was played this phase
export const SKIP_REGEN_DECAYED = 2;  // Rest MP when exactly one card was played (decaying Rest, flaw #5)
export const REFRESH_MP_CAP = 6;      // max MP a single Refresh cast may restore over its lifetime (flaw #7)
export const PASSIVE_MP_CAP = 2;      // max total passiveMp a run may buy (flaw #10)
export const CARD_REMOVAL_PRICE = 20; // unified card-removal price (flaw #17)
export const CASINO_SAFE_GOLD = 25;   // guaranteed payout if you skip the flip (flaw #18)

// Ability values.
export const BOLT_BASE = 5;
export const BOLT_CHARGE_MULT = 3; // Lightning Bolt adds this much damage per Charge
export const CHARGE_MAX = 5;
export const POISON_BASE = 5;   // Poison strength: damage dealt per enemy turn.
export const POISON_TURNS = 5;  // enemy turns Poison lasts
export const REGEN_TURNS = 3;   // player phases Regen lasts
export const REFRESH_TURNS = 3; // enemy turns Refresh lasts
export const TAUNT_TURNS = 4;
export const DEFENSE_AMOUNT = 1; // incoming damage reduced by this while Defense is active
export const DEFENSE_TURNS = 4;  // enemy turns Defense lasts (granted alongside Taunt)
export const SHIELD_TURNS = 3;   // enemy turns a raised Shield lasts before fading unused

// How casting Taunt interacts with the *standing* (already-telegraphed) attack.
// The free instant-retarget made permanent Taunt a strictly-dominant solve
// (flaw #1), so casting it now costs a real decision. Two modes ship behind this
// flag for the P1 sim/playtest (Open Q3); one is kept afterward:
//   'future'    — Taunt only redirects *future* telegraphs; the standing blow
//                 still lands where it was aimed (you must taunt a turn early).
//   'surcharge' — Taunt may redirect the standing blow now, but pays +1 MP for it.
export type TauntRetargetMode = 'future' | 'surcharge';
export const DEFAULT_TAUNT_RETARGET_MODE: TauntRetargetMode = 'surcharge';
export const TAUNT_RETARGET_SURCHARGE = 1; // extra MP to redirect the standing blow (surcharge mode)

export const HAND_SIZE = 3;

// Card definitions. `target` drives the UI's targeting flow.
//   'single' -> one living member, 'all' -> no pick, 'dead' -> one dead member,
//   'none'   -> no pick, 'ability' -> one living member (fires their ability).
export const CARDS: Record<CardId, CardDef> = {
  ability: { id: 'ability', name: 'Ability', cost: 2, target: 'ability',
    desc: 'Fire a chosen living member\'s ability.' },
  lowHeal: { id: 'lowHeal', name: 'Quick Heal', cost: 1, target: 'single', heal: 2,
    desc: 'Heal a member for 2.' },
  highHeal: { id: 'highHeal', name: 'Heal', cost: 3, target: 'single', heal: 4,
    desc: 'Heal a member for 4.' },
  aoeHeal: { id: 'aoeHeal', name: 'Group Heal', cost: 3, target: 'all', heal: 2,
    desc: 'Heal all living members for 2.' },
  regen: { id: 'regen', name: 'Regen', cost: 2, target: 'single', regen: 1,
    desc: 'Regen 1: heal 1 HP per turn for 3 enemy turns.' },
  shield: { id: 'shield', name: 'Shield', cost: 3, target: 'single',
    desc: 'Fully block the next attack instance on a member.' },
  resurrect: { id: 'resurrect', name: 'Resurrect', cost: 6, target: 'dead',
    desc: 'Revive a dead member to 50% max HP.' },
  refresh: { id: 'refresh', name: 'Refresh', cost: 3, target: 'none', refresh: 2, engine: true,
    desc: 'Refresh 2: restore 2 MP per turn for 3 enemy turns.' },
};

// The fixed 15-card starting deck (Quick Heal dropped 3 -> 2 with its buff, flaw #6).
export const DECK_LIST: CardId[] = [
  'lowHeal', 'lowHeal',
  'highHeal', 'highHeal',
  'aoeHeal', 'aoeHeal',
  'regen', 'regen',
  'refresh', 'refresh',
  'ability', 'ability', 'ability',
  'shield',
  'resurrect',
];

// ---------------------------------------------------------------------------
// Run / battle configuration
//
// The engine used to read the party, deck, and player resources straight from
// the constants above. To support a multi-battle run (persistent deck, card
// upgrades, party/healer progression, a two-action boss), the Game constructor
// now takes a BattleConfig. `defaultBattleConfig()` reproduces the original
// single fight, so `new Game(seed)` behaves exactly as before.
// ---------------------------------------------------------------------------

// Card upgrade modifiers. Cards carry up to two of these in their upgrade slots.
export type ModifierId = 'efficient' | 'potent' | 'lingering' | 'retain';

// A concrete card instance in the run deck: a base card id plus the upgrade
// modifiers applied to it. `uid` is a stable identity for picking it in shops.
export interface DeckCard {
  uid: number;
  id: CardId;
  upgrades: ModifierId[]; // length 0..2
}

export interface PartyMemberConfig {
  maxHP: number;
  damage: number;
  abilityPower: number; // bonus added to the member's base ability strength
}

export interface HealerConfig {
  maxMana: number;   // MP cap; starting MP each fight equals this
  handSize: number;
  restRegen: number; // MP regained on rest
  passiveMp: number; // MP gained at the start of each player phase
}

export interface EnemyConfig {
  maxHP: number;
  boss: boolean;       // true -> uses the stronger, fully-telegraphed boss attack pool
  attackBonus: number; // flat bonus added to each attack's per-target damage (difficulty ramp)
  def?: EnemyDef;      // enemy behavior (attack weights, name); synthesized from `boss` if omitted
}

export interface BattleConfig {
  deck: DeckCard[];
  party: PartyMemberConfig[]; // length 3, indexed by slot
  healer: HealerConfig;
  enemy: EnemyConfig;
}

export const DEFAULT_HEALER: HealerConfig = {
  maxMana: MP_MAX, handSize: HAND_SIZE, restRegen: SKIP_REGEN, passiveMp: 0,
};

export const DEFAULT_ENEMY: EnemyConfig = { maxHP: ENEMY_MAX_HP, boss: false, attackBonus: 0, def: DEFAULT_ENEMY_DEF };

export const MAX_UPGRADE_SLOTS = 2;

export function makeDeckCard(id: CardId, uid: number, upgrades: ModifierId[] = []): DeckCard {
  return { uid, id, upgrades: [...upgrades] };
}

export function defaultParty(): PartyMemberConfig[] {
  return MEMBER_DEFS.map((d) => ({ maxHP: d.maxHP, damage: d.damage, abilityPower: 0 }));
}

// The original 15-card deck as concrete instances (uid = position).
export function defaultDeck(): DeckCard[] {
  return DECK_LIST.map((id, i) => makeDeckCard(id, i));
}

export function defaultBattleConfig(): BattleConfig {
  return {
    deck: defaultDeck(),
    party: defaultParty(),
    healer: { ...DEFAULT_HEALER },
    enemy: { ...DEFAULT_ENEMY },
  };
}

// A card's effective stats after its upgrade modifiers are folded in. The engine
// and UI both read cards through resolveCard so base values and upgrades stay in
// one place. (Modifier effects are layered on in resolveCard below.)
export interface ResolvedCard {
  id: CardId;
  name: string;
  cost: number;
  target: CardTarget;
  desc: string;
  heal?: number;
  regen?: number;
  refresh?: number;
  regenTurns: number;
  refreshTurns: number;
  retain: boolean;
  upgrades: ModifierId[];
}

// ---------------------------------------------------------------------------
// Rarity (shared by every shop) and the card upgrade modifiers.
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare';
export const RARITY_PRICE: Record<Rarity, number> = { common: 25, uncommon: 50, rare: 75 };
// Lower rarities show up more often in storefronts.
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10 };

// Modifier magnitudes (per stacked copy).
export const MOD_EFFICIENT_COST = 1;   // -1 mana cost
export const MOD_POTENT_STRENGTH = 1;  // +1 to heal / regen / refresh amount
export const MOD_LINGERING_TURNS = 1;  // +1 turn of duration (Regen / Refresh)

const cardHasStrength = (id: CardId): boolean => {
  const c = CARDS[id];
  return c.heal != null || c.regen != null || c.refresh != null;
};
const cardHasDuration = (id: CardId): boolean => {
  const c = CARDS[id];
  return c.regen != null || c.refresh != null;
};

// Shared engine tag: any card that generates MP or draws cards.
export const isEngineCard = (id: CardId): boolean => CARDS[id].engine === true;

// Retain may not lock in the always-on Ability card, any engine card (that would
// make the MP-economy loop deterministic), or a 0-cost card (free perpetual value).
const retainEligible = (id: CardId): boolean =>
  id !== 'ability' && !isEngineCard(id) && CARDS[id].cost > 0;

// Efficient may not touch a 0-cost card (nothing to shave; the #02 floor already
// blocks reaching 0). Inspiration (a future engine draw card) is excluded here too
// once it exists, via the engine tag on 0-cost cards.
const efficientEligible = (id: CardId): boolean => CARDS[id].cost > 0;

export interface ModifierDef {
  id: ModifierId;
  name: string;
  rarity: Rarity;
  desc: string;
  eligible: (cardId: CardId) => boolean; // which cards this modifier may be applied to
}

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  lingering: {
    id: 'lingering', name: 'Lingering', rarity: 'common',
    desc: '+1 turn of duration.', eligible: cardHasDuration,
  },
  efficient: {
    id: 'efficient', name: 'Efficient', rarity: 'uncommon',
    desc: '-1 mana cost.', eligible: efficientEligible,
  },
  potent: {
    id: 'potent', name: 'Potent', rarity: 'uncommon',
    desc: '+1 to its healing / restore amount.', eligible: cardHasStrength,
  },
  retain: {
    id: 'retain', name: 'Retain', rarity: 'rare',
    desc: 'Not discarded at end of turn.', eligible: retainEligible,
  },
};

export const MODIFIER_IDS: ModifierId[] = ['lingering', 'efficient', 'potent', 'retain'];

// Whether `mod` can be applied to `card` right now: an open slot and eligibility.
export function canApplyModifier(card: DeckCard, mod: ModifierId): boolean {
  return card.upgrades.length < MAX_UPGRADE_SLOTS && MODIFIERS[mod].eligible(card.id);
}

// ---------------------------------------------------------------------------
// Run structure: node types, map shape, economy, and shop/event offer pools.
// ---------------------------------------------------------------------------

export type NodeType =
  | 'fight' | 'cardShop' | 'cardUpgrade' | 'partyUpgrade' | 'event' | 'healerUpgrade';

// The non-fight node types that fill the branches between fights.
export const NON_FIGHT_NODES: NodeType[] = [
  'cardShop', 'cardUpgrade', 'partyUpgrade', 'event', 'healerUpgrade',
];

// Weights for placing non-fight node types on the map.
export const NODE_TYPE_WEIGHTS: Array<[NodeType, number]> = [
  ['cardShop', 25], ['cardUpgrade', 20], ['partyUpgrade', 20], ['event', 20], ['healerUpgrade', 15],
];

export const FIGHT_COUNT = 5;        // fights 0..4; fight 4 (the last) is the boss
export const FORK_COUNT = 4;         // forks sit between consecutive fights
export const BRANCHES_PER_FORK = 2;
export const NODES_PER_BRANCH = 2;

export const GOLD_PER_FIGHT = 50;    // awarded for winning a (non-final) fight

// Enemy HP scales up each fight: the first fight is easiest, every later fight
// adds ENEMY_HP_PER_FIGHT. (Fight 0..4 -> 50/75/100/125/150, the boss last.)
export const ENEMY_BASE_HP = 50;
export const ENEMY_HP_PER_FIGHT = 25;

// Flat bonus added to every enemy attack's per-target damage, indexed by fight.
// This drives the difficulty curve: fight 0 is gentle, fights 1-3 ramp up. The
// boss (last) gets its own stronger, fully-telegraphed attack pool (see TYPE_WEIGHTS).
export const ENEMY_ATTACK_BONUS: number[] = [0, 1, 2, 2, 0];

// Storefront sizes per shop type.
export const SHOP_SIZE = { cardShop: 6, cardUpgrade: 3, partyUpgrade: 4, healerUpgrade: 3 } as const;

// Rarity of each existing card (new cards are a separate design task).
export const CARD_RARITY: Record<CardId, Rarity> = {
  lowHeal: 'common',
  regen: 'common',
  highHeal: 'uncommon',
  aoeHeal: 'uncommon',
  shield: 'uncommon',
  refresh: 'uncommon',
  ability: 'uncommon',
  resurrect: 'rare',
};

// The cards a shop can sell. Quick Heal is dropped from the pool (flaw #6): as a
// buffed 1-MP heal-2 it is a starter card, not a shop purchase.
export const CARD_POOL: CardId[] = (Object.keys(CARDS) as CardId[]).filter((id) => id !== 'lowHeal');

// Party member stat upgrades.
export type PartyStat = 'maxHP' | 'damage' | 'ability';
export interface PartyUpgradeDef {
  id: string;
  stat: PartyStat;
  amount: number;
  rarity: Rarity;
  name: string;
  desc: string;
  price?: number; // overrides the rarity price when an offer needs a bespoke cost
}
export const PARTY_UPGRADES: PartyUpgradeDef[] = [
  { id: 'hp3', stat: 'maxHP', amount: 3, rarity: 'common', name: '+3 Max HP', desc: 'Raise a member’s max HP by 3.' },
  { id: 'hp6', stat: 'maxHP', amount: 7, rarity: 'uncommon', name: '+7 Max HP', desc: 'Raise a member’s max HP by 7.' },
  { id: 'dmg1', stat: 'damage', amount: 1, rarity: 'uncommon', name: '+1 Damage', desc: 'Raise a member’s attack damage by 1.' },
  // +2 Damage is the strongest single lever; priced above its rarity (flaw #10).
  { id: 'dmg2', stat: 'damage', amount: 2, rarity: 'rare', price: 85, name: '+2 Damage', desc: 'Raise a member’s attack damage by 2.' },
  { id: 'abil1', stat: 'ability', amount: 1, rarity: 'uncommon', name: '+1 Ability', desc: 'Raise a member’s ability strength by 1.' },
];

// Healer (player) stat upgrades — each a +1 increment to a player resource.
export type HealerStat = 'maxMana' | 'handSize' | 'restRegen' | 'passiveMp';
export interface HealerUpgradeDef {
  id: string;
  stat: HealerStat;
  amount: number;
  rarity: Rarity;
  name: string;
  desc: string;
  price?: number; // overrides the rarity price when an offer needs a bespoke cost
}
export const HEALER_UPGRADES: HealerUpgradeDef[] = [
  { id: 'mana', stat: 'maxMana', amount: 1, rarity: 'common', name: '+1 Max Mana', desc: 'Raise max mana (and starting mana) by 1.' },
  // +1 Rest Regen repriced to 50g (flaw #9): it was too cheap for the sustain it buys.
  { id: 'rest', stat: 'restRegen', amount: 1, rarity: 'uncommon', name: '+1 Rest Regen', desc: 'Rest restores 1 more MP.' },
  { id: 'passive', stat: 'passiveMp', amount: 1, rarity: 'rare', name: '+1 Passive MP', desc: `Gain 1 MP at the start of each of your turns (max +${PASSIVE_MP_CAP} per run).` },
  { id: 'hand', stat: 'handSize', amount: 1, rarity: 'rare', name: '+1 Hand Size', desc: 'Draw 1 more card each turn.' },
];

// Events: a scenario, plus choices the UI dispatches on by `kind`. The actual
// random rolls / run mutations live in run.ts so they stay testable.
export type EventChoiceKind =
  | 'addCardOffer'  // show a few card offers; player picks one to add (free)
  | 'removeCard'    // deck picker; remove the chosen card (costs CARD_REMOVAL_PRICE gold)
  | 'gambleGold'    // resolve a random gold outcome
  | 'safeGold'      // take the guaranteed payout instead of the flip
  | 'shrineCard'    // pick an eligible card; apply a random eligible modifier (free)
  | 'shrineParty'   // pick a member; apply a random stat boost (free)
  | 'leave';        // decline / move on

export interface EventChoiceDef {
  label: string;
  kind: EventChoiceKind;
  detail?: string; // outcome hint shown under the label
}
export interface EventDef {
  id: string;
  title: string;
  text: string;
  choices: EventChoiceDef[];
}

export const EVENT_CARD_OFFER_SIZE = 3;

export const EVENTS: EventDef[] = [
  {
    id: 'apothecary',
    title: 'Traveling Apothecary',
    text: 'A cart of curios blocks the path. "Add to your repertoire, or shed what burdens you — no charge today."',
    choices: [
      { label: 'Buy a remedy', kind: 'addCardOffer', detail: 'Choose 1 of 3 cards to add (free).' },
      { label: 'Shed a burden', kind: 'removeCard', detail: `Remove a card from your deck (${CARD_REMOVAL_PRICE}g).` },
      { label: 'Move on', kind: 'leave' },
    ],
  },
  {
    id: 'casino',
    title: 'Casino Cart',
    text: 'A gambler flips a golden coin. "Care to test your luck, healer? No ante — but the coin bites."',
    choices: [
      { label: 'Flip the coin', kind: 'gambleGold', detail: '50% +75g · 25% +25g · 25% −25g.' },
      { label: 'Take the safe cut', kind: 'safeGold', detail: `Decline the flip for a guaranteed +${CASINO_SAFE_GOLD}g.` },
      { label: 'Walk away', kind: 'leave' },
    ],
  },
  {
    id: 'shrine',
    title: 'Forgotten Shrine',
    text: 'An old shrine to a forgotten god of mending hums with latent power. It will grant one boon — but chooses its own gift.',
    choices: [
      { label: 'Bless a card', kind: 'shrineCard', detail: 'Pick a card; it gains a random upgrade.' },
      { label: 'Bless a hero', kind: 'shrineParty', detail: 'Pick a member; they gain a random boost.' },
      { label: 'Leave', kind: 'leave' },
    ],
  },
];

// Shop offer shapes (a rolled storefront entry plus its gold price).
export interface CardOffer { cardId: CardId; rarity: Rarity; price: number; }
export interface ModifierOffer { modifier: ModifierId; rarity: Rarity; price: number; }
export interface PartyUpgradeOffer { def: PartyUpgradeDef; price: number; }
export interface HealerUpgradeOffer { def: HealerUpgradeDef; price: number; }

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
    // edge cases (e.g. it would not count as "played" against Rest).
    cost: Math.max(1, base.cost - efficient * MOD_EFFICIENT_COST),
    target: base.target,
    desc: base.desc,
    heal: bump(base.heal),
    regen: bump(base.regen),
    refresh: bump(base.refresh),
    regenTurns: REGEN_TURNS + lingering * MOD_LINGERING_TURNS,
    refreshTurns: REFRESH_TURNS + lingering * MOD_LINGERING_TURNS,
    retain,
    upgrades: card.upgrades,
  };
}
