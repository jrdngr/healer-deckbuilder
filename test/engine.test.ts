// Engine test harness. Run with: npm test  (tsx test/engine.test.ts)
import { Game } from '../src/engine';
import { DECK_LIST, CARDS, SLOT, MP_MAX, MEMBER_DEFS, POISON_BASE, POISON_TURNS, REGEN_TURNS, REFRESH_TURNS, BOLT_BASE, BOLT_CHARGE_MULT, SHIELD_TURNS, DEFENSE_TURNS, DEFENSE_AMOUNT, TAUNT_TURNS, TAUNT_RETARGET_SURCHARGE, ENRAGE_TURN, TYPE_WEIGHTS, SKIP_REGEN, SKIP_REGEN_DECAYED, REFRESH_MP_CAP, FONT_MP_CAP, CULTIVATE_STRENGTH, CULTIVATE_TURNS, BLOOM_HEAL_PER_TURN, LIFEBLOOM_BURST, HYMN_BONUS, BARRIER_TURNS, BLOOD_TITHE_MP, GRIM_HARVEST_DMG, PHALANX_DEFENSE, PHALANX_TURNS, BRACE_AMOUNT, BRACE_TURNS, CARD_RARITY, CARD_POOL, DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF, DEVOURER_MAW_DMG, WOUND_TURNS, SIPHON_AMOUNT, HEXWEAVER_PIERCER_DMG, ATTACK_INTENT_NAMES, makeDeckCard, defaultBattleConfig, DEFAULT_HEALER, resolveCard, canApplyModifier, isEngineCard, MODIFIERS } from '../src/constants';
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
  eq('2 Quick Heal', counts.lowHeal, 2);
  eq('2 Heal', counts.highHeal, 2);
  eq('2 Group Heal', counts.aoeHeal, 2);
  eq('2 Regen', counts.regen, 2);
  eq('2 Refresh', counts.refresh, 2);
  eq('3 Ability', counts.ability, 3);
  eq('1 Shield', counts.shield, 1);
  eq('1 Resurrect', counts.resurrect, 1);
}

// --- card heal values -------------------------------------------------------
eq('Quick Heal heals 2', CARDS.lowHeal.heal, 2);
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

// --- poison: flat 5/turn for 5 turns = 25, then stops ----------------------
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
  eq('poison schedule sum', seq.reduce((a, b) => a + b, 0), POISON_BASE * POISON_TURNS);
  check('poison is flat 5,5,5,5,5 then 0', JSON.stringify(seq) === JSON.stringify([5, 5, 5, 5, 5, 0]),
    JSON.stringify(seq));
}

// --- regen: flat strength for its duration, capped at maxHP ----------------
{
  const g = new Game(3);
  const ranger = g.members[SLOT.LEFT];
  ranger.hp = ranger.maxHP - 2; ranger.regen = 1; ranger.regenTurns = REGEN_TURNS;
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
  // ranger starts maxHP-2: +1, +1 (cap), +1 (no room)
  eq('regen capped total', ranger.hp, ranger.maxHP);
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
  eq('defense set on cast', tank.defense, 4);
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

// --- Defense lasts 4 enemy turns, then fades --------------------------------
{
  const g = new Game(41);
  g.start();
  const tank = g.members[SLOT.CENTER];
  g.mp = 10;
  g.playCard(giveCard(g, 'ability'), SLOT.CENTER); // taunt -> defense 4
  eq('defense starts at 4', tank.defense, 4);
  tank.hp = tank.maxHP; g.endTurn();
  eq('defense after 1 enemy turn', tank.defense, 3);
  tank.hp = tank.maxHP; g.endTurn();
  eq('defense after 2 enemy turns', tank.defense, 2);
  tank.hp = tank.maxHP; g.endTurn();
  eq('defense after 3 enemy turns', tank.defense, 1);
  tank.hp = tank.maxHP; g.endTurn();
  eq('defense after 4 enemy turns', tank.defense, 0);
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
  eq('shield fuse set', mage.shieldTurns, SHIELD_TURNS);
  // force an attack on mage
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.RIGHT], enraged: false, forTurn: 2 };
  const before = mage.hp;
  g._resolveAttack();
  eq('shield absorbs (no dmg)', mage.hp, before);
  check('shield consumed', mage.shield === false);
  eq('shield fuse cleared on consume', mage.shieldTurns, 0);
}

// --- shield survives a fully-mitigated (0-damage) hit (flaw #20) ------------
{
  const g = new Game(7);
  g.start();
  const tank = g.members[SLOT.CENTER];
  const idx = giveCard(g, 'shield');
  g.playCard(idx, SLOT.CENTER);
  // Give the tank Defense so a 1-damage attack is fully mitigated to 0.
  tank.defense = DEFENSE_TURNS;
  tank.defenseAmount = DEFENSE_AMOUNT + tank.abilityPower; // what Taunt would set (#17)
  const raw = DEFENSE_AMOUNT + tank.abilityPower; // reduced exactly to 0
  g.telegraph = { type: 'single', hidden: false, damage: raw, targets: [SLOT.CENTER], enraged: false, forTurn: 2 };
  const before = tank.hp;
  g._resolveAttack();
  eq('0-damage hit deals nothing', tank.hp, before);
  check('shield NOT consumed by a 0-damage hit', tank.shield === true);
}

// --- shield fades after SHIELD_TURNS enemy turns unused (flaw #4) -----------
{
  const g = new Game(7);
  g.start();
  const ranger = g.members[SLOT.LEFT];
  const idx = giveCard(g, 'shield');
  g.playCard(idx, SLOT.LEFT);
  // Run enemy phases where nothing hits the ranger; the fuse counts down.
  for (let i = 0; i < SHIELD_TURNS; i++) {
    // aim the telegraph away from the ranger so the shield stays unused
    g.telegraph = { type: 'single', hidden: false, damage: 3, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
    check(`shield alive before turn ${i + 1}`, ranger.shield === true);
    g._runEnemyPhase();
  }
  check('shield fades after SHIELD_TURNS unused', ranger.shield === false);
  eq('shield fuse at 0 after fade', ranger.shieldTurns, 0);
}

// --- telegraph preview reflects Shield (telegraph == applied invariant) -----
{
  const g = new Game(7);
  g.start();
  const mage = g.members[SLOT.RIGHT];
  mage.shield = true; mage.shieldTurns = SHIELD_TURNS;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.RIGHT], enraged: false, forTurn: g.turn };
  const spec = g.attackTargets().find((s) => s.slot === SLOT.RIGHT);
  eq('shielded member previews 0 damage', spec?.damage, 0);
  const before = mage.hp;
  g._resolveAttack();
  eq('applied damage matches preview (0)', mage.hp, before);
}

// --- taunt (future mode): standing blow still lands, future ones aim at tank -
{
  const g = new Game(8);
  g.start();
  g.tauntRetargetMode = 'future';
  const before = JSON.stringify(g.telegraph!.targets);
  const idx = giveCard(g, 'ability');
  g.playCard(idx, SLOT.CENTER); // taunt
  eq('taunt set to 4', g.members[SLOT.CENTER].taunt, 4);
  eq('standing telegraph is NOT redirected for free (future mode)',
    JSON.stringify(g.telegraph!.targets), before);
  // new telegraphs generated while taunting still funnel onto the tank
  const tg = g._generateTelegraph(3);
  check('new telegraph under taunt targets tank', tg.targets.includes(SLOT.CENTER));
}

// --- taunt (surcharge mode): redirect the standing blow for +1 MP -----------
{
  const g = new Game(8);
  g.start();
  g.tauntRetargetMode = 'surcharge';
  // A single-target blow aimed at the ranger — redirecting it matters.
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.LEFT], enraged: false, forTurn: g.turn };
  check('standing single-target blow is redirectable', g._standingTelegraphRedirectable());
  const mpBefore = g.mp;
  g.playCard(giveCard(g, 'ability'), SLOT.CENTER); // taunt
  eq('standing blow redirected onto the tank',
    JSON.stringify(g.telegraph!.targets), JSON.stringify([SLOT.CENTER]));
  eq('surcharge is +1 MP on top of the Ability cost',
    g.mp, mpBefore - CARDS.ability.cost - TAUNT_RETARGET_SURCHARGE);
}

// --- taunt (surcharge mode): no surcharge on a blow that can't be redirected -
{
  const g = new Game(8);
  g.start();
  g.tauntRetargetMode = 'surcharge';
  g.telegraph = { type: 'sweep', hidden: false, damage: 4, targets: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT], enraged: false, forTurn: g.turn };
  check('a sweep is not redirectable (hits everyone anyway)', g._standingTelegraphRedirectable() === false);
  const mpBefore = g.mp;
  g.playCard(giveCard(g, 'ability'), SLOT.CENTER); // taunt
  eq('no surcharge when redirect is pointless', g.mp, mpBefore - CARDS.ability.cost);
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
  eq('mage revived to 50% (ceil 9/2=5)', mage.hp, Math.ceil(mage.maxHP / 2));
  check('mage alive again', mage.alive);
  eq('charge cleared on res', g.mageCharge, 0);
  // Rework (#18): 4 MP, and the revive comes back behind a fresh Shield.
  eq('Resurrect costs 4 (rework, #18)', CARDS.resurrect.cost, 4);
  check('revived member comes back behind a Shield', mage.shield);
  eq('the revive Shield carries the full fuse', mage.shieldTurns, SHIELD_TURNS);
}

