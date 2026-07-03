// All tunable values from the spec's "Numbers" section live here.
// Slots are 0,1,2 == spec slots 1,2,3 == Ranger (left), Tank (center), Mage (right).

export type Slot = 0 | 1 | 2;
// 'heavy' (big single-target hit) and 'sweep' (strong hit on the whole party) are
// the boss's signature attacks — stronger than the basic ones, but fully telegraphed.
// 'cast' is a non-geometry telegraph: a scripted, no-damage effect (the Hexweaver's
// Hex/Siphon, the Devourer's Consume) whose resolution runs game logic, not a hit.
export type AttackType = 'single' | 'two' | 'aoe' | 'hidden' | 'heavy' | 'sweep' | 'cast';
export type CardTarget = 'single' | 'ability' | 'dead' | 'all' | 'none';
export type MemberId = 'ranger' | 'tank' | 'mage';
export type AbilityId = 'poison' | 'taunt' | 'bolt';
export type CardId =
  | 'ability' | 'lowHeal' | 'highHeal' | 'aoeHeal'
  | 'regen' | 'shield' | 'resurrect' | 'refresh' | 'cleanse'
  | 'overgrowth' | 'cultivate' | 'bloom' | 'fontOfMana' | 'inspiration'
  | 'lifebloom' | 'surge' | 'battleHymn' | 'barrier'
  | 'bloodTithe' | 'martyrsGift' | 'grimHarvest'
  | 'phalanx' | 'brace';

// The scripted effect a 'cast' telegraph resolves into. 'wound' halves the party's
// healing for a few turns; 'siphon' drains healer MP; 'consume' (Devourer, #14)
// cleanses the enemy's own poison and self-heals for the remaining ticks.
export type CastKind = 'wound' | 'siphon' | 'consume';

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
  draw?: number;        // cards drawn when played (Inspiration)
  // Single-target eligibility gate: the target must carry an active Regen
  // (Cultivate / Bloom are dead cards without one).
  needsRegen?: boolean;
  // Excluded from the Potent modifier even though it has a strength field
  // (Overgrowth: +1 strength would be x3 members x3 turns for one upgrade).
  noPotent?: boolean;
  // Per-cast lifetime MP cap override for Refresh-slot cards; defaults to
  // REFRESH_MP_CAP (Font of Mana carries its own larger designed lifetime).
  refreshCap?: number;
  // Blood cards (#16): HP the TARGET pays as a cost. canPlay requires the target
  // to have strictly more HP than this, and the payment clamps to leave 1 HP —
  // Blood self-damage is never lethal (no new death path in playCard).
  selfDamage?: number;
  // Bulwark cards (#17) are Defense-exclusive: the target must not already have
  // an active Defense (this is also how "no stack" is enforced for Phalanx).
  noDefense?: boolean;
  // Phalanx (#17) may not target the taunting member — Taunt's bundled Defense
  // is the tank's lane; Bulwark protects the members Taunt can't.
  noTaunt?: boolean;
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

// Base (pre-enrage) per-target damage by attack type. 'cast' deals no damage —
// its telegraph resolves into a scripted effect, so its base is 0.
export const ATTACK_BASE_DAMAGE: Record<AttackType, number> = {
  single: 4, two: 3, aoe: 2, hidden: 4, heavy: 7, sweep: 4, cast: 0,
};

// Attack-type selection weights. Regular enemies never use the boss-only types
// (heavy/sweep weight 0); the boss never uses the untelegraphed 'hidden' type.
// 'cast' is never weighted-picked (scripted bosses place it in a rotation), so it
// carries weight 0 everywhere — a trailing 0-weight key leaves every pick unchanged.
export const TYPE_WEIGHTS: Record<'normal' | 'enraged' | 'boss' | 'bossEnraged', Record<AttackType, number>> = {
  normal:      { single: 60, two: 20, aoe: 10, hidden: 10, heavy: 0,  sweep: 0,  cast: 0 },
  enraged:     { single: 30, two: 35, aoe: 25, hidden: 10, heavy: 0,  sweep: 0,  cast: 0 },
  boss:        { single: 20, two: 20, aoe: 10, hidden: 0,  heavy: 30, sweep: 20, cast: 0 },
  // Enraged sweep softened 20->10 (issue 04): enraged sweep (ceil(4x1.25)x3 = 15
  // party-wide/turn) otherwise beats the sustain ceiling and makes the post-enrage
  // race unwinnable. Halving its weight keeps the boss hard but the race winnable.
  bossEnraged: { single: 10, two: 20, aoe: 15, hidden: 0,  heavy: 35, sweep: 10, cast: 0 },
};

