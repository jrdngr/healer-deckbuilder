import type { Game } from '../engine';

interface GameOverlayProps {
  game: Game;
  // Advance the run: win -> next node, loss -> run-over screen.
  onContinue: () => void;
}

export function GameOverlay({ game, onContinue }: GameOverlayProps) {
  if (game.status === 'playing') return null;
  const win = game.status === 'win';
  return (
    <div className="overlay">
      <div className={`overlay-card ${game.status}`}>
        <h2>{win ? 'Victory' : 'Defeat'}</h2>
        <p>
          {win
            ? `The enemy fell on turn ${game.turn}.`
            : `The party was wiped on turn ${game.turn}.`}
        </p>
        <button className="primary" onClick={onContinue}>
          {win ? 'Continue' : 'See results'}
        </button>
      </div>
    </div>
  );
}
