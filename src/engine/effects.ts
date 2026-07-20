// Card- and ability-effect method bodies for Game, split out of core.ts to keep
// that file navigable. Attached to the prototype (every Game member is public, so
// `this` reaches them). index.ts side-imports this so the augmentation always runs.
import { Game } from './core';
import type { Member } from './core';
import {
  CARDS
} from '../constants';
import type {
  Slot, AttackType, MemberId, AbilityId, BattleConfig, DeckCard, ResolvedCard, CardId,
  TauntRetargetMode, EnemyDef, RotationStep, RotationEntry, CastKind, RelicId, CardType,
} from '../constants';
import { makeRng, shuffle, weightedPick } from '../rng';
// Content dispatch (#101). The engine imports content; content imports only TYPES back
// from the engine, so this direction is the acyclic one.
import { ABILITY_ACTIONS, CARD_ACTIONS, NATIVES, runActions } from '../content';

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
    this._hookEvent('onAbilityCast', { self: m, vars: {} });
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
    // Every ability effect is data (#102). abilities.json holds the action list; two
    // arms (hex, taunt) reach the native registry from inside it.
    const abilityActions = ABILITY_ACTIONS[ability];
    if (abilityActions) {
      runActions(this, abilityActions, { self: m, target, vars: {} }, NATIVES);
    } else {
      this._log(`${m.name} has no effect defined for ${ability}.`, 'system');
    }
    // Restore the base abilityPower after an Empowered cast (#62) — the bonus was
    // spent by the ability above; the member's persistent power is unchanged.
    if (empower > 0) m.abilityPower -= empower;
};
