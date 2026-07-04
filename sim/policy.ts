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
  BARGAIN_HP_BASE, BARGAIN_HP_GROWTH, BARGAIN_MP, TITHE_AMOUNT, memberDefAt,
} from '../src/constants';
import type { CardId, Slot, RelicId, AbilityId } from '../src/constants';

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

// Taunt-lite for a taunt-less draft (#31, lined for #34): with no Tank ability in
// the party, Provoke is the redirection tool — make the most DURABLE living member
// the enemy's aim (bundled +1 Defense) so the fragile strikers stop eating the
// heavy/sweep. Only run it when there is no real Taunt in the party (a Tank does it
// better and cheaper via its ability), nobody is already provoked, and it is worth a
// card (a boss, or the party already taking damage) — mirrors tryRetaunt's discipline.
function tryProvoke(game: Game): boolean {
  if (game.members.some((m) => m.alive && m.ability === 'taunt')) return false;
  if (game.livingMembers().some((m) => m.taunt > 1)) return false;
  const anyoneHurt = game.livingMembers().some((m) => m.hp < m.maxHP * 0.5);
  if (!game.config.enemy.boss && !anyoneHurt) return false;
  const idx = handIndexOf(game, 'provoke');
  if (!affordable(game, idx)) return false;
  // The sink is the highest-maxHP living member (the seated tank-substitute).
  const sink = [...game.livingMembers()].sort((a, b) => b.maxHP - a.maxHP)[0];
  if (!sink) return false;
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
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  const dmg = BOLT_BASE + mage.abilityPower + BOLT_CHARGE_MULT * mage.charge;
  if (dmg >= game.enemy.hp) { game.playCard(idx, mage.slot); return true; } // the kill ends it now
  if (channelThreatUnanswered(game)) return false;
  if (mage.charge >= Math.min(BOLT_CHARGE_GATE, CHARGE_MAX)) {
    game.playCard(idx, mage.slot);
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
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  game.playCard(idx, ranger.slot);
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
// The living member whose ability matches, or null. Post-demo roster members
// (#27-#29) can occupy any slot, so tactics find them by ability, not slot.
function memberByAbility(game: Game, ability: AbilityId): Member | null {
  return game.members.find((m) => m.alive && m.ability === ability) ?? null;
}

// Warlock as a planned MP engine (#27, re-lined for #34): Dark Bargain trades HP
// for MP and the cost GROWS each cast, so the value is FRONT-LOADED — bargain a
// couple of times while he is near full and the cost is cheapest (cast 0 = 3 HP,
// cast 1 = 6), banking MP the healer can spend on the opening turns, then STOP
// before the growth curve (and Soul Tithe) eat his 7-damage body. Only when the MP
// has somewhere to go (headroom) and he keeps a real cushion above the cost + tithe.
function tryDarkBargain(game: Game): boolean {
  const w = memberByAbility(game, 'darkBargain');
  if (!w) return false;
  if (channelThreatUnanswered(game)) return false;
  if (game.mp + BARGAIN_MP > game.maxMana) return false; // no room to bank the MP
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  const cost = BARGAIN_HP_BASE + BARGAIN_HP_GROWTH * w.bargainCasts;
  // Front-load only: cap the casts, and keep him well clear of the danger zone
  // (the cost itself plus a Soul-Tithe turn plus a margin) so a bargain never
  // strands the party's biggest striker one blow from death.
  if (w.bargainCasts >= 2) return false;
  if (w.hp - cost < cost + TITHE_AMOUNT + 4) return false;
  game.playCard(idx, w.slot);
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
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  if (game.mp - cardCost(game, idx) < 1) return false; // never strand ourselves at 0 MP
  game.playCard(idx, s.slot);
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
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  game.playCard(idx, augur.slot);
  return true;
}

// Berserker band-riding (#28): Rampage doubles his CURRENT strike, so it is worth
// most in a rage band (low HP). Fire it for a kill, or when he is in a band and we
// keep a small MP reserve for answers/heals. The self-damage clamps (never lethal).
function tryRampage(game: Game): boolean {
  const b = memberByAbility(game, 'rampage');
  if (!b) return false;
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  const dmg = 2 * game.memberDamage(b) + b.abilityPower;
  if (dmg >= game.enemy.hp) { game.playCard(idx, b.slot); return true; } // the kill ends it now
  if (channelThreatUnanswered(game)) return false;
  const [band1] = game.berserkerThresholds();
  if (b.hp <= band1 && game.mp >= 4) { game.playCard(idx, b.slot); return true; }
  return false;
}

// Beast Warden re-summon timing (#29): keep a Boar standing — it soaks whole hits
// aimed at her slot AND lends +4 strike, so the moment it is down (killed or
// expired) call another. Bounded (returns false once one stands).
function tryCallBoar(game: Game): boolean {
  const warden = memberByAbility(game, 'callBoar');
  if (!warden || warden.boarHp > 0) return false;
  if (channelThreatUnanswered(game)) return false; // answer a channel first
  const idx = handIndexOf(game, 'ability');
  if (!affordable(game, idx)) return false;
  game.playCard(idx, warden.slot);
  return true;
}

const TACTICS: Array<(game: Game) => boolean> = [
  tryBraceChannel, tryRetaunt, tryProvoke, tryPreventLethal, tryGraveChill, tryCallBoar, tryCleanse, tryGroupHeal, tryResurrect,
  tryBolt, tryPoison, tryRampage, tryDarkBargain, tryCrescendo, tryHeal, tryRegenTank, tryRefresh,
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

// Buy-value of each card the shops can sell (higher = buy first). Ability cards
// feed the Taunt/Bolt/Poison line; Refresh feeds the MP economy.
const CARD_BUY_VALUE: Record<CardId, number> = {
  ability: 9, fontOfMana: 8, refresh: 7, highHeal: 6, shield: 5, cleanse: 5, aoeHeal: 4, regen: 3, resurrect: 2,
  // Phase-A/B cards (#15/#16) the fight policy has no tactic for yet stay below
  // the buy threshold — a card the policy never plays is dead deck weight.
  overgrowth: 2, bloom: 2, inspiration: 2, cultivate: 1, lowHeal: 1,
  lifebloom: 2, surge: 2, battleHymn: 2, barrier: 2, bloodTithe: 2, martyrsGift: 2, grimHarvest: 2,
  phalanx: 2, brace: 2, provoke: 2,
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
  // DR1: with scars now a real, compounding cost, a free scar-heal every victory
  // is a strong anti-spiral pick — valued alongside the top defensive relics.
  mendingTotem: 8,
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

// The most-injured member's slot, or -1 if the party is unscarred (DR1).
function mostInjuredSlot(run: Run): number {
  let slot = -1;
  let most = 0;
  for (let s = 0; s < run.party.length; s++) {
    if (run.party[s].injuries > most) { most = run.party[s].injuries; slot = s; }
  }
  return slot;
}

// Infirmary (DR1): an unhealed scar is a permanent stat loss, so once wounded the
// good player pays it down rather than hoarding gold. Clear the most-injured
// member's scars while gold lasts (top of the ladder first).
function shopInfirmaryNode(run: Run): void {
  if (run.nodeContent?.type !== 'infirmary') return;
  let guard = 0;
  while (guard++ < 12) {
    const slot = mostInjuredSlot(run);
    if (slot < 0 || !run.clearInjuryForGold(slot as Slot)) break;
  }
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

export function resolveNode(run: Run): void {
  switch (run.nodeContent?.type) {
    case 'cardShop': shopCardNode(run); break;
    case 'healerUpgrade': shopHealerNode(run); break;
    case 'partyUpgrade': shopPartyNode(run); break;
    case 'cardUpgrade': shopModifierNode(run); break;
    case 'event': resolveEvent(run); break;
    case 'reliquary': shopReliquary(run); break;
    case 'infirmary': shopInfirmaryNode(run); break;
    default: break;
  }
}

// Score a branch by the permanent power its nodes offer, so the policy walks the
// stronger path through each fork. The Infirmary is scored dynamically (below):
// worthless when the party is whole, valuable once it is carrying scars.
const NODE_DESIRABILITY: Record<string, number> = {
  partyUpgrade: 5, healerUpgrade: 5, reliquary: 5, cardUpgrade: 4, cardShop: 3, event: 2, infirmary: 0, fight: 0,
};

export function chooseBranch(run: Run): number {
  if (run.location.kind !== 'forkChoice') return 0;
  const fork = run.map[run.location.forkIndex];
  // An unhealed scar is a permanent stat loss, so a wounded party values a detour
  // to the Infirmary — the more (and deeper) the scars, the more it is worth.
  const injuries = run.party.reduce((s, p) => s + p.injuries, 0);
  const worth = (t: string): number => (t === 'infirmary' && injuries > 0 ? 5 + injuries : (NODE_DESIRABILITY[t] ?? 0));
  let best = 0, bestScore = -Infinity;
  fork.branches.forEach((b, i) => {
    const score = b.nodes.reduce((s, n) => s + worth(n.type), 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}
