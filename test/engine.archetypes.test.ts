// Engine archetype/roster suites (Beast Warden, Sentinel, Plaguewright, channels,
// Hierophant, Duelist, Flagellant, Lightkeeper, cross-cutting). Split from
// engine.test.ts for navigability; shares test/harness.ts + test/factories.ts.
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

// --- party roster wave 3: Beast Warden + Boar pet (#29) ---------------------
function wardenGame(seed: number) {
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['beastWarden', 'tank', 'mage']);
  return new Game(seed, cfg).start();
}
{
  // Call Boar summons a Boar (7 + abilityPower HP, 4 turns) and lends +4 strike.
  const g = wardenGame(1);
  const w = g.members[0];
  eq('Beast Warden seated in slot 0', w.id, 'beastWarden');
  eq('Warden strikes for 1 without a Boar', g.memberDamage(w), 1);
  g._fireAbility(w);
  eq('Call Boar sets Boar HP', w.boarHp, BOAR_HP);
  eq('Call Boar sets Boar turns', w.boarTurns, BOAR_TURNS);
  eq('the Boar lends +4 strike (1 -> 5)', g.memberDamage(w), 1 + BOAR_STRIKE_BONUS);
  w.abilityPower = 3; g._fireAbility(w);
  eq('Boar HP scales with abilityPower', w.boarHp, BOAR_HP + 3);
}
{
  // The Boar absorbs a WHOLE instance aimed at the slot — no spill to the Warden —
  // and a base heavy (7) is exactly one Boar.
  const g = wardenGame(2);
  const w = g.members[0];
  g._fireAbility(w); // Boar 7 HP
  const wardenHp = w.hp;
  g.telegraph = { type: 'heavy', hidden: false, damage: 7, targets: [0], enraged: false, forTurn: 1, turnsUntilResolve: 1 };
  // Preview shows 0 to the Warden while the Boar stands (preview == applied).
  const preview = g.attackTargets().find((s) => s.slot === 0);
  eq('the preview shows 0 to the Warden behind a Boar', preview?.damage, 0);
  g._resolveAttack();
  eq('the Warden takes no spill', w.hp, wardenHp);
  eq('a base heavy exactly kills the Boar', w.boarHp, 0);
  eq('a fallen Boar clears its timer', w.boarTurns, 0);
}
{
  // A small hit only chips the Boar; the Warden still takes nothing.
  const g = wardenGame(3);
  const w = g.members[0];
  g._fireAbility(w); // Boar 7
  const wardenHp = w.hp;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [0], enraged: false, forTurn: 1, turnsUntilResolve: 1 };
  g._resolveAttack();
  eq('the Boar soaks the small hit', w.boarHp, 7 - 4);
  eq('the Warden is untouched', w.hp, wardenHp);
  check('the Boar still stands', w.boarHp > 0);
}
{
  // The Boar is unhealable: healing the Warden raises HER HP, never the Boar.
  const g = wardenGame(4);
  const w = g.members[0];
  g._fireAbility(w);
  w.hp = 3; const boar0 = w.boarHp;
  g.mp = 10;
  g.playCard(giveCard(g, 'highHeal'), 0);
  check('the heal raises the Warden HP', w.hp > 3);
  eq('the heal never touches the Boar', w.boarHp, boar0);
}
{
  // The Boar returns to the wild after BOAR_TURNS enemy turns.
  const g = wardenGame(5);
  const w = g.members[0];
  g._fireAbility(w);
  g.enemy.hp = 999; // keep the fight alive across turns
  for (let i = 0; i < BOAR_TURNS; i++) g._decayBuffs();
  eq('the Boar expires after BOAR_TURNS', w.boarHp, 0);
  eq('the expired Boar clears its timer', w.boarTurns, 0);
}
{
  // The Boar is exempt from the wipe check: a lone Warden behind a Boar is not a
  // wipe even when a killing blow lands on her slot.
  const g = wardenGame(6);
  const w = g.members[0];
  g.members[1].alive = false; g.members[2].alive = false; // only the Warden lives
  g._fireAbility(w);
  g.telegraph = { type: 'heavy', hidden: false, damage: 99, targets: [0], enraged: false, forTurn: 1, turnsUntilResolve: 1 };
  g._resolveAttack();
  check('the lone Warden survives behind the Boar', w.alive && g.status === 'playing');
}

// --- party roster: Sentinel + Stun (#61) ------------------------------------
// A boss game seating the Sentinel in slot 0, so the Stun can cancel a scripted
// rotation step / channel wind-up / cast.
{
  // Data: the Sentinel is a sturdy bruiser carrying Stun; the bound card is Stagger
  // (5 MP, no target), and it maps through ABILITY_CARD like every other member card.
  const s = MEMBER_POOL.sentinel;
  eq('Sentinel HP 13', s.maxHP, 13);
  eq('Sentinel damage 2', s.damage, 2);
  eq('Sentinel ability is stun', s.ability, 'stun');
  eq('stun binds to the Stagger card', ABILITY_CARD.stun, 'stagger');
  eq('Stagger costs 5 MP (the balance lever)', CARDS.stagger.cost, 5);
  eq('Stagger takes no target', CARDS.stagger.target, 'none');
  eq('Stagger fires the stun ability', CARDS.stagger.ability, 'stun');
  check('Stagger is a per-member ability card', isAbilityCard('stagger'));
  check('the Sentinel has ability flavor', MEMBER_ABILITY_FLAVOR.sentinel.length > 0);
}
{
  // Playing Stagger cancels the standing telegraph: the coming enemy resolution
  // deals NO damage, the MP is spent, and a fresh telegraph stands afterward.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['sentinel', 'tank', 'mage']);
  const g = new Game(1, cfg); g.start();
  const victim = g.members[1];
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [1], enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
  victim.hp = victim.maxHP;
  g.mp = 5;
  g.playCard(giveCard(g, 'stagger'), null);
  check('the telegraph is flagged Stunned', g.telegraph.stunned === true);
  eq('Stagger spent its 5 MP', g.mp, 0);
  eq('a Stunned telegraph previews nothing', g.attackTargets().length, 0);
  const hpBefore = victim.hp;
  const turnBefore = g.turn;
  g._runEnemyPhase();
  eq('the enemy dealt 0 damage on the stunned turn', victim.hp, hpBefore);
  check('a fresh telegraph stands afterward', g.telegraph != null && g.telegraph.stunned !== true);
  eq('the turn counter still ticked (progress toward enrage)', g.turn, turnBefore + 1);
}
{
  // Stunning a rotation-boss step CONSUMES it: the rotation advances and the
  // stunned step is skipped, not repeated (single -> the NEXT step 'two' stands).
  const g = sentinelBossGame(2);
  g.rotationIndex = 0;                       // 'single'
  g.telegraph = g._generateTelegraph(g.turn);
  eq('the standing step is the single', g.telegraph.type, 'single');
  g._fireAbility(g.members[0]);             // Sentinel Stuns
  check('the single is flagged Stunned', g.telegraph.stunned === true);
  g._runEnemyPhase();
  eq('the rotation advanced past the stunned step', g.rotationIndex, 1);
  eq('the next step telegraphs fresh (not a repeat)', g.telegraph.type, 'two');
  check('the fresh telegraph is not itself stunned', g.telegraph.stunned !== true);
}
{
  // Stunning a channel wind-up ABORTS it: it never lands and does not resume — the
  // rotation advances past the channel slot to the next plain step.
  const g = sentinelBossGame(3);
  g.rotationIndex = 6;                       // Crushing Blow channel slot (cycle 2)
  g.telegraph = g._generateTelegraph(g.turn);
  check('a channel is standing', g.telegraph.channel === true);
  const target = g.telegraph.targets[0];
  g.members[target].hp = 50;
  g._fireAbility(g.members[0]);
  g._runEnemyPhase();
  eq('the aborted channel dealt no damage', g.members[target].hp, 50);
  eq('the rotation advanced past the channel', g.rotationIndex, 7);
  check('the channel did not resume/stand', g.telegraph.channel !== true);
  // Drive a full extra cycle: the consumed Crushing Blow does not re-stand this cycle.
  for (let i = 0; i < 3; i++) g._runEnemyPhase();
  check('the consumed channel is not repeated within the cycle',
    g.telegraph.channelName !== 'Crushing Blow' || g.rotationIndex % 8 !== 6);
}
{
  // A 'cast' telegraph (Hexweaver's Hex) is likewise consumed with NO scripted
  // effect — no healing-reduction Wound is applied.
  const g = sentinelBossGame(4, HEXWEAVER_DEF);
  g.rotationIndex = 2;                       // Hex ('cast' -> 'wound') slot
  g.telegraph = g._generateTelegraph(g.turn);
  check('the standing telegraph is a cast', g.telegraph.cast != null);
  eq('no Wound is active yet', g.woundTurns, 0);
  g._fireAbility(g.members[0]);
  g._runEnemyPhase();
  eq('the cancelled cast ran no scripted effect (no Wound)', g.woundTurns, 0);
  eq('the cancelled cast advanced the rotation', g.rotationIndex, 3);
}
{
  // Property: while stunned, the preview (attackTargets) and the applied damage are
  // both 0, across every telegraph geometry — the telegraph==applied invariant holds.
  let checked = 0;
  for (const type of ['single', 'two', 'aoe', 'heavy', 'sweep'] as const) {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['sentinel', 'tank', 'mage']);
    const g = new Game(100 + checked, cfg); g.start();
    const targets: Slot[] = type === 'single' || type === 'heavy' ? [SLOT.CENTER] : [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT];
    g.telegraph = { type, hidden: false, damage: 6, targets, enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
    for (const m of g.members) m.hp = m.maxHP;
    g._fireAbility(g.members[0]);
    eq(`stunned ${type} previews nothing`, g.attackTargets().length, 0);
    const hpBefore = g.members.map((m) => m.hp);
    g._runEnemyPhase();
    const applied = g.members.reduce((s, m, i) => s + (hpBefore[i] - m.hp), 0);
    eq(`stunned ${type} applied 0 damage (preview == applied)`, applied, 0);
    checked++;
  }
  check('stun property test exercised every geometry', checked === 5, `${checked} checked`);
}
{
  // Enrage still fires and the turn counter still advances on a stunned turn — the
  // lost turn is real tempo cost toward enrage (the intended balance lever).
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['sentinel', 'tank', 'mage']);
  const g = new Game(6, cfg); g.start();
  g.enemy.hp = 999;
  g.turn = ENRAGE_TURN;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [1], enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
  g._fireAbility(g.members[0]);
  g._runEnemyPhase();
  check('enrage fired on the stunned turn', g.enemy.enraged === true);
  eq('the turn counter advanced through the stunned turn', g.turn, ENRAGE_TURN + 1);
}
{
  // The Stagger card is unplayable while the Sentinel is down (the #44/#54 path),
  // and firing Stun with nothing to interrupt is a harmless no-op.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['sentinel', 'tank', 'mage']);
  const g = new Game(7, cfg); g.start();
  g.mp = 10;
  const idx = giveCard(g, 'stagger');
  check('Stagger is playable with a living Sentinel', g.canPlay(idx, null) === null);
  g._killMember(g.members[0]);
  check('Stagger is disabled once the Sentinel is down', g.canPlay(idx, null) !== null);
  // Idempotent: stunning an already-stunned telegraph does not double-consume.
  const cfg2 = defaultBattleConfig();
  cfg2.party = partyFromMembers(['sentinel', 'tank', 'mage']);
  const g2 = new Game(8, cfg2); g2.start();
  g2.telegraph = { type: 'single', hidden: false, damage: 4, targets: [1], enraged: false, forTurn: g2.turn, turnsUntilResolve: 1 };
  g2._fireAbility(g2.members[0]);
  g2._fireAbility(g2.members[0]);
  check('re-stunning keeps the telegraph stunned (no error)', g2.telegraph.stunned === true);
}

