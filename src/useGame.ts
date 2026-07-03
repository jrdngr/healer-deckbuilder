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
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Game } from './engine';
import type { GameEvent } from './engine';
import type { BattleConfig } from './constants';
import { buildTimeline, FX_DURATION } from './animations';
import { getAnimSpeed } from './settings';
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
  /** Dev-panel cheat hook: run an arbitrary engine mutation through the normal
   *  dispatch path so its events animate and the view/re-render stay in sync. */
  devAction: (mutate: (g: Game) => void) => void;
}

function randomSeed(): number {
  return (Math.random() * 1e9) | 0;
}

function createGame(seed?: number, config?: BattleConfig): Game {
  const g = new Game(Number.isFinite(seed) ? (seed as number) : randomSeed(), config);
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

// The board as it stood before turn 1's enemy phase: everything at full health.
// We start the view here so the opening attack animates the first hit landing,
// rather than loading straight into the already-damaged aftermath.
function preStartView(g: Game): BattleView {
  return {
    enemyHp: g.enemy.maxHP,
    memberHp: g.members.map((m) => m.maxHP),
    memberDead: g.members.map(() => false),
  };
}

export function useGame(initialSeed?: number, config?: BattleConfig): GameController {
  const ref = useRef<Game | null>(null);
  // The battle config is captured once on mount; the run remounts this hook (via a
  // keyed FightScreen) for each new fight, so each fight gets its own config.
  const configRef = useRef(config);
  // The first enemy phase (turn 1) runs inside start(); capture its events so the
  // opening effect can animate that attack instead of the board loading damaged.
  const openingEvents = useRef<GameEvent[]>([]);
  if (ref.current === null) {
    const g = createGame(initialSeed, configRef.current);
    ref.current = g;
    openingEvents.current = g.events.slice();
  }

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [view, setView] = useState<BattleView>(() => preStartView(ref.current!));
  const [fx, setFx] = useState<FxInstance[]>([]);
  const [animating, setAnimating] = useState(false);
  const [shakeTick, setShakeTick] = useState(0);

  // A ref mirrors `animating` so the dispatch guard sees it synchronously.
  const animatingRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fxId = useRef(0);
  // Guards the one-shot opening animation against React StrictMode's double mount.
  const openingDone = useRef(false);

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
    }, ms * getAnimSpeed()); // scale by the global animation-speed setting (issue 11)
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
  const playStaged = useCallback((timeline: Timeline, onDone?: () => void) => {
    const g = ref.current!;
    for (const entry of timeline.entries) {
      schedule(() => {
        if (entry.patch) applyPatch(entry.patch);
        if (entry.shake) setShakeTick((x) => x + 1);
        if (entry.fx) for (const spec of entry.fx) spawnFx(spec);
      }, entry.at);
    }
    // Unlock once the action has played out (paceEnd) rather than waiting for the
    // cosmetic fade-out (total) — the lingering particles/numbers finish on their
    // own. This roughly halves the input delay after the enemy's attack lands.
    schedule(() => {
      setView(snapshot(g));
      animatingRef.current = false;
      setAnimating(false);
      onDone?.();
    }, timeline.paceEnd + 100);
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

  // Animate the captured turn-1 enemy phase as a staged sequence, with the view
  // starting at full health (set by the caller) so the opening blow lands on
  // screen like any other attack.
  const playOpening = useCallback((events: GameEvent[]) => {
    const timeline = buildTimeline(events);
    if (timeline.entries.length === 0) {
      setView(snapshot(ref.current!));
      animatingRef.current = false;
      setAnimating(false);
      openingDone.current = true;
      return;
    }
    animatingRef.current = true;
    setAnimating(true);
    force();
    playStaged(timeline, () => { openingDone.current = true; });
  }, [playStaged]);

  // Play the opening attack once on mount. A layout effect so the board is locked
  // (and the next telegraph hidden) before the first paint — otherwise the
  // full-health board would flash for a frame. Re-runs harmlessly under
  // StrictMode's double mount: the captured events are replayed until the
  // sequence actually completes (openingDone), since the first pass's timers get
  // cancelled between the simulated unmount and remount.
  useLayoutEffect(() => {
    if (!openingDone.current) playOpening(openingEvents.current);
  }, [playOpening]);

  const newGame = useCallback((seed?: number): number => {
    clearTimers();
    const g = createGame(seed, configRef.current);
    ref.current = g;
    animatingRef.current = false;
    setFx([]);
    setShakeTick(0);
    setView(preStartView(g)); // full health; the opening attack patches it down
    force();
    playOpening(g.events.slice());
    return g.seed;
  }, [clearTimers, playOpening]);

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

  const devAction = useCallback((mutate: (g: Game) => void) => {
    dispatch(() => mutate(ref.current!), false);
  }, [dispatch]);

  // Return a STABLE controller reference. The fields are refreshed every render,
  // but the object identity is held constant (via a ref + Object.assign) so the
  // controller can be used safely in dependency arrays. FightScreen publishes this
  // object up to App in an effect keyed on the controller; a fresh object literal
  // each render would re-fire that effect -> setState -> re-render, looping until
  // React throws "Maximum update depth exceeded".
  const controllerRef = useRef<GameController>({} as GameController);
  return Object.assign(controllerRef.current, {
    game: ref.current, view, fx, animating, shakeTick, newGame, playCard, skipTurn, endTurn, devAction,
  });
}
