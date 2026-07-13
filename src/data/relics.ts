import type { CardId } from './tuning';
import type { Rarity, ModifierId, PartyUpgradeDef, HealerUpgradeDef } from './run';
import { HERO_HEAL_PCT } from './run';
import { BEACON_DRAW, BRACE_AMOUNT, FOCUS_STONE_MP, LONE_WOLF_DMG, SMALL_PARTY_MAX, TWIN_CENSER_SPLASH, WARBAND_HP_PER_SEAT } from './tuning';

// ---------------------------------------------------------------------------
// Relics (issue 21, phase A): passive run-long items. Ten legible relics that
// need no rule-changing hooks — each is a constant tweak or a single trigger in
// the engine. All relic code is INERT when the run owns none (regression gate).
// ---------------------------------------------------------------------------

export type RelicId =
  | 'lantern'        // hidden attacks reveal their target
  | 'hagglersCharm'  // shop prices -10%
  | 'fieldTriage'    // heals on members below 50% max HP heal +2
  | 'warDrum'        // after an Ability cast, that member's next auto doubles
  | 'prayerBeads'    // +3 MP on each draw-pile reshuffle
  | 'vanguardsBanner'// members at full HP deal +1 on their auto
  // --- phase B (#22): rule-changers ------------------------------------------
  | 'martyrsIcon'    // once/fight, a member death becomes survival at 1 HP
  // --- phase B (#22): curses (bought only, never in spoils, never forced) ---
  | 'pactOfSilence'  // you can no longer Rest; +1 passive MP each turn
  | 'rustyCrown'     // all enemies +1 attack; fight wins pay +40g
  // --- small-party relics (#42): reward fielding fewer bodies ----------------
  | 'loneWolf'       // while fielding <=2, fielded members deal +2 damage
  | 'focusStone'     // while fielding <=2, +2 max MP (fewer bodies to heal)
  | 'warband'        // fielded members gain +3 max HP per empty deploy seat
  // --- card-type synergy relics (#63): read card type on play ----------------
  | 'reliquaryOfLight' // Holy cards heal +1
  // --- Regen conversions relics (#66): pay out when Regen ends / HP drops -----
  | 'ossuaryBell'      // a member dropping below 25% max HP gains Regen 2 (every crossing)
  // --- Status-window management relics (#67): amplify / cash in the windows ---
  | 'venomGland'       // Poison you apply lasts +1 turn
  // --- Holy overheal & board-state relics (#69): pay off a topped-off party -------
  | 'beaconOfSecondSun'// whenever a card heals a member to full, draw 1 (no per-fight cap)
  | 'twinCenser'       // single-target heal cards also heal the most wounded other member 1
  // --- Channel archetype rescue relic (#70): a channel keep-alive ----------------
  | 'chantersIdol'     // the first card you play each turn doesn't break your channel
  // --- Meta-layer / run-economy relics (#71): touch Rest, recovery, rewards ------
  | 'pilgrimsFlask'    // every Rest also heals your most wounded member 2
  | 'surgeonsThread'   // between-fight recovery 40% -> 50% of max HP
  | 'beggarsBowl';     // curse: card rewards offer 2 instead of 3; +20g per won fight

export interface RelicDef {
  id: RelicId;
  name: string;
  rarity: Rarity;
  icon: string; // topbar row glyph
  desc: string;
  curse?: boolean; // a curse: purchasable burden with an upside; never dropped
}

