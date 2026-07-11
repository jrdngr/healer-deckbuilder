import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { ShopFrame } from './ShopFrame';

interface HealerUpgradeShopScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Buy +1 healer (player) upgrades. These apply directly to the player, so there's
// no target to choose.
export function HealerUpgradeShopScreen({ run, act, onDone }: HealerUpgradeShopScreenProps) {
  if (run.nodeContent?.type !== 'healerUpgrade') return null;
  const offers = run.nodeContent.offers;
  const h = run.healer;

  return (
    <ShopFrame title="Sanctum" gold={run.gold} onLeave={onDone}>
      <p className="shop-hint">
        Max Mana {h.maxMana} · Hand {h.handSize} · Rest +{h.restRegen} · Passive +{h.passiveMp}
      </p>
      <div className="shop-offers">
        {offers.map((offer, i) => {
          const affordable = run.gold >= offer.price;
          return (
            <button
              key={offer.def.id}
              className={`mod-offer ${offer.def.rarity}`}
              disabled={!affordable}
              onClick={() => act((r) => r.buyHealerOffer(i))}
            >
              <span className="mod-name">{offer.def.name}</span>
              <span className="mod-desc">{offer.def.desc}</span>
              <span className="offer-price">⦿ {offer.price}</span>
            </button>
          );
        })}
        {offers.length === 0 && <p className="shop-empty">Nothing left to learn.</p>}
      </div>
    </ShopFrame>
  );
}
