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
  REFRESH_TURNS, FONT_MP_CAP, LIFEBLOOM_BURST, HYMN_BONUS, BARRIER_TURNS,
  BLOOD_TITHE_MP, DREAD_WHISPER_REDUCTION, PHALANX_DEFENSE, PHALANX_TURNS,
  GUARD_DR, GUARD_TURNS, SHARPEN_BONUS, SHARPEN_TURNS, EMPOWER_BONUS,
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
  // endTurn(): endTurn/skipTurn park the engine at phase 'idle' (core.ts:2372-2378).
  // endTurn, not skipTurn: casting the card already forfeits Rest, so skipTurn no-ops.
  const g = fresh();
  for (const m of g.members) m.hp = 4;
  g.playCard(giveCard(g, 'sunriseVigil'));
  const rest = capture(g, () => g.endTurn());
  eq('the delayed effect does NOT fire on endTurn', g.delayedStartEffects.length, 1);
  check('endTurn produces no Special Delivery line',
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
  g.endTurn(); // the cast already forfeits Rest
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

// ===========================================================================
// A4 — the remaining 22 card arms. These had shallow coverage (state only, or a
// bare event-exists check); this brings them to the same depth as A3.
// ===========================================================================

// --- Quick Heal / Heal (lowHeal, highHeal share one body) ------------------
for (const [id, name, amount] of [['lowHeal', 'Quick Heal', 2], ['highHeal', 'Heal', 4]] as const) {
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  const cap = play(g, id, SLOT.CENTER);
  eq(`${id} heals its amount`, tank.hp, 5 + amount);
  expectLog(`${id} logs the heal with resulting HP`, cap,
    `${name}: ${tank.name} heals ${amount}. (${tank.hp}/${tank.maxHP})`, 'heal');
  expectEvent(`${id} emits heal`, cap, 'heal',
    { slot: SLOT.CENTER, amount, hp: tank.hp });
  expectEventCount(`${id} emits exactly one heal without a splash source`, cap, 'heal', 1);
}
{ // overheal clamps, and the LOGGED amount is the clamped one
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = tank.maxHP - 1;
  const cap = play(g, 'highHeal', SLOT.CENTER);
  eq('a heal cannot exceed maxHP', tank.hp, tank.maxHP);
  expectLog('the log reports the clamped heal, not the nominal 4', cap,
    `Heal: ${tank.name} heals 1. (${tank.maxHP}/${tank.maxHP})`, 'heal');
  expectEvent('the heal event reports the clamped amount', cap, 'heal', { amount: 1 });
}
{ // a dead member is not a legal single target
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.alive = false; tank.hp = 0;
  const cap = play(g, 'lowHeal', SLOT.CENTER);
  eq('a heal is refused on a dead member', tank.hp, 0);
  eq('a refused heal logs nothing', cap.log.length, 0);
}

// --- Group Heal (aoeHeal) --------------------------------------------------
{
  const g = fresh();
  for (const m of g.members) m.hp = 3;
  const cap = play(g, 'aoeHeal');
  for (const m of g.members) eq(`aoeHeal heals ${m.name}`, m.hp, 5);
  expectEventCount('aoeHeal emits one heal per living member', cap, 'heal', 3);
  expectLog('aoeHeal logs a single summary line', cap,
    'Group Heal: all living members heal up to 2.', 'heal');
}
{ // dead members are skipped entirely
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.alive = false; mage.hp = 0;
  for (const m of g.members) if (m.alive) m.hp = 3;
  const cap = play(g, 'aoeHeal');
  eq('aoeHeal does not raise the dead', mage.hp, 0);
  expectEventCount('aoeHeal emits nothing for a dead member', cap, 'heal', 2);
}

// --- Regen -----------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const cap = play(g, 'regen', SLOT.CENTER);
  eq('regen sets the stack', tank.regen, 2);
  expectLog('regen logs the new total', cap,
    `Regen on ${tank.name} (Regen 2, decays each turn).`, 'status');
  expectEvent('regen emits regenApplied with the stack', cap, 'regenApplied',
    { slot: SLOT.CENTER, stack: 2 });
}
{ // ADDITIVE onto an existing Regen — magnitude is duration, so it goes deeper AND longer
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.regen = 3;
  const cap = play(g, 'regen', SLOT.CENTER);
  eq('regen adds to an existing stack', tank.regen, 5);
  expectLog('regen logs the combined total', cap,
    `Regen on ${tank.name} (Regen 5, decays each turn).`, 'status');
}
{ // it ticks at the start of the player phase, healing its value then decaying by 1
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5; tank.regen = 3;
  g.endTurn();
  const cap = nextPlayerPhase(g);
  eq('regen decays by one after ticking', tank.regen, 2);
  expectLog('regen logs its tick', cap, `${tank.name} regenerates 3 (Regen 3).`, 'heal');
  expectEvent('regen emits regenTick', cap, 'regenTick', { slot: SLOT.CENTER, amount: 3 });
}

