import type { Run } from '../run';
import { FIGHT_COUNT } from '../constants';

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
        <p className="runover-stats">
          Fights won: {run.fightsWon} / {FIGHT_COUNT} · Relics: {run.relics.length} · Deck: {run.deck.length} cards · Gold left: {run.gold}
        </p>
        {(() => {
          const s = run.runScore();
          return (
            <p className="runover-score" title="Progress and relics score points; hoarded gold costs them — spend it next time.">
              Score: <strong>{s.total}</strong>
              {' '}({s.fights} fights{s.relics > 0 ? ` + ${s.relics} relics` : ''}
              {s.victory > 0 ? ` + ${s.victory} victory` : ''}
              {s.goldPenalty < 0 ? ` − ${-s.goldPenalty} hoarded gold` : ''})
            </p>
          );
        })()}
        <button className="primary" onClick={onNewRun}>New Run</button>
      </div>
    </main>
  );
}
