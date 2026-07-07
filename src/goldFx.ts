// Pure, DOM-free planning for the end-of-fight gold particle burst (#59).
//
// Winning a fight pays a bounty: the player keeps the remainder after each
// deployed member is paid their salary. This module turns that split into a
// particle plan — roughly one coin per gold earned — that the GoldFx overlay
// then flies to its destinations (salary shares to each paid member card, the
// player's take to the topbar gold counter). Kept pure so the count/apportion
// math is unit-testable without a browser.

// Hard cap on the total number of coins spawned. A big boss payout would spray
// hundreds of nodes otherwise, so above this the per-target counts are scaled
// down PROPORTIONALLY — they are NOT an exact one-per-gold count past the cap.
export const GOLD_FX_MAX_PARTICLES = 60;

// One recipient of the bounty and how many coins fly to it.
export interface GoldTargetPlan {
  kind: 'player' | 'member';
  slot?: number;     // battle slot (0..2) for a member target; undefined for the player
  gold: number;      // gold this target actually receives
  particles: number; // coins to fly there (>=1 whenever gold > 0)
}

export interface GoldFxPlan {
  targets: GoldTargetPlan[];
  total: number; // total coins across every target
}

// One deployed member's salary share, keyed by their battle slot.
export interface MemberSalaryShare { slot: number; gold: number; }

// Build the coin plan from the reward split. Under the cap it is exact — one
// coin per gold. Over the cap the `GOLD_FX_MAX_PARTICLES` budget is apportioned
// by each target's gold share (largest-remainder), with a floor of one coin so
// every paid target still gets at least a single visible coin.
export function planGoldFx(playerGold: number, memberSalaries: MemberSalaryShare[]): GoldFxPlan {
  const raw: Omit<GoldTargetPlan, 'particles'>[] = [
    { kind: 'player' as const, slot: undefined, gold: playerGold },
    ...memberSalaries.map((m) => ({ kind: 'member' as const, slot: m.slot, gold: m.gold })),
  ].filter((t) => t.gold > 0);

  const totalGold = raw.reduce((s, t) => s + t.gold, 0);
  if (totalGold === 0) return { targets: [], total: 0 };

  const budget = Math.min(totalGold, GOLD_FX_MAX_PARTICLES);

  // Under the cap: one coin per gold, exactly.
  if (budget === totalGold) {
    const targets = raw.map((t) => ({ ...t, particles: t.gold }));
    return { targets, total: totalGold };
  }

  // Over the cap: largest-remainder apportionment of `budget` coins by gold
  // share, floored at 1 per target.
  const exact = raw.map((t) => (t.gold / totalGold) * budget);
  const counts = exact.map((e) => Math.max(1, Math.floor(e)));
  let used = counts.reduce((a, b) => a + b, 0);
  // Order targets by their fractional remainder, biggest first, to hand out (or
  // reclaim) the leftover coins in the fairest order.
  const order = raw.map((_, i) => i)
    .sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])));

  for (let i = 0; used < budget; i++) { counts[order[i % order.length]]++; used++; }
  // Reclaim if the floor-of-1 pushed us over budget (only when targets are many
  // and the budget small — never with real salaries, but keep it exact anyway).
  for (let i = 0; used > budget && i < order.length * 8; i++) {
    const idx = order[order.length - 1 - (i % order.length)];
    if (counts[idx] > 1) { counts[idx]--; used--; }
  }

  const targets = raw.map((t, i) => ({ ...t, particles: counts[i] }));
  return { targets, total: targets.reduce((s, t) => s + t.particles, 0) };
}
