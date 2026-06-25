import type { Run } from '../run';

interface RunOverScreenProps {
  run: Run;
  onNewRun: () => void;
}

// End-of-run summary: the boss fell, or the party did.
export function RunOverScreen({ run, onNewRun }: RunOverScreenProps) {
  const won = run.status === 'won';
  return (
    <main className="runover-screen">
      <div className={`overlay-card ${won ? 'win' : 'loss'}`}>
        <h2>{won ? 'Run Complete' : 'Run Over'}</h2>
        <p>
          {won
            ? 'You felled the boss and survived the run.'
            : 'The party fell before the boss. The run ends here.'}
        </p>
        <p className="runover-stats">Gold: {run.gold} · Deck: {run.deck.length} cards</p>
        <button className="primary" onClick={onNewRun}>New Run</button>
      </div>
    </main>
  );
}
