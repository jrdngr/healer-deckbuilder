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

// The fixed 15-card deck.
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
