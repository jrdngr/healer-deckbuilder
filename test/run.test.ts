// Run-layer test harness. Run with: tsx test/run.test.ts
import { Run } from '../src/run';
import { makeRng } from '../src/rng';
import {
  FIGHT_COUNT, FORK_COUNT, BRANCHES_PER_FORK, NODES_PER_BRANCH, NON_FIGHT_NODES,
  GOLD_PER_FIGHT, SHOP_SIZE, RARITY_PRICE, CARD_RARITY, MODIFIERS, DEFAULT_HEALER,
  defaultDeck, MAX_UPGRADE_SLOTS, EVENTS, ENEMY_HP_BY_FIGHT, ENEMY_ENRAGE_TURN_BY_FIGHT,
  CARD_POOL, PARTY_UPGRADES, HEALER_UPGRADES, PASSIVE_MP_CAP, CARD_REMOVAL_PRICE, CASINO_SAFE_GOLD,
  CURSED_CHEST_GOLD, MERCENARY_PRICE, MERCENARY_DAMAGE, DUPLICATE_PRICE,
  BLOOD_ALTAR_HP, BLOOD_ALTAR_DAMAGE, BLOOD_ALTAR_MIN_HP,
  SPOILS_OFFER_SIZE, RELIQUARY_STOCK, RELIQUARY_REMOVALS_MAX, RELIC_PRICE,
  HAGGLER_DISCOUNT, HAGGLER_FLOOR, NODE_TYPE_WEIGHTS, RELICS, CURSE_PRICE, CURSE_SHRINE_GOLD, RUSTY_CROWN_GOLD,
  NORMAL_ENEMY_DEFS, ENEMY_DEF_BY_ID, isActBoss, actOfFight, ACT_BOSS_DEFS, FIGHTS_PER_ACT, ACT_COUNT,
  DIFFICULTIES, MAX_INJURIES, INJURY_MAXHP, INJURY_DAMAGE, INJURY_ABILITY, RELIC_IDS,
  DRAFT_POOL, partyFromMembers, STARTER_MEMBERS, DRAFT_OFFER_SIZE,
  memberSalary, MEMBER_BASE_SALARY, SALARY_PER_UPGRADE, SALARY_PER_INJURY, MIN_SALARY,
  INJURY_RULES, INCAPACITATE_AT, injuryRecordCap, injuryIncapacitates,
  injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty,
} from '../src/constants';
import type { RunLocation } from '../src/run';
import { emptyStats, recordRunEnd } from '../src/stats';
import { groupPile } from '../src/deckView';
import type { CardId, ModifierId, Slot, MemberId } from '../src/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}
function eq(name: string, a: unknown, b: unknown): void { check(name, a === b, `expected ${b}, got ${a}`); }

const uidOf = (run: Run, id: CardId): number => run.deck.find((c) => c.id === id)!.uid;

// Cross the current fork: take a branch, visit every open stop once (a closed
// Infirmary is skipped — enterNode refuses it and completeNode then no-ops),
// and head on to the next fight.
// Pass through the pre-fight deploy step (2026-07) with the default seating. Tests
// that care about deployment set it explicitly via confirmDeployment.
const deployAll = (run: Run): void => {
  if (run.location.kind === 'deploy') run.confirmDeployment(run.deployment);
};

const crossBranch = (run: Run, branch = 0): void => {
  run.chooseBranch(branch);
  for (let i = 0; i < NODES_PER_BRANCH; i++) { run.enterNode(i); run.completeNode(); }
  run.startNextFight();
  deployAll(run);
};

// Net gold a won fight pays after the default trio's salary (2026-07): the raised
// GOLD_PER_FIGHT minus what the deployed classic trio (ranger+tank+mage) costs.
const TRIO_SALARY = new Run(0).deployedSalary();
const NET_GOLD = GOLD_PER_FIGHT - TRIO_SALARY;

// --- map shape & determinism ------------------------------------------------
{
  const run = new Run(1);
  eq('map has FORK_COUNT forks', run.map.length, FORK_COUNT);
  let okShape = true, okTypes = true, okDiffer = true;
  for (const fork of run.map) {
    if (fork.branches.length !== BRANCHES_PER_FORK) okShape = false;
    for (const branch of fork.branches) {
      if (branch.nodes.length !== NODES_PER_BRANCH) okShape = false;
      for (const node of branch.nodes) if (!NON_FIGHT_NODES.includes(node.type)) okTypes = false;
      if (branch.nodes[0].type === branch.nodes[1].type) okDiffer = false;
    }
  }
  check('every fork has BRANCHES_PER_FORK branches of NODES_PER_BRANCH nodes', okShape);
  check('all map nodes are non-fight types', okTypes);
  check("a branch's two nodes differ", okDiffer);
}
{
  // Every node across a whole fork is distinct — no duplicate among the two
  // paths' four nodes. Sweep many seeds so a rare collision can't slip through.
  let allUnique = true;
  for (let seed = 1; seed <= 300; seed++) {
    for (const fork of new Run(seed).map) {
      const types = fork.branches.flatMap((b) => b.nodes.map((n) => n.type));
      if (new Set(types).size !== types.length) allUnique = false;
    }
  }
  check('all nodes within a fork are unique (no duplicates across the two paths)', allUnique);
}
{
  // Same seed -> identical map; different seed -> (very likely) different map.
  eq('map deterministic by seed', JSON.stringify(new Run(42).map), JSON.stringify(new Run(42).map));
  check('different seeds differ', JSON.stringify(new Run(1).map) !== JSON.stringify(new Run(2).map));
}

// --- initial state ----------------------------------------------------------
{
  const run = new Run(1);
  eq('starts on the map (start screen)', run.location.kind, 'start');
  eq('starts with 0 gold', run.gold, 0);
  eq('starts with default deck size', run.deck.length, defaultDeck().length);
  eq('default healer maxMana', run.healer.maxMana, DEFAULT_HEALER.maxMana);
  // beginRun enters the first fight.
  run.beginRun(); deployAll(run);
  eq('beginRun -> fight 0', run.location.kind === 'fight' && run.location.fightIndex, 0);
  eq('not boss at fight 0', run.isBossFight, false);
}

// --- progression through the run --------------------------------------------
{
  const run = new Run(3);
  run.beginRun(); deployAll(run);
  // Win fight 0 -> fork 0, gold awarded.
  run.winFight();
  eq('win fight -> forkChoice', run.location.kind, 'forkChoice');
  eq('gold awarded for fight (net of salary)', run.gold, NET_GOLD);

  // Choose a branch -> its hub; stops open in ANY order, leaving a stop returns
  // to the hub, and the hub decides when the next fight starts. Pin the stops so
  // the assertions don't depend on the seed's roll (a closed Infirmary hides).
  run.map[0].branches[0].nodes = [{ type: 'cardShop' }, { type: 'event' }];
  run.chooseBranch(0);
  check('branch choice -> the branch hub', run.location.kind === 'branch');
  run.enterNode(1);
  check('stops open in any order (second first)', run.location.kind === 'node' && run.location.index === 1);
  run.completeNode();
  check('leaving a stop returns to the hub', run.location.kind === 'branch');
  run.enterNode(0);
  check('the other stop opens from the hub', run.location.kind === 'node' && run.location.index === 0);
  run.completeNode();
  run.startNextFight();
  deployAll(run);
  check('the hub leads to fight 1', run.location.kind === 'fight' && run.location.fightIndex === 1);
}
// --- branch hub: revisits keep state, events resolve once ---------------------
{
  const run = new Run(31);
  run.beginRun(); deployAll(run);
  run.winFight();
  run.map[0].branches[0].nodes = [{ type: 'cardShop' }, { type: 'event' }];
  run.chooseBranch(0);

  // First visit rolls the shop; buy something.
  run.enterNode(0);
  const stock = run.nodeContent?.type === 'cardShop' ? run.nodeContent.offers.length : 0;
  check('the shop rolls on first entry', stock > 0);
  run.gold = 999;
  check('a purchase goes through', run.buyCardOffer(0));
  run.completeNode();

  // Revisit: same content object, reduced stock, and the rng stream untouched.
  const rngBefore = run.rng.getState();
  run.enterNode(0);
  check('a revisited shop keeps its (reduced) stock — no reroll',
    run.nodeContent?.type === 'cardShop' && run.nodeContent.offers.length === stock - 1);
  eq('a revisit consumes no rng', run.rng.getState(), rngBefore);
  check('the revisit shares the cached content object', run.nodeContent === run.branchContent[0]);
  run.completeNode();

  // Events roll live, resolve once, and stay spent across revisits.
  run.enterNode(1);
  check('an event rolls unspent', run.nodeContent?.type === 'event' && !run.nodeContent.done);
  run.markEventDone();
  run.completeNode();
  run.enterNode(1);
  check('a resolved event stays spent on revisit', run.nodeContent?.type === 'event' && run.nodeContent.done);
  run.completeNode();

  // Moving on reaches the fight and drops the branch cache.
  run.startNextFight();
  deployAll(run);
  check('the hub leads to the next fight', run.location.kind === 'fight' && run.location.fightIndex === 1);
  eq('the branch cache is dropped at the fight boundary', run.branchContent.length, 0);
}

