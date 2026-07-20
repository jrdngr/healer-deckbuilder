// Characterization tests for the 11 hero passives (#99 A8).
//
// These are hardcoded `m.id === '...'` branches scattered through core.ts — hero
// content living as engine code. #103 moves 8 of them onto the same hook bus as the
// relics, so each needs its trigger, its magnitude, and its NON-firing case pinned.
//
// Three more damage branches key off `m.ability` rather than `m.id`
// (core.ts:515-528). That distinction is deliberate and load-bearing: a hero who
// LEARNS one of those abilities must not inherit the passive. Asserted below.
import { Game } from '../../src/engine';
import type { MemberId, PartyMemberConfig } from '../../src/constants';
import {
  SLOT, defaultBattleConfig, partyFromMembers,
  TOXICOLOGIST_BONUS, GRUDGE_DIVISOR, HOLD_LINE_BANK_MULT,
  DARK_BARGAIN_DMG, DARK_BARGAIN_POWER, FERAL_BOND_MULT,
  BERSERKER_BAND_BONUS, SKALD_DMG_PER_CARD, SKALD_DMG_CAP,
  BOAR_STRIKE_BONUS, BOAR_HP, CHARGE_MAX,
} from '../../src/constants';
import { giveCard } from '../factories';
import { check, eq, finish, capture, expectEvent, expectLog } from '../harness';

const seat = (id: MemberId | null): PartyMemberConfig =>
  id ? partyFromMembers([id])[0]
    : { maxHP: 1, hp: 1, damage: 0, abilityPower: 0, injuries: 0, upgrades: 0, empty: true };

function passiveGame(party: (MemberId | null)[], seed = 4): Game {
  const cfg = defaultBattleConfig();
  const padded: (MemberId | null)[] = [...party];
  while (padded.length < 3) padded.push(null);
  cfg.party = padded.map(seat);
  const g = new Game(seed, cfg);
  g.start();
  // start() runs _openingStrike, which can already have banked Grudge on the Tank and
  // dented the party. Reset to a clean board so each passive is measured from zero.
  for (const m of g.members) if (m.alive) { m.hp = m.maxHP; m.bankedDamage = 0; }
  g.mp = 20;
  g.enemy.hp = 400;
  return g;
}
// Force the standing telegraph onto one slot for a deterministic hit.
function aimAt(g: Game, slot: number, damage: number): void {
  const t = g.telegraph;
  if (!t) throw new Error('no telegraph');
  // type 'single' pins the intent label the hit logs ("Attack"), which otherwise
  // varies with whatever geometry the rotation happened to roll.
  Object.assign(t, {
    cast: undefined, hidden: false, ignoreTaunt: true, type: 'single',
    name: undefined, channel: undefined, targets: [slot], damage,
  });
}
const lethalPoison = (g: Game, slot: number) => {
  const m = g.members[slot];
  m.poison = m.maxHP + 99; m.poisonTurns = 3;
};

// --- Toxicologist (Ranger, core.ts:539) ------------------------------------
{
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const ranger = g.members[SLOT.LEFT];
  const bare = g.memberDamage(ranger);
  g.enemy.poison = 3; g.enemy.poisonTurns = 2;
  eq('Toxicologist rewards attacking a poisoned enemy',
    g.memberDamage(ranger) - bare, TOXICOLOGIST_BONUS);
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  eq('Toxicologist is inert against an unpoisoned enemy', g.memberDamage(ranger), bare);
}
{ // it is keyed on the RANGER specifically, not on "anyone attacking a poisoned enemy"
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const mage = g.members[SLOT.RIGHT];
  const bare = g.memberDamage(mage);
  g.enemy.poison = 3; g.enemy.poisonTurns = 2;
  eq('Toxicologist does not extend to other members', g.memberDamage(mage), bare);
}

