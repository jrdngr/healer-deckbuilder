// Characterization tests for card effect arms (#99 A3/A4).
//
// Depth per arm: resulting STATE, the EXACT log text, the emitted EVENTS, and the
// edge cases. Exact log text is deliberate — #100 rewrites every log string through a
// template engine, and substring matching is what would let that drift through.
//
// Public surface only: everything goes through playCard/skipTurn. No underscore
// methods, so this file passes unchanged against the switch today and the interpreter
// after #101.
//
// A3 covers the ten arms that had ZERO behavioral coverage before this file existed.
import { Game } from '../../src/engine';
import {
  SLOT,
  SUNRISE_VIGIL_HEAL, CONSECRATION_HEAL, CONSECRATION_STRIKE_BONUS, CONSECRATION_STRIKE_TURNS,
  CRIMSON_PACT_HP, CRIMSON_PACT_DRAW, SCARLET_WARD_HP, SHIELD_TURNS,
  TRANSFUSION_HP, TRANSFUSION_HEAL,
  BLOOD_BANNER_HP, BLOOD_BANNER_BONUS, BLOOD_BANNER_TURNS,
  SPOREBURST_POISON, TAUNT_LITE_TURNS,
} from '../../src/constants';
import { giveCard } from '../factories';
import {
  check, eq, finish, capture, expectEvent, expectNoEvent, expectEventCount, expectLog,
} from '../harness';

// A started default-trio game with MP to spare.
// Trio: LEFT Ranger 11hp/4dmg · CENTER Tank 18hp/2dmg · RIGHT Mage 9hp/5dmg.
//
// start() runs _openingStrike() (core.ts:961) — the enemy lands one unreactable hit
// before the player's first turn — so the party is NOT at full HP after start(). Top
// everyone up so these tests have a seed-independent baseline; the opening strike is
// enemy behavior and belongs to the enemy-def batch (A9), not here.
function fresh(seed = 11): Game {
  const g = new Game(seed);
  g.start();
  for (const m of g.members) if (m.alive) m.hp = m.maxHP;
  g.mp = 10;
  return g;
}
// Advance to the next player phase. endTurn/skipTurn park the engine at phase 'idle';
// beginPlayerTurn() is the only path back and is what runs _startPlayerPhase (Regen
// tick -> delayed start effects -> passive MP -> draw).
const nextPlayerPhase = (g: Game) => capture(g, () => g.beginPlayerTurn());
const play = (g: Game, id: string, target?: number) =>
  capture(g, () => g.playCard(giveCard(g, id as never), target));

// --- Special Delivery (sunriseVigil) ---------------------------------------
// Queues a party heal that fires at the START of the next player phase, after the
// Regen tick and before the draw (effects.ts:106-113). Nothing in test/ asserted this
// contract before — delayedStartEffects had zero references in the whole directory.
{
  const g = fresh();
  const cap = play(g, 'sunriseVigil');
  eq('sunriseVigil queues one delayed effect', g.delayedStartEffects.length, 1);
  eq('sunriseVigil queues the right kind', g.delayedStartEffects[0].kind, 'sunriseVigil');
  expectLog('sunriseVigil logs the schedule', cap,
    `Special Delivery scheduled — every living member heals ${SUNRISE_VIGIL_HEAL} at the start of your next turn.`,
    'status');
  eq('sunriseVigil emits nothing', cap.events.length, 0);
  check('sunriseVigil heals nobody on cast', g.members.every((m) => m.hp === m.maxHP));
}
{ // it fires at the START of the next player phase — which is beginPlayerTurn(), not
  // skipTurn(): endTurn/skipTurn park the engine at phase 'idle' (core.ts:2372-2378).
  const g = fresh();
  for (const m of g.members) m.hp = 4;
  g.playCard(giveCard(g, 'sunriseVigil'));
  const rest = capture(g, () => g.skipTurn());
  eq('the delayed effect does NOT fire on skipTurn', g.delayedStartEffects.length, 1);
  check('skipTurn produces no Special Delivery line',
    !rest.log.some((l) => l.text.startsWith('Special Delivery arrives')));

  const cap = nextPlayerPhase(g);
  expectLog('sunriseVigil fires at the start of the next player phase', cap,
    `Special Delivery arrives: every living member heals ${SUNRISE_VIGIL_HEAL}.`, 'heal');
  eq('sunriseVigil drains its queue', g.delayedStartEffects.length, 0);
}
{ // two casts queue two entries and pay out twice
  const g = fresh();
  g.mp = 20;
  for (const m of g.members) m.hp = 4;
  g.playCard(giveCard(g, 'sunriseVigil'));
  g.playCard(giveCard(g, 'sunriseVigil'));
  eq('two casts queue two entries', g.delayedStartEffects.length, 2);
  // endTurn, not skipTurn: Rest is gated on a restrained previous turn (#53), so
  // canSkip() refuses after two cards and skipTurn would be a no-op.
  g.endTurn();
  const cap = nextPlayerPhase(g);
  const arrivals = cap.log.filter((l) => l.text.startsWith('Special Delivery arrives')).length;
  eq('both queued Special Deliveries pay out', arrivals, 2);
}
{ // the queue drains before the draw, and dead members are skipped at fire time
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  for (const m of g.members) m.hp = 4;
  g.playCard(giveCard(g, 'sunriseVigil'));
  mage.alive = false; mage.hp = 0;
  g.skipTurn();
  nextPlayerPhase(g);
  eq('a dead member is not healed by the delayed effect', mage.hp, 0);
}

