// Core battle engine for the Healer Deckbuilder prototype.
// Pure logic, no DOM. Drives one handcrafted fight end to end.
//
// Phase cycle per turn: enemy phase -> player phase -> party phase.
// The UI drives it by calling:
//   new Game(seed); game.start();          // runs turn 1's enemy phase, opens player phase
//   game.playCard(handIndex, target);      // during player phase
//   game.skipTurn();                        // regen MP instead of playing (before any card)
//   game.endTurn();                         // discard, party phase, then next enemy + player phases
// Read state off the public fields; read game.log for a running event feed.

import {
  MEMBER_DEFS, ATTACK_BASE_DAMAGE, SLOT_WEIGHTS,
  ENRAGE_TURN, ENRAGE_MULT, BOLT_BASE, BOLT_CHARGE_MULT, CHARGE_MAX,
  POISON_BASE, POISON_TURNS,
  TAUNT_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS, SHIELD_TURNS, SLOT,
  DEFAULT_TAUNT_RETARGET_MODE, TAUNT_RETARGET_SURCHARGE,
  SKIP_REGEN_DECAYED, REFRESH_MP_CAP,
  CULTIVATE_STRENGTH, CULTIVATE_TURNS, BLOOM_HEAL_PER_TURN,
  LIFEBLOOM_BURST, HYMN_BONUS, BARRIER_TURNS, BLOOD_TITHE_MP, GRIM_HARVEST_DMG,
  PHALANX_DEFENSE, PHALANX_TURNS, BRACE_AMOUNT, BRACE_TURNS,
  TITHE_CANDLE_MP, TITHE_CANDLE_FIGHT_CAP, FIELD_TRIAGE_BONUS, FIELD_TRIAGE_THRESHOLD,
  GROUNDING_ROD_REDUCTION, PRAYER_BEADS_MP, STORMGLASS_MIN_HIT, VANGUARD_BONUS,
  WARD_MAX, TAPER_MAX_COST, DUSK_CHIME_MIN, PACT_PASSIVE_MP,
  CRACKED_HOURGLASS_ENRAGE, HOURGLASS_POWER_BONUS, RUSTY_CROWN_ATTACK,
  isEngineCard,
  WOUND_TURNS, WOUND_HEAL_FACTOR, SIPHON_AMOUNT,
  DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, ATTACK_INTENT_NAMES,
  defaultBattleConfig, resolveCard, makeDeckCard,
} from './constants';
import type {
  Slot, AttackType, MemberId, AbilityId, BattleConfig, DeckCard, ResolvedCard, CardId,
  TauntRetargetMode, EnemyDef, RotationStep, RotationEntry, CastKind, RelicId,
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
  regen: number;      // Regen strength: HP healed per turn while active
  regenTurns: number; // player phases of Regen remaining
  bloomBurst: number; // pending Lifebloom burst: heals this much when the Regen ends alive (#16)
  taunt: number;   // taunt turns remaining (attributed to whoever cast Taunt)
  defense: number; // Defense turns remaining: incoming hits reduced by defenseAmount
  defenseAmount: number; // per-member Defense strength while defense > 0 (#17)
  charge: number;  // per-member Charge (feeds the Bolt ability); ticks each player phase
  drumPrimed: boolean; // War Drum relic (#21): next auto deals double (consumed)
  ward: number;    // Aegis Font (#22): damage buffer from cast-heal overheal (max WARD_MAX)
  diedThisFight: boolean; // DR1: went to 0 HP at any point this fight (a later Resurrect
                          // does not clear it — death always scars; a Martyr's Icon save
                          // vetoes the death, so it never sets this).
  injuries: number; // DR1 (display only): persistent scars carried in from the run; the
                    // stat penalty they cause is already baked into maxHP/damage/abilityPower.
}

export interface Enemy {
  hp: number;
  maxHP: number;
  poison: number;      // Poison strength: damage dealt per turn while active
  poisonTurns: number; // enemy turns of Poison remaining
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
  | { kind: 'enemyAttack'; slot: Slot; amount: number; hp: number;
      result: 'hit' | 'shield' | 'whiff'; killed: boolean; hidden: boolean }
  // --- player phase start (regen resolves after the enemy's blow has landed) ---
  | { kind: 'regenTick'; slot: Slot; amount: number; hp: number }
  // --- party phase (one per attacking member, left to right) ---
  | { kind: 'partyAttack'; slot: Slot; amount: number; enemyHp: number }
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
  cardsPlayedThisPhase: number; // cards played this player phase; drives decaying Rest (+5 at 0, +2 at 1)
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

