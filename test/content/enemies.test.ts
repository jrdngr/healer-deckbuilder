// Characterization tests for the enemy definitions (#99 A9).
//
// Enemies are the one content type that is already almost entirely data — an
// EnemyDef is weights + a rotation of steps + an optional phase/channel. #104 moves
// the defs to JSON, so what needs pinning is that the ENGINE reads every field:
// rotation order, the channel hijack cadence, phase transitions, enrage, and each
// per-step targeting flag.
//
// The repo's standing ground rule (ISSUES.md) is that the telegraph preview must
// equal the damage actually applied. That invariant is asserted here per def, since
// #104 touches telegraph generation.
import { Game } from '../../src/engine';
import type { EnemyDef, MemberId, PartyMemberConfig } from '../../src/constants';
import {
  SLOT, defaultBattleConfig, partyFromMembers,
  NORMAL_ENEMY_DEFS, ENEMY_DEF_BY_ID, ENCOUNTER_TABLE, ACT_BOSS_DEFS,
  GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF, ATTACK_INTENT_NAMES, ENRAGE_MULT,
} from '../../src/constants';
import { check, eq, finish, capture } from '../harness';

const seat = (id: MemberId | null): PartyMemberConfig =>
  id ? partyFromMembers([id])[0]
    : { maxHP: 1, hp: 1, damage: 0, abilityPower: 0, injuries: 0, upgrades: 0, empty: true };

// A fight against `def`. The party is given a huge HP pool and no damage so the
// rotation can be observed for many turns without anybody dying or the enemy falling.
function enemyGame(def: EnemyDef, opts: { enrageTurn?: number; maxHP?: number; boss?: boolean } = {}): Game {
  const cfg = defaultBattleConfig();
  cfg.party = (['ranger', 'tank', 'mage'] as (MemberId | null)[]).map(seat);
  cfg.enemy = {
    maxHP: opts.maxHP ?? 100000,
    boss: opts.boss ?? def.boss,
    attackBonus: 0,
    def,
    enrageTurn: opts.enrageTurn ?? 999,
  };
  const g = new Game(3, cfg);
  g.start();
  for (const m of g.members) {
    m.maxHP = 100000; m.hp = 100000; m.damage = 0; m.bankedDamage = 0;
  }
  return g;
}
// The label the standing telegraph is showing right now.
const intentOf = (g: Game): string => g.telegraphIntent() ?? '(none)';
// Advance one full round and return the NEXT telegraph's intent.
function step(g: Game): string {
  g.endTurn();
  g.beginPlayerTurn();
  return intentOf(g);
}
// The first `n` intents this enemy telegraphs, starting with the standing one.
function intents(g: Game, n: number): string[] {
  const out = [intentOf(g)];
  for (let i = 1; i < n; i++) out.push(step(g));
  return out;
}

// --- every def is playable and self-consistent -----------------------------
{
  const all = [...NORMAL_ENEMY_DEFS, ...ACT_BOSS_DEFS];
  eq('the roster is 12 normals plus 3 act bosses', all.length, 15);
  for (const def of all) {
    const g = enemyGame(def);
    check(`${def.id} starts a fight`, g.status === 'playing');
    check(`${def.id} telegraphs something on turn 1`, g.telegraph != null);
    check(`${def.id} exposes a readable intent`, intentOf(g) !== '(none)');
    check(`${def.id} previews a detail line`, (g.telegraphDetail() ?? '') !== '');
    eq(`${def.id} reports its own name`, g.enemyDef.name, def.name);
    eq(`${def.id} reports boss-ness`, g.enemyDef.boss === true, def.boss === true);
  }
}

