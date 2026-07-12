import type { CardId, CardType, CardDef, AbilityId } from './tuning';
import { MOD_EFFICIENT_COST, MOD_POTENT_STRENGTH, MOD_LINGERING_TURNS, REFRESH_MP_CAP, REFRESH_TURNS } from './tuning';
import {
  ABSOLUTION_HEAL, ANVIL_STANCE_BONUS, BENEDICTION_HEAL, BENEDICTION_PER_BUFF, BLOOD_BANNER_BONUS, BLOOD_BANNER_HP, BLOOD_BANNER_TURNS, CASCADE_DISCOUNT_PER_ARCANE, CASCADE_DRAW, CHANNEL_MP, CONSECRATION_HEAL, CONSECRATION_STRIKE_BONUS, CONSECRATION_STRIKE_TURNS, CRIMSON_PACT_DRAW, CRIMSON_PACT_HP, DEFENSE_AMOUNT, DOOM_BASE, DOOM_CAP, DOOM_PER_DEBUFF, DRAIN_DMG, DRAIN_MAX_TURNS, DRAIN_MP_MAX, DRAIN_MP_MIN, DREAD_WHISPER_REDUCTION, EMBOLDEN_BONUS, EMBOLDEN_TURNS, EMPOWER_BONUS, EN_GARDE_TURNS, FOCUS_HEAL, FOCUS_SMALL_BONUS, FONT_MP_CAP, FORTIFY_MAX_TURNS, GUARD_DR, GUARD_TURNS, INTERLOCK_GUARD_DR, INTERLOCK_GUARD_TURNS, MENDING_STREAM_HEAL, MENDING_STREAM_MAX_TURNS, NIGHTFALL_BASE, NIGHTFALL_CAP, NIGHTFALL_PER_SHADOW, OPEN_VEINS_DMG, OPEN_VEINS_HP, PENANCE_HP, PENANCE_STRIKE_BONUS, RADIANCE_HEAL, RALLY_DMG_PER_SEAT, REFRESH_CHANNEL_MAX_TURNS, REFRESH_CHANNEL_MP, ROOTBIND_BONUS_TURNS, SAP_MAX_TURNS, SAP_VULN_CAP, SAP_VULN_PER_TICK, SCARLET_WARD_HP, SHADOW_BOLT_DMG, SHARPEN_BONUS, SHARPEN_TURNS, SIPHON_LIFE_DMG, SIPHON_LIFE_HEAL, SMALL_PARTY_MAX, SPOREBURST_POISON, SUNRISE_VIGIL_HEAL, TAUNT_TURNS, THORNSKIN_REDUCTION, TRANSFUSION_HEAL, TRANSFUSION_HP, UMBRAL_FEAST_PER_EFFECT
} from './tuning';
import type { DeckCard, ResolvedCard } from './run';


