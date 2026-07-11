// All tunable values from the spec's "Numbers" section live here.
// Slots are 0,1,2 == spec slots 1,2,3 == Ranger (left), Tank (center), Mage (right).

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
export type MemberId = 'ranger' | 'tank' | 'mage' | 'warlock' | 'skald' | 'berserker' | 'graveAugur' | 'beastWarden' | 'sentinel' | 'plaguewright' | 'hierophant' | 'duelist' | 'flagellant' | 'lightkeeper';
// 'hex' (Warlock, #39) curses the enemy with Vulnerability — the party deals more
// damage to it, and the bonus is LARGER the fewer members are fielded (a small-party
// controller); 'crescendo' (Skald) draws cards and feeds his cards-played strike;
// 'rampage' (Berserker) doubles his current strike at an HP cost; 'graveChill'
// (Augur) weakens the standing telegraph; 'callBoar' (Beast Warden) summons a pet
// that soaks whole hits; 'stun' (Sentinel, #61) cancels the enemy's standing
// telegraph — the move is consumed (rotation advances, channel wind-up aborts) and
// a fresh action telegraphs next turn; 'ferment' (Plaguewright, #72) opens a window
// in which enemy Poison compounds — each tick deals its damage, then the per-turn
// value GROWS and the duration does NOT count down (investment over drip);
// 'liturgy' (Hierophant, #73) gives the active channel DUAL CADENCE — for its
// remaining duration it also ticks at the start of the enemy phase (after party
// autos, before the telegraph resolves), doubling total ticks while the duration
// still counts down only once per round; 'enGarde' (Duelist, #74) grants a chosen
// member PERSISTENT Riposte — for EN_GARDE_TURNS enemy turns they counter EVERY hit
// that strikes them (fully blocked hits included) for their live auto damage, not
// consumed on the first trigger like the one-shot Riposte card. It is the first
// target 'single' ability card — the stance can be placed on any member, self
// included. Each fires via that member's own ability card (#44), inserted into the
// deck when they are deployed.
export type AbilityId = 'poison' | 'taunt' | 'bolt' | 'hex' | 'crescendo' | 'rampage' | 'graveChill' | 'callBoar' | 'stun' | 'ferment' | 'liturgy' | 'enGarde' | 'penance' | 'radiance';
export type CardId =
  | 'lowHeal' | 'highHeal' | 'aoeHeal'
  | 'regen' | 'shield' | 'resurrect' | 'refresh' | 'cleanse'
  | 'overgrowth' | 'cultivate' | 'bloom' | 'fontOfMana' | 'inspiration'
  | 'lifebloom' | 'surge' | 'battleHymn' | 'barrier'
  | 'bloodTithe' | 'martyrsGift' | 'grimHarvest'
  | 'phalanx' | 'brace' | 'provoke'
  // Iron mitigation web (#65): steer telegraphed hits, get paid for blocking.
  | 'feint' | 'anvilStance' | 'interlock'
  // Regen conversions (#66): turn Regen into damage reduction / enemy Poison.
  | 'thornskin' | 'sporeburst'
  // Status-window management (#67): manage enemy Poison / Vulnerability windows.
  | 'hemorrhage' | 'umbralFeast' | 'dreadWhisper'
  // Blood + cycling (#68): HP as a spendable resource — draw, shields, damage,
  // redistribution, and party offense, all priced in HP the healer manages.
  | 'crimsonPact' | 'scarletWard' | 'openVeins' | 'transfusion' | 'bloodBanner'
  // Holy overheal & board-state payoffs (#69): a healthy party becomes a plan —
  // overheal -> mitigation, full HP -> offense, topping off pays cards, buff density
  // is a stat. Rootbind (Nature) is the generic timed-effect duration extender.
  | 'benediction' | 'sunriseVigil' | 'consecration' | 'absolution' | 'rootbind'
  // Channel archetype rescue + arcane support (#70): keep-alive draw + a splash
  // enabler so a "channel + cheap cards" deck is a real archetype.
  | 'attunement' | 'arcaneLens'
  // Shadow cards (#63, Part A′): healer-castable direct damage / debuff payoff.
  | 'shadowBolt' | 'siphonLife' | 'doom'
  // Count-based payoff cards (#63, Part B): scale with the per-type counters.
  | 'cascade' | 'nightfall'
  // Channeled cards (#64): hold an effect across turns while you play nothing else
  // (Refresh, below, is reworked into one). Drain/Sap read Shadow, Mending Stream
  // Holy, Fortify Iron.
  | 'drain' | 'mendingStream' | 'sap' | 'fortify'
  // Small-party cards (#42): stronger the fewer members you field.
  | 'rally' | 'focus' | 'channel' | 'holdTheLine'
  // Hero buff card batch (#62): proactive per-hero buffs. Standing buffs (Guard,
  // Sharpen, Embolden, Goad) decay over N enemy turns; the one-shots (Double
  // Strike, Empower, Riposte) are consumed on use. (Goad = a full Taunt from a
  // card, Embolden = a standing party damage buff — named apart from the existing
  // `provoke`/`rally` cards they resemble, which stay their tuned selves.)
  | 'guard' | 'sharpen' | 'goad' | 'doubleStrike' | 'embolden' | 'empower' | 'riposte'
  // Per-member ability cards (#44): one bound card per member, inserted into the
  // battle deck when that member is deployed and firing their ability. The healer
  // enables the member's move — the player no longer picks which member acts.
  | 'imbuePoison' | 'bolster' | 'unleash' | 'hex'
  | 'conduct' | 'incite' | 'hush' | 'beckon' | 'stagger' | 'ferment' | 'liturgy' | 'enGarde' | 'penance' | 'radiance';

// The scripted effect a 'cast' telegraph resolves into. 'wound' halves the party's
// healing for a few turns; 'siphon' drains healer MP; 'consume' (Devourer, #14)
// cleanses the enemy's own poison and self-heals for the remaining ticks.
export type CastKind = 'wound' | 'siphon' | 'consume';

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
                     // early if that member dies (Mending Stream, Fortify)
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
}

export const SLOT = { LEFT: 0, CENTER: 1, RIGHT: 2 } as const;

// Fixed party layout. `ability` names which ability the Ability card fires for this member.
export const MEMBER_DEFS: MemberDef[] = [
  { slot: 0, id: 'ranger', name: 'Ranger', maxHP: 11, damage: 4, ability: 'poison' },
  { slot: 1, id: 'tank', name: 'Tank', maxHP: 18, damage: 2, ability: 'taunt' },
  { slot: 2, id: 'mage', name: 'Mage', maxHP: 9, damage: 5, ability: 'bolt' },
];

// Per-member identity keyed by id. The fixed demo trio is laid out by MEMBER_DEFS
// (slot order); MEMBER_POOL is the data-driven source the post-demo roster and
// draft (#27-#31) extend so any member can occupy any slot and carry any ability.
export const MEMBER_POOL: Record<MemberId, MemberDef> = {
  ranger: MEMBER_DEFS[0],
  tank: MEMBER_DEFS[1],
  mage: MEMBER_DEFS[2],
  // Post-demo roster wave 1 (#27). `slot` here is a nominal home slot only — a
  // drafted member takes whatever slot it is assigned; the engine uses the map
  // index for placement and reads only id/name/ability/stats from the pool.
  // Warlock (redesigned #39): a small-party CONTROLLER, not a striker. His Hex
  // curses the enemy with Vulnerability (the party deals more damage), and the bonus
  // is bigger the fewer members are fielded — strongest solo, where it amplifies his
  // own low damage enough to carry act 1. No self-damage: the old Soul Tithe / Dark
  // Bargain suicide (a permadeath magnet under the roster campaign) is gone.
  warlock: { slot: 0, id: 'warlock', name: 'Warlock', maxHP: 14, damage: 3, ability: 'hex' },
  // Skald: 0 base damage; his strike scales on cards played this phase (Crescendo
  // both draws and counts toward that), attacking Rest timing.
  skald: { slot: 2, id: 'skald', name: 'Skald', maxHP: 10, damage: 0, ability: 'crescendo' },
  // Roster wave 2 (#28). Berserker: strongest at LOW HP — healing him is friendly
  // fire. Grave Augur: shrinks the standing telegraph (the taunt-less draft's
  // redirection substitute).
  berserker: { slot: 0, id: 'berserker', name: 'Berserker', maxHP: 16, damage: 2, ability: 'rampage' },
  graveAugur: { slot: 2, id: 'graveAugur', name: 'Grave Augur', maxHP: 10, damage: 4, ability: 'graveChill' },
  // Roster wave 3 (#29). Beast Warden: 9 HP / 1 dmg, but Call Boar summons a pet on
  // her slot that soaks whole hits and lends her its strike — the most invasive
  // member (a new board entity).
  beastWarden: { slot: 0, id: 'beastWarden', name: 'Beast Warden', maxHP: 9, damage: 1, ability: 'callBoar' },
  // Sentinel (#61): a sturdy front-line bruiser whose Stun cancels the enemy's
  // standing telegraph — a control member. Low damage; the value is the lost enemy
  // turn. Home slot 0 (front line).
  sentinel: { slot: 0, id: 'sentinel', name: 'Sentinel', maxHP: 13, damage: 2, ability: 'stun' },
  // Plaguewright (#72): a second poison hero. A mid-line caster body (Ranger-adjacent,
  // one less HP) whose Ferment turns enemy Poison from a fire-and-forget drip into an
  // investment — while the window runs, each tick deals its damage, then the per-turn
  // value grows and the duration stops counting down (compounds instead of expiring).
  plaguewright: { slot: 2, id: 'plaguewright', name: 'Plaguewright', maxHP: 10, damage: 3, ability: 'ferment' },
  // Hierophant (#73): the channel archetype anchor. A fragile support body (Mage-tier
  // HP, low auto) whose Liturgy gives the active channel DUAL CADENCE — an extra
  // enemy-phase tick each round for the channel's remaining duration. Home slot 2
  // (back line), like the other caster bodies.
  hierophant: { slot: 2, id: 'hierophant', name: 'Hierophant', maxHP: 9, damage: 2, ability: 'liturgy' },
  // Duelist (#74): a front-line skirmisher who converts being attacked well into
  // damage. Her En Garde grants a chosen member PERSISTENT Riposte — for a couple of
  // enemy turns they counterattack EVERY hit that lands on them (fully blocked hits
  // included) for their live auto damage. Between Tank and Ranger on the body curve.
  // Home slot 0 (front line), where the hits — and the counters — land.
  duelist: { slot: 0, id: 'duelist', name: 'Duelist', maxHP: 12, damage: 3, ability: 'enGarde' },
  // Flagellant (#75): the blood battery. A big body, weak swing (Berserker-adjacent
  // chassis) whose HP is the party's fuel — his Penance pays 4 HP (NO clamp, it can
  // kill him) to buff every living member's auto +2 this turn. High HP holds Sanguine
  // Pact's below-50% window open and bankrolls the Blood web (#68). Home slot 0.
  flagellant: { slot: 0, id: 'flagellant', name: 'Flagellant', maxHP: 15, damage: 2, ability: 'penance' },
  // Lightkeeper (#76): the overheal-as-mitigation member. A support body (Mage-tier
  // HP, weak auto) whose Radiance heals the WHOLE party and converts every point of
  // overheal into Brace — on a topped party that is party-wide −2 mitigation, and it
  // STACKS (repeat casts pile Brace higher). She executes the wave's "party at full
  // HP" plan (#69) and feeds Anvil Stance / Bulwark / Beacon / Benediction. Home slot 1.
  lightkeeper: { slot: 1, id: 'lightkeeper', name: 'Lightkeeper', maxHP: 11, damage: 2, ability: 'radiance' },
};

// Build a party config from an ordered list of member ids (slot = list index).
// Fresh members carry no injuries and the pool's base stats. Used by the draft
// (#27 skeleton, #30 full) to seat arbitrary compositions.
export function partyFromMembers(ids: MemberId[]): PartyMemberConfig[] {
  return ids.map((id): PartyMemberConfig => {
    const d = MEMBER_POOL[id];
    return { maxHP: d.maxHP, hp: d.maxHP, damage: d.damage, abilityPower: 0, injuries: 0, upgrades: 0, member: id };
  });
}

// The classic demo trio, as a member-id list (Ranger / Tank / Mage). The draft
// pre-selects this so returning players lose nothing (#30).
export const CLASSIC_TRIO: MemberId[] = ['ranger', 'tank', 'mage'];

// A drafted party seats this many members (one per slot).
export const PARTY_SIZE = 3;
// The pool the draft (#27 skeleton, #30 full) picks from — grows as roster waves
// land (#28 Berserker/Augur, #29 Beast Warden).
export const DRAFT_POOL: MemberId[] = ['ranger', 'tank', 'mage', 'warlock', 'skald', 'berserker', 'graveAugur', 'beastWarden', 'sentinel', 'plaguewright', 'hierophant', 'duelist', 'flagellant', 'lightkeeper'];

