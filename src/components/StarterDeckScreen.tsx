import type { Run } from '../run';
import type { RunAct } from '../useRun';
import {
  STARTER_DECK_IDS, STARTER_DECKS, DECK_LIST, DRAFT_BASE_HEALS,
  STARTER_DRAFT_PICKS, CARDS, resolveCard, makeDeckCard,
} from '../constants';
import type { CardId, StarterDeckId } from '../constants';
import { Card } from './Card';
import { Tooltip } from './Tooltip';
import { ScreenHeader } from './ScreenChrome';

// Summarize a card list as "3x Quick Heal · Heal · ..." so the player sees what a
// choice contains before committing.
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

// Run-start deck picker: take the fixed Standard deck, or Draft one — seed with the
// shared base heals, then pick 1 of 3 cards each round until the deck is full.
export function StarterDeckScreen({ run, act }: StarterDeckScreenProps) {
  if (run.location.kind !== 'starterDeck') return null;

  // Draft in progress: show the current pick-1-of-3 round.
  if (run.nodeContent?.type === 'starterDraft') {
    const { offers, picksLeft } = run.nodeContent;
    const round = STARTER_DRAFT_PICKS - picksLeft + 1;
    return (
      <main className="shop-screen draft-screen">
        <ScreenHeader title={`Draft your deck — pick ${round} of ${STARTER_DRAFT_PICKS}`} />
        <p className="draft-hint">Base: {deckSummary(DRAFT_BASE_HEALS)}. Choose one card to add.</p>
        <div className="shop-offers draft-offers">
          {offers.map((cardId, i) => (
            <div className="shop-offer" key={`${cardId}-${i}`}>
              <Card
                card={resolveCard(makeDeckCard(cardId, -1))}
                affordable
                selected={false}
                onClick={() => act((r) => r.pickStarterDraftCard(cardId))}
              />
            </div>
          ))}
        </div>
      </main>
    );
  }

  // Otherwise: the Standard-or-Draft mode choice.
  const summaries: Record<StarterDeckId, string> = {
    standard: deckSummary(DECK_LIST),
    draft: `${deckSummary(DRAFT_BASE_HEALS)} + ${STARTER_DRAFT_PICKS} picks`,
  };
  return (
    <main className="shop-screen draft-screen">
      <ScreenHeader title="Choose your starting deck" />
      <div className="shop-offers draft-offers">
        {STARTER_DECK_IDS.map((id: StarterDeckId) => {
          const d = STARTER_DECKS[id];
          return (
            <Tooltip key={id} content={d.desc}>
              <button
                className="draft-member"
                onClick={() => act((r) => r.chooseStarterMode(id))}
              >
                <span className="draft-member-name">{d.name}</span>
                <span className="draft-member-stats">{d.desc}</span>
                <span className="draft-member-ability">{summaries[id]}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </main>
  );
}
