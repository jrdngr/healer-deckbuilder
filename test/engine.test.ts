// Engine test harness. Run with: npm test  (tsx test/engine.test.ts)
import { Game } from '../src/engine';
import { DECK_LIST, CARDS, SLOT, MP_MAX, POISON_BASE, POISON_TURNS, REGEN_TURNS, REFRESH_TURNS, BOLT_BASE, BOLT_CHARGE_MULT, makeDeckCard, defaultBattleConfig, DEFAULT_HEALER, resolveCard, canApplyModifier, MODIFIERS } from '../src/constants';
import type { CardId, ModifierId } from '../src/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string | undefined = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}
function eq(name: string, a: unknown, b: unknown): void { check(name, a === b, `expected ${b}, got ${a}`); }

// Find a hand index for a card id, drawing/arranging as needed by stuffing the hand.
// Cards in the hand are now DeckCard instances; give each a unique negative uid so
// it can't collide with the run deck's positional uids.
let testUid = -1;
function giveCard(game: Game, cardId: CardId, upgrades: ModifierId[] = []): number {
  game.hand.push(makeDeckCard(cardId, testUid--, upgrades));
  return game.hand.length - 1;
}

// --- deck composition -------------------------------------------------------
eq('deck has 15 cards', DECK_LIST.length, 15);
{
  const counts: Record<string, number> = {};
  for (const c of DECK_LIST) counts[c] = (counts[c] || 0) + 1;
  eq('3 Quick Heal', counts.lowHeal, 3);
  eq('2 Heal', counts.highHeal, 2);
  eq('2 Group Heal', counts.aoeHeal, 2);
  eq('2 Regen', counts.regen, 2);
  eq('2 Refresh', counts.refresh, 2);
  eq('2 Ability', counts.ability, 2);
  eq('1 Shield', counts.shield, 1);
  eq('1 Resurrect', counts.resurrect, 1);
}

// --- card heal values -------------------------------------------------------
eq('Quick Heal heals 1', CARDS.lowHeal.heal, 1);
eq('Heal heals 4', CARDS.highHeal.heal, 4);
eq('Group Heal heals 2', CARDS.aoeHeal.heal, 2);
eq('Regen strength 1', CARDS.regen.regen, 1);
eq('Refresh strength 2', CARDS.refresh.refresh, 2);

// --- enrage damage rounds up ------------------------------------------------
{
  const g = new Game(1);
  eq('single base dmg', g.attackDamage('single', 1), 4);
  eq('two base dmg', g.attackDamage('two', 1), 3);
  eq('aoe base dmg', g.attackDamage('aoe', 1), 2);
  eq('single enraged dmg', g.attackDamage('single', 11), 5);   // ceil(5)
  eq('two enraged dmg', g.attackDamage('two', 11), 4);          // ceil(3.75)
  eq('aoe enraged dmg', g.attackDamage('aoe', 11), 3);          // ceil(2.5)
  eq('hidden enraged dmg', g.attackDamage('hidden', 11), 5);
}

// --- geometry: tank-in-center pairing --------------------------------------
{
  const g = new Game(1);
  // edge primary -> pairs with center
  check('two-target left primary includes center', g._geometry('two', SLOT.LEFT).includes(SLOT.CENTER));
  check('two-target right primary includes center', g._geometry('two', SLOT.RIGHT).includes(SLOT.CENTER));
  // center primary -> pairs with an edge (so center always involved either way)
  const cen = g._geometry('two', SLOT.CENTER);
  check('two-target center primary includes an edge',
    cen.includes(SLOT.LEFT) || cen.includes(SLOT.RIGHT));
  check('two-target center primary includes center', cen.includes(SLOT.CENTER));
  eq('aoe hits 3', g._geometry('aoe', SLOT.CENTER).length, 3);
  eq('single hits 1', g._geometry('single', SLOT.LEFT).length, 1);
}

// --- poison: flat 3/turn for 5 turns = 15, then stops ----------------------
{
  const g = new Game(2);
  g.start();
  g.enemy.poison = POISON_BASE; g.enemy.poisonTurns = POISON_TURNS;
  g.enemy.hp = 100;
  const seq: number[] = [];
  // Simulate the engine's poison tick (flat strength, gated on the turn counter).
  for (let i = 0; i < 6; i++) {
    const before = g.enemy.hp;
    if (g.enemy.poisonTurns > 0) {
      g.enemy.hp -= g.enemy.poison;
      g.enemy.poisonTurns -= 1;
      if (g.enemy.poisonTurns === 0) g.enemy.poison = 0;
    }
    seq.push(before - g.enemy.hp);
  }
  eq('poison schedule sum', seq.reduce((a, b) => a + b, 0), 15);
  check('poison is flat 3,3,3,3,3 then 0', JSON.stringify(seq) === JSON.stringify([3, 3, 3, 3, 3, 0]),
    JSON.stringify(seq));
}

