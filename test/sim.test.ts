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
// NOTE (issue 10): with the 3-act / 9-fight structure, full-run is 0% because the
// Act 2/3 bosses are placeholders (scaled BOSS_ENEMY_DEF at 200/280 HP) that the
// current policy can't beat — the real bosses and their policy reactions land with
// #12-#14, which is when the full-run band is tuned. The early normals (F0/F1/F3/F4)
// are the demonstrable "normals >= 95%" gate.
{
  const r = runSim(200, 1);
  eq('N=200 full-run wins', r.fullRun.wins, 0);
  eq('N=200 sample size', r.fullRun.n, 200);
  eq('N=200 fight count', r.perFight.length, 9);
  const perFightWins = r.perFight.map((p) => p.wins);
  // Re-pinned twice after the issues-01-12 playtest fixes:
  // - canApplyModifier refuses no-op purchases (Efficient at the 1-MP floor),
  //   so the shopper keeps gold it used to waste: F5 34->35, F6 29->30.
  // - Crushing Blow retuned 20->12 with channel-aware policy reactions
  //   (tryBraceChannel + wind-up MP banking): the channel is now answered in
  //   ~53% of boss fights instead of killing a member in 82%; F2 185->181
  //   (still >= 85% gate) with knock-on F3/F4 sample shifts.
  // Re-pinned for issue 13: the Hexweaver replaces the Act-2 placeholder boss at
  // 135 HP, and Cleanse joins the shop pool (shifting shop RNG). F5 jumps from the
  // ~35 placeholder wins to ~121 (68% of the F5 sample) and the knock-on F6/F7
  // samples grow. Full-run stays 0 (the Act-3 boss is still a placeholder, tuned
  // with the Devourer in #14).
  eq('N=200 per-fight wins', JSON.stringify(perFightWins), JSON.stringify([200, 200, 181, 180, 177, 121, 110, 28, 0]));
  // Early normals clear >= 95% (F0, F1, F3, F4 have clean sample sizes).
  for (const fi of [0, 1, 3, 4]) check(`normal F${fi} clears >= 95%`, r.perFight[fi].rate >= 0.95);
  // Issue 12 gate: the Act-1 boss (Gatewarden, F2) clears >= 85%.
  check('Act-1 boss (Gatewarden) clears >= 85%', r.perFight[2].rate >= 0.85);
  // Issue 13 gate: the Act-2 boss (Hexweaver, F5) lands in the 65-75% band.
  check('Act-2 boss (Hexweaver) in 65-75%', r.perFight[5].rate >= 0.65 && r.perFight[5].rate <= 0.75);
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
