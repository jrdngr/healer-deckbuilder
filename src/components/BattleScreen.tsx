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

// Where a drag started: a hand card (drag to play OR onto the Reserve slot to reserve it)
// or the reserved card (drag to play OR onto the discard pile to release it).
type DragSource = { kind: 'hand'; handIndex: number } | { kind: 'reserve' };

// The floating card ghost that follows the pointer during a drag. x/y are its
// viewport top-left; w/h size the ghost to match the source card.
interface DragView {
  source: DragSource;
  card: ResolvedCard;
  uid: number;
  board: boolean; // no-target card — plays wherever it's released on the board
  x: number;
  y: number;
  w: number;
  h: number;
}

// A card's legal drop targets (heroes and/or the whole board), shared by the click and
// drag paths.
type DropSpec = { slots: number[]; board: boolean };

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
  // End the turn / Rest; `handBoxes` are the current hand-card positions so the discard
  // can fly to the pile (#94).
  skipTurn: (handBoxes?: CardOrigin[]) => void;
  endTurn: (handBoxes?: CardOrigin[]) => void;
  // "The Reserve" (91a): reserve a hand card, play the reserved card, release it.
  reserve: (handIndex: number) => void;
  playReservedCard: (target: number | null) => void;
  releaseReserved: (handBoxes?: CardOrigin[]) => void;
  // Displayed deck-pile counts, held while cards fly (#94).
  pileCounts: { draw: number; discard: number };
  // Play the end-of-fight gold burst over the live board on a win (#59); returns how
  // long (ms) to hold the result overlay while it plays.
  onWinFx: () => number;
  // Resolve the fight within the run (win -> advance, loss -> run over).
  onBattleEnd: () => void;
}

