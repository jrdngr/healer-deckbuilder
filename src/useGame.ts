// Binds the imperative, mutate-in-place Game engine to React, and plays back the
// engine's event feed as animations.
//
// The engine mutates state in place and returns nothing, so React can't "see"
// changes by reference — we keep the single Game instance in a ref and force a
// re-render after each action. On top of that, every action emits an ordered list
// of GameEvents (see engine.ts). We turn that into a timeline (see animations.ts)
// and walk it with timers: spawning visual effects, staging the HP/death values
// the bars show so they move in step with the effects, and shaking the screen.
// While a sequence is playing, input is gated (`animating`); when it finishes the
// staged view snaps back to the engine, which already holds the same final state.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Game } from './engine';
import { buildTimeline, FX_DURATION } from './animations';
import type { Timeline, DisplayPatch, FxInstance, FxSpec } from './animations';

// Staged display values overlaid on the engine while an animation plays. Only the
// things that should move in step with effects live here; everything else (MP,
// charge, badges, hand, telegraph) reads the engine directly and updates at once.
export interface BattleView {
  enemyHp: number;
  memberHp: number[];    // length 3
  memberDead: boolean[]; // length 3
}

export interface GameController {
  game: Game;
  view: BattleView;
  fx: FxInstance[];
  animating: boolean;
  shakeTick: number;
  /** Start a fresh fight. Returns the seed actually used (random when omitted). */
  newGame: (seed?: number) => number;
  playCard: (handIndex: number, target: number | null) => void;
  skipTurn: () => void;
  endTurn: () => void;
}

function randomSeed(): number {
  return (Math.random() * 1e9) | 0;
}

function createGame(seed?: number): Game {
  const g = new Game(Number.isFinite(seed) ? (seed as number) : randomSeed());
  g.start();
  return g;
}

function snapshot(g: Game): BattleView {
  return {
    enemyHp: g.enemy.hp,
    memberHp: g.members.map((m) => m.hp),
    memberDead: g.members.map((m) => !m.alive),
  };
}

export function useGame(initialSeed?: number): GameController {
  const ref = useRef<Game | null>(null);
  if (ref.current === null) ref.current = createGame(initialSeed);

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [view, setView] = useState<BattleView>(() => snapshot(ref.current!));
  const [fx, setFx] = useState<FxInstance[]>([]);
  const [animating, setAnimating] = useState(false);
  const [shakeTick, setShakeTick] = useState(0);

  // A ref mirrors `animating` so the dispatch guard sees it synchronously.
  const animatingRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fxId = useRef(0);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  // Cancel any in-flight animation timers if the component unmounts.
  useEffect(() => clearTimers, [clearTimers]);

  // Run `fn` after `ms`, tracking the timer so it can be cancelled (newGame /
  // unmount) and dropping it from the list once it fires, so the list only ever
  // holds pending timers even across many overlapping live card animations.
  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  }, []);

  const applyPatch = useCallback((p: DisplayPatch) => {
    setView((v) => {
      const next: BattleView = {
        enemyHp: v.enemyHp,
        memberHp: [...v.memberHp],
        memberDead: [...v.memberDead],
      };
      if (p.enemyHp != null) next.enemyHp = p.enemyHp;
      if (p.memberHp) next.memberHp[p.memberHp.slot] = p.memberHp.hp;
      if (p.memberDead != null) next.memberDead[p.memberDead] = true;
      if (p.memberAlive != null) next.memberDead[p.memberAlive] = false;
      return next;
    });
  }, []);

  const spawnFx = useCallback((spec: FxSpec) => {
    const id = fxId.current++;
    setFx((cur) => [...cur, { id, spec }]);
    schedule(() => setFx((cur) => cur.filter((f) => f.id !== id)), FX_DURATION[spec.type] + 40);
  }, [schedule]);

  // Staged, blocking playback for end-of-turn sequences (party + enemy phases).
  // The view is held at its pre-action values and patched forward step by step so
  // bars move with each effect; input stays locked until the sequence finishes.
  const playStaged = useCallback((timeline: Timeline) => {
    const g = ref.current!;
    for (const entry of timeline.entries) {
      schedule(() => {
        if (entry.patch) applyPatch(entry.patch);
        if (entry.shake) setShakeTick((x) => x + 1);
        if (entry.fx) for (const spec of entry.fx) spawnFx(spec);
      }, entry.at);
    }
    // When the last effect has faded, snap the view to the engine and unlock.
    schedule(() => {
      setView(snapshot(g));
      animatingRef.current = false;
      setAnimating(false);
    }, timeline.total + 100);
  }, [schedule, applyPatch, spawnFx]);

  // Live, non-blocking playback for the player's own card plays. The result is
  // already reflected on the bars; we just layer the effects and shakes on top
  // without locking input, so cards can be chained freely. Display patches are
  // skipped here (the view already holds the final values).
  const playLive = useCallback((timeline: Timeline) => {
    for (const entry of timeline.entries) {
      schedule(() => {
        if (entry.shake) setShakeTick((x) => x + 1);
        if (entry.fx) for (const spec of entry.fx) spawnFx(spec);
      }, entry.at);
    }
  }, [schedule, spawnFx]);

  // Run an engine mutation, then animate the events it produced. `staged` actions
  // (end turn / rest) lock input and step the view through the enemy/party phase;
  // unstaged actions (playing a card) keep input responsive. A play that ends the
  // fight is always staged so the win/lose flourish lands before the result card.
  const dispatch = useCallback((run: () => void, staged: boolean) => {
    const g = ref.current!;
    if (animatingRef.current) return; // a staged sequence is mid-play — block input
    run();
    const timeline = buildTimeline(g.events);
    if (staged || g.status !== 'playing') {
      // The view already holds the pre-action HP (every path leaves it synced to
      // the engine); the timeline patches it forward in step with the effects.
      if (timeline.entries.length === 0) { setView(snapshot(g)); force(); return; }
      animatingRef.current = true;
      setAnimating(true);
      force();
      playStaged(timeline);
    } else {
      // Reflect the play immediately, then play its effects live over the top.
      setView(snapshot(g));
      force();
      if (timeline.entries.length > 0) playLive(timeline);
    }
  }, [playStaged, playLive]);

  const newGame = useCallback((seed?: number): number => {
    clearTimers();
    const g = createGame(seed);
    ref.current = g;
    animatingRef.current = false;
    setAnimating(false);
    setFx([]);
    setView(snapshot(g));
    setShakeTick(0);
    force();
    return g.seed;
  }, [clearTimers]);

  const playCard = useCallback((handIndex: number, target: number | null) => {
    const g = ref.current!;
    if (g.status !== 'playing' || g.phase !== 'player') return;
    dispatch(() => g.playCard(handIndex, target), false); // live: don't lock input
  }, [dispatch]);

  const skipTurn = useCallback(() => {
    const g = ref.current!;
    if (!g.canSkip()) return;
    dispatch(() => g.skipTurn(), true); // ends the turn -> staged enemy/party phase
  }, [dispatch]);

  const endTurn = useCallback(() => {
    const g = ref.current!;
    if (g.status !== 'playing') return;
    dispatch(() => g.endTurn(), true); // staged enemy/party phase
  }, [dispatch]);

  return { game: ref.current, view, fx, animating, shakeTick, newGame, playCard, skipTurn, endTurn };
}
