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

// A single coin's flight: viewport px start (the swarm origin) and delta to its
// destination, plus a stagger delay so the swarm trickles in rather than snapping.
interface Coin {
  id: number;
  ox: number; oy: number;   // swarm-origin viewport px
  jx: number; jy: number;   // initial scatter offset (coins gather from a cloud)
  dx: number; dy: number;   // delta from origin to destination
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

// Coin flight time (before speed scaling). The full run also includes the last
// coin's stagger delay; see GATHER/STAGGER below.
const FLY_MS = 900;
const GATHER_MS = 260;   // time coins spend converging into the swarm first
const STAGGER_MS = 22;   // per-coin launch stagger

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
          // Cloud scatter around the origin so the gather reads as a swarm.
          jx: (Math.random() - 0.5) * 90, jy: (Math.random() - 0.5) * 70,
          dx, dy,
          delay: 0, // assigned an even stagger across the whole swarm below
        });
      }
    }
    // Even stagger across the whole swarm (independent of target order) so coins
    // don't leave in per-target clumps.
    next.forEach((c, i) => { c.delay = i * STAGGER_MS; });
    setCoins(next);

    const lastDelay = next.length > 0 ? (next.length - 1) * STAGGER_MS : 0;
    const flightMs = (GATHER_MS + FLY_MS + lastDelay) * speed;
    // The player's coins are the last leg landing on the topbar; tick the counter
    // up a touch before the very last fade so the number moves "as" they arrive.
    timers.current.push(setTimeout(() => onArrive?.(), (GATHER_MS + FLY_MS * 0.75) * speed + lastDelay * speed));
    timers.current.push(setTimeout(() => { setCoins([]); onDone?.(); }, flightMs + 120 * speed));

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
          '--dx': `${c.dx}px`, '--dy': `${c.dy}px`,
          '--dur': `${(GATHER_MS + FLY_MS) * speed}ms`,
          animationDelay: `${c.delay * speed}ms`,
        };
        return <span key={c.id} className="gold-coin" style={style}>⦿</span>;
      })}
    </div>
  );
}