// --- Grudge (Tank: bank at core.ts:1877, read at :540, reset at :2455) -----
{
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const tank = g.members[SLOT.CENTER];
  eq('the Tank starts with nothing banked', tank.bankedDamage, 0);
  const bare = g.memberDamage(tank);
  aimAt(g, SLOT.CENTER, 6);
  g.endTurn();
  eq('the Tank banks the damage he soaks', tank.bankedDamage, 6);
  g.beginPlayerTurn();
  eq('the banked damage rides his next auto',
    g.memberDamage(tank) - bare, Math.floor(6 / GRUDGE_DIVISOR));
}
{ // Hold the Line doubles the banking
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const tank = g.members[SLOT.CENTER];
  tank.holdLineTurns = 2;
  aimAt(g, SLOT.CENTER, 5);
  g.endTurn();
  eq('Hold the Line banks double', tank.bankedDamage, 5 * HOLD_LINE_BANK_MULT);
}
{ // the bank is SPENT by the strike that carried it
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const tank = g.members[SLOT.CENTER];
  tank.bankedDamage = 8;
  g.endTurn(); // party phase strikes, then the enemy phase banks whatever it deals
  check('the Grudge bank is cleared by the strike that used it',
    tank.bankedDamage === 0 || tank.bankedDamage < 8);
}
{ // only the Tank banks
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const ranger = g.members[SLOT.LEFT];
  aimAt(g, SLOT.LEFT, 5);
  g.endTurn();
  eq('a non-Tank banks nothing', ranger.bankedDamage, 0);
}

// --- Last Stand (Strongman, core.ts:994) -----------------------------------
{
  const g = passiveGame(['flagellant', 'tank', 'mage']);
  const str = g.members[SLOT.LEFT];
  lethalPoison(g, SLOT.LEFT);
  const cap = capture(g, () => g.endTurn());
  check('Last Stand refuses the first killing blow', str.alive);
  eq('Last Stand leaves him on 1 HP', str.hp, 1);
  check('Last Stand is marked spent', str.lastStandUsed);
  expectLog('Last Stand announces itself', cap,
    `${str.name} makes his Last Stand — he clings to life at 1 HP!`, 'status');
}
{ // once per fight
  const g = passiveGame(['flagellant', 'tank', 'mage']);
  const str = g.members[SLOT.LEFT];
  str.lastStandUsed = true;
  lethalPoison(g, SLOT.LEFT);
  g.endTurn();
  check('a spent Last Stand does not save again', !str.alive);
}
{ // it is the Strongman's alone
  const g = passiveGame(['flagellant', 'tank', 'mage']);
  const tank = g.members[SLOT.CENTER];
  lethalPoison(g, SLOT.CENTER);
  g.endTurn();
  check('Last Stand does not protect other members', !tank.alive);
}

// --- Dark Bargain (Warlock, core.ts:1044) ----------------------------------
{
  const g = passiveGame(['warlock', 'tank', 'mage']);
  const wl = g.members[SLOT.LEFT], mage = g.members[SLOT.RIGHT];
  const dmg0 = wl.damage, pow0 = wl.abilityPower;
  lethalPoison(g, SLOT.RIGHT);
  const cap = capture(g, () => g.endTurn());
  check('the other member died', !mage.alive);
  eq('Dark Bargain grows the Warlock damage', wl.damage, dmg0 + DARK_BARGAIN_DMG);
  eq('Dark Bargain grows the Warlock power', wl.abilityPower, pow0 + DARK_BARGAIN_POWER);
  expectLog('Dark Bargain announces itself', cap,
    `${wl.name} feeds on ${mage.name}'s death — Dark Bargain (+${DARK_BARGAIN_DMG} damage, +${DARK_BARGAIN_POWER} power).`,
    'status');
}
{ // the Warlock's OWN death pays him nothing — there is no living Warlock left
  const g = passiveGame(['warlock', 'tank', 'mage']);
  const wl = g.members[SLOT.LEFT];
  const dmg0 = wl.damage;
  lethalPoison(g, SLOT.LEFT);
  g.endTurn();
  check('the Warlock died', !wl.alive);
  eq('a dead Warlock gains nothing from his own death', wl.damage, dmg0);
}
{ // no Warlock fielded, no bargain
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const mage = g.members[SLOT.RIGHT];
  lethalPoison(g, SLOT.RIGHT);
  const cap = capture(g, () => g.endTurn());
  check('the member died', !mage.alive);
  check('without a Warlock nothing feeds on the death',
    !cap.log.some((l) => l.text.includes('Dark Bargain')));
}

