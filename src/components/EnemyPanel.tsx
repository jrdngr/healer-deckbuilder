import type { Game } from '../engine';

interface EnemyPanelProps {
  game: Game;
  // HP the bar shows; staged by the animator so it steps down with each hit.
  displayHp: number;
}

export function EnemyPanel({ game, displayHp }: EnemyPanelProps) {
  const e = game.enemy;
  return (
    <section className="enemy">
      <div className="enemy-head">
        <h2>Enemy {e.enraged && <span className="enrage">ENRAGED</span>}</h2>
        <div className="bar enemy-bar">
          <div className="bar-fill" style={{ width: `${(displayHp / e.maxHP) * 100}%` }} />
          <span className="bar-label">{displayHp} / {e.maxHP} HP</span>
        </div>
        <div className="enemy-status">{e.poison > 0 ? `☠ Poison ${e.poison}` : ''}</div>
      </div>
    </section>
  );
}
