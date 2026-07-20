// Characterization tests for the 30 ability arms (#99 A5), switch (ability) at
// src/engine/effects.ts:477.
//
// Every ability here fires through playCard on its bound ability card, NOT through
// _fireAbility. That matters: the 19 learned-ability tests in
// engine.archetypes.test.ts:1010-1174 call _fireAbility directly and so cover neither
// the MP cost, the targeting gates, nor the log path. Going through the card is also
// what makes this file survive #102 unchanged.
import { Game } from '../../src/engine';
import type { MemberId, AbilityId, PartyMemberConfig } from '../../src/constants';
import {
  SLOT, defaultBattleConfig, partyFromMembers, ABILITY_CARD, LEARNED_CARDS_BY_MEMBER,
  POISON_BASE, POISON_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS, TAUNT_TURNS,
  BOLT_BASE, BOLT_CHARGE_MULT, CHARGE_MAX,
  HEX_TURNS, HEX_VULN_BY_SIZE, CRESCENDO_DRAW, RAMPAGE_SELF_DMG,
  BOAR_HP, BOAR_TURNS, BOAR_STRIKE_BONUS, EN_GARDE_TURNS,
  PENANCE_HP, PENANCE_STRIKE_BONUS, PENANCE_STRIKE_TURNS,
  TWIN_SHOT_HITS, CONC_VENOM_MULT, SHIELD_WALL_DEFENSE, SHIELD_WALL_TURNS,
  HOLD_LINE_DEFENSE, HOLD_LINE_TURNS, ARCANE_SURGE_CHARGE, DRAIN_LIFE_DMG,
  DOOM_DELAY, SACRIFICE_HP, SACRIFICE_DMG, SACRIFICE_POWER,
  FINALE_MULT, BLOODBATH_PER_MISSING, WHIRLWIND_HITS, SIC_EM_MULT, MEND_BEAST_HEAL,
  BIG_TOP_TURNS, LUNGE_MULT, LUNGE_TAUNT_TURNS, FLURRY_HITS, FLURRY_REDUCTION,
  STRONGEST_HP, DEADLIFT_TURNS, EMPOWER_BONUS,
} from '../../src/constants';
import { giveCard } from '../factories';
import {
  check, eq, finish, capture, expectEvent, expectNoEvent, expectEventCount, expectLog,
} from '../harness';

// A battle party is ALWAYS length 3; a short deployment fills the rest with
// `{empty: true}` seats, which the engine seats as absent members — dead,
// unstriking, untargetable (core.ts:365-402). Building a 1-element party directly
// crashes _pickPrimary, so `null` here means an empty seat.
const seat = (id: MemberId | null): PartyMemberConfig =>
  id ? partyFromMembers([id])[0]
    : { maxHP: 1, hp: 1, damage: 0, abilityPower: 0, injuries: 0, upgrades: 0, empty: true };

// A started game with an arbitrary party, everyone topped up (start() runs
// _openingStrike), plenty of MP, and any learned abilities granted to their owner.
function abilityGame(ids: (MemberId | null)[], learned: AbilityId[] = [], seed = 5): Game {
  const cfg = defaultBattleConfig();
  const padded: (MemberId | null)[] = [...ids];
  while (padded.length < 3) padded.push(null);
  cfg.party = padded.map(seat);
  const g = new Game(seed, cfg);
  g.start();
  for (const m of g.members) if (m.alive) m.hp = m.maxHP;
  g.mp = 20;
  g.enemy.hp = 400; // deep enough that no strike ends the fight mid-assertion
  for (const a of learned) {
    const owner = g.members.find((m) => LEARNED_CARDS_BY_MEMBER[m.id]?.includes(a));
    if (owner) owner.learned.push(a);
  }
  return g;
}
const fire = (g: Game, ability: AbilityId, target?: number) =>
  capture(g, () => g.playCard(giveCard(g, ABILITY_CARD[ability]), target));

const TRIO: MemberId[] = ['ranger', 'tank', 'mage'];

// The Mage's Arcane Battery passive grants +1 Charge at every player-phase start,
// including the one inside start() — so he is NOT on 0 Charge when a test begins.
// Bolt tests set it explicitly rather than assuming.
const setCharge = (g: Game, n: number) => { g.members[SLOT.RIGHT].charge = n; };

// ===========================================================================
// The shell around every ability (effects.ts:465-475, :791-793)
// ===========================================================================
{ // Empower is borrowed for the cast and restored afterwards — spent exactly once
  const g = abilityGame(TRIO);
  const mage = g.members[SLOT.RIGHT];
  mage.empowerBonus = EMPOWER_BONUS;
  setCharge(g, 0);
  const power0 = mage.abilityPower;
  const cap = fire(g, 'bolt');
  expectLog('an Empowered cast announces itself', cap,
    `${mage.name} is Empowered — this ability fires at +${EMPOWER_BONUS} power.`, 'status');
  eq('Empower is consumed by the cast', mage.empowerBonus, 0);
  eq('the borrowed power is restored afterwards', mage.abilityPower, power0);
  expectEvent('the Empowered bolt is scaled', cap, 'bolt',
    { amount: BOLT_BASE + EMPOWER_BONUS });
}
{ // without Empower there is no announcement and no bonus
  const g = abilityGame(TRIO);
  setCharge(g, 0);
  const cap = fire(g, 'bolt');
  check('an unempowered cast logs no Empower line',
    !cap.log.some((l) => l.text.includes('is Empowered')));
  expectEvent('an unempowered bolt is unscaled', cap, 'bolt', { amount: BOLT_BASE });
}

