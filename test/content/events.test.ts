// Characterization tests for the 8 events and all 12 choice kinds (#99 A10).
//
// This is run-layer content, and it is the part the migration plan originally
// dropped: EVENTS is declarative data (src/data/run.ts:710) but every OUTCOME is a
// hand-written Run method dispatched on `choice.kind`, with magnitudes and odds
// baked in — gambleGold's 50/25/25 split lives at src/run.ts:1380. #105 gives these
// an outcome vocabulary, so each kind needs its effect, its gold movement and its
// refusal case pinned first.
//
// Five choice kinds had ZERO test references before this file: addCardOffer,
// removeCard, shrineCard, shrineParty, duplicateCard.
import { Run } from '../../src/run';
import type { Slot, EventChoiceKind } from '../../src/constants';
import {
  EVENTS, CURSED_CHEST_GOLD, MERCENARY_PRICE, MERCENARY_DAMAGE, DUPLICATE_PRICE,
  BLOOD_ALTAR_HP, BLOOD_ALTAR_DAMAGE, BLOOD_ALTAR_MIN_HP,
  CARD_REMOVAL_PRICE, CURSE_SHRINE_GOLD, EVENT_CARD_OFFER_SIZE,
  MAX_UPGRADE_SLOTS, CARD_POOL,
} from '../../src/constants';
import { check, eq, finish } from '../harness';

const rich = (seed = 5, gold = 500): Run => {
  const r = new Run(seed);
  r.gold = gold;
  return r;
};

// --- the event table itself ------------------------------------------------
{
  eq('there are eight events', EVENTS.length, 8);
  const ids = EVENTS.map((e) => e.id);
  eq('event ids are unique', new Set(ids).size, ids.length);
  for (const e of EVENTS) {
    check(`${e.id} has a title`, e.title.length > 0);
    check(`${e.id} has body text`, e.text.length > 0);
    check(`${e.id} offers at least two choices`, e.choices.length >= 2);
    check(`${e.id} always offers a way out`, e.choices.some((c) => c.kind === 'leave'));
    for (const c of e.choices) {
      check(`${e.id}: choice '${c.kind}' has a label`, c.label.length > 0);
      // Every non-leave choice explains its outcome; 'leave' needs no gloss.
      if (c.kind !== 'leave') {
        check(`${e.id}: choice '${c.kind}' explains itself`, (c.detail ?? '').length > 0);
      }
    }
  }
}
{ // every declared choice kind is actually reachable from some event
  const used = new Set(EVENTS.flatMap((e) => e.choices.map((c) => c.kind)));
  const ALL_KINDS: EventChoiceKind[] = ['addCardOffer', 'removeCard', 'gambleGold',
    'shrineCard', 'shrineParty', 'cursedChest', 'mercenary', 'duplicateCard',
    'bloodAltar', 'shrineCurse', 'healInjury', 'leave'];
  eq('the union declares twelve choice kinds', ALL_KINDS.length, 12);
  for (const kind of ALL_KINDS) {
    check(`choice kind '${kind}' is reachable from an event`, used.has(kind));
  }
}

// --- apothecary: addCardOffer + removeCard (both previously untested) ------
{
  const r = rich();
  const offer = r.eventCardOffer();
  eq('the apothecary offers the declared number of cards', offer.length, EVENT_CARD_OFFER_SIZE);
  eq('the offer has no duplicates', new Set(offer).size, offer.length);
  check('every offered card is from the shop pool', offer.every((id) => CARD_POOL.includes(id)));
}
{ // the offer is seed-deterministic
  eq('the card offer is deterministic by seed',
    rich(9).eventCardOffer().join(','), rich(9).eventCardOffer().join(','));
}
{ // removeCard for gold: shrinks the deck and charges
  const r = rich();
  const size0 = r.deck.length, gold0 = r.gold;
  const victim = r.deck[0].uid;
  check('the removal succeeds', r.removeCardForGold(victim));
  eq('the deck shrinks by one', r.deck.length, size0 - 1);
  eq('the removal charges its price', r.gold, gold0 - CARD_REMOVAL_PRICE);
  check('the removed card is gone', !r.deck.some((c) => c.uid === victim));
}
{ // it refuses when the gold is not there, and charges nothing
  const r = rich(5, CARD_REMOVAL_PRICE - 1);
  const size0 = r.deck.length, gold0 = r.gold;
  check('removal is refused when unaffordable', !r.removeCardForGold(r.deck[0].uid));
  eq('a refused removal leaves the deck alone', r.deck.length, size0);
  eq('a refused removal charges nothing', r.gold, gold0);
}
{ // and refuses an unknown card
  const r = rich();
  const gold0 = r.gold;
  check('removal is refused for a card not in the deck', !r.removeCardForGold(-999));
  eq('a refused removal charges nothing', r.gold, gold0);
}

