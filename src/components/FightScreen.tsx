import { useRef } from 'react';
import { useGame } from '../useGame';
import type { Run } from '../run';
import { BattleScreen } from './BattleScreen';

interface FightScreenProps {
  run: Run;
  onWin: () => void;
  onLose: () => void;
}

// Derive a stable, per-fight seed from the run seed so each fight is reproducible
// but distinct.
function fightSeed(run: Run): number {
  const fightIndex = run.location.kind === 'fight' ? run.location.fightIndex : 0;
  return (Math.imul(run.seed ^ 0x9e3779b9, 0x85ebca6b) + fightIndex * 0x27d4eb2f + 1) >>> 0;
}

// One fight within the run. Mounted fresh per fight (keyed by fight index), so its
// useGame builds a fresh battle from this fight's config. On end, resolves the
// fight into the run.
export function FightScreen({ run, onWin, onLose }: FightScreenProps) {
  // Capture config and seed once on mount (this component is remounted per fight).
  const config = useRef(run.toBattleConfig()).current;
  const seed = useRef(fightSeed(run)).current;
  const ctrl = useGame(seed, config);

  const onBattleEnd = () => {
    if (ctrl.game.status === 'win') onWin();
    else onLose();
  };

  return (
    <BattleScreen
      game={ctrl.game}
      view={ctrl.view}
      fx={ctrl.fx}
      animating={ctrl.animating}
      shakeTick={ctrl.shakeTick}
      playCard={ctrl.playCard}
      skipTurn={ctrl.skipTurn}
      endTurn={ctrl.endTurn}
      onBattleEnd={onBattleEnd}
    />
  );
}