// Primary-slot weights, indexed by slot. Hidden attack uses its own profile.
export const SLOT_WEIGHTS: Record<'normal' | 'hidden', number[]> = {
  normal: [25, 50, 25],
  hidden: [40, 20, 40],
};

// Human-readable intent names for each attack type (the telegraph carries the
// numbers; this labels what the enemy is about to do).
// Note: no generic name may collide with a boss channel's name (e.g. the
// Gatewarden's 'Crushing Blow') — a channel is a bigger threat than the plain
// attack type it replaces, and sharing a name trains the wrong read.
export const ATTACK_INTENT_NAMES: Record<AttackType, string> = {
  single: 'Strike', two: 'Double Strike', aoe: 'Barrage',
  hidden: 'Veiled Strike', heavy: 'Heavy Blow', sweep: 'Sweep',
  // 'cast' rotation steps always carry an explicit name (Hex / Siphon / Consume),
  // so this generic label is only a fallback.
  cast: 'Cast',
};

// ---------------------------------------------------------------------------
// Data-driven enemy definition. An EnemyDef describes an enemy's behavior — its
// attack-type selection weights (and, later, rotations/phases for the bosses).
// The per-fight difficulty numbers (maxHP, attackBonus) live on EnemyConfig, so
// the same def can be reused across the fight curve.
// ---------------------------------------------------------------------------
export type AttackWeights = Record<AttackType, number>;

// A channelled attack: a multi-turn wind-up whose telegraph IS the standing
// telegraph (preserving the single-telegraph invariant). While it winds up the
// enemy takes no other action; on resolve it lands `damage` with `type` geometry.
export interface ChannelDef {
  slot: number;        // rotation index that becomes a channel
  everyCycles: number; // channel on cycles where (cycle % everyCycles) === everyCycles - 1
  turns: number;       // enemy turns from telegraph to resolve (2 = one wind-up turn + resolve)
  damage: number;      // per-target damage on resolve
  type: AttackType;    // geometry/label the channel resolves as
  name: string;        // display name (e.g. "Crushing Blow")
}

// A single step in a scripted boss rotation. A bare AttackType is shorthand for a
// plain attack of that type (the Gatewarden uses that form); a RotationStep object
// adds the Hexweaver's tricks: an explicit intent name, a damage override, targeting
// flags that bypass the taunt funnel, a multi-turn channel wind-up, or a scripted
// 'cast' effect. `type: 'cast'` steps deal no damage and must set `cast`.
export interface RotationStep {
  type: AttackType;
  name?: string;          // intent/display name override (e.g. 'Piercing Bolt', 'Hex')
  damage?: number;        // per-target base damage override (defaults to ATTACK_BASE_DAMAGE[type])
  ignoreTaunt?: boolean;  // not funnelled/redirected by Taunt (still auto-aimed by targetLowest)
  ignoreDefense?: boolean;// Defense reduction does not apply to this hit
  targetLowest?: boolean; // aim the (single-target) hit at the lowest-HP living member
  channelTurns?: number;  // >1 makes this a channel with that many enemy turns to resolve
  cast?: CastKind;        // for type 'cast': which scripted effect resolves
}

export type RotationEntry = AttackType | RotationStep;

export interface EnemyDef {
  id: string;
  name: string;
  boss: boolean;
  baseWeights: AttackWeights;    // attack-type selection pre-enrage
  enragedWeights: AttackWeights; // attack-type selection while enraged
  rotation?: RotationEntry[];    // fixed, learnable attack cycle (overrides weighted selection)
  channel?: ChannelDef;          // a rotation slot that periodically becomes a channel
  phase?: PhaseDef;              // an HP-threshold phase transition (Devourer, #14)
}

