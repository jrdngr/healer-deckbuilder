// Tests for the pure animation timeline builder. Run via: npm test.
import { buildTimeline, FX_DURATION, fxDuration, HITSTOP } from '../src/animations';
import type { GameEvent } from '../src/engine';

import { check, eq, finish } from './harness';

const fxTypes = (tl: ReturnType<typeof buildTimeline>): string[] =>
  tl.entries.flatMap((e) => (e.fx ?? []).map((f) => f.type));

// --- party attacks: each identity strikes with its own signature ------------
{
  const events: GameEvent[] = [
    { kind: 'partyAttack', slot: 0, memberId: 'ranger', amount: 3, enemyHp: 97 },
    { kind: 'partyAttack', slot: 1, memberId: 'tank', amount: 1, enemyHp: 96 },
    { kind: 'partyAttack', slot: 2, memberId: 'mage', amount: 5, enemyHp: 91 },
  ];
  const tl = buildTimeline(events);
  // ranger: a three-dart volley; tank: one heavy arc lob; mage: a beam.
  const projs = tl.entries.flatMap((e) => (e.fx ?? []).filter((f) => f.type === 'projectile'));
  eq('ranger volley + tank slam projectiles', projs.length, 4);
  eq('tank slam is an arc lob', projs.filter((p) => p.type === 'projectile' && p.variant === 'arc').length, 1);
  check('mage fires a beam', fxTypes(tl).includes('beam'));
  check('tank slam rakes a slash', fxTypes(tl).includes('slash'));
  const hpPatches = tl.entries.filter((e) => e.patch?.enemyHp != null).map((e) => e.patch!.enemyHp);
  check('enemy HP steps down across strikes',
    JSON.stringify(hpPatches) === JSON.stringify([97, 96, 91]), JSON.stringify(hpPatches));
  // strikes are staggered in time, not all at zero
  const times = tl.entries.filter((e) => e.fx?.some((f) => f.type === 'projectile')).map((e) => e.at);
  check('strikes are sequenced', times.every((a, i) => i === 0 || a > times[i - 1]), JSON.stringify(times));
  check('every member lunges', tl.entries.filter((e) => e.react?.some((r) => r.kind === 'lunge')).length === 3);
}

// --- every identity has a working signature ----------------------------------
{
  const ids = ['ranger', 'tank', 'mage', 'warlock', 'skald', 'berserker', 'sentinel', 'beastWarden'] as const;
  for (const memberId of ids) {
    const tl = buildTimeline([{ kind: 'partyAttack', slot: 1, memberId, amount: 4, enemyHp: 90 }]);
    check(`${memberId}: strike patches enemy HP`, tl.entries.some((e) => e.patch?.enemyHp === 90));
    check(`${memberId}: strike floats its damage`,
      tl.entries.some((e) => e.fx?.some((f) => f.type === 'float' && f.text.includes('4'))));
    check(`${memberId}: strike shakes on impact`, tl.entries.some((e) => (e.shake ?? 0) > 0));
  }
  // berserker crosses two slashes; graveAugur lobs an arc.
  const zerk = buildTimeline([{ kind: 'partyAttack', slot: 0, memberId: 'berserker', amount: 6, enemyHp: 80 }]);
  eq('berserker crosses two slashes', fxTypes(zerk).filter((t) => t === 'slash').length, 2);
}