// --- party roster: Plaguewright + Ferment (#72) -----------------------------
// A second poison hero. Ferment opens a window in which enemy Poison COMPOUNDS:
// each tick deals its damage, then per-turn grows and the duration is frozen.
function plaguewrightGame(seed: number, ids: MemberId[] = ['plaguewright', 'tank', 'mage']): Game {
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(ids);
  cfg.enemy = { maxHP: 99999, boss: false, attackBonus: 0, def: DEFAULT_ENEMY_DEF, enrageTurn: 999 };
  return new Game(seed, cfg).start();
}
// A harmless 0-damage single so a driven enemy phase only surfaces the Poison tick
// (enemy attacks hit the party, not the enemy — enemy HP moves only by Poison).
function harmlessTelegraph(g: Game) {
  g.telegraph = { type: 'single', hidden: false, damage: 0, targets: [1], enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
}
{
  // Data: the Plaguewright is a mid-line caster (Ranger-adjacent, one less HP) whose
  // Ferment card (2 MP, no target, nature) maps through ABILITY_CARD like every member.
  const p = MEMBER_POOL.plaguewright;
  eq('Plaguewright HP 10', p.maxHP, 10);
  eq('Plaguewright damage 3', p.damage, 3);
  eq('Plaguewright ability is ferment', p.ability, 'ferment');
  eq('ferment binds to the Ferment card', ABILITY_CARD.ferment, 'ferment');
  eq('Ferment costs 2 MP', CARDS.ferment.cost, 2);
  eq('Ferment takes no target', CARDS.ferment.target, 'none');
  eq('Ferment fires the ferment ability', CARDS.ferment.ability, 'ferment');
  eq('Ferment is a nature card', cardType('ferment'), 'nature');
  check('Ferment is a per-member ability card', isAbilityCard('ferment'));
  check('the Plaguewright has ability flavor', MEMBER_ABILITY_FLAVOR.plaguewright.length > 0);
  eq('Plaguewright base salary is 17', MEMBER_BASE_SALARY.plaguewright, 17);
  check('Ferment is excluded from the shop pool', !CARD_POOL.includes('ferment'));
}
{
  // Fresh 5×5 Poison + Ferment: the window deals 5, 7, 9 (per-turn grows +2 each,
  // duration frozen), then decays 11×5 = 55 after the window — a fight total of 76.
  const g = plaguewrightGame(1);
  g.enemy.poison = POISON_BASE; g.enemy.poisonTurns = POISON_TURNS; // 5×5 = 25 raw
  g._fireAbility(g.members[0]);
  eq('ferment opens a 3-turn window', g.enemy.fermentTurns, FERMENT_TURNS);
  const dealt: number[] = [];
  for (let i = 0; i < 10; i++) {
    const before = g.enemy.hp;
    harmlessTelegraph(g);
    g._runEnemyPhase();
    dealt.push(before - g.enemy.hp);
  }
  eq('the fermented window deals 5 then 7 then 9', JSON.stringify(dealt.slice(0, 3)), JSON.stringify([5, 7, 9]));
  eq('after the window the per-turn is inflated to 11', dealt[3], 11);
  eq('the inflated Poison decays 11×5 after the window', JSON.stringify(dealt.slice(3, 8)), JSON.stringify([11, 11, 11, 11, 11]));
  eq('the whole fermented Poison deals 76 total', dealt.reduce((a, b) => a + b, 0), 76);
}
{
  // Mid-window the per-turn is inflated and the duration is FROZEN at its cast value.
  const g = plaguewrightGame(2);
  g.enemy.poison = POISON_BASE; g.enemy.poisonTurns = POISON_TURNS;
  g._fireAbility(g.members[0]);
  harmlessTelegraph(g); g._runEnemyPhase(); // tick 5 -> poison 7
  harmlessTelegraph(g); g._runEnemyPhase(); // tick 7 -> poison 9
  eq('two ticks inflate the per-turn to 9', g.enemy.poison, 9);
  eq('the duration is frozen at its cast value', g.enemy.poisonTurns, POISON_TURNS);
  eq('the ferment window itself decremented once per phase', g.enemy.fermentTurns, FERMENT_TURNS - 2);
}
{
  // Recast extends the window additively (+3), and the duration stays frozen across
  // the whole 6-turn window.
  const g = plaguewrightGame(3);
  g.enemy.poison = POISON_BASE; g.enemy.poisonTurns = POISON_TURNS;
  g._fireAbility(g.members[0]); // window 3
  g._fireAbility(g.members[0]); // recast: +3 -> window 6
  eq('a recast adds +3 to the window', g.enemy.fermentTurns, FERMENT_TURNS * 2);
  let frozenThroughout = true;
  for (let i = 0; i < 6; i++) {
    harmlessTelegraph(g); g._runEnemyPhase();
    if (g.enemy.poisonTurns !== POISON_TURNS) frozenThroughout = false;
  }
  check('the duration stayed frozen through all 6 fermented ticks', frozenThroughout);
  eq('the 6-turn window has fully closed', g.enemy.fermentTurns, 0);
  eq('the per-turn compounded 6× (+2 each) to 17', g.enemy.poison, POISON_BASE + FERMENT_GROWTH * 6);
  // After the window, normal decay resumes at the inflated rate.
  const before = g.enemy.poisonTurns;
  harmlessTelegraph(g); g._runEnemyPhase();
  eq('normal decay resumes once the window closes', g.enemy.poisonTurns, before - 1);
}
{
  // Hemorrhage (#67) reads the inflated per-turn × the frozen duration (9×5 = 45).
  const g = plaguewrightGame(4);
  g.mp = g.maxMana;
  g.enemy.poison = POISON_BASE; g.enemy.poisonTurns = POISON_TURNS;
  g._fireAbility(g.members[0]);
  harmlessTelegraph(g); g._runEnemyPhase(); // poison -> 7
  harmlessTelegraph(g); g._runEnemyPhase(); // poison -> 9
  eq('mid-window poison is 9 over a frozen 5 turns', g.enemy.poison, 9);
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'hemorrhage'));
  eq('Hemorrhage cashes 9×5 = 45 mid-fermentation', before - g.enemy.hp, 9 * POISON_TURNS);
}
{
  // Ability power (Empower here) modifies the +2 growth per tick — it becomes +3.
  const g = plaguewrightGame(5);
  g.enemy.poison = POISON_BASE; g.enemy.poisonTurns = POISON_TURNS;
  g.members[0].empowerBonus = EMPOWER_BONUS; // +1 power on the next ability
  g._fireAbility(g.members[0]);
  eq('Empower lifts the growth to +3', g.enemy.fermentGrowth, FERMENT_GROWTH + EMPOWER_BONUS);
  check('Empower was spent by the cast', g.members[0].empowerBonus === 0);
  harmlessTelegraph(g); g._runEnemyPhase();
  eq('one fermented tick grew the per-turn by 3', g.enemy.poison, POISON_BASE + FERMENT_GROWTH + EMPOWER_BONUS);
}
{
  // The Devourer's Consume eats the whole investment: it clears Poison entirely, but
  // the ferment window keeps running (empty) — counterplay both ways.
  const g = plaguewrightGame(6);
  g.enemy.poison = 9; g.enemy.poisonTurns = POISON_TURNS; // a fat fermented poison
  g._fireAbility(g.members[0]);
  const consume = { type: 'single' as const, cast: 'consume' as const, name: 'Consume', hidden: false, damage: 0, targets: [1] as Slot[], enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
  g._resolveCast(consume);
  eq('Consume clears the poison strength', g.enemy.poison, 0);
  eq('Consume clears the poison duration', g.enemy.poisonTurns, 0);
  check('the ferment window keeps running, now empty', g.enemy.fermentTurns === FERMENT_TURNS);
}
{
  // Ferment before any poison: the window opens and burns down on its own, then a
  // fresh Imbue Venom (the Ranger's poison) compounds from its very first tick.
  const g = plaguewrightGame(7, ['ranger', 'plaguewright', 'tank']);
  const plague = g.members[1];
  g._fireAbility(plague); // ferment with no poison standing
  eq('the window opens with no poison', g.enemy.fermentTurns, FERMENT_TURNS);
  harmlessTelegraph(g); g._runEnemyPhase(); // empty window ticks down, no poison dealt
  eq('an empty window still ticks down', g.enemy.fermentTurns, FERMENT_TURNS - 1);
  eq('no poison stood so nothing was dealt', g.enemy.poison, 0);
  g._fireAbility(g.members[0]); // the Ranger applies a fresh 5×5 Poison mid-window
  eq('Imbue Venom seeds a fresh 5×5 poison', g.enemy.poison, POISON_BASE);
  harmlessTelegraph(g); g._runEnemyPhase();
  eq('the poison compounds from its first in-window tick', g.enemy.poison, POISON_BASE + FERMENT_GROWTH);
  eq('and its duration is frozen from that tick', g.enemy.poisonTurns, POISON_TURNS);
}
{
  // Ferment is unplayable while the Plaguewright is down (the #44/#54 path), and
  // firing it opens a window even against a fresh enemy (no crash, no poison needed).
  const g = plaguewrightGame(8);
  g.mp = 10;
  const idx = giveCard(g, 'ferment');
  check('Ferment is playable with a living Plaguewright', g.canPlay(idx, null) === null);
  g._killMember(g.members[0]);
  check('Ferment is disabled once the Plaguewright is down', g.canPlay(idx, null) !== null);
}

// --- Provoke / Taunt-lite card (#31) ----------------------------------------
{
  // Provoke makes ANY member the enemy's aim (not just the Tank) with a light Defense.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['ranger', 'mage', 'graveAugur']); // taunt-less draft
  const g = new Game(1, cfg); g.start();
  g.mp = 10;
  const augur = g.members[2];
  g.playCard(giveCard(g, 'provoke'), 2);
  eq('Provoke grants Taunt to a non-Tank member', augur.taunt, TAUNT_LITE_TURNS);
  eq('Provoke bundles a light Defense', augur.defenseAmount, TAUNT_LITE_DEFENSE);
  eq('the provoked member holds the party Taunt', g.tauntingMember()?.slot, 2);
  // Future telegraphs aim at the provoked member (auto-aim via _pickPrimary).
  const tg = g._generateTelegraph(g.turn + 1);
  check('the enemy aims a single at the provoked member', tg.type !== 'single' || tg.targets.includes(2));
  // Provoke is a real, purchasable card in the pool.
  check('Provoke is in the shop pool', CARD_POOL.includes('provoke'));
}

// --- incapacitated members ('incapacitate' injury mode, 2026-07-04) ---------
{
  const cfg = defaultBattleConfig();
  cfg.party[0] = { ...cfg.party[0], incapacitated: true };
  const g = new Game(1, cfg); g.start();
  const m = g.members[0];
  check('an incapacitated member starts the fight dead', !m.alive && m.hp === 0);
  check('no death is recorded for a fight they never stood in', !m.diedThisFight);
  check('the incapacitated slot is excluded from scar recording', !g.diedThisFightSlots().includes(0));

  // Resurrect refuses them — only the run layer restores an incapacitated member.
  g.mp = 10;
  const idx = giveCard(g, 'resurrect');
  eq('Resurrect refuses an incapacitated member', g.canPlay(idx, 0), 'target is incapacitated');

  // A normally-dead member is still resurrectable in the same fight.
  g.members[2].alive = false; g.members[2].hp = 0;
  eq('a plain corpse is still a legal Resurrect target', g.canPlay(idx, 2), null);

  // The fight still runs with two members — no stall, and the wipe check counts
  // the incapacitated member as dead.
  g.members[2].alive = true; g.members[2].hp = 1;
  g.members[1].alive = false; g.members[2].alive = false;
  check('wipe check counts the incapacitated slot as dead', g._checkWipe());
}

// --- empty deploy slots (roster deployment of <3 members) -------------------
{
  // A solo deployment: the mage seated at CENTER, the other two slots empty.
  const emptySlot = () => ({ maxHP: 0, damage: 0, abilityPower: 0, injuries: 0, empty: true });
  const cfg = defaultBattleConfig();
  cfg.party = [emptySlot(), partyFromMembers(['mage'])[0], emptySlot()];
  const g = new Game(1, cfg); g.start();

  const left = g.members[0], mage = g.members[1], right = g.members[2];
  check('an empty slot builds an absent member', left.absent && right.absent);
  check('an absent member starts dead at 0 HP', !left.alive && left.hp === 0);
  check('the seated member is alive', mage.alive && mage.id === 'mage');
  eq('only the seated member is living', g.livingMembers().length, 1);
  check('the party is not wiped with one member standing', !g.allDead() && !g._checkWipe());

  // Targeting never lands on an empty slot: _pickPrimary reweights to living slots,
  // so every pick and every telegraph line aims at the seated member.
  let allPrimaryCenter = true;
  for (let i = 0; i < 20; i++) if (g._pickPrimary('single') !== SLOT.CENTER) allPrimaryCenter = false;
  check('the enemy never aims a single at an empty slot', allPrimaryCenter);
  check('every telegraph line targets a living member', g.attackTargets().every((s) => g.members[s.slot].alive));

  // An empty slot carries a trio-default id (slot 2 defaults to the mage's id), so
  // memberById must resolve to the REAL, non-absent member.
  eq('memberById skips the absent duplicate id', g.memberById('mage').slot, SLOT.CENTER);
  check('memberById returns a non-absent member', !g.memberById('mage').absent);

  // The fight runs to a conclusion with a single attacker — no stall/throw — and the
  // wipe only fires once the seated member falls (the empty slots never blocked it).
  let turns = 0;
  while (g.status === 'playing' && turns < 40) { g.endTurn(); turns++; }
  check('a solo deployment reaches a terminal state without stalling', g.status !== 'playing');
}
{
  // A two-member deployment: ranger + tank, right slot empty. Drives a few turns.
  const cfg = defaultBattleConfig();
  cfg.party = [partyFromMembers(['ranger'])[0], partyFromMembers(['tank'])[0],
    { maxHP: 0, damage: 0, abilityPower: 0, injuries: 0, empty: true }];
  const g = new Game(2, cfg); g.start();
  eq('two members deployed, one slot empty', g.livingMembers().length, 2);
  check('the empty right slot is absent', g.members[2].absent);
  let threw = false;
  try { for (let i = 0; i < 6 && g.status === 'playing'; i++) g.endTurn(); } catch { threw = true; }
  check('a two-member deployment runs without throwing', !threw);
}

// --- hero buff card batch (#62) ---------------------------------------------
{
  const empty = () => ({ maxHP: 0, damage: 0, abilityPower: 0, injuries: 0, empty: true });

  // All 7 are shop/reward-eligible; Double Strike is the rare of the set.
  const batch: CardId[] = ['guard', 'sharpen', 'goad', 'doubleStrike', 'embolden', 'empower', 'riposte'];
  check('all 7 hero-buff cards are shop/reward-eligible', batch.every((id) => CARD_POOL.includes(id)));
  eq('Double Strike is the rare of the set', CARD_RARITY.doubleStrike, 'rare');

  // Sharpen: +SHARPEN_BONUS to the hero's auto, feeding memberDamage(), then it
  // fades after SHARPEN_TURNS enemy turns.
  {
    const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10;
    const ranger = g.members[0];
    const base = g.memberDamage(ranger);
    g.playCard(giveCard(g, 'sharpen'), 0);
    eq('Sharpen raises the auto by its bonus', g.memberDamage(ranger), base + SHARPEN_BONUS);
    check('Sharpen buffs only the chosen hero', g.memberDamage(g.members[1]) === g.members[1].damage);
    for (let i = 0; i < SHARPEN_TURNS; i++) g._decayBuffs();
    eq('Sharpen fades after its turns', g.memberDamage(ranger), base);
  }

  // Embolden: +EMBOLDEN_BONUS to EVERY fielded hero, fading after EMBOLDEN_TURNS.
  {
    const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10;
    const bases = g.members.map((m) => g.memberDamage(m));
    g.playCard(giveCard(g, 'embolden'));
    check('Embolden buffs every fielded hero', g.members.every((m, i) => g.memberDamage(m) === bases[i] + EMBOLDEN_BONUS));
    for (let i = 0; i < EMBOLDEN_TURNS; i++) g._decayBuffs();
    check('Embolden fades after its turns', g.members.every((m, i) => g.memberDamage(m) === bases[i]));
  }

  // Guard: -GUARD_DR incoming per hit; stacks with Defense but NOT with itself; fades.
  {
    const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10;
    const tank = g.members[1];
    g.playCard(giveCard(g, 'guard'), 1);
    eq('Guard reduces incoming damage', g._effectiveDamage(tank, 5), 5 - GUARD_DR);
    // A second Guard refreshes the timer but does not add a second -1.
    g.mp = 10;
    g.playCard(giveCard(g, 'guard'), 1);
    eq('Guard does not stack with itself', g._effectiveDamage(tank, 5), 5 - GUARD_DR);
    // Stacks with a standing Defense (e.g. Bulwark / Taunt).
    tank.defense = 2; tank.defenseAmount = DEFENSE_AMOUNT;
    eq('Guard stacks with Defense', g._effectiveDamage(tank, 5), 5 - GUARD_DR - DEFENSE_AMOUNT);
    tank.defense = 0; tank.defenseAmount = 0;
    // Telegraph preview equals applied damage through the Guard reduction.
    g.telegraph = { type: 'single', hidden: false, damage: 5, targets: [1], enraged: false, forTurn: g.turn };
    const preview = g.attackTargets().find((s) => s.slot === 1)?.damage;
    const hpBefore = tank.hp; g._resolveAttack();
    eq('Guard: telegraph preview equals applied damage', hpBefore - tank.hp, preview);
    for (let i = 0; i < GUARD_TURNS; i++) g._decayBuffs();
    eq('Guard fades after its turns', g._effectiveDamage(tank, 5), 5);
  }

  // Goad: the SAME Taunt(+Defense) the Tank's ability grants, from a card on any hero.
  {
    const cfg = defaultBattleConfig();
    cfg.party = partyFromMembers(['ranger', 'mage', 'graveAugur']); // taunt-less draft
    const g = new Game(1, cfg); g.start(); g.mp = 10;
    const augur = g.members[2];
    g.playCard(giveCard(g, 'goad'), 2);
    eq('Goad grants the full Taunt duration', augur.taunt, TAUNT_TURNS);
    eq('Goad bundles the Tank ability\'s Defense', augur.defense, DEFENSE_TURNS);
    eq('Goad bundles Defense strength', augur.defenseAmount, DEFENSE_AMOUNT);
    check('the goaded member holds the party Taunt', g.tauntingMember()?.slot === 2);
    const tg = g._generateTelegraph(g.turn + 1);
    check('the enemy aims a single at the goaded member', tg.type !== 'single' || tg.targets.includes(2));
  }

  // Double Strike: doubles exactly the next basic auto, consumed on use.
  {
    const cfg = defaultBattleConfig();
    cfg.party = [partyFromMembers(['mage'])[0], empty(), empty()]; // solo mage isolates the auto
    const g = new Game(3, cfg); g.start(); g.mp = 10; g.enemy.hp = 999;
    const mage = g.members[0];
    const dmg = g.memberDamage(mage);
    g.playCard(giveCard(g, 'doubleStrike'), 0);
    check('Double Strike primes the hero', mage.drumPrimed);
    const before = g.enemy.hp; g._runPartyPhase();
    eq('Double Strike doubles the next auto', before - g.enemy.hp, dmg * 2);
    check('the doubled beat is spent', !mage.drumPrimed);
    const before2 = g.enemy.hp; g._runPartyPhase();
    eq('the following auto is back to normal', before2 - g.enemy.hp, dmg);
  }

  // Empower: +EMPOWER_BONUS ability power on the next ability, consumed once, and the
  // hero's persistent ability power is unchanged after.
  {
    const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10;
    const ranger = g.members[0];
    g.playCard(giveCard(g, 'empower'), 0);
    eq('Empower is pending on the hero', ranger.empowerBonus, EMPOWER_BONUS);
    g._fireAbility(ranger);
    eq('Empower bumps the next ability once', g.enemy.poison, POISON_BASE + EMPOWER_BONUS);
    eq('Empower is consumed', ranger.empowerBonus, 0);
    eq('the hero\'s base ability power is unchanged', ranger.abilityPower, 0);
    g.enemy.poison = 0; g.enemy.poisonTurns = 0;
    g._fireAbility(ranger);
    eq('the following ability is back to base strength', g.enemy.poison, POISON_BASE);
  }

  // Riposte: counters exactly once, on the next hit that connects, scaling with Vulnerability.
  {
    const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
    const tank = g.members[1];
    g.playCard(giveCard(g, 'riposte'), 1);
    check('Riposte is armed', tank.riposte);
    g.telegraph = { type: 'single', hidden: false, damage: 3, targets: [1], enraged: false, forTurn: g.turn };
    const before = g.enemy.hp; g._resolveAttack();
    eq('Riposte counters for the hero\'s damage', before - g.enemy.hp, g.memberDamage(tank));
    check('Riposte is consumed', !tank.riposte);
    g.telegraph = { type: 'single', hidden: false, damage: 3, targets: [1], enraged: false, forTurn: g.turn };
    const before2 = g.enemy.hp; g._resolveAttack();
    eq('Riposte does not fire a second time', before2 - g.enemy.hp, 0);
  }
  {
    // The counter respects Vulnerability like every other party source.
    const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
    const tank = g.members[1];
    g.enemy.vulnerable = 1.0; g.enemy.vulnerableTurns = 3; // +100% party damage
    g.playCard(giveCard(g, 'riposte'), 1);
    g.telegraph = { type: 'single', hidden: false, damage: 3, targets: [1], enraged: false, forTurn: g.turn };
    const before = g.enemy.hp; g._resolveAttack();
    eq('Riposte scales with Vulnerability', before - g.enemy.hp, g.vulnerableAmount(g.memberDamage(tank)));
  }
}

// --- Card types (#63): taxonomy ---------------------------------------------
{
  const ALL = Object.keys(CARDS) as CardId[];
  check('every card carries a type', ALL.every((id) => CARD_TYPE[id] != null && CARDS[id].type === CARD_TYPE[id]));
  const has = (type: CardType, id: CardId): boolean => CARDS_BY_TYPE[type].includes(id);
  check('Holy holds the heal core',
    (['lowHeal', 'highHeal', 'aoeHeal', 'resurrect', 'cleanse', 'focus'] as CardId[]).every((id) => has('holy', id)));
  check('Nature holds the regen family + buffs',
    (['regen', 'overgrowth', 'cultivate', 'bloom', 'lifebloom', 'battleHymn', 'rally', 'imbuePoison', 'beckon'] as CardId[]).every((id) => has('nature', id)));
  check('Shadow holds debuffs/damage + the new cards',
    (['unleash', 'hex', 'hush', 'shadowBolt', 'siphonLife', 'doom'] as CardId[]).every((id) => has('shadow', id)));
  check('Blood holds the sacrifice cards',
    (['bloodTithe', 'martyrsGift', 'grimHarvest', 'incite'] as CardId[]).every((id) => has('blood', id)));
  check('Arcane holds the economy cards',
    (['refresh', 'fontOfMana', 'inspiration', 'surge', 'channel', 'conduct'] as CardId[]).every((id) => has('arcane', id)));
  check('Iron holds the protection cards',
    (['shield', 'barrier', 'phalanx', 'brace', 'provoke', 'holdTheLine', 'bolster'] as CardId[]).every((id) => has('iron', id)));
  // The six buckets partition every card (each card in exactly one type).
  const total = (['holy', 'nature', 'shadow', 'blood', 'arcane', 'iron'] as CardType[])
    .reduce((s, t) => s + CARDS_BY_TYPE[t].length, 0);
  eq('types partition every card', total, ALL.length);
  // Ability cards' type counts for synergies (the Warlock's Hex reads as Shadow).
  eq('cardType(hex) is shadow', cardType('hex'), 'shadow');
  eq('cardsOfType(shadow) includes Shadow Bolt', cardsOfType('shadow').includes('shadowBolt'), true);
}

// --- Shadow cards (#63, Part A′) ---------------------------------------------
{
  // Shadow Bolt: deals its damage and leaves the enemy telegraph untouched.
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
  const before = g.enemy.hp;
  const tgBefore = JSON.stringify(g.attackTargets());
  g.playCard(giveCard(g, 'shadowBolt'));
  eq('Shadow Bolt deals its damage', before - g.enemy.hp, SHADOW_BOLT_DMG);
  eq('Shadow Bolt does not perturb the telegraph', JSON.stringify(g.attackTargets()), tgBefore);
}
{
  // Shadow Bolt obeys Vulnerability (routes through _damageEnemy).
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
  g.enemy.vulnerable = 1.0; g.enemy.vulnerableTurns = 3; // +100% party damage
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'shadowBolt'));
  eq('Shadow Bolt scales with Vulnerability', before - g.enemy.hp, g.vulnerableAmount(SHADOW_BOLT_DMG));
}
{
  // Siphon Life: damages the enemy AND heals its target by the designed split.
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
  const m = g.members[SLOT.CENTER];
  m.hp = 1; // room to heal
  const tgBefore = JSON.stringify(g.attackTargets());
  const eBefore = g.enemy.hp;
  g.playCard(giveCard(g, 'siphonLife'), SLOT.CENTER);
  eq('Siphon Life damages the enemy', eBefore - g.enemy.hp, SIPHON_LIFE_DMG);
  eq('Siphon Life heals its target', m.hp, 1 + SIPHON_LIFE_HEAL);
  eq('Siphon Life does not perturb the telegraph', JSON.stringify(g.attackTargets()), tgBefore);
}
{
  // Doom: its computed damage rises with enemy debuffs/Vulnerability and caps.
  const g = new Game(1, defaultBattleConfig()); g.start();
  eq('Doom base with no debuffs', g._doomDamage(), DOOM_BASE);
  g.enemy.vulnerable = 0.5; g.enemy.vulnerableTurns = 3;
  eq('Doom adds per-debuff + vuln scaling', g._doomDamage(), DOOM_BASE + DOOM_PER_DEBUFF + Math.floor(0.5 * DOOM_PER_VULN));
  g.enemy.poison = 5; g.enemy.poisonTurns = 5;
  eq('Doom counts a second active debuff', g._doomDamage(), DOOM_BASE + 2 * DOOM_PER_DEBUFF + Math.floor(0.5 * DOOM_PER_VULN));
  g.enemy.vulnerable = 10; // saturate the vuln scaling
  eq('Doom caps its base roll', g._doomDamage(), DOOM_CAP);
}
{
  // Doom applies its computed damage through the Vulnerability pipeline, telegraph intact.
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 9999;
  g.enemy.vulnerable = 1.0; g.enemy.vulnerableTurns = 3;
  const expected = g.vulnerableAmount(g._doomDamage());
  const tgBefore = JSON.stringify(g.attackTargets());
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'doom'));
  eq('Doom applies its computed damage', before - g.enemy.hp, expected);
  eq('Doom does not perturb the telegraph', JSON.stringify(g.attackTargets()), tgBefore);
}

// --- Per-type counters (#63) ------------------------------------------------
{
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
  g.playCard(giveCard(g, 'shadowBolt'));         // Shadow
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // Holy
  eq('shadow per-turn counter increments', g.typePlayedThisTurn.shadow, 1);
  eq('holy per-turn counter increments', g.typePlayedThisTurn.holy, 1);
  eq('no bleed into an unplayed type', g.typePlayedThisTurn.iron, 0);
  eq('per-fight counter mirrors the play', g.typePlayedThisFight.shadow, 1);
  g.endTurn(); // resolve the enemy phase and start a fresh player phase
  eq('per-turn counter resets next turn', g.typePlayedThisTurn.shadow, 0);
  check('per-fight counter persists across the turn', g.typePlayedThisFight.shadow === 1);
  // Per-fight counters do not bleed across fights: a fresh Game (a new fight) is zero.
  eq('a fresh fight starts at zero', new Game(2, defaultBattleConfig()).typePlayedThisFight.shadow, 0);
}

// --- Card-type synergy relics (#63) -----------------------------------------
{
  // Reliquary of Light: Holy cards heal +1; off = base; non-Holy heals untouched.
  const cfg = defaultBattleConfig(); cfg.relics = ['reliquaryOfLight'];
  const g = new Game(1, cfg); g.start(); g.mp = 10;
  const m = g.members[SLOT.CENTER]; m.hp = 1;
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('Reliquary of Light: Holy heal +1', m.hp - 1, (CARDS.lowHeal.heal ?? 0) + HOLY_RELIC_HEAL);
  const g2 = new Game(1, defaultBattleConfig()); g2.start(); g2.mp = 10;
  const m2 = g2.members[SLOT.CENTER]; m2.hp = 1;
  g2.playCard(giveCard(g2, 'lowHeal'), SLOT.CENTER);
  eq('without the relic: base heal', m2.hp - 1, CARDS.lowHeal.heal ?? 0);
}
{
  // Shadow Sigil: +1 to the enemy after a Shadow card; telegraph intact; Holy ignored.
  const cfg = defaultBattleConfig(); cfg.relics = ['shadowSigil'];
  const g = new Game(1, cfg); g.start(); g.mp = 10; g.enemy.hp = 999;
  const tgBefore = JSON.stringify(g.attackTargets());
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'shadowBolt'));
  eq('Shadow Sigil: +1 after a Shadow card', before - g.enemy.hp, SHADOW_BOLT_DMG + SHADOW_RELIC_DMG);
  eq('Shadow Sigil keeps telegraph == applied', JSON.stringify(g.attackTargets()), tgBefore);
  const before2 = g.enemy.hp;
  g.members[SLOT.CENTER].hp = 1;
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('Shadow Sigil ignores non-Shadow cards', before2 - g.enemy.hp, 0);
}
{
  // Iron Ward: the FIRST Iron card each turn costs 1 less; later Iron cards pay full;
  // resets next turn.
  const cfg = defaultBattleConfig(); cfg.relics = ['ironWard'];
  const g = new Game(1, cfg); g.start(); g.mp = 10;
  const i1 = giveCard(g, 'shield'); // Iron, cost 3
  eq('Iron Ward: first Iron card cheaper', g.effectiveCost(resolveCard(g.hand[i1])), CARDS.shield.cost - IRON_RELIC_DISCOUNT);
  g.playCard(i1, SLOT.CENTER);
  const i2 = giveCard(g, 'brace'); // second Iron card this turn -> full price
  eq('Iron Ward: later Iron cards pay full', g.effectiveCost(resolveCard(g.hand[i2])), CARDS.brace.cost);
  g.endTurn();
  const i3 = giveCard(g, 'shield');
  eq('Iron Ward resets each turn', g.effectiveCost(resolveCard(g.hand[i3])), CARDS.shield.cost - IRON_RELIC_DISCOUNT);
  // A non-Iron card is never discounted by the Ward.
  const i4 = giveCard(g, 'lowHeal');
  eq('Iron Ward ignores non-Iron cards', g.effectiveCost(resolveCard(g.hand[i4])), CARDS.lowHeal.cost);
}

