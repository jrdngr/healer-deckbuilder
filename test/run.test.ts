// Run-layer test harness. Run with: tsx test/run.test.ts
import { Run, RUN_SAVE_VERSION } from '../src/run';
import { makeRng } from '../src/rng';
import {
  FIGHT_COUNT, FORK_COUNT, BRANCHES_PER_FORK, NODES_PER_BRANCH, NON_FIGHT_NODES,
  GOLD_PER_FIGHT, EMPTY_SEAT_GOLD_BONUS, SHOP_SIZE, RARITY_PRICE, CARD_RARITY, MODIFIERS, DEFAULT_HEALER,
  defaultDeck, MAX_UPGRADE_SLOTS, EVENTS, ENEMY_HP_BY_FIGHT, ENEMY_ENRAGE_TURN_BY_FIGHT,
  CARD_POOL, PARTY_UPGRADES, HEALER_UPGRADES, PASSIVE_MP_CAP, CARD_REMOVAL_PRICE, CASINO_SAFE_GOLD,
  CURSED_CHEST_GOLD, MERCENARY_PRICE, MERCENARY_DAMAGE, DUPLICATE_PRICE,
  BLOOD_ALTAR_HP, BLOOD_ALTAR_DAMAGE, BLOOD_ALTAR_MIN_HP,
  SPOILS_OFFER_SIZE, CARD_REWARD_SIZE, RELIQUARY_STOCK, RELIQUARY_REMOVALS_MAX, RELIC_PRICE,
  HAGGLER_DISCOUNT_PCT, NODE_TYPE_WEIGHTS, RELICS, CURSE_PRICE, CURSE_SHRINE_GOLD, RUSTY_CROWN_GOLD,
  NORMAL_ENEMY_DEFS, ENEMY_DEF_BY_ID, isActBoss, actOfFight, ACT_BOSS_DEFS, FIGHTS_PER_ACT, ACT_COUNT,
  MAX_INJURIES, INJURY_MAXHP, INJURY_DAMAGE, INJURY_ABILITY, RELIC_IDS,
  DRAFT_POOL, partyFromMembers, DRAFT_OFFER_SIZE, isAbilityCard, LEARNED_CARDS_BY_MEMBER, abilityCardsForParty,
  memberSalary, MEMBER_BASE_SALARY, SALARY_PER_UPGRADE, SALARY_PER_INJURY, MIN_SALARY,
  INJURY_RULES, INCAPACITATE_AT, DEATH_AT, injuryRecordCap, injuryIncapacitates,
  injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty,
  HERO_HEAL_PCT, INFIRMARY_HP_PRICE, INFIRMARY_INJURY_PRICE,
  SURGEON_THREAD_HEAL_PCT, BEGGARS_BOWL_GOLD, BEGGARS_BOWL_REWARD_SIZE,
  STARTER_DECKS, STARTER_DECK_IDS, DEFAULT_STARTER_DECK, buildStandardDeck, DRAFT_BASE_HEALS, STARTER_DRAFT_PICKS, DECK_LIST,
} from '../src/constants';
import type { RunLocation } from '../src/run';
import { emptyStats, recordRunEnd } from '../src/stats';
import { groupPile } from '../src/deckView';
import type { CardId, ModifierId, Slot, MemberId, RelicId } from '../src/constants';

import { check, eq, finish } from './harness';

const uidOf = (run: Run, id: CardId): number => run.deck.find((c) => c.id === id)!.uid;

// Cross the current fork: take a branch, visit every open stop once (a closed
// Infirmary is skipped — enterNode refuses it and completeNode then no-ops),
// and head on to the next fight.
// Pass through the pre-fight deploy step (2026-07) with the default seating. Tests
// that care about deployment set it explicitly via confirmDeployment.
const deployAll = (run: Run): void => {
  if (run.location.kind === 'deploy') run.confirmDeployment(run.deployment);
};

// Enter fight 0 with the constructor's default trio roster — a test convenience that
// replaces the removed quick-play (the real game always drafts). Used by progression
// tests that just need a run standing at a fight with a known party.
const startRun = (run: Run): void => {
  run._enterDeploy(0);
  run.confirmDeployment(run.deployment);
};

