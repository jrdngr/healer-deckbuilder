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
  const resting = game.canSkip();
  return (
    <section className="buttons">
      <button
        className="primary"
        disabled={over || animating}
        onClick={resting ? onSkip : onEndTurn}
        title={resting ? 'Play no cards, rest to regain MP, then end your turn' : undefined}
      >
        {resting ? `Rest & End Turn (+${game.restAmount()} MP)` : 'End Turn'}
      </button>
      {hasSelection && <button onClick={onCancel}>Cancel targeting</button>}
    </section>
  );
}
