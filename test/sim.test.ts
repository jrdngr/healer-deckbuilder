// Sim-harness test. Run with: tsx test/sim.test.ts
//
// Guards the two properties the balance gates rely on: the harness is
// deterministic (same seed -> identical result) and its aggregate winrate is
// stable (a fixed seed range produces a fixed number, so an accidental engine or
// policy change is caught). The absolute numbers here are the harness's living
// baseline, not a balance target — see the BASELINE note in sim/run-sim.ts.

import { runSingleRun, runSim } from '../sim/run-sim';
import { STICK, OPTIMAL, AVERAGE, POOR } from '../sim/profile';
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

// --- skill-tier harness (2026-07-07): additive, doesn't touch the pinned stick -----
{
  // The STICK profile is exactly the default path — passing it explicitly changes nothing
  // (this is what keeps the pinned vector above valid: the default draws no policy RNG).
  for (const seed of [1, 42, 777]) {
    eq(`runSingleRun(${seed}) with STICK profile == default`,
      JSON.stringify(runSingleRun(seed, undefined, { profile: STICK })),
      JSON.stringify(runSingleRun(seed)));
  }
  // Each tier is itself seed-deterministic (the mistake RNG is seeded off the fight seed).
  for (const profile of [OPTIMAL, AVERAGE, POOR]) {
    eq(`the ${profile.tier} tier is deterministic`,
      JSON.stringify(runSingleRun(9, undefined, { profile })),
      JSON.stringify(runSingleRun(9, undefined, { profile })));
  }
  // The skill gradient is monotonic: optimal >= average >= poor at a small N.
  const rate = (p: typeof STICK): number => runSim(120, 1, undefined, { profile: p }).fullRun.rate;
  const [o, a, pr] = [rate(OPTIMAL), rate(AVERAGE), rate(POOR)];
  check('skill gradient is monotonic (optimal >= average >= poor)', o >= a && a >= pr,
    `optimal ${(o * 100).toFixed(0)}% >= average ${(a * 100).toFixed(0)}% >= poor ${(pr * 100).toFixed(0)}%`);
  // A deployment cap fields fewer members: solo (cap 1) is strictly harder than the trio.
  const trio = runSim(120, 1, undefined, { profile: OPTIMAL, maxDeploy: 3 }).fullRun.rate;
  const solo = runSim(120, 1, undefined, { profile: OPTIMAL, maxDeploy: 1 }).fullRun.rate;
  check('a solo deployment cap is harder than the trio', solo < trio,
    `solo ${(solo * 100).toFixed(0)}% < trio ${(trio * 100).toFixed(0)}%`);
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
  // #51 (2026-07-06): the starter deck became the heal-only six (1× Group Heal / 3×
  // Quick Heal / 2× Heal), dropping the starter Regen/Refresh/Shield/Resurrect. The
  // leaner, heal-DENSE 6-card opener cycles twice as fast to the heals the policy
  // actually plays and stops clogging draws with the removed utility, so the sim got
  // EASIER across the board: F0/F1 189/198 -> 200/200, the walls softened (F2 69->80,
  // F5 38->53, F8 17->22). A KNOWN shift; the #58 balance pass re-anchors the settled
  // system. Re-pinned on the new observed numbers.
  // #52 (2026-07-06): Regen reworked to magnitude==duration with additive stacking —
  // the card now applies Regen 2 (heal 2 then 1, triangular) and re-casts stack, so
  // the policy's tank-Regen sustain heals more per cast. A small EASIER nudge on the
  // fights where members trade blows: F2/F3/F4 80/80/79 -> 81/81/80, F5/F6/F7 53 -> 54,
  // F8 22 -> 26 (F0/F1 already 200). A KNOWN shift; the #58 balance pass re-anchors the
  // settled system. Re-pinned on the new observed numbers.
  // #53 (2026-07-06): passive MP is now gated on a restrained turn (≤1 card played),
  // matching the Rest gate. This reshuffles MP timing (mostly the Pact of Silence line),
  // nudging the policy's play/Rest choices; the net was a small shift on the fights where
  // members trade blows: F4 80 -> 81, F5/F6/F7 54 -> 56. A KNOWN shift; the #58 balance
  // pass re-anchors the settled system. Re-pinned on the new observed numbers.
  // #55 (2026-07-06): the start draft now samples three heroes from the FULL pool
  // instead of the fixed striker trio, so some seeds offer no conventional striker as
  // a starter — the policy's solo carry into fight 0 is weaker on those seeds. A small
  // HARDER nudge, mostly on the early solo/wall fights: F1 200 -> 199, F2/F3/F4 81 -> 77,
  // F5/F6 56 -> 57, F8 26 -> 21 (F0 stays 200; F7 stays 56). A KNOWN shift; the #58
  // balance pass re-anchors the settled system. Re-pinned on the new observed numbers.
  // #56 (2026-07-06): recruiter cadence — the post-boss auto-draft is removed and a
  // Recruit node is guaranteed in the fork that begins each cycle (after fight 1, and
  // after each boss). The roster now grows only if the player ROUTES to the recruiter,
  // and the changed map-injection RNG reshuffles the whole downstream stream, so the
  // per-fight vector moved broadly: F0/F1 200/199 -> 197/194, F2/F3 77 -> 97, F4 77 ->
  // 94, F5/F6 57 -> 62, F7 56 -> 61, F8 21 -> 25 (the guaranteed post-boss recruiters
  // let more seeds field a full three into the later walls). A KNOWN shift; the #58
  // balance pass re-anchors the settled system. Re-pinned on the new observed numbers.
  // #57 (2026-07-06): a free card reward now follows EVERY won fight (pick 1 of 3,
  // rarity-weighted). The greedy sim policy takes any offer above the shop bar, which
  // steadily DILUTES the lean, heal-/ability-dense deck the campaign relies on — so
  // draws of the per-fight ability cards and the heal core thin out and the walls got
  // harder: F0/F1 unchanged (the first reward lands after F0), F2 97 -> 89, F3/F4 97/94
  // -> 88/87, F5 62 -> 47, F6/F7 62/61 -> 46/46, F8 25 -> 14; full-run ~10.5% -> ~7%.
  // This is a real power-flow change that #58's balance pass owns (it re-anchors the
  // settled system once between-fight healing lands). Re-pinned on the new numbers.
  // #58 (2026-07-06): THE balance pass. HP now PERSISTS across fights and members
  // heal only HERO_HEAL_PCT (0.40, chosen by the sim/heal-exp.ts sweep) of max HP
  // between them; a member dead at the end of a won fight resurrects to that recovered
  // amount; the Infirmary node (heal HP / shed a scar for gold) is back. Persistent HP
  // is a systemic NERF (damage carries forward), so this pass re-anchored the whole
  // enemy-HP curve DOWN — the KNOWN ~7% deferred regression from #45-#57 + enemy-first
  // was owned here. ENEMY_HP_BY_FIGHT: Gatewarden 90->64, Hexweaver 208->174, Devourer
  // 216->172, and the act-2/3 normals eased (F3 70->58, F4 88->72, F6 102->94, F7
  // 108->100). Result: the bosses cluster ~67-71% and full-run lands ~23% (N=1000:
  // 23.3% ±2.6; bosses 68.4 / 71.2 / 66.0%), back in the roster-campaign band. The
  // per-fight vector rose broadly: F2 89->133, F3/F4 88/87->124/111, F5 47->75, F6/F7
  // 46->70/65, F8 14->45. Re-pinned on the new observed numbers.
  // 2026-07-07: the branch hub now SWAPS an un-openable stop (a forced Recruiter on a
  // full roster, an Infirmary with nobody hurt) for an available one instead of leaving
  // it blank. The swap consumes an rng draw when it fires, nudging the deterministic
  // stream, so the vector shifts slightly: F2 133->138, F3/F4 124/111->130/119, F5
  // 75->76, F6/F7 70/65->72/66, F8 45->47 (F0/F1 unchanged). A stream perturbation, not
  // a balance move; all the band/CI gates below still hold. Re-pinned on the new numbers.
  // 2026-07-07 (#61): the Sentinel joins the roster as a 9th draftable member, so the
  // start/post-boss drafts now sample from a pool of 9 instead of 8. That extra draw
  // perturbs the deterministic rng stream (and the best-3 policy occasionally seats the
  // Sentinel), shifting the vector: F0/F1 198/195->194/193, F2 138->133, F3/F4 130/119->
  // 126/112, F5 76->83, F6/F7 72/66->75/69, F8 unchanged at 47. A pool/stream change, not
  // a balance move; all the band/CI/boss gates below still hold. Re-pinned on the new numbers.
  // 2026-07-07 (#62): the hero buff card batch adds 7 shop-eligible cards to CARD_POOL,
  // so every shop's weighted card offer draws from a larger pool — a pure rng-stream
  // perturbation (the best-3 policy has no tactic for the buffs, buy value 1, so it never
  // banks them). The vector shifts: F1 193->194, F2 133->142, F3/F4 126/112->127/120, F5
  // 83->100, F6/F7 75/69->91/84, F8 47->56 (F0 unchanged). All band/CI/boss gates below
  // still hold; re-pinned on the new observed numbers.
  // 2026-07-07 (#63): the 3 shoppable Shadow cards (Shadow Bolt, Siphon Life, Doom)
  // join CARD_POOL, so every shop's weighted card offer draws from a larger pool — a
  // pure rng-stream perturbation (the best-3 policy has no debuff-first tactic, low buy
  // value, so it never banks them). The vector shifts: F1 194->193, F2 142->137, F3/F4
  // 127/120->126/115, F5 100->89, F6/F7 91/84->82/78, F8 56->59 (F0 unchanged). All
  // band/CI/boss gates below still hold; re-pinned on the new observed numbers.
  // 2026-07-07 (#63 relics): the 3 card-type synergy relics (Reliquary of Light,
  // Shadow Sigil, Iron Ward) join the relic pool, so every spoils/reliquary roll draws
  // from a larger pool — a pure rng-stream perturbation (the best-3 policy values them
  // 0 and never banks one). The vector shifts: F3/F4 126/115->124/117, F5 89->88, F6/F7
  // 82/78->81/76, F8 59->51 (F0-F2 unchanged). All gates below still hold; re-pinned.
  // 2026-07-07 (#63 count cards): 2 more shop-eligible cards (Cascade, Nightfall) join
  // CARD_POOL — another pure rng-stream perturbation (buy value 1, never banked). The
  // vector shifts: F2 137->139, F3/F4 124/117->130/121, F5 88->93, F6/F7 81/76->86/82,
  // F8 51->54 (F0/F1 unchanged). All gates below still hold; re-pinned.
  // 2026-07-07 (#64 channeled cards): 4 more shop-eligible cards (Drain, Mending Stream,
  // Sap, Fortify) join CARD_POOL, and Refresh is reworked from an MP-over-time buff into
  // a channel — another pure rng-stream perturbation (all channeled cards carry buy value
  // 1, never banked; the best-3 policy has no "commit the whole turn to a channel" line).
  // The vector shifts: F2 139->135, F3/F4 130/121->125/118, F5 93->91, F6/F7 86/82->84/80,
  // F8 54->53 (F0/F1 unchanged). All band/CI/boss gates below still hold; re-pinned.
  // ==========================================================================
  // 2026-07-07 SKILL-TIER BALANCE PASS. This is a deliberate difficulty re-anchor,
  // NOT a stream perturbation. The sim gained three play-quality tiers (optimal /
  // average / poor — see sim/profile.ts + sim/balance-tiers.ts) and the content was
  // tuned so the FLAWLESS good-player line (the default STICK profile this test pins)
  // lands the maintainer's OPTIMAL target of ~75% full-run, with the difficulty
  // gradient carried by the tiers: average ~30%, poor <1%. What moved:
  //   • ENEMY_HP_BY_FIGHT re-anchored DOWN — Gatewarden 64->35, Hexweaver 174->120,
  //     Devourer 172->120, and the normals eased (F0 14->10, F1 20->15, F3 58->40,
  //     F4 72->50, F6 94->65, F7 100->75). The bosses stay the walls but are
  //     answerable; normals clear ~97-100%.
  //   • Solo-only levers buffed to make a solo Warlock ~25% (target): HEX_VULN_BY_SIZE
  //     solo 1.0->2.2, WARBAND_HP_PER_SEAT 3->8, LONE_WOLF_DMG 2->4. All are gated on
  //     fielding <= SMALL_PARTY_MAX, so the best-3 STICK line here is UNCHANGED by them.
  // The STICK profile now reads ~75-77% full-run (bosses ~91/97/92% conditional at
  // N=200) because the stick IS a near-flawless good player and the content is tuned
  // to that ceiling. deaths/won-fight fell for the flawless line (it wins by keeping
  // the party alive); the healing/attrition pressure now lives at the AVERAGE tier
  // (~1.3 scars/run). Re-pinned on the new observed numbers.
  // 2026-07-08 (#65 Iron mitigation web): 3 shop-eligible Iron cards (Feint, Anvil
  // Stance, Interlock) join CARD_POOL and 2 relics (Whetstone, Bulwark Core) join the
  // relic pool — a pure rng-stream perturbation (the best-3 policy has no steer-and-block
  // line; the cards carry buy value 1 and the relics value 0, so it never banks them).
  // The vector shifts: F2 182->181, F4 176->175, F5 170->167, F6 168->164, F7 168->161,
  // F8 155->153 (F0/F1/F3 unchanged). All band/CI/boss gates below still hold; re-pinned.
  // 2026-07-08 (#66 Regen conversions): 2 more shop-eligible Nature cards (Thornskin,
  // Sporeburst) join CARD_POOL and 2 relics (Deep Roots, Ossuary Bell) join the relic
  // pool — the same pure rng-stream perturbation (the best-3 policy has no Regen-currency
  // line; the cards carry buy value 1 and the relics value 0, so it never banks them).
  // The vector shifts: F2 181->179, F4 175->174, F5 167->166, F7 161->160, F8 153->150
  // (F0/F1/F3/F6 unchanged). All band/CI/boss gates below still hold; re-pinned.
  eq('N=200 per-fight wins', JSON.stringify(perFightWins), JSON.stringify([200, 199, 179, 176, 174, 166, 164, 160, 150]));
  // Full-run gate around the ~75% OPTIMAL ceiling the flawless STICK line now hits.
  // CI-consistency, not a hard threshold, so subsample noise can't fail a healthy
  // build while a real drift still trips it.
  check('full-run consistent with the ~75% optimal ceiling (2026-07-07 skill-tier pass)',
    r.fullRun.rate - r.fullRun.ci95 <= 0.86 && r.fullRun.rate + r.fullRun.ci95 >= 0.66,
    `${(r.fullRun.rate * 100).toFixed(1)}% ±${(r.fullRun.ci95 * 100).toFixed(1)}`);
  // Normals clear cleanly for the flawless line: all normals >= 90%.
  for (const fi of [0, 1, 3, 4]) check(`normal F${fi} clears >= 90%`, r.perFight[fi].rate >= 0.90);
  for (const fi of [6, 7]) check(`Act-3 normal F${fi} clears >= 90%`, r.perFight[fi].rate >= 0.90);
  // Boss gates re-anchored by the skill-tier pass: the flawless line answers all three
  // bosses ~88-96% conditional (N=200: 88.5 / 96.5 / 95.1%). Conditional on REACHING,
  // so CI-consistent bands, not point thresholds.
  const bandConsistent = (p: { rate: number; ci95: number }, lo: number, hi: number): boolean =>
    p.rate + p.ci95 >= lo && p.rate - p.ci95 <= hi;
  check('Act-1 boss (Gatewarden) consistent with ~82-97% (skill-tier pass)', bandConsistent(r.perFight[2], 0.82, 0.97),
    `${(r.perFight[2].rate * 100).toFixed(1)}% ±${(r.perFight[2].ci95 * 100).toFixed(1)}`);
  check('Act-2 boss (Hexweaver) consistent with ~88-100% (skill-tier pass)', bandConsistent(r.perFight[5], 0.88, 1.0),
    `${(r.perFight[5].rate * 100).toFixed(1)}% ±${(r.perFight[5].ci95 * 100).toFixed(1)}`);
  check('Act-3 boss (Devourer) consistent with ~86-100% (skill-tier pass)', bandConsistent(r.perFight[8], 0.86, 1.0),
    `${(r.perFight[8].rate * 100).toFixed(1)}% ±${(r.perFight[8].ci95 * 100).toFixed(1)}`);
}

