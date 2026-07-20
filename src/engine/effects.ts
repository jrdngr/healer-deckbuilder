// Card- and ability-effect method bodies for Game, split out of core.ts to keep
// that file navigable. Attached to the prototype (every Game member is public, so
// `this` reaches them). index.ts side-imports this so the augmentation always runs.
import { Game } from './core';
import type { Member } from './core';
import {
  HEX_TURNS, HEX_VULN_BY_SIZE, HEX_VULN_PER_POWER, CRESCENDO_DRAW,
  RAMPAGE_SELF_DMG, BOAR_HP, BOAR_TURNS, BOAR_STRIKE_BONUS,
  TWIN_SHOT_HITS, CONC_VENOM_MULT, SHIELD_WALL_DEFENSE, SHIELD_WALL_TURNS,
  HOLD_LINE_DEFENSE, HOLD_LINE_TURNS, ARCANE_SURGE_CHARGE, DRAIN_LIFE_DMG,
  DOOM_DELAY, SACRIFICE_HP, SACRIFICE_DMG, SACRIFICE_POWER,
  FINALE_MULT, BLOODBATH_PER_MISSING, WHIRLWIND_HITS, SIC_EM_MULT,
  MEND_BEAST_HEAL, BIG_TOP_TURNS, LUNGE_MULT, LUNGE_TAUNT_TURNS,
  FLURRY_HITS, FLURRY_REDUCTION, STRONGEST_HP, DEADLIFT_TURNS,
  BOLT_BASE, BOLT_CHARGE_MULT, CHARGE_MAX, POISON_BASE,
  POISON_TURNS, TAUNT_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS,
  EN_GARDE_TURNS, PENANCE_HP, PENANCE_STRIKE_BONUS, PENANCE_STRIKE_TURNS,
  CARDS, TAUNT_RETARGET_SURCHARGE, VENOM_GLAND_BONUS_TURNS
} from '../constants';
import type {
  Slot, AttackType, MemberId, AbilityId, BattleConfig, DeckCard, ResolvedCard, CardId,
  TauntRetargetMode, EnemyDef, RotationStep, RotationEntry, CastKind, RelicId, CardType,
} from '../constants';
import { makeRng, shuffle, weightedPick } from '../rng';
// Content dispatch (#101). The engine imports content; content imports only TYPES back
// from the engine, so this direction is the acyclic one.
import { CARD_ACTIONS, NATIVES, runActions } from '../content';

declare module './core' {
  interface Game {
    _applyCard(card: ResolvedCard, target: number | null): void;
    _fireAbility(m: Member, target?: number | null, ability?: AbilityId): void;
  }
}

Game.prototype._applyCard = function (card, target) {
    // Per-member ability cards (#44): fire the bound member's ability. canPlay has
    // already ensured a living carrier exists (devPlayCard tolerates its absence).
    if (card.ability != null) {
      const m = this._abilityMember(card.ability);
      // En Garde (#74) is the first target 'single' ability card — the chosen member
      // receives the stance. Every other ability is target 'none' and ignores `target`.
      // Fire the CARD's ability (which may be a learned one), not the member's signature.
      if (m) this._fireAbility(m, target, card.ability);
      return;
    }
    // Channeled cards (#64): start a channel (first tick immediate) rather than a
    // one-shot effect. Playing this card already cancelled any prior channel in
    // playCard; _startChannel additionally replaces a still-running one.
    if (CARDS[card.id].channel != null) {
      this._startChannel(card, target);
      return;
    }
    // Every card effect is data (#101). cards.json holds the action list; the
    // interpreter runs it. A card with no actions is a content bug, not a silent
    // no-op — the old switch's `default: break` hid exactly that.
    const contentActions = CARD_ACTIONS[card.id];
    if (contentActions) {
      runActions(this, contentActions, { card, target, vars: {} }, NATIVES);
      return;
    }
    this._log(`${card.name} has no effect defined.`, 'system');
};

