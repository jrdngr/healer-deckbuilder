import type { Run } from '../run';
import { NODE_META } from './nodeMeta';
import { nextFightPreview, InjuryBanner, NodeTileBody } from './MapChrome';

interface BranchScreenProps {
  run: Run;
  onEnter: (index: number) => void;
  onFight: () => void;
}

// The hub of a chosen branch: its stops laid out as doors the player can enter
// in any order, as many times as they like — a shop keeps the stock it was left
// with, a spent event stays spent — until they commit to the next fight.
// Unavailable stops (an Infirmary with no one injured) are hidden.
export function BranchScreen({ run, onEnter, onFight }: BranchScreenProps) {
  if (run.location.kind !== 'branch') return null;
  const { forkIndex, branch } = run.location;
  const nodes = run.map[forkIndex].branches[branch].nodes;
  const { foe, threat } = nextFightPreview(run, forkIndex);

  return (
    <main className="branch-screen">
      <h2 className="map-title">Along the trail</h2>
      <InjuryBanner run={run} />
      <div className="branch-stops">
        {nodes.map((node, i) => {
          if (!run.nodeAvailable(node.type)) return null;
          const meta = NODE_META[node.type];
          const content = run.branchContent[i];
          const spent = content?.type === 'event' && content.done;
          return (
            <button key={i} className={`map-node branch-stop type-${node.type}`} onClick={() => onEnter(i)}>
              <NodeTileBody
                icon={meta.icon}
                label={`${meta.label}${spent ? ' — concluded' : content ? ' — visited' : ''}`}
                desc={meta.desc}
              />
            </button>
          );
        })}
      </div>
      <button className="primary branch-fight" onClick={onFight}>
        Onward to the fight — {foe.name} {threat}
      </button>
    </main>
  );
}
