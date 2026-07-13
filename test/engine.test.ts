// Engine test harness. Run with: npm test  (tsx test/engine.test.ts)
import { Game } from '../src/engine';
import type { GameEvent } from '../src/engine';
import { channelEffectLine } from '../src/channelView';
import { DECK_LIST, CARDS, SLOT, MP_MAX, MEMBER_DEFS, POISON_BASE, POISON_TURNS, REFRESH_TURNS, BOLT_BASE, BOLT_CHARGE_MULT, SHIELD_TURNS, DEFENSE_TURNS, DEFENSE_AMOUNT, TAUNT_TURNS, TAUNT_RETARGET_SURCHARGE, ENRAGE_TURN, TYPE_WEIGHTS, SKIP_REGEN, SKIP_REGEN_DECAYED, REFRESH_MP_CAP, FONT_MP_CAP, CULTIVATE_STRENGTH, BLOOM_HEAL_PER_TURN, LIFEBLOOM_BURST, HYMN_BONUS, BARRIER_TURNS, BLOOD_TITHE_MP, GRIM_HARVEST_DMG, PHALANX_DEFENSE, PHALANX_TURNS, BRACE_AMOUNT, BRACE_TURNS, CARD_RARITY, CARD_POOL, DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF, IRONMAW_DEF, NEEDLER_DEF, LEECH_DEF, JUGGERNAUT_DEF, LANCER_DEF, DEVOURLING_DEF, NEEDLER_PIERCE_DMG, LANCER_PIERCE_DMG, DEVOURER_MAW_DMG, WOUND_TURNS, SIPHON_AMOUNT, HEXWEAVER_PIERCER_DMG, ATTACK_INTENT_NAMES, makeDeckCard, defaultBattleConfig, DEFAULT_HEALER, resolveCard, canApplyModifier, isEngineCard, MODIFIERS } from '../src/constants';
import { TITHE_CANDLE_MP, TITHE_CANDLE_FIGHT_CAP, FIELD_TRIAGE_BONUS, PRAYER_BEADS_MP, VANGUARD_BONUS, GROUNDING_ROD_REDUCTION, STORMGLASS_MIN_HIT, WARD_MAX, TAPER_MAX_COST, TAPER_DISCOUNT, DUSK_CHIME_MIN, PACT_PASSIVE_MP, CRACKED_HOURGLASS_ENRAGE, HOURGLASS_POWER_BONUS, RUSTY_CROWN_ATTACK } from '../src/constants';
import { partyFromMembers, isEngineAbility, HEX_TURNS, HEX_VULN_BY_SIZE, RALLY_DMG_PER_SEAT, FOCUS_HEAL, FOCUS_SMALL_BONUS, SKALD_DMG_PER_CARD, SKALD_DMG_CAP, CRESCENDO_DRAW, RAMPAGE_SELF_DMG, GRAVE_CHILL_REDUCTION, BOAR_HP, BOAR_TURNS, BOAR_STRIKE_BONUS, TAUNT_LITE_TURNS, TAUNT_LITE_DEFENSE } from '../src/constants';
import { abilityCardsForParty, isAbilityCard } from '../src/constants';
import { GUARD_DR, GUARD_TURNS, SHARPEN_BONUS, SHARPEN_TURNS, EMBOLDEN_BONUS, EMBOLDEN_TURNS, EMPOWER_BONUS, EN_GARDE_TURNS, PENANCE_HP, PENANCE_STRIKE_BONUS, SANGUINE_PACT_THRESHOLD, RADIANCE_HEAL } from '../src/constants';
import { ABILITY_CARD, MEMBER_POOL, MEMBER_ABILITY_FLAVOR, MEMBER_BASE_SALARY, FERMENT_TURNS, FERMENT_GROWTH, DRAFT_POOL } from '../src/constants';
import { CARD_TYPE, CARDS_BY_TYPE, cardType, cardsOfType } from '../src/constants';
import { SHADOW_BOLT_DMG, SIPHON_LIFE_DMG, SIPHON_LIFE_HEAL, DOOM_BASE, DOOM_PER_DEBUFF, DOOM_PER_VULN, DOOM_CAP } from '../src/constants';
import { HOLY_RELIC_HEAL, SHADOW_RELIC_DMG, IRON_RELIC_DISCOUNT } from '../src/constants';
import { ANVIL_STANCE_BONUS, INTERLOCK_GUARD_DR, INTERLOCK_GUARD_TURNS, BULWARK_BRACE_TURNS, WHETSTONE_BONUS, RELIC_IDS, RELICS } from '../src/constants';
import { THORNSKIN_REDUCTION, SPOREBURST_POISON, OSSUARY_REGEN, OSSUARY_THRESHOLD } from '../src/constants';
import { UMBRAL_FEAST_PER_EFFECT, DREAD_WHISPER_REDUCTION, VENOM_GLAND_BONUS_TURNS, EMBERMARK_DMG } from '../src/constants';
import { CRIMSON_PACT_HP, CRIMSON_PACT_DRAW, SCARLET_WARD_HP, OPEN_VEINS_HP, OPEN_VEINS_DMG, TRANSFUSION_HP, TRANSFUSION_HEAL, BLOOD_BANNER_HP, BLOOD_BANNER_BONUS, BLOOD_BANNER_TURNS, GRIMOIRE_DMG, SANGUINE_PACT_SURCHARGE, SANGUINE_PACT_AUTO_BONUS } from '../src/constants';
import { CASCADE_DRAW, CASCADE_DISCOUNT_PER_ARCANE, NIGHTFALL_BASE, NIGHTFALL_PER_SHADOW, NIGHTFALL_CAP } from '../src/constants';
import { DRAIN_DMG, DRAIN_MP_MIN, DRAIN_MP_MAX, DRAIN_MAX_TURNS, REFRESH_CHANNEL_MP, REFRESH_CHANNEL_MAX_TURNS, MENDING_STREAM_HEAL, MENDING_STREAM_MAX_TURNS, SAP_VULN_PER_TICK, SAP_VULN_CAP, SAP_MAX_TURNS, FORTIFY_MAX_TURNS } from '../src/constants';
import { BENEDICTION_HEAL, BENEDICTION_PER_BUFF, SUNRISE_VIGIL_HEAL, CONSECRATION_HEAL, CONSECRATION_STRIKE_BONUS, CONSECRATION_STRIKE_TURNS, ABSOLUTION_HEAL, ROOTBIND_BONUS_TURNS, BEACON_DRAW, TWIN_CENSER_SPLASH, PILGRIM_FLASK_HEAL } from '../src/constants';
import type { CardId, ModifierId, RelicId, Slot, CardType, MemberId } from '../src/constants';

import { check, eq, finish } from './harness';
import {
  giveCard, giveAbility, bossGame,
  gatewardenGame, hexweaverGame, devourerGame, sentinelBossGame,
} from './factories';

// --- deck composition -------------------------------------------------------
// #51: the starter deck is exactly the heal-only six — 1× Group Heal, 3× Quick
// Heal, 2× Heal, and nothing else. Regen/Refresh/Shield/Resurrect left the opener
// (they remain reachable via rewards/shops). Per #44, each deployed member still
// inserts their own bound ability card at fight lock-in (see the toBattleConfig
// injection test in run.test.ts), so the core deck is 6 and a full trio fights 9.
eq('deck has 6 core cards', DECK_LIST.length, 6);
{
  const counts: Record<string, number> = {};
  for (const c of DECK_LIST) counts[c] = (counts[c] || 0) + 1;
  eq('3 Quick Heal', counts.lowHeal, 3);
  eq('2 Heal', counts.highHeal, 2);
  eq('1 Group Heal', counts.aoeHeal, 1);
  eq('no Regen in the starter', counts.regen, undefined);
  eq('no Refresh in the starter', counts.refresh, undefined);
  eq('no Shield in the starter', counts.shield, undefined);
  eq('no Resurrect in the starter', counts.resurrect, undefined);
  eq('no generic Ability cards in the core deck', counts.ability, undefined);
  // Exactly the six heal-only cards, no extras of any other id.
  eq('starter has exactly 3 distinct card ids', Object.keys(counts).length, 3);
}

// --- card heal values -------------------------------------------------------
eq('Quick Heal heals 2', CARDS.lowHeal.heal, 2);
eq('Heal heals 4', CARDS.highHeal.heal, 4);
eq('Group Heal heals 2', CARDS.aoeHeal.heal, 2);
eq('Regen card applies +2 (#52)', CARDS.regen.regen, 2);
// Font of Mana (renamed "Refresh") stays the buff-style MP engine.
eq('Refresh (Font of Mana) strength 3', CARDS.fontOfMana.refresh, 3);
eq('Refresh (Font of Mana) is named Refresh', CARDS.fontOfMana.name, 'Refresh');

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

// --- regen (#52): magnitude IS duration; decays each tick, capped at maxHP ----
{
  const g = new Game(3);
  g.start();
  const m = g.members[SLOT.CENTER];
  m.maxHP = 100; m.hp = 1;
  g.mp = 10;
  g.playCard(giveCard(g, 'regen'), SLOT.CENTER);
  eq('Regen card starts a clean target at Regen 2', m.regen, 2);
  const healed: number[] = [];
  for (let i = 0; i < 3; i++) {
    const before = m.hp;
    g._startPlayerPhase();
    healed.push(m.hp - before);
  }
  // Ticks 2 then 1 then it's gone — a self-expiring, front-loaded HoT.
  check('single-cast Regen decays 2 then 1 then gone', JSON.stringify(healed) === JSON.stringify([2, 1, 0]),
    JSON.stringify(healed));
  eq('Regen self-expires to 0', m.regen, 0);
}

// --- regen respects the HP cap on each tick --------------------------------
{
  const g = new Game(3);
  g.start();
  const m = g.members[SLOT.CENTER];
  m.hp = m.maxHP - 1; m.regen = 2; // heal 2 but only 1 room, then heal 1 into 0 room
  const healed: number[] = [];
  for (let i = 0; i < 2; i++) { const b = m.hp; g._startPlayerPhase(); healed.push(m.hp - b); }
  eq('regen capped at maxHP', m.hp, m.maxHP);
  check('regen ticks respect the cap', JSON.stringify(healed) === JSON.stringify([1, 0]), JSON.stringify(healed));
}

