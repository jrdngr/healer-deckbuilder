import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Run } from '../run';
import { NODE_META } from './nodeMeta';
import { nextFightPreview, InjuryBanner, NodeTileBody } from './MapChrome';

interface MapScreenProps {
  run: Run;
  onChoose: (branch: number) => void;
}

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

// The fork between two fights: two branches of visible typed nodes, drawn as
// real diverging trails that reconverge on the next fight. Choosing a branch
// leads to its hub (BranchScreen), where the stops can be visited in any order
// before moving on. Nodes the party can't use right now (an Infirmary with no
// one injured) aren't shown.
export function MapScreen({ run, onChoose }: MapScreenProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (run.location.kind !== 'forkChoice') return null;
  const fork = run.map[run.location.forkIndex];
  const { foe, boss, threat } = nextFightPreview(run, run.location.forkIndex);

  const canvasCls = [
    'map-canvas',
    hovered !== null && `hover-${hovered}`,
  ].filter(Boolean).join(' ');

  return (
    <main className="map-screen">
      <h2 className="map-title">Choose your path</h2>
      <InjuryBanner run={run} />
      <div className={canvasCls}>
        <svg className="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {PATH_D.map((d, b) => (
            <path key={b} className={`map-path map-path-${b}`} d={d} pathLength={1} />
          ))}
        </svg>
        <div className="map-token" aria-hidden="true">◉</div>
        {fork.branches.map((branch, b) => (
          <div key={b} className={`map-branch-group branch-${b}`}
            onMouseEnter={() => setHovered(b)} onMouseLeave={() => setHovered(null)}>
            {branch.nodes.filter((node) => run.nodeAvailable(node.type)).map((node, i) => {
              const meta = NODE_META[node.type];
              const style: MapStyle = {
                left: `${BRANCH_X[b]}%`, top: `${NODE_Y[i]}%`,
                '--d': `${140 + b * 60 + i * 160}ms`,
              };
              return (
                <div className={`map-node type-${node.type}`} key={i} style={style}>
                  <NodeTileBody icon={meta.icon} label={meta.label} desc={meta.desc} />
                </div>
              );
            })}
            <button
              className="primary map-take"
              style={{ left: `${BRANCH_X[b]}%`, top: `${TAKE_Y}%`, '--d': '460ms' } as MapStyle}
              onClick={() => onChoose(b)}
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
          <NodeTileBody icon="⚔" label={`Ahead: ${foe.name}`} desc={threat} />
        </div>
      </div>
    </main>
  );
}
