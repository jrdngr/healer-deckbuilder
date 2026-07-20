import type { Game } from '../engine';
import { Tooltip } from './Tooltip';

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
  // Rest is all-or-nothing, and the button says which side of that line the turn is
  // on: red "Rest" while no card has been committed, yellow "End Turn" the moment one
  // is. The colour tracks cards-played, NOT whether MP would actually be gained — at
  // full MP it still reads red and honestly advertises "+0 MP" (deliberately unlike
  // #37's never-show-a-zero rule: here the number must always match reality).
  const resting = game.canSkip();
  const restAmount = game.restAmount();
  return (
    <section className="buttons">
      <Tooltip content={resting ? 'Play no cards, rest to regain MP, then end your turn' : undefined}>
        <button
          className={`primary${resting ? ' danger' : ''}`}
          disabled={over || animating}
          onClick={resting ? onSkip : onEndTurn}
        >
          {resting ? `Rest (+${restAmount} MP)` : 'End Turn'}
        </button>
      </Tooltip>
      {hasSelection && <button onClick={onCancel}>Cancel targeting</button>}
    </section>
  );
}