// --- branch hub: a full-roster Recruit node is hidden ------------------------
{
  const run = new Run(32);
  run.beginRun(); deployAll(run);
  run.winFight();
  run.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  run.chooseBranch(0);

  // With members still to offer, the Recruit node is open.
  check('a recruit stop is open while members remain', run.nodeAvailable('recruit'));
  // Once the roster holds everyone, it hides.
  run.roster = partyFromMembers(DRAFT_POOL);
  check('a full-roster recruit stop is hidden', !run.nodeAvailable('recruit'));
  run.enterNode(0);
  check('entering a hidden recruit stop is refused', run.location.kind === 'branch');
  check('every other stop stays open', run.nodeAvailable('event') && run.nodeAvailable('cardShop'));
}

// --- branch hub: a mid-branch save/resume keeps the cached stops ---------------
{
  const run = new Run(33);
  run.beginRun(); deployAll(run);
  run.winFight();
  run.map[0].branches[1].nodes = [{ type: 'cardShop' }, { type: 'partyUpgrade' }];
  run.chooseBranch(1);
  run.enterNode(0);
  run.gold = 999;
  run.buyCardOffer(0);

  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  check('a mid-node resume lands back in the node', restored.location.kind === 'node');
  check('the resumed node IS its cached branch slot (one object, not two copies)',
    restored.nodeContent === restored.branchContent[0]);
  eq('a mid-branch snapshot round-trips byte-stable',
    JSON.stringify(restored.toJSON()), JSON.stringify(run.toJSON()));

  // The resumed shop still shows the purchase, and a resumed revisit keeps it.
  const offers = restored.nodeContent?.type === 'cardShop' ? restored.nodeContent.offers.length : -1;
  restored.completeNode();
  restored.enterNode(0);
  check('the resumed revisit keeps the reduced stock',
    restored.nodeContent?.type === 'cardShop' && restored.nodeContent.offers.length === offers);
}

{
  // Drive through all 9 fights: three acts, an act boss at the end of each
  // (fights 2, 5, 8), only the final fight wins the run.
  const run = new Run(4);
  run.beginRun(); deployAll(run);
  const bossFights: number[] = [];
  let gold = 0;
  for (let f = 0; f < FIGHT_COUNT; f++) {
    check(`fight ${f} boss flag matches isActBoss`, run.isBossFight === isActBoss(f));
    if (run.isBossFight) {
      bossFights.push(f);
      eq(`fight ${f} config flagged boss`, run.toBattleConfig().enemy.boss, true);
    }
    if (f < FIGHT_COUNT - 1) {
      run.winFight();
      gold = run.gold;
      // Act-1/2 bosses drop a spoils screen first (#21), then a post-boss member
      // draft (2026-07); resolving both moves on to the fork.
      if (isActBoss(f)) {
        check(`win of boss fight ${f} -> spoils`, run.location.kind === 'spoils');
        run.skipSpoils();
        check(`boss ${f} spoils -> post-boss draft`, run.location.kind === 'draft');
        run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
      }
      check(`win of fight ${f} -> forkChoice`, run.location.kind === 'forkChoice');
      crossBranch(run, run.rng() < 0.5 ? 0 : 1);
    }
  }
  eq('act bosses sit at fights 2/5/8', JSON.stringify(bossFights), JSON.stringify([2, 5, 8]));
  eq('reached the final boss fight', run.fightIndex, FIGHT_COUNT - 1);
  eq('gold accrued over 8 non-final fights (net)', gold, NET_GOLD * (FIGHT_COUNT - 1));
  run.winFight();
  eq('beating the final boss wins the run', run.status, 'won');
}
{
  // Enemy HP / enrage turn follow the per-act curve.
  const run = new Run(77);
  run.beginRun(); deployAll(run);
  const seen: number[] = [];
  const enrage: number[] = [];
  for (let f = 0; f < FIGHT_COUNT; f++) {
    seen.push(run.toBattleConfig().enemy.maxHP);
    enrage.push(run.toBattleConfig().enemy.enrageTurn ?? -1);
    if (f < FIGHT_COUNT - 1) {
      run.winFight();
      if (run.location.kind === 'spoils') run.skipSpoils();
      if (run.location.kind === 'draft') run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
      crossBranch(run);
    }
  }
  eq('HP curve matches ENEMY_HP_BY_FIGHT', JSON.stringify(seen), JSON.stringify(ENEMY_HP_BY_FIGHT));
  eq('enrage curve matches ENEMY_ENRAGE_TURN_BY_FIGHT', JSON.stringify(enrage), JSON.stringify(ENEMY_ENRAGE_TURN_BY_FIGHT));
  eq('act-2 boss enrages a turn sooner', enrage[5], 10);
}
{
  // Losing any fight loses the run.
  const run = new Run(5);
  run.loseFight();
  eq('loseFight -> lost', run.status, 'lost');
}

// --- toBattleConfig reflects progression ------------------------------------
{
  const run = new Run(6);
  const cfg = run.toBattleConfig();
  eq('config deck length tracks run deck', cfg.deck.length, run.deck.length);
  eq('non-boss fight is not flagged as the boss', cfg.enemy.boss, false);
  // Config deep-copies the deck (mutating config must not touch the run deck).
  cfg.deck[0].upgrades.push('retain');
  eq('config deck is a copy', run.deck[0].upgrades.length, 0);
}

// --- card shop --------------------------------------------------------------
{
  const run = new Run(7);
  const offers = run.rollCardShop();
  eq('card shop offers SHOP_SIZE.cardShop cards', offers.length, SHOP_SIZE.cardShop);
  const ids = new Set(offers.map((o) => o.cardId));
  eq('card offers are distinct', ids.size, offers.length);
  check('card offer prices match rarity', offers.every((o) => o.price === RARITY_PRICE[CARD_RARITY[o.cardId]]));
}
{
  const run = new Run(7);
  run.gold = 1000;
  run.nodeContent = { type: 'cardShop', offers: run.rollCardShop() };
  const before = run.deck.length;
  const price = (run.nodeContent as { offers: { price: number }[] }).offers[0].price;
  check('buy card offer succeeds', run.buyCardOffer(0));
  eq('deck grew by one', run.deck.length, before + 1);
  eq('gold deducted', run.gold, 1000 - price);
  // Out of gold -> rejected.
  run.gold = 0;
  check('buy with no gold fails', !run.buyCardOffer(0));
}

// --- card upgrade shop ------------------------------------------------------
{
  const run = new Run(8);
  run.gold = 1000;
  run.nodeContent = { type: 'cardUpgrade', offers: [{ modifier: 'lingering', rarity: 'common', price: RARITY_PRICE.common }] };
  const regenUid = uidOf(run, 'regen');
  check('apply lingering to regen succeeds', run.buyModifierOffer(0, regenUid));
  eq('gold deducted for upgrade', run.gold, 1000 - RARITY_PRICE.common);
  check('regen card carries lingering', run.deck.find((c) => c.uid === regenUid)!.upgrades.includes('lingering'));
  check('offer consumed', (run.nodeContent as { offers: unknown[] }).offers.length === 0);
}
{
  // Ineligible target is rejected and costs nothing.
  const run = new Run(8);
  run.gold = 1000;
  run.nodeContent = { type: 'cardUpgrade', offers: [{ modifier: 'lingering', rarity: 'common', price: RARITY_PRICE.common }] };
  check('lingering on highHeal rejected', !run.buyModifierOffer(0, uidOf(run, 'highHeal')));
  eq('rejected upgrade keeps gold', run.gold, 1000);
}

