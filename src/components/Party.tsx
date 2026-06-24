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
        // Hide the telegraph (targeted outline + bar chunks) while a sequence
        // plays or the fight is over; it reflects the next turn, which shouldn't
        // show during the current attack.
        const showTelegraph = !animating && !over;
        const targetedByEnemy =
          showTelegraph && !!tg && !tg.hidden && tg.targets.includes(m.slot) && m.alive;
        return (
          <MemberCard
            key={m.slot}
            member={m}
            displayHp={view.memberHp[m.slot]}
            displayDead={view.memberDead[m.slot]}
            mageCharge={game.mageCharge}
            targetedByEnemy={targetedByEnemy}
            incomingDamage={showTelegraph ? (game.predictedDamage(m.slot) ?? 0) : 0}
            pendingRegen={showTelegraph ? game.predictedRegen(m.slot) : 0}
            validTarget={isValidTarget(m.slot)}
            onClick={() => onMemberClick(m.slot)}
          />
        );
      })}
    </section>
  );
}
