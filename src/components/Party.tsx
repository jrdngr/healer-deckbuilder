import { MemberCard } from './MemberCard';
import type { Slot } from '../constants';
import type { Game } from '../engine';

interface PartyProps {
  game: Game;
  isValidTarget: (slot: Slot) => boolean;
  onMemberClick: (slot: Slot) => void;
}

export function Party({ game, isValidTarget, onMemberClick }: PartyProps) {
  const over = game.status !== 'playing';
  const tg = game.telegraph;
  return (
    <section className="party">
      {game.members.map((m) => {
        const targetedByEnemy = !over && !!tg && !tg.hidden && tg.targets.includes(m.slot) && m.alive;
        return (
          <MemberCard
            key={m.slot}
            member={m}
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
