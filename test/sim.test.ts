// Sim-harness test. Run with: tsx test/sim.test.ts
//
// Guards the two properties the balance gates rely on: the harness is
// deterministic (same seed -> identical result) and its aggregate winrate is
// stable (a fixed seed range produces a fixed number, so an accidental engine or
// policy change is caught). The absolute numbers here are the harness's living
// baseline, not a balance target — see the BASELINE note in sim/run-sim.ts.

import { runSingleRun, runSim, allCompositions, seatComposition, runCompositionSweep } from '../sim/run-sim';
import { MEMBER_POOL } from '../src/constants';
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
// NOTE (2026-07 roster campaign): the sim plays the real campaign now — a solo
// starter drafted, the roster built over the run, the best three deployed each
// fight. Enemy HP was re-anchored down for the under-strength party. Full-run lands
// ~22% at N=200; normals clear cleanly and the act bosses are the walls (~61/76/65%).
{
  const r = runSim(200, 1);
  eq('N=200 sample size', r.fullRun.n, 200);
  eq('N=200 fight count', r.perFight.length, 9);
  const perFightWins = r.perFight.map((p) => p.wins);
  // Re-pinned for the 2026-07 ROSTER CAMPAIGN. The sim now plays the real campaign:
  // draft a solo starter, build the roster (post-boss drafts + Recruit nodes), and
  // deploy the best three each fight — so act 1 is fought SOLO/duo and the whole
  // enemy-HP curve was re-anchored down for the under-strength party (ENEMY_HP_BY_FIGHT).
  // Shape: normals clear cleanly (~90-100%); the act bosses are the walls, sharpest
  // at the act-1 Gatewarden you meet under-strength. N=200: full-run ~22%, bosses
  // ~61 / 76 / 65%. Provisional regression pins on the observed numbers.
  eq('N=200 per-fight wins', JSON.stringify(perFightWins), JSON.stringify([195, 183, 111, 111, 104, 79, 73, 69, 45]));
  // Full-run gate around the observed ~22% (N=200 runs a touch hot vs N=1000).
  // CI-consistency, not a hard threshold, so subsample noise can't fail a healthy
  // build while a real drift still trips it.
  check('full-run consistent with the ~22% campaign band',
    r.fullRun.rate - r.fullRun.ci95 <= 0.30 && r.fullRun.rate + r.fullRun.ci95 >= 0.15,
    `${(r.fullRun.rate * 100).toFixed(1)}% ±${(r.fullRun.ci95 * 100).toFixed(1)}`);
  // Normals clear cleanly even under-strength: act-1/2 normals >= 88%, act-3 >= 85%.
  for (const fi of [0, 1, 3, 4]) check(`normal F${fi} clears >= 88%`, r.perFight[fi].rate >= 0.88);
  for (const fi of [6, 7]) check(`Act-3 normal F${fi} clears >= 85%`, r.perFight[fi].rate >= 0.85);
  // Provisional boss gates on the campaign observations (N=200: Gatewarden ~61%,
  // Hexweaver ~76%, Devourer ~65%) — CI-consistent bands.
  const bandConsistent = (p: { rate: number; ci95: number }, lo: number, hi: number): boolean =>
    p.rate + p.ci95 >= lo && p.rate - p.ci95 <= hi;
  check('Act-1 boss (Gatewarden) consistent with ~50-72% (the under-strength wall)', bandConsistent(r.perFight[2], 0.50, 0.72),
    `${(r.perFight[2].rate * 100).toFixed(1)}% ±${(r.perFight[2].ci95 * 100).toFixed(1)}`);
  check('Act-2 boss (Hexweaver) consistent with ~66-86%', bandConsistent(r.perFight[5], 0.66, 0.86),
    `${(r.perFight[5].rate * 100).toFixed(1)}% ±${(r.perFight[5].ci95 * 100).toFixed(1)}`);
  check('Act-3 boss (Devourer) consistent with ~52-78%', bandConsistent(r.perFight[8], 0.52, 0.78),
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
  // Injuries are permanent now (2026-07): a member removed at the 4th death takes its
  // scars with it, and the Field Hospital sheds the odd one, so the residual per run
  // stays bounded rather than spiralling.
  check('residual scars per run stay bounded', r.meanInjuries >= 0 && r.meanInjuries < 4,
    `${r.meanInjuries.toFixed(2)}`);
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

// --- issue 34: the re-lined tactics actually engage the new abilities ---------
// Not gates: the policy plans around Dark Bargain, Crescendo, and Provoke rather
// than firing them only in a corner case.
{
  // Dark Bargain FRONT-LOADS and CAPS: over a long fight the Warlock is bargained
  // early (once MP has headroom) but never past 2 casts — the growth curve is
  // respected, so he is not slowly bled to death.
  let everBargained = false;
  let maxCasts = 0;
  for (let s = 1; s <= 40; s++) {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['warlock', 'mage', 'graveAugur']); // taunt-less, warlock present
    cfg.enemy = { ...cfg.enemy, maxHP: 200 }; // a wall, so MP gets spent and turns pass
    const g = new Game(s, cfg);
    playFight(g, 12);
    const casts = g.members[0].bargainCasts;
    if (casts > 0) everBargained = true;
    maxCasts = Math.max(maxCasts, casts);
  }
  check('Dark Bargain front-loads (fires at least once across seeds)', everBargained);
  check('Dark Bargain is capped at 2 front-load casts (never bled dry)', maxCasts <= 2, `maxCasts=${maxCasts}`);

  // Provoke is the taunt-less redirection line: a party with no Tank plays Provoke,
  // so a member that does NOT have the Taunt ability ends up holding Taunt.
  {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['ranger', 'mage', 'graveAugur']); // no tank
    // Ensure a Provoke is in hand to play (the deck is the policy's, so seed it).
    cfg.deck = [...cfg.deck.slice(0, cfg.deck.length - 1), makeDeckCard('provoke', 999)];
    cfg.enemy = { ...cfg.enemy, boss: true, maxHP: 200 };
    const g = new Game(3, cfg);
    playFight(g, 10);
    const provoked = g.log.some((e) => e.text.includes('Provokes'));
    check('a taunt-less party plays Provoke to redirect', provoked);
  }
}