// Relic magnitudes (kept here so balance passes can reach them).
export const HAGGLER_DISCOUNT_PCT = 0.10; // Haggler's Charm: fraction off every shop price (rounds down)
export const TITHE_CANDLE_MP = 1;
// Per-fight bound on the Candle's MP — every MP engine in this game is capped
// (the flaw-#7 law; cf. REFRESH_MP_CAP), and an uncapped Candle reads +15-25 MP
// over a boss fight, which alone breaks the full-run band.
export const TITHE_CANDLE_FIGHT_CAP = 4;
export const FIELD_TRIAGE_BONUS = 2;
export const FIELD_TRIAGE_THRESHOLD = 0.5; // "below 50% max HP"
export const GROUNDING_ROD_REDUCTION = 1;
export const PRAYER_BEADS_MP = 2;
export const STORMGLASS_MIN_HIT = 6; // post-Defense hits this big are negated
export const VANGUARD_BONUS = 1;
// Phase B (#22) magnitudes.
// Aegis Font's Ward buffer cap. Trimmed 2→1 (#35): under player-first ordering (#26)
// overheal gets a safe turn to convert to Wards, drifting the relic to +9.8pp; a
// 1-point cap lands it at +7.1pp (N=1000), inside the ≤+9pp band. See sim/experiments/relic-exp.ts.
export const WARD_MAX = 1;             // Aegis Font's Ward buffer cap
export const TAPER_MAX_COST = 3;       // Taper only discounts cards this cheap
// Taper discount magnitude (#35). Under player-first ordering (#26) a FULL zeroing
// of the first card every turn compounded to +10.8pp — the strongest relic measured,
// out of the ≤+9pp band. A partial −2 discount keeps the per-turn relief (the whole
// value; once-per-fight measured ~0) but lands it at +8.8pp (N=1000). A −1 discount
// undershoots to +1.7pp; dropping TAPER_MAX_COST 3→2 measured *stronger* (fewer
// penalty firings). See sim/experiments/relic-exp.ts.
export const TAPER_DISCOUNT = 2;       // MP the first cheap non-engine card is reduced by
// Telegraphs totalling this much can be delayed once per run. Lowered 13→10 (#35):
// at 13 the once-per-run Chime drifted to +4.8pp, below a relic slot's opportunity
// cost; letting 10+ telegraphs qualify lifts it to +5.9pp (N=1000), still in band.
export const DUSK_CHIME_MIN = 10;      // telegraphs totalling this much can be delayed
// Pact of Silence's passive MP per turn. Held at 1 (#35): the standalone curse reads
// −23.9pp under player-first ordering, but the passive-MP lever swings ~±23pp PER
// POINT — +2 flips it to +23.2pp (a top relic, absurd for a curse). No integer buff
// lands it as a "mild curse", so it is priced as the hard trap it is; the sim policy
// already values every curse at 0 and never takes one. See sim/experiments/relic-exp.ts.
export const PACT_PASSIVE_MP = 1;      // Pact of Silence's passive MP per turn
export const CRACKED_HOURGLASS_ENRAGE = 9; // enrage turn under the Hourglass
export const HOURGLASS_POWER_BONUS = 2;    // Poison & Bolt power under the Hourglass
export const RUSTY_CROWN_ATTACK = 1;   // enemy attack bonus under the Crown
export const RUSTY_CROWN_GOLD = 15;    // extra gold per fight win under the Crown
// Card-type synergy relics (#63). Magnitudes are tunable — a later balance pass
// owns the numbers; this issue ships the mechanics. Each reads a card's type on
// play (via the per-type counters / cardType), so all three share one source.
export const HOLY_RELIC_HEAL = 1;       // Reliquary of Light: Holy cards heal +this
export const SHADOW_RELIC_DMG = 1;      // Shadow Sigil: +this to the enemy after a Shadow card
export const IRON_RELIC_DISCOUNT = 1;   // Iron Ward: the first Iron card each turn costs this less
// Iron mitigation web relics (#65). Magnitudes tunable; a later balance pass owns them.
export const WHETSTONE_BONUS = 1;       // Whetstone: +auto damage for a member untouched last enemy phase
// Regen conversions relics (#66). Magnitudes tunable; a later balance pass owns them.
// Ossuary Bell tuning (N=1000, ≤ +9pp gate): free per-crossing Regen is strong in an
// MP-starved game — at the issue's 50% / Regen 2 it read +17.3pp, and even Regen 1 (the
// integer floor of the magnitude lever) at 50% stayed +11.6pp. With the magnitude floored,
// the trigger THRESHOLD (a design knob, NOT the forbidden per-fight trigger cap) drops to
// 25%: every crossing still retriggers, but the deeper line lands it at +7.3pp, in band.
export const OSSUARY_REGEN = 2;          // Ossuary Bell: Regen granted each time a member crosses below the threshold
export const OSSUARY_THRESHOLD = 0.25;   // Ossuary Bell: fires on a downward crossing of this fraction of max HP
// Status-window management relics (#67). Magnitudes tunable; a later balance pass owns them.
export const VENOM_GLAND_BONUS_TURNS = 1; // Venom Gland: extra turns on every Poison application while owned
export const EMBERMARK_DMG = 4;           // Embermark: damage dealt on every natural Vulnerability expiry
// Blood + cycling relics (#68). Magnitudes tunable; a later balance pass owns them.
// Grimoire is deliberately UNCAPPED (user verdict removed the 2×/fight cap): reshuffle
// frequency is bounded by draws, which cost cards/MP, so the loop is self-limiting.
export const GRIMOIRE_DMG = 3;               // Grimoire of Turning: damage dealt to the enemy on every reshuffle
export const SANGUINE_PACT_SURCHARGE = 2;    // Sanguine Pact (curse): extra HP every Blood-card cost pays
export const SANGUINE_PACT_AUTO_BONUS = 2;   // Sanguine Pact (curse): +auto damage while any member is below the threshold
export const SANGUINE_PACT_THRESHOLD = 0.5;  // Sanguine Pact (curse): "below 50% HP" holds the auto buff open
// Meta-layer / run-economy relics (#71). Magnitudes tunable; a later balance pass owns them.
export const PILGRIM_FLASK_HEAL = 2;         // Pilgrim's Flask: HP healed to the most wounded living member on every Rest (scoped from all-members to fit the ≤+9pp gate; see engine skipTurn)
export const SURGEON_THREAD_HEAL_PCT = 0.5;  // Surgeon's Thread: between-fight recovery fraction while owned (vs HERO_HEAL_PCT)
export const BEGGARS_BOWL_GOLD = 20;         // Beggar's Bowl (curse): extra gold per won fight
export const BEGGARS_BOWL_REWARD_SIZE = 2;   // Beggar's Bowl (curse): card-reward offers rolled per won fight

