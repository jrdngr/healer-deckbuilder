import type { Game } from '../engine';

interface ActionsProps {
  game: Game;
  hasSelection: boolean;
  onSkip: () => void;
  onEndTurn: () => void;
  onCancel: () => void;
}

export function Actions({ game, hasSelection, onSkip, onEndTurn, onCancel }: ActionsProps) {
  const over = game.status !== 'playing';
  return (
    <section className="buttons">
      <button
        className="danger"
        disabled={over || !game.canSkip()}
        onClick={onSkip}
        title="Play no cards, rest to regain MP, then end your turn"
      >
        Rest
      </button>
      <button className="primary" disabled={over} onClick={onEndTurn}>End Turn</button>
      {hasSelection && <button onClick={onCancel}>Cancel targeting</button>}
    </section>
  );
}
