import type { MemberId, MemberDef } from './tuning';
import type { PartyMemberConfig } from './run';
import {
  BERSERKER_BAND_BONUS, BOAR_HP, BOAR_STRIKE_BONUS, BOAR_TURNS, BOLT_BASE, BOLT_CHARGE_MULT, CRESCENDO_DRAW, DEFENSE_AMOUNT, EN_GARDE_TURNS, FERMENT_GROWTH, FERMENT_TURNS, GRAVE_CHILL_REDUCTION, HEX_TURNS, HEX_VULN_BY_SIZE, PENANCE_HP, PENANCE_STRIKE_BONUS, POISON_BASE, POISON_TURNS, RADIANCE_HEAL, RAMPAGE_SELF_DMG, SKALD_DMG_CAP, SKALD_DMG_PER_CARD, TAUNT_TURNS
} from './tuning';

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


// Member ability flavor + slot lookup (moved from the old middle region).
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
