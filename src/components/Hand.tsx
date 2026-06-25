import { resolveCard } from '../constants';
import type { ResolvedCard } from '../constants';
import type { Game } from '../engine';
import { Card } from './Card';

interface HandProps {
  game: Game;
  disabled: boolean; // dim the hand while an animation sequence plays
  selectedIndex: number | null;
  selectedCard: ResolvedCard | null;
  onCardClick: (handIndex: number) => void;
}

function promptFor(card: ResolvedCard): string {
  const kind = card.target === 'dead' ? 'a dead member'
    : card.target === 'ability' ? 'a living member (fires their ability)'
    : 'a living member';
  return `Select ${kind} for ${card.name} — or Cancel`;
}

export function Hand({ game, disabled, selectedIndex, selectedCard, onCardClick }: HandProps) {
  const over = game.status !== 'playing';
  return (
    <section className="hand-wrap">
      <h3 id="hand-prompt" className={selectedCard ? 'targeting' : undefined}>
        {selectedCard ? promptFor(selectedCard) : 'Your hand'}
      </h3>
      <div className={`hand-area${disabled ? ' busy' : ''}`}>
        <div className="pile draw-pile" title="Draw pile">
          <span className="pile-count">{game.drawPile.length}</span>
          <span className="pile-label">Draw</span>
        </div>
        <div className="hand">
          {game.hand.map((dc, i) => {
            const card = resolveCard(dc);
            const affordable = game.mp >= card.cost && !over && !disabled;
            return (
              <Card
                key={dc.uid}
                card={card}
                affordable={affordable}
                selected={selectedIndex === i}
                onClick={() => onCardClick(i)}
              />
            );
          })}
        </div>
        <div className="pile discard-pile" title="Discard pile">
          <span className="pile-count">{game.discardPile.length}</span>
          <span className="pile-label">Discard</span>
        </div>
      </div>
    </section>
  );
}
