import { MP_MAX } from '../constants';
import type { Game } from '../engine';

export function ManaBar({ game }: { game: Game }) {
  return (
    <section className="controls">
      <div className="bar mp-bar">
        <div className="bar-fill" style={{ width: `${(game.mp / MP_MAX) * 100}%` }} />
        <span className="bar-label">MP {game.mp} / {MP_MAX}</span>
        {game.refresh > 0 && <span className="refresh-pill">⟳ +{game.refresh}</span>}
      </div>
    </section>
  );
}
