// Tuning leaf (issue #84): core shared types + all scalar magnitudes. Imports nothing,
// so it can be read at init by every later data module without a load cycle.

export type Slot = 0 | 1 | 2;
// 'heavy' (big single-target hit) and 'sweep' (strong hit on the whole party) are
// the boss's signature attacks — stronger than the basic ones, but fully telegraphed.
// 'cast' is a non-geometry telegraph: a scripted, no-damage effect (the Hexweaver's
// Hex/Siphon, the Devourer's Consume) whose resolution runs game logic, not a hit.
export type AttackType = 'single' | 'two' | 'aoe' | 'hidden' | 'heavy' | 'sweep' | 'cast';
export type CardTarget = 'single' | 'dead' | 'all' | 'none';
// Card types (#63): every card carries exactly one primary type — a readable
// identity axis synergy relics/cards and themed starter decks build on.
//   holy   — one-shot heals, resurrect, purify
//   nature — regen family and buffs generally (incl. combat buffs)
//   shadow — enemy debuffs and direct damage to the enemy
//   blood  — sacrifice something (usually HP) to gain something
//   arcane — the mana / card-draw economy
//   iron   — protection: shields, Defense, Taunt/Provoke, braces
// A type is a THEME, not a rulebook — a few outliers per type are intended.
export type CardType = 'holy' | 'nature' | 'shadow' | 'blood' | 'arcane' | 'iron';
// The classic demo trio plus the post-demo roster (#27-#29). Any member can occupy
// any slot in a drafted party; the engine reads identity from MEMBER_POOL, not slot.
export type MemberId = 'ranger' | 'tank' | 'mage' | 'warlock' | 'skald' | 'berserker' | 'beastWarden' | 'sentinel' | 'duelist' | 'flagellant';
// 'hex' (Warlock, #39) curses the enemy with Vulnerability — the party deals more
// damage to it, and the bonus is LARGER the fewer members are fielded (a small-party
// controller); 'crescendo' (Skald) draws cards and feeds his cards-played strike;
// 'rampage' (Berserker) doubles his current strike at an HP cost; 'callBoar' (Beast
// Warden) summons a pet that soaks whole hits; 'stun' (Sentinel, #61) cancels the
// enemy's standing telegraph — the move is consumed (rotation advances, channel
// wind-up aborts) and a fresh action telegraphs next turn; 'enGarde' (Duelist, #74)
// Provokes a chosen member (Taunt) and grants them PERSISTENT Riposte — for
// EN_GARDE_TURNS enemy turns they counter EVERY hit that strikes them (fully blocked
// hits included) for their live auto damage, not consumed on the first trigger like
// the one-shot Riposte card. It is a target 'single' ability card — the stance can be
// placed on any member, self included. Each fires via that member's own ability card
// (#44), inserted into the deck when they are deployed.
export type AbilityId = 'poison' | 'taunt' | 'bolt' | 'hex' | 'crescendo' | 'rampage' | 'callBoar' | 'stun' | 'enGarde' | 'penance'
  // Learned ability cards (Training Dojo, 2026-07): two extra per hero, acquired at the
  // Dojo node and fired like a signature ability card (bound member, _fireAbility case).
  | 'twinShot' | 'concVenom'        // Ranger
  | 'shieldWall' | 'holdLine'       // Tank
  | 'arcaneSurge' | 'drainLife'     // Mage
  | 'doom' | 'sacrifice'            // Warlock
  | 'finale' | 'duet'               // Busker
  | 'bloodbath' | 'whirlwind'       // Berserker
  | 'sicEm' | 'mendBeast'           // Beast Warden
  | 'standingOvation' | 'bigTop'    // Showstopper
  | 'lunge' | 'flurry'              // Duelist
  | 'strongest' | 'deadlift';       // Strongman
