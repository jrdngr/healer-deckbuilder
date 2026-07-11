import { FIGHT_COUNT, ACT_COUNT, actOfFight } from '../constants';
import { NODE_META } from './nodeMeta';
import { loadStats } from '../stats';

interface StartScreenProps {
  onBegin: () => void;
  hasSave: boolean;
  /** Fight index the save is at or headed toward (null when no save). */
  savedFightIndex: number | null;
  onContinue: () => void;
}

// The opening screen. There is one way to play (2026-07): begin the run by drafting
// your first hero. If a saved run exists, offer to resume it.
export function StartScreen({ onBegin, hasSave, savedFightIndex, onContinue }: StartScreenProps) {
  const stats = loadStats();
  const fight = NODE_META.fight;
  return (
    <main className="map-screen">
      <h2 className="map-title">Your run begins</h2>
      {hasSave && (
        <div className="map-branch start-branch">
          {savedFightIndex != null && (
            <div className="map-node">
              <span className="map-node-icon" aria-hidden>{fight.icon}</span>
              <span className="map-node-label">
                Act {actOfFight(savedFightIndex) + 1} / {ACT_COUNT} · Fight {savedFightIndex + 1} / {FIGHT_COUNT}
              </span>
            </div>
          )}
          <button className="primary map-take" onClick={onContinue}>Continue your saved run</button>
        </div>
      )}
      <div className="map-branch start-branch">
        <div className="map-node">
          <span className="map-node-icon" aria-hidden>{fight.icon}</span>
          <span className="map-node-label">Draft your first hero</span>
        </div>
        <button className={hasSave ? 'map-take' : 'primary map-take'} onClick={onBegin}>
          {hasSave ? 'Start a new run instead' : 'Begin your journey'}
        </button>
      </div>
      {stats.bestAct > 0 && (
        <p className="map-sub stats-line">
          Wins {stats.wins} / {stats.runs} — best act reached: {stats.bestAct} / {ACT_COUNT}
        </p>
      )}
    </main>
  );
}