// ===========================================================================
// Signature abilities
// ===========================================================================

// --- poison (Ranger) -------------------------------------------------------
{
  const g = abilityGame(TRIO);
  const ranger = g.members[SLOT.LEFT];
  const cap = fire(g, 'poison');
  eq('poison sets the per-turn magnitude', g.enemy.poison, POISON_BASE);
  eq('poison sets its duration', g.enemy.poisonTurns, POISON_TURNS);
  expectLog('poison logs magnitude and duration', cap,
    `${ranger.name} fires Poison Arrow (${POISON_BASE}/turn for ${POISON_TURNS}).`, 'status');
  expectEvent('poison emits poisonApplied', cap, 'poisonApplied',
    { slot: SLOT.LEFT, amount: POISON_BASE, poison: POISON_BASE });
}
{ // the ability KEEPS THE STRONGER magnitude (unlike _applyPoison, which adds)
  const g = abilityGame(TRIO);
  g.enemy.poison = 9; g.enemy.poisonTurns = 1;
  fire(g, 'poison');
  eq('poison keeps a stronger standing magnitude', g.enemy.poison, 9);
  eq('poison SETS the duration rather than taking the max', g.enemy.poisonTurns, POISON_TURNS);
}
{ // negative abilityPower (a Broken member) floors the strength at 1
  const g = abilityGame(TRIO);
  g.members[SLOT.LEFT].abilityPower = -99;
  fire(g, 'poison');
  eq('poison floors its strength at 1', g.enemy.poison, 1);
}

// --- taunt (Tank) ----------------------------------------------------------
{
  const g = abilityGame(TRIO);
  const tank = g.members[SLOT.CENTER];
  const cap = fire(g, 'taunt');
  eq('taunt sets its Taunt timer', tank.taunt, TAUNT_TURNS);
  eq('taunt bundles Defense', tank.defense, DEFENSE_TURNS);
  eq('taunt sets the Defense strength', tank.defenseAmount, DEFENSE_AMOUNT);
  expectLog('taunt logs Defense and duration', cap,
    `${tank.name} Taunts and braces (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} enemy turns.`,
    'status');
  expectEvent('taunt emits its event', cap, 'taunt', { slot: SLOT.CENTER, turns: TAUNT_TURNS });
}
{ // abilityPower scales the bundled Defense — but the LOG still prints the base
  // constant (effects.ts:510 interpolates DEFENSE_AMOUNT, not `strength`). Pinning
  // the discrepancy so #102 reproduces it rather than "fixing" it silently.
  const g = abilityGame(TRIO);
  const tank = g.members[SLOT.CENTER];
  tank.abilityPower = 3;
  const cap = fire(g, 'taunt');
  eq('abilityPower scales the bundled Defense', tank.defenseAmount, DEFENSE_AMOUNT + 3);
  expectLog('the taunt log prints the BASE Defense, not the scaled one', cap,
    `${tank.name} Taunts and braces (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} enemy turns.`,
    'status');
}
{ // a stronger standing Defense (Phalanx) is kept
  const g = abilityGame(TRIO);
  const tank = g.members[SLOT.CENTER];
  tank.defense = 1; tank.defenseAmount = 5;
  fire(g, 'taunt');
  eq('taunt keeps a stronger standing Defense', tank.defenseAmount, 5);
}
{ // negative abilityPower floors the bundled Defense at 0, never negative
  const g = abilityGame(TRIO);
  const tank = g.members[SLOT.CENTER];
  tank.abilityPower = -99;
  fire(g, 'taunt');
  eq('taunt floors its Defense at 0', tank.defenseAmount, 0);
}

// --- bolt (Mage) -----------------------------------------------------------
{
  const g = abilityGame(TRIO);
  const mage = g.members[SLOT.RIGHT];
  mage.charge = 2;
  const hp0 = g.enemy.hp;
  const cap = fire(g, 'bolt');
  const dmg = BOLT_BASE + BOLT_CHARGE_MULT * 2;
  eq('bolt scales on Charge', hp0 - g.enemy.hp, dmg);
  eq('bolt spends the Charge', mage.charge, 0);
  expectLog('bolt logs the PRE-SPEND Charge', cap,
    `${mage.name} casts Lightning Bolt (base ${BOLT_BASE} + ${BOLT_CHARGE_MULT}×Charge 2).`, 'status');
  expectEvent('bolt emits with the resulting enemy HP', cap, 'bolt',
    { slot: SLOT.RIGHT, amount: dmg, enemyHp: g.enemy.hp });
}
{ // Vulnerability scales the applied damage AND the emitted amount
  const g = abilityGame(TRIO);
  setCharge(g, 0);
  g.enemy.vulnerable = 1; g.enemy.vulnerableTurns = 3;
  const hp0 = g.enemy.hp;
  const cap = fire(g, 'bolt');
  eq('bolt is scaled by Vulnerability', hp0 - g.enemy.hp, BOLT_BASE * 2);
  expectEvent('the bolt event reports the scaled amount', cap, 'bolt', { amount: BOLT_BASE * 2 });
}
{ // a killing bolt also emits defeatEnemy
  const g = abilityGame(TRIO);
  g.enemy.hp = 1;
  const cap = fire(g, 'bolt');
  expectEvent('a lethal bolt emits defeatEnemy', cap, 'defeatEnemy');
}

