// Skill-tier profiles for the balance harness (2026-07-07 balance pass).
//
// The sim has always had ONE policy (policy.ts) — a deterministic "good player"
// measuring STICK. This module adds a skill knob so the same policy can be driven at
// four levels and balance can be judged across a skill gradient, not one point:
//
//   stick   — today's exact behavior, the pinned default (test/sim.test.ts). It never
//             touches the policy PRNG, so runs stay byte-identical.
//   optimal — the stick PLUS the lines it leaves on the table (Consume-aware poison and
//             the #61-64 Shadow / channel / count cards + synergy relics), no mistakes.
//   average — the stick's line with realistic imperfection: a per-turn chance to mute one
//             tactic (a missed cleanse / a late re-taunt / a reactive heal) + a greedier,
//             less selective shopper/drafter.
//   poor    — a thinned, offense-first tactic list with a high mistake rate + a buy-
//             anything shopper. Should wall at the first boss.
//
// DETERMINISM: the mistake roll uses a SEPARATE makeRng instance (a fixed salt off the
// fight seed), never game.rng, and is only drawn when mistakeProb > 0 — so stick/optimal
// advance no policy RNG and reproduce today's numbers exactly. policy.ts selects the
// tactic list and consults these knobs; nothing here imports the tactics (no cycle).

import { makeRng, type Rng } from '../src/rng';
import type { CardId, RelicId } from '../src/constants';

export type Tier = 'stick' | 'optimal' | 'average' | 'poor';

export interface SkillProfile {
  tier: Tier;
  mistakeProb: number;          // per-turn prob of muting one tactic slot (0 = perfect execution)
  shopBuyBar: number;           // min buy-value to purchase a card (stick = 2)
  shopMaxCards: number;         // cards bought per shop (stick = 2)
  strikerPriorityBonus: number; // draft striker-first weight (stick = 10)
  recruitCap: number;           // roster growth cap (stick = 6)
  // Per-card / per-relic buy-value overrides consulted BEFORE the base tables, so a tier
  // can value cards the stick treats as dead weight (the #61-64 Shadow/channel cards and
  // synergy relics). Empty for stick/average/poor → base tables → identical behavior.
  valueOverride: Partial<Record<CardId | RelicId, number>>;
}

// Salt so the policy PRNG is derived from — but independent of — the engine's fight seed.
const FIGHT_SALT = 0x501c_1de5 | 0;

// A fresh policy PRNG for a fight, seeded off the fight seed with a fixed salt so the
// whole matrix reproduces from the run seed and never collides with game.rng.
export function fightPolicyRng(fightSeed: number): Rng {
  return makeRng((fightSeed ^ FIGHT_SALT) >>> 0);
}

// MEASURED 2026-07-07: buying the #61-64 Shadow / channel / count cards is a ~15pp TRAP
// for this policy. Under HAND_SIZE 3 every non-ability card starves the ability-card draws
// the whole line is built on, and the Shadow payoff (Doom/Nightfall) rarely gets its
// Vulnerability set-up under MP scarcity — so a lean deck strictly beats a Shadow build.
// The optimal edge is therefore FLAWLESS execution of the lean good-player line PLUS
// Consume-awareness (not feeding the Devourer), not a bigger toolbox. So the optimal
// shopper stays as lean/selective as the stick and buys no Shadow cards. (Kept here,
// unused, as the record of what was tried and why it lost.)
const OPTIMAL_OVERRIDE: Partial<Record<CardId | RelicId, number>> = {};

// Small-party relics only pay off while fielding <= SMALL_PARTY_MAX; the balance-tiers
// harness folds these into the optimal override for the solo/duo cells only (a trio run
// would waste gold on inert relics). Exported so the harness can build size-specialized
// profiles cheaply.
// RELICS ONLY: valuing the small-party support CARDS (rally/focus/channel/holdTheLine) was
// a net loss — buying them dilutes the 3-card hand faster than they help (measured solo
// 8.7% -> 4.7%). The relics are pure passive power with no draw cost, so they help.
export const SMALL_PARTY_OVERRIDE: Partial<Record<CardId | RelicId, number>> = {
  loneWolf: 9, focusStone: 9, warband: 9,
};

export const STICK: SkillProfile = {
  tier: 'stick',
  mistakeProb: 0,
  shopBuyBar: 2,
  shopMaxCards: 2,
  strikerPriorityBonus: 10,
  recruitCap: 6,
  valueOverride: {},
};

export const OPTIMAL: SkillProfile = {
  tier: 'optimal',
  mistakeProb: 0,
  shopBuyBar: 2,
  shopMaxCards: 2,
  strikerPriorityBonus: 10,
  recruitCap: 6,
  valueOverride: OPTIMAL_OVERRIDE,
};

// Average = the good line, but an imperfect human: buys a bit too greedily (dilutes the
// 3-card hand's ability draws — a ~14pp self-inflicted wound) and fumbles a whole player
// phase ~12% of turns. Drafts less striker-first.
export const AVERAGE: SkillProfile = {
  tier: 'average',
  mistakeProb: 0.14,
  shopBuyBar: 1,
  shopMaxCards: 3,
  strikerPriorityBonus: 3,
  recruitCap: 6,
  valueOverride: {},
};

// Poor = a thinned offense-first tactic list (POOR_TACTICS: attacks before survival),
// buys everything (heavy dilution), and wastes a phase ~40% of turns. Walls at boss 1.
export const POOR: SkillProfile = {
  tier: 'poor',
  mistakeProb: 0.42,
  shopBuyBar: 0,
  shopMaxCards: 4,
  strikerPriorityBonus: 0,
  recruitCap: 6,
  valueOverride: {},
};

// Fold the small-party relic/card values into a profile (for the solo/duo harness cells).
export function withSmallParty(profile: SkillProfile): SkillProfile {
  return { ...profile, valueOverride: { ...profile.valueOverride, ...SMALL_PARTY_OVERRIDE } };
}
