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
  MEMBER_DEFS, ENEMY_MAX_HP, ATTACK_BASE_DAMAGE, TYPE_WEIGHTS, SLOT_WEIGHTS,
  ENRAGE_TURN, ENRAGE_MULT, MP_START, MP_MAX, SKIP_REGEN, BOLT_BASE, CHARGE_MAX,
  POISON_BASE, TAUNT_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS, HAND_SIZE, CARDS, DECK_LIST, SLOT,
} from './constants';
import type { Slot, AttackType, CardId, MemberId, AbilityId, CardDef } from './constants';
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
  hp: number;
  alive: boolean;
  shield: boolean; // pending shield (blocks next instance)
  regen: number;   // regen stack
  taunt: number;   // taunt turns remaining (tank only)
  defense: number; // Defense turns remaining: incoming hits reduced by DEFENSE_AMOUNT
}

export interface Enemy {
  hp: number;
  maxHP: number;
  poison: number;
  enraged: boolean;
}

export interface Telegraph {
  type: AttackType;
  hidden: boolean;
  damage: number;
  targets: Slot[];
  enraged: boolean;
  forTurn: number;
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
  | { kind: 'poisonTick'; amount: number; enemyHp: number }
  | { kind: 'regenTick'; slot: Slot; amount: number; hp: number }
  | { kind: 'refreshTick'; amount: number; mp: number }
  | { kind: 'enemyAttack'; slot: Slot; amount: number; hp: number;
      result: 'hit' | 'shield' | 'whiff'; killed: boolean; hidden: boolean }
  // --- party phase (one per attacking member, left to right) ---
  | { kind: 'partyAttack'; slot: Slot; amount: number; enemyHp: number }
  // --- healing / buffs / spells ---
  | { kind: 'heal'; slot: Slot; amount: number; hp: number }
  | { kind: 'regenApplied'; slot: Slot; stack: number }
  | { kind: 'shieldApplied'; slot: Slot }
  | { kind: 'resurrect'; slot: Slot; hp: number }
  | { kind: 'refreshPrimed'; stack: number }
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
  members: Member[];
  enemy: Enemy;
  mp: number;
  mageCharge: number;
  refresh: number;
  drawPile: CardId[];
  discardPile: CardId[];
  hand: CardId[];
  turn: number;
  phase: Phase;
  status: Status;
  cardPlayedThisPhase: boolean;
  telegraph: Telegraph | null;
  log: LogEntry[];
  events: GameEvent[]; // animation feed for the most recent action (see GameEvent)