// --- hex (Warlock) ---------------------------------------------------------
{
  const g = abilityGame(['warlock', 'tank', 'mage']);
  const wl = g.members[SLOT.LEFT];
  const cap = fire(g, 'hex');
  const vuln = HEX_VULN_BY_SIZE[3];
  eq('hex applies trio-sized Vulnerability', g.enemy.vulnerable, vuln);
  eq('hex sets its duration', g.enemy.vulnerableTurns, HEX_TURNS);
  expectLog('hex logs the percentage', cap,
    `${wl.name} gives the enemy the Evil Eye — +${Math.round(vuln * 100)}% damage taken for ${HEX_TURNS} turns.`,
    'status');
  eq('hex emits nothing', cap.events.length, 0);
}
{ // the bonus is far LARGER solo — the whole point of the redesign
  const g = abilityGame(['warlock']);
  eq('the solo party fields exactly one member', g.fieldedPartySize(), 1);
  fire(g, 'hex');
  eq('hex is strongest solo', g.enemy.vulnerable, HEX_VULN_BY_SIZE[1]);
  check('solo hex dwarfs trio hex', HEX_VULN_BY_SIZE[1] > HEX_VULN_BY_SIZE[3]);
}
{ // re-hexing keeps the stronger value and refreshes the duration
  const g = abilityGame(['warlock', 'tank', 'mage']);
  g.enemy.vulnerable = 5; g.enemy.vulnerableTurns = 1;
  fire(g, 'hex');
  eq('hex keeps a stronger standing Vulnerability', g.enemy.vulnerable, 5);
  eq('hex refreshes the duration regardless', g.enemy.vulnerableTurns, HEX_TURNS);
}

// --- crescendo (Busker) ----------------------------------------------------
{
  const g = abilityGame(['skald', 'tank', 'mage']);
  const skald = g.members[SLOT.LEFT];
  const hand0 = g.hand.length;
  const cap = fire(g, 'crescendo');
  eq('crescendo draws its cards', g.hand.length, hand0 + CRESCENDO_DRAW);
  expectLog('crescendo logs the draw', cap,
    `${skald.name} plays a Crescendo — draws ${CRESCENDO_DRAW}.`, 'status');
  expectEvent('crescendo emits draw', cap, 'draw', { count: CRESCENDO_DRAW });
}

// --- rampage (Berserker) ---------------------------------------------------
{
  const g = abilityGame(['berserker', 'tank', 'mage']);
  const zerk = g.members[SLOT.LEFT];
  const expected = 2 * g.memberDamage(zerk) + zerk.abilityPower;
  const hp0 = g.enemy.hp, self0 = zerk.hp;
  const cap = fire(g, 'rampage');
  eq('rampage strikes for double his live damage', hp0 - g.enemy.hp, expected);
  eq('rampage costs him HP afterwards', zerk.hp, self0 - RAMPAGE_SELF_DMG);
  expectEvent('rampage emits a partyAttack', cap, 'partyAttack',
    { slot: SLOT.LEFT, memberId: 'berserker', amount: expected });
  expectEvent('rampage emits its blood cost', cap, 'bloodPay',
    { slot: SLOT.LEFT, amount: RAMPAGE_SELF_DMG });
}
{ // the self-damage is CLAMPED (bloodPay), so Rampage can never kill him
  const g = abilityGame(['berserker', 'tank', 'mage']);
  const zerk = g.members[SLOT.LEFT];
  zerk.hp = 1;
  fire(g, 'rampage');
  eq('rampage clamps its self-damage to leave 1 HP', zerk.hp, 1);
  check('rampage never kills the Berserker', zerk.alive);
}