// Card definitions. `target` drives the UI's targeting flow.
//   'single' -> one living member, 'all' -> no pick, 'dead' -> one dead member,
//   'none'   -> no pick. Per-member ability cards (#44) are 'none' + an `ability`
//   binding: they auto-resolve on the deployed member who carries that ability.
//
// These raw defs omit `type`; CARDS (below the table) folds in each card's type
// from the exhaustive CARD_TYPE map, so the taxonomy lives in one legible place
// while CardDef.type stays a required field on the assembled table.
const CARD_DEFS: Record<CardId, Omit<CardDef, 'type'>> = {
  // --- per-member ability cards (#44): the healer enables the member's move ----
  // One is inserted into the battle deck for each deployed member; cost mirrors the
  // old generic Ability card (2 MP). Unplayable while the bound member is down.
  imbuePoison: { id: 'imbuePoison', name: 'Imbue Venom', cost: 2, target: 'none', ability: 'poison',
    desc: 'Lace the Ranger\'s arrows — Poison the enemy.' },
  bolster: { id: 'bolster', name: 'Bolster', cost: 2, target: 'none', ability: 'taunt',
    desc: 'Steel the Tank — they Taunt the enemy and brace.' },
  unleash: { id: 'unleash', name: 'Unleash', cost: 2, target: 'none', ability: 'bolt',
    desc: 'Unleash the Mage\'s stored Charge as a Lightning Bolt.' },
  hex: { id: 'hex', name: 'Hex', cost: 2, target: 'none', ability: 'hex',
    desc: 'Curse the enemy through the Warlock — it takes more damage (more with fewer allies).' },
  conduct: { id: 'conduct', name: 'Conduct', cost: 2, target: 'none', ability: 'crescendo',
    desc: 'Cue the Skald\'s Crescendo — draw cards.' },
  incite: { id: 'incite', name: 'Incite', cost: 2, target: 'none', ability: 'rampage',
    desc: 'Incite the Berserker — a doubled strike at an HP cost.' },
  hush: { id: 'hush', name: 'Hush', cost: 2, target: 'none', ability: 'graveChill',
    desc: 'Channel the Augur\'s Grave Chill — weaken the enemy\'s telegraph.' },
  beckon: { id: 'beckon', name: 'Beckon', cost: 2, target: 'none', ability: 'callBoar',
    desc: 'Beckon the Beast Warden\'s Boar to soak hits at her side.' },
  // Stagger (#61) costs 5 MP — the higher price (vs the 2 MP other ability cards) is
  // the balance lever: no once-per-fight cap, the MP burn plus the tempo lost toward
  // enrage is what limits stunning.
  stagger: { id: 'stagger', name: 'Stagger', cost: 5, target: 'none', ability: 'stun',
    desc: 'Through the Sentinel, Stun the enemy — cancel its telegraphed action.' },
  ferment: { id: 'ferment', name: 'Ferment', cost: 2, target: 'none', ability: 'ferment',
    desc: 'Through the Plaguewright, Ferment the enemy\'s Poison — it compounds instead of expiring.' },
  // Liturgy (#73) needs an active channel to enhance (needsChannel gates the dead cast).
  liturgy: { id: 'liturgy', name: 'Liturgy', cost: 2, target: 'none', ability: 'liturgy', needsChannel: true,
    desc: 'Through the Hierophant, give your active channel dual cadence — an extra enemy-phase tick each round.' },
  // En Garde (#74) is the first target 'single' ability card — the Duelist grants the
  // persistent Riposte stance to the chosen member (herself included).
  enGarde: { id: 'enGarde', name: 'En Garde', cost: 2, target: 'single', ability: 'enGarde',
    desc: `Through the Duelist, a chosen member gains Riposte for ${EN_GARDE_TURNS} enemy turns — they counter every hit that strikes them.` },
  // Penance (#75) is a Blood ability card (incite precedent — target 'none', counts toward
  // the blood type counters). It carries NO selfDamage field: the payment is not the clamped
  // canPlay Blood gate but a raw lethal drain in _fireAbility (this ability is meant to be
  // castable at any HP — a lethal Penance is a legal, informed sacrifice, so there is no
  // ">N HP" playability gate). The Sanguine surcharge is applied in the engine, not via _bloodCost.
  penance: { id: 'penance', name: 'Penance', cost: 2, target: 'none', ability: 'penance',
    desc: `Through the Flagellant, pay ${PENANCE_HP} HP (no clamp — it can kill him); every living member's auto deals +${PENANCE_STRIKE_BONUS} this turn.` },
  // Radiance (#76) is a Holy ability card (target 'none'): it heals the whole party and
  // converts overheal to Brace. Holy type => counts toward holy counters and Reliquary of
  // Light's +1 holy heal applies (see _fireAbility's radiance case).
  radiance: { id: 'radiance', name: 'Radiance', cost: 2, target: 'none', ability: 'radiance',
    desc: `Through the Lightkeeper, heal every living member ${RADIANCE_HEAL}; each member's overheal hardens into Brace (stacks with existing Brace; a Shield is kept).` },
  lowHeal: { id: 'lowHeal', name: 'Quick Heal', cost: 1, target: 'single', heal: 2,
    desc: 'Heal a member for 2.' },
  highHeal: { id: 'highHeal', name: 'Heal', cost: 3, target: 'single', heal: 4,
    desc: 'Heal a member for 4.' },
  aoeHeal: { id: 'aoeHeal', name: 'Group Heal', cost: 3, target: 'all', heal: 2,
    desc: 'Heal all living members for 2.' },
  regen: { id: 'regen', name: 'Regen', cost: 2, target: 'single', regen: 2,
    desc: 'Regen +2: heal 2, then 1, decaying each turn. Adds to an existing Regen.' },
  shield: { id: 'shield', name: 'Shield', cost: 3, target: 'single',
    desc: 'Fully block the next attack instance on a member.' },
  // Resurrect reworked (#18, flaw #14): 6 MP -> 4 and the revived member comes
  // back behind a Shield, so a revive isn't immediately undone by the standing
  // telegraph — worth casting against bosses where deaths are rare but brutal.
  resurrect: { id: 'resurrect', name: 'Resurrect', cost: 4, target: 'dead',
    desc: 'Revive a dead member to 50% max HP behind a Shield.' },
  // Refresh reworked to a channel (#64): instead of a fire-and-forget MP-over-time
  // buff, it now restores MP each turn only while you keep channeling (play no other
  // card). Font of Mana (below) stays the buff-style MP engine.
  refresh: { id: 'refresh', name: 'Refresh', cost: 3, target: 'none', engine: true,
    channel: { maxTurns: REFRESH_CHANNEL_MAX_TURNS },
    desc: `Channel: restore ${REFRESH_CHANNEL_MP} MP each turn for up to ${REFRESH_CHANNEL_MAX_TURNS} turns. Playing any card ends it.` },
  cleanse: { id: 'cleanse', name: 'Cleanse', cost: 1, target: 'none',
    desc: 'Remove Hex (the healing-reduction curse) from the party.' },
  // --- card set phase A (#15): shop-only cards on existing engine state ------
  overgrowth: { id: 'overgrowth', name: 'Overgrowth', cost: 3, target: 'all', regen: 1, noPotent: true,
    desc: 'Regen +1 on every living member (decays each turn; adds to existing Regen).' },
  cultivate: { id: 'cultivate', name: 'Cultivate', cost: 1, target: 'single', needsRegen: true,
    desc: 'Strengthen a member\'s active Regen: +1 (heals more and lasts a turn longer).' },
  bloom: { id: 'bloom', name: 'Bloom', cost: 2, target: 'single', needsRegen: true,
    desc: 'Consume a member\'s Regen: heal 2 per remaining tick.' },
  fontOfMana: { id: 'fontOfMana', name: 'Font of Mana', cost: 3, target: 'none',
    refresh: 3, refreshCap: FONT_MP_CAP, engine: true,
    desc: 'Refresh 3: restore 3 MP per turn for 3 enemy turns.' },
  inspiration: { id: 'inspiration', name: 'Inspiration', cost: 2, target: 'none', draw: 2, engine: true,
    desc: 'Draw 2 cards.' },
  // --- card set phase B (#16): cards with small new engine state -------------
  lifebloom: { id: 'lifebloom', name: 'Lifebloom', cost: 3, target: 'single', regen: 2,
    desc: 'Regen +2 (decays each turn); when it ends while the target lives, burst-heal 3.' },
  surge: { id: 'surge', name: 'Surge', cost: 2, target: 'none',
    desc: 'The next card you play this turn costs 0 MP.' },
  battleHymn: { id: 'battleHymn', name: 'Battle Hymn', cost: 1, target: 'none',
    desc: 'Every living member\'s attack this turn deals +2.' },
  barrier: { id: 'barrier', name: 'Barrier', cost: 4, target: 'all',
    desc: 'Every living member gains a Shield; unused ones fade after the next enemy phase.' },
  bloodTithe: { id: 'bloodTithe', name: 'Blood Tithe', cost: 0, target: 'single', selfDamage: 4, engine: true,
    desc: 'A member with more than 4 HP pays 4 HP; restore 2 MP.' },
  martyrsGift: { id: 'martyrsGift', name: 'Martyr\'s Gift', cost: 2, target: 'single', selfDamage: 3, heal: 4,
    desc: 'A member with more than 3 HP pays 3 HP; every other living member heals 4.' },
  grimHarvest: { id: 'grimHarvest', name: 'Grim Harvest', cost: 2, target: 'single', selfDamage: 4,
    desc: 'A member with more than 4 HP pays 4 HP; deal 10 damage to the enemy.' },
  // --- card set phase C (#17): the Bulwark / Defense pipeline ----------------
  // ("Phalanx" per Q10 — the old "Aegis" name collides with a relic.)
  phalanx: { id: 'phalanx', name: 'Phalanx', cost: 2, target: 'single', noDefense: true, noTaunt: true,
    desc: 'Defense 2 for 2 enemy turns. Cannot target a defended or taunting member.' },
  brace: { id: 'brace', name: 'Brace', cost: 1, target: 'single', noDefense: true,
    desc: 'The next attack on the target deals 2 less. Replaces a Shield (and vice versa).' },
  // Taunt-lite (#31): make any member the enemy's aim — the taunt-less draft's
  // redirection tool, so the Tank isn't mandatory in every party.
  provoke: { id: 'provoke', name: 'Provoke', cost: 1, target: 'single',
    desc: 'The target Taunts (enemy aims at them) and braces (Defense 1) for 2 enemy turns.' },
  // --- Iron mitigation web (#65): steer hits, get paid for blocking ----------
  // Feint redirects EVERY hit of the standing telegraph onto one member (a
  // multi-hit blow stacks all its hits on them) — reuses the taunt-retarget path,
  // but as a card effect with no MP surcharge (the card's cost is the price).
  feint: { id: 'feint', name: 'Feint', cost: 1, target: 'single',
    desc: 'Redirect every hit of the standing telegraph onto the target member.' },
  // Anvil Stance is stateful-conditional: the +damage is checked at auto time
  // against the member's CURRENT Shield/Brace hold, and the mark persists for the
  // fight (the condition — not a timer — gates the bonus).
  anvilStance: { id: 'anvilStance', name: 'Anvil Stance', cost: 2, target: 'single',
    desc: `While the target holds a Shield or Brace, their attacks deal +${ANVIL_STANCE_BONUS}.` },
  // Interlock blankets the party in Guard; its grants stack freely (no cap) and each
  // decays on its own timer — the one place Guard's no-self-stack rule is relaxed.
  interlock: { id: 'interlock', name: 'Interlock', cost: 2, target: 'all',
    desc: `Every living member gains Guard ${INTERLOCK_GUARD_DR} for ${INTERLOCK_GUARD_TURNS} enemy turns (stacks with any Guard).` },
  // --- Regen conversions (#66): spend Regen across domains --------------------
  // Thornskin has no timer of its own — its duration IS the target's Regen. While
  // that Regen lasts the member takes 1 less per hit; extending the Regen (Cultivate)
  // extends the reduction, consuming it (Bloom/Sporeburst) ends it. needsRegen-gated.
  thornskin: { id: 'thornskin', name: 'Thornskin', cost: 1, target: 'single', needsRegen: true,
    desc: `While the target's Regen lasts, they take ${THORNSKIN_REDUCTION} less from each hit.` },
  // Sporeburst consumes the whole remaining Regen and converts every consumed tick
  // into a turn of enemy Poison (via the wave-wide poison stacking rule). needsRegen-gated.
  sporeburst: { id: 'sporeburst', name: 'Sporeburst', cost: 2, target: 'single', needsRegen: true,
    desc: `Consume the target's Regen; Poison the enemy ${SPOREBURST_POISON}/turn for as many turns as ticks consumed.` },
  // --- Shadow cards (#63, Part A′): healer-castable direct damage / debuff payoff --
  shadowBolt: { id: 'shadowBolt', name: 'Shadow Bolt', cost: 1, target: 'none',
    desc: `Deal ${SHADOW_BOLT_DMG} damage to the enemy.` },
  siphonLife: { id: 'siphonLife', name: 'Siphon Life', cost: 2, target: 'single',
    desc: `Deal ${SIPHON_LIFE_DMG} to the enemy and heal a member for ${SIPHON_LIFE_HEAL}.` },
  // Doom (rare): a big nuke that scales with how debuffed the enemy is — reward for a
  // debuff-first Shadow line (Hex's Vulnerability, Poison). Capped.
  doom: { id: 'doom', name: 'Doom', cost: 4, target: 'none',
    desc: `Deal ${DOOM_BASE} damage, +${DOOM_PER_DEBUFF} per active enemy debuff and more the more Vulnerable it is (cap ${DOOM_CAP}).` },
  // --- Status-window management (#67): Poison / Vulnerability as resources -----
  // Hemorrhage cashes the enemy's whole Poison out in one uncapped hit (per-turn ×
  // turns left) through _damageEnemy, so Vulnerability multiplies the cash-out (the
  // poison ticks it consumes stay unmultiplied). needsPoison-gated: a dead card with
  // no poison to spend (mirrors needsRegen's UX, but reads the enemy).
  hemorrhage: { id: 'hemorrhage', name: 'Hemorrhage', cost: 3, target: 'none', needsPoison: true,
    desc: `Consume the enemy's Poison and deal its whole remaining damage (per-turn × turns left) at once.` },
  // Umbral Feast reads the board: 1 damage per active effect in play — every party
  // buff and every enemy debuff. Uncapped; the count is taken at cast time.
  umbralFeast: { id: 'umbralFeast', name: 'Umbral Feast', cost: 2, target: 'none',
    desc: `Deal ${UMBRAL_FEAST_PER_EFFECT} per active effect in play — every party buff and enemy debuff counts.` },
  // Dread Whisper shaves the standing telegraph by 1 per target (floor 0), like Grave
  // Chill — stacks with every other reduction to zero out a sweep.
  dreadWhisper: { id: 'dreadWhisper', name: 'Dread Whisper', cost: 1, target: 'none',
    desc: `The standing telegraph deals ${DREAD_WHISPER_REDUCTION} less per target (min 0).` },
  // --- Blood + cycling (#68): HP as a spendable resource ---------------------
  // Crimson Pact draws 2 through the normal draw path (a reshuffle mid-draw fires
  // Prayer Beads / Grimoire); like Inspiration it is `engine`-tagged (draw effect),
  // so Retain/Efficient are ineligible. 0-MP — the HP is the cost (Blood Tithe precedent).
  crimsonPact: { id: 'crimsonPact', name: 'Crimson Pact', cost: 0, target: 'single', selfDamage: CRIMSON_PACT_HP, draw: CRIMSON_PACT_DRAW, engine: true,
    desc: `A member with more than ${CRIMSON_PACT_HP} HP pays ${CRIMSON_PACT_HP} HP; draw ${CRIMSON_PACT_DRAW}.` },
  scarletWard: { id: 'scarletWard', name: 'Scarlet Ward', cost: 1, target: 'single', selfDamage: SCARLET_WARD_HP,
    desc: `A member with more than ${SCARLET_WARD_HP} HP pays ${SCARLET_WARD_HP} HP; gain a Shield.` },
  openVeins: { id: 'openVeins', name: 'Open Veins', cost: 0, target: 'single', selfDamage: OPEN_VEINS_HP,
    desc: `A member with more than ${OPEN_VEINS_HP} HP pays ${OPEN_VEINS_HP} HP; deal ${OPEN_VEINS_DMG} to the enemy.` },
  transfusion: { id: 'transfusion', name: 'Transfusion', cost: 1, target: 'single', selfDamage: TRANSFUSION_HP, heal: TRANSFUSION_HEAL,
    desc: `A member with more than ${TRANSFUSION_HP} HP pays ${TRANSFUSION_HP} HP; the most wounded other member heals ${TRANSFUSION_HEAL}.` },
  // Blood Banner has no ">N HP" gate (clamped, target 'none'): every living member
  // pays, and the payment leaves each at 1 HP minimum.
  bloodBanner: { id: 'bloodBanner', name: 'Blood Banner', cost: 2, target: 'none',
    desc: `Every living member pays ${BLOOD_BANNER_HP} HP (clamps to 1); the party's autos deal +${BLOOD_BANNER_BONUS} for ${BLOOD_BANNER_TURNS} enemy turns.` },
  // --- Holy overheal & board-state payoffs (#69) -----------------------------
  // Benediction heals a flat base plus BENEDICTION_PER_BUFF per active buff on the
  // TARGET (the per-member half of _activeEffectCount, #67). No cap — buff density pays.
  benediction: { id: 'benediction', name: 'Benediction', cost: 2, target: 'single', heal: BENEDICTION_HEAL,
    desc: `Heal ${BENEDICTION_HEAL}, +${BENEDICTION_PER_BUFF} per active buff on the target. No cap.` },
  // Sunrise Vigil queues a delayed party heal: at the START of your next turn (after the
  // enemy blow and the Regen tick, before the draw) every living member heals. Cast twice,
  // it queues twice. The wave's timing tool — heal AFTER the blow lands.
  sunriseVigil: { id: 'sunriseVigil', name: 'Sunrise Vigil', cost: 2, target: 'none',
    desc: `At the start of your next turn, heal every living member ${SUNRISE_VIGIL_HEAL}.` },
  // Consecration heals the whole party a little; members at FULL HP afterward turn the
  // surplus into offense — a standing +auto for a couple enemy turns.
  consecration: { id: 'consecration', name: 'Consecration', cost: 3, target: 'all', heal: CONSECRATION_HEAL,
    desc: `Heal all ${CONSECRATION_HEAL}; members at full HP afterward gain +${CONSECRATION_STRIKE_BONUS} auto for ${CONSECRATION_STRIKE_TURNS} enemy turns.` },
  // Absolution heals, then converts any OVERHEAL into Brace on the target (uncapped). It
  // captures the overheal itself, so Aegis Font sees none of it this cast — the two never
  // double-convert one heal (Absolution converts first; see engine _applyHeal).
  absolution: { id: 'absolution', name: 'Absolution', cost: 2, target: 'single', heal: ABSOLUTION_HEAL,
    desc: `Heal ${ABSOLUTION_HEAL}; any overheal becomes Brace on the target. No cap.` },
  // Rootbind (Nature) extends every FRIENDLY timed effect by a turn — Regen, Shield/Brace
  // fuses, Guard, Defense, strike buffs, Taunt. Makes every timed effect, old and new, worth more.
  rootbind: { id: 'rootbind', name: 'Rootbind', cost: 2, target: 'none',
    desc: `All friendly timed effects (Regen, Shield/Brace, Guard, Defense, strike buffs, Taunt) last +${ROOTBIND_BONUS_TURNS} turn.` },
  // --- channel archetype rescue + arcane support (#70) -----------------------
  // Attunement (engine): draw 1, and neither Attunement NOR the card it draws breaks a
  // running channel (#64). The keep-alive that lets a channel deck run cheap cards. The
  // draw's channel-exempt stamping is bespoke, so the engine has a dedicated case (the
  // generic `draw` field is not used here).
  attunement: { id: 'attunement', name: 'Attunement', cost: 1, target: 'none', engine: true,
    desc: 'Draw 1. Neither this card nor the card it draws breaks your channel.' },
  // Arcane Lens: arm a one-shot turn flag — the NEXT single-target heal this turn also
  // applies its full amount to the most wounded other member (routes through the normal
  // heal pipeline, so Field Triage / Twin Censer / Beacon all interact). Splash-heal tool.
  arcaneLens: { id: 'arcaneLens', name: 'Arcane Lens', cost: 2, target: 'none',
    desc: 'Your next single-target heal this turn also heals the most wounded other member for the same amount.' },
  // --- count-based payoff cards (#63, Part B) --------------------------------
  cascade: { id: 'cascade', name: 'Cascade', cost: 2, target: 'none', draw: CASCADE_DRAW, engine: true,
    desc: `Draw ${CASCADE_DRAW}. Costs ${CASCADE_DISCOUNT_PER_ARCANE} less per Arcane card already played this turn (min 0).` },
  nightfall: { id: 'nightfall', name: 'Nightfall', cost: 3, target: 'none',
    desc: `Deal ${NIGHTFALL_BASE} damage, +${NIGHTFALL_PER_SHADOW} per Shadow card played this fight (cap ${NIGHTFALL_CAP}).` },
  // --- channeled cards (#64): sustained effects that end when you play a card ------
  drain: { id: 'drain', name: 'Drain', cost: 2, target: 'none',
    channel: { maxTurns: DRAIN_MAX_TURNS },
    desc: `Channel: each turn deal ${DRAIN_DMG} to the enemy and, if it dealt damage, return ${DRAIN_MP_MIN}-${DRAIN_MP_MAX} MP (up to ${DRAIN_MAX_TURNS} turns). Playing any card ends it.` },
  mendingStream: { id: 'mendingStream', name: 'Mending Stream', cost: 2, target: 'single',
    channel: { maxTurns: MENDING_STREAM_MAX_TURNS, single: true },
    desc: `Channel: heal a member for ${MENDING_STREAM_HEAL} each turn (up to ${MENDING_STREAM_MAX_TURNS} turns). Ends if they die or you play a card.` },
  sap: { id: 'sap', name: 'Sap', cost: 2, target: 'none',
    channel: { maxTurns: SAP_MAX_TURNS },
    desc: `Channel: each turn make the enemy more Vulnerable (+${Math.round(SAP_VULN_PER_TICK * 100)}% up to +${Math.round(SAP_VULN_CAP * 100)}%), for up to ${SAP_MAX_TURNS} turns. Playing any card ends it.` },
  fortify: { id: 'fortify', name: 'Fortify', cost: 2, target: 'single',
    channel: { maxTurns: FORTIFY_MAX_TURNS, single: true },
    desc: `Channel: grant a member a Shield each turn (up to ${FORTIFY_MAX_TURNS} turns). Ends if they die or you play a card.` },
  // --- small-party cards (#42): reward fielding fewer bodies -------------------
  rally: { id: 'rally', name: 'Rally', cost: 1, target: 'none',
    desc: `Every living member's attack this turn deals +${RALLY_DMG_PER_SEAT} per empty deploy seat.` },
  focus: { id: 'focus', name: 'Focus', cost: 2, target: 'single', heal: FOCUS_HEAL,
    desc: `Heal a member for ${FOCUS_HEAL} — or ${FOCUS_HEAL + FOCUS_SMALL_BONUS} while fielding ${SMALL_PARTY_MAX} or fewer.` },
  channel: { id: 'channel', name: 'Channel', cost: 1, target: 'none', engine: true,
    desc: `Restore ${CHANNEL_MP} MP, +1 more per empty deploy seat.` },
  holdTheLine: { id: 'holdTheLine', name: 'Hold the Line', cost: 3, target: 'all',
    desc: `While fielding ${SMALL_PARTY_MAX} or fewer, every living member gains a Shield.` },
  // --- hero buff card batch (#62): proactive per-hero buffs -------------------
  guard: { id: 'guard', name: 'Guard', cost: 1, target: 'single',
    desc: `A hero takes ${GUARD_DR} less damage per hit for ${GUARD_TURNS} enemy turns. Stacks with Defense, not with itself.` },
  sharpen: { id: 'sharpen', name: 'Sharpen', cost: 1, target: 'single',
    desc: `A hero's attacks deal +${SHARPEN_BONUS} for ${SHARPEN_TURNS} enemy turns.` },
  // Goad grants the SAME Taunt(+Defense) the Tank's ability does, castable on any
  // hero from the deck (the existing `provoke` card is a lighter taunt-lite).
  goad: { id: 'goad', name: 'Goad', cost: 1, target: 'single',
    desc: `A hero Taunts (enemy aims at them) and braces (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} enemy turns.` },
  // Double Strike (rare): doubles the chosen hero's next basic auto (not an ability).
  doubleStrike: { id: 'doubleStrike', name: 'Double Strike', cost: 2, target: 'single',
    desc: 'A hero\'s next basic attack lands doubled, then is spent.' },
  // Embolden (issue "Rally"): a standing party damage buff (the existing `rally`
  // card is a one-phase, empty-seat buff via hymnBonus — kept as-is).
  embolden: { id: 'embolden', name: 'Embolden', cost: 2, target: 'all',
    desc: `Every fielded hero's attacks deal +${EMBOLDEN_BONUS} for ${EMBOLDEN_TURNS} enemy turns.` },
  empower: { id: 'empower', name: 'Empower', cost: 1, target: 'single',
    desc: `A hero's next ability fires at +${EMPOWER_BONUS} ability power, then is spent.` },
  riposte: { id: 'riposte', name: 'Riposte', cost: 2, target: 'single',
    desc: 'The next attack that hits a hero, they counterattack for their damage.' },
};