// --- enemy attack geometries have distinct signatures -------------------------
{
  const twoTargets = (attackType: 'aoe' | 'sweep' | 'two'): GameEvent[] => [
    { kind: 'enemyAttack', slot: 0, amount: 3, hp: 7, result: 'hit', killed: false, hidden: false, attackType },
    { kind: 'enemyAttack', slot: 1, amount: 3, hp: 9, result: 'hit', killed: false, hidden: false, attackType },
  ];
  // AoE: one detonation, both targets struck at the same instant.
  const aoe = buildTimeline(twoTargets('aoe'));
  const aoeImpacts = aoe.entries.filter((e) => e.patch?.memberHp).map((e) => e.at);
  check('aoe strikes all targets at once', aoeImpacts.length === 2 && aoeImpacts[0] === aoeImpacts[1],
    JSON.stringify(aoeImpacts));
  check('aoe opens with a shockwave ring', aoe.entries[0].fx?.some((f) => f.type === 'ring') === true);
  // Sweep: a slash rakes each target, left to right.
  const sweep = buildTimeline(twoTargets('sweep'));
  eq('sweep slashes each target', fxTypes(sweep).filter((t) => t === 'slash').length, 2);
  const sweepImpacts = sweep.entries.filter((e) => e.patch?.memberHp).map((e) => e.at);
  check('sweep rakes in sequence', sweepImpacts[0] < sweepImpacts[1], JSON.stringify(sweepImpacts));
  // Heavy: a wind-up glow, then a big arc lob.
  const heavy = buildTimeline([
    { kind: 'enemyAttack', slot: 1, amount: 9, hp: 1, result: 'hit', killed: false, hidden: false, attackType: 'heavy' },
  ]);
  check('heavy winds up with a glow', heavy.entries[0].fx?.some((f) => f.type === 'glow') === true);
  check('heavy lobs an arc', heavy.entries.some((e) =>
    e.fx?.some((f) => f.type === 'projectile' && f.variant === 'arc')));
  const heavyShake = Math.max(...heavy.entries.map((e) => e.shake ?? 0));
  const plainShake = Math.max(...buildTimeline([
    { kind: 'enemyAttack', slot: 1, amount: 9, hp: 1, result: 'hit', killed: false, hidden: false, attackType: 'single' },
  ]).entries.map((e) => e.shake ?? 0));
  check('heavy shakes harder than a plain hit', heavyShake > plainShake, `${heavyShake} <= ${plainShake}`);
}

// --- heals are warm: rising motes, slow floats, big heals warm the board ------
{
  const tl = buildTimeline([{ kind: 'heal', slot: 1, amount: 7, hp: 12 }]);
  check('big heal tints the board', tl.entries.some((e) =>
    e.fx?.some((f) => f.type === 'vignette' && f.mode === 'tint')));
  check('heal motes rise', tl.entries.some((e) =>
    e.fx?.some((f) => f.type === 'burst' && f.mode === 'rise')));
  const small = buildTimeline([{ kind: 'heal', slot: 1, amount: 2, hp: 12 }]);
  check('small heal does not tint the board', !small.entries.some((e) =>
    e.fx?.some((f) => f.type === 'vignette')));
}

// --- big beats sweep banners ---------------------------------------------------
{
  const phase = buildTimeline([{ kind: 'enemyPhase' }]);
  check('enemy phase sweeps a banner', phase.entries.some((e) =>
    e.fx?.some((f) => f.type === 'banner' && f.text === 'ENEMY PHASE')));
  check('the phase stinger is quick (no long pause)', phase.paceEnd <= 400, `${phase.paceEnd}`);
  const beat = buildTimeline([{ kind: 'phaseChange', beat: 'IT MOLTS' }]);
  check('boss beats banner their name', beat.entries.some((e) =>
    e.fx?.some((f) => f.type === 'banner' && f.text === 'IT MOLTS')));
  const win = buildTimeline([{ kind: 'defeatEnemy' }]);
  check('victory flashes then banners', win.entries.some((e) =>
    e.fx?.some((f) => f.type === 'vignette' && f.mode === 'flash')) &&
    win.entries.some((e) => e.fx?.some((f) => f.type === 'banner')));
  const loss = buildTimeline([{ kind: 'wipe' }]);
  check('defeat banners the fall', loss.entries.some((e) =>
    e.fx?.some((f) => f.type === 'banner' && f.text === 'THE PARTY FALLS')));
}

// --- debuffs crumble downward instead of exploding -----------------------------
{
  const hex = buildTimeline([{ kind: 'wound', turns: 2, slots: [0, 1, 2] }]);
  check('hex crumbles down over the party', hex.entries.some((e) =>
    e.fx?.some((f) => f.type === 'burst' && f.mode === 'fall')));
  check('hex creeps in as a vignette', hex.entries.some((e) =>
    e.fx?.some((f) => f.type === 'vignette' && f.mode === 'tint')));
  const siphon = buildTimeline([{ kind: 'siphon', amount: 3, mp: 4 }]);
  check('siphon crumbles the mana', siphon.entries.some((e) =>
    e.fx?.some((f) => f.type === 'burst' && f.mode === 'fall')));
}

