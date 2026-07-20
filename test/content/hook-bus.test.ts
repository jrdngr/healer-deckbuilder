// Tests for the hook BUS itself (#103) — the machinery, not the content.
//
// The relic and passive suites (#99's A7/A8) pin what each individual hook DOES. This file
// pins the properties of the dispatcher they all share, because a bug there is invisible
// in any single relic's test and wrong in all of them at once:
//
//   - compilation: the index is built once and a hook name with no owner is a Map miss;
//   - ownership: a member-owned hook fires for its own hero and nobody else;
//   - purity: a value hook on a preview-feeding seam cannot act;
//   - consumption ordering: when two vetoes could save one death, exactly one is spent,
//     and it is the right one.
import { Game } from '../../src/engine';
import type { MemberId, PartyMemberConfig } from '../../src/constants';
import { SLOT, defaultBattleConfig, partyFromMembers } from '../../src/constants';
import { compileHooks } from '../../src/content/hooks';
import { check, eq, finish, capture } from '../harness';

const seat = (id: MemberId | null): PartyMemberConfig =>
  id ? partyFromMembers([id])[0]
    : { maxHP: 1, hp: 1, damage: 0, abilityPower: 0, injuries: 0, upgrades: 0, empty: true };

function game(party: (MemberId | null)[], relics: string[] = [], seed = 5): Game {
  const cfg = defaultBattleConfig();
  const padded: (MemberId | null)[] = [...party];
  while (padded.length < 3) padded.push(null);
  cfg.party = padded.map(seat);
  cfg.relics = relics as never;
  const g = new Game(seed, cfg);
  g.start();
  for (const m of g.members) if (m.alive) m.hp = m.maxHP;
  g.mp = 20;
  g.enemy.hp = 400;
  return g;
}

// --- compilation ------------------------------------------------------------
{
  const empty = compileHooks([]);
  eq('an empty owner list compiles to an empty value map', empty.value.size, 0);
  eq('an empty owner list compiles to an empty event map', empty.event.size, 0);

  const idx = compileHooks([
    { owner: 'a', hooks: { modifyMemberDamage: { add: 1 } } },
    { owner: 'b', hooks: { modifyMemberDamage: { add: 2 } } },
    { owner: 'c', hooks: { onTurnStart: [{ op: 'draw', count: 1 }] } },
  ]);
  eq('two owners of one value hook land in one bucket', idx.value.get('modifyMemberDamage')?.length, 2);
  eq('an event hook lands in the event map', idx.event.get('onTurnStart')?.length, 1);
  // The whole performance argument for the index rests on this: an unowned hook name is
  // a Map miss, not a walk.
  eq('an unowned hook name is absent, not empty', idx.value.get('modifyHealAmount'), undefined);

  const owned = compileHooks([{ owner: 'tank', ownerSlot: SLOT.CENTER, hooks: { ripostes: { answer: true } } }]);
  eq('a member hook records its slot', owned.value.get('ripostes')?.[0].ownerSlot, SLOT.CENTER);
  eq('a relic hook records no slot', idx.value.get('modifyMemberDamage')?.[0].ownerSlot, undefined);
}

// --- ownership: a passive is its hero's alone -------------------------------
{
  // The Ranger's Toxicologist is +damage vs a poisoned enemy. It must lift HER auto and
  // nobody else's — the property that `ownerSlot` replaced `m.id === 'ranger'` to keep.
  const g = game(['ranger', 'tank', 'mage']);
  const ranger = g.members[SLOT.LEFT];
  const tank = g.members[SLOT.CENTER];
  const rangerClean = g.memberDamage(ranger);
  const tankClean = g.memberDamage(tank);
  g.enemy.poison = 3;
  check('the poisoned enemy lifts the Ranger\'s auto', g.memberDamage(ranger) > rangerClean);
  eq('it does not lift anyone else\'s', g.memberDamage(tank), tankClean);
}
{
  // And a party without the Ranger gets nothing from it at all.
  const g = game(['duelist', 'tank', 'mage']);
  const before = g.members.map((m) => g.memberDamage(m));
  g.enemy.poison = 3;
  eq('with no Ranger fielded the hook is inert',
    g.members.map((m) => g.memberDamage(m)).join(','), before.join(','));
}

// --- purity: the telegraph preview must equal the damage applied ------------
{
  // memberDamage feeds attackTargets()'s preview. Reading it must never change state, or
  // the preview and the applied damage diverge. Read it many times and assert the world
  // is untouched — the structural guarantee is that _hookValue has no consuming path, and
  // this is the observable form of it.
  const g = game(['ranger', 'tank', 'mage'], ['vanguardsBanner', 'loneWolf']);
  const snapshot = () => JSON.stringify(g.members.map((m) => ({
    hp: m.hp, charge: m.charge, banked: m.bankedDamage, regen: m.regen, primed: m.drumPrimed,
  })));
  const before = snapshot();
  const first = g.members.map((m) => g.memberDamage(m)).join(',');
  for (let i = 0; i < 25; i++) g.members.forEach((m) => g.memberDamage(m));
  eq('reading memberDamage 25 more times changes no state', snapshot(), before);
  eq('and keeps answering the same number', g.members.map((m) => g.memberDamage(m)).join(','), first);
}

