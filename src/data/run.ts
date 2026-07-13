import type { CardId, CardType, CardTarget, CardChannelDef, AbilityId, MemberId, MemberDef } from './tuning';
import { MP_MAX, HAND_SIZE, SKIP_REGEN, PASSIVE_MP_CAP, CARD_REMOVAL_PRICE, CASINO_SAFE_GOLD } from './tuning';
import { ENEMY_MAX_HP, DEFAULT_ENEMY_DEF } from './enemies';
import type { EnemyDef } from './enemies';
import { partyFromMembers, CLASSIC_TRIO, MEMBER_DEFS, MEMBER_POOL, memberDefAt } from './members';
import { CARDS, cardsOfType, isAbilityCard, ABILITY_CARD, resolveCard, DECK_LIST } from './cards';
import type { RelicId } from './relics';

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
  // Current HP (#58). On a ROSTER member this persists across fights: a member ends
  // a fight hurt and carries that HP forward (healed only HERO_HEAL_PCT between
  // fights). Absent means "full" — a fresh member, and the standalone/quick-play
  // battle party that has no run layer to persist it. Threaded into the fight via
  // Run.toBattleConfig (clamped to the injury-adjusted max) and read back out on a
  // win (Run.winFight). Never set on the length-3 battle party's empty slots.
  hp?: number;
  damage: number;
  abilityPower: number; // bonus added to the member's base ability strength
  // Persistent death-scars (DR1). A member accrues one each time it dies in a
  // won fight (see Run.recordInjuries); the count drives an escalating stat
  // penalty (injuryPenalty below) that is applied to the fight config in
  // Run.toBattleConfig and cleared for gold at an Infirmary node. Kept SEPARATE
  // from the base stats so clearing restores them exactly and does not entangle
  // with permanent party upgrades.
  injuries: number; // 0..MAX_INJURIES
  // Drafted identity (#27): which pool member sits in this slot. Absent means the
  // classic trio member for the slot (backward-compatible with pre-draft configs).
  member?: MemberId;
  // 'incapacitate' injury mode: the member enters the fight dead and cannot be
  // Resurrected (see INJURY_RULES). Absent/false everywhere else.
  incapacitated?: boolean;
  // An unfilled deploy slot: no member is seated here for this fight. The engine
  // builds it as an absent member (dead, untargetable, unstriking) so a 1- or
  // 2-member deployment leaves the remaining battle slots inert. Only ever set on
  // the length-3 battle party built in Run.toBattleConfig — never on a roster member.
  empty?: boolean;
  // Count of permanent stat upgrades applied to this roster member (2026-07). Drives
  // the member's salary (memberSalary): each upgrade raises the fee to field them.
  // Absent/0 on a fresh member and on the battle party (a run-layer concern only).
  upgrades?: number;
}

// ---------------------------------------------------------------------------
// Injuries / scars (DR1). Death used to cost only the current fight's output —
// the party was rebuilt at full HP for free — so optimal play spent members.
// A death now leaves a persistent, escalating scar, so protecting members is
// correct play (and the revive kit finally earns its cost). Each member scars
// by ITS OWN death count, capped at MAX_INJURIES:
//   1st death → "Cracked"  (−max HP)
//   2nd death → "Weakened" (−1 damage)
//   3rd death → "Broken"   (−1 ability power)
// The tables give the TOTAL penalty at a given injury count (indexed count−1),
// i.e. they are cumulative-by-tier, not per-tier increments: a Cracked member
// keeps just the HP penalty even after taking the Weakened and Broken scars.
// Flat, not percentage — legible on the card and clean to sim/pin (a percentage
// rounds ugly on the 9-HP mage). Exact magnitudes are sim-tuned.
// ---------------------------------------------------------------------------
export const MAX_INJURIES = 3;
export const INJURY_MAXHP: number[] = [2, 2, 2];   // Cracked: −2 max HP from the 1st scar on
export const INJURY_DAMAGE: number[] = [0, 1, 1];  // Weakened: −1 damage from the 2nd scar on
export const INJURY_ABILITY: number[] = [0, 0, 1]; // Broken: −1 ability power from the 3rd scar

// Human-readable scar names by tier index (0 = 1st death). Used by the UI and
// the Infirmary. The first MAX_INJURIES are the graded scars; the last ('Shattered')
// is the 4th scar that incapacitates under 'incapacitate' mode (INCAPACITATE_AT).
export const INJURY_NAMES: string[] = ['Cracked', 'Weakened', 'Broken', 'Shattered'];

