import { useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
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
  // Begin a drag from a hand card (drag-to-target). uid of the card currently being
  // dragged is dimmed in place while its ghost follows the cursor.
  onCardPointerDown: (handIndex: number, e: ReactPointerEvent) => void;
  draggingUid: number | null;
  // Card Bank slot (91a): reserve a hand card. Present only while banking is possible
  // (player phase, the Reserve empty, no animation) — undefined hides the affordance.
  onBank?: (handIndex: number) => void;
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
    : 'a living member';
  return `Select ${kind} for ${card.name} — or Cancel`;
}

export function Hand({ game, disabled, selectedIndex, selectedCard, onCardClick, onCardPointerDown, draggingUid, onBank }: HandProps) {
  const over = game.status !== 'playing';
  // A player-cast channel (#64, #78) is tracked per card id in the engine, so any
  // in-hand copy of the channeling card gets the glow + "channeling · N left" badge.
  const channelingId = game.channelActive() ? game.channelCard : null;
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
            // #54: an ability card whose bound member is down is drawn but unplayable —
            // render it clearly disabled (grayed) rather than only refusing the click.
            const ineligible = game.isAbilityCardDisabled(card);
            return (
              <Card
                key={dc.uid}
                uid={dc.uid}
                card={card}
                affordable={affordable}
                ineligible={ineligible}
                selected={selectedIndex === i}
                onClick={() => onCardClick(i)}
                onPointerDown={(e) => onCardPointerDown(i, e)}
                dragging={draggingUid === dc.uid}
                onBank={onBank ? () => onBank(i) : undefined}
                channelingTurns={channelingId != null && dc.id === channelingId ? game.channelTurns : null}
                // Fan geometry + draw-stagger inputs; uid-keying means only
                // genuinely new cards mount and play the deal-in animation.
                style={{ '--i': i, '--n': game.hand.length } as CSSProperties}
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