// ---------------------------------------------------------------------------
// Card types (#63): the exhaustive taxonomy. This map IS the mapping table — it
// mirrors the design doc's per-type list, and being a Record<CardId, CardType>
// it is typecheck-exhaustive: every card must appear (a missing one is a compile
// error), and CARDS folds each type onto its def below. A type is a THEME, not a
// rulebook — the outliers are called out inline.
// ---------------------------------------------------------------------------
export const CARD_TYPE: Record<CardId, CardType> = {
  // Holy — one-shot heals, resurrect, purify (the current starter core).
  lowHeal: 'holy', highHeal: 'holy', aoeHeal: 'holy', resurrect: 'holy', cleanse: 'holy', focus: 'holy',
  mendingStream: 'holy', /* channeled Holy heal (#64) */
  benediction: 'holy', sunriseVigil: 'holy', consecration: 'holy', absolution: 'holy', /* Holy overheal payoffs (#69) */
  radiance: 'holy', /* Lightkeeper's overheal-to-Brace ability card (#76); Reliquary of Light's +1 holy heal applies */
  // Nature — the regen family, and buffs generally (incl. combat buffs).
  regen: 'nature', overgrowth: 'nature', cultivate: 'nature', bloom: 'nature', lifebloom: 'nature',
  thornskin: 'nature', sporeburst: 'nature', /* Regen conversions (#66) */
  rootbind: 'nature', /* Holy overheal payoffs wave (#69): the timed-effect duration extender */
  battleHymn: 'nature', /* outlier: offense buff */ rally: 'nature', /* outlier: offense buff */
  imbuePoison: 'nature', /* outlier: venom/toxin DoT */ beckon: 'nature', /* outlier: summon */
  ferment: 'nature', /* poison/toxin lives in nature (#63/#72) */
  sharpen: 'nature', doubleStrike: 'nature', embolden: 'nature', empower: 'nature', riposte: 'nature',
  // Shadow — enemy debuffs and direct damage to the enemy.
  unleash: 'shadow', hex: 'shadow', hush: 'shadow', stagger: 'shadow', /* Stun: enemy control */
  shadowBolt: 'shadow', siphonLife: 'shadow', doom: 'shadow', nightfall: 'shadow',
  drain: 'shadow', sap: 'shadow', /* channeled Shadow (#64) */
  hemorrhage: 'shadow', umbralFeast: 'shadow', dreadWhisper: 'shadow', /* Status-window management (#67) */
  // Blood — sacrifice something (usually HP) to gain something.
  bloodTithe: 'blood', martyrsGift: 'blood', grimHarvest: 'blood',
  incite: 'blood', /* outlier: HP-cost doubled strike */
  crimsonPact: 'blood', scarletWard: 'blood', openVeins: 'blood', transfusion: 'blood', bloodBanner: 'blood', /* Blood + cycling (#68) */
  penance: 'blood', /* Flagellant's lethal-blood ability card (#75); counts toward blood counters */
  // Arcane — the mana / card-draw economy.
  refresh: 'arcane', fontOfMana: 'arcane', inspiration: 'arcane', surge: 'arcane', channel: 'arcane', conduct: 'arcane', cascade: 'arcane',
  attunement: 'arcane', arcaneLens: 'arcane', /* channel archetype rescue + arcane support (#70) */
  liturgy: 'arcane', /* channel-economy ability card — dual cadence (#73); Cascade counts it */
  // Iron — protection: shields, Defense, Taunt/Provoke, braces.
  shield: 'iron', barrier: 'iron', phalanx: 'iron', brace: 'iron', provoke: 'iron', holdTheLine: 'iron',
  bolster: 'iron', guard: 'iron', goad: 'iron',
  fortify: 'iron', /* channeled Iron shield (#64) */
  feint: 'iron', anvilStance: 'iron', interlock: 'iron', /* Iron mitigation web (#65) */
  enGarde: 'iron', /* Duelist's persistent-Riposte stance (#74); Iron Ward's first-iron discount applies */
};

