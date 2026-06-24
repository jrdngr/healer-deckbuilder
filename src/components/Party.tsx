import { MemberCard } from './MemberCard';
import type { Slot } from '../constants';
import type { Game } from '../engine';
import type { BattleView } from '../useGame';

interface PartyProps {
  game: Game;
  view: BattleView;
  animating: boolean;
  isValidTarget: (slot: Slot) => boolean;
  onMemberClick: (slot: Slot) => void;
}

export function Party({ game, view, animating, isValidTarget, onMemberClick }: PartyProps) {
  const over = game.status !== 'playing';
  const tg = game.telegraph;
  return (
    <section className="party">
      {game.members.map((m) => {
        // Hide the "targeted" outline while a sequence plays; it reflects the
        // next turn's telegraph, which shouldn't glow during the current attack.
        const targetedByEnemy =
          !animating && !over && !!tg && !tg.hidden && tg.targets.includes(m.slot) && m.alive;
        return (
          <MemberCard
            key={m.slot}
            member={m}
            displayHp={view.memberHp[m.slot]}
            displayDead={view.memberDead[m.slot]}
            mageCharge={game.mageCharge}
            targetedByEnemy={targetedByEnemy}
            validTarget={isValidTarget(m.slot)}
            onClick={() => onMemberClick(m.slot)}
          />
        );
      })}
    </section>
  );
}