// --- Stunt Double (Showstopper, core.ts:1830) ------------------------------
{
  const g = passiveGame(['sentinel', 'tank', 'mage']);
  const sent = g.members[SLOT.LEFT], mage = g.members[SLOT.RIGHT];
  mage.hp = 2; // a 6-damage hit would kill him
  const sentHp = sent.hp;
  aimAt(g, SLOT.RIGHT, 6);
  const cap = capture(g, () => g.endTurn());
  check('the Showstopper intercepts a lethal blow', mage.alive);
  eq('the target is untouched', mage.hp, 2);
  check('the Showstopper took it instead', sent.hp < sentHp);
  expectLog('the intercept is logged', cap,
    `${sent.name} dives in front of ${mage.name}, taking the Attack!`, 'status');
}
{ // a NON-lethal blow is not intercepted — she only dives for kills
  const g = passiveGame(['sentinel', 'tank', 'mage']);
  const sent = g.members[SLOT.LEFT], mage = g.members[SLOT.RIGHT];
  mage.hp = mage.maxHP;
  const sentHp = sent.hp;
  aimAt(g, SLOT.RIGHT, 2);
  g.endTurn();
  eq('a survivable blow lands on its real target', mage.hp, mage.maxHP - 2);
  eq('the Showstopper is untouched', sent.hp, sentHp);
}
{ // a blow the target's Shield would eat is not lethal, so she does not dive
  const g = passiveGame(['sentinel', 'tank', 'mage']);
  const sent = g.members[SLOT.LEFT], mage = g.members[SLOT.RIGHT];
  mage.hp = 1; mage.shield = true; mage.shieldTurns = 3;
  const sentHp = sent.hp;
  aimAt(g, SLOT.RIGHT, 9);
  g.endTurn();
  check('the shielded member survives on their own', mage.alive);
  eq('the Showstopper does not dive for a blocked hit', sent.hp, sentHp);
}

// --- Riposte Master (Duelist, core.ts:1858) --------------------------------
{
  const g = passiveGame(['duelist', 'tank', 'mage']);
  const duelist = g.members[SLOT.LEFT];
  eq('the Duelist carries no Riposte timer', duelist.riposteTurns, 0);
  check('the Duelist has no Riposte flag either', !duelist.riposte);
  const hp0 = g.enemy.hp;
  aimAt(g, SLOT.LEFT, 3);
  const cap = capture(g, () => g.endTurn());
  // She counters with no card and no timer — the passive IS the stance.
  const counters = cap.events.filter((e) => e.kind === 'partyAttack');
  check('the Duelist counters an incoming hit', counters.length >= 2);
  check('the counter damaged the enemy', g.enemy.hp < hp0);
}
{ // nobody else counters without the stance
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const ranger = g.members[SLOT.LEFT];
  check('the Ranger has no standing Riposte', ranger.riposteTurns === 0 && !ranger.riposte);
  aimAt(g, SLOT.LEFT, 3);
  const cap = capture(g, () => g.endTurn());
  const counters = cap.events.filter((e) => e.kind === 'partyAttack');
  eq('a member without the stance counters nothing', counters.length, 3); // the party phase only
}

// --- Arcane Battery (Mage, core.ts:1974) -----------------------------------
{
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const mage = g.members[SLOT.RIGHT];
  const c0 = mage.charge;
  g.endTurn();
  g.beginPlayerTurn();
  eq('the Mage banks a Charge each turn', mage.charge, c0 + 1);
}
{ // capped
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const mage = g.members[SLOT.RIGHT];
  mage.charge = CHARGE_MAX;
  g.endTurn();
  g.beginPlayerTurn();
  eq('Charge is capped', mage.charge, CHARGE_MAX);
}
{ // only the Mage banks Charge
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const ranger = g.members[SLOT.LEFT];
  g.endTurn();
  g.beginPlayerTurn();
  eq('a non-Mage banks no Charge', ranger.charge, 0);
}
{ // a dead Mage banks nothing
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const mage = g.members[SLOT.RIGHT];
  lethalPoison(g, SLOT.RIGHT);
  g.endTurn();
  const c = mage.charge;
  g.beginPlayerTurn();
  eq('a dead Mage banks no Charge', mage.charge, c);
}