// --- skip regen +5, only before a card is played ---------------------------
{
  const g = new Game(10);
  g.start();
  const mpBefore = g.mp;
  check('can skip initially', g.canSkip());
  // Decaying Rest (issue 05): still allowed after ONE card, blocked after two.
  const g2 = new Game(10);
  g2.start();
  g2.members[SLOT.LEFT].hp = 1;
  g2.playCard(giveCard(g2, 'lowHeal'), SLOT.LEFT);
  check('can still skip after one card', g2.canSkip());
  g2.playCard(giveCard(g2, 'lowHeal'), SLOT.LEFT);
  check('cannot skip after two cards', !g2.canSkip());
  // restAmount reflects what a rest would actually recover, clamped to MP_MAX
  const g3 = new Game(10);
  g3.start();
  g3.mp = 0;
  eq('restAmount is full SKIP_REGEN with 0 cards played', g3.restAmount(), 5);
  g3.mp = MP_MAX - 2; // 8; +5 would overshoot, so only 2 is recoverable
  eq('restAmount clamps to MP_MAX', g3.restAmount(), 2);
  g3.mp = MP_MAX;
  eq('restAmount is 0 at full MP', g3.restAmount(), 0);
  // skip on first game
  g.skipTurn();
  check('skip added at least +5 MP (minus any refresh noise)', g.mp >= mpBefore); // sanity
}

// --- decaying Rest: +5 at 0 cards, +2 at 1 card (issue 05) ------------------
{
  const g = new Game(21);
  g.start();
  g.mp = 0;
  eq('rest gives full SKIP_REGEN at 0 cards', g.restRegenNow(), SKIP_REGEN);
  g.skipTurn();
  eq('rested +5 MP with 0 cards played', g.mp, SKIP_REGEN);
}
{
  const g = new Game(22);
  g.start();
  g.mp = 5;
  g.members[SLOT.LEFT].hp = 1;
  g.playCard(giveCard(g, 'lowHeal'), SLOT.LEFT); // 1 card, costs 1 -> mp 4
  eq('rest decays to SKIP_REGEN_DECAYED after one card', g.restRegenNow(), SKIP_REGEN_DECAYED);
  const before = g.mp;
  g.skipTurn();
  eq('rested +2 MP after one card', g.mp, before + SKIP_REGEN_DECAYED);
}

