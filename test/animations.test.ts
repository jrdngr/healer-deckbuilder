// Tests for the pure animation timeline builder. Run via: npm test.
import { buildTimeline, FX_DURATION, FIRST_ENEMY_ATTACK_LEAD_IN } from '../src/animations';
import type { GameEvent } from '../src/engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}
function eq(name: string, a: unknown, b: unknown): void { check(name, a === b, `expected ${b}, got ${a}`); }

const fxTypes = (tl: ReturnType<typeof buildTimeline>): string[] =>
  tl.entries.flatMap((e) => (e.fx ?? []).map((f) => f.type));

// --- party attacks: a projectile + stepped enemy-HP patch per strike --------
{
  const events: GameEvent[] = [
    { kind: 'partyAttack', slot: 0, amount: 3, enemyHp: 97 },
    { kind: 'partyAttack', slot: 1, amount: 1, enemyHp: 96 },
    { kind: 'partyAttack', slot: 2, amount: 5, enemyHp: 91 },
  ];
  const tl = buildTimeline(events);
  eq('three projectiles', fxTypes(tl).filter((t) => t === 'projectile').length, 3);
  const hpPatches = tl.entries.filter((e) => e.patch?.enemyHp != null).map((e) => e.patch!.enemyHp);
  check('enemy HP steps down across strikes',
    JSON.stringify(hpPatches) === JSON.stringify([97, 96, 91]), JSON.stringify(hpPatches));
  // strikes are staggered in time, not all at zero
  const times = tl.entries.filter((e) => e.fx?.some((f) => f.type === 'projectile')).map((e) => e.at);
  check('strikes are sequenced', times[0] < times[1] && times[1] < times[2], JSON.stringify(times));
  check('total covers the last effect fade', tl.total >= times[2] + FX_DURATION.projectile);
}

// --- a lethal enemy attack stages the death and shakes the screen -----------
{
  const events: GameEvent[] = [
    { kind: 'enemyAttack', slot: 2, amount: 4, hp: 0, result: 'hit', killed: true, hidden: false },
  ];
  const tl = buildTimeline(events);
  check('death is staged in the view', tl.entries.some((e) => e.patch?.memberDead === 2));
  check('lethal hit shakes the screen', tl.entries.some((e) => (e.shake ?? 0) > 0));
  check('hit spawns a damage number',
    tl.entries.some((e) => e.fx?.some((f) => f.type === 'float' && f.text === '-4')));
}

// --- a blocked attack shows a shield, not a HP patch ------------------------
{
  const events: GameEvent[] = [
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 12, result: 'shield', killed: false, hidden: false },
  ];
  const tl = buildTimeline(events);
  check('shield effect present', fxTypes(tl).includes('shield'));
  check('blocked hit applies no HP change', !tl.entries.some((e) => e.patch?.memberHp));
}

// --- AoE heal cascades all members together, each with its own HP patch -----
{
  const events: GameEvent[] = [
    { kind: 'heal', slot: 0, amount: 3, hp: 8 },
    { kind: 'heal', slot: 1, amount: 3, hp: 12 },
    { kind: 'heal', slot: 2, amount: 3, hp: 6 },
  ];
  const tl = buildTimeline(events);
  const healPatches = tl.entries.filter((e) => e.patch?.memberHp).length;
  eq('one HP patch per healed member', healPatches, 3);
  check('heals float +N', tl.entries.some((e) => e.fx?.some((f) => f.type === 'float' && f.text === '+3')));
}

// --- bolt fires a beam and drops enemy HP -----------------------------------
{
  const events: GameEvent[] = [{ kind: 'bolt', slot: 2, amount: 7, enemyHp: 93 }];
  const tl = buildTimeline(events);
  check('bolt uses a beam', fxTypes(tl).includes('beam'));
  check('bolt patches enemy HP', tl.entries.some((e) => e.patch?.enemyHp === 93));
}

// --- resurrect brings a member back to life in the view ---------------------
{
  const events: GameEvent[] = [{ kind: 'resurrect', slot: 2, hp: 3 }];
  const tl = buildTimeline(events);
  check('resurrect revives in the view', tl.entries.some((e) => e.patch?.memberAlive === 2));
  check('resurrect raises a pillar', fxTypes(tl).includes('pillar'));
}

// --- enemy lead-in delays the first enemy attack, nothing else --------------
{
  const events: GameEvent[] = [
    { kind: 'partyAttack', slot: 0, amount: 3, enemyHp: 97 },
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 8, result: 'hit', killed: false, hidden: false },
    { kind: 'enemyAttack', slot: 0, amount: 4, hp: 4, result: 'hit', killed: false, hidden: false },
  ];
  const enemyProj = (tl: ReturnType<typeof buildTimeline>) =>
    tl.entries.filter((e) => e.fx?.some((f) => f.type === 'projectile' && f.from === 'enemy')).map((e) => e.at);
  const partyProj = (tl: ReturnType<typeof buildTimeline>) =>
    tl.entries.find((e) => e.fx?.some((f) => f.type === 'projectile' && f.to === 'enemy'))!.at;

  const base = buildTimeline(events);
  const led = buildTimeline(events, { enemyLeadIn: FIRST_ENEMY_ATTACK_LEAD_IN });

  check('party strike timing is untouched by the lead-in', partyProj(base) === partyProj(led));
  const [b0, b1] = enemyProj(base);
  const [l0, l1] = enemyProj(led);
  eq('first enemy attack is pushed back by the lead-in', l0 - b0, FIRST_ENEMY_ATTACK_LEAD_IN);
  eq('the lead-in applies only once', l1 - b1, FIRST_ENEMY_ATTACK_LEAD_IN);
  check('spacing between the two enemy attacks is preserved', l1 - l0 === b1 - b0);
  eq('total grows by exactly the lead-in', led.total - base.total, FIRST_ENEMY_ATTACK_LEAD_IN);
}

// --- with no enemy attack, the lead-in option is a no-op --------------------
{
  const events: GameEvent[] = [{ kind: 'heal', slot: 0, amount: 3, hp: 8 }];
  const base = buildTimeline(events);
  const led = buildTimeline(events, { enemyLeadIn: FIRST_ENEMY_ATTACK_LEAD_IN });
  eq('lead-in does nothing without an enemy attack', led.total, base.total);
}

// --- empty feed yields an empty, zero-length timeline -----------------------
{
  const tl = buildTimeline([]);
  eq('no entries', tl.entries.length, 0);
  eq('zero total', tl.total, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
