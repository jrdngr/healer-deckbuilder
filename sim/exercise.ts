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
  CARDS, RELIC_IDS, RELICS, SLOT, RARITY_PRICE,
  POISON_BASE, RUSTY_CROWN_ATTACK,
  DEFAULT_ENEMY_DEF, HEXWEAVER_DEF, makeDeckCard, resolveCard, defaultBattleConfig, isAbilityCard,
  MEMBER_POOL, LONE_WOLF_DMG, FOCUS_STONE_MP, WARBAND_HP_PER_SEAT,
  HOLY_RELIC_HEAL,
  OSSUARY_REGEN, POISON_TURNS, VENOM_GLAND_BONUS_TURNS,
  BEACON_DRAW, TWIN_CENSER_SPLASH, BEGGARS_BOWL_REWARD_SIZE,
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
  'regen', 'regen', 'lifebloom', 'bloom',
  'lowHeal', 'highHeal', 'highHeal', 'aoeHeal', 'shield', 'resurrect', 'cleanse',
  'fontOfMana', 'inspiration', 'battleHymn', 'barrier',
  'bloodTithe', 'martyrsGift', 'phalanx', 'provoke',
  // Iron mitigation web (#65).
  'feint',
  // Regen conversion (#66): consumes an active Regen (the seeded Regen fodder above).
  'sporeburst',
  // Status-window management (#67): Hemorrhage needs enemy poison (imbuePoison seeds it),
  // Dread Whisper shaves the telegraph.
  'hemorrhage', 'dreadWhisper',
  // Blood + cycling (#68): HP-priced draw/shield/redistribution/offense.
  'crimsonPact', 'scarletWard', 'transfusion', 'bloodBanner',
  // Holy board-state payoffs (#69): a delayed party heal and full-HP->offense.
  'sunriseVigil', 'consecration',
  // Arcane support (#70): a splash enabler.
  'arcaneLens',
  // Channeled cards (#64).
  'mendingStream', 'sap',
  // Hero buff card batch (#62).
  'guard', 'sharpen', 'doubleStrike', 'empower', 'riposte',
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
    // No Regen-granting card in hand to seed with (deck shuffle can leave a stuck Bloom /
    // Cultivate / Sporeburst / Thornskin with its fodder elsewhere) — grant Regen directly
    // so the consumer becomes playable this phase (mirrors pass 0b's direct poison seed;
    // the harness already pokes state each turn, keeping coverage decoupled from draws).
    const living = game.livingMembers()[0];
    if (living && living.regen <= 0) living.regen = 3;
  }
  // Pass 0b — seed enemy Poison. Hemorrhage (#67, needsPoison) is a dead card until the
  // enemy is Poisoned; the bigger #68 deck can draw it while no poison stands and the
  // one Imbue Venom is elsewhere. When such a consumer is in hand but stuck for lack of
  // enemy poison, poison the enemy directly (the harness already pokes state — it tops MP
  // each turn — to keep coverage decoupled from the economy; a real poison, cashed for real).
  const stuckPoison = game.hand.some(
    (dc, i) => !cov.cardsPlayed.has(dc.id) && CARDS[dc.id].needsPoison && legalPlay(game, i) === null);
  if (stuckPoison && game.enemy.poisonTurns <= 0) game._applyPoison(POISON_BASE, POISON_TURNS);
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
  warDrum: 'War Drum',
  prayerBeads: 'Fidget Beads',
  martyrsIcon: 'Guardian Feather',
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
  prayerBeads: () => {
    const g = probeGame(['prayerBeads']); g.start(); g.mp = 0;
    g.drawPile = []; g.discardPile.push(makeDeckCard('lowHeal', -1));
    g._drawOne();
    return g.mp > 0;
  },
  vanguardsBanner: () => {
    const g = probeGame(['vanguardsBanner']); g.start(); g.tank.hp = g.tank.maxHP;
    return g.memberDamage(g.tank) > g.tank.damage;
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
  ossuaryBell: () => {
    const g = probeGame(['ossuaryBell']); g.start();
    // Start full behind no shield so the hit is a clean downward crossing of the threshold.
    g.tank.hp = g.tank.maxHP; g.tank.shield = false; g.tank.defense = 0;
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
  // --- Holy overheal & board-state relics (#69) ---------------------------------
  beaconOfSecondSun: () => {
    const g = probeGame(['beaconOfSecondSun']); g.start();
    g.tank.hp = g.tank.maxHP - 1;               // one below full so a heal tops it off
    g.drawPile = [makeDeckCard('lowHeal', -1)]; // a card to draw on the top-off
    const idx = give(g, 'highHeal');
    const handBefore = g.hand.length;           // includes the highHeal about to be spent
    g.playCard(idx, SLOT.CENTER);               // tops the tank off -> Beacon draws
    // The played card leaves the hand; net change = BEACON_DRAW - 1 (0 with a draw, -1 without).
    return g.hand.length - handBefore === BEACON_DRAW - 1;
  },
  twinCenser: () => {
    const g = probeGame(['twinCenser']); g.start();
    g.tank.hp = g.tank.maxHP;      // heal target (the primary heal can even land full)
    g.ranger.hp = g.ranger.maxHP;  // healthy -> not the splash target
    g.mage.hp = g.mage.maxHP - 3;  // the most wounded OTHER member
    const before = g.mage.hp;
    g.playCard(give(g, 'lowHeal'), SLOT.CENTER); // single-target heal card splashes to the mage
    return g.mage.hp - before === TWIN_CENSER_SPLASH;
  },
  // --- Channel archetype rescue relic (#70) -------------------------------------
  chantersIdol: () => {
    const g = probeGame(['chantersIdol']); g.start();
    g.playCard(give(g, 'sap'));          // start a Sap channel (this turn's 1st play)
    if (!g.channelActive()) return false;
    g.cardsPlayedThisPhase = 0;         // a fresh turn with the channel still running
    g.playCard(give(g, 'lowHeal'), SLOT.CENTER); // the turn's FIRST card -> Idol keeps the channel
    return g.channelActive();           // the channel survived a non-channel play
  },
  // --- meta-layer / run-economy relics (#71) ------------------------------------
  pilgrimsFlask: () => {
    const g = probeGame(['pilgrimsFlask']); g.start();
    g.ranger.hp = 1;                    // a wounded member to top off
    g.skipTurn();                       // a Rest heals all living members via the pipeline
    return g.log.some((e) => e.text.includes('Nap Sack'));
  },
  surgeonsThread: () => {
    // Run-layer: the between-fight recovery fraction is higher with the relic.
    const withRelic = new Run(5); withRelic.addRelic('surgeonsThread');
    const without = new Run(5);
    withRelic.roster[0].hp = 1; without.roster[0].hp = 1;
    withRelic._healBetweenFights(); without._healBetweenFights();
    return withRelic.roster[0].hp > without.roster[0].hp;
  },
  beggarsBowl: () => {
    // Run-layer curse: the card-reward roll shrinks to 2 distinct offers.
    const run = new Run(5); run.addRelic('beggarsBowl');
    return run.rollCardReward(0).length === BEGGARS_BOWL_REWARD_SIZE;
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