    this.members = config.party.map((p, slot): Member => {
      const d = MEMBER_DEFS[slot];
      return {
        slot: d.slot, id: d.id, name: d.name, maxHP: p.maxHP, damage: p.damage,
        ability: d.ability, abilityPower: p.abilityPower,
        hp: p.maxHP, alive: true,
        shield: false, // pending shield (blocks the next damaging instance)
        shieldTurns: 0,
        brace: false,  // pending Brace (one-shot damage reduction)
        braceTurns: 0,
        regen: 0,      // Regen strength
        regenTurns: 0, // Regen turns remaining
        bloomBurst: 0, // no Lifebloom burst pending
        taunt: 0,      // taunt turns remaining (attributed to the caster)
        defense: 0,    // Defense turns remaining
        defenseAmount: 0, // Defense strength while active
        charge: 0,     // per-member Charge
        drumPrimed: false, // no War Drum beat pending
        ward: 0,       // no Aegis Ward standing
        diedThisFight: false, // no death yet this fight
        injuries: p.injuries, // display-only; penalty already folded into the stats above
      };
    });

    this.enemy = {
      hp: config.enemy.maxHP, maxHP: config.enemy.maxHP,
      poison: 0, poisonTurns: 0, enraged: false,
    };

    this.maxMana = config.healer.maxMana;
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

    this.turn = 1;           // turn whose enemy phase is current/next to run
    this.phase = 'idle';     // 'idle' | 'player' | 'over'
    this.status = 'playing'; // 'playing' | 'win' | 'loss'
    this.cardsPlayedThisPhase = 0;
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

  memberById(id: MemberId): Member { return this.members.find((m) => m.id === id) ?? this.members[SLOT.CENTER]; }

  // Charge is per-member now (any member can carry it); mageCharge proxies the
  // mage's charge so existing UI/sim/test call sites keep working for the trio.
  get mageCharge(): number { return this.mage.charge; }
  set mageCharge(v: number) { this.mage.charge = v; }

  // The member currently holding Taunt (whoever cast it), or null. For the fixed
  // trio this is always the tank, but the engine no longer assumes that.
  tauntingMember(): Member | null { return this.members.find((m) => m.alive && m.taunt > 0) ?? null; }

  hasRelic(id: RelicId): boolean { return this.relics.has(id); }

  // Per-member attack damage — the single seam for party-phase damage modifiers.
  // Battle Hymn (#16) adds its bonus here for the phase it was sung in;
  // Vanguard's Banner (#21) rewards a member kept at full HP.
  memberDamage(m: Member): number {
    const banner = this.hasRelic('vanguardsBanner') && m.hp === m.maxHP ? VANGUARD_BONUS : 0;
    return m.damage + this.hymnBonus + banner;
  }

  livingMembers(): Member[] { return this.members.filter((m) => m.alive); }
  allDead(): boolean { return this.members.every((m) => !m.alive); }

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
    let second: Slot;
    if (primary === SLOT.CENTER) second = this.rng() < 0.5 ? SLOT.LEFT : SLOT.RIGHT;
    else second = SLOT.CENTER;
    return [primary, second];
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
    // The turn-1 blow resolves on mount, before any player input, so it must not
    // open on a heavy or a sweep — force it to a plain single-target hit (flaw #12).
    const type = turn === 1 ? 'single' : this._pickType(turn);
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
    return t.targets
      .filter((slot) => this.members[slot]?.alive)
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
    // First telegraph is generated before turn 1's enemy phase.
    this.telegraph = this._generateTelegraph(this.turn);
    this._runEnemyPhase();
    if (this.status === 'playing') this._startPlayerPhase();
    return this;
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
    m.regenTurns = 0;
    m.bloomBurst = 0; // death forfeits a pending Lifebloom burst (#16)
    m.taunt = 0;
    m.defense = 0;
    m.defenseAmount = 0;
    m.charge = 0;
    m.drumPrimed = false;
    m.ward = 0;
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
  // its target lives — natural expiry, overwrite by a new Regen-slot cast, or
  // Bloom's consume — burst-heals; death forfeits it (_killMember clears the
  // field without paying). Cultivate modifies the stack in place and never
  // routes through here, so it keeps the burst pending.
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

