// All tunable values from the spec's "Numbers" section live here.
// Slots are 0,1,2 == spec slots 1,2,3 == Ranger (left), Tank (center), Mage (right).

export type Slot = 0 | 1 | 2;
export type AttackType = 'single' | 'two' | 'aoe' | 'hidden';
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
}

export const SLOT = { LEFT: 0, CENTER: 1, RIGHT: 2 } as const;

// Fixed party layout. `ability` names which ability the Ability card fires for this member.
export const MEMBER_DEFS: MemberDef[] = [
  { slot: 0, id: 'ranger', name: 'Ranger', maxHP: 8, damage: 3, ability: 'poison' },
  { slot: 1, id: 'tank', name: 'Tank', maxHP: 12, damage: 1, ability: 'taunt' },
  { slot: 2, id: 'mage', name: 'Mage', maxHP: 6, damage: 5, ability: 'bolt' },
];

export const ENEMY_MAX_HP = 100;

// Base (pre-enrage) per-target damage by attack type.
export const ATTACK_BASE_DAMAGE: Record<AttackType, number> = { single: 4, two: 3, aoe: 2, hidden: 4 };

// Attack-type selection weights.
export const TYPE_WEIGHTS: Record<'normal' | 'enraged', Record<AttackType, number>> = {
  normal: { single: 60, two: 20, aoe: 10, hidden: 10 },
  enraged: { single: 30, two: 35, aoe: 25, hidden: 10 },
};

// Primary-slot weights, indexed by slot. Hidden attack uses its own profile.
export const SLOT_WEIGHTS: Record<'normal' | 'hidden', number[]> = {
  normal: [25, 50, 25],
  hidden: [40, 20, 40],
};

export const ENRAGE_TURN = 11; // first enraged enemy turn (turn 11 onward)
export const ENRAGE_MULT = 1.25;

export const MP_START = 10;
export const MP_MAX = 10; // hard cap; MP never exceeds this
export const SKIP_REGEN = 5;

// Ability values.
export const BOLT_BASE = 5;
export const BOLT_CHARGE_MULT = 2; // Lightning Bolt adds this much damage per Charge
export const CHARGE_MAX = 5;
export const POISON_BASE = 3;   // Poison strength: damage dealt per enemy turn.
export const POISON_TURNS = 5;  // enemy turns Poison lasts
export const REGEN_TURNS = 3;   // player phases Regen lasts
export const REFRESH_TURNS = 3; // enemy turns Refresh lasts
export const TAUNT_TURNS = 3;
export const DEFENSE_AMOUNT = 1; // incoming damage reduced by this while Defense is active
export const DEFENSE_TURNS = 3;  // enemy turns Defense lasts (granted alongside Taunt)

export const HAND_SIZE = 3;

// Card definitions. `target` drives the UI's targeting flow.
//   'single' -> one living member, 'all' -> no pick, 'dead' -> one dead member,
//   'none'   -> no pick, 'ability' -> one living member (fires their ability).
export const CARDS: Record<CardId, CardDef> = {
  ability: { id: 'ability', name: 'Ability', cost: 2, target: 'ability',
    desc: 'Fire a chosen living member\'s ability.' },
  lowHeal: { id: 'lowHeal', name: 'Quick Heal', cost: 1, target: 'single', heal: 1,
    desc: 'Heal a member for 1.' },
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
  refresh: { id: 'refresh', name: 'Refresh', cost: 3, target: 'none', refresh: 2,
    desc: 'Refresh 2: restore 2 MP per turn for 3 enemy turns.' },
};

// The fixed 15-card starting deck.
export const DECK_LIST: CardId[] = [
  'lowHeal', 'lowHeal', 'lowHeal',
  'highHeal', 'highHeal',
  'aoeHeal', 'aoeHeal',
  'regen', 'regen',
  'refresh', 'refresh',
  'ability', 'ability',
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
  actionsPerTurn: number; // 1 for normal fights; 2 for the boss (2nd untelegraphed)
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

export const DEFAULT_ENEMY: EnemyConfig = { maxHP: ENEMY_MAX_HP, actionsPerTurn: 1 };

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
    desc: '-1 mana cost.', eligible: () => true,
  },
  potent: {
    id: 'potent', name: 'Potent', rarity: 'uncommon',
    desc: '+1 to its healing / restore amount.', eligible: cardHasStrength,
  },
  retain: {
    id: 'retain', name: 'Retain', rarity: 'rare',
    desc: 'Not discarded at end of turn.', eligible: () => true,
  },
};

export const MODIFIER_IDS: ModifierId[] = ['lingering', 'efficient', 'potent', 'retain'];

// Whether `mod` can be applied to `card` right now: an open slot and eligibility.
export function canApplyModifier(card: DeckCard, mod: ModifierId): boolean {
  return card.upgrades.length < MAX_UPGRADE_SLOTS && MODIFIERS[mod].eligible(card.id);
}

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
    cost: Math.max(0, base.cost - efficient * MOD_EFFICIENT_COST),
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
