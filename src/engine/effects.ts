// Card- and ability-effect method bodies for Game, split out of core.ts to keep
// that file navigable. Attached to the prototype (every Game member is public, so
// `this` reaches them). index.ts side-imports this so the augmentation always runs.
import { Game } from './core';
import type { Member } from './core';
import {
  MEMBER_DEFS, MEMBER_POOL, ATTACK_BASE_DAMAGE, SLOT_WEIGHTS,
  HEX_TURNS, HEX_VULN_BY_SIZE, HEX_VULN_PER_POWER,
  SMALL_PARTY_MAX, LONE_WOLF_DMG, FOCUS_STONE_MP, WARBAND_HP_PER_SEAT,
  RALLY_DMG_PER_SEAT, FOCUS_HEAL, FOCUS_SMALL_BONUS, CHANNEL_MP,
  SKALD_DMG_PER_CARD, SKALD_DMG_CAP, CRESCENDO_DRAW,
  BERSERKER_BAND1_HP, BERSERKER_BAND2_HP, BERSERKER_BAND_BONUS, RAMPAGE_SELF_DMG, GRAVE_CHILL_REDUCTION,
  BOAR_HP, BOAR_TURNS, BOAR_STRIKE_BONUS,
  TWIN_SHOT_HITS, CONC_VENOM_MULT, SHIELD_WALL_DEFENSE, SHIELD_WALL_TURNS, HOLD_LINE_DEFENSE, HOLD_LINE_TURNS,
  ARCANE_SURGE_CHARGE, DRAIN_LIFE_DMG, DOOM_DELAY, SACRIFICE_HP, SACRIFICE_DMG, SACRIFICE_POWER,
  FINALE_MULT, BLOODBATH_PER_MISSING, WHIRLWIND_HITS, SIC_EM_MULT, MEND_BEAST_HEAL, BIG_TOP_TURNS,
  LUNGE_MULT, LUNGE_TAUNT_TURNS, FLURRY_HITS, FLURRY_REDUCTION, STRONGEST_HP, DEADLIFT_TURNS,
  ENRAGE_TURN, ENRAGE_MULT, BOLT_BASE, BOLT_CHARGE_MULT, CHARGE_MAX,
  POISON_BASE, POISON_TURNS, FERMENT_TURNS, FERMENT_GROWTH,
  TAUNT_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS, SHIELD_TURNS, SLOT,
  TAUNT_LITE_TURNS, TAUNT_LITE_DEFENSE,
  GUARD_DR, GUARD_TURNS, SHARPEN_BONUS, SHARPEN_TURNS,
  EMBOLDEN_BONUS, EMBOLDEN_TURNS, EMPOWER_BONUS, EN_GARDE_TURNS, PENANCE_HP, PENANCE_STRIKE_BONUS, PENANCE_STRIKE_TURNS, RADIANCE_HEAL,
  SHADOW_BOLT_DMG, SIPHON_LIFE_DMG, SIPHON_LIFE_HEAL,
  DOOM_BASE, DOOM_PER_DEBUFF, DOOM_PER_VULN, DOOM_CAP, cardType,
  HOLY_RELIC_HEAL, SHADOW_RELIC_DMG, IRON_RELIC_DISCOUNT,
  CASCADE_DISCOUNT_PER_ARCANE, NIGHTFALL_BASE, NIGHTFALL_PER_SHADOW, NIGHTFALL_CAP,
  CARDS,
  DRAIN_DMG, DRAIN_MP_MIN, DRAIN_MP_MAX, REFRESH_CHANNEL_MP, MENDING_STREAM_HEAL,
  SAP_VULN_PER_TICK, SAP_VULN_CAP, SAP_VULN_TURNS,
  DEFAULT_TAUNT_RETARGET_MODE, TAUNT_RETARGET_SURCHARGE,
  SKIP_REGEN_DECAYED, REFRESH_MP_CAP,
  CULTIVATE_STRENGTH, BLOOM_HEAL_PER_TURN,
  LIFEBLOOM_BURST, HYMN_BONUS, BARRIER_TURNS, BLOOD_TITHE_MP, GRIM_HARVEST_DMG,
  PHALANX_DEFENSE, PHALANX_TURNS, BRACE_AMOUNT, BRACE_TURNS,
  ANVIL_STANCE_BONUS, INTERLOCK_GUARD_DR, INTERLOCK_GUARD_TURNS, BULWARK_BRACE_TURNS, WHETSTONE_BONUS,
  THORNSKIN_REDUCTION, SPOREBURST_POISON, OSSUARY_REGEN, OSSUARY_THRESHOLD,
  UMBRAL_FEAST_PER_EFFECT, DREAD_WHISPER_REDUCTION, VENOM_GLAND_BONUS_TURNS, EMBERMARK_DMG,
  CRIMSON_PACT_DRAW, SCARLET_WARD_HP, OPEN_VEINS_DMG, TRANSFUSION_HEAL,
  BLOOD_BANNER_HP, BLOOD_BANNER_BONUS, BLOOD_BANNER_TURNS,
  GRIMOIRE_DMG, SANGUINE_PACT_SURCHARGE, SANGUINE_PACT_AUTO_BONUS, SANGUINE_PACT_THRESHOLD,
  BENEDICTION_HEAL, BENEDICTION_PER_BUFF, SUNRISE_VIGIL_HEAL,
  CONSECRATION_HEAL, CONSECRATION_STRIKE_BONUS, CONSECRATION_STRIKE_TURNS,
  ABSOLUTION_HEAL, ROOTBIND_BONUS_TURNS, BEACON_DRAW, TWIN_CENSER_SPLASH,
  PILGRIM_FLASK_HEAL,
  TITHE_CANDLE_MP, TITHE_CANDLE_FIGHT_CAP, FIELD_TRIAGE_BONUS, FIELD_TRIAGE_THRESHOLD,
  GROUNDING_ROD_REDUCTION, PRAYER_BEADS_MP, STORMGLASS_MIN_HIT, VANGUARD_BONUS,
  WARD_MAX, TAPER_MAX_COST, TAPER_DISCOUNT, DUSK_CHIME_MIN, PACT_PASSIVE_MP,
  CRACKED_HOURGLASS_ENRAGE, HOURGLASS_POWER_BONUS, RUSTY_CROWN_ATTACK,
  isEngineCard,
  WOUND_TURNS, WOUND_HEAL_FACTOR, SIPHON_AMOUNT,
  DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, ATTACK_INTENT_NAMES,
  defaultBattleConfig, resolveCard, makeDeckCard,
} from '../constants';
import type {
  Slot, AttackType, MemberId, AbilityId, BattleConfig, DeckCard, ResolvedCard, CardId,
  TauntRetargetMode, EnemyDef, RotationStep, RotationEntry, CastKind, RelicId, CardType,
} from '../constants';
import { makeRng, shuffle, weightedPick } from '../rng';

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
    switch (card.id) {
      case 'lowHeal':
      case 'highHeal': {
        const m = this.members[target as number];
        const amount = (card.heal ?? 0) + this._holyHealBonus(card);
        const healed = this._healMember(m, amount, true);
        this._log(`${card.name}: ${m.name} heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        this._healCardSplash(m, amount); // #69 Twin Censer + #70 Arcane Lens
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
      // --- Holy board-state payoffs (#69) -------------------------------------
      case 'sunriseVigil': {
        // Queue a delayed party heal — it fires at the START of the next player phase
        // (after the Regen tick, before the draw; see _startPlayerPhase). Each cast
        // queues its own entry, so casting twice this turn heals twice next turn.
        this.delayedStartEffects.push({ kind: 'sunriseVigil' });
        this._log(`Special Delivery scheduled — every living member heals ${SUNRISE_VIGIL_HEAL} at the start of your next turn.`, 'status');
        break;
      }
      case 'consecration': {
        // Heal the whole party a little; then members at FULL HP afterward turn the
        // surplus into offense — a standing +auto (shares the strike field with Sharpen).
        const bonus = this._holyHealBonus(card);
        for (const m of this.livingMembers()) {
          const healed = this._healMember(m, (card.heal ?? CONSECRATION_HEAL) + bonus, true);
          this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        }
        const atFullSlots: Slot[] = [];
        for (const m of this.livingMembers()) {
          if (m.hp >= m.maxHP) {
            m.strikeBonus = Math.max(m.strikeTurns > 0 ? m.strikeBonus : 0, CONSECRATION_STRIKE_BONUS);
            m.strikeTurns = CONSECRATION_STRIKE_TURNS;
            atFullSlots.push(m.slot);
          }
        }
        this._log(`Glow Up: the party heals ${card.heal ?? CONSECRATION_HEAL}; ${atFullSlots.length} at full HP strike +${CONSECRATION_STRIKE_BONUS} for ${CONSECRATION_STRIKE_TURNS} enemy turns.`, 'heal');
        if (atFullSlots.length > 0) this._emit({ kind: 'hymn', bonus: CONSECRATION_STRIKE_BONUS, slots: atFullSlots });
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
        this._log(`Shield raised on ${m.name} (fades in ${SHIELD_TURNS} enemy turns).`, 'status');
        this._emit({ kind: 'shieldApplied', slot: m.slot });
        break;
      }
      case 'resurrect': {
        const m = this.members[target as number];
        m.alive = true;
        m.hp = Math.ceil(m.maxHP / 2);
        m.regen = 0; m.bloomBurst = 0;
        m.taunt = 0; m.defense = 0; m.defenseAmount = 0; m.charge = 0; m.drumPrimed = false;
        m.strikeBonus = 0; m.strikeTurns = 0; m.guardDR = 0; m.guardTurns = 0; // #62 buffs cleared on revive
        m.empowerBonus = 0; m.riposte = false; m.riposteTurns = 0; // Riposte / En Garde stance cleared on revive
        // Reworked (#18): 6 MP -> 4, revive to 50% max HP. (The return-behind-a-Shield
        // rider was removed in the content-cut pass.)
        this._log(`${m.name} is resurrected to ${m.hp} HP.`, 'status');
        this._emit({ kind: 'resurrect', slot: m.slot, hp: m.hp });
        break;
      }
      case 'fontOfMana': {
        // Font of Mana (#15) is the buff-style MP engine (Refresh is now a channel,
        // #64). Re-applying refreshes the duration and keeps the stronger value (no
        // stacking), and resets the per-cast MP total; the cap is the JUST-CAST card's
        // designed lifetime, so no cast can ever restore more than its own card allows.
        this.refresh = Math.max(this.refresh, card.refresh ?? 0);
        this.refreshTurns = card.refreshTurns;
        this.refreshRestored = 0;
        this.refreshCap = card.refreshCap;
        this._log(`${card.name} primed (${this.refresh} MP/turn for ${this.refreshTurns}).`, 'status');
        this._emit({ kind: 'refreshPrimed', stack: this.refresh });
        break;
      }
      case 'bloom': {
        const m = this.members[target as number];
        // Consume the Regen: heal its full remaining amount at once (magnitude == the
        // Regen value, #52), then it's gone.
        const healed = this._healMember(m, m.regen, true);
        m.regen = 0;
        this._log(`Bloom consumes ${m.name}'s Regen: heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        // Consuming the Regen is one of its end conditions: Lifebloom burst + Deep
        // Roots fire, and the Thornskin mark is cleared (#66).
        this._onRegenEnded(m, true);
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
        this._log(`${card.name}: drew ${drawn} card${drawn === 1 ? '' : 's'}.`, 'status');
        this._emit({ kind: 'draw', count: drawn });
        break;
      }
      case 'arcaneLens': {
        // Arm a one-shot turn flag (mirrors Surge's next-card flag, #16): the next
        // single-target heal this turn also heals the most wounded OTHER member for the
        // full amount (see _lensSplash). Unconsumed, it fizzles at end of turn.
        this.lensArmed = true;
        this._log('Arcane Lens: your next single-target heal also refracts to the most wounded ally.', 'status');
        this._emit({ kind: 'lensArmed' });
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
      case 'battleHymn': {
        // No stacking — re-singing it in the same phase keeps the stronger bonus.
        this.hymnBonus = Math.max(this.hymnBonus, HYMN_BONUS);
        this._log(`Fight Song: every living member's attack deals +${this.hymnBonus} this turn.`, 'status');
        this._emit({ kind: 'hymn', bonus: this.hymnBonus, slots: this.livingMembers().map((x) => x.slot) });
        break;
      }
      case 'barrier': {
        // A mass Shield with a 1-enemy-phase fuse (the strict case of the #02
        // expiry rule). Never downgrades a longer-lived Shield already standing.
        for (const m of this.livingMembers()) {
          m.shield = true;
          m.shieldTurns = Math.max(m.shieldTurns, BARRIER_TURNS);
          this._emit({ kind: 'shieldApplied', slot: m.slot });
        }
        this._log('Barrier: every living member gains a Shield (fades after the next enemy phase).', 'status');
        break;
      }
      case 'bloodTithe': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        const before = this.mp;
        this.mp = Math.min(this.maxMana, this.mp + BLOOD_TITHE_MP);
        this._log(`Elbow Grease: ${m.name} pays ${paid} HP; ${this.mp - before} MP restored. (MP ${this.mp})`, 'mp');
        this._emit({ kind: 'refreshTick', amount: this.mp - before, mp: this.mp });
        break;
      }
      case 'martyrsGift': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        for (const other of this.livingMembers()) {
          if (other.slot === m.slot) continue;
          const healed = this._healMember(other, card.heal ?? 0, true);
          this._emit({ kind: 'heal', slot: other.slot, amount: healed, hp: other.hp });
        }
        this._log(`Helping Hand: ${m.name} pays ${paid} HP; the others heal up to ${card.heal}.`, 'heal');
        break;
      }
      // --- Blood + cycling (#68): HP as a spendable resource -------------------
      case 'crimsonPact': {
        // Pay HP, then draw through the normal draw path — a reshuffle mid-draw fires
        // Fidget Beads / Grimoire (like Inspiration, but priced in HP).
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        const before = this.hand.length;
        for (let i = 0; i < (card.draw ?? CRIMSON_PACT_DRAW); i++) {
          const c = this._drawOne();
          if (c == null) break; // draw and discard both empty
          this.hand.push(c);
        }
        const drawn = this.hand.length - before;
        this._log(`Paper Cuts: ${m.name} pays ${paid} HP; drew ${drawn} card${drawn === 1 ? '' : 's'}.`, 'status');
        this._emit({ kind: 'draw', count: drawn });
        break;
      }
      case 'scarletWard': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        // A normal Shield (replaces Brace, fades in SHIELD_TURNS enemy turns).
        m.shield = true;
        m.shieldTurns = SHIELD_TURNS;
        this._log(`Thick Skin: ${m.name} pays ${paid} HP for a Shield (fades in ${SHIELD_TURNS} enemy turns).`, 'status');
        this._emit({ kind: 'shieldApplied', slot: m.slot });
        break;
      }
      case 'transfusion': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        // Redistribute the blood to the most wounded OTHER member (never the payer).
        const other = this._mostWoundedOther(m);
        if (other) {
          const healed = this._healMember(other, card.heal ?? TRANSFUSION_HEAL, true);
          this._log(`Blood Drive: ${m.name} pays ${paid} HP; ${other.name} heals ${healed}.`, 'heal');
          this._emit({ kind: 'heal', slot: other.slot, amount: healed, hp: other.hp });
        } else {
          this._log(`Blood Drive: ${m.name} pays ${paid} HP, but no other member remains to receive it.`, 'status');
        }
        break;
      }
      case 'bloodBanner': {
        // Every living member pays (clamped to 1 HP); the party's autos gain a standing
        // +bonus for BLOOD_BANNER_TURNS enemy turns. Its own engine-level buff (not the
        // per-member strike field), so it stacks additively with Battle Hymn / Embolden.
        const cost = BLOOD_BANNER_HP + this._sanguineSurcharge();
        for (const m of this.livingMembers()) this._bloodPay(m, cost);
        this.bloodBannerTurns = BLOOD_BANNER_TURNS;
        this._log(`Pep Rally: the party digs deep — autos deal +${BLOOD_BANNER_BONUS} for ${BLOOD_BANNER_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'hymn', bonus: BLOOD_BANNER_BONUS, slots: this.livingMembers().map((x) => x.slot) });
        break;
      }
      // --- Status-window management (#67) --------------------------------------
      case 'hemorrhage': {
        // Cash the enemy's whole Poison out in one hit: per-turn × turns left. canPlay's
        // needsPoison gate guarantees an active poison. The consumed ticks stay
        // unmultiplied (they never tick), but the cash-out routes through _damageEnemy,
        // so Vulnerability multiplies it like any normal hit. Uncapped by design.
        const total = this.enemy.poison * this.enemy.poisonTurns;
        this.enemy.poison = 0;
        this.enemy.poisonTurns = 0;
        const killed = this._damageEnemy(total, 'Goo Burst');
        this._emitEnemyNuke(total, killed);
        break;
      }
      case 'dreadWhisper': {
        // Shave DREAD_WHISPER_REDUCTION damage per target off the standing telegraph
        // (floor 0), like Grave Chill — stacks with every other reduction. Modifies the
        // telegraph in place, so attackTargets() previews it immediately. No-op on a
        // 'cast' (channel wind-up) or an already-zeroed telegraph.
        const t = this.telegraph;
        if (t && !t.cast && t.damage > 0) {
          const before = t.damage;
          t.damage = Math.max(0, t.damage - DREAD_WHISPER_REDUCTION);
          this._log(`Trash Talk saps the ${this.telegraphIntent() ?? 'attack'}: ${before} → ${t.damage} per target.`, 'status');
          this._emit({ kind: 'graveChill', slot: SLOT.CENTER, amount: before - t.damage });
        } else {
          this._log('Trash Talk echoes at the telegraph, but there is nothing to sap.', 'status');
        }
        break;
      }
      case 'phalanx': {
        const m = this.members[target as number];
        // canPlay guarantees no active Defense (that is also the no-stack rule).
        m.defense = PHALANX_TURNS;
        m.defenseAmount = PHALANX_DEFENSE;
        this._log(`Turtle Up: ${m.name} gains Defense ${PHALANX_DEFENSE} for ${PHALANX_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'defenseApplied', slot: m.slot, amount: PHALANX_DEFENSE });
        break;
      }
      case 'provoke': {
        // Taunt-lite (#31): make any member the enemy's aim (no bundled Defense — that
        // was removed in the content-cut pass). Like the Tank's Taunt, future telegraphs
        // auto-aim at them (via _pickPrimary); the standing blow is not redirected for free.
        const m = this.members[target as number];
        m.taunt = TAUNT_LITE_TURNS;
        this._log(`${m.name} Provokes — the enemy turns to them for ${TAUNT_LITE_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'taunt', slot: m.slot, turns: TAUNT_LITE_TURNS });
        break;
      }
      // --- Iron mitigation web (#65) -------------------------------------------
      case 'feint': {
        // Redirect EVERY hit of the standing telegraph onto the chosen member (a
        // multi-hit blow stacks all its hits on them). Reuses the taunt-retarget path,
        // but as a card — no MP surcharge (the cost is the price). No-op on a 'cast',
        // a hidden telegraph (no readable geometry), or a Piercing-Bolt-style hit that
        // ignores Taunt by design; modifies the telegraph in place, so attackTargets()
        // previews the new target immediately.
        const m = this.members[target as number];
        const t = this.telegraph;
        if (t && !t.cast && !t.hidden && !t.ignoreTaunt && t.targets.length > 0) {
          t.targets = t.targets.map(() => m.slot);
          this._log(`${m.name} Feints — the ${this.telegraphIntent() ?? 'attack'} is drawn fully onto them.`, 'status');
          this._emit({ kind: 'taunt', slot: m.slot, turns: TAUNT_LITE_TURNS });
        } else {
          this._log(`${m.name} Feints, but there is no attack to steer.`, 'status');
        }
        break;
      }
      // --- Regen conversions (#66) ---------------------------------------------
      case 'sporeburst': {
        // Consume the full remaining Regen (canPlay's needsRegen gate guarantees > 0)
        // and convert every consumed tick into a turn of enemy Poison via the wave-wide
        // stacking rule. Consuming the Regen is an end path (Lifebloom burst + Deep Roots
        // + Thornskin cleanup), routed through _onRegenEnded AFTER the poison is applied.
        const m = this.members[target as number];
        const ticks = m.regen;
        m.regen = 0;
        this._applyPoison(SPOREBURST_POISON, ticks);
        this._log(`Sporeburst consumes ${m.name}'s Regen — the enemy is poisoned ${SPOREBURST_POISON}/turn for ${ticks} turn${ticks === 1 ? '' : 's'}. (${this.enemy.poison}/turn for ${this.enemy.poisonTurns})`, 'status');
        this._emit({ kind: 'poisonApplied', slot: m.slot, amount: SPOREBURST_POISON, poison: this.enemy.poison });
        this._onRegenEnded(m, true);
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
        this._emit({ kind: 'hymn', bonus: SHARPEN_BONUS, slots: [m.slot] });
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
        this._emit({ kind: 'hymn', bonus: EMPOWER_BONUS, slots: [m.slot] });
        break;
      }
      case 'riposte': {
        // Arm a counter on the next attack that connects with the hero (see
        // _resolveAttack). Consumed once; refreshing just re-arms the single flag.
        const m = this.members[target as number];
        m.riposte = true;
        this._log(`${m.name} sets a Riposte — the next hit will be answered in kind.`, 'status');
        this._emit({ kind: 'enGarde', slot: m.slot, turns: 1 });
        break;
      }
      case 'cleanse': {
        // Purge all negative party statuses: the party-wide Hex (#13) plus the per-member
        // Hero Poison (#87 — the sole answer to the Gobbler's Sludge and the venomous
        // normal). Written as a general purge so new party/member debuffs are covered.
        // Always playable; a no-op if nothing is afflicted (the animator still gets an event).
        let had = this.woundTurns > 0;
        this.woundTurns = 0;
        for (const m of this.members) {
          if (m.poison > 0 || m.poisonTurns > 0) { had = true; m.poison = 0; m.poisonTurns = 0; }
          if (m.markTurns > 0) { had = true; m.markTurns = 0; } // Curse/Mark cleared (#87)
        }
        this._log(had ? 'Cleanse purges the party — all afflictions lifted.' : 'Cleanse finds nothing to purge.', 'status');
        this._emit({ kind: 'cleanse', slot: SLOT.CENTER });
        break;
      }
      default:
        break;
    }
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