// --- Count-based payoff cards (#63, Part B) ----------------------------------
{
  // Cascade (Arcane): draws its cards, and costs 1 less per Arcane card already
  // played this turn (floor 0).
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
  const i0 = giveCard(g, 'cascade');
  eq('Cascade full cost with no prior Arcane play', g.effectiveCost(resolveCard(g.hand[i0])), CARDS.cascade.cost);
  g.playCard(giveCard(g, 'channel')); // Arcane
  g.playCard(giveCard(g, 'refresh')); // Arcane
  const i1 = giveCard(g, 'cascade');
  eq('Cascade discounts per Arcane card this turn',
    g.effectiveCost(resolveCard(g.hand[i1])),
    Math.max(0, CARDS.cascade.cost - CASCADE_DISCOUNT_PER_ARCANE * 2));
}
{
  // Cascade actually draws CASCADE_DRAW cards.
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10;
  const handBefore = g.hand.length;
  g.playCard(giveCard(g, 'cascade'));
  eq('Cascade draws its cards', g.hand.length, handBefore + CASCADE_DRAW);
}
{
  // Nightfall (Shadow): base with no prior Shadow plays; scales with Shadow cards
  // played this fight; caps; leaves the enemy telegraph untouched.
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 20; g.enemy.hp = 999;
  const tgBefore = JSON.stringify(g.attackTargets());
  const b0 = g.enemy.hp; g.playCard(giveCard(g, 'nightfall'));
  eq('Nightfall base with no prior Shadow plays', b0 - g.enemy.hp, NIGHTFALL_BASE);
  eq('Nightfall keeps telegraph == applied', JSON.stringify(g.attackTargets()), tgBefore);
  // Now 3 Shadow cards have been played this fight (the first Nightfall + 2 bolts).
  g.playCard(giveCard(g, 'shadowBolt'));
  g.playCard(giveCard(g, 'shadowBolt'));
  const b1 = g.enemy.hp; g.playCard(giveCard(g, 'nightfall'));
  eq('Nightfall scales with Shadow cards played this fight',
    b1 - g.enemy.hp, Math.min(NIGHTFALL_CAP, NIGHTFALL_BASE + NIGHTFALL_PER_SHADOW * 3));
}
{
  // Nightfall caps its damage.
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
  g.typePlayedThisFight.shadow = 100; // saturate the scaling
  const before = g.enemy.hp; g.playCard(giveCard(g, 'nightfall'));
  eq('Nightfall caps its damage', before - g.enemy.hp, NIGHTFALL_CAP);
}

// --- channeled cards (#64) -------------------------------------------------
// A benign fight so channels can run for their full length: sturdy party, a huge
// enemy that won't die to autos, no enrage, and roomy MP.
function channelGame(seed: number): Game {
  const g = new Game(seed, defaultBattleConfig()); g.start();
  g.members.forEach((m) => { m.maxHP = 100; m.hp = 100; m.alive = true; m.shield = false; m.shieldTurns = 0; });
  g.enemy.maxHP = 100000; g.enemy.hp = 100000;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  g.maxMana = 30; g.mp = 30; g.passiveMp = 0; g.enrageTurn = 9999;
  return g;
}
function countPulses(g: Game): number {
  return g.events.filter((e) => e.kind === 'channelPulse').length;
}

{
  // A channel ticks each turn while nothing else is played, and ends exactly at
  // maxTurns (first tick lands on the cast turn).
  const g = channelGame(200);
  const hp0 = g.enemy.hp;
  g.playCard(giveCard(g, 'drain'), null);
  check('Drain starts a channel', g.channelActive() && g.channelCard === 'drain');
  eq('Drain first tick lands on the cast turn (damage)', hp0 - g.enemy.hp, DRAIN_DMG);
  eq('Drain ticks remaining after the cast tick', g.channelTurns, DRAIN_MAX_TURNS - 1);
  let pulses = countPulses(g); // the immediate first tick
  for (let i = 0; i < DRAIN_MAX_TURNS + 3 && g.channelActive(); i++) {
    g.endTurn();               // hold — play no card, so it ticks at the enemy phase
    pulses += countPulses(g);
  }
  eq('Drain channels exactly maxTurns ticks', pulses, DRAIN_MAX_TURNS);
  check('Drain channel ends on its own at the cap', !g.channelActive());
}

{
  // Drain damages each tick and obeys Vulnerability (routes through _damageEnemy).
  const g = channelGame(201);
  g.enemy.vulnerable = 0.5; g.enemy.vulnerableTurns = 9;
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'drain'), null);
  eq('Drain tick obeys Vulnerability', before - g.enemy.hp, DRAIN_DMG + Math.floor(DRAIN_DMG * 0.5));
}

{
  // Drain's per-tick MP return is 1-2, only when there is room, and is the ONLY MP a
  // channeling player gets (passive income is suppressed).
  const g = channelGame(202);
  g.passiveMp = 2;
  g.mp = CARDS.drain.cost; // exactly the cost, so we see just the return
  g.playCard(giveCard(g, 'drain'), null);
  check('Drain returns 1-2 MP on a damaging tick', g.mp >= DRAIN_MP_MIN && g.mp <= DRAIN_MP_MAX);
  g.endTurn(); // close the cast turn (a card was played, so it does not tick)
  // Hold with 0 MP: the only income is Drain's return (no passive while channeling).
  g.mp = 0;
  g.endTurn();
  check('Only Drain\'s return funds a channeling turn (no passive)', g.mp >= DRAIN_MP_MIN && g.mp <= DRAIN_MP_MAX);
  // At full MP the tick still damages but returns nothing (no room).
  g.mp = g.maxMana;
  const hp0 = g.enemy.hp;
  g.endTurn();
  eq('Drain returns no MP when MP is full', g.mp, g.maxMana);
  check('Drain still damages the enemy at full MP', g.enemy.hp < hp0);
}

{
  // Passive/over-time MP income is suppressed while a channel runs; the reworked
  // Refresh restores its own MP per tick, up to its cap.
  const g = channelGame(203);
  g.passiveMp = 2; g.restRegen = 5;
  g.mp = CARDS.refresh.cost;
  g.playCard(giveCard(g, 'refresh'), null);
  check('Refresh starts a channel', g.channelActive() && g.channelCard === 'refresh');
  eq('Rest MP is suppressed while channeling', g.restRegenNow(), 0);
  g.endTurn(); // close the cast turn (a card was played, so it does not tick)
  g.mp = 0;
  g.endTurn(); // hold — channel ticks +REFRESH_CHANNEL_MP, no passive, no rest
  eq('Only the channel\'s own MP is granted while channeling', g.mp, REFRESH_CHANNEL_MP);
}

{
  // Reworked Refresh restores MP each tick and cancels the instant another card is played.
  const g = channelGame(204);
  g.mp = 20;
  g.playCard(giveCard(g, 'refresh'), null);
  const mpAfterCast = g.mp;
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // any card ends the channel
  check('Refresh channel cancels on a card play', !g.channelActive() && g.channelCard === null);
  eq('Cancelling Refresh grants no extra MP that play', g.mp, mpAfterCast - CARDS.lowHeal.cost);
}

{
  // Playing any card mid-channel cancels it and it does NOT tick that turn.
  const g = channelGame(205);
  g.playCard(giveCard(g, 'drain'), null);
  g.endTurn(); // cast-turn end: no tick (a card was played this phase)
  check('channel survives the cast-turn end', g.channelActive());
  g.events = [];
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // cancels — no tick
  eq('a card play emits no channel tick', countPulses(g), 0);
  check('a card play emits a channelCancel', g.events.some((e) => e.kind === 'channelCancel'));
  g.endTurn();
  eq('no channel tick on the enemy phase after a cancel', countPulses(g), 0);
  check('channel is gone after the cancel', !g.channelActive());
}

{
  // Starting a second channel cancels the first.
  const g = channelGame(206);
  g.playCard(giveCard(g, 'drain'), null);
  check('Drain active', g.channelCard === 'drain');
  g.events = [];
  g.playCard(giveCard(g, 'sap'), null);
  check('the new channel replaced the old', g.channelCard === 'sap' && g.channelActive());
  check('the old channel emitted a cancel', g.events.some((e) => e.kind === 'channelCancel'));
  check('the new channel emitted a start', g.events.some((e) => e.kind === 'channelStart'));
}

{
  // Mending Stream heals its remembered target each tick and ends if that member dies.
  const g = channelGame(207);
  const m = g.members[SLOT.LEFT];
  m.hp = 1;
  g.playCard(giveCard(g, 'mendingStream'), m.slot);
  check('Mending Stream remembers its target', g.channelActive() && g.channelTarget === m.slot);
  eq('Mending Stream heals on the cast tick', m.hp, 1 + MENDING_STREAM_HEAL);
  g.endTurn(); // close the cast turn (a card was played, so it does not tick)
  g._killMember(m);
  g.endTurn(); // hold — the tick sees the dead target and ends the channel
  check('Mending Stream ends when its target dies', !g.channelActive());
}

{
  // Fortify grants a Shield each tick (verified via the immediate cast tick and a
  // held turn whose enemy blow is aimed elsewhere so the fresh Shield survives).
  const g = channelGame(208);
  const m = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'fortify'), m.slot);
  check('Fortify shields the target on the cast tick', m.shield === true);
  g.endTurn(); // close the cast turn (a card was played, so it does not tick)
  m.shield = false; m.shieldTurns = 0; // consume the Shield
  // Aim the standing blow at RIGHT so the re-shield on LEFT is not spent this turn.
  g.telegraph = { type: 'single', hidden: false, damage: 1, targets: [SLOT.RIGHT], enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
  g.endTurn(); // hold — Fortify re-shields LEFT before the blow lands on RIGHT
  check('Fortify re-shields the target on a held tick', g.members[SLOT.LEFT].shield === true);
}

{
  // Sap stacks Vulnerability up to its cap.
  const g = channelGame(209);
  g.playCard(giveCard(g, 'sap'), null);
  eq('Sap adds Vulnerability on the cast tick', g.enemy.vulnerable, SAP_VULN_PER_TICK);
  for (let i = 0; i < SAP_MAX_TURNS + 2 && g.channelActive(); i++) g.endTurn();
  check('Sap never exceeds its Vulnerability cap', g.enemy.vulnerable <= SAP_VULN_CAP + 1e-9);
  eq('Sap stacks to its cap over the channel', g.enemy.vulnerable,
    Math.min(SAP_VULN_CAP, SAP_MAX_TURNS * SAP_VULN_PER_TICK));
}

{
  // Sap -> Doom (#63): Sap's stacked Vulnerability raises Doom's damage.
  const V = SAP_VULN_PER_TICK; // one Sap tick
  const doomPre = Math.min(DOOM_CAP, DOOM_BASE + DOOM_PER_DEBUFF * 1 + Math.floor(V * DOOM_PER_VULN));
  const doomWithSap = doomPre + Math.floor(doomPre * V); // _damageEnemy Vulnerability multiplier
  const g = channelGame(210);
  g.playCard(giveCard(g, 'sap'), null); // vulnerable = V, vulnerableTurns > 0
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'doom'), null); // cancels Sap, then reads the Vulnerability
  eq('Doom damage rises with Sap\'s Vulnerability', before - g.enemy.hp, doomWithSap);
  // Baseline: Doom with no debuff on the enemy.
  const g2 = channelGame(211);
  const b2 = g2.enemy.hp;
  g2.playCard(giveCard(g2, 'doom'), null);
  eq('Doom base with no debuffs', b2 - g2.enemy.hp, DOOM_BASE);
  check('Sap made Doom hit harder', doomWithSap > DOOM_BASE);
}

{
  // No channeled damage/debuff card changes the enemy's telegraph preview
  // (attackTargets == applied): Drain and Sap only touch party->enemy state.
  const g = channelGame(212);
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
  const preview = JSON.stringify(g.attackTargets());
  g.playCard(giveCard(g, 'sap'), null);
  eq('Sap does not change the telegraph preview', JSON.stringify(g.attackTargets()), preview);
  g.playCard(giveCard(g, 'drain'), null); // cancels Sap
  eq('Drain does not change the telegraph preview', JSON.stringify(g.attackTargets()), preview);
}

// Definitions / typing sanity for the five channeled cards (#64).
{
  eq('Drain is Shadow', cardType('drain'), 'shadow');
  eq('Sap is Shadow', cardType('sap'), 'shadow');
  eq('Mending Stream is Holy', cardType('mendingStream'), 'holy');
  eq('Fortify is Iron', cardType('fortify'), 'iron');
  eq('Refresh is Arcane', cardType('refresh'), 'arcane');
  check('Mending Stream / Fortify are single-target channels',
    CARDS.mendingStream.channel?.single === true && CARDS.fortify.channel?.single === true);
  check('Drain / Sap / Refresh are no-target channels',
    !CARDS.drain.channel?.single && !CARDS.sap.channel?.single && !CARDS.refresh.channel?.single);
  eq('Drain caps at DRAIN_MAX_TURNS', CARDS.drain.channel?.maxTurns, DRAIN_MAX_TURNS);
  eq('Fortify caps at FORTIFY_MAX_TURNS', CARDS.fortify.channel?.maxTurns, FORTIFY_MAX_TURNS);
  eq('Mending Stream caps at MENDING_STREAM_MAX_TURNS', CARDS.mendingStream.channel?.maxTurns, MENDING_STREAM_MAX_TURNS);
  // Font of Mana stays the buff-style MP engine (not a channel).
  check('Font of Mana is not a channel', CARDS.fontOfMana.channel == null);
}

// --- channel archetype rescue + arcane support (#70) ------------------------
{
  // Attunement (no relic): playing it does NOT break a running channel, and neither
  // does playing the card it DREW; a different card still breaks it.
  const g = channelGame(300);
  g.playCard(giveCard(g, 'drain'), null);
  check('Drain channel is running', g.channelActive() && g.channelCard === 'drain');
  // Attunement draws a known seeded card so we can play the exact instance next.
  g.drawPile = [makeDeckCard('lowHeal', 900)];
  const ai = giveCard(g, 'attunement');
  const handBefore = g.hand.length; // includes the Attunement about to be played
  g.playCard(ai, null);
  check('channel survives Attunement', g.channelActive() && g.channelCard === 'drain');
  eq('Attunement is net-neutral on hand size (play -1, draw +1)', g.hand.length, handBefore);
  const drawnIdx = g.hand.findIndex((c) => c.uid === 900);
  check('Attunement drew the seeded card', drawnIdx >= 0);
  g.playCard(drawnIdx, SLOT.CENTER); // the drawn card's uid is channel-exempt
  check('channel survives the card Attunement drew', g.channelActive());
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // a different, unstamped card
  check('a different card still breaks the channel', !g.channelActive());
}
{
  // The Attunement-stamped exemption persists for the fight and rides the card
  // INSTANCE (by uid) to a LATER turn — it is not a "this turn only" flag.
  const g = channelGame(307);
  g.playCard(giveCard(g, 'drain'), null);
  g.drawPile = [makeDeckCard('lowHeal', 902)];
  g.playCard(giveCard(g, 'attunement'), null); // draws + stamps uid 902
  check('channel running after Attunement', g.channelActive());
  g.endTurn(); // the hand discards, but the uid-902 stamp persists for the fight
  check('channel survives into the next turn', g.channelActive());
  check('the stamp persists across the turn', g.channelExemptUids.has(902));
  // Play a card carrying the stamped uid a turn later — still channel-exempt.
  g.hand.push(makeDeckCard('lowHeal', 902));
  g.playCard(g.hand.length - 1, SLOT.CENTER);
  check('the stamped card is exempt on a later turn', g.channelActive());
}
{
  // Chanter's Idol: the FIRST card of each turn does not break a running channel; a
  // SECOND card does. Inert with no relic (covered by the plain-cancel tests above).
  const g = channelGame(301);
  g.relics.add('chantersIdol');
  g.playCard(giveCard(g, 'drain'), null);
  g.endTurn();
  check('Idol: channel running into turn 2', g.channelActive());
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // turn 2, first card -> Idol keeps it
  check('Idol: the first card of turn 2 keeps the channel', g.channelActive());
  g.endTurn();
  check('Idol: channel running into turn 3', g.channelActive());
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // turn 3, first card -> Idol keeps it
  check('Idol: the first card of turn 3 keeps the channel', g.channelActive());
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // turn 3, second card -> breaks
  check('Idol: the second card of a turn breaks the channel', !g.channelActive());
}
{
  // Composability (Idol + Attunement-first): two plays in one turn keep the channel,
  // the third breaks it.
  const g = channelGame(302);
  g.relics.add('chantersIdol');
  g.playCard(giveCard(g, 'drain'), null);
  g.endTurn();
  check('channel running into the composability turn', g.channelActive());
  g.drawPile = [makeDeckCard('lowHeal', 901)];
  g.playCard(giveCard(g, 'attunement'), null); // first play (Idol + self-stamp)
  check('Idol+Attunement: channel survives the first play', g.channelActive());
  const idx = g.hand.findIndex((c) => c.uid === 901);
  g.playCard(idx, SLOT.CENTER); // second play (Attunement-stamped)
  check('Idol+Attunement: channel survives the second play', g.channelActive());
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // third play
  check('Idol+Attunement: the third play breaks the channel', !g.channelActive());
}
{
  // An exempt play does not tick the channel (no extra tick) and does not re-enable
  // Rest / passive MP: the channel is still running, so both stay suppressed.
  const g = channelGame(303);
  g.relics.add('chantersIdol');
  g.restRegen = 5; g.passiveMp = 3;
  g.playCard(giveCard(g, 'drain'), null); // cast tick
  g.endTurn();
  const turnsBefore = g.channelTurns;
  g.events = [];
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // Idol-exempt first card
  check('exempt play keeps the channel alive', g.channelActive());
  eq('exempt play emits no channel tick', g.events.filter((e) => e.kind === 'channelPulse').length, 0);
  eq('exempt play consumes no channel turn', g.channelTurns, turnsBefore);
  eq('Rest stays suppressed after an exempt play (channel still running)', g.restRegenNow(), 0);
}
{
  // Arcane Lens: the next single-target heal ALSO heals the most wounded other member
  // for the full amount, then the flag is spent.
  const g = channelGame(304);
  const c = g.members[SLOT.CENTER], l = g.members[SLOT.LEFT], r = g.members[SLOT.RIGHT];
  c.hp = c.maxHP - 4; l.hp = l.maxHP; r.hp = r.maxHP - 20; // RIGHT is the most wounded OTHER
  const heal = CARDS.highHeal.heal ?? 0; // 4
  g.playCard(giveCard(g, 'arcaneLens'), null);
  check('Arcane Lens arms the turn flag', g.lensArmed);
  const rBefore = r.hp;
  g.playCard(giveCard(g, 'highHeal'), SLOT.CENTER); // heals CENTER, refracts full to RIGHT
  eq('Lens: the primary heal still tops off the target', c.hp, c.maxHP);
  eq('Lens: the full heal also refracts to the most wounded other', r.hp - rBefore, heal);
  eq('Lens: an untargeted healthy member is untouched', l.hp, l.maxHP);
  check('Lens: the flag is spent by the heal', !g.lensArmed);
}
{
  // A non-heal single-target card does NOT consume the Lens; an unconsumed flag
  // expires at end of turn.
  const g = channelGame(305);
  g.playCard(giveCard(g, 'arcaneLens'), null);
  check('Lens armed', g.lensArmed);
  g.playCard(giveCard(g, 'shield'), SLOT.CENTER); // single-target, non-heal
  check('a non-heal single-target card does not consume the Lens', g.lensArmed);
  g.endTurn();
  check('an unconsumed Lens flag expires at end of turn', !g.lensArmed);
}
{
  // Definitions / typing sanity for the two new cards + the relic (#70).
  eq('Attunement is Arcane', cardType('attunement'), 'arcane');
  eq('Arcane Lens is Arcane', cardType('arcaneLens'), 'arcane');
  check('Attunement is engine-tagged (Retain/Efficient-ineligible)', CARDS.attunement.engine === true && isEngineCard('attunement'));
  eq('Attunement is uncommon', CARD_RARITY.attunement, 'uncommon');
  eq('Arcane Lens is rare', CARD_RARITY.arcaneLens, 'rare');
  eq("Chanter's Idol is a rare relic", RELICS.chantersIdol.rarity, 'rare');
  check('the new cards are shoppable (in CARD_POOL)',
    CARD_POOL.includes('attunement') && CARD_POOL.includes('arcaneLens'));
}