// The name of a member's WORST (highest-tier) scar, given their scar count. Returns
// null when uninjured. Shared by the Deploy and Infirmary screens.
export function topScarName(injuries: number): string | null {
  return injuries > 0 ? INJURY_NAMES[Math.min(injuries, INJURY_NAMES.length) - 1] : null;
}

// ---------------------------------------------------------------------------
// Injury-mode experiment (2026-07-04 playtest). The 3-scar cap NULLIFIES the
// system at its limit: once a member is Broken, every further death is free and
// the DR1 sacrifice line returns for that member. Two harder variants, behind a
// runtime switch so they can be simmed / play-felt without a build:
//   'cap'          — today's rule: scars stop at 3, further deaths cost nothing.
//   'escalate'     — scars never cap; each death past the 3rd repeats the cycle
//                    (4th −2 max HP, 5th −1 damage, 6th −1 ability, ...).
//   'incapacitate' — the 4th death takes the member OUT: they start every fight
//                    dead and cannot be Resurrected; the Infirmary / Field
//                    Hospital / Mending Totem can still heal the 4th scar to
//                    restore them (recoverable, like the rest of DR1).
// Default 'cap' (the tuned demo rule); the sim experiments read the findings
// issue. Mutable at runtime on purpose — sim scripts and a future settings
// toggle flip it without touching the module graph.
// ---------------------------------------------------------------------------
//   'death'        — the shipped rule (2026-07): the 4th death PERMANENTLY kills the
//                    member — they are removed from the roster for good. Injuries are
//                    permanent (no Infirmary); the Field Hospital event can still shed
//                    a scar before the 4th, so a wounded hero can be pulled back.
export type InjuryMode = 'cap' | 'escalate' | 'incapacitate' | 'death';
// Default 'death' (2026-07 roster rework): the 4th death removes the member from the
// roster permanently — the sharpest legible cost, and the reason to bench a
// three-scar hero. Still mutable at runtime for sim experiments.
export const INJURY_RULES: { mode: InjuryMode } = { mode: 'death' };
export const INCAPACITATE_AT = MAX_INJURIES + 1; // the scar count that removes/incapacitates the member
export const DEATH_AT = INCAPACITATE_AT;         // (alias) the scar count that permanently kills under 'death'

// Scar count a run may record for one member under the active mode.
export function injuryRecordCap(): number {
  switch (INJURY_RULES.mode) {
    case 'cap': return MAX_INJURIES;
    case 'incapacitate': return INCAPACITATE_AT;
    case 'death': return DEATH_AT;
    case 'escalate': return Number.MAX_SAFE_INTEGER;
  }
}

// Whether this scar count incapacitates the member (starts fights dead,
// unresurrectable) under the active mode.
export const injuryIncapacitates = (injuries: number): boolean =>
  INJURY_RULES.mode === 'incapacitate' && injuries >= INCAPACITATE_AT;

// Whether this scar count PERMANENTLY kills the member (removed from the roster)
// under the active mode ('death'). The run layer splices them out.
export const injuryKills = (injuries: number): boolean =>
  INJURY_RULES.mode === 'death' && injuries >= DEATH_AT;

// Total penalty of each kind for a member carrying `injuries` scars.
// 'escalate' extends the 3-tier cycle indefinitely: tier i (1-indexed) grants the
// table's ((i-1) % 3)-th penalty, so the 4th scar is another Cracked, the 5th
// another Weakened, and so on. The other modes clamp at the table edge.
const injuryPenalty = (table: number[], injuries: number): number => {
  if (injuries <= 0) return 0;
  if (INJURY_RULES.mode !== 'escalate' || injuries <= MAX_INJURIES) {
    return table[Math.min(injuries, MAX_INJURIES) - 1];
  }
  let total = table[MAX_INJURIES - 1];
  for (let tier = MAX_INJURIES + 1; tier <= injuries; tier++) {
    // Per-tier increment of the cycled tier = the table delta at that position.
    const pos = (tier - 1) % MAX_INJURIES;
    total += table[pos] - (pos > 0 ? table[pos - 1] : 0);
  }
  return total;
};
export const injuryMaxHPPenalty = (injuries: number): number => injuryPenalty(INJURY_MAXHP, injuries);
export const injuryDamagePenalty = (injuries: number): number => injuryPenalty(INJURY_DAMAGE, injuries);
export const injuryAbilityPenalty = (injuries: number): number => injuryPenalty(INJURY_ABILITY, injuries);