// --- party upgrade shop -----------------------------------------------------
{
  const run = new Run(9);
  run.gold = 1000;
  const def = { id: 'hp3', stat: 'maxHP' as const, amount: 3, rarity: 'common' as const, name: '+3 Max HP', desc: '' };
  run.nodeContent = { type: 'partyUpgrade', offers: [{ def, price: RARITY_PRICE.common }] };
  const before = run.party[0 as Slot].maxHP;
  check('buy party offer succeeds', run.buyPartyOffer(0, 0 as Slot));
  eq('member maxHP raised', run.party[0 as Slot].maxHP, before + 3);
  eq('party gold deducted', run.gold, 1000 - RARITY_PRICE.common);
}

// --- healer upgrade shop ----------------------------------------------------
{
  const run = new Run(10);
  run.gold = 1000;
  const def = { id: 'mana', stat: 'maxMana' as const, amount: 1, rarity: 'common' as const, name: '+1 Max Mana', desc: '' };
  run.nodeContent = { type: 'healerUpgrade', offers: [{ def, price: RARITY_PRICE.common }] };
  const before = run.healer.maxMana;
  check('buy healer offer succeeds', run.buyHealerOffer(0));
  eq('maxMana raised', run.healer.maxMana, before + 1);
}

// --- events -----------------------------------------------------------------
{
  // Casino: invariants over many seeds.
  for (let seed = 0; seed < 30; seed++) {
    const run = new Run(seed);
    run.gold = 100;
    const { delta, gold } = run.gambleGold();
    check(`casino delta in set (seed ${seed})`, [75, 25, -25].includes(delta), `got ${delta}`);
    eq(`casino gold floors at 0 (seed ${seed})`, gold, Math.max(0, 100 + delta));
  }
  // Floor actually clamps when poor.
  let sawLoss = false;
  for (let seed = 0; seed < 60 && !sawLoss; seed++) {
    const run = new Run(seed);
    run.gold = 10;
    const { delta, gold } = run.gambleGold();
    if (delta === -25) { sawLoss = true; eq('poor loss floors to 0', gold, 0); }
  }
  check('exercised a losing flip', sawLoss);
}
{
  // Apothecary add-card offer.
  const run = new Run(11);
  const offer = run.eventCardOffer();
  eq('event card offer size', offer.length, 3);
  check('event card offer distinct', new Set(offer).size === offer.length);
  const before = run.deck.length;
  run.addCard(offer[0]);
  eq('event add card grows deck', run.deck.length, before + 1);
}
{
  // Apothecary remove-card.
  const run = new Run(11);
  const uid = uidOf(run, 'lowHeal');
  const before = run.deck.length;
  check('remove card succeeds', run.removeCard(uid));
  eq('deck shrank', run.deck.length, before - 1);
  check('remove missing uid fails', !run.removeCard(99999));
}
{
  // Shrine: bless a card -> a random *eligible* modifier lands in a free slot.
  const run = new Run(12);
  const eligible = run.shrineEligibleCards();
  check('shrine has eligible cards', eligible.length > 0);
  const target = eligible[0];
  const slotsBefore = target.upgrades.length;
  const mod = run.shrineBlessCard(target.uid);
  check('shrine applied a modifier', mod !== null);
  eq('shrine filled a slot', target.upgrades.length, slotsBefore + 1);
  check('applied modifier is eligible for the card', mod != null && MODIFIERS[mod].eligible(target.id));
  check('within slot cap', target.upgrades.length <= MAX_UPGRADE_SLOTS);
}
{
  // Shrine: bless a member -> a random stat boost applies.
  const run = new Run(13);
  const slot = 2 as Slot;
  const snapshot = { ...run.party[slot] };
  const def = run.shrineBlessMember(slot);
  const after = run.party[slot];
  const changed = after.maxHP !== snapshot.maxHP || after.damage !== snapshot.damage || after.abilityPower !== snapshot.abilityPower;
  check('shrine member boost changed a stat', changed, `def ${def.id}`);
}

{
  // Event catalog & rollEvent stay within the defined set (3 -> 8 in #19, + the
  // DR1 Field Hospital = 9).
  eq('nine events (incl. DR1 Field Hospital)', EVENTS.length, 9);
  check('the Field Hospital tends injuries',
    EVENTS.find((e) => e.id === 'fieldHospital')!.choices.some((c) => c.kind === 'healInjury'));
  const ids = new Set(EVENTS.map((e) => e.id));
  let inSet = true;
  for (let seed = 0; seed < 30; seed++) {
    const e = new Run(seed).rollEvent();
    if (!ids.has(e.id)) inSet = false;
  }
  check('rollEvent always returns a defined event', inSet);
  check('every event has 2-4 choices', EVENTS.every((e) => e.choices.length >= 2 && e.choices.length <= 4));
  check('no event id repeats', ids.size === EVENTS.length);
  // Every event keeps a walk-away branch except the shrine-style pure boons.
  check('every new event can be declined',
    EVENTS.filter((e) => ['cursedChest', 'mercenary', 'duplicator', 'purgeWell', 'bloodAltar'].includes(e.id))
      .every((e) => e.choices.some((c) => c.kind === 'leave')));
}

// --- events expansion (#19) ---------------------------------------------------
{
  // Cursed Chest: guaranteed gold, a seeded-random card is the price.
  const run = new Run(60);
  const before = run.deck.length;
  const goldBefore = run.gold;
  const { gold, removed } = run.cursedChest();
  eq('chest pays the flat gold', gold, CURSED_CHEST_GOLD);
  eq('chest gold lands in the purse', run.gold, goldBefore + CURSED_CHEST_GOLD);
  check('chest takes a card', removed !== null);
  eq('deck shrinks by one', run.deck.length, before - 1);
  check('the taken card is really gone', !run.deck.some((c) => c.uid === removed!.uid));
  // Determinism: same seed, same victim.
  const run2 = new Run(60);
  eq('chest victim is seed-deterministic', run2.cursedChest().removed!.uid, removed!.uid);
}
{
  // Wandering Mercenary: fee gated on gold; a seeded-random member gains damage.
  const run = new Run(61);
  eq('mercenary refuses an empty purse', run.hireMercenary(), null);
  run.gold = MERCENARY_PRICE;
  const before = run.party.map((p) => p.damage);
  const hired = run.hireMercenary();
  check('mercenary hires with enough gold', hired !== null);
  eq('the fee is paid in full', run.gold, 0);
  eq('the drilled member gains the damage', run.party[hired!.slot].damage, before[hired!.slot] + MERCENARY_DAMAGE);
  const others = run.party.filter((_, s) => s !== hired!.slot);
  check('nobody else changes', others.every((p, i) => {
    const slots = [0, 1, 2].filter((s) => s !== hired!.slot);
    return p.damage === before[slots[i]];
  }));
}
{
  // The Duplicator: a paid, unupgraded copy of a chosen card.
  const run = new Run(62);
  run.gold = DUPLICATE_PRICE;
  const target = run.deck.find((c) => c.id === 'ability')!;
  target.upgrades.push('efficient'); // the copy must NOT inherit this
  const before = run.deck.length;
  const copy = run.duplicateCard(target.uid);
  check('duplicator returns the copy', copy !== null);
  eq('deck grows by one', run.deck.length, before + 1);
  eq('the copy shares the id', copy!.id, 'ability');
  eq('the copy is unupgraded', copy!.upgrades.length, 0);
  check('the copy has a fresh uid', copy!.uid !== target.uid);
  eq('the commission is paid', run.gold, 0);
  eq('a second copy is unaffordable', run.duplicateCard(target.uid), null);
}
{
  // Purge Well: free removal, but the well chooses; seed-deterministic.
  const run = new Run(63);
  const before = run.deck.length;
  const goldBefore = run.gold;
  const purged = run.purgeRandomCard();
  check('the well takes a card', purged !== null);
  eq('free — no gold moves', run.gold, goldBefore);
  eq('deck shrinks by one', run.deck.length, before - 1);
  eq('well victim is seed-deterministic', new Run(63).purgeRandomCard()!.uid, purged!.uid);
}
{
  // Blood Altar: permanent maxHP -> damage trade, floored so it never cripples.
  const run = new Run(64);
  const tank = run.party[1];
  const hpBefore = tank.maxHP, dmgBefore = tank.damage;
  const result = run.bloodAltarSacrifice(1 as Slot);
  check('the altar accepts a healthy member', result !== null);
  eq('max HP is paid', tank.maxHP, hpBefore - BLOOD_ALTAR_HP);
  eq('damage is granted', tank.damage, dmgBefore + BLOOD_ALTAR_DAMAGE);
  // Drain the mage down to the floor: the altar must refuse.
  const mage = run.party[2];
  mage.maxHP = BLOOD_ALTAR_MIN_HP;
  check('a member at the floor may not sacrifice', !run.canSacrifice(2 as Slot));
  eq('the altar refuses the frail', run.bloodAltarSacrifice(2 as Slot), null);
  eq('no stats moved on refusal', mage.maxHP, BLOOD_ALTAR_MIN_HP);
}