// --- callBoar (Beast Warden) -----------------------------------------------
{
  const g = abilityGame(['beastWarden', 'tank', 'mage']);
  const bw = g.members[SLOT.LEFT];
  const cap = fire(g, 'callBoar');
  eq('callBoar summons at full HP', bw.boarHp, BOAR_HP);
  eq('callBoar sets the Boar duration', bw.boarTurns, BOAR_TURNS);
  expectLog('callBoar logs HP and duration', cap,
    `${bw.name} calls a Boar (${BOAR_HP} HP) to her side for ${BOAR_TURNS} enemy turns.`, 'status');
  expectEvent('callBoar emits boarSummon', cap, 'boarSummon',
    { slot: SLOT.LEFT, hp: BOAR_HP, turns: BOAR_TURNS });
}
{ // abilityPower deepens the Boar; recasting REPLACES it at full rather than stacking
  const g = abilityGame(['beastWarden', 'tank', 'mage']);
  const bw = g.members[SLOT.LEFT];
  bw.abilityPower = 2; bw.boarHp = 1; bw.boarTurns = 1;
  fire(g, 'callBoar');
  eq('abilityPower deepens the Boar', bw.boarHp, BOAR_HP + 2);
  eq('recasting replaces rather than stacks', bw.boarTurns, BOAR_TURNS);
}

// --- stun (Showstopper) ----------------------------------------------------
{
  const g = abilityGame(['sentinel', 'tank', 'mage']);
  const sent = g.members[SLOT.LEFT];
  const intent = g.telegraphIntent() ?? 'attack';
  const cap = fire(g, 'stun');
  check('stun flags the standing telegraph', g.telegraph?.stunned === true);
  expectLog('stun names the cancelled intent', cap,
    `${sent.name} Stuns the ${g.enemyDef.name} — its ${intent} is cancelled.`, 'status');
  expectEvent('stun emits with the intent string', cap, 'stun', { slot: SLOT.LEFT, intent });
}
{ // no-op branch: an already-stunned telegraph has nothing left to interrupt
  const g = abilityGame(['sentinel', 'tank', 'mage']);
  const sent = g.members[SLOT.LEFT];
  if (g.telegraph) g.telegraph.stunned = true;
  const cap = fire(g, 'stun');
  expectLog('stun logs the no-op', cap,
    `${sent.name} winds up to Stun, but there is nothing to interrupt.`, 'status');
  expectNoEvent('stun emits nothing on the no-op branch', cap, 'stun');
}

// --- enGarde (Duelist) -----------------------------------------------------
{ // on a chosen OTHER member: the log names them
  const g = abilityGame(['duelist', 'tank', 'mage']);
  const duelist = g.members[SLOT.LEFT], tank = g.members[SLOT.CENTER];
  const cap = fire(g, 'enGarde', SLOT.CENTER);
  eq('enGarde applies Taunt to the holder', tank.taunt, EN_GARDE_TURNS);
  eq('enGarde grants persistent Riposte', tank.riposteTurns, EN_GARDE_TURNS);
  expectLog('enGarde names the chosen holder', cap,
    `${duelist.name} sets ${tank.name}'s guard — En Garde: ${tank.name} Provokes and counters every hit for ${EN_GARDE_TURNS} enemy turns.`,
    'status');
  expectEvent('enGarde emits taunt on the holder', cap, 'taunt',
    { slot: SLOT.CENTER, turns: EN_GARDE_TURNS });
  expectEvent('enGarde emits its own event too', cap, 'enGarde',
    { slot: SLOT.CENTER, turns: EN_GARDE_TURNS });
}
{ // on herself: the log switches to conditional prose ("her own")
  const g = abilityGame(['duelist', 'tank', 'mage']);
  const duelist = g.members[SLOT.LEFT];
  const cap = fire(g, 'enGarde', SLOT.LEFT);
  expectLog('enGarde uses possessive prose when self-targeted', cap,
    `${duelist.name} sets her own guard — En Garde: ${duelist.name} Provokes and counters every hit for ${EN_GARDE_TURNS} enemy turns.`,
    'status');
}

// --- penance (Strongman) ---------------------------------------------------
{
  const g = abilityGame(['flagellant', 'tank', 'mage']);
  const str = g.members[SLOT.LEFT];
  const hp0 = str.hp;
  const cap = fire(g, 'penance');
  eq('penance costs him HP', str.hp, hp0 - PENANCE_HP);
  eq('penance sets the party bonus', g.penanceBonus, PENANCE_STRIKE_BONUS);
  eq('penance sets its duration', g.penanceTurns, PENANCE_STRIKE_TURNS);
  expectLog('penance logs the survived case', cap,
    `${str.name} strains himself (-${PENANCE_HP} HP) — Feat of Strength: every living member's auto deals +${PENANCE_STRIKE_BONUS} for ${PENANCE_STRIKE_TURNS} enemy turns.`,
    'status');
  expectEvent('penance emits with died=false', cap, 'penance',
    { slot: SLOT.LEFT, bonus: PENANCE_STRIKE_BONUS, died: false });
}
{ // His OWN Last Stand passive catches the first lethal Penance of the fight.
  const g = abilityGame(['flagellant', 'tank', 'mage']);
  const str = g.members[SLOT.LEFT];
  str.hp = PENANCE_HP;
  const cap = fire(g, 'penance');
  check('Last Stand saves the Strongman from his own Penance', str.alive);
  eq('Last Stand leaves him on 1 HP', str.hp, 1);
  expectLog('Last Stand announces itself', cap,
    `${str.name} makes his Last Stand — he clings to life at 1 HP!`, 'status');
  expectEvent('a saved Penance still reports died=false', cap, 'penance', { died: false });
}
{ // UNCLAMPED: with Last Stand already spent, Penance is the sole Blood effect that
  // kills its own caster — and the party buff still lands afterwards
  const g = abilityGame(['flagellant', 'tank', 'mage']);
  const str = g.members[SLOT.LEFT];
  str.lastStandUsed = true;
  str.hp = PENANCE_HP;
  const cap = fire(g, 'penance');
  check('penance can kill the Strongman', !str.alive);
  eq('the party buff lands even when he dies', g.penanceBonus, PENANCE_STRIKE_BONUS);
  expectLog('penance switches to the death sentence', cap,
    `${str.name} gives everything for one last Feat of Strength. Every living member's auto deals +${PENANCE_STRIKE_BONUS} for ${PENANCE_STRIKE_TURNS} enemy turns.`,
    'status');
  expectEvent('penance emits with died=true', cap, 'penance', { slot: SLOT.LEFT, died: true });
}