export interface HealerConfig {
  maxMana: number;   // MP cap; starting MP each fight equals this
  handSize: number;
  restRegen: number; // MP regained on rest
  passiveMp: number; // MP gained at the start of each player phase
  // Hand-4 carryover experiment (#25, Q6): cards KEPT in hand across the end-of-turn
  // discard (in addition to Retain cards). Absent/0 = classic full-hand discard.
  // Behind a flag: DEFAULT_HEALER ships it at 0; only an explicit config turns it on.
  carryover?: number;
}

export interface EnemyConfig {
  maxHP: number;
  boss: boolean;       // true -> uses the stronger, fully-telegraphed boss attack pool
  attackBonus: number; // flat bonus added to each attack's per-target damage (difficulty ramp)
  def?: EnemyDef;      // enemy behavior (attack weights, name); synthesized from `boss` if omitted
  enrageTurn?: number; // turn this enemy enrages (defaults to the global ENRAGE_TURN)
}

export interface BattleConfig {
  deck: DeckCard[];
  party: PartyMemberConfig[]; // length 3, indexed by slot
  healer: HealerConfig;
  enemy: EnemyConfig;
  relics?: RelicId[]; // run-long passives (#21); absent/empty means fully inert
  // Once-per-RUN relics already spent in an earlier fight (#22: Dusk Chime,
  // Martyr's Icon). The engine treats these as used from the first turn.
  spentRelics?: RelicId[];
}

export const DEFAULT_HEALER: HealerConfig = {
  maxMana: MP_MAX, handSize: HAND_SIZE, restRegen: SKIP_REGEN, passiveMp: 0, carryover: 0,
};

export const DEFAULT_ENEMY: EnemyConfig = { maxHP: ENEMY_MAX_HP, boss: false, attackBonus: 0, def: DEFAULT_ENEMY_DEF };

export const MAX_UPGRADE_SLOTS = 2;

export function makeDeckCard(id: CardId, uid: number, upgrades: ModifierId[] = []): DeckCard {
  return { uid, id, upgrades: [...upgrades] };
}

export function defaultParty(): PartyMemberConfig[] {
  return MEMBER_DEFS.map((d) => ({ maxHP: d.maxHP, damage: d.damage, abilityPower: 0, injuries: 0 }));
}

// The 7-card core deck as concrete instances (uid = position). Member ability
// cards are added on top per-fight (abilityCardsForParty), not stored here.
// This is the Preserver preset (#63) — the run/sim/quick-play default opener.
export function defaultDeck(): DeckCard[] {
  return DECK_LIST.map((id, i) => makeDeckCard(id, i));
}

// ---------------------------------------------------------------------------
// Themed preset starter decks (#63, Part C). The player picks one at run start;
// each is ~6-8 cards weighted toward its 1-2 types, drawn only from shoppable,
// non-ability cards (ability cards are still injected per deployed member). The
// lists/names are tunable — a later balance pass owns deep starter tuning.
// ---------------------------------------------------------------------------
// Run start offers two paths: take the fixed Standard deck, or DRAFT one — seed with
// the shared heals, then pick 1-of-3 cards a few times (#content-cut). The old three
// preset decks (Preserver/Reaper/Warden) are gone.
export type StarterDeckId = 'standard' | 'draft';
export interface StarterDeckDef {
  id: StarterDeckId;
  name: string;
  desc: string;
  types: CardType[];  // the types the option leans on (for the picker UI)
}
export const DEFAULT_STARTER_DECK: StarterDeckId = 'standard';
export const STARTER_DECK_IDS: StarterDeckId[] = ['standard', 'draft'];
export const STARTER_DECKS: Record<StarterDeckId, StarterDeckDef> = {
  // Standard — the fixed heal-lean opener (the renamed Preserver), Holy.
  standard: {
    id: 'standard', name: 'Standard', types: ['holy'],
    desc: 'A fixed heal-lean opener that keeps the party standing.',
  },
  // Draft — build your own: start with two heals and a revive, then pick 1 of 3 each round.
  draft: {
    id: 'draft', name: 'Draft', types: ['holy', 'nature', 'shadow', 'blood', 'arcane', 'iron'],
    desc: 'Build your own deck — start with two heals and a revive, then pick 1 of 3 cards each round.',
  },
};

// The Standard deck (the heal-only six + Resurrect, #86); quick-play/sim use this by default.
export function buildStandardDeck(): DeckCard[] {
  return DECK_LIST.map((cid, i) => makeDeckCard(cid, i));
}

