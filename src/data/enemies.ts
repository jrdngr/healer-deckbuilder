import type { AttackType, Slot, CastKind } from './tuning';

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

// A pierce step: ignores Taunt AND Defense and aims at the lowest-HP living member
// — the shared shape of every piercer (Piercing Bolt / Needle Shot / Skewer).
const pierceStep = (name: string, damage: number): RotationStep =>
  ({ type: 'single', name, damage, ignoreTaunt: true, ignoreDefense: true, targetLowest: true });

// A rotation-driven enemy: its base/enraged weights are fallback-only (the rotation
// drives attack selection), so they point at the shared normal/boss tables — kept as
// the SAME object references so weightedPick's draw order stays bit-identical (#07).
const normalDef = (id: string, name: string, rest: Partial<EnemyDef>): EnemyDef =>
  ({ id, name, boss: false, baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged, ...rest });
const bossDef = (id: string, name: string, rest: Partial<EnemyDef>): EnemyDef =>
  ({ id, name, boss: true, baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged, ...rest });

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
export const GATEWARDEN_DEF: EnemyDef = bossDef('gatewarden', 'Gatewarden', {
  rotation: ['single', 'two', 'heavy', 'sweep'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 12, type: 'heavy', name: 'Crushing Blow' },
});

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
export const HEXWEAVER_DEF: EnemyDef = bossDef('hexweaver', 'Hexweaver', {
  rotation: [
    'single',
    pierceStep('Piercing Bolt', HEXWEAVER_PIERCER_DMG),
    { type: 'cast', name: 'Hex', cast: 'wound' },
    'sweep',
    pierceStep('Piercing Bolt', HEXWEAVER_PIERCER_DMG),
    { type: 'cast', name: 'Siphon', cast: 'siphon' },
  ],
});

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
export const DEVOURER_DEF: EnemyDef = bossDef('devourer', 'Devourer', {
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
});

// Act boss per act (0-based): Gatewarden (#12), Hexweaver (#13), Devourer (#14).
export const ACT_BOSS_DEFS: EnemyDef[] = [GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF];

// ---------------------------------------------------------------------------
// Act 2/3 named normals (issue 20): boss tech at small scale, so the later map
// teaches (and rewards) the reads the act bosses demand — a channeler (mini
// Crushing Blow), a piercer (mini Piercing Bolt), a self-healer (mini Consume).
// Total threat stays near the act-1 normals' ~4.5 party-wide dmg/turn; the
// signature trick, not the numbers, is the difference. No channel/step name may
// collide with a boss's (Crushing Blow / Piercing Bolt / Maw / Consume).
// ---------------------------------------------------------------------------

// Act 2 — Ironmaw (channeler): a learnable 3-step cycle whose 3rd step becomes
// Siegebreak every 2nd cycle — a 2-turn single-target channel at 9.
export const IRONMAW_DEF: EnemyDef = normalDef('ironmaw', 'Ironmaw', {
  rotation: ['single', 'two', 'single'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 9, type: 'single', name: 'Siegebreak' },
});

// Act 2 — Needler (piercer): one step per cycle is Needle Shot — a mini
// Piercing Bolt (ignores Taunt AND Defense, aims at the lowest-HP member) at 4.
// Pierce-at-lowest is worth far more than its number (it bypasses the whole
// taunt/Defense answer), so it appears once per 4-step cycle.
export const NEEDLER_PIERCE_DMG = 4;
export const NEEDLER_DEF: EnemyDef = normalDef('needler', 'Needler', {
  rotation: ['single', pierceStep('Needle Shot', NEEDLER_PIERCE_DMG), 'two', 'single'],
});

// Act 2 — Leech (self-healer): a mini Consume ('Gorge') every 6th turn cleanses
// its own Poison and self-heals the remaining ticks — poison timing matters on
// normals now, not just on the Devourer. Its plain cycle runs light because the
// Gorge value is real threat too.
export const LEECH_DEF: EnemyDef = normalDef('leech', 'Leech', {
  rotation: ['single', 'two', 'single', 'single', { type: 'cast', name: 'Gorge', cast: 'consume' }, 'two'],
});

// Act 3 — Juggernaut (channeler, heavier): Overrun is an 11-damage 2-turn
// channel every 2nd cycle, over a single-heavy base cycle (the channel is the
// threat; the cycle stays on budget).
export const JUGGERNAUT_DEF: EnemyDef = normalDef('juggernaut', 'Juggernaut', {
  rotation: ['single', 'single', 'two'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 11, type: 'single', name: 'Overrun' },
});

// Act 3 — Lancer (piercer, heavier): Skewer pierces at 5, once per 4-step cycle.
export const LANCER_PIERCE_DMG = 5;
export const LANCER_DEF: EnemyDef = normalDef('lancer', 'Lancer', {
  rotation: ['single', pierceStep('Skewer', LANCER_PIERCE_DMG), 'single', 'two'],
});

// Act 3 — Devourling (self-healer, hungrier): Gorge every 6th turn over a
// light cycle (long 150-HP fights sit near the enrage cliff, so every eaten
// poison tick is expensive — the Gorge itself is the difficulty).
export const DEVOURLING_DEF: EnemyDef = normalDef('devourling', 'Devourling', {
  rotation: ['single', 'two', 'single', { type: 'cast', name: 'Gorge', cast: 'consume' }, 'two', 'single'],
});

export const NORMAL_ENEMY_DEFS: EnemyDef[] = [
  ENEMY_SPAMMER, ENEMY_SWARM, ENEMY_STALKER, ENEMY_CLEAVER,
  IRONMAW_DEF, NEEDLER_DEF, LEECH_DEF, JUGGERNAUT_DEF, LANCER_DEF, DEVOURLING_DEF,
];
export const ENEMY_DEF_BY_ID: Record<string, EnemyDef> =
  Object.fromEntries(NORMAL_ENEMY_DEFS.map((d) => [d.id, d]));

// Encounter table: weighted normal picks per fight index. Act-boss slots (2, 5,
// 8) are empty — those fights always use the act boss. Act 1 keeps the original
// four; acts 2/3 lead with their own named rosters (#20) — the boss-tech
// normals — with an act-1 body as occasional filler for texture.
export const ENCOUNTER_TABLE: Array<Array<[string, number]>> = [
  [['spammer', 70], ['swarm', 30]],                                       // fight 0 (A1)
  [['spammer', 45], ['swarm', 30], ['stalker', 25]],                      // fight 1 (A1)
  [],                                                                      // fight 2 (A1 boss)
  [['ironmaw', 30], ['needler', 30], ['leech', 20], ['swarm', 20]],       // fight 3 (A2)
  [['ironmaw', 25], ['needler', 25], ['leech', 25], ['cleaver', 25]],     // fight 4 (A2)
  [],                                                                      // fight 5 (A2 boss)
  [['juggernaut', 30], ['lancer', 30], ['devourling', 20], ['cleaver', 20]], // fight 6 (A3)
  [['juggernaut', 25], ['lancer', 25], ['devourling', 25], ['cleaver', 25]], // fight 7 (A3)
  [],                                                                      // fight 8 (A3 boss)
];

// There is a single, tuned mode (2026-07): the roster campaign is the one and only
// way to play. No difficulty presets, no quick-play — the per-act curve below IS the
// game. (Deliberately no meta-progression either; it fights seed determinism.)
