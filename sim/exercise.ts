// Mechanic-coverage harness (sim playtest follow-up to finding 4). The fixed
// winrate policy (policy.ts) is a NARROW "good player": it only ever plays ~6
// cards and never touches the Regen/Blood/Bulwark lines, curses, or several
// relics — so all that content ships unit-tested but never shaken out through a
// live fight loop. This harness is the opposite of a measuring stick: it exists
// to DRIVE every mechanic through real gameplay, so integration bugs surface and
// dead content can't creep back in.
//
// Two pieces:
//   1. A card exerciser — a deliberately promiscuous fight driver that plays
//      every card in a stacked deck across a few live fights (reporting which it
//      played and which crashed).
//   2. Relic/curse drive-throughs — one focused live scenario per relic that
//      starts a real Game with it equipped and observes its effect through the
//      public API (the same surfaces the UI reads).
//
// `test/coverage.test.ts` asserts the union covers every card, ability, relic,
// and curse with zero crashes — the permanent guard for finding 4.
//
// Pure and DOM-free like the rest of sim/. Run it: `npm run coverage`.

import { Game } from '../src/engine';
import type { Telegraph } from '../src/engine';
import { Run } from '../src/run';
import {
  CARDS, RELIC_IDS, RELICS, SLOT, RARITY_PRICE, GROUNDING_ROD_REDUCTION,
  POISON_BASE, RUSTY_CROWN_ATTACK, CRACKED_HOURGLASS_ENRAGE, injuryRecordCap,
  DEFAULT_ENEMY_DEF, HEXWEAVER_DEF, makeDeckCard, resolveCard, defaultBattleConfig, isAbilityCard,
  MEMBER_POOL, LONE_WOLF_DMG, FOCUS_STONE_MP, WARBAND_HP_PER_SEAT,
  SHADOW_BOLT_DMG, HOLY_RELIC_HEAL, SHADOW_RELIC_DMG, IRON_RELIC_DISCOUNT,
  WHETSTONE_BONUS, OSSUARY_REGEN, POISON_TURNS, VENOM_GLAND_BONUS_TURNS, EMBERMARK_DMG,
} from '../src/constants';
import type {
  CardId, AbilityId, RelicId, MemberId, BattleConfig, Slot, DeckCard,
} from '../src/constants';

export interface Coverage {
  cardsPlayed: Set<CardId>;
  abilitiesFired: Set<AbilityId>;
  relicsFired: Set<RelicId>;
  cursesFired: Set<RelicId>;
  dr1Fired: Set<string>; // injury avenues driven end-to-end (permanent death / Field Hospital)
  crashes: Array<{ where: string; error: string }>;
}

const ALL_CARDS = Object.keys(CARDS) as CardId[];
const ALL_ABILITIES: AbilityId[] = ['poison', 'taunt', 'bolt'];

// A deck with at least one of every core card, plus a few enablers: the classic
// trio's bound ability cards (#44) to fire Poison/Taunt/Bolt, and Regen sources so
// Cultivate/Bloom (which require an active Regen on their target) always have fodder.
const EXERCISE_DECK: CardId[] = [
  'imbuePoison', 'bolster', 'unleash',
  'regen', 'regen', 'lifebloom', 'overgrowth', 'cultivate', 'bloom',
  'lowHeal', 'highHeal', 'highHeal', 'aoeHeal', 'shield', 'resurrect', 'refresh', 'cleanse',
  'fontOfMana', 'inspiration', 'surge', 'battleHymn', 'barrier',
  'bloodTithe', 'martyrsGift', 'grimHarvest', 'phalanx', 'brace', 'provoke',
  // Iron mitigation web (#65).
  'feint', 'anvilStance', 'interlock',
  // Regen conversions (#66): both consume/read an active Regen (the seeded Regen fodder above).
  'thornskin', 'sporeburst',
  // Status-window management (#67): Hemorrhage needs enemy poison (imbuePoison seeds it),
  // Umbral Feast reads the board, Dread Whisper shaves the telegraph.
  'hemorrhage', 'umbralFeast', 'dreadWhisper',
  // Shadow cards (#63).
  'shadowBolt', 'siphonLife', 'doom',
  // Count-based payoff cards (#63).
  'cascade', 'nightfall',
  // Channeled cards (#64): Refresh (above) is reworked into one; these are the four new.
  'drain', 'mendingStream', 'sap', 'fortify',
  'rally', 'focus', 'channel', 'holdTheLine',
  // Hero buff card batch (#62).
  'guard', 'sharpen', 'goad', 'doubleStrike', 'embolden', 'empower', 'riposte',
];

