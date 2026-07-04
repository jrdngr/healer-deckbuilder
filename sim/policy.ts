// Sim policy — a living "good player" that drives both shopping and fights, so
// balance can be judged by winrate instead of by feel. Pure and DOM-free: it
// consumes the engine (src/engine.ts) and run layer (src/run.ts) directly.
//
// The fight policy encodes the known-optimal line from the June balance pass
// (see memory/balance-pass-2026-06): keep Taunt uptime so the tank is the sink,
// heal the tank, race the enemy down with Bolt + Poison + party attacks, and
// bank MP with Refresh / Rest. It is structured as a list of prioritized
// "try*" tactics so later issues (per-boss reactions at P4/P5/P6, relic-aware
// shopping at P9) can register additional tactics without a rewrite.

import { Game } from '../src/engine';
import type { Member } from '../src/engine';
import { Run } from '../src/run';
import {
  resolveCard, SLOT, BOLT_BASE, BOLT_CHARGE_MULT, CHARGE_MAX,
} from '../src/constants';
import type { CardId, Slot, RelicId } from '../src/constants';

// ---------------------------------------------------------------------------
// Fight policy
// ---------------------------------------------------------------------------

const SAFE_FRACTION = 0.6;   // proactively heal a member below this HP fraction
const BOLT_CHARGE_GATE = 4;  // cast Bolt once Charge reaches this (best value / avoid cap waste)
const REFRESH_TURN_GATE = 6; // only prime Refresh in the early game, when the payoff has time to land

function handIndexOf(game: Game, id: CardId): number {
  return game.hand.findIndex((c) => c.id === id);
}
function cardCost(game: Game, idx: number): number {
  return game.effectiveCost(resolveCard(game.hand[idx])); // 0 while a Surge is pending
}
function affordable(game: Game, idx: number): boolean {
  return idx >= 0 && game.mp >= cardCost(game, idx);
}

// Damage each living member would take on the next enemy phase, folding in
// Defense (attackTargets() already applies it). Hidden attacks preview as null;
// treat them as a worst-case single-hit so the policy still reacts.
function incomingDamage(game: Game): Map<Slot, number> {
  const out = new Map<Slot, number>();
  for (const spec of game.attackTargets()) {
    const dmg = spec.hidden ? 5 : spec.damage ?? 0;
    out.set(spec.slot, (out.get(spec.slot) ?? 0) + dmg);
  }
  return out;
}

// Members in the order we care about saving them from a lethal blow: the fragile,
// high-value DPS first (mage's 5 damage + Bolt, then ranger), and the tank last —
// it carries the most HP and its Regen, so it is the least likely to be lethal.
function saveOrder(game: Game): Member[] {
  const order: Slot[] = [SLOT.RIGHT, SLOT.LEFT, SLOT.CENTER];
  return order.map((s) => game.members[s]).filter((m) => m.alive);
}

// Keep Taunt (and its bundled Defense) live so every attack — including the
// boss's heavy/sweep — funnels onto the defended tank. This is a survival tool:
// on normal fights it only slows the kill (the tank soaks damage we then have to
// heal), so we reserve the funnel for the boss and for rescuing a party in
// trouble, and otherwise spend ability cards on offense.
function tryRetaunt(game: Game): boolean {
  const tank = game.tank;
  if (!tank.alive || tank.taunt > 1) return false;
  const anyoneHurt = game.livingMembers().some((m) => m.hp < m.maxHP * 0.5);
  if (!game.config.enemy.boss && !anyoneHurt) return false;
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  game.playCard(idx, SLOT.CENTER);
  return true;
}

