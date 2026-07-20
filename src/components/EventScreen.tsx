import { useState } from 'react';
import {
  CARDS, memberDefAt, MODIFIERS, RELICS, CARD_REMOVAL_PRICE, DUPLICATE_PRICE,
  BLOOD_ALTAR_HP, BLOOD_ALTAR_DAMAGE, CURSE_SHRINE_GOLD, INJURY_NAMES, resolveCard, makeDeckCard,
} from '../constants';
import type { CardId, Slot, EventChoiceKind } from '../constants';
import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { Card } from './Card';
import { DeckPicker } from './DeckPicker';
import { MemberPick, MemberStatLine } from './MemberList';
import type { ReactNode } from 'react';

interface EventScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// The shared shell for an event follow-up pick: a heading, the picker body, and a
// Back button that returns to the choice list.
function PickStage({ title, onBack, children }: { title: ReactNode; onBack: () => void; children: ReactNode }) {
  return (
    <div className="event-pick">
      <h3>{title}</h3>
      {children}
      <button className="leave-btn" onClick={onBack}>Back</button>
    </div>
  );
}

type Stage =
  | { kind: 'choices' }
  | { kind: 'addCard'; offers: CardId[] }
  | { kind: 'removeCard' }
  | { kind: 'shrineCard' }
  | { kind: 'shrineParty' }
  | { kind: 'duplicateCard' }
  | { kind: 'bloodAltar' }
  | { kind: 'healInjury' }
  | { kind: 'result'; text: string };