Game.prototype._fireAbility = function (m, target = null, ability = m.ability) {
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
    // Switch on the ability being FIRED (a learned card's, or the signature by default),
    // not the member's signature — one hero can now fire several abilities.
    switch (ability) {
      case 'poison': {
        // Floored at 1: a Broken member (DR1) can carry negative abilityPower, but
        // an ability never resolves to 0-or-below damage.
        const strength = Math.max(1, POISON_BASE + m.abilityPower);
        // Re-applying refreshes the duration and keeps the stronger value (no stacking).
        // Venom Gland (#67) extends the window by VENOM_GLAND_BONUS_TURNS at apply time,
        // like every poison application (Sporeburst rides the same bonus in _applyPoison).
        this.enemy.poison = Math.max(this.enemy.poison, strength);
        this.enemy.poisonTurns = POISON_TURNS + (this.hasRelic('venomGland') ? VENOM_GLAND_BONUS_TURNS : 0);
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
        // Floored at 1 (DR1): see the poison note — a Broken member still bolts for
        // at least its Charge scaling.
        const base = Math.max(1, BOLT_BASE + m.abilityPower);
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
        this._log(`${m.name} gives the enemy the Evil Eye — +${Math.round(vuln * 100)}% damage taken for ${HEX_TURNS} turns.`, 'status');
        break;
      }
      case 'crescendo': {
        // The Busker (#27) draws CRESCENDO_DRAW cards; the Ability card that fired it
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
        // The Showstopper (#61) Stuns the enemy: flag the standing telegraph as
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
      case 'enGarde': {
        // The Duelist (#74) Provokes a CHOSEN member (Taunt — the enemy aims at them) and
        // grants them the persistent Riposte stance for EN_GARDE_TURNS enemy turns. Target
        // 'single', so `target` is the picked slot (canPlay's 'single' branch already
        // validated a living member); it defaults to the Duelist herself if unset.
        // Recasting refreshes the duration (no stacking).
        const holder = (target != null && this.members[target]?.alive) ? this.members[target] : m;
        holder.taunt = EN_GARDE_TURNS;
        holder.riposteTurns = EN_GARDE_TURNS;
        this._log(`${m.name} sets ${holder === m ? 'her own' : `${holder.name}'s`} guard — En Garde: ${holder.name} Provokes and counters every hit for ${EN_GARDE_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'taunt', slot: holder.slot, turns: EN_GARDE_TURNS });
        this._emit({ kind: 'enGarde', slot: holder.slot, turns: EN_GARDE_TURNS });
        break;
      }
      case 'penance': {
        // The Strongman (#75) pays PENANCE_HP — NO clamp; this is the SOLE Blood effect
        // that can kill him. Order is payment -> death check -> buff (per the design):
        //   1) drain via _drainMember (unclamped): at <= PENANCE_HP HP it empties him and
        //      runs the FULL standard death pipeline — Martyr's Icon may veto it (survive at
        //      1 HP), else scars/deadMemberIds/incapacitate rules all apply and the wipe is
        //      re-checked. At 5+ HP he simply survives at HP - PENANCE_HP.
        //   2) buff EVERY living member's auto +PENANCE_STRIKE_BONUS this turn — a global
        //      one-phase field, so it lands whether or not he died (him included only if he
        //      is still alive, since a dead member takes no auto). It ADDS to Battle Hymn /
        //      Blood Banner / Sanguine / Hex (its own field; see memberDamage).
        // Sanguine Pact's surcharge rides this ability-card blood cost too (scope call
        // documented on PENANCE_HP): the payment is PENANCE_HP + the surcharge.
        const cost = PENANCE_HP + this._sanguineSurcharge();
        this._drainMember(m, cost);
        const died = !m.alive;
        // The buff now lasts 2 enemy turns (was cast-turn only): penanceBonus is the
        // standing +auto and penanceTurns its timer, decremented on the enemy phase.
        this.penanceBonus = Math.max(this.penanceBonus, PENANCE_STRIKE_BONUS);
        this.penanceTurns = PENANCE_STRIKE_TURNS;
        this._log(died
          ? `${m.name} gives everything for one last Feat of Strength. Every living member's auto deals +${PENANCE_STRIKE_BONUS} for ${PENANCE_STRIKE_TURNS} enemy turns.`
          : `${m.name} strains himself (-${cost} HP) — Feat of Strength: every living member's auto deals +${PENANCE_STRIKE_BONUS} for ${PENANCE_STRIKE_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'penance', slot: m.slot, bonus: PENANCE_STRIKE_BONUS, died,
          slots: this.livingMembers().map((x) => x.slot) });
        break;
      }
      // ---- learned ability cards (Training Dojo, 2026-07) --------------------
      case 'twinShot': {
        // The Ranger looses two arrows — each is a full auto (Toxicologist rides each).
        for (let i = 0; i < TWIN_SHOT_HITS; i++) {
          if (this._strikeEnemy(m, this.memberDamage(m), `${m.name} (Twin Shot)`)) break;
        }
        break;
      }
      case 'concVenom': {
        // Double the enemy's current Poison-per-turn (duration unchanged); a no-op unpoisoned.
        if (this.enemy.poisonTurns > 0) {
          this.enemy.poison *= CONC_VENOM_MULT;
          this._log(`${m.name} concentrates the venom — Poison ${this.enemy.poison}/turn.`, 'status');
          this._emit({ kind: 'poisonApplied', slot: m.slot, amount: this.enemy.poison, poison: this.enemy.poison });
        } else {
          this._log(`${m.name} finds no venom to concentrate.`, 'status');
        }
        break;
      }
      case 'shieldWall': {
        // Every living member braces (keep the stronger of any standing Defense).
        for (const x of this.livingMembers()) {
          x.defenseAmount = x.defense > 0 ? Math.max(x.defenseAmount, SHIELD_WALL_DEFENSE) : SHIELD_WALL_DEFENSE;
          x.defense = Math.max(x.defense, SHIELD_WALL_TURNS);
          this._emit({ kind: 'defenseApplied', slot: x.slot, amount: SHIELD_WALL_DEFENSE });
        }
        this._log(`${m.name} raises a Shield Wall — the party braces (Defense ${SHIELD_WALL_DEFENSE} for ${SHIELD_WALL_TURNS} turns).`, 'status');
        break;
      }
      case 'holdLine': {
        // The Tank digs in (Defense) and opens a window where his Grudge banks double.
        m.defenseAmount = m.defense > 0 ? Math.max(m.defenseAmount, HOLD_LINE_DEFENSE) : HOLD_LINE_DEFENSE;
        m.defense = Math.max(m.defense, HOLD_LINE_TURNS);
        m.holdLineTurns = HOLD_LINE_TURNS;
        this._emit({ kind: 'defenseApplied', slot: m.slot, amount: HOLD_LINE_DEFENSE });
        this._log(`${m.name} holds the line (Defense ${HOLD_LINE_DEFENSE}) — the blows he soaks now bank double for Grudge.`, 'status');
        break;
      }
      case 'arcaneSurge': {
        // Instant Charge for the Mage — fuels a huge next Bolt.
        m.charge = Math.min(CHARGE_MAX, m.charge + ARCANE_SURGE_CHARGE);
        this._log(`${m.name} surges with arcane power — Charge ${m.charge}.`, 'status');
        break;
      }
      case 'drainLife': {
        // Deal DRAIN_LIFE_DMG (Vulnerability scales it), then heal the most-wounded living
        // member for the damage actually dealt (post-Vulnerability lifesteal).
        const dealt = this.vulnerableAmount(DRAIN_LIFE_DMG + m.abilityPower);
        const killed = this._damageEnemy(DRAIN_LIFE_DMG + m.abilityPower, `${m.name} (Drain Life)`);
        this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: dealt, enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        const wounded = this.livingMembers().reduce((a, b) => (b.maxHP - b.hp) > (a.maxHP - a.hp) ? b : a, m);
        const res = this._applyHeal(wounded, dealt, true);
        if (res.healed > 0) this._emit({ kind: 'heal', slot: wounded.slot, amount: res.healed, hp: wounded.hp });
        break;
      }
      case 'doom': {
        // Curse the enemy: it detonates after DOOM_DELAY enemy turns (see _runEnemyPhase).
        // Recasting refreshes the countdown.
        this.enemy.doomTurns = DOOM_DELAY;
        this._log(`${m.name} pronounces Doom — the enemy is struck in ${DOOM_DELAY} turns.`, 'status');
        break;
      }
      case 'sacrifice': {
        // A chosen ally bleeds (clamped to leave 1 HP); the Warlock grows for the fight.
        const ally = (target != null && this.members[target]?.alive) ? this.members[target] : m;
        this._bloodPay(ally, SACRIFICE_HP);
        m.damage += SACRIFICE_DMG;
        m.abilityPower += SACRIFICE_POWER;
        this._log(`${m.name} sacrifices ${ally === m ? 'his own' : `${ally.name}'s`} blood — +${SACRIFICE_DMG} damage, +${SACRIFICE_POWER} power for the fight.`, 'status');
        break;
      }
      case 'finale': {
        // The Busker's big number: FINALE_MULT× his current cards-played auto.
        this._strikeEnemy(m, FINALE_MULT * this.memberDamage(m), `${m.name} (Finale)`);
        break;
      }
      case 'duet': {
        // A chosen other member makes an immediate bonus auto-attack.
        const partner = (target != null && this.members[target]?.alive) ? this.members[target] : m;
        this._strikeEnemy(partner, this.memberDamage(partner), `${partner.name} (Duet)`);
        break;
      }
      case 'bloodbath': {
        // The Berserker strikes for his MISSING HP — bigger the more hurt he is.
        const missing = Math.max(0, m.maxHP - m.hp);
        this._strikeEnemy(m, missing * BLOODBATH_PER_MISSING + m.abilityPower, `${m.name} (Bloodbath)`);
        break;
      }
      case 'whirlwind': {
        // Strike WHIRLWIND_HITS×, plus a third while in his hottest rage band.
        const times = m.hp <= this.berserkerThresholds()[1] ? WHIRLWIND_HITS + 1 : WHIRLWIND_HITS;
        for (let i = 0; i < times; i++) {
          if (this._strikeEnemy(m, this.memberDamage(m), `${m.name} (Whirlwind)`)) break;
        }
        break;
      }
      case 'sicEm': {
        // The Boar lunges (canPlay's needsBoar gate guarantees one is out).
        this._strikeEnemy(m, SIC_EM_MULT * BOAR_STRIKE_BONUS + m.abilityPower, `${m.name}'s Boar (Sic 'Em)`);
        break;
      }
      case 'mendBeast': {
        // Heal the Boar and extend its stay (needsBoar-gated).
        m.boarHp += MEND_BEAST_HEAL;
        m.boarTurns += 1;
        this._log(`${m.name} mends her Boar (${m.boarHp} HP, ${m.boarTurns} turns).`, 'status');
        this._emit({ kind: 'boarSummon', slot: m.slot, hp: m.boarHp, turns: m.boarTurns });
        break;
      }
      case 'standingOvation': {
        // Every living member's next attack lands doubled (reuses the drum-primed one-shot).
        for (const x of this.livingMembers()) x.drumPrimed = true;
        this._log(`${m.name} brings the house down — every member's next strike lands doubled!`, 'status');
        break;
      }
      case 'bigTop': {
        // A one-turn party-wide DR aura (read in _effectiveDamage, decays in _decayBuffs).
        this.bigTopTurns = Math.max(this.bigTopTurns, BIG_TOP_TURNS);
        this._log(`${m.name} raises the big top — the party takes less from every hit next turn.`, 'status');
        break;
      }
      case 'lunge': {
        // Strike LUNGE_MULT× and Provoke (she taunts the enemy onto herself).
        this._strikeEnemy(m, LUNGE_MULT * this.memberDamage(m), `${m.name} (Lunge)`);
        m.taunt = Math.max(m.taunt, LUNGE_TAUNT_TURNS);
        this._emit({ kind: 'taunt', slot: m.slot, turns: LUNGE_TAUNT_TURNS });
        break;
      }
      case 'flurry': {
        // FLURRY_HITS reduced strikes (each auto − FLURRY_REDUCTION, min 1).
        const each = Math.max(1, this.memberDamage(m) - FLURRY_REDUCTION);
        for (let i = 0; i < FLURRY_HITS; i++) {
          if (this._strikeEnemy(m, each, `${m.name} (Flurry)`)) break;
        }
        break;
      }
      case 'strongest': {
        // Pay STRONGEST_HP (NO clamp — Last Stand can catch a lethal payment), then every
        // living member's next auto lands doubled. Order: pay -> (death pipeline) -> buff.
        this._drainMember(m, STRONGEST_HP);
        for (const x of this.livingMembers()) x.drumPrimed = true;
        this._log(`${m.name} shows the world his strength — every member's next strike lands doubled!`, 'status');
        break;
      }
      case 'deadlift': {
        // Hoist a chosen ally clear — untargetable for the next enemy turn.
        const lifted = (target != null && this.members[target]?.alive) ? this.members[target] : m;
        lifted.untargetable = Math.max(lifted.untargetable, DEADLIFT_TURNS);
        this._log(`${m.name} hoists ${lifted === m ? 'himself' : lifted.name} clear — out of reach next turn.`, 'status');
        break;
      }
      default:
        break;
    }
    // Restore the base abilityPower after an Empowered cast (#62) — the bonus was
    // spent by the ability above; the member's persistent power is unchanged.
    if (empower > 0) m.abilityPower -= empower;
};
