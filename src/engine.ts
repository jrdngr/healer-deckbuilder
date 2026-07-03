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
  DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, ATTACK_INTENT_NAMES,
  defaultBattleConfig, resolveCard, makeDeckCard,
} from './constants';
import type {
  Slot, AttackType, MemberId, AbilityId, BattleConfig, DeckCard, ResolvedCard, CardId,
  TauntRetargetMode, EnemyDef,
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
  regen: number;      // Regen strength: HP healed per turn while active
  regenTurns: number; // player phases of Regen remaining
  taunt: number;   // taunt turns remaining (attributed to whoever cast Taunt)
  defense: number; // Defense turns remaining: incoming hits reduced by DEFENSE_AMOUNT
  charge: number;  // per-member Charge (feeds the Bolt ability); ticks each player phase
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
  | { kind: 'refreshTick'; amount: number; mp: number }
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
  config: BattleConfig;
  enemyDef: EnemyDef; // data-driven enemy behavior (attack weights, name)
  members: Member[];
  enemy: Enemy;
  mp: number;
  maxMana: number;   // MP cap (healer stat); starting MP equals this
  handSize: number;  // cards drawn each player phase (healer stat)
  restRegen: number; // MP regained on rest (healer stat)
  passiveMp: number; // MP gained at the start of each player phase (healer stat)
  refresh: number;        // Refresh strength: MP restored per turn while active
  refreshTurns: number;   // enemy turns of Refresh remaining
  refreshRestored: number; // MP the current Refresh cast has restored so far (capped at REFRESH_MP_CAP)
  drawPile: DeckCard[];
  discardPile: DeckCard[];
  hand: DeckCard[];
  turn: number;
  phase: Phase;
  status: Status;
  cardsPlayedThisPhase: number; // cards played this player phase; drives decaying Rest (+5 at 0, +2 at 1)
  telegraph: Telegraph | null;
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

    this.members = config.party.map((p, slot): Member => {
      const d = MEMBER_DEFS[slot];
      return {
        slot: d.slot, id: d.id, name: d.name, maxHP: p.maxHP, damage: p.damage,
        ability: d.ability, abilityPower: p.abilityPower,
        hp: p.maxHP, alive: true,
        shield: false, // pending shield (blocks the next damaging instance)
        shieldTurns: 0,
        regen: 0,      // Regen strength
        regenTurns: 0, // Regen turns remaining
        taunt: 0,      // taunt turns remaining (attributed to the caster)
        defense: 0,    // Defense turns remaining
        charge: 0,     // per-member Charge
      };
    });

    this.enemy = {
      hp: config.enemy.maxHP, maxHP: config.enemy.maxHP,
      poison: 0, poisonTurns: 0, enraged: false,
    };

    this.maxMana = config.healer.maxMana;
    this.handSize = config.healer.handSize;
    this.restRegen = config.healer.restRegen;
    this.passiveMp = config.healer.passiveMp;

    this.mp = this.maxMana; // starting MP each fight equals the cap
    this.refresh = 0;       // Refresh strength
    this.refreshTurns = 0;  // Refresh turns remaining
    this.refreshRestored = 0;

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

  // Per-member attack damage — an accessor so future per-member damage modifiers
  // have a single seam.
  memberDamage(m: Member): number { return m.damage; }

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

  isEnraged(turn: number): boolean { return turn >= ENRAGE_TURN; }

  // Player-turns remaining before the enemy enrages (0 once it has). Drives the
  // enrage-countdown pip so the otherwise-invisible race is legible (flaw #2).
  turnsUntilEnrage(): number {
    if (this.enemy.enraged) return 0;
    return Math.max(0, ENRAGE_TURN - this.turn);
  }

  // Per-target damage for an attack type at a given turn (round up on enrage).
  // The enemy's per-fight attackBonus is added before the enrage multiplier.
  attackDamage(type: AttackType, turn: number): number {
    const base = ATTACK_BASE_DAMAGE[type] + this.config.enemy.attackBonus;
    return this.isEnraged(turn) ? Math.ceil(base * ENRAGE_MULT) : base;
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
    return ATTACK_INTENT_NAMES[this.telegraph.type];
  }

  _pickPrimary(type: AttackType): Slot {
    const taunter = this.tauntingMember();
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

  _generateTelegraph(turn: number): Telegraph {
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
    };
  }

  // Lines to draw for the standing telegraph. [] when the game is over / no telegraph.
  // Each entry: { slot, damage, hidden }. Hidden attacks fan out to every living
  // member with unknown (null) damage; known attacks hit their living targets.
  attackTargets(): AttackSpec[] {
    const t = this.telegraph;
    if (this.status !== 'playing' || !t) return [];
    if (t.hidden) {
      // Reveal the magnitude, hide the target: every living member shows the same
      // number as a "someone takes N" threat (flaw #11).
      return this.livingMembers().map((m): AttackSpec => ({ slot: m.slot, damage: t.damage, hidden: true }));
    }
    return t.targets
      .filter((slot) => this.members[slot]?.alive)
      .map((slot): AttackSpec => {
        const m = this.members[slot];
        const eff = this._effectiveDamage(m, t.damage);
        // A Shield blocks a damaging instance entirely, so the applied damage is
        // 0 — preview must match (telegraph == applied invariant).
        return { slot, damage: m.shield && eff > 0 ? 0 : eff, hidden: false };
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
    if (!t || t.hidden || t.type === 'aoe' || t.type === 'sweep') return false;
    return t.targets.some((s) => s !== slot && this.members[s]?.alive);
  }

  // ---- next-turn predictions (for the bar telegraphs) ----------------------
  // Pure reads of the status stacks, previewing what next turn will do so the UI
  // can paint it as coloured bar segments.

  // MP that Refresh will restore on the next enemy phase (its strength while
  // active), capped by the room left under MP_MAX.
  predictedRefresh(): number {
    if (this.refreshTurns <= 0) return 0;
    const capRoom = Math.max(0, REFRESH_MP_CAP - this.refreshRestored);
    return Math.min(this.refresh, this.maxMana - this.mp, capRoom);
  }

  // Enemy HP the next Poison tick will remove (its strength while active), capped by its HP.
  predictedPoison(): number {
    if (this.enemy.poisonTurns <= 0) return 0;
    return Math.min(this.enemy.poison, this.enemy.hp);
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
    m.shieldTurns = 0;
    m.regen = 0;
    m.regenTurns = 0;
    m.taunt = 0;
    m.defense = 0;
    m.charge = 0;
    this._log(`${m.name} has fallen!`, 'death');
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
    return false;
  }

  _healMember(m: Member, amount: number): number {
    if (!m.alive || amount <= 0) return 0;
    const before = m.hp;
    m.hp = Math.min(m.maxHP, m.hp + amount);
    return m.hp - before;
  }

  // Damage a member actually takes from a raw attack value, after their Defense
  // (if any). Floored at 0 so a fully-absorbed hit can't heal. Defense is granted
  // by the Taunt ability to whoever cast it, and that caster's abilityPower scales
  // the reduction (for the fixed trio this is always the tank).
  _effectiveDamage(m: Member, raw: number): number {
    return m.defense > 0 ? Math.max(0, raw - (DEFENSE_AMOUNT + m.abilityPower)) : raw;
  }

  // ---- enemy phase ---------------------------------------------------------

  _runEnemyPhase(): void {
    if (this.turn === ENRAGE_TURN && !this.enemy.enraged) {
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
      // A single Refresh cast restores at most REFRESH_MP_CAP MP over its lifetime,
      // so Potent/Lingering can't turn it into an unbounded MP engine (flaw #7).
      const capRoom = Math.max(0, REFRESH_MP_CAP - this.refreshRestored);
      const before = this.mp;
      this.mp = Math.min(this.maxMana, this.mp + Math.min(this.refresh, capRoom));
      const gained = this.mp - before;
      this.refreshRestored += gained;
      this._log(`Refresh restores ${gained} MP. (MP ${this.mp})`, 'mp');
      this._emit({ kind: 'refreshTick', amount: gained, mp: this.mp });
      this.refreshTurns -= 1;
      // End the cast once spent or its cap is exhausted.
      if (this.refreshTurns === 0 || this.refreshRestored >= REFRESH_MP_CAP) {
        this.refreshTurns = 0;
        this.refresh = 0;
      }
    }

    // 2) the attack itself (executes the standing telegraph). The boss is more
    // dangerous via its stronger telegraphed attack pool (heavy/sweep), not via a
    // hidden extra strike — everything it does is shown ahead of time.
    this._resolveAttack();
    if (this._checkWipe()) return;

    // 3) decay per-turn buffs now that this enemy turn's attack has resolved.
    for (const m of this.members) {
      if (m.alive && m.taunt > 0) {
        m.taunt -= 1;
        if (m.taunt === 0) this._log(`Taunt fades from ${m.name}.`, 'status');
      }
      if (m.alive && m.defense > 0) {
        m.defense -= 1;
        if (m.defense === 0) this._log(`Defense fades from ${m.name}.`, 'status');
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
    }

    // 4) telegraph the next turn's attack (with correct enrage state baked in).
    this.telegraph = this._generateTelegraph(this.turn + 1);
  }

  // Resolve an enemy attack. Defaults to the standing telegraph, but the boss's
  // second action passes a freshly generated (untelegraphed) one.
  _resolveAttack(t: Telegraph | null = this.telegraph): void {
    if (!t) return;
    const label = t.hidden ? 'Hidden attack' : t.type === 'two' ? 'Two-target attack'
      : t.type === 'aoe' ? 'AoE attack' : t.type === 'heavy' ? 'Heavy attack'
      : t.type === 'sweep' ? 'Sweeping attack' : 'Attack';
    for (const slot of t.targets) {
      const m = this.members[slot];
      if (!m || !m.alive) {
        this._log(`${label} whiffs on slot ${slot + 1}.`, 'whiff');
        this._emit({ kind: 'enemyAttack', slot, amount: 0, hp: 0, result: 'whiff', killed: false, hidden: t.hidden });
        continue;
      }
      const dmg = this._effectiveDamage(m, t.damage);
      // A Shield only spends on a *damaging* instance — a fully-mitigated (0-damage)
      // hit passes through harmlessly and leaves the Shield up.
      if (m.shield && dmg > 0) {
        m.shield = false;
        m.shieldTurns = 0;
        this._log(`${m.name}'s Shield absorbs the hit.`, 'shield');
        this._emit({ kind: 'enemyAttack', slot, amount: t.damage, hp: m.hp, result: 'shield', killed: false, hidden: t.hidden });
        continue;
      }
      m.hp = Math.max(0, m.hp - dmg);
      this._log(`${label} hits ${m.name} for ${dmg}. (${m.hp}/${m.maxHP})`, 'hit');
      const killed = m.hp <= 0;
      this._emit({ kind: 'enemyAttack', slot, amount: dmg, hp: m.hp, result: 'hit', killed, hidden: t.hidden });
      if (killed) this._killMember(m);
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
        if (m.regenTurns === 0) m.regen = 0;
      }
    }
    // Passive MP income (healer upgrade) lands at the start of the player phase.
    if (this.passiveMp > 0 && this.mp < this.maxMana) {
      const before = this.mp;
      this.mp = Math.min(this.maxMana, this.mp + this.passiveMp);
      this._log(`Passive regen restores ${this.mp - before} MP. (MP ${this.mp})`, 'mp');
      this._emit({ kind: 'refreshTick', amount: this.mp - before, mp: this.mp });
    }
    // Per-member Charge ticks before the player can act (only the Bolt ability
    // consumes it today, so for the trio this is effectively the mage's charge).
    for (const m of this.members) {
      if (m.alive) m.charge = Math.min(CHARGE_MAX, m.charge + 1);
    }
    this._drawTo(this.handSize);
    this.cardsPlayedThisPhase = 0;
    this.phase = 'player';
  }

  _drawOne(): DeckCard | null {
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
    const dc = this.hand[handIndex];
    if (dc == null) return 'no such card';
    const card = resolveCard(dc);
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
    const dc = this.hand[handIndex];
    const card = resolveCard(dc);
    this.mp -= card.cost;
    this.hand.splice(handIndex, 1);
    this.discardPile.push(dc);
    this.cardsPlayedThisPhase += 1;

    this._applyCard(card, target);
    return { ok: true };
  }

  _applyCard(card: ResolvedCard, target: number | null): void {
    switch (card.id) {
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
        this._log(`Shield raised on ${m.name} (fades in ${SHIELD_TURNS} enemy turns).`, 'status');
        this._emit({ kind: 'shieldApplied', slot: m.slot });
        break;
      }
      case 'resurrect': {
        const m = this.members[target as number];
        m.alive = true;
        m.hp = Math.ceil(m.maxHP / 2);
        m.shield = false; m.shieldTurns = 0; m.regen = 0; m.regenTurns = 0; m.taunt = 0; m.defense = 0; m.charge = 0;
        this._log(`${m.name} is resurrected to ${m.hp} HP.`, 'status');
        this._emit({ kind: 'resurrect', slot: m.slot, hp: m.hp });
        break;
      }
      case 'refresh': {
        // Re-applying refreshes the duration and keeps the stronger value (no stacking),
        // and resets the per-cast MP cap so a fresh cast gets its full REFRESH_MP_CAP.
        this.refresh = Math.max(this.refresh, card.refresh ?? 0);
        this.refreshTurns = card.refreshTurns;
        this.refreshRestored = 0;
        this._log(`Refresh primed (${this.refresh} MP/turn for ${this.refreshTurns}).`, 'status');
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
        const strength = POISON_BASE + m.abilityPower;
        // Re-applying refreshes the duration and keeps the stronger value (no stacking).
        this.enemy.poison = Math.max(this.enemy.poison, strength);
        this.enemy.poisonTurns = POISON_TURNS;
        this._log(`${m.name} fires Poison Arrow (${this.enemy.poison}/turn for ${this.enemy.poisonTurns}).`, 'status');
        this._emit({ kind: 'poisonApplied', slot: m.slot, amount: strength, poison: this.enemy.poison });
        break;
      }
      case 'taunt': {
        // Taunt and its bundled Defense are attributed to the caster, not a slot.
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
        const base = BOLT_BASE + m.abilityPower;
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
    // Discard the hand from the end (same ordering the prototype used, so existing
    // seeds reshuffle identically), keeping any Retain cards in hand for next phase.
    const kept: DeckCard[] = [];
    while (this.hand.length) {
      const dc = this.hand.pop() as DeckCard;
      if (resolveCard(dc).retain) kept.push(dc);
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
      const dmg = this.memberDamage(m);
      if (!m.alive || dmg <= 0) continue;
      const killed = this._damageEnemy(dmg, `${m.name}`);
      this._emit({ kind: 'partyAttack', slot: m.slot, amount: dmg, enemyHp: this.enemy.hp });
      if (killed) this._emit({ kind: 'defeatEnemy' });
      if (this.status !== 'playing') break; // a strike can finish the enemy
    }
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
      if (needsLiving) t = this.members.find((m) => m.alive)?.slot ?? null;
      else if (card.target === 'dead') t = this.members.find((m) => !m.alive)?.slot ?? null;
    }
    // Bail if a slot-targeted card has no valid target available.
    if ((needsLiving || card.target === 'dead') && t == null) return;
    this._applyCard(card, t);
  }
}
