// Tests for the action interpreter (#100).
//
// The interpreter is wired to nothing yet — #101/#102 point the dispatch surfaces at
// it. These tests drive it directly against a live Game with hand-built action lists,
// so the op vocabulary is proven before 60+ arms are written in it.
import { Game } from '../../src/engine';
import type { Action } from '../../src/content/schema/dsl';
import { runActions, evalAmount, evalCondition, resolveSelector, STATUS_WRITERS } from '../../src/content/interpreter/run';
import type { ActionCtx } from '../../src/content/interpreter/run';
import { SLOT, TUNING } from '../../src/constants';
import { STATUS_TAGS } from '../../src/content/schema/dsl';
import { check, eq, finish, capture, expectEvent, expectLog } from '../harness';

function fresh(seed = 11): Game {
  const g = new Game(seed);
  g.start();
  for (const m of g.members) if (m.alive) { m.hp = m.maxHP; m.bankedDamage = 0; }
  g.mp = 20;
  g.enemy.hp = 400;
  return g;
}
const ctxFor = (over: Partial<ActionCtx> = {}): ActionCtx =>
  ({ target: SLOT.CENTER, vars: {}, ...over });

const run = (g: Game, actions: Action[], over: Partial<ActionCtx> = {}, natives = {}) => {
  const ctx = ctxFor(over);
  const cap = capture(g, () => runActions(g, actions, ctx, natives));
  return { cap, ctx };
};

// --- amounts ---------------------------------------------------------------
{
  const g = fresh();
  const ctx = ctxFor({ vars: { n: 7 }, card: { id: 'x', name: 'X', heal: 4 } });
  eq('a literal number', evalAmount(g, 5, ctx), 5);
  eq('a tuning key', evalAmount(g, { tune: 'POISON_BASE' }, ctx), TUNING.POISON_BASE);
  eq('an unknown tuning key is 0, not NaN', evalAmount(g, { tune: 'NOPE' }, ctx), 0);
  eq('a binding', evalAmount(g, { var: 'n' }, ctx), 7);
  eq('a card field', evalAmount(g, { card: 'heal' }, ctx), 4);
  eq('a card field falls back when absent',
    evalAmount(g, { card: 'regen', else: { tune: 'POISON_BASE' } }, ctx), TUNING.POISON_BASE);
  eq('a member stat', evalAmount(g, { stat: 'hp', of: '$target' }, ctx), g.members[SLOT.CENTER].hp);
  eq('an auto reads memberDamage',
    evalAmount(g, { auto: '$target' }, ctx), g.memberDamage(g.members[SLOT.CENTER]));
  eq('missingHp', evalAmount(g, { missingHp: '$target' }, ctx), 0);
  eq('sum', evalAmount(g, { sum: [1, 2, { var: 'n' }] }, ctx), 10);
  eq('mul', evalAmount(g, { mul: [2, 3] }, ctx), 6);
  eq('max', evalAmount(g, { max: [1, 9, 4] }, ctx), 9);
  eq('min', evalAmount(g, { min: [1, 9, 4] }, ctx), 1);
  eq('floor', evalAmount(g, { floor: { mul: [2.9, 1] } }, ctx), 2);
  eq('clampMin raises a low value', evalAmount(g, { clampMin: 1, atLeast: 5 }, ctx), 5);
  eq('clampMin leaves a high value alone', evalAmount(g, { clampMin: 9, atLeast: 5 }, ctx), 9);
  eq('nested composition', evalAmount(g, { sum: [{ mul: [2, 2] }, { max: [1, 3] }] }, ctx), 7);
}
{ // vulnerable scales through the engine's own helper
  const g = fresh();
  g.enemy.vulnerable = 1; g.enemy.vulnerableTurns = 3;
  eq('vulnerable applies the enemy debuff', evalAmount(g, { vulnerable: 10 }, ctxFor()), 20);
}
{
  const g = fresh();
  g.enemy.poison = 6;
  eq('an enemy stat', evalAmount(g, { enemyStat: 'poison' }, ctxFor()), 6);
  if (g.telegraph) {
    g.telegraph.damage = 5;
    eq('a telegraph stat', evalAmount(g, { telegraphStat: 'damage' }, ctxFor()), 5);
  }
}