export type CardId =
  | 'lowHeal' | 'highHeal' | 'aoeHeal'
  | 'regen' | 'shield' | 'resurrect' | 'cleanse'
  | 'bloom' | 'fontOfMana' | 'inspiration'
  | 'lifebloom' | 'battleHymn' | 'barrier'
  | 'bloodTithe' | 'martyrsGift'
  | 'phalanx' | 'provoke'
  // Iron mitigation web (#65): steer telegraphed hits, get paid for blocking.
  | 'feint'
  // Regen conversions (#66): turn Regen into enemy Poison.
  | 'sporeburst'
  // Status-window management (#67): manage enemy Poison / Vulnerability windows.
  | 'hemorrhage' | 'dreadWhisper'
  // Blood + cycling (#68): HP as a spendable resource — draw, shields,
  // redistribution, and party offense, all priced in HP the healer manages.
  | 'crimsonPact' | 'scarletWard' | 'transfusion' | 'bloodBanner'
  // Holy board-state payoffs (#69): a healthy party becomes a plan.
  | 'sunriseVigil' | 'consecration'
  // Arcane support (#70): a splash enabler.
  | 'arcaneLens'
  // Channeled cards (#64): hold an effect across turns while you play nothing else.
  // Sap reads Shadow, Mending Stream Holy.
  | 'mendingStream' | 'sap'
  // Hero buff card batch (#62): proactive per-hero buffs. Standing buffs (Guard,
  // Sharpen) decay over N enemy turns; the one-shots (Double Strike, Empower,
  // Riposte) are consumed on use.
  | 'guard' | 'sharpen' | 'doubleStrike' | 'empower' | 'riposte'
  // Per-member ability cards (#44): one bound card per member, inserted into the
  // battle deck when that member is deployed and firing their ability. The healer
  // enables the member's move — the player no longer picks which member acts.
  | 'imbuePoison' | 'bolster' | 'unleash' | 'hex'
  | 'conduct' | 'incite' | 'beckon' | 'stagger' | 'enGarde' | 'penance'
  // Learned ability cards (Training Dojo, 2026-07): two extra ability cards per hero.
  // Card id == its AbilityId; injected on deploy only for the hero that learned it.
  | 'twinShot' | 'concVenom' | 'shieldWall' | 'holdLine' | 'arcaneSurge' | 'drainLife'
  | 'doom' | 'sacrifice' | 'finale' | 'duet' | 'bloodbath' | 'whirlwind'
  | 'sicEm' | 'mendBeast' | 'standingOvation' | 'bigTop' | 'lunge' | 'flurry'
  | 'strongest' | 'deadlift';

// The scripted effect a 'cast' telegraph resolves into. 'wound' halves the party's
// healing for a few turns; 'siphon' drains healer MP; 'consume' (Devourer, #14)
// cleanses the enemy's own poison and self-heals for the remaining ticks; 'poison'
// (#87) lays a stacking, cleansable damage-over-time on the heroes; 'curse' (#87)
// Marks the heroes for a delayed clear-or-die Payoff.
export type CastKind = 'wound' | 'siphon' | 'consume' | 'poison' | 'curse';

export interface MemberDef {
  slot: Slot;
  id: MemberId;
  name: string;
  maxHP: number;
  damage: number;
  ability: AbilityId;
}

// Channeled cards (#64): a card whose effect repeats each turn for as long as the
// player plays nothing else. The engine holds one active channel (card + target +
// ticks remaining) per fight; the per-tick effect is applied by the engine, keyed
// by card id. The first tick lands on the cast turn; playing any card cancels it,
// and it ends on its own after `maxTurns` ticks. While a channel runs the player
// gains no passive/over-time MP — only what the channel itself returns.
// (Named apart from EnemyDef.ChannelDef, which is the enemy's channelled attack.)
export interface CardChannelDef {
  maxTurns: number;  // ticks before the channel ends on its own (first tick on cast)
  single?: boolean;  // a single-target channel that remembers its target and ends
                     // early if that member dies (Mending Stream)
}

