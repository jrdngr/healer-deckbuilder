import type { ReactNode } from 'react';
import { ENEMY_HP_BY_FIGHT, FIGHT_COUNT, isActBoss, memberDefAt } from '../constants';
import type { Run } from '../run';

// The next fight is shared by both fork paths and by the branch hub — preview its
// foe and a rough threat rating (flaw #15: no blind forks). peekEncounter is
// stream-independent, so previewing it changes nothing about the roll.
export function nextFightPreview(run: Run, forkIndex: number) {
  const nextFight = Math.min(forkIndex + 1, FIGHT_COUNT - 1);
  const foe = run.peekEncounter(nextFight);
  const boss = isActBoss(nextFight);
  const hp = ENEMY_HP_BY_FIGHT[nextFight] ?? 0;
  const threat = boss ? '💀💀💀' : hp >= 140 ? '💀💀' : '💀';
  return { nextFight, foe, boss, hp, threat };
}

// The "🩹 Injured: …" banner shown above the map and the branch hub. Renders
// nothing when nobody carries a scar.
export function InjuryBanner({ run }: { run: Run }) {
  const injured = run.party
    .map((p, slot) => ({ p, name: memberDefAt(run.party, slot).name }))
    .filter(({ p }) => p.injuries > 0);
  if (injured.length === 0) return null;
  return (
    <p className="map-sub party-injuries" title="Lasting injuries reduce a member's stats until healed at an Infirmary (or a Field Hospital / the Mending Totem).">
      🩹 Injured: {injured.map(({ p, name }) => `${name} ×${p.injuries}`).join(' · ')}
    </p>
  );
}

// The icon/label(/desc) trio inside a map node, branch stop, or start-screen tile.
// Returns the spans; the caller supplies the wrapper (a div or a button). `desc` is
// optional — the start-screen tiles show only an icon and a label.
export function NodeTileBody({ icon, label, desc }: { icon: ReactNode; label: ReactNode; desc?: ReactNode }) {
  return (
    <>
      <span className="map-node-icon" aria-hidden>{icon}</span>
      <span className="map-node-label">{label}</span>
      {desc != null && <span className="map-node-desc">{desc}</span>}
    </>
  );
}
