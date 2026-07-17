import { useState } from 'react';
import { toggleAnimSpeed, animSpeedLabel } from '../settings';
import { RELICS } from '../constants';
import type { DeckCard, RelicId } from '../constants';
import { groupPile } from '../deckView';
import { GoldTag } from './ScreenChrome';
import { Tooltip } from './Tooltip';

interface TopbarProps {
  seedField: string;
  onSeedChange: (value: string) => void;
  onNewRun: () => void;
  gold: number;
  progress: string;
  relics: RelicId[];
  deck: DeckCard[];
}

export function Topbar({ seedField, onSeedChange, onNewRun, gold, progress, relics, deck }: TopbarProps) {
  const [confirming, setConfirming] = useState(false);
  const [viewingDeck, setViewingDeck] = useState(false);
  const [, forceSpeed] = useState(0);

  return (
    <header className="topbar">
      <h1>Bandage of Brothers <span className="tag">prototype</span></h1>
      <div className="run-status">
        <span className="run-progress">{progress}</span>
        <GoldTag gold={gold} />
        {relics.length > 0 && (
          <span className="relic-row" aria-label="Relics">
            {relics.map((id) => (
              <Tooltip key={id} content={`${RELICS[id].name} — ${RELICS[id].desc}`}>
                <span className="relic-badge">
                  {RELICS[id].icon}
                </span>
              </Tooltip>
            ))}
          </span>
        )}
      </div>
      <div className="newgame">
        <Tooltip content="View your full run deck">
          <button
            className="view-deck"
            onClick={() => setViewingDeck(true)}
          >
            View Deck ({deck.length})
          </button>
        </Tooltip>
        <Tooltip content="Animation speed">
          <button
            className="speed-toggle"
            onClick={() => { toggleAnimSpeed(); forceSpeed((x) => x + 1); }}
          >
            Speed {animSpeedLabel()}
          </button>
        </Tooltip>
        <label htmlFor="seed">
          Seed{' '}
          <input
            id="seed"
            name="seed"
            type="number"
            min={0}
            max={4294967295}
            value={seedField}
            onChange={(e) => onSeedChange(e.target.value)}
          />
        </label>
        <button onClick={() => setConfirming(true)}>New Run</button>
      </div>

      {viewingDeck && (
        <div className="overlay" onClick={() => setViewingDeck(false)}>
          <div
            className="overlay-card deck-view"
            role="dialog"
            aria-label="Your deck"
            tabIndex={-1}
            ref={(el) => el?.focus()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setViewingDeck(false); }}
          >
            <h2>Your deck ({deck.length})</h2>
            {deck.length === 0
              ? <p className="pile-empty">Your deck is empty.</p>
              : (
                <ul className="deck-view-list">
                  {groupPile(deck).map((g) => (
                    <li key={g.label}>{g.count}× {g.label}</li>
                  ))}
                </ul>
              )}
            <div className="overlay-actions">
              <button className="primary" onClick={() => setViewingDeck(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

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
