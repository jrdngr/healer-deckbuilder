import { ENEMY_HP_BY_FIGHT, FIGHT_COUNT, isActBoss, memberDefAt } from '../constants';
import type { Run } from '../run';
import { NODE_META } from './nodeMeta';

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

  const nextFight = Math.min(forkIndex + 1, FIGHT_COUNT - 1);
  const foe = run.peekEncounter(nextFight);
  const boss = isActBoss(nextFight);
  const hp = ENEMY_HP_BY_FIGHT[nextFight] ?? 0;
  const threat = boss ? '💀💀💀' : hp >= 140 ? '💀💀' : '💀';

  const injured = run.party
    .map((p, slot) => ({ p, name: memberDefAt(run.party, slot).name }))
    .filter(({ p }) => p.injuries > 0);

  return (
    <main className="branch-screen">
      <h2 className="map-title">Along the trail</h2>
      <p className="map-sub">Stop wherever you like, in any order — return as often as you want. The fight waits until you're ready.</p>
      {injured.length > 0 && (
        <p className="map-sub party-injuries" title="Lasting injuries reduce a member's stats until healed at an Infirmary (or a Field Hospital / the Mending Totem).">
          🩹 Injured: {injured.map(({ p, name }) => `${name} ×${p.injuries}`).join(' · ')}
        </p>
      )}
      <div className="branch-stops">
        {nodes.map((node, i) => {
          if (!run.nodeAvailable(node.type)) return null;
          const meta = NODE_META[node.type];
          const content = run.branchContent[i];
          const spent = content?.type === 'event' && content.done;
          return (
            <button key={i} className={`map-node branch-stop type-${node.type}`} onClick={() => onEnter(i)}>
              <span className="map-node-icon" aria-hidden>{meta.icon}</span>
              <span className="map-node-label">{meta.label}{spent ? ' — concluded' : content ? ' — visited' : ''}</span>
              <span className="map-node-desc">{meta.desc}</span>
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
