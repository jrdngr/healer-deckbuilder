import type { Game } from '../engine';
import { Icon } from './Icon';
import { CharacterBlob } from './CharacterBlob';
import { StatBar } from './Bars';
import { Tooltip } from './Tooltip';

interface EnemyPanelProps {
  game: Game;
  // HP the bar shows; staged by the animator so it steps down with each hit.
  displayHp: number;
}

export function EnemyPanel({ game, displayHp }: EnemyPanelProps) {
  const e = game.enemy;
  // Single red fill anchored at the left so it depletes from the right. Clamp to
  // [0, 100] so an out-of-range displayHp (overkill below 0, or a stale value
  // above max) still maps to a valid width — 0 HP renders as an empty bar.
  const pct = Math.max(0, Math.min(100, (displayHp / e.maxHP) * 100));
  // Announce the otherwise-invisible enrage race: a pip appears once the enrage is
  // within ~4 turns, so the player can see the clock (flaw #2).
  const untilEnrage = game.turnsUntilEnrage();
  const showCountdown = game.status === 'playing' && !e.enraged && untilEnrage > 0 && untilEnrage <= 4;
  const intent = game.telegraphIntent();
  const intentDetail = game.telegraphDetail();
  // A channelled attack (Gatewarden's Crushing Blow, #12): show a cast bar that
  // fills as its wind-up nears resolve.
  const tel = game.telegraph;
  const channel = game.status === 'playing' && tel?.channel ? tel : null;
  const castTurns = channel?.turnsUntilResolve ?? 0;
  return (
    <section className="enemy">
      <div className="enemy-head">
        <CharacterBlob id={game.enemyDef.id} size={86} isEnemy />
        <h2>
          {game.enemyDef.name} {e.enraged && <Tooltip content="Enraged — the enemy's attacks now hit harder for the rest of the fight."><span className="enrage">ENRAGED</span></Tooltip>}
          {showCountdown && (
            <Tooltip content="The enemy's attacks grow heavier when it enrages.">
              <span className="enrage-countdown">
                Enrages in {untilEnrage}
              </span>
            </Tooltip>
          )}
        </h2>
        <StatBar className="enemy-bar" label={`${displayHp} / ${e.maxHP} HP`}>
          <div className="seg enemy" style={{ left: 0, width: `${pct}%` }} />
        </StatBar>
        <div className="enemy-status">
          {game.status === 'playing' && (
            <Tooltip content="The current turn. The standing telegraph resolves at the end of it."><span className="turn-chip">Turn {game.turn}</span></Tooltip>
          )}
          {intent && <Tooltip content={intentDetail ?? undefined}><span className="enemy-intent">Intends: {intent}</span></Tooltip>}
          {e.poison > 0 ? <Tooltip content={`Poison — the enemy takes ${e.poison} at the start of each of its turns (${e.poisonTurns} left).`}><span className="enemy-poison"><Icon name="poison" /> Poison {e.poison}</span></Tooltip> : ''}
        </div>
        {channel && (
          <Tooltip content={`${channel.channelName}: ${channel.damage} damage on resolve`}>
          <div className="cast-bar">
            <span className="cast-label">
              <Icon name="bolt" /> {channel.channelName} — resolves in {castTurns} turn{castTurns === 1 ? '' : 's'} ({channel.damage})
            </span>
            <div className="cast-track">
              {/* fills as the wind-up nears resolve (1 turn left ≈ full) */}
              <div className="cast-fill" style={{ width: `${Math.max(0, 100 - castTurns * 45)}%` }} />
            </div>
          </div>
          </Tooltip>
        )}
      </div>
    </section>
  );
}
