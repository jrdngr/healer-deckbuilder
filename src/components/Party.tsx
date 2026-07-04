import { MemberCard } from './MemberCard';
import type { Slot } from '../constants';
import type { Game } from '../engine';
import type { BattleView, MemberReactState } from '../useGame';

interface PartyProps {
  game: Game;
  view: BattleView;
  reacts: (MemberReactState | null)[];
  animating: boolean;
  isValidTarget: (slot: Slot) => boolean;
  onMemberClick: (slot: Slot) => void;
}

export function Party({ game, view, reacts, animating, isValidTarget, onMemberClick }: PartyProps) {
  const over = game.status !== 'playing';
  const tg = game.telegraph;
  return (
    <section className="party">
      {game.wounded && (
        <div className="hex-banner" title="A Hex halves all healing until it fades. Cleanse removes it.">
          ☠ Hexed — healing halved ({game.woundTurns})
        </div>
      )}
      {game.members.map((m) => {
        // Hide the "targeted" outline while a sequence plays or the fight is over;
        // it reflects the next turn's telegraph, which shouldn't glow mid-attack.
        const targetedByEnemy =
          !animating && !over && !!tg && !tg.hidden && tg.targets.includes(m.slot) && m.alive;
        return (
          <MemberCard
            key={m.slot}
            member={m}
            displayHp={view.memberHp[m.slot]}
            displayDead={view.memberDead[m.slot]}
            react={reacts[m.slot]}
            mageCharge={game.mageCharge}
            liveDamage={game.memberDamage(m)}
            berserkerBands={m.ability === 'rampage' ? game.berserkerThresholds() : null}
            targetedByEnemy={targetedByEnemy}
            validTarget={isValidTarget(m.slot)}
            onClick={() => onMemberClick(m.slot)}
          />
        );
      })}
    </section>
  );
}