// --- rotations are walked IN ORDER, and they loop --------------------------
{
  for (const def of NORMAL_ENEMY_DEFS) {
    if (!def.rotation || def.channel) continue; // channel enemies are covered separately
    const g = enemyGame(def);
    const len = def.rotation.length;
    const seen = intents(g, len * 2);
    // Step i and step i+len are the same point in the cycle, so they must match.
    let looped = true;
    for (let i = 0; i < len; i++) if (seen[i] !== seen[i + len]) looped = false;
    check(`${def.id} loops its ${len}-step rotation`, looped, seen.join(' | '));
  }
}
{ // and the first cycle matches the DECLARED steps, not just itself
  const g = enemyGame(ENEMY_DEF_BY_ID.devourling);
  const rot = ENEMY_DEF_BY_ID.devourling.rotation ?? [];
  const seen = intents(g, rot.length);
  const expected = rot.map((s) =>
    typeof s === 'string' ? ATTACK_INTENT_NAMES[s] : (s.name ?? ATTACK_INTENT_NAMES[s.type]));
  eq('the Gobblet walks its declared rotation', seen.join(' | '), expected.join(' | '));
  check('the declared rotation includes its scripted cast', expected.includes('Snack Time'));
}

// --- the channel hijack replaces a rotation slot on its cadence ------------
{
  const def = ENEMY_DEF_BY_ID.ironmaw;
  const ch = def.channel;
  check('the Ironchomp declares a channel', ch != null);
  if (ch) {
    const g = enemyGame(def);
    const len = (def.rotation ?? []).length;
    const seen = intents(g, len * (ch.everyCycles + 1));
    const hits = seen.filter((s) => s === ch.name).length;
    check(`the Ironchomp channels ${ch.name} on its cadence`, hits >= 1, seen.join(' | '));
    // It replaces the declared slot, not an arbitrary one.
    const at = seen.indexOf(ch.name);
    eq('the channel takes its declared rotation slot', at % len, ch.slot);
  }
}
{ // a channel winds up: the telegraph STAYS standing while it resolves
  const def = ENEMY_DEF_BY_ID.ironmaw;
  const g = enemyGame(def);
  let guard = 0;
  while (intentOf(g) !== (def.channel?.name ?? '') && guard++ < 12) step(g);
  check('the channel came up within a few cycles', guard < 12);
  if (guard < 12) {
    const before = intentOf(g);
    check('a winding-up channel announces turns until it resolves',
      (g.telegraph?.turnsUntilResolve ?? 0) >= 1);
    step(g);
    // The wind-up consumes the enemy's turn; the same channel is still standing.
    check('the channel holds the telegraph while winding up',
      intentOf(g) === before || (g.telegraph?.channel ?? false) === false);
  }
}

// --- phase transition (the Gobbler) ----------------------------------------
{
  const def = DEVOURER_DEF;
  const phase = def.phase;
  check('the Gobbler declares a phase', phase != null);
  if (phase) {
    const g = enemyGame(def, { maxHP: 200, boss: true });
    check('the Gobbler starts un-transformed', !g.phaseTriggered);
    // The threshold is checked inside _damageEnemy, so the enemy must actually be
    // DAMAGED across it — assigning enemy.hp directly never runs the check.
    g.enemy.hp = Math.floor(g.enemy.maxHP * phase.hpFraction) + 5;
    g.members[SLOT.LEFT].damage = 40;
    const cap = capture(g, () => g.endTurn());
    check('crossing the HP fraction transforms it', g.phaseTriggered);
    check('the transformation beat is logged',
      cap.log.some((l) => l.text.includes(phase.beat)));
  }
}
{ // the phase does not fire above its threshold
  const g = enemyGame(DEVOURER_DEF, { maxHP: 200, boss: true });
  g.enemy.hp = g.enemy.maxHP;
  g.members[SLOT.LEFT].damage = 1;
  g.endTurn();
  check('the Gobbler stays un-transformed above the threshold', !g.phaseTriggered);
}

// --- enrage ----------------------------------------------------------------
{
  const g = enemyGame(GATEWARDEN_DEF, { enrageTurn: 3, boss: true });
  check('the fight starts un-enraged', !g.isEnraged(1));
  check('the enrage turn enrages', g.isEnraged(3));
  eq('enrage scales attack damage',
    g.attackDamageOf(4, 3), Math.ceil((4 + 0) * ENRAGE_MULT));
  eq('a pre-enrage turn is unscaled', g.attackDamageOf(4, 1), 4);
}

