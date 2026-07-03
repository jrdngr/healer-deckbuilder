import { RELICS } from '../constants';
import type { RelicOffer } from '../constants';

interface RelicTileProps {
  offer: RelicOffer;
  affordable: boolean;
  onClick: () => void;
}

// One relic in a spoils / Reliquary storefront: icon, name, effect, price tag
// (spoils offers carry price 0 and show "Take" instead of a price).
export function RelicTile({ offer, affordable, onClick }: RelicTileProps) {
  const def = RELICS[offer.relicId];
  return (
    <div className="shop-offer">
      <button
        className={`relic-tile${affordable ? '' : ' unaffordable'}`}
        disabled={!affordable}
        onClick={onClick}
        title={def.desc}
      >
        <span className="relic-icon">{def.icon}</span>
        <span className="relic-name">{def.name}</span>
        <span className="relic-desc">{def.desc}</span>
      </button>
      <div className={`offer-price ${offer.rarity}`}>{offer.price > 0 ? `⦿ ${offer.price}` : 'Take'}</div>
    </div>
  );
}