const crossBranch = (run: Run, branch = 0): void => {
  // Every won fight now opens a free card reward (#57), and act bosses still drop
  // spoils, both BEFORE the fork. Skip whichever sits in front so a progression
  // helper reaches the fork regardless of what the win produced.
  if (run.location.kind === 'cardReward') run.skipCardReward();
  if (run.location.kind === 'spoils') run.skipSpoils();
  // Act bosses also drop a free healer boon after spoils (#83), before the fork.
  if (run.location.kind === 'healerBoon') run.skipHealerBoon();
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
{
  // #56 recruiter cadence: the fork that begins each fight cycle — after the first
  // fight (fork 0) and after each act boss (forks 2 and 5) — always contains a
  // Recruit node, so the "who joins" beat is predictable and roster growth is no
  // longer a structural coin flip. Sweep many seeds; every cadence fork guarantees a
  // recruiter, and the injection never breaks fork uniqueness (checked below).
  const cadenceForks = [0, 2, 5];
  let everyCadenceForkHasRecruit = true;
  for (let seed = 1; seed <= 300; seed++) {
    const map = new Run(seed).map;
    for (const fi of cadenceForks) {
      const has = map[fi].branches.some((br) => br.nodes.some((n) => n.type === 'recruit'));
      if (!has) everyCadenceForkHasRecruit = false;
    }
  }
  check('every run guarantees a Recruit in each cadence fork (0, 2, 5)', everyCadenceForkHasRecruit);
}

// --- initial state ----------------------------------------------------------
{
  const run = new Run(1);
  eq('starts on the map (start screen)', run.location.kind, 'start');
  eq('starts with 0 gold', run.gold, 0);
  eq('starts with default deck size', run.deck.length, defaultDeck().length);
  eq('default healer maxMana', run.healer.maxMana, DEFAULT_HEALER.maxMana);
  // startRun (default trio) enters the first fight.
  startRun(run);
  eq('startRun -> fight 0', run.location.kind === 'fight' && run.location.fightIndex, 0);
  eq('not boss at fight 0', run.isBossFight, false);
}

// --- progression through the run --------------------------------------------
{
  const run = new Run(3);
  startRun(run);
  // Win fight 0 -> card reward (#57) -> fork 0, gold awarded.
  run.winFight();
  eq('win fight -> card reward first (#57)', run.location.kind, 'cardReward');
  run.skipCardReward();
  eq('leaving the card reward -> forkChoice', run.location.kind, 'forkChoice');
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
  startRun(run);
  run.winFight();
  run.skipCardReward(); // clear the post-win card reward (#57) to reach the fork
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
  startRun(run);
  run.winFight();
  run.skipCardReward(); // #57
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

// --- branch hub: an un-openable stop is swapped, never left blank ---------------
{
  const run = new Run(32);
  startRun(run);
  run.winFight();
  run.skipCardReward(); // #57
  // A branch that would otherwise present a Recruiter the full roster can't open (the
  // recruiter cadence can force one) — the hub must not show a blank/missing stop.
  run.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  run.roster = partyFromMembers(DRAFT_POOL); // full roster: the recruit stop can't open
  run.chooseBranch(0);
  const nodes = run.map[0].branches[0].nodes;
  check('the un-openable recruit stop is swapped away', nodes[0].type !== 'recruit');
  check('the swap keeps the branch stops distinct', nodes[0].type !== nodes[1].type);
  check('every stop on the chosen branch is now openable', nodes.every((n) => run.nodeAvailable(n.type)));
}

// --- branch hub: an openable stop is left untouched ----------------------------
{
  const run = new Run(32);
  startRun(run);
  run.winFight();
  run.skipCardReward(); // #57
  run.roster = partyFromMembers(['ranger', 'tank']); // room to recruit -> the stop stays
  run.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  run.chooseBranch(0);
  const nodes = run.map[0].branches[0].nodes;
  check('an openable recruit stop survives untouched', nodes[0].type === 'recruit' && nodes[1].type === 'event');
}

// --- roster cap of 3: recruiting appends until full, then REPLACES --------------
{
  const run = new Run(50);
  startRun(run);
  run.winFight();
  run.skipCardReward();
  run.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  run.roster = partyFromMembers(['ranger']); // room to grow
  run.chooseBranch(0);
  run.enterNode(0);
  const opts = run.nodeContent?.type === 'recruit' ? run.nodeContent.options : [];
  run.recruitMember(opts[0]);
  check('recruiting with room appends the hero',
    run.roster.length === 2 && run.roster.some((p) => p.member === opts[0]));
}

// --- a full roster (cap 3) keeps the Recruiter open and swaps a member -----------
{
  const run = new Run(32);
  startRun(run);
  run.winFight();
  run.skipCardReward();
  run.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  run.roster = partyFromMembers(['ranger', 'tank', 'mage']); // FULL (ROSTER_CAP = 3)
  run.chooseBranch(0);
  check('a full-cap roster keeps the recruit stop open (replace path)', run.nodeAvailable('recruit'));
  run.enterNode(0);
  const opts = run.nodeContent?.type === 'recruit' ? run.nodeContent.options : [];
  const newHero = opts[0];
  // A full roster with no replacement chosen must be a no-op (can't grow past the cap).
  run.recruitMember(newHero);
  check('recruiting at a full roster without a replacement is refused',
    run.roster.length === 3 && !run.roster.some((p) => p.member === newHero)
    && run.nodeContent?.type === 'recruit' && !run.nodeContent.done);
  // Choosing a slot to release swaps exactly one member.
  run.recruitMember(newHero, 1); // release the Tank (index 1)
  check('replacing swaps exactly one member (roster still 3)',
    run.roster.length === 3 && run.roster.some((p) => p.member === newHero)
    && !run.roster.some((p) => p.member === 'tank'));
  check('the dismissed hero returns to the recruit pool', run.availableMembers().includes('tank'));
  check('a completed replace spends the node',
    run.nodeContent?.type === 'recruit' && run.nodeContent.done);
}

// --- Training Dojo: learn a hero ability card for free --------------------------
{
  const run = new Run(70);
  startRun(run);
  run.winFight(); run.skipCardReward();
  run.map[0].branches[0].nodes = [{ type: 'dojo' }, { type: 'event' }];
  run.roster = partyFromMembers(['ranger', 'tank', 'mage']); // full party
  run.chooseBranch(0);
  check('the Dojo is open while heroes have cards to learn', run.nodeAvailable('dojo'));
  run.enterNode(0);
  const offers = run.nodeContent?.type === 'dojo' ? run.nodeContent.offers : [];
  eq('a full party is offered one card per hero', offers.length, 3);
  check('each offer is a real unlearned ability for its hero',
    offers.every((o) => (LEARNED_CARDS_BY_MEMBER[o.member] ?? []).includes(o.ability)));
  check('the offered heroes are distinct at a full party', new Set(offers.map((o) => o.member)).size === 3);
  const pick = offers[0];
  run.learnAbility(pick.member, pick.ability);
  const learner = run.roster.find((p) => p.member === pick.member)!;
  check('the hero keeps the learned ability', (learner.learned ?? []).includes(pick.ability));
  check('the Dojo is spent after a pick', run.nodeContent?.type === 'dojo' && run.nodeContent.done);
}
{
  // A lone hero is offered BOTH of their cards; a two-hero party fills up to three.
  const solo = new Run(71);
  startRun(solo); solo.winFight(); solo.skipCardReward();
  solo.map[0].branches[0].nodes = [{ type: 'dojo' }, { type: 'event' }];
  solo.roster = partyFromMembers(['mage']);
  solo.chooseBranch(0); solo.enterNode(0);
  const soloOffers = solo.nodeContent?.type === 'dojo' ? solo.nodeContent.offers : [];
  eq('a lone hero is offered both of their cards', soloOffers.length, 2);
  check('both offers belong to that hero', soloOffers.every((o) => o.member === 'mage'));

  const duo = new Run(73);
  startRun(duo); duo.winFight(); duo.skipCardReward();
  duo.map[0].branches[0].nodes = [{ type: 'dojo' }, { type: 'event' }];
  duo.roster = partyFromMembers(['ranger', 'tank']);
  duo.chooseBranch(0); duo.enterNode(0);
  const duoOffers = duo.nodeContent?.type === 'dojo' ? duo.nodeContent.offers : [];
  eq('two heroes fill up to three offers', duoOffers.length, 3);
}
{
  // The Dojo hides once every roster member has learned everything it can teach them.
  const run = new Run(72);
  const roster = partyFromMembers(['ranger']);
  roster[0].learned = [...(LEARNED_CARDS_BY_MEMBER['ranger'] ?? [])];
  run.roster = roster;
  check('a fully-taught roster hides the Dojo', !run.nodeAvailable('dojo'));
}
{
  // A learned card injects on deploy alongside the signature (abilityCardsForParty).
  const roster = partyFromMembers(['ranger', 'tank', 'mage']);
  roster[0].learned = ['twinShot'];
  const cards = abilityCardsForParty(roster);
  check('the learned card injects next to the signature',
    cards.some((c) => c.id === 'twinShot') && cards.some((c) => c.id === 'imbuePoison'));
}

// --- #77: fork availability is resolved for EVERY branch at fork-entry ----------
{
  // Repro (intake 2026-07-10, seed 216002962): after the first fight the roster is a
  // single ranger at full HP, and fork 0 branch 0 rolled [cardShop, infirmary]. The
  // Infirmary is hidden (nobody hurt), which used to leave that branch showing a
  // single stop and an empty slot. Drive the real flow to the first fork and assert
  // every branch of fork 0 now exposes exactly NODES_PER_BRANCH enterable stops.
  const run = new Run(216002962);
  run.beginDraft();
  run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]); // 'ranger'
  run.confirmDeployment(run.deployment);
  run.winFight();
  run.skipCardReward(); // -> _enterForkChoice(0)
  check('the repro run reaches the fork', run.location.kind === 'forkChoice');
  check('the repro roster is a single full-HP hero (nobody needs the Infirmary)',
    run.roster.length === 1 && !run.anyoneNeedsInfirmary());
  let allShow = true, allDistinct = true;
  for (const branch of run.map[0].branches) {
    const avail = branch.nodes.filter((n) => run.nodeAvailable(n.type));
    if (avail.length !== NODES_PER_BRANCH) allShow = false;
    if (new Set(branch.nodes.map((n) => n.type)).size !== branch.nodes.length) allDistinct = false;
  }
  check('seed 216002962: every fork-0 branch shows NODES_PER_BRANCH enterable stops', allShow);
  check('seed 216002962: rerolled branches stay distinct within the branch', allDistinct);
}
{
  // Worst case: a branch rolled [infirmary, recruit] with a healthy, full roster —
  // BOTH types unavailable, which used to render a fully blank branch. After the
  // fork is reached both slots are rerolled into enterable, distinct types.
  const run = new Run(32);
  startRun(run);
  run.winFight();               // -> cardReward
  run.map[0].branches[0].nodes = [{ type: 'infirmary' }, { type: 'recruit' }];
  run.roster = partyFromMembers(DRAFT_POOL); // full roster, all full-HP: both stops closed
  run.skipCardReward();         // -> _enterForkChoice(0) resolves all branches up front
  const nodes = run.map[0].branches[0].nodes;
  check('worst-case: the infirmary slot is rerolled away', nodes[0].type !== 'infirmary');
  check('worst-case: the recruit slot is rerolled away', nodes[1].type !== 'recruit');
  check('worst-case: both slots are now enterable', nodes.every((n) => run.nodeAvailable(n.type)));
  check('worst-case: the two rerolled stops are distinct', nodes[0].type !== nodes[1].type);
}
{
  // State-dependence: resolution runs against the LIVE state at fork-entry. A hurt
  // party keeps its Infirmary, and a non-full roster keeps its Recruit — neither is
  // rerolled away.
  const run = new Run(32);
  startRun(run);
  run.winFight();
  run.map[0].branches[0].nodes = [{ type: 'infirmary' }, { type: 'recruit' }];
  run.roster = partyFromMembers(['ranger', 'tank']); // room to recruit
  run.roster[0].hp = 1;                               // someone is hurt
  run.skipCardReward();
  const nodes = run.map[0].branches[0].nodes;
  check('state-dependence: a hurt party keeps its Infirmary', nodes[0].type === 'infirmary');
  check('state-dependence: a non-full roster keeps its Recruit', nodes[1].type === 'recruit');
}
{
  // Idempotence: the up-front pass resolves once. chooseBranch on the resolved fork
  // changes nothing and draws no further rng (already-available nodes consume none).
  const run = new Run(216002962);
  run.beginDraft();
  run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
  run.confirmDeployment(run.deployment);
  run.winFight();
  run.skipCardReward(); // -> forkChoice, all branches resolved
  const before = run.map[0].branches.map((b) => b.nodes.map((n) => n.type).join(','));
  const rngBefore = run.rng.getState();
  run.chooseBranch(0);
  const after = run.map[0].branches.map((b) => b.nodes.map((n) => n.type).join(','));
  check('idempotence: chooseBranch does not change the resolved node types', before.join('|') === after.join('|'));
  check('idempotence: chooseBranch draws no extra rng after the entry pass', run.rng.getState() === rngBefore);
}

