import { ENEMY_HP_BY_FIGHT, FIGHT_COUNT, isActBoss, MEMBER_DEFS } from '../constants';
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
  // The next fight is shared by both paths — preview its foe and rough threat
  // (flaw #15: no more blind forks). peekEncounter is stream-independent, so
  // showing it here changes nothing about the roll itself.
  const nextFight = Math.min(run.location.forkIndex + 1, FIGHT_COUNT - 1);
  const foe = run.peekEncounter(nextFight);
  const boss = isActBoss(nextFight);
  const hp = ENEMY_HP_BY_FIGHT[nextFight] ?? 0;
  const threat = boss ? '💀💀💀' : hp >= 140 ? '💀💀' : '💀';

  return (
    <main className="map-screen">
      <h2 className="map-title">Choose your path</h2>
      <p className="map-sub">You will visit both nodes on the path you pick, then reach the next fight.</p>
      <p className="map-sub next-fight" title={boss ? 'An act boss — expect a signature mechanic.' : 'A normal fight.'}>
        Ahead: <strong>{foe.name}</strong> {threat}
      </p>
      {(() => {
        const injured = MEMBER_DEFS.filter((d) => run.party[d.slot].injuries > 0);
        if (injured.length === 0) return null;
        return (
          <p className="map-sub party-injuries" title="Lasting injuries reduce a member's stats until healed at an Infirmary (or a Field Hospital / the Mending Totem).">
            🩹 Injured: {injured.map((d) => `${d.name} ×${run.party[d.slot].injuries}`).join(' · ')}
          </p>
        );
      })()}
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
