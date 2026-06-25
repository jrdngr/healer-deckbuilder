import { FIGHT_COUNT } from '../constants';
import { NODE_META } from './nodeMeta';

interface StartScreenProps {
  onBegin: () => void;
}

// The opening map: the run starts here, and the player manually enters the first
// (easiest) fight.
export function StartScreen({ onBegin }: StartScreenProps) {
  const fight = NODE_META.fight;
  return (
    <main className="map-screen">
      <h2 className="map-title">Your run begins</h2>
      <p className="map-sub">
        Five fights stand between you and the boss, each tougher than the last. Keep your party alive.
      </p>
      <div className="map-branch start-branch">
        <div className="map-node">
          <span className="map-node-icon" aria-hidden>{fight.icon}</span>
          <span className="map-node-label">Fight 1 / {FIGHT_COUNT}</span>
          <span className="map-node-desc">The first foe — the weakest of the run.</span>
        </div>
        <button className="primary map-take" onClick={onBegin}>Enter the first fight</button>
      </div>
    </main>
  );
}
