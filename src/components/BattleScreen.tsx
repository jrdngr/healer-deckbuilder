import { useEffect, useRef, useState } from 'react';
import { resolveCard } from '../constants';
import type { Slot, ResolvedCard } from '../constants';
import type { Game } from '../engine';
import type { BattleView } from '../useGame';
import type { FxInstance } from '../animations';
import { EnemyPanel } from './EnemyPanel';
import { Party } from './Party';
import { ManaBar } from './ManaBar';
import { Hand } from './Hand';
import { Actions } from './Actions';
import { CombatLog } from './CombatLog';
import { GameOverlay } from './GameOverlay';
import { AttackLines } from './AttackLines';
import { FxLayer } from './FxLayer';

interface Selected {
  handIndex: number;
  card: ResolvedCard;
}

interface BattleScreenProps {
  game: Game;
  view: BattleView;
  fx: FxInstance[];
  animating: boolean;
  shakeTick: number;
  playCard: (handIndex: number, target: number | null) => void;
  skipTurn: () => void;
  endTurn: () => void;
  // Resolve the fight within the run (win -> advance, loss -> run over).
  onBattleEnd: () => void;
}

export function BattleScreen({
  game, view, fx, animating, shakeTick, playCard, skipTurn, endTurn, onBattleEnd,
}: BattleScreenProps) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // A fresh Game instance (newGame) means any pending targeting is stale.
  useEffect(() => { setSelected(null); }, [game]);

  // Cancel any pending targeting once a sequence starts playing.
  useEffect(() => { if (animating) setSelected(null); }, [animating]);

  // Escape cancels targeting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Punch the whole board on each shake beat. Re-trigger the CSS animation by
  // clearing it and forcing a reflow before re-adding the class.
  useEffect(() => {
    const el = mainRef.current;
    if (!el || shakeTick === 0) return;
    el.classList.remove('shake');
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add('shake');
    const t = setTimeout(() => el.classList.remove('shake'), 320);
    return () => clearTimeout(t);
  }, [shakeTick]);

  const isValidTarget = (slot: Slot): boolean =>
    !animating && !!selected && game.canPlay(selected.handIndex, slot) === null;

  const onCardClick = (handIndex: number) => {
    if (animating || game.status !== 'playing' || game.phase !== 'player') return;
    const card = resolveCard(game.hand[handIndex]);
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
    if (animating || !selected) return;
    if (game.canPlay(selected.handIndex, slot) !== null) return; // invalid target; ignore
    setSelected(null);
    playCard(selected.handIndex, slot);
  };

  const onEndTurn = () => { setSelected(null); endTurn(); };
  const onSkip = () => { setSelected(null); skipTurn(); };

  return (
    <main ref={mainRef}>
      <EnemyPanel game={game} displayHp={view.enemyHp} />
      <Party
        game={game}
        view={view}
        animating={animating}
        isValidTarget={isValidTarget}
        onMemberClick={onMemberClick}
      />
      <ManaBar game={game} animating={animating} />
      <Hand
        game={game}
        disabled={animating}
        selectedIndex={selected?.handIndex ?? null}
        selectedCard={selected?.card ?? null}
        onCardClick={onCardClick}
      />
      <Actions
        game={game}
        animating={animating}
        hasSelection={!!selected}
        onSkip={onSkip}
        onEndTurn={onEndTurn}
        onCancel={() => setSelected(null)}
      />
      <CombatLog game={game} />
      {/* The standing telegraph would flash the *next* turn's lines mid-sequence. */}
      {!animating && <AttackLines game={game} containerRef={mainRef} />}
      <FxLayer fx={fx} containerRef={mainRef} />
      {/* Let the victory/defeat flourish play before the result card drops in. */}
      {!animating && <GameOverlay game={game} onContinue={onBattleEnd} />}
    </main>
  );
}
