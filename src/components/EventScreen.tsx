import { useState } from 'react';
import {
  CARDS, MEMBER_DEFS, MODIFIERS, CARD_REMOVAL_PRICE, DUPLICATE_PRICE,
  BLOOD_ALTAR_HP, BLOOD_ALTAR_DAMAGE, resolveCard, makeDeckCard,
} from '../constants';
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
  | { kind: 'duplicateCard' }
  | { kind: 'bloodAltar' }
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
      case 'safeGold': {
        const { delta } = act((r) => r.safeGold());
        finish(`You pocket the safe cut — ${delta} gold.`);
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
      case 'cursedChest': {
        const { gold, removed } = act((r) => r.cursedChest());
        finish(removed
          ? `You pocket ${gold} gold — and the chest swallows your ${CARDS[removed.id].name}.`
          : `You pocket ${gold} gold. The chest finds nothing else to take.`);
        break;
      }
      case 'mercenary': {
        const hired = act((r) => r.hireMercenary());
        finish(hired
          ? `The mercenary drills ${MEMBER_DEFS[hired.slot].name} — +${hired.amount} damage.`
          : 'You can\'t afford the fee.');
        break;
      }
      case 'duplicateCard':
        setStage({ kind: 'duplicateCard' });
        break;
      case 'purgeRandom': {
        const purged = act((r) => r.purgeRandomCard());
        finish(purged
          ? `The well swallows your ${CARDS[purged.id].name}.`
          : 'The well finds nothing to take.');
        break;
      }
      case 'bloodAltar':
        setStage({ kind: 'bloodAltar' });
        break;
    }
  };

  const addCard = (id: CardId) => {
    act((r) => r.addCard(id));
    finish(`You add ${CARDS[id].name} to your deck.`);
  };

  const removeCard = (uid: number) => {
    const name = CARDS[run.deck.find((c) => c.uid === uid)!.id].name;
    const ok = act((r) => r.removeCardForGold(uid));
    finish(ok ? `You let go of ${name} (−${CARD_REMOVAL_PRICE}g).`
      : `You can't afford the ${CARD_REMOVAL_PRICE}g fee.`);
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

  const duplicate = (uid: number) => {
    const name = CARDS[run.deck.find((c) => c.uid === uid)!.id].name;
    const copy = act((r) => r.duplicateCard(uid));
    finish(copy ? `The scribe copies your ${name} (−${DUPLICATE_PRICE}g).`
      : `You can't afford the ${DUPLICATE_PRICE}g commission.`);
  };

  const sacrifice = (slot: Slot) => {
    const result = act((r) => r.bloodAltarSacrifice(slot));
    finish(result
      ? `The altar drinks. ${MEMBER_DEFS[slot].name}: −${result.hpLoss} max HP, +${result.damageGain} damage.`
      : `${MEMBER_DEFS[slot].name} is too frail to sacrifice.`);
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
            <h3>Choose a card to remove ({CARD_REMOVAL_PRICE}g)</h3>
            <DeckPicker
              deck={run.deck}
              canPick={() => run.gold >= CARD_REMOVAL_PRICE}
              onPick={removeCard}
              emptyText={run.gold >= CARD_REMOVAL_PRICE ? undefined : `You need ${CARD_REMOVAL_PRICE}g to remove a card.`}
            />
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

        {stage.kind === 'duplicateCard' && (
          <div className="event-pick">
            <h3>Choose a card to copy ({DUPLICATE_PRICE}g)</h3>
            <DeckPicker
              deck={run.deck}
              canPick={() => run.gold >= DUPLICATE_PRICE}
              onPick={duplicate}
              emptyText={run.gold >= DUPLICATE_PRICE ? undefined : `You need ${DUPLICATE_PRICE}g to commission a copy.`}
            />
            <button className="leave-btn" onClick={() => setStage({ kind: 'choices' })}>Back</button>
          </div>
        )}

        {stage.kind === 'bloodAltar' && (
          <div className="event-pick">
            <h3>Choose who bleeds (−{BLOOD_ALTAR_HP} max HP, +{BLOOD_ALTAR_DAMAGE} damage)</h3>
            <div className="member-row">
              {MEMBER_DEFS.map((d) => {
                const p = run.party[d.slot];
                const able = run.canSacrifice(d.slot as Slot);
                return (
                  <button
                    key={d.id}
                    className="member-pick"
                    disabled={!able}
                    onClick={() => able && sacrifice(d.slot as Slot)}
                  >
                    <span className="member-name">{d.name}{able ? '' : ' (too frail)'}</span>
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