// --- Refresh cannot exceed its per-cast MP cap (flaw #7) --------------------
{
  const g = new Game(23);
  g.start();
  // A heavily-upgraded Refresh (Potent + Lingering) would be 3 MP/turn for 4 turns
  // = 12, but the per-cast cap holds total restored to REFRESH_MP_CAP.
  g.playCard(giveCard(g, 'refresh', ['potent', 'lingering']), null);
  let restored = 0;
  for (let i = 0; i < 6 && g.status === 'playing'; i++) {
    g.mp = 0;            // drain each turn so the cap, not MP_MAX, is what binds
    g._runEnemyPhase();  // applies one refresh tick (among other things)
    restored += g.mp;    // all MP present now came from this phase's refresh tick
  }
  check('Refresh never restores more than its per-cast cap', restored <= REFRESH_MP_CAP,
    `restored=${restored} cap=${REFRESH_MP_CAP}`);
  eq('Refresh ends once the cap is spent', g.refreshTurns, 0);
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
  eq('hidden line reveals the magnitude (not the target)', hl[0].damage, 4);
  check('hidden line flagged hidden', hl[0].hidden === true);
  // Per-member fold (playtest finding): a defended member's line shows what THEY
  // would take, and a Shield previews as 0 — preview == applied for any target.
  g2.tank.defense = DEFENSE_TURNS;
  g2.tank.defenseAmount = DEFENSE_AMOUNT + g2.tank.abilityPower; // what Taunt would set (#17)
  g2.mage.shield = true; g2.mage.shieldTurns = SHIELD_TURNS;
  const hl2 = g2.attackTargets();
  const bySlot = new Map(hl2.map((s) => [s.slot, s.damage]));
  eq('hidden line folds Defense for the defended member',
    bySlot.get(SLOT.CENTER), 4 - (DEFENSE_AMOUNT + g2.tank.abilityPower));
  eq('hidden line previews 0 for a shielded member', bySlot.get(SLOT.RIGHT), 0);
  eq('hidden line unchanged for an unprotected member', bySlot.get(SLOT.LEFT), 4);
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
  // ranger 4, tank 2, mage 5 -> running enemy HP 96, 94, 89
  check('party enemyHp steps down per strike',
    JSON.stringify(party.map((e: any) => e.enemyHp)) === JSON.stringify([96, 94, 89]),
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
  cfg.enemy = { maxHP: 50, boss: false, attackBonus: 0 };
  const g = new Game(6, cfg);
  eq('custom member maxHP', g.members[SLOT.LEFT].maxHP, 20);
  eq('custom member starts at full', g.members[SLOT.LEFT].hp, 20);
  eq('custom member damage', g.members[SLOT.LEFT].damage, 7);
  eq('custom enemy maxHP', g.enemy.maxHP, 50);
}

// --- card upgrade modifiers -------------------------------------------------
{
  // Efficient: -1 cost per stack, floored at 1 (never free).
  eq('efficient -1 cost', resolveCard(makeDeckCard('highHeal', 1, ['efficient'])).cost, CARDS.highHeal.cost - 1);
  eq('efficient stacks', resolveCard(makeDeckCard('highHeal', 1, ['efficient', 'efficient'])).cost, CARDS.highHeal.cost - 2);
  eq('efficient floors at 1', resolveCard(makeDeckCard('lowHeal', 1, ['efficient', 'efficient'])).cost, 1);
  eq('efficient floors highHeal at 1', resolveCard(makeDeckCard('highHeal', 1, ['efficient', 'efficient', 'efficient'])).cost, 1);
}
{
  // Efficient can't create a 0-cost card, so playing one still counts as a card
  // played (Rest is blocked afterward).
  const g = new Game(31);
  g.start();
  const idx = giveCard(g, 'lowHeal', ['efficient', 'efficient']);
  eq('efficient lowHeal still costs 1', resolveCard(g.hand[idx]).cost, 1);
  const mpBefore = g.mp;
  g.playCard(idx, SLOT.CENTER);
  eq('playing the card spent 1 MP', g.mp, mpBefore - 1);
  // The card counts as played: Rest still allowed but decayed, and a second card
  // blocks Rest entirely.
  eq('one card counted', g.cardsPlayedThisPhase, 1);
  eq('rest decays after that card', g.restRegenNow(), SKIP_REGEN_DECAYED);
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  check('cannot Rest after two cards', g.canSkip() === false);
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
  // Retain gating (issue 03): refuses the always-on Ability card and engine cards.
  check('retain eligible on shield', MODIFIERS.retain.eligible('shield'));
  check('retain eligible on lowHeal', MODIFIERS.retain.eligible('lowHeal'));
  check('retain refuses the Ability card', !MODIFIERS.retain.eligible('ability'));
  check('retain refuses the engine card Refresh', !MODIFIERS.retain.eligible('refresh'));
  check('Refresh is engine-tagged', isEngineCard('refresh'));
  check('Quick Heal is not engine-tagged', !isEngineCard('lowHeal'));
  // Efficient refuses 0-cost cards (there are none today; all base costs are > 0).
  check('efficient eligible on a costed card', MODIFIERS.efficient.eligible('highHeal'));
  check('two open slots applies', canApplyModifier(makeDeckCard('regen', 1, []), 'lingering'));
  check('one open slot applies', canApplyModifier(makeDeckCard('regen', 1, ['lingering']), 'lingering'));
  check('full slots reject', !canApplyModifier(makeDeckCard('regen', 1, ['lingering', 'lingering']), 'lingering'));
  // No-op purchases are refused (playtest finding): a modifier must change the card.
  check('efficient refuses a base-cost-1 card (floor makes it a no-op)',
    !canApplyModifier(makeDeckCard('lowHeal', 1, []), 'efficient'));
  check('efficient refuses a card already discounted to 1 (slot still open)',
    !canApplyModifier(makeDeckCard('regen', 1, ['efficient']), 'efficient'));
  check('efficient still applies while cost > 1', canApplyModifier(makeDeckCard('highHeal', 1, []), 'efficient'));
  check('a second retain is refused', !canApplyModifier(makeDeckCard('shield', 1, ['retain']), 'retain'));
  check('a first retain still applies', canApplyModifier(makeDeckCard('shield', 1, []), 'retain'));
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

// --- data-driven EnemyDef plumbing (issue 07) ------------------------------
{
  // A config without a def synthesizes the stock def from its boss flag.
  eq('normal config synthesizes DEFAULT_ENEMY_DEF', new Game(1).enemyDef, DEFAULT_ENEMY_DEF);
  const bossCfg = defaultBattleConfig(); bossCfg.enemy = { maxHP: 150, boss: true, attackBonus: 0 };
  eq('boss config synthesizes BOSS_ENEMY_DEF', new Game(1, bossCfg).enemyDef, BOSS_ENEMY_DEF);
}
{
  // The engine reads attack weights from the def: a custom all-single def only
  // ever rolls single (proves _pickType is data-driven, not forked on `boss`).
  const cfg = defaultBattleConfig();
  const onlySingle = { single: 1, two: 0, aoe: 0, hidden: 0, heavy: 0, sweep: 0, cast: 0 };
  cfg.enemy = {
    maxHP: 100, boss: false, attackBonus: 0,
    def: { id: 'test', name: 'Dummy', boss: false, baseWeights: onlySingle, enragedWeights: onlySingle },
  };
  const g = new Game(2, cfg);
  let allSingle = true;
  for (let turn = 2; turn <= 14; turn++) if (g._generateTelegraph(turn).type !== 'single') allSingle = false;
  check('custom def weights drive attack selection', allSingle);
  eq('enemy def name is surfaced', g.enemyDef.name, 'Dummy');
}
{
  // telegraphIntent surfaces a human-readable name for the standing telegraph.
  const g = new Game(3);
  g.start();
  g.telegraph = { type: 'heavy', hidden: false, damage: 7, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  eq('intent name for heavy', g.telegraphIntent(), ATTACK_INTENT_NAMES.heavy);
  g.status = 'win';
  eq('no intent once the fight is over', g.telegraphIntent(), null);
}

// --- member-identity refactor (issue 08) -----------------------------------
{
  // Charge is per-member and ticks for every living member each player phase.
  const g = new Game(41);
  g.start(); // one tick already happened at player-phase start
  for (const m of g.members) check(`${m.id} has per-member charge`, typeof m.charge === 'number' && m.charge >= 1);
  // mageCharge proxies the mage's charge (back-compat for UI/sim/tests).
  eq('mageCharge proxies mage.charge', g.mageCharge, g.mage.charge);
  g.mageCharge = 4;
  eq('setting mageCharge writes mage.charge', g.mage.charge, 4);
}
{
  // Bolt consumes only the caster's Charge, not other members'.
  const g = new Game(42);
  g.start();
  g.mage.charge = 3;
  g.ranger.charge = 2;
  g.mp = 10;
  g.playCard(giveCard(g, 'ability'), SLOT.RIGHT); // mage bolt
  eq('bolt cleared the caster charge', g.mage.charge, 0);
  eq("bolt left another member's charge alone", g.ranger.charge, 2);
}
{
  // Taunt is attributed to the caster, not a fixed slot.
  const g = new Game(43);
  g.start();
  g.mp = 10;
  g.playCard(giveCard(g, 'ability'), SLOT.CENTER); // tank taunt
  eq('taunt landed on the caster', g.tank.taunt, TAUNT_TURNS);
  eq('caster also braced with Defense', g.tank.defense, DEFENSE_TURNS);
  eq('tauntingMember() is the caster', g.tauntingMember(), g.tank);
  check('other members are not taunting', g.mage.taunt === 0 && g.ranger.taunt === 0);
}
{
  // memberDamage accessor returns the member's damage (the party-phase seam).
  const g = new Game(44);
  for (const m of g.members) eq(`memberDamage(${m.id})`, g.memberDamage(m), m.damage);
}

// --- Gatewarden: fixed rotation + Crushing Blow channel (issue 12) ----------
function gatewardenGame(seed: number, enrageTurn = 99): Game {
  const cfg = defaultBattleConfig();
  cfg.enemy = { maxHP: 9999, boss: true, attackBonus: 0, def: GATEWARDEN_DEF, enrageTurn };
  return new Game(seed, cfg);
}
{
  // Rotation is exact: single -> two -> heavy -> sweep, repeating, with the heavy
  // becoming Crushing Blow on every 2nd cycle.
  const g = gatewardenGame(1);
  const seq: string[] = [];
  for (let i = 0; i < 8; i++) {
    g.rotationIndex = i;
    const t = g._generateTelegraph(5);
    seq.push(t.channel ? `channel:${t.channelName}` : t.type);
  }
  eq('exact rotation with channel on cycle 2',
    JSON.stringify(seq),
    JSON.stringify(['single', 'two', 'heavy', 'sweep', 'single', 'two', 'channel:Crushing Blow', 'sweep']));
}
{
  // Crushing Blow: a 2-turn channel that deals 12 on resolve; no damage during
  // the wind-up (the enemy takes no other action while channelling). 12 keeps
  // the read answerable — a defended tank survives it when topped up, while the
  // ranger/mage still die to it (see the GATEWARDEN_DEF note).
  const g = gatewardenGame(2);
  g.rotationIndex = 6;               // the channel slot
  g.telegraph = g._generateTelegraph(3);
  check('channel is telegraphed', g.telegraph.channel === true);
  eq('channel damage is 12', g.telegraph.damage, 12);
  eq('channel takes 2 turns to resolve', g.telegraph.turnsUntilResolve, 2);
  const target = g.telegraph.targets[0];
  g.members[target].hp = 50;         // survive to measure the exact hit
  const before = g.members[target].hp;
  g.turn = 2; g._runEnemyPhase();     // wind-up turn: no damage
  eq('no damage during the wind-up', g.members[target].hp, before);
  eq('wind-up decremented the timer', g.telegraph.turnsUntilResolve, 1);
  check('still channelling after wind-up', g.telegraph.channel === true);
  g.members[target].hp = 50;
  g.turn = 3; g._runEnemyPhase();     // resolve turn
  eq('Crushing Blow lands for 12', g.members[target].hp, 38);
}
{
  // The channel is answerable by the tank and only the tank (the teaching): a
  // defended, topped-up tank survives the resolve; the squishies never do.
  const dmg = GATEWARDEN_DEF.channel!.damage;
  const [ranger, tank, mage] = MEMBER_DEFS;
  check('a defended full tank survives Crushing Blow',
    tank.maxHP - (dmg - DEFENSE_AMOUNT) > 0);
  check('Crushing Blow still one-shots a full ranger', ranger.maxHP - dmg <= 0);
  check('Crushing Blow still one-shots a full mage', mage.maxHP - dmg <= 0);
}
{
  // A Taunt cast DURING the wind-up still redirects the channel at resolve.
  const g = gatewardenGame(3);
  g.rotationIndex = 6;
  g.telegraph = g._generateTelegraph(3);
  g.telegraph.targets = [SLOT.LEFT];  // channel aimed at the ranger
  g.turn = 2; g._runEnemyPhase();      // wind-up (channel now resolves next turn)
  // Late taunt: the tank taunts during the wind-up.
  g.tank.taunt = TAUNT_TURNS; g.tank.defense = DEFENSE_TURNS;
  g.tank.defenseAmount = DEFENSE_AMOUNT + g.tank.abilityPower; // what Taunt would set (#17)
  g.ranger.hp = 50; g.tank.hp = 50;
  g.turn = 3; g._runEnemyPhase();      // resolve: should hit the taunting tank
  eq('channel redirected onto the taunting tank',
    g.tank.hp, 50 - (GATEWARDEN_DEF.channel!.damage - (DEFENSE_AMOUNT + g.tank.abilityPower)));
  eq('the original target (ranger) is untouched', g.ranger.hp, 50);
}
{
  // Naming legibility: the plain heavy must not share a name with the channel
  // that replaces it — the whole point of the rotation is telling them apart.
  check('generic heavy intent is not the channel name',
    ATTACK_INTENT_NAMES.heavy !== GATEWARDEN_DEF.channel!.name);
  const g = gatewardenGame(4);
  g.rotationIndex = 2;                 // plain heavy slot (cycle 1)
  g.telegraph = g._generateTelegraph(3);
  eq('plain heavy announces by its generic name', g.telegraphIntent(), ATTACK_INTENT_NAMES.heavy);
  g.rotationIndex = 6;                 // channel slot (cycle 2)
  g.telegraph = g._generateTelegraph(3);
  eq('a standing channel announces by its own name', g.telegraphIntent(), 'Crushing Blow');
  // The resolve log also names the channel, not the underlying attack type.
  const target = g.telegraph.targets[0];
  g.members[target].hp = 50;
  g.turn = 2; g._runEnemyPhase();      // wind-up
  g.members[target].hp = 50;
  g.turn = 3; g._runEnemyPhase();      // resolve
  check('the resolve log names the channel',
    g.log.some((l) => /Crushing Blow (hits|whiffs)/.test(l.text)),
    g.log.map((l) => l.text).slice(-3).join(' | '));
}

// --- Hexweaver: Piercing Bolt / Hex / Siphon + Cleanse (issue 13) -----------
function hexweaverGame(seed: number, enrageTurn = 99): Game {
  const cfg = defaultBattleConfig();
  cfg.enemy = { maxHP: 9999, boss: true, attackBonus: 0, def: HEXWEAVER_DEF, enrageTurn };
  return new Game(seed, cfg);
}
{
  // Rotation is exact and mixes the three tricks between whole-party pressure.
  const g = hexweaverGame(1);
  const seq: string[] = [];
  for (let i = 0; i < 6; i++) {
    g.rotationIndex = i;
    g.telegraph = g._generateTelegraph(5);
    seq.push(g.telegraphIntent() ?? '?');
  }
  eq('exact Hexweaver rotation (by intent name)',
    JSON.stringify(seq),
    JSON.stringify(['Strike', 'Piercing Bolt', 'Hex', 'Sweep', 'Piercing Bolt', 'Siphon']));
  // A bare-string opener still announces by its generic intent name.
  g.rotationIndex = 0; g.telegraph = g._generateTelegraph(5);
  eq('plain opener announces generically', g.telegraphIntent(), ATTACK_INTENT_NAMES.single);
}
{
  // Piercing Bolt ignores Taunt AND Defense and aims at the lowest-HP member — the
  // tank can't soak it and the fragile DPS is who's threatened.
  const g = hexweaverGame(2);
  g.tank.taunt = TAUNT_TURNS; g.tank.defense = DEFENSE_TURNS; // full taunt/defense up
  g.ranger.hp = 3; g.mage.hp = 9; g.tank.hp = 18;            // ranger is lowest
  g.rotationIndex = 1;                                        // Piercing Bolt slot
  g.telegraph = g._generateTelegraph(5);
  check('Piercing Bolt is telegraphed by name', g.telegraphIntent() === 'Piercing Bolt');
  eq('Piercing Bolt aims at the lowest-HP member (ranger), not the taunter', JSON.stringify(g.telegraph.targets), JSON.stringify([SLOT.LEFT]));
  // Preview must equal applied even though the tank is taunting/defending.
  const spec = g.attackTargets().find((s) => s.slot === SLOT.LEFT);
  eq('preview shows the full piercer damage (Defense ignored)', spec?.damage, HEXWEAVER_PIERCER_DMG);
  g.turn = 5; g._runEnemyPhase();
  eq('Piercing Bolt hit the ranger for full damage', g.ranger.hp, 3 - HEXWEAVER_PIERCER_DMG <= 0 ? 0 : 3 - HEXWEAVER_PIERCER_DMG);
  eq('the taunting tank was untouched by the piercer', g.tank.hp, 18);
}
{
  // Invariant: preview == applied for a Piercing Bolt aimed at a DEFENDED member —
  // the ignoreDefense flag must fold into both the preview and the hit identically.
  const g = hexweaverGame(20);
  g.tank.hp = 10; g.tank.defense = DEFENSE_TURNS; // tank is strictly lowest AND defending
  g.ranger.hp = 18; g.mage.hp = 18;
  g.rotationIndex = 1; g.telegraph = g._generateTelegraph(5);
  eq('piercer aims at the (defended) lowest tank', JSON.stringify(g.telegraph.targets), JSON.stringify([SLOT.CENTER]));
  const preview = g.attackTargets().find((s) => s.slot === SLOT.CENTER)?.damage ?? -1;
  const before = g.tank.hp;
  g.turn = 5; g._runEnemyPhase();
  const applied = before - g.tank.hp;
  eq('preview equals applied through Defense (both full piercer damage)', preview, applied);
  eq('and both equal the undefended piercer damage', applied, HEXWEAVER_PIERCER_DMG);
}
{
  // A Piercing Bolt is NOT redirected onto a taunter that taunts during the wind-up
  // (unlike Crushing Blow) — it pierces the funnel.
  const g = hexweaverGame(3);
  g.ranger.hp = 8; g.mage.hp = 9; g.tank.hp = 18;
  g.rotationIndex = 1; g.telegraph = g._generateTelegraph(5); // aims at ranger (lowest)
  check('not redirectable onto the tank', g._standingTelegraphRedirectable(SLOT.CENTER) === false);
}
{
  // Hex: a 'cast' that halves ALL healing for WOUND_TURNS turns — intercepts both
  // the direct heal path and the Regen tick (both route through _healMember).
  const g = hexweaverGame(4);
  g.rotationIndex = 2; g.telegraph = g._generateTelegraph(5); // Hex slot
  check('Hex telegraph is a cast', g.telegraph.cast === 'wound');
  check('Hex deals no damage lines', g.attackTargets().length === 0);
  g.turn = 5; g._runEnemyPhase();                             // Hex resolves
  check('party is Wounded after Hex', g.wounded === true);
  eq('Wound lasts WOUND_TURNS player phases', g.woundTurns, WOUND_TURNS);
  // Direct heal path: a Heal-4 heals only 2 while Wounded.
  g.tank.hp = 1;
  const healed = g._healMember(g.tank, 4);
  eq('direct heal is halved under Hex', healed, 2);
  // Regen tick path: strength 2 regens 1 while Wounded.
  g.mage.hp = 1; g.mage.regen = 2; g.mage.regenTurns = 3;
  g.phase = 'idle'; g._startPlayerPhase();
  eq('Regen tick is halved under Hex', g.mage.hp, 1 + 1);
}
{
  // Cleanse removes the Hex; healing returns to full.
  const g = hexweaverGame(5);
  g.woundTurns = WOUND_TURNS;
  const idx = giveCard(g, 'cleanse');
  g.phase = 'player';
  g.playCard(idx, null);
  check('Cleanse cleared the Hex', g.wounded === false);
  g.tank.hp = 1;
  eq('healing is full again after Cleanse', g._healMember(g.tank, 4), 4);
}
{
  // Wound lasts exactly WOUND_TURNS player phases (the same-turn decay does not eat one).
  const g = hexweaverGame(6);
  g.rotationIndex = 2; g.telegraph = g._generateTelegraph(5);
  g.turn = 5; g._runEnemyPhase();       // Hex resolves; woundTurns = 3
  let woundedPhases = 0;
  for (let k = 0; k < 5; k++) {
    if (g.wounded) woundedPhases++;      // player phase k: is healing halved?
    g.turn += 1; g._runEnemyPhase();     // next enemy phase decays it at the top
  }
  eq('Hex halves healing for exactly WOUND_TURNS player phases', woundedPhases, WOUND_TURNS);
}
{
  // Siphon: a 'cast' that drains SIPHON_AMOUNT MP, floored at 0, previewed on the bar.
  const g = hexweaverGame(7);
  g.rotationIndex = 5; g.telegraph = g._generateTelegraph(5); // Siphon slot
  check('Siphon telegraph is a cast', g.telegraph.cast === 'siphon');
  g.mp = 10;
  eq('Siphon preview matches the drain', g.predictedSiphon(), SIPHON_AMOUNT);
  g.turn = 5; g._runEnemyPhase();
  eq('Siphon drained the MP', g.mp, 10 - SIPHON_AMOUNT);
  // Floors at 0: from 1 MP, a 3-drain only takes 1.
  const g2 = hexweaverGame(8);
  g2.rotationIndex = 5; g2.telegraph = g2._generateTelegraph(5);
  g2.mp = 1;
  eq('Siphon floors at 0', g2.predictedSiphon(), 1);
  g2.turn = 5; g2._runEnemyPhase();
  eq('Siphon left MP at 0, not negative', g2.mp, 0);
}
{
  // Cleanse is a pool card (uncommon) and is in the shop pool.
  check('Cleanse exists as an uncommon', CARDS.cleanse != null);
}

// --- Devourer: phase system + Consume + Maw (issue 14) ----------------------
function devourerGame(seed: number, maxHP = 200, enrageTurn = 99): Game {
  const cfg = defaultBattleConfig();
  cfg.enemy = { maxHP, boss: true, attackBonus: 0, def: DEVOURER_DEF, enrageTurn };
  return new Game(seed, cfg);
}
{
  // Consume: cleanses the enemy's OWN poison and self-heals for every remaining
  // tick (poison stops being free value against the Devourer).
  const g = devourerGame(1);
  g.enemy.hp = 100;                       // room to heal (below max 200)
  g.enemy.poison = 5; g.enemy.poisonTurns = 4; // 20 damage of poison still owed
  g.rotationIndex = 3; g.telegraph = g._generateTelegraph(2); // Consume slot
  check('Consume is a cast telegraph', g.telegraph.cast === 'consume');
  eq('Consume announces by name', g.telegraphIntent(), 'Consume');
  // Resolve the cast in isolation (a full enemy phase would first land one poison
  // tick, which is correct in play but muddies the pure heal-for-remaining check).
  g._resolveCast(g.telegraph);
  eq('Consume cleansed the enemy poison', g.enemy.poisonTurns, 0);
  eq('Consume also zeroed the poison strength', g.enemy.poison, 0);
  eq('Consume self-healed for the remaining ticks (5x4)', g.enemy.hp, 100 + 20);
}
{
  // Consume heal is capped at max HP and is a no-op with no poison up.
  const g = devourerGame(2);
  g.enemy.hp = 100;
  g.rotationIndex = 3; g.telegraph = g._generateTelegraph(2);
  g.turn = 2; g._runEnemyPhase();
  eq('Consume with no poison leaves HP unchanged', g.enemy.hp, 100);
}
{
  // Phase transition fires exactly once at <=50% HP, swaps in the phase-2 rotation
  // (Maw channel) and tightens enrage — and does NOT re-fire on further damage.
  const g = devourerGame(3, 200);
  check('starts un-transformed', g.phaseTriggered === false);
  check('phase-1 rotation is active', g.activeChannel() === undefined);
  g._damageEnemy(101, 'test');            // 200 -> 99 (<=50%)
  check('transformed at the threshold', g.phaseTriggered === true);
  check('phase-2 Maw channel is now active', g.activeChannel()?.name === 'Maw');
  eq('enrage tightened to the phase-2 turn', g.enrageTurn, 11);
  const beats = g.events.filter((e) => e.kind === 'phaseChange').length;
  eq('the transformation beat fired once', beats, 1);
  g.events = [];
  g._damageEnemy(20, 'test');             // further damage in phase 2
  eq('no second transformation beat', g.events.filter((e) => e.kind === 'phaseChange').length, 0);
}
{
  // The threshold is edge-detected even when a Poison tick is what crosses it.
  const g = devourerGame(4, 200);
  g.enemy.hp = 55;                        // just above 50% (100)
  g.enemy.poison = 10; g.enemy.poisonTurns = 2; // a 10-tick will cross 50%
  g.telegraph = g._generateTelegraph(2); // some phase-1 attack (not consume)
  g.turn = 2; g._runEnemyPhase();        // poison ticks 55 -> 45, crossing 50%
  check('a Poison tick triggers the phase once', g.phaseTriggered === true);
  check('Maw is active after the DoT-triggered transition', g.activeChannel()?.name === 'Maw');
}
{
  // Maw: a 2-turn channelled sweep that resolves for DEVOURER_MAW_DMG on every
  // living member. Drive to phase 2, then find and resolve a Maw.
  const g = devourerGame(5, 200);
  g._damageEnemy(150, 'test');           // -> 50, phase 2
  // Find the next Maw telegraph.
  let guard = 0;
  while (guard++ < 12) {
    g.rotationIndex += 1;
    const t = g._generateTelegraph(2);   // turn 2 (pre-enrage) so damage is base
    if (t.channel && t.channelName === 'Maw') { g.telegraph = t; break; }
  }
  check('a Maw telegraph was found in phase 2', g.telegraph?.channelName === 'Maw');
  eq('Maw is a 2-turn channel', g.telegraph!.turnsUntilResolve, 2);
  eq('Maw hits the whole party (sweep geometry)', g.telegraph!.targets.length, 3);
  eq('Maw base damage is DEVOURER_MAW_DMG', g.telegraph!.damage, DEVOURER_MAW_DMG);
  // Wind-up then resolve; every living member takes DEVOURER_MAW_DMG.
  for (const m of g.members) m.hp = m.maxHP;
  g.turn = 2; g._runEnemyPhase();        // wind-up (no damage)
  const preResolve = g.members.map((m) => m.hp);
  g.turn = 3; g._runEnemyPhase();        // resolve
  let allTookMaw = true;
  g.members.forEach((m, i) => { if (m.alive && preResolve[i] - m.hp !== DEVOURER_MAW_DMG) allTookMaw = false; });
  check('Maw resolved for DEVOURER_MAW_DMG on each member', allTookMaw);
}

// --- turn-1 attack is always a plain single (flaw #12) ----------------------
{
  // Turn 1 resolves on mount before any input, so it must not be a heavy/sweep.
  // Check both regular and boss configs across many seeds.
  const boss = defaultBattleConfig(); boss.enemy = { maxHP: 150, boss: true, attackBonus: 0 };
  let allSingle = true;
  for (let seed = 0; seed < 400; seed++) {
    if (new Game(seed)._generateTelegraph(1).type !== 'single') allSingle = false;
    if (new Game(seed, boss)._generateTelegraph(1).type !== 'single') allSingle = false;
  }
  check('turn-1 telegraph is always single (regular + boss)', allSingle);
  // The mounted fight opens on a single-target blow.
  const g = new Game(3, boss);
  g.start();
  const opener = g.log.find((l) => l.kind === 'hit');
  check('boss opening blow is single-target', opener !== undefined && !/Sweep|Heavy|AoE|Two/.test(opener!.text));
}

// --- enrage fires exactly on ENRAGE_TURN; countdown counts down -------------
{
  const g = new Game(9);
  g.start();
  eq('not enraged at turn 1', g.enemy.enraged, false);
  // Countdown legibility: ENRAGE_TURN - turn until it fires.
  eq('turnsUntilEnrage at turn 1', g.turnsUntilEnrage(), ENRAGE_TURN - 1);
  // Fast-forward to just before enrage without ending the fight.
  g.turn = ENRAGE_TURN - 1;
  eq('countdown reads 1 the turn before enrage', g.turnsUntilEnrage(), 1);
  g.enemy.hp = 999; // keep the fight alive through the enrage turn
  g.endTurn();
  eq('enrage fires exactly on ENRAGE_TURN', g.enemy.enraged, true);
  eq('turnsUntilEnrage is 0 once enraged', g.turnsUntilEnrage(), 0);
}

// --- tuned enraged sweep weight matches the softened constant (issue 04) -----
eq('enraged sweep weight softened to 10', TYPE_WEIGHTS.bossEnraged.sweep, 10);
eq('non-enraged boss sweep unchanged at 20', TYPE_WEIGHTS.boss.sweep, 20);

// --- boss attack pool: stronger, but fully telegraphed (no hidden 2nd strike) ---
{
  // The boss draws from its own attack pool, which includes the heavy/sweep types
  // that regular enemies never use. Sweep over many seeds to observe them.
  const cfg = defaultBattleConfig();
  cfg.enemy = { maxHP: 150, boss: true, attackBonus: 0 };
  const types = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    const g = new Game(seed, cfg);
    types.add(g._generateTelegraph(2).type);   // pre-enrage boss pool (turn 1 is forced single)
    types.add(g._generateTelegraph(11).type);  // enraged boss pool
  }
  check('boss uses the heavy attack', types.has('heavy'));
  check('boss uses the sweep attack', types.has('sweep'));
  check('boss never uses the hidden (untelegraphed) attack', !types.has('hidden'));
}
{
  // Regular enemies never roll the boss-only types.
  const cfg = defaultBattleConfig(); // boss: false
  const types = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    const g = new Game(seed, cfg);
    types.add(g._generateTelegraph(2).type);
    types.add(g._generateTelegraph(11).type);
  }
  check('regular enemy never uses heavy', !types.has('heavy'));
  check('regular enemy never uses sweep', !types.has('sweep'));
}
{
  // The boss resolves exactly one (telegraphed) attack per enemy phase — its
  // standing telegraph — never a hidden extra strike. Every blow that lands is
  // one the player could see coming.
  const cfg = defaultBattleConfig();
  cfg.enemy = { maxHP: 150, boss: true, attackBonus: 0 };
  for (let seed = 0; seed < 50; seed++) {
    const g = new Game(seed, cfg);
    g.telegraph = g._generateTelegraph(1);
    const telegraphed = g.telegraph.targets.filter((s) => g.members[s].alive).length;
    g.events = [];
    g._runEnemyPhase(); // resolves the standing telegraph, then telegraphs the next turn
    const hits = g.events.filter((e) => e.kind === 'enemyAttack').length;
    check(`boss enemy phase resolves only the telegraph (seed ${seed})`,
      hits === telegraphed, `hits=${hits} telegraphed=${telegraphed}`);
  }
}
{
  // attackBonus raises every attack's per-target damage (the per-fight difficulty ramp).
  const base = defaultBattleConfig();
  const buffed = defaultBattleConfig();
  buffed.enemy = { maxHP: 100, boss: false, attackBonus: 2 };
  const gb = new Game(1, base);
  const gp = new Game(1, buffed);
  eq('attackBonus adds to single damage', gp.attackDamage('single', 1), gb.attackDamage('single', 1) + 2);
  eq('attackBonus adds before enrage', gp.attackDamage('single', 11), Math.ceil((4 + 2) * 1.25));
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

// --- card set phase A: Overgrowth / Cultivate / Bloom / Font of Mana / Inspiration (issue 15) ---
{
  // Definitions: costs, strengths, rarities (shop prices follow rarity 25/50/75).
  eq('Overgrowth costs 3', CARDS.overgrowth.cost, 3);
  eq('Overgrowth regen strength 1', CARDS.overgrowth.regen, 1);
  eq('Overgrowth targets all', CARDS.overgrowth.target, 'all');
  eq('Overgrowth is uncommon', CARD_RARITY.overgrowth, 'uncommon');
  eq('Cultivate costs 1', CARDS.cultivate.cost, 1);
  eq('Cultivate is common', CARD_RARITY.cultivate, 'common');
  eq('Bloom costs 2', CARDS.bloom.cost, 2);
  eq('Bloom is uncommon', CARD_RARITY.bloom, 'uncommon');
  eq('Font of Mana costs 3', CARDS.fontOfMana.cost, 3);
  eq('Font of Mana refresh strength 3', CARDS.fontOfMana.refresh, 3);
  eq('Font of Mana is rare', CARD_RARITY.fontOfMana, 'rare');
  eq('Inspiration costs 2', CARDS.inspiration.cost, 2);
  eq('Inspiration draws 2', CARDS.inspiration.draw, 2);
  eq('Inspiration is uncommon', CARD_RARITY.inspiration, 'uncommon');
  check('all five phase-A cards joined the shop pool',
    (['overgrowth', 'cultivate', 'bloom', 'fontOfMana', 'inspiration'] as CardId[])
      .every((id) => CARD_POOL.includes(id)));
}
{
  // Overgrowth: Regen 1 to every living member with the Regen card's no-stack
  // semantics (keep the stronger strength, refresh the duration); dead skipped.
  const g = new Game(60); g.start();
  const [ranger, tank, mage] = g.members;
  tank.regen = 2; tank.regenTurns = 1; // a stronger, nearly-spent stack
  g._killMember(mage);
  g.playCard(giveCard(g, 'overgrowth'), null);
  eq('Overgrowth grants Regen 1', ranger.regen, 1);
  eq('Overgrowth runs for REGEN_TURNS', ranger.regenTurns, REGEN_TURNS);
  eq('Overgrowth keeps a stronger Regen', tank.regen, 2);
  eq('Overgrowth refreshes the stronger stack\'s duration', tank.regenTurns, REGEN_TURNS);
  eq('Overgrowth skips the dead', mage.regenTurns, 0);
  // Potent-ineligible (a +1 would be x3 members x3 turns); Lingering still applies.
  check('Overgrowth is Potent-ineligible', !MODIFIERS.potent.eligible('overgrowth'));
  check('Overgrowth still takes Lingering', MODIFIERS.lingering.eligible('overgrowth'));
}
{
  // Cultivate: dead without an active Regen; modifies the stack IN PLACE.
  const g = new Game(61); g.start();
  const tank = g.tank;
  const idx = giveCard(g, 'cultivate');
  eq('Cultivate is dead without an active Regen', g.canPlay(idx, SLOT.CENTER), 'target must have an active Regen');
  tank.regen = 1; tank.regenTurns = 2;
  eq('Cultivate is playable with an active Regen', g.canPlay(idx, SLOT.CENTER), null);
  g.playCard(idx, SLOT.CENTER);
  eq('Cultivate adds strength in place (never overwrites)', tank.regen, 1 + CULTIVATE_STRENGTH);
  eq('Cultivate adds duration in place', tank.regenTurns, 2 + CULTIVATE_TURNS);
}
{
  // Bloom: dead without an active Regen; consumes it, healing per remaining turn.
  const g = new Game(62); g.start();
  const tank = g.tank;
  tank.hp = 5;
  const idx = giveCard(g, 'bloom');
  eq('Bloom is dead without an active Regen', g.canPlay(idx, SLOT.CENTER), 'target must have an active Regen');
  tank.regen = 1; tank.regenTurns = 3;
  g.playCard(idx, SLOT.CENTER);
  eq('Bloom heals 2 per remaining turn', tank.hp, 5 + BLOOM_HEAL_PER_TURN * 3);
  eq('Bloom consumes the Regen strength', tank.regen, 0);
  eq('Bloom consumes the Regen turns', tank.regenTurns, 0);
}
{
  // Font of Mana: Refresh 3 in the same status slot, with its own larger
  // per-cast lifetime — 9 MP restored total (net +6 after its 3 MP cost).
  const g = new Game(63); g.start();
  g.playCard(giveCard(g, 'fontOfMana'), null);
  eq('Font primes Refresh 3', g.refresh, 3);
  eq('Font runs for REFRESH_TURNS', g.refreshTurns, REFRESH_TURNS);
  eq('Font carries its own per-cast cap', g.refreshCap, FONT_MP_CAP);
  let restored = 0;
  for (let i = 0; i < 5 && g.status === 'playing'; i++) {
    g.mp = 0;            // drain each turn so the cap, not MP_MAX, is what binds
    g._runEnemyPhase();  // applies one refresh tick (among other things)
    restored += g.mp;
  }
  eq('Font restores 9 MP over its lifetime (net +6)', restored, FONT_MP_CAP);
  // The cap is the BASE card's designed lifetime; Potent shifts tempo, not total.
  eq('Potent does not raise the Font cap', resolveCard(makeDeckCard('fontOfMana', -90, ['potent'])).refreshCap, FONT_MP_CAP);
}
{
  // Refresh <-> Font share one status slot: keep-stronger strength, and each
  // cast carries ITS OWN card's cap (no chaining past a cast's designed total).
  const g = new Game(64); g.start();
  g.playCard(giveCard(g, 'fontOfMana'), null);
  g.mp = MP_MAX;
  g.playCard(giveCard(g, 'refresh'), null);
  eq('Refresh over Font keeps the stronger strength', g.refresh, 3);
  eq('Refresh over Font uses the Refresh cap', g.refreshCap, REFRESH_MP_CAP);
  const g2 = new Game(65); g2.start();
  g2.playCard(giveCard(g2, 'refresh'), null);
  g2.mp = MP_MAX;
  g2.playCard(giveCard(g2, 'fontOfMana'), null);
  eq('Font over Refresh keeps strength 3', g2.refresh, 3);
  eq('Font over Refresh carries the Font cap', g2.refreshCap, FONT_MP_CAP);
  eq('recasting resets the restored counter', g2.refreshRestored, 0);
}
{
  // Inspiration: draw 2; engine-tagged, so Retain / Efficient may not touch it.
  const g = new Game(66); g.start();
  const handBefore = g.hand.length;
  const idx = giveCard(g, 'inspiration');
  g.playCard(idx, null); // -1 played, +2 drawn
  eq('Inspiration draws 2 cards', g.hand.length, handBefore + 2);
  check('Inspiration is engine-tagged', isEngineCard('inspiration'));
  check('Font of Mana is engine-tagged', isEngineCard('fontOfMana'));
  check('Retain cannot lock in Inspiration', !MODIFIERS.retain.eligible('inspiration'));
  check('Retain cannot lock in Font of Mana', !MODIFIERS.retain.eligible('fontOfMana'));
  check('Efficient cannot discount Inspiration', !MODIFIERS.efficient.eligible('inspiration'));
  check('Efficient still applies to Font of Mana', MODIFIERS.efficient.eligible('fontOfMana'));
}
{
  // Inspiration with both piles otherwise empty: the played card is discarded
  // before it draws, so the reshuffle finds only Inspiration itself and draws it
  // back — net hand unchanged, second draw finds nothing, and nothing throws.
  const g = new Game(67); g.start();
  g.drawPile = []; g.discardPile = [];
  const idx = giveCard(g, 'inspiration');
  const handBefore = g.hand.length;
  g.playCard(idx, null);
  eq('Inspiration with empty piles redraws only itself', g.hand.length, handBefore);
  check('Inspiration comes back to hand off the reshuffle', g.hand.some((c) => c.id === 'inspiration'));
}

// --- card set phase B: Lifebloom / Surge / Battle Hymn / Barrier / Blood (issue 16) ---
{
  // Definitions: costs, blood costs, rarities (shop prices follow rarity 25/50/75).
  eq('Lifebloom costs 3', CARDS.lifebloom.cost, 3);
  eq('Lifebloom regen strength 2', CARDS.lifebloom.regen, 2);
  eq('Lifebloom is uncommon', CARD_RARITY.lifebloom, 'uncommon');
  eq('Surge costs 2', CARDS.surge.cost, 2);
  eq('Surge is uncommon', CARD_RARITY.surge, 'uncommon');
  eq('Battle Hymn costs 1', CARDS.battleHymn.cost, 1);
  eq('Battle Hymn is common', CARD_RARITY.battleHymn, 'common');
  eq('Barrier costs 4', CARDS.barrier.cost, 4);
  eq('Barrier is rare', CARD_RARITY.barrier, 'rare');
  eq('Blood Tithe costs 0 MP', CARDS.bloodTithe.cost, 0);
  eq('Blood Tithe blood cost 4', CARDS.bloodTithe.selfDamage, 4);
  eq('Blood Tithe is uncommon', CARD_RARITY.bloodTithe, 'uncommon');
  eq('Martyr\'s Gift costs 2', CARDS.martyrsGift.cost, 2);
  eq('Martyr\'s Gift blood cost 3', CARDS.martyrsGift.selfDamage, 3);
  eq('Martyr\'s Gift heals others 4', CARDS.martyrsGift.heal, 4);
  eq('Grim Harvest costs 2', CARDS.grimHarvest.cost, 2);
  eq('Grim Harvest blood cost 4', CARDS.grimHarvest.selfDamage, 4);
  eq('Grim Harvest is rare', CARD_RARITY.grimHarvest, 'rare');
  check('all seven phase-B cards joined the shop pool',
    (['lifebloom', 'surge', 'battleHymn', 'barrier', 'bloodTithe', 'martyrsGift', 'grimHarvest'] as CardId[])
      .every((id) => CARD_POOL.includes(id)));
}
{
  // Lifebloom end condition 1 — natural expiry: ticks 2/turn, then bursts 3.
  const g = new Game(70); g.start();
  const tank = g.tank;
  tank.hp = 5;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER);
  eq('Lifebloom applies Regen 2', tank.regen, 2);
  eq('Lifebloom runs for REGEN_TURNS', tank.regenTurns, REGEN_TURNS);
  eq('Lifebloom arms its burst', tank.bloomBurst, LIFEBLOOM_BURST);
  for (let i = 0; i < REGEN_TURNS; i++) g._startPlayerPhase(); // each ticks Regen once
  eq('Lifebloom ticks then bursts on expiry', tank.hp, 5 + 2 * REGEN_TURNS + LIFEBLOOM_BURST);
  eq('the paid burst is cleared', tank.bloomBurst, 0);
}
{
  // End condition 2 — overwrite by a new Regen-slot cast pays the burst out.
  const g = new Game(71); g.start();
  const tank = g.tank;
  tank.hp = 5;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER);
  const hpBefore = tank.hp;
  g.playCard(giveCard(g, 'regen'), SLOT.CENTER);
  eq('overwrite pays the burst immediately', tank.hp, hpBefore + LIFEBLOOM_BURST);
  eq('keep-stronger keeps Lifebloom strength', tank.regen, 2);
  eq('no burst left pending', tank.bloomBurst, 0);
}
{
  // End condition 3 — Bloom's consume: consume heal + burst together.
  const g = new Game(72); g.start();
  const tank = g.tank;
  tank.hp = 3;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER);
  const hpBefore = tank.hp;
  g.playCard(giveCard(g, 'bloom'), SLOT.CENTER);
  eq('Bloom on Lifebloom heals consume + burst', tank.hp, hpBefore + BLOOM_HEAL_PER_TURN * REGEN_TURNS + LIFEBLOOM_BURST);
  eq('the Regen is consumed', tank.regenTurns, 0);
  eq('the burst is spent', tank.bloomBurst, 0);
}
{
  // Death forfeits; Cultivate keeps the burst pending (in-place, no overwrite).
  const g = new Game(73); g.start();
  const tank = g.tank;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER);
  g.playCard(giveCard(g, 'cultivate'), SLOT.CENTER);
  eq('Cultivate keeps the burst pending', tank.bloomBurst, LIFEBLOOM_BURST);
  eq('Cultivate still modifies in place', tank.regen, 2 + CULTIVATE_STRENGTH);
  g._killMember(tank);
  eq('death forfeits the burst', tank.bloomBurst, 0);
  eq('no posthumous heal', tank.hp, 0);
}
{
  // Surge: the next card this turn costs 0; consumed by exactly one play.
  const g = new Game(74); g.start();
  g.mp = 5;
  g.playCard(giveCard(g, 'surge'), null);
  eq('Surge costs its own 2 MP', g.mp, 3);
  check('Surge is pending', g.surgePending);
  const idx = giveCard(g, 'highHeal');
  eq('effectiveCost is 0 under Surge', g.effectiveCost(resolveCard(g.hand[idx])), 0);
  g.members[SLOT.LEFT].hp = 1;
  g.playCard(idx, SLOT.LEFT);
  eq('the surged card spent no MP', g.mp, 3);
  check('Surge is consumed by one play', !g.surgePending);
}
{
  // Surge makes an otherwise-unaffordable card playable; Surge->Surge is legal.
  const g = new Game(75); g.start();
  g.mp = 2;
  g.playCard(giveCard(g, 'surge'), null); // -> 0 MP, surge pending
  const heal = giveCard(g, 'highHeal');
  eq('canPlay allows a 3-cost card at 0 MP under Surge', g.canPlay(heal, SLOT.CENTER), null);
  const surge2 = giveCard(g, 'surge');
  g.playCard(surge2, null); // consumes the pending surge, re-arms it: a strict loss
  eq('Surge->Surge spends no MP', g.mp, 0);
  check('Surge->Surge leaves a surge pending', g.surgePending);
  g.endTurn();
  check('an unspent Surge fizzles at end of turn', !g.surgePending);
}
{
  // Battle Hymn: +2 on every living auto THIS party phase; resets after.
  const g = new Game(76); g.start();
  g.playCard(giveCard(g, 'battleHymn'), null);
  const expected = g.livingMembers().reduce((s, m) => s + m.damage + HYMN_BONUS, 0);
  const ehp = g.enemy.hp;
  g.endTurn(); // party phase swings with the hymn, then the enemy phase runs
  eq('Hymn adds +2 to each living auto', ehp - g.enemy.hp, expected);
  eq('Hymn resets after the party phase', g.hymnBonus, 0);
}
{
  // Battle Hymn degrades as members die (per-member bonus, no corpse credit).
  const g = new Game(77); g.start();
  g._killMember(g.mage);
  g.playCard(giveCard(g, 'battleHymn'), null);
  const expected = g.livingMembers().reduce((s, m) => s + m.damage + HYMN_BONUS, 0);
  const ehp = g.enemy.hp;
  g.endTurn();
  eq('Hymn only buffs the living', ehp - g.enemy.hp, expected);
}
{
  // Barrier: every living member gains a 1-enemy-phase Shield; a longer-lived
  // Shield already standing is not downgraded; unused Barrier Shields fade
  // after exactly one enemy phase.
  const g = new Game(78); g.start();
  g.playCard(giveCard(g, 'shield'), SLOT.CENTER); // tank: full 3-turn Shield
  g.playCard(giveCard(g, 'barrier'), null);
  check('Barrier shields every living member', g.livingMembers().every((m) => m.shield));
  eq('Barrier fuse is 1 enemy phase', g.members[SLOT.LEFT].shieldTurns, BARRIER_TURNS);
  eq('Barrier never downgrades a longer Shield', g.members[SLOT.CENTER].shieldTurns, SHIELD_TURNS);
  g._runEnemyPhase(); // targets consume their Shield; unused Barrier ones fade
  check('no Barrier shield survives the enemy phase',
    [g.members[SLOT.LEFT], g.members[SLOT.RIGHT]].every((m) => !m.alive || !m.shield));
}
{
  // Blood Tithe: pay 4 HP for 2 MP (capped); gated on >4 HP; engine-tagged.
  const g = new Game(79); g.start();
  const tank = g.tank;
  tank.hp = 12;
  g.mp = 5;
  const idx = giveCard(g, 'bloodTithe');
  eq('Tithe playable above the gate', g.canPlay(idx, SLOT.CENTER), null);
  g.playCard(idx, SLOT.CENTER);
  eq('Tithe pays 4 HP', tank.hp, 8);
  eq('Tithe restores 2 MP', g.mp, 5 + BLOOD_TITHE_MP);
  const idx2 = giveCard(g, 'bloodTithe');
  tank.hp = 4;
  eq('Tithe is blocked at exactly 4 HP', g.canPlay(idx2, SLOT.CENTER), 'target must have more than 4 HP');
  tank.hp = 18; g.mp = g.maxMana;
  g.playCard(idx2, SLOT.CENTER);
  eq('Tithe MP gain respects the cap', g.mp, g.maxMana);
  check('Blood Tithe is engine-tagged', isEngineCard('bloodTithe'));
  check('Retain cannot lock in Blood Tithe', !MODIFIERS.retain.eligible('bloodTithe'));
  check('Efficient cannot touch a 0-cost card', !MODIFIERS.efficient.eligible('bloodTithe'));
}
{
  // Martyr's Gift: the target pays 3; every OTHER living member heals 4.
  const g = new Game(80); g.start();
  const [ranger, tank, mage] = g.members;
  ranger.hp = 5; tank.hp = 10; mage.hp = 3;
  g.playCard(giveCard(g, 'martyrsGift'), SLOT.CENTER);
  eq('Gift: the target pays 3', tank.hp, 7);
  eq('Gift: ranger heals 4', ranger.hp, 9);
  eq('Gift: mage heals 4', mage.hp, 7);
}
{
  // Grim Harvest: the target pays 4; the enemy takes 10 (can trigger phase/kill).
  const g = new Game(81); g.start();
  const tank = g.tank;
  const hpBefore = tank.hp;
  const ehp = g.enemy.hp;
  g.playCard(giveCard(g, 'grimHarvest'), SLOT.CENTER);
  eq('Harvest deals 10 to the enemy', ehp - g.enemy.hp, GRIM_HARVEST_DMG);
  eq('Harvest: the target pays 4', tank.hp, hpBefore - 4);
}
{
  // Blood is never lethal: even bypassing canPlay (dev path), the payment
  // clamps to leave 1 HP.
  const g = new Game(82); g.start();
  const tank = g.tank;
  tank.hp = 2;
  g.devPlayCard('grimHarvest', SLOT.CENTER);
  eq('Blood pay clamps to leave 1 HP', tank.hp, 1);
  check('the member survives the payment', tank.alive);
}