// Boss channels (the Gatewarden's Crushing Blow, #12) are the one telegraph the
// player gets two full phases to answer, and the answer is real: keep the tank's
// Taunt (and its bundled Defense) alive through the resolve, then top the
// threatened member up ABOVE the incoming hit. The re-taunt matters doubly —
// the preview folds Defense in, so letting it lapse mid-wind-up both raises the
// applied damage and invalidates the number that was healed against.
function tryBraceChannel(game: Game): boolean {
  const t = game.telegraph;
  if (!t || !t.channel) return false;
  const tank = game.tank;
  if (tank.alive && tank.taunt <= (t.turnsUntilResolve ?? 1)) {
    const idx = handIndexOf(game, 'ability');
    if (affordable(game, idx)) { game.playCard(idx, SLOT.CENTER); return true; }
  }
  const incoming = incomingDamage(game);
  for (const m of saveOrder(game)) {
    const dmg = incoming.get(m.slot) ?? 0;
    if (dmg === 0 || m.shield || m.hp > dmg) continue;
    const shieldIdx = handIndexOf(game, 'shield');
    if (affordable(game, shieldIdx)) { game.playCard(shieldIdx, m.slot); return true; }
    for (const id of ['highHeal', 'aoeHeal', 'lowHeal', 'regen'] as CardId[]) {
      const idx = handIndexOf(game, id);
      if (affordable(game, idx)) { game.playCard(idx, m.slot); return true; }
    }
  }
  return false;
}

// Stop an otherwise-lethal blow: Shield fully blocks it; failing that, top the
// member up above the incoming damage.
function tryPreventLethal(game: Game): boolean {
  const incoming = incomingDamage(game);
  for (const m of saveOrder(game)) {
    if (m.shield) continue;
    const dmg = incoming.get(m.slot) ?? 0;
    if (dmg === 0 || dmg < m.hp) continue; // safe this turn
    const shieldIdx = handIndexOf(game, 'shield');
    if (affordable(game, shieldIdx)) { game.playCard(shieldIdx, m.slot); return true; }
    for (const id of ['highHeal', 'aoeHeal', 'lowHeal'] as CardId[]) {
      const idx = handIndexOf(game, id);
      if (affordable(game, idx)) { game.playCard(idx, m.slot); return true; }
    }
  }
  return false;
}

// While a channel threatens someone we haven't made safe yet, every point of MP
// belongs to the save — offense during the wind-up is what turns an answerable
// hit into a death (rest banks +2/+5 toward next phase's heals instead).
function channelThreatUnanswered(game: Game): boolean {
  const t = game.telegraph;
  if (!t || !t.channel) return false;
  const incoming = incomingDamage(game);
  return game.livingMembers().some((m) => {
    const dmg = incoming.get(m.slot) ?? 0;
    return dmg > 0 && !m.shield && m.hp <= dmg;
  });
}

// Race the enemy down with the mage's Bolt when Charge is worth spending (or
// when it lands the kill).
function tryBolt(game: Game): boolean {
  const mage = game.mage;
  if (!mage.alive) return false;
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  const dmg = BOLT_BASE + mage.abilityPower + BOLT_CHARGE_MULT * game.mageCharge;
  if (dmg >= game.enemy.hp) { game.playCard(idx, SLOT.RIGHT); return true; } // the kill ends it now
  if (channelThreatUnanswered(game)) return false;
  if (game.mageCharge >= Math.min(BOLT_CHARGE_GATE, CHARGE_MAX)) {
    game.playCard(idx, SLOT.RIGHT);
    return true;
  }
  return false;
}

// Keep Poison ticking on the enemy for steady chip damage.
function tryPoison(game: Game): boolean {
  if (game.enemy.poisonTurns > 0) return false;
  if (!game.ranger.alive) return false;
  if (channelThreatUnanswered(game)) return false;
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  game.playCard(idx, SLOT.LEFT);
  return true;
}

// Heal the most-hurt member that has dropped below the comfort threshold. Once
// lethal blows are covered, this keeps everyone (and their party-phase damage)
// alive without over-spending on members who are merely scratched.
function tryHeal(game: Game): boolean {
  let worst: Member | null = null;
  let worstFrac = SAFE_FRACTION;
  for (const m of game.livingMembers()) {
    const frac = m.hp / m.maxHP;
    if (frac < worstFrac) { worst = m; worstFrac = frac; }
  }
  if (!worst) return false;
  const missing = worst.maxHP - worst.hp;
  const prefer: CardId[] = missing >= 4 ? ['highHeal', 'aoeHeal', 'regen', 'lowHeal']
    : ['lowHeal', 'regen', 'aoeHeal', 'highHeal'];
  for (const id of prefer) {
    if (id === 'regen' && worst.regenTurns > 0) continue;
    const idx = handIndexOf(game, id);
    if (affordable(game, idx)) { game.playCard(idx, worst.slot); return true; }
  }
  return false;
}

