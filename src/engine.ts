// Core battle engine for the Healer Deckbuilder prototype.
// Pure logic, no DOM. Drives one handcrafted fight end to end.
//
// Turn order: the enemy takes the first turn — an opening strike lands before the
// player can act. After that, each turn runs player phase -> party phase -> enemy
// phase. The opener is a bonus ambush (a plain single, never a heavy/sweep) that
// advances neither the rotation nor the enrage clock, so turn 1 is still the
// player's first planning turn against the standing telegraph.
// The UI drives it by calling:
//   new Game(seed); game.start();          // resolves the opening strike, telegraphs turn 1, opens the player phase
//   game.playCard(handIndex, target);      // during player phase
//   game.skipTurn();                        // regen MP instead of playing (before any card)
//   game.endTurn();                         // discard, party phase, then the enemy resolves + telegraphs next
// Read state off the public fields; read game.log for a running event feed.

import {
  MEMBER_DEFS, MEMBER_POOL, ATTACK_BASE_DAMAGE, SLOT_WEIGHTS,
  HEX_TURNS, HEX_VULN_BY_SIZE, HEX_VULN_PER_POWER,
  SMALL_PARTY_MAX, LONE_WOLF_DMG, FOCUS_STONE_MP, WARBAND_HP_PER_SEAT,
  RALLY_DMG_PER_SEAT, FOCUS_HEAL, FOCUS_SMALL_BONUS, CHANNEL_MP,
  SKALD_DMG_PER_CARD, SKALD_DMG_CAP, CRESCENDO_DRAW,
  BERSERKER_BAND1_HP, BERSERKER_BAND2_HP, BERSERKER_BAND_BONUS, RAMPAGE_SELF_DMG, GRAVE_CHILL_REDUCTION,
  BOAR_HP, BOAR_TURNS, BOAR_STRIKE_BONUS,
  ENRAGE_TURN, ENRAGE_MULT, BOLT_BASE, BOLT_CHARGE_MULT, CHARGE_MAX,
  POISON_BASE, POISON_TURNS,
  TAUNT_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS, SHIELD_TURNS, SLOT,
  TAUNT_LITE_TURNS, TAUNT_LITE_DEFENSE,
  GUARD_DR, GUARD_TURNS, SHARPEN_BONUS, SHARPEN_TURNS,
  EMBOLDEN_BONUS, EMBOLDEN_TURNS, EMPOWER_BONUS,
  SHADOW_BOLT_DMG, SIPHON_LIFE_DMG, SIPHON_LIFE_HEAL,
  DOOM_BASE, DOOM_PER_DEBUFF, DOOM_PER_VULN, DOOM_CAP, cardType,
  HOLY_RELIC_HEAL, SHADOW_RELIC_DMG, IRON_RELIC_DISCOUNT,
  CASCADE_DISCOUNT_PER_ARCANE, NIGHTFALL_BASE, NIGHTFALL_PER_SHADOW, NIGHTFALL_CAP,
  DEFAULT_TAUNT_RETARGET_MODE, TAUNT_RETARGET_SURCHARGE,
  SKIP_REGEN_DECAYED, REFRESH_MP_CAP,
  CULTIVATE_STRENGTH, BLOOM_HEAL_PER_TURN,
  LIFEBLOOM_BURST, HYMN_BONUS, BARRIER_TURNS, BLOOD_TITHE_MP, GRIM_HARVEST_DMG,
  PHALANX_DEFENSE, PHALANX_TURNS, BRACE_AMOUNT, BRACE_TURNS,
  TITHE_CANDLE_MP, TITHE_CANDLE_FIGHT_CAP, FIELD_TRIAGE_BONUS, FIELD_TRIAGE_THRESHOLD,
  GROUNDING_ROD_REDUCTION, PRAYER_BEADS_MP, STORMGLASS_MIN_HIT, VANGUARD_BONUS,
  WARD_MAX, TAPER_MAX_COST, TAPER_DISCOUNT, DUSK_CHIME_MIN, PACT_PASSIVE_MP,
  CRACKED_HOURGLASS_ENRAGE, HOURGLASS_POWER_BONUS, RUSTY_CROWN_ATTACK,
  isEngineCard,
  WOUND_TURNS, WOUND_HEAL_FACTOR, SIPHON_AMOUNT,
  DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, ATTACK_INTENT_NAMES,
  defaultBattleConfig, resolveCard, makeDeckCard,
} from './constants';
import type {
  Slot, AttackType, MemberId, AbilityId, BattleConfig, DeckCard, ResolvedCard, CardId,
  TauntRetargetMode, EnemyDef, RotationStep, RotationEntry, CastKind, RelicId, CardType,
} from './constants';
import { makeRng, shuffle, weightedPick } from './rng';
import type { Rng } from './rng';

export type Phase = 'idle' | 'player' | 'over';
export type Status = 'playing' | 'win' | 'loss';

export interface Member {
  slot: Slot;
  id: MemberId;
  name: string;
  maxHP: number;
  damage: number;
  ability: AbilityId;
  abilityPower: number; // run bonus added to the member's base ability strength
  hp: number;
  alive: boolean;
  shield: boolean;      // pending shield (blocks the next damaging instance)
  shieldTurns: number;  // enemy turns the pending Shield lasts before fading unused
  brace: boolean;       // pending Brace: next damaging instance reduced by BRACE_AMOUNT (#17)
  braceTurns: number;   // enemy turns the pending Brace lasts before fading unused
  regen: number;      // Regen value (#52): heals this much this tick, then decays by 1
                      // each tick until 0. Magnitude IS duration — a Regen R runs R ticks.
  bloomBurst: number; // pending Lifebloom burst: heals this much when the Regen ends alive (#16)
  taunt: number;   // taunt turns remaining (attributed to whoever cast Taunt)
  defense: number; // Defense turns remaining: incoming hits reduced by defenseAmount
  defenseAmount: number; // per-member Defense strength while defense > 0 (#17)
  charge: number;  // per-member Charge (feeds the Bolt ability); ticks each player phase
  drumPrimed: boolean; // War Drum relic (#21) / Double Strike card (#62): next auto deals double (consumed)
  strikeBonus: number; // Sharpen / Embolden (#62): +auto damage while strikeTurns > 0
  strikeTurns: number; // enemy turns strikeBonus lasts before it decays
  guardDR: number;     // Guard (#62): incoming damage reduced by this while guardTurns > 0
  guardTurns: number;  // enemy turns guardDR lasts before it decays
  empowerBonus: number; // Empower (#62): +abilityPower on the next ability this hero fires (one-shot)
  riposte: boolean;    // Riposte (#62): counter the next attack that hits this hero (consumed)
  ward: number;    // Aegis Font (#22): damage buffer from cast-heal overheal (max WARD_MAX)
  boarHp: number;   // Beast Warden (#29): standing Boar's HP (0 = no Boar); it soaks whole hits
  boarTurns: number; // Beast Warden (#29): enemy turns the Boar has left before it returns to the wild
  diedThisFight: boolean; // DR1: went to 0 HP at any point this fight (a later Resurrect
                          // does not clear it — death always scars; a Martyr's Icon save
                          // vetoes the death, so it never sets this).
  injuries: number; // DR1 (display only): persistent scars carried in from the run; the
                    // stat penalty they cause is already baked into maxHP/damage/abilityPower.
  incapacitated: boolean; // 'incapacitate' injury mode: starts the fight dead and cannot be
                          // Resurrected (the run layer heals the scar to restore them).
  absent: boolean; // an unfilled deploy slot (no member seated here): starts dead, is never
                   // targeted and never strikes (excluded like any dead member via alive:false);
                   // the battle UI renders it as an empty slot rather than a fallen hero.
}

export interface Enemy {
  hp: number;
  maxHP: number;
  poison: number;      // Poison strength: damage dealt per turn while active
  poisonTurns: number; // enemy turns of Poison remaining
  vulnerable: number;      // Vulnerability (Warlock's Hex, #39): party damage is x(1 + this)
  vulnerableTurns: number; // enemy turns of Vulnerability remaining
  enraged: boolean;
}

export interface Telegraph {
  type: AttackType;
  hidden: boolean;
  damage: number;
  targets: Slot[];
  enraged: boolean;
  forTurn: number;
  channel?: boolean;          // a multi-turn channelled attack (its wind-up is the telegraph)
  channelName?: string;       // display name for the channel (e.g. "Crushing Blow")
  turnsUntilResolve?: number; // enemy turns until it lands (undefined/1 = lands next enemy phase)
  name?: string;              // intent-name override (scripted rotation steps, e.g. "Piercing Bolt")
  ignoreTaunt?: boolean;      // not funnelled/redirected by Taunt (Hexweaver's Piercing Bolt)
  ignoreDefense?: boolean;    // Defense reduction does not apply to this hit
  targetLowest?: boolean;     // aimed at the lowest-HP living member (locked at telegraph time)
  cast?: CastKind;            // a scripted no-damage effect resolves instead of a hit
  stunned?: boolean;          // Sentinel's Stun (#61): the move is cancelled — it deals no
                              // damage / runs no cast, is consumed (rotation advances,
                              // channel wind-up aborts), and a fresh action telegraphs next turn
}

export interface LogEntry {
  text: string;
  kind: string;
  turn: number;
}

// One line spec for the telegraph overlay. Hidden attacks carry null damage.
export interface AttackSpec {
  slot: Slot;
  damage: number | null;
  hidden: boolean;
}

// Structured, ordered record of everything that happened during a single action
// (start / playCard / skipTurn / endTurn). The UI replays this list to drive its
// animations. Each event carries the *post-event* values it touches (e.g. a hit
// records the target's resulting HP) so the view can stage numbers/bars to the
// exact moment each effect lands without re-deriving any engine math. Pure data —
// no DOM, no timing.
export type GameEvent =
  // --- enemy phase ---
  // Marks the moment the enemy's turn begins (the UI sweeps a phase banner).
  | { kind: 'enemyPhase' }
  | { kind: 'enrage' }
  // --- channelled attacks (Gatewarden, #12): a wind-up the cast bar tracks ---
  | { kind: 'channelStart'; name: string; damage: number; turnsUntilResolve: number }
  | { kind: 'channelTick'; name: string; turnsUntilResolve: number }
  | { kind: 'poisonTick'; amount: number; enemyHp: number }
  | { kind: 'refreshTick'; amount: number; mp: number }
  // --- scripted 'cast' resolutions (Hexweaver #13, Devourer #14) ---
  | { kind: 'wound'; turns: number }                       // Hex: healing halved for `turns`
  | { kind: 'siphon'; amount: number; mp: number }         // Siphon: MP drained
  | { kind: 'consume'; heal: number; enemyHp: number }     // Devourer: self-heal off its own poison
  | { kind: 'phaseChange'; beat: string }                  // Devourer: transformation beat
  // `attackType` is the telegraph geometry that produced the hit, so the
  // animator can give each attack shape its own visual signature.
  | { kind: 'enemyAttack'; slot: Slot; amount: number; hp: number;
      result: 'hit' | 'shield' | 'whiff'; killed: boolean; hidden: boolean;
      attackType: AttackType }
  // --- player phase start (regen resolves after the enemy's blow has landed) ---
  | { kind: 'regenTick'; slot: Slot; amount: number; hp: number }
  // --- party phase (one per attacking member, left to right) ---
  // `memberId` names the striker: any member can occupy any slot in a drafted
  // party, so identity (not slot) drives the strike's visual signature.
  | { kind: 'partyAttack'; slot: Slot; memberId: MemberId; amount: number; enemyHp: number }
  // --- healing / buffs / spells ---
  | { kind: 'heal'; slot: Slot; amount: number; hp: number }
  | { kind: 'regenApplied'; slot: Slot; stack: number }
  | { kind: 'shieldApplied'; slot: Slot }
  | { kind: 'defenseApplied'; slot: Slot; amount: number } // Phalanx (#17)
  | { kind: 'braceApplied'; slot: Slot }                   // Brace (#17)
  | { kind: 'resurrect'; slot: Slot; hp: number }
  | { kind: 'refreshPrimed'; stack: number }
  | { kind: 'draw'; count: number }
  | { kind: 'surge' }                                      // next card this turn costs 0 (#16)
  | { kind: 'wardApplied'; slot: Slot; amount: number }    // Aegis Font ward gained (#22)
  | { kind: 'chime' }                                      // Dusk Chime delays the telegraph (#22)
  | { kind: 'martyrSave'; slot: Slot }                     // Martyr's Icon refuses a death (#22)
  | { kind: 'hymn'; bonus: number }                        // party autos buffed this phase (#16)
  | { kind: 'bloodPay'; slot: Slot; amount: number; hp: number } // Blood card HP cost paid (#16)
  | { kind: 'cleanse'; slot: Slot }
  | { kind: 'rest'; amount: number; mp: number }
  // --- abilities ---
  | { kind: 'poisonApplied'; slot: Slot; amount: number; poison: number }
  | { kind: 'taunt'; slot: Slot; turns: number }
  | { kind: 'bolt'; slot: Slot; amount: number; enemyHp: number }
  | { kind: 'graveChill'; slot: Slot; amount: number } // Grave Chill weakens the telegraph (#28)
  | { kind: 'boarSummon'; slot: Slot; hp: number; turns: number } // Beast Warden calls a Boar (#29)
  | { kind: 'boarHit'; slot: Slot; amount: number; boarHp: number; killed: boolean } // Boar soaks a hit (#29)
  | { kind: 'boarExpire'; slot: Slot } // Boar returns to the wild (#29)
  | { kind: 'stun'; slot: Slot; intent: string } // Sentinel cancels the standing telegraph (#61)
  // --- terminal flourishes ---
  | { kind: 'defeatEnemy' }
  | { kind: 'wipe' };

export interface PlayResult {
  ok: boolean;
  reason?: string;
}