// --- Glow Up (consecration) ------------------------------------------------
{ // whole party already at full HP: everyone qualifies for the strike buff
  const g = fresh();
  const cap = play(g, 'consecration');
  expectEventCount('consecration emits one heal per living member', cap, 'heal', 3);
  expectLog('consecration logs the heal and the at-full count', cap,
    `Glow Up: the party heals ${CONSECRATION_HEAL}; 3 at full HP strike +${CONSECRATION_STRIKE_BONUS} for ${CONSECRATION_STRIKE_TURNS} enemy turns.`,
    'heal');
  expectEvent('consecration emits hymn over the at-full slots', cap, 'hymn',
    { bonus: CONSECRATION_STRIKE_BONUS, slots: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT] });
  for (const m of g.members) {
    eq(`consecration grants strikeBonus to ${m.name}`, m.strikeBonus, CONSECRATION_STRIKE_BONUS);
    eq(`consecration sets strikeTurns on ${m.name}`, m.strikeTurns, CONSECRATION_STRIKE_TURNS);
  }
}
{ // a member too wounded to reach full after the +1 does NOT get the buff
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.hp = 2;
  const cap = play(g, 'consecration');
  eq('consecration heals the wounded member', mage.hp, 2 + CONSECRATION_HEAL);
  eq('a member still short of full gets no strike buff', mage.strikeBonus, 0);
  eq('members at full still get the buff', g.members[SLOT.LEFT].strikeBonus, CONSECRATION_STRIKE_BONUS);
  expectLog('consecration counts only the at-full members', cap,
    `Glow Up: the party heals ${CONSECRATION_HEAL}; 2 at full HP strike +${CONSECRATION_STRIKE_BONUS} for ${CONSECRATION_STRIKE_TURNS} enemy turns.`,
    'heal');
}
{ // healing exactly INTO full HP qualifies — the check runs after the heal
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.hp = mage.maxHP - CONSECRATION_HEAL;
  play(g, 'consecration');
  eq('a member healed exactly to full qualifies', mage.strikeBonus, CONSECRATION_STRIKE_BONUS);
}
{ // nobody at full -> no hymn event at all
  const g = fresh();
  for (const m of g.members) m.hp = 2;
  const cap = play(g, 'consecration');
  expectNoEvent('consecration emits no hymn when nobody is at full', cap, 'hymn');
  expectLog('consecration logs a zero at-full count', cap,
    `Glow Up: the party heals ${CONSECRATION_HEAL}; 0 at full HP strike +${CONSECRATION_STRIKE_BONUS} for ${CONSECRATION_STRIKE_TURNS} enemy turns.`,
    'heal');
}