// Cleanse the Hexweaver's Hex (#13) before healing, so the heals we spend land at
// full value. Only worth a card + MP when there is real healing to do — a Hex with
// nobody hurt can just be ridden out.
function tryCleanse(game: Game): boolean {
  if (!game.wounded) return false;
  const idx = handIndexOf(game, 'cleanse');
  if (!affordable(game, idx)) return false;
  const someoneHurt = game.livingMembers().some((m) => m.hp < m.maxHP * SAFE_FRACTION);
  if (!someoneHurt) return false;
  game.playCard(idx, null);
  return true;
}

// Sweeps and AoE hit the whole party regardless of Taunt — the fragile members
// bleed out to repeated multi-target blows. Group Heal is the efficient answer:
// when a multi-target hit is telegraphed and at least two members are hurt, heal
// everyone at once rather than dribbling single-target heals.
function tryGroupHeal(game: Game): boolean {
  const idx = handIndexOf(game, 'aoeHeal');
  if (!affordable(game, idx)) return false;
  const targets = game.attackTargets().filter((s) => (s.hidden ? true : (s.damage ?? 0) > 0));
  const multiTargetIncoming = targets.length >= 2;
  const hurt = game.livingMembers().filter((m) => m.hp < m.maxHP).length;
  if (!multiTargetIncoming || hurt < 2) return false;
  game.playCard(idx, null);
  return true;
}

// Keep Regen running on the tank for cheap sustained healing between big blows.
function tryRegenTank(game: Game): boolean {
  const tank = game.tank;
  if (!tank.alive || tank.regenTurns > 0) return false;
  const idx = handIndexOf(game, 'regen');
  if (!affordable(game, idx)) return false;
  game.playCard(idx, SLOT.CENTER);
  return true;
}

// Bank MP income by priming Refresh early, while it still has turns to pay off.
// Font of Mana (#15) shares the Refresh slot and restores more per cast, so it
// is the preferred prime when both are in hand.
function tryRefresh(game: Game): boolean {
  if (game.refreshTurns > 0 || game.turn > REFRESH_TURN_GATE) return false;
  for (const id of ['fontOfMana', 'refresh'] as CardId[]) {
    const idx = handIndexOf(game, id);
    if (!affordable(game, idx)) continue;
    if (game.mp - cardCost(game, idx) < 1) continue; // don't strand ourselves at 0 MP
    game.playCard(idx, null);
    return true;
  }
  return false;
}

// Priority order per player phase. Secure the tank's Taunt, stop lethal blows,
// and blanket-heal telegraphed sweeps (Group Heal) up top — that is what keeps
// the fragile DPS alive. Then win the damage race (Bolt/Poison) before enrage
// snowballs; banking MP instead only drags fights past the turn-11 enrage and
// loses. Proactive single-target healing and MP economy fill the leftovers.
const TACTICS: Array<(game: Game) => boolean> = [
  tryBraceChannel, tryRetaunt, tryPreventLethal, tryCleanse, tryGroupHeal, tryBolt, tryPoison, tryHeal, tryRegenTank, tryRefresh,
];

// Play a single player phase to a natural close (rest or end turn).
function takeFightTurn(game: Game): void {
  while (game.phase === 'player') {
    let acted = false;
    for (const tactic of TACTICS) {
      if (tactic(game)) { acted = true; break; }
    }
    if (!acted) break;
  }
  if (game.phase !== 'player') return; // a Bolt / Poison tick finished the enemy
  // Nothing left worth doing: rest to bank MP if we still have room and haven't
  // committed the turn to a card; otherwise let the party phase run.
  if (game.canSkip() && game.mp < game.maxMana) game.skipTurn();
  else game.endTurn();
}

// Play a fight from a fresh Game to completion. A turn cap guards against a
// stalled line dragging on forever; exceeding it leaves status 'playing', which
// the caller reads as a loss.
export function playFight(game: Game, turnCap = 40): void {
  game.start();
  let guard = 0;
  while (game.status === 'playing' && game.turn <= turnCap && guard < 1000) {
    guard++;
    takeFightTurn(game);
  }
}