// --- regen: flat strength for its duration, capped at maxHP ----------------
{
  const g = new Game(3);
  const ranger = g.members[SLOT.LEFT];
  ranger.hp = 6; ranger.regen = 1; ranger.regenTurns = REGEN_TURNS; // maxHP 8
  const healed: number[] = [];
  for (let i = 0; i < REGEN_TURNS; i++) {
    const before = ranger.hp;
    if (ranger.regenTurns > 0) {
      ranger.hp = Math.min(ranger.maxHP, ranger.hp + ranger.regen);
      ranger.regenTurns -= 1;
      if (ranger.regenTurns === 0) ranger.regen = 0;
    }
    healed.push(ranger.hp - before);
  }
  // ranger starts 6: +1 ->7, +1 ->8 (cap), +1 ->8 (no room)
  eq('regen capped total', ranger.hp, 8);
  check('regen ticks respect cap', JSON.stringify(healed) === JSON.stringify([1, 1, 0]),
    JSON.stringify(healed));
}

// --- regen ticks at the start of the player phase, after the enemy attacks -----
{
  const g = new Game(30);
  g.start();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  g.mp = 10;
  const idx = giveCard(g, 'regen'); // regen 1 for 3 turns
  g.playCard(idx, SLOT.CENTER);
  eq('regen primed strength 1', tank.regen, 1);
  eq('regen primed duration 3', tank.regenTurns, REGEN_TURNS);
  // Force a telegraph that spares the tank, so the only change to its HP across the
  // turn is the regen heal (isolating the tick's timing).
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.LEFT], enraged: false, forTurn: g.turn + 1 };
  g.endTurn();
  eq('regen healed +1 at player-phase start', tank.hp, 6);
  eq('regen duration decremented to 2', tank.regenTurns, REGEN_TURNS - 1);
  eq('regen strength unchanged', tank.regen, 1);
  // The heal must land after the enemy attack in the event feed, not before it.
  const atkIdx = g.events.findIndex((e) => e.kind === 'enemyAttack');
  const regIdx = g.events.findIndex((e) => e.kind === 'regenTick');
  check('regenTick lands after the enemy attack', atkIdx >= 0 && regIdx > atkIdx,
    `atkIdx=${atkIdx} regIdx=${regIdx}`);
}

// --- stacking is non-additive: re-applying refreshes duration, keeps max strength ---
{
  const g = new Game(31);
  g.start();
  const tank = g.members[SLOT.CENTER];
  g.mp = 10;
  g.playCard(giveCard(g, 'regen'), SLOT.CENTER);
  eq('regen first cast strength', tank.regen, 1);
  tank.regenTurns -= 1; // simulate a tick elapsing
  // Re-apply: duration resets to full, strength stays the max (not 1+1=2).
  g.playCard(giveCard(g, 'regen'), SLOT.CENTER);
  eq('regen re-cast keeps strength (no stacking)', tank.regen, 1);
  eq('regen re-cast refreshes duration', tank.regenTurns, REGEN_TURNS);
}

// --- enemy never aims its primary at a dead square (no invisible telegraph) ----
{
  const g = new Game(31);
  g.start();
  g._killMember(g.members[SLOT.LEFT]); // ranger falls
  for (let i = 0; i < 300; i++) {
    const single = g._pickPrimary('single');
    const hidden = g._pickPrimary('hidden');
    check('single primary is a living slot', g.members[single].alive && single !== SLOT.LEFT);
    check('hidden primary is a living slot', g.members[hidden].alive && hidden !== SLOT.LEFT);
  }
  // End to end: a generated single/hidden telegraph always resolves onto a living
  // member, and a single telegraph always shows at least one line (never invisible).
  for (let i = 0; i < 300; i++) {
    const tel = g._generateTelegraph(2);
    if (tel.type === 'single' || tel.type === 'hidden') {
      g.telegraph = tel;
      check('single/hidden telegraph lands on a living member', g.members[tel.targets[0]].alive);
      if (tel.type === 'single') check('single telegraph stays visible', g.attackTargets().length > 0);
    }
  }
}

// --- taunt also grants the tank Defense, reducing incoming hits by 1 ---------
{
  const g = new Game(40);
  g.start();
  const tank = g.members[SLOT.CENTER];
  g.mp = 10;
  g.playCard(giveCard(g, 'ability'), SLOT.CENTER); // taunt
  eq('defense set on cast', tank.defense, 3);
  tank.hp = tank.maxHP;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.CENTER], enraged: false, forTurn: 2 };
  g.events = [];
  g._resolveAttack();
  eq('defense reduces the hit by 1', tank.hp, tank.maxHP - 3);
  const atk = g.events.find((e) => e.kind === 'enemyAttack') as any;
  eq('enemyAttack amount reflects reduced damage', atk.amount, 3);
  const spec = g.attackTargets().find((s) => s.slot === SLOT.CENTER) as any;
  eq('telegraph preview shows reduced damage on the tank', spec.damage, 3);
}