// --- issue 05: economy repricing -------------------------------------------
{
  // Quick Heal is out of the shop pool (starter-only) but still a real card.
  check('shop pool excludes Quick Heal', !CARD_POOL.includes('lowHeal'));
  check('starter deck still has Quick Heal', defaultDeck().some((c) => c.id === 'lowHeal'));
}
{
  // passiveMp is capped per run: buying it repeatedly stops at the cap and never
  // wastes gold on a maxed-out offer.
  const run = new Run(1);
  run.gold = 1000;
  const passive = HEALER_UPGRADES.find((d) => d.stat === 'passiveMp')!;
  run.applyHealerUpgrade(passive);
  run.applyHealerUpgrade(passive);
  run.applyHealerUpgrade(passive); // third apply is clamped
  eq('passiveMp clamps at the cap', run.healer.passiveMp, PASSIVE_MP_CAP);
}
{
  // +2 Damage carries a bespoke price above its rarity; +1 Rest Regen is 50g.
  const dmg2 = PARTY_UPGRADES.find((d) => d.id === 'dmg2')!;
  eq('+2 Damage priced at 85g', dmg2.price, 85);
  const rest = HEALER_UPGRADES.find((d) => d.id === 'rest')!;
  eq('+1 Rest Regen is uncommon (50g)', RARITY_PRICE[rest.rarity], 50);
  const hp6 = PARTY_UPGRADES.find((d) => d.id === 'hp6')!;
  eq('+HP upgrade bumped to +7', hp6.amount, 7);
}
{
  // Paid removal charges the unified fee and refuses when unaffordable.
  const run = new Run(2);
  run.gold = CARD_REMOVAL_PRICE - 1;
  const uid = run.deck[0].uid;
  check('removal refused when broke', run.removeCardForGold(uid) === false);
  eq('deck unchanged when refused', run.deck.length, defaultDeck().length);
  run.gold = CARD_REMOVAL_PRICE + 5;
  check('removal succeeds when affordable', run.removeCardForGold(uid) === true);
  eq('removal charged the fee', run.gold, 5);
  eq('deck shrank by one', run.deck.length, defaultDeck().length - 1);
}
{
  // Casino now offers a guaranteed cut alongside the flip.
  const casino = EVENTS.find((e) => e.id === 'casino')!;
  check('casino has a safe-gold branch', casino.choices.some((c) => c.kind === 'safeGold'));
  const run = new Run(3);
  const g0 = run.gold;
  const { delta, gold } = run.safeGold();
  eq('safe cut pays the fixed amount', delta, CASINO_SAFE_GOLD);
  eq('safe cut adds to gold', gold, g0 + CASINO_SAFE_GOLD);
}

// --- issue 09: named normals + encounter tables ----------------------------
{
  // Each named normal has a distinct, single-plurality profile (texture, not a
  // spike): single is the most-weighted type, and only Cleaver uses heavy.
  for (const def of NORMAL_ENEMY_DEFS) {
    const w = def.baseWeights;
    const total = Object.values(w).reduce((s, x) => s + x, 0);
    check(`${def.id} weights sum > 0`, total > 0);
    check(`${def.id} is single-plurality`, w.single >= Math.max(w.two, w.aoe, w.hidden, w.heavy, w.sweep));
    check(`${def.id} never sweeps (boss-only)`, w.sweep === 0);
  }
  check('only Cleaver uses heavy', NORMAL_ENEMY_DEFS.filter((d) => d.baseWeights.heavy > 0).map((d) => d.id).join() === 'cleaver');
}
{
  // Encounter selection is deterministic by seed, and the boss slot is always the boss.
  const idsFor = (seed: number): string[] =>
    Array.from({ length: FIGHT_COUNT }, (_, fi) => new Run(seed).peekEncounter(fi).id);
  eq('encounter roll deterministic by seed', JSON.stringify(idsFor(7)), JSON.stringify(idsFor(7)));
  const ids = idsFor(7);
  for (let fi = 0; fi < FIGHT_COUNT; fi++) {
    if (isActBoss(fi)) eq(`fight ${fi} (act boss) uses its act boss def`, ids[fi], ACT_BOSS_DEFS[actOfFight(fi)].id);
    else check(`fight ${fi} is a named normal`, ENEMY_DEF_BY_ID[ids[fi]] !== undefined);
  }
  eq('Act-1 boss is the Gatewarden', ids[2], 'gatewarden');
}
{
  // Act 2/3 rosters (#20): the later normal fights draw from their own named
  // rosters (boss tech at small scale), never from act-1-only filler.
  const A2 = new Set(['ironmaw', 'needler', 'leech', 'swarm', 'cleaver']);
  const A3 = new Set(['juggernaut', 'lancer', 'devourling', 'cleaver']);
  let a2ok = true, a3ok = true;
  const seen = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    for (const fi of [3, 4]) { const id = new Run(seed).peekEncounter(fi).id; seen.add(id); if (!A2.has(id)) a2ok = false; }
    for (const fi of [6, 7]) { const id = new Run(seed).peekEncounter(fi).id; seen.add(id); if (!A3.has(id)) a3ok = false; }
  }
  check('act-2 fights draw only from the act-2 roster', a2ok);
  check('act-3 fights draw only from the act-3 roster', a3ok);
  // All six new archetypes actually appear across seeds.
  check('every new named normal shows up in rolls',
    ['ironmaw', 'needler', 'leech', 'juggernaut', 'lancer', 'devourling'].every((id) => seen.has(id)));
}
{
  // 3-act shape: 9 fights, an act boss at each act end, 8 forks in the map.
  eq('nine fights', FIGHT_COUNT, 9);
  eq('three acts of three', FIGHTS_PER_ACT * ACT_COUNT, FIGHT_COUNT);
  eq('eight forks between fights', FORK_COUNT, FIGHT_COUNT - 1);
  eq('map has one fork per gap', new Run(1).map.length, FORK_COUNT);
}
{
  // Entering a fight rolls and caches the enemy def (stable across toBattleConfig).
  const run = new Run(3);
  run.beginRun(); deployAll(run); // enters fight 0
  const def = run.currentEnemyDef;
  check('fight 0 has a rolled enemy def', def !== null && def!.boss === false);
  eq('battle config carries the same def', run.toBattleConfig().enemy.def, def);
}

