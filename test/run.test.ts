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
  DIFFICULTIES, MAX_INJURIES, INJURY_MAXHP, INJURY_DAMAGE, INJURY_ABILITY, INFIRMARY_PRICE,
  DRAFT_PICKS, DRAFT_POOL, rollDraft, draftOfferViable, partyMeetsDraftConstraints, CLASSIC_TRIO,
  CONVENTIONAL_STRIKERS,
} from '../src/constants';
import { shuffle } from '../src/rng';
import { emptyStats, recordRunEnd } from '../src/stats';
import { groupPile } from '../src/deckView';
import type { CardId, ModifierId, Slot } from '../src/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}
function eq(name: string, a: unknown, b: unknown): void { check(name, a === b, `expected ${b}, got ${a}`); }

const uidOf = (run: Run, id: CardId): number => run.deck.find((c) => c.id === id)!.uid;

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
  run.beginRun();
  eq('beginRun -> fight 0', run.location.kind === 'fight' && run.location.fightIndex, 0);
  eq('not boss at fight 0', run.isBossFight, false);
}

// --- progression through the run --------------------------------------------
{
  const run = new Run(3);
  run.beginRun();
  // Win fight 0 -> fork 0, gold awarded.
  run.winFight();
  eq('win fight -> forkChoice', run.location.kind, 'forkChoice');
  eq('gold awarded for fight', run.gold, GOLD_PER_FIGHT);

  // Choose a branch -> first node; complete twice -> next fight.
  run.chooseBranch(0);
  check('branch choice -> node', run.location.kind === 'node' && run.location.index === 0);
  run.completeNode();
  check('node -> second node', run.location.kind === 'node' && run.location.index === 1);
  run.completeNode();
  check('branch end -> fight 1', run.location.kind === 'fight' && run.location.fightIndex === 1);
}
{
  // Drive through all 9 fights: three acts, an act boss at the end of each
  // (fights 2, 5, 8), only the final fight wins the run.
  const run = new Run(4);
  run.beginRun();
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
      // Act-1/2 bosses drop a spoils screen first (#21); skipping it moves on.
      if (isActBoss(f)) {
        check(`win of boss fight ${f} -> spoils`, run.location.kind === 'spoils');
        run.skipSpoils();
      }
      check(`win of fight ${f} -> forkChoice`, run.location.kind === 'forkChoice');
      run.chooseBranch(run.rng() < 0.5 ? 0 : 1);
      run.completeNode();
      run.completeNode();
    }
  }
  eq('act bosses sit at fights 2/5/8', JSON.stringify(bossFights), JSON.stringify([2, 5, 8]));
  eq('reached the final boss fight', run.fightIndex, FIGHT_COUNT - 1);
  eq('gold accrued over 8 non-final fights', gold, GOLD_PER_FIGHT * (FIGHT_COUNT - 1));
  run.winFight();
  eq('beating the final boss wins the run', run.status, 'won');
}
{
  // Enemy HP / enrage turn follow the per-act curve.
  const run = new Run(77);
  run.beginRun();
  const seen: number[] = [];
  const enrage: number[] = [];
  for (let f = 0; f < FIGHT_COUNT; f++) {
    seen.push(run.toBattleConfig().enemy.maxHP);
    enrage.push(run.toBattleConfig().enemy.enrageTurn ?? -1);
    if (f < FIGHT_COUNT - 1) {
      run.winFight();
      if (run.location.kind === 'spoils') run.skipSpoils();
      run.chooseBranch(0);
      run.completeNode();
      run.completeNode();
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
  run.beginRun(); // enters fight 0
  const def = run.currentEnemyDef;
  check('fight 0 has a rolled enemy def', def !== null && def!.boss === false);
  eq('battle config carries the same def', run.toBattleConfig().enemy.def, def);
}

// --- relics phase A: spoils / Reliquary / Haggler (issue 21) -----------------
{
  // Spoils fire after the act-1 boss: 3 free, distinct offers with a rare guaranteed.
  const run = new Run(80);
  run.beginRun();
  for (let f = 0; f < 2; f++) {
    run.winFight();
    run.chooseBranch(0); run.completeNode(); run.completeNode();
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
    eq('spoils -> forkChoice', run.location.kind, 'forkChoice');
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
  run._enterNode('reliquary');
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
  run.beginRun();
  run.winFight();
  eq('the Crown pays extra gold per win', run.gold, GOLD_PER_FIGHT + RUSTY_CROWN_GOLD);
}

// --- difficulty presets + local stats (issue 23) ------------------------------
{
  // Story softens the tuned curve: HP x0.8, attack -1 (floor 0), enrage +2,
  // gold +25/fight. Standard IS the curve. Brutal is dev-only and untuned.
  const std = new Run(95);
  const story = new Run(95, 'story');
  std.beginRun(); story.beginRun();
  const stdCfg = std.toBattleConfig();
  const storyCfg = story.toBattleConfig();
  eq('Story scales enemy HP by 0.8', storyCfg.enemy.maxHP, Math.round(stdCfg.enemy.maxHP * 0.8));
  eq('Story floors the attack bonus at 0', storyCfg.enemy.attackBonus, 0);
  eq('Story delays enrage by 2', storyCfg.enemy.enrageTurn, (stdCfg.enemy.enrageTurn ?? 0) + 2);
  story.winFight();
  eq('Story pads the purse', story.gold, GOLD_PER_FIGHT + DIFFICULTIES.story.goldBonus);
  std.winFight();
  eq('Standard gold is unchanged', std.gold, GOLD_PER_FIGHT);
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
  run.beginRun();
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
  run.beginRun();
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
  run.beginRun();
  run.winFight();
  run.chooseBranch(0);
  const snap = JSON.parse(JSON.stringify(run.toJSON())); // survive real serialization
  const restored = Run.fromJSON(snap);
  eq('snapshot round-trips', JSON.stringify(restored.toJSON()), JSON.stringify(snap));
  eq('restored rng continues from the saved position', run.rng(), restored.rng());
}
{
  // A save+resume at a boundary produces the same run as never interrupting.
  const finish = (r: Run): void => { r.chooseBranch(0); r.completeNode(); r.completeNode(); };
  const uninterrupted = new Run(9);
  uninterrupted.beginRun();
  uninterrupted.winFight();
  finish(uninterrupted);

  const resumed = new Run(9);
  resumed.beginRun();
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
  eq('a node heads to the next fight',
    Run.upcomingFightIndex({ kind: 'node', forkIndex: 2, branch: 0, index: 1, nodeType: 'event' }), 3);
  eq('the last fork clamps to the final fight', Run.upcomingFightIndex({ kind: 'forkChoice', forkIndex: 8 }), 8);
}

// --- injuries / scars (DR1): accrual, caps, stat penalties, save round-trip ----
{
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
}

// --- Infirmary node (DR1): clear scars for gold, top of the ladder first --------
{
  // The Infirmary is a real weighted node (unlike the injected Reliquary).
  check('infirmary is a placeable node type', NODE_TYPE_WEIGHTS.some(([t]) => t === 'infirmary'));

  const run = new Run(11);
  run._enterNode('infirmary');
  eq('infirmary content rolls', run.nodeContent?.type, 'infirmary');
  if (run.nodeContent?.type === 'infirmary') eq('infirmary price is the flat rate', run.nodeContent.price, INFIRMARY_PRICE);

  // A member with all three scars, and enough gold for two clears.
  run.party[0].injuries = MAX_INJURIES;
  run.gold = INFIRMARY_PRICE * 2;

  check('treating clears one scar (top of the ladder)', run.clearInjuryForGold(0 as Slot));
  eq('one scar healed', run.party[0].injuries, MAX_INJURIES - 1);
  eq('the flat price was charged', run.gold, INFIRMARY_PRICE);

  check('a second treatment works while gold lasts', run.clearInjuryForGold(0 as Slot));
  eq('scars keep coming off, one per payment', run.party[0].injuries, MAX_INJURIES - 2);
  eq('purse is spent to zero', run.gold, 0);

  check('an empty purse treats nothing', !run.clearInjuryForGold(0 as Slot));
  eq('the refused treatment left the scar', run.party[0].injuries, MAX_INJURIES - 2);

  // Unscarred members and non-infirmary nodes are refused without charge.
  run.gold = INFIRMARY_PRICE;
  check('an unharmed member is refused', !run.clearInjuryForGold(1 as Slot));
  eq('no gold lost refusing the unharmed', run.gold, INFIRMARY_PRICE);
  run.nodeContent = { type: 'cardShop', offers: [] };
  check('clearing off an infirmary is refused', !run.clearInjuryForGold(0 as Slot));

  // Haggler's Charm discounts the infirmary price like any other.
  const haggled = new Run(12);
  haggled.addRelic('hagglersCharm');
  haggled._enterNode('infirmary');
  if (haggled.nodeContent?.type === 'infirmary') {
    eq('Haggler discounts the infirmary', haggled.nodeContent.price, INFIRMARY_PRICE - HAGGLER_DISCOUNT);
  }

  // Field Hospital event: heal one scar free (top of the ladder), no-op if unharmed.
  const fh = new Run(13);
  fh.party[0].injuries = 2;
  check('the Field Hospital tends a scar for free', fh.healInjury(0 as Slot));
  eq('one scar closed, no gold spent', fh.party[0].injuries, 1);
  eq('the free tend costs nothing', fh.gold, 0);
  check('tending an unharmed member does nothing', !fh.healInjury(1 as Slot));

  // Mending Totem relic: after a victory, the most-injured member sheds one scar.
  const totem = new Run(14);
  totem.addRelic('mendingTotem');
  totem.party[0].injuries = 1;
  totem.party[2].injuries = 3; // the most injured
  totem.location = { kind: 'fight', fightIndex: 0 };
  totem.winFight();
  eq('the Totem mends the most-injured member', totem.party[2].injuries, 2);
  eq('the Totem leaves the less-injured alone', totem.party[0].injuries, 1);

  // Inert without the relic: a plain victory mends nothing.
  const noTotem = new Run(15);
  noTotem.party[1].injuries = 2;
  noTotem.location = { kind: 'fight', fightIndex: 0 };
  noTotem.winFight();
  eq('without the Totem, victory mends nothing', noTotem.party[1].injuries, 2);
}

// --- draft skeleton (#27) ---------------------------------------------------
{
  const run = new Run(20);
  run.beginDraft();
  eq('beginDraft enters the draft location', run.location.kind, 'draft');
  check('draft offers three 1-of-2 pairs', run.nodeContent?.type === 'draft'
    && run.nodeContent.pairs.length === DRAFT_PICKS
    && run.nodeContent.pairs.every((p) => p.length === 2));

  // Seat a drafted party and confirm it opens fight 0 with those members.
  run.chooseDraft(['warlock', 'tank', 'skald']);
  eq('chooseDraft opens the first fight', run.location.kind, 'fight');
  eq('slot 0 is the drafted Warlock', run.party[0].member, 'warlock');
  eq('slot 2 is the drafted Skald', run.party[2].member, 'skald');

  // A malformed pick (wrong size / unknown id) is ignored — the run can't wedge.
  const bad = new Run(21);
  bad.beginDraft();
  bad.chooseDraft(['warlock', 'tank'] as never);      // too few
  eq('a short draft pick is refused', bad.location.kind, 'draft');
  bad.chooseDraft(['warlock', 'tank', 'ranger', 'mage'] as never); // too many
  eq('an over-long draft pick is refused', bad.location.kind, 'draft');

  // The classic trio path seats the demo party (returning players lose nothing).
  const trio = new Run(22);
  trio.beginDraft();
  trio.chooseDraft(['ranger', 'tank', 'mage']);
  eq('classic trio drafts into a fight', trio.location.kind, 'fight');
  eq('classic draft seats the ranger in slot 0', trio.party[0].member, 'ranger');

  // A drafted run round-trips through a save snapshot (v6 carries member identity).
  const drafted = new Run(23);
  drafted.beginDraft();
  drafted.chooseDraft(['warlock', 'mage', 'skald']);
  const restored = Run.fromJSON(drafted.toJSON());
  eq('drafted identity survives save/resume', restored.party[0].member, 'warlock');
  eq('drafted skald survives save/resume', restored.party[2].member, 'skald');
}

// --- full draft generator constraints (#30) ---------------------------------
{
  // The generator always offers a viable party, uses distinct members with no
  // repeats across pairs, across many seeds.
  let allViable = true, allDistinct = true;
  for (let seed = 1; seed <= 500; seed++) {
    const pairs = rollDraft(shuffle([...DRAFT_POOL], makeRng(seed)));
    if (!draftOfferViable(pairs)) allViable = false;
    const flat = pairs.flat();
    if (new Set(flat).size !== flat.length) allDistinct = false;
    if (pairs.length !== DRAFT_PICKS || pairs.some((p) => p.length !== 2)) allDistinct = false;
  }
  check('every rolled draft offers a viable party', allViable);
  check('draft pairs use distinct members (no repeats)', allDistinct);

  // The viability bar itself: the classic trio clears it; a triple of the weakest
  // members (all rated 2, none "strong") does not.
  check('the classic trio meets the draft bar', partyMeetsDraftConstraints(CLASSIC_TRIO));
  check('an all-weak party fails the strong-damage floor', !partyMeetsDraftConstraints(['tank', 'berserker', 'tank']));
  check('a low-total party fails the damage floor',
    !partyMeetsDraftConstraints(['tank', 'berserker', 'berserker']));
  // Two self-reliant members + one healable fails the healable floor.
  check('too few healable members fails the bar', !partyMeetsDraftConstraints(['warlock', 'berserker', 'mage']));
  // #31 striker requirement: a comp with no conventional striker fails even when the
  // damage sum and healable count pass (the #31 sweep showed these floor out).
  check('a striker-less party fails the bar', !partyMeetsDraftConstraints(['tank', 'berserker', 'graveAugur']));
  check('every certified-viable offer contains a striker (500 seeds)', (() => {
    for (let seed = 1; seed <= 500; seed++) {
      const pairs = rollDraft(shuffle([...DRAFT_POOL], makeRng(seed)));
      // At least one assemblable party is viable AND every viable one has a striker.
      const combos = pairs.reduce<string[][]>((acc, pr) => acc.flatMap((pre) => pr.map((id) => [...pre, id])), [[]]);
      const viable = combos.filter((c) => partyMeetsDraftConstraints(c as never));
      if (viable.length === 0) return false;
      if (!viable.every((c) => c.some((id) => CONVENTIONAL_STRIKERS.has(id as never)))) return false;
    }
    return true;
  })());

  // beginDraft is deterministic in the run seed (same offer on the same seed).
  const a = new Run(77); a.beginDraft();
  const b = new Run(77); b.beginDraft();
  check('the draft offer is deterministic in the seed',
    JSON.stringify((a.nodeContent as { pairs: unknown }).pairs) === JSON.stringify((b.nodeContent as { pairs: unknown }).pairs));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