// A single-step event: a scenario with a few choices. Some choices need a follow-up
// pick (which card to add/remove, which card/member to bless); all end in a result
// the player acknowledges before leaving. An event resolves ONCE — the branch hub
// allows revisits, and a spent event only offers the way out.
export function EventScreen({ run, act, onDone }: EventScreenProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'choices' });
  if (run.nodeContent?.type !== 'event') return null;
  const event = run.nodeContent.event;
  const spent = run.nodeContent.done && stage.kind === 'choices';

  // Reaching a result means the event resolved: mark it spent in the run so a
  // revisit can't farm the choices again.
  const finish = (text: string) => {
    act((r) => r.markEventDone());
    setStage({ kind: 'result', text });
  };
  const back = () => setStage({ kind: 'choices' });

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
      case 'cursedChest': {
        const { delta, removed } = act((r) => r.cursedChest());
        finish(removed
          ? `You pocket ${delta} gold — and the chest swallows your ${CARDS[removed.id].name}.`
          : `You pocket ${delta} gold. The chest finds nothing else to take.`);
        break;
      }
      case 'mercenary': {
        const hired = act((r) => r.hireMercenary());
        finish(hired
          ? `The mercenary drills ${memberDefAt(run.party, hired.slot).name} — +${hired.amount} damage.`
          : 'You can\'t afford the fee.');
        break;
      }
      case 'duplicateCard':
        setStage({ kind: 'duplicateCard' });
        break;
      case 'bloodAltar':
        setStage({ kind: 'bloodAltar' });
        break;
      case 'healInjury':
        setStage({ kind: 'healInjury' });
        break;
      case 'shrineCurse': {
        const curse = act((r) => r.shrineAcceptCurse());
        finish(curse
          ? `The shrine brands you with ${RELICS[curse].name} — and pays ${CURSE_SHRINE_GOLD} gold.`
          : 'You already bear every burden the shrine knows.');
        break;
      }
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
    finish(`The shrine grants ${memberDefAt(run.party, slot).name} ${def.name}.`);
  };

  const duplicate = (uid: number) => {
    const name = CARDS[run.deck.find((c) => c.uid === uid)!.id].name;
    const copy = act((r) => r.duplicateCard(uid));
    finish(copy ? `The scribe copies your ${name} (−${DUPLICATE_PRICE}g).`
      : `You can't afford the ${DUPLICATE_PRICE}g commission.`);
  };

  const sacrifice = (slot: Slot) => {
    const result = act((r) => r.bloodAltarSacrifice(slot));
    const name = memberDefAt(run.party, slot).name;
    finish(result
      ? `The altar drinks. ${name}: −${result.hpLoss} max HP, +${result.damageGain} damage.`
      : `${name} is too frail to sacrifice.`);
  };

  const tendInjury = (slot: Slot) => {
    const healed = act((r) => r.healInjury(slot));
    const name = memberDefAt(run.party, slot).name;
    finish(healed
      ? `The medic tends ${name}, and one wound closes for good.`
      : `${name} bears no lasting wounds.`);
  };

  return (
    <main className="event-screen">
      <div className="event-card">
        <h2>{event.title}</h2>
        <p className="event-text">{event.text}</p>

        {spent && (
          <div className="event-result">
            <p>The moment has passed — there is nothing more to do here.</p>
            <button className="primary" onClick={onDone}>Leave</button>
          </div>
        )}

        {!spent && stage.kind === 'choices' && (
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
          <PickStage title="Choose a card to add" onBack={back}>
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
          </PickStage>
        )}

        {stage.kind === 'removeCard' && (
          <PickStage title={`Choose a card to remove (${CARD_REMOVAL_PRICE}g)`} onBack={back}>
            <DeckPicker
              deck={run.deck}
              canPick={() => run.gold >= CARD_REMOVAL_PRICE}
              onPick={removeCard}
              emptyText={run.gold >= CARD_REMOVAL_PRICE ? undefined : `You need ${CARD_REMOVAL_PRICE}g to remove a card.`}
            />
          </PickStage>
        )}

        {stage.kind === 'shrineCard' && (
          <PickStage title="Choose a card to bless" onBack={back}>
            <DeckPicker
              deck={run.deck}
              canPick={(c) => run.eligibleModifiersFor(c).length > 0}
              onPick={blessCard}
              emptyText="No card can take a blessing."
            />
          </PickStage>
        )}

        {stage.kind === 'shrineParty' && (
          <PickStage title="Choose a hero to bless" onBack={back}>
            <div className="member-row">
              {run.party.map((p, slot) => (
                <MemberPick
                  key={slot}
                  name={memberDefAt(run.party, slot).name}
                  stats={<MemberStatLine maxHP={p.maxHP} damage={p.damage} abilityPower={p.abilityPower} />}
                  onClick={() => blessMember(slot as Slot)}
                />
              ))}
            </div>
          </PickStage>
        )}

        {stage.kind === 'duplicateCard' && (
          <PickStage title={`Choose a card to copy (${DUPLICATE_PRICE}g)`} onBack={back}>
            <DeckPicker
              deck={run.deck}
              canPick={() => run.gold >= DUPLICATE_PRICE}
              onPick={duplicate}
              emptyText={run.gold >= DUPLICATE_PRICE ? undefined : `You need ${DUPLICATE_PRICE}g to commission a copy.`}
            />
          </PickStage>
        )}

        {stage.kind === 'bloodAltar' && (
          <PickStage title={`Choose who bleeds (−${BLOOD_ALTAR_HP} max HP, +${BLOOD_ALTAR_DAMAGE} damage)`} onBack={back}>
            <div className="member-row">
              {run.party.map((p, slot) => {
                const able = run.canSacrifice(slot as Slot);
                return (
                  <MemberPick
                    key={slot}
                    name={`${memberDefAt(run.party, slot).name}${able ? '' : ' (too frail)'}`}
                    stats={<MemberStatLine maxHP={p.maxHP} damage={p.damage} abilityPower={p.abilityPower} />}
                    disabled={!able}
                    onClick={() => able && sacrifice(slot as Slot)}
                  />
                );
              })}
            </div>
          </PickStage>
        )}

        {stage.kind === 'healInjury' && (
          <PickStage title="Choose a hero to tend" onBack={back}>
            <div className="member-row">
              {run.party.map((p, slot) => {
                const injured = p.injuries > 0;
                return (
                  <MemberPick
                    key={slot}
                    name={`${memberDefAt(run.party, slot).name}${injured ? '' : ' (unharmed)'}`}
                    stats={<span className="member-stats">{injured ? INJURY_NAMES.slice(0, p.injuries).join(' · ') : 'No injuries'}</span>}
                    disabled={!injured}
                    onClick={() => injured && tendInjury(slot as Slot)}
                  />
                );
              })}
            </div>
          </PickStage>
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
