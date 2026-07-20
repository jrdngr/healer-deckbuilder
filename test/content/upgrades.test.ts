// Characterization tests for the 3 card modifiers and the 9 stat upgrades (#99 A11).
//
// The modifiers were already well covered at the resolveCard DATA layer — but only
// four card ids verified that the resolved value actually reaches the EFFECT BODY.
// That gap is the dangerous one for #101: the DSL reads upgraded fields via
// {card: "heal"}, and a schema that inlines the tuning constant instead would keep
// every resolveCard test green while silently deleting card upgrades in play.
//
// The party/healer upgrades were covered by a generic "some stat changed" check
// (run.test.ts:885); here each of the 9 is asserted per id.
import { Game } from '../../src/engine';
import { Run } from '../../src/run';
import type { Slot, CardId, ModifierId } from '../../src/constants';
import {
  SLOT, MODIFIERS, MODIFIER_IDS, PARTY_UPGRADES, HEALER_UPGRADES,
  MOD_EFFICIENT_COST, MOD_POTENT_STRENGTH, MOD_LINGERING_TURNS,
  MAX_UPGRADE_SLOTS, PASSIVE_MP_CAP, CARDS, resolveCard, makeDeckCard,
  REFRESH_TURNS,
} from '../../src/constants';
import { giveCard } from '../factories';
import { check, eq, finish, capture, expectLog } from '../harness';

function fresh(seed = 11): Game {
  const g = new Game(seed);
  g.start();
  for (const m of g.members) if (m.alive) m.hp = m.maxHP;
  g.mp = 20;
  return g;
}
const playUp = (g: Game, id: CardId, ups: ModifierId[], target?: number) =>
  capture(g, () => g.playCard(giveCard(g, id, ups), target));

// --- the modifier table ----------------------------------------------------
{
  eq('there are three modifiers', MODIFIER_IDS.length, 3);
  for (const id of MODIFIER_IDS) {
    const def = MODIFIERS[id];
    check(`${id} exists in the table`, def != null);
    eq(`${id} matches its key`, def.id, id);
    check(`${id} has a name`, def.name.length > 0);
    check(`${id} has a description`, def.desc.length > 0);
    check(`${id} declares an eligibility predicate`, typeof def.eligible === 'function');
  }
}

// --- eligibility: the three predicates, over the whole card table ----------
{ // Potent needs a strength field and must not be blocked by noPotent
  for (const id of Object.keys(CARDS) as CardId[]) {
    const c = CARDS[id];
    const expected = !c.noPotent && (c.heal != null || c.regen != null || c.refresh != null);
    eq(`potent eligibility for ${id}`, MODIFIERS.potent.eligible(id), expected);
  }
}
{ // Lingering needs a duration field
  for (const id of Object.keys(CARDS) as CardId[]) {
    const c = CARDS[id];
    eq(`lingering eligibility for ${id}`,
      MODIFIERS.lingering.eligible(id), c.regen != null || c.refresh != null);
  }
}
{ // Efficient refuses 0-cost cards and draw engines
  for (const id of Object.keys(CARDS) as CardId[]) {
    const c = CARDS[id];
    eq(`efficient eligibility for ${id}`,
      MODIFIERS.efficient.eligible(id), c.cost > 0 && c.draw == null);
  }
}
{ // spot-checks that name the reason, so a predicate change reads as intent
  check('potent refuses Shield (no strength field)', !MODIFIERS.potent.eligible('shield'));
  check('potent accepts Quick Heal', MODIFIERS.potent.eligible('lowHeal'));
  check('lingering refuses Quick Heal (no duration)', !MODIFIERS.lingering.eligible('lowHeal'));
  check('lingering accepts Regen', MODIFIERS.lingering.eligible('regen'));
  check('efficient refuses Inspiration (a draw engine)', !MODIFIERS.efficient.eligible('inspiration'));
  check('efficient refuses Paper Cuts (0 cost)', !MODIFIERS.efficient.eligible('crimsonPact'));
  check('efficient accepts Heal', MODIFIERS.efficient.eligible('highHeal'));
}

