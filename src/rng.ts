// Small seedable PRNG (mulberry32) so fights are reproducible from a seed.
// The generator carries its state so a run can be saved and resumed mid-stream:
// getState() reads the current 32-bit position and setState() restores it, and a
// resumed generator continues the identical deterministic sequence (issue 11).
export interface Rng {
  (): number;
  getState(): number;
  setState(state: number): void;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  } as Rng;
  rng.getState = () => a >>> 0;
  rng.setState = (state: number) => { a = state >>> 0; };
  return rng;
}

// Fisher–Yates, in place, using the provided rng.
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// entries: [[key, weight], ...] -> returns a key with probability weight/total.
export function weightedPick<K>(entries: Array<[K, number]>, rng: Rng): K {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    if (r < w) return k;
    r -= w;
  }
  return entries[entries.length - 1][0];
}
