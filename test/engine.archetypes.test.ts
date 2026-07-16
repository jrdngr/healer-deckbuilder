// Engine archetype/roster suites (Beast Warden, Showstopper, Plaguewright, channels,
// Hierophant, Duelist, Strongman, Lightkeeper, cross-cutting). Split from
// engine.test.ts for navigability; shares test/harness.ts + test/factories.ts.
import { Game } from '../src/engine';
import type { GameEvent } from '../src/engine';
import { channelEffectLine } from '../src/channelView';
import { DECK_LIST, CARDS, SLOT, MP_MAX, MEMBER_DEFS, POISON_BASE, POISON_TURNS, REFRESH_TURNS, BOLT_BASE, BOLT_CHARGE_MULT, SHIELD_TURNS, DEFENSE_TURNS, DEFENSE_AMOUNT, TAUNT_TURNS, TAUNT_RETARGET_SURCHARGE, ENRAGE_TURN, TYPE_WEIGHTS, SKIP_REGEN, SKIP_REGEN_DECAYED, REFRESH_MP_CAP, FONT_MP_CAP, CULTIVATE_STRENGTH, BLOOM_HEAL_PER_TURN, LIFEBLOOM_BURST, HYMN_BONUS, BARRIER_TURNS, BLOOD_TITHE_MP, GRIM_HARVEST_DMG, PHALANX_DEFENSE, PHALANX_TURNS, BRACE_AMOUNT, BRACE_TURNS, CARD_RARITY, CARD_POOL, DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF, IRONMAW_DEF, NEEDLER_DEF, LEECH_DEF, JUGGERNAUT_DEF, LANCER_DEF, DEVOURLING_DEF, NEEDLER_PIERCE_DMG, LANCER_PIERCE_DMG, DEVOURER_MAW_DMG, WOUND_TURNS, SIPHON_AMOUNT, HEXWEAVER_PIERCER_DMG, ATTACK_INTENT_NAMES, makeDeckCard, defaultBattleConfig, DEFAULT_HEALER, resolveCard, canApplyModifier, isEngineCard, MODIFIERS } from '../src/constants';
import { TITHE_CANDLE_MP, TITHE_CANDLE_FIGHT_CAP, FIELD_TRIAGE_BONUS, PRAYER_BEADS_MP, VANGUARD_BONUS, GROUNDING_ROD_REDUCTION, STORMGLASS_MIN_HIT, WARD_MAX, TAPER_MAX_COST, TAPER_DISCOUNT, DUSK_CHIME_MIN, PACT_PASSIVE_MP, CRACKED_HOURGLASS_ENRAGE, HOURGLASS_POWER_BONUS, RUSTY_CROWN_ATTACK } from '../src/constants';
import { partyFromMembers, isEngineAbility, HEX_TURNS, HEX_VULN_BY_SIZE, RALLY_DMG_PER_SEAT, FOCUS_HEAL, FOCUS_SMALL_BONUS, SKALD_DMG_PER_CARD, SKALD_DMG_CAP, CRESCENDO_DRAW, RAMPAGE_SELF_DMG, GRAVE_CHILL_REDUCTION, BOAR_HP, BOAR_TURNS, BOAR_STRIKE_BONUS, TAUNT_LITE_TURNS, TAUNT_LITE_DEFENSE } from '../src/constants';
import { abilityCardsForParty, isAbilityCard } from '../src/constants';
import { GUARD_DR, GUARD_TURNS, SHARPEN_BONUS, SHARPEN_TURNS, EMBOLDEN_BONUS, EMBOLDEN_TURNS, EMPOWER_BONUS, EN_GARDE_TURNS, PENANCE_HP, PENANCE_STRIKE_BONUS, PENANCE_STRIKE_TURNS, SANGUINE_PACT_THRESHOLD, RADIANCE_HEAL } from '../src/constants';
import { ABILITY_CARD, MEMBER_POOL, MEMBER_ABILITY_FLAVOR, MEMBER_PASSIVE_FLAVOR, MEMBER_BASE_SALARY, FERMENT_TURNS, FERMENT_GROWTH, DRAFT_POOL } from '../src/constants';
import { TOXICOLOGIST_BONUS, GRUDGE_DIVISOR, FERAL_BOND_MULT, DARK_BARGAIN_DMG, DARK_BARGAIN_POWER } from '../src/constants';
import {
  SHIELD_WALL_DEFENSE, HOLD_LINE_DEFENSE, HOLD_LINE_BANK_MULT, ARCANE_SURGE_CHARGE, DRAIN_LIFE_DMG,
  DOOM_DELAY, DOOM_DAMAGE, SACRIFICE_HP, SACRIFICE_DMG, SACRIFICE_POWER, FINALE_MULT, BLOODBATH_PER_MISSING,
  WHIRLWIND_HITS, SIC_EM_MULT, MEND_BEAST_HEAL, BIG_TOP_DR, LUNGE_MULT, FLURRY_HITS, FLURRY_REDUCTION, STRONGEST_HP,
} from '../src/constants';
import { CARD_TYPE, CARDS_BY_TYPE, cardType, cardsOfType } from '../src/constants';
import { SHADOW_BOLT_DMG, SIPHON_LIFE_DMG, SIPHON_LIFE_HEAL, DOOM_BASE, DOOM_PER_DEBUFF, DOOM_PER_VULN, DOOM_CAP } from '../src/constants';
import { HOLY_RELIC_HEAL, SHADOW_RELIC_DMG, IRON_RELIC_DISCOUNT } from '../src/constants';
import { ANVIL_STANCE_BONUS, INTERLOCK_GUARD_DR, INTERLOCK_GUARD_TURNS, BULWARK_BRACE_TURNS, WHETSTONE_BONUS, RELIC_IDS, RELICS } from '../src/constants';
import { THORNSKIN_REDUCTION, SPOREBURST_POISON, OSSUARY_REGEN, OSSUARY_THRESHOLD } from '../src/constants';
import { UMBRAL_FEAST_PER_EFFECT, DREAD_WHISPER_REDUCTION, VENOM_GLAND_BONUS_TURNS, EMBERMARK_DMG } from '../src/constants';
import { CRIMSON_PACT_HP, CRIMSON_PACT_DRAW, SCARLET_WARD_HP, OPEN_VEINS_HP, OPEN_VEINS_DMG, TRANSFUSION_HP, TRANSFUSION_HEAL, BLOOD_BANNER_HP, BLOOD_BANNER_BONUS, BLOOD_BANNER_TURNS, GRIMOIRE_DMG, SANGUINE_PACT_SURCHARGE, SANGUINE_PACT_AUTO_BONUS } from '../src/constants';
import { CASCADE_DRAW, CASCADE_DISCOUNT_PER_ARCANE, NIGHTFALL_BASE, NIGHTFALL_PER_SHADOW, NIGHTFALL_CAP } from '../src/constants';
import { DRAIN_DMG, DRAIN_MP_MIN, DRAIN_MP_MAX, DRAIN_MAX_TURNS, REFRESH_CHANNEL_MP, REFRESH_CHANNEL_MAX_TURNS, MENDING_STREAM_HEAL, MENDING_STREAM_MAX_TURNS, SAP_VULN_PER_TICK, SAP_VULN_CAP, SAP_MAX_TURNS } from '../src/constants';
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