export interface CardDef {
  id: CardId;
  name: string;
  cost: number;
  target: CardTarget;
  // Primary card type (#63) — REQUIRED, so every card in CARDS declares one. There
  // is no runtime "untyped" fallback; a missing type is a compile error (CARD_TYPE
  // below is the exhaustive Record that supplies it when CARDS is assembled).
  type: CardType;
  desc: string;
  heal?: number;
  regen?: number;
  refresh?: number;
  draw?: number;        // cards drawn when played (Inspiration)
  // Single-target eligibility gate: the target must carry an active Regen
  // (Cultivate / Bloom are dead cards without one).
  needsRegen?: boolean;
  // Playability gate (#67): the enemy must be Poisoned (Hemorrhage is a dead card
  // with no poison to cash out — mirrors needsRegen's UX, but reads the enemy).
  needsPoison?: boolean;
  // Playability gate (#73): a channel must be active (Liturgy is a dead cast with
  // no channel to grant dual cadence — mirrors needsRegen's no-dead-cast UX).
  needsChannel?: boolean;
  // Excluded from the Potent modifier even though it has a strength field
  // (Overgrowth: +1 strength would be x3 members x3 turns for one upgrade).
  noPotent?: boolean;
  // Per-cast lifetime MP cap override for Refresh-slot cards; defaults to
  // REFRESH_MP_CAP (Font of Mana carries its own larger designed lifetime).
  refreshCap?: number;
  // Blood cards (#16): HP the TARGET pays as a cost. canPlay requires the target
  // to have strictly more HP than this, and the payment clamps to leave 1 HP —
  // Blood self-damage is never lethal (no new death path in playCard).
  selfDamage?: number;
  // Bulwark cards (#17) are Defense-exclusive: the target must not already have
  // an active Defense (this is also how "no stack" is enforced for Phalanx).
  noDefense?: boolean;
  // Phalanx (#17) may not target the taunting member — Taunt's bundled Defense
  // is the tank's lane; Bulwark protects the members Taunt can't.
  noTaunt?: boolean;
  // "Engine" cards generate MP or draw cards (they fuel the economy). Retain is
  // ineligible for them, and later economy modifiers (Taper, #22) gate on the
  // same tag. Keep this the single source of the tag.
  engine?: boolean;
  // Per-member ability card (#44): when set, playing this card fires the bound
  // ability on the deployed living member who carries it (no member pick). The
  // card is unplayable while that member is dead/absent.
  ability?: AbilityId;
  // Channeled card (#64): when set, playing this card starts a channel (see
  // CardChannelDef) instead of a one-shot effect. Its per-tick payoff is applied by
  // the engine, keyed by card id.
  channel?: CardChannelDef;
  // Consume/exhaust (Training Dojo, 2026-07): when set, the card is REMOVED from the
  // fight after one play (not sent to the discard pile, so it never reshuffles). Used by
  // Sacrifice — a one-shot per fight.
  exhaust?: boolean;
  // Playability gate (Training Dojo): the caster must have a living Boar out (Sic 'Em /
  // Mend Beast are dead cards without one — mirrors needsPoison's no-dead-cast UX).
  needsBoar?: boolean;
}

export const SLOT = { LEFT: 0, CENTER: 1, RIGHT: 2 } as const;


// --- Combat / ability magnitudes (moved from the old constants.ts middle region) ---

export const ENRAGE_TURN = 11; // first enraged enemy turn (turn 11 onward)
export const ENRAGE_MULT = 1.25;

export const MP_START = 10;
export const MP_MAX = 10; // hard cap; MP never exceeds this
export const SKIP_REGEN = 5;          // Rest MP when no card was played this phase
export const SKIP_REGEN_DECAYED = 1;  // Rest MP when exactly one card was played (decaying Rest, flaw #5)
export const REFRESH_MP_CAP = 6;      // max MP a single Refresh cast may restore over its lifetime (flaw #7)
export const FONT_MP_CAP = 9;         // Font of Mana's per-cast lifetime (3/turn x 3 turns; net +6 after its 3 MP cost)
export const PASSIVE_MP_CAP = 2;      // max total passiveMp a run may buy (flaw #10)
export const CARD_REMOVAL_PRICE = 20; // unified card-removal price (flaw #17)
export const CASINO_SAFE_GOLD = 25;   // guaranteed payout if you skip the flip (flaw #18)

