import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getAnimSpeed } from '../settings';
import type { GoldFxPlan } from '../goldFx';

// Full-viewport overlay for the end-of-fight gold burst (#59). Unlike FxLayer
// (which lives inside the battle container and so can't reach the topbar), this
// sits at the app root with `position: fixed` and pointer-events off, so it can
// fly coins to BOTH the party member cards and the topbar `.run-gold` counter —
// which live in different containers. It is purely presentational: useGame/App
// decide when and where; this just plays the coins and cleans itself up.

// A single coin's flight: viewport px start (the swarm origin), its own scattered
// spot within the origin cloud, and its own scattered landing near the destination,
// plus a launch delay so the cloud trickles out rather than snapping as one.
interface Coin {
  id: number;
  ox: number; oy: number;   // cloud-origin viewport px (all coins share this anchor)
  jx: number; jy: number;   // this coin's offset within the origin cloud
  ex: number; ey: number;   // this coin's landing offset from origin (delta + scatter)
  delay: number;            // ms stagger before this coin flies
}

// One resolved destination the coins fly to (viewport px), with its coin count.
export interface GoldFxTarget { x: number; y: number; particles: number; }

// A fully-measured job: the plan's targets resolved to on-screen coordinates,
// plus the swarm origin (where the loot gathers before splitting). `nonce`
// changes per fight so the same-shaped job still replays.
export interface GoldFxJob {
  nonce: number;
  origin: { x: number; y: number };
  targets: GoldFxTarget[];
}

// Per-coin animation length (before speed scaling): fade in as a cloud, hold that
// cloud briefly, then fly to a scattered landing. LAUNCH_WINDOW_MS is the total
// spread of launch delays across the WHOLE burst (not per coin), so the run lasts
// ~1s regardless of coin count — see GOLD_FX_TOTAL_MS.
const FLY_MS = 760;
const LAUNCH_WINDOW_MS = 220;

// Nominal total length of the burst before animSpeed scaling (~1s), so callers can
// hold a result overlay for exactly as long as the coins are on screen.
export const GOLD_FX_TOTAL_MS = LAUNCH_WINDOW_MS + FLY_MS;

// How far coins spread within the origin cloud, and how far their landings scatter
// around the destination (so a group reads as a cloud at both ends, never a point).
const CLOUD_W = 120, CLOUD_H = 84;
const LAND_W = 52, LAND_H = 46;

type CoinStyle = CSSProperties & Record<string, string | number>;

interface GoldFxProps {
  job: GoldFxJob | null;
  // Fired once the player's coins have reached the topbar, so the counter can
  // tick up "as/after" the coins arrive rather than the instant gold is awarded.
  onArrive?: () => void;
  // Fired once every coin has finished and the layer has cleaned up its nodes.
  onDone?: () => void;
}

export function GoldFx({ job, onArrive, onDone }: GoldFxProps) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const idRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clear any in-flight coins/timers when a new job arrives (or on unmount).
    const clear = () => { for (const t of timers.current) clearTimeout(t); timers.current = []; };
    clear();
    if (!job) { setCoins([]); return clear; }

    const speed = getAnimSpeed();
    const next: Coin[] = [];
    for (const target of job.targets) {
      const dx = target.x - job.origin.x;
      const dy = target.y - job.origin.y;
      for (let k = 0; k < target.particles; k++) {
        next.push({
          id: idRef.current++,
          ox: job.origin.x, oy: job.origin.y,
          // Own spot within the origin cloud, and own scattered landing near the
          // target — so the group is a cloud at BOTH ends, not stacked on a point.
          jx: (Math.random() - 0.5) * CLOUD_W, jy: (Math.random() - 0.5) * CLOUD_H,
          ex: dx + (Math.random() - 0.5) * LAND_W, ey: dy + (Math.random() - 0.5) * LAND_H,
          delay: 0, // assigned an even launch stagger across the whole burst below
        });
      }
    }
    // Spread every coin's launch evenly across a FIXED window (independent of count
    // and of target order), so the burst stays ~1s whether 3 coins fly or 60.
    const n = next.length;
    next.forEach((c, i) => { c.delay = n > 1 ? (i / (n - 1)) * LAUNCH_WINDOW_MS : 0; });
    setCoins(next);

    // The player's coins land on the topbar; tick the counter up a touch before the
    // last fade so the number moves "as" they arrive.
    timers.current.push(setTimeout(() => onArrive?.(), (LAUNCH_WINDOW_MS + FLY_MS * 0.72) * speed));
    timers.current.push(setTimeout(() => { setCoins([]); onDone?.(); }, (GOLD_FX_TOTAL_MS + 100) * speed));

    return clear;
    // Re-run only when a new job is handed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.nonce]);

  if (coins.length === 0) return null;
  const speed = getAnimSpeed();
  return (
    <div className="gold-fx-layer" aria-hidden="true">
      {coins.map((c) => {
        const style: CoinStyle = {
          left: c.ox, top: c.oy,
          '--jx': `${c.jx}px`, '--jy': `${c.jy}px`,
          '--ex': `${c.ex}px`, '--ey': `${c.ey}px`,
          '--dur': `${FLY_MS * speed}ms`,
          animationDelay: `${c.delay * speed}ms`,
        };
        return <span key={c.id} className="gold-coin" style={style}>⦿</span>;
      })}
    </div>
  );
}