// ---------------------------------------------------------------------------
// Full draft (#30): three 1-of-2 picks from the pool of 8, then L/C/R assignment.
// The generator guarantees a viable party is achievable so a bad roll can't hand
// the player a dead run; taunt-less drafts are intended variance, not a failure.
// ---------------------------------------------------------------------------

// Conservative damage rating per member (the review's numbers), used only by the
// draft generator's viability check — NOT the in-fight damage (that is on the pool).
export const DRAFT_RATING: Record<MemberId, number> = {
  ranger: 4, tank: 2, mage: 5, warlock: 4, berserker: 2, skald: 3, graveAugur: 4, beastWarden: 3, sentinel: 2,
  plaguewright: 3, hierophant: 2, duelist: 3, flagellant: 2, lightkeeper: 2,
};

// Members healing works "conventionally" on. The Warlock burns himself regardless
// and the Berserker wants to STAY low (healing him is friendly fire), so neither
// counts toward the healable floor.
export const CONVENTIONALLY_HEALABLE: Set<MemberId> = new Set<MemberId>(
  ['ranger', 'tank', 'mage', 'skald', 'graveAugur', 'beastWarden', 'sentinel', 'plaguewright', 'hierophant', 'duelist', 'flagellant', 'lightkeeper'],
);

export const DRAFT_PICKS = 3;             // number of 1-of-2 picks (one per slot)
export const DRAFT_MIN_DAMAGE = 8;        // a viable party's conservative damage floor
export const DRAFT_STRONG_DAMAGE = 4;     // "one member >= 4" — a real damage threat
export const DRAFT_MIN_HEALABLE = 2;      // a viable party needs >= 2 conventionally-healable members

// The members that deal reliable, self-sufficient damage (the #31 sweep showed a
// comp with NO conventional striker floors out — the Skald/Warden/Berserker need
// support the fixed policy can't always give). A viable draft needs at least one.
export const CONVENTIONAL_STRIKERS: Set<MemberId> = new Set<MemberId>(['ranger', 'mage', 'warlock']);

// Roster acquisition (2026-07): the game no longer drafts a fixed trio up front.
// The player collects members one at a time — a pick-one draft at run start and
// after each boss, plus occasional Recruit map nodes — and deploys up to three per
// fight. These set how many members each such offer shows.
export const DRAFT_OFFER_SIZE = 3;   // members shown by the start draft (pick one)
export const RECRUIT_OFFER_SIZE = 3; // members shown by a Recruit node (pick one)
// The start draft (#55) samples three heroes from the full DRAFT_POOL — any hero can
// open the run, not a fixed striker trio. Fight 0 is still a forced solo; the solo
// opener must stay winnable whichever starter is picked. Post-boss drafts and Recruit
// nodes likewise draw from the full remaining pool.

// Does this exact party (a member per slot) clear the draft's viability bar?
// Tightened by #31: also require a conventional striker, so a certified-viable
// offer can actually kill the bosses (not just pass a paper damage sum).
export function partyMeetsDraftConstraints(ids: MemberId[]): boolean {
  const total = ids.reduce((s, id) => s + DRAFT_RATING[id], 0);
  const hasStrong = ids.some((id) => DRAFT_RATING[id] >= DRAFT_STRONG_DAMAGE);
  const hasStriker = ids.some((id) => CONVENTIONAL_STRIKERS.has(id));
  const healable = ids.filter((id) => CONVENTIONALLY_HEALABLE.has(id)).length;
  return total >= DRAFT_MIN_DAMAGE && hasStrong && hasStriker && healable >= DRAFT_MIN_HEALABLE;
}

// Every party the player could assemble from an offer (one option per pair).
function draftCombos(pairs: MemberId[][]): MemberId[][] {
  return pairs.reduce<MemberId[][]>(
    (acc, pair) => acc.flatMap((prefix) => pair.map((id) => [...prefix, id])),
    [[]],
  );
}

// An offer is viable if AT LEAST ONE assemblable party clears the bar — so the
// player can always build a viable comp (while still being free to pick a spicy one).
export function draftOfferViable(pairs: MemberId[][]): boolean {
  return draftCombos(pairs).some((ids) => partyMeetsDraftConstraints(ids));
}

// Roll DRAFT_PICKS pairs of two distinct members (no member repeats across pairs),
// re-rolling until the offer is viable; a hard fallback guarantees termination.
export function rollDraft(shuffled: MemberId[]): MemberId[][] {
  // `shuffled` is the pool already permuted by the caller's seeded RNG. Take the
  // first DRAFT_PICKS*2 as the pairs.
  const pairs: MemberId[][] = [];
  for (let i = 0; i < DRAFT_PICKS; i++) pairs.push([shuffled[i * 2], shuffled[i * 2 + 1]]);
  return draftOfferViable(pairs) ? pairs : DRAFT_FALLBACK_PAIRS;
}

// A known-viable offer used only if a roll somehow fails to (it cannot, with the
// current pool — every 6-of-8 split contains a viable party — but the guarantee is
// explicit): the classic trio each paired with a strong alternative.
export const DRAFT_FALLBACK_PAIRS: MemberId[][] = [
  ['ranger', 'warlock'], ['tank', 'berserker'], ['mage', 'skald'],
];

export const ENEMY_MAX_HP = 100;

// Base (pre-enrage) per-target damage by attack type. 'cast' deals no damage —
// its telegraph resolves into a scripted effect, so its base is 0.
export const ATTACK_BASE_DAMAGE: Record<AttackType, number> = {
  single: 4, two: 3, aoe: 2, hidden: 4, heavy: 7, sweep: 4, cast: 0,
};

// Attack-type selection weights. Regular enemies never use the boss-only types
// (heavy/sweep weight 0); the boss never uses the untelegraphed 'hidden' type.
// 'cast' is never weighted-picked (scripted bosses place it in a rotation), so it
// carries weight 0 everywhere — a trailing 0-weight key leaves every pick unchanged.
export const TYPE_WEIGHTS: Record<'normal' | 'enraged' | 'boss' | 'bossEnraged', Record<AttackType, number>> = {
  normal:      { single: 60, two: 20, aoe: 10, hidden: 10, heavy: 0,  sweep: 0,  cast: 0 },
  enraged:     { single: 30, two: 35, aoe: 25, hidden: 10, heavy: 0,  sweep: 0,  cast: 0 },
  boss:        { single: 20, two: 20, aoe: 10, hidden: 0,  heavy: 30, sweep: 20, cast: 0 },
  // Enraged sweep softened 20->10 (issue 04): enraged sweep (ceil(4x1.25)x3 = 15
  // party-wide/turn) otherwise beats the sustain ceiling and makes the post-enrage
  // race unwinnable. Halving its weight keeps the boss hard but the race winnable.
  bossEnraged: { single: 10, two: 20, aoe: 15, hidden: 0,  heavy: 35, sweep: 10, cast: 0 },
};

// Primary-slot weights, indexed by slot. Hidden attack uses its own profile.
export const SLOT_WEIGHTS: Record<'normal' | 'hidden', number[]> = {
  normal: [25, 50, 25],
  hidden: [40, 20, 40],
};

// Human-readable intent names for each attack type (the telegraph carries the
// numbers; this labels what the enemy is about to do).
// Note: no generic name may collide with a boss channel's name (e.g. the
// Gatewarden's 'Crushing Blow') — a channel is a bigger threat than the plain
// attack type it replaces, and sharing a name trains the wrong read.
export const ATTACK_INTENT_NAMES: Record<AttackType, string> = {
  single: 'Strike', two: 'Double Strike', aoe: 'Barrage',
  hidden: 'Veiled Strike', heavy: 'Heavy Blow', sweep: 'Sweep',
  // 'cast' rotation steps always carry an explicit name (Hex / Siphon / Consume),
  // so this generic label is only a fallback.
  cast: 'Cast',
};

// ---------------------------------------------------------------------------
// Data-driven enemy definition. An EnemyDef describes an enemy's behavior — its
// attack-type selection weights (and, later, rotations/phases for the bosses).
// The per-fight difficulty numbers (maxHP, attackBonus) live on EnemyConfig, so
// the same def can be reused across the fight curve.
// ---------------------------------------------------------------------------
export type AttackWeights = Record<AttackType, number>;

// A channelled attack: a multi-turn wind-up whose telegraph IS the standing
// telegraph (preserving the single-telegraph invariant). While it winds up the
// enemy takes no other action; on resolve it lands `damage` with `type` geometry.
export interface ChannelDef {
  slot: number;        // rotation index that becomes a channel
  everyCycles: number; // channel on cycles where (cycle % everyCycles) === everyCycles - 1
  turns: number;       // enemy turns from telegraph to resolve (2 = one wind-up turn + resolve)
  damage: number;      // per-target damage on resolve
  type: AttackType;    // geometry/label the channel resolves as
  name: string;        // display name (e.g. "Crushing Blow")
}

// A single step in a scripted boss rotation. A bare AttackType is shorthand for a
// plain attack of that type (the Gatewarden uses that form); a RotationStep object
// adds the Hexweaver's tricks: an explicit intent name, a damage override, targeting
// flags that bypass the taunt funnel, a multi-turn channel wind-up, or a scripted
// 'cast' effect. `type: 'cast'` steps deal no damage and must set `cast`.
export interface RotationStep {
  type: AttackType;
  name?: string;          // intent/display name override (e.g. 'Piercing Bolt', 'Hex')
  damage?: number;        // per-target base damage override (defaults to ATTACK_BASE_DAMAGE[type])
  ignoreTaunt?: boolean;  // not funnelled/redirected by Taunt (still auto-aimed by targetLowest)
  ignoreDefense?: boolean;// Defense reduction does not apply to this hit
  targetLowest?: boolean; // aim the (single-target) hit at the lowest-HP living member
  channelTurns?: number;  // >1 makes this a channel with that many enemy turns to resolve
  cast?: CastKind;        // for type 'cast': which scripted effect resolves
}

export type RotationEntry = AttackType | RotationStep;

export interface EnemyDef {
  id: string;
  name: string;
  boss: boolean;
  baseWeights: AttackWeights;    // attack-type selection pre-enrage
  enragedWeights: AttackWeights; // attack-type selection while enraged
  rotation?: RotationEntry[];    // fixed, learnable attack cycle (overrides weighted selection)
  channel?: ChannelDef;          // a rotation slot that periodically becomes a channel
  phase?: PhaseDef;              // an HP-threshold phase transition (Devourer, #14)
}

// A one-shot phase transition (the Devourer, #14). When the enemy first drops to
// or below `hpFraction` of its max HP, it announces `beat`, swaps its rotation for
// `rotation`, and may tighten enrage to `enrageTurn`. Edge-detected: fires once,
// even if the threshold is crossed mid-DoT-tick.
export interface PhaseDef {
  hpFraction: number;         // trigger when hp <= maxHP * hpFraction
  beat: string;               // the announced transformation line
  rotation: RotationEntry[];  // the rotation the enemy switches to in phase 2
  channel?: ChannelDef;       // a phase-2 channel slot (Maw)
  enrageTurn?: number;        // optional tighter enrage turn once transformed
}

// The two stock behaviors that reproduce the pre-refactor enemies exactly. They
// reference the existing TYPE_WEIGHTS objects so Object.entries order — and thus
// every weightedPick draw — is byte-for-byte unchanged (the #07 bit-identical gate).
export const DEFAULT_ENEMY_DEF: EnemyDef = {
  id: 'enemy', name: 'Enemy', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged,
};
export const BOSS_ENEMY_DEF: EnemyDef = {
  id: 'boss', name: 'Boss', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged,
};

// Attack-weight literal helper — keeps the key order consistent across defs. The
// scripted-only 'cast' type is always weight 0 (never weighted-picked).
const aw = (single: number, two: number, aoe: number, hidden: number, heavy: number, sweep: number): AttackWeights =>
  ({ single, two, aoe, hidden, heavy, sweep, cast: 0 });