// --- Defense lasts 3 enemy turns, then fades --------------------------------
{
  const g = new Game(41);
  g.start();
  const tank = g.members[SLOT.CENTER];
  g.mp = 10;
  g.playCard(giveCard(g, 'ability'), SLOT.CENTER); // taunt -> defense 3
  eq('defense starts at 3', tank.defense, 3);
  tank.hp = tank.maxHP; g.endTurn();
  eq('defense after 1 enemy turn', tank.defense, 2);
  tank.hp = tank.maxHP; g.endTurn();
  eq('defense after 2 enemy turns', tank.defense, 1);
  tank.hp = tank.maxHP; g.endTurn();
  eq('defense after 3 enemy turns', tank.defense, 0);
}

// --- refresh: flat 2 MP/turn for 3 turns = 6, then stops -------------------
{
  const g = new Game(4);
  g.refresh = 2; g.refreshTurns = REFRESH_TURNS; g.mp = 0;
  const gains: number[] = [];
  for (let i = 0; i < REFRESH_TURNS + 1; i++) {
    if (g.refreshTurns > 0) {
      const gain = g.refresh; g.mp += gain; g.refreshTurns -= 1;
      if (g.refreshTurns === 0) g.refresh = 0;
      gains.push(gain);
    }
  }
  eq('refresh total = 2x cost', g.mp, 6);
  check('refresh schedule 2,2,2', JSON.stringify(gains) === JSON.stringify([2, 2, 2]));
}

// --- lightning bolt = base + charge, resets charge -------------------------
{
  const g = new Game(5);
  g.start();
  g.mageCharge = 4;
  g.enemy.hp = 100;
  const idx = giveCard(g, 'ability');
  const res = g.playCard(idx, SLOT.RIGHT); // mage
  check('bolt played', res.ok, res.reason);
  eq('bolt dealt base + mult×charge', g.enemy.hp, 100 - (BOLT_BASE + BOLT_CHARGE_MULT * 4));
  eq('charge reset after firing', g.mageCharge, 0);
}

// --- charge ticks at start of player phase, before acting ------------------
{
  const g = new Game(6);
  g.start(); // player phase 1: charge ticked once (mage alive) => 1
  eq('charge ticks to 1 at start', g.mageCharge, 1);
}

// --- shield absorbs next instance, does not stack --------------------------
{
  const g = new Game(7);
  g.start();
  const mage = g.members[SLOT.RIGHT];
  const idxA = giveCard(g, 'shield');
  g.playCard(idxA, SLOT.RIGHT);
  const idxB = giveCard(g, 'shield');
  g.playCard(idxB, SLOT.RIGHT); // does not stack -> still one shield
  check('shield set', mage.shield === true);
  // force an attack on mage
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.RIGHT], enraged: false, forTurn: 2 };
  const before = mage.hp;
  g._resolveAttack();
  eq('shield absorbs (no dmg)', mage.hp, before);
  check('shield consumed', mage.shield === false);
}

// --- taunt forces primary to tank and retargets telegraph ------------------
{
  const g = new Game(8);
  g.start();
  // Standing telegraph might target anyone; fire taunt and verify retarget.
  const idx = giveCard(g, 'ability');
  g.playCard(idx, SLOT.CENTER); // tank
  eq('taunt set to 3', g.members[SLOT.CENTER].taunt, 3);
  const tel = g.telegraph!;
  check('telegraph retargeted to include tank', tel.targets.includes(SLOT.CENTER));
  if (tel.type === 'single' || tel.type === 'hidden') {
    check('single/hidden taunt -> tank only', tel.targets[0] === SLOT.CENTER);
  }
  // new telegraphs while taunting also target tank
  const tg = g._generateTelegraph(3);
  check('new telegraph under taunt targets tank', tg.targets.includes(SLOT.CENTER));
}

// --- resurrect to 50% max hp, statuses cleared -----------------------------
{
  const g = new Game(9);
  g.start();
  const mage = g.members[SLOT.RIGHT];
  g._killMember(mage);
  check('mage dead', !mage.alive);
  g.mp = 10;
  const idx = giveCard(g, 'resurrect');
  const res = g.playCard(idx, SLOT.RIGHT);
  check('resurrect played', res.ok, res.reason);
  eq('mage revived to 50% (ceil 6/2=3)', mage.hp, 3);
  check('mage alive again', mage.alive);
  eq('charge cleared on res', g.mageCharge, 0);
}

