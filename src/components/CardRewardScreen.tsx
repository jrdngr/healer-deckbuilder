import { resolveCard, makeDeckCard } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { Card } from './Card';
import { RewardScreen, GoldTag } from './ScreenChrome';

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
    <RewardScreen
      title="Spoils of Battle"
      headerRight={<GoldTag gold={run.gold} />}
      onSkip={() => act((r) => r.skipCardReward())}
      onBack={run.canGoBack() ? () => act((r) => r.goBackToReward()) : undefined}
    >
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
    </RewardScreen>
  );
}