// ---------------------------------------------------------------------------
// Shop / run policy — a sensible buyer that favors damage, MP economy, and tank
// survivability (the levers the balance pass found mattered).
// ---------------------------------------------------------------------------

// Buy-value of each card the shops can sell (higher = buy first). Ability cards
// feed the Taunt/Bolt/Poison line; Refresh feeds the MP economy.
const CARD_BUY_VALUE: Record<CardId, number> = {
  ability: 9, fontOfMana: 8, refresh: 7, highHeal: 6, shield: 5, cleanse: 5, aoeHeal: 4, regen: 3, resurrect: 2,
  // Phase-A/B cards (#15/#16) the fight policy has no tactic for yet stay below
  // the buy threshold — a card the policy never plays is dead deck weight.
  overgrowth: 2, bloom: 2, inspiration: 2, cultivate: 1, lowHeal: 1,
  lifebloom: 2, surge: 2, battleHymn: 2, barrier: 2, bloodTithe: 2, martyrsGift: 2, grimHarvest: 2,
  phalanx: 2, brace: 2,
};
const MAX_CARDS_PER_SHOP = 2; // stay selective so the deck doesn't dilute ability draws

// Desirability of each healer stat when buying upgrades.
const HEALER_STAT_VALUE: Record<string, number> = {
  passiveMp: 4, maxMana: 3, restRegen: 2, handSize: 1,
};

function shopCardNode(run: Run): void {
  if (run.nodeContent?.type !== 'cardShop') return;
  let bought = 0;
  while (bought < MAX_CARDS_PER_SHOP) {
    const offers = run.nodeContent.offers;
    // Best affordable, worthwhile offer (skip low-value filler like lowHeal).
    let best = -1, bestVal = 2;
    offers.forEach((o, i) => {
      if (o.price > run.gold) return;
      const v = CARD_BUY_VALUE[o.cardId];
      if (v > bestVal) { bestVal = v; best = i; }
    });
    if (best < 0 || !run.buyCardOffer(best)) break;
    bought++;
  }
}

function shopHealerNode(run: Run): void {
  if (run.nodeContent?.type !== 'healerUpgrade') return;
  const offers = run.nodeContent.offers;
  let best = -1, bestVal = -1;
  offers.forEach((o, i) => {
    if (o.price > run.gold) return;
    const v = HEALER_STAT_VALUE[o.def.stat] ?? 0;
    if (v > bestVal) { bestVal = v; best = i; }
  });
  if (best >= 0) run.buyHealerOffer(best);
}

function shopPartyNode(run: Run): void {
  if (run.nodeContent?.type !== 'partyUpgrade') return;
  const offers = run.nodeContent.offers;
  // Value damage highest (reliable cumulative DPS), then tank HP, then ability.
  const value = (stat: string, amount: number): number =>
    stat === 'damage' ? 5 + amount : stat === 'maxHP' ? 3 + amount / 3 : 2 + amount;
  let best = -1, bestVal = -1;
  offers.forEach((o, i) => {
    if (o.price > run.gold) return;
    const v = value(o.def.stat, o.def.amount);
    if (v > bestVal) { bestVal = v; best = i; }
  });
  if (best < 0) return;
  // Put damage / HP on the tank (the always-alive taunt sink); ability on the
  // ranger (Poison scales more consistently than Bolt for a grind line).
  const def = offers[best].def;
  const slot: Slot = def.stat === 'ability' ? SLOT.LEFT : SLOT.CENTER;
  run.buyPartyOffer(best, slot);
}

function shopModifierNode(run: Run): void {
  if (run.nodeContent?.type !== 'cardUpgrade') return;
  const offers = run.nodeContent.offers;
  // Apply the first affordable modifier to an ability card if possible (efficient
  // makes Taunt/Bolt cheaper), else any card that can take it.
  for (let i = 0; i < offers.length; i++) {
    if (offers[i].price > run.gold) continue;
    const mod = offers[i].modifier;
    const target = run.deck.find((c) => c.id === 'ability' && c.upgrades.length < 2 && run.eligibleModifiersFor(c).includes(mod))
      ?? run.deck.find((c) => run.eligibleModifiersFor(c).includes(mod));
    if (target && run.buyModifierOffer(i, target.uid)) return;
  }
}