// --- Shield ----------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const cap = play(g, 'shield', SLOT.CENTER);
  check('shield raises the flag', tank.shield);
  eq('shield sets the fuse', tank.shieldTurns, SHIELD_TURNS);
  expectLog('shield logs the fuse length', cap,
    `Shield raised on ${tank.name} (fades in ${SHIELD_TURNS} enemy turns).`, 'status');
  expectEvent('shield emits shieldApplied', cap, 'shieldApplied', { slot: SLOT.CENTER });
}
{ // re-raising refreshes the fuse rather than stacking a second Shield
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.shield = true; tank.shieldTurns = 1;
  play(g, 'shield', SLOT.CENTER);
  eq('re-raising refreshes the fuse', tank.shieldTurns, SHIELD_TURNS);
  check('a Shield does not stack into a second flag', tank.shield === true);
}

// --- Resurrect -------------------------------------------------------------
{
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.alive = false; mage.hp = 0;
  mage.regen = 4; mage.taunt = 2; mage.charge = 3; mage.strikeBonus = 2; mage.strikeTurns = 2;
  mage.guardDR = 1; mage.guardTurns = 2; mage.riposte = true; mage.riposteTurns = 3;
  const cap = play(g, 'resurrect', SLOT.RIGHT);
  check('resurrect revives the member', mage.alive);
  eq('resurrect returns them at half max HP', mage.hp, Math.ceil(mage.maxHP / 2));
  expectLog('resurrect logs the revived HP', cap,
    `${mage.name} is resurrected to ${mage.hp} HP.`, 'status');
  expectEvent('resurrect emits with the resulting HP', cap, 'resurrect',
    { slot: SLOT.RIGHT, hp: mage.hp });
  // Every buff and stance is wiped on revive — the arm clears 18 fields.
  eq('revive clears Regen', mage.regen, 0);
  eq('revive clears Taunt', mage.taunt, 0);
  eq('revive clears Charge', mage.charge, 0);
  eq('revive clears the strike bonus', mage.strikeBonus, 0);
  eq('revive clears Guard', mage.guardDR, 0);
  check('revive clears the Riposte stance', !mage.riposte && mage.riposteTurns === 0);
}
{ // a living member is not a legal 'dead' target
  const g = fresh();
  const cap = play(g, 'resurrect', SLOT.RIGHT);
  eq('resurrect is refused on a living member', cap.log.length, 0);
}

// --- Refresh (fontOfMana) --------------------------------------------------
{
  const g = fresh();
  const cap = play(g, 'fontOfMana');
  eq('fontOfMana primes the per-turn amount', g.refresh, 3);
  eq('fontOfMana sets its duration', g.refreshTurns, REFRESH_TURNS);
  eq('fontOfMana resets the per-cast total', g.refreshRestored, 0);
  eq('fontOfMana sets the per-cast cap', g.refreshCap, FONT_MP_CAP);
  expectLog('fontOfMana logs the priming', cap,
    `Refresh primed (3 MP/turn for ${REFRESH_TURNS}).`, 'status');
  expectEvent('fontOfMana emits refreshPrimed', cap, 'refreshPrimed', { stack: 3 });
}
{ // recasting keeps the stronger value and resets the per-cast total
  const g = fresh();
  g.refresh = 5; g.refreshRestored = 7;
  play(g, 'fontOfMana');
  eq('fontOfMana keeps the stronger per-turn value', g.refresh, 5);
  eq('fontOfMana resets the restored total on recast', g.refreshRestored, 0);
}

