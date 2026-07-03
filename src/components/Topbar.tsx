import { useState } from 'react';
import { toggleAnimSpeed, animSpeedLabel } from '../settings';
import { RELICS } from '../constants';
import type { RelicId } from '../constants';

interface TopbarProps {
  seedField: string;
  onSeedChange: (value: string) => void;
  onNewRun: () => void;
  gold: number;
  progress: string;
  relics: RelicId[];
}

export function Topbar({ seedField, onSeedChange, onNewRun, gold, progress, relics }: TopbarProps) {
  const [confirming, setConfirming] = useState(false);
  const [, forceSpeed] = useState(0);

  return (
    <header className="topbar">
      <h1>Healer Deckbuilder <span className="tag">prototype</span></h1>
      <div className="run-status">
        <span className="run-progress">{progress}</span>
        <span className="run-gold" title="Gold">⦿ {gold}</span>
        {relics.length > 0 && (
          <span className="relic-row" aria-label="Relics">
            {relics.map((id) => (
              <span key={id} className="relic-badge" title={`${RELICS[id].name} — ${RELICS[id].desc}`}>
                {RELICS[id].icon}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="newgame">
        <button
          className="speed-toggle"
          title="Animation speed"
          onClick={() => { toggleAnimSpeed(); forceSpeed((x) => x + 1); }}
        >
          Speed {animSpeedLabel()}
        </button>
        <label>
          Seed{' '}
          <input
            type="number"
            value={seedField}
            onChange={(e) => onSeedChange(e.target.value)}
          />
        </label>
        <button onClick={() => setConfirming(true)}>New Run</button>
      </div>

      {confirming && (
        <div className="overlay" onClick={() => setConfirming(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <h2>Start a new run?</h2>
            <p>Your current run will be lost.</p>
            <div className="overlay-actions">
              <button onClick={() => setConfirming(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  setConfirming(false);
                  onNewRun();
                }}
              >
                New Run
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