// --- Opening Act (Busker, core.ts:1978) ------------------------------------
{
  const withSkald = passiveGame(['skald', 'tank', 'mage']);
  const without = passiveGame(['ranger', 'tank', 'mage']);
  for (const g of [withSkald, without]) { g.endTurn(); g.beginPlayerTurn(); }
  eq('a fielded Busker draws one extra card each turn',
    withSkald.hand.length - without.hand.length, 1);
}
{ // a DEAD Busker draws nothing
  const g = passiveGame(['skald', 'tank', 'mage']);
  const skald = g.members[SLOT.LEFT];
  lethalPoison(g, SLOT.LEFT);
  g.endTurn();
  check('the Busker died', !skald.alive);
  const before = g.hand.length;
  g.beginPlayerTurn();
  const withBusker = passiveGame(['skald', 'tank', 'mage']);
  withBusker.endTurn();
  const liveBefore = withBusker.hand.length;
  withBusker.beginPlayerTurn();
  check('a dead Busker draws fewer than a living one',
    g.hand.length - before < withBusker.hand.length - liveBefore);
}

// --- Feral Bond (Beast Warden, core.ts:2447) -------------------------------
{
  const g = passiveGame(['beastWarden', 'tank', 'mage']);
  const bw = g.members[SLOT.LEFT];
  bw.boarHp = 1; bw.boarTurns = 3;
  aimAt(g, SLOT.LEFT, 9); // kills the Boar
  g.endTurn();
  check('the Boar fell', bw.boarHp <= 0);
  check('the Warden is primed to avenge it', bw.feralPrimed);
  g.beginPlayerTurn();
  const expected = g.memberDamage(bw) * FERAL_BOND_MULT;
  const cap = capture(g, () => g.endTurn());
  expectEvent('the avenging strike is multiplied', cap, 'partyAttack',
    { slot: SLOT.LEFT, amount: expected });
  check('Feral Bond is consumed by that swing', !bw.feralPrimed);
  expectLog('the avenging strike is logged', cap,
    `${bw.name} avenges her Boar — her strike tears for ${expected}!`, 'status');
}

// --- ability-keyed damage bands (core.ts:515-528) --------------------------
// These three key off m.ability, NOT m.id — so a hero who LEARNS the ability must
// not inherit the passive. That distinction survives into #103.
{
  const g = passiveGame(['berserker', 'tank', 'mage']);
  const zerk = g.members[SLOT.LEFT];
  const [b1, b2] = g.berserkerThresholds();
  zerk.hp = zerk.maxHP;
  const full = g.memberDamage(zerk);
  zerk.hp = b1;
  eq('the Berserker gains a band at the first threshold', g.memberDamage(zerk) - full, BERSERKER_BAND_BONUS);
  zerk.hp = b2;
  eq('and a second band at the lower one', g.memberDamage(zerk) - full, BERSERKER_BAND_BONUS * 2);
}
{
  const g = passiveGame(['skald', 'tank', 'mage']);
  const skald = g.members[SLOT.LEFT];
  eq('the Busker swings for nothing on an empty turn', g.memberDamage(skald), 0);
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('the Busker scales on cards played this phase',
    g.memberDamage(skald), SKALD_DMG_PER_CARD);
  g.cardsPlayedThisPhase = 99;
  eq('the Busker bonus is capped', g.memberDamage(skald), SKALD_DMG_CAP);
}
{
  const g = passiveGame(['beastWarden', 'tank', 'mage']);
  const bw = g.members[SLOT.LEFT];
  const bare = g.memberDamage(bw);
  bw.boarHp = BOAR_HP; bw.boarTurns = 3;
  eq('a standing Boar lends the Warden its strike', g.memberDamage(bw) - bare, BOAR_STRIKE_BONUS);
  bw.boarHp = 0;
  eq('a fallen Boar lends nothing', g.memberDamage(bw), bare);
}
{ // a hero who LEARNS an ability does not inherit its owner's passive
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const ranger = g.members[SLOT.LEFT];
  const bare = g.memberDamage(ranger);
  ranger.learned.push('bloodbath'); // a Berserker card, learned by the Ranger
  ranger.hp = 1; // deep in what WOULD be the Berserker's hottest band
  eq('a learned ability grants no damage band', g.memberDamage(ranger), bare);
  check('the passive is keyed on the signature ability', ranger.ability !== 'rampage');
}

finish('content/passives');