// Four named normals (issue 09). Each is a distinct *shape* of the same total
// threat as the old generic normal (~4.5 party-wide dmg/turn), not a difficulty
// spike — the encounter tables keep per-fight winrates within ±5pp of baseline.
export const ENEMY_SPAMMER: EnemyDef = { // single-spammer: relentless single hits
  id: 'spammer', name: 'Brute', boss: false,
  baseWeights: aw(78, 14, 4, 4, 0, 0), enragedWeights: aw(58, 24, 14, 4, 0, 0),
};
export const ENEMY_SWARM: EnemyDef = { // swarm: leans more on multi-target blows
  id: 'swarm', name: 'Swarm', boss: false,
  baseWeights: aw(52, 26, 17, 5, 0, 0), enragedWeights: aw(35, 33, 27, 5, 0, 0),
};
export const ENEMY_STALKER: EnemyDef = { // stalker: leans on concealed (hidden) blows
  id: 'stalker', name: 'Stalker', boss: false,
  baseWeights: aw(52, 10, 8, 30, 0, 0), enragedWeights: aw(35, 18, 17, 30, 0, 0),
};
export const ENEMY_CLEAVER: EnemyDef = { // cleaver: occasional heavy single hit
  id: 'cleaver', name: 'Cleaver', boss: false,
  baseWeights: aw(58, 12, 7, 5, 18, 0), enragedWeights: aw(42, 18, 12, 5, 23, 0),
};

// Boss 1 — Gatewarden (issue 12): a fixed, learnable rotation that teaches
// telegraph-reading. Every 2nd cycle its heavy becomes Crushing Blow — a 2-turn
// channel at 12 (~1.7× heavy). Opens on single, complementing the turn-1 rule.
// 14 keeps the read answerable (playtest finding): a defended tank takes 13, so
// Taunt upkeep + topping the tank up survives it, while the ranger (11) and
// mage (9) still die to it — at the original 20 it exceeded every max HP and
// killed a member in 82% of good-play sims, teaching sacrifice instead.
export const GATEWARDEN_DEF: EnemyDef = {
  id: 'gatewarden', name: 'Gatewarden', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged, // fallback only
  rotation: ['single', 'two', 'heavy', 'sweep'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 12, type: 'heavy', name: 'Crushing Blow' },
};

// Boss 2 — Hexweaver (issue 13): the telegraphed taunt-punisher. It breaks the
// permanent-taunt/turtle solve with three tools, all fully telegraphed:
//   • Piercing Bolt — ignores Taunt AND Defense, aims at the lowest-HP member, so
//     the tank can't soak it and the fragile DPS is the one under threat.
//   • Hex — a 'cast' that halves ALL healing for WOUND_TURNS turns (you can't
//     out-heal it — Cleanse removes it).
//   • Siphon — a 'cast' that drains SIPHON_AMOUNT healer MP (you can't cast freely).
// Opens on a plain single (a gentle turn-1 read), then cycles the three tricks
// between whole-party pressure. Cleanse (added this issue) is its designed counter.
export const HEXWEAVER_PIERCER_DMG = 5; // Piercing Bolt per-hit damage (before attackBonus)
export const HEXWEAVER_DEF: EnemyDef = {
  id: 'hexweaver', name: 'Hexweaver', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged, // fallback only
  rotation: [
    'single',
    { type: 'single', name: 'Piercing Bolt', damage: HEXWEAVER_PIERCER_DMG, ignoreTaunt: true, ignoreDefense: true, targetLowest: true },
    { type: 'cast', name: 'Hex', cast: 'wound' },
    'sweep',
    { type: 'single', name: 'Piercing Bolt', damage: HEXWEAVER_PIERCER_DMG, ignoreTaunt: true, ignoreDefense: true, targetLowest: true },
    { type: 'cast', name: 'Siphon', cast: 'siphon' },
  ],
};

// Boss 3 — Devourer (issue 14): "race or die". Turns the invisible enrage race
// into an explicit, fair one via a phase system:
//   • Phase 1 (>50% HP): a heavy/sweep pool plus Consume — a 'cast' that cleanses
//     its OWN Poison and self-heals for every remaining tick, so poison stops being
//     free value (it becomes a decision — the deferred call in #18).
//   • Phase 2 (<=50% HP): an announced transformation beat, then Maw — a 2-turn
//     channelled sweep at DEVOURER_MAW_DMG x3, recurring every ~4 turns — plus a
//     tighter enrage. Enraged Maw one-shots an unshielded squishy: race it down.
// The phase threshold is edge-detected (fires once, even mid-Poison-tick).
export const DEVOURER_MAW_DMG = 7; // Maw per-target sweep damage (before enrage/attackBonus)
export const DEVOURER_DEF: EnemyDef = {
  id: 'devourer', name: 'Devourer', boss: true,
  baseWeights: TYPE_WEIGHTS.boss, enragedWeights: TYPE_WEIGHTS.bossEnraged, // fallback only
  rotation: [
    'single',
    'heavy',
    'sweep',
    { type: 'cast', name: 'Consume', cast: 'consume' },
    'two',
    'heavy',
  ],
  phase: {
    hpFraction: 0.5,
    beat: 'The Devourer splits its maw and TRANSFORMS!',
    // Slot 0 is always Maw (the channel fires every cycle at slot 0); the 'sweep'
    // literal there is a placeholder the channel overrides. Maw resolves every 4
    // enemy turns (2-turn wind-up + heavy + two).
    rotation: ['sweep', 'heavy', 'two'],
    channel: { slot: 0, everyCycles: 1, turns: 2, damage: DEVOURER_MAW_DMG, type: 'sweep', name: 'Maw' },
    enrageTurn: 11,
  },
};

// Act boss per act (0-based): Gatewarden (#12), Hexweaver (#13), Devourer (#14).
export const ACT_BOSS_DEFS: EnemyDef[] = [GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF];

// ---------------------------------------------------------------------------
// Act 2/3 named normals (issue 20): boss tech at small scale, so the later map
// teaches (and rewards) the reads the act bosses demand — a channeler (mini
// Crushing Blow), a piercer (mini Piercing Bolt), a self-healer (mini Consume).
// Total threat stays near the act-1 normals' ~4.5 party-wide dmg/turn; the
// signature trick, not the numbers, is the difference. No channel/step name may
// collide with a boss's (Crushing Blow / Piercing Bolt / Maw / Consume).
// ---------------------------------------------------------------------------

// Act 2 — Ironmaw (channeler): a learnable 3-step cycle whose 3rd step becomes
// Siegebreak every 2nd cycle — a 2-turn single-target channel at 9.
export const IRONMAW_DEF: EnemyDef = {
  id: 'ironmaw', name: 'Ironmaw', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged, // fallback only
  rotation: ['single', 'two', 'single'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 9, type: 'single', name: 'Siegebreak' },
};

// Act 2 — Needler (piercer): one step per cycle is Needle Shot — a mini
// Piercing Bolt (ignores Taunt AND Defense, aims at the lowest-HP member) at 4.
// Pierce-at-lowest is worth far more than its number (it bypasses the whole
// taunt/Defense answer), so it appears once per 4-step cycle.
export const NEEDLER_PIERCE_DMG = 4;
export const NEEDLER_DEF: EnemyDef = {
  id: 'needler', name: 'Needler', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged, // fallback only
  rotation: [
    'single',
    { type: 'single', name: 'Needle Shot', damage: NEEDLER_PIERCE_DMG, ignoreTaunt: true, ignoreDefense: true, targetLowest: true },
    'two',
    'single',
  ],
};

// Act 2 — Leech (self-healer): a mini Consume ('Gorge') every 6th turn cleanses
// its own Poison and self-heals the remaining ticks — poison timing matters on
// normals now, not just on the Devourer. Its plain cycle runs light because the
// Gorge value is real threat too.
export const LEECH_DEF: EnemyDef = {
  id: 'leech', name: 'Leech', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged, // fallback only
  rotation: ['single', 'two', 'single', 'single', { type: 'cast', name: 'Gorge', cast: 'consume' }, 'two'],
};

// Act 3 — Juggernaut (channeler, heavier): Overrun is an 11-damage 2-turn
// channel every 2nd cycle, over a single-heavy base cycle (the channel is the
// threat; the cycle stays on budget).
export const JUGGERNAUT_DEF: EnemyDef = {
  id: 'juggernaut', name: 'Juggernaut', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged, // fallback only
  rotation: ['single', 'single', 'two'],
  channel: { slot: 2, everyCycles: 2, turns: 2, damage: 11, type: 'single', name: 'Overrun' },
};

// Act 3 — Lancer (piercer, heavier): Skewer pierces at 5, once per 4-step cycle.
export const LANCER_PIERCE_DMG = 5;
export const LANCER_DEF: EnemyDef = {
  id: 'lancer', name: 'Lancer', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged, // fallback only
  rotation: [
    'single',
    { type: 'single', name: 'Skewer', damage: LANCER_PIERCE_DMG, ignoreTaunt: true, ignoreDefense: true, targetLowest: true },
    'single',
    'two',
  ],
};

// Act 3 — Devourling (self-healer, hungrier): Gorge every 6th turn over a
// light cycle (long 150-HP fights sit near the enrage cliff, so every eaten
// poison tick is expensive — the Gorge itself is the difficulty).
export const DEVOURLING_DEF: EnemyDef = {
  id: 'devourling', name: 'Devourling', boss: false,
  baseWeights: TYPE_WEIGHTS.normal, enragedWeights: TYPE_WEIGHTS.enraged, // fallback only
  rotation: ['single', 'two', 'single', { type: 'cast', name: 'Gorge', cast: 'consume' }, 'two', 'single'],
};

export const NORMAL_ENEMY_DEFS: EnemyDef[] = [
  ENEMY_SPAMMER, ENEMY_SWARM, ENEMY_STALKER, ENEMY_CLEAVER,
  IRONMAW_DEF, NEEDLER_DEF, LEECH_DEF, JUGGERNAUT_DEF, LANCER_DEF, DEVOURLING_DEF,
];
export const ENEMY_DEF_BY_ID: Record<string, EnemyDef> =
  Object.fromEntries(NORMAL_ENEMY_DEFS.map((d) => [d.id, d]));

// Encounter table: weighted normal picks per fight index. Act-boss slots (2, 5,
// 8) are empty — those fights always use the act boss. Act 1 keeps the original
// four; acts 2/3 lead with their own named rosters (#20) — the boss-tech
// normals — with an act-1 body as occasional filler for texture.
export const ENCOUNTER_TABLE: Array<Array<[string, number]>> = [
  [['spammer', 70], ['swarm', 30]],                                       // fight 0 (A1)
  [['spammer', 45], ['swarm', 30], ['stalker', 25]],                      // fight 1 (A1)
  [],                                                                      // fight 2 (A1 boss)
  [['ironmaw', 30], ['needler', 30], ['leech', 20], ['swarm', 20]],       // fight 3 (A2)
  [['ironmaw', 25], ['needler', 25], ['leech', 25], ['cleaver', 25]],     // fight 4 (A2)
  [],                                                                      // fight 5 (A2 boss)
  [['juggernaut', 30], ['lancer', 30], ['devourling', 20], ['cleaver', 20]], // fight 6 (A3)
  [['juggernaut', 25], ['lancer', 25], ['devourling', 25], ['cleaver', 25]], // fight 7 (A3)
  [],                                                                      // fight 8 (A3 boss)
];

// There is a single, tuned mode (2026-07): the roster campaign is the one and only
// way to play. No difficulty presets, no quick-play — the per-act curve below IS the
// game. (Deliberately no meta-progression either; it fights seed determinism.)

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
export const EN_GARDE_TURNS = 2;   // Duelist's En Garde (#74): enemy turns the persistent Riposte stance holds
// Penance (#75): the Flagellant's Blood ability. The ONE blood effect that breaks the
// never-lethal clamp — the payment is a raw drain (engine _drainMember), so at PENANCE_HP
// or less HP the cast KILLS him (a real death: scars, permadeath, ability-card removal),
// and the party still gets the fury. Declared here (before MEMBER_ABILITY_FLAVOR) so the
// flavor string can read it. Sanguine Pact's surcharge rides this ability-card blood cost
// too (a deliberate scope call: curse costs apply to blood ABILITY cards, not just hand
// Blood cards — see _fireAbility's penance case).
export const PENANCE_HP = 4;           // Penance: HP the Flagellant pays — NO clamp; <= this kills him
export const PENANCE_STRIKE_BONUS = 2; // Penance: +auto damage every living member gets this turn
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
export const FORTIFY_MAX_TURNS = 3;       // Fortify: ticks before it ends on its own (Shield/tick)