// ===========================================================================
// Learned abilities (Training Dojo)
// ===========================================================================

// --- twinShot (Ranger) -----------------------------------------------------
{
  const g = abilityGame(TRIO, ['twinShot']);
  const ranger = g.members[SLOT.LEFT];
  const each = g.memberDamage(ranger);
  const hp0 = g.enemy.hp;
  const cap = fire(g, 'twinShot');
  eq('twinShot lands two full autos', hp0 - g.enemy.hp, each * TWIN_SHOT_HITS);
  expectEventCount('twinShot emits one partyAttack per hit', cap, 'partyAttack', TWIN_SHOT_HITS);
}
{ // it stops early once the enemy dies rather than swinging at a corpse
  const g = abilityGame(TRIO, ['twinShot']);
  g.enemy.hp = 1;
  const cap = fire(g, 'twinShot');
  expectEventCount('twinShot breaks on the kill', cap, 'partyAttack', 1);
}

// --- concVenom (Ranger) ----------------------------------------------------
{
  const g = abilityGame(TRIO, ['concVenom']);
  const ranger = g.members[SLOT.LEFT];
  g.enemy.poison = 4; g.enemy.poisonTurns = 3;
  const cap = fire(g, 'concVenom');
  eq('concVenom multiplies the per-turn magnitude', g.enemy.poison, 4 * CONC_VENOM_MULT);
  eq('concVenom leaves the duration alone', g.enemy.poisonTurns, 3);
  expectLog('concVenom logs the new magnitude', cap,
    `${ranger.name} concentrates the venom — Poison ${4 * CONC_VENOM_MULT}/turn.`, 'status');
  expectEvent('concVenom emits poisonApplied', cap, 'poisonApplied',
    { slot: SLOT.LEFT, poison: 4 * CONC_VENOM_MULT });
}
{ // no-op on an unpoisoned enemy, with its own log
  const g = abilityGame(TRIO, ['concVenom']);
  const ranger = g.members[SLOT.LEFT];
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  const cap = fire(g, 'concVenom');
  eq('concVenom cannot create poison from nothing', g.enemy.poison, 0);
  expectLog('concVenom logs the no-op', cap,
    `${ranger.name} finds no venom to concentrate.`, 'status');
  expectNoEvent('concVenom emits nothing on the no-op branch', cap, 'poisonApplied');
}

// --- shieldWall (Tank) -----------------------------------------------------
{
  const g = abilityGame(TRIO, ['shieldWall']);
  const tank = g.members[SLOT.CENTER];
  const cap = fire(g, 'shieldWall');
  for (const m of g.members) {
    eq(`shieldWall braces ${m.name}`, m.defenseAmount, SHIELD_WALL_DEFENSE);
    eq(`shieldWall times ${m.name}`, m.defense, SHIELD_WALL_TURNS);
  }
  expectEventCount('shieldWall emits one defenseApplied per member', cap, 'defenseApplied', 3);
  expectLog('shieldWall logs a single summary', cap,
    `${tank.name} raises a Shield Wall — the party braces (Defense ${SHIELD_WALL_DEFENSE} for ${SHIELD_WALL_TURNS} turns).`,
    'status');
}
{ // keeps a stronger ACTIVE Defense and the longer timer
  const g = abilityGame(TRIO, ['shieldWall']);
  const mage = g.members[SLOT.RIGHT];
  mage.defense = 9; mage.defenseAmount = 7;
  fire(g, 'shieldWall');
  eq('shieldWall keeps a stronger standing Defense', mage.defenseAmount, 7);
  eq('shieldWall keeps a longer standing timer', mage.defense, 9);
}

