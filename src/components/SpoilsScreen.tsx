import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { RelicTile } from './RelicTile';

interface SpoilsScreenProps {
  run: Run;
  act: RunAct;
}

// The free relic pick after the act-1 and act-2 bosses (#21): take one of the
// offered relics, or walk on empty-handed.
export function SpoilsScreen({ run, act }: SpoilsScreenProps) {
  if (run.location.kind !== 'spoils' || run.nodeContent?.type !== 'spoils') return null;
  const offers = run.nodeContent.offers;

  return (
    <main className="shop-screen">
      <header className="shop-head">
        <div>
          <h2>Spoils of Victory</h2>
          <p>The fallen boss leaves a prize. Choose one relic — it lasts the rest of the run.</p>
        </div>
        <span className="run-gold" title="Gold">⦿ {run.gold}</span>
      </header>
      <div className="shop-offers">
        {offers.map((offer, i) => (
          <RelicTile
            key={offer.relicId}
            offer={offer}
            affordable
            onClick={() => act((r) => r.pickSpoil(i))}
          />
        ))}
      </div>
      <button className="leave-btn" onClick={() => act((r) => r.skipSpoils())}>Take nothing</button>
    </main>
  );
}
