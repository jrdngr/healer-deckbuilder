import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { STARTER_DECK_IDS, STARTER_DECKS, CARDS } from '../constants';
import type { CardId, StarterDeckId } from '../constants';

// Summarize a preset's card list as "2x Shadow Bolt · Heal · ..." so the player sees
// what they are choosing before the run begins.
function deckSummary(list: CardId[]): string {
  const counts = new Map<CardId, number>();
  for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, n]) => (n > 1 ? `${n}x ${CARDS[id].name}` : CARDS[id].name))
    .join(' · ');
}

interface StarterDeckScreenProps {
  run: Run;
  act: RunAct;
}

// Preset starter-deck picker (#63): one themed deck chosen at run start, before the
// first-hero draft. Each preset leans on one or two card types.
export function StarterDeckScreen({ run, act }: StarterDeckScreenProps) {
  if (run.location.kind !== 'starterDeck') return null;

  return (
    <main className="shop-screen draft-screen">
      <header className="shop-head">
        <div>
          <h2>Choose your starting deck</h2>
        </div>
      </header>

      <div className="shop-offers draft-offers">
        {STARTER_DECK_IDS.map((id: StarterDeckId) => {
          const d = STARTER_DECKS[id];
          return (
            <button
              key={id}
              className="draft-member"
              onClick={() => act((r) => r.chooseStarterDeck(id))}
              title={d.desc}
            >
              <span className="draft-member-name">{d.name}</span>
              <span className="draft-member-stats">{d.types.map((t) => t[0].toUpperCase() + t.slice(1)).join(' / ')} · {d.list.length} cards</span>
              <span className="draft-member-ability">{deckSummary(d.list)}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