export const RELICS: Record<RelicId, RelicDef> = {
  lantern: { id: 'lantern', name: 'Searchlight', rarity: 'common', icon: '🔦',
    desc: 'Hidden attacks reveal their target.' },
  hagglersCharm: { id: 'hagglersCharm', name: 'Haggler\'s Charm', rarity: 'common', icon: '🪙',
    desc: `All shop prices −${Math.round(HAGGLER_DISCOUNT_PCT * 100)}%.` },
  fieldTriage: { id: 'fieldTriage', name: 'Field Triage Kit', rarity: 'uncommon', icon: '🩹',
    desc: `Heals on a member below ${FIELD_TRIAGE_THRESHOLD * 100}% max HP heal +${FIELD_TRIAGE_BONUS}.` },
  warDrum: { id: 'warDrum', name: 'War Drum', rarity: 'uncommon', icon: '🥁',
    desc: 'After a member casts their Ability, their next auto-attack deals double.' },
  prayerBeads: { id: 'prayerBeads', name: 'Fidget Beads', rarity: 'common', icon: '📿',
    desc: `+${PRAYER_BEADS_MP} MP each time the draw pile is reshuffled.` },
  vanguardsBanner: { id: 'vanguardsBanner', name: 'Team Pennant', rarity: 'rare', icon: '🚩',
    desc: `Members at full HP deal +${VANGUARD_BONUS} on their auto-attack.` },
  // --- phase B (#22): rule-changers ------------------------------------------
  martyrsIcon: { id: 'martyrsIcon', name: 'Guardian Feather', rarity: 'rare', icon: '🕊',
    desc: 'Once per fight, a member death becomes survival at 1 HP.' },
  // --- phase B (#22): curses -------------------------------------------------
  pactOfSilence: { id: 'pactOfSilence', name: 'Cursed Coffee', rarity: 'rare', icon: '☕', curse: true,
    desc: `CURSE — you can no longer Rest; gain +${PACT_PASSIVE_MP} MP at the start of each turn.` },
  rustyCrown: { id: 'rustyCrown', name: 'Rusty Crown', rarity: 'rare', icon: '👑', curse: true,
    desc: `CURSE — normal enemies attack +${RUSTY_CROWN_ATTACK} harder (bosses are proud enough); fight wins pay +${RUSTY_CROWN_GOLD}g.` },
  // --- small-party relics (#42): a build-around for fielding fewer bodies -------
  loneWolf: { id: 'loneWolf', name: 'Lone Wolf Totem', rarity: 'uncommon', icon: '🐺',
    desc: `While fielding ${SMALL_PARTY_MAX} or fewer members, each of them deals +${LONE_WOLF_DMG} damage.` },
  focusStone: { id: 'focusStone', name: 'Thinking Cap', rarity: 'uncommon', icon: '🎩',
    desc: `While fielding ${SMALL_PARTY_MAX} or fewer members, +${FOCUS_STONE_MP} max MP (fewer bodies to tend).` },
  warband: { id: 'warband', name: 'Roomy Tent', rarity: 'rare', icon: '⛺',
    desc: `Fielded members gain +${WARBAND_HP_PER_SEAT} max HP for each empty deploy seat.` },
  // --- card-type synergy relics (#63) ----------------------------------------
  reliquaryOfLight: { id: 'reliquaryOfLight', name: 'Glitter Box', rarity: 'uncommon', icon: '✨',
    desc: `Holy cards heal +${HOLY_RELIC_HEAL}.` },
  // --- Regen conversions relics (#66) ----------------------------------------
  ossuaryBell: { id: 'ossuaryBell', name: 'Second-Wind Chime', rarity: 'uncommon', icon: '🔔',
    desc: `Whenever a member drops below ${OSSUARY_THRESHOLD * 100}% max HP, they gain Regen ${OSSUARY_REGEN}.` },
  // --- Status-window management relics (#67) ---------------------------------
  venomGland: { id: 'venomGland', name: 'Venom Gland', rarity: 'uncommon', icon: '🦂',
    desc: `Poison you apply lasts +${VENOM_GLAND_BONUS_TURNS} turn.` },
  // --- Holy overheal & board-state relics (#69) ------------------------------
  beaconOfSecondSun: { id: 'beaconOfSecondSun', name: 'Beacon of the Second Sun', rarity: 'rare', icon: '🌅',
    desc: `Whenever a card heals a member to full, draw ${BEACON_DRAW}.` },
  twinCenser: { id: 'twinCenser', name: 'Buddy System', rarity: 'rare', icon: '🤝',
    desc: `Single-target heal cards also heal the most wounded other member ${TWIN_CENSER_SPLASH}.` },
  // --- Channel archetype rescue relic (#70) ----------------------------------
  chantersIdol: { id: 'chantersIdol', name: "Chanter's Idol", rarity: 'rare', icon: '🎐',
    desc: 'The first card you play each turn does not break your channel.' },
  // --- Meta-layer / run-economy relics (#71) ---------------------------------
  pilgrimsFlask: { id: 'pilgrimsFlask', name: 'Nap Sack', rarity: 'common', icon: '🎒',
    desc: `Every Rest also heals your most wounded member ${PILGRIM_FLASK_HEAL}.` },
  surgeonsThread: { id: 'surgeonsThread', name: 'Spare Bandages', rarity: 'common', icon: '🧵',
    desc: `Between-fight recovery rises to ${SURGEON_THREAD_HEAL_PCT * 100}% of max HP (from ${HERO_HEAL_PCT * 100}%).` },
  beggarsBowl: { id: 'beggarsBowl', name: "Beggar's Bowl", rarity: 'rare', icon: '🥣', curse: true,
    desc: `CURSE — card rewards after a won fight offer ${BEGGARS_BOWL_REWARD_SIZE} choices instead of 3; +${BEGGARS_BOWL_GOLD}g per won fight.` },
};

