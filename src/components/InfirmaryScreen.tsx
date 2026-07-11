import { memberDefAt, INFIRMARY_HP_PRICE, INFIRMARY_INJURY_PRICE, INJURY_NAMES } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { ShopFrame } from './ShopFrame';

interface InfirmaryScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Infirmary node (#58, re-added): now that HP persists across fights, pay gold to
// restore a member to full HP, or a much larger price to shed one lasting injury.
// The node hides (BranchScreen) when nobody is hurt or injured; each member's
// buttons disable when the price can't help them or the gold isn't there.
export function InfirmaryScreen({ run, act, onDone }: InfirmaryScreenProps) {
  if (run.location.kind !== 'node' || run.nodeContent?.type !== 'infirmary') return null;

  return (
    <ShopFrame
      title="Infirmary"
      gold={run.gold}
      onLeave={onDone}
    >
      <div className="member-row infirmary-members">
        {run.roster.map((p, index) => {
          const d = memberDefAt(run.roster, index);
          const hp = p.hp ?? p.maxHP;
          const hurt = hp < p.maxHP;
          const scarred = p.injuries > 0;
          const topScar = scarred ? INJURY_NAMES[Math.min(p.injuries, INJURY_NAMES.length) - 1] : null;
          return (
            <div key={index} className="member-pick infirmary-member">
              <span className="member-name">{d.name}</span>
              <span className="member-stats">
                HP {hp}/{p.maxHP}{scarred ? ` · 🩹 ${topScar} ×${p.injuries}` : ''}
              </span>
              <button
                className="infirmary-btn"
                disabled={!hurt || run.gold < INFIRMARY_HP_PRICE}
                onClick={() => act((r) => r.infirmaryHealHP(index))}
              >
                Heal HP — ⦿ {INFIRMARY_HP_PRICE}
              </button>
              <button
                className="infirmary-btn"
                disabled={!scarred || run.gold < INFIRMARY_INJURY_PRICE}
                onClick={() => act((r) => r.infirmaryHealInjury(index))}
              >
                Mend injury — ⦿ {INFIRMARY_INJURY_PRICE}
              </button>
            </div>
          );
        })}
      </div>
    </ShopFrame>
  );
}