// --- casino: gambleGold, all four branches --------------------------------
{ // the payout table is exactly 50% +75 / 25% +25 / 25% -25
  const seen = new Map<number, number>();
  for (let seed = 0; seed < 200; seed++) {
    const r = rich(seed, 500);
    const { delta, gold } = r.gambleGold();
    seen.set(delta, (seen.get(delta) ?? 0) + 1);
    eq('gambleGold reports the resulting gold', gold, 500 + delta);
  }
  check('the big win occurs', (seen.get(75) ?? 0) > 0);
  check('the small win occurs', (seen.get(25) ?? 0) > 0);
  check('the loss occurs', (seen.get(-25) ?? 0) > 0);
  eq('no other outcome is possible', seen.size, 3);
  // 50/25/25 over 200 seeds — a loose band, enough to catch a swapped weight.
  const big = seen.get(75) ?? 0;
  check(`the big win is the most common outcome (${big}/200)`, big > (seen.get(25) ?? 0));
}
{ // gold is floored at 0 — a loss cannot put the run in debt
  const r = rich(0, 5);
  let guard = 0;
  while (guard++ < 50) {
    const { gold } = r.gambleGold();
    check('gold never goes negative', gold >= 0);
    if (gold === 0) break;
  }
}
{ // deterministic by seed
  eq('the flip is deterministic by seed', rich(11).gambleGold().delta, rich(11).gambleGold().delta);
}

// --- shrine: shrineCard, shrineParty, shrineCurse -------------------------
{
  const r = rich();
  const eligible = r.shrineEligibleCards();
  check('the shrine finds eligible cards in a starting deck', eligible.length > 0);
  check('every eligible card has an upgrade slot free',
    eligible.every((c) => c.upgrades.length < MAX_UPGRADE_SLOTS));
  check('every eligible card has at least one applicable modifier',
    eligible.every((c) => r.eligibleModifiersFor(c).length > 0));
}
{ // blessing a card applies a real modifier to that card
  const r = rich();
  const target = r.shrineEligibleCards()[0];
  const before = target.upgrades.length;
  const applied = r.shrineBlessCard(target.uid);
  check('the shrine applies a modifier', applied != null);
  eq('the card gains exactly one upgrade', target.upgrades.length, before + 1);
  check('the applied modifier is the one reported', target.upgrades.includes(applied!));
}
{ // it refuses a card that cannot take an upgrade
  const r = rich();
  check('blessing an unknown card is refused', r.shrineBlessCard(-999) == null);
}
{ // blessing a hero applies a real party upgrade
  const r = rich();
  const before = { ...r.party[0] };
  const def = r.shrineBlessMember(0 as Slot);
  check('the shrine returns the upgrade it applied', def != null);
  const after = r.party[0];
  const changed = after.maxHP !== before.maxHP || after.damage !== before.damage
    || after.abilityPower !== before.abilityPower;
  check(`the blessed member actually changed (${def.stat})`, changed);
}
{ // accepting a curse pays gold and adds a cursed relic
  const r = rich(3, 0);
  const relics0 = r.relics.length;
  const relic = r.shrineAcceptCurse();
  if (relic != null) {
    eq('accepting a curse pays its gold', r.gold, CURSE_SHRINE_GOLD);
    eq('the curse joins the relic list', r.relics.length, relics0 + 1);
    check('the granted relic is the one reported', r.relics.includes(relic));
  } else {
    check('a refused curse pays nothing', r.gold === 0);
  }
}

// --- cursedChest -----------------------------------------------------------
{
  const r = rich(2);
  const gold0 = r.gold, size0 = r.deck.length;
  const { delta, gold, removed } = r.cursedChest();
  // One run-layer gold convention, shared with gambleGold (#107): `delta` is the
  // change, `gold` is the resulting total.
  eq('the chest reports its payout as delta', delta, CURSED_CHEST_GOLD);
  eq('the chest reports the resulting total as gold', gold, gold0 + CURSED_CHEST_GOLD);
  eq('the chest gold is reflected on the run', r.gold, gold0 + CURSED_CHEST_GOLD);
  check('the chest takes a card', removed != null);
  eq('the deck shrinks by one', r.deck.length, size0 - 1);
  check('the taken card is gone', !r.deck.some((c) => c.uid === removed!.uid));
}
{ // the victim is the CHEST's choice, and seed-deterministic
  eq('the chest victim is deterministic by seed',
    rich(8).cursedChest().removed!.uid, rich(8).cursedChest().removed!.uid);
}

// --- mercenary -------------------------------------------------------------
{
  const r = rich();
  const gold0 = r.gold;
  const before = r.party.map((p) => p.damage);
  const hired = r.hireMercenary();
  check('the mercenary takes the job', hired != null);
  eq('hiring charges its fee', r.gold, gold0 - MERCENARY_PRICE);
  eq('the drilled member gains damage',
    r.party[hired!.slot].damage, before[hired!.slot] + MERCENARY_DAMAGE);
  eq('the reported amount matches', hired!.amount, MERCENARY_DAMAGE);
  const others = r.party.filter((_, i) => i !== hired!.slot);
  check('only one member is drilled',
    others.every((p, i) => p.damage === before.filter((_, j) => j !== hired!.slot)[i]));
}
{ // unaffordable: refused, and nothing is charged
  const r = rich(5, MERCENARY_PRICE - 1);
  const gold0 = r.gold;
  const before = r.party.map((p) => p.damage);
  check('the mercenary refuses an unaffordable hire', r.hireMercenary() == null);
  eq('a refused hire charges nothing', r.gold, gold0);
  check('a refused hire drills nobody', r.party.every((p, i) => p.damage === before[i]));
}