// --- holdLine (Tank) -------------------------------------------------------
{
  const g = abilityGame(TRIO, ['holdLine']);
  const tank = g.members[SLOT.CENTER];
  const cap = fire(g, 'holdLine');
  eq('holdLine sets its Defense strength', tank.defenseAmount, HOLD_LINE_DEFENSE);
  eq('holdLine sets the Defense timer', tank.defense, HOLD_LINE_TURNS);
  eq('holdLine opens the double-banking window', tank.holdLineTurns, HOLD_LINE_TURNS);
  expectLog('holdLine logs the stance', cap,
    `${tank.name} holds the line (Defense ${HOLD_LINE_DEFENSE}) — the blows he soaks now bank double for Grudge.`,
    'status');
  expectEvent('holdLine emits defenseApplied', cap, 'defenseApplied',
    { slot: SLOT.CENTER, amount: HOLD_LINE_DEFENSE });
}

// --- arcaneSurge (Mage) ----------------------------------------------------
{
  const g = abilityGame(TRIO, ['arcaneSurge']);
  const mage = g.members[SLOT.RIGHT];
  setCharge(g, 0);
  const cap = fire(g, 'arcaneSurge');
  eq('arcaneSurge grants Charge', mage.charge, ARCANE_SURGE_CHARGE);
  expectLog('arcaneSurge logs the new Charge', cap,
    `${mage.name} surges with arcane power — Charge ${ARCANE_SURGE_CHARGE}.`, 'status');
}
{ // Charge is capped
  const g = abilityGame(TRIO, ['arcaneSurge']);
  const mage = g.members[SLOT.RIGHT];
  mage.charge = CHARGE_MAX;
  fire(g, 'arcaneSurge');
  eq('arcaneSurge cannot exceed CHARGE_MAX', mage.charge, CHARGE_MAX);
}

