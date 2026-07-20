// Characterization tests for the enemy cast kinds and the player channels (#99 A6).
//
// Two dispatch surfaces #104 replaces:
//   - _resolveCast          core.ts:1716 — 5 CastKinds
//   - telegraphDetail       core.ts:639-656 — the SAME 5 kinds, duplicated for the
//     preview text. #104 derives this from the cast def, so it must be pinned first.
//   - _tickChannel          core.ts:1182 — mendingStream, sap
//
// A cast is driven by flipping `cast` on the standing telegraph and ending the turn,
// so the whole enemy phase runs for real rather than calling _resolveCast directly.
import { Game } from '../../src/engine';
import {
  SLOT, WOUND_TURNS, SIPHON_AMOUNT, HERO_POISON_BASE, HERO_POISON_TURNS, MARK_TURNS,
  MENDING_STREAM_HEAL, MENDING_STREAM_MAX_TURNS,
  SAP_VULN_PER_TICK, SAP_VULN_CAP, SAP_VULN_TURNS, SAP_MAX_TURNS,
} from '../../src/constants';
import { giveCard } from '../factories';
import {
  check, eq, finish, capture, expectEvent, expectNoEvent, expectLog,
} from '../harness';

function fresh(seed = 11): Game {
  const g = new Game(seed);
  g.start();
  for (const m of g.members) if (m.alive) m.hp = m.maxHP;
  g.mp = 10;
  return g;
}
// Turn the standing telegraph into a scripted cast and let the enemy phase resolve it.
function castTurn(g: Game, cast: string, extra: Record<string, unknown> = {}) {
  const t = g.telegraph;
  if (!t) throw new Error('no standing telegraph');
  Object.assign(t, { cast, ...extra });
  return capture(g, () => g.endTurn());
}
const play = (g: Game, id: string, target?: number) =>
  capture(g, () => g.playCard(giveCard(g, id as never), target));

// ===========================================================================
// Cast kinds
// ===========================================================================

// --- wound (Jinx) ----------------------------------------------------------
{
  const g = fresh();
  const cap = castTurn(g, 'wound');
  eq('wound sets the party-wide healing debuff', g.woundTurns, WOUND_TURNS);
  expectLog('wound logs the Jinx', cap,
    `${g.enemyDef.name} casts a Jinx — healing is halved for ${WOUND_TURNS} turns.`, 'system');
  expectEvent('wound emits over the living slots', cap, 'wound',
    { turns: WOUND_TURNS, slots: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT] });
}
{ // it actually halves healing — the reason the cast exists
  const g = fresh();
  castTurn(g, 'wound');
  g.beginPlayerTurn();
  g.mp = 10;
  const tank = g.members[SLOT.CENTER];
  tank.hp = 4;
  play(g, 'highHeal', SLOT.CENTER);
  eq('a Jinxed heal lands for half', tank.hp - 4, 2);
}
{ // Cleanse is the answer
  const g = fresh();
  castTurn(g, 'wound');
  g.beginPlayerTurn();
  g.mp = 10;
  play(g, 'cleanse');
  eq('cleanse clears the Jinx', g.woundTurns, 0);
}

// --- siphon ----------------------------------------------------------------
{
  const g = fresh();
  g.mp = 10;
  const cap = castTurn(g, 'siphon');
  eq('siphon drains its amount', g.mp, 10 - SIPHON_AMOUNT);
  expectLog('siphon logs the drain and the remainder', cap,
    `${g.enemyDef.name} Slurps up ${SIPHON_AMOUNT} MP. (MP ${g.mp})`, 'mp');
  expectEvent('siphon emits the drain', cap, 'siphon',
    { amount: SIPHON_AMOUNT, mp: g.mp });
}
{ // clamped to what is actually available — never negative
  const g = fresh();
  g.mp = 1;
  const cap = castTurn(g, 'siphon');
  eq('siphon cannot drain past zero', g.mp, 0);
  expectLog('siphon logs the CLAMPED drain', cap,
    `${g.enemyDef.name} Slurps up 1 MP. (MP 0)`, 'mp');
  expectEvent('the siphon event reports the clamped amount', cap, 'siphon', { amount: 1 });
}

