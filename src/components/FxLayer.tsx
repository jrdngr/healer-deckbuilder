import { useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { FX_DURATION } from '../animations';
import type { Anchor, FxInstance } from '../animations';

// Renders the active visual effects as absolutely-positioned, CSS-animated nodes
// over the battle layout. Each effect's logical anchor ('enemy' / 'mp' / a party
// slot) is resolved to on-screen coordinates by measuring the live DOM, the same
// trick AttackLines uses. Effects are spawned and removed by useGame; this layer
// is purely presentational. Particle directions are generated once per effect and
// cached so they stay put across the many re-renders during a sequence.
interface FxLayerProps {
  fx: FxInstance[];
  containerRef: RefObject<HTMLElement | null>;
}

interface Pt { x: number; y: number; }

// CSS custom properties we set inline; typed loosely so React accepts them.
type FxStyle = CSSProperties & Record<string, string | number>;

export function FxLayer({ fx, containerRef }: FxLayerProps) {
  const dirs = useRef<Map<number, number[]>>(new Map());
  const main = containerRef.current;

  if (!main || fx.length === 0) {
    if (fx.length === 0) dirs.current.clear(); // drop cached particle angles when idle
    return null;
  }

  const mainRect = main.getBoundingClientRect();
  const anchor = (a: Anchor): Pt | null => {
    let el: Element | null | undefined;
    if (a === 'enemy') el = main.querySelector('.enemy');
    else if (a === 'mp') el = main.querySelector('.mp-bar');
    else el = main.querySelector('.party')?.children[a];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - mainRect.left, y: r.top + r.height / 2 - mainRect.top };
  };

  // Stable random unit-angle set for a burst, generated once per effect id.
  const angles = (id: number, count: number): number[] => {
    let a = dirs.current.get(id);
    if (!a) {
      a = Array.from({ length: count }, (_, k) =>
        (k / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.9);
      dirs.current.set(id, a);
    }
    return a;
  };

  const render = ({ id, spec }: FxInstance) => {
    switch (spec.type) {
      case 'projectile':
      case 'beam': {
        const from = anchor(spec.from);
        const to = anchor(spec.to);
        if (!from || !to) return null;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (spec.type === 'beam') {
          const len = Math.hypot(dx, dy);
          const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
          const style: FxStyle = {
            left: from.x, top: from.y, width: len, color: spec.color,
            transform: `translateY(-50%) rotate(${deg}deg)`,
            '--dur': `${FX_DURATION.beam}ms`,
          };
          return <div key={id} className="fx fx-beam" style={style} />;
        }
        const style: FxStyle = {
          left: from.x, top: from.y, color: spec.color,
          '--dx': `${dx}px`, '--dy': `${dy}px`, '--dur': `${FX_DURATION.projectile}ms`,
        };
        return <div key={id} className="fx fx-proj" style={style} />;
      }
      case 'burst': {
        const at = anchor(spec.at);
        if (!at) return null;
        const style: FxStyle = { left: at.x, top: at.y, color: spec.color };
        return (
          <div key={id} className="fx fx-burst" style={style}>
            {angles(id, spec.count).map((ang, k) => {
              const ps: FxStyle = {
                '--dx': `${Math.cos(ang) * spec.spread}px`,
                '--dy': `${Math.sin(ang) * spec.spread}px`,
              };
              return <span key={k} className="fx-particle" style={ps} />;
            })}
          </div>
        );
      }
      case 'float': {
        const at = anchor(spec.at);
        if (!at) return null;
        const style: FxStyle = { left: at.x, top: at.y, color: spec.color };
        return (
          <div key={id} className={`fx fx-float${spec.big ? ' big' : ''}`} style={style}>
            {spec.text}
          </div>
        );
      }
      case 'ring': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-ring" style={{ left: at.x, top: at.y, color: spec.color }} />;
      }
      case 'shield': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-shield" style={{ left: at.x, top: at.y, color: spec.color }} />;
      }
      case 'pillar': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-pillar" style={{ left: at.x, top: at.y, color: spec.color }} />;
      }
      case 'glow': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-glow" style={{ left: at.x, top: at.y, color: spec.color }} />;
      }
      default:
        return null;
    }
  };

  return <div className="fx-layer" aria-hidden="true">{fx.map(render)}</div>;
}