// Ability values.
export const BOLT_BASE = 5;
export const BOLT_CHARGE_MULT = 3; // Lightning Bolt adds this much damage per Charge
export const CHARGE_MAX = 5;
// Poison stays 5x5 (#18, flaw #13 / Q5 measured 2026-07): the Devourer's
// Consume (#14) already made it a decision — always-poison reads 56.7% there
// while never-poison reads ~71%, so feeding the Consume is a real mistake —
// and the 5x5 value is load-bearing against the other bosses (without it the
// Gatewarden falls 89->70% and the Hexweaver 74->41%). A 4x4 nerf (with or
// without a Bolt execute niche) breaks the Gatewarden >=85% and Hexweaver
// 65-75% gates, and re-tuning three bosses is out of #18's scope. See the
// baseline note in sim/run-sim.ts for the full numbers.
export const POISON_BASE = 5;   // Poison strength: damage dealt per enemy turn.
export const POISON_TURNS = 5;  // enemy turns Poison lasts
// Hero Poison (#87): an ENEMY-applied damage-over-time on the party (the mirror of
// the enemy-side poison above). It ticks its magnitude on each hero at the start of
// the enemy phase, bypassing all mitigation — Cleanse is the sole answer. Re-applying
// STACKS the per-turn magnitude and refreshes the duration to the LONGER of the two
// (same rule as the shared _applyPoison enemy path). A 'poison' cast reads its own
// per-turn strength / duration from the rotation step, falling back to these.
export const HERO_POISON_BASE = 2;  // default hero-poison strength: damage per enemy turn
export const HERO_POISON_TURNS = 3; // default enemy turns hero-poison lasts
// Curse / Mark (#87): a 'curse' cast Marks every living hero (no direct damage); a later
// Payoff step (targetsMarked) hits ONLY the still-Marked heroes for heavy damage. A hero
// survives by clearing the Mark (Cleanse) OR by mitigation (Shield fully blocks it,
// Defense shaves it below lethal) — the Payoff runs the normal ward pipeline. MARK_TURNS
// must outlast the gap to the Payoff: with Mark and Payoff on ADJACENT rotation slots the
// Mark decays once (at the Payoff's enemy-phase start) before it lands, so 2 is the floor.
export const MARK_TURNS = 2;        // enemy turns a Mark persists before it fades on its own
// Ferment (Plaguewright, #72): opens a window of `FERMENT_TURNS` enemy turns per cast
// (recasts add another FERMENT_TURNS, additive). While it runs, each Poison tick deals
// its current per-turn damage, then per-turn grows by FERMENT_GROWTH and the Poison
// duration does NOT decrement — Poison compounds instead of expiring. The growth is
// scaled by the caster's ability power (Empower / injury penalty). No caps.
export const FERMENT_TURNS = 3;   // enemy turns the ferment window runs per cast
export const FERMENT_GROWTH = 2;  // per-turn Poison growth applied after each fermented tick
// Regen (#52): magnitude IS duration — a member's regen is a single value R that
// heals R then decays to R-1 each tick until it hits 0. There is no separate
// duration constant; a Regen R runs for exactly R ticks.
export const REFRESH_TURNS = 3; // enemy turns Refresh lasts
export const TAUNT_TURNS = 4;
export const DEFENSE_AMOUNT = 1; // incoming damage reduced by this while Defense is active
// Post-demo roster wave 1 abilities (#27).
// Warlock Hex (#39): applies Vulnerability to the enemy — the party's damage to it
// is multiplied by (1 + vuln) for HEX_TURNS. The bonus scales inversely with the
// fielded party size (index by size 1/2/3), so it is strongest solo — where it
// amplifies his own low damage enough to carry act 1 — and modest in a full party.
export const HEX_TURNS = 3;
export const HEX_VULN_BY_SIZE = [0, 2.8, 0.55, 0.35]; // [unused, solo, duo, trio+]
export const HEX_VULN_PER_POWER = 0.05; // each point of abilityPower adds this much vuln
export const SKALD_DMG_PER_CARD = 2; // Skald strike: damage per card played this phase
export const SKALD_DMG_CAP = 8;      // Skald strike: cap on the cards-played bonus
export const CRESCENDO_DRAW = 2;     // Crescendo: cards drawn (and it counts as 1 card played)
// Roster wave 2 abilities (#28).
export const BERSERKER_BAND1_HP = 8; // Berserker: +BAND_BONUS damage while HP <= this + fight attackBonus
export const BERSERKER_BAND2_HP = 4; // Berserker: a further +BAND_BONUS while HP <= this + fight attackBonus
export const BERSERKER_BAND_BONUS = 2; // per-band damage bonus (net 2 / 4 / 6 across the bands)
export const RAMPAGE_SELF_DMG = 2;   // Rampage: HP the Berserker loses after the doubled strike
export const GRAVE_CHILL_REDUCTION = 2; // Grave Chill: per-target damage shaved off the standing telegraph
// Hero passives (2026-07). One always-on identity per hero; small magnitudes, sim-tuned.
// (Berserker's Rage bands are the BERSERKER_* constants above; Mage's Arcane Battery and
// Busker's Opening Act reuse the existing +1-Charge / +1-draw and add no constant.)
export const TOXICOLOGIST_BONUS = 2;   // Ranger: +auto damage vs a poisoned enemy
export const GRUDGE_DIVISOR = 2;       // Tank: his next auto adds (banked damage / this)
export const FERAL_BOND_MULT = 3;      // Beast Warden: her next auto after her Boar falls ×this
export const DARK_BARGAIN_DMG = 1;     // Warlock: permanent +damage each time a party member dies
export const DARK_BARGAIN_POWER = 1;   // Warlock: permanent +ability power on the same trigger

