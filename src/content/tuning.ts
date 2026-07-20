// The full balance table content JSON can reference by name (#102).
//
// `data/tuning-table` covers `data/tuning.ts`, which is the leaf module and holds most
// magnitudes — but not all of them. Relic magnitudes live in `data/relics.ts`
// (VENOM_GLAND_BONUS_TURNS, OSSUARY_REGEN…) and run-economy numbers in `data/run.ts`
// (CURSED_CHEST_GOLD, MERCENARY_PRICE…). Content needs to address all three.
//
// WHY THE MERGE LIVES HERE AND NOT IN data/tuning-table. The constants barrel exports
// tuning-table SECOND, to keep it a leaf — at that point `data/relics` has not
// initialised, so merging there would read undefined values or throw on the TDZ. This
// module is reached only through `src/content/index.ts`, which the barrel exports LAST,
// so every data module is fully initialised by the time it runs.
import { TUNING as BASE } from '../data/tuning-table';
import * as RELIC_CONSTS from '../data/relics';
import * as RUN_CONSTS from '../data/run';

function numericExports(mod: object): Record<string, number> {
  return Object.fromEntries(
    Object.entries(mod as Record<string, unknown>)
      .filter((e): e is [string, number] => typeof e[1] === 'number'),
  );
}

/**
 * Every numeric constant addressable as {"tune": "KEY"}.
 *
 * Later sources win on a collision, but there are none today and a duplicate would be
 * a genuine bug — the same name meaning two numbers. `TUNING_COLLISIONS` names any,
 * and the validator reports them.
 */
const RELIC_NUMS = numericExports(RELIC_CONSTS);
const RUN_NUMS = numericExports(RUN_CONSTS);

export const TUNING_COLLISIONS: readonly string[] = Object.freeze(
  [...Object.keys(RELIC_NUMS), ...Object.keys(RUN_NUMS)]
    .filter((k, i, all) => (k in BASE) || all.indexOf(k) !== i)
    .sort(),
);

export const CONTENT_TUNING: Record<string, number> = Object.freeze({
  ...BASE, ...RELIC_NUMS, ...RUN_NUMS,
});

export const CONTENT_TUNING_KEYS: readonly string[] =
  Object.freeze(Object.keys(CONTENT_TUNING).sort());