// --- issue 38: the Provoke sink never funnels hits onto the tithe-drained Warlock -
// The Warlock is often the highest-maxHP body on a taunt-less comp, but Soul Tithe
// makes him the WORST sink — provoking him would help kill the party's main striker.
{
  let everProvoked = false;
  let everProvokedWarlock = false;
  for (let s = 1; s <= 30; s++) {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['warlock', 'skald', 'beastWarden']); // taunt-less; warlock = highest maxHP
    cfg.deck = [...cfg.deck.slice(0, cfg.deck.length - 1), makeDeckCard('provoke', 999)];
    cfg.enemy = { ...cfg.enemy, boss: true, maxHP: 200 };
    const g = new Game(s, cfg);
    playFight(g, 10);
    for (const e of g.log) {
      if (!e.text.includes('Provokes')) continue;
      everProvoked = true;
      if (e.text.includes(MEMBER_POOL.warlock.name)) everProvokedWarlock = true;
    }
  }
  check('the taunt-less Warlock comp does play Provoke', everProvoked);
  check('Provoke never sinks onto the tithe-drained Warlock (#38)', !everProvokedWarlock);
}

// --- per-composition sweep harness (#31) ------------------------------------
{
  eq('there are 56 compositions (8-choose-3)', allCompositions().length, 56);
  // seatComposition puts the tankiest member in the (most-targeted) center slot.
  const seated = seatComposition(['mage', 'tank', 'skald']); // maxHP 9 / 18 / 10
  eq('the tankiest member is seated in center', seated[1], 'tank');

  // The Warlock is back at the spec's 7 (2026-07-04 playtest): #31's 7->5 nerf was
  // calibrated against the toBattleConfig identity bug — "warlock" comps were
  // fighting as poison-firing trio members with warlock stats. With REAL abilities,
  // warlock comps read 2.5-3% full-run even at 7 (no ceiling; the fixed policy can
  // barely pilot Dark Bargain), so the nerf had no justification left.
  eq('Warlock damage restored to the spec value', MEMBER_POOL.warlock.damage, 7);

  // A tiny sweep runs over all 56 comps without stalling and returns finite rates.
  const reps = runCompositionSweep(4, 1);
  eq('the sweep reports every composition', reps.length, 56);
  check('every comp reports a finite full-run rate',
    reps.every((r) => r.full.rate >= 0 && r.full.rate <= 1 && r.bosses.length === 3));
  // There is a real power spread across comps (not everything is a cakewalk) — the
  // authoritative ceiling/floor bands are the manual N=100 sweep in the issue file.
  check('the sweep shows a real spread (not every comp clears)', reps.some((r) => r.full.rate < 1));
}

if (failed > 0) { console.error(`\nsim.test: ${passed} passed, ${failed} failed`); process.exit(1); }
else console.log(`sim.test: ${passed} passed`);