// --- Arcane Lens -----------------------------------------------------------
{
  const g = fresh();
  const cap = play(g, 'arcaneLens');
  check('arcaneLens arms the lens flag', g.lensArmed);
  expectLog('arcaneLens logs arming', cap,
    'Arcane Lens: your next single-target heal also refracts to the most wounded ally.', 'status');
  expectEvent('arcaneLens emits lensArmed', cap, 'lensArmed');
}
{ // the armed lens refracts the next single-target heal to the most wounded other
  const g = fresh();
  const tank = g.members[SLOT.CENTER], mage = g.members[SLOT.RIGHT];
  tank.hp = 10; mage.hp = 2;
  g.playCard(giveCard(g, 'arcaneLens'));
  const cap = play(g, 'lowHeal', SLOT.CENTER);
  check('the lens refracts to the most wounded other member', mage.hp > 2);
  check('the lens is spent after refracting', !g.lensArmed);
  expectEventCount('a refracted heal emits two heal events', cap, 'heal', 2);
}

// --- Paper Cuts (crimsonPact) ----------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const hp0 = tank.hp, hand0 = g.hand.length;
  const cap = play(g, 'crimsonPact', SLOT.CENTER);
  eq('crimsonPact charges its HP cost', tank.hp, hp0 - CRIMSON_PACT_HP);
  // The played card leaves the hand, so the net gain is draw - 1.
  eq('crimsonPact draws its cards', g.hand.length, hand0 + CRIMSON_PACT_DRAW);
  expectLog('crimsonPact logs the payment and the draw', cap,
    `Paper Cuts: ${tank.name} pays ${CRIMSON_PACT_HP} HP; drew ${CRIMSON_PACT_DRAW} cards.`, 'status');
  expectEvent('crimsonPact emits draw with the real count', cap, 'draw', { count: CRIMSON_PACT_DRAW });
  expectEvent('crimsonPact emits the blood payment', cap, 'bloodPay',
    { slot: SLOT.CENTER, amount: CRIMSON_PACT_HP, hp: hp0 - CRIMSON_PACT_HP });
}
{ // Blood cards are gated BEFORE the clamp ever matters: canPlay refuses a target
  // that cannot pay in full, so _bloodPay's leave-1-HP clamp is unreachable via
  // playCard (it exists for the dev panel, which bypasses canPlay).
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = CRIMSON_PACT_HP; // exactly the cost — not MORE than it
  const cap = play(g, 'crimsonPact', SLOT.CENTER);
  eq('crimsonPact is refused when the payer cannot afford it', tank.hp, CRIMSON_PACT_HP);
  eq('a refused card produces no log', cap.log.length, 0);
  eq('a refused card produces no events', cap.events.length, 0);

  tank.hp = CRIMSON_PACT_HP + 1; // one over the cost — now legal, and leaves exactly 1
  play(g, 'crimsonPact', SLOT.CENTER);
  eq('crimsonPact is legal at one HP over the cost', tank.hp, 1);
  check('crimsonPact never kills the payer', tank.alive);
}

// --- Thick Skin (scarletWard) ----------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const hp0 = tank.hp;
  const cap = play(g, 'scarletWard', SLOT.CENTER);
  eq('scarletWard charges its HP cost', tank.hp, hp0 - SCARLET_WARD_HP);
  check('scarletWard raises a Shield', tank.shield);
  eq('scarletWard sets the Shield fuse', tank.shieldTurns, SHIELD_TURNS);
  expectLog('scarletWard logs the trade', cap,
    `Thick Skin: ${tank.name} pays ${SCARLET_WARD_HP} HP for a Shield (fades in ${SHIELD_TURNS} enemy turns).`,
    'status');
  expectEvent('scarletWard emits shieldApplied', cap, 'shieldApplied', { slot: SLOT.CENTER });
}

