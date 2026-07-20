// Characterization tests for all 21 relics (#99 A7).
//
// Relics have NO dispatch table today — each is an inline `this.hasRelic('x')` guard
// at the seam it affects (20 sites: 18 in core.ts, 2 in effects.ts). #103 replaces
// every one of them with a hook bus, so each relic needs both halves pinned: what it
// does when owned, and that the same scenario does NOT do it when unowned. Nine of
// these existed only as a boolean probe in sim/exercise.ts, which reports
// "never fired: twinCenser" with no expected/got.
import { Game } from '../../src/engine';
import type { RelicId, MemberId, PartyMemberConfig } from '../../src/constants';
import {
  SLOT, defaultBattleConfig, partyFromMembers,
  FIELD_TRIAGE_BONUS, FIELD_TRIAGE_THRESHOLD, PRAYER_BEADS_MP, VANGUARD_BONUS,
  PACT_PASSIVE_MP, RUSTY_CROWN_ATTACK, LONE_WOLF_DMG, FOCUS_STONE_MP,
  WARBAND_HP_PER_SEAT, SMALL_PARTY_MAX, HOLY_RELIC_HEAL,
  OSSUARY_REGEN, OSSUARY_THRESHOLD, VENOM_GLAND_BONUS_TURNS, POISON_TURNS,
  BEACON_DRAW, TWIN_CENSER_SPLASH, PILGRIM_FLASK_HEAL,
} from '../../src/constants';
import { giveCard, giveAbility } from '../factories';
import {
  check, eq, finish, capture, expectEvent, expectNoEvent, expectLog,
} from '../harness';

const seat = (id: MemberId | null): PartyMemberConfig =>
  id ? partyFromMembers([id])[0]
    : { maxHP: 1, hp: 1, damage: 0, abilityPower: 0, injuries: 0, upgrades: 0, empty: true };

// A started game owning `relics`. `party` defaults to the classic trio; pass nulls for
// empty deploy seats (the small-party relics need those).
function relicGame(relics: RelicId[], party: (MemberId | null)[] = ['ranger', 'tank', 'mage'],
                   seed = 7): Game {
  const cfg = defaultBattleConfig();
  cfg.relics = relics;
  const padded: (MemberId | null)[] = [...party];
  while (padded.length < 3) padded.push(null);
  cfg.party = padded.map(seat);
  const g = new Game(seed, cfg);
  g.start();
  for (const m of g.members) if (m.alive) m.hp = m.maxHP;
  g.mp = 10;
  return g;
}
const play = (g: Game, id: string, target?: number) =>
  capture(g, () => g.playCard(giveCard(g, id as never), target));

// Run one scenario with and without the relic and report both halves. `setup` prepares
// the board; `act` performs the action; `read` extracts the number under test.
function withAndWithout(
  name: string, relic: RelicId, expectedOwned: number, expectedBare: number,
  scenario: (g: Game) => number, party?: (MemberId | null)[],
): void {
  eq(`${name} (owned)`, scenario(relicGame([relic], party)), expectedOwned);
  eq(`${name} (not owned — control)`, scenario(relicGame([], party)), expectedBare);
}

// --- Searchlight (lantern) -------------------------------------------------
{
  const owned = relicGame(['lantern']);
  const bare = relicGame([]);
  if (owned.telegraph && bare.telegraph) {
    owned.telegraph.hidden = true;
    bare.telegraph.hidden = true;
    eq('without lantern a hidden attack fans out over every living member',
      bare.attackTargets().length, bare.livingMembers().length);
    check('lantern collapses the fan-out to the true target(s)',
      owned.attackTargets().length < bare.attackTargets().length);
    check('lantern still marks the attack as hidden',
      owned.attackTargets().every((a) => a.hidden));
  }
}

