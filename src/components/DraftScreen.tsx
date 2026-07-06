import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { MEMBER_POOL, MEMBER_ABILITY_FLAVOR, CONVENTIONALLY_HEALABLE } from '../constants';
import type { MemberId } from '../constants';

// One member offer button — shared by the pick-one draft and the Recruit node. The
// ability shows its player-facing flavor, never the raw id (#37); a self-reliant tag
// marks members conventional healing doesn't help.
export function MemberOfferButton({ id, onClick }: { id: MemberId; onClick: () => void }) {
  const d = MEMBER_POOL[id];
  const healable = CONVENTIONALLY_HEALABLE.has(id);
  const flavor = MEMBER_ABILITY_FLAVOR[id];
  return (
    <button className="draft-member" onClick={onClick} title={flavor}>
      <span className="draft-member-name">{d.name}</span>
      <span className="draft-member-stats">
        HP {d.maxHP} · DMG {d.damage}{healable ? '' : ' · self-reliant'}
      </span>
      <span className="draft-member-ability">{flavor}</span>
    </button>
  );
}

interface DraftScreenProps {
  run: Run;
  act: RunAct;
}

// Pick-one member draft: at run start only (a forced solo — choose your carry). The
// post-boss draft was removed with #56; later heroes join via the Recruit node, which
// the map now guarantees after the first fight and after each boss. Deploy per fight.
export function DraftScreen({ run, act }: DraftScreenProps) {
  if (run.location.kind !== 'draft' || run.nodeContent?.type !== 'draft') return null;
  const options = run.nodeContent.options;
  const rosterNames = run.roster.map((p) => (p.member ? MEMBER_POOL[p.member].name : null)).filter(Boolean);

  return (
    <main className="shop-screen draft-screen">
      <header className="shop-head">
        <div>
          <h2>Choose your starting hero</h2>
          <p>Pick one of three heroes drawn from the full roster to open your run. Your first battle is a solo; more heroes join at the recruiter after your first fight and after each boss.</p>
        </div>
      </header>

      {rosterNames.length > 0 && (
        <div className="draft-weights"><span>Your roster: {rosterNames.join(' · ')}</span></div>
      )}

      <div className="shop-offers draft-offers">
        {options.map((id) => (
          <MemberOfferButton key={id} id={id} onClick={() => act((r) => r.chooseDraftMember(id))} />
        ))}
      </div>
    </main>
  );
}