// --- regen ticks at the start of the player phase, after the enemy attacks -----
{
  const g = new Game(30);
  g.start();
  const tank = g.members[SLOT.CENTER];
  tank.hp = 5;
  g.mp = 10;
  const idx = giveCard(g, 'regen'); // Regen +2 (decaying)
  g.playCard(idx, SLOT.CENTER);
  eq('regen primed at Regen 2', tank.regen, 2);
  // Force a telegraph that spares the tank, so the only change to its HP across the
  // turn is the regen heal (isolating the tick's timing).
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.LEFT], enraged: false, forTurn: g.turn + 1 };
  g.endTurn();
  eq('regen healed +2 at player-phase start', tank.hp, 7);
  eq('regen decayed to 1 after the tick', tank.regen, 1);
  // The heal must land after the enemy attack in the event feed, not before it.
  const atkIdx = g.events.findIndex((e) => e.kind === 'enemyAttack');
  const regIdx = g.events.findIndex((e) => e.kind === 'regenTick');
  check('regenTick lands after the enemy attack', atkIdx >= 0 && regIdx > atkIdx,
    `atkIdx=${atkIdx} regIdx=${regIdx}`);
}

// --- stacking is ADDITIVE (#52): the card's amount adds to the running Regen ---
{
  const g = new Game(31);
  g.start();
  const m = g.members[SLOT.CENTER];
  m.maxHP = 100; m.hp = 1;
  g.mp = 20;
  m.regen = 3; // an existing Regen 3
  g.playCard(giveCard(g, 'regen'), SLOT.CENTER); // +2
  eq('re-cast is additive (Regen 3 + card → Regen 5)', m.regen, 5);
  // Decays 5→4→3→2→1→0, healing the triangular total 15 (headroom guaranteed).
  let total = 0;
  for (let i = 0; i < 6; i++) { const b = m.hp; g._startPlayerPhase(); total += m.hp - b; }
  eq('additive Regen heals the triangular total', total, 5 + 4 + 3 + 2 + 1);
  eq('additive Regen self-expires', m.regen, 0);
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
  g.playCard(giveAbility(g, SLOT.CENTER)); // taunt
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
  g.playCard(giveAbility(g, SLOT.CENTER)); // taunt -> defense 4
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
  const idx = giveAbility(g, SLOT.RIGHT);
  const res = g.playCard(idx); // mage
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

// --- #44: per-member ability cards are bound and self-resolve ----------------
{
  // An ability card fires its BOUND member's ability, whoever the player would
  // have picked — bolster always taunts the tank, imbueVenom always poisons.
  const g = new Game(11);
  g.start();
  g.mp = 10;
  g.playCard(giveCard(g, 'bolster')); // no target given
  eq('bolster fired the tank\'s Taunt with no member pick', g.members[SLOT.CENTER].taunt > 0, true);
  g.playCard(giveCard(g, 'imbuePoison'));
  eq('imbueVenom fired the ranger\'s Poison', g.enemy.poisonTurns > 0, true);
}
{
  // A bound ability card is unplayable while its member is dead/absent (mirrors
  // the old "must target a living member" gate), and playable again once alive.
  const g = new Game(12);
  g.start();
  g.mp = 10;
  g.members[SLOT.CENTER].alive = false; // tank down
  g.members[SLOT.CENTER].hp = 0;
  const idx = giveCard(g, 'bolster');
  check('bolster is unplayable while the tank is dead', g.canPlay(idx, null) !== null);
  eq('playing a card with a dead bound member is refused', g.playCard(idx, null).ok, false);
  // A card whose member was never deployed is likewise unplayable: the default
  // trio has no Warlock, so the Evil Eye card finds no carrier.
  const pact = giveCard(g, 'hex');
  check('the Evil Eye card is unplayable with no Warlock deployed', g.canPlay(pact, null) !== null);
}
{
  // Ability cards (#44) are no-target and play immediately with no member-pick prompt —
  // EXCEPT En Garde (#74), the first single-target ability card: the Duelist grants her
  // stance to a chosen member, so it runs the normal single-target pick flow.
  for (const id of Object.keys(CARDS) as CardId[]) {
    const card = CARDS[id];
    if (card.ability == null) continue;
    if (id === 'enGarde') { eq('enGarde is the single-target ability card', card.target, 'single'); continue; }
    eq(`${id} is a no-target ability card`, card.target, 'none');
  }
}

// --- #54: ability cards disable on death, vanish on incapacitation --------------
{
  // A normal in-fight death: the bound member's ability card is still IN the fight
  // (drawn like any card) but unplayable and flagged disabled for the UI. Reviving
  // the member re-enables it.
  const g = new Game(54);
  g.start();
  g.mp = 10;
  const idx = giveCard(g, 'bolster'); // tank's Taunt card
  eq('#54: dead-member ability card is disabled while the tank is down (setup: alive)',
    g.isAbilityCardDisabled(resolveCard(g.hand[idx])), false);
  g.members[SLOT.CENTER].alive = false; // tank falls mid-fight
  g.members[SLOT.CENTER].hp = 0;
  check('#54: the card is still in hand (drawn but disabled)', g.hand[idx] != null);
  eq('#54: canPlay refuses a disabled ability card', g.canPlay(idx, null) !== null, true);
  eq('#54: isAbilityCardDisabled flags it for the UI', g.isAbilityCardDisabled(resolveCard(g.hand[idx])), true);
  // Resurrect the tank — the card becomes playable again.
  g.members[SLOT.CENTER].alive = true;
  g.members[SLOT.CENTER].hp = 5;
  eq('#54: resurrecting the member re-enables the card', g.isAbilityCardDisabled(resolveCard(g.hand[idx])), false);
  eq('#54: canPlay allows the re-enabled card', g.canPlay(idx, null), null);
  // A non-ability card is never disabled by this rule.
  const heal = giveCard(g, 'lowHeal');
  eq('#54: a plain heal is not an ability card, never disabled', g.isAbilityCardDisabled(resolveCard(g.hand[heal])), false);
}
{
  // Incapacitation (unresurrectable this fight): the member's ability card is NEVER
  // injected — removed from deck+hand for the whole fight — while every other
  // member's card is untouched.
  const party = defaultBattleConfig().party.map((p) => ({ ...p }));
  party[SLOT.LEFT] = { ...party[SLOT.LEFT], incapacitated: true };
  const ids = abilityCardsForParty(party).map((c) => c.id);
  check('#54: incapacitated LEFT drops its ability card (imbuePoison gone)', !ids.includes('imbuePoison'));
  check('#54: CENTER ability card survives', ids.includes('bolster'));
  check('#54: RIGHT ability card survives', ids.includes('unleash'));
  eq('#54: exactly the two living members\' ability cards remain', ids.length, 2);

  // And at the whole-fight level: the incapacitated member's card is absent from
  // every pile for the entire battle (it is simply never in the deck).
  const cfg = defaultBattleConfig();
  cfg.party = party;
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(party)];
  const g = new Game(55, cfg);
  g.start();
  const all = [...g.hand, ...g.drawPile, ...g.discardPile].map((c) => c.id);
  check('#54: incapacitated member\'s ability card never enters the fight', !all.includes('imbuePoison'));
  check('#54: living members\' ability cards are in the fight', all.includes('bolster') && all.includes('unleash'));
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
  const idx = giveAbility(g, SLOT.CENTER);
  g.playCard(idx); // taunt
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
  g.playCard(giveAbility(g, SLOT.CENTER)); // taunt
  eq('standing blow redirected onto the tank',
    JSON.stringify(g.telegraph!.targets), JSON.stringify([SLOT.CENTER]));
  eq('surcharge is +1 MP on top of the Ability cost',
    g.mp, mpBefore - CARDS.bolster.cost - TAUNT_RETARGET_SURCHARGE);
}

// --- taunt (surcharge mode): no surcharge on a blow that can't be redirected -
{
  const g = new Game(8);
  g.start();
  g.tauntRetargetMode = 'surcharge';
  g.telegraph = { type: 'sweep', hidden: false, damage: 4, targets: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT], enraged: false, forTurn: g.turn };
  check('a sweep is not redirectable (hits everyone anyway)', g._standingTelegraphRedirectable() === false);
  const mpBefore = g.mp;
  g.playCard(giveAbility(g, SLOT.CENTER)); // taunt
  eq('no surcharge when redirect is pointless', g.mp, mpBefore - CARDS.bolster.cost);
}

