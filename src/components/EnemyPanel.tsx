import type { Game } from '../engine';

interface EnemyPanelProps {
  game: Game;
  // HP the bar shows; staged by the animator so it steps down with each hit.
  displayHp: number;
  animating: boolean;
}

export function EnemyPanel({ game, displayHp, animating }: EnemyPanelProps) {
  const e = game.enemy;
  // Dark-green chunk attached to the right of the HP fill: the next Poison tick.
  const poison = !animating && game.status === 'playing' ? Math.min(game.predictedPoison(), displayHp) : 0;
  const safe = displayHp - poison;
  const pct = (v: number) => (v / e.maxHP) * 100;
  return (
    <section className="enemy">
      <div className="enemy-head">
        <h2>Enemy {e.enraged && <span className="enrage">ENRAGED</span>}</h2>
        <div className="bar enemy-bar">
          <div className="bar-track">
            <div className="seg enemy" style={{ left: 0, width: `${pct(safe)}%` }} />
            {poison > 0 && <div className="seg poison-pending" style={{ left: `${pct(safe)}%`, width: `${pct(poison)}%` }} />}
          </div>
          <span className="bar-label">{displayHp} / {e.maxHP} HP</span>
        </div>
        <div className="enemy-status">{e.poison > 0 ? `☠ Poison ${e.poison}` : ''}</div>
      </div>
    </section>
  );
}
