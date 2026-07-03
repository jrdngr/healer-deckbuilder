import { useState } from 'react';
import { CARD_REMOVAL_PRICE } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { RelicTile } from './RelicTile';
import { ShopFrame } from './ShopFrame';
import { DeckPicker } from './DeckPicker';

interface ReliquaryScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// The Reliquary node (#21): a relic storefront plus a capped card-removal
// service at the standard removal price.
export function ReliquaryScreen({ run, act, onDone }: ReliquaryScreenProps) {
  const [removing, setRemoving] = useState(false);
  if (run.nodeContent?.type !== 'reliquary') return null;
  const { offers, removalsLeft } = run.nodeContent;

  return (
    <ShopFrame
      title="Reliquary"
      subtitle="Relics last the rest of the run. The keeper also disposes of unwanted cards."
      gold={run.gold}
      onLeave={onDone}
    >
      <div className="shop-offers">
        {offers.map((offer, i) => (
          <RelicTile
            key={offer.relicId}
            offer={offer}
            affordable={run.gold >= offer.price}
            onClick={() => act((r) => r.buyRelicOffer(i))}
          />
        ))}
        {offers.length === 0 && <p className="shop-empty">Sold out — the shelves are bare.</p>}
      </div>

      {!removing && (
        <button
          className="leave-btn"
          disabled={removalsLeft <= 0 || run.gold < CARD_REMOVAL_PRICE}
          onClick={() => setRemoving(true)}
        >
          Remove a card ({CARD_REMOVAL_PRICE}g · {removalsLeft} left)
        </button>
      )}
      {removing && (
        <div className="event-pick">
          <h3>Choose a card to remove ({CARD_REMOVAL_PRICE}g · {removalsLeft} left)</h3>
          <DeckPicker
            deck={run.deck}
            canPick={() => run.gold >= CARD_REMOVAL_PRICE && removalsLeft > 0}
            onPick={(uid) => {
              act((r) => r.reliquaryRemoveCard(uid));
              setRemoving(false);
            }}
          />
          <button className="leave-btn" onClick={() => setRemoving(false)}>Back</button>
        </div>
      )}
    </ShopFrame>
  );
}