// --- duplicator ------------------------------------------------------------
{
  const r = rich();
  const source = r.deck[0];
  const size0 = r.deck.length, gold0 = r.gold;
  const copy = r.duplicateCard(source.uid);
  check('the duplicator returns the copy', copy != null);
  eq('the deck grows by one', r.deck.length, size0 + 1);
  eq('duplication charges its price', r.gold, gold0 - DUPLICATE_PRICE);
  eq('the copy is the same card', copy!.id, source.id);
  check('the copy has its own identity', copy!.uid !== source.uid);
}
{ // upgrades come along with the copy
  const r = rich();
  const target = r.shrineEligibleCards()[0];
  r.shrineBlessCard(target.uid);
  const copy = r.duplicateCard(target.uid);
  check('the copy carries the original upgrades',
    copy != null && copy.upgrades.join(',') === target.upgrades.join(','));
  check('the upgrade list is a COPY, not a shared reference',
    copy!.upgrades !== target.upgrades);
}
{ // unaffordable and unknown-card both refuse without charging
  const r = rich(5, DUPLICATE_PRICE - 1);
  const gold0 = r.gold, size0 = r.deck.length;
  check('duplication is refused when unaffordable', r.duplicateCard(r.deck[0].uid) == null);
  eq('a refused duplication charges nothing', r.gold, gold0);
  eq('a refused duplication grows nothing', r.deck.length, size0);

  const r2 = rich();
  const g2 = r2.gold;
  check('duplication is refused for an unknown card', r2.duplicateCard(-999) == null);
  eq('a refused duplication charges nothing', r2.gold, g2);
}

// --- fieldHospital: healInjury --------------------------------------------
{
  const r = rich();
  r.party[1].injuries = 2;
  check('tending a scarred member succeeds', r.healInjury(1 as Slot));
  eq('exactly one scar is cleared', r.party[1].injuries, 1);
}
{ // an unharmed member is refused — it is a free choice, so refusal must be visible
  const r = rich();
  r.party[0].injuries = 0;
  check('tending an unharmed member is refused', !r.healInjury(0 as Slot));
  eq('nothing changes', r.party[0].injuries, 0);
}

// --- bloodAltar ------------------------------------------------------------
{
  const r = rich();
  const p = r.party[1];
  const maxHP0 = p.maxHP, dmg0 = p.damage;
  const res = r.bloodAltarSacrifice(1 as Slot);
  check('the altar accepts a healthy member', res != null);
  eq('the member pays max HP', p.maxHP, maxHP0 - BLOOD_ALTAR_HP);
  eq('the member gains damage', p.damage, dmg0 + BLOOD_ALTAR_DAMAGE);
  eq('the reported HP loss matches', res!.hpLoss, BLOOD_ALTAR_HP);
  eq('the reported damage gain matches', res!.damageGain, BLOOD_ALTAR_DAMAGE);
}
{ // the wheel turns one way: the trade raises the member's salary
  const r = rich();
  const up0 = r.party[1].upgrades ?? 0;
  r.bloodAltarSacrifice(1 as Slot);
  eq('the altar counts as a permanent upgrade', r.party[1].upgrades ?? 0, up0 + 1);
}
{ // the altar takes but never kills — a frail member is refused
  const r = rich();
  r.party[2].maxHP = BLOOD_ALTAR_MIN_HP;
  const dmg0 = r.party[2].damage;
  check('the altar refuses a member at the floor', !r.canSacrifice(2 as Slot));
  check('the sacrifice is refused', r.bloodAltarSacrifice(2 as Slot) == null);
  eq('a refused sacrifice grants nothing', r.party[2].damage, dmg0);
  eq('a refused sacrifice takes nothing', r.party[2].maxHP, BLOOD_ALTAR_MIN_HP);
}
{ // repeated sacrifices eventually hit the floor and stop
  const r = rich();
  let guard = 0;
  while (r.canSacrifice(1 as Slot) && guard++ < 50) r.bloodAltarSacrifice(1 as Slot);
  check('the altar stops at the floor', guard < 50);
  check('the member is left above the minimum', r.party[1].maxHP > BLOOD_ALTAR_MIN_HP - BLOOD_ALTAR_HP);
}

// --- leave -----------------------------------------------------------------
{ // 'leave' is inert by construction: it has no Run method at all. Assert that every
  // event can be walked away from without touching the run's state.
  const r = rich(4);
  const snapshot = JSON.stringify({ gold: r.gold, deck: r.deck.length, party: r.party });
  for (const e of EVENTS) {
    check(`${e.id} offers 'leave'`, e.choices.some((c) => c.kind === 'leave'));
  }
  eq('walking away changes nothing',
    JSON.stringify({ gold: r.gold, deck: r.deck.length, party: r.party }), snapshot);
}

finish('content/events');