// Learned ability cards (Training Dojo, 2026-07): two extra per hero. First-draft numbers;
// a balance pass owns them. Multi-strike counts / mults live inline where obvious.
export const TWIN_SHOT_HITS = 2;         // Ranger Twin Shot: auto strikes this many times
export const CONC_VENOM_MULT = 2;        // Ranger Concentrated Venom: enemy poison-per-turn ×this
export const SHIELD_WALL_DEFENSE = 2;    // Tank Shield Wall: party Defense strength
export const SHIELD_WALL_TURNS = 2;      // Tank Shield Wall: enemy turns it lasts
export const HOLD_LINE_DEFENSE = 3;      // Tank Hold the Line: his Defense strength
export const HOLD_LINE_TURNS = 2;        // Tank Hold the Line: enemy turns of the stance
export const HOLD_LINE_BANK_MULT = 2;    // Tank Hold the Line: Grudge banks ×this while it stands
export const ARCANE_SURGE_CHARGE = 3;    // Mage Arcane Surge: Charge gained now
export const DRAIN_LIFE_DMG = 3;         // Mage Drain Life: base damage (heals the most wounded for it)
export const DOOM_DELAY = 2;             // Warlock Doom: enemy turns until it detonates
export const DOOM_DAMAGE = 10;           // Warlock Doom: detonation damage (Vulnerability scales it via _damageEnemy)
export const SACRIFICE_HP = 6;           // Warlock Sacrifice: HP the chosen ally pays (clamps to 1)
export const SACRIFICE_DMG = 2;          // Warlock Sacrifice: +damage the Warlock gains for the fight
export const SACRIFICE_POWER = 2;        // Warlock Sacrifice: +ability power on the same
export const FINALE_MULT = 2;            // Busker Finale: strikes for ×this of his cards-played auto
export const BLOODBATH_PER_MISSING = 1;  // Berserker Bloodbath: damage per point of missing HP
export const WHIRLWIND_HITS = 2;         // Berserker Whirlwind: base strikes (a 3rd in his hottest band)
export const SIC_EM_MULT = 2;            // Beast Warden Sic 'Em: damage = Boar strike bonus ×this
export const MEND_BEAST_HEAL = 3;        // Beast Warden Mend Beast: Boar HP healed (and +1 turn)
export const BIG_TOP_DR = 2;             // Showstopper Big Top: party takes this much less per hit
export const BIG_TOP_TURNS = 1;          // Showstopper Big Top: enemy turns of the DR aura
export const LUNGE_MULT = 2;             // Duelist Lunge: strike ×this, and she Provokes
export const LUNGE_TAUNT_TURNS = 2;      // Duelist Lunge: enemy turns she Provokes for
export const FLURRY_HITS = 3;            // Duelist Flurry: number of reduced strikes
export const FLURRY_REDUCTION = 1;       // Duelist Flurry: each strike is auto − this (min 1)
export const STRONGEST_HP = 5;           // Strongman Strongest in the World: HP paid (NO clamp — Last Stand can catch it)
export const DEADLIFT_TURNS = 1;         // Strongman Deadlift: enemy turns the ally is untargetable
// Roster wave 3 abilities (#29).
export const BOAR_HP = 7;           // Call Boar: pet HP (+ abilityPower) — exactly one base heavy
export const BOAR_TURNS = 4;        // Call Boar: enemy turns the Boar stands before returning to the wild
export const BOAR_STRIKE_BONUS = 4; // the Boar lends the Warden this much strike while it stands (1 -> 5)
export const DEFENSE_TURNS = 4;  // enemy turns Defense lasts (granted alongside Taunt)
export const SHIELD_TURNS = 3;   // enemy turns a raised Shield lasts before fading unused
// Provoke / "Taunt-lite" (#31): a purchasable card so a taunt-less draft can make
// ANY member the enemy's aim, without forcing the Tank into every party. Lighter
// than the Tank's ability (fewer turns, same +1 Defense) so the Tank stays best.
export const TAUNT_LITE_TURNS = 2;   // enemy turns the provoked member holds Taunt
export const TAUNT_LITE_DEFENSE = 1; // bundled Defense strength while provoked