// --- selectors -------------------------------------------------------------
{
  const g = fresh();
  const ctx = ctxFor({ self: g.members[SLOT.LEFT] });
  eq('$target', resolveSelector(g, '$target', ctx)[0].slot, SLOT.CENTER);
  eq('$self', resolveSelector(g, '$self', ctx)[0].slot, SLOT.LEFT);
  eq('$allLiving', resolveSelector(g, '$allLiving', ctx).length, 3);
  eq('$allLivingOther excludes the anchor',
    resolveSelector(g, '$allLivingOther', ctx).length, 2);
  check('$allLivingOther really excludes it',
    !resolveSelector(g, '$allLivingOther', ctx).some((m) => m.slot === SLOT.LEFT));
}
{
  const g = fresh();
  g.members[SLOT.RIGHT].hp = 1;
  const ctx = ctxFor({ self: g.members[SLOT.LEFT] });
  eq('$mostWoundedOther finds the wounded one',
    resolveSelector(g, '$mostWoundedOther', ctx)[0].slot, SLOT.RIGHT);
  eq('$lowestHp finds the lowest', resolveSelector(g, '$lowestHp', ctx)[0].slot, SLOT.RIGHT);
}
{ // $mostWounded is seeded with the CASTER — drainLife's exact tie-break
  const g = fresh();
  const ctx = ctxFor({ self: g.members[SLOT.LEFT] });
  eq('with nobody wounded, $mostWounded is the caster',
    resolveSelector(g, '$mostWounded', ctx)[0].slot, SLOT.LEFT);
  g.members[SLOT.RIGHT].hp = 1;
  eq('with someone wounded, $mostWounded finds them',
    resolveSelector(g, '$mostWounded', ctx)[0].slot, SLOT.RIGHT);
}
{ // $targetOrSelf falls back when the target is dead
  const g = fresh();
  g.members[SLOT.CENTER].alive = false;
  const ctx = ctxFor({ self: g.members[SLOT.LEFT] });
  eq('$targetOrSelf falls back to the caster',
    resolveSelector(g, '$targetOrSelf', ctx)[0].slot, SLOT.LEFT);
}
{ // a filtered selector
  const g = fresh();
  g.members[SLOT.RIGHT].hp = 1;
  eq('a where-filtered selector narrows the set',
    resolveSelector(g, { sel: '$allLiving', where: { hpFull: '$self' } }, ctxFor()).length, 2);
}

// --- conditions ------------------------------------------------------------
{
  const g = fresh();
  const ctx = ctxFor({ self: g.members[SLOT.LEFT] });
  check('hpFull on a full member', evalCondition(g, { hpFull: '$target' }, ctx));
  g.members[SLOT.CENTER].hp = 1;
  check('hpFull is false when wounded', !evalCondition(g, { hpFull: '$target' }, ctx));
  check('hpAtOrBelow', evalCondition(g, { hpAtOrBelow: 1, of: '$target' }, ctx));
  check('hpBelowFrac', evalCondition(g, { hpBelowFrac: 0.5, of: '$target' }, ctx));
  check('alive', evalCondition(g, { alive: '$target' }, ctx));
  check('exists', evalCondition(g, { exists: '$allLiving' }, ctx));
  check('not inverts', !evalCondition(g, { not: { alive: '$target' } }, ctx));
  check('all requires both',
    evalCondition(g, { all: [{ alive: '$target' }, { exists: '$self' }] }, ctx));
  check('all fails on one false',
    !evalCondition(g, { all: [{ alive: '$target' }, { hpFull: '$target' }] }, ctx));
  check('any needs only one',
    evalCondition(g, { any: [{ hpFull: '$target' }, { alive: '$target' }] }, ctx));
}
{
  const g = fresh();
  g.enemy.poison = 3;
  check('enemyHasStatus', evalCondition(g, { enemyHasStatus: 'poison' }, ctxFor()));
  g.enemy.poison = 0;
  check('enemyHasStatus is false at zero', !evalCondition(g, { enemyHasStatus: 'poison' }, ctxFor()));
  check('hasRelic is false without it', !evalCondition(g, { hasRelic: 'lantern' }, ctxFor()));
}
{
  const g = fresh();
  if (g.telegraph) {
    Object.assign(g.telegraph, { cast: undefined, hidden: false, ignoreTaunt: false, damage: 4, targets: [SLOT.LEFT], stunned: false });
    check('telegraph damaging', evalCondition(g, { telegraph: 'damaging' }, ctxFor()));
    check('telegraph redirectable', evalCondition(g, { telegraph: 'redirectable' }, ctxFor()));
    check('telegraph interruptible', evalCondition(g, { telegraph: 'interruptible' }, ctxFor()));
    g.telegraph.damage = 0;
    check('a zeroed telegraph is not damaging', !evalCondition(g, { telegraph: 'damaging' }, ctxFor()));
    g.telegraph.stunned = true;
    check('a stunned telegraph is not interruptible',
      !evalCondition(g, { telegraph: 'interruptible' }, ctxFor()));
  }
}

