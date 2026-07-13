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
// Bouncer's 'Haymaker') — a channel is a bigger threat than the plain
// attack type it replaces, and sharing a name trains the wrong read.
export const ATTACK_INTENT_NAMES: Record<AttackType, string> = {
  single: 'Strike', two: 'Double Strike', aoe: 'Scattershot',
  hidden: 'Sucker Punch', heavy: 'Wallop', sweep: 'Sweep',
  // 'cast' rotation steps always carry an explicit name (Jinx / Slurp / Gulp),
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
  name: string;        // display name (e.g. "Haymaker")
}

// A single step in a scripted boss rotation. A bare AttackType is shorthand for a
// plain attack of that type (the Gatewarden uses that form); a RotationStep object
// adds the Jinxweaver's tricks: an explicit intent name, a damage override, targeting
// flags that bypass the taunt funnel, a multi-turn channel wind-up, or a scripted
// 'cast' effect. `type: 'cast'` steps deal no damage and must set `cast`.
export interface RotationStep {
  type: AttackType;
  name?: string;          // intent/display name override (e.g. 'Zinger', 'Jinx')
  damage?: number;        // per-target base damage override (defaults to ATTACK_BASE_DAMAGE[type])
  ignoreTaunt?: boolean;  // not funnelled/redirected by Taunt (still auto-aimed by targetLowest)
  ignoreDefense?: boolean;// Defense reduction does not apply to this hit
  targetLowest?: boolean; // aim the (single-target) hit at the lowest-HP living member
  channelTurns?: number;  // >1 makes this a channel with that many enemy turns to resolve
  cast?: CastKind;        // for type 'cast': which scripted effect resolves
  castAmount?: number;    // magnitude a scripted cast carries (e.g. hero-poison per-turn strength, #87)
  castTurns?: number;     // duration a scripted cast carries (e.g. hero-poison turns, #87)
  targetsMarked?: boolean;// Curse/Mark Payoff (#87): hits only currently-Marked living heroes,
                          // recomputed at resolve (so clearing a Mark drops that hero live)
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
  channel?: ChannelDef;       // a phase-2 channel slot (Big Chomp)
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
// — the shared shape of every piercer (Zinger / Needle Shot / Skewer).
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
// SIGNATURE: Executioner (#87). A scripted focus-fire — two single hits that both aim
// at the lowest-HP living hero, so a wounded squishy keeps taking the blows and gets
// finished off unless the party heals it up or Taunts the hunt away (targetLowest is
// still funnelled by Taunt, so the tank can pull the execution onto itself). The closing
// 'two' keeps the per-turn threat near the ~4.5 party-wide budget (identity, not a spike).
export const ENEMY_SPAMMER: EnemyDef = { // Executioner: focus-fires the weakest hero
  id: 'spammer', name: 'Basher', boss: false,
  baseWeights: aw(78, 14, 4, 4, 0, 0), enragedWeights: aw(58, 24, 14, 4, 0, 0),
  rotation: [
    { type: 'single', name: 'Hunt', targetLowest: true },
    { type: 'single', name: 'Hunt', targetLowest: true },
    'two',
  ],
};
// SIGNATURE: AoE-lite. A weight shape that leans on multi-target blows (two/aoe) — the
// party takes spread chip damage, so the answer is party-wide topping-up, not saving one.
export const ENEMY_SWARM: EnemyDef = { // AoE-lite: leans on multi-target blows
  id: 'swarm', name: 'Rabble', boss: false,
  baseWeights: aw(52, 26, 17, 5, 0, 0), enragedWeights: aw(35, 33, 27, 5, 0, 0),
};
// SIGNATURE: Ambush. A weight shape heavy on 'hidden' — its concealed strike (unknown
// target, magnitude revealed) is the read: keep a Shield or heal buffer ready for anyone.
export const ENEMY_STALKER: EnemyDef = { // Ambush: leans on concealed (hidden) blows
  id: 'stalker', name: 'Skulker', boss: false,
  baseWeights: aw(52, 10, 8, 30, 0, 0), enragedWeights: aw(35, 18, 17, 30, 0, 0),
};
// SIGNATURE: Cleave. A weight shape carrying real 'heavy' weight — an occasional big
// single blow you must mitigate (Defense/Shield) or heal through, unlike the other
// act-1 normals' chip damage.
export const ENEMY_CLEAVER: EnemyDef = { // Cleave: occasional heavy single hit
  id: 'cleaver', name: 'Clobberer', boss: false,
  baseWeights: aw(58, 12, 7, 5, 18, 0), enragedWeights: aw(42, 18, 12, 5, 23, 0),
};
// SIGNATURE: Mark (#87). The act-1 teacher for the Jinxweaver's clear-or-die read: a
// Whammy Marks the whole party (no damage), then the very next step Kapow strikes only
// the still-Marked heroes. Answer it by clearing the Mark (Cleanse) OR by mitigation
// (Shield fully blocks Kapow; Defense shaves it) — the small act-1 payoff teaches the
// read without one-shotting. Mark and Kapow sit on ADJACENT slots so exactly one player
// turn falls between them (MARK_TURNS survives the single decay).
export const DOOMLING_PAYOFF_DMG = 5; // Kapow per-target damage (before attackBonus/enrage)
export const ENEMY_MARKER: EnemyDef = { // Mark: telegraphed clear-or-die on the party
  id: 'marker', name: 'Doomling', boss: false,
  baseWeights: aw(60, 20, 10, 10, 0, 0), enragedWeights: aw(45, 28, 17, 10, 0, 0),
  rotation: [
    'single',
    { type: 'cast', name: 'Whammy', cast: 'curse' },
    { type: 'heavy', name: 'Kapow', damage: DOOMLING_PAYOFF_DMG, targetsMarked: true },
    'two',
  ],
};

// Boss 1 — Bouncer (issue 12). SIGNATURE: the clean teaching boss — a fixed,
// learnable rotation + a periodic Haymaker channel that teaches telegraph-reading. Every 2nd cycle its heavy becomes Haymaker — a 2-turn
// channel at 12 (~1.7× heavy). Opens on single, complementing the turn-1 rule.
// 14 keeps the read answerable (playtest finding): a defended tank takes 13, so
// Taunt upkeep + topping the tank up survives it, while the ranger (11) and
// mage (9) still die to it — at the original 20 it exceeded every max HP and
// killed a member in 82% of good-play sims, teaching sacrifice instead.
export const GATEWARDEN_DEF: EnemyDef = bossDef('gatewarden', 'Bouncer', {
  rotation: ['single', 'two', 'heavy', 'sweep'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 12, type: 'heavy', name: 'Haymaker' },
});

// Boss 2 — Jinxweaver (issue 13). SIGNATURE: the telegraphed debuff-punisher. It breaks the
// permanent-taunt/turtle solve with three tools, all fully telegraphed:
//   • Zinger — ignores Taunt AND Defense, aims at the lowest-HP member, so
//     the tank can't soak it and the fragile DPS is the one under threat.
//   • Jinx — a 'cast' that halves ALL healing for WOUND_TURNS turns (you can't
//     out-heal it — Cleanse removes it).
//   • Slurp — a 'cast' that drains SIPHON_AMOUNT healer MP (you can't cast freely).
// Opens on a plain single (a gentle turn-1 read), then cycles the three tricks
// between whole-party pressure. Cleanse (added this issue) is its designed counter.
// #87: Jinxweaver gains the boss-scale Curse/Mark climax (taught by the act-1 Doomling).
// Doom Marks the whole party, then the adjacent Reckoning strikes every still-Marked hero
// for heavy damage — clear-or-die at boss scale: Cleanse OR mitigation (Shield fully
// blocks, Defense shaves below lethal). It REPLACES the sweep + the second Zinger, so all
// of the boss's original tricks survive — pierce (Zinger), wound (Jinx), siphon (Slurp) —
// and the Payoff takes over the sweep's party-wide-threat role, keeping the fight in budget.
export const HEXWEAVER_PIERCER_DMG = 5; // Zinger per-hit damage (before attackBonus)
export const HEXWEAVER_PAYOFF_DMG = 8;  // Reckoning per-target damage on the still-Marked (before attackBonus/enrage)
export const HEXWEAVER_DEF: EnemyDef = bossDef('hexweaver', 'Jinxweaver', {
  rotation: [
    'single',
    pierceStep('Zinger', HEXWEAVER_PIERCER_DMG),
    { type: 'cast', name: 'Jinx', cast: 'wound' },
    { type: 'cast', name: 'Doom', cast: 'curse' },
    { type: 'heavy', name: 'Reckoning', damage: HEXWEAVER_PAYOFF_DMG, targetsMarked: true },
    { type: 'cast', name: 'Slurp', cast: 'siphon' },
  ],
});

// Boss 3 — Gobbler (issue 14). SIGNATURE: the two-phase "race or die" boss. Turns the invisible enrage race
// into an explicit, fair one via a phase system:
//   • Phase 1 (>50% HP): a heavy/sweep pool plus Gulp — a 'cast' that cleanses
//     its OWN Poison and self-heals for every remaining tick, so poison stops being
//     free value (it becomes a decision — the deferred call in #18).
//   • Phase 2 (<=50% HP): an announced transformation beat, then Big Chomp — a 2-turn
//     channelled sweep at DEVOURER_MAW_DMG x3, recurring every ~4 turns — plus a
//     tighter enrage. Enraged Big Chomp one-shots an unshielded squishy: race it down.
// The phase threshold is edge-detected (fires once, even mid-Poison-tick).
// #87: the Gobbler gains boss-scale Hero Poison. Phase 1's trailing heavy becomes Sludge —
// a stacking, cleansable DoT on the party (taught by the act-2 Gloopy) — so the race gains
// a ramp: ignore it and it spikes into real burst on the squishies. Cleanse is the only
// answer (it ticks raw, past Shield/Defense). Thematic next to Gulp: it eats its own poison
// and spits some on you. Budget-neutral — a 0-direct-damage applier for a 7-damage heavy.
export const DEVOURER_MAW_DMG = 7;    // Big Chomp per-target sweep damage (before enrage/attackBonus)
export const DEVOURER_SLUDGE_DMG = 3; // Sludge per-turn hero-poison strength
export const DEVOURER_SLUDGE_TURNS = 3; // Sludge hero-poison duration
export const DEVOURER_DEF: EnemyDef = bossDef('devourer', 'Gobbler', {
  rotation: [
    'single',
    'heavy',
    'sweep',
    { type: 'cast', name: 'Gulp', cast: 'consume' },
    'two',
    { type: 'cast', name: 'Sludge', cast: 'poison', castAmount: DEVOURER_SLUDGE_DMG, castTurns: DEVOURER_SLUDGE_TURNS },
  ],
  phase: {
    hpFraction: 0.5,
    beat: 'The Gobbler unhinges its jaw and TRANSFORMS!',
    // Slot 0 is always Big Chomp (the channel fires every cycle at slot 0); the 'sweep'
    // literal there is a placeholder the channel overrides. Big Chomp resolves every 4
    // enemy turns (2-turn wind-up + heavy + two).
    rotation: ['sweep', 'heavy', 'two'],
    channel: { slot: 0, everyCycles: 1, turns: 2, damage: DEVOURER_MAW_DMG, type: 'sweep', name: 'Big Chomp' },
    enrageTurn: 11,
  },
});

// Act boss per act (0-based): Bouncer (#12), Jinxweaver (#13), Gobbler (#14).
export const ACT_BOSS_DEFS: EnemyDef[] = [GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF];

// ---------------------------------------------------------------------------
// Act 2/3 named normals (issue 20): boss tech at small scale, so the later map
// teaches (and rewards) the reads the act bosses demand — a channeler (mini
// Haymaker), a piercer (mini Zinger), a self-healer (mini Gulp).
// Total threat stays near the act-1 normals' ~4.5 party-wide dmg/turn; the
// signature trick, not the numbers, is the difference. No channel/step name may
// collide with a boss's (Haymaker / Zinger / Big Chomp / Gulp).
// ---------------------------------------------------------------------------

// Act 2 — Ironchomp. SIGNATURE: Channeler — a learnable 3-step cycle whose 3rd step becomes
// Jawbreaker every 2nd cycle — a 2-turn single-target channel at 9.
export const IRONMAW_DEF: EnemyDef = normalDef('ironmaw', 'Ironchomp', {
  rotation: ['single', 'two', 'single'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 9, type: 'single', name: 'Jawbreaker' },
});

// Act 2 — Needler. SIGNATURE: Piercer — one step per cycle is Needle Shot — a mini
// Zinger (ignores Taunt AND Defense, aims at the lowest-HP member) at 4.
// Pierce-at-lowest is worth far more than its number (it bypasses the whole
// taunt/Defense answer), so it appears once per 4-step cycle.
export const NEEDLER_PIERCE_DMG = 4;
export const NEEDLER_DEF: EnemyDef = normalDef('needler', 'Needler', {
  rotation: ['single', pierceStep('Needle Shot', NEEDLER_PIERCE_DMG), 'two', 'single'],
});

// Act 2 — Leech. SIGNATURE: Self-healer — a mini Gulp ('Snack Time') every 6th turn cleanses
// its own Poison and self-heals the remaining ticks — poison timing matters on
// normals now, not just on the Gobbler. Its plain cycle runs light because the
// Snack Time value is real threat too.
export const LEECH_DEF: EnemyDef = normalDef('leech', 'Leech', {
  rotation: ['single', 'two', 'single', 'single', { type: 'cast', name: 'Snack Time', cast: 'consume' }, 'two'],
});

// Act 2 — Gloopy. SIGNATURE: Poisoner (#87) — the act-2 teacher for the Gobbler's Sludge.
// Its Ick cast lays a small, STACKING Hero Poison (raw ticks past mitigation) on the whole
// party, so the party learns that Cleanse — not a shield — is the answer, before act 3
// weaponises it. The plain cycle runs light; the DoT ramp is the threat.
export const GLOOPY_POISON_DMG = 2;   // Ick per-turn hero-poison strength
export const GLOOPY_POISON_TURNS = 3; // Ick hero-poison duration
export const VENOMANCER_DEF: EnemyDef = normalDef('venomancer', 'Gloopy', {
  rotation: [
    'single', 'two',
    { type: 'cast', name: 'Ick', cast: 'poison', castAmount: GLOOPY_POISON_DMG, castTurns: GLOOPY_POISON_TURNS },
    'single', 'two',
  ],
});

// Act 3 — Steamroller. SIGNATURE: Channeler (heavier) — Flatten is an 11-damage 2-turn
// channel every 2nd cycle, over a single-heavy base cycle (the channel is the
// threat; the cycle stays on budget).
export const JUGGERNAUT_DEF: EnemyDef = normalDef('juggernaut', 'Steamroller', {
  rotation: ['single', 'single', 'two'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 11, type: 'single', name: 'Flatten' },
});

// Act 3 — Pokey. SIGNATURE: Piercer (heavier) — Skewer pierces at 5, once per 4-step cycle.
export const LANCER_PIERCE_DMG = 5;
export const LANCER_DEF: EnemyDef = normalDef('lancer', 'Pokey', {
  rotation: ['single', pierceStep('Skewer', LANCER_PIERCE_DMG), 'single', 'two'],
});

// Act 3 — Gobblet. SIGNATURE: Self-healer (hungrier) — Snack Time every 6th turn over a
// light cycle (long 150-HP fights sit near the enrage cliff, so every eaten
// poison tick is expensive — the Snack Time itself is the difficulty).
export const DEVOURLING_DEF: EnemyDef = normalDef('devourling', 'Gobblet', {
  rotation: ['single', 'two', 'single', { type: 'cast', name: 'Snack Time', cast: 'consume' }, 'two', 'single'],
});

export const NORMAL_ENEMY_DEFS: EnemyDef[] = [
  ENEMY_SPAMMER, ENEMY_SWARM, ENEMY_STALKER, ENEMY_CLEAVER, ENEMY_MARKER,
  IRONMAW_DEF, NEEDLER_DEF, LEECH_DEF, VENOMANCER_DEF, JUGGERNAUT_DEF, LANCER_DEF, DEVOURLING_DEF,
];
export const ENEMY_DEF_BY_ID: Record<string, EnemyDef> =
  Object.fromEntries(NORMAL_ENEMY_DEFS.map((d) => [d.id, d]));

// Encounter table: weighted normal picks per fight index. Act-boss slots (2, 5,
// 8) are empty — those fights always use the act boss. Act 1 keeps the original
// four; acts 2/3 lead with their own named rosters (#20) — the boss-tech
// normals — with an act-1 body as occasional filler for texture.
export const ENCOUNTER_TABLE: Array<Array<[string, number]>> = [
  [['spammer', 55], ['swarm', 25], ['marker', 20]],                       // fight 0 (A1)
  [['spammer', 35], ['swarm', 25], ['stalker', 20], ['marker', 20]],      // fight 1 (A1)
  [],                                                                      // fight 2 (A1 boss)
  [['ironmaw', 25], ['needler', 25], ['leech', 20], ['venomancer', 20], ['swarm', 10]],   // fight 3 (A2)
  [['ironmaw', 22], ['needler', 22], ['leech', 22], ['venomancer', 22], ['cleaver', 12]], // fight 4 (A2)
  [],                                                                      // fight 5 (A2 boss)
  [['juggernaut', 30], ['lancer', 30], ['devourling', 20], ['cleaver', 20]], // fight 6 (A3)
  [['juggernaut', 25], ['lancer', 25], ['devourling', 25], ['cleaver', 25]], // fight 7 (A3)
  [],                                                                      // fight 8 (A3 boss)
];

// There is a single, tuned mode (2026-07): the roster campaign is the one and only
// way to play. No difficulty presets, no quick-play — the per-act curve below IS the
// game. (Deliberately no meta-progression either; it fights seed determinism.)
