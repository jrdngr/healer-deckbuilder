// Tests for the pure animation timeline builder. Run via: npm test.
import { buildTimeline, FX_DURATION, HITSTOP } from '../src/animations';
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

// --- input resumes at the pacing end, before the cosmetic fade-out ----------
{
  const events: GameEvent[] = [
    { kind: 'partyAttack', slot: 0, amount: 3, enemyHp: 97 },
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 8, result: 'hit', killed: false, hidden: false },
  ];
  const tl = buildTimeline(events);
  check('input resumes before the full fade-out', tl.paceEnd < tl.total);
  // Every display patch must land by the pacing end, so HP is current on unlock.
  const lastPatchAt = Math.max(...tl.entries.filter((e) => e.patch).map((e) => e.at));
  check('all HP patches land by the pacing end', lastPatchAt <= tl.paceEnd, `${lastPatchAt} > ${tl.paceEnd}`);
}

// --- empty feed yields an empty, zero-length timeline -----------------------
{
  const tl = buildTimeline([]);
  eq('no entries', tl.entries.length, 0);
  eq('zero total', tl.total, 0);
  eq('zero paceEnd', tl.paceEnd, 0);
}

// --- every FX type has a positive duration -----------------------------------
{
  for (const [type, ms] of Object.entries(FX_DURATION)) {
    check(`FX_DURATION.${type} > 0`, ms > 0, `${ms}`);
  }
}

// --- hitstop: a kill stops the world for a beat ------------------------------
{
  const hit: GameEvent[] = [
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 8, result: 'hit', killed: false, hidden: false },
  ];
  const kill: GameEvent[] = [
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 0, result: 'hit', killed: true, hidden: false },
  ];
  const tlHit = buildTimeline(hit);
  const tlKill = buildTimeline(kill);
  // Kill pacing = hitstop + a longer settle (520 vs 360): 160 + HITSTOP apart.
  eq('kill pacing exceeds a plain hit by the hitstop + settle',
    tlKill.paceEnd - tlHit.paceEnd, HITSTOP + 160);
  // The blow lands at impact; the damage number waits out the stop.
  const burstAt = tlKill.entries.find((e) => e.fx?.some((f) => f.type === 'burst'))!.at;
  const floatAt = tlKill.entries.find((e) => e.fx?.some((f) => f.type === 'float'))!.at;
  eq('damage float is delayed by the hitstop', floatAt - burstAt, HITSTOP);
  // Bolt gets the same treatment.
  const tlBolt = buildTimeline([{ kind: 'bolt', slot: 2, amount: 7, enemyHp: 93 }]);
  const boltImpact = tlBolt.entries.find((e) => e.patch?.enemyHp === 93)!.at;
  const boltFloat = tlBolt.entries.find((e) => e.fx?.some((f) => f.type === 'float'))!.at;
  eq('bolt float is delayed by the hitstop', boltFloat - boltImpact, HITSTOP);
}

// --- member reactions ride the timeline --------------------------------------
{
  const events: GameEvent[] = [
    { kind: 'partyAttack', slot: 0, amount: 3, enemyHp: 97 },
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 8, result: 'hit', killed: false, hidden: false },
    { kind: 'enemyAttack', slot: 2, amount: 9, hp: 0, result: 'hit', killed: true, hidden: false },
    { kind: 'enemyAttack', slot: 0, amount: 4, hp: 12, result: 'shield', killed: false, hidden: false },
    { kind: 'heal', slot: 1, amount: 3, hp: 11 },
  ];
  const tl = buildTimeline(events);
  const reactsOf = (kind: string) =>
    tl.entries.filter((e) => e.react?.some((r) => r.kind === kind));
  check('party attack lunges at launch',
    reactsOf('lunge').length === 1 && reactsOf('lunge')[0].at === 0);
  check('a hit recoils the target', reactsOf('hit').some((e) => e.react![0].slot === 1));
  check('a kill collapses the target', reactsOf('death').some((e) => e.react![0].slot === 2));
  check('a block braces the target', reactsOf('block').some((e) => e.react![0].slot === 0));
  check('a heal pulses the target', reactsOf('heal').some((e) => e.react![0].slot === 1));
  // The lethal reaction lands at impact (with the blow), not at launch.
  const death = reactsOf('death')[0];
  const deathBurst = tl.entries.find((e) => e.at === death.at && e.fx?.some((f) => f.type === 'burst'));
  check('death reaction lands with the impact burst', deathBurst != null);
}

