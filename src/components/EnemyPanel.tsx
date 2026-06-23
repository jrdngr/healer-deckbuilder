import type { Game } from '../engine';

export function EnemyPanel({ game }: { game: Game }) {
  const e = game.enemy;
  return (
    <section className="enemy">
      <div className="enemy-head">
        <h2>Enemy {e.enraged && <span className="enrage">ENRAGED</span>}</h2>
        <div className="bar enemy-bar">
          <div className="bar-fill" style={{ width: `${(e.hp / e.maxHP) * 100}%` }} />
          <span className="bar-label">{e.hp} / {e.maxHP} HP</span>
        </div>
        <div className="enemy-status">{e.poison > 0 ? `☠ Poison ${e.poison}` : ''}</div>
      </div>
    </section>
  );
}
