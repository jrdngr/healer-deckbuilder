import type { Run } from '../run';
import { NODE_META } from './nodeMeta';

interface MapScreenProps {
  run: Run;
  onChoose: (branch: number) => void;
}

// The fork between two fights: two branches, each of two visible typed nodes that
// will be visited in sequence. Choosing a branch commits to both its nodes.
export function MapScreen({ run, onChoose }: MapScreenProps) {
  if (run.location.kind !== 'forkChoice') return null;
  const fork = run.map[run.location.forkIndex];

  return (
    <main className="map-screen">
      <h2 className="map-title">Choose your path</h2>
      <p className="map-sub">You will visit both nodes on the path you pick, then reach the next fight.</p>
      <div className="map-forks">
        {fork.branches.map((branch, b) => (
          <div className="map-branch" key={b}>
            <ol className="map-nodes">
              {branch.nodes.map((node, i) => {
                const meta = NODE_META[node.type];
                return (
                  <li className="map-node" key={i}>
                    <span className="map-node-icon" aria-hidden>{meta.icon}</span>
                    <span className="map-node-label">{meta.label}</span>
                    <span className="map-node-desc">{meta.desc}</span>
                  </li>
                );
              })}
            </ol>
            <button className="primary map-take" onClick={() => onChoose(b)}>
              Take this path
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