// --- party roster: Showstopper + Stun (#61) ------------------------------------
// A boss game seating the Showstopper in slot 0, so the Stun can cancel a scripted
// rotation step / channel wind-up / cast.
{
  // Data: the Showstopper is a sturdy bruiser carrying Stun; the bound card is Halt!
  // (5 MP, no target), and it maps through ABILITY_CARD like every other member card.
  const s = MEMBER_POOL.sentinel;
  eq('Showstopper HP 16', s.maxHP, 16); // raised 13 -> 16 to pay for Stunt Double
  eq('Showstopper damage 2', s.damage, 2);
  eq('Showstopper ability is stun', s.ability, 'stun');
  eq('stun binds to the Halt! card', ABILITY_CARD.stun, 'stagger');
  eq('Halt! costs 5 MP (the balance lever)', CARDS.stagger.cost, 5);
  eq('Halt! takes no target', CARDS.stagger.target, 'none');
  eq('Halt! fires the stun ability', CARDS.stagger.ability, 'stun');
  check('Halt! is a per-member ability card', isAbilityCard('stagger'));
  check('the Showstopper has ability flavor', MEMBER_ABILITY_FLAVOR.sentinel.length > 0);
}
{
  // #89: every hero in the pool has a passive with a non-empty name + description, so
  // the player-facing MEMBER_PASSIVE_FLAVOR table is total (mirrors the flavor checks).
  for (const id of Object.keys(MEMBER_POOL) as (keyof typeof MEMBER_POOL)[]) {
    const p = MEMBER_PASSIVE_FLAVOR[id];
    check(`${id} has a passive name`, !!p && p.name.length > 0);
    check(`${id} has a passive description`, !!p && p.desc.length > 0);
  }
  // The Showstopper's passive is Stunt Double, per the engine comment (no #85 rename).
  eq('Showstopper passive is Stunt Double', MEMBER_PASSIVE_FLAVOR.sentinel.name, 'Stunt Double');
}
{
  // Playing Halt! cancels the standing telegraph: the coming enemy resolution
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
  eq('Halt! spent its 5 MP', g.mp, 0);
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
  g._fireAbility(g.members[0]);             // Showstopper Stuns
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
  g.rotationIndex = 6;                       // Haymaker channel slot (cycle 2)
  g.telegraph = g._generateTelegraph(g.turn);
  check('a channel is standing', g.telegraph.channel === true);
  const target = g.telegraph.targets[0];
  g.members[target].hp = 50;
  g._fireAbility(g.members[0]);
  g._runEnemyPhase();
  eq('the aborted channel dealt no damage', g.members[target].hp, 50);
  eq('the rotation advanced past the channel', g.rotationIndex, 7);
  check('the channel did not resume/stand', g.telegraph.channel !== true);
  // Drive a full extra cycle: the consumed Haymaker does not re-stand this cycle.
  for (let i = 0; i < 3; i++) g._runEnemyPhase();
  check('the consumed channel is not repeated within the cycle',
    g.telegraph.channelName !== 'Haymaker' || g.rotationIndex % 8 !== 6);
}
{
  // A 'cast' telegraph (Jinxweaver's Jinx) is likewise consumed with NO scripted
  // effect — no healing-reduction Wound is applied.
  const g = sentinelBossGame(4, HEXWEAVER_DEF);
  g.rotationIndex = 2;                       // Jinx ('cast' -> 'wound') slot
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
  // The Halt! card is unplayable while the Showstopper is down (the #44/#54 path),
  // and firing Stun with nothing to interrupt is a harmless no-op.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['sentinel', 'tank', 'mage']);
  const g = new Game(7, cfg); g.start();
  g.mp = 10;
  const idx = giveCard(g, 'stagger');
  check('Halt! is playable with a living Showstopper', g.canPlay(idx, null) === null);
  g._killMember(g.members[0]);
  check('Halt! is disabled once the Showstopper is down', g.canPlay(idx, null) !== null);
  // Idempotent: stunning an already-stunned telegraph does not double-consume.
  const cfg2 = defaultBattleConfig();
  cfg2.party = partyFromMembers(['sentinel', 'tank', 'mage']);
  const g2 = new Game(8, cfg2); g2.start();
  g2.telegraph = { type: 'single', hidden: false, damage: 4, targets: [1], enraged: false, forTurn: g2.turn, turnsUntilResolve: 1 };
  g2._fireAbility(g2.members[0]);
  g2._fireAbility(g2.members[0]);
  check('re-stunning keeps the telegraph stunned (no error)', g2.telegraph.stunned === true);
}