// Relic desirability (#21) for spoils picks and Reliquary buys. MP economy and
// steady damage top the list (the levers the balance passes found mattered);
// the Lantern trails (hidden attacks are rare and already magnitude-revealed).
const RELIC_VALUE: Record<RelicId, number> = {
  titheCandle: 9, vanguardsBanner: 8, prayerBeads: 7, warDrum: 7,
  fieldTriage: 6, groundingRod: 6, stormglass: 5, echoLocket: 5,
  hagglersCharm: 4, lantern: 2,
  // Phase-B rule-changers (#22). The Taper's hand 3->2 starves this policy's
  // tactic engine, so it never takes one; the others are solid defensive picks.
  martyrsIcon: 6, duskChime: 6, aegisFont: 4, firstLightTaper: 0,
  // DR1: the Mending Totem is worthless until the policy actually records and
  // avoids scars (commit 6 raises this and adds the survival/infirmary logic).
  mendingTotem: 0,
  // Curses are deliberate player trades; the fixed policy never buys one.
  pactOfSilence: 0, crackedHourglass: 0, rustyCrown: 0,
};

// Spoils are free: always take the best-valued offer.
export function chooseSpoil(run: Run): number {
  if (run.nodeContent?.type !== 'spoils') return 0;
  let best = 0, bestVal = -1;
  run.nodeContent.offers.forEach((o, i) => {
    const v = RELIC_VALUE[o.relicId] ?? 0;
    if (v > bestVal) { bestVal = v; best = i; }
  });
  return best;
}

// Reliquary: buy the single best-value affordable relic (run-long payoff), and
// skip the card-removal service (the policy's deck stays lean by buying little).
function shopReliquary(run: Run): void {
  if (run.nodeContent?.type !== 'reliquary') return;
  const offers = run.nodeContent.offers;
  let best = -1, bestVal = 3; // don't burn 50g+ on bottom-value relics
  offers.forEach((o, i) => {
    if (o.price > run.gold) return;
    const v = RELIC_VALUE[o.relicId] ?? 0;
    if (v > bestVal) { bestVal = v; best = i; }
  });
  if (best >= 0) run.buyRelicOffer(best);
}

function resolveEvent(run: Run): void {
  if (run.nodeContent?.type !== 'event') return;
  for (const choice of run.nodeContent.event.choices) {
    switch (choice.kind) {
      case 'gambleGold': run.gambleGold(); return;          // positive EV, always flip
      case 'addCardOffer': {
        const ids = run.eventCardOffer();
        const pick = ids.reduce((a, b) => (CARD_BUY_VALUE[b] > CARD_BUY_VALUE[a] ? b : a), ids[0]);
        run.addCard(pick); return;
      }
      case 'shrineParty': run.shrineBlessMember(SLOT.CENTER); return; // buff the tank
      case 'shrineCard': {
        const eligible = run.shrineEligibleCards();
        if (eligible.length) { run.shrineBlessCard(eligible[0].uid); return; }
        break;
      }
      default: break;
    }
  }
  // Nothing worthwhile (or only a card-removal we don't need) — move on.
}

export function resolveNode(run: Run): void {
  switch (run.nodeContent?.type) {
    case 'cardShop': shopCardNode(run); break;
    case 'healerUpgrade': shopHealerNode(run); break;
    case 'partyUpgrade': shopPartyNode(run); break;
    case 'cardUpgrade': shopModifierNode(run); break;
    case 'event': resolveEvent(run); break;
    case 'reliquary': shopReliquary(run); break;
    default: break;
  }
}

// Score a branch by the permanent power its nodes offer, so the policy walks the
// stronger path through each fork.
const NODE_DESIRABILITY: Record<string, number> = {
  partyUpgrade: 5, healerUpgrade: 5, reliquary: 5, cardUpgrade: 4, cardShop: 3, event: 2, fight: 0,
};

export function chooseBranch(run: Run): number {
  if (run.location.kind !== 'forkChoice') return 0;
  const fork = run.map[run.location.forkIndex];
  let best = 0, bestScore = -Infinity;
  fork.branches.forEach((b, i) => {
    const score = b.nodes.reduce((s, n) => s + (NODE_DESIRABILITY[n.type] ?? 0), 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}