// --- a lethal enemy attack stages the death and shakes the screen -----------
{
  const events: GameEvent[] = [
    { kind: 'enemyAttack', slot: 2, amount: 4, hp: 0, result: 'hit', killed: true, hidden: false, attackType: 'single' },
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
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 12, result: 'shield', killed: false, hidden: false, attackType: 'single' },
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
    { kind: 'partyAttack', slot: 0, memberId: 'ranger', amount: 3, enemyHp: 97 },
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 8, result: 'hit', killed: false, hidden: false, attackType: 'single' },
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
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 8, result: 'hit', killed: false, hidden: false, attackType: 'single' },
  ];
  const kill: GameEvent[] = [
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 0, result: 'hit', killed: true, hidden: false, attackType: 'single' },
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
    { kind: 'partyAttack', slot: 0, memberId: 'ranger', amount: 3, enemyHp: 97 },
    { kind: 'enemyAttack', slot: 1, amount: 4, hp: 8, result: 'hit', killed: false, hidden: false, attackType: 'single' },
    { kind: 'enemyAttack', slot: 2, amount: 9, hp: 0, result: 'hit', killed: true, hidden: false, attackType: 'single' },
    { kind: 'enemyAttack', slot: 0, amount: 4, hp: 12, result: 'shield', killed: false, hidden: false, attackType: 'single' },
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
    [{ kind: 'enemyPhase' }],
    [{ kind: 'enrage' }],
    [{ kind: 'poisonTick', amount: 3, enemyHp: 90 }],
    [{ kind: 'regenTick', slot: 0, amount: 2, hp: 9 }],
    [{ kind: 'refreshTick', amount: 2, mp: 5 }],
    [{ kind: 'wound', turns: 2, slots: [0, 1, 2] }],
    [{ kind: 'siphon', amount: 3, mp: 2 }],
    [{ kind: 'consume', heal: 6, enemyHp: 80 }],
    [{ kind: 'phaseChange', beat: 'IT MOLTS' }],
    [{ kind: 'enemyAttack', slot: 0, amount: 5, hp: 5, result: 'hit', killed: false, hidden: true, attackType: 'hidden' }],
    [{ kind: 'partyAttack', slot: 1, memberId: 'tank', amount: 2, enemyHp: 88 }],
    [{ kind: 'heal', slot: 2, amount: 4, hp: 10 }],
    [{ kind: 'regenApplied', slot: 0, stack: 2 }],
    [{ kind: 'shieldApplied', slot: 1 }],
    [{ kind: 'defenseApplied', slot: 0, amount: 1 }],
    [{ kind: 'resurrect', slot: 1, hp: 4 }],
    [{ kind: 'refreshPrimed', stack: 2 }],
    [{ kind: 'draw', count: 2 }],
    [{ kind: 'lensArmed' }],
    [{ kind: 'martyrSave', slot: 1 }],
    [{ kind: 'hymn', bonus: 2, slots: [0, 1, 2] }],
    [{ kind: 'penance', slot: 0, bonus: 2, died: false, slots: [0, 1, 2] }],
    [{ kind: 'stun', slot: 1, intent: 'a heavy blow' }],
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
    // total must cover every effect's fade-out (honoring per-effect overrides).
    const covered = tl.entries.every((e) =>
      (e.fx ?? []).every((f) => e.at + fxDuration(f) <= tl.total));
    check(`${kind}: total covers all fades`, covered);
  }
}