// --- resolveCard: the data layer ------------------------------------------
{
  const base = resolveCard(makeDeckCard('lowHeal', -1, []));
  const potent = resolveCard(makeDeckCard('lowHeal', -2, ['potent']));
  eq('potent raises the heal amount', potent.heal, (base.heal ?? 0) + MOD_POTENT_STRENGTH);
  eq('potent leaves the cost alone', potent.cost, base.cost);
}
{
  const base = resolveCard(makeDeckCard('highHeal', -3, []));
  const eff = resolveCard(makeDeckCard('highHeal', -4, ['efficient']));
  eq('efficient lowers the cost', eff.cost, base.cost - MOD_EFFICIENT_COST);
}
{ // the cost floor: two Efficients cannot drive a card below 1
  const twice = resolveCard(makeDeckCard('lowHeal', -5, ['efficient', 'efficient']));
  check('cost never falls below 1', twice.cost >= 1);
}
{
  const base = resolveCard(makeDeckCard('fontOfMana', -6, []));
  const ling = resolveCard(makeDeckCard('fontOfMana', -7, ['lingering']));
  eq('lingering extends Refresh duration',
    ling.refreshTurns, (base.refreshTurns ?? REFRESH_TURNS) + MOD_LINGERING_TURNS);
}
{ // both slots stack
  const two = resolveCard(makeDeckCard('regen', -8, ['potent', 'potent']));
  const one = resolveCard(makeDeckCard('regen', -9, ['potent']));
  const none = resolveCard(makeDeckCard('regen', -10, []));
  eq('one Potent adds one', one.regen, (none.regen ?? 0) + MOD_POTENT_STRENGTH);
  eq('two Potents add two', two.regen, (none.regen ?? 0) + MOD_POTENT_STRENGTH * 2);
  eq('a card holds at most two upgrades', MAX_UPGRADE_SLOTS, 2);
}

