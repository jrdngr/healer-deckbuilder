// Agreement test for the TUNING lookup record (#100).
//
// Content JSON references balance numbers by name — {"tune": "POISON_BASE"} — so the
// record MUST stay in lockstep with the named exports. The record is derived
// automatically rather than hand-maintained, and this test is what proves the
// derivation is total: every numeric export appears under its own name with an
// identical value, and nothing appears that is not a real export.
import * as T from '../../src/data/tuning';
import { TUNING, TUNING_KEYS } from '../../src/constants';
import { check, eq, finish } from '../harness';

const numericExports = Object.entries(T as Record<string, unknown>)
  .filter((e): e is [string, number] => typeof e[1] === 'number');

{
  check('tuning.ts actually exports a lot of numbers', numericExports.length > 150);
  eq('TUNING holds exactly the numeric exports', Object.keys(TUNING).length, numericExports.length);
}
{ // every numeric export is present, under its own name, with the same value
  let missing = 0, wrong = 0;
  for (const [name, value] of numericExports) {
    if (!(name in TUNING)) { missing += 1; console.error(`  missing from TUNING: ${name}`); continue; }
    if (TUNING[name] !== value) {
      wrong += 1;
      console.error(`  TUNING.${name} = ${TUNING[name]}, tuning.ts = ${value}`);
    }
  }
  eq('no numeric export is missing from TUNING', missing, 0);
  eq('no TUNING value disagrees with its export', wrong, 0);
}
{ // and nothing is invented
  let extra = 0;
  const real = new Set(numericExports.map(([n]) => n));
  for (const name of Object.keys(TUNING)) {
    if (!real.has(name)) { extra += 1; console.error(`  TUNING has no matching export: ${name}`); }
  }
  eq('TUNING invents nothing', extra, 0);
}
{ // non-numeric exports are deliberately excluded — an amount expression resolving to
  // an array or a record would be a type error waiting to happen
  check('the SLOT record is not addressable as a tuning key', !('SLOT' in TUNING));
  check('the HEX_VULN_BY_SIZE array is not addressable as a tuning key',
    !('HEX_VULN_BY_SIZE' in TUNING));
  check('a real scalar IS addressable', TUNING.POISON_BASE === T.POISON_BASE);
}
{ // spot-check a few by hand so a wholesale derivation bug cannot pass silently
  eq('POISON_BASE', TUNING.POISON_BASE, T.POISON_BASE);
  eq('BOLT_BASE', TUNING.BOLT_BASE, T.BOLT_BASE);
  eq('SHIELD_TURNS', TUNING.SHIELD_TURNS, T.SHIELD_TURNS);
  eq('TRANSFUSION_HEAL', TUNING.TRANSFUSION_HEAL, T.TRANSFUSION_HEAL);
  eq('SAP_VULN_PER_TICK carries its fractional value', TUNING.SAP_VULN_PER_TICK, 0.25);
}
{ // the key corpus the validator's suggestions search
  eq('TUNING_KEYS covers every key', TUNING_KEYS.length, Object.keys(TUNING).length);
  const sorted = [...TUNING_KEYS].sort();
  check('TUNING_KEYS is sorted', TUNING_KEYS.every((k, i) => k === sorted[i]));
}
{ // the record is frozen — content must not be able to rewrite balance at runtime
  const before = TUNING.POISON_BASE;
  try { (TUNING as Record<string, number>).POISON_BASE = 999; } catch { /* strict mode throws */ }
  eq('TUNING is immutable', TUNING.POISON_BASE, before);
}

finish('content/tuning-table');