// --- consuming vetoes: exactly one save, and the right one ------------------
{
  // The Strongman's Last Stand and the Martyr's Icon can both save one death. The relic is
  // consulted first, so a party holding both spends the RELIC and the Strongman keeps his
  // own save for later. Getting this backwards costs the player a save they still hold.
  const g = game(['flagellant', 'tank', 'mage'], ['martyrsIcon']);
  const f = g.members[SLOT.LEFT];

  f.hp = 1;
  eq('the first lethal blow is vetoed', g._killMember(f), false);
  check('the hero lives', f.alive);
  check('the RELIC was spent', g.martyrUsed);
  check('and Last Stand was NOT', !f.lastStandUsed);

  f.hp = 1;
  eq('the second lethal blow is vetoed too', g._killMember(f), false);
  check('now Last Stand is spent', f.lastStandUsed);

  f.hp = 1;
  eq('the third lethal blow kills — no saves left', g._killMember(f), true);
  check('the hero is down', !f.alive);
}
{
  // A Strongman alone still gets exactly one save, so the relic is not what grants it.
  const g = game(['flagellant', 'tank', 'mage']);
  const f = g.members[SLOT.LEFT];
  f.hp = 1;
  eq('Last Stand vetoes unaided', g._killMember(f), false);
  f.hp = 1;
  eq('but only once', g._killMember(f), true);
}
{
  // The save is PER MEMBER, not per party — the reason Last Stand needed `consumesMember`
  // rather than the per-Game flag the Martyr's Icon uses. Only the Strongman has the
  // passive, so this asserts the flag is not global: spending his does not touch a
  // teammate's death, which is unvetoed.
  const g = game(['flagellant', 'tank', 'mage']);
  const f = g.members[SLOT.LEFT];
  const tank = g.members[SLOT.CENTER];
  f.hp = 1;
  g._killMember(f);
  check('the Strongman was saved', f.alive);
  tank.hp = 1;
  eq('a teammate with no Last Stand still dies', g._killMember(tank), true);
}

// --- the Duelist regression -------------------------------------------------
//
// The rejected design gave her a permanent `riposteTurns`. That field is TIMED and has
// four other owners — it decays each enemy turn, the death pipeline zeroes it, Resurrect
// clears it, and En Garde plain-ASSIGNS it — so one En Garde cast would have overwritten
// her passive with a finite timer and deleted it when that expired. These are the cases
// that design would have failed.
// Count the EXTRA strikes this slot makes beyond its one party-phase auto. Measuring
// enemy HP instead would be vacuous — the party phase always deals damage, so a
// "damage went down" assertion passes whether or not anyone riposted. (It did, in the
// first draft of this file, and the negative control caught it.)
function countersOf(g: Game, slot: number): number {
  const t = g.telegraph;
  if (!t) throw new Error('no telegraph');
  Object.assign(t, { cast: undefined, hidden: false, ignoreTaunt: true, targets: [slot], damage: 3 });
  const cap = capture(g, () => g.endTurn());
  const mine = cap.events.filter((e) => e.kind === 'partyAttack' && (e as { slot: number }).slot === slot);
  return mine.length - 1; // subtract the party-phase auto every living member makes
}
{
  const g = game(['duelist', 'tank', 'mage']);
  const duelist = g.members[SLOT.LEFT];
  eq('her timer really is zero', duelist.riposteTurns, 0);
  eq('the Duelist ripostes anyway — the passive IS the stance', countersOf(g, SLOT.LEFT), 1);
}
{
  // En Garde her, then let the stance run all the way out. She must still riposte.
  const g = game(['duelist', 'tank', 'mage']);
  const duelist = g.members[SLOT.LEFT];
  duelist.riposteTurns = 3;
  for (let i = 0; i < 6; i++) g._decayBuffs();
  eq('the En Garde timer has fully decayed', duelist.riposteTurns, 0);
  eq('she still ripostes after the stance expires', countersOf(g, SLOT.LEFT), 1);
}
{
  // Death zeroes riposteTurns. A revived Duelist must still have her passive.
  const g = game(['duelist', 'tank', 'mage']);
  const duelist = g.members[SLOT.LEFT];
  duelist.hp = 1;
  g._killMember(duelist);
  eq('death zeroed the timer', duelist.riposteTurns, 0);
  duelist.alive = true;
  duelist.hp = duelist.maxHP;
  eq('a revived Duelist still ripostes', countersOf(g, SLOT.LEFT), 1);
}

finish('content/hook-bus');
