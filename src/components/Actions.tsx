import type { Game } from '../engine';

interface ActionsProps {
  game: Game;
  animating: boolean; // lock the buttons while an animation sequence plays
  hasSelection: boolean;
  onSkip: () => void;
  onEndTurn: () => void;
  onCancel: () => void;
}

export function Actions({ game, animating, hasSelection, onSkip, onEndTurn, onCancel }: ActionsProps) {
  const over = game.status !== 'playing';
  // Until the player commits a card this turn, ending the turn also rests for MP,
  // so the primary button doubles as Rest and advertises the MP it will recover.
  // At full MP (or the 2+-cards lockout) the rest yields 0 — advertising "+0 MP"
  // reads as a zero benefit (#37), so the button is just "End Turn" then.
  const resting = game.canSkip();
  const restAmount = game.restAmount();
  const showRest = resting && restAmount > 0;
  return (
    <section className="buttons">
      <button
        className="primary"
        disabled={over || animating}
        onClick={resting ? onSkip : onEndTurn}
        title={showRest ? 'Play no cards, rest to regain MP, then end your turn' : undefined}
      >
        {showRest ? `Rest & End Turn (+${restAmount} MP)` : 'End Turn'}
      </button>
      {hasSelection && <button onClick={onCancel}>Cancel targeting</button>}
    </section>
  );
}