// --- Iron mitigation web (#65) ---------------------------------------------
{
  // Feint redirects EVERY hit of a multi-hit telegraph onto one member; the
  // preview predicts exactly that before resolution (preview == applied).
  const g = new Game(650); g.start();
  const tank = g.tank; tank.hp = tank.maxHP;
  // A two-target blow aimed at the EDGES (not the tank).
  g.telegraph = { type: 'two', hidden: false, damage: 3, targets: [SLOT.LEFT, SLOT.RIGHT], enraged: false, forTurn: 2 };
  g.playCard(giveCard(g, 'feint'), SLOT.CENTER); // steer it all onto the tank
  const preview = g.attackTargets();
  eq('Feint: both hits previewed', preview.length, 2);
  check('Feint: every previewed hit lands on the tank', preview.every((s) => s.slot === SLOT.CENTER));
  const before = tank.hp;
  g._resolveAttack();
  eq('Feint: applied == both hits stacked on the tank', before - tank.hp, 3 + 3);
}
{
  // Feint is inert against a Piercing-Bolt-style ignoreTaunt hit (boss tech stays
  // un-steerable) — the target set is unchanged.
  const g = new Game(651); g.start();
  g.telegraph = { type: 'single', hidden: false, damage: 5, targets: [SLOT.LEFT], enraged: false, forTurn: 2, ignoreTaunt: true, targetLowest: true };
  g.playCard(giveCard(g, 'feint'), SLOT.CENTER);
  eq('Feint: an ignoreTaunt hit is not steered', g.telegraph?.targets[0], SLOT.LEFT);
}
{
  // Anvil Stance: the +bonus is condition-gated on a live Shield/Brace hold — it
  // toggles as the hold is gained, lost, and regained (via a Fortify tick).
  const g = new Game(652); g.start();
  const tank = g.tank; tank.hp = tank.maxHP;
  const base = g.memberDamage(tank);
  g.playCard(giveCard(g, 'anvilStance'), SLOT.CENTER);
  eq('Anvil Stance: no bonus without a hold', g.memberDamage(tank), base);
  g.playCard(giveCard(g, 'shield'), SLOT.CENTER);
  eq('Anvil Stance: +bonus while holding a Shield', g.memberDamage(tank), base + ANVIL_STANCE_BONUS);
  tank.shield = false; tank.shieldTurns = 0; // lose the hold
  eq('Anvil Stance: bonus drops with the hold', g.memberDamage(tank), base);
  g.playCard(giveCard(g, 'fortify'), SLOT.CENTER); // channel: first tick re-grants a Shield
  check('Anvil Stance: Fortify re-grants a Shield', tank.shield);
  eq('Anvil Stance: bonus restored when the hold returns', g.memberDamage(tank), base + ANVIL_STANCE_BONUS);
  // Brace also satisfies the condition.
  tank.shield = false; tank.shieldTurns = 0;
  tank.brace = true; tank.braceAmount = BRACE_AMOUNT; tank.braceTurns = BRACE_TURNS;
  eq('Anvil Stance: a Brace hold also grants the bonus', g.memberDamage(tank), base + ANVIL_STANCE_BONUS);
}
{
  // Interlock: Guard 1 on every living member, stacking freely (two casts -> -2 per
  // hit), additive with Defense, and the grants expire on independent timers.
  const g = new Game(653); g.start();
  const tank = g.tank; tank.hp = tank.maxHP;
  g.playCard(giveCard(g, 'interlock'), null);
  for (const m of g.livingMembers()) check(`Interlock grants ${m.name} a guard`, m.interlockGuardTurns.length === 1);
  // Second cast a turn later stacks a second grant with a fresher timer.
  g.telegraph = { type: 'single', hidden: false, damage: 0, targets: [SLOT.LEFT], enraged: false, forTurn: g.turn + 1 };
  g.endTurn(); // party + enemy phase: the first grant ticks 2 -> 1
  g.playCard(giveCard(g, 'interlock'), null);
  eq('Interlock: two grants stacked on the tank', tank.interlockGuardTurns.length, 2);
  // A 5-damage single now takes -2 (two Guard 1 grants), additive on top of Defense.
  tank.defense = 4; tank.defenseAmount = 1; // +1 Defense
  g.telegraph = { type: 'single', hidden: false, damage: 5, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn + 1 };
  eq('Interlock: -2 guard stacks with -1 Defense on the preview', g.attackTargets()[0]?.damage, 5 - 1 - 2 * INTERLOCK_GUARD_DR);
  // Expire independently: the older grant (1 turn left) fades first, leaving one.
  g.telegraph = { type: 'single', hidden: false, damage: 0, targets: [SLOT.LEFT], enraged: false, forTurn: g.turn + 1 };
  g._runEnemyPhase();
  eq('Interlock: the older grant expired, one remains', tank.interlockGuardTurns.length, 1);
  eq('Interlock: grants last INTERLOCK_GUARD_TURNS', CARDS.interlock.target, 'all');
  check('Interlock: guard turns constant is positive', INTERLOCK_GUARD_TURNS > 0);
}
{
  // Whetstone of the Patient: a member untouched last enemy phase strikes +1; a
  // member that took real damage does not; a fully Shield-blocked member counts as
  // untouched.
  const g = new Game(654, ((): any => { const c = defaultBattleConfig(); c.relics = ['whetstone']; return c; })());
  g.start();
  const [ranger, tank, mage] = g.members;
  for (const m of g.members) { m.hp = m.maxHP; m.tookDamageLastEnemyPhase = false; }
  // Ranger takes a real hit; tank is Shield-blocked (untouched); mage untargeted.
  tank.shield = true; tank.shieldTurns = SHIELD_TURNS;
  g.telegraph = { type: 'two', hidden: false, damage: 2, targets: [SLOT.LEFT, SLOT.CENTER], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  check('Whetstone: a hit member is marked touched', ranger.tookDamageLastEnemyPhase);
  check('Whetstone: a fully Shield-blocked member stays untouched', !tank.tookDamageLastEnemyPhase);
  eq('Whetstone: touched member gets no bonus', g.memberDamage(ranger), ranger.damage);
  eq('Whetstone: fully-blocked member gets the bonus', g.memberDamage(tank), tank.damage + WHETSTONE_BONUS);
  eq('Whetstone: untouched member gets the bonus', g.memberDamage(mage), mage.damage + WHETSTONE_BONUS);
}
{
  // Whetstone is inert with no relic owned (no code path fires).
  const g = new Game(655); g.start();
  const tank = g.tank; tank.hp = tank.maxHP; tank.tookDamageLastEnemyPhase = false;
  eq('Whetstone inert without the relic', g.memberDamage(tank), tank.damage);
}
{
  // Bulwark Core: a FULL Shield block leaves the member Braced; a Brace-reduced
  // (still-damaging) hit does not trigger it. Inert with no relic.
  const g = new Game(656, ((): any => { const c = defaultBattleConfig(); c.relics = ['bulwarkCore']; return c; })());
  g.start();
  const tank = g.tank; tank.hp = tank.maxHP;
  tank.shield = true; tank.shieldTurns = SHIELD_TURNS;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  check('Bulwark Core: full block consumes the Shield', !tank.shield);
  check('Bulwark Core: full block leaves a Brace', tank.brace);
  eq('Bulwark Core: the granted Brace carries its fuse', tank.braceTurns, BULWARK_BRACE_TURNS);
  // A Brace-reduced but still-damaging hit must NOT re-trigger Bulwark (it stays a
  // one-shot Brace, consumed, not refreshed into another).
  const mage = g.mage; mage.hp = mage.maxHP;
  mage.brace = true; mage.braceAmount = BRACE_AMOUNT; mage.braceTurns = BRACE_TURNS;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.RIGHT], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  check('Bulwark Core: a partial (Brace) block does not re-grant Brace', !mage.brace);
}
{
  // Bulwark Core inert without the relic: a Shield block leaves no Brace behind.
  const g = new Game(657); g.start();
  const tank = g.tank; tank.hp = tank.maxHP;
  tank.shield = true; tank.shieldTurns = SHIELD_TURNS;
  g.telegraph = { type: 'single', hidden: false, damage: 4, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  check('Bulwark Core inert: Shield block leaves no Brace', !tank.brace);
}
{
  // Definitions / typing sanity for the three new Iron cards and two relics (#65).
  check('Feint / Anvil Stance / Interlock are Iron', (['feint', 'anvilStance', 'interlock'] as CardId[]).every((id) => cardType(id) === 'iron'));
  check('all three new cards are shop/reward-eligible', (['feint', 'anvilStance', 'interlock'] as CardId[]).every((id) => CARD_POOL.includes(id)));
  check('the three new cards carry a rarity', (['feint', 'anvilStance', 'interlock'] as CardId[]).every((id) => CARD_RARITY[id] != null));
  check('Whetstone / Bulwark Core are real relics', (['whetstone', 'bulwarkCore'] as RelicId[]).every((id) => RELIC_IDS.includes(id)));
}

// --- Regen conversions (#66) -----------------------------------------------
{
  // Thornskin: -1 per hit while the target's Regen runs; the preview predicts the
  // reduced number exactly (preview == applied).
  const g = new Game(660); g.start(); g.mp = g.maxMana;
  const tank = g.tank; tank.hp = tank.maxHP; tank.shield = false; tank.brace = false; tank.defense = 0;
  tank.regen = 3;
  g.playCard(giveCard(g, 'thornskin'), SLOT.CENTER);
  g.telegraph = { type: 'single', hidden: false, damage: 5, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  const shown = g.attackTargets().find((s) => s.slot === SLOT.CENTER)?.damage;
  eq('Thornskin: preview reduced by 1 while Regen runs', shown, 5 - THORNSKIN_REDUCTION);
  const before = tank.hp;
  g._resolveAttack();
  eq('Thornskin: applied -1 while Regen runs', before - tank.hp, 5 - THORNSKIN_REDUCTION);
}
{
  // Cultivate extends the Regen, and Thornskin rides the extension — the reduction
  // survives a tick that would have expired the un-cultivated Regen.
  const g = new Game(661); g.start(); g.mp = g.maxMana;
  const tank = g.tank; tank.hp = tank.maxHP - 5; tank.shield = false; tank.brace = false; tank.defense = 0;
  tank.regen = 1; // one tick left without Cultivate
  g.playCard(giveCard(g, 'thornskin'), SLOT.CENTER);
  g.playCard(giveCard(g, 'cultivate'), SLOT.CENTER);
  eq('Cultivate extended the Regen', tank.regen, 1 + CULTIVATE_STRENGTH);
  g._startPlayerPhase(); // one tick: the un-cultivated Regen would be gone here
  check('Thornskin still armed while the extended Regen runs', tank.thornskin && tank.regen > 0);
  eq('Thornskin still reduces after the tick', g._effectiveDamage(tank, 4), 4 - THORNSKIN_REDUCTION);
}
{
  // Bloom-consume ends the Regen and clears the mark mid-fight; a fresh Regen does
  // NOT resume the reduction (the mark was consumed) — recast re-arms it.
  const g = new Game(662); g.start(); g.mp = g.maxMana;
  const tank = g.tank; tank.hp = 5; tank.shield = false; tank.brace = false; tank.defense = 0;
  tank.regen = 3;
  g.playCard(giveCard(g, 'thornskin'), SLOT.CENTER);
  eq('Thornskin reduces while armed', g._effectiveDamage(tank, 4), 4 - THORNSKIN_REDUCTION);
  g.playCard(giveCard(g, 'bloom'), SLOT.CENTER); // consume the Regen -> ends it
  check('Bloom-consume cleared the Thornskin mark', !tank.thornskin);
  eq('Regen gone after Bloom', tank.regen, 0);
  tank.regen = 2; // regains Regen WITHOUT a recast
  eq('Thornskin does NOT resume on new Regen without a recast', g._effectiveDamage(tank, 4), 4);
  g.playCard(giveCard(g, 'thornskin'), SLOT.CENTER); // recast re-arms
  check('Thornskin re-armed after recast', tank.thornskin);
  eq('Thornskin reduces again after re-arm', g._effectiveDamage(tank, 4), 4 - THORNSKIN_REDUCTION);
}
{
  // Sporeburst on Regen 3 -> enemy poisoned SPOREBURST_POISON/turn for 3 turns; the
  // whole Regen is consumed.
  const g = new Game(663); g.start(); g.mp = g.maxMana;
  const tank = g.tank; tank.regen = 3;
  eq('enemy starts unpoisoned', g.enemy.poisonTurns, 0);
  g.playCard(giveCard(g, 'sporeburst'), SLOT.CENTER);
  eq('Sporeburst: poison turns == ticks consumed', g.enemy.poisonTurns, 3);
  eq('Sporeburst: poison per turn', g.enemy.poison, SPOREBURST_POISON);
  eq('Sporeburst consumed the whole Regen', tank.regen, 0);
}
{
  // Wave stacking rule: on an already-poisoned enemy the per-turn ADDS and the
  // duration takes the MAX (existing 5 > new 3).
  const g = new Game(664); g.start(); g.mp = g.maxMana;
  g.enemy.poison = 2; g.enemy.poisonTurns = 5;
  g.tank.regen = 3;
  g.playCard(giveCard(g, 'sporeburst'), SLOT.CENTER);
  eq('poison per-turn adds', g.enemy.poison, 2 + SPOREBURST_POISON);
  eq('poison duration takes the longer window (max)', g.enemy.poisonTurns, 5);
}
{
  // Max the other way: existing shorter window is replaced by the longer new one.
  const g = new Game(665); g.start(); g.mp = g.maxMana;
  g.enemy.poison = 1; g.enemy.poisonTurns = 2;
  g.tank.regen = 4;
  g.playCard(giveCard(g, 'sporeburst'), SLOT.CENTER);
  eq('poison duration extends to the longer new window', g.enemy.poisonTurns, 4);
  eq('poison per-turn still adds', g.enemy.poison, 1 + SPOREBURST_POISON);
}
{
  // Deep Roots: Brace 2 on NATURAL expiry.
  const cfg = defaultBattleConfig(); cfg.relics = ['deepRoots'];
  const g = new Game(666, cfg); g.start();
  const tank = g.tank; tank.hp = tank.maxHP; tank.shield = false; tank.brace = false;
  tank.regen = 1; // expires next tick
  g._startPlayerPhase(); // Regen 1 -> 0: natural expiry
  check('Deep Roots: Brace on natural expiry', tank.brace);
  eq('Deep Roots: standard Brace duration', tank.braceTurns, BRACE_TURNS);
}
{
  // Deep Roots: Brace on Bloom-consume, and on Sporeburst-consume.
  const cfg = defaultBattleConfig(); cfg.relics = ['deepRoots'];
  const g = new Game(667, cfg); g.start(); g.mp = g.maxMana;
  const tank = g.tank; tank.hp = 5; tank.shield = false; tank.brace = false; tank.regen = 3;
  g.playCard(giveCard(g, 'bloom'), SLOT.CENTER);
  check('Deep Roots: Brace on Bloom-consume', tank.brace);
  tank.brace = false; tank.regen = 2;
  g.playCard(giveCard(g, 'sporeburst'), SLOT.CENTER);
  check('Deep Roots: Brace on Sporeburst-consume', tank.brace);
}
{
  // Deep Roots + Lifebloom burst both fire on expiry (intended double-dip).
  const cfg = defaultBattleConfig(); cfg.relics = ['deepRoots'];
  const g = new Game(670, cfg); g.start(); g.mp = g.maxMana;
  const tank = g.tank; tank.hp = 5; tank.shield = false; tank.brace = false;
  g.playCard(giveCard(g, 'lifebloom'), SLOT.CENTER); // Regen 2 (= 2 ticks) + burst pending
  const hpBeforeExpiry = tank.hp;
  for (let i = 0; i < 2; i++) g._startPlayerPhase(); // tick to expiry
  eq('Lifebloom Regen expired', tank.regen, 0);
  check('Double-dip: Deep Roots Brace on Lifebloom expiry', tank.brace);
  check('Double-dip: Lifebloom burst also healed on expiry', tank.hp > hpBeforeExpiry + LIFEBLOOM_BURST - 1);
}
{
  // Deep Roots inert without the relic: an expiring Regen leaves no Brace.
  const g = new Game(669); g.start();
  const tank = g.tank; tank.shield = false; tank.brace = false; tank.regen = 1;
  g._startPlayerPhase();
  check('Deep Roots inert: no Brace without the relic', !tank.brace);
}
{
  // Ossuary Bell: two separate downward crossings of 50% in one fight -> two Regen
  // grants (every crossing retriggers; no per-fight cap).
  const cfg = defaultBattleConfig(); cfg.relics = ['ossuaryBell'];
  const g = new Game(671, cfg); g.start();
  const tank = g.tank; tank.shield = false; tank.brace = false; tank.defense = 0; tank.regen = 0;
  const bigHit = tank.maxHP - 1; // full -> 1 HP: below any threshold, still alive (non-lethal)
  tank.hp = tank.maxHP;
  g.telegraph = { type: 'single', hidden: false, damage: bigHit, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  check('Ossuary Bell: first crossing grants Regen', tank.alive && tank.regen >= OSSUARY_REGEN);
  const afterFirst = tank.regen;
  tank.hp = tank.maxHP; // healed back above half
  g.telegraph = { type: 'single', hidden: false, damage: bigHit, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  check('Ossuary Bell: second crossing grants Regen again', tank.regen >= afterFirst + OSSUARY_REGEN);
}
{
  // Ossuary Bell inert without the relic.
  const g = new Game(672); g.start();
  const tank = g.tank; tank.shield = false; tank.brace = false; tank.defense = 0; tank.regen = 0;
  tank.hp = tank.maxHP;
  g.telegraph = { type: 'single', hidden: false, damage: tank.maxHP - 1, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  eq('Ossuary Bell inert: no Regen without the relic', tank.regen, 0);
}
{
  // Thornskin composes with Brace in the pipeline and preview still equals applied.
  const g = new Game(673); g.start(); g.mp = g.maxMana;
  const tank = g.tank; tank.hp = tank.maxHP; tank.shield = false; tank.defense = 0;
  tank.regen = 2; tank.brace = true; tank.braceAmount = BRACE_AMOUNT; tank.braceTurns = BRACE_TURNS;
  g.playCard(giveCard(g, 'thornskin'), SLOT.CENTER);
  g.telegraph = { type: 'single', hidden: false, damage: 6, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  const shown = g.attackTargets().find((s) => s.slot === SLOT.CENTER)?.damage;
  const before = tank.hp;
  g._resolveAttack();
  eq('Thornskin + Brace: preview equals applied', shown, before - tank.hp);
}
{
  // Definitions / typing sanity for the two new Nature cards and two relics (#66).
  check('Thornskin / Sporeburst are Nature', (['thornskin', 'sporeburst'] as CardId[]).every((id) => cardType(id) === 'nature'));
  check('both new cards are shop/reward-eligible', (['thornskin', 'sporeburst'] as CardId[]).every((id) => CARD_POOL.includes(id)));
  check('both new cards carry a rarity', (['thornskin', 'sporeburst'] as CardId[]).every((id) => CARD_RARITY[id] != null));
  check('both new cards use the needsRegen gate', (['thornskin', 'sporeburst'] as CardId[]).every((id) => CARDS[id].needsRegen === true));
  check('Deep Roots / Ossuary Bell are real relics', (['deepRoots', 'ossuaryBell'] as RelicId[]).every((id) => RELIC_IDS.includes(id)));
}

// --- Status-window management (#67) ----------------------------------------
{
  // Hemorrhage cashes the enemy's whole Poison out at once: per-turn × turns left.
  const g = new Game(670); g.start(); g.mp = g.maxMana; g.enemy.hp = 999;
  g.enemy.poison = 5; g.enemy.poisonTurns = 3; // 15 damage owed
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'hemorrhage'));
  eq('Hemorrhage deals per-turn × turns at once', before - g.enemy.hp, 5 * 3);
  eq('Hemorrhage clears the poison strength', g.enemy.poison, 0);
  eq('Hemorrhage clears the poison duration', g.enemy.poisonTurns, 0);
}
{
  // Hemorrhage routes through _damageEnemy, so Vulnerability multiplies the cash-out.
  const g = new Game(671); g.start(); g.mp = g.maxMana; g.enemy.hp = 999;
  g.enemy.poison = 5; g.enemy.poisonTurns = 3; // 15 base
  g.enemy.vulnerable = 1; g.enemy.vulnerableTurns = 2; // ×2
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'hemorrhage'));
  eq('Hemorrhage is amplified by Vulnerability', before - g.enemy.hp, (5 * 3) * 2);
}
{
  // Hemorrhage is a dead card while the enemy is not Poisoned (needsPoison gate).
  const g = new Game(672); g.start(); g.mp = g.maxMana;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  const idx = giveCard(g, 'hemorrhage');
  check('Hemorrhage is unplayable with no enemy poison', g.canPlay(idx, null) != null);
  g.enemy.poison = 4; g.enemy.poisonTurns = 2;
  check('Hemorrhage becomes playable once the enemy is Poisoned', g.canPlay(idx, null) == null);
}
{
  // Umbral Feast: empty board is a 0 baseline; Shield + Regen + Poison + Vuln → 4.
  const g = new Game(673); g.start(); g.mp = g.maxMana; g.enemy.hp = 999;
  eq('Umbral Feast: empty-board effect count is 0', g._activeEffectCount(), 0);
  const before0 = g.enemy.hp;
  g.playCard(giveCard(g, 'umbralFeast'));
  eq('Umbral Feast deals 0 on an empty board', before0 - g.enemy.hp, 0);
  // Arm four active effects: a member Shield + Regen, enemy Poison + Vulnerability.
  g.tank.shield = true; g.tank.shieldTurns = SHIELD_TURNS;
  g.tank.regen = 2;
  g.enemy.poison = 3; g.enemy.poisonTurns = 4;
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 2; // vuln 0% still counts as an active window
  eq('Umbral Feast: Shield + Regen + Poison + Vuln counts 4', g._activeEffectCount(), 4);
  g.mp = g.maxMana; g.enemy.hp = 999;
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'umbralFeast'));
  eq('Umbral Feast deals 1 per active effect', before - g.enemy.hp, 4 * UMBRAL_FEAST_PER_EFFECT);
}
{
  // Dread Whisper shaves 1 per target off the standing sweep — preview drops immediately
  // and the applied damage matches; it stacks (floors at 0 on a 1-damage sweep).
  const g = new Game(674); g.start(); g.mp = g.maxMana;
  g.telegraph = { type: 'sweep', hidden: false, damage: 4, targets: [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT], enraged: false, forTurn: g.turn };
  const raw = g.attackTargets().map((s) => s.damage);
  check('Dread Whisper: sweep previews 4 per target before the shave', raw.every((d) => d === 4));
  g.playCard(giveCard(g, 'dreadWhisper'));
  const shaved = g.attackTargets().map((s) => s.damage);
  check('Dread Whisper: preview drops 1 per target', shaved.every((d) => d === 4 - DREAD_WHISPER_REDUCTION));
  // Applied matches the preview: each of the three targets takes the shaved number.
  const hpBefore = g.members.map((m) => m.hp);
  g._resolveAttack();
  const applied = g.members.map((m, i) => hpBefore[i] - m.hp);
  check('Dread Whisper: every target took the previewed (shaved) hit',
    [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT].every((s) => applied[s] === 4 - DREAD_WHISPER_REDUCTION));
}
{
  // Dread Whisper floors a 1-damage telegraph at 0 (never negative).
  const g = new Game(675); g.start(); g.mp = g.maxMana;
  g.telegraph = { type: 'single', hidden: false, damage: 1, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  g.playCard(giveCard(g, 'dreadWhisper'));
  eq('Dread Whisper floors the telegraph at 0', g.attackTargets().find((s) => s.slot === SLOT.CENTER)?.damage, 0);
}
{
  // Venom Gland: every poison application lasts +1 turn — the Ranger's Imbue Venom
  // lands 5×6 (POISON_BASE × POISON_TURNS+1) and Sporeburst's window is +1 too.
  const cfg = defaultBattleConfig(); cfg.relics = ['venomGland'];
  const g = new Game(676, cfg); g.start(); g.mp = g.maxMana;
  g.playCard(giveAbility(g, SLOT.LEFT)); // Imbue Venom (Ranger poison)
  eq('Venom Gland: Imbue Venom strength is POISON_BASE', g.enemy.poison, POISON_BASE);
  eq('Venom Gland: Imbue Venom lasts POISON_TURNS + 1', g.enemy.poisonTurns, POISON_TURNS + VENOM_GLAND_BONUS_TURNS);
  // Sporeburst consumes a 3-tick Regen → window is 3 + 1 with Venom Gland.
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  g.tank.regen = 3;
  g.mp = g.maxMana;
  g.playCard(giveCard(g, 'sporeburst'), SLOT.CENTER);
  eq('Venom Gland: Sporeburst window is ticks + 1', g.enemy.poisonTurns, 3 + VENOM_GLAND_BONUS_TURNS);
}
{
  // Venom Gland is inert with no relics: Imbue Venom lasts exactly POISON_TURNS.
  const g = new Game(677); g.start(); g.mp = g.maxMana;
  g.playCard(giveAbility(g, SLOT.LEFT));
  eq('Venom Gland inert: Imbue Venom lasts POISON_TURNS', g.enemy.poisonTurns, POISON_TURNS);
}
{
  // Embermark: every natural Vulnerability expiry deals EMBERMARK_DMG; nothing while the
  // window is still open (Sap re-up keeps vulnerableTurns > 0 → no trigger until it hits 0).
  const cfg = defaultBattleConfig(); cfg.relics = ['embermark'];
  const g = new Game(678, cfg); g.start(); g.enemy.hp = 999; g.telegraph = null;
  g.enemy.vulnerable = 0.5; g.enemy.vulnerableTurns = 2; // will decrement 2 → 1 (no fire), then 1 → 0 (fire)
  let before = g.enemy.hp;
  g._runEnemyPhase();
  eq('Embermark does not fire while the window is still open', before - g.enemy.hp, 0);
  before = g.enemy.hp;
  g._runEnemyPhase();
  eq('Embermark fires EMBERMARK_DMG on the natural expiry', before - g.enemy.hp, EMBERMARK_DMG);
}
{
  // Embermark is inert with no relics: the Vulnerability just expires, no damage.
  const g = new Game(679); g.start(); g.enemy.hp = 999; g.telegraph = null;
  g.enemy.vulnerable = 0.5; g.enemy.vulnerableTurns = 1;
  const before = g.enemy.hp;
  g._runEnemyPhase();
  eq('Embermark inert: expiry deals no damage without the relic', before - g.enemy.hp, 0);
}
{
  // Definitions / typing sanity for the three new Shadow cards and two relics (#67).
  check('the three new cards are Shadow', (['hemorrhage', 'umbralFeast', 'dreadWhisper'] as CardId[]).every((id) => cardType(id) === 'shadow'));
  check('all three count toward the Shadow type bucket', (['hemorrhage', 'umbralFeast', 'dreadWhisper'] as CardId[]).every((id) => cardsOfType('shadow').includes(id)));
  check('all three are shop/reward-eligible', (['hemorrhage', 'umbralFeast', 'dreadWhisper'] as CardId[]).every((id) => CARD_POOL.includes(id)));
  check('all three carry a rarity', (['hemorrhage', 'umbralFeast', 'dreadWhisper'] as CardId[]).every((id) => CARD_RARITY[id] != null));
  check('Hemorrhage uses the needsPoison gate', CARDS.hemorrhage.needsPoison === true);
  check('Venom Gland / Embermark are real relics', (['venomGland', 'embermark'] as RelicId[]).every((id) => RELIC_IDS.includes(id)));
}

// --- Blood + cycling (#68) --------------------------------------------------
{
  // Crimson Pact: a member > CRIMSON_PACT_HP pays it and the party draws CRIMSON_PACT_DRAW.
  const g = new Game(680); g.start(); g.mp = g.maxMana;
  g.tank.hp = g.tank.maxHP;
  const hp0 = g.tank.hp;
  const idx = giveCard(g, 'crimsonPact');
  const handBefore = g.hand.length; // includes the Pact about to be spent
  g.playCard(idx, SLOT.CENTER);
  eq('Crimson Pact pays its HP cost', hp0 - g.tank.hp, CRIMSON_PACT_HP);
  // The played card leaves the hand; net hand change is the draw minus the one spent.
  eq('Crimson Pact draws CRIMSON_PACT_DRAW', g.hand.length - handBefore, CRIMSON_PACT_DRAW - 1);
  eq('Crimson Pact costs 0 MP', CARDS.crimsonPact.cost, 0);
  check('Crimson Pact is engine-tagged (Retain/Efficient-ineligible like Inspiration)', isEngineCard('crimsonPact'));
  check('Retain cannot lock in Crimson Pact', !MODIFIERS.retain.eligible('crimsonPact'));
}
{
  // The ">N HP" gate refuses a target at or below the cost; accepts one above it.
  const g = new Game(681); g.start(); g.mp = g.maxMana;
  const idx = giveCard(g, 'crimsonPact');
  g.tank.hp = CRIMSON_PACT_HP; // exactly the cost — must be refused
  check('Crimson Pact refuses a target at the cost', g.canPlay(idx, SLOT.CENTER) != null);
  g.tank.hp = CRIMSON_PACT_HP + 1; // one above — allowed
  check('Crimson Pact accepts a target above the cost', g.canPlay(idx, SLOT.CENTER) == null);
}
{
  // The selfDamage payment clamps to leave 1 HP (never lethal), even when the dev
  // path bypasses the canPlay gate on a too-poor member.
  const g = new Game(682); g.start();
  g.tank.hp = 2; // below the cost — devPlayCard bypasses canPlay
  g.devPlayCard('crimsonPact', SLOT.CENTER);
  eq('Crimson Pact clamps the payment to leave 1 HP', g.tank.hp, 1);
  check('the clamped payment does not kill', g.tank.alive);
}
{
  // Scarlet Ward: pay SCARLET_WARD_HP for a normal Shield (replaces Brace, fades in SHIELD_TURNS).
  const g = new Game(683); g.start(); g.mp = g.maxMana;
  g.tank.hp = g.tank.maxHP; g.tank.brace = true; g.tank.braceAmount = BRACE_AMOUNT; g.tank.braceTurns = 2;
  const hp0 = g.tank.hp;
  g.playCard(giveCard(g, 'scarletWard'), SLOT.CENTER);
  eq('Scarlet Ward pays its HP cost', hp0 - g.tank.hp, SCARLET_WARD_HP);
  check('Scarlet Ward grants a Shield', g.tank.shield && g.tank.shieldTurns === SHIELD_TURNS);
  check('Scarlet Ward replaces the Brace', !g.tank.brace);
}
{
  // Open Veins: pay OPEN_VEINS_HP, deal OPEN_VEINS_DMG to the enemy (through _damageEnemy).
  const g = new Game(684); g.start(); g.mp = g.maxMana; g.enemy.hp = 999;
  g.ranger.hp = g.ranger.maxHP;
  const hp0 = g.ranger.hp, ehp0 = g.enemy.hp;
  g.playCard(giveCard(g, 'openVeins'), SLOT.LEFT);
  eq('Open Veins pays its HP cost', hp0 - g.ranger.hp, OPEN_VEINS_HP);
  eq('Open Veins deals its damage to the enemy', ehp0 - g.enemy.hp, OPEN_VEINS_DMG);
}
{
  // Transfusion: pay TRANSFUSION_HP; the most wounded OTHER living member heals — never the payer.
  const g = new Game(685); g.start(); g.mp = g.maxMana;
  g.ranger.hp = g.ranger.maxHP;   // payer, full
  g.tank.hp = g.tank.maxHP - 2;   // wounded by 2
  g.mage.hp = g.mage.maxHP - 5;   // most wounded (deficit 5)
  const payerHp0 = g.ranger.hp, mageHp0 = g.mage.hp;
  g.playCard(giveCard(g, 'transfusion'), SLOT.LEFT);
  eq('Transfusion pays its HP cost', payerHp0 - g.ranger.hp, TRANSFUSION_HP);
  eq('Transfusion heals the most wounded other member', g.mage.hp - mageHp0, TRANSFUSION_HEAL);
  check('Transfusion never heals the payer beyond its own cost', g.ranger.hp === payerHp0 - TRANSFUSION_HP);
}
{
  // Transfusion tie-break: equal deficits resolve to the lowest slot (deterministic).
  const g = new Game(686); g.start(); g.mp = g.maxMana;
  g.mage.hp = g.mage.maxHP;       // payer (slot 2), full
  g.ranger.hp = g.ranger.maxHP - 6; // slot 0, deficit 6 (> heal, so it lands fully)
  g.tank.hp = g.tank.maxHP - 6;     // slot 1, deficit 6 (tie)
  const rangerHp0 = g.ranger.hp, tankHp0 = g.tank.hp;
  g.playCard(giveCard(g, 'transfusion'), SLOT.RIGHT);
  check('Transfusion tie-break picks the lowest slot', g.ranger.hp - rangerHp0 === TRANSFUSION_HEAL && g.tank.hp === tankHp0);
}
{
  // The _mostWoundedOther selector never returns the excluded payer.
  const g = new Game(687); g.start();
  for (const m of g.members) m.hp = m.maxHP;
  g.tank.hp = 1; // the payer is itself the most wounded
  const pick = g._mostWoundedOther(g.tank);
  check('_mostWoundedOther excludes the payer', pick != null && pick.slot !== g.tank.slot);
}
{
  // Blood Banner: every living member pays BLOOD_BANNER_HP (clamped) and the party's
  // autos gain +BLOOD_BANNER_BONUS for BLOOD_BANNER_TURNS enemy turns.
  const g = new Game(688); g.start(); g.mp = g.maxMana;
  for (const m of g.members) m.hp = m.maxHP;
  const dmg0 = g.members.map((m) => g.memberDamage(m));
  g.playCard(giveCard(g, 'bloodBanner'));
  check('Blood Banner bleeds every living member', g.members.every((m) => m.hp === m.maxHP - BLOOD_BANNER_HP));
  eq('Blood Banner sets its buff timer', g.bloodBannerTurns, BLOOD_BANNER_TURNS);
  check('Blood Banner raises every member\'s auto by the bonus',
    g.members.every((m, i) => g.memberDamage(m) === dmg0[i] + BLOOD_BANNER_BONUS));
}
{
  // Blood Banner is additive with Battle Hymn in the same turn (both stack, not max).
  const g = new Game(689); g.start(); g.mp = g.maxMana;
  for (const m of g.members) m.hp = m.maxHP;
  const base = g.memberDamage(g.ranger);
  g.playCard(giveCard(g, 'battleHymn'));
  const withHymn = g.memberDamage(g.ranger);
  g.playCard(giveCard(g, 'bloodBanner'));
  const withBoth = g.memberDamage(g.ranger);
  check('Blood Banner stacks additively on top of Battle Hymn',
    withHymn > base && withBoth === withHymn + BLOOD_BANNER_BONUS);
}
{
  // Blood Banner clamps its own payment to leave 1 HP (never lethal).
  const g = new Game(690); g.start(); g.mp = g.maxMana;
  g.mage.hp = 1; // already at the floor
  g.playCard(giveCard(g, 'bloodBanner'));
  check('Blood Banner never bleeds a member below 1 HP', g.mage.hp === 1 && g.mage.alive);
}
{
  // Blood Banner's buff decays after BLOOD_BANNER_TURNS enemy turns.
  const g = new Game(691); g.start(); g.mp = g.maxMana;
  g.playCard(giveCard(g, 'bloodBanner'));
  eq('Blood Banner buff starts at BLOOD_BANNER_TURNS', g.bloodBannerTurns, BLOOD_BANNER_TURNS);
  g._decayBuffs();
  eq('Blood Banner buff decays one turn', g.bloodBannerTurns, BLOOD_BANNER_TURNS - 1);
  g._decayBuffs();
  eq('Blood Banner buff expires after its turns', g.bloodBannerTurns, 0);
}
{
  // Grimoire of Turning: every reshuffle deals GRIMOIRE_DMG to the enemy (through _damageEnemy).
  const cfg = defaultBattleConfig(); cfg.relics = ['grimoireOfTurning'];
  const g = new Game(692, cfg); g.start(); g.enemy.hp = 999;
  g.drawPile = []; g.discardPile.push(makeDeckCard('lowHeal', -1)); // force a reshuffle
  const before = g.enemy.hp;
  g._drawOne();
  eq('Grimoire deals GRIMOIRE_DMG on a reshuffle', before - g.enemy.hp, GRIMOIRE_DMG);
}
{
  // Grimoire is uncapped: two reshuffles deal it twice (no per-fight cap).
  const cfg = defaultBattleConfig(); cfg.relics = ['grimoireOfTurning'];
  const g = new Game(693, cfg); g.start(); g.enemy.hp = 999;
  let before = g.enemy.hp;
  g.drawPile = []; g.discardPile.push(makeDeckCard('lowHeal', -1)); g._drawOne();
  eq('Grimoire fires on the first reshuffle', before - g.enemy.hp, GRIMOIRE_DMG);
  before = g.enemy.hp;
  g.drawPile = []; g.discardPile.push(makeDeckCard('lowHeal', -2)); g._drawOne();
  eq('Grimoire fires again on the second reshuffle (uncapped)', before - g.enemy.hp, GRIMOIRE_DMG);
}
{
  // Grimoire is inert with no relics: a reshuffle deals no damage.
  const g = new Game(694); g.start(); g.enemy.hp = 999;
  g.drawPile = []; g.discardPile.push(makeDeckCard('lowHeal', -1));
  const before = g.enemy.hp;
  g._drawOne();
  eq('Grimoire inert: a reshuffle deals no damage without the relic', before - g.enemy.hp, 0);
}
{
  // Grimoire rides Crimson Pact's draw: a Pact that triggers a mid-draw reshuffle fires it.
  const cfg = defaultBattleConfig(); cfg.relics = ['grimoireOfTurning'];
  const g = new Game(695, cfg); g.start(); g.mp = g.maxMana; g.enemy.hp = 999;
  g.tank.hp = g.tank.maxHP;
  // Empty the draw pile and seed the discard so the Pact's second draw reshuffles.
  g.drawPile = [makeDeckCard('lowHeal', -1)];
  g.discardPile = [makeDeckCard('lowHeal', -2), makeDeckCard('lowHeal', -3)];
  const before = g.enemy.hp;
  g.playCard(giveCard(g, 'crimsonPact'), SLOT.CENTER); // draws 2 -> the 2nd triggers a reshuffle
  eq('Crimson Pact\'s mid-draw reshuffle fires Grimoire', before - g.enemy.hp, GRIMOIRE_DMG);
}
{
  // Sanguine Pact (curse), cost half: every Blood-card HP cost pays +SURCHARGE, so the
  // ">N HP" gate rises with it. Open Veins' effective cost = base + surcharge.
  const cfg = defaultBattleConfig(); cfg.relics = ['sanguinePact'];
  const g = new Game(696, cfg); g.start(); g.mp = g.maxMana; g.enemy.hp = 999;
  g.ranger.hp = g.ranger.maxHP;
  const cost = OPEN_VEINS_HP + SANGUINE_PACT_SURCHARGE;
  const idx = giveCard(g, 'openVeins');
  g.ranger.hp = cost; // exactly the raised cost — refused
  check('Sanguine Pact raises the Blood gate by the surcharge', g.canPlay(idx, SLOT.LEFT) != null);
  g.ranger.hp = cost + 1; // one above the raised cost — allowed
  check('Sanguine Pact gate accepts a target above the raised cost', g.canPlay(idx, SLOT.LEFT) == null);
  const hp0 = g.ranger.hp;
  g.playCard(idx, SLOT.LEFT);
  eq('Sanguine Pact makes the payment pay the surcharge too', hp0 - g.ranger.hp, cost);
}
{
  // Sanguine Pact, upside half: while ANY living member is below 50% HP, party autos +bonus.
  const cfg = defaultBattleConfig(); cfg.relics = ['sanguinePact'];
  const g = new Game(697, cfg); g.start();
  for (const m of g.members) m.hp = m.maxHP; // all healthy -> no bonus
  const healthy = g.memberDamage(g.ranger);
  g.tank.hp = Math.floor(g.tank.maxHP * 0.4); // one member below 50% -> party-wide +bonus
  const wounded = g.memberDamage(g.ranger);
  eq('Sanguine Pact grants +bonus while a member is below 50%', wounded - healthy, SANGUINE_PACT_AUTO_BONUS);
  g.tank.hp = g.tank.maxHP; // topped back off -> the bonus toggles off
  eq('Sanguine Pact bonus toggles off once everyone is above 50%', g.memberDamage(g.ranger), healthy);
}
{
  // Sanguine Pact is inert when not owned: no surcharge, no auto bonus.
  const g = new Game(698); g.start();
  eq('Sanguine Pact inert: no Blood surcharge', g._sanguineSurcharge(), 0);
  g.tank.hp = 1; // below 50%, but no relic -> no party auto bonus
  const dmg = g.memberDamage(g.ranger);
  for (const m of g.members) m.hp = m.maxHP;
  eq('Sanguine Pact inert: no auto bonus from a wounded member', g.memberDamage(g.ranger), dmg);
}
{
  // Definitions / typing sanity for the five new Blood cards and two relics (#68).
  const blood: CardId[] = ['crimsonPact', 'scarletWard', 'openVeins', 'transfusion', 'bloodBanner'];
  check('the five new cards are Blood', blood.every((id) => cardType(id) === 'blood'));
  check('all five count toward the Blood type bucket', blood.every((id) => cardsOfType('blood').includes(id)));
  check('all five are shop/reward-eligible', blood.every((id) => CARD_POOL.includes(id)));
  check('all five carry a rarity', blood.every((id) => CARD_RARITY[id] != null));
  // Every gated Blood card clamps to 1 HP: the four single-target ones carry selfDamage.
  check('the four single-target Blood cards carry selfDamage', (['crimsonPact', 'scarletWard', 'openVeins', 'transfusion'] as CardId[]).every((id) => CARDS[id].selfDamage != null));
  eq('Crimson Pact HP cost', CARDS.crimsonPact.selfDamage, CRIMSON_PACT_HP);
  eq('Crimson Pact draws CRIMSON_PACT_DRAW', CARDS.crimsonPact.draw, CRIMSON_PACT_DRAW);
  eq('Scarlet Ward HP cost', CARDS.scarletWard.selfDamage, SCARLET_WARD_HP);
  eq('Open Veins HP cost', CARDS.openVeins.selfDamage, OPEN_VEINS_HP);
  eq('Transfusion HP cost', CARDS.transfusion.selfDamage, TRANSFUSION_HP);
  check('Blood Banner has no ">N HP" gate (no selfDamage, target none)', CARDS.bloodBanner.selfDamage == null && CARDS.bloodBanner.target === 'none');
  check('Grimoire of Turning / Sanguine Pact are real relics', (['grimoireOfTurning', 'sanguinePact'] as RelicId[]).every((id) => RELIC_IDS.includes(id)));
  check('Sanguine Pact is registered as a curse', RELICS.sanguinePact.curse === true);
  check('Grimoire of Turning is not a curse', RELICS.grimoireOfTurning.curse !== true);
}

// --- Holy overheal & board-state payoffs (#69) ------------------------------
{
  // Benediction heals a flat base + 1 per active buff on the TARGET (the per-member
  // half of _activeEffectCount). Shield + Regen + Guard = 3 buffs -> heal 2 + 3 = 5.
  const g = new Game(690001); g.start(); g.mp = 20;
  const m = g.tank; m.hp = 1;
  m.shield = true; m.regen = 2; m.guardDR = 1; m.guardTurns = 2; // 3 distinct buffs
  eq('Benediction reads the per-member buff count', g._memberEffectCount(m), 3);
  g.playCard(giveCard(g, 'benediction'), SLOT.CENTER);
  eq('Benediction heals base + 1 per buff (5)', m.hp - 1, BENEDICTION_HEAL + BENEDICTION_PER_BUFF * 3);
}
{
  // Benediction with no buffs heals the flat base only.
  const g = new Game(690002); g.start(); g.mp = 20;
  const m = g.mage; m.hp = 1;
  g.playCard(giveCard(g, 'benediction'), SLOT.RIGHT);
  eq('Benediction with no buffs heals the base', m.hp - 1, BENEDICTION_HEAL);
}
{
  // Sunrise Vigil queues a delayed heal that fires at the START of the next player
  // phase (post-Regen, pre-draw) — every living member heals SUNRISE_VIGIL_HEAL.
  const g = new Game(690010); g.start(); g.mp = 20;
  g.playCard(giveCard(g, 'sunriseVigil'));
  eq('Sunrise Vigil queues one delayed entry', g.delayedStartEffects.length, 1);
  for (const m of g.members) m.hp = m.maxHP - 5;
  g._startPlayerPhase(); // regen (none) then the queue, before the draw
  check('Sunrise Vigil heals every living member at phase start',
    g.members.every((m) => m.hp === m.maxHP - 5 + SUNRISE_VIGIL_HEAL));
  eq('Sunrise Vigil drains its queue after firing', g.delayedStartEffects.length, 0);
}
{
  // Cast twice -> two entries -> heals twice (2x SUNRISE_VIGIL_HEAL). Dead members are
  // skipped at fire time; a fresh fight starts with an empty queue.
  const g = new Game(690011); g.start(); g.mp = 20;
  g.playCard(giveCard(g, 'sunriseVigil'));
  g.playCard(giveCard(g, 'sunriseVigil'));
  eq('two casts queue two entries', g.delayedStartEffects.length, 2);
  g._killMember(g.mage); // dead -> skipped
  for (const m of g.members) if (m.alive) m.hp = m.maxHP - 5;
  g._startPlayerPhase();
  check('two queued Vigils heal twice', g.ranger.hp === g.ranger.maxHP - 5 + 2 * SUNRISE_VIGIL_HEAL
    && g.tank.hp === g.tank.maxHP - 5 + 2 * SUNRISE_VIGIL_HEAL);
  eq('a dead member is skipped by the Vigil', g.mage.hp, 0);
  eq('a fresh fight starts with an empty delayed-effect queue', new Game(690012).delayedStartEffects.length, 0);
}
{
  // Consecration heals the whole party a little; only members at FULL HP AFTERWARD gain
  // the strike buff. Mixed party: two land full, one stays wounded.
  const g = new Game(690020); g.start(); g.mp = 20;
  g.ranger.hp = g.ranger.maxHP;      // already full -> stays full -> buffed
  g.mage.hp = g.mage.maxHP - 1;      // heal 1 -> full -> buffed
  g.tank.hp = g.tank.maxHP - 5;      // heal 1 -> still wounded -> NOT buffed
  g.playCard(giveCard(g, 'consecration'));
  check('Consecration buffs the members at full HP afterward',
    g.ranger.strikeTurns === CONSECRATION_STRIKE_TURNS && g.ranger.strikeBonus >= CONSECRATION_STRIKE_BONUS
    && g.mage.strikeTurns === CONSECRATION_STRIKE_TURNS);
  eq('Consecration leaves the still-wounded member unbuffed', g.tank.strikeTurns, 0);
  eq('Consecration healed the wounded member its base', g.tank.hp, g.tank.maxHP - 5 + CONSECRATION_HEAL);
}
{
  // Absolution: at full HP the whole heal is overheal -> Brace ABSOLUTION_HEAL.
  const g = new Game(690030); g.start(); g.mp = 20;
  const m = g.tank; m.hp = m.maxHP; m.shield = true; m.shieldTurns = 3; // Brace should replace the Shield
  g.playCard(giveCard(g, 'absolution'), SLOT.CENTER);
  check('Absolution at full HP braces for the whole heal', m.brace && m.braceAmount === ABSOLUTION_HEAL && m.braceTurns === BRACE_TURNS);
  check('Absolution Brace replaces the standing Shield', !m.shield);
  eq('Absolution did no actual healing at full HP', m.hp, m.maxHP);
}
{
  // Absolution: 1 HP missing -> heal 1, overheal 2 -> Brace 2.
  const g = new Game(690031); g.start(); g.mp = 20;
  const m = g.tank; m.hp = m.maxHP - 1;
  g.playCard(giveCard(g, 'absolution'), SLOT.CENTER);
  eq('Absolution heals the missing HP first', m.hp, m.maxHP);
  eq('Absolution braces for exactly the overheal', m.braceAmount, ABSOLUTION_HEAL - 1);
}
{
  // The variable Brace actually reduces the next hit by braceAmount (not the fixed 2).
  const g = new Game(690032); g.start(); g.mp = 20;
  const m = g.tank; m.hp = m.maxHP;
  g.playCard(giveCard(g, 'absolution'), SLOT.CENTER); // Brace 3
  eq('the captured Brace is 3', m.braceAmount, ABSOLUTION_HEAL);
  g.telegraph = { type: 'single', hidden: false, damage: 5, targets: [SLOT.CENTER], enraged: false, forTurn: g.turn };
  g._resolveAttack();
  eq('Brace 3 blunts the 5-damage hit to 2', m.hp, m.maxHP - (5 - ABSOLUTION_HEAL));
}
{
  // With Aegis Font owned, Absolution converts the overheal first — the Font sees none of
  // it (no Ward), and both effects do not double-convert one cast.
  const cfg = defaultBattleConfig(); cfg.relics = ['aegisFont'];
  const g = new Game(690033, cfg); g.start(); g.mp = 20;
  const m = g.tank; m.hp = m.maxHP;
  g.playCard(giveCard(g, 'absolution'), SLOT.CENTER);
  check('Absolution braces from the overheal', m.brace && m.braceAmount === ABSOLUTION_HEAL);
  eq('the Aegis Font gets no Ward from an Absolution cast', m.ward, 0);
}
{
  // Rootbind extends every listed friendly timed effect by ROOTBIND_BONUS_TURNS; effects
  // at 0 (absent) are untouched, and excluded fields (Interlock grants, once-armed flags)
  // do not move. This pins the published field list.
  const g = new Game(690040); g.start(); g.mp = 20;
  const m = g.tank;
  m.regen = 2; m.shield = true; m.shieldTurns = 1; m.brace = true; m.braceAmount = 2; m.braceTurns = 1;
  m.guardDR = 1; m.guardTurns = 1; m.defense = 1; m.defenseAmount = 1; m.strikeBonus = 1; m.strikeTurns = 1; m.taunt = 1;
  // Excluded / absent controls.
  m.interlockGuardTurns = [1]; m.empowerBonus = 1; m.charge = 1; m.boarHp = 4; m.boarTurns = 1;
  g.ranger.regen = 0; // an absent effect on another member
  g.playCard(giveCard(g, 'rootbind'));
  check('Rootbind extends the seven listed timers by +1',
    m.regen === 2 + ROOTBIND_BONUS_TURNS && m.shieldTurns === 1 + ROOTBIND_BONUS_TURNS
    && m.braceTurns === 1 + ROOTBIND_BONUS_TURNS && m.guardTurns === 1 + ROOTBIND_BONUS_TURNS
    && m.defense === 1 + ROOTBIND_BONUS_TURNS && m.strikeTurns === 1 + ROOTBIND_BONUS_TURNS
    && m.taunt === 1 + ROOTBIND_BONUS_TURNS);
  eq('Rootbind leaves an absent effect (Regen 0) untouched', g.ranger.regen, 0);
  check('Rootbind excludes Interlock grants / once-armed flags / Boar / Charge',
    m.interlockGuardTurns[0] === 1 && m.empowerBonus === 1 && m.charge === 1 && m.boarTurns === 1);
}
{
  // Beacon of the Second Sun: a card-driven heal-to-full draws a card (no per-fight cap).
  const cfg = defaultBattleConfig(); cfg.relics = ['beaconOfSecondSun'];
  const g = new Game(690050, cfg); g.start(); g.mp = 20;
  g.tank.hp = g.tank.maxHP - 1;
  g.drawPile = [makeDeckCard('lowHeal', -1)];
  let idx = giveCard(g, 'highHeal'); let handBefore = g.hand.length;
  g.playCard(idx, SLOT.CENTER); // tops the tank off -> draw 1
  eq('Beacon draws on the first heal-to-full', g.hand.length - handBefore, BEACON_DRAW - 1);
  // A second top-off draws again (uncapped).
  g.mage.hp = g.mage.maxHP - 1;
  g.drawPile = [makeDeckCard('lowHeal', -2)];
  idx = giveCard(g, 'highHeal'); handBefore = g.hand.length;
  g.playCard(idx, SLOT.RIGHT);
  eq('Beacon draws again on a second heal-to-full (no cap)', g.hand.length - handBefore, BEACON_DRAW - 1);
}
{
  // Beacon does NOT fire on a Regen tick (direct-only), and is inert with no relic.
  const cfg = defaultBattleConfig(); cfg.relics = ['beaconOfSecondSun'];
  const g = new Game(690051, cfg); g.start();
  g.tank.hp = g.tank.maxHP - 5;
  const handBefore = g.hand.length;
  g._healMember(g.tank, 5); // the Regen-tick path (direct=false) — tops off but must NOT draw
  eq('a Regen-tick heal-to-full does not trigger Beacon', g.hand.length, handBefore);
  eq('the tick still healed to full', g.tank.hp, g.tank.maxHP);
  const g2 = new Game(690052); g2.start(); // no relics
  g2.mage.hp = g2.mage.maxHP - 5;
  const hb2 = g2.hand.length;
  g2._applyHeal(g2.mage, 5, true); // direct heal-to-full, but Beacon not owned
  eq('Beacon is inert with no relic', g2.hand.length, hb2);
}
{
  // Twin Censer: a single-target heal card also heals the most wounded OTHER member.
  const cfg = defaultBattleConfig(); cfg.relics = ['twinCenser'];
  const g = new Game(690060, cfg); g.start(); g.mp = 20;
  g.tank.hp = g.tank.maxHP;         // heal target
  g.ranger.hp = g.ranger.maxHP;     // healthy -> not the splash target
  g.mage.hp = g.mage.maxHP - 3;     // most wounded other
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('Twin Censer splashes to the most wounded other', g.mage.hp, g.mage.maxHP - 3 + TWIN_CENSER_SPLASH);
}
{
  // The Twin Censer splash routes through the heal pipeline: Field Triage boosts it.
  const cfg = defaultBattleConfig(); cfg.relics = ['twinCenser', 'fieldTriage'];
  const g = new Game(690061, cfg); g.start(); g.mp = 20;
  g.tank.hp = g.tank.maxHP;
  g.ranger.hp = g.ranger.maxHP;
  g.mage.hp = 2; // below half of 9 -> Field Triage adds to the splash
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER);
  eq('Twin Censer splash is boosted by Field Triage', g.mage.hp - 2, TWIN_CENSER_SPLASH + FIELD_TRIAGE_BONUS);
}
{
  // The Twin Censer splash can itself trigger Beacon (topping the other to full draws).
  const cfg = defaultBattleConfig(); cfg.relics = ['twinCenser', 'beaconOfSecondSun'];
  const g = new Game(690062, cfg); g.start(); g.mp = 20;
  g.tank.hp = g.tank.maxHP;         // primary heal lands full (heal 0)
  g.ranger.hp = g.ranger.maxHP;
  g.mage.hp = g.mage.maxHP - 1;     // splash 1 tops it off -> Beacon draws
  g.drawPile = [makeDeckCard('lowHeal', -1)];
  const idx = giveCard(g, 'lowHeal'); const handBefore = g.hand.length;
  g.playCard(idx, SLOT.CENTER);
  eq('Twin Censer splash-to-full triggers Beacon', g.hand.length - handBefore, BEACON_DRAW - 1);
}
{
  // No splash on a non-heal single-target card (regen), and inert with no relic.
  const cfg = defaultBattleConfig(); cfg.relics = ['twinCenser'];
  const g = new Game(690063, cfg); g.start(); g.mp = 20;
  g.mage.hp = g.mage.maxHP - 3;
  g.playCard(giveCard(g, 'regen'), SLOT.CENTER); // single, but not a heal card -> no splash
  eq('Twin Censer does not splash on a non-heal single-target card', g.mage.hp, g.mage.maxHP - 3);
  const g2 = new Game(690064); g2.start(); g2.mp = 20; // no relics
  g2.tank.hp = g2.tank.maxHP; g2.mage.hp = g2.mage.maxHP - 3;
  g2.playCard(giveCard(g2, 'lowHeal'), SLOT.CENTER);
  eq('Twin Censer is inert with no relic', g2.mage.hp, g2.mage.maxHP - 3);
}
{
  // Pilgrim's Flask (#71): a zero-card Rest heals the MOST WOUNDED living member and
  // touches no MP — the +5 zero-card regen is unchanged. (Scoped from all-members to
  // the single most-wounded to fit the ≤+9pp relic gate; see engine skipTurn.)
  const cfg = defaultBattleConfig(); cfg.relics = ['pilgrimsFlask'];
  const g = new Game(710071, cfg); g.start(); g.mp = 0;
  g.tank.hp = g.tank.maxHP - 1; g.ranger.hp = 2; g.mage.hp = g.mage.maxHP; // ranger is the most wounded
  eq('zero-card Rest still regens the full amount (Flask adds no MP)', g.restRegenNow(), SKIP_REGEN);
  g.skipTurn(); // the enemy phase after may re-touch HP, so assert the heal through the log
  eq('the Rest still granted exactly SKIP_REGEN MP', g.mp, SKIP_REGEN);
  eq('Flask healed the most wounded member (once)', g.log.filter((e) => e.text.includes("Pilgrim's Flask")).length, 1);
  check('Flask healed the most wounded member for the flask amount', g.log.some((e) => e.text.includes(`Pilgrim's Flask heals ${g.ranger.name} ${PILGRIM_FLASK_HEAL}.`)));
}
{
  // Decayed Rest (one card played) still fires the Flask, and no MP is added beyond
  // the decayed +1. Play a cheap card first, then Rest.
  const cfg = defaultBattleConfig(); cfg.relics = ['pilgrimsFlask'];
  const g = new Game(710072, cfg); g.start(); g.mp = 5;
  g.ranger.hp = g.ranger.maxHP - 2; // the only wounded member (the played heal won't top it off)
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // 1 card -> decayed Rest available
  eq('one-card Rest regens the decayed amount', g.restRegenNow(), SKIP_REGEN_DECAYED);
  const mpBefore = g.mp;
  g.skipTurn();
  eq('decayed Rest adds only the decayed MP (Flask adds none)', g.mp - mpBefore, SKIP_REGEN_DECAYED);
  check('Flask fired on the decayed Rest', g.log.some((e) => e.text.includes("Pilgrim's Flask")));
}
{
  // Flask heal routes through the pipeline: a member below half gets the Field Triage
  // boost on the Rest top-off.
  const cfg = defaultBattleConfig(); cfg.relics = ['pilgrimsFlask', 'fieldTriage'];
  const g = new Game(710073, cfg); g.start(); g.mp = 0;
  g.tank.hp = 1; // below half of maxHP and the most wounded -> Field Triage adds to the Flask heal
  g.ranger.hp = g.ranger.maxHP; g.mage.hp = g.mage.maxHP;
  g.skipTurn();
  check('Flask heal is boosted by Field Triage', g.log.some((e) => e.text.includes("Pilgrim's Flask heals") && e.text.includes(String(PILGRIM_FLASK_HEAL + FIELD_TRIAGE_BONUS))));
}
{
  // A fully healthy party: no wounded member, so the Flask no-ops (inert-when-none).
  const cfg = defaultBattleConfig(); cfg.relics = ['pilgrimsFlask'];
  const g = new Game(710075, cfg); g.start(); g.mp = 0;
  g.tank.hp = g.tank.maxHP; g.ranger.hp = g.ranger.maxHP; g.mage.hp = g.mage.maxHP; // undo any opening-strike scratch
  g.skipTurn();
  eq('Flask no-ops when nobody is wounded', g.log.filter((e) => e.text.includes("Pilgrim's Flask")).length, 0);
}
{
  // Inert gate: no relic -> a Rest heals nobody and MP behaves exactly as before.
  const g = new Game(710074); g.start(); g.mp = 0;
  g.tank.hp = g.tank.maxHP - 3;
  const hpBefore = g.tank.hp;
  g.skipTurn();
  eq('no Flask log with no relic', g.log.filter((e) => e.text.includes("Pilgrim's Flask")).length, 0);
  check('a member is not healed by a bare Rest (only the enemy phase touches HP)', g.tank.hp <= hpBefore);
  eq('the bare Rest still grants SKIP_REGEN MP', g.mp, SKIP_REGEN);
  eq("Pilgrim's Flask is a common, non-curse relic", RELICS.pilgrimsFlask.rarity === 'common' && RELICS.pilgrimsFlask.curse !== true, true);
}
{
  // Definitions / typing sanity for the five new cards and two relics (#69).
  const holy: CardId[] = ['benediction', 'sunriseVigil', 'consecration', 'absolution'];
  check('the four new Holy cards are Holy', holy.every((id) => cardType(id) === 'holy'));
  eq('Rootbind is Nature', cardType('rootbind'), 'nature');
  const all: CardId[] = [...holy, 'rootbind'];
  check('all five count toward their type bucket', all.every((id) => cardsOfType(cardType(id)).includes(id)));
  check('all five are shop/reward-eligible', all.every((id) => CARD_POOL.includes(id)));
  check('all five carry a rarity', all.every((id) => CARD_RARITY[id] != null));
  eq('Benediction heal base', CARDS.benediction.heal, BENEDICTION_HEAL);
  eq('Consecration heal', CARDS.consecration.heal, CONSECRATION_HEAL);
  eq('Absolution heal', CARDS.absolution.heal, ABSOLUTION_HEAL);
  eq('Sunrise Vigil targets none', CARDS.sunriseVigil.target, 'none');
  eq('Consecration targets all', CARDS.consecration.target, 'all');
  check('Beacon / Twin Censer are real relics', (['beaconOfSecondSun', 'twinCenser'] as RelicId[]).every((id) => RELIC_IDS.includes(id)));
  check('neither new relic is a curse', RELICS.beaconOfSecondSun.curse !== true && RELICS.twinCenser.curse !== true);
}