// The assembled card table: each raw def with its type folded in. Every card in
// CARDS therefore carries a type (typecheck-enforced by CARD_TYPE's exhaustiveness).
export const CARDS: Record<CardId, CardDef> = Object.fromEntries(
  (Object.keys(CARD_DEFS) as CardId[]).map((id) => [id, { ...CARD_DEFS[id], type: CARD_TYPE[id] }]),
) as Record<CardId, CardDef>;

// A card's primary type (#63). Single source read by pools, starter decks, and the
// engine's per-type synergy counters.
export const cardType = (id: CardId): CardType => CARD_TYPE[id];

// The card ids of a given type (ability cards included — their type counts for
// in-fight synergies even though they are excluded from shop/starter pools).
export const cardsOfType = (type: CardType): CardId[] =>
  (Object.keys(CARD_TYPE) as CardId[]).filter((id) => CARD_TYPE[id] === type);

// Per-type grouping (built once) for pool building and tests.
export const CARDS_BY_TYPE: Record<CardType, CardId[]> = {
  holy: cardsOfType('holy'), nature: cardsOfType('nature'), shadow: cardsOfType('shadow'),
  blood: cardsOfType('blood'), arcane: cardsOfType('arcane'), iron: cardsOfType('iron'),
};

// The fixed 6-card core starting deck: the heal-only six (#51) —
// 1× Group Heal / 3× Quick Heal / 2× Heal, and nothing else. Regen, Refresh,
// Shield and Resurrect are no longer in the opener (they remain reachable via
// card rewards and shops). A 6-card pile cycles fast and cuts early-game power,
// landing before the #58 between-fight-healing balance pass. The per-member
// ability cards are still inserted per deployed member at fight lock-in (see
// abilityCardsForParty), so a full trio fights with 6 + 3 = 9.
export const DECK_LIST: CardId[] = [
  'aoeHeal',
  'lowHeal', 'lowHeal', 'lowHeal',
  'highHeal', 'highHeal',
];

