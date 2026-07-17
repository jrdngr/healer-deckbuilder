import { useRef, useState } from 'react';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { MEMBER_POOL, MEMBER_PASSIVE_FLAVOR, topScarName, memberSalary, GOLD_PER_FIGHT, EMPTY_SEAT_GOLD_BONUS } from '../constants';
import { firstEmptySlot, nextEmptySlot, reduceDeploy, type Deployment, type DragSource } from '../deploy';
import { Tooltip } from './Tooltip';

interface DeployScreenProps {
  run: Run;
  act: RunAct;
}

const SLOT_NAMES = ['Left', 'Center', 'Right'];

// Pre-fight deploy (2026-07): choose which roster members fight this battle and
// where. Click a slot to make it active, then a hero to seat/unseat them there.
// Fielding fewer than three is allowed (and, once salaries land, cheaper).
export function DeployScreen({ run, act }: DeployScreenProps) {
  const loc = run.location;
  const [deploy, setDeploy] = useState<Deployment>(() => [...run.deployment]);
  // Active slot starts on the first empty slot from the left (Left if all full).
  const [activeSlot, setActiveSlot] = useState(() => firstEmptySlot(run.deployment));
  // Source of an in-flight drag (native HTML5 DnD). A ref, not state, so starting
  // a drag doesn't re-render.
  const dragSrc = useRef<DragSource | null>(null);
  if (loc.kind !== 'deploy') return null;
  const enemy = run.peekEncounter(loc.fightIndex);

  // Click a roster hero: toggle them into the active slot, then auto-advance the
  // active slot to the next empty one from the left so three clicks fill L/C/R.
  const assign = (ri: number): void => {
    const next = reduceDeploy(deploy, { type: 'seat', roster: ri, slot: activeSlot });
    setDeploy(next);
    setActiveSlot((cur) => nextEmptySlot(next, cur));
  };
  const clearSlot = (i: number): void => {
    setDeploy(reduceDeploy(deploy, { type: 'clear', slot: i }));
  };
  // Resolve a drop landing on slot `i` from whatever is being dragged.
  const dropOnSlot = (i: number): void => {
    const src = dragSrc.current;
    dragSrc.current = null;
    if (!src) return;
    const next = src.kind === 'slot'
      ? reduceDeploy(deploy, { type: 'dropSlotToSlot', from: src.index, to: i })
      : reduceDeploy(deploy, { type: 'dropRosterToSlot', roster: src.index, slot: i });
    setDeploy(next);
    setActiveSlot((cur) => nextEmptySlot(next, cur));
  };
  // A seated hero dragged back onto the roster list: unseat them.
  const dropOnRoster = (): void => {
    const src = dragSrc.current;
    dragSrc.current = null;
    if (!src || src.kind !== 'slot') return;
    const ri = deploy[src.index];
    if (ri == null) return;
    const next = reduceDeploy(deploy, { type: 'unseat', roster: ri });
    setDeploy(next);
    setActiveSlot((cur) => nextEmptySlot(next, cur));
  };
  const seatedCount = deploy.filter((x) => x != null).length;
  // Salary owed if this deployment fights: paid out of the win, so fielding fewer keeps more.
  const projectedSalary = deploy.reduce<number>((s, ri) => s + (ri != null && run.roster[ri] ? memberSalary(run.roster[ri]) : 0), 0);
  // "Field fewer, keep more" (#42): the win bounty scales up with empty seats, and
  // benched wages are saved — so a smaller party is the richer (riskier) line.
  const emptySeats = 3 - seatedCount;
  const projectedBounty = Math.round(GOLD_PER_FIGHT * (1 + EMPTY_SEAT_GOLD_BONUS * emptySeats));
  const projectedNet = projectedBounty - projectedSalary;
  // Fielding fewer is a real (paid) strategy, but forgetting to seat a recruit is a
  // mistake. Warn — loudly, non-blocking — when a roster member is benched AND a seat
  // is free. One click still starts the fight; the warning only catches the oversight.
  const benchedCount = run.roster.filter((p, ri) => p.member && !deploy.includes(ri)).length;
  const warnUndeployed = benchedCount > 0 && emptySeats > 0;

  return (
    <main className="shop-screen deploy-screen">
      <header className="shop-head">
        <div>
          <h2>Deploy your party</h2>
          <p>Up next: <strong>{enemy.name}</strong>{enemy.boss ? ' — Boss' : ''}.</p>
          <p className="deploy-salary-line">Gold {run.gold} · win pays <strong>{projectedBounty}g</strong>{emptySeats > 0 ? ` (+${Math.round(EMPTY_SEAT_GOLD_BONUS * emptySeats * 100)}% for ${emptySeats} empty)` : ''} − <strong>{projectedSalary}g</strong> wages = <strong>{projectedNet}g</strong></p>
        </div>
        <button className={`primary map-take${warnUndeployed ? ' danger' : ''}`} disabled={seatedCount === 0}
          onClick={() => act((r) => r.confirmDeployment(deploy))}>
          {seatedCount === 0 ? 'Deploy at least one' : 'Fight'}
        </button>
      </header>

      {warnUndeployed && (
        <p className="deploy-undeployed-warning" role="alert">
          ⚠ {benchedCount === 1 ? 'A party member is' : `${benchedCount} party members are`} benched with {emptySeats === 1 ? 'an empty seat' : 'empty seats'} to fill.
        </p>
      )}

      <div className="deploy-slots">
        {SLOT_NAMES.map((name, i) => {
          const ri = deploy[i];
          const m = ri != null && run.roster[ri]?.member ? MEMBER_POOL[run.roster[ri].member!] : null;
          return (
            <button key={i} className={`deploy-slot${i === activeSlot ? ' active' : ''}${m ? ' filled' : ''}`}
              onClick={() => setActiveSlot(i)} aria-pressed={i === activeSlot}
              draggable={m != null}
              onDragStart={(e) => { dragSrc.current = { kind: 'slot', index: i }; e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); dropOnSlot(i); }}>
              <span className="deploy-slot-label">{name}</span>
              <span className="deploy-slot-name">{m ? m.name : 'Empty'}</span>
              {m && <span className="deploy-slot-clear" role="button" onClick={(e) => { e.stopPropagation(); clearSlot(i); }}>✕</span>}
            </button>
          );
        })}
      </div>

      <div className="shop-offers deploy-roster"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); dropOnRoster(); }}>
        {run.roster.map((p, ri) => {
          const id = p.member!;
          const dm = MEMBER_POOL[id];
          const inSlot = deploy.indexOf(ri);
          const scar = p.injuries > 0 ? ` · ${topScarName(p.injuries)}` : '';
          const passive = MEMBER_PASSIVE_FLAVOR[id];
          return (
            <Tooltip key={ri} content={`${passive.name} — ${passive.desc}`}>
              <button className={`draft-member${inSlot >= 0 ? ' chosen' : ''}`}
                onClick={() => assign(ri)} aria-pressed={inSlot >= 0}
                draggable
                onDragStart={(e) => { dragSrc.current = { kind: 'roster', index: ri }; e.dataTransfer.effectAllowed = 'move'; }}>
                <span className="draft-member-name">{dm.name}{inSlot >= 0 ? ` — ${SLOT_NAMES[inSlot]}` : ''}</span>
                <span className="draft-member-stats">HP {p.maxHP} · DMG {p.damage} · {memberSalary(p)}g/fight{scar}</span>
                <span className="draft-member-ability">{passive.name}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </main>
  );
}
