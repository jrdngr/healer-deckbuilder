import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { PASSIVE_MP_CAP } from '../constants';
import { RewardScreen } from './ScreenChrome';
import { Tooltip } from './Tooltip';

interface HealerBoonScreenProps {
  run: Run;
  act: RunAct;
}

// The free healer-upgrade pick after the act-1 and act-2 bosses (#83): take one of
// all four healer boons, or walk on empty-handed. Free and repeatable across bosses
// — re-picking stacks the stat (passiveMp stops at its per-run cap).
export function HealerBoonScreen({ run, act }: HealerBoonScreenProps) {
  if (run.location.kind !== 'healerBoon' || run.nodeContent?.type !== 'healerBoon') return null;
  const offers = run.nodeContent.offers;
  const h = run.healer;
  const passiveMaxed = h.passiveMp >= PASSIVE_MP_CAP;

  return (
    <RewardScreen
      title="A Healer’s Boon"
      headerRight={<Tooltip content="Free"><span className="run-gold">Free pick</span></Tooltip>}
      hint={`Max Mana ${h.maxMana} · Hand ${h.handSize} · Rest +${h.restRegen} · Passive +${h.passiveMp}`}
      onSkip={() => act((r) => r.skipHealerBoon())}
      onBack={run.canGoBack() ? () => act((r) => r.goBackToReward()) : undefined}
    >
      {offers.map((offer, i) => {
        const maxed = offer.def.stat === 'passiveMp' && passiveMaxed;
        return (
          <button
            key={offer.def.id}
            className={`mod-offer ${offer.def.rarity}`}
            disabled={maxed}
            onClick={() => act((r) => r.pickHealerBoon(i))}
          >
            <span className="mod-name">{offer.def.name}</span>
            <span className="mod-desc">{maxed ? 'Already at the per-run cap.' : offer.def.desc}</span>
          </button>
        );
      })}
    </RewardScreen>
  );
}
