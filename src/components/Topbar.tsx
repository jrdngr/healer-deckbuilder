interface TopbarProps {
  seedField: string;
  onSeedChange: (value: string) => void;
  onNewFight: () => void;
}

export function Topbar({ seedField, onSeedChange, onNewFight }: TopbarProps) {
  return (
    <header className="topbar">
      <h1>Healer Deckbuilder <span className="tag">prototype</span></h1>
      <div className="newgame">
        <label>
          Seed{' '}
          <input
            type="number"
            value={seedField}
            onChange={(e) => onSeedChange(e.target.value)}
          />
        </label>
        <button onClick={onNewFight}>New Fight</button>
      </div>
    </header>
  );
}