export class Game {
  seed: number;
  rng: Rng;
  config: BattleConfig;
  enemyDef: EnemyDef; // data-driven enemy behavior (attack weights, name)
  enrageTurn: number; // the turn this enemy enrages (per-fight; default ENRAGE_TURN)
  members: Member[];
  enemy: Enemy;
  mp: number;
  maxMana: number;   // MP cap (healer stat); starting MP equals this
  handSize: number;  // cards drawn each player phase (healer stat)
  carryover: number; // cards kept across the end-of-turn discard (#25 experiment; 0 = off)
  restRegen: number; // MP regained on rest (healer stat)
  passiveMp: number; // MP gained at the start of each player phase (healer stat)
  refresh: number;        // Refresh strength: MP restored per turn while active
  refreshTurns: number;   // enemy turns of Refresh remaining
  refreshRestored: number; // MP the current Refresh cast has restored so far (capped at refreshCap)
  refreshCap: number;     // per-cast lifetime MP cap of the active cast (Refresh 6 / Font of Mana 9)
  woundTurns: number;     // party-wide Hex remaining (halves all healing while > 0); Cleanse clears it
  surgePending: boolean;  // Surge (#16): the next card played this turn costs 0 MP
  hymnBonus: number;      // Battle Hymn (#16): damage added to each living auto this party phase
  relics: Set<RelicId>;   // run-long passives (#21); empty set = fully inert
  echoUsed: boolean;      // Echo Locket: its once-per-fight return has fired
  stormglassUsed: boolean;// Stormglass Mirror: its once-per-fight negate has fired
  titheGained: number;    // Tithe Candle MP granted this fight (capped per fight)
  chimeUsed: boolean;     // Dusk Chime (#22): its once-per-RUN delay has fired
  martyrUsed: boolean;    // Martyr's Icon (#22): its once-per-RUN save has fired
  taperFired: boolean;    // First-Light Taper (#22): the discount fired this turn
  drawPile: DeckCard[];
  discardPile: DeckCard[];
  hand: DeckCard[];
  turn: number;
  phase: Phase;
  status: Status;
  cardsPlayedThisPhase: number; // cards played this player phase; drives decaying Rest (+5 at 0, +1 at 1)
  // Per-type cards-played counters (#63): both feed the type-synergy relics and the
  // count-based cards from one source. `ThisTurn` resets each player phase (Iron Ward's
  // first-Iron discount, the Arcane count card's per-turn cost scaling); `ThisFight`
  // resets only at fight start (the Shadow count card's per-fight damage scaling).
  typePlayedThisTurn: Record<CardType, number>;
  typePlayedThisFight: Record<CardType, number>;
  telegraph: Telegraph | null;
  rotationIndex: number; // index into a rotation enemy's fixed attack cycle (see EnemyDef.rotation)
  phaseTriggered: boolean; // whether the enemy's HP-threshold phase has fired (edge-detect, #14)
  activeRotationOverride?: RotationEntry[]; // rotation swapped in by a phase transition (#14)
  activeChannelOverride?: EnemyDef['channel']; // channel swapped in by a phase transition (#14)
  tauntRetargetMode: TauntRetargetMode; // how Taunt treats the standing telegraph (see constants)
  log: LogEntry[];
  events: GameEvent[]; // animation feed for the most recent action (see GameEvent)

  constructor(seed: number = Date.now(), config: BattleConfig = defaultBattleConfig()) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.config = config;
    // Read enemy behavior from the def; a config without one (e.g. older test
    // fixtures) synthesizes the stock def from its boss flag, so the engine always
    // has a single source for attack weights and never forks on the boss flag.
    this.enemyDef = config.enemy.def ?? (config.enemy.boss ? BOSS_ENEMY_DEF : DEFAULT_ENEMY_DEF);
    this.enrageTurn = config.enemy.enrageTurn ?? ENRAGE_TURN;

    // Warband Standard (#42): every fielded member gains max HP per EMPTY deploy
    // seat, so a smaller party is sturdier per body. Computed once from the config.
    const emptySeatsAtStart = config.party.filter((p) => p.empty === true).length;
    const warbandBonus = (config.relics?.includes('warband') ? WARBAND_HP_PER_SEAT * emptySeatsAtStart : 0);
    this.members = config.party.map((p, slot): Member => {
      // Identity comes from the drafted member id (#27) when present, else the
      // classic trio member that homes this slot. The engine seats it at the map
      // index, so any member can occupy any slot.
      const d = p.member ? MEMBER_POOL[p.member] : MEMBER_DEFS[slot];
      // An empty deploy slot ('empty') has no member seated: it enters absent —
      // dead, unstriking, untargetable — so a 1- or 2-member deployment leaves the
      // remaining slots inert. Its trio-default identity below is never read while
      // absent (memberById skips absent members).
      const empty = p.empty === true;
      const down = empty || (p.incapacitated ?? false);
      const maxHP = p.maxHP + (empty ? 0 : warbandBonus); // Warband only sturdies seated bodies
      return {
        slot: slot as Slot, id: d.id, name: d.name, maxHP, damage: p.damage,
        ability: d.ability, abilityPower: p.abilityPower,
        // An incapacitated member ('incapacitate' injury mode) or an empty slot starts
        // the fight dead; diedThisFight stays false (no NEW scar for a fight they never
        // stood in). Otherwise HP persists across fights (#58): seat at the config's
        // carried HP, clamped to this fight's max (which includes the Warband bonus and
        // already folds the injury penalty); absent HP means full (quick-play/standalone).
        hp: down ? 0 : Math.min(maxHP, p.hp ?? maxHP), alive: !down,
        shield: false, // pending shield (blocks the next damaging instance)
        shieldTurns: 0,
        brace: false,  // pending Brace (one-shot damage reduction)
        braceTurns: 0,
        regen: 0,      // Regen value (magnitude == remaining ticks; #52)
        bloomBurst: 0, // no Lifebloom burst pending
        taunt: 0,      // taunt turns remaining (attributed to the caster)
        defense: 0,    // Defense turns remaining
        defenseAmount: 0, // Defense strength while active
        charge: 0,     // per-member Charge
        drumPrimed: false, // no War Drum / Double Strike beat pending
        strikeBonus: 0, strikeTurns: 0, // no Sharpen/Embolden buff (#62)
        guardDR: 0, guardTurns: 0,       // no Guard buff (#62)
        empowerBonus: 0, // no Empower pending (#62)
        riposte: false,  // no Riposte pending (#62)
        ward: 0,       // no Aegis Ward standing
        boarHp: 0,     // no Boar summoned yet (#29)
        boarTurns: 0,
        diedThisFight: false, // no death yet this fight
        injuries: p.injuries, // display-only; penalty already folded into the stats above
        incapacitated: p.incapacitated ?? false,
        absent: empty,
      };
    });

    this.enemy = {
      hp: config.enemy.maxHP, maxHP: config.enemy.maxHP,
      poison: 0, poisonTurns: 0, vulnerable: 0, vulnerableTurns: 0, enraged: false,
    };

    // Focus Stone (#42): fewer bodies to tend means more MP to spare while small.
    const focusStoneMp = (config.relics?.includes('focusStone') && (3 - emptySeatsAtStart) <= SMALL_PARTY_MAX) ? FOCUS_STONE_MP : 0;
    this.maxMana = config.healer.maxMana + focusStoneMp;
    this.handSize = config.healer.handSize;
    this.carryover = config.healer.carryover ?? 0;
    this.restRegen = config.healer.restRegen;
    this.passiveMp = config.healer.passiveMp;

    this.mp = this.maxMana; // starting MP each fight equals the cap
    this.refresh = 0;       // Refresh strength
    this.refreshTurns = 0;  // Refresh turns remaining
    this.refreshRestored = 0;
    this.refreshCap = REFRESH_MP_CAP;
    this.woundTurns = 0;    // no Hex active at fight start
    this.surgePending = false;
    this.hymnBonus = 0;
    this.relics = new Set(config.relics ?? []);
    this.echoUsed = false;
    this.stormglassUsed = false;
    this.titheGained = 0;
    const spent = new Set(config.spentRelics ?? []);
    this.chimeUsed = spent.has('duskChime');   // once per RUN (#22)
    this.martyrUsed = spent.has('martyrsIcon'); // once per RUN (#22)
    this.taperFired = false;
    // Cracked Hourglass (#22): the race starts earlier, whoever the enemy is.
    if (this.relics.has('crackedHourglass')) {
      this.enrageTurn = Math.min(this.enrageTurn, CRACKED_HOURGLASS_ENRAGE);
    }

    // Battle uses fresh instances of the run deck (shuffled) — never the run's
    // own array — so reshuffles here don't disturb the persistent deck.
    this.drawPile = shuffle(config.deck.map((c) => ({ ...c })), this.rng);
    this.discardPile = [];
    this.hand = [];

