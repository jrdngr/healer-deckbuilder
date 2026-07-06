// Sim-harness test. Run with: tsx test/sim.test.ts
//
// Guards the two properties the balance gates rely on: the harness is
// deterministic (same seed -> identical result) and its aggregate winrate is
// stable (a fixed seed range produces a fixed number, so an accidental engine or
// policy change is caught). The absolute numbers here are the harness's living
// baseline, not a balance target — see the BASELINE note in sim/run-sim.ts.

import { runSingleRun, runSim } from '../sim/run-sim';
import { aggregate, deploySizeEdge } from '../sim/campaign-exp';
import { MEMBER_POOL } from '../src/constants';
import { Game } from '../src/engine';
import { playFight } from '../sim/policy';
import { HEXWEAVER_DEF, SLOT, defaultBattleConfig, makeDeckCard, resolveCard, partyFromMembers, abilityCardsForParty, isAbilityCard } from '../src/constants';
import type { CardId, BattleConfig, MemberId } from '../src/constants';

// #44: swap a config's party AND re-inject the bound ability cards to match it
// (defaultBattleConfig injected the classic trio's; a party override must rebuild
// them or the new members have no ability cards to play).
function setParty(cfg: BattleConfig, ids: MemberId[]): void {
  cfg.party = partyFromMembers(ids);
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
}

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
  // #40 (graveyard): permadead members are now buried instead of returning as fresh
  // copies, so the sim can no longer re-draft the Warlock trap it just killed.
  // #41 (guaranteed act-1 recruit): forks 0/1 always offer a Recruit, so the
  // Gatewarden is now fought as a duo far more often.
  // #44 (abilities as per-member cards): small parties field a LEANER, heal-denser
  // deck and the buyer stopped loading up on offense — the curve got easier.
  // #39 (Warlock -> Hex controller): his Vulnerability amplifies ALL party damage, a
  // net party-power boost (he is a good pick now, not a trap).
  // #42 (real small-party decision): GOLD_PER_FIGHT 80->100, salaries rescaled up,
  // and the win bounty scales with empty deploy seats — so the sim's small act-1
  // rosters win more gold, a richer economy. The walls re-anchored up again
  // (Gatewarden ->90, Hexweaver ->208, Devourer ->216); full-run ~22% at N=1000.
  // Passive-MP upgrade repriced 75->150 (double): the buyer's strongest sustain lever
  // now costs a real gold commitment, so fewer runs can afford it and the later walls
  // got a touch harder — re-pinned on the new observed numbers.
  // ENEMY-FIRST ordering (2026-07-06): the enemy now takes the first turn — one
  // opening single-target strike lands before the player can act (restricted to a
  // single so it can't gib a squishy; see engine _openingStrike). That is one extra
  // hit per fight, which raised difficulty across the board: full-run ~22% -> ~10.5%,
  // the walls sharper (Gatewarden ~61% -> ~39%). Re-pinned on the new observed numbers
  // as a KNOWN regression — a dedicated balance pass (re-anchoring ENEMY_HP_BY_FIGHT)
  // is deferred, as the maintainer flagged the balance fix as separate work.
  // #47 (2026-07-06): the enemy no longer whiffs an aimed attack onto a corpse — a
  // telegraph pointing at a slot that has since died re-points to the nearest living
  // member (and a two-target drops its dead half onto the survivor). That lands hits
  // that previously wasted themselves, so the boss fights (where members die mid-fight)
  // got a touch harder: F2/F3/F4 73/73/72 -> 69/69/67, F5/F6/F7 42/40/40 -> 38/36/36,
  // F8 21 -> 17. The normals (F0/F1) are unchanged (nobody dies to re-point onto).
  // Re-pinned on the new observed numbers; the balance re-anchor remains deferred.
  eq('N=200 per-fight wins', JSON.stringify(perFightWins), JSON.stringify([198, 189, 69, 69, 67, 38, 36, 36, 17]));
  // Full-run gate around the observed ~10.5% (enemy-first regression; was ~22%).
  // CI-consistency, not a hard threshold, so subsample noise can't fail a healthy
  // build while a real drift still trips it.
  check('full-run consistent with the ~10.5% enemy-first band',
    r.fullRun.rate - r.fullRun.ci95 <= 0.16 && r.fullRun.rate + r.fullRun.ci95 >= 0.06,
    `${(r.fullRun.rate * 100).toFixed(1)}% ±${(r.fullRun.ci95 * 100).toFixed(1)}`);
  // Normals clear cleanly even under-strength: act-1/2 normals >= 88%, act-3 >= 85%.
  for (const fi of [0, 1, 3, 4]) check(`normal F${fi} clears >= 88%`, r.perFight[fi].rate >= 0.88);
  for (const fi of [6, 7]) check(`Act-3 normal F${fi} clears >= 85%`, r.perFight[fi].rate >= 0.85);
  // Provisional boss gates on the campaign observations. Re-pinned for ENEMY-FIRST
  // (2026-07-06): the opening strike lowered the conditional boss winrates (N=200:
  // Gatewarden ~39%, Hexweaver ~58%, Devourer ~53%). These are conditional on
  // REACHING the boss, so the later two are noisy (small n) — CI-consistent bands.
  const bandConsistent = (p: { rate: number; ci95: number }, lo: number, hi: number): boolean =>
    p.rate + p.ci95 >= lo && p.rate - p.ci95 <= hi;
  check('Act-1 boss (Gatewarden) consistent with ~28-50% (the enemy-first wall)', bandConsistent(r.perFight[2], 0.28, 0.50),
    `${(r.perFight[2].rate * 100).toFixed(1)}% ±${(r.perFight[2].ci95 * 100).toFixed(1)}`);
  check('Act-2 boss (Hexweaver) consistent with ~44-72%', bandConsistent(r.perFight[5], 0.44, 0.72),
    `${(r.perFight[5].rate * 100).toFixed(1)}% ±${(r.perFight[5].ci95 * 100).toFixed(1)}`);
  check('Act-3 boss (Devourer) consistent with ~36-72%', bandConsistent(r.perFight[8], 0.36, 0.72),
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
    // #44: the trio's bound ability cards (Imbue Venom / Bolster / Unleash) stand in
    // for the old three generic Ability cards.
    const ids: CardId[] = ['imbuePoison', 'bolster', 'unleash', 'highHeal', 'highHeal', 'lowHeal', 'lowHeal',
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
        // #44: each ability is its own bound card, played with no target.
        const abTaunt = handIdx(game, 'bolster');
        if (tank.alive && tank.taunt <= 1 && afford(game, abTaunt)) { game.playCard(abTaunt); acted = true; continue; }
        // offense: bolt when charged, else keep poison ticking
        const abBolt = handIdx(game, 'unleash');
        if (game.mage.alive && game.mageCharge >= 4 && afford(game, abBolt)) { game.playCard(abBolt); acted = true; continue; }
        const abPoison = handIdx(game, 'imbuePoison');
        if (game.ranger.alive && game.enemy.poisonTurns === 0 && afford(game, abPoison)) { game.playCard(abPoison); acted = true; continue; }
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

  // The redesigned Warlock (#39) takes NO self-damage: a full turn never chips him
  // (the old Soul Tithe that made him a permadeath magnet is gone).
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['warlock', 'tank', 'mage']);
  const g = new Game(7, cfg);
  g.start();
  const w = g.members[0];
  const hp0 = w.hp;
  g.enemy.hp = 999;
  g.endTurn();
  check('the Warlock takes no self-damage across a turn (no Soul Tithe)', w.alive && w.hp === hp0);
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

// --- issue 34 / #39: the re-lined tactics actually engage the abilities --------
// Not gates: the policy plans around Hex, Crescendo, and Provoke rather than firing
// them only in a corner case.
{
  // The Warlock's Hex (#39): the policy curses the enemy with Vulnerability, so a
  // Warlock comp reliably makes the enemy Vulnerable over a fight.
  let everHexed = false;
  for (let s = 1; s <= 40; s++) {
    const cfg = defaultBattleConfig();
    setParty(cfg, ['warlock', 'mage', 'graveAugur']); // #44: rebuild ability cards for the party
    cfg.enemy = { ...cfg.enemy, maxHP: 200 }; // a wall, so the fight lasts several turns
    const g = new Game(s, cfg);
    playFight(g, 12);
    if (g.log.some((e) => e.text.includes('hexes the enemy'))) everHexed = true;
  }
  check('the policy plays Hex to make the enemy Vulnerable (#39)', everHexed);

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

// --- Warlock is a low-damage controller (#39 redesign) ----------------------
{
  // The redesigned Warlock is a support controller, not a striker: his value is the
  // Hex (Vulnerability), so his own damage is low. (The old #31/#38 spec-value-7 and
  // Provoke-sink-avoidance tests were tied to the Soul-Tithe striker and are retired.)
  eq('Warlock damage is the controller value', MEMBER_POOL.warlock.damage, 3);
  eq('Warlock ability is Hex', MEMBER_POOL.warlock.ability, 'hex');
}

// --- #39: the Warlock is no longer a trap starter or the permadeath system ------
// The campaign harness measures the structural fix directly (per-starter spread,
// the banned-vs-allowed delta, and permadeaths-by-member). Playtest 2026-07-05 read
// warlock-start 21.8% vs ranger 54.4% (a 2.5x trap), a +11.8pp gain from BANNING
// him, and 386 Warlock permadeaths / 1000. This locks that all three are fixed.
{
  const N = 120;
  const rangerStart = aggregate(N, 1, { forceStarter: 'ranger' });
  const warlockStart = aggregate(N, 1, { forceStarter: 'warlock' });
  const banned = aggregate(N, 1, { forceStarter: 'ranger', ban: ['warlock'] });
  check('warlock is a viable starter (within ~12pp of ranger, was a 2.5x trap)',
    Math.abs(warlockStart.fullRun - rangerStart.fullRun) <= 0.12,
    `ranger ${(rangerStart.fullRun * 100).toFixed(1)}% vs warlock ${(warlockStart.fullRun * 100).toFixed(1)}%`);
  check('banning the Warlock no longer RAISES the winrate (the +11.8pp trap is gone)',
    banned.fullRun - rangerStart.fullRun <= 0.03,
    `allowed ${(rangerStart.fullRun * 100).toFixed(1)}% vs banned ${(banned.fullRun * 100).toFixed(1)}%`);
  check('the Warlock is no longer the permadeath system (near-zero permadeaths)',
    rangerStart.permadeathsByMember.warlock <= 2, `${rangerStart.permadeathsByMember.warlock} warlock permadeaths / ${N}`);
}

// --- #42: "field fewer, keep more" is a real decision (the gate) ----------------
// The playtest found sub-max deployment was NEVER right (best-2 collapsed to 0.3%).
// With the small-party build (loneWolf + focusStone + warband + the Warlock's
// fewer-allies Hex + the empty-seat gold), fielding 2 must be a WINNING line in at
// least one fight class — and a losing one without the build (so it's a real choice,
// not a free lunch).
{
  const edge = deploySizeEdge(150);
  check('with the small-party build, fielding 2 beats fielding 3 (sub-max is a real line)',
    edge.two > edge.three, `field-2 ${(edge.two * 100).toFixed(1)}% vs field-3 ${(edge.three * 100).toFixed(1)}%`);
  // Enemy-first (2026-07-06) made field-2 harder overall (it now tops out ~7%), so the
  // absolute lift shrank — but the PROPERTY holds: without the build field-2 collapses
  // to ~0%, so the build is still entirely what makes sub-max deployment a line. Lift
  // threshold relaxed 10pp -> 5pp to track the harder environment.
  check('the build is what makes it work (field-2 collapses without it — not a free lunch)',
    edge.two - edge.twoNoRelics >= 0.05, `build lifts field-2 by ${((edge.two - edge.twoNoRelics) * 100).toFixed(1)}pp`);
}

if (failed > 0) { console.error(`\nsim.test: ${passed} passed, ${failed} failed`); process.exit(1); }
else console.log(`sim.test: ${passed} passed`);