// Short flavor of each member's ability — name + one-liner. Shown on the live
// MemberCard AND the draft card (#37), so it lives here rather than in a component
// (the draft must not leak raw ability ids like `graveChill`). Keyed by MemberId.
export const MEMBER_ABILITY_FLAVOR: Record<MemberId, string> = {
  ranger: `Poison Arrow — Poison ${POISON_BASE}: ${POISON_BASE} damage per turn for ${POISON_TURNS} turns.`,
  tank: `Taunt — pull the enemy onto the Tank and brace (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} turns.`,
  mage: `Lightning Bolt — deal ${BOLT_BASE} + ${BOLT_CHARGE_MULT}×Charge to the enemy.`,
  warlock: `Hex — curse the enemy with Vulnerability: the party deals +${Math.round(HEX_VULN_BY_SIZE[1] * 100)}% damage solo / +${Math.round(HEX_VULN_BY_SIZE[3] * 100)}% in a full party, for ${HEX_TURNS} turns.`,
  skald: `Crescendo — draw ${CRESCENDO_DRAW}. Strikes for ${SKALD_DMG_PER_CARD}×cards played (cap ${SKALD_DMG_CAP}).`,
  berserker: `Rampage — strike for 2× current damage, then −${RAMPAGE_SELF_DMG} HP. Hits +${BERSERKER_BAND_BONUS}/+${BERSERKER_BAND_BONUS * 2} harder at low HP.`,
  graveAugur: `Grave Chill — shave ${GRAVE_CHILL_REDUCTION} damage per target off the enemy's telegraphed attack.`,
  beastWarden: `Call Boar — summon a ${BOAR_HP} HP Boar for ${BOAR_TURNS} turns; it soaks whole hits aimed at her and adds +${BOAR_STRIKE_BONUS} to her strike.`,
  sentinel: `Stun — cancel the enemy's telegraphed action: the enemy loses the turn and telegraphs anew next turn.`,
  plaguewright: `Ferment — for ${FERMENT_TURNS} enemy turns the enemy's Poison compounds: each tick deals its damage, then +${FERMENT_GROWTH}/turn and its duration is frozen. Recasts extend the window.`,
  hierophant: `Liturgy — your active channel gains dual cadence: for its remaining duration it also ticks at the start of the enemy phase, before the blow lands.`,
  duelist: `En Garde — a chosen member gains Riposte for ${EN_GARDE_TURNS} enemy turns: they counter EVERY hit that strikes them (fully blocked hits included) for their auto damage.`,
  flagellant: `Penance — pay ${PENANCE_HP} HP (NO clamp — this can kill him); every living member's auto deals +${PENANCE_STRIKE_BONUS} this turn (him included if he survives; the buff lands even if he dies).`,
  lightkeeper: `Radiance — heal every living member ${RADIANCE_HEAL}; each member's overheal hardens into Brace (adds to existing Brace, no cap). A Shield is kept, not overwritten.`,
};

// The MemberDef that actually sits in a party slot: the drafted member's identity
// if one was drafted (#27), else the classic-trio def for that slot. Every run-layer
// screen must resolve names/abilities/flavor through this — reading MEMBER_DEFS[slot]
// directly shows classic-trio names for a drafted party (the #36 bug).
export function memberDefAt(party: PartyMemberConfig[], slot: number): MemberDef {
  const m = party[slot]?.member;
  return (m && MEMBER_POOL[m]) || MEMBER_DEFS[slot];
}

// Card set phase A (#15) magnitudes.
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

// ---------------------------------------------------------------------------
// Run / battle configuration
//
// The engine used to read the party, deck, and player resources straight from
// the constants above. To support a multi-battle run (persistent deck, card
// upgrades, party/healer progression, a two-action boss), the Game constructor
// now takes a BattleConfig. `defaultBattleConfig()` reproduces the original
// single fight, so `new Game(seed)` behaves exactly as before.
// ---------------------------------------------------------------------------

// Card upgrade modifiers. Cards carry up to two of these in their upgrade slots.
export type ModifierId = 'efficient' | 'potent' | 'lingering' | 'retain';

// A concrete card instance in the run deck: a base card id plus the upgrade
// modifiers applied to it. `uid` is a stable identity for picking it in shops.
export interface DeckCard {
  uid: number;
  id: CardId;
  upgrades: ModifierId[]; // length 0..2
}

export interface PartyMemberConfig {
  maxHP: number;
  // Current HP (#58). On a ROSTER member this persists across fights: a member ends
  // a fight hurt and carries that HP forward (healed only HERO_HEAL_PCT between
  // fights). Absent means "full" — a fresh member, and the standalone/quick-play
  // battle party that has no run layer to persist it. Threaded into the fight via
  // Run.toBattleConfig (clamped to the injury-adjusted max) and read back out on a
  // win (Run.winFight). Never set on the length-3 battle party's empty slots.
  hp?: number;
  damage: number;
  abilityPower: number; // bonus added to the member's base ability strength
  // Persistent death-scars (DR1). A member accrues one each time it dies in a
  // won fight (see Run.recordInjuries); the count drives an escalating stat
  // penalty (injuryPenalty below) that is applied to the fight config in
  // Run.toBattleConfig and cleared for gold at an Infirmary node. Kept SEPARATE
  // from the base stats so clearing restores them exactly and does not entangle
  // with permanent party upgrades.
  injuries: number; // 0..MAX_INJURIES
  // Drafted identity (#27): which pool member sits in this slot. Absent means the
  // classic trio member for the slot (backward-compatible with pre-draft configs).
  member?: MemberId;
  // 'incapacitate' injury mode: the member enters the fight dead and cannot be
  // Resurrected (see INJURY_RULES). Absent/false everywhere else.
  incapacitated?: boolean;
  // An unfilled deploy slot: no member is seated here for this fight. The engine
  // builds it as an absent member (dead, untargetable, unstriking) so a 1- or
  // 2-member deployment leaves the remaining battle slots inert. Only ever set on
  // the length-3 battle party built in Run.toBattleConfig — never on a roster member.
  empty?: boolean;
  // Count of permanent stat upgrades applied to this roster member (2026-07). Drives
  // the member's salary (memberSalary): each upgrade raises the fee to field them.
  // Absent/0 on a fresh member and on the battle party (a run-layer concern only).
  upgrades?: number;
}

// ---------------------------------------------------------------------------
// Injuries / scars (DR1). Death used to cost only the current fight's output —
// the party was rebuilt at full HP for free — so optimal play spent members.
// A death now leaves a persistent, escalating scar, so protecting members is
// correct play (and the revive kit finally earns its cost). Each member scars
// by ITS OWN death count, capped at MAX_INJURIES:
//   1st death → "Cracked"  (−max HP)
//   2nd death → "Weakened" (−1 damage)
//   3rd death → "Broken"   (−1 ability power)
// The tables give the TOTAL penalty at a given injury count (indexed count−1),
// i.e. they are cumulative-by-tier, not per-tier increments: a Cracked member
// keeps just the HP penalty even after taking the Weakened and Broken scars.
// Flat, not percentage — legible on the card and clean to sim/pin (a percentage
// rounds ugly on the 9-HP mage). Exact magnitudes are sim-tuned.
// ---------------------------------------------------------------------------
export const MAX_INJURIES = 3;
export const INJURY_MAXHP: number[] = [2, 2, 2];   // Cracked: −2 max HP from the 1st scar on
export const INJURY_DAMAGE: number[] = [0, 1, 1];  // Weakened: −1 damage from the 2nd scar on
export const INJURY_ABILITY: number[] = [0, 0, 1]; // Broken: −1 ability power from the 3rd scar

// Human-readable scar names by tier index (0 = 1st death). Used by the UI and
// the Infirmary. The first MAX_INJURIES are the graded scars; the last ('Shattered')
// is the 4th scar that incapacitates under 'incapacitate' mode (INCAPACITATE_AT).
export const INJURY_NAMES: string[] = ['Cracked', 'Weakened', 'Broken', 'Shattered'];

// ---------------------------------------------------------------------------
// Injury-mode experiment (2026-07-04 playtest). The 3-scar cap NULLIFIES the
// system at its limit: once a member is Broken, every further death is free and
// the DR1 sacrifice line returns for that member. Two harder variants, behind a
// runtime switch so they can be simmed / play-felt without a build:
//   'cap'          — today's rule: scars stop at 3, further deaths cost nothing.
//   'escalate'     — scars never cap; each death past the 3rd repeats the cycle
//                    (4th −2 max HP, 5th −1 damage, 6th −1 ability, ...).
//   'incapacitate' — the 4th death takes the member OUT: they start every fight
//                    dead and cannot be Resurrected; the Infirmary / Field
//                    Hospital / Mending Totem can still heal the 4th scar to
//                    restore them (recoverable, like the rest of DR1).
// Default 'cap' (the tuned demo rule); the sim experiments read the findings
// issue. Mutable at runtime on purpose — sim scripts and a future settings
// toggle flip it without touching the module graph.
// ---------------------------------------------------------------------------
//   'death'        — the shipped rule (2026-07): the 4th death PERMANENTLY kills the
//                    member — they are removed from the roster for good. Injuries are
//                    permanent (no Infirmary); the Field Hospital event can still shed
//                    a scar before the 4th, so a wounded hero can be pulled back.
export type InjuryMode = 'cap' | 'escalate' | 'incapacitate' | 'death';
// Default 'death' (2026-07 roster rework): the 4th death removes the member from the
// roster permanently — the sharpest legible cost, and the reason to bench a
// three-scar hero. Still mutable at runtime for sim experiments.
export const INJURY_RULES: { mode: InjuryMode } = { mode: 'death' };
export const INCAPACITATE_AT = MAX_INJURIES + 1; // the scar count that removes/incapacitates the member
export const DEATH_AT = INCAPACITATE_AT;         // (alias) the scar count that permanently kills under 'death'

// Scar count a run may record for one member under the active mode.
export function injuryRecordCap(): number {
  switch (INJURY_RULES.mode) {
    case 'cap': return MAX_INJURIES;
    case 'incapacitate': return INCAPACITATE_AT;
    case 'death': return DEATH_AT;
    case 'escalate': return Number.MAX_SAFE_INTEGER;
  }
}

// Whether this scar count incapacitates the member (starts fights dead,
// unresurrectable) under the active mode.
export const injuryIncapacitates = (injuries: number): boolean =>
  INJURY_RULES.mode === 'incapacitate' && injuries >= INCAPACITATE_AT;

// Whether this scar count PERMANENTLY kills the member (removed from the roster)
// under the active mode ('death'). The run layer splices them out.
export const injuryKills = (injuries: number): boolean =>
  INJURY_RULES.mode === 'death' && injuries >= DEATH_AT;

// Total penalty of each kind for a member carrying `injuries` scars.
// 'escalate' extends the 3-tier cycle indefinitely: tier i (1-indexed) grants the
// table's ((i-1) % 3)-th penalty, so the 4th scar is another Cracked, the 5th
// another Weakened, and so on. The other modes clamp at the table edge.
const injuryPenalty = (table: number[], injuries: number): number => {
  if (injuries <= 0) return 0;
  if (INJURY_RULES.mode !== 'escalate' || injuries <= MAX_INJURIES) {
    return table[Math.min(injuries, MAX_INJURIES) - 1];
  }
  let total = table[MAX_INJURIES - 1];
  for (let tier = MAX_INJURIES + 1; tier <= injuries; tier++) {
    // Per-tier increment of the cycled tier = the table delta at that position.
    const pos = (tier - 1) % MAX_INJURIES;
    total += table[pos] - (pos > 0 ? table[pos - 1] : 0);
  }
  return total;
};
export const injuryMaxHPPenalty = (injuries: number): number => injuryPenalty(INJURY_MAXHP, injuries);
export const injuryDamagePenalty = (injuries: number): number => injuryPenalty(INJURY_DAMAGE, injuries);
export const injuryAbilityPenalty = (injuries: number): number => injuryPenalty(INJURY_ABILITY, injuries);

export interface HealerConfig {
  maxMana: number;   // MP cap; starting MP each fight equals this
  handSize: number;
  restRegen: number; // MP regained on rest
  passiveMp: number; // MP gained at the start of each player phase
  // Hand-4 carryover experiment (#25, Q6): cards KEPT in hand across the end-of-turn
  // discard (in addition to Retain cards). Absent/0 = classic full-hand discard.
  // Behind a flag: DEFAULT_HEALER ships it at 0; only an explicit config turns it on.
  carryover?: number;
}

export interface EnemyConfig {
  maxHP: number;
  boss: boolean;       // true -> uses the stronger, fully-telegraphed boss attack pool
  attackBonus: number; // flat bonus added to each attack's per-target damage (difficulty ramp)
  def?: EnemyDef;      // enemy behavior (attack weights, name); synthesized from `boss` if omitted
  enrageTurn?: number; // turn this enemy enrages (defaults to the global ENRAGE_TURN)
}

export interface BattleConfig {
  deck: DeckCard[];
  party: PartyMemberConfig[]; // length 3, indexed by slot
  healer: HealerConfig;
  enemy: EnemyConfig;
  relics?: RelicId[]; // run-long passives (#21); absent/empty means fully inert
  // Once-per-RUN relics already spent in an earlier fight (#22: Dusk Chime,
  // Martyr's Icon). The engine treats these as used from the first turn.
  spentRelics?: RelicId[];
}