// --- relics phase A: spoils / Reliquary / Haggler (issue 21) -----------------
{
  // Spoils fire after the act-1 boss: 3 free, distinct offers with a rare guaranteed.
  const run = new Run(80);
  run.beginRun(); deployAll(run);
  for (let f = 0; f < 2; f++) {
    run.winFight();
    crossBranch(run);
  }
  eq('at the act-1 boss', run.fightIndex, 2);
  run.winFight();
  eq('boss win -> spoils', run.location.kind, 'spoils');
  check('spoils content rolled', run.nodeContent?.type === 'spoils');
  if (run.nodeContent?.type === 'spoils') {
    const offers = run.nodeContent.offers;
    eq('three spoils offers', offers.length, SPOILS_OFFER_SIZE);
    check('spoils offers are distinct', new Set(offers.map((o) => o.relicId)).size === offers.length);
    check('spoils are free', offers.every((o) => o.price === 0));
    const picked = run.pickSpoil(0);
    check('the pick lands in the relic list', picked !== null && run.hasRelic(picked));
    eq('spoils -> post-boss draft', run.location.kind, 'draft');
    // Cast through unknown: TS still has nodeContent narrowed to the spoils type here.
    run.chooseDraftMember((run.nodeContent as unknown as { options: MemberId[] }).options[0]);
    eq('post-boss draft -> forkChoice', run.location.kind, 'forkChoice');
    check('the battle config carries the relics', run.toBattleConfig().relics!.includes(picked!));
  }
  // The fight-3 spoils roll guarantees >=1 rare, across seeds.
  let rareAlways = true;
  for (let seed = 0; seed < 25; seed++) {
    const r = new Run(seed);
    if (!r.rollSpoils(2).some((o) => o.rarity === 'rare')) rareAlways = false;
  }
  check('fight-3 spoils always include a rare', rareAlways);
}
{
  // The Reliquary appears exactly twice per run: once in a mid-act-2 fork,
  // once in a mid-act-3 fork; never anywhere else.
  let ok = true;
  for (let seed = 0; seed < 30; seed++) {
    const run = new Run(seed);
    let inA2 = 0, inA3 = 0, elsewhere = 0;
    run.map.forEach((fork, fi) => fork.branches.forEach((b) => b.nodes.forEach((n) => {
      if (n.type !== 'reliquary') return;
      if (fi === 3 || fi === 4) inA2++;
      else if (fi === 6 || fi === 7) inA3++;
      else elsewhere++;
    })));
    if (inA2 !== 1 || inA3 !== 1 || elsewhere !== 0) ok = false;
  }
  check('the Reliquary appears exactly twice, in mid-act-2 and mid-act-3 forks', ok);
  check('the Reliquary is never in the rolled node weights',
    NODE_TYPE_WEIGHTS.every(([t]) => t !== 'reliquary'));
}
{
  // Reliquary storefront: unowned relics at rarity prices; gold-gated buys;
  // card removal at the standard price, capped per visit.
  const run = new Run(81);
  run.nodeContent = run._rollNodeContent('reliquary');
  check('reliquary content rolled', run.nodeContent?.type === 'reliquary');
  if (run.nodeContent?.type === 'reliquary') {
    const offers = run.nodeContent.offers;
    // #22: the stock is RELIQUARY_STOCK regular relics plus one cursed offer.
    eq('reliquary stocks 3 relics + 1 cursed', offers.length, RELIQUARY_STOCK + 1);
    const regular = offers.filter((o) => !RELICS[o.relicId].curse);
    const cursed = offers.filter((o) => RELICS[o.relicId].curse);
    eq('exactly one cursed offer', cursed.length, 1);
    eq('the cursed offer costs its flat price', cursed[0].price, CURSE_PRICE);
    check('regular reliquary prices follow rarity', regular.every((o) => o.price === RELIC_PRICE[o.rarity]));
    run.gold = 0;
    check('an empty purse buys nothing', !run.buyRelicOffer(0));
    run.gold = offers[0].price;
    const id = offers[0].relicId;
    check('an affordable relic sells', run.buyRelicOffer(0));
    check('the relic is owned', run.hasRelic(id));
    eq('the offer is consumed', run.nodeContent.offers.length, RELIQUARY_STOCK);
    // Removal: capped at RELIQUARY_REMOVALS_MAX per visit.
    run.gold = CARD_REMOVAL_PRICE * 3;
    const before = run.deck.length;
    check('removal 1 works', run.reliquaryRemoveCard(run.deck[0].uid));
    check('removal 2 works', run.reliquaryRemoveCard(run.deck[0].uid));
    check('removal 3 is refused (per-visit cap)', !run.reliquaryRemoveCard(run.deck[0].uid));
    eq('exactly two cards removed', run.deck.length, before - RELIQUARY_REMOVALS_MAX);
  }
}
{
  // Haggler's Charm discounts every storefront at roll time (floor 5).
  const run = new Run(82);
  run.addRelic('hagglersCharm');
  check('Haggler discounts card-shop prices',
    run.rollCardShop().every((o) => o.price === Math.max(HAGGLER_FLOOR, RARITY_PRICE[o.rarity] - HAGGLER_DISCOUNT)));
  check('Haggler discounts reliquary prices',
    run.rollReliquary().every((o) => o.price === Math.max(HAGGLER_FLOOR,
      (RELICS[o.relicId].curse ? CURSE_PRICE : RELIC_PRICE[o.rarity]) - HAGGLER_DISCOUNT)));
  const plain = new Run(82);
  check('without the Charm prices are full',
    plain.rollCardShop().every((o) => o.price === RARITY_PRICE[o.rarity]));
}
{
  // Exclusion list (Q9): the Lantern is dead once no remaining fight can roll a
  // hidden attack; before that it stays offered.
  const run = new Run(83);
  check('Lantern lives while hidden-capable normals remain', !run.relicExclusions(2).has('lantern'));
  check('Lantern is excluded once only the boss remains', run.relicExclusions(7).has('lantern'));
}
{
  // Relics survive the save/resume roundtrip.
  const run = new Run(84);
  run.addRelic('prayerBeads');
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  check('relics round-trip through a snapshot', restored.hasRelic('prayerBeads'));
}

// --- relics phase B: curses + once-per-run plumbing (issue 22) ----------------
{
  // The Shrine's burden: a random unowned curse plus its payment; never forced.
  const run = new Run(90);
  const goldBefore = run.gold;
  const c1 = run.shrineAcceptCurse();
  check('the shrine hands out a curse', c1 !== null && RELICS[c1].curse === true && run.hasRelic(c1));
  eq('the shrine pays for the burden', run.gold, goldBefore + CURSE_SHRINE_GOLD);
  const c2 = run.shrineAcceptCurse();
  const c3 = run.shrineAcceptCurse();
  check('three distinct curses exist', new Set([c1, c2, c3]).size === 3);
  eq('a fourth burden does not exist', run.shrineAcceptCurse(), null);
  check('the shrine event offers the burden',
    EVENTS.find((e) => e.id === 'shrine')!.choices.some((c) => c.kind === 'shrineCurse'));
}
{
  // Curses are NEVER in spoils, across seeds and both spoils rolls.
  let clean = true;
  for (let seed = 0; seed < 25; seed++) {
    const run = new Run(seed);
    for (const fi of [2, 5]) {
      if (run.rollSpoils(fi).some((o) => RELICS[o.relicId].curse)) clean = false;
    }
  }
  check('spoils never offer a curse', clean);
}
{
  // Once-per-run relic state: spent ids thread into the next BattleConfig and
  // survive the save/resume roundtrip.
  const run = new Run(91);
  run.addRelic('duskChime');
  run.markRelicsSpent(['duskChime']);
  check('spent relics reach the battle config', run.toBattleConfig().spentRelics!.includes('duskChime'));
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  check('spent relics survive the snapshot', restored.spentRelics.includes('duskChime'));
  run.markRelicsSpent(['duskChime']);
  eq('marking twice never duplicates', run.spentRelics.length, 1);
}
{
  // The Rusty Crown pays its bonus on fight wins.
  const run = new Run(92);
  run.addRelic('rustyCrown');
  run.beginRun(); deployAll(run);
  run.winFight();
  eq('the Crown pays extra gold per win', run.gold, NET_GOLD + RUSTY_CROWN_GOLD);
}