// --- Hierophant + Liturgy (#73): channel dual cadence -----------------------
// A benign channel fight (mirrors channelGame) but with a Hierophant fielded so its
// Liturgy ability card is playable. Hierophant seats LEFT; tank CENTER, mage RIGHT.
function liturgyGame(seed: number): Game {
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['hierophant', 'tank', 'mage']);
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
  const g = new Game(seed, cfg); g.start();
  g.members.forEach((m) => { m.maxHP = 100; m.hp = 100; m.alive = true; m.shield = false; m.shieldTurns = 0; });
  g.enemy.maxHP = 100000; g.enemy.hp = 100000;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  g.maxMana = 40; g.mp = 40; g.passiveMp = 0; g.enrageTurn = 9999;
  return g;
}
{
  // Definitions / typing sanity for the member and the ability card (#73).
  eq('Hierophant is in MEMBER_POOL', MEMBER_POOL.hierophant?.id, 'hierophant');
  eq('Hierophant maxHP 9', MEMBER_POOL.hierophant.maxHP, 9);
  eq('Hierophant damage 2', MEMBER_POOL.hierophant.damage, 2);
  eq('Hierophant ability is liturgy', MEMBER_POOL.hierophant.ability, 'liturgy');
  eq('Hierophant base salary 16', MEMBER_BASE_SALARY.hierophant, 16);
  check('Hierophant is in the draft pool', DRAFT_POOL.includes('hierophant'));
  check('Hierophant has an ability flavor mentioning Liturgy', /Liturgy/.test(MEMBER_ABILITY_FLAVOR.hierophant ?? ''));
  eq('liturgy is the Hierophant\'s bound ability card', ABILITY_CARD.liturgy, 'liturgy');
  eq('Liturgy is Arcane', cardType('liturgy'), 'arcane');
  check('Liturgy counts toward the Arcane bucket (Cascade reads it)', cardsOfType('arcane').includes('liturgy'));
  eq('Liturgy costs 2', CARDS.liturgy.cost, 2);
  eq('Liturgy targets none', CARDS.liturgy.target, 'none');
  eq('Liturgy needs an active channel', CARDS.liturgy.needsChannel, true);
  eq('Liturgy is uncommon', CARD_RARITY.liturgy, 'uncommon');
  check('Liturgy is an ability card (never shopped)', isAbilityCard('liturgy') && !CARD_POOL.includes('liturgy'));
}
{
  // Liturgy is a dead cast with no channel running (needsChannel gate, no-dead-cast UX).
  const g = liturgyGame(730);
  eq('Liturgy is unplayable with no active channel', g.canPlay(giveCard(g, 'liturgy'), null), 'no active channel');
  // With a channel up it becomes playable; playing it does NOT break the channel and
  // arms dual cadence on the surviving channel.
  g.playCard(giveCard(g, 'drain'), null);
  check('Drain channel is running', g.channelActive() && g.channelCard === 'drain');
  check('dual cadence is off until Liturgy is cast', !g.channelDualCadence);
  eq('Liturgy is playable once a channel runs', g.canPlay(giveCard(g, 'liturgy'), null), null);
  g.playCard(giveCard(g, 'liturgy'), null);
  check('Liturgy does not break the channel it enhances', g.channelActive() && g.channelCard === 'drain');
  check('Liturgy arms dual cadence', g.channelDualCadence);
}
{
  // Liturgy is unplayable while the Hierophant is down (ability-member gate), even
  // with a channel running.
  const g = liturgyGame(731);
  g.playCard(giveCard(g, 'sap'), null);
  check('a channel is running', g.channelActive());
  g._killMember(g.members[SLOT.LEFT]); // the Hierophant
  eq('Liturgy is unplayable with the Hierophant down', g.canPlay(giveCard(g, 'liturgy'), null), 'that member is unavailable');
}
{
  // Sap + Liturgy: Vulnerability climbs TWO steps per held round (dual cadence), and the
  // duration decrements only ONCE per round (the player-phase tick).
  const g = liturgyGame(732);
  g.playCard(giveCard(g, 'sap'), null);   // cast tick: +1 step
  g.playCard(giveCard(g, 'liturgy'), null);
  eq('Sap cast adds one Vulnerability step', g.enemy.vulnerable, SAP_VULN_PER_TICK);
  g.endTurn();                            // close the cast turn (2 cards played — no tick)
  const turnsBefore = g.channelTurns, vulnBefore = g.enemy.vulnerable;
  g.endTurn();                            // hold one round: dual + normal tick
  eq('the duration decrements exactly once per round', turnsBefore - g.channelTurns, 1);
  eq('Sap climbs two steps per round under dual cadence',
    g.enemy.vulnerable, Math.min(SAP_VULN_CAP, vulnBefore + 2 * SAP_VULN_PER_TICK));
}
{
  // Sap + Liturgy total ticks ≈ 2× duration: one cast tick + two ticks per held round
  // for the remaining duration = 2*SAP_MAX_TURNS - 1 pulses.
  const g = liturgyGame(733);
  g.playCard(giveCard(g, 'sap'), null);   // cast tick
  let pulses = countPulses(g);            // count the cast pulse now (playing Liturgy resets events)
  g.playCard(giveCard(g, 'liturgy'), null);
  g.endTurn();                            // close the cast turn (2 cards played — no tick)
  for (let i = 0; i < SAP_MAX_TURNS + 3 && g.channelActive(); i++) {
    g.endTurn();                          // hold: dual + normal tick each round
    pulses += countPulses(g);
  }
  eq('Sap + Liturgy ticks ≈ 2× duration', pulses, 2 * SAP_MAX_TURNS - 1);
  check('the channel still ends on its own at the (undoubled) duration cap', !g.channelActive());
}
{
  // Drain + Liturgy: a held round deals Drain's damage TWICE (dual cadence doubles it).
  const g = liturgyGame(734);
  g.members.forEach((m) => { m.damage = 0; }); // silence party autos so only Drain moves enemy HP
  g.playCard(giveCard(g, 'drain'), null); // cast tick: one Drain hit
  g.playCard(giveCard(g, 'liturgy'), null);
  g.endTurn();                            // close the cast turn (no tick — 2 cards played)
  const before = g.enemy.hp;
  g.mp = 40;                              // room so MP return doesn't gate the damage path
  g.endTurn();                            // hold: dual + normal Drain tick
  eq('Drain deals double damage in a dual-cadence round', before - g.enemy.hp, 2 * DRAIN_DMG);
}
{
  // Refresh + Liturgy: MP is restored TWICE per held round (legal channel income).
  const g = liturgyGame(735);
  g.mp = CARDS.refresh.cost;
  g.playCard(giveCard(g, 'refresh'), null);
  g.playCard(giveCard(g, 'liturgy'), null);
  g.endTurn();                            // close the cast turn (no tick)
  g.mp = 0;
  g.endTurn();                            // hold: dual + normal Refresh tick
  eq('Refresh restores its MP twice per dual-cadence round', g.mp, 2 * REFRESH_CHANNEL_MP);
}
{
  // Fortify + Liturgy: the pre-blow enemy-phase tick puts the Shield up before the blow
  // resolves, and the telegraph preview reflects it (preview == applied).
  const g = liturgyGame(736);
  const tank = g.members[SLOT.CENTER];
  g.playCard(giveCard(g, 'fortify'), tank.slot);
  g.playCard(giveCard(g, 'liturgy'), null);
  check('Fortify shields on the cast tick', tank.shield === true);
  g.endTurn();                            // close the cast turn (no tick)
  tank.shield = false; tank.shieldTurns = 0; // consume the standing Shield
  // A known single-target blow aimed at the Fortify target, still with no Shield up.
  g.telegraph = { type: 'single', hidden: false, damage: 6, targets: [tank.slot], enraged: false, forTurn: g.turn, turnsUntilResolve: 1 };
  const preview = g.attackTargets().find((s) => s.slot === tank.slot)?.damage ?? -1;
  eq('the preview folds in the pending pre-blow Fortify shield (0 damage)', preview, 0);
  const hpBefore = tank.hp;
  g.endTurn();                            // hold: dual/normal Fortify tick shields before the blow
  eq('the pre-blow shield absorbs the telegraphed hit that same round', tank.hp, hpBefore);
  eq('preview == applied for the shielded blow', preview, hpBefore - tank.hp);
}
{
  // Mending Stream + Liturgy on a target that dies mid-round: the channel ends and there
  // is no orphan tick (neither the dual cadence tick nor the normal tick fires).
  const g = liturgyGame(737);
  const tank = g.members[SLOT.CENTER];
  tank.hp = 1;
  g.playCard(giveCard(g, 'mendingStream'), tank.slot);
  g.playCard(giveCard(g, 'liturgy'), null);
  check('Mending Stream is dual-cadenced and running', g.channelActive() && g.channelDualCadence);
  g.endTurn();                            // close the cast turn
  g._killMember(tank);                    // the remembered target dies before the enemy phase
  g.events = [];
  g.endTurn();                            // hold: the tick sees the dead target and ends the channel
  check('the channel ended with its target', !g.channelActive());
  check('dual cadence cleared with the channel', !g.channelDualCadence);
  eq('no orphan tick fired', countPulses(g), 0);
}
{
  // Break rules unchanged: a non-exempt card play ends the channel AND its dual cadence.
  const g = liturgyGame(738);
  g.playCard(giveCard(g, 'sap'), null);
  g.playCard(giveCard(g, 'liturgy'), null);
  check('dual cadence armed', g.channelDualCadence);
  g.playCard(giveCard(g, 'lowHeal'), SLOT.CENTER); // a plain, non-exempt card
  check('a non-exempt play breaks the channel', !g.channelActive());
  check('and clears dual cadence with it', !g.channelDualCadence);
}
{
  // Attunement (#70) exemption keeps BOTH the channel and its dual cadence alive.
  const g = liturgyGame(739);
  g.playCard(giveCard(g, 'sap'), null);
  g.playCard(giveCard(g, 'liturgy'), null);
  g.drawPile = [makeDeckCard('lowHeal', 950)];
  g.playCard(giveCard(g, 'attunement'), null); // exempt: keeps the channel
  check('the channel survives Attunement', g.channelActive() && g.channelCard === 'sap');
  check('dual cadence survives Attunement', g.channelDualCadence);
}
{
  // Starting a NEW channel after a dual-cadenced one resets to normal cadence.
  const g = liturgyGame(740);
  g.playCard(giveCard(g, 'sap'), null);
  g.playCard(giveCard(g, 'liturgy'), null);
  check('dual cadence armed on the first channel', g.channelDualCadence);
  g.playCard(giveCard(g, 'drain'), null); // a channel card replaces the old channel
  check('the new channel replaced the old', g.channelActive() && g.channelCard === 'drain');
  check('the new channel starts on normal cadence', !g.channelDualCadence);
}
{
  // Recasting Liturgy while already dual-cadenced is a harmless no-op (idempotent).
  const g = liturgyGame(741);
  g.playCard(giveCard(g, 'sap'), null);
  g.playCard(giveCard(g, 'liturgy'), null);
  const turns = g.channelTurns;
  g.playCard(giveCard(g, 'liturgy'), null); // recast: still exempt, still dual, no tick
  check('still the same channel, still dual-cadenced', g.channelActive() && g.channelDualCadence);
  eq('a recast does not tick or advance the channel', g.channelTurns, turns);
}

