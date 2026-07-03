// Sim-harness test. Run with: tsx test/sim.test.ts
//
// Guards the two properties the balance gates rely on: the harness is
// deterministic (same seed -> identical result) and its aggregate winrate is
// stable (a fixed seed range produces a fixed number, so an accidental engine or
// policy change is caught). The absolute numbers here are the harness's living
// baseline, not a balance target — see the BASELINE note in sim/run-sim.ts.

import { runSingleRun, runSim } from '../sim/run-sim';
import { Game } from '../src/engine';
import { playFight } from '../sim/policy';
import { HEXWEAVER_DEF, SLOT, defaultBattleConfig, makeDeckCard, resolveCard } from '../src/constants';
import type { CardId } from '../src/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}
function eq(name: string, a: unknown, b: unknown): void { check(name, a === b, `expected ${b}, got ${a}`); }

// --- determinism ------------------------------------------------------------
{
  // Same seed -> byte-identical outcome, twice.
  for (const seed of [1, 42, 777, 123456]) {
    const a = JSON.stringify(runSingleRun(seed));
    const b = JSON.stringify(runSingleRun(seed));
    eq(`runSingleRun(${seed}) is deterministic`, a, b);
  }
  // Different seeds almost surely differ.
  check('different seeds produce different runs',
    JSON.stringify(runSingleRun(1)) !== JSON.stringify(runSingleRun(2)));
}
{
  // A whole aggregate run is reproducible.
  const a = JSON.stringify(runSim(50, 1));
  const b = JSON.stringify(runSim(50, 1));
  eq('runSim(50, 1) is deterministic', a, b);
}

// --- stable winrate regression ----------------------------------------------
// Locked from the current engine + policy over seeds 1..200. If a change here is
// intentional, update these numbers together with a note on what moved.
//
// NOTE (issue 14): with all three real bosses in place (Gatewarden / Hexweaver /
// Devourer) and the Act-3 normals brought under the enrage cliff, the full run is
// beatable end to end — full-run lands in the designed 25-35% band. Boss winrates
// sit near ~85 / ~70 / ~55%.
{
  const r = runSim(200, 1);
  eq('N=200 sample size', r.fullRun.n, 200);
  eq('N=200 fight count', r.perFight.length, 9);
  const perFightWins = r.perFight.map((p) => p.wins);
  // Re-pinned for issue 16 (card set phase B): seven more cards join CARD_POOL
  // (20 ids total), so every shop/event offer roll draws differently. Balance
  // holds — N=1000 reads full-run 34.1%, bosses 89.0 / 73.9 / 57.9% (vs 32.3%
  // and 89.3 / 71.2 / 57.2 after #15). This N=200 sample: full run 66/200 = 33%;
  // F2 179 (~90%), F5 125/175 (~71%), F8 66/118 (~56%).
  eq('N=200 per-fight wins', JSON.stringify(perFightWins), JSON.stringify([200, 200, 179, 178, 175, 125, 122, 118, 66]));
  // Full-run lands in the 25-35% band (issue 14 gate).
  check('full-run in the 25-35% band', r.fullRun.rate >= 0.25 && r.fullRun.rate <= 0.35, `${(r.fullRun.rate * 100).toFixed(1)}%`);
  // Early normals clear >= 95% (F0, F1, F3, F4 have clean sample sizes).
  for (const fi of [0, 1, 3, 4]) check(`normal F${fi} clears >= 95%`, r.perFight[fi].rate >= 0.95);
  // Act-3 normals (F6, F7) also clear >= 90% now that they're under the enrage cliff.
  for (const fi of [6, 7]) check(`Act-3 normal F${fi} clears >= 90%`, r.perFight[fi].rate >= 0.90);
  // Boss gates: Gatewarden >= 85%, Hexweaver 65-75%, Devourer ~55% (50-62% band).
  check('Act-1 boss (Gatewarden) clears >= 85%', r.perFight[2].rate >= 0.85);
  check('Act-2 boss (Hexweaver) in 65-75%', r.perFight[5].rate >= 0.65 && r.perFight[5].rate <= 0.75);
  check('Act-3 boss (Devourer) in 50-62%', r.perFight[8].rate >= 0.50 && r.perFight[8].rate <= 0.62);
}