// --- DR1: the harness reports injury telemetry -------------------------------
{
  const r = runSim(200, 1);
  eq('deathsPerWin is reported per fight', r.deathsPerWin.length, r.perFight.length);
  check('deaths per won fight are non-negative', r.deathsPerWin.every((d) => d >= 0));
  // The sacrifice signal DR1 named: even the flawless line still spends members on the
  // act-2/3 walls (F5/F8 ~0.35-0.38 deaths/won-fight). The 2026-07-07 skill-tier pass
  // eased the Gatewarden hard (37 HP), so the flawless line now clears F2 nearly
  // death-free (~0.06) — the real attrition pressure moved to the AVERAGE tier
  // (~1.3 scars/run); here we only assert the later bosses still bite.
  check('the act-2/3 bosses still cost member deaths (the DR1 signal)',
    r.deathsPerWin[2] >= 0 && r.deathsPerWin[5] > 0.25 && r.deathsPerWin[8] > 0.25,
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
  // Aim the standing telegraph at the Tank (slot 1) so the only thing that could
  // move the Warlock's HP this turn is a self-damage effect — isolating the "no
  // Soul Tithe" check from incidental enemy fire. (The heal-only starter deck of
  // #51 reshuffled the RNG stream, so the turn-1 telegraph would otherwise land on
  // slot 0; the redirect makes the assertion deck-independent.)
  if (g.telegraph) g.telegraph.targets = [SLOT.CENTER];
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
  // 2026-07-07 skill-tier pass buffed the small-party relics to make a solo Warlock
  // viable (WARBAND_HP_PER_SEAT 3->8, LONE_WOLF_DMG 2->4). A happy side effect: on this
  // fixed contest the small-party BUILD now makes fielding 2 clearly OUT-winrate fielding
  // 3 (field-2 ~41% vs field-3 ~20%), so "field fewer, keep more" is a genuinely winning
  // line again (and still a losing one WITHOUT the build — not a free lunch).
  check('the small-party build makes sub-max a winning line (buffed relics)',
    edge.two >= 0.03, `field-2 ${(edge.two * 100).toFixed(1)}% vs field-3 ${(edge.three * 100).toFixed(1)}%`);
  check('the build is what makes it work (field-2 collapses without it — not a free lunch)',
    edge.two - edge.twoNoRelics >= 0.05, `build lifts field-2 by ${((edge.two - edge.twoNoRelics) * 100).toFixed(1)}pp`);
}

if (failed > 0) { console.error(`\nsim.test: ${passed} passed, ${failed} failed`); process.exit(1); }
else console.log(`sim.test: ${passed} passed`);