// --- drainLife (Mage) ------------------------------------------------------
{
  const g = abilityGame(TRIO, ['drainLife']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 4;
  const hp0 = g.enemy.hp;
  const cap = fire(g, 'drainLife');
  eq('drainLife deals its damage', hp0 - g.enemy.hp, DRAIN_LIFE_DMG);
  eq('drainLife heals the most wounded for the damage dealt', tank.hp, 4 + DRAIN_LIFE_DMG);
  expectEvent('drainLife emits a partyAttack', cap, 'partyAttack', { amount: DRAIN_LIFE_DMG });
  expectEvent('drainLife emits the lifesteal heal', cap, 'heal',
    { slot: SLOT.CENTER, amount: DRAIN_LIFE_DMG });
}
{ // POST-Vulnerability lifesteal: the heal tracks the damage actually dealt
  const g = abilityGame(TRIO, ['drainLife']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 2;
  g.enemy.vulnerable = 1; g.enemy.vulnerableTurns = 3;
  fire(g, 'drainLife');
  eq('drainLife lifesteals the SCALED damage', tank.hp, 2 + DRAIN_LIFE_DMG * 2);
}
{ // with nobody wounded the reduce is seeded with the CASTER, so the Mage heals
  // himself for 0 and no heal event fires (effects.ts:687)
  const g = abilityGame(TRIO, ['drainLife']);
  const cap = fire(g, 'drainLife');
  check('a full-HP party takes no lifesteal heal', g.members.every((m) => m.hp === m.maxHP));
  expectNoEvent('no heal event fires when the heal lands for 0', cap, 'heal');
}

// --- doom (Warlock) --------------------------------------------------------
{
  const g = abilityGame(['warlock', 'tank', 'mage'], ['doom']);
  const wl = g.members[SLOT.LEFT];
  const cap = fire(g, 'doom');
  eq('doom sets its countdown', g.enemy.doomTurns, DOOM_DELAY);
  expectLog('doom logs the delay', cap,
    `${wl.name} pronounces Doom — the enemy is struck in ${DOOM_DELAY} turns.`, 'status');
  eq('doom emits nothing on cast', cap.events.length, 0);
}
{ // recasting refreshes the countdown
  const g = abilityGame(['warlock', 'tank', 'mage'], ['doom']);
  g.enemy.doomTurns = 1;
  fire(g, 'doom');
  eq('doom refreshes its countdown', g.enemy.doomTurns, DOOM_DELAY);
}

// --- sacrifice (Warlock) ---------------------------------------------------
{
  const g = abilityGame(['warlock', 'tank', 'mage'], ['sacrifice']);
  const wl = g.members[SLOT.LEFT], tank = g.members[SLOT.CENTER];
  const dmg0 = wl.damage, pow0 = wl.abilityPower, hp0 = tank.hp;
  const cap = fire(g, 'sacrifice', SLOT.CENTER);
  eq('sacrifice bleeds the chosen ally', tank.hp, hp0 - SACRIFICE_HP);
  eq('sacrifice grows the Warlock damage', wl.damage, dmg0 + SACRIFICE_DMG);
  eq('sacrifice grows the Warlock power', wl.abilityPower, pow0 + SACRIFICE_POWER);
  expectLog('sacrifice names the bled ally', cap,
    `${wl.name} sacrifices ${tank.name}'s blood — +${SACRIFICE_DMG} damage, +${SACRIFICE_POWER} power for the fight.`,
    'status');
}
{ // self-targeted, the prose switches to "his own"
  const g = abilityGame(['warlock', 'tank', 'mage'], ['sacrifice']);
  const wl = g.members[SLOT.LEFT];
  const cap = fire(g, 'sacrifice', SLOT.LEFT);
  expectLog('sacrifice uses possessive prose when self-targeted', cap,
    `${wl.name} sacrifices his own blood — +${SACRIFICE_DMG} damage, +${SACRIFICE_POWER} power for the fight.`,
    'status');
}
{ // the bleed is clamped — sacrifice never kills the ally
  const g = abilityGame(['warlock', 'tank', 'mage'], ['sacrifice']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 2;
  fire(g, 'sacrifice', SLOT.CENTER);
  eq('sacrifice clamps the bleed to leave 1 HP', tank.hp, 1);
  check('sacrifice never kills the ally', tank.alive);
}

// --- finale / duet (Busker) ------------------------------------------------
{
  const g = abilityGame(['skald', 'tank', 'mage'], ['finale']);
  const skald = g.members[SLOT.LEFT];
  const before = g.memberDamage(skald);
  const hp0 = g.enemy.hp;
  fire(g, 'finale');
  // The Busker's auto scales on cards played this phase, and _resolvePlayedCard
  // increments that counter BEFORE _applyCard — so Finale reads a board that already
  // includes itself. Measured after the play, which is the same value it cast at.
  eq('finale multiplies his live cards-played damage',
    hp0 - g.enemy.hp, FINALE_MULT * g.memberDamage(skald));
  check('playing Finale raised his own auto first', g.memberDamage(skald) > before);
}
{
  const g = abilityGame(['skald', 'tank', 'mage'], ['duet']);
  const mage = g.members[SLOT.RIGHT];
  const hp0 = g.enemy.hp;
  const expected = g.memberDamage(mage);
  const cap = fire(g, 'duet', SLOT.RIGHT);
  eq('duet makes the PARTNER attack, not the caster', hp0 - g.enemy.hp, expected);
  expectEvent('duet attributes the strike to the partner', cap, 'partyAttack',
    { slot: SLOT.RIGHT, memberId: 'mage' });
}

// --- bloodbath / whirlwind (Berserker) -------------------------------------
{
  const g = abilityGame(['berserker', 'tank', 'mage'], ['bloodbath']);
  const zerk = g.members[SLOT.LEFT];
  zerk.hp = zerk.maxHP - 6;
  const hp0 = g.enemy.hp;
  fire(g, 'bloodbath');
  eq('bloodbath scales on MISSING HP', hp0 - g.enemy.hp, 6 * BLOODBATH_PER_MISSING + zerk.abilityPower);
}
{ // at full HP it does nothing at all
  const g = abilityGame(['berserker', 'tank', 'mage'], ['bloodbath']);
  const hp0 = g.enemy.hp;
  fire(g, 'bloodbath');
  eq('bloodbath at full HP deals nothing', hp0 - g.enemy.hp, 0);
}
{ // whirlwind: base hits outside the hottest band
  const g = abilityGame(['berserker', 'tank', 'mage'], ['whirlwind']);
  const zerk = g.members[SLOT.LEFT];
  zerk.hp = zerk.maxHP;
  const cap = fire(g, 'whirlwind');
  expectEventCount('whirlwind lands its base hit count', cap, 'partyAttack', WHIRLWIND_HITS);
}
{ // ...and one extra inside it
  const g = abilityGame(['berserker', 'tank', 'mage'], ['whirlwind']);
  const zerk = g.members[SLOT.LEFT];
  zerk.hp = g.berserkerThresholds()[1];
  const cap = fire(g, 'whirlwind');
  expectEventCount('whirlwind adds a hit in the hottest band', cap, 'partyAttack', WHIRLWIND_HITS + 1);
}

// --- sicEm / mendBeast (Beast Warden) --------------------------------------
{
  const g = abilityGame(['beastWarden', 'tank', 'mage'], ['sicEm']);
  const bw = g.members[SLOT.LEFT];
  bw.boarHp = BOAR_HP; bw.boarTurns = BOAR_TURNS;
  const hp0 = g.enemy.hp;
  fire(g, 'sicEm');
  eq('sicEm strikes for a multiple of the Boar bonus',
    hp0 - g.enemy.hp, SIC_EM_MULT * BOAR_STRIKE_BONUS + bw.abilityPower);
}
{ // needsBoar gates it — with no Boar out the card is refused entirely
  const g = abilityGame(['beastWarden', 'tank', 'mage'], ['sicEm']);
  const bw = g.members[SLOT.LEFT];
  bw.boarHp = 0; bw.boarTurns = 0;
  const hp0 = g.enemy.hp;
  const cap = fire(g, 'sicEm');
  eq('sicEm is refused with no Boar out', g.enemy.hp, hp0);
  eq('a refused sicEm logs nothing', cap.log.length, 0);
}
{
  const g = abilityGame(['beastWarden', 'tank', 'mage'], ['mendBeast']);
  const bw = g.members[SLOT.LEFT];
  bw.boarHp = 2; bw.boarTurns = 1;
  const cap = fire(g, 'mendBeast');
  eq('mendBeast heals the Boar', bw.boarHp, 2 + MEND_BEAST_HEAL);
  eq('mendBeast extends its stay by one turn', bw.boarTurns, 2);
  expectLog('mendBeast logs HP and turns', cap,
    `${bw.name} mends her Boar (${2 + MEND_BEAST_HEAL} HP, 2 turns).`, 'status');
  expectEvent('mendBeast re-emits boarSummon', cap, 'boarSummon',
    { slot: SLOT.LEFT, hp: 2 + MEND_BEAST_HEAL, turns: 2 });
}

// --- standingOvation / bigTop (Showstopper) --------------------------------
{
  const g = abilityGame(['sentinel', 'tank', 'mage'], ['standingOvation']);
  const sent = g.members[SLOT.LEFT];
  const cap = fire(g, 'standingOvation');
  for (const m of g.members) check(`standingOvation primes ${m.name}`, m.drumPrimed);
  expectLog('standingOvation logs the party priming', cap,
    `${sent.name} brings the house down — every member's next strike lands doubled!`, 'status');
}
{
  const g = abilityGame(['sentinel', 'tank', 'mage'], ['bigTop']);
  const sent = g.members[SLOT.LEFT];
  const cap = fire(g, 'bigTop');
  eq('bigTop raises the party DR aura', g.bigTopTurns, BIG_TOP_TURNS);
  expectLog('bigTop logs the aura', cap,
    `${sent.name} raises the big top — the party takes less from every hit next turn.`, 'status');
}
{ // keeps the stronger standing timer
  const g = abilityGame(['sentinel', 'tank', 'mage'], ['bigTop']);
  g.bigTopTurns = 5;
  fire(g, 'bigTop');
  eq('bigTop keeps a longer standing aura', g.bigTopTurns, 5);
}

// --- lunge / flurry (Duelist) ----------------------------------------------
{
  const g = abilityGame(['duelist', 'tank', 'mage'], ['lunge']);
  const duelist = g.members[SLOT.LEFT];
  const hp0 = g.enemy.hp;
  const expected = LUNGE_MULT * g.memberDamage(duelist);
  const cap = fire(g, 'lunge');
  eq('lunge strikes for a multiple of her auto', hp0 - g.enemy.hp, expected);
  eq('lunge also Provokes onto herself', duelist.taunt, LUNGE_TAUNT_TURNS);
  expectEvent('lunge emits taunt', cap, 'taunt', { slot: SLOT.LEFT, turns: LUNGE_TAUNT_TURNS });
}
{
  const g = abilityGame(['duelist', 'tank', 'mage'], ['flurry']);
  const duelist = g.members[SLOT.LEFT];
  const each = Math.max(1, g.memberDamage(duelist) - FLURRY_REDUCTION);
  const hp0 = g.enemy.hp;
  const cap = fire(g, 'flurry');
  eq('flurry lands its reduced strikes', hp0 - g.enemy.hp, each * FLURRY_HITS);
  expectEventCount('flurry emits one partyAttack per hit', cap, 'partyAttack', FLURRY_HITS);
}

// --- strongest / deadlift (Strongman) --------------------------------------
{
  const g = abilityGame(['flagellant', 'tank', 'mage'], ['strongest']);
  const str = g.members[SLOT.LEFT];
  const hp0 = str.hp;
  const cap = fire(g, 'strongest');
  eq('strongest costs him HP', str.hp, hp0 - STRONGEST_HP);
  for (const m of g.members) check(`strongest primes ${m.name}`, m.drumPrimed);
  expectLog('strongest logs the party priming', cap,
    `${str.name} shows the world his strength — every member's next strike lands doubled!`, 'status');
}
{ // UNCLAMPED like penance — with Last Stand spent it kills him, and the buff still lands
  const g = abilityGame(['flagellant', 'tank', 'mage'], ['strongest']);
  const str = g.members[SLOT.LEFT];
  str.lastStandUsed = true;
  str.hp = STRONGEST_HP;
  fire(g, 'strongest');
  check('strongest can kill the Strongman', !str.alive);
  check('the surviving members are still primed', g.members[SLOT.CENTER].drumPrimed);
  check('a dead member is not primed', !str.drumPrimed);
}
{
  const g = abilityGame(['flagellant', 'tank', 'mage'], ['deadlift']);
  const str = g.members[SLOT.LEFT], mage = g.members[SLOT.RIGHT];
  const cap = fire(g, 'deadlift', SLOT.RIGHT);
  eq('deadlift lifts the chosen ally clear', mage.untargetable, DEADLIFT_TURNS);
  expectLog('deadlift names the lifted ally', cap,
    `${str.name} hoists ${mage.name} clear — out of reach next turn.`, 'status');
}
{ // self-targeted prose
  const g = abilityGame(['flagellant', 'tank', 'mage'], ['deadlift']);
  const str = g.members[SLOT.LEFT];
  const cap = fire(g, 'deadlift', SLOT.LEFT);
  expectLog('deadlift uses reflexive prose when self-targeted', cap,
    `${str.name} hoists himself clear — out of reach next turn.`, 'status');
}

finish('content/abilities');