// --- difficulty presets + local stats (issue 23) ------------------------------
{
  // Story softens the tuned curve: HP x0.8, attack -1 (floor 0), enrage +2,
  // gold +25/fight. Standard IS the curve. Brutal is dev-only and untuned.
  const std = new Run(95);
  const story = new Run(95, 'story');
  std.beginRun(); deployAll(std); story.beginRun(); deployAll(story);
  const stdCfg = std.toBattleConfig();
  const storyCfg = story.toBattleConfig();
  eq('Story scales enemy HP by 0.8', storyCfg.enemy.maxHP, Math.round(stdCfg.enemy.maxHP * 0.8));
  eq('Story floors the attack bonus at 0', storyCfg.enemy.attackBonus, 0);
  eq('Story delays enrage by 2', storyCfg.enemy.enrageTurn, (stdCfg.enemy.enrageTurn ?? 0) + 2);
  story.winFight();
  eq('Story pads the purse', story.gold, NET_GOLD + DIFFICULTIES.story.goldBonus);
  std.winFight();
  eq('Standard gold is unchanged (net)', std.gold, NET_GOLD);
  check('Standard is the identity preset',
    DIFFICULTIES.standard.hpMult === 1 && DIFFICULTIES.standard.attackDelta === 0
    && DIFFICULTIES.standard.enrageDelta === 0 && DIFFICULTIES.standard.goldBonus === 0);
  check('Brutal hides behind the dev flag', DIFFICULTIES.brutal.devOnly === true);
  eq('a run defaults to Standard', new Run(1).difficulty, 'standard');
  // Difficulty survives the snapshot roundtrip.
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(story.toJSON())));
  eq('difficulty round-trips through a save', restored.difficulty, 'story');
}
{
  // Local stats fold runs per difficulty and track the best act (pure logic).
  let s = emptyStats();
  s = recordRunEnd(s, 'standard', false, 1);
  s = recordRunEnd(s, 'standard', true, 3);
  s = recordRunEnd(s, 'story', true, 3);
  eq('runs counted per difficulty', s.runs.standard, 2);
  eq('wins counted per difficulty', s.wins.standard, 1);
  eq('story wins counted', s.wins.story, 1);
  eq('best act sticks at the maximum', s.bestAct, 3);
  const s2 = recordRunEnd(s, 'standard', false, 2);
  eq('a worse run never lowers the best act', s2.bestAct, 3);
}

// --- hardening batch (issue 24) -----------------------------------------------
{
  // The deck viewer's grouping matches engine-state counts and hides pile order.
  const mk = (id: CardId, uid: number, up: ModifierId[] = []) => ({ uid, id, upgrades: up });
  const pile = [mk('highHeal', 1), mk('ability', 2), mk('highHeal', 3), mk('ability', 4, ['efficient']), mk('regen', 5)];
  const groups = groupPile(pile);
  eq('viewer total matches the pile', groups.reduce((s, g) => s + g.count, 0), pile.length);
  check('same-name cards group', groups.some((g) => g.label === 'Heal' && g.count === 2));
  check('upgraded copies group separately', groups.some((g) => g.label.includes('Efficient') && g.count === 1));
  const sorted = [...groups].sort((a, b) => a.label.localeCompare(b.label));
  eq('viewer output is name-sorted (order never leaks)', JSON.stringify(groups), JSON.stringify(sorted));
}
{
  // The end-of-run score rewards progress and penalizes hoarded gold (flaw #21).
  const run = new Run(96);
  run.beginRun(); deployAll(run);
  run.winFight(); // 1 fight, +40g
  run.addRelic('lantern');
  const s = run.runScore();
  eq('fights score 100 each', s.fights, 100);
  eq('relics score 40 each', s.relics, 40);
  eq('no victory bonus while playing', s.victory, 0);
  eq('hoarded gold costs half a point each', s.goldPenalty, -Math.floor(run.gold / 2));
  eq('the total adds up', s.total, Math.max(0, 100 + 40 + s.goldPenalty));
  run.gold = 100000;
  check('the score floors at zero', run.runScore().total === 0);
}
{
  // Fork previews (flaw #15): the next fight's foe is peekable, deterministic,
  // stream-independent — peeking never disturbs the run's rng position.
  const run = new Run(97);
  const before = run.rng.getState();
  const a = run.peekEncounter(3).id;
  const b = run.peekEncounter(3).id;
  eq('peeking twice gives the same foe', a, b);
  eq('peeking never consumes the rng stream', run.rng.getState(), before);
  check('the preview names a real enemy', ENEMY_DEF_BY_ID[a] !== undefined);
  // Entering the fight later meets exactly the previewed foe.
  run.beginRun(); deployAll(run);
  eq('fight 0 matches its preview', run.currentEnemyDef!.id, new Run(97).peekEncounter(0).id);
}

// --- issue 11: save / resume -----------------------------------------------
{
  // makeRng exposes get/set state and resumes the identical stream.
  const a = makeRng(123);
  for (let i = 0; i < 5; i++) a();      // advance the stream
  const state = a.getState();
  const seq = [a(), a(), a()];
  const b = makeRng(999);               // a different seed...
  b.setState(state);                    // ...restored to a's position
  eq('rng resumes the stream from saved state', JSON.stringify([b(), b(), b()]), JSON.stringify(seq));
}
{
  // Snapshot round-trips through JSON and the resumed run continues the stream.
  const run = new Run(5);
  run.beginRun(); deployAll(run);
  run.winFight();
  run.chooseBranch(0);
  const snap = JSON.parse(JSON.stringify(run.toJSON())); // survive real serialization
  const restored = Run.fromJSON(snap);
  eq('snapshot round-trips', JSON.stringify(restored.toJSON()), JSON.stringify(snap));
  eq('restored rng continues from the saved position', run.rng(), restored.rng());
}
{
  // A save+resume at a boundary produces the same run as never interrupting.
  const finish = (r: Run): void => crossBranch(r);
  const uninterrupted = new Run(9);
  uninterrupted.beginRun(); deployAll(uninterrupted);
  uninterrupted.winFight();
  finish(uninterrupted);

  const resumed = new Run(9);
  resumed.beginRun(); deployAll(resumed);
  resumed.winFight();
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(resumed.toJSON())));
  finish(restored);

  eq('resumed run matches an uninterrupted run of the same seed',
    JSON.stringify(uninterrupted.toJSON()), JSON.stringify(restored.toJSON()));
}

// --- upcomingFightIndex: where a saved location is headed (start-screen resume card)
{
  eq('start heads to fight 0', Run.upcomingFightIndex({ kind: 'start' }), 0);
  eq('a fight is its own fight', Run.upcomingFightIndex({ kind: 'fight', fightIndex: 4 }), 4);
  eq('a fork heads to the next fight', Run.upcomingFightIndex({ kind: 'forkChoice', forkIndex: 4 }), 5);
  eq('a branch hub heads to the next fight', Run.upcomingFightIndex({ kind: 'branch', forkIndex: 2, branch: 1 }), 3);
  eq('a node heads to the next fight',
    Run.upcomingFightIndex({ kind: 'node', forkIndex: 2, branch: 0, index: 1, nodeType: 'event' }), 3);
  eq('the last fork clamps to the final fight', Run.upcomingFightIndex({ kind: 'forkChoice', forkIndex: 8 }), 8);
}

