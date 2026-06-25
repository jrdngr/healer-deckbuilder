// Binds the pure Run model (see run.ts) to React, mirroring useGame: the single
// Run instance lives in a ref, and a tick reducer forces a re-render after each
// mutation. Screens read run state directly and call `act` with a mutation.
import { useCallback, useReducer, useRef } from 'react';
import { Run } from './run';

function randomSeed(): number {
  return (Math.random() * 1e9) | 0;
}

// Run a function against the Run (usually a mutation), re-render, and return its
// result — so callers can capture e.g. a random roll's outcome for display.
export type RunAct = <T>(fn: (run: Run) => T) => T;

export interface RunController {
  run: Run;
  act: RunAct;
  /** Start a fresh run. Returns the seed actually used (random when omitted). */
  newRun: (seed?: number) => number;
}

export function useRun(initialSeed?: number): RunController {
  const ref = useRef<Run | null>(null);
  if (ref.current === null) {
    ref.current = new Run(Number.isFinite(initialSeed) ? (initialSeed as number) : randomSeed());
  }

  const [, force] = useReducer((x: number) => x + 1, 0);

  const act = useCallback(<T,>(fn: (run: Run) => T): T => {
    const out = fn(ref.current!);
    force();
    return out;
  }, []);

  const newRun = useCallback((seed?: number): number => {
    const s = Number.isFinite(seed) ? (seed as number) : randomSeed();
    ref.current = new Run(s);
    force();
    return s;
  }, []);

  return { run: ref.current, act, newRun };
}