// --- the gap that matters: upgrades reaching the EFFECT BODY ---------------
// Each of these plays the real card and reads the resulting board, so an
// implementation that resolves the upgrade but does not USE it fails here.
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  const cap = playUp(g, 'lowHeal', ['potent'], SLOT.CENTER);
  eq('a Potent Quick Heal heals more IN PLAY', tank.hp, 5 + 2 + MOD_POTENT_STRENGTH);
  expectLog('and the log reports the upgraded amount', cap,
    `Quick Heal: ${tank.name} heals ${2 + MOD_POTENT_STRENGTH}. (${tank.hp}/${tank.maxHP})`, 'heal');
}
{
  const g = fresh();
  for (const m of g.members) m.hp = 3;
  playUp(g, 'aoeHeal', ['potent']);
  eq('a Potent Group Heal heals more IN PLAY', g.members[SLOT.CENTER].hp, 3 + 2 + MOD_POTENT_STRENGTH);
}
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  const cap = playUp(g, 'regen', ['potent'], SLOT.CENTER);
  eq('a Potent Regen applies a deeper stack IN PLAY', tank.regen, 2 + MOD_POTENT_STRENGTH);
  expectLog('and the log reports the upgraded stack', cap,
    `Regen on ${tank.name} (Regen ${2 + MOD_POTENT_STRENGTH}, decays each turn).`, 'status');
}
{ // ...and the deeper Regen actually ticks for more, turn over turn
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  g.playCard(giveCard(g, 'regen', ['potent']), SLOT.CENTER);
  g.endTurn();
  const cap = capture(g, () => g.beginPlayerTurn());
  expectLog('a Potent Regen ticks for its upgraded value', cap,
    `${tank.name} regenerates ${2 + MOD_POTENT_STRENGTH} (Regen ${2 + MOD_POTENT_STRENGTH}).`, 'heal');
}
{
  const g = fresh();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  playUp(g, 'lifebloom', ['potent'], SLOT.CENTER);
  eq('a Potent Lifebloom applies a deeper stack IN PLAY', tank.regen, 2 + MOD_POTENT_STRENGTH);
}
{
  const g = fresh();
  playUp(g, 'fontOfMana', ['potent']);
  eq('a Potent Refresh primes a bigger per-turn restore IN PLAY', g.refresh, 3 + MOD_POTENT_STRENGTH);
}
{
  const g = fresh();
  playUp(g, 'fontOfMana', ['lingering']);
  eq('a Lingering Refresh primes a longer duration IN PLAY',
    g.refreshTurns, REFRESH_TURNS + MOD_LINGERING_TURNS);
}
{ // Efficient must actually cost less MP at the point of payment
  const g = fresh();
  g.mp = 10;
  g.playCard(giveCard(g, 'highHeal', ['efficient']), SLOT.CENTER);
  eq('an Efficient card charges the reduced cost IN PLAY',
    g.mp, 10 - (CARDS.highHeal.cost - MOD_EFFICIENT_COST));
}
{ // an Efficient card is playable at MP the base card could not afford
  const g = fresh();
  g.mp = CARDS.highHeal.cost - MOD_EFFICIENT_COST;
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  g.playCard(giveCard(g, 'highHeal', ['efficient']), SLOT.CENTER);
  check('the discounted card resolved', tank.hp > 5);

  const g2 = fresh();
  g2.mp = CARDS.highHeal.cost - MOD_EFFICIENT_COST;
  const t2 = g2.members[SLOT.CENTER];
  t2.hp = 5;
  g2.playCard(giveCard(g2, 'highHeal', []), SLOT.CENTER);
  eq('the undiscounted card at the same MP is refused', t2.hp, 5);
}
{ // stacked upgrades reach the body together
  const g = fresh();
  g.mp = 20;
  const tank = g.members[SLOT.CENTER];
  tank.hp = 2;
  g.playCard(giveCard(g, 'highHeal', ['potent', 'potent']), SLOT.CENTER);
  eq('two Potents both reach the effect body', tank.hp, 2 + 4 + MOD_POTENT_STRENGTH * 2);
}

// --- applyModifier gating on a real Run ------------------------------------
{
  const r = new Run(3);
  const card = r.deck.find((c) => MODIFIERS.potent.eligible(c.id))!;
  check('a Potent-eligible card exists in the starting deck', card != null);
  check('applying an eligible modifier succeeds', r.applyModifier(card.uid, 'potent'));
  check('the card carries it', card.upgrades.includes('potent'));
}
{
  const r = new Run(3);
  const shield = r.deck.find((c) => c.id === 'shield');
  if (shield) {
    check('applying an ineligible modifier is refused', !r.applyModifier(shield.uid, 'potent'));
    eq('the refused card is unchanged', shield.upgrades.length, 0);
  }
}
{ // slots are capped
  const r = new Run(3);
  const card = r.deck.find((c) => MODIFIERS.potent.eligible(c.id))!;
  let applied = 0;
  for (let i = 0; i < 5; i++) if (r.applyModifier(card.uid, 'potent')) applied += 1;
  check('a card cannot exceed its upgrade slots', card.upgrades.length <= MAX_UPGRADE_SLOTS);
  eq('only the available slots were filled', applied, card.upgrades.length);
}
{ // an unknown card is refused
  const r = new Run(3);
  check('applying to an unknown card is refused', !r.applyModifier(-999, 'potent'));
}

