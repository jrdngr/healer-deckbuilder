import { resolveCard, makeDeckCard, ABILITY_CARD, MEMBER_POOL } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { Card } from './Card';
import { ScreenHeader } from './ScreenChrome';

interface DojoScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// Training Dojo node: a hero learns one of their extra ability cards for free. The
// offers are one-per-hero at a full party (up to two from a hero in a smaller party);
// picking one appends it to that roster member's `learned` so it injects on deploy.
// Optional — the player may decline. Resolves once (content.done); revisits find it spent.
export function DojoScreen({ run, act, onDone }: DojoScreenProps) {
  const content = run.nodeContent;
  if (run.location.kind !== 'node' || content?.type !== 'dojo') return null;
  const done = content.done;

  return (
    <main className="shop-screen draft-screen">
      <ScreenHeader
        title="Training Dojo"
        right={<button className="leave-btn" onClick={onDone}>{done ? 'Move on' : 'Decline'}</button>}
      />

      {!done && (
        <div className="shop-offers draft-offers">
          {content.offers.map((offer) => (
            <div className="shop-offer" key={`${offer.member}:${offer.ability}`}>
              <Card
                card={resolveCard(makeDeckCard(ABILITY_CARD[offer.ability], -1))}
                affordable
                selected={false}
                onClick={() => { act((r) => r.learnAbility(offer.member, offer.ability)); onDone(); }}
              />
              <div className="offer-price">{MEMBER_POOL[offer.member].name} learns this</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