// --- Duelist + En Garde (#74): persistent Riposte stance ---------------------
// A benign fight with a Duelist fielded so her En Garde ability card is playable.
// Duelist seats LEFT (slot 0); tank CENTER, mage RIGHT. HP/enemy tuned so nobody dies
// and counters never actually finish the enemy.
function duelistGame(seed: number): Game {
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['duelist', 'tank', 'mage']);
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
  const g = new Game(seed, cfg); g.start();
  g.members.forEach((m) => { m.maxHP = 100; m.hp = 100; m.alive = true; m.shield = false; m.shieldTurns = 0; });
  g.enemy.maxHP = 100000; g.enemy.hp = 100000;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  g.maxMana = 40; g.mp = 40; g.passiveMp = 0; g.enrageTurn = 9999;
  return g;
}
// A one-hit single-target telegraph aimed at a slot (matches the Riposte-test shape).
function hitAt(g: Game, slots: number[], damage: number): void {
  g.telegraph = { type: slots.length > 1 ? 'aoe' : 'single', hidden: false, damage, targets: slots as Slot[], enraged: false, forTurn: g.turn };
}
{
  // Definitions / typing sanity for the member and the ability card (#74).
  eq('Duelist is in MEMBER_POOL', MEMBER_POOL.duelist?.id, 'duelist');
  eq('Duelist maxHP 12', MEMBER_POOL.duelist.maxHP, 12);
  eq('Duelist damage 3', MEMBER_POOL.duelist.damage, 3);
  eq('Duelist ability is enGarde', MEMBER_POOL.duelist.ability, 'enGarde');
  eq('Duelist base salary 15', MEMBER_BASE_SALARY.duelist, 15);
  check('Duelist is in the draft pool', DRAFT_POOL.includes('duelist'));
  check('Duelist has an ability flavor mentioning En Garde', /En Garde/.test(MEMBER_ABILITY_FLAVOR.duelist ?? ''));
  eq('enGarde is the Duelist\'s bound ability card', ABILITY_CARD.enGarde, 'enGarde');
  eq('En Garde is Iron', cardType('enGarde'), 'iron');
  check('En Garde counts toward the Iron bucket (Iron Ward\'s discount reads it)', cardsOfType('iron').includes('enGarde'));
  eq('En Garde costs 2', CARDS.enGarde.cost, 2);
  eq('En Garde targets single (the first single-target ability card)', CARDS.enGarde.target, 'single');
  eq('En Garde is uncommon', CARD_RARITY.enGarde, 'uncommon');
  check('En Garde is an ability card (never shopped)', isAbilityCard('enGarde') && !CARD_POOL.includes('enGarde'));
}
{
  // Single-target ability card: needs a living pick; arms the stance on the chosen member.
  const g = duelistGame(740);
  eq('En Garde needs a living target', g.canPlay(giveCard(g, 'enGarde'), null), 'target must be a living member');
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT); // grant to herself
  eq('En Garde arms the stance on the chosen member', g.members[SLOT.LEFT].riposteTurns, EN_GARDE_TURNS);
  // The targeting departure: the Duelist can place the stance on ANOTHER member.
  const g2 = duelistGame(741);
  g2.playCard(giveCard(g2, 'enGarde'), SLOT.CENTER);
  eq('En Garde can be placed on another member (the tank)', g2.members[SLOT.CENTER].riposteTurns, EN_GARDE_TURNS);
  check('granting it elsewhere leaves the Duelist herself un-stanced', g2.members[SLOT.LEFT].riposteTurns === 0);
}
{
  // Unplayable while the Duelist is down (ability-member gate wins over targeting).
  const g = duelistGame(742);
  g._killMember(g.members[SLOT.LEFT]); // the Duelist
  eq('En Garde is unplayable with the Duelist down', g.canPlay(giveCard(g, 'enGarde'), SLOT.CENTER), 'that member is unavailable');
}
{
  // En Garde + a Feint-style two-hit sweep into the Duelist → TWO counters, each at her
  // live auto damage (multi-hit resolution: N hits => N counters in one phase).
  const g = duelistGame(743);
  const duelist = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  const dmg = g.memberDamage(duelist);
  g.telegraph = { type: 'two', hidden: false, damage: 3, targets: [SLOT.LEFT, SLOT.LEFT], enraged: false, forTurn: g.turn };
  const before = g.enemy.hp;
  g._resolveAttack();
  eq('a two-hit sweep into the stance-holder draws two counters', before - g.enemy.hp, 2 * dmg);
}
{
  // The counter is the defender's LIVE auto: Sharpen (+1) and Anvil Stance (+2 while
  // shielded) both fold in, and the Anvil payoff survives the very hit that spends the
  // Shield (captured before the block resolves — the #65 "bigger block, bigger payoff").
  const g = duelistGame(744);
  const duelist = g.members[SLOT.LEFT];
  const base = g.memberDamage(duelist);
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  g.playCard(giveCard(g, 'sharpen'), SLOT.LEFT);      // +SHARPEN_BONUS
  g.playCard(giveCard(g, 'anvilStance'), SLOT.LEFT);  // +ANVIL_STANCE_BONUS while shielded
  g.playCard(giveCard(g, 'shield'), SLOT.LEFT);       // the hold Anvil needs
  const expected = base + SHARPEN_BONUS + ANVIL_STANCE_BONUS;
  eq('Sharpen + Anvil-while-shielded fold into the live auto', g.memberDamage(duelist), expected);
  hitAt(g, [SLOT.LEFT], 5); // a damaging hit the Shield fully blocks
  const before = g.enemy.hp;
  g._resolveAttack();
  eq('the counter carries Sharpen + Anvil even on the blocking hit', before - g.enemy.hp, expected);
  check('the blocking hit spent the Shield', !duelist.shield);
}
{
  // A fully Shield-blocked hit still counters, and Whetstone still sees her as untouched
  // (a 0-damage block never sets the took-damage flag).
  const g = duelistGame(745);
  const duelist = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  g.playCard(giveCard(g, 'shield'), SLOT.LEFT);
  const dmg = g.memberDamage(duelist);
  hitAt(g, [SLOT.LEFT], 4);
  const before = g.enemy.hp; const hpBefore = duelist.hp;
  g._resolveAttack();
  eq('a fully Shield-blocked hit still counters', before - g.enemy.hp, dmg);
  eq('the blocked hit dealt no damage', duelist.hp, hpBefore);
  check('Whetstone still sees her as untouched (no took-damage flag)', !duelist.tookDamageLastEnemyPhase);
}
{
  // Stance + one-shot Riposte: the timed stance SUPERSEDES — exactly one counter per hit,
  // and the one-shot is neither consumed nor double-triggered while the stance runs.
  const g = duelistGame(746);
  const duelist = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  g.playCard(giveCard(g, 'riposte'), SLOT.LEFT);
  check('one-shot Riposte is armed alongside the stance', duelist.riposte && duelist.riposteTurns > 0);
  const dmg = g.memberDamage(duelist);
  hitAt(g, [SLOT.LEFT], 4);
  const before = g.enemy.hp;
  g._resolveAttack();
  eq('exactly one counter fires (no double-trigger)', before - g.enemy.hp, dmg);
  check('the one-shot Riposte is NOT consumed while the stance runs', duelist.riposte);
}
{
  // Timer: counters on enemy turns 1 and 2, none on turn 3 (decrements with _decayBuffs,
  // which runs AFTER the attack — so the stance fires on the turn it also decays).
  const g = duelistGame(747);
  const duelist = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  const dmg = g.memberDamage(duelist);
  const oneTurn = (): number => {
    hitAt(g, [SLOT.LEFT], 3);
    const before = g.enemy.hp;
    g._resolveAttack();
    g._decayBuffs();
    return before - g.enemy.hp;
  };
  eq('enemy turn 1 counters', oneTurn(), dmg);
  eq('enemy turn 2 counters', oneTurn(), dmg);
  eq('enemy turn 3 does not counter (stance expired)', oneTurn(), 0);
  check('the stance timer is spent', duelist.riposteTurns === 0);
}
{
  // Death ends the stance immediately.
  const g = duelistGame(748);
  const duelist = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  check('stance armed', duelist.riposteTurns > 0);
  g._killMember(duelist);
  check('death ends the En Garde stance', duelist.riposteTurns === 0);
}
{
  // An AoE hitting the whole party triggers ONLY the members holding the stance.
  const g = duelistGame(749);
  const duelist = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT); // only the Duelist holds it
  const dmg = g.memberDamage(duelist);
  hitAt(g, [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT], 3);
  const before = g.enemy.hp;
  g._resolveAttack();
  eq('an AoE draws one counter — only the stance-holder answers', before - g.enemy.hp, dmg);
}
{
  // The stance is party->enemy only: it never perturbs the telegraph preview
  // (preview == applied for the member), and it moves enemy HP.
  const g = duelistGame(750);
  const duelist = g.members[SLOT.LEFT];
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  hitAt(g, [SLOT.LEFT], 4);
  const preview = g.attackTargets().find((s) => s.slot === SLOT.LEFT)?.damage ?? -1;
  const hpBefore = duelist.hp; const enemyBefore = g.enemy.hp;
  g._resolveAttack();
  eq('the stance leaves the telegraph preview intact (preview == applied to the member)', preview, hpBefore - duelist.hp);
  check('the counter moved enemy HP (party->enemy only)', g.enemy.hp < enemyBefore);
}

