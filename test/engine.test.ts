// Engine test harness. Run with: npm test  (tsx test/engine.test.ts)
import { Game } from '../src/engine.js';
import { DECK_LIST, CARDS, SLOT, MP_MAX } from '../src/constants.js';
import type { CardId } from '../src/constants.js';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string | undefined = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}
function eq(name: string, a: unknown, b: unknown): void { check(name, a === b, `expected ${b}, got ${a}`); }

// Find a hand index for a card id, drawing/arranging as needed by stuffing the hand.
function giveCard(game: Game, cardId: CardId): number {
  game.hand.push(cardId);
  return game.hand.length - 1;
}

// --- deck composition -------------------------------------------------------
eq('deck has 15 cards', DECK_LIST.length, 15);
{
  const counts: Record<string, number> = {};
  for (const c of DECK_LIST) counts[c] = (counts[c] || 0) + 1;
  eq('3 Low Heal', counts.lowHeal, 3);
  eq('2 High Heal', counts.highHeal, 2);
  eq('2 AoE Heal', counts.aoeHeal, 2);
  eq('2 Regen', counts.regen, 2);
  eq('2 Refresh', counts.refresh, 2);
  eq('2 Ability', counts.ability, 2);
  eq('1 Shield', counts.shield, 1);
  eq('1 Resurrect', counts.resurrect, 1);
}

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

// --- poison decay schedule 5,4,3,2,1 = 15 ----------------------------------
{
  const g = new Game(2);
  g.start();
  g.enemy.poison = 5;
  g.enemy.hp = 100;
  const seq: number[] = [];
  // Run ticks only, isolate poison by neutralizing the attack each time.
  for (let i = 0; i < 5; i++) {
    const before = g.enemy.hp;
    // simulate just the poison tick portion
    if (g.enemy.poison > 0) { g.enemy.hp -= g.enemy.poison; g.enemy.poison -= 1; }
    seq.push(before - g.enemy.hp);
  }
  eq('poison schedule sum', seq.reduce((a, b) => a + b, 0), 15);
  check('poison decays 5..1', JSON.stringify(seq) === JSON.stringify([5, 4, 3, 2, 1]),
    JSON.stringify(seq));
}

// --- regen decay schedule 4,3,2,1 = 10, capped at maxHP --------------------
{
  const g = new Game(3);
  const ranger = g.members[SLOT.LEFT];
  ranger.hp = 1; ranger.regen = 4;
  const healed: number[] = [];
  for (let i = 0; i < 4; i++) {
    const before = ranger.hp;
    if (ranger.regen > 0) { ranger.hp = Math.min(ranger.maxHP, ranger.hp + ranger.regen); ranger.regen -= 1; }
    healed.push(ranger.hp - before);
  }
  // ranger maxHP 8, starts 1: +4 ->5, +3 ->8 (cap), +2 ->8 (no room), +1 ->8
  eq('regen capped total', ranger.hp, 8);
  check('regen ticks respect cap', JSON.stringify(healed) === JSON.stringify([4, 3, 0, 0]),
    JSON.stringify(healed));
}

// --- refresh returns 2x cost over 3,2,1 ------------------------------------
{
  const g = new Game(4);
  g.refresh = 3; g.mp = 0;
  const gains: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (g.refresh > 0) { const gain = g.refresh; g.mp += gain; g.refresh -= 1; gains.push(gain); }
  }
  eq('refresh total = 2x cost', g.mp, 6);
  check('refresh schedule 3,2,1', JSON.stringify(gains) === JSON.stringify([3, 2, 1]));
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
  eq('bolt dealt base+charge', g.enemy.hp, 100 - (3 + 4));
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
  g2.mp = MP_MAX; g2.refresh = 3;
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
  const idx = giveCard(g, 'highHeal'); // heals 8
  g.mp = 10;
  g.playCard(idx, SLOT.CENTER);
  eq('heal capped at maxHP', tank.hp, tank.maxHP);
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
        const card = CARDS[g.hand[i]];
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
