import { useEffect, useRef, useState } from 'react';
import { resolveCard } from '../constants';
import type { Slot, ResolvedCard } from '../constants';
import type { Game } from '../engine';
import type { BattleView, MemberReactState } from '../useGame';
import type { CardOrigin, FxInstance } from '../animations';
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
  reacts: (MemberReactState | null)[];
  animating: boolean;
  shakeTick: number;
  playCard: (handIndex: number, target: number | null, origin?: CardOrigin) => void;
  skipTurn: () => void;
  endTurn: () => void;
  // Play the end-of-fight gold burst over the live board on a win (#59); returns how
  // long (ms) to hold the result overlay while it plays.
  onWinFx: () => number;
  // Resolve the fight within the run (win -> advance, loss -> run over).
  onBattleEnd: () => void;
}

export function BattleScreen({
  game, view, fx, reacts, animating, shakeTick, playCard, skipTurn, endTurn, onWinFx, onBattleEnd,
}: BattleScreenProps) {
  const [selected, setSelected] = useState<Selected | null>(null);
  // The result overlay waits until the win burst has played (#59): false while the
  // fight is live or the gold coins are still flying, true once it's time to show
  // Victory/Defeat. A ref keeps the burst firing exactly once per fight.
  const [resultReady, setResultReady] = useState(false);
  const resultFired = useRef(false);
  const onWinFxRef = useRef(onWinFx);
  onWinFxRef.current = onWinFx;
  const mainRef = useRef<HTMLElement>(null);

  // A fresh Game instance (newGame) means any pending targeting is stale.
  useEffect(() => { setSelected(null); }, [game]);

  // A fresh fight re-arms the result gate.
  useEffect(() => { resultFired.current = false; setResultReady(false); }, [game]);

  // Once the fight ends and the board settles (#59): on a win, play the gold burst
  // over the live board first and reveal Victory a beat later; on a loss, show the
  // result at once. Fires once per fight (resultFired) and holds the overlay for the
  // burst's own duration so a skipped burst never adds a dead pause.
  useEffect(() => {
    if (animating || game.status === 'playing' || resultFired.current) return;
    resultFired.current = true;
    if (game.status === 'win') {
      const holdMs = onWinFxRef.current();
      if (holdMs <= 0) { setResultReady(true); return; }
      const t = setTimeout(() => setResultReady(true), holdMs);
      return () => clearTimeout(t);
    }
    setResultReady(true);
  }, [animating, game.status, game]);

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

  // Measure the clicked card's on-screen box (container-relative) BEFORE the
  // engine removes it from the hand, so its ghost can fly out of that spot.
  const cardOrigin = (handIndex: number): CardOrigin | undefined => {
    const main = mainRef.current;
    const uid = game.hand[handIndex]?.uid;
    const el = uid != null ? main?.querySelector(`[data-uid="${uid}"]`) : null;
    if (!main || !el) return undefined;
    const r = el.getBoundingClientRect();
    const mr = main.getBoundingClientRect();
    return { x: r.left - mr.left, y: r.top - mr.top, w: r.width, h: r.height };
  };

  const onCardClick = (handIndex: number) => {
    if (animating || game.status !== 'playing' || game.phase !== 'player') return;
    const card = resolveCard(game.hand[handIndex]);
    if (game.mp < game.effectiveCost(card)) return; // unaffordable
    // No-target cards play immediately.
    if (card.target === 'all' || card.target === 'none') {
      setSelected(null);
      playCard(handIndex, null, cardOrigin(handIndex));
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
    const origin = cardOrigin(selected.handIndex);
    setSelected(null);
    playCard(selected.handIndex, slot, origin);
  };

  const onEndTurn = () => { setSelected(null); endTurn(); };
  const onSkip = () => { setSelected(null); skipTurn(); };

  return (
    <main ref={mainRef}>
      <EnemyPanel game={game} displayHp={view.enemyHp} />
      <Party
        game={game}
        view={view}
        reacts={reacts}
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
      {/* Result card drops in only after the flourish AND the win gold burst (#59). */}
      {resultReady && <GameOverlay game={game} onContinue={onBattleEnd} />}
    </main>
  );
}