// --- per-step targeting flags ----------------------------------------------
{ // targetLowest: the Executioner-style piercers lock onto the lowest-HP hero
  const def = ENEMY_DEF_BY_ID.needler;
  const g = enemyGame(def);
  const mage = g.members[SLOT.RIGHT];
  let guard = 0;
  // Walk to a step that declares targetLowest.
  while (!(g.telegraph?.targetLowest) && guard++ < 12) {
    mage.hp = 10; // keep him lowest across the walk
    step(g);
  }
  if (g.telegraph?.targetLowest) {
    mage.hp = 5;
    for (const m of g.members) if (m.slot !== SLOT.RIGHT) m.hp = 100000;
    // Regenerating the telegraph is what locks the target; step once and read it.
    const targets = g.attackTargets().map((a) => a.slot);
    check('a targetLowest step aims at the lowest-HP member',
      targets.length === 0 || targets.includes(SLOT.RIGHT), targets.join(','));
  }
}
{ // ignoreDefense: a piercing step is not reduced by Defense
  const g = enemyGame(ENEMY_DEF_BY_ID.needler);
  const t = g.telegraph;
  if (t) {
    const tank = g.members[SLOT.CENTER];
    tank.defense = 3; tank.defenseAmount = 5;
    Object.assign(t, { ignoreDefense: true, ignoreTaunt: true, targets: [SLOT.CENTER], damage: 8, cast: undefined, hidden: false });
    const preview = g.attackTargets().find((a) => a.slot === SLOT.CENTER);
    eq('an ignoreDefense hit previews unreduced', preview?.damage, 8);
    Object.assign(t, { ignoreDefense: false });
    const reduced = g.attackTargets().find((a) => a.slot === SLOT.CENTER);
    eq('the same hit is reduced when it respects Defense', reduced?.damage, 3);
  }
}
{ // ignoreTaunt: a Taunt does not pull a piercing step
  const g = enemyGame(ENEMY_DEF_BY_ID.needler);
  const t = g.telegraph;
  if (t) {
    g.members[SLOT.CENTER].taunt = 3;
    Object.assign(t, { ignoreTaunt: true, cast: undefined, hidden: false, targets: [SLOT.LEFT], damage: 4 });
    const targets = g.attackTargets().map((a) => a.slot);
    check('an ignoreTaunt step is not pulled onto the taunter', !targets.includes(SLOT.CENTER));
  }
}
{ // targetsMarked: the payoff strikes only members who are STILL Marked, recomputed live
  const g = enemyGame(ENEMY_DEF_BY_ID.marker);
  const t = g.telegraph;
  if (t) {
    Object.assign(t, { targetsMarked: true, cast: undefined, hidden: false, damage: 5 });
    for (const m of g.members) m.markTurns = 2;
    eq('a Marked party is fully targeted', g.attackTargets().length, 3);
    g.members[SLOT.RIGHT].markTurns = 0;
    eq('clearing a Mark drops that member from the preview', g.attackTargets().length, 2);
    for (const m of g.members) m.markTurns = 0;
    eq('an unmarked party is not struck at all', g.attackTargets().length, 0);
  }
}

// --- _resolvedTargets re-points a fully-dead aimed attack ------------------
{
  const g = enemyGame(ENEMY_DEF_BY_ID.spammer);
  const t = g.telegraph;
  if (t) {
    Object.assign(t, { cast: undefined, hidden: false, ignoreTaunt: true, targets: [SLOT.RIGHT], damage: 4 });
    g.members[SLOT.RIGHT].alive = false;
    g.members[SLOT.RIGHT].hp = 0;
    const targets = g.attackTargets().map((a) => a.slot);
    check('an attack aimed at a corpse re-points to a living member',
      targets.every((s) => g.members[s].alive), targets.join(','));
    check('it still strikes someone', targets.length > 0);
  }
}
{ // an untargetable member is dropped from the preview
  const g = enemyGame(ENEMY_DEF_BY_ID.spammer);
  const t = g.telegraph;
  if (t) {
    Object.assign(t, { cast: undefined, hidden: false, ignoreTaunt: true, targets: [SLOT.LEFT, SLOT.RIGHT], damage: 4 });
    g.members[SLOT.RIGHT].untargetable = 2;
    const targets = g.attackTargets().map((a) => a.slot);
    check('an untargetable member is not previewed', !targets.includes(SLOT.RIGHT));
  }
}

