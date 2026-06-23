import { CHARGE_MAX, POISON_BASE, TAUNT_TURNS, BOLT_BASE } from '../constants';
import type { MemberId } from '../constants';
import type { Member } from '../engine';

// Short flavor of each member's ability, shown on their card.
const ABILITY: Record<MemberId, string> = {
  ranger: `Poison Arrow — stack Poison ${POISON_BASE} on the enemy.`,
  tank: `Taunt — force the enemy onto the Tank for ${TAUNT_TURNS} turns.`,
  mage: `Lightning Bolt — deal ${BOLT_BASE} + Charge to the enemy.`,
};

interface MemberCardProps {
  member: Member;
  mageCharge: number;
  targetedByEnemy: boolean;
  validTarget: boolean;
  onClick: () => void;
}

export function MemberCard({ member: m, mageCharge, targetedByEnemy, validTarget, onClick }: MemberCardProps) {
  const hpPct = (m.hp / m.maxHP) * 100;
  const low = hpPct <= 34;
  const cls = ['member', !m.alive && 'dead', targetedByEnemy && 'targeted-by-enemy', validTarget && 'valid-target']
    .filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={onClick}>
      <div className="atk" title="Attack"><span>{m.damage}</span></div>
      <h3>{m.name}</h3>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${hpPct}%`, background: low ? 'var(--hp-low)' : undefined }} />
        <span className="bar-label">{m.hp} / {m.maxHP}</span>
      </div>
      <div className="badges">
        {m.shield && <span className="badge shield">🛡 Shield</span>}
        {m.regen > 0 && <span className="badge regen">♻ Regen {m.regen}</span>}
        {m.id === 'tank' && m.taunt > 0 && <span className="badge taunt">⚔ Taunt {m.taunt}</span>}
      </div>
      {m.id === 'mage' && <div className="charge">⚡ Charge {mageCharge}/{CHARGE_MAX}</div>}
      <div className="ability">{ABILITY[m.id]}</div>
    </div>
  );
}
