import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { PASSIVE_MP_CAP } from '../constants';

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
    <main className="shop-screen">
      <header className="shop-head">
        <div>
          <h2>A Healer’s Boon</h2>
        </div>
        <span className="run-gold" title="Free">Free pick</span>
      </header>
      <p className="shop-hint">
        Max Mana {h.maxMana} · Hand {h.handSize} · Rest +{h.restRegen} · Passive +{h.passiveMp}
      </p>
      <div className="shop-offers">
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
      </div>
      <button className="leave-btn" onClick={() => act((r) => r.skipHealerBoon())}>Take nothing</button>
    </main>
  );
}