// --- Flagellant + Penance (#75): the lethal blood battery --------------------
// A fight with a Flagellant fielded so his Penance ability card is playable.
// Flagellant seats LEFT (slot 0); tank CENTER, mage RIGHT. Enemy HP is huge so the
// buffed autos never actually finish it; per-test HP is set on the Flagellant directly.
function flagellantGame(seed: number, relics: RelicId[] = []): Game {
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['flagellant', 'tank', 'mage']);
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
  cfg.relics = relics;
  const g = new Game(seed, cfg); g.start();
  g.members.forEach((m) => { m.shield = false; m.shieldTurns = 0; });
  g.enemy.maxHP = 100000; g.enemy.hp = 100000;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  g.maxMana = 40; g.mp = 40; g.passiveMp = 0; g.enrageTurn = 9999;
  return g;
}
{
  // Definitions / typing sanity for the member and the ability card (#75).
  eq('Flagellant is in MEMBER_POOL', MEMBER_POOL.flagellant?.id, 'flagellant');
  eq('Flagellant maxHP 15', MEMBER_POOL.flagellant.maxHP, 15);
  eq('Flagellant damage 2 (weak swing)', MEMBER_POOL.flagellant.damage, 2);
  eq('Flagellant ability is penance', MEMBER_POOL.flagellant.ability, 'penance');
  eq('Flagellant base salary 14', MEMBER_BASE_SALARY.flagellant, 14);
  check('Flagellant is in the draft pool', DRAFT_POOL.includes('flagellant'));
  check('Flagellant has an ability flavor mentioning Penance', /Penance/.test(MEMBER_ABILITY_FLAVOR.flagellant ?? ''));
  eq('penance is the Flagellant\'s bound ability card', ABILITY_CARD.penance, 'penance');
  eq('Penance is Blood', cardType('penance'), 'blood');
  check('Penance counts toward the blood bucket (incite precedent)', cardsOfType('blood').includes('penance'));
  eq('Penance costs 2', CARDS.penance.cost, 2);
  eq('Penance targets none', CARDS.penance.target, 'none');
  eq('Penance carries NO selfDamage field (payment is a raw drain, not the clamped gate)', CARDS.penance.selfDamage, undefined);
  eq('Penance is uncommon', CARD_RARITY.penance, 'uncommon');
  check('Penance is an ability card (never shopped)', isAbilityCard('penance') && !CARD_POOL.includes('penance'));
}
{
  // Survive branch: at 15 HP the payment leaves him at 11, and every LIVING member's
  // auto (his own included, since he lives) gains +PENANCE_STRIKE_BONUS this turn.
  const g = flagellantGame(750);
  const flag = g.members[SLOT.LEFT];
  const baseFlag = g.memberDamage(flag);
  const baseTank = g.memberDamage(g.members[SLOT.CENTER]);
  eq('Flagellant opens at full 15 HP', flag.hp, 15);
  g.playCard(giveCard(g, 'penance'), null);
  eq('Penance pays PENANCE_HP with no clamp: 15 -> 11', flag.hp, 15 - PENANCE_HP);
  check('the payment left him alive (5+ HP survives)', flag.alive);
  eq('his own auto is buffed (he survived)', g.memberDamage(flag), baseFlag + PENANCE_STRIKE_BONUS);
  eq('every other living member is buffed too', g.memberDamage(g.members[SLOT.CENTER]), baseTank + PENANCE_STRIKE_BONUS);
}
{
  // Die branch: at PENANCE_HP or less the cast KILLS him — the full standard death
  // pipeline runs (diedThisFight scar bookkeeping, hp 0, not alive) — and the party
  // still gets the +2 fury on their autos (his own does not count; he is dead).
  const g = flagellantGame(751);
  const flag = g.members[SLOT.LEFT];
  const baseTank = g.memberDamage(g.members[SLOT.CENTER]);
  flag.hp = PENANCE_HP; // exactly the payment — a lethal cast
  const res = g.playCard(giveCard(g, 'penance'), null);
  check('the lethal cast was legal (no HP playability gate)', res.ok);
  check('the Flagellant died', !flag.alive);
  eq('he was drained to 0', flag.hp, 0);
  check('the death recorded a scar (diedThisFight bookkeeping)', g.diedThisFightSlots().includes(flag.slot));
  eq('the +2 buff still landed on the surviving party', g.memberDamage(g.members[SLOT.CENTER]), baseTank + PENANCE_STRIKE_BONUS);
  check('the party did not wipe (tank + mage stand)', g.status === 'playing');
}
{
  // Martyr's Icon (#22) converts the suicide to a 1-HP survival: the Icon triggers on
  // MEMBER DEATH, and a Penance suicide is a member death — intended, not special-cased.
  // The buff then includes him, because he lives.
  const g = flagellantGame(752, ['martyrsIcon']);
  const flag = g.members[SLOT.LEFT];
  const baseFlag = g.memberDamage(flag);
  check('the Icon starts unspent', !g.martyrUsed);
  flag.hp = PENANCE_HP; // would be lethal without the Icon
  g.playCard(giveCard(g, 'penance'), null);
  check('the Icon saved him — he survives', flag.alive);
  eq('he clings to life at 1 HP', flag.hp, 1);
  check('the Icon is now spent', g.martyrUsed);
  check('no scar recorded — a Martyr save is not a death', !g.diedThisFightSlots().includes(flag.slot));
  eq('the buff includes him (he lives)', g.memberDamage(flag), baseFlag + PENANCE_STRIKE_BONUS);
}
{
  // Sanguine Pact (#68 curse) raises the payment by its blood-cost rider — the surcharge
  // rides this Blood ABILITY card too (documented scope call). Starting at 13, paying
  // PENANCE_HP + surcharge = 6 leaves him at 7 (< 50% of 15), opening the Pact's window.
  const g = flagellantGame(753, ['sanguinePact']);
  const flag = g.members[SLOT.LEFT];
  const baseTank = g.members[SLOT.CENTER].damage; // raw, before any party-wide bonuses
  flag.hp = 13;
  g.playCard(giveCard(g, 'penance'), null);
  eq('the surcharge raised the payment to 6 (13 -> 7)', flag.hp, 13 - (PENANCE_HP + SANGUINE_PACT_SURCHARGE));
  check('the below-50% window is now open', g.livingMembers().some((m) => m.hp < m.maxHP * SANGUINE_PACT_THRESHOLD));
  // The tank's auto now carries BOTH the Penance +2 and the Sanguine below-threshold +2.
  eq('Penance and the Sanguine window both buff the tank auto', g.memberDamage(g.members[SLOT.CENTER]),
    baseTank + PENANCE_STRIKE_BONUS + SANGUINE_PACT_AUTO_BONUS);
}
{
  // The Penance buff is its OWN field, additive with Battle Hymn in the same turn
  // (not max-ed against it): the tank auto gains HYMN_BONUS + PENANCE_STRIKE_BONUS.
  const g = flagellantGame(754);
  const tank = g.members[SLOT.CENTER];
  const base = tank.damage;
  g.playCard(giveCard(g, 'battleHymn'), null);
  g.playCard(giveCard(g, 'penance'), null);
  eq('Penance stacks additively with Battle Hymn', g.memberDamage(tank), base + HYMN_BONUS + PENANCE_STRIKE_BONUS);
}
{
  // Party->enemy surface only: the buff is a one-phase field that resets after the
  // party autos resolve (like Battle Hymn) — it never leaks into the next turn, and
  // never touches the enemy's telegraph.
  const g = flagellantGame(755);
  g.playCard(giveCard(g, 'penance'), null);
  check('penanceBonus is live this phase', g.penanceBonus === PENANCE_STRIKE_BONUS);
  g._runPartyPhase();
  check('the buff resets after the party autos resolve (one-phase, like Hymn)', g.penanceBonus === 0);
}
{
  // #79 floats: a party-wide +ATK buff resolves to a per-member payload (slots) the
  // animator fans a `+N ATK` float over. Battle Hymn buffs every living member.
  const g = flagellantGame(760);
  g.events = [];
  g.playCard(giveCard(g, 'battleHymn'), null);
  const hymn = g.events.find((e) => e.kind === 'hymn') as Extract<GameEvent, { kind: 'hymn' }>;
  check('Battle Hymn emits a hymn event', !!hymn);
  eq('the hymn carries its bonus', hymn.bonus, HYMN_BONUS);
  eq('the hymn fans over every living member', hymn.slots.slice().sort().join(','),
    g.livingMembers().map((m) => m.slot).sort().join(','));
}
{
  // #79 floats: Penance carries the living members it buffs (slots) plus the payer's
  // own slot for the `PENANCE PAID` flag when the payment kills him.
  const g = flagellantGame(761);
  const flag = g.members[SLOT.LEFT];
  flag.hp = PENANCE_HP; // a lethal payment
  g.events = [];
  g.playCard(giveCard(g, 'penance'), null);
  const pen = g.events.find((e) => e.kind === 'penance') as Extract<GameEvent, { kind: 'penance' }>;
  check('Penance emits a penance event', !!pen);
  check('the dead payer is flagged', pen.died && pen.slot === flag.slot);
  check('the buffed slots are the living members only (payer excluded)',
    !pen.slots.includes(flag.slot) && pen.slots.length === g.livingMembers().length);
}

