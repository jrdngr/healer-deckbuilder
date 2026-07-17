import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { resolveCard } from '../constants';
import type { Slot, ResolvedCard } from '../constants';
import type { Game } from '../engine';
import type { BattleView, MemberReactState } from '../useGame';
import type { CardOrigin, FxInstance } from '../animations';
import { EnemyPanel } from './EnemyPanel';
import { Party } from './Party';
import { ManaBar } from './ManaBar';
import { ChannelBanner } from './ChannelBanner';
import { Reserve } from './Reserve';
import { Hand } from './Hand';
import { Card } from './Card';
import { Actions } from './Actions';
import { CombatLog } from './CombatLog';
import { GameOverlay } from './GameOverlay';
import { AttackLines } from './AttackLines';
import { FxLayer } from './FxLayer';

interface Selected {
  handIndex: number;
  card: ResolvedCard;
}

// The floating card ghost that follows the pointer during a drag. x/y are its
// viewport top-left; w/h size the ghost to match the source card.
interface DragView {
  handIndex: number;
  card: ResolvedCard;
  uid: number;
  board: boolean; // no-target card — plays wherever it's released
  x: number;
  y: number;
  w: number;
  h: number;
}

// How far the pointer must travel before a press becomes a drag rather than a click.
const DRAG_THRESHOLD = 6;

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
  // Card Bank slot / "The Reserve" (91a).
  reserveCard: (handIndex: number) => void;
  playReservedCard: (target: number | null) => void;
  releaseReserved: () => void;
  // Play the end-of-fight gold burst over the live board on a win (#59); returns how
  // long (ms) to hold the result overlay while it plays.
  onWinFx: () => number;
  // Resolve the fight within the run (win -> advance, loss -> run over).
  onBattleEnd: () => void;
}