// --- skip regen +5, only before a card is played ---------------------------
{
  const g = new Game(10);
  g.start();
  const mpBefore = g.mp;
  check('can skip initially', g.canSkip());
  // play a card then verify skip blocked (use a fresh game to avoid ending turn)
  const g2 = new Game(10);
  g2.start();
  const idx = giveCard(g2, 'lowHeal');
  g2.members[SLOT.LEFT].hp = 1;
  g2.playCard(idx, SLOT.LEFT);
  check('cannot skip after playing a card', !g2.canSkip());
  // restAmount reflects what a rest would actually recover, clamped to MP_MAX
  const g3 = new Game(10);
  g3.start();
  g3.mp = 0;
  eq('restAmount is full SKIP_REGEN when far from cap', g3.restAmount(), 5);
  g3.mp = MP_MAX - 2; // 8; +5 would overshoot, so only 2 is recoverable
  eq('restAmount clamps to MP_MAX', g3.restAmount(), 2);
  g3.mp = MP_MAX;
  eq('restAmount is 0 at full MP', g3.restAmount(), 0);
  // skip on first game
  g.skipTurn();
  check('skip added at least +5 MP (minus any refresh noise)', g.mp >= mpBefore); // sanity
}

// --- MP is capped at MP_MAX ------------------------------------------------
{
  eq('MP_MAX is 10', MP_MAX, 10);
  const g = new Game(15);
  g.start();
  g.mp = MP_MAX - 1; // 9; resting adds +5 but must clamp to 10
  g.skipTurn();
  check('rest never exceeds MP_MAX', g.mp <= MP_MAX, `got ${g.mp}`);
  // refresh tick also clamps
  const g2 = new Game(16);
  g2.start();
  g2.mp = MP_MAX; g2.refresh = 2; g2.refreshTurns = REFRESH_TURNS;
  g2._runEnemyPhase(); // applies one refresh tick among other things
  check('refresh tick never exceeds MP_MAX', g2.mp <= MP_MAX, `got ${g2.mp}`);
}

// --- attackTargets() builds the right line specs ---------------------------
{
  const g = new Game(17);
  g.start();
  // known single -> 1 line carrying the telegraph damage
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.CENTER], enraged: false, forTurn: 2 };
  let lines = g.attackTargets();
  eq('single -> 1 line', lines.length, 1);
  eq('single line damage', lines[0].damage, 4);
  check('single line not hidden', lines[0].hidden === false);
  // aoe -> 3 lines
  g.telegraph = { type: 'aoe', hidden: false, damage: 2, targets: [0, 1, 2], enraged: false, forTurn: 2 };
  eq('aoe -> 3 lines', g.attackTargets().length, 3);
  // a dead targeted slot is filtered out
  g._killMember(g.members[SLOT.LEFT]);
  g.telegraph = { type: 'two', hidden: false, damage: 3, targets: [SLOT.LEFT, SLOT.CENTER], enraged: false, forTurn: 2 };
  lines = g.attackTargets();
  eq('dead target filtered', lines.length, 1);
  eq('surviving target is center', lines[0].slot, SLOT.CENTER);
  // hidden -> one line per living member, unknown damage
  const g2 = new Game(18);
  g2.start();
  g2.telegraph = { type: 'hidden', hidden: true, damage: 4, targets: [SLOT.CENTER], enraged: false, forTurn: 2 };
  const hl = g2.attackTargets();
  eq('hidden -> all living lines', hl.length, 3);
  check('hidden line damage is null', hl[0].damage === null);
  check('hidden line flagged hidden', hl[0].hidden === true);
}

// --- loss: party wipe ends immediately -------------------------------------
{
  const g = new Game(11);
  g.start();
  for (const m of g.members) { m.hp = 1; }
  // AoE that kills everyone
  g.telegraph = { type: 'aoe', hidden: false, damage: 9, targets: [0, 1, 2], enraged: false, forTurn: 2 };
  g._resolveAttack();
  check('all dead', g.allDead());
}

// --- win: party damage to 0 ends fight, no further enemy phase --------------
{
  const g = new Game(12);
  g.start();
  g.enemy.hp = 9; // party deals 9 with all alive
  g.endTurn();
  eq('enemy at 0', g.enemy.hp, 0);
  eq('status win', g.status, 'win');
  // The killing hit's event (carrying the zeroed enemyHp) must be emitted before
  // defeatEnemy, so the bar empties to 0 before the DEFEATED flourish plays —
  // otherwise the flourish lands while a red HP chunk is still on screen.
  const killIdx = g.events.findIndex((e) => e.kind === 'partyAttack' && (e as any).enemyHp === 0);
  const defeatIdx = g.events.findIndex((e) => e.kind === 'defeatEnemy');
  check('killing hit carries enemyHp 0', killIdx >= 0);
  check('hit emitted before defeatEnemy', killIdx >= 0 && defeatIdx === killIdx + 1,
    `killIdx=${killIdx} defeatIdx=${defeatIdx}`);
}

