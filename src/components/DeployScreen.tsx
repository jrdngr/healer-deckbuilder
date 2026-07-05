import { useState } from 'react';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { MEMBER_POOL, MEMBER_ABILITY_FLAVOR, INJURY_NAMES, memberSalary } from '../constants';

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
  const [deploy, setDeploy] = useState<(number | null)[]>(() => [...run.deployment]);
  const [activeSlot, setActiveSlot] = useState(0);
  if (loc.kind !== 'deploy') return null;
  const enemy = run.peekEncounter(loc.fightIndex);

  const assign = (ri: number): void => {
    const next = [...deploy];
    for (let i = 0; i < next.length; i++) if (next[i] === ri) next[i] = null; // one slot per hero
    next[activeSlot] = deploy[activeSlot] === ri ? null : ri;                 // toggle in the active slot
    setDeploy(next);
  };
  const clearSlot = (i: number): void => {
    const next = [...deploy];
    next[i] = null;
    setDeploy(next);
  };
  const seatedCount = deploy.filter((x) => x != null).length;
  // Salary owed if this deployment fights: paid out of the win, so fielding fewer keeps more.
  const projectedSalary = deploy.reduce<number>((s, ri) => s + (ri != null && run.roster[ri] ? memberSalary(run.roster[ri]) : 0), 0);

  return (
    <main className="shop-screen deploy-screen">
      <header className="shop-head">
        <div>
          <h2>Deploy your party</h2>
          <p>Field up to three heroes and set their positions. Up next: <strong>{enemy.name}</strong>{enemy.boss ? ' — Boss' : ''}.</p>
          <p className="deploy-salary-line">Gold {run.gold} · salary this fight: <strong>{projectedSalary}g</strong> (paid from the win)</p>
        </div>
        <button className="primary map-take" disabled={seatedCount === 0}
          onClick={() => act((r) => r.confirmDeployment(deploy))}>
          {seatedCount === 0 ? 'Deploy at least one' : `Fight with ${seatedCount} · −${projectedSalary}g`}
        </button>
      </header>

      <div className="deploy-slots">
        {SLOT_NAMES.map((name, i) => {
          const ri = deploy[i];
          const m = ri != null && run.roster[ri]?.member ? MEMBER_POOL[run.roster[ri].member!] : null;
          return (
            <button key={i} className={`deploy-slot${i === activeSlot ? ' active' : ''}${m ? ' filled' : ''}`}
              onClick={() => setActiveSlot(i)} aria-pressed={i === activeSlot}>
              <span className="deploy-slot-label">{name}</span>
              <span className="deploy-slot-name">{m ? m.name : 'Empty'}</span>
              {m && <span className="deploy-slot-clear" role="button" onClick={(e) => { e.stopPropagation(); clearSlot(i); }}>✕</span>}
            </button>
          );
        })}
      </div>

      <div className="shop-offers deploy-roster">
        {run.roster.map((p, ri) => {
          const id = p.member!;
          const dm = MEMBER_POOL[id];
          const inSlot = deploy.indexOf(ri);
          const scar = p.injuries > 0 ? ` · ${INJURY_NAMES[Math.min(p.injuries, INJURY_NAMES.length) - 1]}` : '';
          return (
            <button key={ri} className={`draft-member${inSlot >= 0 ? ' chosen' : ''}`}
              onClick={() => assign(ri)} aria-pressed={inSlot >= 0} title={MEMBER_ABILITY_FLAVOR[id]}>
              <span className="draft-member-name">{dm.name}{inSlot >= 0 ? ` — ${SLOT_NAMES[inSlot]}` : ''}</span>
              <span className="draft-member-stats">HP {p.maxHP} · DMG {p.damage} · {memberSalary(p)}g/fight{scar}</span>
              <span className="draft-member-ability">{MEMBER_ABILITY_FLAVOR[id]}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
