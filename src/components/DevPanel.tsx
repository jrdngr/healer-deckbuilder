import { useState } from 'react';
import { CARDS, MEMBER_DEFS, makeDeckCard, resolveCard } from '../constants';
import type { GameController } from '../useGame';
import { Card } from './Card';

interface DevPanelProps {
  // The active fight's controller, or null when not in a fight.
  ctrl: GameController | null;
  // Grant gold at the run level (lives outside the battle engine).
  addGold: () => void;
}

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

  // Heal buttons act on a slot; label them from the live fight's seated members so
  // a drafted party reads its real names (not the hardcoded classic trio — #36).
  // Out of a fight there are no seated members; fall back to the classic labels.
  const healSlots = inFight
    ? ctrl.game.members.map((m, slot) => ({ slot, label: m.name }))
    : MEMBER_DEFS.map((d) => ({ slot: d.slot as number, label: d.name }));

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
                {healSlots.map(({ slot, label }) => (
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