// --- DR1 death-tracking: diedThisFight persists through Resurrect; a Martyr's
//     Icon save vetoes the death and leaves no scar ----------------------------
{
  const g = new Game(41);
  g.start();
  const ranger = g.members[SLOT.LEFT];
  eq('no scar before any death', g.diedThisFightSlots().length, 0);
  g._killMember(ranger);
  check('a killed member is flagged died-this-fight', g.diedThisFightSlots().includes(SLOT.LEFT));

  // Resurrect brings them back but does NOT clear the flag — death always scars.
  g.mp = 10;
  const res = g.playCard(giveCard(g, 'resurrect'), SLOT.LEFT);
  check('resurrect played', res.ok, res.reason);
  check('ranger alive again after Resurrect', ranger.alive);
  check('the death still counts for a scar after Resurrect', g.diedThisFightSlots().includes(SLOT.LEFT));

  // A Guardian Feather save vetoes the death itself, so no scar is recorded.
  const cfg = defaultBattleConfig();
  cfg.relics = ['martyrsIcon'];
  const gm = new Game(42, cfg);
  gm.start();
  const saved = gm._killMember(gm.members[SLOT.CENTER]);
  check('Martyr veto keeps the member alive at 1 HP', !saved && gm.members[SLOT.CENTER].alive);
  check('a Martyr save leaves NO scar', !gm.diedThisFightSlots().includes(SLOT.CENTER));
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
  // Rework (#18): 4 MP. (The return-behind-a-Shield rider was removed in the content-cut pass.)
  eq('Resurrect costs 4 (rework, #18)', CARDS.resurrect.cost, 4);
  check('revived member no longer comes back behind a Shield', !mage.shield);
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

// --- decaying Rest: +5 at 0 cards, +1 at 1 card (issue 05) ------------------
{
  eq('decayed rest is worth 1 MP', SKIP_REGEN_DECAYED, 1);
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
  eq('rested +1 MP after one card', g.mp, before + SKIP_REGEN_DECAYED);
}

// --- Font of Mana cannot exceed its per-cast MP cap (flaw #7) ---------------
// (Refresh moved to a channel in #64; Font of Mana keeps the capped MP-over-time buff.)
{
  const g = new Game(23);
  g.start();
  // A heavily-upgraded Font of Mana (Potent + Lingering) would be 4 MP/turn for 4
  // turns = 16, but the per-cast cap holds total restored to FONT_MP_CAP.
  g.playCard(giveCard(g, 'fontOfMana', ['potent', 'lingering']), null);
  let restored = 0;
  for (let i = 0; i < 6 && g.status === 'playing'; i++) {
    g.mp = 0;            // drain each turn so the cap, not MP_MAX, is what binds
    g._runEnemyPhase();  // applies one refresh tick (among other things)
    restored += g.mp;    // all MP present now came from this phase's refresh tick
  }
  check('Font never restores more than its per-cast cap', restored <= FONT_MP_CAP,
    `restored=${restored} cap=${FONT_MP_CAP}`);
  eq('Font ends once the cap is spent', g.refreshTurns, 0);
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

// --- #47: dead-target telegraphs re-point instead of whiffing on a corpse ----
{
  // A single-target attack whose SOLE target has died re-points to a living
  // member: the preview shows that living member, and the applied hit matches it
  // (no wasted swing on a corpse).
  const g = new Game(31);
  g.start();
  g._killMember(g.members[SLOT.LEFT]);
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.LEFT], enraged: false, forTurn: 2 };
  const lines = g.attackTargets();
  eq('dead single re-points to one living line', lines.length, 1);
  check('re-pointed line lands on a living member', g.members[lines[0].slot].alive);
  const spec = lines[0];
  const target = g.members[spec.slot];
  const before = target.hp;
  g._resolveAttack();
  eq('#47 single: applied equals the re-pointed preview', before - target.hp, spec.damage);
  check('#47 single: no whiff logged (a living target existed)',
    !g.log.some((l) => l.kind === 'whiff'));
}
{
  // A two-target swing whose primary died drops onto the living secondary — the
  // preview and the resolution agree on exactly that one slot.
  const g = new Game(32);
  g.start();
  g._killMember(g.members[SLOT.CENTER]);
  g.telegraph = { type: 'two', hidden: false, damage: 3, targets: [SLOT.CENTER, SLOT.LEFT], enraged: false, forTurn: 2 };
  const lines = g.attackTargets();
  eq('#47 two-target with dead primary shows only the living slot', lines.length, 1);
  eq('#47 surviving slot is the left member', lines[0].slot, SLOT.LEFT);
  const left = g.members[SLOT.LEFT];
  const before = left.hp;
  g._resolveAttack();
  eq('#47 two-target: applied equals preview on the surviving slot', before - left.hp, lines[0].damage);
}
{
  // Taunt retarget onto a slot whose telegraphed neighbour is dead: the stored
  // telegraph re-points, and preview == applied for the funnelled hit.
  const g = new Game(33);
  g.start();
  g._killMember(g.members[SLOT.LEFT]);
  const tank = g.members[SLOT.CENTER];
  tank.taunt = TAUNT_TURNS;
  g.telegraph = { type: 'two', hidden: false, damage: 3, targets: [SLOT.RIGHT, SLOT.LEFT], enraged: false, forTurn: 2 };
  g._retargetTelegraphTo(tank.slot); // funnel onto the taunter
  const preview = new Map(g.attackTargets().map((s) => [s.slot, s.damage]));
  check('#47 taunt retarget previews the taunter', preview.has(SLOT.CENTER));
  check('#47 taunt retarget never previews the dead slot', !preview.has(SLOT.LEFT));
  const hpBefore = g.members.map((m) => m.hp);
  g._resolveAttack();
  let mismatches = 0;
  for (const m of g.members) {
    const taken = hpBefore[m.slot] - m.hp;
    if (taken === 0) continue;
    if (taken !== preview.get(m.slot)) mismatches++;
  }
  eq('#47 taunt retarget: preview == applied (no mismatches)', mismatches, 0);
}
{
  // PROPERTY (#47): preview == applied across randomized turns that kill members
  // mid-run, so a stored telegraph can point at a slot that has since died. Some
  // seeds also stand a Taunt, exercising the retarget path.
  let checked = 0;
  let mismatches = 0;
  let deadTargetTurns = 0; // turns where the telegraph named at least one dead slot
  for (let seed = 300; seed < 380; seed++) {
    const g = new Game(seed);
    g.start();
    // Deterministically kill some members off the game's own rng, then top the
    // survivors up so a kill's HP floor can't mask the comparison.
    for (const m of g.members) {
      if (g.rng() < 0.4) g._killMember(m);
    }
    if (g.allDead()) continue; // nothing left to compare
    for (const m of g.members) if (m.alive) m.hp = m.maxHP;
    if (g.livingMembers().some((m) => g.rng() < 0.5)) {
      const t = g.livingMembers()[0];
      t.taunt = TAUNT_TURNS;
      if (g._standingTelegraphRedirectable(t.slot)) g._retargetTelegraphTo(t.slot);
    }
    const t = g.telegraph;
    if (t && !t.hidden && !t.cast && t.targets.some((s) => !g.members[s]?.alive)) deadTargetTurns++;
    const preview = new Map(g.attackTargets().map((s) => [s.slot, s.damage]));
    const hpBefore = g.members.map((m) => m.hp);
    g._runEnemyPhase();
    for (const m of g.members) {
      const taken = hpBefore[m.slot] - m.hp;
      if (taken === 0) continue; // not struck (or fully mitigated) — nothing to compare
      checked++;
      if (taken !== preview.get(m.slot)) mismatches++;
    }
  }
  check('#47 property: preview == applied with mid-turn deaths (no mismatches)', mismatches === 0,
    `${mismatches} mismatches`);
  check('#47 property: exercised real hits', checked > 20, `${checked} hits checked`);
  check('#47 property: exercised telegraphs aimed at dead slots', deadTargetTurns > 3,
    `${deadTargetTurns} dead-target turns`);
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

// --- injury ability floor (DR1): a Broken member carries negative abilityPower,
//     but no ability ever resolves to 0-or-below --------------------------------
{
  const cfg = defaultBattleConfig();
  cfg.party = cfg.party.map((p) => ({ ...p, abilityPower: -10 }));
  const g = new Game(31, cfg);
  g.start();

  g.mp = 10; g.events = [];
  g.playCard(giveAbility(g, SLOT.LEFT)); // poison: max(1, 5−10)
  const pois = g.events.find((e) => e.kind === 'poisonApplied') as any;
  eq('Broken poison strength floored at 1', pois.amount, 1);

  g.mp = 10; g.mageCharge = 0; g.enemy.hp = 100; g.events = [];
  g.playCard(giveAbility(g, SLOT.RIGHT)); // bolt base: max(1, 5−10), +0 charge
  const bolt = g.events.find((e) => e.kind === 'bolt') as any;
  eq('Broken bolt base floored at 1', bolt.amount, 1);

  g.mp = 10; g.events = [];
  g.playCard(giveAbility(g, SLOT.CENTER)); // taunt: defense max(0, 1−10)
  eq('Broken taunt Defense floored at 0', g.members[SLOT.CENTER].defenseAmount, 0);
}

// --- events: bolt, poison, taunt, shield, regen, refresh, resurrect ---------
{
  const g = new Game(23);
  g.start();
  g.mageCharge = 2; g.enemy.hp = 100; g.mp = 10;
  let idx = giveAbility(g, SLOT.RIGHT);
  g.events = [];
  g.playCard(idx); // bolt: 5 + 2×2 = 9
  const bolt = g.events.find((e) => e.kind === 'bolt') as any;
  check('bolt event emitted', !!bolt);
  eq('bolt event amount', bolt.amount, BOLT_BASE + BOLT_CHARGE_MULT * 2);
  eq('bolt event enemyHp', bolt.enemyHp, 100 - (BOLT_BASE + BOLT_CHARGE_MULT * 2));

  idx = giveAbility(g, SLOT.LEFT);
  g.events = [];
  g.playCard(idx); // poison arrow
  const pois = g.events.find((e) => e.kind === 'poisonApplied') as any;
  check('poison event emitted', !!pois);
  eq('poison event amount', pois.amount, POISON_BASE);

  idx = giveAbility(g, SLOT.CENTER);
  g.events = [];
  g.playCard(idx); // taunt
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
  idx = giveCard(g, 'fontOfMana');
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
  // #53: passive MP is a reward for a RESTRAINED previous turn — it only lands when
  // the turn that just ended played ≤1 card (the same cardsPlayedThisPhase signal the
  // Rest gate uses), read at the start of the next phase before the counter resets.
  const mkGame = () => {
    const cfg = defaultBattleConfig();
    cfg.healer = { ...DEFAULT_HEALER, maxMana: 10, passiveMp: 3 };
    const g = new Game(30, cfg);
    g.start();
    return g;
  };
  // 0 cards played → passive granted (cardsPlayedThisPhase is still its 0 init).
  {
    const g = mkGame();
    g.mp = 0;
    g._startPlayerPhase();
    check('#53 passive grants after a 0-card turn', g.mp >= 3, `mp=${g.mp}`);
  }
  // Exactly 1 card played → still granted.
  {
    const g = mkGame();
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    eq('#53 one card is counted', g.cardsPlayedThisPhase, 1);
    g.mp = 0;
    g._startPlayerPhase();
    check('#53 passive grants after a 1-card turn', g.mp >= 3, `mp=${g.mp}`);
  }
  // 2+ cards played → passive withheld entirely.
  {
    const g = mkGame();
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    eq('#53 two cards are counted', g.cardsPlayedThisPhase, 2);
    g.mp = 0;
    g._startPlayerPhase();
    eq('#53 no passive after a busy (2-card) turn', g.mp, 0);
  }
  // The counter resets each phase, so eligibility returns the very next restrained turn.
  {
    const g = mkGame();
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
    g.mp = 0;
    g._startPlayerPhase();                     // busy turn: withheld
    eq('#53 counter resets to 0 after the phase', g.cardsPlayedThisPhase, 0);
    g.mp = 0;
    g._startPlayerPhase();                     // now 0 cards played
    check('#53 passive resumes once the counter resets', g.mp >= 3, `mp=${g.mp}`);
  }
  // The Pact of Silence passive flows through the same add, so it obeys the same gate.
  {
    const cfg = defaultBattleConfig();
    cfg.relics = ['pactOfSilence'];
    const g = new Game(31, cfg);
    g.start();
    g.cardsPlayedThisPhase = 2;
    g.mp = 0;
    g._startPlayerPhase();
    eq('#53 the Pact passive is withheld after a busy turn', g.mp, 0);
    g.mp = 0;
    g._startPlayerPhase();                     // 0 cards played this time
    eq('#53 the Pact passive returns on a restrained turn', g.mp, PACT_PASSIVE_MP);
  }
}
{
  // Ability power scales poison strength (Ranger).
  const cfg = defaultBattleConfig();
  cfg.party = cfg.party.map((p) => ({ ...p, abilityPower: 2 }));
  const g = new Game(4, cfg);
  g.start();
  g.playCard(giveAbility(g, SLOT.LEFT));
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
  g.playCard(giveAbility(g, SLOT.RIGHT));
  eq('bolt damage includes abilityPower', before - g.enemy.hp,
    BOLT_BASE + 3 + BOLT_CHARGE_MULT * charge);
}
{
  // Custom party stats and enemy HP feed straight through.
  const cfg = defaultBattleConfig();
  cfg.party[SLOT.LEFT] = { maxHP: 20, damage: 7, abilityPower: 0, injuries: 0 };
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
  eq('potent +refresh (Font)', resolveCard(makeDeckCard('fontOfMana', 1, ['potent'])).refresh, (CARDS.fontOfMana.refresh ?? 0) + 1);
  eq('potent stacks', resolveCard(makeDeckCard('highHeal', 1, ['potent', 'potent'])).heal, (CARDS.highHeal.heal ?? 0) + 2);
}
{
  // Lingering: +1 turn of Refresh; on Regen (#52) magnitude IS duration, so it
  // folds into the applied regen amount rather than a separate turn count.
  eq('lingering +regen magnitude (#52)', resolveCard(makeDeckCard('regen', 1, ['lingering'])).regen, (CARDS.regen.regen ?? 0) + 1);
  eq('potent + lingering both deepen regen', resolveCard(makeDeckCard('regen', 1, ['potent', 'lingering'])).regen, (CARDS.regen.regen ?? 0) + 2);
  eq('lingering +refresh turns', resolveCard(makeDeckCard('fontOfMana', 1, ['lingering'])).refreshTurns, REFRESH_TURNS + 1);
}
{
  // Eligibility gating and slot limits.
  check('potent ineligible on shield', !MODIFIERS.potent.eligible('shield'));
  check('potent eligible on Font of Mana', MODIFIERS.potent.eligible('fontOfMana'));
  check('lingering ineligible on highHeal', !MODIFIERS.lingering.eligible('highHeal'));
  check('lingering eligible on regen', MODIFIERS.lingering.eligible('regen'));
  // Retain gating (issue 03): refuses the always-on Ability card and engine cards.
  check('retain eligible on shield', MODIFIERS.retain.eligible('shield'));
  check('retain eligible on lowHeal', MODIFIERS.retain.eligible('lowHeal'));
  check('retain refuses a per-member ability card', !MODIFIERS.retain.eligible('bolster'));
  check('retain refuses the engine card Refresh', !MODIFIERS.retain.eligible('fontOfMana'));
  check('Refresh is engine-tagged', isEngineCard('fontOfMana'));
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
{
  // Hand-4 carryover experiment (#25, Q6). With carryover 1 the costliest non-retain
  // card survives the end-of-turn discard, and next phase the hand refills to 4.
  const cfg = defaultBattleConfig();
  cfg.healer = { ...DEFAULT_HEALER, handSize: 4, carryover: 1 };
  const g = new Game(8, cfg);
  g.start();
  eq('hand refills to 4', g.hand.length, 4);
  g.hand = [];
  // highHeal (cost 3) is the costliest here; lowHeal (1) / regen (1) are cheaper.
  g.hand.push(makeDeckCard('lowHeal', -200, []), makeDeckCard('highHeal', -201, []), makeDeckCard('regen', -202, []));
  const drawBefore = g.drawPile.length, discardBefore = g.discardPile.length;
  g.endTurn();
  check('carryover keeps exactly 1 card', g.hand.filter((c) => c.uid <= -200).length === 1);
  check('carryover keeps the costliest card', g.hand.some((c) => c.uid === -201));
  check('cheaper cards were discarded', !g.hand.some((c) => c.uid === -200) && !g.hand.some((c) => c.uid === -202));
  // After the enemy phase the hand refilled to 4: 1 carried + 3 drawn.
  eq('hand refilled to 4 after carryover', g.hand.length, 4);
  check('exactly 1 of the 4 was carried', g.hand.filter((c) => c.uid === -201).length === 1);
  void drawBefore; void discardBefore;
}
{
  // Retain and carryover stack: a Retain card is kept regardless, and carryover
  // keeps 1 additional non-retain card on top of it.
  const cfg = defaultBattleConfig();
  cfg.healer = { ...DEFAULT_HEALER, handSize: 4, carryover: 1 };
  const g = new Game(9, cfg);
  g.start();
  g.hand = [];
  g.hand.push(makeDeckCard('shield', -210, ['retain']), makeDeckCard('highHeal', -211, []), makeDeckCard('lowHeal', -212, []));
  g.endTurn();
  check('retain survives alongside carryover', g.hand.some((c) => c.uid === -210));
  check('carryover keeps the costliest non-retain', g.hand.some((c) => c.uid === -211));
  check('the other non-retain was discarded', !g.hand.some((c) => c.uid === -212));
}
{
  // carryover 0 leaves the discard bit-identical to the classic full discard: the
  // whole (non-retain) hand goes to the discard pile.
  const cfg = defaultBattleConfig();
  cfg.healer = { ...DEFAULT_HEALER, carryover: 0 };
  const g = new Game(10, cfg);
  g.start();
  g.hand = [];
  g.hand.push(makeDeckCard('highHeal', -220, []), makeDeckCard('lowHeal', -221, []));
  g.endTurn();
  check('carryover 0 keeps no card', !g.hand.some((c) => c.uid === -220 || c.uid === -221));
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
  g.playCard(giveAbility(g, SLOT.RIGHT)); // mage bolt
  eq('bolt cleared the caster charge', g.mage.charge, 0);
  eq("bolt left another member's charge alone", g.ranger.charge, 2);
}
{
  // Taunt is attributed to the caster, not a fixed slot.
  const g = new Game(43);
  g.start();
  g.mp = 10;
  g.playCard(giveAbility(g, SLOT.CENTER)); // tank taunt
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

// --- Bouncer: fixed rotation + Haymaker channel (issue 12) ----------
{
  // Rotation is exact: single -> two -> heavy -> sweep, repeating, with the heavy
  // becoming Haymaker on every 2nd cycle.
  const g = gatewardenGame(1);
  const seq: string[] = [];
  for (let i = 0; i < 8; i++) {
    g.rotationIndex = i;
    const t = g._generateTelegraph(5);
    seq.push(t.channel ? `channel:${t.channelName}` : t.type);
  }
  eq('exact rotation with channel on cycle 2',
    JSON.stringify(seq),
    JSON.stringify(['single', 'two', 'heavy', 'sweep', 'single', 'two', 'channel:Haymaker', 'sweep']));
}
{
  // Haymaker: a 2-turn channel that deals 12 on resolve; no damage during
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
  eq('Haymaker lands for 12', g.members[target].hp, 38);
}
{
  // The channel is answerable by the tank and only the tank (the teaching): a
  // defended, topped-up tank survives the resolve; the squishies never do.
  const dmg = GATEWARDEN_DEF.channel!.damage;
  const [ranger, tank, mage] = MEMBER_DEFS;
  check('a defended full tank survives Haymaker',
    tank.maxHP - (dmg - DEFENSE_AMOUNT) > 0);
  check('Haymaker still one-shots a full ranger', ranger.maxHP - dmg <= 0);
  check('Haymaker still one-shots a full mage', mage.maxHP - dmg <= 0);
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
  eq('a standing channel announces by its own name', g.telegraphIntent(), 'Haymaker');
  // The resolve log also names the channel, not the underlying attack type.
  const target = g.telegraph.targets[0];
  g.members[target].hp = 50;
  g.turn = 2; g._runEnemyPhase();      // wind-up
  g.members[target].hp = 50;
  g.turn = 3; g._runEnemyPhase();      // resolve
  check('the resolve log names the channel',
    g.log.some((l) => /Haymaker (hits|whiffs)/.test(l.text)),
    g.log.map((l) => l.text).slice(-3).join(' | '));
}

// --- Jinxweaver: Zinger / Jinx / Slurp + Cleanse (issue 13) -----------
{
  // Rotation is exact and mixes the three tricks between whole-party pressure.
  const g = hexweaverGame(1);
  const seq: string[] = [];
  for (let i = 0; i < 6; i++) {
    g.rotationIndex = i;
    g.telegraph = g._generateTelegraph(5);
    seq.push(g.telegraphIntent() ?? '?');
  }
  eq('exact Jinxweaver rotation (by intent name)',
    JSON.stringify(seq),
    JSON.stringify(['Strike', 'Zinger', 'Jinx', 'Sweep', 'Zinger', 'Slurp']));
  // A bare-string opener still announces by its generic intent name.
  g.rotationIndex = 0; g.telegraph = g._generateTelegraph(5);
  eq('plain opener announces generically', g.telegraphIntent(), ATTACK_INTENT_NAMES.single);
}
{
  // Zinger ignores Taunt AND Defense and aims at the lowest-HP member — the
  // tank can't soak it and the fragile DPS is who's threatened.
  const g = hexweaverGame(2);
  g.tank.taunt = TAUNT_TURNS; g.tank.defense = DEFENSE_TURNS; // full taunt/defense up
  g.ranger.hp = 3; g.mage.hp = 9; g.tank.hp = 18;            // ranger is lowest
  g.rotationIndex = 1;                                        // Zinger slot
  g.telegraph = g._generateTelegraph(5);
  check('Zinger is telegraphed by name', g.telegraphIntent() === 'Zinger');
  eq('Zinger aims at the lowest-HP member (ranger), not the taunter', JSON.stringify(g.telegraph.targets), JSON.stringify([SLOT.LEFT]));
  // Preview must equal applied even though the tank is taunting/defending.
  const spec = g.attackTargets().find((s) => s.slot === SLOT.LEFT);
  eq('preview shows the full piercer damage (Defense ignored)', spec?.damage, HEXWEAVER_PIERCER_DMG);
  g.turn = 5; g._runEnemyPhase();
  eq('Zinger hit the ranger for full damage', g.ranger.hp, 3 - HEXWEAVER_PIERCER_DMG <= 0 ? 0 : 3 - HEXWEAVER_PIERCER_DMG);
  eq('the taunting tank was untouched by the piercer', g.tank.hp, 18);
}
{
  // Invariant: preview == applied for a Zinger aimed at a DEFENDED member —
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
  // A Zinger is NOT redirected onto a taunter that taunts during the wind-up
  // (unlike Haymaker) — it pierces the funnel.
  const g = hexweaverGame(3);
  g.ranger.hp = 8; g.mage.hp = 9; g.tank.hp = 18;
  g.rotationIndex = 1; g.telegraph = g._generateTelegraph(5); // aims at ranger (lowest)
  check('not redirectable onto the tank', g._standingTelegraphRedirectable(SLOT.CENTER) === false);
}
{
  // Jinx: a 'cast' that halves ALL healing for WOUND_TURNS turns — intercepts both
  // the direct heal path and the Regen tick (both route through _healMember).
  const g = hexweaverGame(4);
  g.rotationIndex = 2; g.telegraph = g._generateTelegraph(5); // Jinx slot
  check('Jinx telegraph is a cast', g.telegraph.cast === 'wound');
  check('Jinx deals no damage lines', g.attackTargets().length === 0);
  g.turn = 5; g._runEnemyPhase();                             // Jinx resolves
  check('party is Wounded after Jinx', g.wounded === true);
  eq('Wound lasts WOUND_TURNS player phases', g.woundTurns, WOUND_TURNS);
  // Direct heal path: a Heal-4 heals only 2 while Wounded.
  g.tank.hp = 1;
  const healed = g._healMember(g.tank, 4);
  eq('direct heal is halved under Jinx', healed, 2);
  // Regen tick path: strength 2 regens 1 while Wounded.
  g.mage.hp = 1; g.mage.regen = 2;
  g.phase = 'idle'; g._startPlayerPhase();
  eq('Regen tick is halved under Jinx', g.mage.hp, 1 + 1);
}
{
  // Cleanse removes the Jinx; healing returns to full.
  const g = hexweaverGame(5);
  g.woundTurns = WOUND_TURNS;
  const idx = giveCard(g, 'cleanse');
  g.phase = 'player';
  g.playCard(idx, null);
  check('Cleanse cleared the Jinx', g.wounded === false);
  g.tank.hp = 1;
  eq('healing is full again after Cleanse', g._healMember(g.tank, 4), 4);
}
{
  // Wound lasts exactly WOUND_TURNS player phases (the same-turn decay does not eat one).
  const g = hexweaverGame(6);
  g.rotationIndex = 2; g.telegraph = g._generateTelegraph(5);
  g.turn = 5; g._runEnemyPhase();       // Jinx resolves; woundTurns = 3
  let woundedPhases = 0;
  for (let k = 0; k < 5; k++) {
    if (g.wounded) woundedPhases++;      // player phase k: is healing halved?
    g.turn += 1; g._runEnemyPhase();     // next enemy phase decays it at the top
  }
  eq('Jinx halves healing for exactly WOUND_TURNS player phases', woundedPhases, WOUND_TURNS);
}
{
  // Slurp: a 'cast' that drains SIPHON_AMOUNT MP, floored at 0, previewed on the bar.
  const g = hexweaverGame(7);
  g.rotationIndex = 5; g.telegraph = g._generateTelegraph(5); // Slurp slot
  check('Slurp telegraph is a cast', g.telegraph.cast === 'siphon');
  g.mp = 10;
  eq('Slurp preview matches the drain', g.predictedSiphon(), SIPHON_AMOUNT);
  g.turn = 5; g._runEnemyPhase();
  eq('Slurp drained the MP', g.mp, 10 - SIPHON_AMOUNT);
  // Floors at 0: from 1 MP, a 3-drain only takes 1.
  const g2 = hexweaverGame(8);
  g2.rotationIndex = 5; g2.telegraph = g2._generateTelegraph(5);
  g2.mp = 1;
  eq('Slurp floors at 0', g2.predictedSiphon(), 1);
  g2.turn = 5; g2._runEnemyPhase();
  eq('Slurp left MP at 0, not negative', g2.mp, 0);
}
{
  // Cleanse is a pool card (uncommon) and is in the shop pool.
  check('Cleanse exists as an uncommon', CARDS.cleanse != null);
}

// --- Gobbler: phase system + Gulp + Big Chomp (issue 14) ----------------------
{
  // Gulp: cleanses the enemy's OWN poison and self-heals for every remaining
  // tick (poison stops being free value against the Gobbler).
  const g = devourerGame(1);
  g.enemy.hp = 100;                       // room to heal (below max 200)
  g.enemy.poison = 5; g.enemy.poisonTurns = 4; // 20 damage of poison still owed
  g.rotationIndex = 3; g.telegraph = g._generateTelegraph(2); // Gulp slot
  check('Gulp is a cast telegraph', g.telegraph.cast === 'consume');
  eq('Gulp announces by name', g.telegraphIntent(), 'Gulp');
  // Resolve the cast in isolation (a full enemy phase would first land one poison
  // tick, which is correct in play but muddies the pure heal-for-remaining check).
  g._resolveCast(g.telegraph);
  eq('Gulp cleansed the enemy poison', g.enemy.poisonTurns, 0);
  eq('Gulp also zeroed the poison strength', g.enemy.poison, 0);
  eq('Gulp self-healed for the remaining ticks (5x4)', g.enemy.hp, 100 + 20);
}
{
  // Gulp heal is capped at max HP and is a no-op with no poison up.
  const g = devourerGame(2);
  g.enemy.hp = 100;
  g.rotationIndex = 3; g.telegraph = g._generateTelegraph(2);
  g.turn = 2; g._runEnemyPhase();
  eq('Gulp with no poison leaves HP unchanged', g.enemy.hp, 100);
}
{
  // Phase transition fires exactly once at <=50% HP, swaps in the phase-2 rotation
  // (Big Chomp channel) and tightens enrage — and does NOT re-fire on further damage.
  const g = devourerGame(3, 200);
  check('starts un-transformed', g.phaseTriggered === false);
  check('phase-1 rotation is active', g.activeChannel() === undefined);
  g._damageEnemy(101, 'test');            // 200 -> 99 (<=50%)
  check('transformed at the threshold', g.phaseTriggered === true);
  check('phase-2 Big Chomp channel is now active', g.activeChannel()?.name === 'Big Chomp');
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
  check('Big Chomp is active after the DoT-triggered transition', g.activeChannel()?.name === 'Big Chomp');
}
{
  // Big Chomp: a 2-turn channelled sweep that resolves for DEVOURER_MAW_DMG on every
  // living member. Drive to phase 2, then find and resolve a Big Chomp.
  const g = devourerGame(5, 200);
  g._damageEnemy(150, 'test');           // -> 50, phase 2
  // Find the next Big Chomp telegraph.
  let guard = 0;
  while (guard++ < 12) {
    g.rotationIndex += 1;
    const t = g._generateTelegraph(2);   // turn 2 (pre-enrage) so damage is base
    if (t.channel && t.channelName === 'Big Chomp') { g.telegraph = t; break; }
  }
  check('a Big Chomp telegraph was found in phase 2', g.telegraph?.channelName === 'Big Chomp');
  eq('Big Chomp is a 2-turn channel', g.telegraph!.turnsUntilResolve, 2);
  eq('Big Chomp hits the whole party (sweep geometry)', g.telegraph!.targets.length, 3);
  eq('Big Chomp base damage is DEVOURER_MAW_DMG', g.telegraph!.damage, DEVOURER_MAW_DMG);
  // Wind-up then resolve; every living member takes DEVOURER_MAW_DMG.
  for (const m of g.members) m.hp = m.maxHP;
  g.turn = 2; g._runEnemyPhase();        // wind-up (no damage)
  const preResolve = g.members.map((m) => m.hp);
  g.turn = 3; g._runEnemyPhase();        // resolve
  let allTookMaw = true;
  g.members.forEach((m, i) => { if (m.alive && preResolve[i] - m.hp !== DEVOURER_MAW_DMG) allTookMaw = false; });
  check('Big Chomp resolved for DEVOURER_MAW_DMG on each member', allTookMaw);
}

// --- enemy-first ordering: an opening strike lands before the player's turn ----
{
  // The enemy takes the first turn: start() resolves one opening strike before the
  // player can act. It is unreactable (no Shield can be up yet), so it is always a
  // plain single hit — never a heavy/sweep/AoE. It is a bonus ambush that leaves the
  // turn counter at 1, so turn 1 is still the player's first planning turn.
  const boss = defaultBattleConfig(); boss.enemy = { maxHP: 150, boss: true, attackBonus: 0 };
  const g = new Game(3, boss);
  g.start();
  eq('player phase opens the fight after the enemy strikes', g.phase, 'player');
  check('the opening strike damaged exactly one member',
    g.members.filter((m) => m.hp < m.maxHP).length === 1);
  check('an enemy hit landed on mount', g.log.some((l) => l.kind === 'hit'));
  check('the opening strike animates in the event feed',
    g.events.some((e) => e.kind === 'enemyAttack'));
  check('a standing telegraph opens the player turn', g.telegraph !== null);
  eq('this.turn is 1 during the opening player phase', g.turn, 1);
  // The opener is ALWAYS a plain single, whatever the enemy's attack pool — a boss
  // that opens on heavy/sweep otherwise would gib a squishy before any answer.
  for (let seed = 0; seed < 400; seed++) {
    const gg = new Game(seed, boss); gg.start();
    const hits = gg.events.filter((e) => e.kind === 'enemyAttack');
    check('opening strike is single-target (one target)', hits.length === 1, `seed=${seed} hits=${hits.length}`);
  }
  // The opener does not advance a boss's learnable rotation: after start(), turn 1's
  // standing telegraph is still the rotation's first step (Bouncer opens 'single').
  const gwCfg = defaultBattleConfig();
  gwCfg.enemy = { maxHP: 200, boss: true, attackBonus: 0, def: GATEWARDEN_DEF };
  const gw = new Game(3, gwCfg); gw.start();
  eq('opener leaves the rotation index at 0', gw.rotationIndex, 0);
  eq("turn 1's standing telegraph is the rotation's first step", gw.telegraph!.type, 'single');
}

// --- enrage fires exactly on ENRAGE_TURN; countdown counts down -------------
{
  const g = new Game(9);
  g.start();
  eq('not enraged at turn 1', g.enemy.enraged, false);
  // Countdown legibility: ENRAGE_TURN - turn until it fires.
  eq('turnsUntilEnrage at turn 1', g.turnsUntilEnrage(), ENRAGE_TURN - 1);
  // Under player-first ordering (#26) enrage fires when the enemy phase resolves
  // the turn equal to ENRAGE_TURN — i.e. when this.turn is ENRAGE_TURN at endTurn.
  g.turn = ENRAGE_TURN - 1;
  eq('countdown reads 1 the turn before enrage', g.turnsUntilEnrage(), 1);
  g.enemy.hp = 999; // keep the fight alive through the enrage turn
  g.turn = ENRAGE_TURN;
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
  g.devPlayCard('sap');
  check('devPlayCard sap starts a channel', g.channelActive() && g.channelCard === 'sap');
}

// --- card set phase A: Bloom / Font of Mana / Inspiration (issue 15) ---
{
  // Definitions: costs, strengths, rarities (shop prices follow rarity 25/50/75).
  eq('Bloom costs 2', CARDS.bloom.cost, 2);
  eq('Bloom is uncommon', CARD_RARITY.bloom, 'uncommon');
  eq('Font of Mana costs 3', CARDS.fontOfMana.cost, 3);
  eq('Font of Mana refresh strength 3', CARDS.fontOfMana.refresh, 3);
  eq('Font of Mana is rare', CARD_RARITY.fontOfMana, 'rare');
  eq('Inspiration costs 2', CARDS.inspiration.cost, 2);
  eq('Inspiration draws 2', CARDS.inspiration.draw, 2);
  eq('Inspiration is uncommon', CARD_RARITY.inspiration, 'uncommon');
  check('the phase-A survivors joined the shop pool',
    (['bloom', 'fontOfMana', 'inspiration'] as CardId[])
      .every((id) => CARD_POOL.includes(id)));
}
{
  // Bloom: dead without an active Regen; consumes it, healing its full remaining
  // amount at once (== the Regen value, #52).
  const g = new Game(62); g.start();
  const tank = g.tank;
  tank.hp = 5;
  const idx = giveCard(g, 'bloom');
  eq('Bloom is dead without an active Regen', g.canPlay(idx, SLOT.CENTER), 'target must have an active Regen');
  tank.regen = 3;
  g.playCard(idx, SLOT.CENTER);
  eq('Bloom heals its full remaining amount at once', tank.hp, 5 + 3);
  eq('Bloom consumes the Regen', tank.regen, 0);
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
  // Recasting Font of Mana resets its per-cast restored counter (each cast carries
  // its own designed lifetime). (Refresh moved to a channel in #64, so the old
  // Refresh<->Font shared-slot test is gone; channel behavior is covered below.)
  const g2 = new Game(65); g2.start();
  g2.playCard(giveCard(g2, 'fontOfMana'), null);
  g2.mp = MP_MAX;
  g2.playCard(giveCard(g2, 'fontOfMana'), null);
  eq('Font recast keeps strength 3', g2.refresh, 3);
  eq('Font recast carries the Font cap', g2.refreshCap, FONT_MP_CAP);
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

// --- card set phase B: Lifebloom / Fight Song / Barrier / Blood (issue 16) ---
{
  // Definitions: costs, blood costs, rarities (shop prices follow rarity 25/50/75).
  eq('Lifebloom costs 3', CARDS.lifebloom.cost, 3);
  eq('Lifebloom regen strength 2', CARDS.lifebloom.regen, 2);
  eq('Lifebloom is uncommon', CARD_RARITY.lifebloom, 'uncommon');
  eq('Fight Song costs 1', CARDS.battleHymn.cost, 1);
  eq('Fight Song is common', CARD_RARITY.battleHymn, 'common');
  eq('Barrier costs 4', CARDS.barrier.cost, 4);
  eq('Barrier is rare', CARD_RARITY.barrier, 'rare');
  eq('Elbow Grease costs 0 MP', CARDS.bloodTithe.cost, 0);
  eq('Elbow Grease blood cost 4', CARDS.bloodTithe.selfDamage, 4);
  eq('Elbow Grease is uncommon', CARD_RARITY.bloodTithe, 'uncommon');
  eq('Helping Hand costs 2', CARDS.martyrsGift.cost, 2);
  eq('Helping Hand blood cost 3', CARDS.martyrsGift.selfDamage, 3);
  eq('Helping Hand heals others 4', CARDS.martyrsGift.heal, 4);
  check('the phase-B survivors joined the shop pool',
    (['lifebloom', 'battleHymn', 'barrier', 'bloodTithe', 'martyrsGift'] as CardId[])
      .every((id) => CARD_POOL.includes(id)));
}
{
  // Lifebloom end condition 1 — natural expiry (#52): Regen 2 ticks 2 then 1,
  // then bursts 3 as it decays to 0.
  const g = new Game(70); g.start();
  const tank = g.tank;
  tank.maxHP = 100; tank.hp = 5;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER);
  eq('Lifebloom applies Regen 2', tank.regen, 2);
  eq('Lifebloom arms its burst', tank.bloomBurst, LIFEBLOOM_BURST);
  for (let i = 0; i < 2; i++) g._startPlayerPhase(); // Regen 2 = exactly 2 ticks
  eq('Lifebloom ticks (2 then 1) then bursts on expiry', tank.hp, 5 + (2 + 1) + LIFEBLOOM_BURST);
  eq('the paid burst is cleared', tank.bloomBurst, 0);
}
{
  // Casting Regen onto a Lifebloom now DEEPENS it (#52) — the burst is NOT paid
  // out early; it rides along on the extended Regen and pays once, on expiry.
  const g = new Game(71); g.start();
  const tank = g.tank;
  tank.maxHP = 100; tank.hp = 5;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER); // Regen 2 + burst
  g.mp = 10;
  const hpBefore = tank.hp;
  g.playCard(giveCard(g, 'regen'), SLOT.CENTER); // +2 -> Regen 4
  eq('additive Regen deepens the Lifebloom', tank.regen, 4);
  eq('the burst does NOT pay out early', tank.hp, hpBefore);
  eq('the burst is still pending', tank.bloomBurst, LIFEBLOOM_BURST);
  for (let i = 0; i < 4; i++) g._startPlayerPhase(); // Regen 4 = 4 ticks
  eq('the burst pays once on the extended expiry', tank.hp, hpBefore + (4 + 3 + 2 + 1) + LIFEBLOOM_BURST);
  eq('burst cleared after paying', tank.bloomBurst, 0);
}
{
  // End condition 2 — Bloom's consume: consume heal + burst together.
  const g = new Game(72); g.start();
  const tank = g.tank;
  tank.maxHP = 100; tank.hp = 3;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER); // Regen 2
  const hpBefore = tank.hp;
  g.playCard(giveCard(g, 'bloom'), SLOT.CENTER);
  eq('Bloom on Lifebloom heals consume + burst', tank.hp, hpBefore + 2 + LIFEBLOOM_BURST);
  eq('the Regen is consumed', tank.regen, 0);
  eq('the burst is spent', tank.bloomBurst, 0);
}
{
  // Death forfeits the pending burst (no posthumous heal).
  const g = new Game(73); g.start();
  const tank = g.tank;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER);
  eq('Lifebloom arms the burst', tank.bloomBurst, LIFEBLOOM_BURST);
  g._killMember(tank);
  eq('death forfeits the burst', tank.bloomBurst, 0);
  eq('no posthumous heal', tank.hp, 0);
}
{
  // Fight Song: +2 on every living auto THIS party phase; resets after.
  const g = new Game(76); g.start();
  g.playCard(giveCard(g, 'battleHymn'), null);
  const expected = g.livingMembers().reduce((s, m) => s + m.damage + HYMN_BONUS, 0);
  const ehp = g.enemy.hp;
  g.endTurn(); // party phase swings with the hymn, then the enemy phase runs
  eq('Hymn adds +2 to each living auto', ehp - g.enemy.hp, expected);
  eq('Hymn resets after the party phase', g.hymnBonus, 0);
}
{
  // Fight Song degrades as members die (per-member bonus, no corpse credit).
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
  // Elbow Grease: pay 4 HP for 2 MP (capped); gated on >4 HP; engine-tagged.
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
  check('Elbow Grease is engine-tagged', isEngineCard('bloodTithe'));
  check('Retain cannot lock in Elbow Grease', !MODIFIERS.retain.eligible('bloodTithe'));
  check('Efficient cannot touch a 0-cost card', !MODIFIERS.efficient.eligible('bloodTithe'));
}
{
  // Helping Hand: the target pays 3; every OTHER living member heals 4.
  const g = new Game(80); g.start();
  const [ranger, tank, mage] = g.members;
  ranger.hp = 5; tank.hp = 10; mage.hp = 3;
  g.playCard(giveCard(g, 'martyrsGift'), SLOT.CENTER);
  eq('Gift: the target pays 3', tank.hp, 7);
  eq('Gift: ranger heals 4', ranger.hp, 9);
  eq('Gift: mage heals 4', mage.hp, 7);
}
{
  // Blood is never lethal: even bypassing canPlay (dev path), the payment
  // clamps to leave 1 HP.
  const g = new Game(82); g.start();
  const tank = g.tank;
  tank.hp = 2;
  g.devPlayCard('bloodTithe', SLOT.CENTER);
  eq('Blood pay clamps to leave 1 HP', tank.hp, 1);
  check('the member survives the payment', tank.alive);
}

