// Local, lightweight run statistics (issue 23): wins per difficulty and the
// best act reached. Persisted in localStorage beside the save. This is a
// scoreboard, NOT meta-progression — nothing here feeds back into a run
// (explicitly rejected: it would fight the seed-determinism contract).

import type { Difficulty } from './constants';

export interface LocalStats {
  version: 1;
  runs: Record<Difficulty, number>; // finished runs (won or lost)
  wins: Record<Difficulty, number>;
  bestAct: number; // best act reached across all runs, 1-based (0 = none yet)
}

const STATS_KEY = 'healer-deckbuilder-stats-v1';

export function emptyStats(): LocalStats {
  return {
    version: 1,
    runs: { story: 0, standard: 0, brutal: 0 },
    wins: { story: 0, standard: 0, brutal: 0 },
    bestAct: 0,
  };
}

// Pure: fold one finished run into the stats. `actReached` is 1-based.
export function recordRunEnd(stats: LocalStats, difficulty: Difficulty, won: boolean, actReached: number): LocalStats {
  return {
    ...stats,
    runs: { ...stats.runs, [difficulty]: stats.runs[difficulty] + 1 },
    wins: { ...stats.wins, [difficulty]: stats.wins[difficulty] + (won ? 1 : 0) },
    bestAct: Math.max(stats.bestAct, actReached),
  };
}

export function loadStats(): LocalStats {
  try {
    if (typeof localStorage === 'undefined') return emptyStats();
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const s = JSON.parse(raw) as LocalStats;
    return s && s.version === 1 ? s : emptyStats();
  } catch { return emptyStats(); }
}

export function saveStats(stats: LocalStats): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* storage unavailable — stats are best-effort */ }
}