// --- Bloom -----------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5; tank.regen = 4;
  const cap = play(g, 'bloom', SLOT.CENTER);
  eq('bloom heals the full remaining Regen at once', tank.hp, 9);
  eq('bloom consumes the Regen', tank.regen, 0);
  expectLog('bloom logs the conversion', cap,
    `Bloom consumes ${tank.name}'s Regen: heals 4. (${tank.hp}/${tank.maxHP})`, 'heal');
  expectEvent('bloom emits heal', cap, 'heal', { slot: SLOT.CENTER, amount: 4, hp: tank.hp });
}
{ // consuming the Regen is an end path, so a pending Lifebloom burst pays out
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5; tank.regen = 2; tank.bloomBurst = LIFEBLOOM_BURST;
  play(g, 'bloom', SLOT.CENTER);
  eq('bloom fires the pending burst on top of the consumed Regen',
    tank.hp, 5 + 2 + LIFEBLOOM_BURST);
  eq('bloom clears the pending burst', tank.bloomBurst, 0);
}

// --- Inspiration -----------------------------------------------------------
{
  const g = fresh();
  const hand0 = g.hand.length;
  const cap = play(g, 'inspiration');
  eq('inspiration draws its cards', g.hand.length, hand0 + 2);
  expectLog('inspiration logs the draw', cap, 'Inspiration: drew 2 cards.', 'status');
  expectEvent('inspiration emits draw with the real count', cap, 'draw', { count: 2 });
}
{ // Exhausted piles: it draws fewer than asked and says so in the SINGULAR.
  // Note it can never reach 0 — _resolvePlayedCard discards the played card before
  // _applyCard runs, so the first _drawOne always has that one card to reshuffle.
  const g = fresh();
  g.drawPile = []; g.discardPile = [];
  const hand0 = g.hand.length;
  const cap = play(g, 'inspiration');
  eq('inspiration draws only what is available', g.hand.length, hand0 + 1);
  expectLog('inspiration pluralizes a single card correctly', cap,
    'Inspiration: drew 1 card.', 'status');
  expectEvent('inspiration emits the real, reduced count', cap, 'draw', { count: 1 });
  eq('the reshuffle consumed the discard pile', g.discardPile.length, 0);
}

// --- Lifebloom -------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const cap = play(g, 'lifebloom', SLOT.CENTER);
  eq('lifebloom adds its Regen', tank.regen, 2);
  eq('lifebloom arms the burst', tank.bloomBurst, LIFEBLOOM_BURST);
  expectLog('lifebloom logs stack and burst', cap,
    `Lifebloom on ${tank.name} (Regen 2, decays each turn; bursts ${LIFEBLOOM_BURST} when it ends).`,
    'status');
  expectEvent('lifebloom emits regenApplied', cap, 'regenApplied',
    { slot: SLOT.CENTER, stack: 2 });
}
{ // re-arming keeps ONE pending burst, but the Regen still stacks
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.regen = 1; tank.bloomBurst = LIFEBLOOM_BURST;
  play(g, 'lifebloom', SLOT.CENTER);
  eq('lifebloom stacks its Regen additively', tank.regen, 3);
  eq('lifebloom keeps a single pending burst', tank.bloomBurst, LIFEBLOOM_BURST);
}

// --- Fight Song (battleHymn) -----------------------------------------------
{
  const g = fresh();
  const cap = play(g, 'battleHymn');
  eq('battleHymn sets the party bonus', g.hymnBonus, HYMN_BONUS);
  expectLog('battleHymn logs the bonus', cap,
    `Fight Song: every living member's attack deals +${HYMN_BONUS} this turn.`, 'status');
  expectEvent('battleHymn emits hymn over all living slots', cap, 'hymn',
    { bonus: HYMN_BONUS, slots: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT] });
}
{ // no stacking — re-singing keeps the stronger value
  const g = fresh();
  g.hymnBonus = 5;
  play(g, 'battleHymn');
  eq('battleHymn keeps the stronger standing bonus', g.hymnBonus, 5);
}