// --- poison (hero poison) --------------------------------------------------
{
  const g = fresh();
  const cap = castTurn(g, 'poison', { name: 'Sludge' });
  for (const m of g.members) {
    eq(`hero poison lands on ${m.name}`, m.poison, HERO_POISON_BASE);
    eq(`hero poison duration on ${m.name}`, m.poisonTurns, HERO_POISON_TURNS);
  }
  expectLog('the poison cast logs its step name', cap,
    `${g.enemyDef.name} — Sludge! The party is poisoned (${HERO_POISON_BASE}/turn for ${HERO_POISON_TURNS}).`,
    'system');
  // The cast itself deals NO direct damage — the threat is the ticks it plants.
  check('the poison cast deals no direct damage', g.members.every((m) => m.hp === m.maxHP));
}
{ // the step can carry its own magnitude and duration
  const g = fresh();
  castTurn(g, 'poison', { name: 'Sludge', castAmount: 5, castTurns: 2 });
  eq('the step magnitude overrides the default', g.members[SLOT.CENTER].poison, 5);
  eq('the step duration overrides the default', g.members[SLOT.CENTER].poisonTurns, 2);
}
{ // it ticks at the start of the NEXT enemy phase, raw past all mitigation
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  castTurn(g, 'poison');
  const hpAfterCast = tank.hp;
  g.beginPlayerTurn();
  tank.defense = 5; tank.defenseAmount = 99; // no amount of Defense stops it
  tank.shield = true; tank.shieldTurns = 3;
  const cap = capture(g, () => g.endTurn());
  check('hero poison ticks on the next enemy phase', tank.hp < hpAfterCast);
  expectEvent('hero poison emits its tick', cap, 'heroPoisonTick', { slot: SLOT.CENTER });
  check('hero poison ignores Defense and Shield', tank.shield === true);
}
{ // re-applying ADDS magnitude and takes the LONGER duration. Note the standing
  // poison TICKS at enemy-phase start, before the cast resolves, so the duration must
  // be deep enough to survive that tick or there is nothing left to stack onto.
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.poison = 3; tank.poisonTurns = 5;
  castTurn(g, 'poison', { castAmount: 2, castTurns: 5 });
  eq('hero poison stacks additively', tank.poison, 5);
  eq('hero poison keeps the longer duration', tank.poisonTurns, 5);
}

// --- curse (Mark) ----------------------------------------------------------
{
  const g = fresh();
  const cap = castTurn(g, 'curse', { name: 'Whammy' });
  for (const m of g.members) eq(`curse Marks ${m.name}`, m.markTurns, MARK_TURNS);
  expectLog('the curse cast logs its step name', cap,
    `${g.enemyDef.name} — Whammy! The party is Marked.`, 'system');
  expectEvent('curse emits over the marked slots', cap, 'curseApplied',
    { slots: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT], turns: MARK_TURNS });
  check('the curse cast deals no direct damage', g.members.every((m) => m.hp === m.maxHP));
}
{ // Cleanse clears the Mark before its payoff can land
  const g = fresh();
  castTurn(g, 'curse');
  g.beginPlayerTurn();
  g.mp = 10;
  play(g, 'cleanse');
  check('cleanse clears every Mark', g.members.every((m) => m.markTurns === 0));
}