export const RELIC_IDS: RelicId[] = Object.keys(RELICS) as RelicId[];

// Relic prices by rarity (C 50 / U 75 / R 100) — distinct from card prices.
export const RELIC_PRICE: Record<Rarity, number> = { common: 50, uncommon: 75, rare: 100 };

// Relics that counter the act-3 boss (the Gobbler's Big Chomp sweep + heavy singles
// and the post-transform race): the fight-6 spoils roll weights these ×2.
export const ACT3_COUNTER_RELICS: RelicId[] = ['warDrum', 'vanguardsBanner'];

export const SPOILS_OFFER_SIZE = 3;      // relics offered on a spoils screen (pick 1, free)
export const CARD_REWARD_SIZE = 3;       // cards offered after every won fight (pick 1, free, #57)
export const RELIQUARY_STOCK = 3;        // relics stocked by a Reliquary visit
export const RELIQUARY_REMOVALS_MAX = 2; // card removals per Reliquary visit (at CARD_REMOVAL_PRICE)

// Shop offer shapes (a rolled storefront entry plus its gold price). `listPrice`,
// when set, is the pre-sale price to strike through: one card-shop offer is always
// discounted, and its list price is shown crossed out beside the sale price.
export interface CardOffer { cardId: CardId; rarity: Rarity; price: number; listPrice?: number; }
export interface RelicOffer { relicId: RelicId; rarity: Rarity; price: number; }
export interface ModifierOffer { modifier: ModifierId; rarity: Rarity; price: number; }
export interface PartyUpgradeOffer { def: PartyUpgradeDef; price: number; }
export interface HealerUpgradeOffer { def: HealerUpgradeDef; price: number; }
