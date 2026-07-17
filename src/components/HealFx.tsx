import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getAnimSpeed } from '../settings';

// Full-viewport overlay for the end-of-fight heal burst (#95). Sibling of GoldFx:
// when a fight is won the party recovers HP between fights (Run._healBetweenFights),
// and this floats each healed member's gain on their party card at the SAME beat the
// coins fly (App.onWinFx measures both from the live board and fires them together).
// Purely presentational — App decides when/where/how much from a non-mutating heal
// preview (Run.winHealPreview); this just plays the floats and cleans itself up.

// One healed member's float: viewport-px anchor (their party-card center) and the
// amount of HP recovered (toHP − fromHP, always > 0 — full-HP members are omitted).
export interface HealFxTarget { x: number; y: number; amount: number; }

// A measured job: the healed slots resolved to on-screen coordinates. `nonce`
// changes per fight so the same-shaped job still replays.
export interface HealFxJob { nonce: number; targets: HealFxTarget[]; }

// Float length before animSpeed scaling; shorter than the gold burst but plays
// within the same hold window (App returns the max of the two durations).
const FLOAT_MS = 900;
export const HEAL_FX_TOTAL_MS = FLOAT_MS;

interface HealFxProps {
  job: HealFxJob | null;
  // Fired once every float has finished and the layer has cleaned up its nodes.
  onDone?: () => void;
}

export function HealFx({ job, onDone }: HealFxProps) {
  const [targets, setTargets] = useState<HealFxTarget[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => { for (const t of timers.current) clearTimeout(t); timers.current = []; };
    clear();
    if (!job) { setTargets([]); return clear; }

    const speed = getAnimSpeed();
    setTargets(job.targets);
    timers.current.push(setTimeout(() => { setTargets([]); onDone?.(); }, (HEAL_FX_TOTAL_MS + 100) * speed));

    return clear;
    // Re-run only when a new job is handed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.nonce]);

  if (targets.length === 0) return null;
  const speed = getAnimSpeed();
  return (
    <div className="heal-fx-layer" aria-hidden="true">
      {targets.map((t, i) => {
        const style: CSSProperties & Record<string, string | number> = {
          left: t.x, top: t.y, '--dur': `${FLOAT_MS * speed}ms`,
        };
        return (
          <span key={`${job?.nonce}-${i}`} className="fx-float heal-float big" style={style}>
            +{t.amount}
          </span>
        );
      })}
    </div>
  );
}