// --- blanket invariants across every event kind -------------------------------
{
  const samples: GameEvent[][] = [
    [{ kind: 'enrage' }],
    [{ kind: 'poisonTick', amount: 3, enemyHp: 90 }],
    [{ kind: 'regenTick', slot: 0, amount: 2, hp: 9 }],
    [{ kind: 'refreshTick', amount: 2, mp: 5 }],
    [{ kind: 'wound', turns: 2 }],
    [{ kind: 'siphon', amount: 3, mp: 2 }],
    [{ kind: 'consume', heal: 6, enemyHp: 80 }],
    [{ kind: 'phaseChange', beat: 'IT MOLTS' }],
    [{ kind: 'enemyAttack', slot: 0, amount: 5, hp: 5, result: 'hit', killed: false, hidden: true }],
    [{ kind: 'partyAttack', slot: 1, amount: 2, enemyHp: 88 }],
    [{ kind: 'heal', slot: 2, amount: 4, hp: 10 }],
    [{ kind: 'regenApplied', slot: 0, stack: 2 }],
    [{ kind: 'shieldApplied', slot: 1 }],
    [{ kind: 'defenseApplied', slot: 0, amount: 1 }],
    [{ kind: 'braceApplied', slot: 2 }],
    [{ kind: 'resurrect', slot: 1, hp: 4 }],
    [{ kind: 'refreshPrimed', stack: 2 }],
    [{ kind: 'draw', count: 2 }],
    [{ kind: 'surge' }],
    [{ kind: 'wardApplied', slot: 0, amount: 3 }],
    [{ kind: 'chime' }],
    [{ kind: 'martyrSave', slot: 1 }],
    [{ kind: 'hymn', bonus: 2 }],
    [{ kind: 'bloodPay', slot: 0, amount: 2, hp: 7 }],
    [{ kind: 'cleanse', slot: 1 }],
    [{ kind: 'rest', amount: 3, mp: 6 }],
    [{ kind: 'poisonApplied', slot: 0, amount: 2, poison: 4 }],
    [{ kind: 'taunt', slot: 1, turns: 2 }],
    [{ kind: 'bolt', slot: 2, amount: 7, enemyHp: 70 }],
    [{ kind: 'graveChill', slot: 0, amount: 2 }],
    [{ kind: 'boarSummon', slot: 1, hp: 10, turns: 2 }],
    [{ kind: 'boarHit', slot: 1, amount: 5, boarHp: 5, killed: false }],
    [{ kind: 'boarExpire', slot: 1 }],
    [{ kind: 'defeatEnemy' }],
    [{ kind: 'wipe' }],
  ];
  for (const events of samples) {
    const kind = events[0].kind;
    const tl = buildTimeline(events);
    const ats = tl.entries.map((e) => e.at);
    check(`${kind}: entries start at t>=0`, ats.every((a) => a >= 0));
    check(`${kind}: entries are ordered`, ats.every((a, i) => i === 0 || a >= ats[i - 1]));
    check(`${kind}: paceEnd <= total`, tl.paceEnd <= tl.total);
    const patchAts = tl.entries.filter((e) => e.patch).map((e) => e.at);
    check(`${kind}: patches land by paceEnd`, patchAts.every((a) => a <= tl.paceEnd));
    // total must cover every effect's fade-out.
    const covered = tl.entries.every((e) =>
      (e.fx ?? []).every((f) => e.at + FX_DURATION[f.type] <= tl.total));
    check(`${kind}: total covers all fades`, covered);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