// --- Barrier ---------------------------------------------------------------
{
  const g = fresh();
  const cap = play(g, 'barrier');
  for (const m of g.members) {
    check(`barrier shields ${m.name}`, m.shield);
    eq(`barrier sets ${m.name}'s fuse`, m.shieldTurns, BARRIER_TURNS);
  }
  expectEventCount('barrier emits one shieldApplied per member', cap, 'shieldApplied', 3);
  expectLog('barrier logs a single summary line', cap,
    'Barrier: every living member gains a Shield (fades after the next enemy phase).', 'status');
}
{ // it never DOWNGRADES a longer-lived Shield already standing
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.shield = true; tank.shieldTurns = SHIELD_TURNS;
  play(g, 'barrier');
  eq('barrier keeps a longer standing fuse', tank.shieldTurns, SHIELD_TURNS);
  eq('barrier still shields the others at its own fuse', g.members[SLOT.LEFT].shieldTurns, BARRIER_TURNS);
}

// --- Elbow Grease (bloodTithe) ---------------------------------------------
{
  const g = fresh();
  g.mp = 0;
  const tank = g.members[SLOT.CENTER];
  const hp0 = tank.hp;
  const cap = play(g, 'bloodTithe', SLOT.CENTER);
  eq('bloodTithe charges its HP cost', tank.hp, hp0 - 4);
  eq('bloodTithe restores MP', g.mp, BLOOD_TITHE_MP);
  expectLog('bloodTithe logs the ACTUAL MP delta', cap,
    `Elbow Grease: ${tank.name} pays 4 HP; ${BLOOD_TITHE_MP} MP restored. (MP ${BLOOD_TITHE_MP})`, 'mp');
  expectEvent('bloodTithe emits refreshTick', cap, 'refreshTick',
    { amount: BLOOD_TITHE_MP, mp: BLOOD_TITHE_MP });
}
{ // at full MP the payment still happens but the gain is zero — the log must say 0
  const g = fresh();
  g.mp = g.maxMana;
  const tank = g.members[SLOT.CENTER];
  const hp0 = tank.hp;
  const cap = play(g, 'bloodTithe', SLOT.CENTER);
  eq('bloodTithe still charges HP at full MP', tank.hp, hp0 - 4);
  eq('bloodTithe cannot exceed max mana', g.mp, g.maxMana);
  expectLog('bloodTithe logs a zero gain honestly', cap,
    `Elbow Grease: ${tank.name} pays 4 HP; 0 MP restored. (MP ${g.maxMana})`, 'mp');
}

// --- Helping Hand (martyrsGift) --------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const ranger = g.members[SLOT.LEFT], mage = g.members[SLOT.RIGHT];
  ranger.hp = 4; mage.hp = 3;
  const hp0 = tank.hp;
  const cap = play(g, 'martyrsGift', SLOT.CENTER);
  eq('martyrsGift charges the payer', tank.hp, hp0 - 3);
  eq('martyrsGift heals the others', ranger.hp, 8);
  eq('martyrsGift heals every other member', mage.hp, 7);
  expectEventCount('martyrsGift emits one heal per OTHER member', cap, 'heal', 2);
  expectLog('martyrsGift logs payer and recipients', cap,
    `Helping Hand: ${tank.name} pays 3 HP; the others heal up to 4.`, 'heal');
}
{ // the payer never heals themselves, even when they are the most wounded
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 6;
  play(g, 'martyrsGift', SLOT.CENTER);
  eq('martyrsGift never heals the payer', tank.hp, 3);
}