// --- card set phase C: Turtle Up + the Defense pipeline (issue 17) ----
{
  eq('Turtle Up costs 2', CARDS.phalanx.cost, 2);
  eq('Turtle Up is uncommon', CARD_RARITY.phalanx, 'uncommon');
  check('Turtle Up joined the shop pool',
    (['phalanx'] as CardId[]).every((id) => CARD_POOL.includes(id)));
}
{
  // Turtle Up: Defense 2 for 2 enemy turns; Defense-exclusive (its no-stack rule)
  // and never on the taunting member.
  const g = new Game(92); g.start();
  const ranger = g.ranger;
  const idx = giveCard(g, 'phalanx');
  eq('Turtle Up playable on an undefended member', g.canPlay(idx, SLOT.LEFT), null);
  g.playCard(idx, SLOT.LEFT);
  eq('Turtle Up grants Defense strength 2', ranger.defenseAmount, PHALANX_DEFENSE);
  eq('Turtle Up lasts 2 enemy turns', ranger.defense, PHALANX_TURNS);
  const idx2 = giveCard(g, 'phalanx');
  eq('Turtle Up refuses a defended member (no stack)', g.canPlay(idx2, SLOT.LEFT), 'target already has Defense');
  g.tank.taunt = 2; g.tank.defense = 0; g.tank.defenseAmount = 0; // taunt outliving Defense (edge)
  eq('Turtle Up refuses the taunting member', g.canPlay(idx2, SLOT.CENTER), 'cannot target the taunting member');
  // Expiry clears the per-member strength too.
  for (let i = 0; i < PHALANX_TURNS; i++) {
    g.telegraph = { type: 'single', hidden: false, damage: 0, targets: [SLOT.RIGHT], enraged: false, forTurn: g.turn + 1 };
    g._runEnemyPhase();
  }
  eq('expired Defense clears its strength', ranger.defenseAmount, 0);
}
{
  // Taunt keeps a stronger Defense already standing (Turtle Up then Taunt).
  const g = new Game(93); g.start();
  const tank = g.tank;
  g.playCard(giveCard(g, 'phalanx'), SLOT.CENTER); // Defense 2 on the (untaunting) tank
  g.playCard(giveAbility(g, SLOT.CENTER)); // Taunt would grant only 1
  eq('Taunt keeps the stronger standing Defense', tank.defenseAmount, PHALANX_DEFENSE);
  eq('Taunt still refreshes the Defense duration', tank.defense, DEFENSE_TURNS);
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
  // PROPERTY: previewed per-target damage == applied damage through the full
  // Defense -> Shield pipeline, across seeds and randomized ward states (the
  // #15/#17 telegraph invariant).
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
      if (g.rng() < 0.4) { m.shield = true; m.shieldTurns = SHIELD_TURNS; }
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

// --- Act 2/3 named rosters: boss tech at small scale (issue 20) -------------
{
  const rosterGame = (seed: number, def: typeof IRONMAW_DEF, maxHP = 150): Game => {
    const cfg = defaultBattleConfig();
    cfg.enemy = { maxHP, boss: false, attackBonus: 0, def, enrageTurn: 99 };
    return new Game(seed, cfg);
  };

  // Ironchomp: Jawbreaker is a 2-turn channel at 9 in rotation slot 2 every 2nd cycle.
  {
    const g = rosterGame(110, IRONMAW_DEF);
    g.rotationIndex = 2; // slot 2, cycle 0 — NOT a channel cycle
    let t = g._generateTelegraph(2);
    check('Ironchomp slot 2 cycle 0 is a plain attack', !t.channel);
    g.rotationIndex = 5; // slot 2, cycle 1 — the channel cycle
    t = g._generateTelegraph(2);
    check('Ironchomp channels Jawbreaker on cycle 2', t.channel === true);
    eq('Jawbreaker carries its name', t.channelName, 'Jawbreaker');
    eq('Jawbreaker hits for 9', t.damage, 9);
    eq('Jawbreaker is a 2-turn wind-up', t.turnsUntilResolve, 2);
  }

  // Needler: Needle Shot pierces — ignores Taunt and Defense, aims at the
  // lowest-HP member — once per 4-step cycle.
  {
    const g = rosterGame(111, NEEDLER_DEF);
    g.tank.taunt = TAUNT_TURNS; g.tank.defense = DEFENSE_TURNS; g.tank.defenseAmount = 1;
    g.mage.hp = 2; // strictly lowest
    g.rotationIndex = 1;
    const t = g._generateTelegraph(2);
    eq('Needle Shot carries its name', t.name, 'Needle Shot');
    check('Needle Shot ignores the taunt funnel', t.ignoreTaunt === true);
    check('Needle Shot ignores Defense', t.ignoreDefense === true);
    eq('Needle Shot aims at the lowest-HP member', JSON.stringify(t.targets), JSON.stringify([SLOT.RIGHT]));
    eq('Needle Shot hits for 4', t.damage, NEEDLER_PIERCE_DMG);
    eq('only one pierce per Needler cycle', NEEDLER_DEF.rotation!.filter((s) => typeof s !== 'string').length, 1);
  }

  // Leech: Snack Time is a telegraphed 'cast' that cleanses its own Poison and
  // self-heals the remaining ticks — the Gobbler's Gulp at small scale.
  {
    const g = rosterGame(112, LEECH_DEF);
    g.start();
    g.rotationIndex = 4; // the Snack Time slot
    g.telegraph = g._generateTelegraph(2);
    eq('Snack Time telegraphs as a cast', g.telegraph.cast, 'consume');
    eq('Snack Time carries its name', g.telegraphIntent(), 'Snack Time');
    g.enemy.hp = 100; g.enemy.poison = 5; g.enemy.poisonTurns = 3;
    g._runEnemyPhase();
    // One poison tick (5) lands first, then Snack Time eats the remaining 2 ticks (10).
    eq('Snack Time cleanses the poison', g.enemy.poisonTurns, 0);
    eq('Snack Time heals the remaining ticks', g.enemy.hp, 100 - 5 + 10);
  }

  // Act-3 variants reuse the same machinery at heavier numbers.
  {
    const g = rosterGame(113, JUGGERNAUT_DEF);
    g.rotationIndex = 5; // slot 2, cycle 1
    const t = g._generateTelegraph(2);
    check('Steamroller channels Flatten', t.channel === true && t.channelName === 'Flatten');
    eq('Flatten hits for 11', t.damage, 11);
    const g2 = rosterGame(114, LANCER_DEF);
    g2.rotationIndex = 1;
    const t2 = g2._generateTelegraph(2);
    check('Lancer Skewer pierces', t2.name === 'Skewer' && t2.ignoreTaunt === true && t2.ignoreDefense === true);
    eq('Skewer hits for 5', t2.damage, LANCER_PIERCE_DMG);
    check('Gobblet carries a Snack Time step',
      DEVOURLING_DEF.rotation!.some((s) => typeof s !== 'string' && s.cast === 'consume'));
  }
}

// --- relics phase A (issue 21) -----------------------------------------------
{
  const relicGame = (seed: number, relics: RelicId[]): Game => {
    const cfg = defaultBattleConfig();
    cfg.relics = relics;
    return new Game(seed, cfg);
  };
  const singleAt = (dmg: number, slot: number, type: 'single' | 'heavy' | 'aoe' = 'single') => ({
    type: type as 'single', hidden: false, damage: dmg,
    targets: type === 'aoe' ? [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT] : [slot as 0],
    enraged: false, forTurn: 2,
  });

  // Inert when empty: relic plumbing changes nothing without relics.
  {
    const play = (g: Game): string => {
      g.start();
      for (let i = 0; i < 6 && g.status === 'playing'; i++) g.endTurn();
      return JSON.stringify(g.log) + JSON.stringify(g.members) + g.mp;
    };
    eq('relic plumbing is inert when empty', play(new Game(300)), play(relicGame(300, [])));
  }

  // Lantern of Foresight: a hidden telegraph reveals its true target.
  {
    const g = relicGame(301, ['lantern']);
    g.start();
    g.telegraph = { ...singleAt(4, SLOT.LEFT), type: 'hidden', hidden: true };
    const lines = g.attackTargets();
    eq('Lantern collapses the hidden fan-out to the true target',
      JSON.stringify(lines.map((l) => l.slot)), JSON.stringify([SLOT.LEFT]));
    check('the revealed line still reads as hidden', lines[0].hidden === true);
    const g2 = relicGame(301, []);
    g2.start();
    g2.telegraph = { ...singleAt(4, SLOT.LEFT), type: 'hidden', hidden: true };
    eq('without the Lantern the fan-out stays', g2.attackTargets().length, g2.livingMembers().length);
  }

  // Field Triage Kit: heals on members below half max HP heal harder.
  {
    const g = relicGame(303, ['fieldTriage']);
    g.start();
    const tank = g.tank;
    tank.hp = 5; // below 9 (half of 18)
    eq('Triage boosts a heal below half', g._healMember(tank, 2), 2 + FIELD_TRIAGE_BONUS);
    tank.hp = 15;
    eq('Triage leaves the healthy alone', g._healMember(tank, 2), 2);
  }

  // War Drum: an Ability cast primes the caster's next auto to double (consumed).
  {
    const g = relicGame(304, ['warDrum']);
    g.start();
    g.playCard(giveAbility(g, SLOT.CENTER)); // Taunt
    check('the Drum primes the caster', g.tank.drumPrimed);
    const expected = g.livingMembers().reduce((s, m) => s + g.memberDamage(m), 0) + g.memberDamage(g.tank);
    const ehp = g.enemy.hp;
    g.endTurn();
    eq('the primed auto lands double', ehp - g.enemy.hp, expected);
    check('the beat is spent', !g.tank.drumPrimed);
  }

  // Prayer Beads: each reshuffle restores MP.
  {
    const g = relicGame(306, ['prayerBeads']);
    g.start();
    g.mp = 0;
    g.drawPile = [];
    g.discardPile.push(makeDeckCard('lowHeal', -60));
    g._drawOne(); // forces the reshuffle
    eq('the Beads pay on a reshuffle', g.mp, PRAYER_BEADS_MP);
  }

  // Vanguard's Banner: full-HP members swing harder.
  {
    const g = relicGame(311, ['vanguardsBanner']);
    g.start();
    g.tank.hp = g.tank.maxHP;
    eq('the Banner boosts a full-HP auto', g.memberDamage(g.tank), g.tank.damage + VANGUARD_BONUS);
    g.tank.hp -= 1;
    eq('the Banner ignores the wounded', g.memberDamage(g.tank), g.tank.damage);
  }

}

// --- relics phase B: rule-changers + curses (issue 22) ------------------------
{
  const relicGame = (seed: number, relics: RelicId[], spent: RelicId[] = []): Game => {
    const cfg = defaultBattleConfig();
    cfg.relics = relics;
    cfg.spentRelics = spent;
    return new Game(seed, cfg);
  };

  // Guardian Feather: the first death of the FIGHT becomes survival at 1 HP with
  // statuses stripped; the wipe check sees the survivor; later deaths are real.
  // (Now once per FIGHT — it resets each fight, and is not persisted to spentRelics.)
  {
    const g = relicGame(408, ['martyrsIcon']);
    g.start();
    const tank = g.tank;
    tank.regen = 2; tank.taunt = 2;
    const died = g._killMember(tank);
    check('the Icon refuses the first death', !died && tank.alive);
    eq('the spared member stands at 1 HP', tank.hp, 1);
    eq('the brush with death strips statuses', tank.regen + tank.taunt, 0);
    check('no wipe with the survivor standing', !g.allDead());
    check('the once-per-fight save is not persisted to the run', !g.spentRelicIds().includes('martyrsIcon'));
    const died2 = g._killMember(tank);
    check('the second death this fight is real', died2 && !tank.alive);
    // A FRESH fight re-arms the save (once per fight, not once per run).
    const g2 = relicGame(409, ['martyrsIcon']);
    g2.start();
    check('a fresh fight re-arms the Icon', !g2._killMember(g2.tank) && g2.tank.alive);
  }

  // Pact of Silence: Rest is gone; the pact pays passive MP instead.
  {
    const g = relicGame(410, ['pactOfSilence']);
    g.start();
    check('the Pact forbids Rest', !g.canSkip());
    g.mp = 0;
    g._startPlayerPhase();
    eq('the Pact pays its passive MP', g.mp, PACT_PASSIVE_MP);
  }

  // Rusty Crown: normal enemies hit +1; the bosses are exempt.
  {
    const g = relicGame(412, ['rustyCrown']);
    eq('normals hit harder under the Crown', g.attackDamage('single', 1), 4 + RUSTY_CROWN_ATTACK);
    const cfg = defaultBattleConfig();
    cfg.relics = ['rustyCrown'];
    cfg.enemy = { ...cfg.enemy, boss: true };
    const gb = new Game(413, cfg);
    eq('bosses are exempt from the Crown', gb.attackDamage('single', 1), 4);
  }
}

// --- party roster wave 1: Evil-Eye Warlock + Busker (#27; Warlock redesigned #39) ---
{
  // Warlock identity is read from the drafted member id, seated at its slot.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['warlock', 'tank', 'mage']);
  const g = new Game(1, cfg); g.start();
  const w = g.members[0];
  eq('drafted Warlock seated in slot 0', w.id, 'warlock');
  eq('Warlock name from the pool', w.name, 'Warlock');
  eq('Warlock ability is Evil Eye (#39)', w.ability, 'hex');
  eq('Warlock is a low-damage controller', w.damage, 3);

  // Evil Eye curses the enemy with Vulnerability; in a full party it uses the trio value.
  g.enemy.hp = 999;
  g._fireAbility(w);
  eq('Evil Eye makes the enemy Vulnerable for HEX_TURNS', g.enemy.vulnerableTurns, HEX_TURNS);
  eq('trio Evil Eye vuln = HEX_VULN_BY_SIZE[3]', g.enemy.vulnerable, HEX_VULN_BY_SIZE[3]);
  // Vulnerability amplifies every party damage source (applied in _damageEnemy).
  const raw = 10;
  eq('Vulnerability amplifies party damage', g.vulnerableAmount(raw), raw + Math.floor(raw * HEX_VULN_BY_SIZE[3]));
}
{
  // The Evil Eye is STRONGER the fewer members are fielded (#39): solo > trio.
  const mkEmpty = () => ({ maxHP: 0, damage: 0, abilityPower: 0, injuries: 0, empty: true });
  const cfg = defaultBattleConfig();
  cfg.party = [partyFromMembers(['warlock'])[0], mkEmpty(), mkEmpty()];
  const g = new Game(4, cfg); g.start();
  eq('a solo Warlock fields party size 1', g.fieldedPartySize(), 1);
  g.enemy.hp = 999;
  g._fireAbility(g.members[0]);
  eq('solo Evil Eye uses the solo (largest) vuln', g.enemy.vulnerable, HEX_VULN_BY_SIZE[1]);
  check('solo Evil Eye is stronger than a full party', HEX_VULN_BY_SIZE[1] > HEX_VULN_BY_SIZE[3]);
}
{
  // The redesigned Evil Eye has NO self-damage: the old Soul Tithe / Dark Bargain suicide
  // (a permadeath magnet under the roster campaign) is gone.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['warlock', 'tank', 'mage']);
  const g = new Game(5, cfg); g.start();
  const w = g.members[0];
  const hp0 = w.hp;
  g.enemy.hp = 999;
  g._fireAbility(w);
  g._fireAbility(w);
  eq('Evil Eye costs the Warlock no HP', w.hp, hp0);
  g.endTurn(); // a full party phase — no Soul Tithe drain any more
  eq('the Warlock is not drained at end of party phase', w.hp, hp0);
  check('the Warlock stays alive (no burn-out)', w.alive);
}
{
  // Vulnerability counts down over enemy phases and clears when it expires.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['warlock', 'tank', 'mage']);
  const g = new Game(6, cfg); g.start();
  g.enemy.hp = 999;
  g._fireAbility(g.members[0]);
  eq('Evil Eye sets HEX_TURNS', g.enemy.vulnerableTurns, HEX_TURNS);
  for (let i = 0; i < HEX_TURNS; i++) g.endTurn();
  eq('Vulnerability expires after HEX_TURNS enemy phases', g.enemy.vulnerableTurns, 0);
  eq('vuln magnitude resets to 0 on expiry', g.enemy.vulnerable, 0);
}
{
  // Busker: 0 base, strikes for SKALD_DMG_PER_CARD × cards played, capped.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['ranger', 'tank', 'skald']);
  const g = new Game(4, cfg); g.start();
  const s = g.members[2];
  eq('drafted Busker seated in slot 2', s.id, 'skald');
  eq('Busker base damage is 0', s.damage, 0);
  g.cardsPlayedThisPhase = 0;
  eq('Busker strikes for 0 on an empty turn', g.memberDamage(s), 0);
  g.cardsPlayedThisPhase = 3;
  eq('Busker strike scales with cards played', g.memberDamage(s), SKALD_DMG_PER_CARD * 3);
  g.cardsPlayedThisPhase = 10;
  eq('Busker strike is capped', g.memberDamage(s), SKALD_DMG_CAP);
}
{
  // Crescendo draws CRESCENDO_DRAW, counts as a card played, and is engine-tagged.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['ranger', 'tank', 'skald']);
  const g = new Game(5, cfg); g.start();
  // Ensure the draw pile has cards to pull.
  g.drawPile = [makeDeckCard('lowHeal', -900), makeDeckCard('lowHeal', -901), makeDeckCard('lowHeal', -902)];
  const handBefore = g.hand.length;
  g.mp = 10;
  const idx = giveCard(g, 'conduct'); // the Busker's bound ability card (#44)
  const played0 = g.cardsPlayedThisPhase;
  g.playCard(idx); // fire the Busker's Crescendo
  eq('Crescendo drew CRESCENDO_DRAW cards', g.hand.length, handBefore + CRESCENDO_DRAW);
  eq('Crescendo counts as one card played', g.cardsPlayedThisPhase, played0 + 1);
  check('Crescendo is engine-tagged', isEngineAbility('crescendo'));
  check('Jinx is not engine-tagged (#39: no longer mints MP)', !isEngineAbility('hex'));
  check('Poison is not engine-tagged', !isEngineAbility('poison'));
}

// --- party roster wave 2: Berserker (#28) -----------------------------------
{
  // Berserker damage bands: 2 / 4 / 6 as HP falls past the fight-relative thresholds.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['berserker', 'tank', 'mage']);
  const g = new Game(1, cfg); g.start();
  const b = g.members[0];
  eq('Berserker seated in slot 0', b.id, 'berserker');
  b.hp = 16; eq('Berserker calm damage is base 2', g.memberDamage(b), 2);
  b.hp = 8;  eq('Berserker +2 in band 1 (HP ≤ 8)', g.memberDamage(b), 4);
  b.hp = 4;  eq('Berserker +4 in band 2 (HP ≤ 4)', g.memberDamage(b), 6);
  b.hp = 5;  eq('Berserker still band 1 at HP 5', g.memberDamage(b), 4);
}
{
  // Bands are fight-relative: a higher attackBonus raises the thresholds.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['berserker', 'tank', 'mage']);
  cfg.enemy = { ...cfg.enemy, attackBonus: 1 };
  const g = new Game(2, cfg); g.start();
  const b = g.members[0];
  eq('thresholds shift with attackBonus', JSON.stringify(g.berserkerThresholds()), JSON.stringify([9, 5]));
  b.hp = 9; eq('Berserker rages one HP higher on a +1 fight', g.memberDamage(b), 4);
  b.hp = 5; eq('Berserker berserk one HP higher on a +1 fight', g.memberDamage(b), 6);
}
{
  // Rampage: 2× current (banded) damage + abilityPower, strikes, then loses 2 HP
  // (clamped — never lethal).
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['berserker', 'tank', 'mage']);
  const g = new Game(3, cfg); g.start();
  const b = g.members[0];
  b.hp = 8; b.abilityPower = 1; // band 1 -> current damage 4
  const ehp = g.enemy.hp;
  g._fireAbility(b);
  eq('Rampage hits for 2×current + abilityPower', ehp - g.enemy.hp, 2 * 4 + 1);
  eq('Rampage self-damages 2 HP', b.hp, 8 - RAMPAGE_SELF_DMG);

  // Rampage never kills the Berserker: at 1 HP the self-damage clamps to 0.
  b.hp = 1; const ehp2 = g.enemy.hp;
  g._fireAbility(b);
  check('Rampage clamps — Berserker survives at 1 HP', b.alive && b.hp === 1);
  check('Rampage still struck', g.enemy.hp < ehp2);
}

finish();