// --- Provoke / Taunt-lite card (#31) ----------------------------------------
{
  // Provoke makes ANY member the enemy's aim (not just the Tank). The bundled Defense
  // was removed in the content-cut pass — Provoke is Taunt-only now.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['ranger', 'mage', 'skald']); // taunt-less draft
  const g = new Game(1, cfg); g.start();
  g.mp = 10;
  const augur = g.members[2];
  g.playCard(giveCard(g, 'provoke'), 2);
  eq('Provoke grants Taunt to a non-Tank member', augur.taunt, TAUNT_LITE_TURNS);
  eq('Provoke no longer bundles a Defense', augur.defense, 0);
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

  // The 5 survivors are shop/reward-eligible; Encore is the rare of the set.
  // (Goad and Embolden were cut in the content-cut pass.)
  const batch: CardId[] = ['guard', 'sharpen', 'doubleStrike', 'empower', 'riposte'];
  check('all 5 hero-buff cards are shop/reward-eligible', batch.every((id) => CARD_POOL.includes(id)));
  eq('Encore is the rare of the set', CARD_RARITY.doubleStrike, 'rare');

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


  // Encore: doubles exactly the next basic auto, consumed on use.
  {
    const cfg = defaultBattleConfig();
    cfg.party = [partyFromMembers(['mage'])[0], empty(), empty()]; // solo mage isolates the auto
    const g = new Game(3, cfg); g.start(); g.mp = 10; g.enemy.hp = 999;
    const mage = g.members[0];
    const dmg = g.memberDamage(mage);
    g.playCard(giveCard(g, 'doubleStrike'), 0);
    check('Double Strike primes the hero', mage.drumPrimed);
    const before = g.enemy.hp; g._runPartyPhase();
    eq('Encore doubles the next auto', before - g.enemy.hp, dmg * 2);
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
    (['lowHeal', 'highHeal', 'aoeHeal', 'resurrect', 'cleanse'] as CardId[]).every((id) => has('holy', id)));
  check('Nature holds the regen family + buffs',
    (['regen', 'bloom', 'lifebloom', 'battleHymn', 'imbuePoison', 'beckon'] as CardId[]).every((id) => has('nature', id)));
  check('Shadow holds debuffs/damage + the new cards',
    (['unleash', 'hex', 'sap', 'dreadWhisper'] as CardId[]).every((id) => has('shadow', id)));
  check('Blood holds the sacrifice cards',
    (['bloodTithe', 'martyrsGift', 'incite'] as CardId[]).every((id) => has('blood', id)));
  check('Arcane holds the economy cards',
    (['fontOfMana', 'inspiration', 'conduct'] as CardId[]).every((id) => has('arcane', id)));
  check('Iron holds the protection cards',
    (['shield', 'barrier', 'phalanx', 'provoke', 'bolster'] as CardId[]).every((id) => has('iron', id)));
  // The six buckets partition every card (each card in exactly one type).
  const total = (['holy', 'nature', 'shadow', 'blood', 'arcane', 'iron'] as CardType[])
    .reduce((s, t) => s + CARDS_BY_TYPE[t].length, 0);
  eq('types partition every card', total, ALL.length);
  // Ability cards' type counts for synergies (the Warlock's Evil Eye reads as Shadow).
  eq('cardType(hex) is shadow', cardType('hex'), 'shadow');
  eq('cardsOfType(shadow) includes Trash Talk', cardsOfType('shadow').includes('dreadWhisper'), true);
}

