import { resolveCard, makeDeckCard } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { Card } from './Card';

interface CardRewardScreenProps {
  run: Run;
  act: RunAct;
}

// The free card pick after every won fight (#57): three rolled, rarity-weighted
// cards — choose one to add to the deck, or walk on empty-handed (mirroring spoils).
export function CardRewardScreen({ run, act }: CardRewardScreenProps) {
  if (run.location.kind !== 'cardReward' || run.nodeContent?.type !== 'cardReward') return null;
  const offers = run.nodeContent.offers;

  return (
    <main className="shop-screen">
      <header className="shop-head">
        <div>
          <h2>Spoils of Battle</h2>
          <p>Victory yields a new card. Choose one — it joins your deck for free.</p>
        </div>
        <span className="run-gold" title="Gold">⦿ {run.gold}</span>
      </header>
      <div className="shop-offers">
        {offers.map((offer, i) => (
          <div className="shop-offer" key={offer.cardId}>
            <Card
              card={resolveCard(makeDeckCard(offer.cardId, -1))}
              affordable
              selected={false}
              onClick={() => act((r) => r.pickCardReward(i))}
            />
            <div className={`offer-price ${offer.rarity}`}>{offer.rarity}</div>
          </div>
        ))}
      </div>
      <button className="leave-btn" onClick={() => act((r) => r.skipCardReward())}>Take nothing</button>
    </main>
  );
}