    this.turn = 1;           // the turn whose telegraph stands during the player phase (resolves at end of turn, #26)
    this.phase = 'idle';     // 'idle' | 'player' | 'over'
    this.status = 'playing'; // 'playing' | 'win' | 'loss'
    this.cardsPlayedThisPhase = 0;
    this.typePlayedThisTurn = Game._zeroTypeCounts();
    this.typePlayedThisFight = Game._zeroTypeCounts();
    this.telegraph = null;   // upcoming attack (the one that lands next enemy phase)
    this.rotationIndex = 0;  // advances each time a rotation enemy issues an attack
    this.phaseTriggered = false; // no phase transition has fired yet
    this.tauntRetargetMode = DEFAULT_TAUNT_RETARGET_MODE;
    this.log = [];
    this.events = [];
  }

  // ---- helpers -------------------------------------------------------------

  // Convenience accessors for the fixed demo trio, by identity (not raw slot).
  // Post-demo compositions read members generically; these stay for the trio.
  get tank(): Member { return this.memberById('tank'); }
  get mage(): Member { return this.memberById('mage'); }
  get ranger(): Member { return this.memberById('ranger'); }

  // Prefer a real (non-absent) member with this id; an empty deploy slot carries a
  // trio-default identity that must never be mistaken for the seated member.
  memberById(id: MemberId): Member {
    return this.members.find((m) => m.id === id && !m.absent)
      ?? this.members.find((m) => m.id === id)
      ?? this.members[SLOT.CENTER];
  }

  // Charge is per-member now (any member can carry it); mageCharge proxies the
  // mage's charge so existing UI/sim/test call sites keep working for the trio.
  get mageCharge(): number { return this.mage.charge; }
  set mageCharge(v: number) { this.mage.charge = v; }

  // The member currently holding Taunt (whoever cast it), or null. For the fixed
  // trio this is always the tank, but the engine no longer assumes that.
  tauntingMember(): Member | null { return this.members.find((m) => m.alive && m.taunt > 0) ?? null; }

  hasRelic(id: RelicId): boolean { return this.relics.has(id); }

  // A fresh zeroed per-type counter (#63).
  static _zeroTypeCounts(): Record<CardType, number> {
    return { holy: 0, nature: 0, shadow: 0, blood: 0, arcane: 0, iron: 0 };
  }

  // Per-member attack damage — the single seam for party-phase damage modifiers.
  // Battle Hymn (#16) adds its bonus here for the phase it was sung in;
  // Vanguard's Banner (#21) rewards a member kept at full HP.
  memberDamage(m: Member): number {
    const banner = this.hasRelic('vanguardsBanner') && m.hp === m.maxHP ? VANGUARD_BONUS : 0;
    // The Skald (#27) has no fixed strike — it scales on cards played this phase
    // (capped), so a busy turn hits hard and a Rest turn barely swings. His base
    // `damage` is 0, but a Weakened scar can push it below 0; fold that in, floored.
    let base = m.damage;
    if (m.ability === 'crescendo') {
      const crescendo = Math.min(SKALD_DMG_CAP, SKALD_DMG_PER_CARD * this.cardsPlayedThisPhase);
      base = Math.max(0, crescendo + m.damage);
    } else if (m.ability === 'rampage') {
      // The Berserker (#28) hits harder the lower his HP — healing him is friendly
      // fire. The bands are fight-relative (thresholds rise with the enemy's
      // attackBonus) so the tension holds across the difficulty curve.
      const [b1, b2] = this.berserkerThresholds();
      if (m.hp <= b1) base += BERSERKER_BAND_BONUS;
      if (m.hp <= b2) base += BERSERKER_BAND_BONUS;
    } else if (m.ability === 'callBoar' && m.boarHp > 0) {
      // The Boar (#29) fights alongside the Warden, lending its strike (1 -> 5).
      base += BOAR_STRIKE_BONUS;
    }
    // Lone Wolf Totem (#42): a small fielded party hits harder per body.
    const lone = this.hasRelic('loneWolf') && this.fieldedPartySize() <= SMALL_PARTY_MAX ? LONE_WOLF_DMG : 0;
    // Sharpen / Embolden (#62): a standing +damage buff on this hero, decays in _decayBuffs.
    const strike = m.strikeTurns > 0 ? m.strikeBonus : 0;
    return base + this.hymnBonus + banner + lone + strike;
  }

  // The Berserker's two fight-relative HP thresholds [band1, band2] (#28). Public so
  // the MemberCard can show the live rage bands. Independent of any specific member.
  berserkerThresholds(): [number, number] {
    const ab = this.config.enemy.attackBonus;
    return [BERSERKER_BAND1_HP + ab, BERSERKER_BAND2_HP + ab];
  }

  livingMembers(): Member[] { return this.members.filter((m) => m.alive); }
  allDead(): boolean { return this.members.every((m) => !m.alive); }

  // How many members were fielded for this fight (#39/#42): the seated slots, not
  // the currently-living count — so it is a stable deploy-time size, the lever the
  // Warlock's Hex and the small-party cards scale on. Empty deploy slots don't count.
  fieldedPartySize(): number { return this.members.filter((m) => !m.absent).length; }

  // Vulnerability (Warlock's Hex, #39): the amount of party damage the enemy takes
  // after its Vulnerability debuff. Applied in _damageEnemy, so every party source
  // (autos, Bolt, Rampage, Grim Harvest, Poison ticks) is amplified in one place.
  vulnerableAmount(raw: number): number {
    if (this.enemy.vulnerableTurns <= 0 || raw <= 0) return raw;
    return raw + Math.floor(raw * this.enemy.vulnerable);
  }

  // If the whole party is down, end the fight in a loss. Returns whether it did.
  _checkWipe(): boolean {
    if (!this.allDead()) return false;
    this.status = 'loss';
    this.phase = 'over';
    this._log('The whole party has fallen. Defeat.', 'loss');
    this._emit({ kind: 'wipe' });
    return true;
  }

  _log(text: string, kind: string = 'info'): void { this.log.push({ text, kind, turn: this.turn }); }

  _emit(e: GameEvent): void { this.events.push(e); }

  isEnraged(turn: number): boolean { return turn >= this.enrageTurn; }

  // Player-turns remaining before the enemy enrages (0 once it has). Drives the
  // enrage-countdown pip so the otherwise-invisible race is legible (flaw #2).
  turnsUntilEnrage(): number {
    if (this.enemy.enraged) return 0;
    return Math.max(0, this.enrageTurn - this.turn);
  }

  // Per-target damage for a base value at a given turn: add the enemy's per-fight
  // attackBonus, then round up under the enrage multiplier if enraged.
  attackDamageOf(base: number, turn: number): number {
    // The Rusty Crown's price (#22) is paid against NORMAL enemies only — a
    // forced +1 on the tightly-tuned bosses read as a pure trap (F5 ~55%).
    const crown = this.hasRelic('rustyCrown') && !this.config.enemy.boss ? RUSTY_CROWN_ATTACK : 0;
    const b = base + this.config.enemy.attackBonus + crown;
    return this.isEnraged(turn) ? Math.ceil(b * ENRAGE_MULT) : b;
  }

  // Per-target damage for an attack type at a given turn.
  attackDamage(type: AttackType, turn: number): number {
    return this.attackDamageOf(ATTACK_BASE_DAMAGE[type], turn);
  }

  tankTaunting(): boolean { return this.tauntingMember() !== null; }

  // ---- telegraph generation ------------------------------------------------

  _pickType(turn: number): AttackType {
    const enraged = this.isEnraged(turn);
    const w = enraged ? this.enemyDef.enragedWeights : this.enemyDef.baseWeights;
    return weightedPick(Object.entries(w) as Array<[AttackType, number]>, this.rng);
  }

  // Display name of the attack the standing telegraph will deliver (the intent),
  // or null when there is nothing telegraphed / the fight is over.
  telegraphIntent(): string | null {
    if (this.status !== 'playing' || !this.telegraph) return null;
    // A channel announces itself by its own name (e.g. 'Crushing Blow'), never
    // by the plain attack type it replaces.
    if (this.telegraph.channel && this.telegraph.channelName) return this.telegraph.channelName;
    // Scripted rotation steps (Piercing Bolt / Hex / Siphon) carry their own name.
    if (this.telegraph.name) return this.telegraph.name;
    return ATTACK_INTENT_NAMES[this.telegraph.type];
  }

  // The lowest-HP living member's slot (ties broken by slot order). Used to aim
  // the Hexweaver's Piercing Bolt at whoever is closest to dying.
  _lowestHpSlot(): Slot {
    const living = this.livingMembers();
    if (living.length === 0) return SLOT.CENTER; // unreachable: telegraphs only generate while someone lives
    let lowest = living[0];
    for (const m of living) if (m.hp < lowest.hp) lowest = m;
    return lowest.slot;
  }

  // The channel config currently in force (a phase transition may swap it, #14).
  activeChannel(): EnemyDef['channel'] {
    return this.activeChannelOverride ?? this.enemyDef.channel;
  }

  _pickPrimary(type: AttackType, ignoreTaunt = false): Slot {
    // A taunter funnels every attack onto itself — except a Piercing-Bolt-style
    // hit flagged ignoreTaunt, which aims by its own rule (its caller handles that).
    const taunter = ignoreTaunt ? null : this.tauntingMember();
    if (taunter) return taunter.slot;
    const weights = type === 'hidden' ? SLOT_WEIGHTS.hidden : SLOT_WEIGHTS.normal;
    // Never aim the primary at a fallen member: a dead primary leaves single/hidden
    // attacks with no telegraph line to show and makes the blow whiff on a corpse.
    // Re-roll against the living slots' relative weights instead.
    const living = weights
      .map((wt, i): [Slot, number] => [i as Slot, wt])
      .filter(([slot]) => this.members[slot].alive);
    if (living.length === 0) return SLOT.CENTER; // unreachable: telegraphs only generate while someone lives
    return weightedPick(living, this.rng);
  }

  // Resolve the set of target slots for a type given a chosen primary slot.
  _geometry(type: AttackType, primary: Slot): Slot[] {
    // 'heavy' is single-target like 'single'; 'sweep' hits the whole party like 'aoe'.
    if (type === 'single' || type === 'hidden' || type === 'heavy') return [primary];
    if (type === 'aoe' || type === 'sweep') return [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT];
    // two-target: primary + one adjacent. center -> random edge; edge -> center.
    // Prefer a LIVING neighbour so the second hit isn't spent on a corpse (#47) —
    // but always consume the rng coin the same way (only the fallback differs), so
    // the telegraph stream stays deterministic across seeds.
    let second: Slot;
    if (primary === SLOT.CENTER) {
      const coin = this.rng() < 0.5 ? SLOT.LEFT : SLOT.RIGHT;
      const other = coin === SLOT.LEFT ? SLOT.RIGHT : SLOT.LEFT;
      // Keep the coin unless it landed on a dead edge while the other edge lives.
      second = (this.members[coin]?.alive || !this.members[other]?.alive) ? coin : other;
    } else {
      second = SLOT.CENTER;
      // Center down but the far edge lives: swing across rather than at the corpse.
      if (!this.members[SLOT.CENTER]?.alive) {
        const far = primary === SLOT.LEFT ? SLOT.RIGHT : SLOT.LEFT;
        if (this.members[far]?.alive) second = far;
      }
    }
    return [primary, second];
  }

  // The nearest LIVING slot to `from` (ties broken toward the lower slot index).
  // Falls back to `from` when the party is wiped (callers guard that case). Pure,
  // deterministic — no rng — so the preview and the resolution agree exactly.
  _nearestLivingSlot(from: Slot): Slot {
    const living = this.livingMembers();
    if (living.length === 0) return from;
    let best = living[0];
    for (const m of living) {
      const d = Math.abs(m.slot - from), bd = Math.abs(best.slot - from);
      if (d < bd || (d === bd && m.slot < best.slot)) best = m;
    }
    return best.slot;
  }

  // The living slots a (revealed) telegraph will ACTUALLY strike, resolved at call
  // time. Single source of truth for both the preview (attackTargets) and the
  // application (_resolveAttack), so the two can never diverge once a target has
  // died mid-turn or a Taunt has retargeted (#47). Dead targets are dropped; an
  // aimed attack whose entire target set has died is re-pointed to the nearest
  // living member, so the enemy never wastes a whole swing whiffing on a corpse.
  // A no-target telegraph (a 'cast') strikes nothing.
  _resolvedTargets(t: Telegraph): Slot[] {
    if (t.targets.length === 0) return [];
    const living = t.targets.filter((slot) => this.members[slot]?.alive);
    if (living.length > 0) return living;
    if (this.livingMembers().length === 0) return []; // party wiped — nothing to hit
    return [this._nearestLivingSlot(t.targets[0])];
  }

  // The rotation the enemy is currently cycling. A phase transition (#14) swaps
  // this for the phase's rotation; until then it is the def's own rotation.
  activeRotation(): RotationEntry[] | undefined {
    return this.activeRotationOverride ?? this.enemyDef.rotation;
  }

  // Normalize a rotation entry: a bare AttackType is shorthand for a plain attack.
  _normalizeStep(entry: RotationEntry): RotationStep {
    return typeof entry === 'string' ? { type: entry } : entry;
  }

  // Build a telegraph from a structured rotation step (Hexweaver / Devourer). A
  // 'cast' step carries no damage and no targets; an attack step honors its
  // targeting flags (ignoreTaunt / targetLowest) and an optional channel wind-up.
  _telegraphFromStep(step: RotationStep, turn: number): Telegraph {
    const enraged = this.isEnraged(turn);
    if (step.type === 'cast') {
      return {
        type: 'cast', hidden: false, damage: 0, targets: [],
        enraged, forTurn: turn, turnsUntilResolve: 1,
        name: step.name, cast: step.cast,
      };
    }
    const base = step.damage ?? ATTACK_BASE_DAMAGE[step.type];
    const primary = step.targetLowest ? this._lowestHpSlot()
      : this._pickPrimary(step.type, step.ignoreTaunt);
    const channelling = (step.channelTurns ?? 1) > 1;
    return {
      type: step.type, hidden: step.type === 'hidden',
      damage: this.attackDamageOf(base, turn),
      targets: this._geometry(step.type, primary),
      enraged, forTurn: turn, turnsUntilResolve: step.channelTurns ?? 1,
      name: step.name,
      ignoreTaunt: step.ignoreTaunt, ignoreDefense: step.ignoreDefense, targetLowest: step.targetLowest,
      channel: channelling || undefined, channelName: channelling ? step.name : undefined,
    };
  }

  _generateTelegraph(turn: number): Telegraph {
    const def = this.enemyDef;
    const rotation = this.activeRotation();
    // Rotation bosses follow a fixed, learnable cycle; some slots periodically
    // become a multi-turn channel (its wind-up is the telegraph).
    if (rotation && rotation.length > 0) {
      const len = rotation.length;
      const idx = this.rotationIndex % len;
      const cycle = Math.floor(this.rotationIndex / len);
      const ch = this.activeChannel();
      if (ch && idx === ch.slot && (cycle % ch.everyCycles) === ch.everyCycles - 1) {
        const primary = this._pickPrimary(ch.type);
        return {
          type: ch.type, hidden: false,
          damage: this.attackDamageOf(ch.damage, turn),
          targets: this._geometry(ch.type, primary),
          enraged: this.isEnraged(turn), forTurn: turn,
          channel: true, channelName: ch.name, turnsUntilResolve: ch.turns,
        };
      }
      return this._telegraphFromStep(this._normalizeStep(rotation[idx]), turn);
    }
    // The standing telegraph is unrestricted even on turn 1: the player gets a full
    // planning turn against it (can Brace/Shield before it resolves at end of turn).
    // The one unreactable blow — the enemy's opening strike — is the only attack held
    // to a plain single, and that restriction lives in _openingStrike, not here.
    const type = this._pickType(turn);
    const primary = this._pickPrimary(type);
    const targets = this._geometry(type, primary);
    return {
      type,
      hidden: type === 'hidden',
      damage: this.attackDamage(type, turn),
      targets,
      enraged: this.isEnraged(turn),
      forTurn: turn,
      turnsUntilResolve: 1,
    };
  }

  // Lines to draw for the standing telegraph. [] when the game is over / no telegraph.
  // Each entry: { slot, damage, hidden }. Hidden attacks fan out to every living
  // member with unknown (null) damage; known attacks hit their living targets.
  attackTargets(): AttackSpec[] {
    const t = this.telegraph;
    if (this.status !== 'playing' || !t) return [];
    // A Stunned telegraph (#61) is cancelled: it strikes nothing, so the preview is
    // empty (preview == applied == 0) and the UI clears the incoming-attack lines.
    if (t.stunned) return [];
    // Lantern of Foresight (#21): a hidden attack's TARGET is revealed too, so
    // its lines collapse from the every-member fan-out to the true target(s)
    // (the magnitude was already revealed by flaw #11's fix). Still drawn in
    // the hidden style — the enemy is concealing it; the lantern sees through.
    if (t.hidden && !this.hasRelic('lantern')) {
      // Reveal the magnitude, hide the target (flaw #11) — per member: each line
      // shows what THAT member would take if the blow lands on them (the full
      // Defense -> Brace -> Shield pipeline folded in), keeping preview ==
      // applied for whichever target the attack turns out to have.
      return this.livingMembers().map((m): AttackSpec => (
        { slot: m.slot, damage: this._wardedDamage(m, t.damage, t.ignoreDefense, t.type).dmg, hidden: true }
      ));
    }
    // Resolve targets through the shared helper (#47), so the preview lines match
    // the slots _resolveAttack will actually strike after a mid-turn death/retarget.
    return this._resolvedTargets(t)
      .map((slot): AttackSpec => {
        const m = this.members[slot];
        // The preview runs the same Defense -> Brace -> Shield pipeline the
        // resolver applies (telegraph == applied invariant).
        return { slot, damage: this._wardedDamage(m, t.damage, t.ignoreDefense, t.type).dmg, hidden: t.hidden };
      });
  }

  // Recompute the standing telegraph's targets with the given slot (the taunter)
  // forced as primary.
  _retargetTelegraphTo(slot: Slot): void {
    if (!this.telegraph) return;
    const t = this.telegraph;
    t.targets = this._geometry(t.type, slot);
  }

  // Whether redirecting the standing telegraph onto `slot` would actually move
  // damage off someone: only for aimed (non-AoE/sweep) attacks that currently
  // threaten a living member other than `slot`. AoE/sweep hit everyone regardless,
  // and a hidden attack has no known geometry, so neither is worth a surcharge.
  _standingTelegraphRedirectable(slot: Slot = SLOT.CENTER): boolean {
    const t = this.telegraph;
    // A Piercing-Bolt-style ignoreTaunt hit and a no-target 'cast' are never
    // pulled onto the taunter; neither are AoE/sweep/hidden (see above).
    if (!t || t.hidden || t.ignoreTaunt || t.cast || t.type === 'aoe' || t.type === 'sweep') return false;
    return t.targets.some((s) => s !== slot && this.members[s]?.alive);
  }

  // ---- next-turn predictions (for the bar telegraphs) ----------------------
  // Pure reads of the status stacks, previewing what next turn will do so the UI
  // can paint it as coloured bar segments.

  // MP that Refresh will restore on the next enemy phase (its strength while
  // active), capped by the room left under MP_MAX.
  predictedRefresh(): number {
    if (this.refreshTurns <= 0) return 0;
    const capRoom = Math.max(0, this.refreshCap - this.refreshRestored);
    return Math.min(this.refresh, this.maxMana - this.mp, capRoom);
  }

  // Enemy HP the next Poison tick will remove (its strength while active), capped by its HP.
  predictedPoison(): number {
    if (this.enemy.poisonTurns <= 0) return 0;
    return Math.min(this.enemy.poison, this.enemy.hp);
  }

  // MP the standing telegraph's Siphon will drain next enemy phase (0 if the
  // telegraphed cast isn't a Siphon), capped by current MP. Drives the ManaBar
  // "about to be drained" segment so the threat is legible before it lands.
  predictedSiphon(): number {
    const t = this.telegraph;
    if (this.status !== 'playing' || !t || t.cast !== 'siphon') return 0;
    return Math.min(SIPHON_AMOUNT, this.mp);
  }

  // Whether a party-wide Hex (healing halved) is currently active.
  get wounded(): boolean { return this.woundTurns > 0; }

  // ---- lifecycle -----------------------------------------------------------

  start(): this {
    this.events = [];
    this._log('Combat begins.', 'system');
    // Enemy-first ordering: the enemy takes the first turn — an opening strike lands
    // before the player can act. It is a bonus ambush that advances neither the
    // rotation nor the enrage clock, so turn 1 remains the player's first planning
    // turn against the standing telegraph generated below.
    this._openingStrike();
    if (this.status !== 'playing') return this; // an opener can't wipe a full party, but stay safe
    this.telegraph = this._generateTelegraph(this.turn);
    this._announceChannel(this.telegraph);
    this._startPlayerPhase();
    return this;
  }

  // The enemy's opening strike (enemy-first ordering). One unreactable hit lands
  // before the player's first turn, so it is restricted to a plain single-target
  // blow — never a heavy/sweep/AoE that would gib a squishy before any Shield can
  // go up ("limiting which enemy attacks can be used on the first turn"). Resolved
  // directly: it does NOT advance the rotation index or the turn counter, so a
  // boss's learnable cycle and the enrage race are untouched — it is purely a bonus
  // ambush layered ahead of the normal turn-1 telegraph.
  _openingStrike(): void {
    const primary = this._pickPrimary('single');
    const opener: Telegraph = {
      type: 'single', hidden: false,
      damage: this.attackDamage('single', this.turn),
      targets: this._geometry('single', primary),
      enraged: false, forTurn: this.turn, turnsUntilResolve: 1,
      name: 'Ambush',
    };
    this._emit({ kind: 'enemyPhase' });
    this._resolveAttack(opener);
    this._checkWipe();
  }

  // Kill a member — unless the Martyr's Icon (#22) spends its once-per-fight
  // save, in which case they survive at 1 HP with every status stripped (the
  // wipe check sees a living member either way). Returns true if they died.
  _killMember(m: Member): boolean {
    const saved = !this.martyrUsed && this.hasRelic('martyrsIcon');
    if (saved) {
      this.martyrUsed = true;
      m.hp = 1;
    } else {
      m.alive = false;
      m.hp = 0;
      m.diedThisFight = true; // DR1: the death is what scars — recorded here, at the
                              // true-kill branch, so a Martyr save (above) never sets it.
    }
    m.shield = false;
    m.shieldTurns = 0;
    m.brace = false;
    m.braceTurns = 0;
    m.regen = 0;
    m.bloomBurst = 0; // death forfeits a pending Lifebloom burst (#16)
    m.taunt = 0;
    m.defense = 0;
    m.defenseAmount = 0;
    m.charge = 0;
    m.drumPrimed = false;
    m.strikeBonus = 0; m.strikeTurns = 0; // death drops the hero-buff batch (#62)
    m.guardDR = 0; m.guardTurns = 0;
    m.empowerBonus = 0; m.riposte = false;
    m.ward = 0;
    m.boarHp = 0;    // the Boar has no summoner left (#29)
    m.boarTurns = 0;
    if (saved) {
      this._log(`The Martyr's Icon glows — ${m.name} clings to life at 1 HP!`, 'status');
      this._emit({ kind: 'martyrSave', slot: m.slot });
      return false;
    }
    this._log(`${m.name} has fallen!`, 'death');
    return true;
  }

  // Returns true on the blow that actually finishes the enemy, so the caller can
  // emit `defeatEnemy` *after* its own hit event. The hit event carries the new
  // (zeroed) enemyHp, and the animator replays events in order: emitting the hit
  // first lets the bar empty to 0 before the DEFEATED flourish plays. (Emitting
  // the defeat here, before the hit, left the bar showing a red chunk during the
  // flourish until the killing strike landed a beat later.)
  _damageEnemy(amount: number, source: string): boolean {
    if (amount <= 0) return false;
    // Vulnerability (Warlock's Hex, #39) amplifies every party source in one place.
    amount = this.vulnerableAmount(amount);
    this.enemy.hp = Math.max(0, this.enemy.hp - amount);
    this._log(`${source} deals ${amount} to the enemy. (${this.enemy.hp}/${this.enemy.maxHP})`, 'enemy-dmg');
    if (this.enemy.hp <= 0 && this.status === 'playing') {
      this.status = 'win';
      this.phase = 'over';
      this._log('The enemy is defeated. Victory!', 'win');
      return true;
    }
    // A killing blow doesn't transform; any other HP drop through the threshold does.
    this._maybeTriggerPhase();
    return false;
  }

  // Edge-detected HP-threshold phase transition (the Devourer, #14). Fires at most
  // once, the first time the enemy's HP falls to/through its phase fraction — even
  // if a Poison tick is what crosses it — then swaps in the phase-2 rotation/channel
  // (Maw), tightens enrage, and announces the transformation beat.
  _maybeTriggerPhase(): void {
    const phase = this.enemyDef.phase;
    if (!phase || this.phaseTriggered) return;
    if (this.enemy.hp <= 0 || this.enemy.hp > this.enemy.maxHP * phase.hpFraction) return;
    this.phaseTriggered = true;
    this.activeRotationOverride = phase.rotation;
    this.activeChannelOverride = phase.channel;
    if (phase.enrageTurn != null) this.enrageTurn = Math.min(this.enrageTurn, phase.enrageTurn);
    this._log(`${this.enemyDef.name}: ${phase.beat}`, 'system');
    this._emit({ kind: 'phaseChange', beat: phase.beat });
  }

  // Doom (#63): a nuke that scales with how debuffed the enemy is — +per active
  // enemy debuff (Vulnerability / Poison) and more the deeper its Vulnerability —
  // capped. The global Vulnerability multiplier in _damageEnemy still applies ON
  // TOP (a debuff-first line pays off twice), so the cap bounds only the base roll.
  _doomDamage(): number {
    const vulnActive = this.enemy.vulnerableTurns > 0;
    const poisonActive = this.enemy.poisonTurns > 0;
    const debuffs = (vulnActive ? 1 : 0) + (poisonActive ? 1 : 0);
    const vulnBonus = vulnActive ? Math.floor(this.enemy.vulnerable * DOOM_PER_VULN) : 0;
    return Math.min(DOOM_CAP, DOOM_BASE + DOOM_PER_DEBUFF * debuffs + vulnBonus);
  }

  // A healer-cast enemy nuke (Shadow Bolt / Doom) has no member source; attribute
  // the visual flourish to the first living member so the animator has an origin.
  _emitEnemyNuke(amount: number, killed: boolean): void {
    const m = this.livingMembers()[0];
    if (m) this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(amount), enemyHp: this.enemy.hp });
    if (killed) this._emit({ kind: 'defeatEnemy' });
  }

  // Reliquary of Light (#63): a flat bonus to healing from Holy cards. Read per heal
  // CARD (not per _healMember call) so only Holy card heals are boosted — a ticking
  // Regen (Nature) or a Blood card's spillover heal is untouched.
  _holyHealBonus(card: ResolvedCard): number {
    return this.hasRelic('reliquaryOfLight') && cardType(card.id) === 'holy' ? HOLY_RELIC_HEAL : 0;
  }

  // Central heal path for every healing source (direct heal cards AND the Regen
  // tick, which routes through here) — so the Hexweaver's Hex (#13) only needs to
  // reduce healing in one place to cover both. While Wounded, healing is scaled by
  // WOUND_HEAL_FACTOR and floored.
  // `direct` marks a cast heal (heal cards, Bloom, Martyr's Gift, the Lifebloom
  // burst) as opposed to the Regen tick — the Aegis Font (#22) only converts
  // DIRECT overheal to Ward, so a ticking Regen can't farm the buffer.
  _healMember(m: Member, amount: number, direct = false): number {
    if (!m.alive || amount <= 0) return 0;
    // Field Triage Kit (#21): heals on a member below half max HP heal harder.
    // The bonus lands before the Hex halving — the curse dominates everything.
    if (this.hasRelic('fieldTriage') && m.hp < m.maxHP * FIELD_TRIAGE_THRESHOLD) {
      amount += FIELD_TRIAGE_BONUS;
    }
    const effective = this.woundTurns > 0 ? Math.floor(amount * WOUND_HEAL_FACTOR) : amount;
    if (effective <= 0) return 0;
    const before = m.hp;
    m.hp = Math.min(m.maxHP, m.hp + effective);
    const healed = m.hp - before;
    // Aegis Font (#22): direct-cast overheal becomes a Ward buffer — capped,
    // larger-replaces (no stacking), independent of Shield.
    if (direct && this.hasRelic('aegisFont')) {
      const over = Math.min(WARD_MAX, effective - healed);
      if (over > m.ward) {
        m.ward = over;
        this._log(`The Aegis Font wells up: Ward ${m.ward} on ${m.name}.`, 'status');
        this._emit({ kind: 'wardApplied', slot: m.slot, amount: m.ward });
      }
    }
    return healed;
  }

  // Pay out a pending Lifebloom burst (#16). A Lifebloom Regen that ENDS while
  // its target lives — natural expiry (regen decays to 0) or Bloom's consume —
  // burst-heals; death forfeits it (_killMember clears the field without paying).
  // Under the additive model (#52) casting more Regen only DEEPENS the running
  // Regen — it no longer ends it — so the burst rides along until the extended
  // Regen expires. Cultivate likewise modifies the value in place and never routes
  // through here, so it keeps the burst pending.
  _endRegenBurst(m: Member): void {
    if (m.bloomBurst <= 0 || !m.alive) return;
    const burst = m.bloomBurst;
    m.bloomBurst = 0;
    const healed = this._healMember(m, burst, true);
    this._log(`Lifebloom bursts on ${m.name}: heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
    this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
  }

  // A Blood card's HP cost (#16). canPlay gates on hp > cost, and the payment
  // itself clamps to leave 1 HP (the dev panel bypasses canPlay) — Blood
  // self-damage is never lethal, so playCard opens no new death path.
  _bloodPay(m: Member, amount: number): number {
    const paid = Math.min(amount, Math.max(0, m.hp - 1));
    m.hp -= paid;
    this._emit({ kind: 'bloodPay', slot: m.slot, amount: paid, hp: m.hp });
    return paid;
  }

  // A LETHAL HP drain (#27): unlike _bloodPay it is not clamped to leave 1 HP, so it
  // can kill the member (Soul Tithe / Dark Bargain burn-out). Kills and re-checks the
  // wipe when it empties them. Reuses the bloodPay FX event (HP cost paid).
  _drainMember(m: Member, amount: number): number {
    const lost = Math.min(amount, m.hp);
    m.hp -= lost;
    this._emit({ kind: 'bloodPay', slot: m.slot, amount: lost, hp: Math.max(0, m.hp) });
    if (m.hp <= 0) { this._killMember(m); this._checkWipe(); }
    return lost;
  }

  // Damage a member actually takes from a raw attack value, after their Defense
  // (if any). Floored at 0 so a fully-absorbed hit can't heal. Defense strength
  // is per-member (#17): Taunt grants DEFENSE_AMOUNT + the caster's abilityPower,
  // Phalanx grants PHALANX_DEFENSE — whatever was set is what reduces here.
  _effectiveDamage(m: Member, raw: number, ignoreDefense = false): number {
    if (ignoreDefense) return raw; // Piercing-Bolt-style hits bypass Defense AND Guard
    let dmg = raw;
    if (m.defense > 0) dmg = Math.max(0, dmg - m.defenseAmount);
    // Guard (#62): its own DR field, so it stacks with Defense (Bulwark, Taunt) but
    // not with itself (a second Guard just refreshes the timer). A pure read, so
    // attackTargets() previews it exactly (telegraph == applied).
    if (m.guardTurns > 0) dmg = Math.max(0, dmg - m.guardDR);
    return dmg;
  }

  // The full defensive pipeline for one attack instance on one member (#17):
  //   Defense (flat reduction while active) -> Brace (one-shot -BRACE_AMOUNT,
  //   consumed) -> Shield (full block, consumed).
  // Brace and Shield are exclusive holds, and each only spends on a hit that
  // still deals damage after the stages before it. Pure read — attackTargets()
  // and _resolveAttack() both compute damage through here, which is what keeps
  // the telegraph preview equal to the applied damage across the whole pipeline.
  _wardedDamage(m: Member, raw: number, ignoreDefense = false, attackType?: AttackType):
      { dmg: number; spendsBrace: boolean; spendsShield: boolean; spendsStormglass: boolean; wardSpent: number } {
    // Beast Warden's Boar (#29) stands in front of her slot and eats the WHOLE
    // instance, so the Warden takes 0 and none of her own wards are spent. Checked
    // FIRST so the preview (attackTargets) equals the applied damage — the boar's
    // own HP loss is resolved in _resolveAttack, not here (this stays a pure read).
    if (m.boarHp > 0) return { dmg: 0, spendsBrace: false, spendsShield: false, spendsStormglass: false, wardSpent: 0 };
    let dmg = this._effectiveDamage(m, raw, ignoreDefense);
    let spendsBrace = false;
    let spendsShield = false;
    // Stormglass Mirror (#21): once per fight, the first single-target hit of
    // 6+ (measured after Defense, before Brace/Shield) is negated outright.
    const singleTarget = attackType === 'single' || attackType === 'hidden' || attackType === 'heavy';
    if (!this.stormglassUsed && this.hasRelic('stormglass') && singleTarget && dmg >= STORMGLASS_MIN_HIT) {
      return { dmg: 0, spendsBrace: false, spendsShield: false, spendsStormglass: true, wardSpent: 0 };
    }
    if (m.brace && dmg > 0) {
      dmg = Math.max(0, dmg - BRACE_AMOUNT);
      spendsBrace = true;
    }
    if (m.shield && dmg > 0) {
      dmg = 0;
      spendsShield = true;
    }
    // Grounding Rod (#21): multi-target hits lose 1 off the FINAL number.
    if (dmg > 0 && this.hasRelic('groundingRod') && (attackType === 'aoe' || attackType === 'sweep')) {
      dmg = Math.max(0, dmg - GROUNDING_ROD_REDUCTION);
    }
    // Aegis Ward (#22): the standing buffer eats what is left, point for point.
    const wardSpent = Math.min(m.ward, dmg);
    dmg -= wardSpent;
    return { dmg, spendsBrace, spendsShield, spendsStormglass: false, wardSpent };
  }

  // ---- enemy phase ---------------------------------------------------------

  _runEnemyPhase(): void {
    this._emit({ kind: 'enemyPhase' });
    if (this.turn === this.enrageTurn && !this.enemy.enraged) {
      this.enemy.enraged = true;
      this._log('The enemy ENRAGES! Its attacks grow heavier.', 'system');
      this._emit({ kind: 'enrage' });
    }

    // 1) start-of-turn status ticks: Poison -> Refresh. (Regen ticks at the start
    // of the player phase instead, so its heal lands after the enemy's blow.)
    if (this.enemy.poisonTurns > 0) {
      const dmg = this.enemy.poison;
      const killed = this._damageEnemy(dmg, `Poison (${this.enemy.poison})`);
      this._emit({ kind: 'poisonTick', amount: this.vulnerableAmount(dmg), enemyHp: this.enemy.hp });
      if (killed) this._emit({ kind: 'defeatEnemy' });
      this.enemy.poisonTurns -= 1;
      if (this.enemy.poisonTurns === 0) this.enemy.poison = 0;
      if (this.status === 'win') return; // poison can finish the enemy
    }
    // Vulnerability (Warlock's Hex, #39) counts down here, after Poison this turn is
    // amplified — so a cast Hex amplifies HEX_TURNS full party phases before fading.
    if (this.enemy.vulnerableTurns > 0) {
      this.enemy.vulnerableTurns -= 1;
      if (this.enemy.vulnerableTurns === 0) {
        this.enemy.vulnerable = 0;
        this._log('The Hex fades; the enemy is no longer Vulnerable.', 'status');
      }
    }
    if (this.refreshTurns > 0) {
      // A single Refresh-slot cast restores at most its refreshCap MP over its
      // lifetime (Refresh 6 / Font of Mana 9), so Potent/Lingering can't turn it
      // into an unbounded MP engine (flaw #7).
      const capRoom = Math.max(0, this.refreshCap - this.refreshRestored);
      const before = this.mp;
      this.mp = Math.min(this.maxMana, this.mp + Math.min(this.refresh, capRoom));
      const gained = this.mp - before;
      this.refreshRestored += gained;
      this._log(`Refresh restores ${gained} MP. (MP ${this.mp})`, 'mp');
      this._emit({ kind: 'refreshTick', amount: gained, mp: this.mp });
      this.refreshTurns -= 1;
      // End the cast once spent or its cap is exhausted.
      if (this.refreshTurns === 0 || this.refreshRestored >= this.refreshCap) {
        this.refreshTurns = 0;
        this.refresh = 0;
      }
    }
    // Hex (#13) decays at the start of the enemy phase — so a Hex applied this turn
    // still Wounds the coming WOUND_TURNS player phases in full (decaying it in
    // _decayBuffs after resolution would eat the turn it was cast on).
    if (this.woundTurns > 0) {
      this.woundTurns -= 1;
      if (this.woundTurns === 0) this._log('The Hex fades; healing is restored.', 'status');
    }

    // 2) resolve the standing telegraph — unless it is a channel still winding up,
    // in which case the enemy takes no other action this turn (its wind-up IS the
    // telegraph) and the channel stays standing for another turn.
    const t = this.telegraph;
    // Sentinel's Stun (#61): the standing telegraph is cancelled. The enemy deals no
    // damage and runs no cast — it loses the turn — but the move is CONSUMED, so this
    // runs the normal resolve tail (advance the rotation, tick the turn counter toward
    // enrage, re-telegraph a fresh action) instead of the channel-tick early-return
    // that keeps the same telegraph standing. A cancelled channel wind-up therefore
    // does not resume/land later, and a cancelled boss step is not repeated.
    if (t && t.stunned) {
      this._log(`${this.enemyDef.name} is Stunned — its turn is lost.`, 'system');
      this._decayBuffs();
      this.rotationIndex += 1;
      this.turn += 1;
      this.telegraph = this._generateTelegraph(this.turn);
      this._announceChannel(this.telegraph);
      return;
    }
    if (t && t.channel && (t.turnsUntilResolve ?? 1) > 1) {
      t.turnsUntilResolve = (t.turnsUntilResolve ?? 1) - 1;
      this._log(`${this.enemyDef.name} channels ${t.channelName} — ${t.turnsUntilResolve} turn(s) to resolve.`, 'system');
      this._emit({ kind: 'channelTick', name: t.channelName ?? 'Channel', turnsUntilResolve: t.turnsUntilResolve ?? 0 });
      this._decayBuffs();
      // The channel keeps standing (no rotation advance, no re-telegraph), but the
      // turn counter still ticks so enrage/rotation timing across a wind-up is
      // unchanged from the pre-#26 order (the counter used to live in endTurn).
      this.turn += 1;
      return;
    }

    // Dusk Chime (#22): once per fight, a big telegraph is delayed one full
    // turn at the moment it would land — it stays standing (like a channel
    // wind-up) and the enemy loses the turn. Checked against the telegraphed
    // magnitude across its targets; casts are never delayed (nothing to blunt).
    if (t && !t.cast && !this.chimeUsed && this.hasRelic('duskChime')
        && t.damage * Math.max(1, t.targets.length) >= DUSK_CHIME_MIN) {
      this.chimeUsed = true;
      this._log(`The Dusk Chime tolls — ${this.telegraphIntent() ?? 'the attack'} is delayed a turn.`, 'system');
      this._emit({ kind: 'chime' });
      this._decayBuffs();
      // As with a channel wind-up, the telegraph keeps standing but the turn
      // counter still advances (see #26 note above).
      this.turn += 1;
      return;
    }

    // A 'cast' telegraph runs its scripted effect (Hex / Siphon / Consume) instead
    // of dealing damage; everything else resolves as an attack.
    if (t && t.cast) {
      this._resolveCast(t);
    } else {
      // A channel re-checks Taunt at resolve (not only at cast), so a late Taunt
      // still redirects it onto the defended member.
      if (t && t.channel) {
        const taunter = this.tauntingMember();
        if (taunter && this._standingTelegraphRedirectable(taunter.slot)) this._retargetTelegraphTo(taunter.slot);
      }
      this._resolveAttack();
      if (this._checkWipe()) return;
      // A Riposte (#62) can finish the enemy during its own attack — stop the phase
      // cleanly rather than telegraphing a fresh attack for a defeated enemy.
      if (this.status === 'win') return;
    }

    // 3) decay per-turn buffs now that this enemy turn's attack has resolved.
    this._decayBuffs();

    // 4) advance any rotation, step the turn counter, and telegraph the next attack
    // (enrage baked in). The turn increment lives here now (#26): under player-first
    // ordering the enemy phase owns the advance so the standing telegraph and
    // this.turn stay in lockstep during the player phase.
    this.rotationIndex += 1;
    this.turn += 1;
    this.telegraph = this._generateTelegraph(this.turn);
    this._announceChannel(this.telegraph);
  }

  // Decay the per-turn member buffs after an enemy turn's attack has resolved.
  _decayBuffs(): void {
    for (const m of this.members) {
      if (m.alive && m.taunt > 0) {
        m.taunt -= 1;
        if (m.taunt === 0) this._log(`Taunt fades from ${m.name}.`, 'status');
      }
      if (m.alive && m.defense > 0) {
        m.defense -= 1;
        if (m.defense === 0) {
          m.defenseAmount = 0;
          this._log(`Defense fades from ${m.name}.`, 'status');
        }
      }
      // Sharpen / Embolden (#62): the standing +damage buff decays after its turns.
      if (m.alive && m.strikeTurns > 0) {
        m.strikeTurns -= 1;
        if (m.strikeTurns === 0) {
          m.strikeBonus = 0;
          this._log(`${m.name}'s edge dulls.`, 'status');
        }
      }
      // Guard (#62): the standing +DR buff decays after its turns.
      if (m.alive && m.guardTurns > 0) {
        m.guardTurns -= 1;
        if (m.guardTurns === 0) {
          m.guardDR = 0;
          this._log(`Guard fades from ${m.name}.`, 'status');
        }
      }
      // An unused Shield fades after SHIELD_TURNS enemy turns (it is consumed —
      // not decayed — the moment it blocks a damaging hit).
      if (m.alive && m.shield && m.shieldTurns > 0) {
        m.shieldTurns -= 1;
        if (m.shieldTurns === 0) {
          m.shield = false;
          this._log(`Shield fades from ${m.name}.`, 'status');
        }
      }
      // An unused Brace fades the same way (#17).
      if (m.alive && m.brace && m.braceTurns > 0) {
        m.braceTurns -= 1;
        if (m.braceTurns === 0) {
          m.brace = false;
          this._log(`Brace fades from ${m.name}.`, 'status');
        }
      }
      // The Boar (#29) returns to the wild after BOAR_TURNS enemy turns (or the
      // moment its HP runs out, handled at the point of the hit).
      if (m.alive && m.boarTurns > 0) {
        m.boarTurns -= 1;
        if (m.boarTurns === 0) {
          m.boarHp = 0;
          this._log(`${m.name}'s Boar returns to the wild.`, 'status');
          this._emit({ kind: 'boarExpire', slot: m.slot });
        }
      }
    }
  }

  // Resolve a scripted 'cast' telegraph (Hexweaver #13 / Devourer #14). These deal
  // no damage — they run game logic: Hex halves the party's healing, Siphon drains
  // healer MP, Consume cleanses the enemy's own poison and self-heals for it.
  _resolveCast(t: Telegraph): void {
    switch (t.cast) {
      case 'wound': {
        this.woundTurns = WOUND_TURNS;
        this._log(`${this.enemyDef.name} weaves a Hex — healing is halved for ${WOUND_TURNS} turns.`, 'system');
        this._emit({ kind: 'wound', turns: WOUND_TURNS });
        break;
      }
      case 'siphon': {
        const drained = Math.min(SIPHON_AMOUNT, this.mp);
        this.mp -= drained;
        this._log(`${this.enemyDef.name} Siphons ${drained} MP. (MP ${this.mp})`, 'mp');
        this._emit({ kind: 'siphon', amount: drained, mp: this.mp });
        break;
      }
      case 'consume': {
        // Devourer (#14) / the act-2/3 self-healers (#20): cleanse the enemy's
        // own Poison and heal for every remaining tick, so poison stops being
        // free value. Log with the step's own name (Consume / Gorge) so the
        // resolution matches the telegraph the player read.
        const name = t.name ?? 'Consume';
        const healed = this.enemy.poison * this.enemy.poisonTurns;
        this.enemy.poison = 0;
        this.enemy.poisonTurns = 0;
        if (healed > 0) {
          this.enemy.hp = Math.min(this.enemy.maxHP, this.enemy.hp + healed);
          this._log(`${this.enemyDef.name} — ${name}! It feeds on its own poison, healing ${healed}. (${this.enemy.hp}/${this.enemy.maxHP})`, 'system');
        } else {
          this._log(`${this.enemyDef.name} — ${name}, but there is no poison to feed on.`, 'system');
        }
        this._emit({ kind: 'consume', heal: healed, enemyHp: this.enemy.hp });
        break;
      }
      default:
        break;
    }
  }

  // Emit the channel-start event when a freshly-generated telegraph is a channel,
  // so the UI cast bar can begin its countdown.
  _announceChannel(t: Telegraph | null): void {
    if (t && t.channel) {
      this._log(`${this.enemyDef.name} begins channelling ${t.channelName}!`, 'system');
      this._emit({ kind: 'channelStart', name: t.channelName ?? 'Channel', damage: t.damage, turnsUntilResolve: t.turnsUntilResolve ?? 1 });
    }
  }

  // Resolve an enemy attack. Defaults to the standing telegraph, but the boss's
  // second action passes a freshly generated (untelegraphed) one.
  _resolveAttack(t: Telegraph | null = this.telegraph): void {
    if (!t) return;
    const label = t.name ? t.name
      : t.channel && t.channelName ? t.channelName
      : t.hidden ? 'Hidden attack' : t.type === 'two' ? 'Two-target attack'
      : t.type === 'aoe' ? 'AoE attack' : t.type === 'heavy' ? 'Heavy attack'
      : t.type === 'sweep' ? 'Sweeping attack' : 'Attack';
    // Strike exactly the slots the preview drew (#47): the shared resolver drops
    // dead targets and re-points a fully-dead aimed attack onto a living member,
    // so applied damage is bit-equal to attackTargets() and no swing is spent on a
    // corpse while a valid target lives.
    for (const slot of this._resolvedTargets(t)) {
      const m = this.members[slot];
      if (!m || !m.alive) { // defensive — _resolvedTargets only returns living slots
        this._log(`${label} whiffs on slot ${slot + 1}.`, 'whiff');
        this._emit({ kind: 'enemyAttack', slot, amount: 0, hp: 0, result: 'whiff', killed: false, hidden: t.hidden, attackType: t.type });
        continue;
      }
      // Beast Warden's Boar (#29): a standing Boar eats the WHOLE instance aimed at
      // her slot — no spill to the Warden, her own wards untouched. The Boar takes
      // the raw per-target damage and dies when its HP runs out (a base heavy = one
      // Boar). Resolved before the ward pipeline; _wardedDamage previews it as 0.
      if (m.boarHp > 0) {
        m.boarHp = Math.max(0, m.boarHp - t.damage);
        const boarDied = m.boarHp <= 0;
        if (boarDied) m.boarTurns = 0;
        this._log(`${m.name}'s Boar takes the ${label} for ${t.damage}${boarDied ? ' and falls' : ''}. (Boar ${m.boarHp})`, 'shield');
        this._emit({ kind: 'boarHit', slot, amount: t.damage, boarHp: m.boarHp, killed: boarDied });
        continue;
      }
      // Defense -> Brace -> Shield (#17); the same pipeline attackTargets()
      // previews. Brace and Shield only spend on a still-damaging instance.
      const w = this._wardedDamage(m, t.damage, t.ignoreDefense, t.type);
      if (w.spendsStormglass) {
        this.stormglassUsed = true;
        this._log(`The Stormglass Mirror shatters the blow aimed at ${m.name}.`, 'shield');
        this._emit({ kind: 'enemyAttack', slot, amount: 0, hp: m.hp, result: 'shield', killed: false, hidden: t.hidden, attackType: t.type });
        continue;
      }
      if (w.spendsShield) {
        m.shield = false;
        m.shieldTurns = 0;
        this._log(`${m.name}'s Shield absorbs the hit.`, 'shield');
        this._emit({ kind: 'enemyAttack', slot, amount: t.damage, hp: m.hp, result: 'shield', killed: false, hidden: t.hidden, attackType: t.type });
        continue;
      }
      if (w.spendsBrace) {
        m.brace = false;
        m.braceTurns = 0;
        this._log(`${m.name} braces — the hit is blunted by ${BRACE_AMOUNT}.`, 'shield');
      }
      if (w.wardSpent > 0) {
        m.ward -= w.wardSpent;
        this._log(`${m.name}'s Ward absorbs ${w.wardSpent}. (Ward ${m.ward})`, 'shield');
      }
      m.hp = Math.max(0, m.hp - w.dmg);
      this._log(`${label} hits ${m.name} for ${w.dmg}. (${m.hp}/${m.maxHP})`, 'hit');
      // The Martyr's Icon (#22) may veto the death — resolve that BEFORE the
      // event is emitted so the animator never stages a death that didn't happen.
      let killed = m.hp <= 0;
      if (killed) killed = this._killMember(m);
      this._emit({ kind: 'enemyAttack', slot, amount: w.dmg, hp: m.hp, result: 'hit', killed, hidden: t.hidden, attackType: t.type });
      // Riposte (#62): the first attack that actually connects with a buffed, still-
      // living hero draws a counter for their damage. Consumed once; routed through
      // _damageEnemy so the counter respects Vulnerability like every party source.
      if (w.dmg > 0 && !killed && m.alive && m.riposte) {
        m.riposte = false;
        const counter = this.memberDamage(m);
        if (counter > 0) {
          const defeated = this._damageEnemy(counter, `${m.name} (Riposte)`);
          this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(counter), enemyHp: this.enemy.hp });
          if (defeated) { this._emit({ kind: 'defeatEnemy' }); return; }
        }
      }
      // Tithe Candle (#21): post-mitigation enemy damage tithes 1 MP back
      // (a 0-damage hit gives nothing; capped at max mana AND per fight — every
      // MP engine in this game is bounded, the flaw-#7 law).
      if (w.dmg > 0 && this.hasRelic('titheCandle') && this.mp < this.maxMana
          && this.titheGained < TITHE_CANDLE_FIGHT_CAP) {
        this.mp = Math.min(this.maxMana, this.mp + TITHE_CANDLE_MP);
        this.titheGained += TITHE_CANDLE_MP;
        this._log(`The Tithe Candle burns: +${TITHE_CANDLE_MP} MP. (MP ${this.mp})`, 'mp');
        this._emit({ kind: 'refreshTick', amount: TITHE_CANDLE_MP, mp: this.mp });
      }
    }
  }

  // ---- player phase --------------------------------------------------------

  _startPlayerPhase(): void {
    // Regen ticks at the start of the player's turn — after the enemy has attacked,
    // so the heal lands on the damage just taken rather than pre-empting the blow.
    for (const m of this.members) {
      if (m.alive && m.regen > 0) {
        // Heal the current value, then decay by 1 (#52). At 0 the Regen is gone;
        // its magnitude was its duration, so no separate turn counter to clear.
        const healed = this._healMember(m, m.regen);
        this._log(`${m.name} regenerates ${healed} (Regen ${m.regen}).`, 'heal');
        this._emit({ kind: 'regenTick', slot: m.slot, amount: healed, hp: m.hp });
        m.regen -= 1;
        if (m.regen === 0) {
          this._endRegenBurst(m); // natural expiry pays a pending Lifebloom burst
        }
      }
    }
    // Passive MP income (healer upgrade, plus the Pact of Silence's tithe)
    // lands at the start of the player phase — but only as a reward for a
    // restrained previous turn (#53): gated on the same ≤1-cards signal the Rest
    // gate uses, read here BEFORE cardsPlayedThisPhase is reset below. On the very
    // first player phase the count is still its 0 init, so the opening turn grants.
    const passive = this.passiveMp + (this.hasRelic('pactOfSilence') ? PACT_PASSIVE_MP : 0);
    if (passive > 0 && this.cardsPlayedThisPhase <= 1 && this.mp < this.maxMana) {
      const before = this.mp;
      this.mp = Math.min(this.maxMana, this.mp + passive);
      this._log(`Passive regen restores ${this.mp - before} MP. (MP ${this.mp})`, 'mp');
      this._emit({ kind: 'refreshTick', amount: this.mp - before, mp: this.mp });
    }
    // Per-member Charge ticks before the player can act (only the Bolt ability
    // consumes it today, so for the trio this is effectively the mage's charge).
    for (const m of this.members) {
      if (m.alive) m.charge = Math.min(CHARGE_MAX, m.charge + 1);
    }
    // The First-Light Taper (#22) pays for its free card in card flow — the
    // turn AFTER the discount fires draws one fewer ("it burns what it lit").
    this._drawTo(Math.max(1, this.handSize - (this.taperFired ? 1 : 0)));
    this.taperFired = false;
    this.cardsPlayedThisPhase = 0;
    this.typePlayedThisTurn = Game._zeroTypeCounts(); // per-turn type counters reset (#63)
    this.phase = 'player';
  }

  _drawOne(): DeckCard | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.drawPile = shuffle(this.discardPile, this.rng);
      this.discardPile = [];
      this._log('Reshuffled discard into draw pile.', 'system');
      // Prayer Beads (#21): every reshuffle restores MP.
      if (this.hasRelic('prayerBeads') && this.mp < this.maxMana) {
        const before = this.mp;
        this.mp = Math.min(this.maxMana, this.mp + PRAYER_BEADS_MP);
        this._log(`The Prayer Beads turn: +${this.mp - before} MP. (MP ${this.mp})`, 'mp');
        this._emit({ kind: 'refreshTick', amount: this.mp - before, mp: this.mp });
      }
    }
    return this.drawPile.shift() ?? null;
  }

  _drawTo(n: number): void {
    while (this.hand.length < n) {
      const c = this._drawOne();
      if (c == null) break;
      this.hand.push(c);
    }
  }

  // What a card costs to play right now: 0 while a Surge (#16) is pending,
  // TAPER_DISCOUNT less (min 0) for the First-Light Taper's (#22) first cheap
  // non-engine card of the turn, otherwise its resolved cost. The UI's
  // affordability check reads this too.
  effectiveCost(card: ResolvedCard): number {
    if (this.surgePending) return 0;
    let cost = card.cost;
    if (this.hasRelic('firstLightTaper') && this.cardsPlayedThisPhase === 0
        && cost <= TAPER_MAX_COST && !isEngineCard(card.id)) {
      cost = Math.max(0, cost - TAPER_DISCOUNT);
    }
    // Iron Ward (#63): the FIRST Iron card each turn costs less. "First" reads the
    // per-turn Iron counter (0 until an Iron card is played), so later Iron cards
    // pay full price. effectiveCost runs before the counter is bumped in playCard.
    if (this.hasRelic('ironWard') && cardType(card.id) === 'iron' && this.typePlayedThisTurn.iron === 0) {
      cost = Math.max(0, cost - IRON_RELIC_DISCOUNT);
    }
    // Cascade (#63): 1 MP cheaper per Arcane card already played this turn (floor 0).
    // The per-turn Arcane counter is bumped after a card resolves, so it reflects the
    // prior Arcane plays this turn — not Cascade itself.
    if (card.id === 'cascade') {
      cost = Math.max(0, cost - CASCADE_DISCOUNT_PER_ARCANE * this.typePlayedThisTurn.arcane);
    }
    return cost;
  }

  // Validate whether a hand card can currently be played. Returns null if ok,
  // otherwise a short reason string.
  canPlay(handIndex: number, target: number | null): string | null {
    if (this.phase !== 'player') return 'not your phase';
    const dc = this.hand[handIndex];
    if (dc == null) return 'no such card';
    const card = resolveCard(dc);
    if (this.mp < this.effectiveCost(card)) return 'not enough MP';
    // Per-member ability cards (#44) auto-resolve on the bound member — no pick;
    // they are unplayable while that member is dead or was never deployed.
    if (card.ability != null && !this._abilityMember(card.ability)) {
      return 'that member is unavailable';
    }
    switch (card.target) {
      case 'single': {
        const m = target == null ? undefined : this.members[target];
        if (!m || !m.alive) return 'target must be a living member';
        // Cultivate / Bloom (#15) operate on an existing Regen — dead without one.
        if (card.needsRegen && m.regen <= 0) return 'target must have an active Regen';
        // Blood cards (#16) demand the target survive the payment outright.
        if (card.selfDamage != null && m.hp <= card.selfDamage) return `target must have more than ${card.selfDamage} HP`;
        // Bulwark cards (#17) are Defense-exclusive; Phalanx also refuses the
        // taunting member (Taunt's bundled Defense is the tank's lane).
        if (card.noDefense && m.defense > 0) return 'target already has Defense';
        if (card.noTaunt && m.taunt > 0) return 'cannot target the taunting member';
        break;
      }
      case 'dead': {
        const m = target == null ? undefined : this.members[target];
        if (!m || m.alive) return 'target must be a dead member';
        // 'incapacitate' injury mode: the 4th scar is beyond a battlefield revive —
        // only the run layer (Infirmary / Field Hospital / Mending Totem) restores them.
        if (m.incapacitated) return 'target is incapacitated';
        if (this.livingMembers().length === 0) return 'no living member remains';
        break;
      }
      default:
        break; // 'all' / 'none' need no target
    }
    return null;
  }

  // target: a slot index for single/ability/dead cards; ignored otherwise.
  playCard(handIndex: number, target: number | null = null): PlayResult {
    const reason = this.canPlay(handIndex, target);
    if (reason) return { ok: false, reason };

    this.events = [];
    const dc = this.hand[handIndex];
    const card = resolveCard(dc);
    // Note a Taper discount firing (Surge takes precedence and is not the Taper).
    if (!this.surgePending && this.hasRelic('firstLightTaper') && this.cardsPlayedThisPhase === 0
        && card.cost <= TAPER_MAX_COST && !isEngineCard(card.id) && card.cost > 0) {
      this.taperFired = true;
    }
    this.mp -= this.effectiveCost(card);
    // A pending Surge is spent by the next card played, whatever it is — even a
    // card that was already free (strict "next card" rule; Surge->Surge is a
    // legal strict loss, since the case below re-arms it after this consume).
    this.surgePending = false;
    this.hand.splice(handIndex, 1);
    this.discardPile.push(dc);
    this.cardsPlayedThisPhase += 1;

    this._applyCard(card, target);

    // Per-type cards-played counters (#63): tally AFTER the effect resolves, so a
    // count-based card reads only the plays BEFORE it (e.g. the Arcane cost card
    // already had its discount read in effectiveCost). Ability cards count too —
    // the Warlock's Hex reads as a Shadow play for these synergies.
    const ct = cardType(card.id);
    this.typePlayedThisTurn[ct] += 1;
    this.typePlayedThisFight[ct] += 1;

    // Shadow Sigil (#63): after a Shadow card resolves, chip the enemy. Party->enemy
    // damage through _damageEnemy (Vulnerability applies; no enemy telegraph touched).
    if (this.status === 'playing' && ct === 'shadow' && this.hasRelic('shadowSigil')) {
      const killed = this._damageEnemy(SHADOW_RELIC_DMG, 'Shadow Sigil');
      this._emitEnemyNuke(SHADOW_RELIC_DMG, killed);
    }

    // Echo Locket (#21): once per fight, the first Poison or Bolt ability card cast
    // (#44: Imbue Venom / Unleash) returns to hand (its MP was paid; a replay pays again).
    if (!this.echoUsed && this.hasRelic('echoLocket') && (card.ability === 'poison' || card.ability === 'bolt')) {
      this.echoUsed = true;
      const i = this.discardPile.lastIndexOf(dc);
      if (i >= 0) {
        this.discardPile.splice(i, 1);
        this.hand.push(dc);
        this._log('The Echo Locket hums — the ability card returns to your hand.', 'status');
        this._emit({ kind: 'draw', count: 1 });
      }
    }
    return { ok: true };
  }

  // The deployed living member carrying an ability (#44). Undefined if that member
  // is dead or was never deployed — which makes their ability card unplayable.
  _abilityMember(ability: AbilityId): Member | undefined {
    return this.members.find((m) => m.alive && m.ability === ability);
  }

  // #54: is this ability card currently disabled — drawn but unplayable because its
  // bound member is down (recoverable via Resurrect)? Non-ability cards are never
  // disabled by this rule. The UI reads this to render the card in a disabled state
  // instead of only refusing the click. (Incapacitated members never inject a card
  // at all — abilityCardsForParty skips them — so this only fires for revivable
  // in-fight deaths.)
  isAbilityCardDisabled(card: ResolvedCard): boolean {
    return card.ability != null && this._abilityMember(card.ability) == null;
  }

  _applyCard(card: ResolvedCard, target: number | null): void {
    // Per-member ability cards (#44): fire the bound member's ability. canPlay has
    // already ensured a living carrier exists (devPlayCard tolerates its absence).
    if (card.ability != null) {
      const m = this._abilityMember(card.ability);
      if (m) this._fireAbility(m);
      return;
    }
    switch (card.id) {
      case 'lowHeal':
      case 'highHeal': {
        const m = this.members[target as number];
        const healed = this._healMember(m, (card.heal ?? 0) + this._holyHealBonus(card), true);
        this._log(`${card.name}: ${m.name} heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        break;
      }
      case 'aoeHeal': {
        for (const m of this.livingMembers()) {
          const healed = this._healMember(m, (card.heal ?? 0) + this._holyHealBonus(card), true);
          this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        }
        this._log(`Group Heal: all living members heal up to ${card.heal}.`, 'heal');
        break;
      }
      case 'regen': {
        const m = this.members[target as number];
        // Additive (#52): the card's amount adds to any existing Regen — magnitude
        // is duration, so Regen +2 onto Regen 3 becomes Regen 5 (deeper AND longer).
        // A pending Lifebloom burst rides along on the extended Regen (no overwrite).
        m.regen += card.regen ?? 0;
        this._log(`Regen on ${m.name} (Regen ${m.regen}, decays each turn).`, 'status');
        this._emit({ kind: 'regenApplied', slot: m.slot, stack: m.regen });
        break;
      }
      case 'shield': {
        const m = this.members[target as number];
        m.shield = true; // does not stack
        m.shieldTurns = SHIELD_TURNS; // re-raising refreshes the fuse
        m.brace = false; // a member holds Shield OR Brace — newest replaces (#17)
        m.braceTurns = 0;
        this._log(`Shield raised on ${m.name} (fades in ${SHIELD_TURNS} enemy turns).`, 'status');
        this._emit({ kind: 'shieldApplied', slot: m.slot });
        break;
      }
      case 'resurrect': {
        const m = this.members[target as number];
        m.alive = true;
        m.hp = Math.ceil(m.maxHP / 2);
        m.brace = false; m.braceTurns = 0;
        m.regen = 0; m.bloomBurst = 0;
        m.taunt = 0; m.defense = 0; m.defenseAmount = 0; m.charge = 0; m.drumPrimed = false;
        m.strikeBonus = 0; m.strikeTurns = 0; m.guardDR = 0; m.guardTurns = 0; // #62 buffs cleared on revive
        m.empowerBonus = 0; m.riposte = false;
        // Reworked (#18): the revive comes back behind a fresh Shield so the
        // standing telegraph can't immediately undo the 4 MP investment.
        m.shield = true; m.shieldTurns = SHIELD_TURNS;
        this._log(`${m.name} is resurrected to ${m.hp} HP behind a Shield.`, 'status');
        this._emit({ kind: 'resurrect', slot: m.slot, hp: m.hp });
        this._emit({ kind: 'shieldApplied', slot: m.slot });
        break;
      }
      case 'refresh':
      case 'fontOfMana': {
        // Refresh and Font of Mana (#15) share one status slot. Re-applying
        // refreshes the duration and keeps the stronger value (no stacking), and
        // resets the per-cast MP total; the cap is the JUST-CAST card's designed
        // lifetime, so no cast can ever restore more than its own card allows.
        this.refresh = Math.max(this.refresh, card.refresh ?? 0);
        this.refreshTurns = card.refreshTurns;
        this.refreshRestored = 0;
        this.refreshCap = card.refreshCap;
        this._log(`${card.name} primed (${this.refresh} MP/turn for ${this.refreshTurns}).`, 'status');
        this._emit({ kind: 'refreshPrimed', stack: this.refresh });
        break;
      }
      case 'overgrowth': {
        // Party-wide Regen with the single-target card's additive semantics per
        // member (#52): the card's amount adds to each member's existing Regen.
        for (const m of this.livingMembers()) {
          m.regen += card.regen ?? 0;
          this._emit({ kind: 'regenApplied', slot: m.slot, stack: m.regen });
        }
        this._log(`Overgrowth: Regen +${card.regen} on all living members (decays each turn).`, 'status');
        break;
      }
      case 'cultivate': {
        const m = this.members[target as number];
        // Modify the active Regen IN PLACE (canPlay guarantees one): add to the
        // single value, so it heals more AND lasts a tick longer (#52), and any
        // pending Lifebloom burst (#16) rides along untouched.
        m.regen += CULTIVATE_STRENGTH;
        this._log(`Cultivate: ${m.name}'s Regen grows to ${m.regen} (decays each turn).`, 'status');
        this._emit({ kind: 'regenApplied', slot: m.slot, stack: m.regen });
        break;
      }
      case 'bloom': {
        const m = this.members[target as number];
        // Consume the Regen: heal per remaining tick (== the Regen value, #52),
        // then it's gone.
        const healed = this._healMember(m, BLOOM_HEAL_PER_TURN * m.regen, true);
        m.regen = 0;
        this._log(`Bloom consumes ${m.name}'s Regen: heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        // Consuming a Lifebloom Regen is one of its end conditions: burst too.
        this._endRegenBurst(m);
        break;
      }
      // Cascade (#63) shares Inspiration's draw effect; its Arcane count payoff is a
      // cost discount, resolved in effectiveCost (the counter is read there).
      case 'inspiration':
      case 'cascade': {
        const before = this.hand.length;
        for (let i = 0; i < (card.draw ?? 0); i++) {
          const c = this._drawOne();
          if (c == null) break; // draw and discard both empty
          this.hand.push(c);
        }
        const drawn = this.hand.length - before;
        this._log(`${card.name}: drew ${drawn} card${drawn === 1 ? '' : 's'}.`, 'status');
        this._emit({ kind: 'draw', count: drawn });
        break;
      }
      case 'nightfall': {
        // A Shadow nuke that grows with Shadow cards played THIS FIGHT (the per-fight
        // counter is bumped after this resolves, so it reads the plays before it), capped.
        const dmg = Math.min(NIGHTFALL_CAP, NIGHTFALL_BASE + NIGHTFALL_PER_SHADOW * this.typePlayedThisFight.shadow);
        const killed = this._damageEnemy(dmg, 'Nightfall');
        this._emitEnemyNuke(dmg, killed);
        break;
      }
      case 'lifebloom': {
        const m = this.members[target as number];
        // Additive Regen like the base card (#52): the amount deepens any existing
        // Regen. The burst is a single flag, so re-arming keeps just one pending
        // burst; it pays out when the (possibly extended) Regen ends alive.
        m.regen += card.regen ?? 0;
        m.bloomBurst = LIFEBLOOM_BURST;
        this._log(`Lifebloom on ${m.name} (Regen ${m.regen}, decays each turn; bursts ${LIFEBLOOM_BURST} when it ends).`, 'status');
        this._emit({ kind: 'regenApplied', slot: m.slot, stack: m.regen });
        break;
      }
      case 'surge': {
        this.surgePending = true; // consumed by the next play; cleared at end of turn
        this._log('Surge: the next card this turn costs 0 MP.', 'status');
        this._emit({ kind: 'surge' });
        break;
      }
      case 'battleHymn': {
        // No stacking — re-singing it in the same phase keeps the stronger bonus.
        this.hymnBonus = Math.max(this.hymnBonus, HYMN_BONUS);
        this._log(`Battle Hymn: every living member's attack deals +${this.hymnBonus} this turn.`, 'status');
        this._emit({ kind: 'hymn', bonus: this.hymnBonus });
        break;
      }
      case 'barrier': {
        // A mass Shield with a 1-enemy-phase fuse (the strict case of the #02
        // expiry rule). Never downgrades a longer-lived Shield already standing.
        for (const m of this.livingMembers()) {
          m.shield = true;
          m.shieldTurns = Math.max(m.shieldTurns, BARRIER_TURNS);
          m.brace = false; // newest ward replaces (#17)
          m.braceTurns = 0;
          this._emit({ kind: 'shieldApplied', slot: m.slot });
        }
        this._log('Barrier: every living member gains a Shield (fades after the next enemy phase).', 'status');
        break;
      }
      case 'bloodTithe': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, card.selfDamage ?? 0);
        const before = this.mp;
        this.mp = Math.min(this.maxMana, this.mp + BLOOD_TITHE_MP);
        this._log(`Blood Tithe: ${m.name} pays ${paid} HP; ${this.mp - before} MP restored. (MP ${this.mp})`, 'mp');
        this._emit({ kind: 'refreshTick', amount: this.mp - before, mp: this.mp });
        break;
      }
      case 'martyrsGift': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, card.selfDamage ?? 0);
        for (const other of this.livingMembers()) {
          if (other.slot === m.slot) continue;
          const healed = this._healMember(other, card.heal ?? 0, true);
          this._emit({ kind: 'heal', slot: other.slot, amount: healed, hp: other.hp });
        }
        this._log(`Martyr's Gift: ${m.name} pays ${paid} HP; the others heal up to ${card.heal}.`, 'heal');
        break;
      }
      case 'grimHarvest': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, card.selfDamage ?? 0);
        this._log(`Grim Harvest: ${m.name} pays ${paid} HP.`, 'status');
        const killed = this._damageEnemy(GRIM_HARVEST_DMG, 'Grim Harvest');
        this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(GRIM_HARVEST_DMG), enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        break;
      }
      // --- Shadow cards (#63): party->enemy damage through _damageEnemy, so
      // Vulnerability applies and no enemy telegraph is perturbed. ---------------
      case 'shadowBolt': {
        const killed = this._damageEnemy(SHADOW_BOLT_DMG, 'Shadow Bolt');
        this._emitEnemyNuke(SHADOW_BOLT_DMG, killed);
        break;
      }
      case 'siphonLife': {
        const m = this.members[target as number];
        // Damage routes through the enemy pipeline (Vulnerability applies); the heal
        // routes through the heal pipeline (Field Triage / Hex etc. apply).
        const killed = this._damageEnemy(SIPHON_LIFE_DMG, 'Siphon Life');
        this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(SIPHON_LIFE_DMG), enemyHp: this.enemy.hp });
        const healed = this._healMember(m, SIPHON_LIFE_HEAL, true);
        this._log(`Siphon Life: ${m.name} drains ${healed} HP from the enemy.`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        break;
      }
      case 'doom': {
        const dmg = this._doomDamage();
        const killed = this._damageEnemy(dmg, 'Doom');
        this._emitEnemyNuke(dmg, killed);
        break;
      }
      case 'phalanx': {
        const m = this.members[target as number];
        // canPlay guarantees no active Defense (that is also the no-stack rule).
        m.defense = PHALANX_TURNS;
        m.defenseAmount = PHALANX_DEFENSE;
        this._log(`Phalanx: ${m.name} gains Defense ${PHALANX_DEFENSE} for ${PHALANX_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'defenseApplied', slot: m.slot, amount: PHALANX_DEFENSE });
        break;
      }
      case 'brace': {
        const m = this.members[target as number];
        m.brace = true;
        m.braceTurns = BRACE_TURNS;
        m.shield = false; // a member holds Shield OR Brace — newest replaces
        m.shieldTurns = 0;
        this._log(`${m.name} Braces: the next hit deals ${BRACE_AMOUNT} less (fades in ${BRACE_TURNS} enemy turns).`, 'status');
        this._emit({ kind: 'braceApplied', slot: m.slot });
        break;
      }
      case 'provoke': {
        // Taunt-lite (#31): make any member the enemy's aim, with a light bundled
        // Defense. Like the Tank's Taunt, future telegraphs auto-aim at them (via
        // _pickPrimary); the standing blow is not redirected for free.
        const m = this.members[target as number];
        m.taunt = TAUNT_LITE_TURNS;
        m.defense = TAUNT_LITE_TURNS;
        m.defenseAmount = Math.max(m.defense > 0 ? m.defenseAmount : 0, TAUNT_LITE_DEFENSE);
        this._log(`${m.name} Provokes — the enemy turns to them (Defense ${TAUNT_LITE_DEFENSE}) for ${TAUNT_LITE_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'taunt', slot: m.slot, turns: TAUNT_LITE_TURNS });
        break;
      }
      // --- small-party cards (#42) ---------------------------------------------
      case 'rally': {
        // Every attack this turn deals more, scaled by empty deploy seats — a lone
        // striker swings for a lot; a full party gains nothing.
        const empty = 3 - this.fieldedPartySize();
        this.hymnBonus = Math.max(this.hymnBonus, RALLY_DMG_PER_SEAT * empty);
        this._log(`Rally: every attack this turn deals +${RALLY_DMG_PER_SEAT * empty} (${empty} empty seat${empty === 1 ? '' : 's'}).`, 'status');
        this._emit({ kind: 'hymn', bonus: this.hymnBonus });
        break;
      }
      case 'focus': {
        // A concentrated heal: more efficient when there are fewer bodies to spread across.
        const m = this.members[target as number];
        const amount = (card.heal ?? FOCUS_HEAL) + (this.fieldedPartySize() <= SMALL_PARTY_MAX ? FOCUS_SMALL_BONUS : 0) + this._holyHealBonus(card);
        const healed = this._healMember(m, amount, true);
        this._log(`Focus: ${m.name} heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        break;
      }
      case 'channel': {
        const empty = 3 - this.fieldedPartySize();
        const before = this.mp;
        this.mp = Math.min(this.maxMana, this.mp + CHANNEL_MP + empty);
        this._log(`Channel restores ${this.mp - before} MP. (MP ${this.mp})`, 'mp');
        this._emit({ kind: 'refreshTick', amount: this.mp - before, mp: this.mp });
        break;
      }
      case 'holdTheLine': {
        // A mass Shield, but only a small party can hold it — a reward for undermanning.
        if (this.fieldedPartySize() <= SMALL_PARTY_MAX) {
          for (const m of this.livingMembers()) {
            m.shield = true;
            m.shieldTurns = SHIELD_TURNS;
            m.brace = false; m.braceTurns = 0;
            this._emit({ kind: 'shieldApplied', slot: m.slot });
          }
          this._log('Hold the Line — the small party braces behind Shields.', 'status');
        } else {
          this._log('Hold the Line finds too many bodies to shield (field 2 or fewer).', 'status');
        }
        break;
      }
      // --- hero buff card batch (#62) ------------------------------------------
      case 'guard': {
        // +GUARD_DR damage reduction on a hero. Its own DR field (adds to Defense),
        // no self-stack — re-casting just refreshes the timer, no second +1.
        const m = this.members[target as number];
        m.guardDR = GUARD_DR;
        m.guardTurns = GUARD_TURNS;
        this._log(`Guard on ${m.name}: -${GUARD_DR} damage per hit for ${GUARD_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'defenseApplied', slot: m.slot, amount: GUARD_DR });
        break;
      }
      case 'sharpen': {
        // +SHARPEN_BONUS auto damage on a hero; feeds memberDamage() until it decays.
        // Shares the strikeBonus field with Embolden (keep the stronger, refresh timer).
        const m = this.members[target as number];
        m.strikeBonus = Math.max(m.strikeTurns > 0 ? m.strikeBonus : 0, SHARPEN_BONUS);
        m.strikeTurns = SHARPEN_TURNS;
        this._log(`Sharpen on ${m.name}: +${SHARPEN_BONUS} damage for ${SHARPEN_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'hymn', bonus: SHARPEN_BONUS });
        break;
      }
      case 'embolden': {
        // +EMBOLDEN_BONUS auto damage to EVERY fielded hero, decaying over N turns.
        // A standing party buff (unlike the one-phase `rally` card's hymnBonus).
        for (const m of this.livingMembers()) {
          m.strikeBonus = Math.max(m.strikeTurns > 0 ? m.strikeBonus : 0, EMBOLDEN_BONUS);
          m.strikeTurns = EMBOLDEN_TURNS;
        }
        this._log(`Embolden: every fielded hero deals +${EMBOLDEN_BONUS} for ${EMBOLDEN_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'hymn', bonus: EMBOLDEN_BONUS });
        break;
      }
      case 'goad': {
        // The same Taunt(+Defense) the Tank's ability grants, from a card on any hero.
        // Defense strength scales on the target's abilityPower and keeps a stronger
        // Defense already standing (floored at 0, mirroring the taunt ability).
        const m = this.members[target as number];
        const strength = Math.max(0, DEFENSE_AMOUNT + m.abilityPower);
        m.defenseAmount = m.defense > 0 ? Math.max(m.defenseAmount, strength) : strength;
        m.taunt = TAUNT_TURNS;
        m.defense = DEFENSE_TURNS;
        this._log(`${m.name} is Goaded to the front — Taunt and Defense ${strength} for ${TAUNT_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'taunt', slot: m.slot, turns: TAUNT_TURNS });
        break;
      }
      case 'doubleStrike': {
        // Prime the hero's next basic auto to double (reuses the War Drum beat, spent
        // in _runPartyPhase). Only the basic auto — abilities don't read drumPrimed.
        const m = this.members[target as number];
        m.drumPrimed = true;
        this._log(`${m.name} readies a Double Strike — their next attack lands doubled.`, 'status');
        break;
      }
      case 'empower': {
        // A one-shot +EMPOWER_BONUS abilityPower on the hero's next ability, consumed
        // in _fireAbility. Refreshing keeps a single pending charge (no stack).
        const m = this.members[target as number];
        m.empowerBonus = EMPOWER_BONUS;
        this._log(`Empower on ${m.name}: their next ability fires at +${EMPOWER_BONUS} power.`, 'status');
        this._emit({ kind: 'hymn', bonus: EMPOWER_BONUS });
        break;
      }
      case 'riposte': {
        // Arm a counter on the next attack that connects with the hero (see
        // _resolveAttack). Consumed once; refreshing just re-arms the single flag.
        const m = this.members[target as number];
        m.riposte = true;
        this._log(`${m.name} sets a Riposte — the next hit will be answered in kind.`, 'status');
        this._emit({ kind: 'braceApplied', slot: m.slot });
        break;
      }
      case 'cleanse': {
        // Removes the Hexweaver's party-wide Hex (#13). Always playable; a no-op if
        // nothing is Wounded (the animator still gets an event to acknowledge it).
        const had = this.woundTurns > 0;
        this.woundTurns = 0;
        this._log(had ? 'Cleanse lifts the Hex — healing is restored.' : 'Cleanse finds no curse to lift.', 'status');
        this._emit({ kind: 'cleanse', slot: SLOT.CENTER });
        break;
      }
      default:
        break;
    }
  }

  _fireAbility(m: Member): void {
    // War Drum (#21): any Ability cast primes the caster's next auto to double.
    if (this.hasRelic('warDrum')) m.drumPrimed = true;
    // Empower (#62): a one-shot +abilityPower on this ability. Every case reads
    // m.abilityPower synchronously inside the switch, so temporarily bump it here
    // and restore below — the bonus is consumed exactly once.
    const empower = m.empowerBonus;
    if (empower > 0) {
      m.abilityPower += empower;
      m.empowerBonus = 0;
      this._log(`${m.name} is Empowered — this ability fires at +${empower} power.`, 'status');
    }
    switch (m.ability) {
      case 'poison': {
        const hourglass = this.hasRelic('crackedHourglass') ? HOURGLASS_POWER_BONUS : 0;
        // Floored at 1: a Broken member (DR1) can carry negative abilityPower, but
        // an ability never resolves to 0-or-below damage.
        const strength = Math.max(1, POISON_BASE + m.abilityPower + hourglass);
        // Re-applying refreshes the duration and keeps the stronger value (no stacking).
        this.enemy.poison = Math.max(this.enemy.poison, strength);
        this.enemy.poisonTurns = POISON_TURNS;
        this._log(`${m.name} fires Poison Arrow (${this.enemy.poison}/turn for ${this.enemy.poisonTurns}).`, 'status');
        this._emit({ kind: 'poisonApplied', slot: m.slot, amount: strength, poison: this.enemy.poison });
        break;
      }
      case 'taunt': {
        // Taunt and its bundled Defense are attributed to the caster, not a slot.
        // Defense strength is per-member (#17): the caster's abilityPower scales
        // it, and a stronger Defense already standing (Phalanx) is kept.
        // Floored at 0 (DR1): a Broken member's negative abilityPower may zero out
        // the bundled Defense, but must never turn it into bonus incoming damage.
        const strength = Math.max(0, DEFENSE_AMOUNT + m.abilityPower);
        m.defenseAmount = m.defense > 0 ? Math.max(m.defenseAmount, strength) : strength;
        m.taunt = TAUNT_TURNS;
        m.defense = DEFENSE_TURNS;
        // Future telegraphs auto-aim at the taunting member (via _pickPrimary). The
        // *standing* blow is the costly part: it is not redirected for free.
        if (this.tauntRetargetMode === 'surcharge'
            && this._standingTelegraphRedirectable(m.slot)
            && this.mp >= TAUNT_RETARGET_SURCHARGE) {
          this.mp -= TAUNT_RETARGET_SURCHARGE;
          this._retargetTelegraphTo(m.slot);
          this._log(`${m.name} wrenches the incoming attack onto itself (-${TAUNT_RETARGET_SURCHARGE} MP).`, 'status');
        }
        this._log(`${m.name} Taunts and braces (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'taunt', slot: m.slot, turns: TAUNT_TURNS });
        break;
      }
      case 'bolt': {
        // Bolt scales on the *caster's* Charge.
        const hourglass = this.hasRelic('crackedHourglass') ? HOURGLASS_POWER_BONUS : 0;
        // Floored at 1 (DR1): see the poison note — a Broken member still bolts for
        // at least its Charge scaling.
        const base = Math.max(1, BOLT_BASE + m.abilityPower + hourglass);
        const dmg = base + BOLT_CHARGE_MULT * m.charge;
        this._log(`${m.name} casts Lightning Bolt (base ${base} + ${BOLT_CHARGE_MULT}×Charge ${m.charge}).`, 'status');
        m.charge = 0;
        const killed = this._damageEnemy(dmg, 'Lightning Bolt');
        this._emit({ kind: 'bolt', slot: m.slot, amount: this.vulnerableAmount(dmg), enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        break;
      }
      case 'hex': {
        // The Warlock (redesigned #39) curses the enemy with Vulnerability: the party
        // deals (1 + vuln) damage to it for HEX_TURNS. The bonus is LARGER the fewer
        // members are fielded (strongest solo), so a small party's low output is
        // amplified enough to matter — and abilityPower (upgrades) sweetens it.
        // No self-damage: the old Soul Tithe / Dark Bargain suicide is gone.
        const size = this.fieldedPartySize();
        const base = HEX_VULN_BY_SIZE[Math.min(size, HEX_VULN_BY_SIZE.length - 1)] ?? 0;
        const vuln = Math.max(0, base + m.abilityPower * HEX_VULN_PER_POWER);
        // Re-hexing refreshes the duration and keeps the stronger value (no stacking).
        this.enemy.vulnerable = Math.max(this.enemy.vulnerable, vuln);
        this.enemy.vulnerableTurns = HEX_TURNS;
        this._log(`${m.name} hexes the enemy — +${Math.round(vuln * 100)}% damage taken for ${HEX_TURNS} turns.`, 'status');
        break;
      }
      case 'crescendo': {
        // The Skald (#27) draws CRESCENDO_DRAW cards; the Ability card that fired it
        // already counted as the "1 card played" toward his cards-played strike.
        let drawn = 0;
        for (let i = 0; i < CRESCENDO_DRAW; i++) {
          const c = this._drawOne();
          if (c == null) break;
          this.hand.push(c);
          drawn += 1;
        }
        this._log(`${m.name} plays a Crescendo — draws ${drawn}.`, 'status');
        this._emit({ kind: 'draw', count: drawn });
        break;
      }
      case 'rampage': {
        // The Berserker (#28) strikes for 2× his CURRENT (banded) damage + abilityPower,
        // then loses RAMPAGE_SELF_DMG HP — which can drop him into a hotter band. The
        // self-damage clamps to leave 1 HP (a nuke, not a suicide button).
        const dmg = 2 * this.memberDamage(m) + m.abilityPower;
        const killed = this._damageEnemy(dmg, `${m.name} (Rampage)`);
        this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(dmg), enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        this._bloodPay(m, RAMPAGE_SELF_DMG);
        break;
      }
      case 'graveChill': {
        // The Grave Augur (#28) shaves GRAVE_CHILL_REDUCTION (+abilityPower) damage per
        // target off the standing telegraph (floor 0) — the taunt-less redirection
        // substitute. Modifies the telegraph in place, so attackTargets() previews it.
        const t = this.telegraph;
        const reduce = Math.max(0, GRAVE_CHILL_REDUCTION + m.abilityPower);
        if (t && !t.cast && t.damage > 0) {
          const before = t.damage;
          t.damage = Math.max(0, t.damage - reduce);
          this._log(`${m.name} chills the ${this.telegraphIntent() ?? 'attack'}: ${before} → ${t.damage} per target.`, 'status');
          this._emit({ kind: 'graveChill', slot: m.slot, amount: before - t.damage });
        } else {
          this._log(`${m.name} reaches for the telegraph, but there is nothing to chill.`, 'status');
        }
        break;
      }
      case 'callBoar': {
        // The Beast Warden (#29) summons a Boar on her slot: it soaks whole hits
        // aimed at her, lends her its strike, and lasts BOAR_TURNS enemy turns.
        // Recasting replaces it at full HP (no stack).
        m.boarHp = BOAR_HP + m.abilityPower;
        m.boarTurns = BOAR_TURNS;
        this._log(`${m.name} calls a Boar (${m.boarHp} HP) to her side for ${m.boarTurns} enemy turns.`, 'status');
        this._emit({ kind: 'boarSummon', slot: m.slot, hp: m.boarHp, turns: m.boarTurns });
        break;
      }
      case 'stun': {
        // The Sentinel (#61) Stuns the enemy: flag the standing telegraph as
        // cancelled. On the enemy phase it deals no damage and runs no cast — the
        // enemy loses the turn — but the move is CONSUMED: the rotation still
        // advances and any channel wind-up aborts (the "cooldown as if the move was
        // successful" clause; the engine has no per-move cooldown, so advancing the
        // rotation index IS consuming the move). A fresh action telegraphs next turn.
        const t = this.telegraph;
        if (t && !t.stunned) {
          const intent = this.telegraphIntent() ?? 'attack';
          t.stunned = true;
          this._log(`${m.name} Stuns the ${this.enemyDef.name} — its ${intent} is cancelled.`, 'status');
          this._emit({ kind: 'stun', slot: m.slot, intent });
        } else {
          this._log(`${m.name} winds up to Stun, but there is nothing to interrupt.`, 'status');
        }
        break;
      }
      default:
        break;
    }
    // Restore the base abilityPower after an Empowered cast (#62) — the bonus was
    // spent by the ability above; the member's persistent power is unchanged.
    if (empower > 0) m.abilityPower -= empower;
  }

  // Decaying Rest (flaw #5): you may still Rest after playing a single card, but
  // it yields less. Resting is off the table once two or more cards are played.
  canSkip(): boolean {
    if (this.hasRelic('pactOfSilence')) return false; // the Pact forbids Rest (#22)
    return this.phase === 'player' && this.cardsPlayedThisPhase <= 1;
  }

  // Raw MP a Rest would grant right now before the cap: full restRegen if no card
  // was played, the decayed amount if exactly one was.
  restRegenNow(): number {
    return this.cardsPlayedThisPhase === 0 ? this.restRegen : SKIP_REGEN_DECAYED;
  }

  // MP a rest would actually recover right now, accounting for the MP cap.
  restAmount(): number {
    return Math.min(this.maxMana, this.mp + this.restRegenNow()) - this.mp;
  }

  skipTurn(): PlayResult {
    if (!this.canSkip()) return { ok: false, reason: 'cannot skip now' };
    this.events = [];
    const before = this.mp;
    this.mp = Math.min(this.maxMana, this.mp + this.restRegenNow());
    this._log(`Rested to regen +${this.mp - before} MP. (MP ${this.mp})`, 'mp');
    this._emit({ kind: 'rest', amount: this.mp - before, mp: this.mp });
    this._endTurnInternal();
    return { ok: true };
  }

  endTurn(): PlayResult {
    if (this.phase !== 'player') return { ok: false, reason: 'not your phase' };
    this.events = [];
    this._endTurnInternal();
    return { ok: true };
  }

  _endTurnInternal(): void {
    this.surgePending = false; // Surge is "this turn" only — an unspent one fizzles

    // Discard the hand from the end (same ordering the prototype used, so existing
    // seeds reshuffle identically), keeping any Retain cards in hand for next phase.
    // The hand-4 carryover experiment (#25) additionally keeps up to `carryover`
    // non-retain cards — costliest first, the card you're saving toward — across the
    // discard. carryover 0 leaves this loop bit-identical to the classic discard.
    const carried = new Set<number>(
      this.carryover > 0
        ? this.hand
            .filter((dc) => !resolveCard(dc).retain)
            .sort((a, b) => resolveCard(b).cost - resolveCard(a).cost)
            .slice(0, this.carryover)
            .map((dc) => dc.uid)
        : [],
    );
    const kept: DeckCard[] = [];
    while (this.hand.length) {
      const dc = this.hand.pop() as DeckCard;
      if (resolveCard(dc).retain || carried.has(dc.uid)) kept.push(dc);
      else this.discardPile.push(dc);
    }
    this.hand = kept;

    // Party phase: living members auto-attack in slot order.
    this._runPartyPhase();
    if (this.status !== 'playing') return; // enemy died -> no further enemy phase

    // Enemy resolves THIS turn's standing telegraph, then advances the turn counter
    // and telegraphs the next (player-first ordering, #26 — the turn no longer
    // increments before the enemy phase; _runEnemyPhase owns the advance).
    this._runEnemyPhase();
    if (this.status === 'playing') this._startPlayerPhase();
  }

  _runPartyPhase(): void {
    // Each living member strikes in slot order (left -> center -> right) so the UI
    // can play three attacks in sequence. The enemy HP steps down per hit; the
    // total is unchanged from a single combined strike.
    for (const m of this.members) {
      let dmg = this.memberDamage(m);
      if (!m.alive || dmg <= 0) continue;
      // War Drum (#21) / Double Strike card (#62): the primed member's auto lands
      // double, then the beat is spent.
      if (m.drumPrimed) {
        dmg *= 2;
        m.drumPrimed = false;
        this._log(this.hasRelic('warDrum')
          ? `The War Drum beats — ${m.name}'s strike doubles!`
          : `${m.name}'s strike lands doubled!`, 'status');
      }
      const killed = this._damageEnemy(dmg, `${m.name}`);
      this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(dmg), enemyHp: this.enemy.hp });
      if (killed) this._emit({ kind: 'defeatEnemy' });
      if (this.status !== 'playing') break; // a strike can finish the enemy
    }
    this.hymnBonus = 0; // Battle Hymn only buffs the phase it was sung in
  }

  // Once-per-RUN relics this fight consumed (#22) — the run layer records these
  // so the next fight's BattleConfig arrives with them pre-spent.
  spentRelicIds(): RelicId[] {
    const out: RelicId[] = [];
    if (this.chimeUsed && this.hasRelic('duskChime')) out.push('duskChime');
    if (this.martyrUsed && this.hasRelic('martyrsIcon')) out.push('martyrsIcon');
    return out;
  }

  // Slots of members that DIED this fight (DR1), even if later Resurrected. The
  // run layer reads this after a win to record persistent injuries.
  diedThisFightSlots(): Slot[] {
    return this.members.filter((m) => m.diedThisFight).map((m) => m.slot);
  }

  // Each battle slot's current HP at the end of a fight (#58): the number the run
  // layer carries back onto the deployed roster member (0 for a dead member, which
  // the between-fight heal then resurrects to the recovered amount). An empty slot
  // (no member deployed) reports null. Indexed by battle slot, length 3.
  memberHPBySlot(): (number | null)[] {
    return this.members.map((m) => (m.absent ? null : m.hp));
  }

  // ---- dev / cheats --------------------------------------------------------
  // Used only by the dev panel. Each clears `events` and emits existing FX events
  // where a natural one exists, so the hook's animator and view-sync stay unchanged.
  // These bypass the normal rules (MP cost, hand, targeting) on purpose.

  devDamageEnemy(amount: number): void {
    this.events = [];
    if (this.status !== 'playing') return;
    const killed = this._damageEnemy(Math.max(0, amount), 'Dev');
    if (killed) this._emit({ kind: 'defeatEnemy' });
  }

  devKillEnemy(): void {
    this.devDamageEnemy(this.enemy.hp);
  }

  devHealMemberToFull(slot: number): void {
    this.events = [];
    const m = this.members[slot];
    if (!m || !m.alive) return; // dead members stay dead — use Resurrect from the library
    const healed = this._healMember(m, m.maxHP - m.hp);
    this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
  }

  devFillMana(): void {
    this.events = [];
    this.mp = this.maxMana;
  }

  // Play any card in the game immediately, free of MP cost and without it being in
  // hand. Auto-resolves a sensible target when none is given.
  devPlayCard(cardId: CardId, target: number | null = null): void {
    this.events = [];
    if (this.status !== 'playing' || this.phase !== 'player') return;
    const card = resolveCard(makeDeckCard(cardId, 0));
    // 'single' covers the heal/regen/shield cards; 'dead' is resurrect; 'all'/'none'
    // need no target (per-member ability cards (#44) are 'none' and self-resolve).
    const needsLiving = card.target === 'single';
    let t = target;
    if (t == null) {
      if (needsLiving) {
        t = this.members.find((m) => m.alive && (!card.needsRegen || m.regen > 0))?.slot ?? null;
      } else if (card.target === 'dead') t = this.members.find((m) => !m.alive)?.slot ?? null;
    }
    // Bail if a slot-targeted card has no valid target available.
    if ((needsLiving || card.target === 'dead') && t == null) return;
    this._applyCard(card, t);
  }
}
