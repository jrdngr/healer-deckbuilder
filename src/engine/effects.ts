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
  ENRAGE_TURN, ENRAGE_MULT, BOLT_BASE, BOLT_CHARGE_MULT, CHARGE_MAX,
  POISON_BASE, POISON_TURNS, FERMENT_TURNS, FERMENT_GROWTH,
  TAUNT_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS, SHIELD_TURNS, SLOT,
  TAUNT_LITE_TURNS, TAUNT_LITE_DEFENSE,
  GUARD_DR, GUARD_TURNS, SHARPEN_BONUS, SHARPEN_TURNS,
  EMBOLDEN_BONUS, EMBOLDEN_TURNS, EMPOWER_BONUS, EN_GARDE_TURNS, PENANCE_HP, PENANCE_STRIKE_BONUS, RADIANCE_HEAL,
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
    _fireAbility(m: Member, target?: number | null): void;
  }
}

Game.prototype._applyCard = function (card, target) {
    // Per-member ability cards (#44): fire the bound member's ability. canPlay has
    // already ensured a living carrier exists (devPlayCard tolerates its absence).
    if (card.ability != null) {
      const m = this._abilityMember(card.ability);
      // En Garde (#74) is the first target 'single' ability card — the chosen member
      // receives the stance. Every other ability is target 'none' and ignores `target`.
      if (m) this._fireAbility(m, target);
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
      // --- Holy overheal & board-state payoffs (#69) --------------------------
      case 'benediction': {
        // Heal a flat base + BENEDICTION_PER_BUFF per active buff on the TARGET (the
        // per-member buff count, #67). No cap — buff density is the payoff.
        const m = this.members[target as number];
        const buffs = this._memberEffectCount(m);
        const amount = BENEDICTION_HEAL + BENEDICTION_PER_BUFF * buffs + this._holyHealBonus(card);
        const healed = this._healMember(m, amount, true);
        this._log(`Benediction: ${m.name} heals ${healed} (${buffs} buff${buffs === 1 ? '' : 's'}). (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        this._healCardSplash(m, amount); // #69 Twin Censer + #70 Arcane Lens
        break;
      }
      case 'sunriseVigil': {
        // Queue a delayed party heal — it fires at the START of the next player phase
        // (after the Regen tick, before the draw; see _startPlayerPhase). Each cast
        // queues its own entry, so casting twice this turn heals twice next turn.
        this.delayedStartEffects.push({ kind: 'sunriseVigil' });
        this._log(`Sunrise Vigil set — every living member heals ${SUNRISE_VIGIL_HEAL} at the start of your next turn.`, 'status');
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
        this._log(`Consecration: the party heals ${card.heal ?? CONSECRATION_HEAL}; ${atFullSlots.length} at full HP strike +${CONSECRATION_STRIKE_BONUS} for ${CONSECRATION_STRIKE_TURNS} enemy turns.`, 'heal');
        if (atFullSlots.length > 0) this._emit({ kind: 'hymn', bonus: CONSECRATION_STRIKE_BONUS, slots: atFullSlots });
        break;
      }
      case 'absolution': {
        // Heal, then convert any OVERHEAL into Brace on the target (uncapped, respecting
        // the Shield-OR-Brace rule, #17). captureOverheal suppresses Aegis Font's own
        // conversion this cast — Absolution converts first, the Font gets nothing.
        const m = this.members[target as number];
        const amount = ABSOLUTION_HEAL + this._holyHealBonus(card);
        const res = this._applyHeal(m, amount, true, true);
        this._emit({ kind: 'heal', slot: m.slot, amount: res.healed, hp: m.hp });
        if (res.overheal > 0) {
          m.brace = true;
          m.braceAmount = res.overheal; // variable Brace strength (#69)
          m.braceTurns = BRACE_TURNS;
          m.shield = false; m.shieldTurns = 0; // newest ward replaces (#17)
          this._log(`Absolution: ${m.name} heals ${res.healed}; ${res.overheal} overheal hardens into Brace ${res.overheal}.`, 'status');
          this._emit({ kind: 'braceApplied', slot: m.slot });
        } else {
          this._log(`Absolution: ${m.name} heals ${res.healed}. (${m.hp}/${m.maxHP})`, 'heal');
        }
        this._healCardSplash(m, amount); // #69 Twin Censer + #70 Arcane Lens
        break;
      }
      case 'rootbind': {
        // Extend every FRIENDLY timed effect by ROOTBIND_BONUS_TURNS. Published field list
        // (#69): regen (magnitude == duration), shieldTurns, braceTurns, guardTurns,
        // defense, strikeTurns, taunt. Effects at 0 (absent) are untouched. Enemy statuses
        // (#67), channels (turn-gated), Interlock grants, and once-armed flags
        // (Empower/Riposte/drumPrimed, Anvil Stance, Thornskin) carry no member timer here
        // and are deliberately excluded.
        let extended = 0;
        for (const m of this.livingMembers()) {
          if (m.regen > 0) { m.regen += ROOTBIND_BONUS_TURNS; extended += 1; }
          if (m.shieldTurns > 0) { m.shieldTurns += ROOTBIND_BONUS_TURNS; extended += 1; }
          if (m.braceTurns > 0) { m.braceTurns += ROOTBIND_BONUS_TURNS; extended += 1; }
          if (m.guardTurns > 0) { m.guardTurns += ROOTBIND_BONUS_TURNS; extended += 1; }
          if (m.defense > 0) { m.defense += ROOTBIND_BONUS_TURNS; extended += 1; }
          if (m.strikeTurns > 0) { m.strikeTurns += ROOTBIND_BONUS_TURNS; extended += 1; }
          if (m.taunt > 0) { m.taunt += ROOTBIND_BONUS_TURNS; extended += 1; }
        }
        this._log(`Rootbind: ${extended} friendly timed effect${extended === 1 ? '' : 's'} last +${ROOTBIND_BONUS_TURNS} turn.`, 'status');
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
        m.regen = 0; m.bloomBurst = 0; m.thornskin = false; // #66 mark cleared on revive
        m.taunt = 0; m.defense = 0; m.defenseAmount = 0; m.charge = 0; m.drumPrimed = false;
        m.strikeBonus = 0; m.strikeTurns = 0; m.guardDR = 0; m.guardTurns = 0; // #62 buffs cleared on revive
        m.interlockGuardTurns = []; m.anvilStance = false; // #65 buffs/marks cleared on revive
        m.empowerBonus = 0; m.riposte = false; m.riposteTurns = 0; // En Garde stance cleared on revive (#74)
        // Reworked (#18): the revive comes back behind a fresh Shield so the
        // standing telegraph can't immediately undo the 4 MP investment.
        m.shield = true; m.shieldTurns = SHIELD_TURNS;
        this._log(`${m.name} is resurrected to ${m.hp} HP behind a Shield.`, 'status');
        this._emit({ kind: 'resurrect', slot: m.slot, hp: m.hp });
        this._emit({ kind: 'shieldApplied', slot: m.slot });
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
        // Consuming the Regen is one of its end conditions: Lifebloom burst + Deep
        // Roots fire, and the Thornskin mark is cleared (#66).
        this._onRegenEnded(m, true);
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
      case 'attunement': {
        // Draw 1; the drawn instance's uid is stamped channel-exempt so its later play
        // (this turn or any later turn) won't break a channel either (#70). Attunement's
        // own uid was already stamped in playCard, before the cancel check. Engine-tagged,
        // so Retain/Efficient never touch it. When both piles are empty the draw no-ops.
        const c = this._drawOne();
        if (c != null) {
          this.hand.push(c);
          this.channelExemptUids.add(c.uid);
          this._log("Attunement: draw 1 (it won't break your channel).", 'status');
          this._emit({ kind: 'draw', count: 1 });
        } else {
          this._log('Attunement: nothing left to draw.', 'status');
        }
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
        this._emit({ kind: 'hymn', bonus: this.hymnBonus, slots: this.livingMembers().map((x) => x.slot) });
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
        const paid = this._bloodPay(m, this._bloodCost(card));
        const before = this.mp;
        this.mp = Math.min(this.maxMana, this.mp + BLOOD_TITHE_MP);
        this._log(`Blood Tithe: ${m.name} pays ${paid} HP; ${this.mp - before} MP restored. (MP ${this.mp})`, 'mp');
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
        this._log(`Martyr's Gift: ${m.name} pays ${paid} HP; the others heal up to ${card.heal}.`, 'heal');
        break;
      }
      case 'grimHarvest': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        this._log(`Grim Harvest: ${m.name} pays ${paid} HP.`, 'status');
        const killed = this._damageEnemy(GRIM_HARVEST_DMG, 'Grim Harvest');
        this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(GRIM_HARVEST_DMG), enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        break;
      }
      // --- Blood + cycling (#68): HP as a spendable resource -------------------
      case 'crimsonPact': {
        // Pay HP, then draw through the normal draw path — a reshuffle mid-draw fires
        // Prayer Beads / Grimoire (like Inspiration, but priced in HP).
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        const before = this.hand.length;
        for (let i = 0; i < (card.draw ?? CRIMSON_PACT_DRAW); i++) {
          const c = this._drawOne();
          if (c == null) break; // draw and discard both empty
          this.hand.push(c);
        }
        const drawn = this.hand.length - before;
        this._log(`Crimson Pact: ${m.name} pays ${paid} HP; drew ${drawn} card${drawn === 1 ? '' : 's'}.`, 'status');
        this._emit({ kind: 'draw', count: drawn });
        break;
      }
      case 'scarletWard': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        // A normal Shield (replaces Brace, fades in SHIELD_TURNS enemy turns).
        m.shield = true;
        m.shieldTurns = SHIELD_TURNS;
        m.brace = false;
        m.braceTurns = 0;
        this._log(`Scarlet Ward: ${m.name} pays ${paid} HP for a Shield (fades in ${SHIELD_TURNS} enemy turns).`, 'status');
        this._emit({ kind: 'shieldApplied', slot: m.slot });
        break;
      }
      case 'openVeins': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        this._log(`Open Veins: ${m.name} pays ${paid} HP.`, 'status');
        const killed = this._damageEnemy(OPEN_VEINS_DMG, 'Open Veins');
        this._emit({ kind: 'partyAttack', slot: m.slot, memberId: m.id, amount: this.vulnerableAmount(OPEN_VEINS_DMG), enemyHp: this.enemy.hp });
        if (killed) this._emit({ kind: 'defeatEnemy' });
        break;
      }
      case 'transfusion': {
        const m = this.members[target as number];
        const paid = this._bloodPay(m, this._bloodCost(card));
        // Redistribute the blood to the most wounded OTHER member (never the payer).
        const other = this._mostWoundedOther(m);
        if (other) {
          const healed = this._healMember(other, card.heal ?? TRANSFUSION_HEAL, true);
          this._log(`Transfusion: ${m.name} pays ${paid} HP; ${other.name} heals ${healed}.`, 'heal');
          this._emit({ kind: 'heal', slot: other.slot, amount: healed, hp: other.hp });
        } else {
          this._log(`Transfusion: ${m.name} pays ${paid} HP, but no other member remains to receive it.`, 'status');
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
        this._log(`Blood Banner: the party bleeds for the standard — autos deal +${BLOOD_BANNER_BONUS} for ${BLOOD_BANNER_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'hymn', bonus: BLOOD_BANNER_BONUS, slots: this.livingMembers().map((x) => x.slot) });
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
      // --- Status-window management (#67) --------------------------------------
      case 'hemorrhage': {
        // Cash the enemy's whole Poison out in one hit: per-turn × turns left. canPlay's
        // needsPoison gate guarantees an active poison. The consumed ticks stay
        // unmultiplied (they never tick), but the cash-out routes through _damageEnemy,
        // so Vulnerability multiplies it like any normal hit. Uncapped by design.
        const total = this.enemy.poison * this.enemy.poisonTurns;
        this.enemy.poison = 0;
        this.enemy.poisonTurns = 0;
        const killed = this._damageEnemy(total, 'Hemorrhage');
        this._emitEnemyNuke(total, killed);
        break;
      }
      case 'umbralFeast': {
        // 1 damage per active effect in play (party buffs + enemy debuffs), counted at
        // cast time by the published helper. Uncapped. Routes through _damageEnemy so
        // Vulnerability (itself one of the counted effects) multiplies it.
        const dmg = this._activeEffectCount() * UMBRAL_FEAST_PER_EFFECT;
        const killed = this._damageEnemy(dmg, 'Umbral Feast');
        this._emitEnemyNuke(dmg, killed);
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
          this._log(`A dread whisper saps the ${this.telegraphIntent() ?? 'attack'}: ${before} → ${t.damage} per target.`, 'status');
          this._emit({ kind: 'graveChill', slot: SLOT.CENTER, amount: before - t.damage });
        } else {
          this._log('A dread whisper reaches for the telegraph, but there is nothing to sap.', 'status');
        }
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
        m.braceAmount = BRACE_AMOUNT; // standard Brace strength (#69)
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
      case 'anvilStance': {
        // Mark the member: while they hold a Shield or Brace, their autos deal
        // +ANVIL_STANCE_BONUS. The mark persists for the fight — the CONDITION gates it,
        // checked at auto time in memberDamage.
        const m = this.members[target as number];
        m.anvilStance = true;
        this._log(`${m.name} takes an Anvil Stance — +${ANVIL_STANCE_BONUS} damage while holding a Shield or Brace.`, 'status');
        this._emit({ kind: 'braceApplied', slot: m.slot });
        break;
      }
      case 'interlock': {
        // Grant every living member a Guard that stacks FREELY (relaxing Guard's
        // no-self-stack rule): push one grant with its own timer, so repeat casts and
        // pre-existing Guard all add up and each expires independently.
        for (const m of this.livingMembers()) {
          m.interlockGuardTurns = [...m.interlockGuardTurns, INTERLOCK_GUARD_TURNS];
          this._emit({ kind: 'defenseApplied', slot: m.slot, amount: INTERLOCK_GUARD_DR });
        }
        this._log(`Interlock: every living member gains Guard ${INTERLOCK_GUARD_DR} for ${INTERLOCK_GUARD_TURNS} enemy turns.`, 'status');
        break;
      }
      // --- Regen conversions (#66) ---------------------------------------------
      case 'thornskin': {
        // Arm the Thornskin mark on the target (canPlay's needsRegen gate guarantees
        // an active Regen). The reduction has no timer of its own — it rides the Regen
        // and is checked in _effectiveDamage; _onRegenEnded clears the mark when the
        // Regen ends. A recast onto the same Regen is a harmless no-op (already armed).
        const m = this.members[target as number];
        m.thornskin = true;
        this._log(`${m.name}'s skin hardens like bark — ${THORNSKIN_REDUCTION} less from each hit while their Regen lasts.`, 'status');
        this._emit({ kind: 'braceApplied', slot: m.slot });
        break;
      }
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
      // --- small-party cards (#42) ---------------------------------------------
      case 'rally': {
        // Every attack this turn deals more, scaled by empty deploy seats — a lone
        // striker swings for a lot; a full party gains nothing.
        const empty = 3 - this.fieldedPartySize();
        this.hymnBonus = Math.max(this.hymnBonus, RALLY_DMG_PER_SEAT * empty);
        this._log(`Rally: every attack this turn deals +${RALLY_DMG_PER_SEAT * empty} (${empty} empty seat${empty === 1 ? '' : 's'}).`, 'status');
        this._emit({ kind: 'hymn', bonus: this.hymnBonus, slots: this.livingMembers().map((x) => x.slot) });
        break;
      }
      case 'focus': {
        // A concentrated heal: more efficient when there are fewer bodies to spread across.
        const m = this.members[target as number];
        const amount = (card.heal ?? FOCUS_HEAL) + (this.fieldedPartySize() <= SMALL_PARTY_MAX ? FOCUS_SMALL_BONUS : 0) + this._holyHealBonus(card);
        const healed = this._healMember(m, amount, true);
        this._log(`Focus: ${m.name} heals ${healed}. (${m.hp}/${m.maxHP})`, 'heal');
        this._emit({ kind: 'heal', slot: m.slot, amount: healed, hp: m.hp });
        this._healCardSplash(m, amount); // #69 Twin Censer + #70 Arcane Lens
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
        this._emit({ kind: 'hymn', bonus: SHARPEN_BONUS, slots: [m.slot] });
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
        this._emit({ kind: 'hymn', bonus: EMBOLDEN_BONUS, slots: this.livingMembers().map((x) => x.slot) });
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
        this._emit({ kind: 'hymn', bonus: EMPOWER_BONUS, slots: [m.slot] });
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
};

Game.prototype._fireAbility = function (m, target = null) {
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
      case 'ferment': {
        // The Plaguewright (#72) opens a fermentation window: for the next FERMENT_TURNS
        // enemy turns, Poison compounds (see the tick in _runEnemyPhase). Recasts extend
        // the remaining window additively — no cap. The per-tick growth is captured at
        // cast time (the tick has no caster) and scaled by the caster's ability power
        // (Empower / injury penalty). Floored at 0 so a Broken member can't SHRINK Poison
        // (mirrors the taunt/poison DR1 floors); no upper cap. The window opens even with
        // no Poison standing — it ferments whatever arrives before it closes.
        const growth = Math.max(0, FERMENT_GROWTH + m.abilityPower);
        this.enemy.fermentTurns += FERMENT_TURNS;
        this.enemy.fermentGrowth = growth;
        this._log(`${m.name} Ferments the enemy's Poison — it compounds (+${growth}/turn, duration frozen) for the next ${this.enemy.fermentTurns} enemy turns.`, 'status');
        this._emit({ kind: 'ferment', slot: m.slot, turns: this.enemy.fermentTurns, growth });
        break;
      }
      case 'liturgy': {
        // The Hierophant (#73) gives the active channel DUAL CADENCE: for its remaining
        // duration it also ticks at the start of the enemy phase (see _runEnemyPhase),
        // before the blow lands. canPlay's needsChannel gate guarantees a channel is
        // running, and Liturgy is channel-exempt so playing it never broke that channel.
        // Idempotent: recasting while already dual-cadenced just re-affirms the flag.
        if (this.channelActive()) {
          const already = this.channelDualCadence;
          this.channelDualCadence = true;
          this._log(already
            ? `${m.name}'s Liturgy already sustains the ${CARDS[this.channelCard as CardId].name} channel's dual cadence.`
            : `${m.name} intones a Liturgy — the ${CARDS[this.channelCard as CardId].name} channel gains dual cadence (an extra enemy-phase tick each round).`, 'status');
        }
        break;
      }
      case 'enGarde': {
        // The Duelist (#74) grants a CHOSEN member the persistent Riposte stance. This is
        // the first target 'single' ability card, so `target` is the picked slot (canPlay's
        // 'single' branch already validated a living member); it defaults to the Duelist
        // herself if somehow unset. Recasting refreshes the duration (no stacking).
        const holder = (target != null && this.members[target]?.alive) ? this.members[target] : m;
        holder.riposteTurns = EN_GARDE_TURNS;
        this._log(`${m.name} sets ${holder === m ? 'her own' : `${holder.name}'s`} guard — En Garde: every hit is answered for ${EN_GARDE_TURNS} enemy turns.`, 'status');
        this._emit({ kind: 'enGarde', slot: holder.slot, turns: EN_GARDE_TURNS });
        break;
      }
      case 'penance': {
        // The Flagellant (#75) pays PENANCE_HP — NO clamp; this is the SOLE Blood effect
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
        this.penanceBonus = Math.max(this.penanceBonus, PENANCE_STRIKE_BONUS);
        this._log(died
          ? `${m.name} spends the last of his blood — Penance is paid. Every living member's auto deals +${PENANCE_STRIKE_BONUS} this turn.`
          : `${m.name} scourges himself (-${cost} HP) — Penance: every living member's auto deals +${PENANCE_STRIKE_BONUS} this turn.`, 'status');
        this._emit({ kind: 'penance', slot: m.slot, bonus: PENANCE_STRIKE_BONUS, died,
          slots: this.livingMembers().map((x) => x.slot) });
        break;
      }
      case 'radiance': {
        // The Lightkeeper (#76) heals EVERY living member and turns each member's OVERHEAL
        // into Brace — the wave's "party at full HP" payoff (#69). The heal routes through
        // the normal pipeline (_applyHeal): Field Triage, Reliquary of Light (via the holy
        // bonus below), and Beacon's heal-to-full draw all apply, and #69's result struct
        // (healed/overheal/reachedFull) supplies the overheal — no separate overheal math.
        // abilityPower (Empower / injury) scales the heal (and therefore the possible Brace),
        // keeping one lever; it was already bumped by Empower at the top of _fireAbility.
        //   - ADDITIVE carve-out: Radiance's Brace ADDS to any existing Brace (brace +=
        //     overheal) and refreshes the single timer — deliberately unlike the Brace card's
        //     newest-replaces rule, so repeat casts pile it up. No cap.
        //   - SHIELD asymmetry (the one documented exception): a member holding a Shield keeps
        //     it — the conversion is SKIPPED for them (a full block already beats Brace 2;
        //     silently downgrading a Shield would be a feel-bad trap). The heal still lands.
        // Reliquary of Light: radiance is a holy card, so its +1 holy heal rides the amount —
        // on topped members that becomes +1 more Brace (intended relic chemistry).
        const reliquary = this.hasRelic('reliquaryOfLight') ? HOLY_RELIC_HEAL : 0;
        const amount = Math.max(0, RADIANCE_HEAL + m.abilityPower) + reliquary;
        let braced = 0;
        for (const t of this.livingMembers()) {
          // captureOverheal=true: Radiance claims the overheal for Brace, so Aegis Font
          // gets NO share of it (the #69 ordering rule — no double-convert), exactly as
          // Absolution does. Beacon's heal-to-full draw still fires (it ignores the flag).
          const res = this._applyHeal(t, amount, true, true);
          this._emit({ kind: 'heal', slot: t.slot, amount: res.healed, hp: t.hp });
          // Shield-holders skip the conversion (Shield preserved); everyone else's overheal
          // hardens into additive Brace with the timer refreshed.
          if (res.overheal > 0 && !t.shield) {
            t.brace = true;
            t.braceAmount += res.overheal; // additive carve-out (#76): 0 (no prior) -> overheal, or pile onto existing
            t.braceTurns = BRACE_TURNS;    // one growing timer, refreshed on each addition
            braced++;
            this._emit({ kind: 'braceApplied', slot: t.slot });
          }
        }
        this._log(braced > 0
          ? `${m.name} calls down Radiance — the party heals ${amount}; ${braced} harden${braced === 1 ? 's' : ''} overheal into Brace.`
          : `${m.name} calls down Radiance — the party heals ${amount}.`, 'status');
        break;
      }
      default:
        break;
    }
    // Restore the base abilityPower after an Empowered cast (#62) — the bonus was
    // spent by the ability above; the member's persistent power is unchanged.
    if (empower > 0) m.abilityPower -= empower;
};
