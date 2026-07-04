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
import { HEXWEAVER_DEF, SLOT, defaultBattleConfig, makeDeckCard, resolveCard, partyFromMembers } from '../src/constants';
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
  // Re-pinned for #26 (player-first ordering). The party now acts before the enemy's
  // opening blow — a systemic +~30pp buff — so all three bosses were re-anchored on
  // HP: Gatewarden 130->155, Hexweaver 158->184, Devourer 182->208. N=1000 reads
  // full-run 31.7%, bosses 87.2 / 70.2 / 52.7% (all dead-center in-band); Story reads
  // high (a cruise). This is the N=200 sample (seeds 1-200).
  eq('N=200 per-fight wins', JSON.stringify(perFightWins), JSON.stringify([200, 200, 175, 175, 174, 118, 117, 116, 53]));
  // Full-run lands in the 25-35% band. The authoritative gate runs at N=1000
  // (ISSUES.md ground rules; see the run-sim baseline note) — this N=200 sample
  // asserts statistical consistency with the band, not the band itself, so
  // subsample noise can't fail a healthy build (a real drift still trips it).
  check('full-run consistent with the 25-35% band',
    r.fullRun.rate - r.fullRun.ci95 <= 0.35 && r.fullRun.rate + r.fullRun.ci95 >= 0.25,
    `${(r.fullRun.rate * 100).toFixed(1)}% ±${(r.fullRun.ci95 * 100).toFixed(1)}`);
  // Early normals clear >= 95% (F0, F1, F3, F4 have clean sample sizes).
  for (const fi of [0, 1, 3, 4]) check(`normal F${fi} clears >= 95%`, r.perFight[fi].rate >= 0.95);
  // Act-3 normals (F6, F7) also clear >= 90% now that they're under the enrage cliff.
  for (const fi of [6, 7]) check(`Act-3 normal F${fi} clears >= 90%`, r.perFight[fi].rate >= 0.90);
  // Boss gates (authoritative at N=1000: Gatewarden 88%, Hexweaver 71%, Devourer
  // 53%). At N=200 each boss's conditional sample is small and noisy, so — like the
  // full-run band above — assert CI-consistency with the target band rather than a
  // hard threshold, so subsample noise can't fail a healthy build while real drift
  // (a CI that no longer overlaps the band) still trips it.
  const bandConsistent = (p: { rate: number; ci95: number }, lo: number, hi: number): boolean =>
    p.rate + p.ci95 >= lo && p.rate - p.ci95 <= hi;
  check('Act-1 boss (Gatewarden) consistent with >= 85%', r.perFight[2].rate + r.perFight[2].ci95 >= 0.85,
    `${(r.perFight[2].rate * 100).toFixed(1)}% ±${(r.perFight[2].ci95 * 100).toFixed(1)}`);
  check('Act-2 boss (Hexweaver) consistent with 65-75%', bandConsistent(r.perFight[5], 0.65, 0.75),
    `${(r.perFight[5].rate * 100).toFixed(1)}% ±${(r.perFight[5].ci95 * 100).toFixed(1)}`);
  check('Act-3 boss (Devourer) consistent with 50-62%', bandConsistent(r.perFight[8], 0.50, 0.62),
    `${(r.perFight[8].rate * 100).toFixed(1)}% ±${(r.perFight[8].ci95 * 100).toFixed(1)}`);
}