// A generous healer + a high-HP, low-threat enemy, so a fight lasts long enough
// to cycle the whole deck and MP never gates a play we want to make.
function exerciseConfig(relics: RelicId[] = [], enemy: Partial<BattleConfig['enemy']> = {}): BattleConfig {
  const cfg = defaultBattleConfig();
  cfg.deck = EXERCISE_DECK.map((id, i) => makeDeckCard(id, i));
  cfg.healer = { maxMana: 12, handSize: 4, restRegen: 6, passiveMp: 2 };
  cfg.relics = relics;
  cfg.enemy = { maxHP: 500, boss: false, attackBonus: 0, def: DEFAULT_ENEMY_DEF, enrageTurn: 99, ...enemy };
  return cfg;
}

// The legal target for a hand card, or null if it cannot be played right now.
// Wrapped in an object because `null` (no-target cards) is itself a valid target.
function legalPlay(game: Game, handIndex: number): { target: number | null } | null {
  const card = resolveCard(game.hand[handIndex]);
  if (card.target === 'none' || card.target === 'all') {
    return game.canPlay(handIndex, null) === null ? { target: null } : null;
  }
  if (card.target === 'dead') {
    for (const m of game.members) if (!m.alive && game.canPlay(handIndex, m.slot) === null) return { target: m.slot };
    return null;
  }
  for (const m of game.members) if (m.alive && game.canPlay(handIndex, m.slot) === null) return { target: m.slot };
  return null;
}

// Record a successful play in the coverage set — including which ability fired
// (#44: ability cards are bound, so the card id carries the ability).
function recordPlay(dc: DeckCard, cov: Coverage): void {
  cov.cardsPlayed.add(dc.id);
  const ability = CARDS[dc.id].ability;
  if (ability) cov.abilitiesFired.add(ability);
}

// Make one play this phase, biased to a card we have not yet exercised. Returns
// false when nothing playable remains (the turn should end).
function exerciseOnePlay(game: Game, cov: Coverage): boolean {
  // Pass 0 — seed Regen fodder. Since #52 shortened Regen durations (magnitude ==
  // duration: a fresh Regen 2 lasts only 2 ticks), incidental Regen can expire
  // before a needsRegen consumer (Cultivate / Bloom) is drawn. If such a consumer
  // is in hand but stuck for lack of an active Regen, cast a Regen source first.
  const stuckConsumer = game.hand.some(
    (dc, i) => !cov.cardsPlayed.has(dc.id) && CARDS[dc.id].needsRegen && legalPlay(game, i) === null);
  if (stuckConsumer) {
    for (let i = 0; i < game.hand.length; i++) {
      const dc = game.hand[i];
      if (CARDS[dc.id].regen == null) continue; // only Regen-granting cards
      const p = legalPlay(game, i);
      if (p && game.playCard(i, p.target).ok) { recordPlay(dc, cov); return true; }
    }
  }
  // Pass 1 — a not-yet-played card (ability cards self-resolve on their bound member).
  for (let i = 0; i < game.hand.length; i++) {
    const dc = game.hand[i];
    if (cov.cardsPlayed.has(dc.id)) continue;
    const p = legalPlay(game, i);
    if (p && game.playCard(i, p.target).ok) { recordPlay(dc, cov); return true; }
  }
  // Pass 2 — any legal play, to keep drawing so the rest of the deck comes around.
  for (let i = 0; i < game.hand.length; i++) {
    const dc = game.hand[i];
    const p = legalPlay(game, i);
    if (p && game.playCard(i, p.target).ok) { recordPlay(dc, cov); return true; }
  }
  return false;
}