// Hero buff card batch (#62): proactive per-hero buffs. The standing buffs decay
// over N enemy turns in _decayBuffs; the one-shots are consumed on use. Costs,
// magnitudes, and turn counts are tunable — a later balance pass owns the numbers;
// this issue ships the mechanics. Goad reuses the Tank ability's TAUNT_TURNS /
// DEFENSE_TURNS / DEFENSE_AMOUNT so it grants the same Taunt(+Defense) from a card.
export const GUARD_DR = 1;         // Guard: +damage reduction on a chosen hero
export const GUARD_TURNS = 3;      // enemy turns Guard lasts before it decays
export const SHARPEN_BONUS = 1;    // Sharpen: +auto damage on a chosen hero
export const SHARPEN_TURNS = 3;    // enemy turns Sharpen lasts
export const EMBOLDEN_BONUS = 1;   // Embolden (issue "Rally"): +auto damage to every fielded hero
export const EMBOLDEN_TURNS = 3;   // enemy turns Embolden lasts
export const EMPOWER_BONUS = 1;    // Empower: +abilityPower on a hero's next ability (one-shot)
export const EN_GARDE_TURNS = 3;   // Duelist's En Garde (#74): enemy turns the Provoke + persistent Riposte stance holds
// Penance (#75): the Flagellant's Blood ability. The ONE blood effect that breaks the
// never-lethal clamp — the payment is a raw drain (engine _drainMember), so at PENANCE_HP
// or less HP the cast KILLS him (a real death: scars, permadeath, ability-card removal),
// and the party still gets the fury. Declared here (before MEMBER_ABILITY_FLAVOR) so the
// flavor string can read it. Sanguine Pact's surcharge rides this ability-card blood cost
// too (a deliberate scope call: curse costs apply to blood ABILITY cards, not just hand
// Blood cards — see _fireAbility's penance case).
export const PENANCE_HP = 4;           // Penance: HP the Flagellant pays — NO clamp; <= this kills him
export const PENANCE_STRIKE_BONUS = 2; // Penance: +auto damage every living member gets
export const PENANCE_STRIKE_TURNS = 2; // Penance: enemy turns the party +auto buff lasts
// Radiance (#76): the Lightkeeper's Holy ability. Heals EVERY living member this much;
// each member's OVERHEAL converts to Brace (the #69 heal-result struct supplies it).
// Radiance's Brace is ADDITIVE (brace += overheal, one timer refreshed) — the deliberate
// carve-out from the Brace card's newest-replaces rule, so repeat casts pile it up. No cap.
// abilityPower (Empower / injury) modifies the heal (and therefore the possible Brace),
// and Reliquary of Light's +1 holy heal rides it (radiance is a holy card).
export const RADIANCE_HEAL = 2;        // Radiance: HP healed on every living member

// Shadow cards (#63, Part A′): healer-castable direct damage / debuff payoff.
// Costs and magnitudes are tunable — a later balance pass owns the numbers; this
// issue ships the mechanics. All three deal party->enemy damage (routed through
// _damageEnemy, so Vulnerability applies) and never touch an enemy telegraph.
export const SHADOW_BOLT_DMG = 4;   // Shadow Bolt: cheap direct nuke to the enemy
export const SIPHON_LIFE_DMG = 3;   // Siphon Life: damage dealt to the enemy
export const SIPHON_LIFE_HEAL = 2;  // Siphon Life: HP healed on the chosen member (lifesteal)
export const DOOM_BASE = 6;         // Doom: base nuke damage
export const DOOM_PER_DEBUFF = 3;   // Doom: +damage per active enemy debuff (Vulnerability / Poison)
export const DOOM_PER_VULN = 8;     // Doom: +floor(vuln x this) extra while the enemy is Vulnerable
export const DOOM_CAP = 18;         // Doom: hard cap on the pre-Vulnerability computed damage

// Count-based payoff cards (#63, Part B): each scales with the per-type counters,
// capped/floored as designed. Magnitudes are tunable — a later balance pass owns them.
export const CASCADE_DRAW = 2;                 // Cascade (Arcane): cards drawn
export const CASCADE_DISCOUNT_PER_ARCANE = 1;  // Cascade: MP off per Arcane card already played this turn (floor 0)
export const NIGHTFALL_BASE = 3;               // Nightfall (Shadow): base enemy damage
export const NIGHTFALL_PER_SHADOW = 2;         // Nightfall: +damage per Shadow card played THIS FIGHT (before it)
export const NIGHTFALL_CAP = 14;               // Nightfall: hard cap on the computed damage

// Channeled cards (#64): each holds an effect across turns while the player plays
// nothing else, trading away MP recovery (all passive/over-time income is suppressed
// while channeling). Magnitudes and turn caps are tunable — a later balance pass owns
// the numbers; this issue ships the mechanic. The first tick lands on the cast turn.
export const DRAIN_DMG = 4;               // Drain: per-tick direct damage to the enemy
export const DRAIN_MP_MIN = 1;            // Drain: min MP returned when a tick dealt damage
export const DRAIN_MP_MAX = 2;            // Drain: max MP returned when a tick dealt damage
export const DRAIN_MAX_TURNS = 4;         // Drain: ticks before it ends on its own
export const REFRESH_CHANNEL_MP = 3;      // Refresh (reworked): MP restored per tick
export const REFRESH_CHANNEL_MAX_TURNS = 3; // Refresh: ticks before it ends on its own
export const MENDING_STREAM_HEAL = 3;     // Mending Stream: per-tick heal on the remembered member
export const MENDING_STREAM_MAX_TURNS = 4;// Mending Stream: ticks before it ends on its own
export const SAP_VULN_PER_TICK = 0.25;    // Sap: Vulnerability added to the enemy each tick
export const SAP_VULN_CAP = 0.75;         // Sap: cap on the stacked Vulnerability from Sap
export const SAP_VULN_TURNS = 3;          // Sap: enemy turns each tick keeps the Vulnerability alive
export const SAP_MAX_TURNS = 4;           // Sap: ticks before it ends on its own