// --- Trash Talk (dreadWhisper) ---------------------------------------------
{
  const g = fresh();
  const t = g.telegraph;
  if (t) {
    t.cast = undefined; t.damage = 6;
    const intent = g.telegraphIntent() ?? 'attack';
    const cap = play(g, 'dreadWhisper');
    eq('dreadWhisper shaves the telegraph damage', t.damage, 6 - DREAD_WHISPER_REDUCTION);
    expectLog('dreadWhisper logs before and after', cap,
      `Trash Talk saps the ${intent}: 6 → ${6 - DREAD_WHISPER_REDUCTION} per target.`, 'status');
    expectEvent('dreadWhisper emits graveChill with the reduction', cap, 'graveChill',
      { slot: SLOT.CENTER, amount: DREAD_WHISPER_REDUCTION });
  }
}
{ // floors at 0 rather than going negative
  const g = fresh();
  const t = g.telegraph;
  if (t) {
    t.cast = undefined; t.damage = 1;
    play(g, 'dreadWhisper');
    eq('dreadWhisper floors the telegraph at 0', t.damage, 0);
  }
}
{ // no-op branch: an already-zeroed telegraph has nothing to sap
  const g = fresh();
  const t = g.telegraph;
  if (t) {
    t.cast = undefined; t.damage = 0;
    const cap = play(g, 'dreadWhisper');
    expectLog('dreadWhisper logs the no-op', cap,
      'Trash Talk echoes at the telegraph, but there is nothing to sap.', 'status');
    expectNoEvent('dreadWhisper emits nothing on the no-op branch', cap, 'graveChill');
  }
}

// --- Turtle Up (phalanx) ---------------------------------------------------
{
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  const cap = play(g, 'phalanx', SLOT.RIGHT);
  eq('phalanx sets the Defense timer', mage.defense, PHALANX_TURNS);
  eq('phalanx sets the Defense strength', mage.defenseAmount, PHALANX_DEFENSE);
  expectLog('phalanx logs strength and duration', cap,
    `Turtle Up: ${mage.name} gains Defense ${PHALANX_DEFENSE} for ${PHALANX_TURNS} enemy turns.`,
    'status');
  expectEvent('phalanx emits defenseApplied', cap, 'defenseApplied',
    { slot: SLOT.RIGHT, amount: PHALANX_DEFENSE });
}
{ // noDefense/noTaunt gating: refused on a member who already has Defense
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.defense = 1; mage.defenseAmount = 1;
  const cap = play(g, 'phalanx', SLOT.RIGHT);
  eq('phalanx is refused on an already-defended member', mage.defenseAmount, 1);
  eq('a refused phalanx logs nothing', cap.log.length, 0);
}

// --- Provoke ---------------------------------------------------------------
{
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  const cap = play(g, 'provoke', SLOT.RIGHT);
  eq('provoke sets Taunt', mage.taunt, TAUNT_LITE_TURNS);
  eq('provoke bundles NO Defense', mage.defense, 0);
  expectLog('provoke logs the redirect', cap,
    `${mage.name} Provokes — the enemy turns to them for ${TAUNT_LITE_TURNS} enemy turns.`, 'status');
  expectEvent('provoke emits taunt', cap, 'taunt', { slot: SLOT.RIGHT, turns: TAUNT_LITE_TURNS });
}

// --- Guard -----------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const cap = play(g, 'guard', SLOT.CENTER);
  eq('guard sets its DR', tank.guardDR, GUARD_DR);
  eq('guard sets its timer', tank.guardTurns, GUARD_TURNS);
  expectLog('guard logs DR and duration', cap,
    `Guard on ${tank.name}: -${GUARD_DR} damage per hit for ${GUARD_TURNS} enemy turns.`, 'status');
  expectEvent('guard emits defenseApplied with its DR', cap, 'defenseApplied',
    { slot: SLOT.CENTER, amount: GUARD_DR });
}
{ // no self-stack: recasting refreshes the timer, it does not add a second point of DR
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.guardDR = GUARD_DR; tank.guardTurns = 1;
  play(g, 'guard', SLOT.CENTER);
  eq('guard does not stack its DR', tank.guardDR, GUARD_DR);
  eq('guard refreshes its timer', tank.guardTurns, GUARD_TURNS);
}

