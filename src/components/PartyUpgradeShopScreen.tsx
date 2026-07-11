import { useState } from 'react';
import { memberDefAt } from '../constants';
import type { Slot } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { ShopFrame } from './ShopFrame';
import { MemberPick, MemberStatLine } from './MemberList';

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
        {run.party.map((p, slot) => (
          <MemberPick
            key={slot}
            name={memberDefAt(run.party, slot).name}
            stats={<MemberStatLine maxHP={p.maxHP} damage={p.damage} abilityPower={p.abilityPower} />}
            disabled={!selectedOffer}
            onClick={() => {
              if (selected == null) return;
              act((r) => r.buyPartyOffer(selected, slot as Slot));
              setSelected(null);
            }}
          />
        ))}
      </div>
      {selectedOffer && <p className="shop-hint">Choose a member to apply {selectedOffer.def.name}.</p>}
    </ShopFrame>
  );
}
