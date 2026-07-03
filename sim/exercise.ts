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
  POISON_BASE, RUSTY_CROWN_ATTACK, CRACKED_HOURGLASS_ENRAGE,
  DEFAULT_ENEMY_DEF, HEXWEAVER_DEF, makeDeckCard, resolveCard, defaultBattleConfig,
} from '../src/constants';
import type {
  CardId, AbilityId, RelicId, MemberId, BattleConfig, Slot,
} from '../src/constants';

export interface Coverage {
  cardsPlayed: Set<CardId>;
  abilitiesFired: Set<AbilityId>;
  relicsFired: Set<RelicId>;
  cursesFired: Set<RelicId>;
  crashes: Array<{ where: string; error: string }>;
}

const ALL_CARDS = Object.keys(CARDS) as CardId[];
const ALL_ABILITIES: AbilityId[] = ['poison', 'taunt', 'bolt'];

// A deck with at least one of every card, plus a few enablers: extra Ability
// cards to fire all three abilities, and Regen sources so Cultivate/Bloom (which
// require an active Regen on their target) always have fodder.
const EXERCISE_DECK: CardId[] = [
  'ability', 'ability', 'ability',
  'regen', 'regen', 'lifebloom', 'overgrowth', 'cultivate', 'bloom',
  'lowHeal', 'highHeal', 'highHeal', 'aoeHeal', 'shield', 'resurrect', 'refresh', 'cleanse',
  'fontOfMana', 'inspiration', 'surge', 'battleHymn', 'barrier',
  'bloodTithe', 'martyrsGift', 'grimHarvest', 'phalanx', 'brace',
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

// Make one play this phase, biased to a card we have not yet exercised. Returns
// false when nothing playable remains (the turn should end).
function exerciseOnePlay(game: Game, cov: Coverage): boolean {
  // Pass 1 — a not-yet-played card, or an Ability aimed at an unfired ability.
  for (let i = 0; i < game.hand.length; i++) {
    const dc = game.hand[i];
    if (dc.id === 'ability') {
      const m = game.members.find((x) => x.alive && !cov.abilitiesFired.has(x.ability) && game.canPlay(i, x.slot) === null);
      if (m && game.playCard(i, m.slot).ok) {
        cov.abilitiesFired.add(m.ability); cov.cardsPlayed.add('ability'); return true;
      }
    } else if (!cov.cardsPlayed.has(dc.id)) {
      const p = legalPlay(game, i);
      if (p && game.playCard(i, p.target).ok) { cov.cardsPlayed.add(dc.id); return true; }
    }
  }
  // Pass 2 — any legal play, to keep drawing so the rest of the deck comes around.
  for (let i = 0; i < game.hand.length; i++) {
    const dc = game.hand[i];
    const p = legalPlay(game, i);
    if (p && game.playCard(i, p.target).ok) {
      cov.cardsPlayed.add(dc.id);
      if (dc.id === 'ability' && typeof p.target === 'number') {
        const m = game.members[p.target];
        if (m) cov.abilitiesFired.add(m.ability);
      }
      return true;
    }
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
    g.playCard(give(g, 'ability'), SLOT.CENTER); // Taunt primes the drum
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
    const i = give(g, 'ability'); const uid = g.hand[i].uid;
    g.playCard(i, SLOT.LEFT); // Poison — the Locket returns it
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
};

// ---------------------------------------------------------------------------

export function exerciseAll(): Coverage {
  const cov: Coverage = {
    cardsPlayed: new Set(), abilitiesFired: new Set(),
    relicsFired: new Set(), cursesFired: new Set(), crashes: [],
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
  return cov;
}

// CLI: print coverage and any gaps. Guarded so importing this file (the test)
// does not also run the report.
if (process.argv[1] && process.argv[1].endsWith('exercise.ts')) {
  const cov = exerciseAll();
  const missCards = ALL_CARDS.filter((c) => !cov.cardsPlayed.has(c));
  const missAbil = ALL_ABILITIES.filter((a) => !cov.abilitiesFired.has(a));
  const missRelics = RELIC_IDS.filter((r) => !cov.relicsFired.has(r));
  const curses = RELIC_IDS.filter((r) => RELICS[r].curse);
  console.log('=== mechanic-coverage sweep ===');
  console.log(`cards played:  ${cov.cardsPlayed.size}/${ALL_CARDS.length}${missCards.length ? `  MISSING: ${missCards.join(', ')}` : '  (all)'}`);
  console.log(`abilities:     ${cov.abilitiesFired.size}/3${missAbil.length ? `  MISSING: ${missAbil.join(', ')}` : '  (all)'}`);
  console.log(`relics fired:  ${cov.relicsFired.size}/${RELIC_IDS.length}${missRelics.length ? `  MISSING: ${missRelics.join(', ')}` : '  (all)'}`);
  console.log(`curses fired:  ${cov.cursesFired.size}/${curses.length}  (${[...cov.cursesFired].join(', ') || 'none'})`);
  console.log(`crashes:       ${cov.crashes.length}${cov.crashes.length ? '\n  ' + cov.crashes.map((c) => `${c.where}: ${c.error}`).join('\n  ') : ''}`);
}
