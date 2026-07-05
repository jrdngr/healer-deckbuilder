// Local, lightweight run statistics: total runs/wins and the best act reached.
// Persisted in localStorage beside the save. This is a scoreboard, NOT
// meta-progression — nothing here feeds back into a run (explicitly rejected: it
// would fight the seed-determinism contract). There is a single mode (2026-07), so
// stats are no longer split by difficulty.

export interface LocalStats {
  version: 2;
  runs: number; // finished runs (won or lost)
  wins: number;
  bestAct: number; // best act reached across all runs, 1-based (0 = none yet)
}

const STATS_KEY = 'healer-deckbuilder-stats-v1';

export function emptyStats(): LocalStats {
  return { version: 2, runs: 0, wins: 0, bestAct: 0 };
}

// Pure: fold one finished run into the stats. `actReached` is 1-based.
export function recordRunEnd(stats: LocalStats, won: boolean, actReached: number): LocalStats {
  return {
    ...stats,
    runs: stats.runs + 1,
    wins: stats.wins + (won ? 1 : 0),
    bestAct: Math.max(stats.bestAct, actReached),
  };
}

export function loadStats(): LocalStats {
  try {
    if (typeof localStorage === 'undefined') return emptyStats();
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const s = JSON.parse(raw) as LocalStats;
    return s && s.version === 2 ? s : emptyStats();
  } catch { return emptyStats(); }
}

export function saveStats(stats: LocalStats): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* storage unavailable — stats are best-effort */ }
}
