import { useState } from 'react';
import { memberDefAt } from '../constants';
import type { Slot } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { ShopFrame } from './ShopFrame';

interface PartyUpgradeShopScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Buy stackable party stat boosts. Step 1: pick an affordable offer. Step 2: pick
// the member to apply it to.
export function PartyUpgradeShopScreen({ run, act, onDone }: PartyUpgradeShopScreenProps) {
  const [selected, setSelected] = useState<number | null>(null);
  if (run.nodeContent?.type !== 'partyUpgrade') return null;
  const offers = run.nodeContent.offers;
  const selectedOffer = selected != null ? offers[selected] : null;

  return (
    <ShopFrame
      title="Training Hall"
      subtitle="Buy a boost, then choose who receives it."
      gold={run.gold}
      onLeave={onDone}
    >
      <div className="shop-offers">
        {offers.map((offer, i) => {
          const affordable = run.gold >= offer.price;
          return (
            <button
              key={offer.def.id}
              className={`mod-offer ${offer.def.rarity}${selected === i ? ' selected' : ''}`}
              disabled={!affordable}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <span className="mod-name">{offer.def.name}</span>
              <span className="mod-desc">{offer.def.desc}</span>
              <span className="offer-price">⦿ {offer.price}</span>
            </button>
          );
        })}
        {offers.length === 0 && <p className="shop-empty">Nothing left to train.</p>}
      </div>

      <div className="member-row">
        {run.party.map((p, slot) => {
          const d = memberDefAt(run.party, slot);
          return (
            <button
              key={slot}
              className="member-pick"
              disabled={!selectedOffer}
              onClick={() => {
                if (selected == null) return;
                act((r) => r.buyPartyOffer(selected, slot as Slot));
                setSelected(null);
              }}
            >
              <span className="member-name">{d.name}</span>
              <span className="member-stats">HP {p.maxHP} · DMG {p.damage} · ABL +{p.abilityPower}</span>
            </button>
          );
        })}
      </div>
      {selectedOffer && <p className="shop-hint">Choose a member to apply {selectedOffer.def.name}.</p>}
    </ShopFrame>
  );
}