export const DEFAULT_HEALER: HealerConfig = {
  maxMana: MP_MAX, handSize: HAND_SIZE, restRegen: SKIP_REGEN, passiveMp: 0, carryover: 0,
};

export const DEFAULT_ENEMY: EnemyConfig = { maxHP: ENEMY_MAX_HP, boss: false, attackBonus: 0, def: DEFAULT_ENEMY_DEF };

export const MAX_UPGRADE_SLOTS = 2;

export function makeDeckCard(id: CardId, uid: number, upgrades: ModifierId[] = []): DeckCard {
  return { uid, id, upgrades: [...upgrades] };
}

export function defaultParty(): PartyMemberConfig[] {
  return MEMBER_DEFS.map((d) => ({ maxHP: d.maxHP, damage: d.damage, abilityPower: 0, injuries: 0 }));
}

// The 6-card core deck as concrete instances (uid = position). Member ability
// cards are added on top per-fight (abilityCardsForParty), not stored here.
// This is the Preserver preset (#63) — the run/sim/quick-play default opener.
export function defaultDeck(): DeckCard[] {
  return DECK_LIST.map((id, i) => makeDeckCard(id, i));
}

// ---------------------------------------------------------------------------
// Themed preset starter decks (#63, Part C). The player picks one at run start;
// each is ~6-8 cards weighted toward its 1-2 types, drawn only from shoppable,
// non-ability cards (ability cards are still injected per deployed member). The
// lists/names are tunable — a later balance pass owns deep starter tuning.
// ---------------------------------------------------------------------------
export type StarterDeckId = 'preserver' | 'reaper' | 'warden';
export interface StarterDeckDef {
  id: StarterDeckId;
  name: string;
  desc: string;
  types: CardType[];  // the 1-2 types the preset leans on (for the picker UI)
  list: CardId[];
}
export const DEFAULT_STARTER_DECK: StarterDeckId = 'preserver';
export const STARTER_DECK_IDS: StarterDeckId[] = ['preserver', 'reaper', 'warden'];
export const STARTER_DECKS: Record<StarterDeckId, StarterDeckDef> = {
  // Preserver — the current heal-lean opener (today's default), Holy/Nature.
  preserver: {
    id: 'preserver', name: 'Preserver', types: ['holy', 'nature'],
    desc: 'Holy & Nature — a heal-lean opener that keeps the party standing.',
    list: DECK_LIST,
  },
  // Reaper — damage + sacrifice tempo, Shadow/Blood.
  reaper: {
    id: 'reaper', name: 'Reaper', types: ['shadow', 'blood'],
    desc: 'Shadow & Blood — burn the enemy down and pay in blood.',
    list: ['shadowBolt', 'siphonLife', 'grimHarvest', 'lowHeal', 'highHeal', 'transfusion'],
  },
  // Warden — protection + economy, Iron/Arcane.
  warden: {
    id: 'warden', name: 'Warden', types: ['iron', 'arcane'],
    desc: 'Iron & Arcane — shields and mana to outlast the fight.',
    list: ['shield', 'brace', 'refresh', 'lowHeal', 'highHeal', 'mendingStream'],
  },
};

// Build a starter deck as concrete DeckCard instances (uid = position). The chosen
// preset replaces defaultDeck() at run start; quick-play/sim keep the Preserver default.
export function buildStarterDeck(id: StarterDeckId): DeckCard[] {
  return STARTER_DECKS[id].list.map((cid, i) => makeDeckCard(cid, i));
}

// The per-fight ability cards for a battle party (#44): one bound card per seated
// member, resolved to that member's ability (drafted id, else the slot's classic
// trio default — mirroring the engine's Member construction). Empty slots add none.
// Given negative uids so they never collide with the persistent run deck, and left
// out of that deck entirely, so they vanish when the fight ends.
export function abilityCardsForParty(party: PartyMemberConfig[]): DeckCard[] {
  const cards: DeckCard[] = [];
  party.forEach((p, slot) => {
    if (p.empty) return;
    // #54: an incapacitated member cannot return this fight (unresurrectable), so
    // their ability card is permanent dead weight — never inject it. This is the
    // "removed from deck+hand for the remainder of the fight" path: because
    // incapacitated members enter the fight already dead, skipping injection here is
    // equivalent to purging at fight start (the card is never drawn at all).
    if (p.incapacitated) return;
    const ability = (p.member ? MEMBER_POOL[p.member] : MEMBER_DEFS[slot]).ability;
    cards.push(makeDeckCard(ABILITY_CARD[ability], -(cards.length + 1)));
  });
  return cards;
}

export function defaultBattleConfig(): BattleConfig {
  const party = defaultParty();
  return {
    deck: [...defaultDeck(), ...abilityCardsForParty(party)],
    party,
    healer: { ...DEFAULT_HEALER },
    enemy: { ...DEFAULT_ENEMY },
  };
}

// A card's effective stats after its upgrade modifiers are folded in. The engine
// and UI both read cards through resolveCard so base values and upgrades stay in
// one place. (Modifier effects are layered on in resolveCard below.)
export interface ResolvedCard {
  id: CardId;
  name: string;
  cost: number;
  target: CardTarget;
  desc: string;
  heal?: number;
  regen?: number;
  refresh?: number;
  draw?: number;
  needsRegen: boolean;
  needsPoison: boolean; // Hemorrhage (#67): playable only while the enemy is Poisoned
  needsChannel: boolean; // Liturgy (#73): playable only while a channel is active
  refreshCap: number; // per-cast lifetime MP cap for Refresh-slot cards
  selfDamage?: number; // Blood cost the target pays (never bumped by modifiers)
  noDefense: boolean; // Bulwark targeting gate: no active Defense on the target
  noTaunt: boolean;   // Phalanx targeting gate: not the taunting member
  ability?: AbilityId; // per-member ability card (#44): fires the bound member's move
  channel?: CardChannelDef; // channeled card (#64): starts a channel instead of a one-shot
  // Regen has no separate duration (#52): `regen` is the applied magnitude, which
  // is also its number of ticks. Lingering folds into `regen` (see resolveCard).
  refreshTurns: number;
  retain: boolean;
  upgrades: ModifierId[];
}

// ---------------------------------------------------------------------------
// Rarity (shared by every shop) and the card upgrade modifiers.
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare';
export const RARITY_PRICE: Record<Rarity, number> = { common: 25, uncommon: 50, rare: 75 };
// Lower rarities show up more often in storefronts.
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10 };

// Modifier magnitudes (per stacked copy).
export const MOD_EFFICIENT_COST = 1;   // -1 mana cost
export const MOD_POTENT_STRENGTH = 1;  // +1 to heal / regen / refresh amount
export const MOD_LINGERING_TURNS = 1;  // +1 turn of duration (Regen / Refresh)

const cardHasStrength = (id: CardId): boolean => {
  const c = CARDS[id];
  return !c.noPotent && (c.heal != null || c.regen != null || c.refresh != null);
};
const cardHasDuration = (id: CardId): boolean => {
  const c = CARDS[id];
  return c.regen != null || c.refresh != null;
};

// Shared engine tag: any card that generates MP or draws cards.
export const isEngineCard = (id: CardId): boolean => CARDS[id].engine === true;

// A member ability counts as an "engine" effect when firing it generates MP or
// draws cards (#27): Crescendo draws. Same spirit as the engine-card tag
// (economy-fueling), surfaced for the ability card that fires it. (The Warlock's
// old Dark Bargain minted MP and was engine-tagged; his redesigned Hex (#39) is a
// pure debuff and no longer counts.)
export const isEngineAbility = (ability: AbilityId): boolean =>
  ability === 'crescendo';

// Retain may not lock in a per-member ability card (#44: those are inserted per
// fight, never part of the persistent deck), any engine card (that would make the
// MP-economy loop deterministic), or a 0-cost card (free perpetual value).
const retainEligible = (id: CardId): boolean =>
  !isAbilityCard(id) && !isEngineCard(id) && CARDS[id].cost > 0;

// Efficient may not touch a 0-cost card (nothing to shave; the #02 floor already
// blocks reaching 0) or a draw-engine card (a discounted Inspiration compounds
// the card economy the same way a Retained engine card would the MP economy).
const efficientEligible = (id: CardId): boolean => CARDS[id].cost > 0 && CARDS[id].draw == null;

export interface ModifierDef {
  id: ModifierId;
  name: string;
  rarity: Rarity;
  desc: string;
  eligible: (cardId: CardId) => boolean; // which cards this modifier may be applied to
}

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  lingering: {
    id: 'lingering', name: 'Lingering', rarity: 'common',
    desc: '+1 turn of duration.', eligible: cardHasDuration,
  },
  efficient: {
    id: 'efficient', name: 'Efficient', rarity: 'uncommon',
    desc: '-1 mana cost.', eligible: efficientEligible,
  },
  potent: {
    id: 'potent', name: 'Potent', rarity: 'uncommon',
    desc: '+1 to its healing / restore amount.', eligible: cardHasStrength,
  },
  retain: {
    id: 'retain', name: 'Retain', rarity: 'rare',
    desc: 'Not discarded at end of turn.', eligible: retainEligible,
  },
};

export const MODIFIER_IDS: ModifierId[] = ['lingering', 'efficient', 'potent', 'retain'];