// --- card set phase C: Phalanx / Brace + the Defense pipeline (issue 17) ----
{
  eq('Phalanx costs 2', CARDS.phalanx.cost, 2);
  eq('Phalanx is uncommon', CARD_RARITY.phalanx, 'uncommon');
  eq('Brace costs 1', CARDS.brace.cost, 1);
  eq('Brace is common', CARD_RARITY.brace, 'common');
  check('both phase-C cards joined the shop pool',
    (['phalanx', 'brace'] as CardId[]).every((id) => CARD_POOL.includes(id)));
}
{
  // Phalanx: Defense 2 for 2 enemy turns; Defense-exclusive (its no-stack rule)
  // and never on the taunting member.
  const g = new Game(92); g.start();
  const ranger = g.ranger;
  const idx = giveCard(g, 'phalanx');
  eq('Phalanx playable on an undefended member', g.canPlay(idx, SLOT.LEFT), null);
  g.playCard(idx, SLOT.LEFT);
  eq('Phalanx grants Defense strength 2', ranger.defenseAmount, PHALANX_DEFENSE);
  eq('Phalanx lasts 2 enemy turns', ranger.defense, PHALANX_TURNS);
  const idx2 = giveCard(g, 'phalanx');
  eq('Phalanx refuses a defended member (no stack)', g.canPlay(idx2, SLOT.LEFT), 'target already has Defense');
  g.tank.taunt = 2; g.tank.defense = 0; g.tank.defenseAmount = 0; // taunt outliving Defense (edge)
  eq('Phalanx refuses the taunting member', g.canPlay(idx2, SLOT.CENTER), 'cannot target the taunting member');
  // Expiry clears the per-member strength too.
  for (let i = 0; i < PHALANX_TURNS; i++) {
    g.telegraph = { type: 'single', hidden: false, damage: 0, targets: [SLOT.RIGHT], enraged: false, forTurn: g.turn + 1 };
    g._runEnemyPhase();
  }
  eq('expired Defense clears its strength', ranger.defenseAmount, 0);
}
{
  // Taunt keeps a stronger Defense already standing (Phalanx then Taunt).
  const g = new Game(93); g.start();
  const tank = g.tank;
  g.playCard(giveCard(g, 'phalanx'), SLOT.CENTER); // Defense 2 on the (untaunting) tank
  g.playCard(giveCard(g, 'ability'), SLOT.CENTER); // Taunt would grant only 1
  eq('Taunt keeps the stronger standing Defense', tank.defenseAmount, PHALANX_DEFENSE);
  eq('Taunt still refreshes the Defense duration', tank.defense, DEFENSE_TURNS);
}
{
  // Shield / Brace exclusivity: a member holds one; the newest replaces.
  const g = new Game(94); g.start();
  const mage = g.mage;
  g.playCard(giveCard(g, 'shield'), SLOT.RIGHT);
  g.playCard(giveCard(g, 'brace'), SLOT.RIGHT);
  check('Brace replaces a standing Shield', mage.brace && !mage.shield);
  eq('Brace carries its fade fuse', mage.braceTurns, BRACE_TURNS);
  g.playCard(giveCard(g, 'shield'), SLOT.RIGHT);
  check('Shield replaces a standing Brace', mage.shield && !mage.brace);
}
{
  // Pipeline order Defense -> Brace: preview and applied agree; Brace only
  // spends on a hit that still damages after Defense.
  const g = new Game(95); g.start();
  const tank = g.tank;
  tank.hp = tank.maxHP;
  tank.defense = 2; tank.defenseAmount = 2;
  tank.brace = true; tank.braceTurns = BRACE_TURNS;
  g.telegraph = { type: 'single', hidden: false, damage: 5, targets: [SLOT.CENTER], enraged: false, forTurn: 2 };
  eq('preview folds Defense then Brace', g.attackTargets()[0]?.damage, 5 - 2 - BRACE_AMOUNT);
  const before = tank.hp;
  g._resolveAttack();
  eq('applied equals the preview', before - tank.hp, 5 - 2 - BRACE_AMOUNT);
  check('Brace is consumed by the damaging hit', !tank.brace);
}
{
  // A hit Defense already absorbs to 0 leaves the Brace standing.
  const g = new Game(96); g.start();
  const tank = g.tank;
  tank.defense = 2; tank.defenseAmount = 4;
  tank.brace = true; tank.braceTurns = BRACE_TURNS;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.CENTER], enraged: false, forTurn: 2 };
  eq('Defense alone absorbs the hit', g.attackTargets()[0]?.damage, 0);
  g._resolveAttack();
  check('Brace not spent on a 0-damage hit', tank.brace);
}
{
  // Pipeline order Defense -> Shield: a partially-reduced hit still blocks (and
  // spends) the Shield; preview shows 0.
  const g = new Game(97); g.start();
  const tank = g.tank;
  tank.hp = tank.maxHP;
  tank.defense = 2; tank.defenseAmount = 2;
  tank.shield = true; tank.shieldTurns = SHIELD_TURNS;
  g.telegraph = { type: 'single', hidden: false, damage: 5, targets: [SLOT.CENTER], enraged: false, forTurn: 2 };
  eq('Shield previews the pipeline to 0', g.attackTargets()[0]?.damage, 0);
  const before = tank.hp;
  g._resolveAttack();
  eq('the blocked hit deals nothing', tank.hp, before);
  check('Shield is spent by the still-damaging hit', !tank.shield);
}
{
  // Unused Brace fades after BRACE_TURNS enemy turns.
  const g = new Game(98); g.start();
  const tank = g.tank;
  g.playCard(giveCard(g, 'brace'), SLOT.CENTER);
  for (let i = 0; i < BRACE_TURNS; i++) {
    g.telegraph = { type: 'single', hidden: false, damage: 0, targets: [SLOT.LEFT], enraged: false, forTurn: g.turn + 1 };
    g._runEnemyPhase();
  }
  check('unused Brace fades after its fuse', !tank.brace);
  eq('faded Brace clears its fuse', tank.braceTurns, 0);
}
{
  // PROPERTY: previewed per-target damage == applied damage through the full
  // Defense -> Brace -> Shield pipeline, across seeds and randomized ward
  // states (the #15/#17 telegraph invariant).
  let checked = 0;
  let mismatches = 0;
  for (let seed = 200; seed < 260; seed++) {
    const g = new Game(seed);
    g.start();
    // Randomize ward states deterministically off the game's own rng, and top
    // everyone up so a kill's HP floor can't mask the comparison.
    for (const m of g.members) {
      m.hp = m.maxHP;
      if (g.rng() < 0.5) { m.defense = 1 + Math.floor(g.rng() * 3); m.defenseAmount = 1 + Math.floor(g.rng() * 3); }
      const r = g.rng();
      if (r < 0.3) { m.shield = true; m.shieldTurns = SHIELD_TURNS; }
      else if (r < 0.6) { m.brace = true; m.braceTurns = BRACE_TURNS; }
    }
    const preview = new Map(g.attackTargets().map((s) => [s.slot, s.damage]));
    const hpBefore = g.members.map((m) => m.hp);
    g._runEnemyPhase();
    for (const m of g.members) {
      const taken = hpBefore[m.slot] - m.hp;
      if (taken === 0) continue; // not targeted (or fully mitigated) — nothing to compare
      checked++;
      if (taken !== preview.get(m.slot)) mismatches++;
    }
  }
  check('property: preview == applied across the ward pipeline (no mismatches)', mismatches === 0,
    `${mismatches} mismatches`);
  check('property test exercised real hits', checked > 20, `${checked} hits checked`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