// The base every draft opens with — the shared heals plus a Resurrect (#86).
export const DRAFT_BASE_HEALS: CardId[] = ['lowHeal', 'highHeal', 'resurrect'];
export const STARTER_DRAFT_PICKS = 3;        // pick-1-of-3 rounds to fill a 6-card deck
export const STARTER_DRAFT_OFFER_SIZE = 3;   // cards shown per draft round (pick one)

// Seed a fresh drafted deck with the base heals (uid = position); the picks append.
export function buildDraftBaseDeck(): DeckCard[] {
  return DRAFT_BASE_HEALS.map((cid, i) => makeDeckCard(cid, i));
}

// The per-fight ability cards for a battle party (#44): one bound card per seated
// member, resolved to that member's ability (drafted id, else the slot's classic
// trio default — mirroring the engine's Member construction). Empty slots add none.
// Given negative uids so they never collide with the persistent run deck, and left
// out of that deck entirely, so they vanish when the fight ends.
export function abilityCardsForParty(party: PartyMemberConfig[]): DeckCard[] {
  const cards: DeckCard[] = [];
  party.forEach((p, slot) => {
    if (p.empty) return;
    // #54: an incapacitated member cannot return this fight (unresurrectable), so
    // their ability card is permanent dead weight — never inject it. This is the
    // "removed from deck+hand for the remainder of the fight" path: because
    // incapacitated members enter the fight already dead, skipping injection here is
    // equivalent to purging at fight start (the card is never drawn at all).
    if (p.incapacitated) return;
    const ability = (p.member ? MEMBER_POOL[p.member] : MEMBER_DEFS[slot]).ability;
    cards.push(makeDeckCard(ABILITY_CARD[ability], -(cards.length + 1)));
  });
  return cards;
}