// --- whiff: attack on dead slot does nothing, others still land ------------
{
  const g = new Game(13);
  g.start();
  g._killMember(g.members[SLOT.LEFT]);
  const tank = g.members[SLOT.CENTER];
  const before = tank.hp;
  g.telegraph = { type: 'two', hidden: false, damage: 3, targets: [SLOT.LEFT, SLOT.CENTER], enraged: false, forTurn: 2 };
  g._resolveAttack();
  eq('tank still takes its hit despite ally whiff', tank.hp, before - 3);
}

// --- heal cannot overheal --------------------------------------------------
{
  const g = new Game(14);
  g.start();
  const tank = g.members[SLOT.CENTER];
  tank.hp = tank.maxHP - 1;
  const idx = giveCard(g, 'highHeal'); // heals 4
  g.mp = 10;
  g.playCard(idx, SLOT.CENTER);
  eq('heal capped at maxHP', tank.hp, tank.maxHP);
}

// --- events: party phase strikes left-to-right, enemy HP steps down ---------
{
  const g = new Game(20);
  g.start();
  g.enemy.hp = 100;
  g.endTurn();
  const party = g.events.filter((e) => e.kind === 'partyAttack');
  eq('party emits one event per living member', party.length, 3);
  check('party events ordered left-to-right',
    JSON.stringify(party.map((e: any) => e.slot)) === JSON.stringify([0, 1, 2]));
  // ranger 3, tank 1, mage 5 -> running enemy HP 97, 96, 91
  check('party enemyHp steps down per strike',
    JSON.stringify(party.map((e: any) => e.enemyHp)) === JSON.stringify([97, 96, 91]),
    JSON.stringify(party.map((e: any) => e.enemyHp)));
}

// --- events: heal records amount + resulting HP ----------------------------
{
  const g = new Game(21);
  g.start();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 4;
  g.mp = 10;
  const idx = giveCard(g, 'highHeal'); // heals 4, tank maxHP 12
  g.events = [];
  g.playCard(idx, SLOT.CENTER);
  const heal = g.events.find((e) => e.kind === 'heal') as any;
  check('heal event emitted', !!heal);
  eq('heal event amount', heal.amount, 4);
  eq('heal event resulting hp', heal.hp, 8);
}

// --- events: aoe heal emits one heal event per living member ----------------
{
  const g = new Game(22);
  g.start();
  for (const m of g.members) m.hp = 1;
  g.mp = 10;
  const idx = giveCard(g, 'aoeHeal');
  g.events = [];
  g.playCard(idx, null);
  eq('aoe heal emits per-member events', g.events.filter((e) => e.kind === 'heal').length, 3);
}

// --- events: bolt, poison, taunt, shield, regen, refresh, resurrect ---------
{
  const g = new Game(23);
  g.start();
  g.mageCharge = 2; g.enemy.hp = 100; g.mp = 10;
  let idx = giveCard(g, 'ability');
  g.events = [];
  g.playCard(idx, SLOT.RIGHT); // bolt: 5 + 2×2 = 9
  const bolt = g.events.find((e) => e.kind === 'bolt') as any;
  check('bolt event emitted', !!bolt);
  eq('bolt event amount', bolt.amount, BOLT_BASE + BOLT_CHARGE_MULT * 2);
  eq('bolt event enemyHp', bolt.enemyHp, 100 - (BOLT_BASE + BOLT_CHARGE_MULT * 2));

  idx = giveCard(g, 'ability');
  g.events = [];
  g.playCard(idx, SLOT.LEFT); // poison arrow
  const pois = g.events.find((e) => e.kind === 'poisonApplied') as any;
  check('poison event emitted', !!pois);
  eq('poison event amount', pois.amount, POISON_BASE);

  idx = giveCard(g, 'ability');
  g.events = [];
  g.playCard(idx, SLOT.CENTER); // taunt
  check('taunt event emitted', g.events.some((e) => e.kind === 'taunt'));

  g.mp = 10;
  idx = giveCard(g, 'shield');
  g.events = [];
  g.playCard(idx, SLOT.CENTER);
  check('shield event emitted', g.events.some((e) => e.kind === 'shieldApplied'));

  g.mp = 10;
  idx = giveCard(g, 'regen');
  g.events = [];
  g.playCard(idx, SLOT.LEFT);
  check('regen event emitted', g.events.some((e) => e.kind === 'regenApplied'));

  g.mp = 10;
  idx = giveCard(g, 'refresh');
  g.events = [];
  g.playCard(idx, null);
  check('refresh event emitted', g.events.some((e) => e.kind === 'refreshPrimed'));

  g._killMember(g.members[SLOT.RIGHT]);
  g.mp = 10;
  idx = giveCard(g, 'resurrect');
  g.events = [];
  g.playCard(idx, SLOT.RIGHT);
  check('resurrect event emitted', g.events.some((e) => e.kind === 'resurrect'));
}