// Log substrings that only appear when a relic's effect actually resolves in a
// live fight — so scanning the fight log proves the relic fired.
const RELIC_LOG_MARK: Partial<Record<RelicId, string>> = {
  titheCandle: 'Tithe Candle',
  warDrum: 'War Drum',
  prayerBeads: 'Prayer Beads',
  echoLocket: 'Echo Locket',
  stormglass: 'Stormglass Mirror',
  aegisFont: 'Aegis Font',
  duskChime: 'Dusk Chime',
  martyrsIcon: "Martyr's Icon",
};

// Drive one exerciser fight to completion. `preKill` seeds a corpse so Resurrect
// becomes reachable. Any relic whose log-mark appears during the fight is
// recorded as fired (a bonus over the deterministic probes below).
function runExerciseFight(cfg: BattleConfig, cov: Coverage, where: string, preKill?: MemberId): void {
  try {
    const game = new Game(4242, cfg);
    game.start();
    if (preKill) game._killMember(game.memberById(preKill));
    let turns = 0;
    while (game.status === 'playing' && turns++ < 80) {
      // #53: passive MP now only lands on a restrained (≤1-card) turn, but the
      // exerciser deliberately plays many cards per phase, so it would otherwise
      // starve on MP and miss late plays (e.g. the Regen->Bloom setup). Keep the
      // harness's "MP never gates a play we want to make" invariant by topping the
      // pool up each turn — coverage stays decoupled from the MP economy.
      game.mp = game.maxMana;
      let plays = 0;
      while (game.phase === 'player' && plays++ < 40) {
        if (!exerciseOnePlay(game, cov)) break;
      }
      if (game.phase !== 'player') break;
      if (game.canSkip() && game.mp < game.maxMana) game.skipTurn();
      else game.endTurn();
    }
    for (const r of cfg.relics ?? []) {
      const mark = RELIC_LOG_MARK[r];
      if (mark && game.log.some((e) => e.text.includes(mark))) cov.relicsFired.add(r);
    }
  } catch (err) {
    cov.crashes.push({ where, error: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Relic / curse drive-throughs — one focused live scenario each, observed
// through the public API. Returns whether the relic's effect fired.
// ---------------------------------------------------------------------------

let probeUid = -1;
function give(game: Game, id: CardId): number {
  game.hand.push(makeDeckCard(id, probeUid--));
  return game.hand.length - 1;
}
function probeGame(relics: RelicId[], enemy: Partial<BattleConfig['enemy']> = {}): Game {
  const cfg = defaultBattleConfig();
  cfg.relics = relics;
  cfg.enemy = { ...cfg.enemy, ...enemy };
  return new Game(7, cfg);
}

// A SOLO fielded party (ranger + two empty seats), for the small-party relics (#42).
function smallProbeGame(relics: RelicId[]): Game {
  const cfg = defaultBattleConfig();
  cfg.relics = relics;
  const mkEmpty = () => ({ maxHP: 0, damage: 0, abilityPower: 0, injuries: 0, empty: true as const });
  cfg.party = [cfg.party[0], mkEmpty(), mkEmpty()];
  return new Game(7, cfg);
}
function single(damage: number, slot: Slot, type: Telegraph['type'] = 'single'): Telegraph {
  return { type, hidden: type === 'hidden', damage, targets: [slot], enraged: false, forTurn: 2 };
}
function sweep(damage: number): Telegraph {
  return { type: 'sweep', hidden: false, damage, targets: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT], enraged: false, forTurn: 2 };
}

const RELIC_PROBES: Record<RelicId, () => boolean> = {
  lantern: () => {
    const g = probeGame(['lantern']); g.start();
    g.telegraph = single(4, SLOT.LEFT, 'hidden');
    return g.attackTargets().length === 1; // revealed to the true target
  },
  hagglersCharm: () => {
    const run = new Run(3); run.addRelic('hagglersCharm');
    return run.rollCardShop().every((o) => o.price < RARITY_PRICE[o.rarity]);
  },
  titheCandle: () => {
    const g = probeGame(['titheCandle']); g.start(); g.mp = 0;
    g.telegraph = single(3, SLOT.CENTER); g._resolveAttack();
    return g.mp > 0;
  },
  fieldTriage: () => {
    const g = probeGame(['fieldTriage']); g.start(); g.tank.hp = 3;
    const before = g.tank.hp; g.playCard(give(g, 'lowHeal'), SLOT.CENTER);
    return g.tank.hp - before > (CARDS.lowHeal.heal ?? 0);
  },
  warDrum: () => {
    const g = probeGame(['warDrum']); g.start();
    g.playCard(give(g, 'bolster')); // Taunt primes the drum
    g.endTurn(); // the party phase resolves the doubled auto
    return g.log.some((e) => e.text.includes('War Drum'));
  },
  groundingRod: () => {
    const g = probeGame(['groundingRod']); g.start();
    g.telegraph = sweep(3);
    return g.attackTargets()[0]?.damage === 3 - GROUNDING_ROD_REDUCTION;
  },
  prayerBeads: () => {
    const g = probeGame(['prayerBeads']); g.start(); g.mp = 0;
    g.drawPile = []; g.discardPile.push(makeDeckCard('lowHeal', -1));
    g._drawOne();
    return g.mp > 0;
  },
  echoLocket: () => {
    const g = probeGame(['echoLocket']); g.start();
    const i = give(g, 'imbuePoison'); const uid = g.hand[i].uid;
    g.playCard(i); // Poison — the Locket returns it
    return g.hand.some((c) => c.uid === uid);
  },
  stormglass: () => {
    const g = probeGame(['stormglass']); g.start(); g.tank.hp = g.tank.maxHP;
    g.telegraph = single(7, SLOT.CENTER, 'heavy');
    const before = g.tank.hp; g._resolveAttack();
    return g.tank.hp === before && g.stormglassUsed;
  },
  vanguardsBanner: () => {
    const g = probeGame(['vanguardsBanner']); g.start(); g.tank.hp = g.tank.maxHP;
    return g.memberDamage(g.tank) > g.tank.damage;
  },
  aegisFont: () => {
    const g = probeGame(['aegisFont']); g.start(); g.tank.hp = g.tank.maxHP - 1;
    g.playCard(give(g, 'highHeal'), SLOT.CENTER); // heal 4, overheal 3 -> Ward
    return g.tank.ward > 0;
  },
  firstLightTaper: () => {
    const g = probeGame(['firstLightTaper']); g.start();
    const i = give(g, 'regen'); // cost 2, non-engine -> free as the first play
    return g.effectiveCost(resolveCard(g.hand[i])) === 0;
  },
  duskChime: () => {
    const g = probeGame(['duskChime']); g.start();
    for (const m of g.members) m.hp = m.maxHP;
    g.telegraph = sweep(5); // 5x3 = 15 >= the delay threshold
    const before = g.members.map((m) => m.hp);
    g._runEnemyPhase();
    return g.chimeUsed && g.members.every((m, i) => m.hp === before[i]);
  },
  martyrsIcon: () => {
    const g = probeGame(['martyrsIcon']); g.start();
    const died = g._killMember(g.mage);
    return !died && g.mage.alive && g.mage.hp === 1;
  },
  pactOfSilence: () => {
    const g = probeGame(['pactOfSilence']); g.start();
    return g.canSkip() === false; // the Pact forbids Rest
  },
  crackedHourglass: () => {
    const g = probeGame(['crackedHourglass']); g.start();
    if (g.enrageTurn > CRACKED_HOURGLASS_ENRAGE) return false;
    g._fireAbility(g.ranger);
    return g.enemy.poison > POISON_BASE; // +2 power
  },
  rustyCrown: () => {
    const base = new Game(7, defaultBattleConfig()).attackDamage('single', 1);
    const g = probeGame(['rustyCrown']); // normal enemy
    return g.attackDamage('single', 1) === base + RUSTY_CROWN_ATTACK;
  },
  // --- small-party relics (#42): probed with a SOLO fielded party ---------------
  loneWolf: () => {
    const g = smallProbeGame(['loneWolf']); g.start();
    return g.memberDamage(g.members[0]) === MEMBER_POOL.ranger.damage + LONE_WOLF_DMG;
  },
  focusStone: () => {
    const g = smallProbeGame(['focusStone']); g.start();
    const base = smallProbeGame([]).maxMana;
    return g.maxMana === base + FOCUS_STONE_MP;
  },
  warband: () => {
    const g = smallProbeGame(['warband']); g.start();
    // A solo deploy leaves 2 empty seats -> +WARBAND_HP_PER_SEAT * 2 max HP.
    return g.members[0].maxHP === MEMBER_POOL.ranger.maxHP + WARBAND_HP_PER_SEAT * 2;
  },
  // --- card-type synergy relics (#63) -------------------------------------------
  reliquaryOfLight: () => {
    const g = probeGame(['reliquaryOfLight']); g.start(); g.tank.hp = 1;
    const before = g.tank.hp; g.playCard(give(g, 'lowHeal'), SLOT.CENTER); // Holy heal
    return g.tank.hp - before === (CARDS.lowHeal.heal ?? 0) + HOLY_RELIC_HEAL;
  },
  shadowSigil: () => {
    const g = probeGame(['shadowSigil']); g.start(); g.enemy.hp = 999;
    const before = g.enemy.hp; g.playCard(give(g, 'shadowBolt')); // Shadow card
    return before - g.enemy.hp === SHADOW_BOLT_DMG + SHADOW_RELIC_DMG;
  },
  ironWard: () => {
    const g = probeGame(['ironWard']); g.start();
    const i = give(g, 'shield'); // Iron, cost 3 -> the first Iron card is cheaper
    return g.effectiveCost(resolveCard(g.hand[i])) === CARDS.shield.cost - IRON_RELIC_DISCOUNT;
  },
  // --- Iron mitigation web relics (#65) -----------------------------------------
  whetstone: () => {
    const g = probeGame(['whetstone']); g.start();
    // A member untouched last enemy phase strikes +1 (the opener may have marked
    // some; clear the flag to observe the bonus on an untouched member).
    g.tank.tookDamageLastEnemyPhase = false;
    return g.memberDamage(g.tank) === g.tank.damage + WHETSTONE_BONUS;
  },
  bulwarkCore: () => {
    const g = probeGame(['bulwarkCore']); g.start();
    g.tank.shield = true; g.tank.shieldTurns = 3;
    g.telegraph = single(4, SLOT.CENTER); // fully blocked by the Shield
    g._resolveAttack();
    return !g.tank.shield && g.tank.brace; // Shield consumed -> Brace left behind
  },
  // --- Regen conversions relics (#66) -------------------------------------------
  deepRoots: () => {
    const g = probeGame(['deepRoots']); g.start();
    g.tank.regen = 1; // a one-tick Regen that expires next player phase
    g._startPlayerPhase(); // ticks Regen to 0 -> _onRegenEnded fires Deep Roots
    return g.tank.brace; // the spent Regen hardened into Brace
  },
  ossuaryBell: () => {
    const g = probeGame(['ossuaryBell']); g.start();
    // Start full behind no ward so the hit is a clean downward crossing of the threshold.
    g.tank.hp = g.tank.maxHP; g.tank.shield = false; g.tank.brace = false; g.tank.defense = 0;
    g.telegraph = single(g.tank.maxHP - 1, SLOT.CENTER); // full -> 1 HP: below the threshold, non-lethal
    g._resolveAttack();
    return g.tank.alive && g.tank.regen >= OSSUARY_REGEN;
  },
  // --- Status-window management relics (#67) ------------------------------------
  venomGland: () => {
    const g = probeGame(['venomGland']); g.start();
    g._applyPoison(POISON_BASE, POISON_TURNS); // an application lasts +1 turn while owned
    return g.enemy.poisonTurns === POISON_TURNS + VENOM_GLAND_BONUS_TURNS;
  },
  embermark: () => {
    const g = probeGame(['embermark']); g.start();
    g.enemy.hp = 999; g.telegraph = null; // no incoming blow — isolate the expiry payout
    g.enemy.vulnerable = 0.5; g.enemy.vulnerableTurns = 1; // expires this enemy phase
    const before = g.enemy.hp;
    g._runEnemyPhase();
    return before - g.enemy.hp === EMBERMARK_DMG; // the ember fired flat on natural expiry
  },
};

// DR1 injury avenues, driven through the run layer end to end. The sim already
// exercises these across full runs; this pins each deterministically so a run-layer
// regression (a node that stops clearing, an event that stops healing) is caught in
// the same sweep as the cards/relics.
const DR1_PROBES: Record<string, () => boolean> = {
  recordInjuries: () => {
    const run = new Run(101);
    // Under the shipped 'death' mode the 4th death permanently removes the deployed
    // member from the roster (deployment[0] -> roster[0]).
    const before = run.roster.length;
    run.recordInjuries([0, 0, 0, 0].map((s) => s as Slot));
    return run.roster.length === before - 1;
  },
  fieldHospital: () => {
    const run = new Run(103);
    run.roster[2].injuries = 1;
    return run.healInjury(2 as Slot) && run.roster[2].injuries === 0;
  },
};

// ---------------------------------------------------------------------------

export function exerciseAll(): Coverage {
  const cov: Coverage = {
    cardsPlayed: new Set(), abilitiesFired: new Set(),
    relicsFired: new Set(), cursesFired: new Set(), dr1Fired: new Set(), crashes: [],
  };

  // Card exerciser: a plain punching-bag fight covers most cards; a Hexweaver
  // fight adds the Hex/heal-denial context; a fight with the mage pre-killed
  // makes Resurrect reachable. Each also forces a rotating relic so the
  // log-observable relics fire in a live fight (a bonus over the probes).
  const logRelics = Object.keys(RELIC_LOG_MARK) as RelicId[];
  logRelics.forEach((r, i) => runExerciseFight(exerciseConfig([r]), cov, `bag+${r}`, i % 5 === 4 ? 'mage' : undefined));
  runExerciseFight(exerciseConfig([], { def: HEXWEAVER_DEF, boss: true, maxHP: 300 }), cov, 'hexweaver');
  runExerciseFight(exerciseConfig([], { maxHP: 500 }), cov, 'bag+prekill', 'mage');

  // Relic / curse drive-throughs (deterministic).
  for (const id of RELIC_IDS) {
    try {
      if (RELIC_PROBES[id]()) {
        cov.relicsFired.add(id);
        if (RELICS[id].curse) cov.cursesFired.add(id);
      }
    } catch (err) {
      cov.crashes.push({ where: `probe:${id}`, error: String(err) });
    }
  }

  // DR1 injury-avenue drive-throughs.
  for (const [name, probe] of Object.entries(DR1_PROBES)) {
    try { if (probe()) cov.dr1Fired.add(name); }
    catch (err) { cov.crashes.push({ where: `dr1:${name}`, error: String(err) }); }
  }
  return cov;
}

// CLI: print coverage and any gaps. Guarded so importing this file (the test)
// does not also run the report.
if (process.argv[1] && process.argv[1].endsWith('exercise.ts')) {
  const cov = exerciseAll();
  const missCards = ALL_CARDS.filter((c) => !isAbilityCard(c) && !cov.cardsPlayed.has(c));
  const missAbil = ALL_ABILITIES.filter((a) => !cov.abilitiesFired.has(a));
  const missRelics = RELIC_IDS.filter((r) => !cov.relicsFired.has(r));
  const curses = RELIC_IDS.filter((r) => RELICS[r].curse);
  console.log('=== mechanic-coverage sweep ===');
  console.log(`cards played:  ${cov.cardsPlayed.size}/${ALL_CARDS.length}${missCards.length ? `  MISSING: ${missCards.join(', ')}` : '  (all)'}`);
  console.log(`abilities:     ${cov.abilitiesFired.size}/3${missAbil.length ? `  MISSING: ${missAbil.join(', ')}` : '  (all)'}`);
  console.log(`relics fired:  ${cov.relicsFired.size}/${RELIC_IDS.length}${missRelics.length ? `  MISSING: ${missRelics.join(', ')}` : '  (all)'}`);
  console.log(`curses fired:  ${cov.cursesFired.size}/${curses.length}  (${[...cov.cursesFired].join(', ') || 'none'})`);
  console.log(`DR1 avenues:   ${cov.dr1Fired.size}/${Object.keys(DR1_PROBES).length}  (${[...cov.dr1Fired].join(', ') || 'none'})`);
  console.log(`crashes:       ${cov.crashes.length}${cov.crashes.length ? '\n  ' + cov.crashes.map((c) => `${c.where}: ${c.error}`).join('\n  ') : ''}`);
}