// Whether `mod` can be applied to `card` right now: an open slot, per-card-id
// eligibility, and the modifier must actually change the resolved card.
// Efficient cannot bite below the 1-MP floor and a second Retain is a no-op —
// offering either would sell the player nothing for full price.
export function canApplyModifier(card: DeckCard, mod: ModifierId): boolean {
  if (card.upgrades.length >= MAX_UPGRADE_SLOTS || !MODIFIERS[mod].eligible(card.id)) return false;
  if (mod === 'efficient' && resolveCard(card).cost <= 1) return false;
  if (mod === 'retain' && card.upgrades.includes('retain')) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Run structure: node types, map shape, economy, and shop/event offer pools.
// ---------------------------------------------------------------------------

export type NodeType =
  | 'fight' | 'cardShop' | 'cardUpgrade' | 'partyUpgrade' | 'event'
  | 'recruit'   // add a member to the roster (2026-07) — a weighted node; hidden when the roster is full
  | 'infirmary' // heal HP / shed a scar for gold (#58) — hidden when nobody is hurt or injured
  | 'reliquary'; // relic shop (#21) — never rolled; injected exactly twice per run

// The non-fight node types that fill the branches between fights. The Infirmary is
// back (#58): HP persists across fights now, so a paid HP/scar top-up is a real
// attrition-economy stop again (it hides at runtime when the party is healthy). The
// Sanctum / healerUpgrade node was removed (#83) — healer upgrades are now a free
// post-boss boon (see run.ts _enterHealerBoon), not a gold-bought map node.
export const NON_FIGHT_NODES: NodeType[] = [
  'cardShop', 'cardUpgrade', 'partyUpgrade', 'event', 'recruit', 'infirmary', 'reliquary',
];

// Weights for placing non-fight node types on the map. The Recruit node (2026-07)
// grows the roster past the pick-one drafts; it is a real roll (you must find one)
// and is hidden once the roster already holds every member. The Infirmary (#58) is
// the paid HP/scar top-up; it too hides at runtime when the party is healthy. The
// old healerUpgrade weight (15) was removed with the Sanctum node (#83) and
// redistributed across the surviving types (total stays 140).
export const NODE_TYPE_WEIGHTS: Array<[NodeType, number]> = [
  ['cardShop', 28], ['cardUpgrade', 23], ['partyUpgrade', 22], ['event', 22],
  ['recruit', 22], ['infirmary', 23],
];

// A run is 3 acts of 3 fights each (two normals + an act boss): 9 fights, 8 forks
// between them. Act bosses sit at fights 2, 5, 8 (the last fight of each act); the
// final fight (8) ends the run.
export const FIGHTS_PER_ACT = 3;
export const ACT_COUNT = 3;
export const FIGHT_COUNT = FIGHTS_PER_ACT * ACT_COUNT; // 9
export const FORK_COUNT = FIGHT_COUNT - 1;             // 8 forks between fights
export const BRANCHES_PER_FORK = 2;
export const NODES_PER_BRANCH = 2;

// Raised 40 -> 80 to fund member salaries (2026-07). Deploying the classic trio
// costs 40 salary/fight, so the trio's NET is the old 40; fielding fewer keeps more.
export const GOLD_PER_FIGHT = 100;   // awarded for winning a (non-final) fight (before salaries)
// "Field fewer, keep more" made real (#42): the win bounty scales UP with empty
// deploy seats, so an undermanned win pays a premium on top of the wages it saves.
// Each empty seat adds this fraction of the base bounty (2 empty = solo = +60%).
export const EMPTY_SEAT_GOLD_BONUS = 0.30;

// ---------------------------------------------------------------------------
// Between-fight healing (#58). HP now PERSISTS across fights (a member ends a
// fight hurt and starts the next deploy step still hurt); between fights each
// member recovers only this fraction of their max HP, clamped to max — no longer
// a free full re-seed. A member dead at the end of a WON fight is resurrected to
// the same recovered amount (round(HERO_HEAL_PCT × maxHP)), not to full and not
// to the in-fight Resurrect card's 50% (which stays a battlefield-only revive).
// The Infirmary node (below) is the paid way to top HP back up / shed a scar.
// Chosen from the N=1000 sweep in sim/heal-exp.ts (#58 balance pass).
// ---------------------------------------------------------------------------
export const HERO_HEAL_PCT = 0.40;

// The active between-fight heal fraction. Reads HERO_HEAL_PCT by default; kept in a
// mutable holder ONLY so the sweep (sim/heal-exp.ts) can vary it without a rebuild,
// exactly like INJURY_RULES. Runtime + tests use the HERO_HEAL_PCT default.
export const HEAL_TUNING = { pct: HERO_HEAL_PCT };

// Infirmary node (#58, re-added): pay gold to fully restore one member's HP, or a
// much larger price to shed one lasting injury (scar). Both gold-clamped; the node
// hides when nobody is hurt or injured. Prices are sim-tuned in the balance pass.
export const INFIRMARY_HP_PRICE = 15;      // restore a chosen member to full HP
export const INFIRMARY_INJURY_PRICE = 45;  // shed one death-scar from a chosen member

// ---------------------------------------------------------------------------
// Member salaries (2026-07): after each won fight, every DEPLOYED member is paid
// out of the winnings; benched members are free, so fielding fewer keeps more gold.
// Salary rises with each stat upgrade and falls with each injury. Base salaries are
// tuned so the classic trio (ranger+tank+mage) costs exactly GOLD_PER_FIGHT/2. These
// magnitudes are sim-tuned in the balance pass.
// ---------------------------------------------------------------------------
// Rescaled up with GOLD_PER_FIGHT (#42) so the wages a benched member saves are a
// meaningful slice of the (now larger, empty-seat-scaled) bounty — the two levers
// together make fielding fewer a real gold decision, not a rounding error.
export const MEMBER_BASE_SALARY: Record<MemberId, number> = {
  ranger: 18, tank: 13, mage: 20,          // classic trio: 18 + 13 + 20 = 51
  warlock: 14, skald: 15, berserker: 13, graveAugur: 18, beastWarden: 15, sentinel: 15,
  plaguewright: 17, hierophant: 16, duelist: 15, flagellant: 14, lightkeeper: 15,
};
export const SALARY_PER_UPGRADE = 4; // each permanent stat upgrade raises a member's salary
export const SALARY_PER_INJURY = 3;  // each scar lowers it (a damaged hero is cheaper to field)
export const MIN_SALARY = 3;         // a salary never drops below this
export const DEFAULT_MEMBER_SALARY = 12; // fallback for a member without a pool identity (quick-play)

// A roster member's current salary: base (by identity) + per-upgrade, − per-injury,
// floored at MIN_SALARY. `upgrades` counts permanent stat boosts applied to them.
export function memberSalary(p: PartyMemberConfig): number {
  const base = p.member ? MEMBER_BASE_SALARY[p.member] : DEFAULT_MEMBER_SALARY;
  return Math.max(MIN_SALARY, base + SALARY_PER_UPGRADE * (p.upgrades ?? 0) - SALARY_PER_INJURY * p.injuries);
}

// Which act a fight belongs to, and whether it is that act's boss (its last fight).
export const actOfFight = (fightIndex: number): number => Math.floor(fightIndex / FIGHTS_PER_ACT);
export const isActBoss = (fightIndex: number): boolean =>
  (fightIndex % FIGHTS_PER_ACT) === FIGHTS_PER_ACT - 1;

// Per-act difficulty curve, indexed by fight. HP and attackBonus climb per act;
// the enrage column lets act bosses enrage sooner. Act bosses (2,5,8) use the
// boss attack pool, so their flat attackBonus is 0. A2/A3 bosses are placeholders
// (scaled BOSS_ENEMY_DEF) until the Gatewarden/Hexweaver/Devourer land (#12-14).
// Re-anchored for the 2026-07 roster campaign: the player builds their party over
// the run, so act 1 is fought SOLO/duo (F0 is a forced solo) and later acts with a
// small roster — far less party DPS/bodies than the old fixed trio. HP drops across
// the board; act 1 especially. Sim-tuned against the campaign policy.
// 2026-07-07 SKILL-TIER PASS: re-anchored DOWN again so the FLAWLESS good-player line
// (the sim's optimal tier) hits the ~75% full-run target, with the difficulty gradient
// carried by play-quality tiers on identical content (see sim/profile.ts + balance-
// tiers.ts): average ~30%, poor <1%. Bosses stay the walls but are answerable. MP economy
// and healing were left untouched per the maintainer constraint — this pass is HP + gold +
// solo-only levers only.
export const ENEMY_HP_BY_FIGHT: number[] = [
  10, 15, 32,     // Act 1: solo F0, ~solo F1, duo Gatewarden (2026-07-09 post-wave re-anchor)
  38, 47, 108,    // Act 2: duo/trio normals + Hexweaver (2026-07-09 post-wave re-anchor)
  61, 71, 110,    // Act 3: small-roster normals + Devourer (2026-07-09 post-wave re-anchor)
];
// Normals stay gentle on per-hit damage (their difficulty is the rising HP =
// longer fights), so a good player clears them reliably; the bosses are the walls.
export const ENEMY_ATTACK_BONUS: number[] = [
  0, 0, 0,
  1, 1, 0,
  1, 1, 0,
];
// Enrage is a boss anti-stall mechanic. Normals get a high enrage turn (14) so
// long high-HP normals stay a clean DPS race and don't hit an enrage cliff; the
// act bosses keep their tuned enrage turns (A1 11, A2 10, A3 per-def placeholder 11).
export const ENEMY_ENRAGE_TURN_BY_FIGHT: number[] = [
  14, 14, 11,
  14, 14, 10,
  14, 14, 11,
];

// Storefront sizes per shop type.
export const SHOP_SIZE = { cardShop: 6, cardUpgrade: 3, partyUpgrade: 4 } as const;

// Rarity of each existing card (new cards are a separate design task).
export const CARD_RARITY: Record<CardId, Rarity> = {
  lowHeal: 'common',
  regen: 'common',
  cultivate: 'common',
  battleHymn: 'common',
  brace: 'common',
  cleanse: 'uncommon',
  highHeal: 'uncommon',
  aoeHeal: 'uncommon',
  shield: 'uncommon',
  refresh: 'uncommon',
  overgrowth: 'uncommon',
  bloom: 'uncommon',
  inspiration: 'uncommon',
  lifebloom: 'uncommon',
  surge: 'uncommon',
  bloodTithe: 'uncommon',
  martyrsGift: 'uncommon',
  phalanx: 'uncommon',
  provoke: 'uncommon',
  resurrect: 'rare',
  fontOfMana: 'rare',
  barrier: 'rare',
  grimHarvest: 'rare',
  // Shadow cards (#63): Doom is the rare of the set.
  shadowBolt: 'common', siphonLife: 'uncommon', doom: 'rare',
  // Count-based payoff cards (#63).
  cascade: 'uncommon', nightfall: 'uncommon',
  // Channeled cards (#64).
  drain: 'uncommon', mendingStream: 'uncommon', sap: 'uncommon', fortify: 'uncommon',
  // Iron mitigation web (#65).
  feint: 'uncommon', anvilStance: 'uncommon', interlock: 'uncommon',
  // Regen conversions (#66).
  thornskin: 'common', sporeburst: 'uncommon',
  // Status-window management (#67).
  hemorrhage: 'rare', umbralFeast: 'uncommon', dreadWhisper: 'common',
  // Blood + cycling (#68): Blood Banner is the rare of the set.
  crimsonPact: 'uncommon', scarletWard: 'uncommon', openVeins: 'common', transfusion: 'uncommon', bloodBanner: 'rare',
  // Holy overheal & board-state payoffs (#69): Consecration / Rootbind are the rares.
  benediction: 'uncommon', sunriseVigil: 'common', consecration: 'rare', absolution: 'uncommon', rootbind: 'rare',
  // Channel archetype rescue + arcane support (#70): Arcane Lens is the rare.
  attunement: 'uncommon', arcaneLens: 'rare',
  // Small-party cards (#42).
  rally: 'uncommon', focus: 'common', channel: 'uncommon', holdTheLine: 'rare',
  // Hero buff card batch (#62): Double Strike is the rare of the set.
  guard: 'common', sharpen: 'common', goad: 'uncommon', doubleStrike: 'rare',
  embolden: 'uncommon', empower: 'uncommon', riposte: 'uncommon',
  // Per-member ability cards (#44): never shopped (excluded from CARD_POOL below);
  // rarity is required by the Record type but inert for these.
  imbuePoison: 'uncommon', bolster: 'uncommon', unleash: 'uncommon', hex: 'uncommon',
  conduct: 'uncommon', incite: 'uncommon', hush: 'uncommon', beckon: 'uncommon', stagger: 'uncommon',
  ferment: 'uncommon', liturgy: 'uncommon', enGarde: 'uncommon', penance: 'uncommon', radiance: 'uncommon',
};

// The cards a shop can sell. Quick Heal is dropped from the pool (flaw #6): as a
// buffed 1-MP heal-2 it is a starter card, not a shop purchase. Per-member ability
// cards (#44) are inserted per-fight, never bought — excluded here.
export const CARD_POOL: CardId[] = (Object.keys(CARDS) as CardId[])
  .filter((id) => id !== 'lowHeal' && !isAbilityCard(id));

// Party member stat upgrades.
export type PartyStat = 'maxHP' | 'damage' | 'ability';
export interface PartyUpgradeDef {
  id: string;
  stat: PartyStat;
  amount: number;
  rarity: Rarity;
  name: string;
  desc: string;
  price?: number; // overrides the rarity price when an offer needs a bespoke cost
}
export const PARTY_UPGRADES: PartyUpgradeDef[] = [
  { id: 'hp3', stat: 'maxHP', amount: 3, rarity: 'common', name: '+3 Max HP', desc: 'Raise a member’s max HP by 3.' },
  { id: 'hp6', stat: 'maxHP', amount: 7, rarity: 'uncommon', name: '+7 Max HP', desc: 'Raise a member’s max HP by 7.' },
  { id: 'dmg1', stat: 'damage', amount: 1, rarity: 'uncommon', name: '+1 Damage', desc: 'Raise a member’s attack damage by 1.' },
  // +2 Damage is the strongest single lever; priced above its rarity (flaw #10).
  { id: 'dmg2', stat: 'damage', amount: 2, rarity: 'rare', price: 85, name: '+2 Damage', desc: 'Raise a member’s attack damage by 2.' },
  { id: 'abil1', stat: 'ability', amount: 1, rarity: 'uncommon', name: '+1 Ability', desc: 'Raise a member’s ability strength by 1.' },
];

// Healer (player) stat upgrades — each a +1 increment to a player resource.
export type HealerStat = 'maxMana' | 'handSize' | 'restRegen' | 'passiveMp';
export interface HealerUpgradeDef {
  id: string;
  stat: HealerStat;
  amount: number;
  rarity: Rarity;
  name: string;
  desc: string;
  price?: number; // overrides the rarity price when an offer needs a bespoke cost
}
// #83: these are now a FREE, repeatable post-boss boon (run.ts _enterHealerBoon),
// not a gold-bought Sanctum node — so the bespoke prices are gone and the four are
// retuned toward roughly EQUAL value as free picks. +1 to hand/passive/rest is a
// big swing; a single +1 max mana is the weakest of the four, so mana is bumped to
// +2 to sit alongside them. passiveMp stays capped per run (PASSIVE_MP_CAP), so a
// second pick of it is absorbed by the cap — the other three keep stacking. rarity
// no longer drives a price (the boon is free); it is retained only as a display tag.
// Exact equalized magnitudes land against the sim/balance harness in a follow-up.
export const HEALER_UPGRADES: HealerUpgradeDef[] = [
  { id: 'mana', stat: 'maxMana', amount: 2, rarity: 'uncommon', name: '+2 Max Mana', desc: 'Raise max mana (and starting mana) by 2.' },
  { id: 'rest', stat: 'restRegen', amount: 1, rarity: 'uncommon', name: '+1 Rest Regen', desc: 'Rest restores 1 more MP.' },
  { id: 'passive', stat: 'passiveMp', amount: 1, rarity: 'rare', name: '+1 Passive MP', desc: `Gain 1 MP at the start of each of your turns (max +${PASSIVE_MP_CAP} per run).` },
  { id: 'hand', stat: 'handSize', amount: 1, rarity: 'rare', name: '+1 Hand Size', desc: 'Draw 1 more card each turn.' },
];

// Events: a scenario, plus choices the UI dispatches on by `kind`. The actual
// random rolls / run mutations live in run.ts so they stay testable.
export type EventChoiceKind =
  | 'addCardOffer'  // show a few card offers; player picks one to add (free)
  | 'removeCard'    // deck picker; remove the chosen card (costs CARD_REMOVAL_PRICE gold)
  | 'gambleGold'    // resolve a random gold outcome
  | 'safeGold'      // take the guaranteed payout instead of the flip
  | 'shrineCard'    // pick an eligible card; apply a random eligible modifier (free)
  | 'shrineParty'   // pick a member; apply a random stat boost (free)
  | 'cursedChest'   // +gold, but a RANDOM card leaves the deck (#19)
  | 'mercenary'     // pay gold; a RANDOM member gains +1 damage (#19)
  | 'duplicateCard' // deck picker; add an unupgraded copy of the chosen card (#19)
  | 'purgeRandom'   // free removal, but the well chooses the card (#19)
  | 'bloodAltar'    // pick a member: -2 max HP for +1 damage, permanent (#19)
  | 'shrineCurse'   // accept a random curse for gold (#22)
  | 'healInjury'    // pick a member: clear one death-scar, free (DR1)
  | 'leave';        // decline / move on

export interface EventChoiceDef {
  label: string;
  kind: EventChoiceKind;
  detail?: string; // outcome hint shown under the label
}
export interface EventDef {
  id: string;
  title: string;
  text: string;
  choices: EventChoiceDef[];
}

export const EVENT_CARD_OFFER_SIZE = 3;

// Curse economy (#22): what the Reliquary charges for a cursed offer, and what
// the Shrine pays for accepting a random one. Declared here (before EVENTS)
// because the Shrine's choice text quotes the payout.
export const CURSE_PRICE = 25;
export const CURSE_SHRINE_GOLD = 50;

// Events-expansion (#19) magnitudes. Duplication costs more than removal (20g)
// so copy/purge stay one coherent economy; the free Purge Well removal pays its
// discount in randomness (the well picks the card, not the player).
export const CURSED_CHEST_GOLD = 80;  // the chest's payout; a random card is the price
export const MERCENARY_PRICE = 45;    // hire fee for +1 damage on a random member
export const MERCENARY_DAMAGE = 1;
export const DUPLICATE_PRICE = 30;    // add an unupgraded copy of a chosen card
export const BLOOD_ALTAR_HP = 2;      // permanent max-HP price a member pays
export const BLOOD_ALTAR_DAMAGE = 1;  // permanent damage the altar grants
export const BLOOD_ALTAR_MIN_HP = 6;  // members at/below this max HP may not sacrifice

export const EVENTS: EventDef[] = [
  {
    id: 'apothecary',
    title: 'Traveling Apothecary',
    text: 'A cart of curios blocks the path. "Add to your repertoire, or shed what burdens you — no charge today."',
    choices: [
      { label: 'Buy a remedy', kind: 'addCardOffer', detail: 'Choose 1 of 3 cards to add (free).' },
      { label: 'Shed a burden', kind: 'removeCard', detail: `Remove a card from your deck (${CARD_REMOVAL_PRICE}g).` },
      { label: 'Move on', kind: 'leave' },
    ],
  },
  {
    id: 'casino',
    title: 'Casino Cart',
    text: 'A gambler flips a golden coin. "Care to test your luck, healer? No ante — but the coin bites."',
    choices: [
      { label: 'Flip the coin', kind: 'gambleGold', detail: '50% +75g · 25% +25g · 25% −25g.' },
      { label: 'Take the safe cut', kind: 'safeGold', detail: `Decline the flip for a guaranteed +${CASINO_SAFE_GOLD}g.` },
      { label: 'Walk away', kind: 'leave' },
    ],
  },
  {
    id: 'shrine',
    title: 'Forgotten Shrine',
    text: 'An old shrine to a forgotten god of mending hums with latent power. It will grant one boon — but chooses its own gift.',
    choices: [
      { label: 'Bless a card', kind: 'shrineCard', detail: 'Pick a card; it gains a random upgrade.' },
      { label: 'Bless a hero', kind: 'shrineParty', detail: 'Pick a member; they gain a random boost.' },
      { label: 'Accept a burden', kind: 'shrineCurse', detail: `Gain a random curse — and ${CURSE_SHRINE_GOLD}g for bearing it.` },
      { label: 'Leave', kind: 'leave' },
    ],
  },
  // --- events expansion (#19): five more, each a real decision ---------------
  {
    id: 'cursedChest',
    title: 'Cursed Chest',
    text: 'A gilded chest sits in the roots of a dead tree, humming softly. Gold glints through the seam — but so does something hungrier.',
    choices: [
      { label: 'Pry it open', kind: 'cursedChest', detail: `+${CURSED_CHEST_GOLD}g — but a random card leaves your deck.` },
      { label: 'Leave it buried', kind: 'leave' },
    ],
  },
  {
    id: 'mercenary',
    title: 'Wandering Mercenary',
    text: '"Your lot swing like farmhands," the sellsword laughs. "For coin, I\'ll drill one of them — my pick, not yours."',
    choices: [
      { label: 'Pay for drills', kind: 'mercenary', detail: `${MERCENARY_PRICE}g: a random member gains +${MERCENARY_DAMAGE} damage.` },
      { label: 'Decline', kind: 'leave' },
    ],
  },
  {
    id: 'duplicator',
    title: 'The Duplicator',
    text: 'A scribe with ink-stained fingers studies your deck. "Any page can be copied — the letters, not the gilding."',
    choices: [
      { label: 'Commission a copy', kind: 'duplicateCard', detail: `${DUPLICATE_PRICE}g: add an unupgraded copy of a chosen card.` },
      { label: 'Move on', kind: 'leave' },
    ],
  },
  {
    id: 'purgeWell',
    title: 'Purge Well',
    text: 'Black water swallows whatever is thrown in. The well keeps what it takes — and it is not picky, unless you pay it to be.',
    choices: [
      { label: 'Feed it a burden', kind: 'removeCard', detail: `Choose a card to remove (${CARD_REMOVAL_PRICE}g).` },
      { label: 'Let the well choose', kind: 'purgeRandom', detail: 'Free — a random card is removed.' },
      { label: 'Step away', kind: 'leave' },
    ],
  },
  {
    id: 'fieldHospital',
    title: 'Field Hospital',
    text: 'A tent of clean linen and boiling water. "Bring me your wounded, healer — I\'ll not charge a coin for mending what the road has broken. One soul, mind you; I\'ve others to see."',
    choices: [
      { label: 'Tend a hero', kind: 'healInjury', detail: 'Heal one lasting injury on a chosen member (free).' },
      { label: 'Move on', kind: 'leave' },
    ],
  },
  {
    id: 'bloodAltar',
    title: 'Blood Altar',
    text: 'The stone drinks. Old carvings promise strength for vitality — a bargain struck in the flesh, and never unstruck.',
    choices: [
      { label: 'Offer a hero\'s blood', kind: 'bloodAltar', detail: `Chosen member: −${BLOOD_ALTAR_HP} max HP, +${BLOOD_ALTAR_DAMAGE} damage (permanent).` },
      { label: 'Keep your blood', kind: 'leave' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Relics (issue 21, phase A): passive run-long items. Ten legible relics that
// need no rule-changing hooks — each is a constant tweak or a single trigger in
// the engine. All relic code is INERT when the run owns none (regression gate).
// ---------------------------------------------------------------------------

export type RelicId =
  | 'lantern'        // hidden attacks reveal their target
  | 'hagglersCharm'  // shop prices -15g (floor 5)
  | 'titheCandle'    // +1 MP when a member takes enemy-attack damage
  | 'fieldTriage'    // heals on members below 50% max HP heal +2
  | 'warDrum'        // after an Ability cast, that member's next auto doubles
  | 'groundingRod'   // aoe/sweep hits -1 (final number, floor 0, preview-visible)
  | 'prayerBeads'    // +3 MP on each draw-pile reshuffle
  | 'echoLocket'     // once/fight, the first Poison/Bolt Ability returns to hand
  | 'stormglass'     // once/fight, the first 6+ single-target hit is negated
  | 'vanguardsBanner'// members at full HP deal +1 on their auto
  // --- phase B (#22): rule-changers ------------------------------------------
  | 'aegisFont'      // direct-cast overheal converts to a Ward buffer (max 4)
  | 'firstLightTaper'// first card each turn costs 0 (cost <=2, non-engine); draw 1 fewer
  | 'duskChime'      // once/fight, a 6+ telegraph is delayed one turn
  | 'martyrsIcon'    // once/fight, a member death becomes survival at 1 HP
  // --- phase B (#22): curses (bought only, never in spoils, never forced) ---
  | 'pactOfSilence'  // you can no longer Rest; +1 passive MP each turn
  | 'crackedHourglass'// enrage on turn 8; Poison & Bolt +2 power
  | 'rustyCrown'     // all enemies +1 attack; fight wins pay +40g
  // --- small-party relics (#42): reward fielding fewer bodies ----------------
  | 'loneWolf'       // while fielding <=2, fielded members deal +2 damage
  | 'focusStone'     // while fielding <=2, +2 max MP (fewer bodies to heal)
  | 'warband'        // fielded members gain +3 max HP per empty deploy seat
  // --- card-type synergy relics (#63): read card type on play ----------------
  | 'reliquaryOfLight' // Holy cards heal +1
  | 'shadowSigil'      // after you play a Shadow card, deal +1 to the enemy
  | 'ironWard'         // the first Iron card each turn costs 1 less (min 0)
  // --- Iron mitigation web relics (#65): get paid for blocking well ----------
  | 'whetstone'        // members untouched last enemy phase deal +1 on their auto
  | 'bulwarkCore'      // a full Shield block leaves the member Braced
  // --- Regen conversions relics (#66): pay out when Regen ends / HP drops -----
  | 'deepRoots'        // a member's Regen ending (expired or consumed) leaves Brace 2
  | 'ossuaryBell'      // a member dropping below 50% max HP gains Regen 2 (every crossing)
  // --- Status-window management relics (#67): amplify / cash in the windows ---
  | 'venomGland'       // Poison you apply lasts +1 turn
  | 'embermark'        // whenever the enemy's Vulnerability expires, deal 4 (every expiry)
  // --- Blood + cycling relics (#68): pay off the reshuffle / hold the knife-edge ---
  | 'grimoireOfTurning'// every draw-pile reshuffle deals 3 to the enemy (no per-fight cap)
  | 'sanguinePact'     // curse: Blood-card HP costs +2; while any member < 50% HP, party autos +2
  // --- Holy overheal & board-state relics (#69): pay off a topped-off party -------
  | 'beaconOfSecondSun'// whenever a card heals a member to full, draw 1 (no per-fight cap)
  | 'twinCenser'       // single-target heal cards also heal the most wounded other member 1
  // --- Channel archetype rescue relic (#70): a channel keep-alive ----------------
  | 'chantersIdol'     // the first card you play each turn doesn't break your channel
  // --- Meta-layer / run-economy relics (#71): touch Rest, recovery, rewards ------
  | 'pilgrimsFlask'    // every Rest also heals all party members 1
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
export const HAGGLER_DISCOUNT = 15;
export const HAGGLER_FLOOR = 5;
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
// 1-point cap lands it at +7.1pp (N=1000), inside the ≤+9pp band. See sim/relic-exp.ts.
export const WARD_MAX = 1;             // Aegis Font's Ward buffer cap
export const TAPER_MAX_COST = 3;       // Taper only discounts cards this cheap
// Taper discount magnitude (#35). Under player-first ordering (#26) a FULL zeroing
// of the first card every turn compounded to +10.8pp — the strongest relic measured,
// out of the ≤+9pp band. A partial −2 discount keeps the per-turn relief (the whole
// value; once-per-fight measured ~0) but lands it at +8.8pp (N=1000). A −1 discount
// undershoots to +1.7pp; dropping TAPER_MAX_COST 3→2 measured *stronger* (fewer
// penalty firings). See sim/relic-exp.ts.
export const TAPER_DISCOUNT = 2;       // MP the first cheap non-engine card is reduced by
// Telegraphs totalling this much can be delayed once per run. Lowered 13→10 (#35):
// at 13 the once-per-run Chime drifted to +4.8pp, below a relic slot's opportunity
// cost; letting 10+ telegraphs qualify lifts it to +5.9pp (N=1000), still in band.
export const DUSK_CHIME_MIN = 10;      // telegraphs totalling this much can be delayed
// Pact of Silence's passive MP per turn. Held at 1 (#35): the standalone curse reads
// −23.9pp under player-first ordering, but the passive-MP lever swings ~±23pp PER
// POINT — +2 flips it to +23.2pp (a top relic, absurd for a curse). No integer buff
// lands it as a "mild curse", so it is priced as the hard trap it is; the sim policy
// already values every curse at 0 and never takes one. See sim/relic-exp.ts.
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
export const OSSUARY_REGEN = 1;          // Ossuary Bell: Regen granted each time a member crosses below the threshold
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
export const PILGRIM_FLASK_HEAL = 1;         // Pilgrim's Flask: HP healed to the most wounded living member on every Rest (scoped from all-members to fit the ≤+9pp gate; see engine skipTurn)
export const SURGEON_THREAD_HEAL_PCT = 0.5;  // Surgeon's Thread: between-fight recovery fraction while owned (vs HERO_HEAL_PCT)
export const BEGGARS_BOWL_GOLD = 20;         // Beggar's Bowl (curse): extra gold per won fight
export const BEGGARS_BOWL_REWARD_SIZE = 2;   // Beggar's Bowl (curse): card-reward offers rolled per won fight

export const RELICS: Record<RelicId, RelicDef> = {
  lantern: { id: 'lantern', name: 'Lantern of Foresight', rarity: 'common', icon: '🏮',
    desc: 'Hidden attacks reveal their target.' },
  hagglersCharm: { id: 'hagglersCharm', name: 'Haggler\'s Charm', rarity: 'common', icon: '🪙',
    desc: `All shop prices −${HAGGLER_DISCOUNT}g (never below ${HAGGLER_FLOOR}g).` },
  titheCandle: { id: 'titheCandle', name: 'Tithe Candle', rarity: 'uncommon', icon: '🕯',
    desc: `+${TITHE_CANDLE_MP} MP each time a member takes damage from an enemy attack.` },
  fieldTriage: { id: 'fieldTriage', name: 'Field Triage Kit', rarity: 'uncommon', icon: '🩹',
    desc: `Heals on a member below ${FIELD_TRIAGE_THRESHOLD * 100}% max HP heal +${FIELD_TRIAGE_BONUS}.` },
  warDrum: { id: 'warDrum', name: 'War Drum', rarity: 'uncommon', icon: '🥁',
    desc: 'After a member casts their Ability, their next auto-attack deals double.' },
  groundingRod: { id: 'groundingRod', name: 'Grounding Rod', rarity: 'common', icon: '⚡',
    desc: `Multi-target (AoE/sweep) hits deal ${GROUNDING_ROD_REDUCTION} less per hit.` },
  prayerBeads: { id: 'prayerBeads', name: 'Prayer Beads', rarity: 'common', icon: '📿',
    desc: `+${PRAYER_BEADS_MP} MP each time the draw pile is reshuffled.` },
  echoLocket: { id: 'echoLocket', name: 'Echo Locket', rarity: 'uncommon', icon: '🔮',
    desc: 'Once per fight, the first Poison or Bolt Ability returns to your hand.' },
  stormglass: { id: 'stormglass', name: 'Stormglass Mirror', rarity: 'uncommon', icon: '🪞',
    desc: `Once per fight, the first single-target hit of ${STORMGLASS_MIN_HIT}+ is negated.` },
  vanguardsBanner: { id: 'vanguardsBanner', name: 'Vanguard\'s Banner', rarity: 'rare', icon: '🚩',
    desc: `Members at full HP deal +${VANGUARD_BONUS} on their auto-attack.` },
  // --- phase B (#22): rule-changers ------------------------------------------
  aegisFont: { id: 'aegisFont', name: 'Aegis Font', rarity: 'rare', icon: '⛲',
    desc: `Overhealing from cast heals becomes a Ward that absorbs damage (max ${WARD_MAX}).` },
  firstLightTaper: { id: 'firstLightTaper', name: 'First-Light Taper', rarity: 'rare', icon: '🌅',
    desc: `Your first card each turn costs ${TAPER_DISCOUNT} less (min 0) if it costs ${TAPER_MAX_COST} or less (never engine cards); each turn it fires, draw 1 fewer card next turn.` },
  duskChime: { id: 'duskChime', name: 'Dusk Chime', rarity: 'rare', icon: '🔔',
    desc: `Once per RUN, an attack totalling ${DUSK_CHIME_MIN}+ damage is delayed one turn.` },
  martyrsIcon: { id: 'martyrsIcon', name: 'Martyr\'s Icon', rarity: 'rare', icon: '🕊',
    desc: 'Once per RUN, a member death becomes survival at 1 HP.' },
  // (Mending Totem retired with the 2026-07 injury rework — injuries are permanent.)
  // --- phase B (#22): curses -------------------------------------------------
  pactOfSilence: { id: 'pactOfSilence', name: 'Pact of Silence', rarity: 'rare', icon: '🤐', curse: true,
    desc: `CURSE — you can no longer Rest; gain +${PACT_PASSIVE_MP} MP at the start of each turn.` },
  crackedHourglass: { id: 'crackedHourglass', name: 'Cracked Hourglass', rarity: 'rare', icon: '⏳', curse: true,
    desc: `CURSE — enemies enrage on turn ${CRACKED_HOURGLASS_ENRAGE}; Poison and Bolt gain +${HOURGLASS_POWER_BONUS} power.` },
  rustyCrown: { id: 'rustyCrown', name: 'Rusty Crown', rarity: 'rare', icon: '👑', curse: true,
    desc: `CURSE — normal enemies attack +${RUSTY_CROWN_ATTACK} harder (bosses are proud enough); fight wins pay +${RUSTY_CROWN_GOLD}g.` },
  // --- small-party relics (#42): a build-around for fielding fewer bodies -------
  loneWolf: { id: 'loneWolf', name: 'Lone Wolf Totem', rarity: 'uncommon', icon: '🐺',
    desc: `While fielding ${SMALL_PARTY_MAX} or fewer members, each of them deals +${LONE_WOLF_DMG} damage.` },
  focusStone: { id: 'focusStone', name: 'Focus Stone', rarity: 'uncommon', icon: '🔷',
    desc: `While fielding ${SMALL_PARTY_MAX} or fewer members, +${FOCUS_STONE_MP} max MP (fewer bodies to tend).` },
  warband: { id: 'warband', name: 'Warband Standard', rarity: 'rare', icon: '⚔️',
    desc: `Fielded members gain +${WARBAND_HP_PER_SEAT} max HP for each empty deploy seat.` },
  // --- card-type synergy relics (#63) ----------------------------------------
  reliquaryOfLight: { id: 'reliquaryOfLight', name: 'Reliquary of Light', rarity: 'uncommon', icon: '✨',
    desc: `Holy cards heal +${HOLY_RELIC_HEAL}.` },
  shadowSigil: { id: 'shadowSigil', name: 'Shadow Sigil', rarity: 'uncommon', icon: '🌑',
    desc: `After you play a Shadow card, deal +${SHADOW_RELIC_DMG} to the enemy.` },
  ironWard: { id: 'ironWard', name: 'Iron Ward', rarity: 'uncommon', icon: '🛡',
    desc: `The first Iron card you play each turn costs ${IRON_RELIC_DISCOUNT} less (min 0).` },
  // --- Iron mitigation web relics (#65) --------------------------------------
  whetstone: { id: 'whetstone', name: 'Whetstone of the Patient', rarity: 'common', icon: '🪨',
    desc: `Members who took no damage during the last enemy phase deal +${WHETSTONE_BONUS} on their auto this turn.` },
  bulwarkCore: { id: 'bulwarkCore', name: 'Bulwark Core', rarity: 'rare', icon: '🧱',
    desc: `When a Shield fully blocks a hit, the member keeps Brace ${BRACE_AMOUNT} afterward.` },
  // --- Regen conversions relics (#66) ----------------------------------------
  deepRoots: { id: 'deepRoots', name: 'Deep Roots', rarity: 'uncommon', icon: '🌿',
    desc: `When a member's Regen ends — expired or consumed — they gain Brace ${BRACE_AMOUNT}.` },
  ossuaryBell: { id: 'ossuaryBell', name: 'Ossuary Bell', rarity: 'uncommon', icon: '🔔',
    desc: `Whenever a member drops below ${OSSUARY_THRESHOLD * 100}% max HP, they gain Regen ${OSSUARY_REGEN}.` },
  // --- Status-window management relics (#67) ---------------------------------
  venomGland: { id: 'venomGland', name: 'Venom Gland', rarity: 'uncommon', icon: '🦂',
    desc: `Poison you apply lasts +${VENOM_GLAND_BONUS_TURNS} turn.` },
  embermark: { id: 'embermark', name: 'Embermark', rarity: 'uncommon', icon: '🔥',
    desc: `Whenever the enemy's Vulnerability expires, deal ${EMBERMARK_DMG}.` },
  // --- Blood + cycling relics (#68) ------------------------------------------
  grimoireOfTurning: { id: 'grimoireOfTurning', name: 'Grimoire of Turning', rarity: 'uncommon', icon: '📖',
    desc: `Every time the draw pile reshuffles, deal ${GRIMOIRE_DMG} to the enemy.` },
  sanguinePact: { id: 'sanguinePact', name: 'Sanguine Pact', rarity: 'rare', icon: '🩸', curse: true,
    desc: `CURSE — Blood-card HP costs +${SANGUINE_PACT_SURCHARGE}; while any member is below ${SANGUINE_PACT_THRESHOLD * 100}% HP, the party's autos deal +${SANGUINE_PACT_AUTO_BONUS}.` },
  // --- Holy overheal & board-state relics (#69) ------------------------------
  beaconOfSecondSun: { id: 'beaconOfSecondSun', name: 'Beacon of the Second Sun', rarity: 'rare', icon: '🌅',
    desc: `Whenever a card heals a member to full, draw ${BEACON_DRAW}.` },
  twinCenser: { id: 'twinCenser', name: 'Twin Censer', rarity: 'rare', icon: '🪔',
    desc: `Single-target heal cards also heal the most wounded other member ${TWIN_CENSER_SPLASH}.` },
  // --- Channel archetype rescue relic (#70) ----------------------------------
  chantersIdol: { id: 'chantersIdol', name: "Chanter's Idol", rarity: 'rare', icon: '🎐',
    desc: 'The first card you play each turn does not break your channel.' },
  // --- Meta-layer / run-economy relics (#71) ---------------------------------
  pilgrimsFlask: { id: 'pilgrimsFlask', name: "Pilgrim's Flask", rarity: 'common', icon: '🍶',
    desc: `Every Rest also heals your most wounded member ${PILGRIM_FLASK_HEAL}.` },
  surgeonsThread: { id: 'surgeonsThread', name: "Surgeon's Thread", rarity: 'common', icon: '🧵',
    desc: `Between-fight recovery rises to ${SURGEON_THREAD_HEAL_PCT * 100}% of max HP (from ${HERO_HEAL_PCT * 100}%).` },
  beggarsBowl: { id: 'beggarsBowl', name: "Beggar's Bowl", rarity: 'rare', icon: '🥣', curse: true,
    desc: `CURSE — card rewards after a won fight offer ${BEGGARS_BOWL_REWARD_SIZE} choices instead of 3; +${BEGGARS_BOWL_GOLD}g per won fight.` },
};

export const RELIC_IDS: RelicId[] = Object.keys(RELICS) as RelicId[];

// Relic prices by rarity (C 50 / U 75 / R 100) — distinct from card prices.
export const RELIC_PRICE: Record<Rarity, number> = { common: 50, uncommon: 75, rare: 100 };

// Relics that counter the act-3 boss (the Devourer's Maw sweep + heavy singles
// and the post-transform race): the fight-6 spoils roll weights these ×2.
export const ACT3_COUNTER_RELICS: RelicId[] = ['groundingRod', 'stormglass', 'warDrum', 'vanguardsBanner'];

export const SPOILS_OFFER_SIZE = 3;      // relics offered on a spoils screen (pick 1, free)
export const CARD_REWARD_SIZE = 3;       // cards offered after every won fight (pick 1, free, #57)
export const RELIQUARY_STOCK = 3;        // relics stocked by a Reliquary visit
export const RELIQUARY_REMOVALS_MAX = 2; // card removals per Reliquary visit (at CARD_REMOVAL_PRICE)

// Shop offer shapes (a rolled storefront entry plus its gold price).
export interface CardOffer { cardId: CardId; rarity: Rarity; price: number; }
export interface RelicOffer { relicId: RelicId; rarity: Rarity; price: number; }
export interface ModifierOffer { modifier: ModifierId; rarity: Rarity; price: number; }
export interface PartyUpgradeOffer { def: PartyUpgradeDef; price: number; }
export interface HealerUpgradeOffer { def: HealerUpgradeDef; price: number; }

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
