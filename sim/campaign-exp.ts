// Campaign experiment harness (#39, promoted from the 2026-07-05 playtest session).
//
// Measures the structural balance the roster campaign cares about but the aggregate
// winrate hides: how a FORCED starter performs, how much BANNING a member from every
// offer moves the winrate (a strictly-dominated hire is one the roster is better off
// never taking), and WHICH members the permadeath system actually removes.
//
// Run with: npx tsx sim/campaign-exp.ts [N]   (default N=1000)
//
// It reuses the real campaign policy (draftPick / deployBest / …) and the real Run,
// so the numbers are the campaign the game actually plays — only the starter choice
// and the offer pool are overridden.

import { Game } from '../src/engine';
import { Run } from '../src/run';
import { FIGHT_COUNT, DRAFT_POOL, defaultBattleConfig, partyFromMembers, abilityCardsForParty, isAbilityCard, DEFAULT_ENEMY_DEF } from '../src/constants';
import type { MemberId, RelicId, PartyMemberConfig, EnemyDef } from '../src/constants';
import { playFight, resolveNode, chooseBranch, chooseSpoil, advanceBranch, draftPick, deployBest } from './policy';

// Same per-fight sub-seed the real runner uses (run-sim.ts), recreated here so this
// harness doesn't need to reach into that module's internals.
function fightSeed(runSeed: number, fightIndex: number): number {
  return (Math.imul(runSeed, 0x9e3779b1) + fightIndex * 0x85ebca77) >>> 0;
}

interface RunResult {
  won: boolean;
  wonByFight: boolean[];   // did the run win fight i (false if it never reached it)
  reachedFight: boolean[]; // did the run reach fight i
  permadeaths: MemberId[]; // members removed by the 4th-death rule this run
}

interface Options {
  forceStarter?: MemberId; // choose this member at the start draft instead of the policy
  ban?: MemberId[];        // members excluded from the start draft and every Recruit offer
}

// One full campaign run. Mirrors run-sim's runSingleRun, with two overrides: a forced
// starter, and a banned set (seeded into the graveyard so availableMembers — which
// the start draft and every Recruit roll keys on — never offers them).
function runCampaign(seed: number, opts: Options = {}): RunResult {
  const run = new Run(seed);
  const ban = opts.ban ?? [];
  const banSet = new Set(ban);
  run.graveyard = [...ban]; // exclude the banned members from availableMembers()

  run.beginDraft();
  const wonByFight = new Array(FIGHT_COUNT).fill(false);
  const reachedFight = new Array(FIGHT_COUNT).fill(false);
  let guard = 0;
  while (run.status === 'playing' && guard < 1000) {
    guard++;
    switch (run.location.kind) {
      case 'fight': {
        const fi = run.location.fightIndex;
        reachedFight[fi] = true;
        const game = new Game(fightSeed(seed, fi), run.toBattleConfig());
        playFight(game);
        run.markRelicsSpent(game.spentRelicIds());
        const win = game.status === 'win';
        if (win) {
          wonByFight[fi] = true;
          run.recordInjuries(game.diedThisFightSlots());
          run.winFight();
        } else run.loseFight();
        break;
      }
      case 'spoils': run.pickSpoil(chooseSpoil(run)); break;
      case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
      case 'branch': advanceBranch(run); break;
      case 'node': resolveNode(run); run.completeNode(); break;
      case 'start': run.beginDraft(); break;
      case 'deploy': deployBest(run); break;
      case 'draft': {
        // Force the starter at the opening draft; otherwise let the policy pick.
        const opts2 = run.nodeContent?.type === 'draft' ? run.nodeContent.options : [];
        if (run.location.post === 'start' && opts.forceStarter && opts2.includes(opts.forceStarter)) {
          run.chooseDraftMember(opts.forceStarter);
        } else {
          draftPick(run);
        }
        break;
      }
      default: run.status = 'lost'; break;
    }
  }
  // Permadeaths = graveyard entries that were NOT part of the initial ban (banned
  // members never enter the roster, so they can't permadie).
  const permadeaths = run.graveyard.filter((id) => !banSet.has(id));
  return { won: run.status === 'won', wonByFight, reachedFight, permadeaths };
}

// Aggregate over a seed range.
interface Agg {
  n: number;
  fullRun: number;                 // full-run winrate
  f2Conditional: number;           // Gatewarden winrate among runs that reached it
  f2Solout: number;                // (informational) reached-F2 count
  permadeathsByMember: Record<string, number>;
}