// --- Blood Drive (transfusion) ---------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER], mage = g.members[SLOT.RIGHT];
  tank.hp = 18; mage.hp = 2;
  const cap = play(g, 'transfusion', SLOT.CENTER);
  eq('transfusion charges the payer', tank.hp, 18 - TRANSFUSION_HP);
  eq('transfusion heals the most wounded OTHER member', mage.hp, 2 + TRANSFUSION_HEAL);
  expectLog('transfusion logs payer and recipient', cap,
    `Blood Drive: ${tank.name} pays ${TRANSFUSION_HP} HP; ${mage.name} heals ${TRANSFUSION_HEAL}.`, 'heal');
  expectEvent('transfusion emits heal on the recipient', cap, 'heal',
    { slot: SLOT.RIGHT, amount: TRANSFUSION_HEAL, hp: 2 + TRANSFUSION_HEAL });
}
{ // the payer is never the recipient, even when the payer is the most wounded
  const g = fresh();
  const tank = g.members[SLOT.CENTER], ranger = g.members[SLOT.LEFT];
  tank.hp = 6; ranger.hp = 10; g.members[SLOT.RIGHT].hp = 9;
  play(g, 'transfusion', SLOT.CENTER);
  eq('transfusion never heals the payer', tank.hp, 6 - TRANSFUSION_HP);
  eq('transfusion routes to the most wounded other', ranger.hp, 10 + 1);
}
{ // no other member alive: different log, no heal event
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  for (const m of g.members) if (m.slot !== SLOT.CENTER) { m.alive = false; m.hp = 0; }
  const hp0 = tank.hp;
  const cap = play(g, 'transfusion', SLOT.CENTER);
  eq('transfusion still charges with no recipient', tank.hp, hp0 - TRANSFUSION_HP);
  expectLog('transfusion logs the wasted payment', cap,
    `Blood Drive: ${tank.name} pays ${TRANSFUSION_HP} HP, but no other member remains to receive it.`,
    'status');
  expectNoEvent('transfusion emits no heal with no recipient', cap, 'heal');
}

// --- Pep Rally (bloodBanner) -----------------------------------------------
{
  const g = fresh();
  const hp0 = g.members.map((m) => m.hp);
  const cap = play(g, 'bloodBanner');
  for (const m of g.members) {
    eq(`bloodBanner charges ${m.name}`, m.hp, hp0[m.slot] - BLOOD_BANNER_HP);
  }
  eq('bloodBanner sets its buff timer', g.bloodBannerTurns, BLOOD_BANNER_TURNS);
  expectLog('bloodBanner logs the party buff', cap,
    `Pep Rally: the party digs deep — autos deal +${BLOOD_BANNER_BONUS} for ${BLOOD_BANNER_TURNS} enemy turns.`,
    'status');
  expectEvent('bloodBanner emits hymn over all living slots', cap, 'hymn',
    { bonus: BLOOD_BANNER_BONUS, slots: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT] });
  expectEventCount('bloodBanner emits one bloodPay per member', cap, 'bloodPay', 3);
}
{ // every payment clamps to leave 1 HP independently
  const g = fresh();
  g.members[SLOT.RIGHT].hp = 1;
  play(g, 'bloodBanner');
  eq('bloodBanner cannot push a member below 1 HP', g.members[SLOT.RIGHT].hp, 1);
  check('bloodBanner kills nobody', g.members.every((m) => m.alive));
}

// --- Goo Burst (hemorrhage) ------------------------------------------------
{
  const g = fresh();
  g.enemy.hp = 200;
  g.enemy.poison = 3; g.enemy.poisonTurns = 4;
  const cap = play(g, 'hemorrhage');
  eq('hemorrhage cashes out poison x turns', g.enemy.hp, 200 - 12);
  eq('hemorrhage clears the poison magnitude', g.enemy.poison, 0);
  eq('hemorrhage clears the poison duration', g.enemy.poisonTurns, 0);
  expectLog('hemorrhage logs through the standard enemy-damage path', cap,
    `Goo Burst deals 12 to the enemy. (${g.enemy.hp}/${g.enemy.maxHP})`, 'enemy-dmg');
  expectEvent('hemorrhage emits the nuke as a partyAttack', cap, 'partyAttack', { amount: 12 });
}
{ // routed through _damageEnemy, so Vulnerability multiplies the cash-out
  const g = fresh();
  g.enemy.hp = 200;
  g.enemy.poison = 3; g.enemy.poisonTurns = 4;
  g.enemy.vulnerable = 1; g.enemy.vulnerableTurns = 3;
  play(g, 'hemorrhage');
  eq('hemorrhage is scaled by Vulnerability', g.enemy.hp, 200 - 24);
}

