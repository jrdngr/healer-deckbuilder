import { resolveCard } from '../constants';
import type { DeckCard } from '../constants';
import { Card } from './Card';

interface DeckPickerProps {
  deck: DeckCard[];
  // Which cards are selectable right now (e.g. eligible for a modifier).
  canPick: (card: DeckCard) => boolean;
  onPick: (uid: number) => void;
  emptyText?: string;
}

// A grid of the run deck for choosing a single card (upgrade target, removal,
// shrine bless). Non-pickable cards are dimmed and inert.
export function DeckPicker({ deck, canPick, onPick, emptyText }: DeckPickerProps) {
  const anyPickable = deck.some(canPick);
  return (
    <div className="deck-picker">
      {deck.map((dc) => {
        const pickable = canPick(dc);
        return (
          <Card
            key={dc.uid}
            card={resolveCard(dc)}
            affordable={pickable}
            selected={false}
            onClick={() => { if (pickable) onPick(dc.uid); }}
          />
        );
      })}
      {!anyPickable && <p className="shop-empty">{emptyText ?? 'No eligible cards.'}</p>}
    </div>
  );
}
