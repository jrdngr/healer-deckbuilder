import { useState } from 'react';
import { CARDS, MEMBER_DEFS, MODIFIERS, resolveCard, makeDeckCard } from '../constants';
import type { CardId, Slot, EventChoiceKind } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { Card } from './Card';
import { DeckPicker } from './DeckPicker';

interface EventScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

type Stage =
  | { kind: 'choices' }
  | { kind: 'addCard'; offers: CardId[] }
  | { kind: 'removeCard' }
  | { kind: 'shrineCard' }
  | { kind: 'shrineParty' }
  | { kind: 'result'; text: string };

// A single-step event: a scenario with a few choices. Some choices need a follow-up
// pick (which card to add/remove, which card/member to bless); all end in a result
// the player acknowledges before leaving.
export function EventScreen({ run, act, onDone }: EventScreenProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'choices' });
  if (run.nodeContent?.type !== 'event') return null;
  const event = run.nodeContent.event;

  const finish = (text: string) => setStage({ kind: 'result', text });

  const choose = (kind: EventChoiceKind) => {
    switch (kind) {
      case 'leave':
        onDone();
        break;
      case 'gambleGold': {
        const { delta } = act((r) => r.gambleGold());
        finish(delta >= 0
          ? `Fortune favors you — you gain ${delta} gold!`
          : `The coin bites — you lose ${-delta} gold.`);
        break;
      }
      case 'addCardOffer':
        setStage({ kind: 'addCard', offers: run.eventCardOffer() });
        break;
      case 'removeCard':
        setStage({ kind: 'removeCard' });
        break;
      case 'shrineCard':
        setStage({ kind: 'shrineCard' });
        break;
      case 'shrineParty':
        setStage({ kind: 'shrineParty' });
        break;
    }
  };

  const addCard = (id: CardId) => {
    act((r) => r.addCard(id));
    finish(`You add ${CARDS[id].name} to your deck.`);
  };

  const removeCard = (uid: number) => {
    const name = CARDS[run.deck.find((c) => c.uid === uid)!.id].name;
    act((r) => r.removeCard(uid));
    finish(`You let go of ${name}.`);
  };

  const blessCard = (uid: number) => {
    const name = CARDS[run.deck.find((c) => c.uid === uid)!.id].name;
    const mod = act((r) => r.shrineBlessCard(uid));
    finish(mod ? `The shrine blesses your ${name} with ${MODIFIERS[mod].name}.` : 'The shrine stays silent.');
  };

  const blessMember = (slot: Slot) => {
    const def = act((r) => r.shrineBlessMember(slot));
    finish(`The shrine grants ${MEMBER_DEFS[slot].name} ${def.name}.`);
  };

  return (
    <main className="event-screen">
      <div className="event-card">
        <h2>{event.title}</h2>
        <p className="event-text">{event.text}</p>

        {stage.kind === 'choices' && (
          <div className="event-choices">
            {event.choices.map((c) => (
              <button key={c.kind + c.label} className="event-choice" onClick={() => choose(c.kind)}>
                <span className="choice-label">{c.label}</span>
                {c.detail && <span className="choice-detail">{c.detail}</span>}
              </button>
            ))}
          </div>
        )}

        {stage.kind === 'addCard' && (
          <div className="event-pick">
            <h3>Choose a card to add</h3>
            <div className="deck-picker">
              {stage.offers.map((id) => (
                <Card
                  key={id}
                  card={resolveCard(makeDeckCard(id, -1))}
                  affordable
                  selected={false}
                  onClick={() => addCard(id)}
                />
              ))}
            </div>
            <button className="leave-btn" onClick={() => setStage({ kind: 'choices' })}>Back</button>
          </div>
        )}

        {stage.kind === 'removeCard' && (
          <div className="event-pick">
            <h3>Choose a card to remove</h3>
            <DeckPicker deck={run.deck} canPick={() => true} onPick={removeCard} />
            <button className="leave-btn" onClick={() => setStage({ kind: 'choices' })}>Back</button>
          </div>
        )}

        {stage.kind === 'shrineCard' && (
          <div className="event-pick">
            <h3>Choose a card to bless</h3>
            <DeckPicker
              deck={run.deck}
              canPick={(c) => run.eligibleModifiersFor(c).length > 0}
              onPick={blessCard}
              emptyText="No card can take a blessing."
            />
            <button className="leave-btn" onClick={() => setStage({ kind: 'choices' })}>Back</button>
          </div>
        )}

        {stage.kind === 'shrineParty' && (
          <div className="event-pick">
            <h3>Choose a hero to bless</h3>
            <div className="member-row">
              {MEMBER_DEFS.map((d) => {
                const p = run.party[d.slot];
                return (
                  <button key={d.id} className="member-pick" onClick={() => blessMember(d.slot as Slot)}>
                    <span className="member-name">{d.name}</span>
                    <span className="member-stats">HP {p.maxHP} · DMG {p.damage} · ABL +{p.abilityPower}</span>
                  </button>
                );
              })}
            </div>
            <button className="leave-btn" onClick={() => setStage({ kind: 'choices' })}>Back</button>
          </div>
        )}

        {stage.kind === 'result' && (
          <div className="event-result">
            <p>{stage.text}</p>
            <button className="primary" onClick={onDone}>Continue</button>
          </div>
        )}
      </div>
    </main>
  );
}