// --- events: enemy attack records result + kill flag ------------------------
{
  const g = new Game(24);
  g.start();
  const mage = g.members[SLOT.RIGHT];
  mage.hp = 2;
  g.events = [];
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.RIGHT], enraged: false, forTurn: 2 };
  g._resolveAttack();
  const atk = g.events.find((e) => e.kind === 'enemyAttack') as any;
  check('enemy attack event emitted', !!atk);
  eq('enemy attack result is hit', atk.result, 'hit');
  check('enemy attack flags the kill', atk.killed === true);
}

// --- events: rest emits a rest event with the MP gained ---------------------
{
  const g = new Game(25);
  g.start();
  g.mp = 2;
  g.skipTurn();
  const rest = g.events.find((e) => e.kind === 'rest') as any;
  check('rest event emitted', !!rest);
  eq('rest event amount', rest.amount, 5);
}

// --- bar telegraph predictions ---------------------------------------------
{
  const g = new Game(50);
  g.start();
  // predictedRefresh: per-turn strength while active, capped by the room under MP_MAX.
  g.refresh = 2; g.refreshTurns = REFRESH_TURNS;
  g.mp = MP_MAX;
  eq('predictedRefresh 0 at MP cap', g.predictedRefresh(), 0);
  g.mp = MP_MAX - 1;
  eq('predictedRefresh limited to room', g.predictedRefresh(), 1);
  g.mp = 0;
  eq('predictedRefresh is the strength', g.predictedRefresh(), 2);
  g.refreshTurns = 0;
  eq('predictedRefresh 0 once expired', g.predictedRefresh(), 0);

  // predictedPoison: per-turn strength while active, capped by enemy HP.
  g.enemy.poison = 3; g.enemy.poisonTurns = POISON_TURNS;
  g.enemy.hp = 100;
  eq('predictedPoison is the strength', g.predictedPoison(), 3);
  g.enemy.hp = 2;
  eq('predictedPoison capped at enemy HP', g.predictedPoison(), 2);
  g.enemy.poisonTurns = 0;
  eq('predictedPoison 0 once expired', g.predictedPoison(), 0);
}

// --- full game smoke test: never throws, terminates ------------------------
{
  for (let seed = 100; seed < 110; seed++) {
    const g = new Game(seed);
    g.start();
    let guard = 0;
    while (g.status === 'playing' && guard < 500) {
      // naive policy: heal the lowest-hp living member if affordable, else skip/end
      const living = g.livingMembers().sort((a, b) => (a.hp / a.maxHP) - (b.hp / b.maxHP));
      let acted = false;
      for (let i = 0; i < g.hand.length; i++) {
        const card = CARDS[g.hand[i].id];
        if (card.target === 'single' && g.mp >= card.cost && living.length) {
          if (g.playCard(i, living[0].slot).ok) { acted = true; break; }
        }
      }
      if (!acted && g.canSkip() && g.mp < 3) g.skipTurn();
      else g.endTurn();
      check(`game seed ${seed} MP within cap`, g.mp <= MP_MAX, `got ${g.mp}`);
      guard++;
    }
    check(`game seed ${seed} terminates`, g.status !== 'playing', `guard=${guard}`);
  }
}