// --- buff/debuff floats: a named label rises over each affected member (#79) --
{
  // Helper: every float label spawned over a given slot anchor.
  const floatsAt = (tl: ReturnType<typeof buildTimeline>, slot: 0 | 1 | 2): string[] =>
    tl.entries.flatMap((e) => (e.fx ?? []).filter(
      (f) => f.type === 'float' && f.at === slot).map((f) => (f as { text: string }).text));

  // A party-wide +ATK buff (Battle Hymn & kin) fans a `+N ATK` float over EACH
  // buffed member — not a single center banner.
  const hymn = buildTimeline([{ kind: 'hymn', bonus: 2, slots: [0, 1, 2] }]);
  const hymnFloats = hymn.entries.flatMap((e) => (e.fx ?? []).filter(
    (f) => f.type === 'float' && f.text === '+2 ATK'));
  eq('hymn floats +N ATK over every buffed member', hymnFloats.length, 3);
  check('hymn +ATK lands over slot 0', floatsAt(hymn, 0).includes('+2 ATK'));
  check('hymn +ATK lands over slot 1', floatsAt(hymn, 1).includes('+2 ATK'));
  check('hymn +ATK lands over slot 2', floatsAt(hymn, 2).includes('+2 ATK'));

  // Consecration only buffs the members at full HP — the float fans over just those.
  const conse = buildTimeline([{ kind: 'hymn', bonus: 3, slots: [0, 2] }]);
  const conseFloats = conse.entries.flatMap((e) => (e.fx ?? []).filter(
    (f) => f.type === 'float' && f.text === '+3 ATK'));
  eq('a partial buff floats only over its affected members', conseFloats.length, 2);
  check('the unaffected member gets no +ATK float', !floatsAt(conse, 1).includes('+3 ATK'));

  // Sharpen is a single-hero +ATK buff — exactly one float, over its target.
  const sharpen = buildTimeline([{ kind: 'hymn', bonus: 1, slots: [1] }]);
  eq('a single-hero +ATK buff floats once', sharpen.entries.flatMap(
    (e) => (e.fx ?? []).filter((f) => f.type === 'float' && f.text === '+1 ATK')).length, 1);

  // Feat of Strength fans +ATK over every living member; when the Strongman dies
  // paying it, a `GAVE IT ALL` label still marks his (now dead) slot.
  const pen = buildTimeline([{ kind: 'penance', slot: 0, bonus: 2, died: true, slots: [1, 2] }]);
  eq('penance floats +ATK over each living member', pen.entries.flatMap(
    (e) => (e.fx ?? []).filter((f) => f.type === 'float' && f.text === '+2 ATK')).length, 2);
  check('penance marks the paid slot when the Strongman dies', floatsAt(pen, 0).includes('GAVE IT ALL'));

  // Jinx (a member-side debuff) floats a `Jinx` label over each afflicted member.
  const hex = buildTimeline([{ kind: 'wound', turns: 2, slots: [0, 1, 2] }]);
  const hexFloats = hex.entries.flatMap((e) => (e.fx ?? []).filter(
    (f) => f.type === 'float' && f.text === 'Jinx'));
  eq('hex floats a debuff label over every afflicted member', hexFloats.length, 3);

  // Stun (Sentinel) now names itself with a float over the member.
  const stun = buildTimeline([{ kind: 'stun', slot: 2, intent: 'a heavy blow' }]);
  check('stun floats a label over its member', floatsAt(stun, 2).includes('STUN'));

  // Spot-check the per-member buff/debuff set the engine already emits still floats.
  const labelFor = (ev: GameEvent): string[] =>
    buildTimeline([ev]).entries.flatMap((e) => (e.fx ?? []).filter(
      (f) => f.type === 'float').map((f) => (f as { text: string }).text));
  check('shield floats a label', labelFor({ kind: 'shieldApplied', slot: 1 }).length > 0);
  check('defense floats a label', labelFor({ kind: 'defenseApplied', slot: 1, amount: 2 }).some((s) => s.includes('DEF')));
  check('taunt floats a label', labelFor({ kind: 'taunt', slot: 1, turns: 2 }).some((s) => s.includes('TAUNT')));
  check('regen floats a label', labelFor({ kind: 'regenApplied', slot: 1, stack: 2 }).length > 0);
  check('en garde floats a label', labelFor({ kind: 'enGarde', slot: 1, turns: 2 }).some((s) => s.includes('GARDE')));
  check('blood cost floats a number', labelFor({ kind: 'bloodPay', slot: 1, amount: 2, hp: 7 }).some((s) => s.includes('-2')));
}

finish();