// --- consume ---------------------------------------------------------------
{ // The enemy's own poison ticks at enemy-phase start BEFORE the cast resolves, so
  // by the time Gulp runs there are 2 turns left, not 3 — it eats 4x2, not 4x3.
  const g = fresh();
  g.enemy.maxHP = 200; g.enemy.hp = 50; // headroom so the heal is not clamped
  g.enemy.poison = 4; g.enemy.poisonTurns = 3;
  const cap = castTurn(g, 'consume', { name: 'Gulp' });
  eq('consume clears the enemy poison magnitude', g.enemy.poison, 0);
  eq('consume clears the enemy poison duration', g.enemy.poisonTurns, 0);
  expectEvent('consume eats the ticks REMAINING after its own poison tick', cap, 'consume', { heal: 8 });
  expectLog('consume logs the heal with its step name', cap,
    `${g.enemyDef.name} — Gulp! It feeds on its own poison, healing 8. (${g.enemy.hp}/${g.enemy.maxHP})`,
    'system');
  // Measure the heal against the emitted events rather than absolute HP: endTurn also
  // runs the PARTY phase, and zeroing m.damage does NOT zero the autos (the Ranger's
  // Toxicologist bonus and the Tank's Grudge both survive a 0 base).
  const tick = cap.events.find((e) => e.kind === 'poisonTick') as { enemyHp: number };
  const eaten = cap.events.find((e) => e.kind === 'consume') as { enemyHp: number };
  eq('consume raises HP by exactly what it ate', eaten.enemyHp - tick.enemyHp, 8);
  eq('nothing further touches the enemy after the cast', g.enemy.hp, eaten.enemyHp);
}
{ // the heal is capped at maxHP
  const g = fresh();
  g.enemy.hp = g.enemy.maxHP;
  g.enemy.poison = 9; g.enemy.poisonTurns = 9;
  castTurn(g, 'consume');
  eq('consume cannot heal past maxHP', g.enemy.hp, g.enemy.maxHP);
}
{ // no-op branch: unpoisoned, it says so and still emits
  const g = fresh();
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  const cap = castTurn(g, 'consume', { name: 'Gulp' });
  expectLog('consume logs the empty case', cap,
    `${g.enemyDef.name} — Gulp, but there is no poison to feed on.`, 'system');
  expectEvent('consume emits even with nothing to eat', cap, 'consume', { heal: 0 });
}

// ===========================================================================
// telegraphDetail — the preview text, duplicated per cast kind (core.ts:639-656)
// ===========================================================================
{
  const g = fresh();
  const t = g.telegraph;
  if (t) {
    t.cast = 'wound';
    eq('wound preview', g.telegraphDetail(),
      `Curses the party — all healing is halved for ${WOUND_TURNS} turns. Cleanse removes it.`);
    t.cast = 'siphon';
    eq('siphon preview', g.telegraphDetail(),
      `Drains up to ${SIPHON_AMOUNT} MP from your mana pool.`);
    t.cast = 'poison'; t.castAmount = undefined; t.castTurns = undefined;
    eq('poison preview uses the defaults', g.telegraphDetail(),
      `Poisons the party — ${HERO_POISON_BASE} damage at the start of each of the next ${HERO_POISON_TURNS} enemy turns. Cleanse or mitigate it.`);
    t.castAmount = 7; t.castTurns = 2;
    eq('poison preview honours the step values', g.telegraphDetail(),
      'Poisons the party — 7 damage at the start of each of the next 2 enemy turns. Cleanse or mitigate it.');
    t.cast = 'curse'; t.castTurns = undefined;
    eq('curse preview', g.telegraphDetail(),
      `Marks the party for ${MARK_TURNS} turns. Clear the Mark (Cleanse or mitigation) before it pays off, or the still-Marked heroes are struck.`);
    t.cast = 'consume';
    eq('consume preview', g.telegraphDetail(),
      'Feeds on its own Poison — clears its Poison and heals for every remaining tick.');
  }
}
{ // a stunned telegraph short-circuits the preview before any cast text
  const g = fresh();
  const t = g.telegraph;
  if (t) {
    t.cast = 'wound';
    t.stunned = true;
    eq('a stunned telegraph previews as cancelled', g.telegraphDetail(),
      'Stunned — this action is cancelled and will not resolve.');
  }
}

// ===========================================================================
// Channels
// ===========================================================================

