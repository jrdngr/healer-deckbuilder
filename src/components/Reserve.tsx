import type { PointerEvent as ReactPointerEvent } from 'react';
import { resolveCard } from '../constants';
import type { Game } from '../engine';
import { Card } from './Card';

interface ReserveProps {
  game: Game;
  animating: boolean;
  // Begin playing the reserved card via a click (two-click targeting, like a hand card):
  // a no-target card plays at once; a single/dead-target card enters targeting.
  onCardClick: () => void;
  // Begin a drag from the reserved card — drag it onto a hero/board to play it, or onto
  // the discard pile to release it. BattleScreen decides play-vs-release on release point.
  onCardPointerDown: (e: ReactPointerEvent) => void;
  // The reserved card is the live targeting source right now (its play was begun and a
  // hero pick is pending) — highlight the zone so it reads as "choose a target".
  targeting: boolean;
  // The reserved card is the source of an in-progress drag — dim it in place while its
  // ghost follows the cursor.
  dragging: boolean;
}

// "The Reserve" (91a): the one card held across turns. Sits between the draw pile and the
// hand. Reserving is FREE (drag a hand card onto the empty slot, or use the card's Reserve
// affordance), but holding costs an escalating end-of-turn MP upkeep (1, then 2, 3…) shown
// below the MP bar. Play the reserved card by clicking it (then a target) or dragging it
// onto a hero/board; release it by dragging it onto the discard pile.
export function Reserve({ game, animating, onCardClick, onCardPointerDown, targeting, dragging }: ReserveProps) {
  if (game.status !== 'playing') return null;
  const dc = game.reserveCard;
  if (dc == null) {
    // Empty slot: a drop zone for a dragged hand card. `reserve-drop` lets the CSS light it
    // up while a hand-card drag is live (main.drag-from-hand). The gutter width is held so
    // the hand never shifts when a card is reserved or played back.
    return (
      <div className="reserve reserve-empty reserve-drop"
        title="Drag a hand card here (or use its Reserve button) to hold it across turns for an escalating MP upkeep.">
        <span className="reserve-hint">Reserve</span>
      </div>
    );
  }
  const card = resolveCard(dc);
  return (
    <div className={`reserve reserve-full${targeting ? ' targeting' : ''}`}
      title="Click to play (then pick a target), or drag onto a hero to play — drag onto the discard pile to release.">
      <Card
        card={card}
        uid={dc.uid}
        affordable={!animating && game.mp >= game.effectiveCost(card)}
        selected={targeting}
        dragging={dragging}
        onClick={onCardClick}
        onPointerDown={onCardPointerDown}
      />
      <span className="reserve-tag">Reserve</span>
    </div>
  );
}
