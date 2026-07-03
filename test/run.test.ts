// Run-layer test harness. Run with: tsx test/run.test.ts
import { Run } from '../src/run';
import { makeRng } from '../src/rng';
import {
  FIGHT_COUNT, FORK_COUNT, BRANCHES_PER_FORK, NODES_PER_BRANCH, NON_FIGHT_NODES,
  GOLD_PER_FIGHT, SHOP_SIZE, RARITY_PRICE, CARD_RARITY, MODIFIERS, DEFAULT_HEALER,
  defaultDeck, MAX_UPGRADE_SLOTS, EVENTS, ENEMY_HP_BY_FIGHT, ENEMY_ENRAGE_TURN_BY_FIGHT,
  CARD_POOL, PARTY_UPGRADES, HEALER_UPGRADES, PASSIVE_MP_CAP, CARD_REMOVAL_PRICE, CASINO_SAFE_GOLD,
  NORMAL_ENEMY_DEFS, ENEMY_DEF_BY_ID, isActBoss, actOfFight, ACT_BOSS_DEFS, FIGHTS_PER_ACT, ACT_COUNT,
} from '../src/constants';
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
  // Event catalog & rollEvent stay within the defined set.
  eq('three sample events', EVENTS.length, 3);
  const ids = new Set(EVENTS.map((e) => e.id));
  let inSet = true;
  for (let seed = 0; seed < 30; seed++) {
    const e = new Run(seed).rollEvent();
    if (!ids.has(e.id)) inSet = false;
  }
  check('rollEvent always returns a defined event', inSet);
  check('every event has 2-3 choices', EVENTS.every((e) => e.choices.length >= 2 && e.choices.length <= 3));
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
    Array.from({ length: FIGHT_COUNT }, (_, fi) => new Run(seed).rollEncounter(fi).id);
  eq('encounter roll deterministic by seed', JSON.stringify(idsFor(7)), JSON.stringify(idsFor(7)));
  const ids = idsFor(7);
  for (let fi = 0; fi < FIGHT_COUNT; fi++) {
    if (isActBoss(fi)) eq(`fight ${fi} (act boss) uses its act boss def`, ids[fi], ACT_BOSS_DEFS[actOfFight(fi)].id);
    else check(`fight ${fi} is a named normal`, ENEMY_DEF_BY_ID[ids[fi]] !== undefined);
  }
  eq('Act-1 boss is the Gatewarden', ids[2], 'gatewarden');
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