  // Damage a member actually takes from a raw attack value, after their Defense
  // (if any). Floored at 0 so a fully-absorbed hit can't heal. Defense strength
  // is per-member (#17): Taunt grants DEFENSE_AMOUNT + the caster's abilityPower,
  // Phalanx grants PHALANX_DEFENSE — whatever was set is what reduces here.
  _effectiveDamage(m: Member, raw: number, ignoreDefense = false): number {
    return m.defense > 0 && !ignoreDefense ? Math.max(0, raw - m.defenseAmount) : raw;
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
      this._emit({ kind: 'poisonTick', amount: dmg, enemyHp: this.enemy.hp });
      if (killed) this._emit({ kind: 'defeatEnemy' });
      this.enemy.poisonTurns -= 1;
      if (this.enemy.poisonTurns === 0) this.enemy.poison = 0;
      if (this.status === 'win') return; // poison can finish the enemy
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
    if (t && t.channel && (t.turnsUntilResolve ?? 1) > 1) {
      t.turnsUntilResolve = (t.turnsUntilResolve ?? 1) - 1;
      this._log(`${this.enemyDef.name} channels ${t.channelName} — ${t.turnsUntilResolve} turn(s) to resolve.`, 'system');
      this._emit({ kind: 'channelTick', name: t.channelName ?? 'Channel', turnsUntilResolve: t.turnsUntilResolve ?? 0 });
      this._decayBuffs();
      return; // channel keeps standing; do not advance the rotation or re-telegraph
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
      return; // the telegraph keeps standing; no rotation advance, no re-telegraph
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
    }

    // 3) decay per-turn buffs now that this enemy turn's attack has resolved.
    this._decayBuffs();

    // 4) advance any rotation and telegraph the next attack (enrage baked in).
    this.rotationIndex += 1;
    this.telegraph = this._generateTelegraph(this.turn + 1);
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
    for (const slot of t.targets) {
      const m = this.members[slot];
      if (!m || !m.alive) {
        this._log(`${label} whiffs on slot ${slot + 1}.`, 'whiff');
        this._emit({ kind: 'enemyAttack', slot, amount: 0, hp: 0, result: 'whiff', killed: false, hidden: t.hidden });
        continue;
      }
      // Defense -> Brace -> Shield (#17); the same pipeline attackTargets()
      // previews. Brace and Shield only spend on a still-damaging instance.
      const w = this._wardedDamage(m, t.damage, t.ignoreDefense, t.type);
      if (w.spendsStormglass) {
        this.stormglassUsed = true;
        this._log(`The Stormglass Mirror shatters the blow aimed at ${m.name}.`, 'shield');
        this._emit({ kind: 'enemyAttack', slot, amount: 0, hp: m.hp, result: 'shield', killed: false, hidden: t.hidden });
        continue;
      }
      if (w.spendsShield) {
        m.shield = false;
        m.shieldTurns = 0;
        this._log(`${m.name}'s Shield absorbs the hit.`, 'shield');
        this._emit({ kind: 'enemyAttack', slot, amount: t.damage, hp: m.hp, result: 'shield', killed: false, hidden: t.hidden });
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
      this._emit({ kind: 'enemyAttack', slot, amount: w.dmg, hp: m.hp, result: 'hit', killed, hidden: t.hidden });
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
      if (m.alive && m.regenTurns > 0) {
        const healed = this._healMember(m, m.regen);
        this._log(`${m.name} regenerates ${healed} (Regen ${m.regen}).`, 'heal');
        this._emit({ kind: 'regenTick', slot: m.slot, amount: healed, hp: m.hp });
        m.regenTurns -= 1;
        if (m.regenTurns === 0) {
          m.regen = 0;
          this._endRegenBurst(m); // natural expiry pays a pending Lifebloom burst
        }
      }
    }
    // Passive MP income (healer upgrade, plus the Pact of Silence's tithe)
    // lands at the start of the player phase.
    const passive = this.passiveMp + (this.hasRelic('pactOfSilence') ? PACT_PASSIVE_MP : 0);
    if (passive > 0 && this.mp < this.maxMana) {
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

  // What a card costs to play right now: 0 while a Surge (#16) is pending, 0
  // for the First-Light Taper's (#22) first cheap non-engine card of the turn,
  // otherwise its resolved cost. The UI's affordability check reads this too.
  effectiveCost(card: ResolvedCard): number {
    if (this.surgePending) return 0;
    if (this.hasRelic('firstLightTaper') && this.cardsPlayedThisPhase === 0
        && card.cost <= TAPER_MAX_COST && !isEngineCard(card.id)) {
      return 0;
    }
    return card.cost;
  }

  // Validate whether a hand card can currently be played. Returns null if ok,
  // otherwise a short reason string.
  canPlay(handIndex: number, target: number | null): string | null {
    if (this.phase !== 'player') return 'not your phase';
    const dc = this.hand[handIndex];
    if (dc == null) return 'no such card';
    const card = resolveCard(dc);
    if (this.mp < this.effectiveCost(card)) return 'not enough MP';
    switch (card.target) {
      case 'single':
      case 'ability': {
        const m = target == null ? undefined : this.members[target];
        if (!m || !m.alive) return 'target must be a living member';
        // Cultivate / Bloom (#15) operate on an existing Regen — dead without one.
        if (card.needsRegen && m.regenTurns <= 0) return 'target must have an active Regen';
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

    // Echo Locket (#21): once per fight, the first Poison or Bolt Ability cast
    // returns the card to hand (its MP was paid; a replay pays again).
    if (!this.echoUsed && this.hasRelic('echoLocket') && card.id === 'ability' && target != null) {
      const ability = this.members[target]?.ability;
      if (ability === 'poison' || ability === 'bolt') {
        this.echoUsed = true;
        const i = this.discardPile.lastIndexOf(dc);
        if (i >= 0) {
          this.discardPile.splice(i, 1);
          this.hand.push(dc);
          this._log('The Echo Locket hums — the Ability card returns to your hand.', 'status');
          this._emit({ kind: 'draw', count: 1 });
        }
      }
    }
    return { ok: true };
  }

  _applyCard(card: ResolvedCard, target: number | null): void {
    switch (card.id) {
      case 'lowHeal':
      case 'highHeal': {
        const m = this.members[target as number];
        const healed = this._healMember(m, card.heal ?? 0, true);
        this._log(`${card.name}: ${m.name} heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        break;
      }
      case 'aoeHeal': {
        for (const m of this.livingMembers()) {
          const healed = this._healMember(m, card.heal ?? 0, true);
          this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        }
        this._log(`Group Heal: all living members heal up to ${card.heal}.`, 'heal');
        break;
      }
      case 'regen': {
        const m = this.members[target as number];
        // Overwriting a Lifebloom Regen ends it — its pending burst pays out first.
        this._endRegenBurst(m);
        // Re-applying refreshes the duration and keeps the stronger value (no stacking).
        m.regen = Math.max(m.regen, card.regen ?? 0);
        m.regenTurns = card.regenTurns;
        this._log(`Regen on ${m.name} (${m.regen}/turn for ${m.regenTurns}).`, 'status');
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
        m.regen = 0; m.regenTurns = 0; m.bloomBurst = 0;
        m.taunt = 0; m.defense = 0; m.defenseAmount = 0; m.charge = 0; m.drumPrimed = false;
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
        // Party-wide Regen with the single-target card's no-stack semantics per
        // member: refresh the duration, keep the stronger strength.
        for (const m of this.livingMembers()) {
          this._endRegenBurst(m); // overwrite pays out a pending Lifebloom burst
          m.regen = Math.max(m.regen, card.regen ?? 0);
          m.regenTurns = card.regenTurns;
          this._emit({ kind: 'regenApplied', slot: m.slot, stack: m.regen });
        }
        this._log(`Overgrowth: Regen ${card.regen} on all living members for ${card.regenTurns} turns.`, 'status');
        break;
      }
      case 'cultivate': {
        const m = this.members[target as number];
        // Modify the active Regen IN PLACE (canPlay guarantees one): never
        // overwrite the stack, so a stronger Regen — and later Lifebloom's burst
        // (#16) — keeps everything it had.
        m.regen += CULTIVATE_STRENGTH;
        m.regenTurns += CULTIVATE_TURNS;
        this._log(`Cultivate: ${m.name}'s Regen grows to ${m.regen}/turn for ${m.regenTurns}.`, 'status');
        this._emit({ kind: 'regenApplied', slot: m.slot, stack: m.regen });
        break;
      }
      case 'bloom': {
        const m = this.members[target as number];
        // Consume the Regen: heal per remaining turn, then the stack is gone.
        const healed = this._healMember(m, BLOOM_HEAL_PER_TURN * m.regenTurns, true);
        m.regen = 0;
        m.regenTurns = 0;
        this._log(`Bloom consumes ${m.name}'s Regen: heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        // Consuming a Lifebloom Regen is one of its end conditions: burst too.
        this._endRegenBurst(m);
        break;
      }
      case 'inspiration': {
        const before = this.hand.length;
        for (let i = 0; i < (card.draw ?? 0); i++) {
          const c = this._drawOne();
          if (c == null) break; // draw and discard both empty
          this.hand.push(c);
        }
        const drawn = this.hand.length - before;
        this._log(`Inspiration: drew ${drawn} card${drawn === 1 ? '' : 's'}.`, 'status');
        this._emit({ kind: 'draw', count: drawn });
        break;
      }
      case 'lifebloom': {
        const m = this.members[target as number];
        // Overwriting an older Lifebloom ends it — pay its burst before arming
        // the new one (a member never holds two pending bursts).
        this._endRegenBurst(m);
        m.regen = Math.max(m.regen, card.regen ?? 0);
        m.regenTurns = card.regenTurns;
        m.bloomBurst = LIFEBLOOM_BURST;
        this._log(`Lifebloom on ${m.name} (${m.regen}/turn for ${m.regenTurns}; bursts ${LIFEBLOOM_BURST} when it ends).`, 'status');
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
        this._emit({ kind: 'partyAttack', slot: m.slot, amount: GRIM_HARVEST_DMG, enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
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
      case 'cleanse': {
        // Removes the Hexweaver's party-wide Hex (#13). Always playable; a no-op if
        // nothing is Wounded (the animator still gets an event to acknowledge it).
        const had = this.woundTurns > 0;
        this.woundTurns = 0;
        this._log(had ? 'Cleanse lifts the Hex — healing is restored.' : 'Cleanse finds no curse to lift.', 'status');
        this._emit({ kind: 'cleanse', slot: SLOT.CENTER });
        break;
      }
      case 'ability': {
        this._fireAbility(this.members[target as number]);
        break;
      }
      default:
        break;
    }
  }

  _fireAbility(m: Member): void {
    // War Drum (#21): any Ability cast primes the caster's next auto to double.
    if (this.hasRelic('warDrum')) m.drumPrimed = true;
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
        this._emit({ kind: 'bolt', slot: m.slot, amount: dmg, enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        break;
      }
      default:
        break;
    }
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

    // Advance to the next turn.
    this.turn += 1;
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
      // War Drum (#21): the primed member's auto lands double, then the beat is spent.
      if (m.drumPrimed) {
        dmg *= 2;
        m.drumPrimed = false;
        this._log(`The War Drum beats — ${m.name}'s strike doubles!`, 'status');
      }
      const killed = this._damageEnemy(dmg, `${m.name}`);
      this._emit({ kind: 'partyAttack', slot: m.slot, amount: dmg, enemyHp: this.enemy.hp });
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
    // single/ability cover the heal/regen/shield/ability cards (all targeted 'single'
    // or 'ability'); 'dead' is resurrect; 'all'/'none' need no target.
    const needsLiving = card.target === 'single' || card.target === 'ability';
    let t = target;
    if (t == null) {
      if (needsLiving) {
        t = this.members.find((m) => m.alive && (!card.needsRegen || m.regenTurns > 0))?.slot ?? null;
      } else if (card.target === 'dead') t = this.members.find((m) => !m.alive)?.slot ?? null;
    }
    // Bail if a slot-targeted card has no valid target available.
    if ((needsLiving || card.target === 'dead') && t == null) return;
    this._applyCard(card, t);
  }
}