// --- status writers --------------------------------------------------------
{
  eq('every status tag has a writer', Object.keys(STATUS_WRITERS).length, STATUS_TAGS.length);
  for (const tag of STATUS_TAGS) {
    check(`${tag} has a writer`, typeof STATUS_WRITERS[tag] === 'function');
  }
}
{ // the write modes
  const g = fresh();
  const m = g.members[SLOT.CENTER];
  m.regen = 3;
  STATUS_WRITERS.regen(m, { amount: 2, mode: 'add' });
  eq('add accumulates', m.regen, 5);
  STATUS_WRITERS.regen(m, { amount: 1, mode: 'set' });
  eq('set overwrites', m.regen, 1);
  STATUS_WRITERS.regen(m, { amount: 9, mode: 'keepStronger' });
  eq('keepStronger takes the max', m.regen, 9);
  STATUS_WRITERS.regen(m, { amount: 2, mode: 'keepStronger' });
  eq('keepStronger keeps the standing value', m.regen, 9);
}
{ // keepStrongerIfActive — the taunt/shieldWall/holdLine idiom
  const g = fresh();
  const m = g.members[SLOT.CENTER];
  m.defense = 2; m.defenseAmount = 5;
  STATUS_WRITERS.defense(m, { amount: 1, turns: 3, mode: 'keepStrongerIfActive' });
  eq('an ACTIVE stronger Defense is kept', m.defenseAmount, 5);
  m.defense = 0; m.defenseAmount = 5;
  STATUS_WRITERS.defense(m, { amount: 1, turns: 3, mode: 'keepStrongerIfActive' });
  eq('an EXPIRED stronger Defense is overwritten', m.defenseAmount, 1);
}
{ // the enemy-side tags refuse to be written per-member
  const g = fresh();
  let threw = false;
  try { STATUS_WRITERS.vulnerable(g.members[0], { mode: 'set' }); } catch { threw = true; }
  check('writing an enemy status per-member throws', threw);
}