// --- BattleConfig parameterization -----------------------------------------
{
  // Default config reproduces the original fight.
  const g = new Game(1);
  eq('default start MP = MP_MAX', g.mp, MP_MAX);
  eq('default maxMana = MP_MAX', g.maxMana, MP_MAX);
  eq('default handSize 3', g.handSize, 3);
  eq('default party size 3', g.members.length, 3);
  eq('default abilityPower 0', g.members[0].abilityPower, 0);
}
{
  // Custom healer: bigger pool (start = max), larger hand.
  const cfg = defaultBattleConfig();
  cfg.healer = { maxMana: 14, handSize: 5, restRegen: 3, passiveMp: 0 };
  const g = new Game(2, cfg);
  g.start();
  eq('custom start MP = maxMana', g.mp, 14);
  eq('custom hand draws handSize', g.hand.length, 5);
}
{
  // Passive MP lands at the start of the player phase, capped at maxMana.
  const cfg = defaultBattleConfig();
  cfg.healer = { ...DEFAULT_HEALER, maxMana: 10, passiveMp: 3 };
  const g = new Game(3, cfg);
  g.start();
  g.mp = 0;     // spend everything
  g.endTurn();  // party + enemy phase, then next player phase grants passive MP
  check('passive MP grants at player phase start',
    g.status !== 'playing' || g.mp >= 3, `mp=${g.mp}`);
}
{
  // Ability power scales poison strength (Ranger).
  const cfg = defaultBattleConfig();
  cfg.party = cfg.party.map((p) => ({ ...p, abilityPower: 2 }));
  const g = new Game(4, cfg);
  g.start();
  g.playCard(giveCard(g, 'ability'), SLOT.LEFT);
  eq('poison strength includes abilityPower', g.enemy.poison, POISON_BASE + 2);
}
{
  // Ability power scales bolt damage (Mage).
  const cfg = defaultBattleConfig();
  cfg.party = cfg.party.map((p) => ({ ...p, abilityPower: 3 }));
  const g = new Game(5, cfg);
  g.start();
  const before = g.enemy.hp;
  const charge = g.mageCharge;
  g.playCard(giveCard(g, 'ability'), SLOT.RIGHT);
  eq('bolt damage includes abilityPower', before - g.enemy.hp,
    BOLT_BASE + 3 + BOLT_CHARGE_MULT * charge);
}
{
  // Custom party stats and enemy HP feed straight through.
  const cfg = defaultBattleConfig();
  cfg.party[SLOT.LEFT] = { maxHP: 20, damage: 7, abilityPower: 0 };
  cfg.enemy = { maxHP: 50, actionsPerTurn: 1 };
  const g = new Game(6, cfg);
  eq('custom member maxHP', g.members[SLOT.LEFT].maxHP, 20);
  eq('custom member starts at full', g.members[SLOT.LEFT].hp, 20);
  eq('custom member damage', g.members[SLOT.LEFT].damage, 7);
  eq('custom enemy maxHP', g.enemy.maxHP, 50);
}

// --- card upgrade modifiers -------------------------------------------------
{
  // Efficient: -1 cost per stack, floored at 0.
  eq('efficient -1 cost', resolveCard(makeDeckCard('highHeal', 1, ['efficient'])).cost, CARDS.highHeal.cost - 1);
  eq('efficient stacks', resolveCard(makeDeckCard('highHeal', 1, ['efficient', 'efficient'])).cost, CARDS.highHeal.cost - 2);
  eq('efficient floors at 0', resolveCard(makeDeckCard('lowHeal', 1, ['efficient', 'efficient'])).cost, 0);
}
{
  // Potent: +1 to the present strength stat; stacks.
  eq('potent +heal', resolveCard(makeDeckCard('highHeal', 1, ['potent'])).heal, (CARDS.highHeal.heal ?? 0) + 1);
  eq('potent +regen', resolveCard(makeDeckCard('regen', 1, ['potent'])).regen, (CARDS.regen.regen ?? 0) + 1);
  eq('potent +refresh', resolveCard(makeDeckCard('refresh', 1, ['potent'])).refresh, (CARDS.refresh.refresh ?? 0) + 1);
  eq('potent stacks', resolveCard(makeDeckCard('highHeal', 1, ['potent', 'potent'])).heal, (CARDS.highHeal.heal ?? 0) + 2);
}
{
  // Lingering: +1 duration on Regen/Refresh.
  eq('lingering +regen turns', resolveCard(makeDeckCard('regen', 1, ['lingering'])).regenTurns, REGEN_TURNS + 1);
  eq('lingering +refresh turns', resolveCard(makeDeckCard('refresh', 1, ['lingering'])).refreshTurns, REFRESH_TURNS + 1);
}
{
  // Eligibility gating and slot limits.
  check('potent ineligible on shield', !MODIFIERS.potent.eligible('shield'));
  check('potent eligible on refresh', MODIFIERS.potent.eligible('refresh'));
  check('lingering ineligible on highHeal', !MODIFIERS.lingering.eligible('highHeal'));
  check('lingering eligible on regen', MODIFIERS.lingering.eligible('regen'));
  check('retain eligible on anything', MODIFIERS.retain.eligible('shield'));
  check('two open slots applies', canApplyModifier(makeDeckCard('regen', 1, []), 'lingering'));
  check('one open slot applies', canApplyModifier(makeDeckCard('regen', 1, ['lingering']), 'lingering'));
  check('full slots reject', !canApplyModifier(makeDeckCard('regen', 1, ['lingering', 'lingering']), 'lingering'));
}
{
  // Potent regen strength flows into gameplay.
  const g = new Game(7);
  g.start();
  const tank = g.tank; tank.hp = 1;
  g.playCard(giveCard(g, 'regen', ['potent']), SLOT.CENTER);
  eq('potent regen strength applied', tank.regen, (CARDS.regen.regen ?? 0) + 1);
}
{
  // Retain keeps the card in hand after end of turn; a plain card is discarded.
  const g = new Game(8);
  g.start();
  g.hand = [];
  g.hand.push(makeDeckCard('shield', -100, ['retain']), makeDeckCard('lowHeal', -101, []));
  g.endTurn();
  check('retained card stays in hand', g.hand.some((c) => c.uid === -100));
  check('plain card left hand', !g.hand.some((c) => c.uid === -101));
}

