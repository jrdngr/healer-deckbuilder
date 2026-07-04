import { useState } from 'react';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { MEMBER_POOL, PARTY_SIZE, CLASSIC_TRIO } from '../constants';
import type { MemberId } from '../constants';

interface DraftScreenProps {
  run: Run;
  act: RunAct;
}

const SLOT_NAMES = ['Left', 'Center', 'Right'];

// Draft skeleton (#27): a crude pick screen — click members to seat them in slots
// left → center → right, then confirm. The full 1-of-2 pick flow with surfaced
// placement weights is #30; this exists so the roster + party plumbing are usable.
export function DraftScreen({ run, act }: DraftScreenProps) {
  const [picks, setPicks] = useState<MemberId[]>([]);
  if (run.location.kind !== 'draft' || run.nodeContent?.type !== 'draft') return null;
  const pool = run.nodeContent.pool;

  const addPick = (id: MemberId) => {
    if (picks.length >= PARTY_SIZE) return;
    setPicks([...picks, id]);
  };
  const reset = () => setPicks([]);
  const full = picks.length === PARTY_SIZE;

  return (
    <main className="shop-screen draft-screen">
      <header className="shop-head">
        <div>
          <h2>Draft your party</h2>
          <p>Pick {PARTY_SIZE} members — they seat left → center → right in pick order.</p>
        </div>
        <button className="leave-btn" onClick={() => act((r) => r.chooseDraft(CLASSIC_TRIO))}>
          Use the classic trio
        </button>
      </header>

      <div className="draft-slots">
        {Array.from({ length: PARTY_SIZE }, (_, i) => {
          const id = picks[i];
          const d = id ? MEMBER_POOL[id] : null;
          return (
            <div key={i} className={`draft-slot${d ? ' filled' : ''}`}>
              <span className="draft-slot-label">{SLOT_NAMES[i]}</span>
              <span className="draft-slot-name">{d ? d.name : '—'}</span>
            </div>
          );
        })}
      </div>

      <div className="shop-offers draft-offers">
        {pool.map((id) => {
          const d = MEMBER_POOL[id];
          const chosenCount = picks.filter((p) => p === id).length;
          return (
            <button
              key={id}
              className={`draft-member${chosenCount ? ' chosen' : ''}`}
              disabled={full}
              onClick={() => addPick(id)}
              title={`Ability: ${d.ability}`}
            >
              <span className="draft-member-name">{d.name}</span>
              <span className="draft-member-stats">HP {d.maxHP} · DMG {d.damage} · {d.ability}</span>
            </button>
          );
        })}
      </div>

      <div className="draft-actions">
        <button className="leave-btn" onClick={reset} disabled={picks.length === 0}>Reset</button>
        <button
          className="primary map-take"
          disabled={!full}
          onClick={() => act((r) => r.chooseDraft(picks))}
        >
          {full ? 'Seat this party' : `Pick ${PARTY_SIZE - picks.length} more`}
        </button>
      </div>
    </main>
  );
}
