// Binds the imperative, mutate-in-place Game engine to React.
//
// The engine mutates state in place and returns nothing, so React can't "see"
// changes by reference. We keep the single Game instance in a ref and force a
// re-render after each action via a tick reducer. Components read the (mutated)
// instance fresh on every render — the same "render everything from state" model
// the old vanilla UI used, but now with React reconciliation doing the diffing.
import { useCallback, useReducer, useRef } from 'react';
import { Game } from './engine';

export interface GameController {
  game: Game;
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

export function useGame(initialSeed?: number): GameController {
  const ref = useRef<Game | null>(null);
  if (ref.current === null) ref.current = createGame(initialSeed);

  const [, force] = useReducer((x: number) => x + 1, 0);

  const newGame = useCallback((seed?: number): number => {
    const g = createGame(seed);
    ref.current = g;
    force();
    return g.seed;
  }, []);

  const playCard = useCallback((handIndex: number, target: number | null) => {
    const g = ref.current!;
    if (g.status !== 'playing' || g.phase !== 'player') return;
    g.playCard(handIndex, target);
    force();
  }, []);

  const skipTurn = useCallback(() => {
    const g = ref.current!;
    if (!g.canSkip()) return;
    g.skipTurn();
    force();
  }, []);

  const endTurn = useCallback(() => {
    const g = ref.current!;
    if (g.status !== 'playing') return;
    g.endTurn();
    force();
  }, []);

  return { game: ref.current, newGame, playCard, skipTurn, endTurn };
}
