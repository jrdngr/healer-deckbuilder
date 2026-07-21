import type { MemberId, MemberDef } from './tuning';
import MEMBER_JSON from '../content/members.json';
import type { PartyMemberConfig } from './run';
import {
  BERSERKER_BAND_BONUS, BOLT_CHARGE_MULT, CHARGE_MAX, DARK_BARGAIN_DMG, DARK_BARGAIN_POWER, FERAL_BOND_MULT, GRUDGE_DIVISOR, TOXICOLOGIST_BONUS
} from './tuning';

export const MEMBER_DEFS: MemberDef[] = [
  { slot: 0, id: 'ranger', name: 'Ranger', maxHP: 11, damage: 4, ability: 'poison' },
  { slot: 1, id: 'tank', name: 'Tank', maxHP: 18, damage: 2, ability: 'taunt' },
  { slot: 2, id: 'mage', name: 'Mage', maxHP: 9, damage: 5, ability: 'bolt' },
];

// Per-member identity keyed by id. The fixed demo trio is laid out by MEMBER_DEFS
// (slot order); MEMBER_POOL is the data-driven source the post-demo roster and
// draft (#27-#31) extend so any member can occupy any slot and carry any ability.
// #106: hero definitions are read from members.json.
export const MEMBER_POOL: Record<MemberId, MemberDef> = Object.freeze(
  Object.fromEntries(Object.entries(MEMBER_JSON).map(([id, raw]) => {
    const m = raw as unknown as Record<string, unknown>;
    return [id, { slot: m.slot, id, name: m.name, maxHP: m.maxHP, damage: m.damage, ability: m.ability } as MemberDef];
  })),
) as Record<MemberId, MemberDef>;

// Build a party config from an ordered list of member ids (slot = list index).
// Fresh members carry no injuries and the pool's base stats. Used by the draft
// (#27 skeleton, #30 full) to seat arbitrary compositions.
export function partyFromMembers(ids: MemberId[]): PartyMemberConfig[] {
  return ids.map((id): PartyMemberConfig => {
    const d = MEMBER_POOL[id];
    return { maxHP: d.maxHP, hp: d.maxHP, damage: d.damage, abilityPower: 0, injuries: 0, upgrades: 0, member: id, learned: [] };
  });
}

// The classic demo trio, as a member-id list (Ranger / Tank / Mage). The draft
// pre-selects this so returning players lose nothing (#30).
export const CLASSIC_TRIO: MemberId[] = ['ranger', 'tank', 'mage'];

// A drafted party seats this many members (one per slot).
export const PARTY_SIZE = 3;
// Hard cap on the roster (2026-07): the player may own at most this many heroes at
// once — there is no bench beyond the fielded three. Recruiting at a full roster
// REPLACES a member (the dismissed hero returns to the recruit pool) rather than growing
// it. Deploy already tops out at 3 slots, so this simply removes the reserve.
export const ROSTER_CAP = 3;
// The pool the draft (#27 skeleton, #30 full) picks from — every hero in members.json.
// Adding a hero to the JSON adds them to the draft; there is no second list to update.
//
// SORTED, for the same reason CARD_POOL is: Run._rollMemberOffer does
// `shuffle([...pool], rng)`, so the pool's ARRAY ORDER decides which heroes a given seed
// offers. Sorting decouples that from members.json's key order, so the file can be
// organised however reads best without silently changing every draft.
export const DRAFT_POOL: MemberId[] = Object.keys(MEMBER_JSON).sort();

// ---------------------------------------------------------------------------
// Full draft (#30): three 1-of-2 picks from the pool of 8, then L/C/R assignment.
// The generator guarantees a viable party is achievable so a bad roll can't hand
// the player a dead run; taunt-less drafts are intended variance, not a failure.
// ---------------------------------------------------------------------------

// Conservative damage rating per member (the review's numbers), used only by the
// draft generator's viability check — NOT the in-fight damage (that is on the pool).
// Read from each hero's `draftRating` in members.json.
export const DRAFT_RATING: Record<MemberId, number> = Object.freeze(
  Object.fromEntries(Object.entries(MEMBER_JSON)
    .map(([id, raw]) => [id, (raw as { draftRating: number }).draftRating])),
) as Record<MemberId, number>;

// Members healing works "conventionally" on (`conventionallyHealable` in members.json).
// The Warlock burns himself regardless and the Berserker wants to STAY low (healing him
// is friendly fire), so neither counts toward the healable floor.
export const CONVENTIONALLY_HEALABLE: Set<MemberId> = new Set<MemberId>(
  Object.entries(MEMBER_JSON)
    .filter(([, raw]) => (raw as { conventionallyHealable?: boolean }).conventionallyHealable)
    .map(([id]) => id),
);

export const DRAFT_PICKS = 3;             // number of 1-of-2 picks (one per slot)
export const DRAFT_MIN_DAMAGE = 8;        // a viable party's conservative damage floor
export const DRAFT_STRONG_DAMAGE = 4;     // "one member >= 4" — a real damage threat
export const DRAFT_MIN_HEALABLE = 2;      // a viable party needs >= 2 conventionally-healable members

// The members that deal reliable, self-sufficient damage (the #31 sweep showed a
// comp with NO conventional striker floors out — the Skald/Warden/Berserker need
// support the fixed policy can't always give). A viable draft needs at least one.
// `conventionalStriker` in members.json.
export const CONVENTIONAL_STRIKERS: Set<MemberId> = new Set<MemberId>(
  Object.entries(MEMBER_JSON)
    .filter(([, raw]) => (raw as { conventionalStriker?: boolean }).conventionalStriker)
    .map(([id]) => id),
);

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
//
// Stays in TypeScript deliberately, unlike the per-hero draft data that moved to
// members.json: this is a PAIRING chosen to be viable together, not a fact about any
// one hero, so there is no member entry it belongs on. Adding a hero does not require
// touching it — the fallback only has to remain viable, which coverage.test.ts pins.
export const DRAFT_FALLBACK_PAIRS: MemberId[][] = [
  ['ranger', 'warlock'], ['tank', 'berserker'], ['mage', 'skald'],
];


// Hero passive flavor: the always-on identity every hero carries (`cf5fc4d`). Names
// ship verbatim from the engine comments (#89 — no #85 rename); each `desc` is derived
// from the actual implementation in `engine/core.ts`, interpolating the tuning constants
// so the text never drifts from the numbers. One entry per hero — the record is total.
// Passive flavour text likewise — it is hero content, not presentation code.
export const MEMBER_PASSIVE_FLAVOR: Record<string, { name: string; desc: string }> = Object.freeze(
  Object.fromEntries(Object.entries(MEMBER_JSON)
    .filter(([, raw]) => (raw as { passiveFlavor?: unknown }).passiveFlavor !== undefined)
    .map(([id, raw]) => [id, (raw as { passiveFlavor: { name: string; desc: string } }).passiveFlavor])),
);

// The MemberDef that actually sits in a party slot: the drafted member's identity
// if one was drafted (#27), else the classic-trio def for that slot. Every run-layer
// screen must resolve names/abilities/flavor through this — reading MEMBER_DEFS[slot]
// directly shows classic-trio names for a drafted party (the #36 bug).
export function memberDefAt(party: PartyMemberConfig[], slot: number): MemberDef {
  const m = party[slot]?.member;
  return (m && MEMBER_POOL[m]) || MEMBER_DEFS[slot];
}