// --- Sharpen ---------------------------------------------------------------
{
  const g = fresh();
  const ranger = g.members[SLOT.LEFT];
  const cap = play(g, 'sharpen', SLOT.LEFT);
  eq('sharpen sets the strike bonus', ranger.strikeBonus, SHARPEN_BONUS);
  eq('sharpen sets its timer', ranger.strikeTurns, SHARPEN_TURNS);
  expectLog('sharpen logs bonus and duration', cap,
    `Sharpen on ${ranger.name}: +${SHARPEN_BONUS} damage for ${SHARPEN_TURNS} enemy turns.`, 'status');
  expectEvent('sharpen emits hymn on one slot', cap, 'hymn',
    { bonus: SHARPEN_BONUS, slots: [SLOT.LEFT] });
}
{ // shares strikeBonus with Embolden: keep the stronger, refresh the timer
  const g = fresh();
  const ranger = g.members[SLOT.LEFT];
  ranger.strikeBonus = 5; ranger.strikeTurns = 1;
  play(g, 'sharpen', SLOT.LEFT);
  eq('sharpen keeps a stronger ACTIVE bonus', ranger.strikeBonus, 5);
  eq('sharpen refreshes the timer', ranger.strikeTurns, SHARPEN_TURNS);
}
{ // an EXPIRED stronger bonus is discarded rather than revived
  const g = fresh();
  const ranger = g.members[SLOT.LEFT];
  ranger.strikeBonus = 5; ranger.strikeTurns = 0;
  play(g, 'sharpen', SLOT.LEFT);
  eq('sharpen overwrites an expired bonus', ranger.strikeBonus, SHARPEN_BONUS);
}

// --- Encore (doubleStrike) -------------------------------------------------
{
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  const cap = play(g, 'doubleStrike', SLOT.RIGHT);
  check('doubleStrike primes the drum flag', mage.drumPrimed);
  expectLog('doubleStrike logs the priming', cap,
    `${mage.name} readies a Double Strike — their next attack lands doubled.`, 'status');
  eq('doubleStrike emits nothing', cap.events.length, 0);
}

// --- Empower ---------------------------------------------------------------
{
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  const cap = play(g, 'empower', SLOT.RIGHT);
  eq('empower arms the one-shot bonus', mage.empowerBonus, EMPOWER_BONUS);
  expectLog('empower logs the priming', cap,
    `Empower on ${mage.name}: their next ability fires at +${EMPOWER_BONUS} power.`, 'status');
  expectEvent('empower emits hymn on one slot', cap, 'hymn',
    { bonus: EMPOWER_BONUS, slots: [SLOT.RIGHT] });
}
{ // refreshing keeps a single pending charge (no stack)
  const g = fresh();
  const mage = g.members[SLOT.RIGHT];
  mage.empowerBonus = EMPOWER_BONUS;
  play(g, 'empower', SLOT.RIGHT);
  eq('empower does not stack its charge', mage.empowerBonus, EMPOWER_BONUS);
}

// --- Riposte ---------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const cap = play(g, 'riposte', SLOT.CENTER);
  check('riposte arms the counter flag', tank.riposte);
  expectLog('riposte logs the arming', cap,
    `${tank.name} sets a Riposte — the next hit will be answered in kind.`, 'status');
  expectEvent('riposte emits enGarde for one turn', cap, 'enGarde',
    { slot: SLOT.CENTER, turns: 1 });
}

// --- Cleanse ---------------------------------------------------------------
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER], mage = g.members[SLOT.RIGHT];
  g.woundTurns = 3;
  tank.poison = 2; tank.poisonTurns = 3;
  mage.markTurns = 2;
  const cap = play(g, 'cleanse');
  eq('cleanse clears the party-wide Hex', g.woundTurns, 0);
  eq('cleanse clears hero Poison magnitude', tank.poison, 0);
  eq('cleanse clears hero Poison duration', tank.poisonTurns, 0);
  eq('cleanse clears the Mark', mage.markTurns, 0);
  expectLog('cleanse logs that it found something', cap,
    'Cleanse purges the party — all afflictions lifted.', 'status');
  expectEvent('cleanse emits its event', cap, 'cleanse', { slot: SLOT.CENTER });
}
{ // always playable, and the no-op branch has its own log but STILL emits
  const g = fresh();
  const cap = play(g, 'cleanse');
  expectLog('cleanse logs the empty case', cap, 'Cleanse finds nothing to purge.', 'status');
  expectEvent('cleanse emits even when it purges nothing', cap, 'cleanse', { slot: SLOT.CENTER });
}

finish('content/cards');
