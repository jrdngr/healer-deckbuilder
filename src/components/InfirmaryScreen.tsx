import { memberDefAt, INJURY_NAMES, injuryIncapacitates } from '../constants';
import type { Slot } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { ShopFrame } from './ShopFrame';

interface InfirmaryScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// The Infirmary node (DR1): pay a flat price to clear one death-scar at a time,
// top of the ladder first (the most recent, worst scar heals first), off any
// injured member. Members carry 0..MAX_INJURIES scars; the ladder names are
// Cracked / Weakened / Broken.
export function InfirmaryScreen({ run, act, onDone }: InfirmaryScreenProps) {
  if (run.nodeContent?.type !== 'infirmary') return null;
  const price = run.nodeContent.price;
  const anyInjured = run.party.some((p) => p.injuries > 0);
  const anyIncapacitated = run.party.some((p) => injuryIncapacitates(p.injuries));

  return (
    <ShopFrame
      title="Infirmary"
      subtitle={`The chirurgeon mends what battle left behind — ${price}g per injury.`}
      gold={run.gold}
      onLeave={onDone}
    >
      <div className="member-row">
        {run.party.map((p, slot) => {
          const d = memberDefAt(run.party, slot);
          const scars = INJURY_NAMES.slice(0, p.injuries); // tiers 0..injuries-1
          const top = scars[scars.length - 1];             // most recent scar heals first
          const canTreat = p.injuries > 0 && run.gold >= price;
          const incap = injuryIncapacitates(p.injuries);   // 4th scar: out of the run until treated
          return (
            <div key={slot} className={`member-pick infirmary-member${incap ? ' incapacitated' : ''}`}>
              <span className="member-name">{d.name}{incap ? ' — ☠ Incapacitated' : ''}</span>
              <span className="member-stats">
                {p.injuries === 0 ? 'Unharmed' : scars.join(' · ')}
              </span>
              <button
                className="leave-btn"
                disabled={!canTreat}
                onClick={() => act((r) => r.clearInjuryForGold(slot as Slot))}
              >
                {p.injuries > 0 ? `Treat ${top} (${price}g)` : 'Healthy'}
              </button>
            </div>
          );
        })}
      </div>
      {anyIncapacitated && (
        <p className="shop-hint">
          An <strong>Incapacitated</strong> member fights no more until treated — healing their Shattered scar restores them to the field.
        </p>
      )}
      {!anyInjured && <p className="shop-hint">Your party bears no lasting wounds. Rest easy.</p>}
    </ShopFrame>
  );
}
