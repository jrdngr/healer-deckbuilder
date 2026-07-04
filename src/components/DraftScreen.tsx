import { useState } from 'react';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { MEMBER_POOL, MEMBER_ABILITY_FLAVOR, PARTY_SIZE, CLASSIC_TRIO, SLOT_WEIGHTS, DRAFT_RATING, CONVENTIONALLY_HEALABLE } from '../constants';
import type { MemberId } from '../constants';

interface DraftScreenProps {
  run: Run;
  act: RunAct;
}

const SLOT_NAMES = ['Left', 'Center', 'Right'];

// Full draft (#30): three 1-of-2 picks from the pool of 8, then L/C/R assignment.
// The placement weights are surfaced so the choice is informed. The classic trio is
// one click away, so returning players lose nothing.
export function DraftScreen({ run, act }: DraftScreenProps) {
  // `chosen[p]` = the member picked from pair p (null until picked).
  const [chosen, setChosen] = useState<(MemberId | null)[]>([null, null, null]);
  // `seated` = the L/C/R order being assembled once all three are picked.
  const [seated, setSeated] = useState<MemberId[]>([]);
  if (run.location.kind !== 'draft' || run.nodeContent?.type !== 'draft') return null;
  const pairs = run.nodeContent.pairs;

  const allPicked = chosen.every((c) => c !== null);
  const picks = chosen.filter((c): c is MemberId => c !== null);
  const toSeat = picks.filter((id) => !seated.includes(id));
  const seatedFull = seated.length === PARTY_SIZE;

  const pick = (pairIdx: number, id: MemberId) => {
    const next = [...chosen];
    next[pairIdx] = id;
    setChosen(next);
    setSeated([]); // re-picking resets seating
  };

  const MemberButton = ({ id, chosenNow, onClick }: { id: MemberId; chosenNow: boolean; onClick: () => void }) => {
    const d = MEMBER_POOL[id];
    const healable = CONVENTIONALLY_HEALABLE.has(id);
    const flavor = MEMBER_ABILITY_FLAVOR[id];
    return (
      // aria-pressed exposes the chosen state to AT (and to text-based tests); the
      // .chosen class is styling only. The ability shows its player-facing flavor,
      // never the raw id (#37) — the pick is no longer blind.
      <button className={`draft-member${chosenNow ? ' chosen' : ''}`} onClick={onClick} aria-pressed={chosenNow} title={flavor}>
        <span className="draft-member-name">{d.name}</span>
        <span className="draft-member-stats">
          HP {d.maxHP} · DMG {d.damage} · rated {DRAFT_RATING[id]}{healable ? '' : ' · self-reliant'}
        </span>
        <span className="draft-member-ability">{flavor}</span>
      </button>
    );
  };

  return (
    <main className="shop-screen draft-screen">
      <header className="shop-head">
        <div>
          <h2>Draft your party</h2>
          <p>{allPicked ? 'Assign your picks to slots — left to right.' : 'Choose one from each pair.'}</p>
        </div>
        <button className="leave-btn" onClick={() => act((r) => r.chooseDraft(CLASSIC_TRIO))}>
          Accept the classic trio
        </button>
      </header>

      {/* Placement weights, surfaced (#30): where the enemy aims by default. */}
      <div className="draft-weights">
        <span>Enemy targeting by slot — </span>
        <span title="How a normal aimed attack picks its primary target.">
          open: {SLOT_WEIGHTS.normal.map((w, i) => `${SLOT_NAMES[i]} ${w}%`).join(' · ')}
        </span>
        <span title="How a hidden/veiled attack picks its target — the flanks are riskier.">
          {' '}| veiled: {SLOT_WEIGHTS.hidden.map((w, i) => `${SLOT_NAMES[i]} ${w}%`).join(' · ')}
        </span>
      </div>

      {!allPicked && (
        <div className="draft-pairs">
          {pairs.map((pair, p) => (
            <div key={p} className="draft-pair">
              <div className="draft-pair-label">Pick {p + 1}</div>
              <div className="shop-offers">
                {pair.map((id) => (
                  <MemberButton key={id} id={id} chosenNow={chosen[p] === id} onClick={() => pick(p, id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {allPicked && (
        <>
          <div className="draft-slots">
            {Array.from({ length: PARTY_SIZE }, (_, i) => {
              const id = seated[i];
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
            {toSeat.map((id) => (
              <MemberButton key={id} id={id} chosenNow={false} onClick={() => setSeated([...seated, id])} />
            ))}
          </div>
          <div className="draft-actions">
            <button className="leave-btn" onClick={() => setSeated([])} disabled={seated.length === 0}>Reset slots</button>
            <button className="leave-btn" onClick={() => { setChosen([null, null, null]); setSeated([]); }}>Re-pick</button>
            <button className="primary map-take" disabled={!seatedFull} onClick={() => act((r) => r.chooseDraft(seated))}>
              {seatedFull ? 'Begin the run' : `Seat ${PARTY_SIZE - seated.length} more`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