// --- issue 13: turtling loses to adapting against the Hexweaver --------------
// The Hexweaver exists to break the permanent-taunt/heal-the-tank turtle. This
// pins that: a turtle policy (funnel everything onto the tank, heal ONLY the tank,
// never answer the Piercing Bolt's real target, never Cleanse) wins far less than
// the adaptive policy — with non-overlapping 95% CIs.
{
  const ci95 = (rate: number, n: number): number => 1.96 * Math.sqrt((rate * (1 - rate)) / n);
  const handIdx = (g: Game, id: CardId): number => g.hand.findIndex((c) => c.id === id);
  const afford = (g: Game, i: number): boolean => i >= 0 && g.mp >= resolveCard(g.hand[i]).cost;

  // A fixed Hexweaver battle with the counters (Shield / Cleanse) in the deck, so
  // the difference measured is decision-making, not draw.
  function hexBattle(seed: number): Game {
    const cfg = defaultBattleConfig();
    const ids: CardId[] = ['ability', 'ability', 'ability', 'highHeal', 'highHeal', 'lowHeal', 'lowHeal',
      'aoeHeal', 'shield', 'shield', 'cleanse', 'cleanse', 'regen', 'refresh'];
    cfg.deck = ids.map((id, i) => makeDeckCard(id, i));
    cfg.enemy = { maxHP: 135, boss: true, attackBonus: 0, def: HEXWEAVER_DEF, enrageTurn: 11 };
    return new Game(seed, cfg);
  }

  // Turtle: keep Taunt up, race with Bolt/Poison, but heal/shield ONLY the tank —
  // it never saves the squishy the Piercing Bolt is aimed at, and never Cleanses.
  function playTurtle(game: Game, turnCap = 40): void {
    game.start();
    let guard = 0;
    while (game.status === 'playing' && game.turn <= turnCap && guard < 1000) {
      guard++;
      while (game.phase === 'player') {
        let acted = false;
        const tank = game.tank;
        const ab = handIdx(game, 'ability');
        if (tank.alive && tank.taunt <= 1 && afford(game, ab)) { game.playCard(ab, SLOT.CENTER); acted = true; continue; }
        // offense: bolt when charged, else keep poison ticking
        if (game.mage.alive && game.mageCharge >= 4 && afford(game, ab)) { game.playCard(ab, SLOT.RIGHT); acted = true; continue; }
        if (game.ranger.alive && game.enemy.poisonTurns === 0 && afford(game, ab)) { game.playCard(ab, SLOT.LEFT); acted = true; continue; }
        // defense: only ever the tank
        if (tank.alive && tank.hp < tank.maxHP * 0.6) {
          for (const id of ['highHeal', 'lowHeal', 'aoeHeal'] as CardId[]) {
            const i = handIdx(game, id);
            if (afford(game, i)) { game.playCard(i, SLOT.CENTER); acted = true; break; }
          }
          if (acted) continue;
        }
        break;
      }
      if (game.phase !== 'player') continue;
      if (game.canSkip() && game.mp < game.maxMana) game.skipTurn(); else game.endTurn();
    }
  }

  const N = 300;
  let turtleWins = 0, adaptiveWins = 0;
  for (let s = 1; s <= N; s++) {
    const gt = hexBattle(s); playTurtle(gt); if (gt.status === 'win') turtleWins++;
    const ga = hexBattle(s); playFight(ga); if (ga.status === 'win') adaptiveWins++;
  }
  const tr = turtleWins / N, ar = adaptiveWins / N;
  const tHi = tr + ci95(tr, N), aLo = ar - ci95(ar, N);
  check('adaptive beats turtle with non-overlapping 95% CIs against the Hexweaver',
    aLo > tHi, `turtle ${(tr * 100).toFixed(1)}% (hi ${(tHi * 100).toFixed(1)}) vs adaptive ${(ar * 100).toFixed(1)}% (lo ${(aLo * 100).toFixed(1)})`);
}

if (failed > 0) { console.error(`\nsim.test: ${passed} passed, ${failed} failed`); process.exit(1); }
else console.log(`sim.test: ${passed} passed`);