// --- Mending Stream --------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  const cap = play(g, 'mendingStream', SLOT.CENTER);
  eq('the channel is running', g.channelCard, 'mendingStream');
  eq('the channel remembers its target', g.channelTarget, SLOT.CENTER);
  expectLog('the channel announces itself', cap,
    `Mending Stream begins channeling (up to ${MENDING_STREAM_MAX_TURNS} turns).`, 'status');
  // The first tick is immediate, like a cast.
  eq('the first tick lands immediately', tank.hp, 5 + MENDING_STREAM_HEAL);
  expectLog('the immediate tick logs its heal', cap,
    `Mending Stream heals ${tank.name} ${MENDING_STREAM_HEAL}. (${tank.hp}/${tank.maxHP})`, 'heal');
  expectEvent('the tick emits a heal', cap, 'heal',
    { slot: SLOT.CENTER, amount: MENDING_STREAM_HEAL });
  expectEvent('the tick emits a pulse', cap, 'channelPulse',
    { card: 'mendingStream', turnsLeft: MENDING_STREAM_MAX_TURNS - 1 });
}
{ // playing any card breaks the channel, and the breaking card does NOT tick it
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  g.playCard(giveCard(g, 'mendingStream'), SLOT.CENTER);
  const hpAfterFirstTick = tank.hp;
  const cap = play(g, 'lowHeal', SLOT.CENTER);
  eq('the channel is cancelled by a card play', g.channelCard, null);
  expectLog('the break is logged', cap, 'The Mending Stream channel is broken.', 'status');
  expectEvent('the break emits channelCancel', cap, 'channelCancel', { card: 'mendingStream' });
  eq('a broken channel does not tick on the way out', tank.hp, hpAfterFirstTick + 2);
}
{ // it ends early if its remembered target dies
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  g.playCard(giveCard(g, 'mendingStream'), SLOT.CENTER);
  tank.alive = false; tank.hp = 0;
  // The cast turn itself does NOT tick (cardsPlayedThisPhase >= 1 skips it,
  // core.ts:1562) — a held turn is required before the channel next ticks.
  g.endTurn();
  g.beginPlayerTurn();
  const cap = capture(g, () => g.endTurn());
  eq('the channel ends when its target dies', g.channelCard, null);
  expectLog('the early end names its reason', cap,
    'The Mending Stream channel ends (target down).', 'status');
}
{ // it runs to its full duration and then ends on its own
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 1;
  g.playCard(giveCard(g, 'mendingStream'), SLOT.CENTER);
  let guard = 0;
  while (g.channelCard != null && guard++ < 12) {
    g.endTurn();
    g.beginPlayerTurn();
  }
  eq('the channel ends after its ticks are spent', g.channelCard, null);
  check('the channel ran a bounded number of turns', guard <= MENDING_STREAM_MAX_TURNS + 1);
}

// --- Sap -------------------------------------------------------------------
{
  const g = fresh();
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  const cap = play(g, 'sap');
  eq('sap starts its channel', g.channelCard, 'sap');
  eq('sap is not single-target', g.channelTarget, null);
  eq('the first sap tick stacks Vulnerability', g.enemy.vulnerable, SAP_VULN_PER_TICK);
  eq('sap keeps the Vulnerability alive', g.enemy.vulnerableTurns, SAP_VULN_TURNS);
  expectLog('sap logs the stacked percentage', cap,
    `Sap deepens the enemy's Vulnerability (+${Math.round(SAP_VULN_PER_TICK * 100)}% damage taken).`,
    'status');
  expectEvent('sap emits a pulse', cap, 'channelPulse',
    { card: 'sap', turnsLeft: SAP_MAX_TURNS - 1 });
  expectNoEvent('sap emits no heal', cap, 'heal');
}
{ // it stacks per tick, capped
  const g = fresh();
  g.enemy.vulnerable = SAP_VULN_CAP; g.enemy.vulnerableTurns = 0;
  play(g, 'sap');
  eq('sap is capped', g.enemy.vulnerable, SAP_VULN_CAP);
}
{ // successive ticks deepen it
  const g = fresh();
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  g.playCard(giveCard(g, 'sap'));
  const afterFirst = g.enemy.vulnerable;
  // Cast turn does not tick; the following HELD turn does.
  g.endTurn();
  g.beginPlayerTurn();
  eq('the cast turn itself does not tick again', g.enemy.vulnerable, afterFirst);
  g.endTurn();
  g.beginPlayerTurn();
  check('a second sap tick deepens the Vulnerability', g.enemy.vulnerable > afterFirst);
  check('sap never exceeds its cap', g.enemy.vulnerable <= SAP_VULN_CAP);
}

finish('content/casts-channels');