// --- Per-type counters (#63) ------------------------------------------------
{
  const g = new Game(1, defaultBattleConfig()); g.start(); g.mp = 10; g.enemy.hp = 999;
  g.playCard(giveCard(g, 'dreadWhisper'));         // Shadow
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
  // The counter is the defender's LIVE auto: Sharpen (+1) folds in, and the payoff
  // survives the very hit that spends the Shield (captured before the block resolves).
  const g = duelistGame(744);
  const duelist = g.members[SLOT.LEFT];
  const base = g.memberDamage(duelist);
  g.playCard(giveCard(g, 'enGarde'), SLOT.LEFT);
  g.playCard(giveCard(g, 'sharpen'), SLOT.LEFT);      // +SHARPEN_BONUS
  g.playCard(giveCard(g, 'shield'), SLOT.LEFT);
  const expected = base + SHARPEN_BONUS;
  eq('Sharpen folds into the live auto', g.memberDamage(duelist), expected);
  hitAt(g, [SLOT.LEFT], 5); // a damaging hit the Shield fully blocks
  const before = g.enemy.hp;
  g._resolveAttack();
  eq('the counter carries Sharpen even on the blocking hit', before - g.enemy.hp, expected);
  check('the blocking hit spent the Shield', !duelist.shield);
}
{
  // A fully Shield-blocked hit still counters (the stance rewards blocking).
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
  // Timer: counters on enemy turns 1..EN_GARDE_TURNS, none after (decrements with
  // _decayBuffs, which runs AFTER the attack — so the stance fires on the turn it decays).
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
  for (let t = 1; t <= EN_GARDE_TURNS; t++) eq(`enemy turn ${t} counters`, oneTurn(), dmg);
  // The En Garde TIMER expires — but the Duelist keeps countering regardless, because
  // Riposte Master (her passive) makes her counter every hit permanently, card or no card.
  eq('Riposte Master keeps the Duelist countering after En Garde', oneTurn(), dmg);
  check('the En Garde stance timer is spent (Riposte Master is separate)', duelist.riposteTurns === 0);
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

// --- Strongman + Feat of Strength (#75): the lethal blood battery --------------------
// A fight with a Strongman fielded so his Feat of Strength ability card is playable.
// Strongman seats LEFT (slot 0); tank CENTER, mage RIGHT. Enemy HP is huge so the
// buffed autos never actually finish it; per-test HP is set on the Strongman directly.
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
  eq('Strongman is in MEMBER_POOL', MEMBER_POOL.flagellant?.id, 'flagellant');
  eq('Strongman maxHP 15', MEMBER_POOL.flagellant.maxHP, 15);
  eq('Strongman damage 2 (weak swing)', MEMBER_POOL.flagellant.damage, 2);
  eq('Strongman ability is penance', MEMBER_POOL.flagellant.ability, 'penance');
  eq('Strongman base salary 14', MEMBER_BASE_SALARY.flagellant, 14);
  check('Strongman is in the draft pool', DRAFT_POOL.includes('flagellant'));
  check('Strongman has an ability flavor mentioning Feat of Strength', /Feat of Strength/.test(MEMBER_ABILITY_FLAVOR.flagellant ?? ''));
  eq('penance is the Strongman\'s bound ability card', ABILITY_CARD.penance, 'penance');
  eq('Feat of Strength is Blood', cardType('penance'), 'blood');
  check('Feat of Strength counts toward the blood bucket (incite precedent)', cardsOfType('blood').includes('penance'));
  eq('Feat of Strength costs 2', CARDS.penance.cost, 2);
  eq('Feat of Strength targets none', CARDS.penance.target, 'none');
  eq('Feat of Strength carries NO selfDamage field (payment is a raw drain, not the clamped gate)', CARDS.penance.selfDamage, undefined);
  eq('Feat of Strength is uncommon', CARD_RARITY.penance, 'uncommon');
  check('Feat of Strength is an ability card (never shopped)', isAbilityCard('penance') && !CARD_POOL.includes('penance'));
}
{
  // Survive branch: at 15 HP the payment leaves him at 11, and every LIVING member's
  // auto (his own included, since he lives) gains +PENANCE_STRIKE_BONUS this turn.
  const g = flagellantGame(750);
  const flag = g.members[SLOT.LEFT];
  const baseFlag = g.memberDamage(flag);
  const baseTank = g.memberDamage(g.members[SLOT.CENTER]);
  eq('Strongman opens at full 15 HP', flag.hp, 15);
  g.playCard(giveCard(g, 'penance'), null);
  eq('Feat of Strength pays PENANCE_HP with no clamp: 15 -> 11', flag.hp, 15 - PENANCE_HP);
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
  flag.lastStandUsed = true; // spend Last Stand so the lethal Blood cost actually kills him
  flag.hp = PENANCE_HP; // exactly the payment — a lethal cast
  const res = g.playCard(giveCard(g, 'penance'), null);
  check('the lethal cast was legal (no HP playability gate)', res.ok);
  check('the Strongman died', !flag.alive);
  eq('he was drained to 0', flag.hp, 0);
  check('the death recorded a scar (diedThisFight bookkeeping)', g.diedThisFightSlots().includes(flag.slot));
  eq('the +2 buff still landed on the surviving party', g.memberDamage(g.members[SLOT.CENTER]), baseTank + PENANCE_STRIKE_BONUS);
  check('the party did not wipe (tank + mage stand)', g.status === 'playing');
}
{
  // Guardian Feather (#22) converts the suicide to a 1-HP survival: the Icon triggers on
  // MEMBER DEATH, and a Feat of Strength suicide is a member death — intended, not special-cased.
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
  // The Feat of Strength buff is its OWN field, additive with Fight Song in the same turn
  // (not max-ed against it): the tank auto gains HYMN_BONUS + PENANCE_STRIKE_BONUS.
  const g = flagellantGame(754);
  const tank = g.members[SLOT.CENTER];
  const base = tank.damage;
  g.playCard(giveCard(g, 'battleHymn'), null);
  g.playCard(giveCard(g, 'penance'), null);
  eq('Feat of Strength stacks additively with Fight Song', g.memberDamage(tank), base + HYMN_BONUS + PENANCE_STRIKE_BONUS);
}
{
  // The Feat of Strength buff now lasts PENANCE_STRIKE_TURNS enemy turns (was cast-turn only):
  // it does NOT reset when the party autos resolve, and decays in _decayBuffs.
  const g = flagellantGame(755);
  g.playCard(giveCard(g, 'penance'), null);
  check('penanceBonus is live after the cast', g.penanceBonus === PENANCE_STRIKE_BONUS);
  eq('the buff arms its multi-turn timer', g.penanceTurns, PENANCE_STRIKE_TURNS);
  g._runPartyPhase();
  check('the buff survives the party autos (not one-phase anymore)', g.penanceBonus === PENANCE_STRIKE_BONUS);
  for (let t = 0; t < PENANCE_STRIKE_TURNS; t++) g._decayBuffs();
  check('the buff clears after its enemy-turn window', g.penanceBonus === 0 && g.penanceTurns === 0);
}
{
  // #79 floats: a party-wide +ATK buff resolves to a per-member payload (slots) the
  // animator fans a `+N ATK` float over. Fight Song buffs every living member.
  const g = flagellantGame(760);
  g.events = [];
  g.playCard(giveCard(g, 'battleHymn'), null);
  const hymn = g.events.find((e) => e.kind === 'hymn') as Extract<GameEvent, { kind: 'hymn' }>;
  check('Fight Song emits a hymn event', !!hymn);
  eq('the hymn carries its bonus', hymn.bonus, HYMN_BONUS);
  eq('the hymn fans over every living member', hymn.slots.slice().sort().join(','),
    g.livingMembers().map((m) => m.slot).sort().join(','));
}
{
  // #79 floats: Feat of Strength carries the living members it buffs (slots) plus the payer's
  // own slot for the `PENANCE PAID` flag when the payment kills him.
  const g = flagellantGame(761);
  const flag = g.members[SLOT.LEFT];
  flag.lastStandUsed = true; // spend Last Stand so the payment is truly lethal
  flag.hp = PENANCE_HP; // a lethal payment
  g.events = [];
  g.playCard(giveCard(g, 'penance'), null);
  const pen = g.events.find((e) => e.kind === 'penance') as Extract<GameEvent, { kind: 'penance' }>;
  check('Feat of Strength emits a penance event', !!pen);
  check('the dead payer is flagged', pen.died && pen.slot === flag.slot);
  check('the buffed slots are the living members only (payer excluded)',
    !pen.slots.includes(flag.slot) && pen.slots.length === g.livingMembers().length);
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
  // Default trio: LEFT=Poison Tip, CENTER=Bolster, RIGHT=Unleash.
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
  const bolt = g.dropTargets(giveCard(g, 'dreadWhisper'));
  check('Trash Talk (offensive, no target) is a board card', bolt.board);
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
  eq('Mending Stream effect line drops the "Ends if they die..." tail',
    channelEffectLine('mendingStream'),
    `heal a member for ${MENDING_STREAM_HEAL} each turn (up to ${MENDING_STREAM_MAX_TURNS} turns)`);
  check('Sap effect line has no leading "Channel:"', !channelEffectLine('sap').startsWith('Channel'));
  check('Sap effect line drops the play-a-card warning', !/play a card/i.test(channelEffectLine('sap')));
}