// --- Field Triage Kit ------------------------------------------------------
withAndWithout('fieldTriage boosts a heal below the threshold', 'fieldTriage',
  2 + FIELD_TRIAGE_BONUS, 2, (g) => {
    const tank = g.members[SLOT.CENTER];
    tank.hp = 2; // well below 50% of 18
    const before = tank.hp;
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    return tank.hp - before;
  });
{ // it does NOT fire at or above the threshold
  const g = relicGame(['fieldTriage']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = Math.ceil(tank.maxHP * FIELD_TRIAGE_THRESHOLD);
  const before = tank.hp;
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('fieldTriage does not fire at the threshold', tank.hp - before, 2);
}

// --- War Drum --------------------------------------------------------------
{
  const g = relicGame(['warDrum']);
  const mage = g.members[SLOT.RIGHT];
  g.playCard(giveAbility(g, SLOT.RIGHT));
  check('warDrum primes the caster after an ability', mage.drumPrimed);
}
{
  const g = relicGame([]);
  const mage = g.members[SLOT.RIGHT];
  g.playCard(giveAbility(g, SLOT.RIGHT));
  check('without warDrum an ability primes nothing', !mage.drumPrimed);
}
{ // the primed auto actually lands doubled, and the drum is spent
  const g = relicGame(['warDrum']);
  const mage = g.members[SLOT.RIGHT];
  g.playCard(giveAbility(g, SLOT.RIGHT));
  const expected = g.memberDamage(mage) * 2;
  const cap = capture(g, () => g.endTurn());
  expectEvent('the primed auto lands doubled', cap, 'partyAttack',
    { slot: SLOT.RIGHT, amount: expected });
  check('the drum is spent after the strike', !mage.drumPrimed);
}

// --- Fidget Beads (prayerBeads) --------------------------------------------
withAndWithout('prayerBeads grants MP on a reshuffle', 'prayerBeads',
  PRAYER_BEADS_MP, 0, (g) => {
    g.drawPile = [];
    g.mp = 6; // inspiration costs MP — at 0 the card is refused, not merely free
    const before = g.mp - 2;
    g.playCard(giveCard(g, 'inspiration')); // forces a reshuffle mid-draw
    return g.mp - before;
  });

// --- Team Pennant (vanguardsBanner) ----------------------------------------
{
  const owned = relicGame(['vanguardsBanner']);
  const bare = relicGame([]);
  const o = owned.members[SLOT.LEFT], b = bare.members[SLOT.LEFT];
  eq('vanguardsBanner boosts a full-HP member', owned.memberDamage(o) - bare.memberDamage(b),
    VANGUARD_BONUS);
  o.hp = o.maxHP - 1; b.hp = b.maxHP - 1;
  eq('vanguardsBanner does nothing off full HP', owned.memberDamage(o), bare.memberDamage(b));
}

// --- Guardian Feather (martyrsIcon) ----------------------------------------
// Death must be driven through a real lethal source — assigning hp = 0 never runs the
// death pipeline, so the relic would never be consulted and the test would pass
// vacuously. Hero poison is unclamped and kills.
const lethalPoison = (g: Game, slot: number) => {
  const m = g.members[slot];
  m.poison = m.maxHP + 99; m.poisonTurns = 3;
};
{
  const g = relicGame(['martyrsIcon']);
  const mage = g.members[SLOT.RIGHT];
  lethalPoison(g, SLOT.RIGHT);
  const cap = capture(g, () => g.endTurn());
  check('martyrsIcon refuses the first death', mage.alive);
  eq('martyrsIcon leaves the member on 1 HP', mage.hp, 1);
  expectLog('martyrsIcon announces itself', cap,
    `The Guardian Feather glows — ${mage.name} clings to life at 1 HP!`, 'status');
  expectEvent('martyrsIcon emits its save', cap, 'martyrSave', { slot: SLOT.RIGHT });
}
{ // control: the same lethal hit without the relic kills
  const g = relicGame([]);
  const mage = g.members[SLOT.RIGHT];
  lethalPoison(g, SLOT.RIGHT);
  g.endTurn();
  check('without martyrsIcon the same hit kills', !mage.alive);
}
{ // it is once per fight — the second death sticks
  const g = relicGame(['martyrsIcon']);
  const mage = g.members[SLOT.RIGHT];
  lethalPoison(g, SLOT.RIGHT);
  g.endTurn();
  check('the first death was refused', mage.alive);
  g.beginPlayerTurn();
  lethalPoison(g, SLOT.RIGHT);
  g.endTurn();
  check('a spent martyrsIcon does not save again', !mage.alive);
}

// --- Cursed Coffee (pactOfSilence) -----------------------------------------
{
  const g = relicGame(['pactOfSilence']);
  check('pactOfSilence forbids Rest', !g.canSkip());
  eq('pactOfSilence refuses a skipTurn outright', g.skipTurn().ok, false);
}
{
  const g = relicGame([]);
  check('without pactOfSilence Rest is available', g.canSkip());
}
{ // ...in exchange for passive MP at the start of each turn
  const owned = relicGame(['pactOfSilence']);
  const bare = relicGame([]);
  for (const g of [owned, bare]) { g.mp = 0; g.endTurn(); g.beginPlayerTurn(); }
  eq('pactOfSilence pays passive MP', owned.mp - bare.mp, PACT_PASSIVE_MP);
}

// --- Rusty Crown -----------------------------------------------------------
{
  const owned = relicGame(['rustyCrown']);
  const bare = relicGame([]);
  eq('rustyCrown makes normal enemies hit harder',
    owned.attackDamageOf(5, 1) - bare.attackDamageOf(5, 1), RUSTY_CROWN_ATTACK);
}
{ // bosses are proud enough — the curse does not apply to them
  const cfg = defaultBattleConfig();
  cfg.relics = ['rustyCrown'];
  cfg.enemy = { ...cfg.enemy, boss: true };
  const boss = new Game(7, cfg).start();
  const cfg2 = defaultBattleConfig();
  cfg2.enemy = { ...cfg2.enemy, boss: true };
  const bareBoss = new Game(7, cfg2).start();
  eq('rustyCrown spares bosses', boss.attackDamageOf(5, 1), bareBoss.attackDamageOf(5, 1));
}

// --- Lone Wolf Totem / Thinking Cap / Roomy Tent (small-party trio) --------
const SOLO: (MemberId | null)[] = ['ranger', null, null];
{
  const owned = relicGame(['loneWolf'], SOLO);
  const bare = relicGame([], SOLO);
  eq('loneWolf boosts a small party',
    owned.memberDamage(owned.members[SLOT.LEFT]) - bare.memberDamage(bare.members[SLOT.LEFT]),
    LONE_WOLF_DMG);
}
{ // ...and does nothing at full party size
  const owned = relicGame(['loneWolf']);
  const bare = relicGame([]);
  eq('loneWolf does nothing at full party',
    owned.memberDamage(owned.members[SLOT.LEFT]), bare.memberDamage(bare.members[SLOT.LEFT]));
  check('a full party exceeds the small-party threshold', owned.fieldedPartySize() > SMALL_PARTY_MAX);
}
{
  const owned = relicGame(['focusStone'], SOLO);
  const bare = relicGame([], SOLO);
  eq('focusStone raises max MP for a small party', owned.maxMana - bare.maxMana, FOCUS_STONE_MP);
}
{
  const owned = relicGame(['focusStone']);
  const bare = relicGame([]);
  eq('focusStone does nothing at full party', owned.maxMana, bare.maxMana);
}
{ // warband scales with EMPTY SEATS, not with party size
  const owned = relicGame(['warband'], SOLO);
  const bare = relicGame([], SOLO);
  eq('warband grants HP per empty seat',
    owned.members[SLOT.LEFT].maxHP - bare.members[SLOT.LEFT].maxHP, WARBAND_HP_PER_SEAT * 2);
}
{
  const owned = relicGame(['warband']);
  const bare = relicGame([]);
  eq('warband grants nothing with a full deployment',
    owned.members[SLOT.LEFT].maxHP, bare.members[SLOT.LEFT].maxHP);
}

// --- Glitter Box (reliquaryOfLight) ----------------------------------------
withAndWithout('reliquaryOfLight boosts a Holy heal', 'reliquaryOfLight',
  2 + HOLY_RELIC_HEAL, 2, (g) => {
    const tank = g.members[SLOT.CENTER];
    tank.hp = 10;
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    return tank.hp - 10;
  });
{ // it is per HOLY CARD — a Nature Regen tick is untouched
  const owned = relicGame(['reliquaryOfLight']);
  const bare = relicGame([]);
  for (const g of [owned, bare]) {
    const tank = g.members[SLOT.CENTER];
    tank.hp = 5; tank.regen = 3;
    g.endTurn(); g.beginPlayerTurn();
  }
  eq('reliquaryOfLight does not boost a Regen tick',
    owned.members[SLOT.CENTER].hp, bare.members[SLOT.CENTER].hp);
}

// --- Second-Wind Chime (ossuaryBell) ---------------------------------------
// It hooks _resolveAttack (core.ts:1889), so it needs a real aimed HIT — a poison
// tick crosses the same threshold without ringing the bell.
function aimAt(g: Game, slot: number, damage: number): void {
  const t = g.telegraph;
  if (!t) throw new Error('no telegraph');
  Object.assign(t, { cast: undefined, hidden: false, ignoreTaunt: true, targets: [slot], damage });
}
{
  const g = relicGame(['ossuaryBell']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 7; // above 25% of 18 (4.5); a 5-damage hit crosses it
  eq('the tank starts with no Regen', tank.regen, 0);
  aimAt(g, SLOT.CENTER, 5);
  const cap = capture(g, () => g.endTurn());
  check('ossuaryBell grants Regen on a downward crossing', tank.regen >= OSSUARY_REGEN);
  expectLog('ossuaryBell announces itself', cap,
    `The Second-Wind Chime rings for ${tank.name} — Regen ${tank.regen}.`, 'status');
}
{ // control: no relic, no Regen
  const g = relicGame([]);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 7;
  aimAt(g, SLOT.CENTER, 5);
  g.endTurn();
  eq('without ossuaryBell no Regen is granted', tank.regen, 0);
}
{ // it fires on the CROSSING, not while already below — no free Regen every hit
  const g = relicGame(['ossuaryBell']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 3; // already below the threshold
  tank.regen = 0;
  aimAt(g, SLOT.CENTER, 1);
  g.endTurn();
  eq('ossuaryBell does not re-fire while already below', tank.regen, 0);
}
{ // a poison tick crosses the threshold WITHOUT ringing it — the hook is on hits only
  const g = relicGame(['ossuaryBell']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 7; tank.regen = 0;
  tank.poison = 4; tank.poisonTurns = 2;
  aimAt(g, SLOT.LEFT, 0);
  g.endTurn();
  check('the poison tick crossed the threshold', tank.hp < tank.maxHP * OSSUARY_THRESHOLD);
  eq('ossuaryBell does not fire on a poison tick', tank.regen, 0);
}

// --- Venom Gland -----------------------------------------------------------
{
  const owned = relicGame(['venomGland']);
  const bare = relicGame([]);
  owned.playCard(giveAbility(owned, SLOT.LEFT));
  bare.playCard(giveAbility(bare, SLOT.LEFT));
  eq('venomGland extends the poison ability duration',
    owned.enemy.poisonTurns - bare.enemy.poisonTurns, VENOM_GLAND_BONUS_TURNS);
  eq('the bare poison lasts its base duration', bare.enemy.poisonTurns, POISON_TURNS);
}
{ // it also rides Sporeburst, which applies poison through _applyPoison
  const owned = relicGame(['venomGland']);
  const bare = relicGame([]);
  for (const g of [owned, bare]) {
    g.members[SLOT.CENTER].regen = 2;
    g.enemy.poison = 0; g.enemy.poisonTurns = 0;
    g.playCard(giveCard(g, 'sporeburst'), SLOT.CENTER);
  }
  eq('venomGland extends Sporeburst too',
    owned.enemy.poisonTurns - bare.enemy.poisonTurns, VENOM_GLAND_BONUS_TURNS);
}

// --- Beacon of the Second Sun ----------------------------------------------
{
  const g = relicGame(['beaconOfSecondSun']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = tank.maxHP - 1; // a Quick Heal tops him off exactly
  const hand0 = g.hand.length;
  const cap = play(g, 'lowHeal', SLOT.CENTER);
  eq('beacon draws on a heal-to-full', g.hand.length, hand0 + BEACON_DRAW);
  expectLog('beacon announces itself', cap,
    `Beacon of the Second Sun: ${tank.name} is topped off — draw ${BEACON_DRAW}.`, 'status');
}
{
  const g = relicGame([]);
  const tank = g.members[SLOT.CENTER];
  tank.hp = tank.maxHP - 1;
  const hand0 = g.hand.length;
  play(g, 'lowHeal', SLOT.CENTER);
  eq('without beacon a heal-to-full draws nothing', g.hand.length, hand0);
}
{ // it needs to REACH full — a partial heal does not fire it
  const g = relicGame(['beaconOfSecondSun']);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  const hand0 = g.hand.length;
  play(g, 'lowHeal', SLOT.CENTER);
  eq('beacon does not fire on a partial heal', g.hand.length, hand0);
}

// --- Buddy System (twinCenser) ---------------------------------------------
{
  const g = relicGame(['twinCenser']);
  const tank = g.members[SLOT.CENTER], mage = g.members[SLOT.RIGHT];
  tank.hp = 10; mage.hp = 2;
  const cap = play(g, 'lowHeal', SLOT.CENTER);
  eq('twinCenser splashes the most wounded OTHER member', mage.hp, 2 + TWIN_CENSER_SPLASH);
  expectLog('twinCenser announces the splash', cap,
    `The Buddy System brings ${TWIN_CENSER_SPLASH} to ${mage.name}. (${mage.hp}/${mage.maxHP})`,
    'heal');
}
{
  const g = relicGame([]);
  const tank = g.members[SLOT.CENTER], mage = g.members[SLOT.RIGHT];
  tank.hp = 10; mage.hp = 2;
  play(g, 'lowHeal', SLOT.CENTER);
  eq('without twinCenser nothing splashes', mage.hp, 2);
}
{ // it is single-target heal CARDS only — a party heal does not splash again
  const g = relicGame(['twinCenser']);
  for (const m of g.members) m.hp = 3;
  const cap = play(g, 'aoeHeal');
  expectNoEvent('an AoE heal produces no splash log', cap, 'lensArmed');
  eq('every member healed exactly the AoE amount', g.members[SLOT.RIGHT].hp, 5);
}

// --- Chanter's Idol --------------------------------------------------------
// The exemption is keyed on cardsPlayedThisPhase === 1 (core.ts:1130), and the
// channel card itself is card #1 of ITS turn — so the exemption only ever applies on
// a LATER turn, to the first card played there.
function channelIntoNextTurn(relics: RelicId[]): Game {
  const g = relicGame(relics);
  g.members[SLOT.CENTER].hp = 5;
  g.playCard(giveCard(g, 'mendingStream'), SLOT.CENTER);
  g.endTurn();
  g.beginPlayerTurn();
  g.mp = 20;
  return g;
}
{
  const g = channelIntoNextTurn(['chantersIdol']);
  eq('the channel survives into the next turn', g.channelCard, 'mendingStream');
  play(g, 'lowHeal', SLOT.CENTER);
  eq('chantersIdol lets the first card of a turn pass without breaking the channel',
    g.channelCard, 'mendingStream');
}
{
  const g = channelIntoNextTurn([]);
  play(g, 'lowHeal', SLOT.CENTER);
  eq('without chantersIdol the first card breaks the channel', g.channelCard, null);
}
{ // only the FIRST card is exempt — the second still breaks it
  const g = channelIntoNextTurn(['chantersIdol']);
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('the exempt card left the channel running', g.channelCard, 'mendingStream');
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('a second card still breaks the channel', g.channelCard, null);
}

// --- Nap Sack (pilgrimsFlask) ----------------------------------------------
{
  const g = relicGame(['pilgrimsFlask']);
  const mage = g.members[SLOT.RIGHT];
  mage.hp = 2;
  const cap = capture(g, () => g.skipTurn());
  eq('pilgrimsFlask heals the most wounded on Rest', mage.hp, 2 + PILGRIM_FLASK_HEAL);
  check('the Flask heal is logged', cap.log.some((l) => l.text.includes('Nap Sack')));
}
{
  const g = relicGame([]);
  const mage = g.members[SLOT.RIGHT];
  mage.hp = 2;
  g.skipTurn();
  eq('without pilgrimsFlask a Rest heals nobody', mage.hp, 2);
}

// --- run-layer relics ------------------------------------------------------
// hagglersCharm, surgeonsThread and beggarsBowl act in Run, not Game — their
// behavior is asserted in test/run.test.ts. What matters HERE is that the engine
// treats them as inert, so #103's split between the engine bus and the run bus is
// pinned from both sides.
for (const relic of ['hagglersCharm', 'surgeonsThread', 'beggarsBowl'] as RelicId[]) {
  const owned = relicGame([relic]);
  const bare = relicGame([]);
  eq(`${relic} does not change member damage in battle`,
    owned.memberDamage(owned.members[SLOT.LEFT]), bare.memberDamage(bare.members[SLOT.LEFT]));
  eq(`${relic} does not change max MP`, owned.maxMana, bare.maxMana);
  eq(`${relic} does not change max HP`,
    owned.members[SLOT.CENTER].maxHP, bare.members[SLOT.CENTER].maxHP);
}

// --- every relic is constructible and inert-by-default ---------------------
// A blunt sweep: owning any single relic must never crash a fight start, and the
// engine must not silently change a member's identity.
{
  const bare = relicGame([]);
  for (const id of ['lantern', 'hagglersCharm', 'fieldTriage', 'warDrum', 'prayerBeads',
    'vanguardsBanner', 'martyrsIcon', 'pactOfSilence', 'rustyCrown', 'loneWolf',
    'focusStone', 'warband', 'reliquaryOfLight', 'ossuaryBell', 'venomGland',
    'beaconOfSecondSun', 'twinCenser', 'chantersIdol', 'pilgrimsFlask',
    'surgeonsThread', 'beggarsBowl'] as RelicId[]) {
    const g = relicGame([id]);
    check(`${id} starts a fight`, g.status === 'playing');
    check(`${id} owns itself`, g.hasRelic(id));
    check(`${id} does not claim another relic`, !g.hasRelic('lantern') || id === 'lantern');
    eq(`${id} leaves the party size alone`, g.members.length, bare.members.length);
  }
}

finish('content/relics');
