import { FIGHT_COUNT, ACT_COUNT } from '../constants';
import { NODE_META } from './nodeMeta';

interface StartScreenProps {
  onBegin: () => void;
  hasSave: boolean;
  onContinue: () => void;
}

// The opening map: the run starts here, and the player manually enters the first
// (easiest) fight. If a saved run exists, offer to resume it.
export function StartScreen({ onBegin, hasSave, onContinue }: StartScreenProps) {
  const fight = NODE_META.fight;
  return (
    <main className="map-screen">
      <h2 className="map-title">Your run begins</h2>
      <p className="map-sub">
        {ACT_COUNT} acts and {FIGHT_COUNT} fights stand between you and the final boss — three act
        bosses along the way, each act tougher than the last. Keep your party alive.
      </p>
      {hasSave && (
        <div className="map-branch start-branch">
          <button className="primary map-take" onClick={onContinue}>Continue your saved run</button>
        </div>
      )}
      <div className="map-branch start-branch">
        <div className="map-node">
          <span className="map-node-icon" aria-hidden>{fight.icon}</span>
          <span className="map-node-label">Fight 1 / {FIGHT_COUNT}</span>
          <span className="map-node-desc">The first foe — the weakest of the run.</span>
        </div>
        <button className={hasSave ? 'map-take' : 'primary map-take'} onClick={onBegin}>
          {hasSave ? 'Start a new run instead' : 'Enter the first fight'}
        </button>
      </div>
    </main>
  );
}