export function BattleScreen({
  game, view, fx, reacts, animating, shakeTick, playCard, skipTurn, endTurn,
  reserveCard, playReservedCard, releaseReserved, onWinFx, onBattleEnd,
}: BattleScreenProps) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [dragView, setDragView] = useState<DragView | null>(null);
  // Playing the reserved card (91a): once "Play" is pressed on a single/dead-target
  // banked card, a hero pick is pending — the hero highlights read the Reserve's own
  // drop targets. No-target banked cards resolve immediately and never enter this mode.
  const [bankTargeting, setBankTargeting] = useState(false);
  // After a drag ends we swallow the click the browser fires on the source card, so
  // a drag never doubles as a select.
  const suppressClickRef = useRef(false);
  // The result overlay waits until the win burst has played (#59): false while the
  // fight is live or the gold coins are still flying, true once it's time to show
  // Victory/Defeat. A ref keeps the burst firing exactly once per fight.
  const [resultReady, setResultReady] = useState(false);
  const resultFired = useRef(false);
  const onWinFxRef = useRef(onWinFx);
  onWinFxRef.current = onWinFx;
  const mainRef = useRef<HTMLElement>(null);

  // A fresh Game instance (newGame) means any pending targeting is stale.
  useEffect(() => { setSelected(null); setDragView(null); setBankTargeting(false); }, [game]);

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
  useEffect(() => { if (animating) { setSelected(null); setDragView(null); setBankTargeting(false); } }, [animating]);
  // A resolved / lost Reserve clears any pending bank targeting.
  useEffect(() => { if (game.reserveCard == null) setBankTargeting(false); }, [game.reserveCard]);

  // Escape cancels targeting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelected(null); setDragView(null); setBankTargeting(false); } };
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

  // The card whose targeting is currently live — the one being dragged, else the
  // click-selected one. Its legal drops (dropTargets, not raw canPlay, so ability
  // cards only accept their own carrier) drive both the hero highlights and the
  // target validation shared by the click and drag paths.
  const activeIndex = dragView ? dragView.handIndex : selected?.handIndex ?? null;
  // When playing the reserved card (bankTargeting), the hero highlights read the
  // Reserve's own drop targets instead of a hand card's.
  const dropSpec = bankTargeting && !animating ? game.reserveDropTargets()
    : activeIndex != null && !animating ? game.dropTargets(activeIndex)
    : null;

  const isValidTarget = (slot: Slot): boolean => !!dropSpec && dropSpec.slots.includes(slot);

  // Measure a hand card's on-screen box (container-relative) BEFORE the engine
  // removes it from the hand, so its ghost can fly out of that spot.
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
    // A just-finished drag also emits a click on the source card — swallow it so a
    // drag never doubles as a select.
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
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
    if (animating) return;
    // Playing the reserved card: a hero pick resolves the banked card on that hero.
    if (bankTargeting) {
      if (game.reserveDropTargets().slots.includes(slot)) {
        setBankTargeting(false);
        playReservedCard(slot);
      }
      return;
    }
    if (!selected) return;
    if (game.dropTargets(selected.handIndex).slots.includes(slot) === false) return; // invalid target
    const origin = cardOrigin(selected.handIndex);
    setSelected(null);
    playCard(selected.handIndex, slot, origin);
  };

  // Reserve a hand card (91a): free, not a turn action. Cancel any pending targeting.
  const onBank = (handIndex: number) => {
    if (animating || game.status !== 'playing' || game.phase !== 'player') return;
    if (game.reserveCard != null) return; // one slot only
    setSelected(null);
    setDragView(null);
    reserveCard(handIndex);
  };

  // Play the reserved card. A no-target card resolves immediately; a single/dead-target
  // card enters bank targeting so a hero pick can finish it.
  const onReservePlay = () => {
    if (animating || game.reserveCard == null) return;
    const drops = game.reserveDropTargets();
    if (drops.board) { playReservedCard(null); return; }
    if (drops.slots.length === 0) return; // nothing legal to target right now
    setSelected(null);
    setBankTargeting(true);
  };

  const onReserveUnbank = () => {
    if (!game.canReleaseReserved()) return;
    setBankTargeting(false);
    releaseReserved();
  };

  // Resolve where a drag was released. A no-target ('board') card plays wherever it
  // lands on the board (but not back on the hand); a hero-targeted card plays only on
  // a valid hero — anything else (off-board, wrong/invalid hero, an ability card on
  // the wrong carrier) cancels.
  const resolveDrop = (handIndex: number, spec: { slots: number[]; board: boolean }, clientX: number, clientY: number) => {
    const main = mainRef.current;
    const el = document.elementFromPoint(clientX, clientY);
    if (!main || !el || !main.contains(el)) return; // released off the board -> cancel
    if (el.closest('.hand-wrap')) return;           // released back on the hand -> cancel
    if (spec.board) { playCard(handIndex, null, cardOrigin(handIndex)); return; }
    const memberEl = el.closest('.member');
    if (!memberEl) return;                           // not over a hero -> cancel
    const party = main.querySelector('.party');
    const slot = party ? Array.prototype.indexOf.call(party.children, memberEl) : -1;
    if (slot >= 0 && spec.slots.includes(slot)) playCard(handIndex, slot, cardOrigin(handIndex));
    // else: a hero that doesn't accept this card (incl. an ability card's wrong carrier) -> cancel
  };

  // Begin a drag gesture from a hand card. The listeners live for the life of the
  // gesture only, capturing this render's game/handlers; a press that never crosses
  // the threshold falls through to the normal click (select-then-target).
  const onCardPointerDown = (handIndex: number, e: ReactPointerEvent) => {
    if (e.button !== 0) return; // primary button only
    if (animating || game.status !== 'playing' || game.phase !== 'player') return;
    const dc = game.hand[handIndex];
    if (!dc) return;
    const spec = game.dropTargets(handIndex);
    if (spec.slots.length === 0 && !spec.board) return; // nothing legal to drag onto
    const card = resolveCard(dc);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - r.left;
    const offsetY = e.clientY - r.top;
    const w = r.width;
    const h = r.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    let active = false;
    suppressClickRef.current = false;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        active = true;
        setSelected({ handIndex, card }); // lights up valid hero slots via isValidTarget
      }
      setDragView({ handIndex, card, uid: dc.uid, board: spec.board, x: ev.clientX - offsetX, y: ev.clientY - offsetY, w, h });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!active) return; // never became a drag -> let the click fire normally
      suppressClickRef.current = true;
      setDragView(null);
      setSelected(null);
      if (ev.type !== 'pointercancel') resolveDrop(handIndex, spec, ev.clientX, ev.clientY);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onEndTurn = () => { setSelected(null); setBankTargeting(false); endTurn(); };
  const onSkip = () => { setSelected(null); setBankTargeting(false); skipTurn(); };

  // While a drag is live, cue the board: hero-targeted cards light their valid heroes
  // (isValidTarget); a no-target 'board' card arms the whole board instead.
  const mainCls = dragView ? (dragView.board ? 'dragging drag-board' : 'dragging') : undefined;

  return (
    <main ref={mainRef} className={mainCls}>
      <EnemyPanel game={game} displayHp={view.enemyHp} />
      <Party
        game={game}
        view={view}
        reacts={reacts}
        animating={animating}
        isValidTarget={isValidTarget}
        onMemberClick={onMemberClick}
      />
      {/* Three-column row: the MP bar and its primary turn button (#80) stay pinned
          to the centered middle column, so they never move. The player-cast channel
          feedback (#78) lives in the left gutter and clears when it ends/cancels —
          occupying reserved space rather than pushing the hand down. */}
      <div className="mana-row">
        <ChannelBanner game={game} />
        <div className="mana-center">
          <ManaBar game={game} animating={animating} />
          <Actions
            game={game}
            animating={animating}
            hasSelection={!!selected}
            onSkip={onSkip}
            onEndTurn={onEndTurn}
            onCancel={() => { setSelected(null); setBankTargeting(false); }}
          />
        </div>
        <Reserve
          game={game}
          animating={animating}
          onPlay={onReservePlay}
          onUnbank={onReserveUnbank}
          targeting={bankTargeting}
        />
      </div>
      <Hand
        game={game}
        disabled={animating}
        selectedIndex={selected?.handIndex ?? null}
        selectedCard={selected?.card ?? null}
        onCardClick={onCardClick}
        onCardPointerDown={onCardPointerDown}
        draggingUid={dragView?.uid ?? null}
        // The Bank affordance shows only while a card can be reserved: player phase,
        // the Reserve empty, nothing animating.
        onBank={!animating && game.status === 'playing' && game.phase === 'player' && game.reserveCard == null ? onBank : undefined}
      />
      <CombatLog game={game} />
      {/* The standing telegraph would flash the *next* turn's lines mid-sequence. */}
      {!animating && <AttackLines game={game} containerRef={mainRef} />}
      <FxLayer fx={fx} containerRef={mainRef} />
      {/* Result card drops in only after the flourish AND the win gold burst (#59). */}
      {resultReady && <GameOverlay game={game} onContinue={onBattleEnd} />}
      {/* The card ghost that follows the pointer during a drag. pointer-events:none
          (in CSS) keeps it out of elementFromPoint so drops hit the target under it. */}
      {dragView && (
        <div
          className="card-drag-ghost"
          style={{ left: dragView.x, top: dragView.y, width: dragView.w, height: dragView.h }}
        >
          <Card card={dragView.card} affordable selected onClick={() => {}} />
        </div>
      )}
    </main>
  );
}
