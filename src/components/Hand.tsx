import { useState } from 'react';
import { resolveCard } from '../constants';
import type { ResolvedCard } from '../constants';
import type { Game } from '../engine';
import { Card } from './Card';
import { groupPile } from '../deckView';

interface HandProps {
  game: Game;
  disabled: boolean; // dim the hand while an animation sequence plays
  selectedIndex: number | null;
  selectedCard: ResolvedCard | null;
  onCardClick: (handIndex: number) => void;
}

function promptFor(card: ResolvedCard, game: Game): string {
  // A dead-target card (Resurrect) with only Incapacitated corpses can't be played
  // on anyone — surface that here instead of a silent no-op when the card is clicked
  // (#33). Incapacitation is a run-layer scar, healed at an Infirmary, not in-fight.
  if (card.target === 'dead') {
    const dead = game.members.filter((m) => !m.alive);
    if (dead.length > 0 && dead.every((m) => m.incapacitated)) {
      return `${card.name} can't reach the Incapacitated — heal a scar at an Infirmary to restore them.`;
    }
  }
  const kind = card.target === 'dead' ? 'a dead member'
    : card.target === 'ability' ? 'a living member (fires their ability)'
    : 'a living member';
  return `Select ${kind} for ${card.name} — or Cancel`;
}

export function Hand({ game, disabled, selectedIndex, selectedCard, onCardClick }: HandProps) {
  const over = game.status !== 'playing';
  // In-fight deck viewer (#24): click a pile to see its contents (grouped and
  // name-sorted — the draw pile's order is never leaked).
  const [viewing, setViewing] = useState<'draw' | 'discard' | null>(null);
  const viewed = viewing === 'draw' ? game.drawPile : viewing === 'discard' ? game.discardPile : null;
  return (
    <section className="hand-wrap">
      <h3 id="hand-prompt" className={selectedCard ? 'targeting' : undefined}>
        {selectedCard ? promptFor(selectedCard, game) : 'Your hand'}
      </h3>
      <div className={`hand-area${disabled ? ' busy' : ''}`}>
        <button className="pile draw-pile" title="Draw pile — click to view (contents shown unordered)"
          onClick={() => setViewing(viewing === 'draw' ? null : 'draw')}>
          <span className="pile-count">{game.drawPile.length}</span>
          <span className="pile-label">Draw</span>
        </button>
        <div className="hand">
          {game.hand.map((dc, i) => {
            const card = resolveCard(dc);
            const affordable = game.mp >= game.effectiveCost(card) && !over && !disabled;
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
        <button className="pile discard-pile" title="Discard pile — click to view"
          onClick={() => setViewing(viewing === 'discard' ? null : 'discard')}>
          <span className="pile-count">{game.discardPile.length}</span>
          <span className="pile-label">Discard</span>
        </button>
      </div>
      {viewed && (
        <div className="pile-viewer" role="dialog" aria-label={`${viewing} pile contents`}>
          <h4>{viewing === 'draw' ? `Draw pile (${viewed.length}, unordered)` : `Discard (${viewed.length})`}</h4>
          {viewed.length === 0 && <p className="pile-empty">Empty.</p>}
          <ul>
            {groupPile(viewed).map((g) => (
              <li key={g.label}>{g.count}× {g.label}</li>
            ))}
          </ul>
          <button className="leave-btn" onClick={() => setViewing(null)}>Close</button>
        </div>
      )}
    </section>
  );
}
