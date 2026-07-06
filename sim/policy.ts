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
  SKALD_DMG_CAP, SKALD_DMG_PER_CARD, memberDefAt,
  DRAFT_RATING, CONVENTIONAL_STRIKERS, MEMBER_POOL, ABILITY_CARD,
} from '../src/constants';
import type { CardId, Slot, RelicId, AbilityId, MemberId } from '../src/constants';

// ---------------------------------------------------------------------------
// Fight policy
// ---------------------------------------------------------------------------

const SAFE_FRACTION = 0.6;   // proactively heal a member below this HP fraction
const BOLT_CHARGE_GATE = 4;  // cast Bolt once Charge reaches this (best value / avoid cap waste)
const REFRESH_TURN_GATE = 6; // only prime Refresh in the early game, when the payoff has time to land

function handIndexOf(game: Game, id: CardId): number {
  return game.hand.findIndex((c) => c.id === id);
}
// The hand index of a member's bound ability card (#44). Ability cards are 'none'
// target — played with no slot pick (the engine resolves the bound member).
function abilityCardIndex(game: Game, ability: AbilityId): number {
  return handIndexOf(game, ABILITY_CARD[ability]);
}
function cardCost(game: Game, idx: number): number {
  return game.effectiveCost(resolveCard(game.hand[idx])); // 0 while a Surge is pending
}
function affordable(game: Game, idx: number): boolean {
  return idx >= 0 && game.mp >= cardCost(game, idx);
}

// Damage each living member would take before its next turn, folding in Defense
// (attackTargets() already applies it). Hidden attacks preview as null; treat them
// as a worst-case single-hit so the policy still reacts. (#39 removed the Warlock's
// Soul Tithe, so there is no longer a self-inflicted drain to fold in here.)
function incomingDamage(game: Game): Map<Slot, number> {
  const out = new Map<Slot, number>();
  for (const spec of game.attackTargets()) {
    const dmg = spec.hidden ? 5 : spec.damage ?? 0;
    out.set(spec.slot, (out.get(spec.slot) ?? 0) + dmg);
  }
  return out;
}