// --- Feint -----------------------------------------------------------------
{
  const g = fresh();
  const t = g.telegraph;
  check('feint test needs a standing telegraph', !!t);
  if (t) {
    t.cast = undefined; t.hidden = false; t.ignoreTaunt = false;
    t.targets = [SLOT.LEFT, SLOT.RIGHT];
    const intent = g.telegraphIntent() ?? 'attack';
    const cap = play(g, 'feint', SLOT.CENTER);
    eq('feint redirects every hit onto the chosen member',
      t.targets.join(','), [SLOT.CENTER, SLOT.CENTER].join(','));
    expectLog('feint logs the steer', cap,
      `${g.members[SLOT.CENTER].name} Feints — the ${intent} is drawn fully onto them.`, 'status');
    expectEvent('feint emits taunt on the chosen member', cap, 'taunt',
      { slot: SLOT.CENTER, turns: TAUNT_LITE_TURNS });
  }
}
{ // no-op branch: a hidden telegraph has no readable geometry
  const g = fresh();
  const t = g.telegraph;
  if (t) {
    t.hidden = true;
    t.targets = [SLOT.LEFT];
    const cap = play(g, 'feint', SLOT.CENTER);
    eq('feint leaves a hidden telegraph alone', t.targets.join(','), String(SLOT.LEFT));
    expectLog('feint logs the no-op', cap,
      `${g.members[SLOT.CENTER].name} Feints, but there is no attack to steer.`, 'status');
    expectNoEvent('feint emits nothing on the no-op branch', cap, 'taunt');
  }
}
{ // no-op branch: an ignoreTaunt (Piercing Bolt style) hit refuses to be steered
  const g = fresh();
  const t = g.telegraph;
  if (t) {
    t.hidden = false; t.ignoreTaunt = true; t.targets = [SLOT.LEFT];
    play(g, 'feint', SLOT.CENTER);
    eq('feint cannot steer an ignoreTaunt hit', t.targets.join(','), String(SLOT.LEFT));
  }
}

// --- Sporeburst ------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.regen = 3;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  const cap = play(g, 'sporeburst', SLOT.CENTER);
  eq('sporeburst consumes the whole Regen', tank.regen, 0);
  eq('sporeburst applies its poison magnitude', g.enemy.poison, SPOREBURST_POISON);
  eq('sporeburst converts each consumed tick into a poison turn', g.enemy.poisonTurns, 3);
  expectLog('sporeburst logs the conversion', cap,
    `Sporeburst consumes ${tank.name}'s Regen — the enemy is poisoned ${SPOREBURST_POISON}/turn for 3 turns. (${SPOREBURST_POISON}/turn for 3)`,
    'status');
  expectEvent('sporeburst emits poisonApplied', cap, 'poisonApplied',
    { slot: SLOT.CENTER, amount: SPOREBURST_POISON, poison: SPOREBURST_POISON });
}
{ // one tick -> singular in the log
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.regen = 1;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  const cap = play(g, 'sporeburst', SLOT.CENTER);
  expectLog('sporeburst pluralizes a single turn correctly', cap,
    `Sporeburst consumes ${tank.name}'s Regen — the enemy is poisoned ${SPOREBURST_POISON}/turn for 1 turn. (${SPOREBURST_POISON}/turn for 1)`,
    'status');
}
{ // poison stacks additively onto an existing one, duration takes the max
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.regen = 2;
  g.enemy.poison = 5; g.enemy.poisonTurns = 6;
  play(g, 'sporeburst', SLOT.CENTER);
  eq('sporeburst adds to existing poison per-turn', g.enemy.poison, 5 + SPOREBURST_POISON);
  eq('sporeburst keeps the longer duration', g.enemy.poisonTurns, 6);
}
{ // consuming the Regen is an end path: a pending Lifebloom burst pays out, and the
  // burst heal must land AFTER the poison is applied (effects.ts:386-393).
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 8; tank.regen = 2; tank.bloomBurst = 4;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  const cap = play(g, 'sporeburst', SLOT.CENTER);
  check('sporeburst fires the pending Lifebloom burst', tank.hp > 8);
  eq('sporeburst clears the pending burst', tank.bloomBurst, 0);
  const poisonIdx = cap.log.findIndex((l) => l.text.startsWith('Sporeburst consumes'));
  const burstIdx = cap.log.findIndex((l) => l.text.startsWith('Lifebloom bursts'));
  check('the Regen-end hook fires AFTER the poison is applied',
    poisonIdx >= 0 && burstIdx > poisonIdx, `poison@${poisonIdx} burst@${burstIdx}`);
}

finish('content/cards');