// --- ops -------------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  const { cap, ctx } = run(g, [
    { op: 'heal', to: '$target', amount: 4, direct: true, bind: 'healed' },
    { op: 'log', text: 'healed {healed}', kind: 'heal' },
  ]);
  eq('heal applies', tank.hp, 9);
  eq('heal binds the amount actually healed', ctx.vars.healed, 4);
  expectLog('a log op renders its template', cap, 'healed 4', 'heal');
}
{ // heal binds the CLAMPED amount, not the nominal one
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = tank.maxHP - 1;
  const { ctx } = run(g, [{ op: 'heal', to: '$target', amount: 9, bind: 'healed' }]);
  eq('heal binds the clamped amount', ctx.vars.healed, 1);
}
{
  const g = fresh();
  const hp0 = g.enemy.hp;
  run(g, [{ op: 'damage', amount: 7, source: 'Test' }]);
  eq('damage hits the enemy', hp0 - g.enemy.hp, 7);
}
{
  const g = fresh();
  const hp0 = g.enemy.hp;
  const each = g.memberDamage(g.members[SLOT.LEFT]);
  const { cap } = run(g, [{ op: 'strike', from: '$self', amount: { auto: '$self' }, times: 3 }],
    { self: g.members[SLOT.LEFT] });
  eq('strike lands its hits', hp0 - g.enemy.hp, each * 3);
  eq('strike emits one partyAttack per hit',
    cap.events.filter((e) => e.kind === 'partyAttack').length, 3);
}
{ // strike breaks on the kill
  const g = fresh();
  g.enemy.hp = 1;
  const { cap } = run(g, [{ op: 'strike', from: '$self', amount: { auto: '$self' }, times: 5 }],
    { self: g.members[SLOT.LEFT] });
  eq('strike stops once the enemy falls',
    cap.events.filter((e) => e.kind === 'partyAttack').length, 1);
}
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const { ctx } = run(g, [{ op: 'bloodPay', from: '$target', amount: 4, bind: 'paid' }]);
  eq('bloodPay charges', tank.hp, tank.maxHP - 4);
  eq('bloodPay binds what was paid', ctx.vars.paid, 4);
}
{ // bloodPay clamps to leave 1 HP; drain does not
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 3;
  run(g, [{ op: 'bloodPay', from: '$target', amount: 99 }]);
  eq('bloodPay leaves 1 HP', tank.hp, 1);

  const g2 = fresh();
  const t2 = g2.members[SLOT.CENTER];
  t2.hp = 3;
  run(g2, [{ op: 'drain', from: '$target', amount: 99 }]);
  check('drain is lethal', !t2.alive);
}
{
  const g = fresh();
  const { cap } = run(g, [
    { op: 'status', on: '$target', tag: 'shield', turns: { tune: 'SHIELD_TURNS' }, mode: 'set' },
    { op: 'emit', kind: 'shieldApplied', slot: '$target' },
  ]);
  check('status writes through the writer table', g.members[SLOT.CENTER].shield);
  eq('and its turns', g.members[SLOT.CENTER].shieldTurns, TUNING.SHIELD_TURNS);
  expectEvent('emit resolves a selector to a slot', cap, 'shieldApplied', { slot: SLOT.CENTER });
}
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5; tank.regen = 4;
  const { ctx } = run(g, [{ op: 'consume', on: '$target', tag: 'regen', bind: 'ticks' }]);
  eq('consume binds the consumed stack', ctx.vars.ticks, 4);
  eq('and zeroes it', tank.regen, 0);
}
{
  const g = fresh();
  g.enemy.poison = 3; g.enemy.poisonTurns = 4;
  const { ctx } = run(g, [{ op: 'consumeEnemyStatus', tag: 'poison', bind: 'total' }]);
  eq('consumeEnemyStatus cashes out magnitude x duration', ctx.vars.total, 12);
  eq('and clears the track', g.enemy.poison, 0);
}
{
  const g = fresh();
  const hand0 = g.hand.length;
  const { ctx } = run(g, [{ op: 'draw', count: 2, bind: 'drawn' }]);
  eq('draw adds cards', g.hand.length, hand0 + 2);
  eq('draw binds the real count', ctx.vars.drawn, 2);
}
{
  const g = fresh();
  g.mp = 0;
  const { ctx } = run(g, [{ op: 'mp', delta: 3, bind: 'gained' }]);
  eq('mp adds', g.mp, 3);
  eq('mp binds the real delta', ctx.vars.gained, 3);
  g.mp = g.maxMana;
  const { ctx: c2 } = run(g, [{ op: 'mp', delta: 5, bind: 'gained' }]);
  eq('mp is capped and binds 0', c2.vars.gained, 0);
}
{
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.alive = false; mage.hp = 0; mage.regen = 5; mage.charge = 3;
  run(g, [{ op: 'revive', on: '$target', hpFraction: 0.5 }], { target: SLOT.RIGHT });
  check('revive brings them back', mage.alive);
  eq('at the requested fraction', mage.hp, Math.ceil(mage.maxHP / 2));
  eq('and clears buffs', mage.regen, 0);
  eq('and clears Charge', mage.charge, 0);
}
{
  const g = fresh();
  g.woundTurns = 3;
  g.members[SLOT.CENTER].poison = 2; g.members[SLOT.CENTER].poisonTurns = 2;
  const { ctx } = run(g, [{ op: 'purge', scope: 'party', bind: 'had' }]);
  eq('purge clears the party Hex', g.woundTurns, 0);
  eq('purge clears hero poison', g.members[SLOT.CENTER].poison, 0);
  eq('purge binds whether anything was found', ctx.vars.had, true);
  const { ctx: c2 } = run(g, [{ op: 'purge', scope: 'party', bind: 'had' }]);
  eq('a second purge finds nothing', c2.vars.had, false);
}
{
  const g = fresh();
  if (g.telegraph) {
    Object.assign(g.telegraph, { cast: undefined, hidden: false, damage: 6, targets: [SLOT.LEFT], ignoreTaunt: false });
    run(g, [{ op: 'telegraph', mode: 'reduceDamage', amount: 2, floor: 0 }]);
    eq('telegraph reduceDamage shaves it', g.telegraph.damage, 4);
    run(g, [{ op: 'telegraph', mode: 'reduceDamage', amount: 99, floor: 0 }]);
    eq('and floors at 0', g.telegraph.damage, 0);
    run(g, [{ op: 'telegraph', mode: 'retargetTo', to: '$target' }]);
    eq('retargetTo redirects every hit', g.telegraph.targets.join(','), String(SLOT.CENTER));
    run(g, [{ op: 'telegraph', mode: 'stun' }]);
    check('stun flags it', g.telegraph.stunned === true);
  }
}
{
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.charge = 1;
  run(g, [{ op: 'addStat', on: '$target', stat: 'charge', amount: 3, cap: { tune: 'CHARGE_MAX' } }],
    { target: SLOT.RIGHT });
  eq('addStat adds', mage.charge, 4);
  run(g, [{ op: 'addStat', on: '$target', stat: 'charge', amount: 99, cap: { tune: 'CHARGE_MAX' } }],
    { target: SLOT.RIGHT });
  eq('addStat respects its cap', mage.charge, TUNING.CHARGE_MAX);
}
{
  const g = fresh();
  run(g, [{ op: 'queueDelayed', kind: 'sunriseVigil' }]);
  eq('queueDelayed enqueues', g.delayedStartEffects.length, 1);
}