// Members in the order we care about saving them from a lethal blow: the fragile,
// high-value DPS first, the tank/soak last. #38: value it by actual strike (damage
// desc) instead of fixed trio slots — a drafted party may seat its 7-damage Warlock
// or 5-damage Mage at center, and the old slot order (RIGHT, LEFT, CENTER) would
// then save the party's best striker LAST as if it were the tank. For the classic
// trio this still yields mage(5) > ranger(4) > tank(2) = the original order.
function saveOrder(game: Game): Member[] {
  return game.livingMembers().sort((a, b) => game.memberDamage(b) - game.memberDamage(a));
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
  const idx = abilityCardIndex(game, 'taunt');
  if (!affordable(game, idx)) return false;
  game.playCard(idx);
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
    const idx = abilityCardIndex(game, 'taunt');
    if (affordable(game, idx)) { game.playCard(idx); return true; }
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

// Taunt-lite for a taunt-less draft (#31, lined for #34): with no Tank ability in
// the party, Provoke is the redirection tool — make the most DURABLE living member
// the enemy's aim (bundled +1 Defense) so the fragile strikers stop eating the
// heavy/sweep. Only run it when there is no real Taunt in the party (a Tank does it
// better and cheaper via its ability), nobody is already provoked, and it is worth a
// card (a boss, or the party already taking damage) — mirrors tryRetaunt's discipline.
function tryProvoke(game: Game): boolean {
  if (game.members.some((m) => m.alive && m.ability === 'taunt')) return false;
  const living = game.livingMembers();
  if (living.length <= 1) return false; // nothing to redirect hits away from
  if (living.some((m) => m.taunt > 1)) return false;
  const anyoneHurt = living.some((m) => m.hp < m.maxHP * 0.5);
  if (!game.config.enemy.boss && !anyoneHurt) return false;
  const idx = handIndexOf(game, 'provoke');
  if (!affordable(game, idx)) return false;
  // The sink is the most DURABLE living member (highest maxHP). (#39: the Warlock is
  // now a fragile 14-HP controller, so the maxHP sort naturally keeps hits off him.)
  const sink = [...living].sort((a, b) => b.maxHP - a.maxHP)[0];
  game.playCard(idx, sink.slot);
  return true;
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

// Revive a fallen member once no live member is about to die. A death is already
// a permanent scar (DR1), but a dead body is also lost output for the rest of the
// fight — and losing the fight is worse than the scar. At 4 MP (the #18 rework)
// putting a high-value DPS back on the field to help win the race is worth it, so
// long as the living are safe first. Revives the highest-value dead member.
function tryResurrect(game: Game): boolean {
  const order: Slot[] = [SLOT.RIGHT, SLOT.LEFT, SLOT.CENTER]; // mage, ranger, tank by output
  // An incapacitated member ('incapacitate' injury mode) cannot be revived —
  // targeting one would fail canPlay and this tactic would claim a turn it
  // didn't take (a spin). Skip them.
  const dead = order.map((s) => game.members[s]).find((m) => !m.alive && !m.incapacitated);
  if (!dead) return false;
  if (channelThreatUnanswered(game)) return false;
  const incoming = incomingDamage(game);
  if (saveOrder(game).some((m) => !m.shield && (incoming.get(m.slot) ?? 0) >= m.hp)) return false; // save the living first
  const idx = handIndexOf(game, 'resurrect');
  if (!affordable(game, idx)) return false;
  game.playCard(idx, dead.slot);
  return true;
}

// Race the enemy down with the mage's Bolt when Charge is worth spending (or
// when it lands the kill).
function tryBolt(game: Game): boolean {
  // Find the Bolt member by ability, not slot — a drafted party may not seat the
  // mage at RIGHT (or seat one at all). For the classic trio this is the mage at
  // RIGHT, so the trio's line is unchanged.
  const mage = memberByAbility(game, 'bolt');
  if (!mage) return false;
  const idx = abilityCardIndex(game, 'bolt');
  if (!affordable(game, idx)) return false;
  const dmg = BOLT_BASE + mage.abilityPower + BOLT_CHARGE_MULT * mage.charge;
  if (dmg >= game.enemy.hp) { game.playCard(idx); return true; } // the kill ends it now
  if (channelThreatUnanswered(game)) return false;
  if (mage.charge >= Math.min(BOLT_CHARGE_GATE, CHARGE_MAX)) {
    game.playCard(idx);
    return true;
  }
  return false;
}

// Keep Poison ticking on the enemy for steady chip damage.
function tryPoison(game: Game): boolean {
  if (game.enemy.poisonTurns > 0) return false;
  // Find the Poison member by ability, not slot (see tryBolt). Classic trio: the
  // ranger at LEFT, so unchanged.
  const ranger = memberByAbility(game, 'poison');
  if (!ranger) return false;
  if (channelThreatUnanswered(game)) return false;
  const idx = abilityCardIndex(game, 'poison');
  if (!affordable(game, idx)) return false;
  game.playCard(idx);
  return true;
}

// Heal the most-hurt member that has dropped below the comfort threshold. Once
// lethal blows are covered, this keeps everyone (and their party-phase damage)
// alive without over-spending on members who are merely scratched.
function tryHeal(game: Game): boolean {
  const [, band2] = game.berserkerThresholds();
  let worst: Member | null = null;
  let worstFrac = SAFE_FRACTION;
  for (const m of game.livingMembers()) {
    // Band-riding (#28/#34): the Berserker hits harder the LOWER his HP, so healing
    // him is friendly fire — leave him in his rage band. tryPreventLethal still saves
    // him from a previewed killing blow; only pull him out of the deepest band (below
    // band2, one bad roll from death) proactively.
    if (m.ability === 'rampage' && m.hp > band2) continue;
    const frac = m.hp / m.maxHP;
    if (frac < worstFrac) { worst = m; worstFrac = frac; }
  }
  if (!worst) return false;
  const missing = worst.maxHP - worst.hp;
  const prefer: CardId[] = missing >= 4 ? ['highHeal', 'aoeHeal', 'regen', 'lowHeal']
    : ['lowHeal', 'regen', 'aoeHeal', 'highHeal'];
  for (const id of prefer) {
    if (id === 'regen' && worst.regen > 0) continue;
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
  if (!tank.alive || tank.regen > 0) return false;
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
// The living member whose ability matches, or null. Post-demo roster members
// (#27-#29) can occupy any slot, so tactics find them by ability, not slot.
function memberByAbility(game: Game, ability: AbilityId): Member | null {
  return game.members.find((m) => m.alive && m.ability === ability) ?? null;
}

// Warlock Hex (#39): curse the enemy with Vulnerability so the party deals more
// damage — the bonus is bigger the fewer members are fielded. Keep it up: cast when
// the enemy isn't already amplified and no channel needs the MP first, so the boost
// is live for this phase's party strikes (and every downstream damage source).
function tryHex(game: Game): boolean {
  const w = memberByAbility(game, 'hex');
  if (!w) return false;
  if (game.enemy.vulnerableTurns > 1) return false; // already Vulnerable; don't waste a card
  if (channelThreatUnanswered(game)) return false;
  const idx = abilityCardIndex(game, 'hex');
  if (!affordable(game, idx)) return false;
  game.playCard(idx);
  return true;
}

// Skald turn-shaping (#27, re-lined for #34): his party-phase strike is
// 2×(cards played this phase), so his damage is something the policy BUILDS — play
// Crescendo early (it draws 2 AND counts as a card, so it both feeds the strike and
// refills the hand to play more), then let the other tactics spend those cards, then
// he strikes for the accumulated count. Fire it whenever it is affordable without
// stranding us at 0 MP and no channel needs answering first — the draw makes it
// close to free, and every card played this phase compounds his hit.
function tryCrescendo(game: Game): boolean {
  const s = memberByAbility(game, 'crescendo');
  if (!s) return false;
  if (channelThreatUnanswered(game)) return false;
  const idx = abilityCardIndex(game, 'crescendo');
  if (!affordable(game, idx)) return false;
  if (game.mp - cardCost(game, idx) < 1) return false; // never strand ourselves at 0 MP
  game.playCard(idx);
  return true;
}

// Grave Chill timing (#28): the Augur's telegraph shave is the taunt-less draft's
// mitigation. Spend it on a genuinely big standing blow (a heavy/sweep), not a chip
// attack — one cast per pass, and the damage-floor stops it once the blow is blunted.
function tryGraveChill(game: Game): boolean {
  const augur = memberByAbility(game, 'graveChill');
  if (!augur) return false;
  const t = game.telegraph;
  if (!t || t.cast || t.damage < 5) return false; // only worth blunting a real threat
  const idx = abilityCardIndex(game, 'graveChill');
  if (!affordable(game, idx)) return false;
  game.playCard(idx);
  return true;
}

// Berserker band-riding (#28): Rampage doubles his CURRENT strike, so it is worth
// most in a rage band (low HP). Fire it for a kill, or when he is in a band and we
// keep a small MP reserve for answers/heals. The self-damage clamps (never lethal).
function tryRampage(game: Game): boolean {
  const b = memberByAbility(game, 'rampage');
  if (!b) return false;
  const idx = abilityCardIndex(game, 'rampage');
  if (!affordable(game, idx)) return false;
  const dmg = 2 * game.memberDamage(b) + b.abilityPower;
  if (dmg >= game.enemy.hp) { game.playCard(idx); return true; } // the kill ends it now
  if (channelThreatUnanswered(game)) return false;
  const [band1] = game.berserkerThresholds();
  if (b.hp <= band1 && game.mp >= 4) { game.playCard(idx); return true; }
  return false;
}

// Beast Warden re-summon timing (#29): keep a Boar standing — it soaks whole hits
// aimed at her slot AND lends +4 strike, so the moment it is down (killed or
// expired) call another. Bounded (returns false once one stands).
function tryCallBoar(game: Game): boolean {
  const warden = memberByAbility(game, 'callBoar');
  if (!warden || warden.boarHp > 0) return false;
  if (channelThreatUnanswered(game)) return false; // answer a channel first
  const idx = abilityCardIndex(game, 'callBoar');
  if (!affordable(game, idx)) return false;
  game.playCard(idx);
  return true;
}

// Skald tempo (#38): his party-phase strike is 2×(cards played this phase), so a
// Rest turn zeroes his damage. When a Skald is alive, the party is safe, and MP is
// near full (a Rest would bank almost nothing anyway), spend a cheap card to keep his
// strike fed instead of resting to 0 — Battle Hymn is ideal (it counts a card AND
// buffs every member's auto this phase). Bounded: stops once his strike is (about)
// capped, so it can't loop, and it is the LAST tactic, so it only ever replaces a Rest.
function trySkaldTempo(game: Game): boolean {
  const s = memberByAbility(game, 'crescendo');
  if (!s) return false;
  if (channelThreatUnanswered(game)) return false;
  if (game.mp < game.maxMana - 1) return false; // only spend "free" MP a Rest wouldn't recover
  if (game.cardsPlayedThisPhase >= SKALD_DMG_CAP / SKALD_DMG_PER_CARD) return false; // strike already maxed
  const incoming = incomingDamage(game);
  if (saveOrder(game).some((m) => !m.shield && (incoming.get(m.slot) ?? 0) >= m.hp)) return false; // never feed into a death
  // Battle Hymn first (buffs the whole party's strike); else a cheap card with a
  // guaranteed-valid target (a living member) so the play never no-ops into a spin.
  const hymn = handIndexOf(game, 'battleHymn');
  if (affordable(game, hymn)) { game.playCard(hymn, null); return true; }
  const hurt = [...game.livingMembers()].sort((a, b) => a.hp / a.maxHP - b.hp / b.maxHP)[0];
  for (const id of ['brace', 'lowHeal'] as CardId[]) {
    const idx = handIndexOf(game, id);
    if (affordable(game, idx) && hurt) { game.playCard(idx, hurt.slot); return true; }
  }
  return false;
}

const TACTICS: Array<(game: Game) => boolean> = [
  tryBraceChannel, tryRetaunt, tryProvoke, tryPreventLethal, tryGraveChill, tryCallBoar, tryCleanse, tryGroupHeal, tryResurrect,
  // Hex before offense so the Vulnerability amplifies this phase's strikes (#39).
  tryHex, tryBolt, tryPoison, tryRampage, tryCrescendo, tryHeal, tryRegenTank, tryRefresh, trySkaldTempo,
];

// Play a single player phase to a natural close (rest or end turn).
function takeFightTurn(game: Game): void {
  // A heuristic policy must always make progress toward ending the turn; this guard
  // is a backstop so a mis-registered tactic can never hang the sim (it would leave
  // status 'playing', which the caller reads as a loss).
  let guard = 0;
  while (game.phase === 'player') {
    let acted = false;
    for (const tactic of TACTICS) {
      if (tactic(game)) { acted = true; break; }
    }
    if (!acted || ++guard > 200) break;
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

// Buy-value of each card the shops can sell (higher = buy first). Refresh feeds
// the MP economy. Per-member ability cards (#44) are never shopped (0, inert).
const CARD_BUY_VALUE: Record<CardId, number> = {
  fontOfMana: 8, refresh: 7, highHeal: 6, shield: 5, cleanse: 5, aoeHeal: 4, regen: 3, resurrect: 2,
  // Phase-A/B cards (#15/#16) the fight policy has no tactic for yet stay below
  // the buy threshold — a card the policy never plays is dead deck weight.
  overgrowth: 2, bloom: 2, inspiration: 2, cultivate: 1, lowHeal: 1,
  lifebloom: 2, surge: 2, battleHymn: 2, barrier: 2, bloodTithe: 2, martyrsGift: 2, grimHarvest: 2,
  phalanx: 2, brace: 2, provoke: 2,
  // Small-party cards (#42): the best-3 policy never fields small, so it has no
  // tactic for them — low buy value (they're for a human's undermanned build).
  rally: 1, focus: 1, channel: 1, holdTheLine: 1,
  // Ability cards (#44) — inserted per-fight, never bought.
  imbuePoison: 0, bolster: 0, unleash: 0, hex: 0, conduct: 0, incite: 0, hush: 0, beckon: 0,
};
const MAX_CARDS_PER_SHOP = 2; // stay selective so the deck doesn't dilute ability draws

// Desirability of each healer stat when buying upgrades.
const HEALER_STAT_VALUE: Record<string, number> = {
  passiveMp: 4, maxMana: 3, restRegen: 2, handSize: 1,
};

// Provoke is dead weight for a party that already has the Tank's Taunt, but on a
// TAUNT-LESS draft (#34) it is the only redirection tool — value it like a core
// ability card so the taunt-less floor actually gets to play its mitigation.
function partyIsTauntless(run: Run): boolean {
  return !run.party.some((_, slot) => memberDefAt(run.party, slot).ability === 'taunt');
}

function cardBuyValue(run: Run, id: CardId): number {
  if (id === 'provoke' && partyIsTauntless(run)) return 6;
  return CARD_BUY_VALUE[id];
}

function shopCardNode(run: Run): void {
  if (run.nodeContent?.type !== 'cardShop') return;
  let bought = 0;
  while (bought < MAX_CARDS_PER_SHOP) {
    const offers = run.nodeContent.offers;
    // Best affordable, worthwhile offer (skip low-value filler like lowHeal).
    let best = -1, bestVal = 2;
    offers.forEach((o, i) => {
      if (o.price > run.gold) return;
      const v = cardBuyValue(run, o.cardId);
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
  if (best < 0 || run.roster.length === 0) return;
  // Target a member that actually exists in the (possibly small) roster: ability on a
  // striker (Poison/Bolt scale), damage/HP on the sturdiest body; else the first member.
  const def = offers[best].def;
  let target = 0;
  if (def.stat === 'ability') {
    const s = run.roster.findIndex((p) => p.member && CONVENTIONAL_STRIKERS.has(p.member));
    if (s >= 0) target = s;
  } else {
    for (let i = 1; i < run.roster.length; i++) if (run.roster[i].maxHP > run.roster[target].maxHP) target = i;
  }
  run.buyPartyOffer(best, target as Slot);
}

function shopModifierNode(run: Run): void {
  if (run.nodeContent?.type !== 'cardUpgrade') return;
  const offers = run.nodeContent.offers;
  // Apply the first affordable modifier to any card that can take it. (#44: ability
  // cards live only in the battle deck now, so there is no persistent ability card
  // to preferentially upgrade — the general fallback is all that remains.)
  for (let i = 0; i < offers.length; i++) {
    if (offers[i].price > run.gold) continue;
    const mod = offers[i].modifier;
    const target = run.deck.find((c) => run.eligibleModifiersFor(c).includes(mod));
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
  // Curses are deliberate player trades; the fixed policy never buys one.
  pactOfSilence: 0, crackedHourglass: 0, rustyCrown: 0,
  // Small-party relics (#42): the best-3 policy never fields small, so it can't use
  // these — value 0 (they're a human undermanned-build reward, exercised via #42's gate).
  loneWolf: 0, focusStone: 0, warband: 0,
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

// The most-injured member's slot, or -1 if the party is unscarred (DR1).
function mostInjuredSlot(run: Run): number {
  let slot = -1;
  let most = 0;
  for (let s = 0; s < run.party.length; s++) {
    if (run.party[s].injuries > most) { most = run.party[s].injuries; slot = s; }
  }
  return slot;
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
      case 'shrineParty': run.shrineBlessMember(Math.min(SLOT.CENTER, run.roster.length - 1) as Slot); return;
      case 'shrineCard': {
        const eligible = run.shrineEligibleCards();
        if (eligible.length) { run.shrineBlessCard(eligible[0].uid); return; }
        break;
      }
      case 'healInjury': { // Field Hospital (DR1): a free scar heal — always take it if wounded
        const slot = mostInjuredSlot(run);
        if (slot >= 0) { run.healInjury(slot as Slot); return; }
        break;
      }
      default: break;
    }
  }
  // Nothing worthwhile (or only a card-removal we don't need) — move on.
}

// ---- roster / draft / deploy policy (2026-07 campaign) ---------------------

// A roster member's value to the good player: its draft rating, docked for scars.
function memberValue(p: { member?: MemberId; injuries: number }): number {
  return (p.member ? DRAFT_RATING[p.member] : 0) - p.injuries;
}

// Draft pick: take the strongest offered member, but prioritise a striker while the
// roster still lacks one (a comp with no poison/bolt loses the F8 race — #38).
export function draftPick(run: Run): void {
  if (run.location.kind !== 'draft' || run.nodeContent?.type !== 'draft') return;
  const opts = run.nodeContent.options;
  if (opts.length === 0) return;
  const needStriker = !run.roster.some((p) => p.member && CONVENTIONAL_STRIKERS.has(p.member));
  let best = opts[0], bestScore = -Infinity;
  for (const id of opts) {
    const score = (DRAFT_RATING[id] ?? 0) + (needStriker && CONVENTIONAL_STRIKERS.has(id) ? 10 : 0);
    if (score > bestScore) { bestScore = score; best = id; }
  }
  run.chooseDraftMember(best);
}

// Recruit node: the good player grows the roster (bodies + replacements after a
// permanent death), taking the strongest offered member up to a sensible cap.
export function recruitPick(run: Run): void {
  if (run.nodeContent?.type !== 'recruit' || run.nodeContent.done) return;
  const opts = run.nodeContent.options;
  if (opts.length === 0 || run.roster.length >= 6) return;
  let best = opts[0], bestScore = -Infinity;
  for (const id of opts) {
    const score = DRAFT_RATING[id] ?? 0;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  run.recruitMember(best);
}

// Deploy: field the best (up to) three roster members by value, seating a taunt
// member (else the highest-HP body) in the center where the enemy aims most.
export function deployBest(run: Run): void {
  if (run.location.kind !== 'deploy') return;
  const ranked = run.roster
    .map((p, ri) => ({ ri, p }))
    .sort((a, b) => memberValue(b.p) - memberValue(a.p));
  const top = ranked.slice(0, 3);
  if (top.length === 0) { run.confirmDeployment(run.deployment); return; }
  // Anchor: a taunt member if we have one, else the highest-HP body.
  let anchor = top.findIndex((t) => t.p.member && MEMBER_POOL[t.p.member].ability === 'taunt');
  if (anchor < 0) {
    anchor = 0;
    for (let i = 1; i < top.length; i++) if (top[i].p.maxHP > top[anchor].p.maxHP) anchor = i;
  }
  const deploy: (number | null)[] = [null, null, null];
  deploy[SLOT.CENTER] = top[anchor].ri;
  const rest = top.filter((_, i) => i !== anchor).map((t) => t.ri);
  if (rest[0] != null) deploy[SLOT.LEFT] = rest[0];
  if (rest[1] != null) deploy[SLOT.RIGHT] = rest[1];
  run.confirmDeployment(deploy);
}

export function resolveNode(run: Run): void {
  switch (run.nodeContent?.type) {
    case 'cardShop': shopCardNode(run); break;
    case 'healerUpgrade': shopHealerNode(run); break;
    case 'partyUpgrade': shopPartyNode(run); break;
    case 'cardUpgrade': shopModifierNode(run); break;
    case 'event': resolveEvent(run); break;
    case 'reliquary': shopReliquary(run); break;
    case 'recruit': recruitPick(run); break;
    default: break;
  }
}

// Score a branch by the permanent power its nodes offer, so the policy walks the
// stronger path through each fork.
const NODE_DESIRABILITY: Record<string, number> = {
  partyUpgrade: 5, healerUpgrade: 5, reliquary: 5, recruit: 4, cardUpgrade: 4, cardShop: 3, event: 2, fight: 0,
};

// Walk the chosen branch's hub one step per driver tick: enter the first
// unvisited stop that's open (a full-roster Recruit node hides), or head to the
// next fight once every stop has been seen. The policy never revisits — cached
// content means a second look buys nothing.
export function advanceBranch(run: Run): void {
  if (run.location.kind !== 'branch') return;
  const { forkIndex, branch } = run.location;
  const nodes = run.map[forkIndex].branches[branch].nodes;
  for (let i = 0; i < nodes.length; i++) {
    if (run.branchContent[i] == null && run.nodeAvailable(nodes[i].type)) { run.enterNode(i); return; }
  }
  run.startNextFight();
}

export function chooseBranch(run: Run): number {
  if (run.location.kind !== 'forkChoice') return 0;
  const fork = run.map[run.location.forkIndex];
  const worth = (t: string): number => NODE_DESIRABILITY[t] ?? 0;
  let best = 0, bestScore = -Infinity;
  fork.branches.forEach((b, i) => {
    const score = b.nodes.reduce((s, n) => s + worth(n.type), 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}
