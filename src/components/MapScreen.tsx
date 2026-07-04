import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ENEMY_HP_BY_FIGHT, FIGHT_COUNT, isActBoss, memberDefAt } from '../constants';
import type { Run } from '../run';
import { NODE_META } from './nodeMeta';
import { getAnimSpeed } from '../settings';

interface MapScreenProps {
  run: Run;
  onChoose: (branch: number) => void;
}

// How long the leaving transition plays (party token travels the chosen trail)
// before the run actually advances. Scaled by the animation-speed setting.
const LEAVE_MS = 780;

// Column x-positions (percent of the canvas) for the two branches, and the
// y-positions of the waypoints going down the map.
const BRANCH_X = [25, 75];
const NODE_Y = [32, 58];
const TAKE_Y = 71.5;
const ORIGIN = { x: 50, y: 6 };
const FIGHT_Y = 88;

// The two diverging trails, in the SVG's 0-100 viewBox space. pathLength=1 lets
// CSS draw them with a plain dashoffset 1 -> 0, no measuring.
const PATH_D = [
  `M ${ORIGIN.x} ${ORIGIN.y} C 38 12, ${BRANCH_X[0]} 18, ${BRANCH_X[0]} ${NODE_Y[0]} L ${BRANCH_X[0]} ${NODE_Y[1]} C ${BRANCH_X[0]} 72, 38 80, 50 ${FIGHT_Y}`,
  `M ${ORIGIN.x} ${ORIGIN.y} C 62 12, ${BRANCH_X[1]} 18, ${BRANCH_X[1]} ${NODE_Y[0]} L ${BRANCH_X[1]} ${NODE_Y[1]} C ${BRANCH_X[1]} 72, 62 80, 50 ${FIGHT_Y}`,
];

type MapStyle = CSSProperties & Record<string, string | number>;

// The fork between two fights: two branches, each of two visible typed nodes
// that will be visited in sequence, drawn as real diverging trails that
// reconverge on the next fight. Choosing a branch commits to both its nodes:
// the party token travels the chosen trail before the run advances.
export function MapScreen({ run, onChoose }: MapScreenProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [leaving, setLeaving] = useState<number | null>(null);
  if (run.location.kind !== 'forkChoice') return null;
  const fork = run.map[run.location.forkIndex];
  // The next fight is shared by both paths — preview its foe and rough threat
  // (flaw #15: no more blind forks). peekEncounter is stream-independent, so
  // showing it here changes nothing about the roll itself.
  const nextFight = Math.min(run.location.forkIndex + 1, FIGHT_COUNT - 1);
  const foe = run.peekEncounter(nextFight);
  const boss = isActBoss(nextFight);
  const hp = ENEMY_HP_BY_FIGHT[nextFight] ?? 0;
  const threat = boss ? '💀💀💀' : hp >= 140 ? '💀💀' : '💀';

  const take = (b: number) => {
    if (leaving !== null) return;
    setLeaving(b);
    const reduced = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => onChoose(b), (reduced ? 120 : LEAVE_MS) * getAnimSpeed());
  };

  const canvasCls = [
    'map-canvas',
    hovered !== null && leaving === null && `hover-${hovered}`,
    leaving !== null && `leaving chosen-${leaving}`,
  ].filter(Boolean).join(' ');

  const injured = run.party
    .map((p, slot) => ({ p, name: memberDefAt(run.party, slot).name }))
    .filter(({ p }) => p.injuries > 0);

  return (
    <main className="map-screen">
      <h2 className="map-title">Choose your path</h2>
      <p className="map-sub">You will visit both nodes on the path you pick, then reach the next fight.</p>
      {injured.length > 0 && (
        <p className="map-sub party-injuries" title="Lasting injuries reduce a member's stats until healed at an Infirmary (or a Field Hospital / the Mending Totem).">
          🩹 Injured: {injured.map(({ p, name }) => `${name} ×${p.injuries}`).join(' · ')}
        </p>
      )}
      <div className={canvasCls}>
        <svg className="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {PATH_D.map((d, b) => (
            <path key={b} className={`map-path map-path-${b}`} d={d} pathLength={1} />
          ))}
        </svg>
        <div className={`map-token${leaving !== null ? ` travel-${leaving}` : ''}`} aria-hidden="true">◉</div>
        {fork.branches.map((branch, b) => (
          <div key={b} className={`map-branch-group branch-${b}${leaving === b ? ' chosen' : ''}`}
            onMouseEnter={() => setHovered(b)} onMouseLeave={() => setHovered(null)}>
            {branch.nodes.map((node, i) => {
              const meta = NODE_META[node.type];
              const style: MapStyle = {
                left: `${BRANCH_X[b]}%`, top: `${NODE_Y[i]}%`,
                '--d': `${140 + b * 60 + i * 160}ms`,
              };
              return (
                <div className={`map-node type-${node.type}`} key={i} style={style}>
                  <span className="map-node-icon" aria-hidden>{meta.icon}</span>
                  <span className="map-node-label">{meta.label}</span>
                  <span className="map-node-desc">{meta.desc}</span>
                </div>
              );
            })}
            <button
              className="primary map-take"
              style={{ left: `${BRANCH_X[b]}%`, top: `${TAKE_Y}%`, '--d': '460ms' } as MapStyle}
              onClick={() => take(b)}
              disabled={leaving !== null}
            >
              Take this path
            </button>
          </div>
        ))}
        <div
          className={`map-node map-next-fight${boss ? ' boss' : ''}`}
          style={{ left: '50%', top: `${FIGHT_Y}%`, '--d': '620ms' } as MapStyle}
          title={boss ? 'An act boss — expect a signature mechanic.' : 'A normal fight.'}
        >
          <span className="map-node-icon" aria-hidden>⚔</span>
          <span className="map-node-label">Ahead: {foe.name}</span>
          <span className="map-node-desc">{threat}</span>
        </div>
      </div>
    </main>
  );
}
