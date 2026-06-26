import { useState } from 'react';
import { CARDS, makeDeckCard, resolveCard } from '../constants';
import type { GameController } from '../useGame';
import { Card } from './Card';

interface DevPanelProps {
  // The active fight's controller, or null when not in a fight.
  ctrl: GameController | null;
  // Grant gold at the run level (lives outside the battle engine).
  addGold: () => void;
}

const HEAL_SLOTS = [
  { slot: 0, label: 'Ranger' },
  { slot: 1, label: 'Tank' },
  { slot: 2, label: 'Mage' },
];

// A developer cheat panel that slides out from the right edge. Fight-only controls
// are disabled outside a fight (or once it's over); the gold grant always works.
export function DevPanel({ ctrl, addGold }: DevPanelProps) {
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Fight controls are live only while a fight is actually in progress.
  const inFight = ctrl != null && ctrl.game.status === 'playing';
  // Cards play only during the player phase (devPlayCard no-ops otherwise).
  const canPlayCards = inFight && ctrl.game.phase === 'player';

  const dev = (mutate: Parameters<GameController['devAction']>[0]) => () => ctrl?.devAction(mutate);

  return (
    <>
      <button
        className="dev-toggle"
        title="Dev panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▶' : '◀'} DEV
      </button>

      <aside className={`dev-panel${open ? '' : ' closed'}`}>
        {libraryOpen ? (
          <div className="dev-library">
            <div className="dev-library-head">
              <button onClick={() => setLibraryOpen(false)}>← Back</button>
              <h2>Card library</h2>
            </div>
            <p className="dev-hint">
              {canPlayCards ? 'Click a card to play it instantly.' : 'Start a fight to play cards.'}
            </p>
            <div className="dev-library-grid">
              {Object.values(CARDS).map((def, i) => (
                <Card
                  key={def.id}
                  card={resolveCard(makeDeckCard(def.id, i))}
                  affordable={canPlayCards}
                  selected={false}
                  onClick={canPlayCards ? dev((g) => g.devPlayCard(def.id)) : () => {}}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="dev-body">
            <h2>Dev panel</h2>

            <section className="dev-section">
              <label>Enemy</label>
              <div className="dev-row">
                <button disabled={!inFight} onClick={dev((g) => g.devDamageEnemy(10))}>Damage 10</button>
                <button disabled={!inFight} onClick={dev((g) => g.devKillEnemy())}>Kill enemy</button>
              </div>
            </section>

            <section className="dev-section">
              <label>Heal party to full</label>
              <div className="dev-row">
                {HEAL_SLOTS.map(({ slot, label }) => (
                  <button
                    key={slot}
                    disabled={!inFight}
                    onClick={dev((g) => g.devHealMemberToFull(slot))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="dev-section">
              <label>Mana</label>
              <div className="dev-row">
                <button disabled={!inFight} onClick={dev((g) => g.devFillMana())}>Fill MP</button>
              </div>
            </section>

            <section className="dev-section">
              <label>Gold</label>
              <div className="dev-row">
                <button onClick={addGold}>+100 gold</button>
              </div>
            </section>

            <section className="dev-section">
              <label>Cards</label>
              <div className="dev-row">
                <button onClick={() => setLibraryOpen(true)}>Open card library</button>
              </div>
            </section>
          </div>
        )}
      </aside>
    </>
  );
}
