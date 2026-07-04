import { useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { FX_DURATION } from '../animations';
import type { Anchor, FxInstance, FxSpec } from '../animations';
import { getAnimSpeed } from '../settings';

// Renders the active visual effects as absolutely-positioned, CSS-animated nodes
// over the battle layout. Each effect's logical anchor ('enemy' / 'mp' / a party
// slot) is resolved to on-screen coordinates by measuring the live DOM, the same
// trick AttackLines uses. Anchorless effects (banner, vignette) span the whole
// container instead. Effects are spawned and removed by useGame; this layer is
// purely presentational. Particle offsets are generated once per effect and
// cached so they stay put across the many re-renders during a sequence.
interface FxLayerProps {
  fx: FxInstance[];
  containerRef: RefObject<HTMLElement | null>;
}

interface Pt { x: number; y: number; }

// CSS custom properties we set inline; typed loosely so React accepts them.
type FxStyle = CSSProperties & Record<string, string | number>;

// Every effect gets its CSS duration from here so the animation-speed setting
// scales the visuals in step with the JS timers that spawn/remove them.
const dur = (type: FxSpec['type']): string => `${FX_DURATION[type] * getAnimSpeed()}ms`;

export function FxLayer({ fx, containerRef }: FxLayerProps) {
  const dirs = useRef<Map<number, Pt[]>>(new Map());
  const main = containerRef.current;

  if (!main || fx.length === 0) {
    if (fx.length === 0) dirs.current.clear(); // drop cached particle offsets when idle
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

  // Stable random offset set for a burst, generated once per effect id. The
  // burst mode picks the motion: radial explosion, upward drift, or crumble.
  const offsets = (id: number, count: number, spread: number,
    mode: 'radial' | 'rise' | 'fall'): Pt[] => {
    let o = dirs.current.get(id);
    if (!o) {
      o = Array.from({ length: count }, (_, k) => {
        if (mode === 'rise') {
          return {
            x: (Math.random() - 0.5) * spread * 1.3,
            y: -(spread * 0.7 + Math.random() * spread * 0.9),
          };
        }
        if (mode === 'fall') {
          return {
            x: (Math.random() - 0.5) * spread * 1.1,
            y: spread * 0.5 + Math.random() * spread * 0.9,
          };
        }
        const ang = (k / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
        return { x: Math.cos(ang) * spread, y: Math.sin(ang) * spread };
      });
      dirs.current.set(id, o);
    }
    return o;
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
            '--dur': dur('beam'),
          };
          return <div key={id} className="fx fx-beam" style={style} />;
        }
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const style: FxStyle = {
          left: from.x, top: from.y, color: spec.color,
          '--dx': `${dx}px`, '--dy': `${dy}px`, '--dur': dur('projectile'),
          '--ang': `${deg}deg`, '--pscale': spec.scale ?? 1,
        };
        if (spec.variant === 'arc') {
          // Outer div flies the straight line; inner div adds the vertical hump.
          return (
            <div key={id} className="fx fx-proj-arc" style={style}>
              <div className="fx-proj-arc-inner" style={{ '--dur': dur('projectile') } as FxStyle}>
                <div className="fx-proj-visual" />
              </div>
            </div>
          );
        }
        return <div key={id} className={`fx fx-proj${spec.variant === 'trail' ? ' trail' : ''}`} style={style} />;
      }
      case 'burst': {
        const at = anchor(spec.at);
        if (!at) return null;
        const mode = spec.mode ?? 'radial';
        const style: FxStyle = { left: at.x, top: at.y, color: spec.color, '--dur': dur('burst') };
        return (
          <div key={id} className="fx fx-burst" style={style}>
            {offsets(id, spec.count, spec.spread, mode).map((o, k) => {
              const ps: FxStyle = { '--dx': `${o.x}px`, '--dy': `${o.y}px` };
              return <span key={k} className={`fx-particle ${mode}`} style={ps} />;
            })}
          </div>
        );
      }
      case 'float': {
        const at = anchor(spec.at);
        if (!at) return null;
        const style: FxStyle = { left: at.x, top: at.y, color: spec.color, '--dur': dur('float') };
        return (
          <div key={id} className={`fx fx-float${spec.big ? ' big' : ''}`} style={style}>
            {spec.text}
          </div>
        );
      }
      case 'ring': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-ring"
          style={{ left: at.x, top: at.y, color: spec.color, '--dur': dur('ring') } as FxStyle} />;
      }
      case 'shield': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-shield"
          style={{ left: at.x, top: at.y, color: spec.color, '--dur': dur('shield') } as FxStyle} />;
      }
      case 'pillar': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-pillar"
          style={{ left: at.x, top: at.y, color: spec.color, '--dur': dur('pillar') } as FxStyle} />;
      }
      case 'glow': {
        const at = anchor(spec.at);
        if (!at) return null;
        return <div key={id} className="fx fx-glow"
          style={{ left: at.x, top: at.y, color: spec.color, '--dur': dur('glow') } as FxStyle} />;
      }
      case 'slash': {
        const at = anchor(spec.at);
        if (!at) return null;
        const style: FxStyle = {
          left: at.x, top: at.y, color: spec.color,
          '--angle': `${spec.angle ?? -28}deg`, '--dur': dur('slash'),
        };
        return <div key={id} className="fx fx-slash" style={style} />;
      }
      case 'banner': {
        // Anchorless: a text band across the board, vertically near the center.
        const style: FxStyle = {
          left: 0, right: 0, top: mainRect.height * 0.38, color: spec.color,
          '--dur': dur('banner'),
        };
        return <div key={id} className="fx fx-banner" style={style}>{spec.text}</div>;
      }
      case 'vignette': {
        // Anchorless: a full-container wash — edge tint or center flash.
        const style: FxStyle = { color: spec.color, '--dur': dur('vignette') };
        return <div key={id} className={`fx fx-vignette ${spec.mode}`} style={style} />;
      }
      default:
        return null;
    }
  };

  return <div className="fx-layer" aria-hidden="true">{fx.map(render)}</div>;
}
