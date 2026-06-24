import { MP_MAX } from '../constants';
import type { Game } from '../engine';

export function ManaBar({ game, animating }: { game: Game; animating: boolean }) {
  // Lighter-blue chunk past the current MP: what Refresh will restore next turn.
  const refresh = !animating && game.status === 'playing' ? game.predictedRefresh() : 0;
  return (
    <section className="controls">
      <div className="bar mp-bar">
        <div className="bar-track">
          <div className="seg mp" style={{ left: 0, width: `${(game.mp / MP_MAX) * 100}%` }} />
          {refresh > 0 && <div className="seg refresh-pending" style={{ left: `${(game.mp / MP_MAX) * 100}%`, width: `${(refresh / MP_MAX) * 100}%` }} />}
        </div>
        <span className="bar-label">MP {game.mp} / {MP_MAX}</span>
        {game.refresh > 0 && <span className="refresh-pill">⟳ +{game.refresh}</span>}
      </div>
    </section>
  );
}