// --- party upgrades, per id ------------------------------------------------
{
  eq('there are five party upgrades', PARTY_UPGRADES.length, 5);
  eq('party upgrade ids are unique', new Set(PARTY_UPGRADES.map((u) => u.id)).size, 5);
  for (const def of PARTY_UPGRADES) {
    const r = new Run(2);
    const before = { ...r.party[1] };
    r.applyPartyUpgrade(1 as Slot, def);
    const p = r.party[1];
    if (def.stat === 'maxHP') {
      eq(`${def.id} raises max HP by ${def.amount}`, p.maxHP, before.maxHP + def.amount);
      eq(`${def.id} leaves damage alone`, p.damage, before.damage);
    } else if (def.stat === 'damage') {
      eq(`${def.id} raises damage by ${def.amount}`, p.damage, before.damage + def.amount);
      eq(`${def.id} leaves max HP alone`, p.maxHP, before.maxHP);
    } else {
      eq(`${def.id} raises ability power by ${def.amount}`,
        p.abilityPower, before.abilityPower + def.amount);
      eq(`${def.id} leaves damage alone`, p.damage, before.damage);
    }
    eq(`${def.id} counts toward salary`, p.upgrades ?? 0, (before.upgrades ?? 0) + 1);
    check(`${def.id} has a name and description`, def.name.length > 0 && def.desc.length > 0);
  }
}
{ // an out-of-range slot is a no-op, not a crash
  const r = new Run(2);
  const snapshot = JSON.stringify(r.party);
  r.applyPartyUpgrade(9 as Slot, PARTY_UPGRADES[0]);
  eq('an out-of-range upgrade changes nothing', JSON.stringify(r.party), snapshot);
}
{ // upgrades stack
  const r = new Run(2);
  const dmg = PARTY_UPGRADES.find((u) => u.id === 'dmg1')!;
  const before = r.party[0].damage;
  r.applyPartyUpgrade(0 as Slot, dmg);
  r.applyPartyUpgrade(0 as Slot, dmg);
  eq('party upgrades stack', r.party[0].damage, before + dmg.amount * 2);
  eq('each stack counts toward salary', r.party[0].upgrades ?? 0, 2);
}

// --- healer upgrades, per id -----------------------------------------------
{
  eq('there are four healer upgrades', HEALER_UPGRADES.length, 4);
  eq('healer upgrade ids are unique', new Set(HEALER_UPGRADES.map((u) => u.id)).size, 4);
  for (const def of HEALER_UPGRADES) {
    const r = new Run(2);
    const before = { ...r.healer };
    r.applyHealerUpgrade(def);
    const h = r.healer;
    if (def.stat === 'passiveMp') {
      eq(`${def.id} raises passive MP`, h.passiveMp,
        Math.min(PASSIVE_MP_CAP, before.passiveMp + def.amount));
    } else {
      eq(`${def.id} raises ${def.stat} by ${def.amount}`,
        h[def.stat], before[def.stat] + def.amount);
    }
    check(`${def.id} has a name and description`, def.name.length > 0 && def.desc.length > 0);
  }
}
{ // passiveMp is capped per run; the other three keep stacking
  const r = new Run(2);
  const passive = HEALER_UPGRADES.find((u) => u.id === 'passive')!;
  for (let i = 0; i < 10; i++) r.applyHealerUpgrade(passive);
  eq('passive MP is capped per run', r.healer.passiveMp, PASSIVE_MP_CAP);

  const r2 = new Run(2);
  const mana = HEALER_UPGRADES.find((u) => u.id === 'mana')!;
  const before = r2.healer.maxMana;
  for (let i = 0; i < 3; i++) r2.applyHealerUpgrade(mana);
  eq('max mana keeps stacking', r2.healer.maxMana, before + mana.amount * 3);
}
{ // a healer upgrade reaches the battle: +max mana raises the fight's mana pool
  const r = new Run(2);
  const mana = HEALER_UPGRADES.find((u) => u.id === 'mana')!;
  const before = r.healer.maxMana;
  r.applyHealerUpgrade(mana);
  eq('the healer stat changed', r.healer.maxMana, before + mana.amount);
}

finish('content/upgrades');