// --- boss two-action enemy phase --------------------------------------------
{
  // Same seed, normal vs. boss: the boss strikes twice per phase, so the party
  // takes strictly more damage in the opening enemy phase.
  const seed = 12345;
  const normalCfg = defaultBattleConfig();
  const bossCfg = defaultBattleConfig();
  bossCfg.enemy = { maxHP: 100, actionsPerTurn: 2 };
  const gn = new Game(seed, normalCfg); gn.start();
  const gb = new Game(seed, bossCfg); gb.start();
  const lost = (g: Game) => g.members.reduce((s, m) => s + (m.maxHP - m.hp), 0);
  check('boss deals more total damage in one phase', lost(gb) > lost(gn),
    `normal=${lost(gn)} boss=${lost(gb)}`);
  const attacks = gb.events.filter((e) => e.kind === 'enemyAttack').length;
  check('boss emits >= 2 enemy attacks in opening phase', attacks >= 2, `got ${attacks}`);
}
{
  // The boss resolves two separate attacks during a mid-fight enemy phase too,
  // not only on the opening phase.
  const cfg = defaultBattleConfig();
  cfg.enemy = { maxHP: 100, actionsPerTurn: 2 };
  const g = new Game(999, cfg);
  g.start();
  g.endTurn(); // party phase, then a full boss enemy phase
  const attacks = g.events.filter((e) => e.kind === 'enemyAttack').length;
  check('boss resolves two actions mid-fight', attacks >= 2, `got ${attacks}`);
}

// --- dev / cheat methods ----------------------------------------------------
{
  const g = new Game(1); g.start();
  const before = g.enemy.hp;
  g.devDamageEnemy(10);
  eq('devDamageEnemy lowers enemy HP by 10', g.enemy.hp, before - 10);
  check('devDamageEnemy keeps fight going', g.status === 'playing');
}
{
  const g = new Game(1); g.start();
  g.devDamageEnemy(99999);
  eq('devDamageEnemy clamps HP at 0', g.enemy.hp, 0);
  eq('lethal devDamageEnemy wins the fight', g.status, 'win');
  check('lethal devDamageEnemy emits defeatEnemy', g.events.some((e) => e.kind === 'defeatEnemy'));
}
{
  const g = new Game(1); g.start();
  g.devKillEnemy();
  eq('devKillEnemy zeroes enemy HP', g.enemy.hp, 0);
  eq('devKillEnemy wins the fight', g.status, 'win');
}
{
  const g = new Game(1); g.start();
  const m = g.members[1];
  m.hp = 1;
  g.devHealMemberToFull(1);
  eq('devHealMemberToFull restores to max', m.hp, m.maxHP);
}
{
  const g = new Game(1); g.start();
  const m = g.members[2];
  g._killMember(m);
  g.devHealMemberToFull(2);
  check('devHealMemberToFull leaves a dead member dead', !m.alive && m.hp === 0);
}
{
  const g = new Game(1); g.start();
  g.mp = 0;
  g.devFillMana();
  eq('devFillMana fills MP to the cap', g.mp, g.maxMana);
}
{
  // Plays a card without spending MP or having it in hand.
  const g = new Game(1); g.start();
  const m = g.members[1];
  m.hp = 1;
  const mpBefore = g.mp;
  const handBefore = g.hand.length;
  g.devPlayCard('highHeal'); // auto-targets the first living member (slot 0)
  g.devPlayCard('highHeal', 1); // explicit target: the hurt tank
  check('devPlayCard heals the targeted member', m.hp > 1);
  eq('devPlayCard spends no MP', g.mp, mpBefore);
  eq('devPlayCard does not consume the hand', g.hand.length, handBefore);
}
{
  const g = new Game(1); g.start();
  const m = g.members[2];
  g._killMember(m);
  g.devPlayCard('resurrect'); // auto-targets the first dead member
  check('devPlayCard resurrect revives a dead member', m.alive && m.hp > 0);
}
{
  const g = new Game(1); g.start();
  g.devPlayCard('refresh');
  check('devPlayCard refresh primes MP regen', g.refreshTurns > 0 && g.refresh > 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
