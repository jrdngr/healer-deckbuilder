import { useState } from 'react';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { MEMBER_POOL, ROSTER_CAP } from '../constants';
import type { MemberId } from '../constants';
import { MemberOfferButton } from './DraftScreen';
import { ScreenHeader } from './ScreenChrome';

interface RecruitScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Recruit node (2026-07): a map stop that adds one member to the roster. Optional —
// the player may decline. Resolves once (content.done); revisits find it spent.
//
// Roster cap: with room to spare, tapping an offer recruits immediately. At a FULL
// roster (ROSTER_CAP), tapping an offer opens a "release which hero?" step — the player
// must dismiss one current member to make room (the dismissed hero returns to the pool).
export function RecruitScreen({ run, act, onDone }: RecruitScreenProps) {
  const content = run.nodeContent;
  // `pending` holds the offered hero awaiting a replacement pick (full-roster path).
  const [pending, setPending] = useState<MemberId | null>(null);
  if (run.location.kind !== 'node' || content?.type !== 'recruit') return null;
  const done = content.done;
  const rosterNames = run.roster.map((p) => (p.member ? MEMBER_POOL[p.member].name : null)).filter(Boolean);
  const rosterFull = run.roster.length >= ROSTER_CAP;

  // Tapping an offer: recruit outright when there's room, else stage a replacement.
  const tapOffer = (id: MemberId) => {
    if (rosterFull) { setPending(id); return; }
    act((r) => r.recruitMember(id));
    onDone();
  };
  // Confirm the swap: dismiss the chosen roster member for the pending recruit.
  const release = (index: number) => {
    const id = pending;
    if (id == null) return;
    act((r) => r.recruitMember(id, index));
    onDone();
  };

  return (
    <main className="shop-screen draft-screen">
      <ScreenHeader
        title="Recruiter"
        right={
          pending != null
            ? <button className="leave-btn" onClick={() => setPending(null)}>Back</button>
            : <button className="leave-btn" onClick={onDone}>{done ? 'Move on' : 'Decline'}</button>
        }
      />

      {rosterNames.length > 0 && (
        <div className="draft-weights"><span>Your roster: {rosterNames.join(' · ')}</span></div>
      )}

      {!done && pending == null && (
        <>
          {rosterFull && (
            <div className="draft-weights"><span>Roster full — choosing a hero means replacing one.</span></div>
          )}
          <div className="shop-offers draft-offers">
            {content.options.map((id) => (
              <MemberOfferButton key={id} id={id} onClick={() => tapOffer(id)} />
            ))}
          </div>
        </>
      )}

      {!done && pending != null && (
        <>
          <div className="draft-weights">
            <span>Recruit {MEMBER_POOL[pending].name} — release which hero?</span>
          </div>
          <div className="shop-offers draft-offers">
            {run.roster.map((p, i) => (
              p.member ? <MemberOfferButton key={p.member} id={p.member} onClick={() => release(i)} /> : null
            ))}
          </div>
        </>
      )}
    </main>
  );
}
