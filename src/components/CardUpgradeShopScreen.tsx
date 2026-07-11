import { useState } from 'react';
import { MODIFIERS, canApplyModifier } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { ShopFrame } from './ShopFrame';
import { DeckPicker } from './DeckPicker';

interface CardUpgradeShopScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Buy upgrade modifiers and apply each to a deck card with a free, eligible slot.
// Step 1: pick an affordable modifier offer. Step 2: pick the target card.
export function CardUpgradeShopScreen({ run, act, onDone }: CardUpgradeShopScreenProps) {
  const [selected, setSelected] = useState<number | null>(null);
  if (run.nodeContent?.type !== 'cardUpgrade') return null;
  const offers = run.nodeContent.offers;
  const selectedOffer = selected != null ? offers[selected] : null;

  return (
    <ShopFrame
      title="Upgrade Shop"
      gold={run.gold}
      onLeave={onDone}
    >
      <div className="shop-offers">
        {offers.map((offer, i) => {
          const affordable = run.gold >= offer.price;
          const mod = MODIFIERS[offer.modifier];
          return (
            <button
              key={offer.modifier}
              className={`mod-offer ${offer.rarity}${selected === i ? ' selected' : ''}`}
              disabled={!affordable}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <span className="mod-name">{mod.name}</span>
              <span className="mod-desc">{mod.desc}</span>
              <span className="offer-price">⦿ {offer.price}</span>
            </button>
          );
        })}
        {offers.length === 0 && <p className="shop-empty">No modifiers left.</p>}
      </div>

      {selectedOffer && (
        <div className="upgrade-target">
          <h3>Apply {MODIFIERS[selectedOffer.modifier].name} to a card</h3>
          <DeckPicker
            deck={run.deck}
            canPick={(c) => canApplyModifier(c, selectedOffer.modifier)}
            onPick={(uid) => {
              act((r) => r.buyModifierOffer(selected as number, uid));
              setSelected(null);
            }}
            emptyText="No card can take this modifier."
          />
          <button className="leave-btn" onClick={() => setSelected(null)}>Cancel</button>
        </div>
      )}
    </ShopFrame>
  );
}
