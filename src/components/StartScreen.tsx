import { FIGHT_COUNT, ACT_COUNT, DIFFICULTIES, DIFFICULTY_IDS, actOfFight } from '../constants';
import type { Difficulty } from '../constants';
import { NODE_META } from './nodeMeta';
import { devUnlocked } from '../settings';
import { loadStats } from '../stats';

interface StartScreenProps {
  onBegin: () => void;
  onDraft: () => void;
  hasSave: boolean;
  /** Fight index the save is at or headed toward (null when no save). */
  savedFightIndex: number | null;
  onContinue: () => void;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
}

// The opening map: the run starts here, and the player manually enters the first
// (easiest) fight. If a saved run exists, offer to resume it.
export function StartScreen({
  onBegin, onDraft, hasSave, savedFightIndex, onContinue, difficulty, onDifficulty,
}: StartScreenProps) {
  const stats = loadStats();
  const presets = DIFFICULTY_IDS.filter((d) => !DIFFICULTIES[d].devOnly || devUnlocked);
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
          {savedFightIndex != null && (
            <div className="map-node">
              <span className="map-node-icon" aria-hidden>{fight.icon}</span>
              <span className="map-node-label">
                Act {actOfFight(savedFightIndex) + 1} / {ACT_COUNT} · Fight {savedFightIndex + 1} / {FIGHT_COUNT}
              </span>
              <span className="map-node-desc">Pick up where you left off.</span>
            </div>
          )}
          <button className="primary map-take" onClick={onContinue}>Continue your saved run</button>
        </div>
      )}
      <div className="map-branch start-branch">
        <div className="map-node">
          <span className="map-node-icon" aria-hidden>{fight.icon}</span>
          <span className="map-node-label">Fight 1 / {FIGHT_COUNT}</span>
          <span className="map-node-desc">The first foe — the weakest of the run.</span>
        </div>
        <div className="difficulty-row" role="radiogroup" aria-label="Difficulty">
          {presets.map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={difficulty === d}
              className={`difficulty-pick${difficulty === d ? ' selected' : ''}`}
              title={DIFFICULTIES[d].desc}
              onClick={() => onDifficulty(d)}
            >
              {DIFFICULTIES[d].name}
            </button>
          ))}
        </div>
        <p className="map-node-desc">{DIFFICULTIES[difficulty].desc}</p>
        <button className={hasSave ? 'map-take' : 'primary map-take'} onClick={onBegin}>
          {hasSave ? 'Start a new run instead' : 'Enter the first fight'}
        </button>
        <button className="map-take" onClick={onDraft} title="Pick your party from the roster">
          Draft your party
        </button>
      </div>
      {stats.bestAct > 0 && (
        <p className="map-sub stats-line">
          Wins — Story {stats.wins.story} · Standard {stats.wins.standard}
          {devUnlocked ? ` · Brutal ${stats.wins.brutal}` : ''} — best act reached: {stats.bestAct} / {ACT_COUNT}
        </p>
      )}
    </main>
  );
}
