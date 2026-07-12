import { resolveCard, makeDeckCard } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { Card } from './Card';
import { ShopFrame } from './ShopFrame';

interface CardShopScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Buy cards from a rolled, rarity-weighted storefront. Click an affordable card to
// add it to the deck; the offer is then consumed.
export function CardShopScreen({ run, act, onDone }: CardShopScreenProps) {
  if (run.nodeContent?.type !== 'cardShop') return null;
  const offers = run.nodeContent.offers;

  return (
    <ShopFrame title="Card Shop" gold={run.gold} onLeave={onDone}>
      <div className="shop-offers">
        {offers.map((offer, i) => {
          const affordable = run.gold >= offer.price;
          return (
            <div className="shop-offer" key={offer.cardId}>
              <Card
                card={resolveCard(makeDeckCard(offer.cardId, -1))}
                affordable={affordable}
                selected={false}
                onClick={() => { if (affordable) act((r) => r.buyCardOffer(i)); }}
              />
              <div className={`offer-price ${offer.rarity}${offer.listPrice != null ? ' on-sale' : ''}`}>
                {offer.listPrice != null && <span className="price-was">⦿ {offer.listPrice}</span>}
                <span className="price-now">⦿ {offer.price}</span>
              </div>
            </div>
          );
        })}
        {offers.length === 0 && <p className="shop-empty">Sold out — nothing left to buy.</p>}
      </div>
    </ShopFrame>
  );
}
