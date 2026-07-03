import type { Game } from '../engine';

export function ManaBar({ game, animating }: { game: Game; animating: boolean }) {
  // Lighter-blue chunk past the current MP: what Refresh will restore next turn.
  const refresh = !animating && game.status === 'playing' ? game.predictedRefresh() : 0;
  // The cap is the healer's (upgradable) maxMana, not the base constant.
  const max = game.maxMana;
  return (
    <section className="controls">
      <div className="bar mp-bar">
        <div className="bar-track">
          <div className="seg mp" style={{ left: 0, width: `${(game.mp / max) * 100}%` }} />
          {refresh > 0 && <div className="seg refresh-pending" style={{ left: `${(game.mp / max) * 100}%`, width: `${(refresh / max) * 100}%` }} />}
        </div>
        <span className="bar-label">MP {game.mp} / {max}</span>
        {game.refresh > 0 && <span className="refresh-pill">⟳ +{game.refresh}</span>}
      </div>
    </section>
  );
}
