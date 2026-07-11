// Tests for the pure gold-particle plan (#59). Run via: npm test.
import { planGoldFx, GOLD_FX_MAX_PARTICLES } from '../src/goldFx';

import { check, eq, finish } from './harness';

// --- under the cap: exactly one coin per gold --------------------------------
{
  const plan = planGoldFx(20, [{ slot: 0, gold: 12 }, { slot: 2, gold: 8 }]);
  eq('under cap: total coins == total gold', plan.total, 40);
  const player = plan.targets.find((t) => t.kind === 'player')!;
  eq('player coins == player gold', player.particles, 20);
  const m0 = plan.targets.find((t) => t.slot === 0)!;
  const m2 = plan.targets.find((t) => t.slot === 2)!;
  eq('member slot 0 coins == its salary', m0.particles, 12);
  eq('member slot 2 coins == its salary', m2.particles, 8);
  eq('one target per paid recipient', plan.targets.length, 3);
}

// --- zero gold yields no coins ------------------------------------------------
{
  const plan = planGoldFx(0, []);
  eq('no gold, no coins', plan.total, 0);
  eq('no gold, no targets', plan.targets.length, 0);
}

// --- unpaid targets (gold 0) are dropped -------------------------------------
{
  const plan = planGoldFx(15, [{ slot: 0, gold: 0 }, { slot: 1, gold: 6 }]);
  eq('zero-salary member is dropped', plan.targets.length, 2);
  check('only the paid member survives', plan.targets.some((t) => t.slot === 1) && !plan.targets.some((t) => t.slot === 0));
}

// --- over the cap: coins are capped, still proportional, floor of 1 ----------
{
  const plan = planGoldFx(500, [{ slot: 0, gold: 18 }, { slot: 1, gold: 15 }, { slot: 2, gold: 12 }]);
  check('over cap: total coins <= cap', plan.total <= GOLD_FX_MAX_PARTICLES, `${plan.total}`);
  check('over cap: total coins hits the budget', plan.total === GOLD_FX_MAX_PARTICLES, `${plan.total}`);
  check('every paid target keeps at least one coin', plan.targets.every((t) => t.particles >= 1));
  const player = plan.targets.find((t) => t.kind === 'player')!;
  const m0 = plan.targets.find((t) => t.slot === 0)!;
  check('the biggest share (player) gets the most coins', player.particles > m0.particles,
    `${player.particles} vs ${m0.particles}`);
  // gold amounts are preserved untouched (only the coin COUNT is scaled).
  eq('player gold preserved', player.particles > 0 && player.gold, 500);
}

// --- exactly at the cap stays exact ------------------------------------------
{
  const plan = planGoldFx(GOLD_FX_MAX_PARTICLES, []);
  eq('exactly-at-cap is exact', plan.total, GOLD_FX_MAX_PARTICLES);
}

finish();