export function defaultBattleConfig(): BattleConfig {
  const party = defaultParty();
  return {
    deck: [...defaultDeck(), ...abilityCardsForParty(party)],
    party,
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
  draw?: number;
  needsRegen: boolean;
  needsPoison: boolean; // Hemorrhage (#67): playable only while the enemy is Poisoned
  needsChannel: boolean; // Liturgy (#73): playable only while a channel is active
  refreshCap: number; // per-cast lifetime MP cap for Refresh-slot cards
  selfDamage?: number; // Blood cost the target pays (never bumped by modifiers)
  noDefense: boolean; // Bulwark targeting gate: no active Defense on the target
  noTaunt: boolean;   // Phalanx targeting gate: not the taunting member
  ability?: AbilityId; // per-member ability card (#44): fires the bound member's move
  channel?: CardChannelDef; // channeled card (#64): starts a channel instead of a one-shot
  // Regen has no separate duration (#52): `regen` is the applied magnitude, which
  // is also its number of ticks. Lingering folds into `regen` (see resolveCard).
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


const cardHasStrength = (id: CardId): boolean => {
  const c = CARDS[id];
  return !c.noPotent && (c.heal != null || c.regen != null || c.refresh != null);
};
const cardHasDuration = (id: CardId): boolean => {
  const c = CARDS[id];
  return c.regen != null || c.refresh != null;
};

// Shared engine tag: any card that generates MP or draws cards.
export const isEngineCard = (id: CardId): boolean => CARDS[id].engine === true;

// A member ability counts as an "engine" effect when firing it generates MP or
// draws cards (#27): Crescendo draws. Same spirit as the engine-card tag
// (economy-fueling), surfaced for the ability card that fires it. (The Warlock's
// old Dark Bargain minted MP and was engine-tagged; his redesigned Hex (#39) is a
// pure debuff and no longer counts.)
export const isEngineAbility = (ability: AbilityId): boolean =>
  ability === 'crescendo';

// Retain may not lock in a per-member ability card (#44: those are inserted per
// fight, never part of the persistent deck), any engine card (that would make the
// MP-economy loop deterministic), or a 0-cost card (free perpetual value).
const retainEligible = (id: CardId): boolean =>
  !isAbilityCard(id) && !isEngineCard(id) && CARDS[id].cost > 0;

// Efficient may not touch a 0-cost card (nothing to shave; the #02 floor already
// blocks reaching 0) or a draw-engine card (a discounted Inspiration compounds
// the card economy the same way a Retained engine card would the MP economy).
const efficientEligible = (id: CardId): boolean => CARDS[id].cost > 0 && CARDS[id].draw == null;

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

// Whether `mod` can be applied to `card` right now: an open slot, per-card-id
// eligibility, and the modifier must actually change the resolved card.
// Efficient cannot bite below the 1-MP floor and a second Retain is a no-op —
// offering either would sell the player nothing for full price.
export function canApplyModifier(card: DeckCard, mod: ModifierId): boolean {
  if (card.upgrades.length >= MAX_UPGRADE_SLOTS || !MODIFIERS[mod].eligible(card.id)) return false;
  if (mod === 'efficient' && resolveCard(card).cost <= 1) return false;
  if (mod === 'retain' && card.upgrades.includes('retain')) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Run structure: node types, map shape, economy, and shop/event offer pools.
// ---------------------------------------------------------------------------

export type NodeType =
  | 'fight' | 'cardShop' | 'cardUpgrade' | 'partyUpgrade' | 'event'
  | 'recruit'   // add a member to the roster (2026-07) — a weighted node; hidden when the roster is full
  | 'infirmary' // heal HP / shed a scar for gold (#58) — hidden when nobody is hurt or injured
  | 'reliquary'; // relic shop (#21) — never rolled; injected exactly twice per run

// The non-fight node types that fill the branches between fights. The Infirmary is
// back (#58): HP persists across fights now, so a paid HP/scar top-up is a real
// attrition-economy stop again (it hides at runtime when the party is healthy). The
// Sanctum / healerUpgrade node was removed (#83) — healer upgrades are now a free
// post-boss boon (see run.ts _enterHealerBoon), not a gold-bought map node.
export const NON_FIGHT_NODES: NodeType[] = [
  'cardShop', 'cardUpgrade', 'partyUpgrade', 'event', 'recruit', 'infirmary', 'reliquary',
];

// Weights for placing non-fight node types on the map. The Recruit node (2026-07)
// grows the roster past the pick-one drafts; it is a real roll (you must find one)
// and is hidden once the roster already holds every member. The Infirmary (#58) is
// the paid HP/scar top-up; it too hides at runtime when the party is healthy. The
// old healerUpgrade weight (15) was removed with the Sanctum node (#83) and
// redistributed across the surviving types (total stays 140).
export const NODE_TYPE_WEIGHTS: Array<[NodeType, number]> = [
  ['cardShop', 28], ['cardUpgrade', 23], ['partyUpgrade', 22], ['event', 22],
  ['recruit', 22], ['infirmary', 23],
];

// A run is 3 acts of 3 fights each (two normals + an act boss): 9 fights, 8 forks
// between them. Act bosses sit at fights 2, 5, 8 (the last fight of each act); the
// final fight (8) ends the run.
export const FIGHTS_PER_ACT = 3;
export const ACT_COUNT = 3;
export const FIGHT_COUNT = FIGHTS_PER_ACT * ACT_COUNT; // 9
export const FORK_COUNT = FIGHT_COUNT - 1;             // 8 forks between fights
export const BRANCHES_PER_FORK = 2;
export const NODES_PER_BRANCH = 2;

// Raised 40 -> 80 to fund member salaries (2026-07). Deploying the classic trio
// costs 40 salary/fight, so the trio's NET is the old 40; fielding fewer keeps more.
export const GOLD_PER_FIGHT = 100;   // awarded for winning a (non-final) fight (before salaries)
// "Field fewer, keep more" made real (#42): the win bounty scales UP with empty
// deploy seats, so an undermanned win pays a premium on top of the wages it saves.
// Each empty seat adds this fraction of the base bounty (2 empty = solo = +60%).
export const EMPTY_SEAT_GOLD_BONUS = 0.30;

// ---------------------------------------------------------------------------
// Between-fight healing (#58). HP now PERSISTS across fights (a member ends a
// fight hurt and starts the next deploy step still hurt); between fights each
// member recovers only this fraction of their max HP, clamped to max — no longer
// a free full re-seed. A member dead at the end of a WON fight is resurrected to
// the same recovered amount (round(HERO_HEAL_PCT × maxHP)), not to full and not
// to the in-fight Resurrect card's 50% (which stays a battlefield-only revive).
// The Infirmary node (below) is the paid way to top HP back up / shed a scar.
// Chosen from the N=1000 sweep in sim/experiments/heal-exp.ts (#58 balance pass).
// ---------------------------------------------------------------------------
export const HERO_HEAL_PCT = 0.40;

// The active between-fight heal fraction. Reads HERO_HEAL_PCT by default; kept in a
// mutable holder ONLY so the sweep (sim/experiments/heal-exp.ts) can vary it without a rebuild,
// exactly like INJURY_RULES. Runtime + tests use the HERO_HEAL_PCT default.
export const HEAL_TUNING = { pct: HERO_HEAL_PCT };

// Infirmary node (#58, re-added): pay gold to fully restore one member's HP, or a
// much larger price to shed one lasting injury (scar). Both gold-clamped; the node
// hides when nobody is hurt or injured. Prices are sim-tuned in the balance pass.
export const INFIRMARY_HP_PRICE = 15;      // restore a chosen member to full HP
export const INFIRMARY_INJURY_PRICE = 45;  // shed one death-scar from a chosen member

// ---------------------------------------------------------------------------
// Member salaries (2026-07): after each won fight, every DEPLOYED member is paid
// out of the winnings; benched members are free, so fielding fewer keeps more gold.
// Salary rises with each stat upgrade and falls with each injury. Base salaries are
// tuned so the classic trio (ranger+tank+mage) costs exactly GOLD_PER_FIGHT/2. These
// magnitudes are sim-tuned in the balance pass.
// ---------------------------------------------------------------------------
// Rescaled up with GOLD_PER_FIGHT (#42) so the wages a benched member saves are a
// meaningful slice of the (now larger, empty-seat-scaled) bounty — the two levers
// together make fielding fewer a real gold decision, not a rounding error.
export const MEMBER_BASE_SALARY: Record<MemberId, number> = {
  ranger: 18, tank: 13, mage: 20,          // classic trio: 18 + 13 + 20 = 51
  warlock: 14, skald: 15, berserker: 13, beastWarden: 15, sentinel: 15,
  duelist: 15, flagellant: 14,
};
export const SALARY_PER_UPGRADE = 4; // each permanent stat upgrade raises a member's salary
export const SALARY_PER_INJURY = 3;  // each scar lowers it (a damaged hero is cheaper to field)
export const MIN_SALARY = 3;         // a salary never drops below this
export const DEFAULT_MEMBER_SALARY = 12; // fallback for a member without a pool identity (quick-play)

// A roster member's current salary: base (by identity) + per-upgrade, − per-injury,
// floored at MIN_SALARY. `upgrades` counts permanent stat boosts applied to them.
export function memberSalary(p: PartyMemberConfig): number {
  const base = p.member ? MEMBER_BASE_SALARY[p.member] : DEFAULT_MEMBER_SALARY;
  return Math.max(MIN_SALARY, base + SALARY_PER_UPGRADE * (p.upgrades ?? 0) - SALARY_PER_INJURY * p.injuries);
}

// Which act a fight belongs to, and whether it is that act's boss (its last fight).
export const actOfFight = (fightIndex: number): number => Math.floor(fightIndex / FIGHTS_PER_ACT);
export const isActBoss = (fightIndex: number): boolean =>
  (fightIndex % FIGHTS_PER_ACT) === FIGHTS_PER_ACT - 1;

// Per-act difficulty curve, indexed by fight. HP and attackBonus climb per act;
// the enrage column lets act bosses enrage sooner. Act bosses (2,5,8) use the
// boss attack pool, so their flat attackBonus is 0. A2/A3 bosses are placeholders
// (scaled BOSS_ENEMY_DEF) until the Gatewarden/Hexweaver/Devourer land (#12-14).
// Re-anchored for the 2026-07 roster campaign: the player builds their party over
// the run, so act 1 is fought SOLO/duo (F0 is a forced solo) and later acts with a
// small roster — far less party DPS/bodies than the old fixed trio. HP drops across
// the board; act 1 especially. Sim-tuned against the campaign policy.
// 2026-07-07 SKILL-TIER PASS: re-anchored DOWN again so the FLAWLESS good-player line
// (the sim's optimal tier) hits the ~75% full-run target, with the difficulty gradient
// carried by play-quality tiers on identical content (see sim/profile.ts + balance-
// tiers.ts): average ~30%, poor <1%. Bosses stay the walls but are answerable. MP economy
// and healing were left untouched per the maintainer constraint — this pass is HP + gold +
// solo-only levers only.
export const ENEMY_HP_BY_FIGHT: number[] = [
  10, 15, 32,     // Act 1: solo F0, ~solo F1, duo Gatewarden (2026-07-09 post-wave re-anchor)
  38, 47, 108,    // Act 2: duo/trio normals + Hexweaver (2026-07-09 post-wave re-anchor)
  61, 71, 110,    // Act 3: small-roster normals + Devourer (2026-07-09 post-wave re-anchor)
];
// Normals stay gentle on per-hit damage (their difficulty is the rising HP =
// longer fights), so a good player clears them reliably; the bosses are the walls.
export const ENEMY_ATTACK_BONUS: number[] = [
  0, 0, 0,
  1, 1, 0,
  1, 1, 0,
];
// Enrage is a boss anti-stall mechanic. Normals get a high enrage turn (14) so
// long high-HP normals stay a clean DPS race and don't hit an enrage cliff; the
// act bosses keep their tuned enrage turns (A1 11, A2 10, A3 per-def placeholder 11).
export const ENEMY_ENRAGE_TURN_BY_FIGHT: number[] = [
  14, 14, 11,
  14, 14, 10,
  14, 14, 11,
];

// Storefront sizes per shop type.
export const SHOP_SIZE = { cardShop: 6, cardUpgrade: 3, partyUpgrade: 4 } as const;

// The card shop always puts one item on sale at this fraction off its list price.
export const SHOP_SALE_OFF = 0.25;

// Rarity of each existing card (new cards are a separate design task).
export const CARD_RARITY: Record<CardId, Rarity> = {
  lowHeal: 'common',
  regen: 'common',
  battleHymn: 'common',
  cleanse: 'uncommon',
  highHeal: 'uncommon',
  aoeHeal: 'uncommon',
  shield: 'uncommon',
  bloom: 'uncommon',
  inspiration: 'uncommon',
  lifebloom: 'uncommon',
  bloodTithe: 'uncommon',
  martyrsGift: 'uncommon',
  phalanx: 'uncommon',
  provoke: 'uncommon',
  resurrect: 'rare',
  fontOfMana: 'rare',
  barrier: 'rare',
  // Channeled cards (#64).
  mendingStream: 'uncommon', sap: 'uncommon',
  // Iron mitigation web (#65).
  feint: 'uncommon',
  // Regen conversions (#66).
  sporeburst: 'uncommon',
  // Status-window management (#67).
  hemorrhage: 'rare', dreadWhisper: 'common',
  // Blood + cycling (#68): Blood Banner is the rare of the set.
  crimsonPact: 'uncommon', scarletWard: 'uncommon', transfusion: 'uncommon', bloodBanner: 'rare',
  // Holy board-state payoffs (#69): Consecration is the rare.
  sunriseVigil: 'common', consecration: 'rare',
  // Arcane support (#70): Arcane Lens is the rare.
  arcaneLens: 'rare',
  // Hero buff card batch (#62): Double Strike is the rare of the set.
  guard: 'common', sharpen: 'common', doubleStrike: 'rare',
  empower: 'uncommon', riposte: 'uncommon',
  // Per-member ability cards (#44): never shopped (excluded from CARD_POOL below);
  // rarity is required by the Record type but inert for these.
  imbuePoison: 'uncommon', bolster: 'uncommon', unleash: 'uncommon', hex: 'uncommon',
  conduct: 'uncommon', incite: 'uncommon', beckon: 'uncommon', stagger: 'uncommon',
  enGarde: 'uncommon', penance: 'uncommon',
};

// The cards a shop can sell. Quick Heal is dropped from the pool (flaw #6): as a
// buffed 1-MP heal-2 it is a starter card, not a shop purchase. Per-member ability
// cards (#44) are inserted per-fight, never bought — excluded here.
export const CARD_POOL: CardId[] = (Object.keys(CARDS) as CardId[])
  .filter((id) => id !== 'lowHeal' && !isAbilityCard(id));

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
// #83: these are now a FREE, repeatable post-boss boon (run.ts _enterHealerBoon),
// not a gold-bought Sanctum node — so the bespoke prices are gone and the four are
// retuned toward roughly EQUAL value as free picks. +1 to hand/passive/rest is a
// big swing; a single +1 max mana is the weakest of the four, so mana is bumped to
// +2 to sit alongside them. passiveMp stays capped per run (PASSIVE_MP_CAP), so a
// second pick of it is absorbed by the cap — the other three keep stacking. rarity
// no longer drives a price (the boon is free); it is retained only as a display tag.
// Exact equalized magnitudes land against the sim/balance harness in a follow-up.
export const HEALER_UPGRADES: HealerUpgradeDef[] = [
  { id: 'mana', stat: 'maxMana', amount: 2, rarity: 'uncommon', name: '+2 Max Mana', desc: 'Raise max mana (and starting mana) by 2.' },
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
  | 'shrineCard'    // pick an eligible card; apply a random eligible modifier (free)
  | 'shrineParty'   // pick a member; apply a random stat boost (free)
  | 'cursedChest'   // +gold, but a RANDOM card leaves the deck (#19)
  | 'mercenary'     // pay gold; a RANDOM member gains +1 damage (#19)
  | 'duplicateCard' // deck picker; add a copy of the chosen card, upgrades included (#19)
  | 'bloodAltar'    // pick a member: -2 max HP for +1 damage, permanent (#19)
  | 'shrineCurse'   // accept a random curse for gold (#22)
  | 'healInjury'    // pick a member: clear one death-scar, free (DR1)
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

// Curse economy (#22): what the Reliquary charges for a cursed offer, and what
// the Shrine pays for accepting a random one. Declared here (before EVENTS)
// because the Shrine's choice text quotes the payout.
export const CURSE_PRICE = 25;
export const CURSE_SHRINE_GOLD = 50;

// Events-expansion (#19) magnitudes. Duplication costs more than removal (20g)
// so copy/purge stay one coherent economy; the free Purge Well removal pays its
// discount in randomness (the well picks the card, not the player).
export const CURSED_CHEST_GOLD = 100; // the chest's payout; a random card is the price
export const MERCENARY_PRICE = 45;    // hire fee for +1 damage on a random member
export const MERCENARY_DAMAGE = 1;
export const DUPLICATE_PRICE = 30;    // add an unupgraded copy of a chosen card
export const BLOOD_ALTAR_HP = 2;      // permanent max-HP price a member pays
export const BLOOD_ALTAR_DAMAGE = 1;  // permanent damage the altar grants
export const BLOOD_ALTAR_MIN_HP = 6;  // members at/below this max HP may not sacrifice

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
      { label: 'Accept a burden', kind: 'shrineCurse', detail: `Gain a random curse — and ${CURSE_SHRINE_GOLD}g for bearing it.` },
      { label: 'Leave', kind: 'leave' },
    ],
  },
  // --- events expansion (#19): five more, each a real decision ---------------
  {
    id: 'cursedChest',
    title: 'Cursed Chest',
    text: 'A gilded chest sits in the roots of a dead tree, humming softly. Gold glints through the seam — but so does something hungrier.',
    choices: [
      { label: 'Pry it open', kind: 'cursedChest', detail: `+${CURSED_CHEST_GOLD}g — but a random card leaves your deck.` },
      // (CURSED_CHEST_GOLD is 100 after the content-cut pass.)
      { label: 'Leave it buried', kind: 'leave' },
    ],
  },
  {
    id: 'mercenary',
    title: 'Wandering Mercenary',
    text: '"Your lot swing like farmhands," the sellsword laughs. "For coin, I\'ll drill one of them — my pick, not yours."',
    choices: [
      { label: 'Pay for drills', kind: 'mercenary', detail: `${MERCENARY_PRICE}g: a random member gains +${MERCENARY_DAMAGE} damage.` },
      { label: 'Decline', kind: 'leave' },
    ],
  },
  {
    id: 'duplicator',
    title: 'The Duplicator',
    text: 'A scribe with ink-stained fingers studies your deck. "Any page can be copied — gilding and all."',
    choices: [
      { label: 'Commission a copy', kind: 'duplicateCard', detail: `${DUPLICATE_PRICE}g: add a copy of a chosen card (upgrades included).` },
      { label: 'Move on', kind: 'leave' },
    ],
  },
  {
    id: 'fieldHospital',
    title: 'Field Hospital',
    text: 'A tent of clean linen and boiling water. "Bring me your wounded, healer — I\'ll not charge a coin for mending what the road has broken. One soul, mind you; I\'ve others to see."',
    choices: [
      { label: 'Tend a hero', kind: 'healInjury', detail: 'Heal one lasting injury on a chosen member (free).' },
      { label: 'Move on', kind: 'leave' },
    ],
  },
  {
    id: 'bloodAltar',
    title: 'The Grindstone',
    text: 'An old grindstone hums in the clearing. Put a hero to it and they come away sharper — and a little worn down. The wheel only turns one way.',
    choices: [
      { label: 'Put a hero to the stone', kind: 'bloodAltar', detail: `Chosen member: −${BLOOD_ALTAR_HP} max HP, +${BLOOD_ALTAR_DAMAGE} damage (permanent).` },
      { label: 'Leave it be', kind: 'leave' },
    ],
  },
];