// --- Lightkeeper + Radiance (#76): overheal-as-mitigation --------------------
// A fight with a Lightkeeper fielded so her Radiance ability card is playable.
// Lightkeeper seats LEFT (slot 0); tank CENTER, mage RIGHT. Enemy HP is huge and
// enrage disabled so nothing interferes; per-test HP is set on the members directly.
function lightkeeperGame(seed: number, relics: RelicId[] = []): Game {
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['lightkeeper', 'tank', 'mage']);
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
  cfg.relics = relics;
  const g = new Game(seed, cfg); g.start();
  g.members.forEach((m) => { m.shield = false; m.shieldTurns = 0; m.brace = false; m.braceAmount = 0; m.braceTurns = 0; });
  g.enemy.maxHP = 100000; g.enemy.hp = 100000;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0;
  g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  g.maxMana = 40; g.mp = 40; g.passiveMp = 0; g.enrageTurn = 9999;
  return g;
}
{
  // Definitions / typing sanity for the member and the ability card (#76).
  eq('Lightkeeper is in MEMBER_POOL', MEMBER_POOL.lightkeeper?.id, 'lightkeeper');
  eq('Lightkeeper maxHP 11', MEMBER_POOL.lightkeeper.maxHP, 11);
  eq('Lightkeeper damage 2 (support body)', MEMBER_POOL.lightkeeper.damage, 2);
  eq('Lightkeeper ability is radiance', MEMBER_POOL.lightkeeper.ability, 'radiance');
  eq('Lightkeeper base salary 15', MEMBER_BASE_SALARY.lightkeeper, 15);
  check('Lightkeeper is in the draft pool', DRAFT_POOL.includes('lightkeeper'));
  check('Lightkeeper has an ability flavor mentioning Radiance', /Radiance/.test(MEMBER_ABILITY_FLAVOR.lightkeeper ?? ''));
  eq('radiance is the Lightkeeper\'s bound ability card', ABILITY_CARD.radiance, 'radiance');
  eq('Radiance is Holy', cardType('radiance'), 'holy');
  check('Radiance counts toward the holy bucket (Reliquary applies)', cardsOfType('holy').includes('radiance'));
  eq('Radiance costs 2', CARDS.radiance.cost, 2);
  eq('Radiance targets none', CARDS.radiance.target, 'none');
  eq('Radiance is uncommon', CARD_RARITY.radiance, 'uncommon');
  check('Radiance is an ability card (never shopped)', isAbilityCard('radiance') && !CARD_POOL.includes('radiance'));
}
{
  // Full topped party: heal lands as pure overheal, so every member gains Brace equal
  // to RADIANCE_HEAL and no HP changes. Casting again STACKS (Brace 2 -> 4) — the
  // additive carve-out (#76) from the Brace card's newest-replaces rule.
  const g = lightkeeperGame(760);
  g.members.forEach((m) => { m.hp = m.maxHP; });
  const hpBefore = g.members.map((m) => m.hp);
  g.playCard(giveCard(g, 'radiance'), null);
  check('no member changed HP (all were topped)', g.members.every((m, i) => m.hp === hpBefore[i]));
  check('every living member is braced', g.livingMembers().every((m) => m.brace));
  check('each Brace equals RADIANCE_HEAL', g.livingMembers().every((m) => m.braceAmount === RADIANCE_HEAL));
  check('brace timer set to the standard fade', g.livingMembers().every((m) => m.braceTurns === BRACE_TURNS));
  g.playCard(giveCard(g, 'radiance'), null);
  check('a repeat cast STACKS Brace without limit (2 -> 4)', g.livingMembers().every((m) => m.braceAmount === 2 * RADIANCE_HEAL));
  check('brace timer refreshed on the addition', g.livingMembers().every((m) => m.braceTurns === BRACE_TURNS));
}
{
  // Mixed party: a deeply wounded member just heals (no overheal, no Brace); a member
  // exactly 1 below max gains +1 HP and Brace 1 (the 1 point of overheal).
  const g = lightkeeperGame(761);
  const lk = g.members[SLOT.LEFT], tank = g.members[SLOT.CENTER], mage = g.members[SLOT.RIGHT];
  tank.hp = tank.maxHP - 5;       // deeply wounded: 2 heal, no overheal
  mage.hp = mage.maxHP - 1;       // one below max: +1 HP, overheal 1
  lk.hp = lk.maxHP;               // topped: pure overheal 2
  g.playCard(giveCard(g, 'radiance'), null);
  eq('wounded tank healed RADIANCE_HEAL', tank.hp, tank.maxHP - 5 + RADIANCE_HEAL);
  check('wounded tank gained NO Brace (no overheal)', !tank.brace && tank.braceAmount === 0);
  eq('the 1-below member reached full', mage.hp, mage.maxHP);
  check('the 1-below member gained Brace 1 (the single overheal point)', mage.brace && mage.braceAmount === 1);
  check('the topped Lightkeeper gained Brace RADIANCE_HEAL', lk.brace && lk.braceAmount === RADIANCE_HEAL);
}
{
  // Shield asymmetry (#76): a Shield-holder keeps the Shield — the overheal-to-Brace
  // conversion is SKIPPED for them (a full block already beats Brace), but the heal
  // still lands. The one documented exception to Brace's newest-replaces rule.
  const g = lightkeeperGame(762);
  const tank = g.members[SLOT.CENTER];
  tank.hp = tank.maxHP;                       // topped, so the heal is pure overheal
  tank.shield = true; tank.shieldTurns = SHIELD_TURNS;
  g.playCard(giveCard(g, 'radiance'), null);
  check('the Shield is preserved (not overwritten)', tank.shield && tank.shieldTurns === SHIELD_TURNS);
  check('no Brace granted to the Shield-holder', !tank.brace && tank.braceAmount === 0);
  // Meanwhile a non-shield topped member DID convert — the skip is per-member.
  const lk = g.members[SLOT.LEFT];
  check('the non-shield member still braced on overheal', lk.brace && lk.braceAmount === RADIANCE_HEAL);
}
{
  // Reliquary of Light (+1 holy heal) rides Radiance (a holy card): the heal is 3, so a
  // topped member's overheal — and its Brace — is RADIANCE_HEAL + HOLY_RELIC_HEAL.
  const g = lightkeeperGame(763, ['reliquaryOfLight']);
  g.members.forEach((m) => { m.hp = m.maxHP; });
  g.playCard(giveCard(g, 'radiance'), null);
  check('topped members gain Brace RADIANCE_HEAL + HOLY_RELIC_HEAL (=3)',
    g.livingMembers().every((m) => m.braceAmount === RADIANCE_HEAL + HOLY_RELIC_HEAL));
}
{
  // Beacon of the Second Sun (#69): a member healed exactly to full by Radiance draws
  // a card (reachedFull, even with overheal 0). Set the mage exactly RADIANCE_HEAL
  // below max so the heal lands on the line with no overheal.
  const g = lightkeeperGame(764, ['beaconOfSecondSun']);
  g.members.forEach((m) => { m.hp = m.maxHP; });        // others topped (before==max: no draw)
  const mage = g.members[SLOT.RIGHT];
  mage.hp = mage.maxHP - RADIANCE_HEAL;                  // heals exactly to full, overheal 0
  const handBefore = g.hand.length;                     // snapshot BEFORE giveCard adds the card
  g.playCard(giveCard(g, 'radiance'), null);            // radiance nets 0 (added then played), +BEACON_DRAW
  eq('the on-the-line member reached full', mage.hp, mage.maxHP);
  check('reaching full did not brace him (overheal 0)', !mage.brace);
  eq('Beacon drew BEACON_DRAW for the member topped off', g.hand.length, handBefore + BEACON_DRAW);
}
{
  // Aegis Font (#22) does NOT double-convert Radiance's overheal: Radiance captures the
  // overheal for Brace (captureOverheal), so the Font wells up NO Ward on the converted
  // members — the #69 ordering rule (card converts first; Font gets no share).
  const g = lightkeeperGame(765, ['aegisFont']);
  const lk = g.members[SLOT.LEFT];
  lk.hp = lk.maxHP; lk.ward = 0;                         // topped -> pure overheal
  g.playCard(giveCard(g, 'radiance'), null);
  check('overheal converted to Brace, not Ward', lk.brace && lk.braceAmount === RADIANCE_HEAL);
  eq('Aegis Font added no Ward (no double-convert)', lk.ward, 0);
}
{
  // Asymmetry pin: Radiance's Brace ADDS to an existing Brace, but the Brace CARD keeps
  // its newest-replaces rule. Stack Radiance twice to Brace 4, then a Brace card REPLACES
  // it down to BRACE_AMOUNT — proving the additive carve-out is scoped to Radiance only.
  const g = lightkeeperGame(766);
  const tank = g.members[SLOT.CENTER];
  tank.hp = tank.maxHP;
  g.playCard(giveCard(g, 'radiance'), null);
  g.playCard(giveCard(g, 'radiance'), null);
  eq('two Radiance casts stacked Brace to 4', tank.braceAmount, 2 * RADIANCE_HEAL);
  g.playCard(giveCard(g, 'brace'), tank.slot);
  eq('a Brace CARD REPLACES (newest-replaces), not adds', tank.braceAmount, BRACE_AMOUNT);
  // And the reverse: a standing Brace-card Brace, then Radiance ADDS onto it.
  const mage = g.members[SLOT.RIGHT];
  mage.hp = mage.maxHP;
  g.playCard(giveCard(g, 'brace'), mage.slot);          // Brace 2
  g.playCard(giveCard(g, 'radiance'), null);            // +2 overheal -> 4
  eq('Radiance ADDS onto an existing Brace-card Brace', mage.braceAmount, BRACE_AMOUNT + RADIANCE_HEAL);
}
{
  // Unplayable while she is down (#44): a dead Lightkeeper means no ability member, so
  // Radiance can't be cast.
  const g = lightkeeperGame(767);
  const lk = g.members[SLOT.LEFT];
  lk.alive = false; lk.hp = 0;
  const res = g.playCard(giveCard(g, 'radiance'), null);
  check('Radiance is unplayable while the Lightkeeper is down', !res.ok);
}

// --- drag-and-drop: dropTargets (legal drop slots per card) ----------------
// A default-trio game with full MP; the drag UI reads dropTargets to decide which
// heroes/board accept a dragged card and to cancel a drop on the wrong target.
function dndGame(seed: number): Game {
  const g = new Game(seed); g.start();
  g.mp = 40; g.maxMana = 40;
  g.members.forEach((m) => { m.hp = m.maxHP; m.alive = true; });
  return g;
}
{
  // A single-target heal accepts every living hero, and is not a board card.
  const g = dndGame(1);
  const spec = g.dropTargets(giveCard(g, 'highHeal'));
  eq('heal accepts 3 living heroes', spec.slots.length, 3);
  check('heal is not a board card', !spec.board);
}
{
  // Resurrect (target 'dead') accepts ONLY the dead hero; living heroes are excluded.
  const g = dndGame(2);
  const down = g.members[SLOT.CENTER];
  down.alive = false; down.hp = 0;
  const spec = g.dropTargets(giveCard(g, 'resurrect'));
  eq('Resurrect targets exactly the dead hero', spec.slots.join(','), String(SLOT.CENTER));
  check('Resurrect does not accept a living hero', !spec.slots.includes(SLOT.LEFT));
}
{
  // Ability card binds to its carrier only — a drop on any other hero must cancel.
  // Default trio: LEFT=Imbue Venom, CENTER=Bolster, RIGHT=Unleash.
  const g = dndGame(3);
  const spec = g.dropTargets(giveAbility(g, SLOT.LEFT)); // imbuePoison -> the LEFT member
  eq('ability card accepts exactly its carrier', spec.slots.join(','), String(SLOT.LEFT));
  check('ability card rejects the wrong hero (center)', !spec.slots.includes(SLOT.CENTER));
  check('ability card rejects the wrong hero (right)', !spec.slots.includes(SLOT.RIGHT));
  check('ability card is not a board card', !spec.board);
}
{
  // A downed carrier makes its ability card accept nothing (and no board drop).
  const g = dndGame(4);
  g.members[SLOT.LEFT].alive = false; g.members[SLOT.LEFT].hp = 0;
  const spec = g.dropTargets(giveAbility(g, SLOT.LEFT));
  eq('ability card with a downed carrier accepts no hero', spec.slots.length, 0);
  check('ability card with a downed carrier is not a board card', !spec.board);
}
{
  // En Garde is the one single-target ability card: it picks a member like any
  // single-target card, so it accepts every living hero.
  const g = duelistGame(5);
  const spec = g.dropTargets(giveCard(g, 'enGarde'));
  eq('En Garde accepts every living hero', spec.slots.length, 3);
  check('En Garde is not a board card', !spec.board);
}
{
  // No-target cards (AoE 'all' and non-ability 'none') are board cards: no member
  // slots, plays wherever released.
  const g = dndGame(6);
  const aoe = g.dropTargets(giveCard(g, 'aoeHeal'));
  check('AoE heal is a board card', aoe.board);
  eq('AoE heal has no member slots', aoe.slots.length, 0);
  const bolt = g.dropTargets(giveCard(g, 'shadowBolt'));
  check('Shadow Bolt (offensive, no target) is a board card', bolt.board);
}
{
  // Unaffordable cards accept nothing — the drag has nowhere legal to land.
  const g = dndGame(7);
  g.mp = 0;
  const heal = g.dropTargets(giveCard(g, 'highHeal'));
  eq('unaffordable heal accepts no hero', heal.slots.length, 0);
  const aoe = g.dropTargets(giveCard(g, 'aoeHeal'));
  check('unaffordable AoE is not a board card', !aoe.board);
}

{
  // Channel banner effect-line derivation (#78): a pure helper that strips the
  // "Channel:" prefix and the trailing cancel/lifetime sentence from a channel
  // card's desc, leaving just the per-tick effect for the banner to show.
  eq('Drain effect line drops the Channel: prefix and cancel warning',
    channelEffectLine('drain'),
    `each turn deal ${DRAIN_DMG} to the enemy and, if it dealt damage, return ${DRAIN_MP_MIN}-${DRAIN_MP_MAX} MP (up to ${DRAIN_MAX_TURNS} turns)`);
  eq('Mending Stream effect line drops the "Ends if they die..." tail',
    channelEffectLine('mendingStream'),
    `heal a member for ${MENDING_STREAM_HEAL} each turn (up to ${MENDING_STREAM_MAX_TURNS} turns)`);
  check('Fortify effect line has no leading "Channel:"', !channelEffectLine('fortify').startsWith('Channel'));
  check('Fortify effect line drops the play-a-card warning', !/play a card/i.test(channelEffectLine('fortify')));
}


finish();