// === Hero passives (2026-07): one always-on identity per hero =================
// A controlled fight: field the given party, heal everyone up, fat enemy, full MP.
function passiveGame(party: MemberId[], seed = 900): Game {
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(party);
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
  const g = new Game(seed, cfg); g.start();
  g.members.forEach((m) => {
    m.maxHP = 100; m.hp = 100; m.alive = true; m.shield = false; m.shieldTurns = 0;
    m.bankedDamage = 0; m.feralPrimed = false; m.lastStandUsed = false; // reset opening-strike side effects
  });
  g.enemy.maxHP = 100000; g.enemy.hp = 100000;
  g.enemy.poison = 0; g.enemy.poisonTurns = 0; g.enemy.vulnerable = 0; g.enemy.vulnerableTurns = 0;
  g.maxMana = 40; g.mp = 40; g.passiveMp = 0; g.enrageTurn = 9999;
  return g;
}
{
  // Toxicologist (Ranger): +auto vs a poisoned enemy; plain otherwise.
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const r = g.members[0];
  eq('Ranger auto is base vs an unpoisoned enemy', g.memberDamage(r), r.damage);
  g.enemy.poison = 3; g.enemy.poisonTurns = 3;
  eq('Toxicologist adds +2 auto vs a poisoned enemy', g.memberDamage(r), r.damage + TOXICOLOGIST_BONUS);
}
{
  // Arcane Battery (Mage): only the Mage banks Charge each turn (also asserted in engine.test).
  const g = passiveGame(['mage', 'tank', 'ranger']);
  eq('only the Mage carries Charge', g.members.filter((m) => m.charge > 0).map((m) => m.id).join(','), 'mage');
}
{
  // Opening Act (Busker): a fielded Busker draws one extra card at each turn start.
  const withBusker = passiveGame(['skald', 'tank', 'mage']);
  const without = passiveGame(['ranger', 'tank', 'mage']);
  eq('Opening Act draws one extra at turn start', withBusker.hand.length, without.hand.length + 1);
}
{
  // Riposte Master (Duelist): she counters every hit that lands on her — no card, no timer.
  const g = passiveGame(['duelist', 'tank', 'mage']);
  const d = g.members[0];
  eq('the Duelist has no En Garde stance running', d.riposteTurns, 0);
  hitAt(g, [SLOT.LEFT], 5);
  const before = g.enemy.hp;
  g._resolveAttack();
  eq('Riposte Master counters for her auto without any card', before - g.enemy.hp, d.damage);
}
{
  // Last Stand (Strongman): the first killing blow leaves him at 1 HP; the next one kills.
  const g = passiveGame(['flagellant', 'tank', 'mage']);
  const f = g.members[0];
  f.hp = 3; hitAt(g, [SLOT.LEFT], 99); g._resolveAttack();
  check('Last Stand catches a lethal hit — he clings at 1 HP', f.alive && f.hp === 1);
  check('Last Stand is spent', f.lastStandUsed);
  f.hp = 3; hitAt(g, [SLOT.LEFT], 99); g._resolveAttack();
  check('a second lethal hit kills him (Last Stand already spent)', !f.alive);
}
{
  // Grudge (Tank): banks damage soaked; his next auto adds half, then clears.
  const g = passiveGame(['tank', 'ranger', 'mage']);
  const tk = g.members[0];
  const base = g.memberDamage(tk);
  hitAt(g, [SLOT.LEFT], 8); g._resolveAttack();
  eq('Grudge banks the damage the Tank soaked', tk.bankedDamage, 8);
  eq('Grudge adds half the bank to his next auto', g.memberDamage(tk), base + Math.floor(8 / GRUDGE_DIVISOR));
  g._runPartyPhase();
  eq('the bank clears after he cashes it', tk.bankedDamage, 0);
  eq('his auto returns to base once cashed', g.memberDamage(tk), base);
}
{
  // Dark Bargain (Warlock): a party death permanently grows a living Warlock.
  const g = passiveGame(['warlock', 'tank', 'mage']);
  const w = g.members[0], tk = g.members[1];
  const d0 = w.damage, p0 = w.abilityPower;
  g._killMember(tk);
  eq('Dark Bargain: +1 damage on a party death', w.damage, d0 + DARK_BARGAIN_DMG);
  eq('Dark Bargain: +1 ability power too', w.abilityPower, p0 + DARK_BARGAIN_POWER);
}
{
  // Feral Bond (Beast Warden): when her Boar falls, her next strike is primed for ×3.
  const g = passiveGame(['beastWarden', 'tank', 'mage']);
  const wd = g.members[0];
  g._fireAbility(wd); // summon a Boar
  hitAt(g, [SLOT.LEFT], BOAR_HP + 10); g._resolveAttack(); // one instance fells the Boar
  check('the Boar fell to the blow', wd.boarHp === 0);
  check('Feral Bond primes her avenging strike', wd.feralPrimed);
}
{
  // Feral Bond payoff: the primed strike deals FERAL_BOND_MULT×, then is consumed.
  const g = passiveGame(['beastWarden', 'tank', 'mage']);
  const wd = g.members[0];
  g.members[1].damage = 0; g.members[2].damage = 0; // silence the others so only she strikes
  wd.feralPrimed = true;
  const expected = g.memberDamage(wd) * FERAL_BOND_MULT;
  const ehp = g.enemy.hp;
  g._runPartyPhase();
  eq('Feral Bond triples the avenging strike', ehp - g.enemy.hp, expected);
  check('Feral Bond is consumed by that strike', !wd.feralPrimed);
}
{
  // Stunt Double (Showstopper): a blow that would kill a teammate lands on her instead.
  const g = passiveGame(['sentinel', 'ranger', 'mage']);
  const show = g.members[0], ranger = g.members[1];
  ranger.hp = 4; const showHp = show.hp;
  hitAt(g, [SLOT.CENTER], 5); g._resolveAttack(); // a lethal hit aimed at the Ranger
  check('the endangered teammate is untouched', ranger.hp === 4 && ranger.alive);
  eq('the Showstopper took the blow in her place', show.hp, showHp - 5);
}
{
  // Stunt Double only intercepts LETHAL blows — a survivable hit is left alone.
  const g = passiveGame(['sentinel', 'ranger', 'mage']);
  const show = g.members[0], ranger = g.members[1];
  ranger.hp = 50; const showHp = show.hp;
  hitAt(g, [SLOT.CENTER], 5); g._resolveAttack();
  eq('a survivable hit lands on its target', ranger.hp, 45);
  eq('the Showstopper is untouched by a non-lethal blow', show.hp, showHp);
}

