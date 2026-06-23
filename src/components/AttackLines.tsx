import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Game } from '../engine';

// One drawn telegraph line: enemy anchor (x1,y1) -> target anchor (x2,y2),
// with a damage badge centered at (mx,my). All coords are relative to <main>.
interface LineSpec {
  x1: number; y1: number; x2: number; y2: number;
  mx: number; my: number;
  label: string; hidden: boolean; badgeW: number;
}

interface AttackLinesProps {
  game: Game;
  containerRef: RefObject<HTMLElement | null>;
}

// Draws the standing telegraph as SVG line(s) from the enemy to each target it
// will hit, with the damage at each line's center. Concealed attacks draw dotted
// purple lines to every living member with "???" for the damage.
//
// Geometry is measured from the live DOM (getBoundingClientRect) in a layout
// effect after each render, and on window resize. A signature guard means we
// only setState when the computed geometry actually changes, so the per-render
// measurement can't loop.
export function AttackLines({ game, containerRef }: AttackLinesProps) {
  const [lines, setLines] = useState<LineSpec[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const lastSig = useRef('');

  useLayoutEffect(() => {
    const main = containerRef.current;
    if (!main) return;

    const compute = () => {
      const specs = game.attackTargets();
      const mainRect = main.getBoundingClientRect();
      const out: LineSpec[] = [];

      const enemyEl = main.querySelector('.enemy');
      const partyEl = main.querySelector('.party');
      if (specs.length > 0 && enemyEl && partyEl) {
        const enemyRect = enemyEl.getBoundingClientRect();
        const partyChildren = partyEl.children;
        // Enemy anchor: bottom-center of the enemy panel.
        const ex = enemyRect.left + enemyRect.width / 2 - mainRect.left;
        const ey = enemyRect.bottom - mainRect.top;
        for (const spec of specs) {
          const memberEl = partyChildren[spec.slot] as HTMLElement | undefined;
          if (!memberEl) continue;
          const mr = memberEl.getBoundingClientRect();
          const tx = mr.left + mr.width / 2 - mainRect.left;
          const ty = mr.top - mainRect.top; // top-center of the member card
          out.push({
            x1: ex, y1: ey, x2: tx, y2: ty,
            mx: (ex + tx) / 2, my: (ey + ty) / 2,
            label: spec.hidden ? '???' : String(spec.damage),
            hidden: spec.hidden,
            badgeW: spec.hidden ? 36 : 26,
          });
        }
      }

      const nextSize = { w: mainRect.width, h: mainRect.height };
      const sig = JSON.stringify({ out, nextSize });
      if (sig !== lastSig.current) {
        lastSig.current = sig;
        setLines(out);
        setSize(nextSize);
      }
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  });

  return (
    <svg className="attack-lines" aria-hidden="true"
      viewBox={`0 0 ${size.w} ${size.h}`} width={size.w} height={size.h}>
      {lines.map((l, i) => (
        <g key={i}>
          <line
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            className={l.hidden ? 'atk-line hidden-line' : 'atk-line'}
          />
          <rect
            x={l.mx - l.badgeW / 2} y={l.my - 11} width={l.badgeW} height={22} rx={6}
            className={l.hidden ? 'atk-badge hidden-badge' : 'atk-badge'}
          />
          <text
            x={l.mx} y={l.my}
            className={l.hidden ? 'atk-text hidden-text' : 'atk-text'}
          >
            {l.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