  constructor(seed: number = Date.now()) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);

    this.members = MEMBER_DEFS.map((d): Member => ({
      slot: d.slot, id: d.id, name: d.name, maxHP: d.maxHP, damage: d.damage,
      ability: d.ability,
      hp: d.maxHP, alive: true,
      shield: false, // pending shield (blocks next instance)
      regen: 0,      // regen stack
      taunt: 0,      // taunt turns remaining (tank only)
      defense: 0,    // Defense turns remaining
    }));

    this.enemy = { hp: ENEMY_MAX_HP, maxHP: ENEMY_MAX_HP, poison: 0, enraged: false };

    this.mp = MP_START;
    this.mageCharge = 0;
    this.refresh = 0; // player-level MP-regen stack

    this.drawPile = shuffle([...DECK_LIST], this.rng);
    this.discardPile = [];
    this.hand = [];

    this.turn = 1;           // turn whose enemy phase is current/next to run
    this.phase = 'idle';     // 'idle' | 'player' | 'over'
    this.status = 'playing'; // 'playing' | 'win' | 'loss'
    this.cardPlayedThisPhase = false;
    this.telegraph = null;   // upcoming attack (the one that lands next enemy phase)
    this.log = [];
    this.events = [];
  }

  // ---- helpers -------------------------------------------------------------

  get tank(): Member { return this.members[SLOT.CENTER]; }
  get mage(): Member { return this.members[SLOT.RIGHT]; }
  get ranger(): Member { return this.members[SLOT.LEFT]; }

  livingMembers(): Member[] { return this.members.filter((m) => m.alive); }
  allDead(): boolean { return this.members.every((m) => !m.alive); }

  _log(text: string, kind: string = 'info'): void { this.log.push({ text, kind, turn: this.turn }); }

  _emit(e: GameEvent): void { this.events.push(e); }

  isEnraged(turn: number): boolean { return turn >= ENRAGE_TURN; }

  // Per-target damage for an attack type at a given turn (round up on enrage).
  attackDamage(type: AttackType, turn: number): number {
    const base = ATTACK_BASE_DAMAGE[type];
    return this.isEnraged(turn) ? Math.ceil(base * ENRAGE_MULT) : base;
  }

  tankTaunting(): boolean { return this.tank.alive && this.tank.taunt > 0; }

  // ---- telegraph generation ------------------------------------------------

  _pickType(turn: number): AttackType {
    const w = this.isEnraged(turn) ? TYPE_WEIGHTS.enraged : TYPE_WEIGHTS.normal;
    return weightedPick(Object.entries(w) as Array<[AttackType, number]>, this.rng);
  }

  _pickPrimary(type: AttackType): Slot {
    if (this.tankTaunting()) return SLOT.CENTER;
    const weights = type === 'hidden' ? SLOT_WEIGHTS.hidden : SLOT_WEIGHTS.normal;
    return weightedPick(weights.map((wt, i): [Slot, number] => [i as Slot, wt]), this.rng);
  }

  // Resolve the set of target slots for a type given a chosen primary slot.
  _geometry(type: AttackType, primary: Slot): Slot[] {
    if (type === 'single' || type === 'hidden') return [primary];
    if (type === 'aoe') return [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT];
    // two-target: primary + one adjacent. center -> random edge; edge -> center.
    let second: Slot;
    if (primary === SLOT.CENTER) second = this.rng() < 0.5 ? SLOT.LEFT : SLOT.RIGHT;
    else second = SLOT.CENTER;
    return [primary, second];
  }

  _generateTelegraph(turn: number): Telegraph {
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
    };
  }

  // Lines to draw for the standing telegraph. [] when the game is over / no telegraph.
  // Each entry: { slot, damage, hidden }. Hidden attacks fan out to every living
  // member with unknown (null) damage; known attacks hit their living targets.
  attackTargets(): AttackSpec[] {
    const t = this.telegraph;
    if (this.status !== 'playing' || !t) return [];
    if (t.hidden) {
      return this.livingMembers().map((m): AttackSpec => ({ slot: m.slot, damage: null, hidden: true }));
    }
    return t.targets
      .filter((slot) => this.members[slot]?.alive)
      .map((slot): AttackSpec => ({ slot, damage: this._effectiveDamage(this.members[slot], t.damage), hidden: false }));
  }

  // Recompute the standing telegraph's targets with the Tank forced as primary.
  _retargetTelegraphToTank(): void {
    if (!this.telegraph) return;
    const t = this.telegraph;
    t.targets = this._geometry(t.type, SLOT.CENTER);
  }

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

  _killMember(m: Member): void {
    m.alive = false;
    m.hp = 0;
    m.shield = false;
    m.regen = 0;
    m.taunt = 0;
    m.defense = 0;
    if (m.id === 'mage') this.mageCharge = 0;
    this._log(`${m.name} has fallen!`, 'death');
  }

  _damageEnemy(amount: number, source: string): void {
    if (amount <= 0) return;
    this.enemy.hp = Math.max(0, this.enemy.hp - amount);
    this._log(`${source} deals ${amount} to the enemy. (${this.enemy.hp}/${this.enemy.maxHP})`, 'enemy-dmg');
    if (this.enemy.hp <= 0 && this.status === 'playing') {
      this.status = 'win';
      this.phase = 'over';
      this._log('The enemy is defeated. Victory!', 'win');
      this._emit({ kind: 'defeatEnemy' });
    }
  }

  _healMember(m: Member, amount: number): number {
    if (!m.alive || amount <= 0) return 0;
    const before = m.hp;
    m.hp = Math.min(m.maxHP, m.hp + amount);
    return m.hp - before;
  }

  // Damage a member actually takes from a raw attack value, after their Defense
  // (if any). Floored at 0 so a fully-absorbed hit can't heal.
  _effectiveDamage(m: Member, raw: number): number {
    return m.defense > 0 ? Math.max(0, raw - DEFENSE_AMOUNT) : raw;
  }

  // ---- enemy phase ---------------------------------------------------------

  _runEnemyPhase(): void {
    if (this.turn === ENRAGE_TURN && !this.enemy.enraged) {
      this.enemy.enraged = true;
      this._log('The enemy ENRAGES! Its attacks grow heavier.', 'system');
      this._emit({ kind: 'enrage' });
    }

    // 1) start-of-turn status ticks: Poison -> Regen -> Refresh.
    if (this.enemy.poison > 0) {
      const dmg = this.enemy.poison;
      this._damageEnemy(dmg, `Poison (${this.enemy.poison})`);
      this._emit({ kind: 'poisonTick', amount: dmg, enemyHp: this.enemy.hp });
      this.enemy.poison -= 1;
      if (this.status === 'win') return; // poison can finish the enemy
    }
    for (const m of this.members) {
      if (m.alive && m.regen > 0) {
        const healed = this._healMember(m, m.regen);
        this._log(`${m.name} regenerates ${healed} (Regen ${m.regen}).`, 'heal');
        this._emit({ kind: 'regenTick', slot: m.slot, amount: healed, hp: m.hp });
        m.regen -= 1;
      }
    }
    if (this.refresh > 0) {
      const before = this.mp;
      this.mp = Math.min(MP_MAX, this.mp + this.refresh);
      this._log(`Refresh restores ${this.mp - before} MP. (MP ${this.mp})`, 'mp');
      this._emit({ kind: 'refreshTick', amount: this.mp - before, mp: this.mp });
      this.refresh -= 1;
    }

    // 2) the attack itself (executes the standing telegraph).
    this._resolveAttack();
    if (this.allDead()) {
      this.status = 'loss';
      this.phase = 'over';
      this._log('The whole party has fallen. Defeat.', 'loss');
      this._emit({ kind: 'wipe' });
      return;
    }

    // 3) decay per-turn buffs now that this enemy turn's attack has resolved.
    if (this.tank.alive && this.tank.taunt > 0) {
      this.tank.taunt -= 1;
      if (this.tank.taunt === 0) this._log('Taunt fades from the Tank.', 'status');
    }
    for (const m of this.members) {
      if (m.alive && m.defense > 0) {
        m.defense -= 1;
        if (m.defense === 0) this._log(`Defense fades from ${m.name}.`, 'status');
      }
    }

    // 4) telegraph the next turn's attack (with correct enrage state baked in).
    this.telegraph = this._generateTelegraph(this.turn + 1);
  }

  _resolveAttack(): void {
    const t = this.telegraph;
    if (!t) return;
    const label = t.hidden ? 'Hidden attack' : t.type === 'two' ? 'Two-target attack'
      : t.type === 'aoe' ? 'AoE attack' : 'Attack';
    for (const slot of t.targets) {
      const m = this.members[slot];
      if (!m || !m.alive) {
        this._log(`${label} whiffs on slot ${slot + 1}.`, 'whiff');
        this._emit({ kind: 'enemyAttack', slot, amount: 0, hp: 0, result: 'whiff', killed: false, hidden: t.hidden });
        continue;
      }
      if (m.shield) {
        m.shield = false;
        this._log(`${m.name}'s Shield absorbs the hit.`, 'shield');
        this._emit({ kind: 'enemyAttack', slot, amount: t.damage, hp: m.hp, result: 'shield', killed: false, hidden: t.hidden });
        continue;
      }
      const dmg = this._effectiveDamage(m, t.damage);
      m.hp = Math.max(0, m.hp - dmg);
      this._log(`${label} hits ${m.name} for ${dmg}. (${m.hp}/${m.maxHP})`, 'hit');
      const killed = m.hp <= 0;
      this._emit({ kind: 'enemyAttack', slot, amount: dmg, hp: m.hp, result: 'hit', killed, hidden: t.hidden });
      if (killed) this._killMember(m);
    }
  }

  // ---- player phase --------------------------------------------------------

  _startPlayerPhase(): void {
    // Mage charge ticks first, before the player can act.
    if (this.mage.alive) {
      this.mageCharge = Math.min(CHARGE_MAX, this.mageCharge + 1);
    }
    this._drawTo(HAND_SIZE);
    this.cardPlayedThisPhase = false;
    this.phase = 'player';
  }

  _drawOne(): CardId | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.drawPile = shuffle(this.discardPile, this.rng);
      this.discardPile = [];
      this._log('Reshuffled discard into draw pile.', 'system');
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

  // Validate whether a hand card can currently be played. Returns null if ok,
  // otherwise a short reason string.
  canPlay(handIndex: number, target: number | null): string | null {
    if (this.phase !== 'player') return 'not your phase';
    const cardId = this.hand[handIndex];
    if (cardId == null) return 'no such card';
    const card = CARDS[cardId];
    if (this.mp < card.cost) return 'not enough MP';
    switch (card.target) {
      case 'single':
      case 'ability': {
        const m = target == null ? undefined : this.members[target];
        if (!m || !m.alive) return 'target must be a living member';
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
    const cardId = this.hand[handIndex];
    const card = CARDS[cardId];
    this.mp -= card.cost;
    this.hand.splice(handIndex, 1);
    this.discardPile.push(cardId);
    this.cardPlayedThisPhase = true;

    this._applyCard(cardId, card, target);
    return { ok: true };
  }

  _applyCard(cardId: CardId, card: CardDef, target: number | null): void {
    switch (cardId) {
      case 'lowHeal':
      case 'highHeal': {
        const m = this.members[target as number];
        const healed = this._healMember(m, card.heal ?? 0);
        this._log(`${card.name}: ${m.name} heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        break;
      }
      case 'aoeHeal': {
        for (const m of this.livingMembers()) {
          const healed = this._healMember(m, card.heal ?? 0);
          this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        }
        this._log(`Group Heal: all living members heal up to ${card.heal}.`, 'heal');
        break;
      }
      case 'regen': {
        const m = this.members[target as number];
        m.regen += card.regen ?? 0;
        this._log(`Regen on ${m.name} (stack ${m.regen}).`, 'status');
        this._emit({ kind: 'regenApplied', slot: m.slot, stack: m.regen });
        break;
      }
      case 'shield': {
        const m = this.members[target as number];
        m.shield = true; // does not stack
        this._log(`Shield raised on ${m.name}.`, 'status');
        this._emit({ kind: 'shieldApplied', slot: m.slot });
        break;
      }
      case 'resurrect': {
        const m = this.members[target as number];
        m.alive = true;
        m.hp = Math.ceil(m.maxHP / 2);
        m.shield = false; m.regen = 0; m.taunt = 0; m.defense = 0;
        if (m.id === 'mage') this.mageCharge = 0;
        this._log(`${m.name} is resurrected to ${m.hp} HP.`, 'status');
        this._emit({ kind: 'resurrect', slot: m.slot, hp: m.hp });
        break;
      }
      case 'refresh': {
        this.refresh += card.refresh ?? 0;
        this._log(`Refresh primed (MP-regen stack ${this.refresh}).`, 'status');
        this._emit({ kind: 'refreshPrimed', stack: this.refresh });
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
    switch (m.ability) {
      case 'poison': {
        this.enemy.poison += POISON_BASE;
        this._log(`${m.name} fires Poison Arrow (Poison ${this.enemy.poison}).`, 'status');
        this._emit({ kind: 'poisonApplied', slot: m.slot, amount: POISON_BASE, poison: this.enemy.poison });
        break;
      }
      case 'taunt': {
        this.tank.taunt = TAUNT_TURNS;
        this.tank.defense = DEFENSE_TURNS;
        this._retargetTelegraphToTank();
        this._log(`${m.name} Taunts and braces (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'taunt', slot: m.slot, turns: TAUNT_TURNS });
        break;
      }
      case 'bolt': {
        const dmg = BOLT_BASE + this.mageCharge;
        this._log(`${m.name} casts Lightning Bolt (base ${BOLT_BASE} + Charge ${this.mageCharge}).`, 'status');
        this.mageCharge = 0;
        this._damageEnemy(dmg, 'Lightning Bolt');
        this._emit({ kind: 'bolt', slot: m.slot, amount: dmg, enemyHp: this.enemy.hp });
        break;
      }
      default:
        break;
    }
  }

  canSkip(): boolean {
    return this.phase === 'player' && !this.cardPlayedThisPhase;
  }

  // MP a rest would actually recover right now, accounting for the MP_MAX cap.
  restAmount(): number {
    return Math.min(MP_MAX, this.mp + SKIP_REGEN) - this.mp;
  }

  skipTurn(): PlayResult {
    if (!this.canSkip()) return { ok: false, reason: 'cannot skip now' };
    this.events = [];
    const before = this.mp;
    this.mp = Math.min(MP_MAX, this.mp + SKIP_REGEN);
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
    // Discard the whole hand (no Retain in the prototype).
    while (this.hand.length) this.discardPile.push(this.hand.pop() as CardId);

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
      if (!m.alive || m.damage <= 0) continue;
      this._damageEnemy(m.damage, `${m.name}`);
      this._emit({ kind: 'partyAttack', slot: m.slot, amount: m.damage, enemyHp: this.enemy.hp });
      if (this.status !== 'playing') break; // a strike can finish the enemy
    }
  }
}
