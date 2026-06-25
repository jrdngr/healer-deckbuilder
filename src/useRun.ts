// Binds the pure Run model (see run.ts) to React, mirroring useGame: the single
// Run instance lives in a ref, and a tick reducer forces a re-render after each
// mutation. Screens read run state directly and call `act` with a mutation.
import { useCallback, useReducer, useRef } from 'react';
import { Run } from './run';

function randomSeed(): number {
  return (Math.random() * 1e9) | 0;
}

export interface RunController {
  run: Run;
  /** Run a mutation against the Run, then re-render. */
  act: (fn: (run: Run) => void) => void;
  /** Start a fresh run. Returns the seed actually used (random when omitted). */
  newRun: (seed?: number) => number;
}

export function useRun(initialSeed?: number): RunController {
  const ref = useRef<Run | null>(null);
  if (ref.current === null) {
    ref.current = new Run(Number.isFinite(initialSeed) ? (initialSeed as number) : randomSeed());
  }

  const [, force] = useReducer((x: number) => x + 1, 0);

  const act = useCallback((fn: (run: Run) => void) => {
    fn(ref.current!);
    force();
  }, []);

  const newRun = useCallback((seed?: number): number => {
    const s = Number.isFinite(seed) ? (seed as number) : randomSeed();
    ref.current = new Run(s);
    force();
    return s;
  }, []);

  return { run: ref.current, act, newRun };
}