function aggregate(n: number, firstSeed: number, opts: Options = {}): Agg {
  let full = 0, f2Reached = 0, f2Won = 0;
  const permaByMember: Record<string, number> = {};
  for (const id of DRAFT_POOL) permaByMember[id] = 0;
  for (let s = firstSeed; s < firstSeed + n; s++) {
    const r = runCampaign(s, opts);
    if (r.won) full++;
    if (r.reachedFight[2]) { f2Reached++; if (r.wonByFight[2]) f2Won++; }
    for (const id of r.permadeaths) permaByMember[id] = (permaByMember[id] ?? 0) + 1;
  }
  return {
    n,
    fullRun: full / n,
    f2Conditional: f2Reached === 0 ? 0 : f2Won / f2Reached,
    f2Solout: f2Reached,
    permadeathsByMember: permaByMember,
  };
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

// ---------------------------------------------------------------------------
// #42 gate: is a SUB-MAX deployment ever the winning line?
//
// Field K of a fixed roster against the same enemy, with the small-party build
// (loneWolf + focusStone + warband) equipped, and compare win rates. If fielding 2
// wins MORE than fielding 3 in some fight class, the deployment decision is real —
// the relics + the empty-seat gold + the Warlock's fewer-allies Hex outweigh the
// lost body there. Without them, a third body is always strictly better (the trap
// the playtest measured).
// ---------------------------------------------------------------------------

const SMALL_PARTY_RELICS: RelicId[] = ['loneWolf', 'focusStone', 'warband'];

function mkEmpty(): PartyMemberConfig {
  return { maxHP: 0, damage: 0, abilityPower: 0, injuries: 0, empty: true };
}

// Win rate fielding the first `fielded` members of `roster` against `enemyDef`/`hp`,
// with `relics` equipped, over N seeds. The battle party is length 3 (empties fill in).
function fieldedWinRate(n: number, roster: MemberId[], fielded: number, relics: RelicId[], enemyDef: EnemyDef, hp: number, attackBonus: number): number {
  const party = partyFromMembers(roster);
  let wins = 0;
  for (let s = 1; s <= n; s++) {
    const cfg = defaultBattleConfig();
    cfg.relics = relics;
    cfg.party = [0, 1, 2].map((i) => (i < fielded ? party[i] : mkEmpty()));
    cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
    cfg.enemy = { maxHP: hp, boss: false, attackBonus, def: enemyDef };
    const g = new Game(s, cfg);
    playFight(g);
    if (g.status === 'win') wins++;
  }
  return wins / n;
}

// The gate measurement: the small-party build's fielded-2 vs fielded-3 win rate on a
// fight tuned to be a genuine contest. The roster's third body is a low-damage soak
// (Tank), so dropping it and buffing the two strikers (loneWolf +2 each, plus the
// Warlock's Hex is stronger with fewer allies) can out-DPS the plain trio while
// warband/focusStone keep the smaller party alive.
export function deploySizeEdge(n: number): { two: number; three: number; twoNoRelics: number } {
  const roster: MemberId[] = ['warlock', 'mage', 'tank']; // Hex + striker + low-dmg soak
  // Contest HP re-anchored 108 -> 80 for the heal-only starter deck (#51): the leaner
  // 6-card opener (no starter Refresh/Regen/Shield/Resurrect) kills survivability on
  // this fixed fight, so 108 collapsed BOTH field sizes to ~3% (no longer a contest).
  // At 80 it is a genuine contest again (field-2 ~29% vs field-3 ~20%), and the
  // property still holds cleanly. The #58 balance pass owns the settled numbers.
  const hp = 80, atk = 3; // a real early-normal contest for this roster

  return {
    // Fielding 2 WITH the small-party build.
    two: fieldedWinRate(n, roster, 2, SMALL_PARTY_RELICS, DEFAULT_ENEMY_DEF, hp, atk),
    // Fielding 3 (the relics don't trigger past SMALL_PARTY_MAX, so it's the plain line).
    three: fieldedWinRate(n, roster, 3, SMALL_PARTY_RELICS, DEFAULT_ENEMY_DEF, hp, atk),
    // Fielding 2 WITHOUT the build — the "trap" baseline (a third body would be better).
    twoNoRelics: fieldedWinRate(n, roster, 2, [], DEFAULT_ENEMY_DEF, hp, atk),
  };
}

// CLI report.
if (process.argv[1] && process.argv[1].endsWith('campaign-exp.ts')) {
  const N = Number(process.argv[2] ?? 1000);
  console.log(`=== campaign experiment (N=${N} per line) ===\n`);

  console.log('-- per-starter (forced) --');
  for (const starter of ['ranger', 'mage', 'warlock'] as MemberId[]) {
    const a = aggregate(N, 1, { forceStarter: starter });
    console.log(`  start=${starter.padEnd(8)} full-run ${pct(a.fullRun)}   F2 ${pct(a.f2Conditional)} (reached ${a.f2Solout})`);
  }

  console.log('\n-- ban delta (ranger start) --');
  const allowed = aggregate(N, 1, { forceStarter: 'ranger' });
  const banned = aggregate(N, 1, { forceStarter: 'ranger', ban: ['warlock'] });
  const delta = banned.fullRun - allowed.fullRun;
  console.log(`  warlock allowed: ${pct(allowed.fullRun)}`);
  console.log(`  warlock banned:  ${pct(banned.fullRun)}`);
  console.log(`  ban delta:       ${(delta * 100).toFixed(1)}pp  ${Math.abs(delta) <= 0.03 ? '(within +/-3pp — not strictly dominated ✓)' : '(OUT of +/-3pp band)'}`);

  console.log('\n-- permadeaths by member (per ' + N + ' runs, ranger start) --');
  const byMember = allowed.permadeathsByMember;
  const total = Object.values(byMember).reduce((s, v) => s + v, 0);
  for (const id of DRAFT_POOL) {
    if (byMember[id] > 0) console.log(`  ${id.padEnd(11)} ${byMember[id]}`);
  }
  console.log(`  total permadeaths: ${total}`);

  console.log('\n-- #42 gate: is sub-max a winning line? (warlock/mage/tank, small-party build) --');
  const edge = deploySizeEdge(N);
  console.log(`  field 2 WITH small-party build: ${pct(edge.two)}`);
  console.log(`  field 3 (plain, relics inert):  ${pct(edge.three)}`);
  console.log(`  field 2 WITHOUT the build:      ${pct(edge.twoNoRelics)}  (the trap baseline)`);
  console.log(`  verdict: ${edge.two > edge.three ? 'sub-max IS the winning line here ✓' : 'sub-max still loses to max'} (build lifts field-2 by ${((edge.two - edge.twoNoRelics) * 100).toFixed(1)}pp)`);
}

export { runCampaign, aggregate };
export type { Options, Agg, RunResult };