// --- DR1: the harness reports injury telemetry -------------------------------
{
  const r = runSim(200, 1);
  eq('deathsPerWin is reported per fight', r.deathsPerWin.length, r.perFight.length);
  check('deaths per won fight are non-negative', r.deathsPerWin.every((d) => d >= 0));
  // The sacrifice signal DR1 named: the fixed policy still spends members on the
  // bosses, so their deaths/won-fight is materially positive (F2/F5/F8).
  check('the bosses still cost member deaths (the DR1 signal)',
    r.deathsPerWin[2] > 0.3 && r.deathsPerWin[5] > 0.3 && r.deathsPerWin[8] > 0.3,
    `F2 ${r.deathsPerWin[2].toFixed(2)} F5 ${r.deathsPerWin[5].toFixed(2)} F8 ${r.deathsPerWin[8].toFixed(2)}`);
  // Scars are recoverable: the good player carries only a small residual to run end.
  check('residual scars per run stay bounded', r.meanInjuries >= 0 && r.meanInjuries < 3,
    `${r.meanInjuries.toFixed(2)}`);
  check('the policy spends gold healing scars', r.meanGoldHealing > 0, `${r.meanGoldHealing.toFixed(1)}`);
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

// --- roster wave 1: the policy drives a drafted Warlock/Skald party (#27) ----
// The full composition sweep is #31; here we only prove the per-wave policy can
// pilot the new members without wedging, and that it wins ordinary fights.
{
  let wins = 0, terminated = 0;
  const N = 60;
  for (let s = 1; s <= N; s++) {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['warlock', 'tank', 'skald']);
    cfg.enemy = { ...cfg.enemy, maxHP: 75 }; // an ordinary early normal
    const g = new Game(s, cfg);
    playFight(g);
    if (g.status !== 'playing') terminated++;
    if (g.status === 'win') wins++;
  }
  check('the policy always resolves a drafted Warlock/Skald fight (no stall)', terminated === N, `${terminated}/${N}`);
  check('the drafted party wins ordinary fights', wins >= Math.floor(N * 0.8), `${wins}/${N} wins`);

  // The Warlock's burn-out is real: against a wall he can be spent, but the policy's
  // safety cushion means he doesn't suicide on turn 1 of an easy fight.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['warlock', 'tank', 'mage']);
  cfg.enemy = { ...cfg.enemy, maxHP: 50 };
  const g = new Game(7, cfg);
  g.start();
  const w = g.members[0];
  const hp0 = w.hp;
  // One full turn: Soul Tithe fires once; the Warlock is chipped but not gone.
  g.enemy.hp = 999;
  g.endTurn();
  check('the Warlock survives an opening turn (Soul Tithe chips, does not kill)', w.alive && w.hp < hp0);
}
{
  // Roster wave 2 (#28): the policy pilots a Berserker/Grave-Augur composition too.
  let wins = 0, terminated = 0;
  const N = 60;
  for (let s = 1; s <= N; s++) {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['berserker', 'graveAugur', 'mage']);
    cfg.enemy = { ...cfg.enemy, maxHP: 75 };
    const g = new Game(s, cfg);
    playFight(g);
    if (g.status !== 'playing') terminated++;
    if (g.status === 'win') wins++;
  }
  check('the policy always resolves a Berserker/Augur fight (no stall)', terminated === N, `${terminated}/${N}`);
  check('the Berserker/Augur party wins ordinary fights', wins >= Math.floor(N * 0.8), `${wins}/${N} wins`);
}
{
  // Roster wave 3 (#29): the policy keeps a Boar up and pilots the Beast Warden.
  let wins = 0, terminated = 0;
  const N = 60;
  for (let s = 1; s <= N; s++) {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['beastWarden', 'tank', 'mage']);
    cfg.enemy = { ...cfg.enemy, maxHP: 75 };
    const g = new Game(s, cfg);
    playFight(g);
    if (g.status !== 'playing') terminated++;
    if (g.status === 'win') wins++;
  }
  check('the policy always resolves a Beast Warden fight (no stall)', terminated === N, `${terminated}/${N}`);
  check('the Beast Warden party wins ordinary fights', wins >= Math.floor(N * 0.8), `${wins}/${N} wins`);
}

if (failed > 0) { console.error(`\nsim.test: ${passed} passed, ${failed} failed`); process.exit(1); }
else console.log(`sim.test: ${passed} passed`);
