// Binds the pure Run model (see run.ts) to React, mirroring useGame: the single
// Run instance lives in a ref, and a tick reducer forces a re-render after each
// mutation. Screens read run state directly and call `act` with a mutation.
import { useCallback, useReducer, useRef } from 'react';
import { Run } from './run';
import type { RunSnapshot } from './run';
import { loadStats, saveStats, recordRunEnd } from './stats';

function randomSeed(): number {
  return (Math.random() * 1e9) | 0;
}

// Boundary-only persistence (issue 11). The Run layer only ever represents
// between-fight/node state, so writing it after every mutation is boundary-safe.
const SAVE_KEY = 'healer-deckbuilder-save-v1';

// Read the stored snapshot, but only surface one we can actually resume (#46):
// Run.tryFromJSON rejects a wrong-version or corrupt/truncated snapshot without
// throwing, so the Continue button never appears for a save that would crash on
// resume (older strict `version ===` gate let a same-version-but-malformed save
// through, so the button showed and clicking it was a silent no-op).
function loadSnapshot(): RunSnapshot | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as RunSnapshot;
    return Run.tryFromJSON(snap) !== null ? snap : null;
  } catch { return null; }
}

function clearSave(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY);
  } catch { /* storage unavailable — nothing to clear */ }
}

function saveRun(run: Run): void {
  try {
    if (typeof localStorage === 'undefined') return;
    // Keep a save only while the run is in progress; clear it once it ends.
    if (run.status === 'playing') localStorage.setItem(SAVE_KEY, JSON.stringify(run.toJSON()));
    else localStorage.removeItem(SAVE_KEY);
  } catch { /* storage unavailable — run continues in-memory */ }
}

// Run a function against the Run (usually a mutation), re-render, and return its
// result — so callers can capture e.g. a random roll's outcome for display.
export type RunAct = <T>(fn: (run: Run) => T) => T;

export interface RunController {
  run: Run;
  act: RunAct;
  /** Start a fresh run. Returns the seed actually used (random when omitted). */
  newRun: (seed?: number) => number;
  /** Whether a resumable save exists (checked once at mount). */
  hasSave: boolean;
  /** Fight index the save is at or headed toward (null when no save). */
  savedFightIndex: number | null;
  /** Resume the saved run, if any. Returns the resumed seed, or null if no save. */
  continueRun: () => number | null;
}

export function useRun(initialSeed?: number): RunController {
  const ref = useRef<Run | null>(null);
  // Whether a save existed when the app loaded (drives the Continue button),
  // and where it stands (drives the resume card's position label).
  const hasSaveRef = useRef<boolean>(false);
  const savedFightRef = useRef<number | null>(null);
  if (ref.current === null) {
    const snap = loadSnapshot();
    hasSaveRef.current = snap !== null;
    savedFightRef.current = snap ? Run.upcomingFightIndex(snap.location) : null;
    ref.current = new Run(Number.isFinite(initialSeed) ? (initialSeed as number) : randomSeed());
  }

  const [, force] = useReducer((x: number) => x + 1, 0);

  const act = useCallback(<T,>(fn: (run: Run) => T): T => {
    const wasPlaying = ref.current!.status === 'playing';
    const out = fn(ref.current!);
    const run = ref.current!;
    // Fold a just-finished run into the local stats (#23) — once, at the
    // playing -> won/lost transition.
    if (wasPlaying && run.status !== 'playing') {
      saveStats(recordRunEnd(loadStats(), run.status === 'won', run.act + 1));
    }
    saveRun(run); // persist the new boundary state
    force();
    return out;
  }, []);

  const newRun = useCallback((seed?: number): number => {
    const s = Number.isFinite(seed) ? (seed as number) : randomSeed();
    ref.current = new Run(s);
    saveRun(ref.current);
    force();
    return s;
  }, []);

  const continueRun = useCallback((): number | null => {
    const snap = loadSnapshot();
    // tryFromJSON never throws (#46): a corrupt/older save resolves to null here
    // instead of taking down the Start screen. Drop the dead save and hide the
    // (now useless) Continue button so a returning player isn't stuck on a no-op.
    const resumed = snap ? Run.tryFromJSON(snap) : null;
    if (!resumed) {
      clearSave();
      hasSaveRef.current = false;
      savedFightRef.current = null;
      force();
      return null;
    }
    ref.current = resumed;
    force();
    return resumed.seed;
  }, []);

  return {
    run: ref.current, act, newRun,
    hasSave: hasSaveRef.current, savedFightIndex: savedFightRef.current, continueRun,
  };
}