// --- control flow ----------------------------------------------------------
{
  const g = fresh();
  for (const m of g.members) m.hp = 3;
  run(g, [{ op: 'forEach', over: '$allLiving', do: [{ op: 'heal', to: '$target', amount: 2 }] }]);
  check('forEach visits every member', g.members.every((m) => m.hp === 5));
}
{ // forEach with an alias exposes the member to templates
  const g = fresh();
  const { cap } = run(g, [
    { op: 'forEach', over: '$allLiving', as: 'm',
      do: [{ op: 'log', text: '{m.name} steps up', kind: 'status' }] },
  ]);
  eq('one log per member', cap.log.length, 3);
  expectLog('the alias renders', cap, 'Tank steps up', 'status');
}
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  run(g, [{ op: 'if', when: { alive: '$target' },
    then: [{ op: 'heal', to: '$target', amount: 3 }],
    else: [{ op: 'heal', to: '$target', amount: 99 }] }]);
  eq('if takes the then branch', tank.hp, 8);
}
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  const { cap } = run(g, [{ op: 'if', when: { hpFull: '$target' },
    then: [{ op: 'heal', to: '$target', amount: 99 }],
    else: [{ op: 'log', text: 'not full', kind: 'status' }] }]);
  eq('if takes the else branch', tank.hp, 5);
  expectLog('the else branch ran', cap, 'not full', 'status');
}
{ // an if with no else and a false condition is a clean no-op
  const g = fresh();
  const { cap } = run(g, [{ op: 'if', when: { hpFull: '$enemy' }, then: [{ op: 'log', text: 'x', kind: 'status' }] }]);
  eq('a false if with no else does nothing', cap.log.length, 0);
}
{
  const g = fresh();
  const { ctx } = run(g, [
    { op: 'let', bind: 'a', value: 5 },
    { op: 'let', bind: 'b', value: { sum: [{ var: 'a' }, 2] } },
  ]);
  eq('let binds', ctx.vars.a, 5);
  eq('a later let can read an earlier one', ctx.vars.b, 7);
}
{
  const g = fresh();
  if (g.telegraph) {
    const { cap } = run(g, [
      { op: 'letStr', bind: 'intent', value: 'a Strike' },
      { op: 'log', text: 'saps {intent}', kind: 'status' },
    ]);
    expectLog('letStr binds a string', cap, 'saps a Strike', 'status');
  }
}
{
  const g = fresh();
  g.members[SLOT.RIGHT].hp = 1;
  const { ctx } = run(g, [
    { op: 'collect', bind: 'slots', over: '$allLiving', where: { hpFull: '$self' }, pick: 'slot' },
  ]);
  eq('collect gathers the picked field from the filtered set',
    (ctx.vars.slots as number[]).join(','), `${SLOT.LEFT},${SLOT.CENTER}`);
}
{ // the template conditional, end to end
  const g = fresh();
  const { cap } = run(g, [
    { op: 'let', bind: 'isSelf', value: 0 },
    { op: 'log', text: "sets {isSelf ? her own : {target.name}'s} guard", kind: 'status' },
  ]);
  expectLog('a false conditional takes the else branch', cap, "sets Tank's guard", 'status');
}

// --- natives ---------------------------------------------------------------
{
  const g = fresh();
  let called = 0;
  run(g, [{ op: 'native', fn: 'testNative' }], {}, { testNative: () => { called += 1; } });
  eq('a native is invoked', called, 1);
}
{ // an unregistered native is a no-op at runtime (the validator is what rejects it)
  const g = fresh();
  const { cap } = run(g, [{ op: 'native', fn: 'missing' }]);
  eq('an unregistered native does not throw', cap.log.length, 0);
}

finish('content/interpreter');