// Short flavor of each member's ability — name + one-liner. Shown on the live
// MemberCard AND the draft card (#37), so it lives here rather than in a component
// (the draft must not leak raw ability ids like `graveChill`). Keyed by MemberId.

export const CULTIVATE_STRENGTH = 1;  // amount Cultivate adds to a Regen value in place
                                      // (#52: magnitude is duration, so +1 also = +1 tick)
export const BLOOM_HEAL_PER_TURN = 2; // healing per remaining Regen tick Bloom consumes

// Card set phase B (#16) magnitudes.
export const LIFEBLOOM_BURST = 3;     // burst heal when a Lifebloom Regen ends on a living target
export const HYMN_BONUS = 2;          // damage added to each living member's auto this party phase
export const BARRIER_TURNS = 1;       // enemy phases an unused Barrier Shield lasts (vs SHIELD_TURNS)
export const BLOOD_TITHE_MP = 2;      // MP gained by Blood Tithe (capped at max mana)
export const GRIM_HARVEST_DMG = 10;   // enemy damage dealt by Grim Harvest

// Card set phase C (#17) — the Bulwark / Defense pipeline.
export const PHALANX_DEFENSE = 2;     // Defense strength Phalanx grants
export const PHALANX_TURNS = 2;       // enemy turns Phalanx's Defense lasts
export const BRACE_AMOUNT = 2;        // one-shot reduction Brace applies to the next damaging hit
export const BRACE_TURNS = 3;         // enemy turns an unused Brace lasts before fading (mirrors Shield)

// Iron mitigation web (#65): steer telegraphed hits into prepared members, and turn
// blocking into offense/more mitigation. Magnitudes are tunable — a later balance
// pass owns the numbers; this issue ships the mechanics.
//   Feint carries no magnitude (it retargets the standing telegraph; its cost is its price).
export const ANVIL_STANCE_BONUS = 2;     // Anvil Stance: +auto damage while the marked member holds Shield/Brace
export const INTERLOCK_GUARD_DR = 1;     // Interlock: Guard DR granted to every living member
export const INTERLOCK_GUARD_TURNS = 2;  // Interlock: enemy turns each Guard grant lasts (stacks freely)
export const BULWARK_BRACE_TURNS = 2;    // Bulwark Core: enemy turns the granted Brace lasts after a full Shield block

// Regen conversions (#66): Regen becomes a currency that converts across domains —
// into damage reduction while it runs (Thornskin), into enemy Poison when spent
// (Sporeburst). Magnitudes are tunable — a later balance pass owns the numbers.
export const THORNSKIN_REDUCTION = 1;    // Thornskin: incoming damage reduced per hit while the marked member's Regen lasts
export const SPOREBURST_POISON = 2;      // Sporeburst: enemy Poison per turn applied when the Regen is consumed (duration == ticks consumed)

// Status-window management (#67): enemy Poison / Vulnerability become resources the
// player amplifies, cashes out, or gets paid on when the window closes. Magnitudes are
// tunable — a later balance pass owns the numbers. Hemorrhage is deliberately UNCAPPED
// (its payoff is poison per-turn × turns left), so it has no magnitude constant.
export const UMBRAL_FEAST_PER_EFFECT = 1; // Umbral Feast: damage per active effect in play (party buffs + enemy debuffs)
export const DREAD_WHISPER_REDUCTION = 1; // Dread Whisper: per-target damage shaved off the standing telegraph (floor 0)

// Blood + cycling (#68): HP becomes a second currency — the healer spends party HP
// for draw / shields / damage / redistribution / offense and then manages it back.
// Every HP cost here rides the existing selfDamage clamp-to-1 rule (never lethal),
// and the ">N HP" gates read the EFFECTIVE cost (base + Sanguine Pact surcharge).
// Magnitudes are tunable — a later balance pass owns the numbers.
export const CRIMSON_PACT_HP = 4;         // Crimson Pact: HP the target pays to draw
export const CRIMSON_PACT_DRAW = 2;       // Crimson Pact: cards drawn
export const SCARLET_WARD_HP = 3;         // Scarlet Ward: HP the target pays for a Shield
export const OPEN_VEINS_HP = 3;           // Open Veins: HP the target pays
export const OPEN_VEINS_DMG = 4;          // Open Veins: damage dealt to the enemy
export const TRANSFUSION_HP = 4;          // Transfusion: HP the target pays
export const TRANSFUSION_HEAL = 5;        // Transfusion: HP the most-wounded other member heals
export const BLOOD_BANNER_HP = 2;         // Blood Banner: HP every living member pays (clamps to 1)
export const BLOOD_BANNER_BONUS = 2;      // Blood Banner: +auto damage party-wide while it lasts
export const BLOOD_BANNER_TURNS = 2;      // Blood Banner: enemy turns the party auto buff lasts