// --- injuries / scars (DR1): accrual, caps, stat penalties, save round-trip ----
{
  // This block exercises the graded-scar model and its 3-scar cap; pin it to 'cap'
  // mode (the module default is now 'death', 2026-07) and restore it at the end.
  INJURY_RULES.mode = 'cap';
  const run = new Run(7);
  eq('party starts unscarred', run.party.every((p) => p.injuries === 0), true);

  // recordInjuries: one scar per death slot, capped at MAX_INJURIES.
  run.recordInjuries([0 as Slot]);
  eq('a death scars the member', run.party[0].injuries, 1);
  run.recordInjuries([0 as Slot, 0 as Slot, 0 as Slot, 0 as Slot]);
  eq('injuries cap at MAX_INJURIES', run.party[0].injuries, MAX_INJURIES);
  eq('untouched members stay unscarred', run.party[1].injuries, 0);

  // Escalating stat penalty flows through toBattleConfig (base − cumulative-by-tier).
  const base = new Run(7);
  const baseCfg = base.toBattleConfig().party;
  base.recordInjuries([2 as Slot]); // Cracked (1st): only HP
  let cfg = base.toBattleConfig().party;
  eq('Cracked cuts max HP', baseCfg[2].maxHP - cfg[2].maxHP, INJURY_MAXHP[0]);
  eq('Cracked leaves damage', cfg[2].damage, baseCfg[2].damage);
  eq('Cracked leaves ability', cfg[2].abilityPower, baseCfg[2].abilityPower);

  base.recordInjuries([2 as Slot]); // Weakened (2nd): + damage
  cfg = base.toBattleConfig().party;
  eq('Weakened cuts damage', baseCfg[2].damage - cfg[2].damage, INJURY_DAMAGE[1]);
  eq('Weakened keeps the HP penalty flat', baseCfg[2].maxHP - cfg[2].maxHP, INJURY_MAXHP[1]);

  base.recordInjuries([2 as Slot]); // Broken (3rd): + ability
  cfg = base.toBattleConfig().party;
  eq('Broken cuts ability power', baseCfg[2].abilityPower - cfg[2].abilityPower, INJURY_ABILITY[2]);

  // Penalties never drive a stat below its floor.
  const frail = new Run(9);
  frail.party[2] = { maxHP: 1, damage: 0, abilityPower: 0, injuries: MAX_INJURIES };
  const fcfg = frail.toBattleConfig().party[2];
  check('max HP floored at 1', fcfg.maxHP >= 1);
  check('damage floored at 0', fcfg.damage >= 0);

  // Injuries survive the save/resume round-trip and don't corrupt the stream.
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(base.toJSON())));
  eq('injuries round-trip through a snapshot', restored.party[2].injuries, MAX_INJURIES);
  eq('snapshot with injuries is byte-stable',
    JSON.stringify(restored.toJSON()), JSON.stringify(base.toJSON()));
  INJURY_RULES.mode = 'death'; // restore the module default
}

// --- deployment: the battle party is a length-3 view of the roster --------------
{
  const run = new Run(3);
  eq('deployment defaults to the first three roster slots',
    JSON.stringify(run.deployment), JSON.stringify([0, 1, 2]));
  const full = run.toBattleConfig().party;
  eq('a full deployment fields 3 members', full.filter((p) => !p.empty).length, 3);

  // Seat only the center slot: the other two battle slots become empty.
  run.deployment = [null, 0, null];
  const solo = run.toBattleConfig().party;
  eq('battle party stays length 3', solo.length, 3);
  check('unseated slots are empty', solo[0].empty === true && solo[2].empty === true);
  check('the seated slot carries the roster member stats',
    solo[1].empty !== true && solo[1].maxHP === run.roster[0].maxHP && solo[1].damage === run.roster[0].damage);

  // deployment (and the empty view) survive save/resume.
  run.deployment = [2, null, 1];
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  eq('deployment round-trips through a snapshot',
    JSON.stringify(restored.deployment), JSON.stringify([2, null, 1]));
  const rcfg = restored.toBattleConfig().party;
  check('a restored unseated slot rebuilds empty', rcfg[1].empty === true);
  eq('a restored seated slot maps to the right roster member', rcfg[0].maxHP, run.roster[2].maxHP);
}

// --- deploy step: choose & seat members; injuries map through the deployment -----
{
  const run = new Run(60);
  run.beginRun(); // trio roster, lands on the deploy step
  eq('beginRun opens the deploy step', run.location.kind, 'deploy');

  // Malformed deployments are refused (the run stays on deploy).
  run.confirmDeployment([null, null, null]);      // nobody deployed
  eq('an empty deployment is refused', run.location.kind, 'deploy');
  run.confirmDeployment([0, 0, null]);            // a roster member seated twice
  eq('a duplicate deployment is refused', run.location.kind, 'deploy');
  run.confirmDeployment([5, null, null]);         // out-of-range roster index
  eq('an out-of-range deployment is refused', run.location.kind, 'deploy');

  // Seat two members in a custom order: roster 2 at Left, roster 0 at Right, Center empty.
  run.confirmDeployment([2, null, 0]);
  eq('a valid deployment enters the fight', run.location.kind, 'fight');
  const cfg = run.toBattleConfig().party;
  eq('battle slot Left holds roster member 2', cfg[0].member, run.roster[2].member);
  check('battle slot Center is empty', cfg[1].empty === true);
  eq('battle slot Right holds roster member 0', cfg[2].member, run.roster[0].member);

  // A death in a battle slot scars the roster member DEPLOYED there (via deployment),
  // not the same-indexed roster member.
  run.recordInjuries([0 as Slot]); // Left slot fell -> roster member 2
  eq('the death scarred the deployed roster member', run.roster[2].injuries, 1);
  eq('an undeployed roster member is unscarred', run.roster[1].injuries, 0);
  eq('the other deployed member is unscarred', run.roster[0].injuries, 0);
}

// --- salaries: deployed members are paid from the win; upgrades/injuries move it -
{
  // memberSalary: base by identity, + per upgrade, − per injury, floored.
  const m = new Run(71).roster[0];
  const base = MEMBER_BASE_SALARY[m.member!];
  eq('base salary reads from the pool', memberSalary(m), base);
  m.upgrades = 2; eq('each upgrade adds to salary', memberSalary(m), base + 2 * SALARY_PER_UPGRADE);
  m.upgrades = 0; m.injuries = 2; eq('each injury lowers salary', memberSalary(m), base - 2 * SALARY_PER_INJURY);
  m.injuries = 99; eq('salary floors at MIN_SALARY', memberSalary(m), MIN_SALARY);

  // deployedSalary sums only the fielded members; a solo deploy pays one salary.
  const run = new Run(70);
  run.beginRun();
  run.confirmDeployment([null, 1, null]); // field only the tank (roster index 1)
  eq('deployedSalary sums only the fielded members', run.deployedSalary(), MEMBER_BASE_SALARY['tank']);
  const before = run.gold;
  run.winFight();
  eq('a solo deployment pays one salary', run.gold, before + GOLD_PER_FIGHT - MEMBER_BASE_SALARY['tank']);

  // Applying a party upgrade bumps the salary counter (so the fee rises next fight).
  const up = new Run(72);
  const u0 = up.roster[0].upgrades ?? 0;
  up.applyPartyUpgrade(0 as Slot, PARTY_UPGRADES[0]);
  eq('a party upgrade raises the salary counter', up.roster[0].upgrades, u0 + 1);

  // Salary can eat into gold but never drives it negative.
  const broke = new Run(73);
  broke.beginRun();
  broke.confirmDeployment([0, 1, 2]);
  broke.gold = 0;
  broke.winFight();
  check('gold never goes negative after salary', broke.gold >= 0);
}

// --- Field Hospital heals free; Infirmary + Mending Totem are retired -----------
{
  // Field Hospital event: heal one scar free (top of the ladder), no-op if unharmed.
  const fh = new Run(13);
  fh.roster[0].injuries = 2;
  check('the Field Hospital tends a scar for free', fh.healInjury(0 as Slot));
  eq('one scar closed, no gold spent', fh.roster[0].injuries, 1);
  eq('the free tend costs nothing', fh.gold, 0);
  check('tending an unharmed member does nothing', !fh.healInjury(1 as Slot));

  // The scar-for-gold Infirmary node and the Mending Totem relic are gone (2026-07).
  check('infirmary is no longer a placeable node type', !NODE_TYPE_WEIGHTS.some(([t]) => (t as string) === 'infirmary'));
  check('Mending Totem is no longer a relic', !RELIC_IDS.includes('mendingTotem' as never));
}

// --- injuries are permanent; the 4th death removes the member from the roster ----
{
  const run = new Run(16);
  run.beginRun(); // trio roster, deployment [0,1,2]
  run.recordInjuries([0 as Slot]); // 1: Cracked
  run.recordInjuries([0 as Slot]); // 2: Weakened
  run.recordInjuries([0 as Slot]); // 3: Broken
  eq('three deaths leave three scars', run.roster[0].injuries, 3);
  const survivor = run.roster[1].member; // roster index 1 (tank) outlives the cull
  const before = run.roster.length;
  run.recordInjuries([0 as Slot]); // 4th death -> permanent removal
  eq('the 4th death removes the member from the roster', run.roster.length, before - 1);
  check('the removed member is gone for good', !run.roster.some((p) => p.member === 'ranger'));
  eq('the survivors keep their identities', run.roster[0].member, survivor);
}

