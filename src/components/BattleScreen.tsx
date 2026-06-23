import { useEffect, useState } from 'react';
import { CARDS } from '../constants';
import type { Slot, CardDef } from '../constants';
import type { Game } from '../engine';
import { EnemyPanel } from './EnemyPanel';
import { Party } from './Party';
import { ManaBar } from './ManaBar';
import { Hand } from './Hand';
import { Actions } from './Actions';
import { CombatLog } from './CombatLog';
import { GameOverlay } from './GameOverlay';

interface Selected {
  handIndex: number;
  card: CardDef;
}

interface BattleScreenProps {
  game: Game;
  playCard: (handIndex: number, target: number | null) => void;
  skipTurn: () => void;
  endTurn: () => void;
  newGameRandom: () => void;
}

export function BattleScreen({ game, playCard, skipTurn, endTurn, newGameRandom }: BattleScreenProps) {
  const [selected, setSelected] = useState<Selected | null>(null);

  // A fresh Game instance (newGame) means any pending targeting is stale.
  useEffect(() => { setSelected(null); }, [game]);

  // Escape cancels targeting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const isValidTarget = (slot: Slot): boolean =>
    selected ? game.canPlay(selected.handIndex, slot) === null : false;

  const onCardClick = (handIndex: number) => {
    if (game.status !== 'playing' || game.phase !== 'player') return;
    const card = CARDS[game.hand[handIndex]];
    if (game.mp < card.cost) return; // unaffordable
    // No-target cards play immediately.
    if (card.target === 'all' || card.target === 'none') {
      setSelected(null);
      playCard(handIndex, null);
      return;
    }
    // Toggle selection for cards needing a target.
    if (selected && selected.handIndex === handIndex) {
      setSelected(null);
      return;
    }
    setSelected({ handIndex, card });
  };

  const onMemberClick = (slot: Slot) => {
    if (!selected) return;
    if (game.canPlay(selected.handIndex, slot) !== null) return; // invalid target; ignore
    setSelected(null);
    playCard(selected.handIndex, slot);
  };

  const onEndTurn = () => { setSelected(null); endTurn(); };
  const onSkip = () => { setSelected(null); skipTurn(); };

  return (
    <main>
      <EnemyPanel game={game} />
      <Party game={game} isValidTarget={isValidTarget} onMemberClick={onMemberClick} />
      <ManaBar game={game} />
      <Hand
        game={game}
        selectedIndex={selected?.handIndex ?? null}
        selectedCard={selected?.card ?? null}
        onCardClick={onCardClick}
      />
      <Actions
        game={game}
        hasSelection={!!selected}
        onSkip={onSkip}
        onEndTurn={onEndTurn}
        onCancel={() => setSelected(null)}
      />
      <CombatLog game={game} />
      <GameOverlay game={game} onNewFight={newGameRandom} />
    </main>
  );
}