// Holy overheal & board-state payoffs (#69): a healthy party becomes a plan — overheal
// converts to mitigation (Absolution), full HP to offense (Consecration), topping off
// pays cards (Beacon), heals splash (Twin Censer), and buff DENSITY is a stat every buff
// feeds (Benediction). Sunrise Vigil is the wave's delayed-heal timing tool; Rootbind is
// the generic timed-effect duration extender. Magnitudes are tunable — a later balance
// pass owns the numbers; this issue ships the mechanics.
export const BENEDICTION_HEAL = 2;          // Benediction: base heal before the per-buff bonus
export const BENEDICTION_PER_BUFF = 1;      // Benediction: extra heal per active buff on the target (uncapped)
export const SUNRISE_VIGIL_HEAL = 2;        // Sunrise Vigil: heal every living member this much next player-phase start
export const CONSECRATION_HEAL = 1;         // Consecration: heal all this much
export const CONSECRATION_STRIKE_BONUS = 1; // Consecration: +auto for members at full HP afterward
export const CONSECRATION_STRIKE_TURNS = 2; // Consecration: enemy turns that strike buff lasts
export const ABSOLUTION_HEAL = 3;           // Absolution: heal this much; any overheal becomes Brace (uncapped)
export const ROOTBIND_BONUS_TURNS = 1;      // Rootbind: extra turns added to every friendly timed effect
// Holy overheal & board-state relics (#69). Magnitudes tunable; a later balance pass owns them.
export const BEACON_DRAW = 1;               // Beacon of the Second Sun: cards drawn on a card-driven heal-to-full (uncapped)
export const TWIN_CENSER_SPLASH = 1;        // Twin Censer: heal splashed to the most wounded OTHER member on a single-target heal card

// Hexweaver (#13) scripted-effect magnitudes.
export const WOUND_TURNS = 3;        // enemy turns the Hex healing-reduction lasts
export const WOUND_HEAL_FACTOR = 0.5; // healing multiplied by this while Wounded (floored)
export const SIPHON_AMOUNT = 3;      // healer MP drained by Siphon (floored at 0)

// How casting Taunt interacts with the *standing* (already-telegraphed) attack.
// The free instant-retarget made permanent Taunt a strictly-dominant solve
// (flaw #1), so casting it now costs a real decision. Two modes ship behind this
// flag for the P1 sim/playtest (Open Q3); one is kept afterward:
//   'future'    — Taunt only redirects *future* telegraphs; the standing blow
//                 still lands where it was aimed (you must taunt a turn early).
//   'surcharge' — Taunt may redirect the standing blow now, but pays +1 MP for it.
export type TauntRetargetMode = 'future' | 'surcharge';
export const DEFAULT_TAUNT_RETARGET_MODE: TauntRetargetMode = 'surcharge';
export const TAUNT_RETARGET_SURCHARGE = 1; // extra MP to redirect the standing blow (surcharge mode)

export const HAND_SIZE = 3;

// Small-party build (#42): relics/cards that reward fielding fewer bodies, so a
// sub-max deployment is a real line (paired with the empty-seat gold bounty and the
// Warlock's fewer-allies Hex). "Small" means a fielded party of SMALL_PARTY_MAX or
// fewer; per-seat effects scale on empty deploy seats (3 − fielded).
export const SMALL_PARTY_MAX = 2;
export const LONE_WOLF_DMG = 4;        // loneWolf relic: +damage per fielded member while small
export const FOCUS_STONE_MP = 2;       // focusStone relic: +max MP while small
export const WARBAND_HP_PER_SEAT = 8;  // warband relic: +max HP per empty deploy seat
export const RALLY_DMG_PER_SEAT = 2;   // Rally card: +auto damage this turn per empty seat
export const FOCUS_HEAL = 3;           // Focus card: base single-target heal
export const FOCUS_SMALL_BONUS = 4;    // Focus card: extra heal while fielding small
export const CHANNEL_MP = 2;           // Channel card: base MP gained (+1 per empty seat)

// Modifier magnitudes (per stacked copy). Live here so resolveCard (cards) and
// canApplyModifier (run) — which load at different layers — can both read them.
export const MOD_EFFICIENT_COST = 1;   // -1 mana cost
export const MOD_POTENT_STRENGTH = 1;  // +1 to heal / regen / refresh amount
export const MOD_LINGERING_TURNS = 1;  // +1 turn of duration (Regen / Refresh)