// --- end-of-fight gold burst: the bounty preview matches what winFight banks ----
{
  const run = new Run(70);
  startRun(run); // location: fight 0, default trio deployed
  const before = run.gold;
  const preview = run.winBountyPreview();
  run.winFight();
  const gained = run.gold - before;
  eq('winBountyPreview.playerGold matches the actual win gold delta', preview.playerGold, gained);
  eq('winBountyPreview lists one salary share per deployed member', preview.salaries.length, 3);

  // The final boss pays no bounty, so the burst is skipped there.
  const boss = new Run(71);
  boss.location = { kind: 'fight', fightIndex: FIGHT_COUNT - 1 };
  const bossPreview = boss.winBountyPreview();
  check('the final boss preview is empty (no bounty burst)',
    bossPreview.playerGold === 0 && bossPreview.salaries.length === 0);
}

// --- branch hub: a mid-branch save/resume keeps the cached stops ---------------
{
  const run = new Run(33);
  startRun(run);
  run.winFight();
  run.skipCardReward(); // #57
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
  startRun(run);
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
      // Every won fight opens a free card reward first (#57), before spoils/fork.
      check(`win of fight ${f} -> card reward first (#57)`, run.location.kind === 'cardReward');
      run.skipCardReward();
      // Act-1/2 bosses then drop a spoils screen (#21); leaving it goes straight to
      // the fork now that the post-boss draft is gone (#56 — recruitment is the node).
      if (isActBoss(f)) {
        check(`win of boss fight ${f} -> spoils`, run.location.kind === 'spoils');
        run.skipSpoils();
        // Spoils now flows into the free healer boon (#83), then the fork.
        check(`boss ${f} spoils -> healerBoon (#83)`, run.location.kind === 'healerBoon');
        run.skipHealerBoon();
        check(`boss ${f} boon -> forkChoice`, run.location.kind === 'forkChoice');
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

// --- #57: free card reward after every won fight ----------------------------
{
  // A won fight opens a 3-card, rarity-weighted, FREE reward; picking one adds it
  // to the deck and ends the step onto the fork.
  const run = new Run(202);
  startRun(run);
  const deckBefore = run.deck.length;
  run.winFight();
  eq('a won fight opens a card reward', run.location.kind, 'cardReward');
  check('the reward content is a cardReward offer set', run.nodeContent?.type === 'cardReward');
  if (run.nodeContent?.type === 'cardReward') {
    const offers = run.nodeContent.offers;
    eq('three cards offered', offers.length, CARD_REWARD_SIZE);
    check('offers are distinct', new Set(offers.map((o) => o.cardId)).size === offers.length);
    check('the reward is free', offers.every((o) => o.price === 0));
    check('offer rarity tags match the card rarity map', offers.every((o) => o.rarity === CARD_RARITY[o.cardId]));
    const want = offers[1].cardId;
    const picked = run.pickCardReward(1);
    eq('picking returns the chosen card', picked, want);
    eq('the picked card is added to the deck', run.deck.length, deckBefore + 1);
    check('the newest deck card is the pick', run.deck[run.deck.length - 1].id === want);
    eq('the pick ends the step -> forkChoice', run.location.kind, 'forkChoice');
  }
}
{
  // Deterministic per seed and per-fight sub-seed: same seed -> same offers, and
  // rollCardReward reads a sub-seed, so it never disturbs the run's rng stream.
  const a = new Run(303); const b = new Run(303);
  eq('same seed -> identical reward offers',
    JSON.stringify(a.rollCardReward(0)), JSON.stringify(b.rollCardReward(0)));
  const before = a.rng.getState();
  a.rollCardReward(4);
  eq('rolling the reward consumes no run rng (sub-seeded)', a.rng.getState(), before);
  check('different fights roll independent offers',
    JSON.stringify(a.rollCardReward(0)) !== JSON.stringify(a.rollCardReward(5)));
}
{
  // Skippable (mirrors spoils): skipping adds nothing and still advances.
  const run = new Run(404);
  startRun(run);
  const deckBefore = run.deck.length;
  run.winFight();
  run.skipCardReward();
  eq('skipping the reward adds no card', run.deck.length, deckBefore);
  eq('skipping still advances to the fork', run.location.kind, 'forkChoice');
}
{
  // Boss order (#57 + #21): the card reward comes first, THEN relic spoils.
  const run = new Run(505);
  run.beginDraft();
  run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
  run.location = { kind: 'fight', fightIndex: 2 } as RunLocation; // act-1 boss
  run.winFight();
  eq('boss win opens the card reward first', run.location.kind, 'cardReward');
  run.pickCardReward(0);
  eq('leaving the card reward reaches boss spoils', run.location.kind, 'spoils');
  check('spoils rolled after the card reward', run.nodeContent?.type === 'spoils');
}
{
  // Save/resume mid-choice: the rolled offer survives the snapshot, and resuming
  // then picking still lands a card.
  const run = new Run(606);
  startRun(run);
  run.winFight();
  const offers = run.nodeContent?.type === 'cardReward' ? run.nodeContent.offers : [];
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  eq('a mid-choice snapshot round-trips byte-stable',
    JSON.stringify(restored.toJSON()), JSON.stringify(run.toJSON()));
  check('the resumed run is still at the card reward', restored.location.kind === 'cardReward');
  check('the resumed offer matches the saved offer',
    restored.nodeContent?.type === 'cardReward'
    && JSON.stringify(restored.nodeContent.offers) === JSON.stringify(offers));
  const deckBefore = restored.deck.length;
  restored.pickCardReward(0);
  eq('resuming then picking adds the card', restored.deck.length, deckBefore + 1);
}
{
  // Enemy HP / enrage turn follow the per-act curve.
  const run = new Run(77);
  startRun(run);
  const seen: number[] = [];
  const enrage: number[] = [];
  for (let f = 0; f < FIGHT_COUNT; f++) {
    seen.push(run.toBattleConfig().enemy.maxHP);
    enrage.push(run.toBattleConfig().enemy.enrageTurn ?? -1);
    if (f < FIGHT_COUNT - 1) {
      run.winFight();
      crossBranch(run); // crossBranch clears the card reward (#57) and any boss spoils
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
  // #44: the battle deck is the run deck PLUS one bound ability card per deployed
  // member (the default trio deploys 3), so it runs 3 longer than the run deck.
  const deployed = run.deployment.filter((d) => d !== null).length;
  eq('battle deck = run deck + one ability card per deployed member',
    cfg.deck.length, run.deck.length + deployed);
  eq('non-boss fight is not flagged as the boss', cfg.enemy.boss, false);
  // Config deep-copies the deck (mutating config must not touch the run deck).
  cfg.deck[0].upgrades.push('retain');
  eq('config deck is a copy', run.deck[0].upgrades.length, 0);
}

// --- #44: toBattleConfig injects one bound ability card per deployed member ----
{
  const run = new Run(6);
  run.roster = partyFromMembers(['ranger', 'tank', 'mage']);
  const coreLen = run.deck.length;

  // Solo deployment injects exactly one ability card (the seated member's).
  run.deployment = [null, 0, null];
  const solo = run.toBattleConfig();
  const soloAbil = solo.deck.filter((c) => isAbilityCard(c.id));
  eq('a solo deployment injects one ability card', soloAbil.length, 1);
  eq('the injected card is the ranger\'s Imbue Venom', soloAbil[0].id, 'imbuePoison');
  eq('the persistent run deck is untouched (solo)', run.deck.length, coreLen);
  check('injected ability cards are never in the run deck',
    !run.deck.some((c) => isAbilityCard(c.id)));

  // A full trio injects three — one bound card per member.
  run.deployment = [0, 1, 2];
  const trio = run.toBattleConfig();
  const trioAbil = trio.deck.filter((c) => isAbilityCard(c.id)).map((c) => c.id).sort();
  eq('a trio injects three ability cards', trioAbil.length, 3);
  eq('the three cards are the trio\'s bound abilities',
    JSON.stringify(trioAbil), JSON.stringify(['bolster', 'imbuePoison', 'unleash']));
}

// --- card shop --------------------------------------------------------------
{
  const run = new Run(7);
  const offers = run.rollCardShop();
  eq('card shop offers SHOP_SIZE.cardShop cards', offers.length, SHOP_SIZE.cardShop);
  const ids = new Set(offers.map((o) => o.cardId));
  eq('card offers are distinct', ids.size, offers.length);
  // The sale offer's list price (not its discounted price) is the one that matches rarity.
  check('card offer prices match rarity', offers.every((o) => (o.listPrice ?? o.price) === RARITY_PRICE[CARD_RARITY[o.cardId]]));
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
  // Regen left the starter deck (#51); acquire one so the upgrade target exists.
  const regenUid = run.addCard('regen').uid;
  run.nodeContent = { type: 'cardUpgrade', offers: [{ modifier: 'lingering', rarity: 'common', price: RARITY_PRICE.common }] };
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

// --- #83: post-boss healer boon (free, repeatable, replaces the Sanctum node) ----
{
  // The Sanctum / healerUpgrade node is gone: it never appears on the map, and no
  // gold-buy path survives.
  check('healerUpgrade absent from NODE_TYPE_WEIGHTS', NODE_TYPE_WEIGHTS.every(([t]) => (t as string) !== 'healerUpgrade'));
  check('healerUpgrade absent from NON_FIGHT_NODES', NON_FIGHT_NODES.every((t) => (t as string) !== 'healerUpgrade'));
  check('no gold-buy healer path remains', !('rollHealerShop' in (Run.prototype as object)) && !('buyHealerOffer' in (Run.prototype as object)));
  check('SHOP_SIZE has no healerUpgrade entry', !('healerUpgrade' in SHOP_SIZE));
  // NODE_TYPE_WEIGHTS totals 158: the base 140 plus the Training Dojo's 18 (2026-07).
  eq('node-type weights total 158', NODE_TYPE_WEIGHTS.reduce((a, [, w]) => a + w, 0), 158);
}
{
  // After an act-1 boss, the reward chain reaches a healerBoon offering all four
  // upgrades; picking one applies its stat for free and lands on the fork.
  const run = new Run(10);
  startRun(run);
  // Fast-forward to the act-1 boss (fight 2).
  run.winFight(); run.skipCardReward(); crossBranch(run, 0); // fight 0 -> fork -> fight 1
  run.winFight(); run.skipCardReward(); crossBranch(run, 0); // fight 1 -> fork -> fight 2 (boss)
  check('standing at the act-1 boss', run.location.kind === 'fight' && run.fightIndex === 2 && run.isBossFight);
  run.winFight();
  check('boss win -> cardReward', run.location.kind === 'cardReward');
  run.skipCardReward();
  check('cardReward -> spoils', run.location.kind === 'spoils');
  run.skipSpoils();
  check('spoils -> healerBoon (#83)', run.location.kind === 'healerBoon');
  check('boon offers all four upgrades', run.nodeContent?.type === 'healerBoon' && run.nodeContent.offers.length === HEALER_UPGRADES.length);
  check('boon offers are free', run.nodeContent?.type === 'healerBoon' && run.nodeContent.offers.every((o) => o.price === 0));
  const handIdx = (run.nodeContent as { offers: { def: { stat: string } }[] }).offers.findIndex((o) => o.def.stat === 'handSize');
  const before = run.healer.handSize;
  run.pickHealerBoon(handIdx);
  eq('picking the hand boon raises hand size for free', run.healer.handSize, before + 1);
  check('picking the boon lands on the fork', run.location.kind === 'forkChoice');
}
{
  // Skipping the boon proceeds straight to the fork with the stat untouched.
  const run = new Run(11);
  run.location = { kind: 'healerBoon', fightIndex: 2 } as RunLocation;
  run.nodeContent = { type: 'healerBoon', offers: run.rollHealerBoon() };
  const before = run.healer.maxMana;
  run.skipHealerBoon();
  eq('skipping the boon leaves stats untouched', run.healer.maxMana, before);
  check('skipping the boon proceeds to the fork', run.location.kind === 'forkChoice');
}
{
  // Repeatable/stackable across bosses: re-picking the same boon stacks the stat,
  // and passiveMp still honors PASSIVE_MP_CAP.
  const run = new Run(12);
  const enter = () => { run.location = { kind: 'healerBoon', fightIndex: 2 }; run.nodeContent = { type: 'healerBoon', offers: run.rollHealerBoon() }; };
  const idxOf = (stat: string) => (run.nodeContent as { offers: { def: { stat: string } }[] }).offers.findIndex((o) => o.def.stat === stat);
  const manaAmt = HEALER_UPGRADES.find((d) => d.stat === 'maxMana')!.amount;
  const base = run.healer.maxMana;
  enter(); run.pickHealerBoon(idxOf('maxMana'));
  enter(); run.pickHealerBoon(idxOf('maxMana'));
  eq('two mana picks stack', run.healer.maxMana, base + 2 * manaAmt);
  // passiveMp: pick it three times; the stat clamps at the per-run cap.
  enter(); run.pickHealerBoon(idxOf('passiveMp'));
  enter(); run.pickHealerBoon(idxOf('passiveMp'));
  enter(); run.pickHealerBoon(idxOf('passiveMp'));
  eq('repeated passive picks clamp at PASSIVE_MP_CAP', run.healer.passiveMp, PASSIVE_MP_CAP);
}
{
  // Save/resume round-trips the healerBoon location + content.
  const run = new Run(13);
  run.location = { kind: 'healerBoon', fightIndex: 5 };
  run.nodeContent = { type: 'healerBoon', offers: run.rollHealerBoon() };
  const resumed = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  check('resumed location is the healerBoon', resumed.location.kind === 'healerBoon' && (resumed.location as { fightIndex: number }).fightIndex === 5);
  check('resumed content is the healerBoon offers', resumed.nodeContent?.type === 'healerBoon' && resumed.nodeContent.offers.length === HEALER_UPGRADES.length);
  const before = resumed.healer.restRegen;
  resumed.pickHealerBoon((resumed.nodeContent as { offers: { def: { stat: string } }[] }).offers.findIndex((o) => o.def.stat === 'restRegen'));
  eq('resumed boon still applies its stat', resumed.healer.restRegen, before + 1);
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
  eq('eight events (Purge Well cut in the content-cut pass)', EVENTS.length, 8);
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
  // The Duplicator: a paid copy of a chosen card, upgrades included.
  const run = new Run(62);
  run.gold = DUPLICATE_PRICE;
  const target = run.deck.find((c) => c.id === 'highHeal')!;
  target.upgrades.push('efficient'); // the copy INHERITS this now
  const before = run.deck.length;
  const copy = run.duplicateCard(target.uid);
  check('duplicator returns the copy', copy !== null);
  eq('deck grows by one', run.deck.length, before + 1);
  eq('the copy shares the id', copy!.id, 'highHeal');
  eq('the copy inherits the upgrades', JSON.stringify(copy!.upgrades), JSON.stringify(['efficient']));
  check('the copy has a fresh uid', copy!.uid !== target.uid);
  eq('the commission is paid', run.gold, 0);
  eq('a second copy is unaffordable', run.duplicateCard(target.uid), null);
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
  // Casino offers only the flip now (the guaranteed safe cut was cut).
  const casino = EVENTS.find((e) => e.id === 'casino')!;
  check('casino has a flip branch', casino.choices.some((c) => c.kind === 'gambleGold'));
  check('casino offers only flip + leave', casino.choices.every((c) => c.kind === 'gambleGold' || c.kind === 'leave'));
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
  const A2 = new Set(['ironmaw', 'needler', 'leech', 'venomancer', 'swarm', 'cleaver']); // + Gloopy (#87)
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
  startRun(run); // enters fight 0
  const def = run.currentEnemyDef;
  check('fight 0 has a rolled enemy def', def !== null && def!.boss === false);
  eq('battle config carries the same def', run.toBattleConfig().enemy.def, def);
}

// --- relics phase A: spoils / Reliquary / Haggler (issue 21) -----------------
{
  // Spoils fire after the act-1 boss: 3 free, distinct offers with a rare guaranteed.
  const run = new Run(80);
  startRun(run);
  for (let f = 0; f < 2; f++) {
    run.winFight();
    crossBranch(run);
  }
  eq('at the act-1 boss', run.fightIndex, 2);
  run.winFight();
  eq('boss win -> card reward first (#57)', run.location.kind, 'cardReward');
  run.skipCardReward();
  eq('card reward -> spoils', run.location.kind, 'spoils');
  check('spoils content rolled', run.nodeContent?.type === 'spoils');
  if (run.nodeContent?.type === 'spoils') {
    const offers = run.nodeContent.offers;
    eq('three spoils offers', offers.length, SPOILS_OFFER_SIZE);
    check('spoils offers are distinct', new Set(offers.map((o) => o.relicId)).size === offers.length);
    check('spoils are free', offers.every((o) => o.price === 0));
    const picked = run.pickSpoil(0);
    check('the pick lands in the relic list', picked !== null && run.hasRelic(picked));
    eq('spoils -> healerBoon (#83)', run.location.kind, 'healerBoon');
    run.skipHealerBoon();
    eq('healerBoon -> forkChoice', run.location.kind, 'forkChoice');
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
  // Haggler's Charm discounts every storefront at roll time (−10%, rounded down).
  const hag = (base: number) => Math.floor(base * (1 - HAGGLER_DISCOUNT_PCT));
  const run = new Run(82);
  run.addRelic('hagglersCharm');
  check('Haggler discounts card-shop prices',
    // One offer is on sale (its list price is the haggler price); the rest sit at the haggler price.
    run.rollCardShop().every((o) => (o.listPrice ?? o.price) === hag(RARITY_PRICE[o.rarity])));
  check('Haggler discounts reliquary prices',
    run.rollReliquary().every((o) => o.price === hag(RELICS[o.relicId].curse ? CURSE_PRICE : RELIC_PRICE[o.rarity])));
  const plain = new Run(82);
  check('without the Charm prices are full',
    plain.rollCardShop().every((o) => (o.listPrice ?? o.price) === RARITY_PRICE[o.rarity]));
}
{
  // The card shop always puts exactly one item on sale: 25% off its list price.
  const run = new Run(91);
  const offers = run.rollCardShop();
  const onSale = offers.filter((o) => o.listPrice != null);
  eq('exactly one card-shop item is on sale', onSale.length, 1);
  const sale = onSale[0];
  eq('sale price is 25% off the list price', sale.price, Math.max(1, Math.round(sale.listPrice! * 0.75)));
  check('sale price is below the list price', sale.price < sale.listPrice!);
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
  // spentRelics plumbing (threads into BattleConfig + survives save) still holds,
  // though no once-per-run relic remains after the content-cut pass — Martyr's Icon
  // is now once per FIGHT and never marks itself spent.
  const run = new Run(91);
  run.markRelicsSpent(['lantern']);
  check('spent relics reach the battle config', run.toBattleConfig().spentRelics!.includes('lantern'));
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  check('spent relics survive the snapshot', restored.spentRelics.includes('lantern'));
  run.markRelicsSpent(['lantern']);
  eq('marking twice never duplicates', run.spentRelics.length, 1);
}
{
  // The Rusty Crown pays its bonus on fight wins.
  const run = new Run(92);
  run.addRelic('rustyCrown');
  startRun(run);
  run.winFight();
  eq('the Crown pays extra gold per win', run.gold, NET_GOLD + RUSTY_CROWN_GOLD);
}

// --- local stats: total runs/wins + best act (single mode, 2026-07) -----------
{
  let s = emptyStats();
  s = recordRunEnd(s, false, 1);
  s = recordRunEnd(s, true, 3);
  s = recordRunEnd(s, true, 3);
  eq('runs counted', s.runs, 3);
  eq('wins counted', s.wins, 2);
  eq('best act sticks at the maximum', s.bestAct, 3);
  const s2 = recordRunEnd(s, false, 2);
  eq('a worse run never lowers the best act', s2.bestAct, 3);
}

// --- hardening batch (issue 24) -----------------------------------------------
{
  // The deck viewer's grouping matches engine-state counts and hides pile order.
  const mk = (id: CardId, uid: number, up: ModifierId[] = []) => ({ uid, id, upgrades: up });
  const pile = [mk('highHeal', 1), mk('shield', 2), mk('highHeal', 3), mk('shield', 4, ['efficient']), mk('regen', 5)];
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
  startRun(run);
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
  startRun(run);
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
  startRun(run);
  run.winFight();
  run.skipCardReward(); // #57
  run.chooseBranch(0);
  const snap = JSON.parse(JSON.stringify(run.toJSON())); // survive real serialization
  const restored = Run.fromJSON(snap);
  eq('snapshot round-trips', JSON.stringify(restored.toJSON()), JSON.stringify(snap));
  eq('restored rng continues from the saved position', run.rng(), restored.rng());
}
{
  // #46 "Continue saved run": a live run resumed from its snapshot must land back
  // at the exact saved position (map/screen), with the same roster, deck, gold,
  // and seed. Guards the resume the Start screen's Continue button drives.
  const run = new Run(4242);
  startRun(run);          // deploy + fight 0 with the default trio
  run.winFight();         // -> card reward (#57)
  run.skipCardReward();   // -> forkChoice
  run.gold = 137;
  run.chooseBranch(0);    // -> branch hub (a real mid-run boundary)
  const snap = JSON.parse(JSON.stringify(run.toJSON()));
  const resumed = Run.tryFromJSON(snap)!;
  check('tryFromJSON resumes a valid current-version save', resumed !== null);
  eq('resumed seed matches', resumed.seed, run.seed);
  eq('resumed location matches', JSON.stringify(resumed.location), JSON.stringify(run.location));
  eq('resumed gold matches', resumed.gold, 137);
  eq('resumed roster matches', JSON.stringify(resumed.roster), JSON.stringify(run.roster));
  eq('resumed deck matches', JSON.stringify(resumed.deck), JSON.stringify(run.deck));
  eq('resumed relics match', JSON.stringify(resumed.relics), JSON.stringify(run.relics));
}
{
  // #46 graceful failure — a save from an OLDER RUN_SAVE_VERSION must not resume
  // (and must not throw): tryFromJSON returns null so the caller can hide the
  // Continue button rather than silently no-op or crash.
  const run = new Run(7);
  startRun(run);
  run.winFight();
  const snap = JSON.parse(JSON.stringify(run.toJSON()));
  snap.version = snap.version - 1; // pretend it was written by an older build
  let threw = false;
  let out: Run | null = run;
  try { out = Run.tryFromJSON(snap); } catch { threw = true; }
  check('version-mismatched snapshot does not throw', !threw);
  check('version-mismatched snapshot does not resume', out === null);
}
{
  // #46 graceful failure — a truncated/corrupt snapshot that still parses and
  // even carries the CURRENT version (a partial write, or a shape change made
  // without a version bump: the actual root-cause shape) must resolve to null,
  // never throw. This is the exact snapshot that made the Continue button a
  // silent no-op before the fix (fromJSON blew up on the missing deck).
  let threw = false;
  let out: Run | null = new Run(0);
  try {
    out = Run.tryFromJSON({ version: RUN_SAVE_VERSION, seed: 1, location: { kind: 'branch', forkIndex: 0, branch: 0 } });
  } catch { threw = true; }
  check('truncated current-version snapshot does not throw', !threw);
  check('truncated snapshot does not resume', out === null);
  check('non-object snapshot does not resume', Run.tryFromJSON(null) === null && Run.tryFromJSON(undefined) === null);
}
{
  // A save+resume at a boundary produces the same run as never interrupting.
  const finish = (r: Run): void => crossBranch(r);
  const uninterrupted = new Run(9);
  startRun(uninterrupted);
  uninterrupted.winFight();
  finish(uninterrupted);

  const resumed = new Run(9);
  startRun(resumed);
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

// --- graveyard: permadeath buries the member, never re-offered (#40) ------------
{
  const run = new Run(11);
  run.roster = partyFromMembers(['warlock', 'mage', 'ranger']);
  run.deployment = [0, 1, 2];
  eq('graveyard starts empty', run.graveyard.length, 0);
  check('a member not in the roster is offerable', run.availableMembers().includes('tank'));

  // Drive the Warlock to the 4th-death cliff: 3 scars, then one more death.
  run.roster[0].injuries = DEATH_AT - 1;
  run.recordInjuries([0 as Slot]); // 4th death → permadeath
  check('the permadead member is removed from the roster',
    !run.roster.some((p) => p.member === 'warlock'));
  check('the permadead member is recorded in the graveyard', run.graveyard.includes('warlock'));
  // #50: the seating is reconciled, not blown away. Warlock sat in slot 0 (killed →
  // empty); mage/ranger sat in slots 1/2 and keep those seats at their shifted indices.
  eq('the killed member\'s slot is emptied and survivors keep their seats',
    JSON.stringify(run.deployment), JSON.stringify([null, 0, 1]));
  check('no reconciled deployment index is out of range',
    run.deployment.every((d) => d == null || (d >= 0 && d < run.roster.length)));
  check('the reconciled seats still point at mage and ranger',
    run.roster[0].member === 'mage' && run.roster[1].member === 'ranger');

  // The buried member must never return through any offer path (all key on availableMembers).
  check('a buried member is not in availableMembers', !run.availableMembers().includes('warlock'));
  const offer = run._rollMemberOffer(run.availableMembers(), 8);
  check('a buried member never appears in a rolled offer', !offer.includes('warlock'));

  // Graveyard survives save/resume and stays byte-stable.
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  eq('graveyard round-trips through a snapshot',
    JSON.stringify(restored.graveyard), JSON.stringify(run.graveyard));
  eq('snapshot with a graveyard is byte-stable',
    JSON.stringify(restored.toJSON()), JSON.stringify(run.toJSON()));

  // A fully-buried pool hides the Recruit node (nodeAvailable keys on availableMembers).
  const buried = new Run(12);
  buried.roster = partyFromMembers(['ranger']);
  buried.graveyard = DRAFT_POOL.filter((id) => id !== 'ranger');
  eq('every non-roster member is buried', buried.availableMembers().length, 0);
  check('a fully-buried pool hides the Recruit stop', !buried.nodeAvailable('recruit'));
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
  run._enterDeploy(0); // trio roster, lands on the deploy step (no auto-confirm)
  eq('entering the fight opens the deploy step', run.location.kind, 'deploy');

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

// --- #50: the deploy step remembers the player's last seating between fights -----
{
  const run = new Run(50);
  run._enterDeploy(0);
  eq('the first deploy defaults to the classic trio order',
    JSON.stringify(run.deployment), JSON.stringify([0, 1, 2]));

  // Seat a non-default order (Center empty, roster 2 at Left, roster 0 at Right).
  run.confirmDeployment([2, null, 0]);
  eq('the chosen deployment fights', run.location.kind, 'fight');

  // Advance to the next fight's deploy step: it must still reflect the prior seating,
  // not reset to [0,1,2].
  run._enterDeploy(1);
  eq('the next deploy step keeps the prior seating',
    JSON.stringify(run.deployment), JSON.stringify([2, null, 0]));

  // The player can still freely re-seat.
  run.confirmDeployment([1, 0, null]);
  run._enterDeploy(2);
  eq('a re-seated deployment is itself remembered next fight',
    JSON.stringify(run.deployment), JSON.stringify([1, 0, null]));

  // The remembered seating round-trips through save/resume.
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  eq('the remembered seating survives save/resume',
    JSON.stringify(restored.deployment), JSON.stringify([1, 0, null]));
  restored._enterDeploy(3);
  eq('a resumed run still defaults the deploy step to the remembered seating',
    JSON.stringify(restored.deployment), JSON.stringify([1, 0, null]));
}

// --- #50: a stale seating (roster too small) falls back to the default -----------
{
  const run = new Run(51);
  run.deployment = [2, null, 1];   // valid for a trio
  run.roster = partyFromMembers(['ranger']); // roster shrank to one — index 2/1 now stale
  run._enterDeploy(0);
  eq('an out-of-range remembered seating falls back to the default',
    JSON.stringify(run.deployment), JSON.stringify([0, null, null]));
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
  run._enterDeploy(0); // land on deploy without auto-confirming the default
  run.confirmDeployment([null, 1, null]); // field only the tank (roster index 1)
  eq('deployedSalary sums only the fielded members', run.deployedSalary(), MEMBER_BASE_SALARY['tank']);
  const before = run.gold;
  run.winFight();
  // #42: a solo deploy leaves 2 empty seats, so the win bounty scales up (+60%) —
  // fielding fewer pays a premium on top of the wages it saves.
  const soloBounty = Math.round(GOLD_PER_FIGHT * (1 + EMPTY_SEAT_GOLD_BONUS * 2));
  eq('a solo win pays the empty-seat-scaled bounty minus one salary',
    run.gold, before + soloBounty - MEMBER_BASE_SALARY['tank']);
  check('the empty-seat bounty exceeds the base bounty (#42)', soloBounty > GOLD_PER_FIGHT);

  // Applying a party upgrade bumps the salary counter (so the fee rises next fight).
  const up = new Run(72);
  const u0 = up.roster[0].upgrades ?? 0;
  up.applyPartyUpgrade(0 as Slot, PARTY_UPGRADES[0]);
  eq('a party upgrade raises the salary counter', up.roster[0].upgrades, u0 + 1);

  // Salary can eat into gold but never drives it negative.
  const broke = new Run(73);
  startRun(broke);
  broke.confirmDeployment([0, 1, 2]);
  broke.gold = 0;
  broke.winFight();
  check('gold never goes negative after salary', broke.gold >= 0);
}

// --- Field Hospital heals free; Infirmary is back (#58); Mending Totem retired ---
{
  // Field Hospital event: heal one scar free (top of the ladder), no-op if unharmed.
  const fh = new Run(13);
  fh.roster[0].injuries = 2;
  check('the Field Hospital tends a scar for free', fh.healInjury(0 as Slot));
  eq('one scar closed, no gold spent', fh.roster[0].injuries, 1);
  eq('the free tend costs nothing', fh.gold, 0);
  check('tending an unharmed member does nothing', !fh.healInjury(1 as Slot));

  // The Infirmary node is placeable again (#58 — HP persists, so paid HP/scar
  // top-ups are a real economy stop); the Mending Totem relic stays retired.
  check('infirmary is a placeable node type again (#58)', NODE_TYPE_WEIGHTS.some(([t]) => (t as string) === 'infirmary'));
  check('Mending Totem is no longer a relic', !RELIC_IDS.includes('mendingTotem' as never));
}

// --- injuries are permanent; the 4th death removes the member from the roster ----
{
  const run = new Run(16);
  startRun(run); // trio roster, deployment [0,1,2]
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
  // #55: the start draft samples three DISTINCT heroes from the FULL pool (not the
  // old fixed striker trio).
  const startOpts = (run.nodeContent as { options: MemberId[] }).options;
  check('the start draft offers three distinct members from the full pool',
    run.nodeContent?.type === 'draft'
    && startOpts.length === DRAFT_OFFER_SIZE
    && new Set(startOpts).size === DRAFT_OFFER_SIZE
    && startOpts.every((id) => DRAFT_POOL.includes(id)));

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

  // A pick that was never offered is ignored (pick a member not in this offer).
  const bad = new Run(21);
  bad.beginDraft();
  const badOpts = (bad.nodeContent as { options: MemberId[] }).options;
  const notOffered = DRAFT_POOL.find((id) => !badOpts.includes(id))!;
  bad.chooseDraftMember(notOffered);
  eq('a non-offered starter pick is refused', bad.location.kind, 'draft');

  // The offer is deterministic in the run seed (same offer on the same seed).
  const a = new Run(77); a.beginDraft();
  const b = new Run(77); b.beginDraft();
  check('the draft offer is deterministic in the seed',
    JSON.stringify((a.nodeContent as { options: unknown }).options)
      === JSON.stringify((b.nodeContent as { options: unknown }).options));

  // #55: the offer varies by seed, and every hero in the full pool is reachable as a
  // starter across seeds (all 8 members show up within a modest seed sweep).
  const seen = new Set<MemberId>();
  const offerStrings = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    const r = new Run(seed); r.beginDraft();
    const opts = (r.nodeContent as { options: MemberId[] }).options;
    offerStrings.add(JSON.stringify(opts));
    for (const id of opts) seen.add(id);
  }
  check('the start offer varies across seeds', offerStrings.size > 1);
  check('every hero can appear as a starter across seeds',
    DRAFT_POOL.every((id) => seen.has(id)), `saw ${[...seen].join(',')}`);

  // The drafted identity round-trips through a save snapshot (v8) and reaches the
  // fight via toBattleConfig (the 2026-07-04 field-drop regression stays covered).
  const restored = Run.fromJSON(run.toJSON());
  eq('drafted identity survives save/resume', restored.roster[0].member, first);
  eq('toBattleConfig carries the drafted identity', restored.toBattleConfig().party[1].member ?? restored.toBattleConfig().party[0].member, first);
}

// --- #56: no post-boss draft — winning an act boss goes spoils -> fork -------
{
  const run = new Run(40);
  run.beginDraft();
  run.chooseDraftMember((run.nodeContent as { options: MemberId[] }).options[0]);
  // Jump to the act-1 boss and win it: spoils, then straight to the fork (the
  // post-boss member draft was removed with #56). (Cast so TS doesn't pin
  // run.location to the fight literal across the mutating calls.)
  run.location = { kind: 'fight', fightIndex: 2 } as RunLocation;
  run.winFight();
  run.skipCardReward(); // #57: the card reward precedes boss spoils
  eq('an act boss drops spoils first', run.location.kind, 'spoils');
  const before = run.roster.length;
  run.skipSpoils();
  eq('leaving spoils goes to the healer boon (#83)', run.location.kind, 'healerBoon');
  run.skipHealerBoon();
  eq('leaving the boon goes straight to the fork (no draft)', run.location.kind, 'forkChoice');
  eq('winning a boss no longer auto-adds a member', run.roster.length, before);
  // A recruiter fork is guaranteed after each boss (fork 2 here), so the roster can
  // still grow — just through the Recruit node, not an auto-draft.
  check('the post-boss fork (2) guarantees a recruiter path',
    run.map[2].branches.some((br) => br.nodes.some((n) => n.type === 'recruit')));
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
  startRun(dead); // deployment [0,1,2]
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

// --- #58: HP persists across fights, heals a percentage between, resurrects ------
{
  // A member ends a fight hurt and carries that HP forward. winFight captures the
  // battle slots' ending HP, then the between-fight heal tops everyone up.
  const run = new Run(101);
  startRun(run); // trio at a fight, deployment [0,1,2]
  const max0 = run.roster[0].maxHP;
  // Battle slot 0 ended at 3 HP, slots 1/2 unhurt (full). winFight carries it back.
  run.winFight([3, run.roster[1].maxHP, run.roster[2].maxHP]);
  const healed = Math.round(max0 * HERO_HEAL_PCT);
  eq('hurt member carries HP forward + the between-fight heal', run.roster[0].hp, Math.min(max0, 3 + healed));
  check('the carried-forward member is still hurt (not full)', (run.roster[0].hp ?? max0) < max0);
  eq('an unhurt member stays clamped at full', run.roster[1].hp, run.roster[1].maxHP);

  // That persisted HP threads into the NEXT fight's config, clamped to max.
  crossBranch(run);
  deployAll(run);
  const cfg = run.toBattleConfig();
  eq('the next fight seats the member at the carried HP', cfg.party[0].hp, run.roster[0].hp);
}
{
  // The between-fight heal is HERO_HEAL_PCT of MAX, clamped to max, on the whole roster.
  const run = new Run(102);
  startRun(run);
  for (const p of run.roster) p.hp = 1;
  run.winFight([1, 1, 1]);
  for (let i = 0; i < run.roster.length; i++) {
    const p = run.roster[i];
    eq(`member ${i} heals exactly the pct of max`, p.hp, Math.min(p.maxHP, 1 + Math.round(p.maxHP * HERO_HEAL_PCT)));
  }
  // A near-full member clamps at max rather than overshooting.
  const near = new Run(103);
  startRun(near);
  near.roster[0].hp = near.roster[0].maxHP - 1;
  near.winFight([near.roster[0].maxHP - 1, near.roster[1].maxHP, near.roster[2].maxHP]);
  eq('a near-full member clamps at max', near.roster[0].hp, near.roster[0].maxHP);
}
{
  // A member DEAD at the end of a won fight (0 HP) is resurrected to the recovered
  // amount — the same pct heal — not to full and not to the in-fight 50%.
  const run = new Run(104);
  startRun(run);
  const max = run.roster[0].maxHP;
  run.winFight([0, run.roster[1].maxHP, run.roster[2].maxHP]); // slot 0 died this fight
  eq('the dead-at-end member returns at the recovered amount', run.roster[0].hp, Math.round(max * HERO_HEAL_PCT));
  check('the resurrect is NOT to full', (run.roster[0].hp ?? max) < max);
}
{
  // HP round-trips through save/resume (v13).
  const run = new Run(105);
  startRun(run);
  run.winFight([2, run.roster[1].maxHP, run.roster[2].maxHP]);
  const carried = run.roster[0].hp;
  const resumed = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  eq('save version is current', run.toJSON().version, RUN_SAVE_VERSION);
  eq('resumed run keeps each member current HP', resumed.roster[0].hp, carried);
  // An old snapshot without hp reconciles to full (maxHP), not undefined.
  const legacy = run.toJSON();
  for (const p of legacy.roster) delete (p as { hp?: number }).hp;
  const rebuilt = Run.fromJSON(legacy);
  eq('a legacy member with no hp reconciles to full', rebuilt.roster[0].hp, rebuilt.roster[0].maxHP);
}

// --- #58: the Infirmary node heals HP / injuries for gold ------------------------
{
  // Infirmary content is rollable and gated: hidden when the party is healthy,
  // shown when someone is hurt or scarred.
  const run = new Run(106);
  startRun(run);
  check('a full, unscarred roster hides the Infirmary', !run.nodeAvailable('infirmary'));
  run.roster[0].hp = 1;
  check('a hurt roster shows the Infirmary', run.nodeAvailable('infirmary'));
  run.roster[0].hp = run.roster[0].maxHP;
  run.roster[1].injuries = 1;
  check('a scarred roster shows the Infirmary', run.nodeAvailable('infirmary'));
}
{
  // Heal HP: restore a member to full for INFIRMARY_HP_PRICE gold; gold-clamped.
  const run = new Run(107);
  startRun(run);
  run.nodeContent = { type: 'infirmary' }; // stand at the node so the actions fire
  run.roster[0].hp = 1;
  const max = run.roster[0].maxHP;
  run.gold = INFIRMARY_HP_PRICE - 1;
  check('unaffordable HP heal fails without charging', !run.infirmaryHealHP(0));
  eq('gold untouched on a failed heal', run.gold, INFIRMARY_HP_PRICE - 1);
  run.gold = INFIRMARY_HP_PRICE + 5;
  check('affordable HP heal succeeds', run.infirmaryHealHP(0));
  eq('the member is restored to full', run.roster[0].hp, max);
  eq('the HP price was charged', run.gold, 5);
  check('healing an already-full member fails (no waste)', !run.infirmaryHealHP(0));
}
{
  // Mend injury: shed one scar for the larger INFIRMARY_INJURY_PRICE; gold-clamped.
  const run = new Run(108);
  startRun(run);
  run.nodeContent = { type: 'infirmary' };
  run.roster[0].injuries = 2;
  run.gold = INFIRMARY_INJURY_PRICE - 1;
  check('unaffordable mend fails without charging', !run.infirmaryHealInjury(0));
  eq('gold untouched on a failed mend', run.gold, INFIRMARY_INJURY_PRICE - 1);
  run.gold = INFIRMARY_INJURY_PRICE;
  check('affordable mend succeeds', run.infirmaryHealInjury(0));
  eq('one scar shed', run.roster[0].injuries, 1);
  eq('the (larger) injury price was charged', run.gold, 0);
  check('mending an unscarred member fails', !run.infirmaryHealInjury(1));
  check('the injury price is larger than the HP price', INFIRMARY_INJURY_PRICE > INFIRMARY_HP_PRICE);
  // The actions refuse to fire away from an Infirmary node (a crude UI can't wedge it).
  run.nodeContent = null;
  run.roster[0].hp = 1;
  check('HP heal refuses off an Infirmary node', !run.infirmaryHealHP(0));
}

// --- starter deck: Standard or Draft (content-cut pass) ---------------------
{
  // Two options only: the fixed Standard deck, or a Draft.
  eq('two starter options', STARTER_DECK_IDS.length, 2);
  check('Standard and Draft are the options',
    STARTER_DECK_IDS.includes('standard') && STARTER_DECK_IDS.includes('draft'));
  check('the old presets are gone', !(STARTER_DECK_IDS as string[]).includes('reaper'));

  // Standard = the fixed DECK_LIST (7 cards, one Resurrect, #86); the draft base
  // seeds Quick Heal + Heal + Resurrect and picks are down to 3 so a finished
  // drafted deck still lands at 6.
  eq('Standard deck is DECK_LIST',
    JSON.stringify(buildStandardDeck().map((c) => c.id)), JSON.stringify(DECK_LIST));
  eq('Standard deck has 7 cards', DECK_LIST.length, 7);
  eq('draft base is Quick Heal + Heal + Resurrect',
    JSON.stringify(DRAFT_BASE_HEALS), JSON.stringify(['lowHeal', 'highHeal', 'resurrect']));
  eq('draft picks are down to 3', STARTER_DRAFT_PICKS, 3);
  eq('a finished drafted deck is still 6 cards', DRAFT_BASE_HEALS.length + STARTER_DRAFT_PICKS, 6);

  // Default path (no picker): a fresh Run defaults to Standard and its deck.
  const fresh = new Run(7);
  eq('a fresh run defaults to Standard', fresh.starterDeck, DEFAULT_STARTER_DECK);
  eq('the default deck is DECK_LIST',
    JSON.stringify(fresh.deck.map((c) => c.id)), JSON.stringify(DECK_LIST));

  // Standard path: begin -> pick standard -> builds DECK_LIST, then enters the draft.
  const run = new Run(7);
  run.beginStarterDeck();
  eq('beginStarterDeck opens the picker', run.location.kind, 'starterDeck');
  run.chooseStarterMode('standard');
  eq('choosing Standard records it', run.starterDeck, 'standard');
  eq('choosing Standard builds DECK_LIST',
    JSON.stringify(run.deck.map((c) => c.id)), JSON.stringify(DECK_LIST));
  eq('choosing Standard moves on to the draft', run.location.kind, 'draft');

  // Draft path: seed the base cards, then pick 1 of 3 for STARTER_DRAFT_PICKS rounds.
  const d = new Run(9);
  d.beginStarterDeck();
  d.chooseStarterMode('draft');
  eq('choosing Draft records it', d.starterDeck, 'draft');
  eq('draft seeds the three base cards', d.deck.length, DRAFT_BASE_HEALS.length);
  check('the draft picker is open', d.location.kind === 'starterDeck' && d.nodeContent?.type === 'starterDraft');
  for (let i = 0; i < STARTER_DRAFT_PICKS; i++) {
    check(`round ${i + 1} offers 3 cards`, d.nodeContent?.type === 'starterDraft' && d.nodeContent.offers.length === 3);
    const offer = (d.nodeContent as { type: 'starterDraft'; offers: CardId[] }).offers[0];
    d.pickStarterDraftCard(offer);
  }
  eq('the drafted deck is full (base + picks)', d.deck.length, DRAFT_BASE_HEALS.length + STARTER_DRAFT_PICKS);
  eq('finishing the draft enters the hero draft', d.location.kind, 'draft');

  // The chosen mode round-trips through save/resume.
  const resumed = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  eq('starter mode survives save/resume', resumed.starterDeck, 'standard');

  // Quick-play/sim path: beginDraft() straight from 'start' keeps the Standard default.
  const sim = new Run(7);
  sim.beginDraft();
  eq('beginDraft from start keeps Standard', sim.starterDeck, DEFAULT_STARTER_DECK);
  eq('beginDraft from start still enters the draft', sim.location.kind, 'draft');
}

// --- #71: meta-layer relics — Surgeon's Thread, Beggar's Bowl -------------------
{
  // Surgeon's Thread lifts the between-fight recovery from 40% to 50% of max HP;
  // a matched run without it recovers the smaller amount from the same start.
  const withT = new Run(710); startRun(withT); withT.addRelic('surgeonsThread');
  const without = new Run(710); startRun(without);
  const maxW = withT.roster[0].maxHP;
  withT.winFight([1, withT.roster[1].maxHP, withT.roster[2].maxHP]);
  without.winFight([1, without.roster[1].maxHP, without.roster[2].maxHP]);
  eq("Spare Bandages recover to the 50% line", withT.roster[0].hp, Math.min(maxW, 1 + Math.round(maxW * SURGEON_THREAD_HEAL_PCT)));
  eq('without the Thread recovery stays at the 40% line', without.roster[0].hp, Math.min(maxW, 1 + Math.round(maxW * HERO_HEAL_PCT)));
  check("the Thread's recovery exceeds the default", (withT.roster[0].hp ?? 0) > (without.roster[0].hp ?? 0));
  check('Surgeon\'s Thread is a common, non-curse relic', RELICS.surgeonsThread.rarity === 'common' && RELICS.surgeonsThread.curse !== true);
}
{
  // Beggar's Bowl: card rewards roll exactly 2 distinct offers, and each won fight
  // pays +BEGGARS_BOWL_GOLD; it stacks with the Rusty Crown's rider when both are held.
  const run = new Run(711); run.addRelic('beggarsBowl'); startRun(run);
  const offers = run.rollCardReward(0);
  eq("Beggar's Bowl rolls 2 reward offers", offers.length, BEGGARS_BOWL_REWARD_SIZE);
  check('the two offers are distinct', offers[0].cardId !== offers[1].cardId);
  run.winFight();
  eq('the Bowl pays extra gold per win', run.gold, NET_GOLD + BEGGARS_BOWL_GOLD);

  const both = new Run(712); both.addRelic('beggarsBowl'); both.addRelic('rustyCrown'); startRun(both);
  both.winFight();
  eq('Bowl + Crown gold riders stack', both.gold, NET_GOLD + BEGGARS_BOWL_GOLD + RUSTY_CROWN_GOLD);
  check("Beggar's Bowl is a rare curse", RELICS.beggarsBowl.rarity === 'rare' && RELICS.beggarsBowl.curse === true);
}
{
  // Inert gate: with no relics, recovery stays 40%, rewards roll the default size,
  // and a win pays only the base net gold — no #71 relic changes anything.
  const run = new Run(713); startRun(run);
  eq('default reward size with no relics', run.rollCardReward(0).length, CARD_REWARD_SIZE);
  const max = run.roster[0].maxHP;
  run.winFight([1, run.roster[1].maxHP, run.roster[2].maxHP]);
  eq('recovery stays at the default 40% with no relics', run.roster[0].hp, Math.min(max, 1 + Math.round(max * HERO_HEAL_PCT)));
  eq('no bonus gold with no relics', run.gold, NET_GOLD);
}
{
  // The three #71 relics are real, and the two non-curses flow into the spoils pool.
  const ids: RelicId[] = ['pilgrimsFlask', 'surgeonsThread', 'beggarsBowl'];
  check('all three #71 relics exist', ids.every((id) => RELIC_IDS.includes(id)));
  const spoilsPool = RELIC_IDS.filter((id) => !RELICS[id].curse);
  check("Nap Sack and Spare Bandages are spoils-eligible", spoilsPool.includes('pilgrimsFlask') && spoilsPool.includes('surgeonsThread'));
  check("Beggar's Bowl is excluded from the spoils pool", !spoilsPool.includes('beggarsBowl'));
}

finish();
