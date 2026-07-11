import type { Game } from '../engine';
import { Icon } from './Icon';

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
  // A channelled attack (Gatewarden's Crushing Blow, #12): show a cast bar that
  // fills as its wind-up nears resolve.
  const tel = game.telegraph;
  const channel = game.status === 'playing' && tel?.channel ? tel : null;
  const castTurns = channel?.turnsUntilResolve ?? 0;
  return (
    <section className="enemy">
      <div className="enemy-head">
        <h2>
          {game.enemyDef.name} {e.enraged && <span className="enrage">ENRAGED</span>}
          {showCountdown && (
            <span className="enrage-countdown" title="The enemy's attacks grow heavier when it enrages.">
              Enrages in {untilEnrage}
            </span>
          )}
        </h2>
        <div className="bar enemy-bar">
          <div className="bar-track">
            <div className="seg enemy" style={{ left: 0, width: `${pct}%` }} />
          </div>
          <span className="bar-label">{displayHp} / {e.maxHP} HP</span>
        </div>
        <div className="enemy-status">
          {game.status === 'playing' && (
            <span className="turn-chip" title="The current turn. The standing telegraph resolves at the end of it.">Turn {game.turn}</span>
          )}
          {intent && <span className="enemy-intent">Intends: {intent}</span>}
          {e.poison > 0 ? <span className="enemy-poison" title={`Poison — the enemy takes ${e.poison} at the start of each of its turns (${e.poisonTurns} left).`}><Icon name="poison" /> Poison {e.poison}</span> : ''}
        </div>
        {channel && (
          <div className="cast-bar" title={`${channel.channelName}: ${channel.damage} damage on resolve`}>
            <span className="cast-label">
              <Icon name="bolt" /> {channel.channelName} — resolves in {castTurns} turn{castTurns === 1 ? '' : 's'} ({channel.damage})
            </span>
            <div className="cast-track">
              {/* fills as the wind-up nears resolve (1 turn left ≈ full) */}
              <div className="cast-fill" style={{ width: `${Math.max(0, 100 - castTurns * 45)}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
