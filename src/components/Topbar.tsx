interface TopbarProps {
  seedField: string;
  onSeedChange: (value: string) => void;
  onNewRun: () => void;
  gold: number;
  progress: string;
}

export function Topbar({ seedField, onSeedChange, onNewRun, gold, progress }: TopbarProps) {
  return (
    <header className="topbar">
      <h1>Healer Deckbuilder <span className="tag">prototype</span></h1>
      <div className="run-status">
        <span className="run-progress">{progress}</span>
        <span className="run-gold" title="Gold">⦿ {gold}</span>
      </div>
      <div className="newgame">
        <label>
          Seed{' '}
          <input
            type="number"
            value={seedField}
            onChange={(e) => onSeedChange(e.target.value)}
          />
        </label>
        <button onClick={onNewRun}>New Run</button>
      </div>
    </header>
  );
}