// A one-shot phase transition (the Devourer, #14). When the enemy first drops to
// or below `hpFraction` of its max HP, it announces `beat`, swaps its rotation for
// `rotation`, and may tighten enrage to `enrageTurn`. Edge-detected: fires once,
// even if the threshold is crossed mid-DoT-tick.
export interface PhaseDef {
  hpFraction: number;         // trigger when hp <= maxHP * hpFraction
  beat: string;               // the announced transformation line
  rotation: RotationEntry[];  // the rotation the enemy switches to in phase 2
  channel?: ChannelDef;       // a phase-2 channel slot (Maw)
  enrageTurn?: number;        // optional tighter enrage turn once transformed
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

// Attack-weight literal helper — keeps the key order consistent across defs. The
// scripted-only 'cast' type is always weight 0 (never weighted-picked).
const aw = (single: number, two: number, aoe: number, hidden: number, heavy: number, sweep: number): AttackWeights =>
  ({ single, two, aoe, hidden, heavy, sweep, cast: 0 });

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

// Boss 1 — Gatewarden (issue 12): a fixed, learnable rotation that teaches
// telegraph-reading. Every 2nd cycle its heavy becomes Crushing Blow — a 2-turn
// channel at 12 (~1.7× heavy). Opens on single, complementing the turn-1 rule.
// 14 keeps the read answerable (playtest finding): a defended tank takes 13, so
// Taunt upkeep + topping the tank up survives it, while the ranger (11) and
// mage (9) still die to it — at the original 20 it exceeded every max HP and
// killed a member in 82% of good-play sims, teaching sacrifice instead.
export const GATEWARDEN_DEF: EnemyDef = {
  id: 'gatewarden', name: 'Gatewarden', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged, // fallback only
  rotation: ['single', 'two', 'heavy', 'sweep'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 12, type: 'heavy', name: 'Crushing Blow' },
};

// Boss 2 — Hexweaver (issue 13): the telegraphed taunt-punisher. It breaks the
// permanent-taunt/turtle solve with three tools, all fully telegraphed:
//   • Piercing Bolt — ignores Taunt AND Defense, aims at the lowest-HP member, so
//     the tank can't soak it and the fragile DPS is the one under threat.
//   • Hex — a 'cast' that halves ALL healing for WOUND_TURNS turns (you can't
//     out-heal it — Cleanse removes it).
//   • Siphon — a 'cast' that drains SIPHON_AMOUNT healer MP (you can't cast freely).
// Opens on a plain single (a gentle turn-1 read), then cycles the three tricks
// between whole-party pressure. Cleanse (added this issue) is its designed counter.
export const HEXWEAVER_PIERCER_DMG = 5; // Piercing Bolt per-hit damage (before attackBonus)
export const HEXWEAVER_DEF: EnemyDef = {
  id: 'hexweaver', name: 'Hexweaver', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged, // fallback only
  rotation: [
    'single',
    { type: 'single', name: 'Piercing Bolt', damage: HEXWEAVER_PIERCER_DMG, ignoreTaunt: true, ignoreDefense: true, targetLowest: true },
    { type: 'cast', name: 'Hex', cast: 'wound' },
    'sweep',
    { type: 'single', name: 'Piercing Bolt', damage: HEXWEAVER_PIERCER_DMG, ignoreTaunt: true, ignoreDefense: true, targetLowest: true },
    { type: 'cast', name: 'Siphon', cast: 'siphon' },
  ],
};

// Boss 3 — Devourer (issue 14): "race or die". Turns the invisible enrage race
// into an explicit, fair one via a phase system:
//   • Phase 1 (>50% HP): a heavy/sweep pool plus Consume — a 'cast' that cleanses
//     its OWN Poison and self-heals for every remaining tick, so poison stops being
//     free value (it becomes a decision — the deferred call in #18).
//   • Phase 2 (<=50% HP): an announced transformation beat, then Maw — a 2-turn
//     channelled sweep at DEVOURER_MAW_DMG x3, recurring every ~4 turns — plus a
//     tighter enrage. Enraged Maw one-shots an unshielded squishy: race it down.
// The phase threshold is edge-detected (fires once, even mid-Poison-tick).
export const DEVOURER_MAW_DMG = 7; // Maw per-target sweep damage (before enrage/attackBonus)
export const DEVOURER_DEF: EnemyDef = {
  id: 'devourer', name: 'Devourer', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged, // fallback only
  rotation: [
    'single',
    'heavy',
    'sweep',
    { type: 'cast', name: 'Consume', cast: 'consume' },
    'two',
    'heavy',
  ],
  phase: {
    hpFraction: 0.5,
    beat: 'The Devourer splits its maw and TRANSFORMS!',
    // Slot 0 is always Maw (the channel fires every cycle at slot 0); the 'sweep'
    // literal there is a placeholder the channel overrides. Maw resolves every 4
    // enemy turns (2-turn wind-up + heavy + two).
    rotation: ['sweep', 'heavy', 'two'],
    channel: { slot: 0, everyCycles: 1, turns: 2, damage: DEVOURER_MAW_DMG, type: 'sweep', name: 'Maw' },
    enrageTurn: 11,
  },
};

// Act boss per act (0-based): Gatewarden (#12), Hexweaver (#13), Devourer (#14).
export const ACT_BOSS_DEFS: EnemyDef[] = [GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF];

export const NORMAL_ENEMY_DEFS: EnemyDef[] = [ENEMY_SPAMMER, ENEMY_SWARM, ENEMY_STALKER, ENEMY_CLEAVER];
export const ENEMY_DEF_BY_ID: Record<string, EnemyDef> =
  Object.fromEntries(NORMAL_ENEMY_DEFS.map((d) => [d.id, d]));

// Encounter table: weighted normal picks per fight index. Act-boss slots (2, 5,
// 8) are empty — those fights always use BOSS_ENEMY_DEF. Gentler shapes early,
// the full roster (Cleaver-weighted) later across acts — texture, not a spike.
export const ENCOUNTER_TABLE: Array<Array<[string, number]>> = [
  [['spammer', 70], ['swarm', 30]],                                   // fight 0 (A1)
  [['spammer', 45], ['swarm', 30], ['stalker', 25]],                  // fight 1 (A1)
  [],                                                                  // fight 2 (A1 boss)
  [['spammer', 35], ['swarm', 30], ['stalker', 25], ['cleaver', 10]], // fight 3 (A2)
  [['spammer', 25], ['swarm', 30], ['stalker', 25], ['cleaver', 20]], // fight 4 (A2)
  [],                                                                  // fight 5 (A2 boss)
  [['spammer', 25], ['swarm', 25], ['stalker', 25], ['cleaver', 25]], // fight 6 (A3)
  [['spammer', 20], ['swarm', 25], ['stalker', 25], ['cleaver', 30]], // fight 7 (A3)
  [],                                                                  // fight 8 (A3 boss)
];

export const ENRAGE_TURN = 11; // first enraged enemy turn (turn 11 onward)
export const ENRAGE_MULT = 1.25;

export const MP_START = 10;
export const MP_MAX = 10; // hard cap; MP never exceeds this
export const SKIP_REGEN = 5;          // Rest MP when no card was played this phase
export const SKIP_REGEN_DECAYED = 2;  // Rest MP when exactly one card was played (decaying Rest, flaw #5)
export const REFRESH_MP_CAP = 6;      // max MP a single Refresh cast may restore over its lifetime (flaw #7)
export const FONT_MP_CAP = 9;         // Font of Mana's per-cast lifetime (3/turn x 3 turns; net +6 after its 3 MP cost)
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

// Card set phase A (#15) magnitudes.
export const CULTIVATE_STRENGTH = 1;  // Regen strength Cultivate adds in place
export const CULTIVATE_TURNS = 1;     // Regen turns Cultivate adds in place
export const BLOOM_HEAL_PER_TURN = 2; // healing per remaining Regen turn Bloom consumes

// Card set phase B (#16) magnitudes.
export const LIFEBLOOM_BURST = 3;     // burst heal when a Lifebloom Regen ends on a living target
export const HYMN_BONUS = 2;          // damage added to each living member's auto this party phase
export const BARRIER_TURNS = 1;       // enemy phases an unused Barrier Shield lasts (vs SHIELD_TURNS)
export const BLOOD_TITHE_MP = 2;      // MP gained by Blood Tithe (capped at max mana)
export const GRIM_HARVEST_DMG = 10;   // enemy damage dealt by Grim Harvest

// Card set phase C (#17) — the Bulwark / Defense pipeline.
export const PHALANX_DEFENSE = 2;     // Defense strength Phalanx grants
export const PHALANX_TURNS = 2;       // enemy turns Phalanx's Defense lasts
export const BRACE_AMOUNT = 2;        // one-shot reduction Brace applies to the next damaging hit
export const BRACE_TURNS = 3;         // enemy turns an unused Brace lasts before fading (mirrors Shield)

// Hexweaver (#13) scripted-effect magnitudes.
export const WOUND_TURNS = 3;        // enemy turns the Hex healing-reduction lasts
export const WOUND_HEAL_FACTOR = 0.5; // healing multiplied by this while Wounded (floored)
export const SIPHON_AMOUNT = 3;      // healer MP drained by Siphon (floored at 0)

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
  cleanse: { id: 'cleanse', name: 'Cleanse', cost: 1, target: 'none',
    desc: 'Remove Hex (the healing-reduction curse) from the party.' },
  // --- card set phase A (#15): shop-only cards on existing engine state ------
  overgrowth: { id: 'overgrowth', name: 'Overgrowth', cost: 3, target: 'all', regen: 1, noPotent: true,
    desc: 'Regen 1 on every living member for 3 enemy turns.' },
  cultivate: { id: 'cultivate', name: 'Cultivate', cost: 1, target: 'single', needsRegen: true,
    desc: 'Strengthen a member\'s active Regen: +1 healing and +1 turn.' },
  bloom: { id: 'bloom', name: 'Bloom', cost: 2, target: 'single', needsRegen: true,
    desc: 'Consume a member\'s Regen: heal 2 per remaining turn.' },
  fontOfMana: { id: 'fontOfMana', name: 'Font of Mana', cost: 3, target: 'none',
    refresh: 3, refreshCap: FONT_MP_CAP, engine: true,
    desc: 'Refresh 3: restore 3 MP per turn for 3 enemy turns.' },
  inspiration: { id: 'inspiration', name: 'Inspiration', cost: 2, target: 'none', draw: 2, engine: true,
    desc: 'Draw 2 cards.' },
  // --- card set phase B (#16): cards with small new engine state -------------
  lifebloom: { id: 'lifebloom', name: 'Lifebloom', cost: 3, target: 'single', regen: 2,
    desc: 'Regen 2 for 3 turns; when it ends while the target lives, burst-heal 3.' },
  surge: { id: 'surge', name: 'Surge', cost: 2, target: 'none',
    desc: 'The next card you play this turn costs 0 MP.' },
  battleHymn: { id: 'battleHymn', name: 'Battle Hymn', cost: 1, target: 'none',
    desc: 'Every living member\'s attack this turn deals +2.' },
  barrier: { id: 'barrier', name: 'Barrier', cost: 4, target: 'all',
    desc: 'Every living member gains a Shield; unused ones fade after the next enemy phase.' },
  bloodTithe: { id: 'bloodTithe', name: 'Blood Tithe', cost: 0, target: 'single', selfDamage: 4, engine: true,
    desc: 'A member with more than 4 HP pays 4 HP; restore 2 MP.' },
  martyrsGift: { id: 'martyrsGift', name: 'Martyr\'s Gift', cost: 2, target: 'single', selfDamage: 3, heal: 4,
    desc: 'A member with more than 3 HP pays 3 HP; every other living member heals 4.' },
  grimHarvest: { id: 'grimHarvest', name: 'Grim Harvest', cost: 2, target: 'single', selfDamage: 4,
    desc: 'A member with more than 4 HP pays 4 HP; deal 10 damage to the enemy.' },
  // --- card set phase C (#17): the Bulwark / Defense pipeline ----------------
  // ("Phalanx" per Q10 — the old "Aegis" name collides with a relic.)
  phalanx: { id: 'phalanx', name: 'Phalanx', cost: 2, target: 'single', noDefense: true, noTaunt: true,
    desc: 'Defense 2 for 2 enemy turns. Cannot target a defended or taunting member.' },
  brace: { id: 'brace', name: 'Brace', cost: 1, target: 'single', noDefense: true,
    desc: 'The next attack on the target deals 2 less. Replaces a Shield (and vice versa).' },
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
  enrageTurn?: number; // turn this enemy enrages (defaults to the global ENRAGE_TURN)
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
  draw?: number;
  needsRegen: boolean;
  refreshCap: number; // per-cast lifetime MP cap for Refresh-slot cards
  selfDamage?: number; // Blood cost the target pays (never bumped by modifiers)
  noDefense: boolean; // Bulwark targeting gate: no active Defense on the target
  noTaunt: boolean;   // Phalanx targeting gate: not the taunting member
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
  return !c.noPotent && (c.heal != null || c.regen != null || c.refresh != null);
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
  | 'fight' | 'cardShop' | 'cardUpgrade' | 'partyUpgrade' | 'event' | 'healerUpgrade';

// The non-fight node types that fill the branches between fights.
export const NON_FIGHT_NODES: NodeType[] = [
  'cardShop', 'cardUpgrade', 'partyUpgrade', 'event', 'healerUpgrade',
];

// Weights for placing non-fight node types on the map.
export const NODE_TYPE_WEIGHTS: Array<[NodeType, number]> = [
  ['cardShop', 25], ['cardUpgrade', 20], ['partyUpgrade', 20], ['event', 20], ['healerUpgrade', 15],
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

export const GOLD_PER_FIGHT = 40;    // awarded for winning a (non-final) fight (~40 x 8 = 320/run)

// Which act a fight belongs to, and whether it is that act's boss (its last fight).
export const actOfFight = (fightIndex: number): number => Math.floor(fightIndex / FIGHTS_PER_ACT);
export const isActBoss = (fightIndex: number): boolean =>
  (fightIndex % FIGHTS_PER_ACT) === FIGHTS_PER_ACT - 1;

// Per-act difficulty curve, indexed by fight. HP and attackBonus climb per act;
// the enrage column lets act bosses enrage sooner. Act bosses (2,5,8) use the
// boss attack pool, so their flat attackBonus is 0. A2/A3 bosses are placeholders
// (scaled BOSS_ENEMY_DEF) until the Gatewarden/Hexweaver/Devourer land (#12-14).
export const ENEMY_HP_BY_FIGHT: number[] = [
  50, 75, 130,    // Act 1: two normals + boss (Gatewarden)
  105, 130, 135,  // Act 2: boss (Hexweaver — heal-denial makes it a wall below its HP)
  150, 150, 165,  // Act 3: two normals (under the enrage-14 cliff) + boss (Devourer)
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
export const SHOP_SIZE = { cardShop: 6, cardUpgrade: 3, partyUpgrade: 4, healerUpgrade: 3 } as const;

// Rarity of each existing card (new cards are a separate design task).
export const CARD_RARITY: Record<CardId, Rarity> = {
  lowHeal: 'common',
  regen: 'common',
  cultivate: 'common',
  battleHymn: 'common',
  brace: 'common',
  cleanse: 'uncommon',
  highHeal: 'uncommon',
  aoeHeal: 'uncommon',
  shield: 'uncommon',
  refresh: 'uncommon',
  ability: 'uncommon',
  overgrowth: 'uncommon',
  bloom: 'uncommon',
  inspiration: 'uncommon',
  lifebloom: 'uncommon',
  surge: 'uncommon',
  bloodTithe: 'uncommon',
  martyrsGift: 'uncommon',
  phalanx: 'uncommon',
  resurrect: 'rare',
  fontOfMana: 'rare',
  barrier: 'rare',
  grimHarvest: 'rare',
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
    // edge cases (e.g. it would not count as "played" against Rest). Cards whose
    // BASE cost is 0 (Blood Tithe pays in HP) keep it — the floor only guards
    // against Efficient discounting a card to free, and Efficient is ineligible
    // on 0-cost cards anyway.
    cost: Math.max(Math.min(1, base.cost), base.cost - efficient * MOD_EFFICIENT_COST),
    target: base.target,
    desc: base.desc,
    heal: bump(base.heal),
    regen: bump(base.regen),
    refresh: bump(base.refresh),
    draw: base.draw,
    needsRegen: base.needsRegen === true,
    // The cap is the BASE card's designed lifetime — Potent/Lingering change the
    // tempo of a Refresh-slot cast, never its total (flaw #7).
    refreshCap: base.refreshCap ?? REFRESH_MP_CAP,
    selfDamage: base.selfDamage,
    noDefense: base.noDefense === true,
    noTaunt: base.noTaunt === true,
    regenTurns: REGEN_TURNS + lingering * MOD_LINGERING_TURNS,
    refreshTurns: REFRESH_TURNS + lingering * MOD_LINGERING_TURNS,
    retain,
    upgrades: card.upgrades,
  };
}
