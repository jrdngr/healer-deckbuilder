import { resolveCard } from '../constants';
import type { Game } from '../engine';
import { Card } from './Card';

interface ReserveProps {
  game: Game;
  animating: boolean;
  // Begin playing the banked card. The parent (BattleScreen) drives target
  // selection for single/dead cards; no-target cards resolve immediately.
  onPlay: () => void;
  // Release the banked card to the discard for free (costs the whole turn).
  onUnbank: () => void;
  // The banked card is the live targeting source right now (its Play was pressed and
  // a hero pick is pending) — highlight the zone so it reads as "choose a target".
  targeting: boolean;
}

// The Card Bank slot / "The Reserve" (91a): the one card reserved across turns. Sits
// in the right gutter of `.mana-row` (grid column 3), mirroring the ChannelBanner in
// the left gutter, so it occupies reserved space rather than shoving the hand down.
// Reserving a card is FREE, but holding it costs an escalating end-of-turn MP upkeep
// (1, then 2, then 3…) — reserve a *situational answer* (a shield, taunt, Cleanse or
// heal) for a blow you see telegraphed, then play or release it.
export function Reserve({ game, animating, onPlay, onUnbank, targeting }: ReserveProps) {
  if (game.status !== 'playing') return null;
  const dc = game.reserveCard;
  if (dc == null) {
    // Empty slot: keep the reserved gutter space (and a hint) so the row never shifts.
    return (
      <div className="reserve reserve-empty" title="Reserve a card here to hold it across turns for an escalating MP upkeep.">
        <span className="reserve-hint">Reserve empty</span>
      </div>
    );
  }
  const card = resolveCard(dc);
  const nextUpkeep = game.reserveNextUpkeep();
  const drops = game.reserveDropTargets();
  const canPlay = !animating && (drops.board || drops.slots.length > 0);
  const canUnbank = !animating && game.canReleaseReserved();
  return (
    <div className={`reserve reserve-full${targeting ? ' targeting' : ''}`}>
      <span className="reserve-title">The Reserve</span>
      <div className="reserve-card">
        <Card card={card} affordable={game.mp >= game.effectiveCost(card)} selected={targeting} onClick={() => {}} />
      </div>
      <div className="reserve-upkeep" title="MP charged at the end of this turn if the card is still held. It rises by 1 each turn it stays reserved.">
        Next upkeep: {nextUpkeep} MP
      </div>
      <div className="reserve-actions">
        <button className="reserve-play" disabled={!canPlay} onClick={onPlay}
          title="Play the reserved card now (normal MP cost).">Play</button>
        <button className="reserve-unbank" disabled={!canUnbank} onClick={onUnbank}
          title="Release the reserved card to the discard — free, but it uses your whole turn (no card played).">
          Release
        </button>
      </div>
    </div>
  );
}