// === Learned ability cards (Training Dojo): fire each and assert its effect ====
{ // Twin Shot (Ranger): two auto strikes.
  const g = passiveGame(['ranger', 'tank', 'mage']);
  const r = g.members[0]; const ehp = g.enemy.hp;
  g._fireAbility(r, null, 'twinShot');
  eq('Twin Shot strikes twice', ehp - g.enemy.hp, 2 * g.memberDamage(r));
}
{ // Concentrated Venom (Ranger): double the enemy's poison-per-turn.
  const g = passiveGame(['ranger', 'tank', 'mage']);
  g.enemy.poison = 3; g.enemy.poisonTurns = 3;
  g._fireAbility(g.members[0], null, 'concVenom');
  eq('Concentrated Venom doubles poison-per-turn', g.enemy.poison, 6);
  eq('Concentrated Venom leaves the duration alone', g.enemy.poisonTurns, 3);
}
{ // Shield Wall (Tank): every living member braces.
  const g = passiveGame(['tank', 'ranger', 'mage']);
  g._fireAbility(g.members[0], null, 'shieldWall');
  check('Shield Wall braces the whole party',
    g.livingMembers().every((m) => m.defense > 0 && m.defenseAmount >= SHIELD_WALL_DEFENSE));
}
{ // Hold the Line (Tank): Defense + a double-Grudge-bank window.
  const g = passiveGame(['tank', 'ranger', 'mage']);
  const tk = g.members[0];
  g._fireAbility(tk, null, 'holdLine');
  check('Hold the Line braces the Tank and opens the window', tk.defense > 0 && tk.holdLineTurns > 0);
  hitAt(g, [SLOT.LEFT], 10); g._resolveAttack();
  eq('Grudge banks double under Hold the Line', tk.bankedDamage, (10 - HOLD_LINE_DEFENSE) * HOLD_LINE_BANK_MULT);
}
{ // Arcane Surge (Mage): instant Charge.
  const g = passiveGame(['mage', 'tank', 'ranger']);
  const mg = g.members[0]; mg.charge = 0;
  g._fireAbility(mg, null, 'arcaneSurge');
  eq('Arcane Surge grants Charge', mg.charge, ARCANE_SURGE_CHARGE);
}
{ // Drain Life (Mage): deal damage, heal the most wounded for it.
  const g = passiveGame(['mage', 'tank', 'ranger']);
  const mg = g.members[0], tk = g.members[1]; tk.hp = 50;
  const ehp = g.enemy.hp;
  g._fireAbility(mg, null, 'drainLife');
  eq('Drain Life deals its damage', ehp - g.enemy.hp, DRAIN_LIFE_DMG);
  eq('Drain Life heals the most wounded for the damage dealt', tk.hp, 50 + DRAIN_LIFE_DMG);
}
{ // Doom (Warlock): arms a countdown that detonates for heavy damage.
  const g = passiveGame(['warlock', 'tank', 'mage']);
  g._fireAbility(g.members[0], null, 'doom');
  eq('Doom arms the countdown', g.enemy.doomTurns, DOOM_DELAY);
  const ehp = g.enemy.hp;
  for (let i = 0; i < DOOM_DELAY; i++) g._runEnemyPhase();
  eq('Doom detonates for its damage', ehp - g.enemy.hp, DOOM_DAMAGE);
  eq('Doom is spent after it fires', g.enemy.doomTurns, 0);
}
{ // Sacrifice (Warlock): an ally bleeds; the Warlock grows for the fight.
  const g = passiveGame(['warlock', 'tank', 'mage']);
  const w = g.members[0], tk = g.members[1];
  const d0 = w.damage, p0 = w.abilityPower;
  g._fireAbility(w, SLOT.CENTER, 'sacrifice');
  eq('Sacrifice bleeds the chosen ally', tk.hp, 100 - SACRIFICE_HP);
  eq('Sacrifice grows the Warlock damage', w.damage, d0 + SACRIFICE_DMG);
  eq('Sacrifice grows the Warlock power', w.abilityPower, p0 + SACRIFICE_POWER);
}
{ // Sacrifice exhausts: after one play it never reaches the discard pile.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['warlock', 'tank', 'mage']);
  cfg.party[0].learned = ['sacrifice'];
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
  const g = new Game(1, cfg).start();
  g.mp = 40;
  const before = g.discardPile.length;
  g.playCard(giveCard(g, 'sacrifice'), SLOT.CENTER);
  eq('Sacrifice is consumed — not added to the discard pile', g.discardPile.length, before);
}
{ // Finale (Busker): 2× his cards-played auto.
  const g = passiveGame(['skald', 'tank', 'mage']);
  const b = g.members[0]; g.cardsPlayedThisPhase = 2;
  const auto = g.memberDamage(b); const ehp = g.enemy.hp;
  g._fireAbility(b, null, 'finale');
  eq('Finale strikes for 2x his cards-played auto', ehp - g.enemy.hp, FINALE_MULT * auto);
}
{ // Duet (Busker): a chosen ally makes a bonus auto-attack.
  const g = passiveGame(['skald', 'ranger', 'mage']);
  const ehp = g.enemy.hp;
  g._fireAbility(g.members[0], SLOT.CENTER, 'duet');
  eq('Duet makes the chosen ally strike', ehp - g.enemy.hp, g.memberDamage(g.members[1]));
}
{ // Bloodbath (Berserker): damage equal to his missing HP.
  const g = passiveGame(['berserker', 'tank', 'mage']);
  const bz = g.members[0]; bz.hp = bz.maxHP - 12;
  const ehp = g.enemy.hp;
  g._fireAbility(bz, null, 'bloodbath');
  eq('Bloodbath deals his missing HP', ehp - g.enemy.hp, 12 * BLOODBATH_PER_MISSING);
}
{ // Whirlwind (Berserker): 2 strikes, a 3rd in his hottest band.
  const g = passiveGame(['berserker', 'tank', 'mage']);
  const bz = g.members[0];
  let auto = g.memberDamage(bz); let ehp = g.enemy.hp;
  g._fireAbility(bz, null, 'whirlwind');
  eq('Whirlwind strikes twice outside the hottest band', ehp - g.enemy.hp, WHIRLWIND_HITS * auto);
  bz.hp = 1; auto = g.memberDamage(bz); ehp = g.enemy.hp;
  g._fireAbility(bz, null, 'whirlwind');
  eq('Whirlwind adds a third strike in the hottest band', ehp - g.enemy.hp, (WHIRLWIND_HITS + 1) * auto);
}
{ // Sic 'Em (Beast Warden): the Boar lunges for 2x its strike bonus.
  const g = passiveGame(['beastWarden', 'tank', 'mage']);
  const wd = g.members[0];
  g._fireAbility(wd); // summon the Boar (signature Call Boar)
  const ehp = g.enemy.hp;
  g._fireAbility(wd, null, 'sicEm');
  eq("Sic 'Em deals 2x the Boar's strike bonus", ehp - g.enemy.hp, SIC_EM_MULT * BOAR_STRIKE_BONUS);
}
{ // Mend Beast (Beast Warden): heal + extend the Boar.
  const g = passiveGame(['beastWarden', 'tank', 'mage']);
  const wd = g.members[0];
  g._fireAbility(wd);
  const hp0 = wd.boarHp, t0 = wd.boarTurns;
  g._fireAbility(wd, null, 'mendBeast');
  eq('Mend Beast heals the Boar', wd.boarHp, hp0 + MEND_BEAST_HEAL);
  eq('Mend Beast extends the Boar by a turn', wd.boarTurns, t0 + 1);
}
{ // needsBoar gate: Sic 'Em is unplayable without a live Boar.
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['beastWarden', 'tank', 'mage']);
  cfg.party[0].learned = ['sicEm'];
  cfg.deck = [...cfg.deck.filter((c) => !isAbilityCard(c.id)), ...abilityCardsForParty(cfg.party)];
  const g = new Game(2, cfg).start();
  g.mp = 40;
  check("Sic 'Em is unplayable with no Boar out", g.canPlay(giveCard(g, 'sicEm'), null) != null);
}
{ // Standing Ovation (Showstopper): every living member's next strike doubles.
  const g = passiveGame(['sentinel', 'tank', 'mage']);
  g._fireAbility(g.members[0], null, 'standingOvation');
  check('Standing Ovation primes every living member', g.livingMembers().every((m) => m.drumPrimed));
}
{ // Big Top (Showstopper): a one-turn party DR aura.
  const g = passiveGame(['sentinel', 'tank', 'mage']);
  g._fireAbility(g.members[0], null, 'bigTop');
  check('Big Top arms the aura', g.bigTopTurns > 0);
  eq('Big Top reduces incoming damage party-wide', g._effectiveDamage(g.members[1], 10), 10 - BIG_TOP_DR);
}
{ // Lunge (Duelist): 2x strike and she Provokes.
  const g = passiveGame(['duelist', 'tank', 'mage']);
  const d = g.members[0]; const auto = g.memberDamage(d); const ehp = g.enemy.hp;
  g._fireAbility(d, null, 'lunge');
  eq('Lunge strikes for 2x', ehp - g.enemy.hp, LUNGE_MULT * auto);
  check('Lunge Provokes (she Taunts)', d.taunt > 0);
}
{ // Flurry (Duelist): three reduced strikes.
  const g = passiveGame(['duelist', 'tank', 'mage']);
  const d = g.members[0]; const each = Math.max(1, g.memberDamage(d) - FLURRY_REDUCTION);
  const ehp = g.enemy.hp;
  g._fireAbility(d, null, 'flurry');
  eq('Flurry strikes three times, each reduced', ehp - g.enemy.hp, FLURRY_HITS * each);
}
{ // Strongest in the World (Strongman): pay HP, double the party's next strikes.
  const g = passiveGame(['flagellant', 'tank', 'mage']);
  const f = g.members[0];
  g._fireAbility(f, null, 'strongest');
  eq('Strongest pays its HP', f.hp, 100 - STRONGEST_HP);
  check("Strongest doubles the party's next strikes", g.livingMembers().every((m) => m.drumPrimed));
}
{ // Deadlift (Strongman): a chosen ally is hoisted clear (untargetable).
  const g = passiveGame(['flagellant', 'ranger', 'mage']);
  g._fireAbility(g.members[0], SLOT.CENTER, 'deadlift');
  check('Deadlift hoists the ally clear', g.members[1].untargetable > 0);
  hitAt(g, [SLOT.LEFT, SLOT.CENTER, SLOT.RIGHT], 5);
  check('Deadlift removes the hoisted ally from an AoE', !g._resolvedTargets(g.telegraph!).includes(SLOT.CENTER));
}

finish();
