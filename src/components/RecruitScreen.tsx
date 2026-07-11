import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { MEMBER_POOL } from '../constants';
import { MemberOfferButton } from './DraftScreen';
import { ScreenHeader } from './ScreenChrome';

interface RecruitScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Recruit node (2026-07): a map stop that adds one member to the roster. Optional —
// the player may decline. Resolves once (content.done); revisits find it spent.
export function RecruitScreen({ run, act, onDone }: RecruitScreenProps) {
  const content = run.nodeContent;
  if (run.location.kind !== 'node' || content?.type !== 'recruit') return null;
  const done = content.done;
  const rosterNames = run.roster.map((p) => (p.member ? MEMBER_POOL[p.member].name : null)).filter(Boolean);

  return (
    <main className="shop-screen draft-screen">
      <ScreenHeader
        title="Recruiter"
        right={<button className="leave-btn" onClick={onDone}>{done ? 'Move on' : 'Decline'}</button>}
      />

      {rosterNames.length > 0 && (
        <div className="draft-weights"><span>Your roster: {rosterNames.join(' · ')}</span></div>
      )}

      {!done && (
        <div className="shop-offers draft-offers">
          {content.options.map((id) => (
            <MemberOfferButton key={id} id={id} onClick={() => act((r) => r.recruitMember(id))} />
          ))}
        </div>
      )}
    </main>
  );
}