export function BattleScreen({
  game, view, fx, reacts, animating, shakeTick, playCard, skipTurn, endTurn,
  reserve, playReservedCard, releaseReserved, pileCounts, onWinFx, onBattleEnd,
}: BattleScreenProps) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [dragView, setDragView] = useState<DragView | null>(null);
  // Playing the reserved card by click (91a): once the reserved card is clicked, a
  // single/dead-target card needs a hero pick — the hero highlights read the Reserve's
  // own drop targets. No-target cards resolve immediately and never enter this mode.
  const [reserveTargeting, setReserveTargeting] = useState(false);
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
  useEffect(() => { setSelected(null); setDragView(null); setReserveTargeting(false); }, [game]);

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
  useEffect(() => { if (animating) { setSelected(null); setDragView(null); setReserveTargeting(false); } }, [animating]);
  // A resolved / lost Reserve clears any pending reserve targeting.
  useEffect(() => { if (game.reserveCard == null) setReserveTargeting(false); }, [game.reserveCard]);

  // Escape cancels targeting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelected(null); setDragView(null); setReserveTargeting(false); } };
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

  // The targeting source that's currently live: a reserve action (a reserved-card drag,
  // or a click that armed reserveTargeting) reads the Reserve's own drop targets; else a
  // hand card (dragged, else click-selected) reads its dropTargets (not raw canPlay, so
  // ability cards only accept their own carrier). This drives the hero highlights and the
  // target validation shared by the click and drag paths.
  const reserveActive = reserveTargeting || dragView?.source.kind === 'reserve';
  const activeHandIndex = dragView?.source.kind === 'hand' ? dragView.source.handIndex
    : (!dragView && selected) ? selected.handIndex : null;
  const dropSpec: DropSpec | null = animating ? null
    : reserveActive ? game.reserveDropTargets()
    : activeHandIndex != null ? game.dropTargets(activeHandIndex)
    : null;

  const isValidTarget = (slot: Slot): boolean => !!dropSpec && dropSpec.slots.includes(slot);

  // Measure a card's on-screen box (container-relative) by its deck uid, BEFORE the
  // engine removes it from its source, so its ghost can fly out of that spot. Works for
  // both hand cards and the reserved card (both render a data-uid).
  const originForUid = (uid: number | undefined): CardOrigin | undefined => {
    const main = mainRef.current;
    const el = uid != null ? main?.querySelector(`[data-uid="${uid}"]`) : null;
    if (!main || !el) return undefined;
    const r = el.getBoundingClientRect();
    const mr = main.getBoundingClientRect();
    return { x: r.left - mr.left, y: r.top - mr.top, w: r.width, h: r.height };
  };

  const slotOf = (memberEl: Element): number => {
    const party = mainRef.current?.querySelector('.party');
    return party ? Array.prototype.indexOf.call(party.children, memberEl) : -1;
  };

  // Measure every hand card's box (container-relative), in hand order, BEFORE the turn
  // ends and the engine discards them — so each can fly to the discard pile (#94).
  const measureHandBoxes = (): CardOrigin[] => {
    const main = mainRef.current;
    const cards = main?.querySelectorAll('.hand .card');
    if (!main || !cards) return [];
    const mr = main.getBoundingClientRect();
    return Array.from(cards).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - mr.left, y: r.top - mr.top, w: r.width, h: r.height };
    });
  };

  const onCardClick = (handIndex: number) => {
    // A just-finished drag also emits a click on the source card — swallow it so a
    // drag never doubles as a select.
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (animating || game.status !== 'playing' || game.phase !== 'player') return;
    const card = resolveCard(game.hand[handIndex]);
    if (game.mp < game.effectiveCost(card)) return; // unaffordable
    setReserveTargeting(false);
    // No-target cards play immediately.
    if (card.target === 'all' || card.target === 'none') {
      setSelected(null);
      playCard(handIndex, null, originForUid(game.hand[handIndex]?.uid));
      return;
    }
    // Toggle selection for cards needing a target.
    if (selected && selected.handIndex === handIndex) {
      setSelected(null);
      return;
    }
    setSelected({ handIndex, card });
  };

  // Click the reserved card to play it (two-click targeting, like a hand card): a
  // no-target card resolves at once; a single/dead-target card arms reserveTargeting so
  // a hero pick finishes it. A second click (while targeting) cancels.
  const onReserveCardClick = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (animating || game.status !== 'playing' || game.phase !== 'player') return;
    const dc = game.reserveCard;
    if (dc == null) return;
    if (game.mp < game.effectiveCost(resolveCard(dc))) return; // unaffordable (Card shows the shake)
    const drops = game.reserveDropTargets();
    if (drops.board) { setReserveTargeting(false); playReservedCard(null); return; }
    if (reserveTargeting) { setReserveTargeting(false); return; } // toggle off
    if (drops.slots.length === 0) return; // nothing legal to target right now
    setSelected(null);
    setReserveTargeting(true);
  };

  const onMemberClick = (slot: Slot) => {
    if (animating) return;
    // Playing the reserved card: a hero pick resolves it on that hero.
    if (reserveActive) {
      if (game.reserveDropTargets().slots.includes(slot)) {
        setReserveTargeting(false);
        playReservedCard(slot);
      }
      return;
    }
    if (!selected) return;
    if (game.dropTargets(selected.handIndex).slots.includes(slot) === false) return; // invalid target
    const origin = originForUid(game.hand[selected.handIndex]?.uid);
    setSelected(null);
    playCard(selected.handIndex, slot, origin);
  };

  // Resolve where a drag was released. A hand card plays on a valid hero / the board, or
  // reserves onto the empty Reserve slot; the reserved card plays on a valid hero / the
  // board, or releases onto the discard pile. Anything else cancels.
  const resolveDrop = (source: DragSource, spec: DropSpec, uid: number, clientX: number, clientY: number) => {
    const main = mainRef.current;
    const el = document.elementFromPoint(clientX, clientY);
    if (!main || !el || !main.contains(el)) return; // released off the board -> cancel

    if (source.kind === 'hand') {
      // Onto the empty Reserve slot -> reserve it (free).
      if (game.reserveCard == null && el.closest('.reserve')) { reserve(source.handIndex); return; }
      if (el.closest('.hand-wrap')) return; // released on the hand row (piles, hand, gaps) -> cancel
      if (spec.board) { playCard(source.handIndex, null, originForUid(uid)); return; }
      const memberEl = el.closest('.member');
      if (!memberEl) return;                 // not over a hero -> cancel
      const slot = slotOf(memberEl);
      if (slot >= 0 && spec.slots.includes(slot)) playCard(source.handIndex, slot, originForUid(uid));
      // else: a hero that doesn't accept this card (incl. an ability card's wrong carrier) -> cancel
      return;
    }

    // source.kind === 'reserve'
    // Onto the discard pile -> release it (free, consumes the whole turn).
    if (game.canReleaseReserved() && el.closest('.discard-pile')) { setReserveTargeting(false); releaseReserved(measureHandBoxes()); return; }
    if (el.closest('.hand-wrap')) return; // released on the hand row (incl. its own slot) -> cancel
    if (spec.board) { setReserveTargeting(false); playReservedCard(null); return; }
    const memberEl = el.closest('.member');
    if (!memberEl) return;                  // not over a hero -> cancel
    const slot = slotOf(memberEl);
    if (slot >= 0 && spec.slots.includes(slot)) { setReserveTargeting(false); playReservedCard(slot); }
  };

  // Begin a drag gesture from a card. The listeners live for the life of the gesture
  // only, capturing this render's game/handlers; a press that never crosses the threshold
  // falls through to the normal click (select-then-target). Shared by hand cards and the
  // reserved card — `spec` is the source's own drop targets.
  const beginDrag = (source: DragSource, card: ResolvedCard, uid: number, spec: DropSpec, e: ReactPointerEvent) => {
    if (e.button !== 0) return; // primary button only
    if (animating || game.status !== 'playing' || game.phase !== 'player') return;
    // The extra landing zones a drag can use beyond a hero/board play.
    const canReserve = source.kind === 'hand' && game.reserveCard == null;
    const canRelease = source.kind === 'reserve' && game.canReleaseReserved();
    if (spec.slots.length === 0 && !spec.board && !canReserve && !canRelease) return; // nothing to drag onto
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
        // Arm the hero highlights via dropSpec (isValidTarget).
        if (source.kind === 'hand') { setReserveTargeting(false); setSelected({ handIndex: source.handIndex, card }); }
        else { setSelected(null); setReserveTargeting(false); }
      }
      setDragView({ source, card, uid, board: spec.board, x: ev.clientX - offsetX, y: ev.clientY - offsetY, w, h });
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
      if (ev.type !== 'pointercancel') resolveDrop(source, spec, uid, ev.clientX, ev.clientY);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onHandPointerDown = (handIndex: number, e: ReactPointerEvent) => {
    const dc = game.hand[handIndex];
    if (!dc) return;
    beginDrag({ kind: 'hand', handIndex }, resolveCard(dc), dc.uid, game.dropTargets(handIndex), e);
  };
  const onReservePointerDown = (e: ReactPointerEvent) => {
    const dc = game.reserveCard;
    if (dc == null) return;
    beginDrag({ kind: 'reserve' }, resolveCard(dc), dc.uid, game.reserveDropTargets(), e);
  };

  // Measure the hand BEFORE clearing selection/targeting so the discard-out fly has the
  // cards' real positions (#94).
  const onEndTurn = () => { const boxes = measureHandBoxes(); setSelected(null); setReserveTargeting(false); endTurn(boxes); };
  const onSkip = () => { const boxes = measureHandBoxes(); setSelected(null); setReserveTargeting(false); skipTurn(boxes); };

  // While a drag is live, cue the board: hero-targeted cards light their valid heroes
  // (isValidTarget); a no-target 'board' card arms the whole board. The source also cues
  // its extra landing zone — a hand card the empty Reserve slot, the reserved card the
  // discard pile (drag-from-hand / drag-from-reserve).
  const mainCls = dragView
    ? ['dragging',
       dragView.board && 'drag-board',
       dragView.source.kind === 'hand' ? 'drag-from-hand' : 'drag-from-reserve',
      ].filter(Boolean).join(' ')
    : undefined;

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
          occupying reserved space rather than pushing the hand down. The Reserve upkeep
          readout (91a) sits directly under the MP bar while a card is held. */}
      <div className="mana-row">
        <ChannelBanner game={game} />
        <div className="mana-center">
          <div className="mana-primary">
            <ManaBar game={game} animating={animating} />
            <Actions
              game={game}
              animating={animating}
              hasSelection={!!selected}
              onSkip={onSkip}
              onEndTurn={onEndTurn}
              onCancel={() => { setSelected(null); setReserveTargeting(false); }}
            />
          </div>
          {game.status === 'playing' && game.reserveCard != null && (
            <div className="reserve-upkeep"
              title="MP charged at the end of this turn while a card is reserved. It rises by 1 each turn the card stays in the Reserve.">
              Reserve upkeep: {game.reserveNextUpkeep()} MP
            </div>
          )}
        </div>
      </div>
      <Hand
        game={game}
        disabled={animating}
        drawCount={pileCounts.draw}
        discardCount={pileCounts.discard}
        selectedIndex={selected?.handIndex ?? null}
        selectedCard={selected?.card ?? null}
        onCardClick={onCardClick}
        onCardPointerDown={onHandPointerDown}
        draggingUid={dragView?.source.kind === 'hand' ? dragView.uid : null}
        // Reserving a hand card is drag-only: drop it onto the Reserve slot.
        reserveSlot={
          <Reserve
            game={game}
            animating={animating}
            onCardClick={onReserveCardClick}
            onCardPointerDown={onReservePointerDown}
            targeting={reserveTargeting}
            dragging={dragView?.source.kind === 'reserve'}
          />
        }
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