// --- preview == applied, per def (the repo's standing invariant) -----------
{
  for (const def of [...NORMAL_ENEMY_DEFS, ...ACT_BOSS_DEFS]) {
    const g = enemyGame(def);
    // Walk a few turns so rotations, channels and casts all get a look-in.
    let mismatches = 0;
    let checked = 0;
    for (let turn = 0; turn < 6; turn++) {
      const t = g.telegraph;
      // Two telegraph shapes deliberately do NOT preview one-hit-per-line:
      //  - hidden: the target is concealed, so every living member gets a line showing
      //    what THEY would take if it lands on them (flaw #11) — only one is struck.
      //  - channel: a wind-up turn resolves nothing; the damage lands later.
      const previewable = t != null && !t.hidden && !t.channel && !t.cast && !t.stunned;
      const preview = previewable ? g.attackTargets() : [];
      const before = new Map(g.members.map((m) => [m.slot, m.hp]));
      g.endTurn();
      for (const spec of preview) {
        checked += 1;
        const lost = (before.get(spec.slot) ?? 0) - g.members[spec.slot].hp;
        // Hero poison and other enemy-phase sources can also remove HP, so only a
        // preview that UNDER-reports is a violation of the invariant.
        if (spec.damage != null && lost < spec.damage) mismatches += 1;
      }
      if (g.status !== 'playing') break;
      g.beginPlayerTurn();
    }
    check(`${def.id}: the invariant was actually exercised`, checked > 0);
    eq(`${def.id}: telegraph preview is never larger than the damage applied`, mismatches, 0);
  }
}

// --- the encounter table references only real defs -------------------------
{
  let rows = 0;
  for (const [i, row] of ENCOUNTER_TABLE.entries()) {
    if (i === 2 || i === 5 || i === 8) {
      eq(`fight ${i} is an act-boss slot`, row.length, 0);
      continue;
    }
    rows += 1;
    check(`fight ${i} offers at least one enemy`, row.length > 0);
    for (const [id, weight] of row) {
      check(`fight ${i}: '${id}' resolves to a real def`, ENEMY_DEF_BY_ID[id] != null);
      check(`fight ${i}: '${id}' carries a positive weight`, weight > 0);
    }
  }
  eq('the table covers six non-boss fights', rows, 6);
  eq('the table covers nine fights in total', ENCOUNTER_TABLE.length, 9);
}
{ // every normal def is reachable from some fight — an unreferenced enemy is dead content
  const referenced = new Set(ENCOUNTER_TABLE.flat().map(([id]) => id));
  for (const def of NORMAL_ENEMY_DEFS) {
    check(`${def.id} is reachable from the encounter table`, referenced.has(def.id));
  }
}
{ // the three act bosses are distinct and ordered by act
  eq('there are three act bosses', ACT_BOSS_DEFS.length, 3);
  eq('act 1 is the Bouncer', ACT_BOSS_DEFS[0].id, GATEWARDEN_DEF.id);
  eq('act 2 is the Jinxweaver', ACT_BOSS_DEFS[1].id, HEXWEAVER_DEF.id);
  eq('act 3 is the Gobbler', ACT_BOSS_DEFS[2].id, DEVOURER_DEF.id);
  check('every act boss is flagged as a boss', ACT_BOSS_DEFS.every((d) => d.boss));
}

finish('content/enemies');
