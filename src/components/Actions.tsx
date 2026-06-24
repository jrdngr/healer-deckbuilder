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
  return (
    <section className="buttons">
      <button
        className="danger"
        disabled={over || animating || !game.canSkip()}
        onClick={onSkip}
        title="Play no cards, rest to regain MP, then end your turn"
      >
        Rest
      </button>
      <button className="primary" disabled={over || animating} onClick={onEndTurn}>End Turn</button>
      {hasSelection && <button onClick={onCancel}>Cancel targeting</button>}
    </section>
  );
}
