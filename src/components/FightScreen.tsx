import { useEffect, useRef } from 'react';
import { useGame } from '../useGame';
import type { GameController } from '../useGame';
import type { Run } from '../run';
import type { RelicId, Slot } from '../constants';
import { BattleScreen } from './BattleScreen';

interface FightScreenProps {
  run: Run;
  onWin: () => void;
  onLose: () => void;
  onSpent: (ids: RelicId[]) => void;
  // Slots of members that died this fight (DR1) — recorded as persistent scars.
  onInjuries: (slots: Slot[]) => void;
  // Publishes this fight's controller up to App so the dev panel can reach the
  // live engine; receives null when the fight unmounts.
  onController?: (ctrl: GameController | null) => void;
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
export function FightScreen({ run, onWin, onLose, onSpent, onInjuries, onController }: FightScreenProps) {
  // Capture config and seed once on mount (this component is remounted per fight).
  const config = useRef(run.toBattleConfig()).current;
  const seed = useRef(fightSeed(run)).current;
  const ctrl = useGame(seed, config);

  // Hand the controller to App for the duration of this fight; clear it on unmount.
  useEffect(() => {
    onController?.(ctrl);
    return () => onController?.(null);
  }, [ctrl, onController]);

  const onBattleEnd = () => {
    // Report once-per-RUN relic uses (#22) before the run resolves the outcome.
    onSpent(ctrl.game.spentRelicIds());
    if (ctrl.game.status === 'win') {
      // Record scars (DR1) BEFORE winFight, so a post-victory scar-clearing relic
      // (Mending Totem) sees this fight's injuries.
      onInjuries(ctrl.game.diedThisFightSlots());
      onWin();
    } else onLose();
  };

  return (
    <BattleScreen
      game={ctrl.game}
      view={ctrl.view}
      fx={ctrl.fx}
      reacts={ctrl.reacts}
      animating={ctrl.animating}
      shakeTick={ctrl.shakeTick}
      playCard={ctrl.playCard}
      skipTurn={ctrl.skipTurn}
      endTurn={ctrl.endTurn}
      onBattleEnd={onBattleEnd}
    />
  );
}