// The bound ability card for each ability (#44). Each member contributes exactly
// this card to the battle deck while deployed.
export const ABILITY_CARD: Record<AbilityId, CardId> = {
  poison: 'imbuePoison',
  taunt: 'bolster',
  bolt: 'unleash',
  hex: 'hex',
  crescendo: 'conduct',
  rampage: 'incite',
  graveChill: 'hush',
  callBoar: 'beckon',
  stun: 'stagger',
  ferment: 'ferment',
  liturgy: 'liturgy',
  enGarde: 'enGarde',
  penance: 'penance',
  radiance: 'radiance',
};

// The set of per-member ability card ids — excluded from the shop pool and Retain
// (they are inserted per-fight, never bought, upgraded, or removed from the run deck).
export const ABILITY_CARD_IDS: ReadonlySet<CardId> = new Set(Object.values(ABILITY_CARD));
export const isAbilityCard = (id: CardId): boolean => ABILITY_CARD_IDS.has(id);


// resolveCard (moved here from the relics region so no later layer imports a value
// from a module that itself reads CARDS at init — breaks the old TDZ cycle, #84).
export function resolveCard(card: DeckCard): ResolvedCard {
  const base = CARDS[card.id];
  let efficient = 0, potent = 0, lingering = 0, retain = false;
  for (const u of card.upgrades) {
    if (u === 'efficient') efficient++;
    else if (u === 'potent') potent++;
    else if (u === 'lingering') lingering++;
    else if (u === 'retain') retain = true;
  }
  const bump = (v: number | undefined): number | undefined =>
    v == null ? undefined : v + potent * MOD_POTENT_STRENGTH;
  return {
    id: base.id,
    name: base.name,
    // Efficient never drives a card below cost 1: a free card opens degenerate
    // edge cases (e.g. it would not count as "played" against Rest). Cards whose
    // BASE cost is 0 (Blood Tithe pays in HP) keep it — the floor only guards
    // against Efficient discounting a card to free, and Efficient is ineligible
    // on 0-cost cards anyway.
    cost: Math.max(Math.min(1, base.cost), base.cost - efficient * MOD_EFFICIENT_COST),
    target: base.target,
    desc: base.desc,
    heal: bump(base.heal),
    // Regen magnitude IS its duration (#52), so Lingering adds to the applied
    // amount here rather than to a separate turn count — Potent and Lingering both
    // deepen the same value. Refresh keeps its own turn count below.
    regen: base.regen == null
      ? undefined
      : base.regen + potent * MOD_POTENT_STRENGTH + lingering * MOD_LINGERING_TURNS,
    refresh: bump(base.refresh),
    draw: base.draw,
    needsRegen: base.needsRegen === true,
    needsPoison: base.needsPoison === true,
    needsChannel: base.needsChannel === true,
    // The cap is the BASE card's designed lifetime — Potent/Lingering change the
    // tempo of a Refresh-slot cast, never its total (flaw #7).
    refreshCap: base.refreshCap ?? REFRESH_MP_CAP,
    selfDamage: base.selfDamage,
    noDefense: base.noDefense === true,
    noTaunt: base.noTaunt === true,
    ability: base.ability,
    channel: base.channel,
    refreshTurns: REFRESH_TURNS + lingering * MOD_LINGERING_TURNS,
    retain,
    upgrades: card.upgrades,
  };
}
