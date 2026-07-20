import type { CardId } from './tuning';
import RELIC_JSON from '../content/relics.json';
import { renderTemplate } from '../content/interpreter/template';
import type { Rarity, ModifierId, PartyUpgradeDef, HealerUpgradeDef } from './run';
import { HERO_HEAL_PCT } from './run';
import { BEACON_DRAW, BRACE_AMOUNT, FOCUS_STONE_MP, LONE_WOLF_DMG, SMALL_PARTY_MAX, TWIN_CENSER_SPLASH, WARBAND_HP_PER_SEAT } from './tuning';

// ---------------------------------------------------------------------------
// Relics (issue 21, phase A): passive run-long items. Ten legible relics that
// need no rule-changing hooks — each is a constant tweak or a single trigger in
// the engine. All relic code is INERT when the run owns none (regression gate).
// ---------------------------------------------------------------------------

// #106: ids are plain strings — relics.json is the source of truth. The
// exhaustiveness the union gave Record<> maps is replaced by the content
// validator and test/content/coverage.test.ts.
export type RelicId = string;

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
// The same number as a MULTIPLIER, derived rather than restated so the two can never
// drift. The relic's hook is a `mul`, and `{mul: {sum: [1, {mul: [-1, {tune: …}]}]}}`
// spells "1 - pct" in JSON at a cost in legibility that nobody should have to pay.
export const HAGGLER_PRICE_MULT = 1 - HAGGLER_DISCOUNT_PCT;
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

// #106: relic metadata is read from relics.json. Descs resolve their tuning
// references once, at load, so consumers see plain strings exactly as before.
// The constants relic descs reference. Listed explicitly rather than derived: this
// module cannot enumerate its own exports without a self-import, and the magnitudes
// below are declared above this point in the same file. A desc naming anything not
// here fails validation at startup rather than rendering a stray placeholder.
const RELIC_TUNING: Record<string, number> = {
  BEACON_DRAW, FOCUS_STONE_MP, LONE_WOLF_DMG, SMALL_PARTY_MAX, TWIN_CENSER_SPLASH,
  WARBAND_HP_PER_SEAT, HOLY_RELIC_HEAL, HERO_HEAL_PCT,
  HAGGLER_DISCOUNT_PCT, FIELD_TRIAGE_BONUS, FIELD_TRIAGE_THRESHOLD, PRAYER_BEADS_MP,
  VANGUARD_BONUS, PACT_PASSIVE_MP, RUSTY_CROWN_ATTACK, RUSTY_CROWN_GOLD,
  OSSUARY_REGEN, OSSUARY_THRESHOLD, VENOM_GLAND_BONUS_TURNS,
  PILGRIM_FLASK_HEAL, SURGEON_THREAD_HEAL_PCT, BEGGARS_BOWL_GOLD, BEGGARS_BOWL_REWARD_SIZE,
};

export const RELICS: Record<RelicId, RelicDef> = Object.freeze(
  Object.fromEntries(Object.entries(RELIC_JSON).map(([id, raw]) => {
    const r = raw as unknown as Record<string, unknown>;
    return [id, {
      id, name: r.name, rarity: r.rarity, icon: r.icon,
      ...(r.curse ? { curse: true } : {}),
      desc: renderTemplate(String(r.desc), { fields: r, tuning: RELIC_TUNING }).text,
    } as RelicDef];
  })),
) as Record<RelicId, RelicDef>;

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
