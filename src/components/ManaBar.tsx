import type { Game } from '../engine';
import { Icon } from './Icon';
import { StatBar } from './Bars';

export function ManaBar({ game, animating }: { game: Game; animating: boolean }) {
  const live = !animating && game.status === 'playing';
  // Lighter-blue chunk past the current MP: what Refresh will restore next turn.
  const refresh = live ? game.predictedRefresh() : 0;
  // Purple chunk carved out of the current MP: what the Hexweaver's Siphon (#13)
  // will drain next enemy phase — shown at the right edge of the filled bar.
  const siphon = live ? game.predictedSiphon() : 0;
  // The cap is the healer's (upgradable) maxMana, not the base constant.
  const max = game.maxMana;
  const mpPct = (game.mp / max) * 100;
  return (
    <section className="controls">
      <StatBar
        className="mp-bar"
        label={`MP ${game.mp} / ${max}`}
        extra={<>
          {game.refresh > 0 && <span className="refresh-pill"><Icon name="plus" /> +{game.refresh}</span>}
          {siphon > 0 && <span className="siphon-pill" title="The enemy will drain this much MP next turn."><Icon name="drop" /> −{siphon}</span>}
        </>}
      >
        <div className="seg mp" style={{ left: 0, width: `${mpPct}%` }} />
        {siphon > 0 && <div className="seg siphon-pending" style={{ left: `${((game.mp - siphon) / max) * 100}%`, width: `${(siphon / max) * 100}%` }} />}
        {refresh > 0 && <div className="seg refresh-pending" style={{ left: `${mpPct}%`, width: `${(refresh / max) * 100}%` }} />}
      </StatBar>
    </section>
  );
}