// --- pick-one member draft (2026-07): start + post-boss ---------------------
{
  const run = new Run(20);
  run.beginDraft();
  eq('beginDraft enters the start draft', run.location.kind === 'draft' && run.location.post, 'start');
  check('the start draft clears the default roster', run.roster.length === 0);
  check('the start draft offers solo-viable starters', run.nodeContent?.type === 'draft'
    && run.nodeContent.options.length === DRAFT_OFFER_SIZE
    && run.nodeContent.options.every((id) => STARTER_MEMBERS.includes(id)));

  // Pick one: it joins the roster and the run heads into the deploy step for fight 0.
  const first = (run.nodeContent as { options: MemberId[] }).options[0];
  run.chooseDraftMember(first);
  eq('choosing a starter opens deploy for fight 0', run.location.kind === 'deploy' && run.location.fightIndex, 0);
  eq('the roster now holds one member', run.roster.length, 1);
  eq('the drafted member joined the roster', run.roster[0].member, first);
  // The lone member is deploy-seated by default; the other two battle slots are empty.
  deployAll(run);
  eq('deploying enters fight 0', run.location.kind, 'fight');
  eq('fight 0 fields exactly one member', run.toBattleConfig().party.filter((p) => !p.empty).length, 1);

  // A pick that was never offered (the tank is never a starter) is ignored.
  const bad = new Run(21);
  bad.beginDraft();
  bad.chooseDraftMember('tank');
  eq('a non-offered starter pick is refused', bad.location.kind, 'draft');

  // The offer is deterministic in the run seed (same offer on the same seed).
  const a = new Run(77); a.beginDraft();
  const b = new Run(77); b.beginDraft();
  check('the draft offer is deterministic in the seed',
    JSON.stringify((a.nodeContent as { options: unknown }).options)
      === JSON.stringify((b.nodeContent as { options: unknown }).options));

  // The drafted identity round-trips through a save snapshot (v8) and reaches the
  // fight via toBattleConfig (the 2026-07-04 field-drop regression stays covered).
  const restored = Run.fromJSON(run.toJSON());
  eq('drafted identity survives save/resume', restored.roster[0].member, first);
  eq('toBattleConfig carries the drafted identity', restored.toBattleConfig().party[1].member ?? restored.toBattleConfig().party[0].member, first);
}

// --- post-boss draft: winning an act boss offers a new member ----------------
{
  const run = new Run(40);
  run.beginDraft();
  run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
  // Jump to the act-1 boss and win it: spoils first, then a member draft. (Cast so
  // TS doesn't pin run.location to the fight literal across the mutating calls.)
  run.location = { kind: 'fight', fightIndex: 2 } as RunLocation;
  run.winFight();
  eq('an act boss drops spoils first', run.location.kind, 'spoils');
  run.skipSpoils();
  eq('leaving spoils opens a post-boss draft', run.location.kind === 'draft' && run.location.post, 'boss');
  check('the post-boss draft offers only unowned members', run.nodeContent?.type === 'draft'
    && run.nodeContent.options.length > 0
    && run.nodeContent.options.every((id) => !run.roster.some((p) => p.member === id)));
  const before = run.roster.length;
  run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
  eq('choosing adds to the roster', run.roster.length, before + 1);
  eq('a post-boss draft leads to the fork', run.location.kind, 'forkChoice');
}

// --- Recruit node: add one member, once; hidden when the roster is full -------
{
  const run = new Run(50);
  run.beginDraft();
  run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
  // Enter a synthetic recruit node and roll its offer.
  run.location = { kind: 'node', forkIndex: 0, branch: 0, index: 0, nodeType: 'recruit' };
  run.nodeContent = run._rollNodeContent('recruit');
  check('a recruit node offers unowned members', run.nodeContent?.type === 'recruit'
    && run.nodeContent.options.length > 0
    && run.nodeContent.options.every((id) => !run.roster.some((p) => p.member === id)));

  const before = run.roster.length;
  const opts = (run.nodeContent as { options: MemberId[] }).options;
  run.recruitMember(opts[0]);
  eq('recruiting adds the member', run.roster.length, before + 1);
  check('the recruit node is now spent', run.nodeContent?.type === 'recruit' && run.nodeContent.done);
  // The node resolves once: a second recruit is refused.
  if (opts[1]) run.recruitMember(opts[1]);
  eq('a spent recruit node refuses a second pick', run.roster.length, before + 1);

  // Once the roster holds everyone, a recruit node is unavailable (nothing to offer).
  const full = new Run(51);
  full.roster = partyFromMembers(DRAFT_POOL);
  check('recruit is hidden when the roster is full', !full.nodeAvailable('recruit'));
  check('recruit is available with members left to offer', new Run(52).nodeAvailable('recruit'));
}

// --- injury-mode experiments (2026-07-04 playtest; 'death' added 2026-07) --------
{
  // The shipped default is 'death' (2026-07): the 4th death removes the member.
  eq('default injury mode is death', INJURY_RULES.mode, 'death');
  eq('death mode records up to the death threshold', injuryRecordCap(), INCAPACITATE_AT);
  const dead = new Run(33);
  dead.beginRun(); // deployment [0,1,2]
  const n0 = dead.roster.length;
  for (let i = 0; i < 4; i++) dead.recordInjuries([1 as Slot]); // 4 deaths on roster member 1
  eq('death: the 4th death removes the member from the roster', dead.roster.length, n0 - 1);
  check('death never incapacitates (removal, not a dead slot)', !injuryIncapacitates(INCAPACITATE_AT));

  // 'cap' (the old default): scars stop at MAX_INJURIES, further deaths are free.
  INJURY_RULES.mode = 'cap';
  eq('cap mode records at most MAX_INJURIES', injuryRecordCap(), MAX_INJURIES);
  const run = new Run(30);
  for (let i = 0; i < 6; i++) run.recordInjuries([0 as Slot]);
  eq('cap: six deaths still cap at 3 scars', run.party[0].injuries, 3);
  check('cap never incapacitates', !injuryIncapacitates(3) && !injuryIncapacitates(99));

  // 'escalate': the penalty cycle repeats past 3 (4th −2 HP, 5th −1 dmg, 6th −1 ability).
  INJURY_RULES.mode = 'escalate';
  const esc = new Run(31);
  for (let i = 0; i < 6; i++) esc.recordInjuries([1 as Slot]);
  eq('escalate: scars keep counting', esc.party[1].injuries, 6);
  eq('escalate: maxHP penalty cycles (6 scars = −4)', injuryMaxHPPenalty(6), 4);
  eq('escalate: damage penalty cycles (5 scars = −2)', injuryDamagePenalty(5), 2);
  eq('escalate: ability penalty cycles (6 scars = −2)', injuryAbilityPenalty(6), 2);
  eq('escalate: totals at 3 match the cap tables', injuryMaxHPPenalty(3), INJURY_MAXHP[2]);

  // 'incapacitate': the 4th scar takes the member out; the Infirmary restores them.
  INJURY_RULES.mode = 'incapacitate';
  eq('incapacitate mode records one past the cap', injuryRecordCap(), INCAPACITATE_AT);
  const inc = new Run(32);
  for (let i = 0; i < 6; i++) inc.recordInjuries([2 as Slot]);
  eq('incapacitate: scars stop at INCAPACITATE_AT', inc.party[2].injuries, INCAPACITATE_AT);
  check('the 4th scar incapacitates', injuryIncapacitates(INCAPACITATE_AT));
  check('3 scars do not incapacitate', !injuryIncapacitates(MAX_INJURIES));
  const cfg = inc.toBattleConfig();
  check('toBattleConfig marks the member incapacitated', cfg.party[2].incapacitated === true);
  check('the other members are not incapacitated', !cfg.party[0].incapacitated && !cfg.party[1].incapacitated);
  // Healing one scar restores them (recoverable, like the rest of DR1).
  inc.healInjury(2 as Slot);
  check('healing a scar un-incapacitates', inc.toBattleConfig().party[2].incapacitated === false);
  INJURY_RULES.mode = 'death'; // restore the module default for every later test
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
