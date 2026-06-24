import { CHARGE_MAX, POISON_BASE, TAUNT_TURNS, DEFENSE_AMOUNT, BOLT_BASE } from '../constants';
import type { MemberId } from '../constants';
import type { Member } from '../engine';

// Short flavor of each member's ability, shown on their card.
const ABILITY: Record<MemberId, string> = {
  ranger: `Poison Arrow — stack Poison ${POISON_BASE} on the enemy.`,
  tank: `Taunt — pull the enemy onto the Tank and brace (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} turns.`,
  mage: `Lightning Bolt — deal ${BOLT_BASE} + Charge to the enemy.`,
};

interface MemberCardProps {
  member: Member;
  // HP / death the card shows; staged by the animator so the bar and the DEAD
  // overlay land in step with the hit (or heal / resurrect) effect.
  displayHp: number;
  displayDead: boolean;
  mageCharge: number;
  targetedByEnemy: boolean;
  // Next-turn telegraph chunks (0 when nothing is incoming / a sequence is playing).
  incomingDamage: number; // HP the next enemy attack will remove (red)
  pendingRegen: number;   // HP regen will restore next turn (lighter green)
  validTarget: boolean;
  onClick: () => void;
}

export function MemberCard({
  member: m, displayHp, displayDead, mageCharge, targetedByEnemy,
  incomingDamage, pendingRegen, validTarget, onClick,
}: MemberCardProps) {
  // Split the current HP into a safe (green) chunk and the part the next attack
  // will eat (red, at the right end); the regen heal rides past it toward maxHP.
  const dmg = Math.min(incomingDamage, displayHp);
  const safe = displayHp - dmg;
  const regen = Math.min(pendingRegen, m.maxHP - displayHp);
  const pct = (v: number) => (v / m.maxHP) * 100;
  const cls = ['member', displayDead && 'dead', targetedByEnemy && 'targeted-by-enemy', validTarget && 'valid-target']
    .filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={onClick}>
      <div className="atk" title="Attack"><span>{m.damage}</span></div>
      <h3>{m.name}</h3>
      <div className="bar">
        <div className="bar-track">
          <div className="seg hp" style={{ left: 0, width: `${pct(safe)}%` }} />
          {dmg > 0 && <div className="seg incoming" style={{ left: `${pct(safe)}%`, width: `${pct(dmg)}%` }} />}
          {regen > 0 && <div className="seg regen-pending" style={{ left: `${pct(safe + dmg)}%`, width: `${pct(regen)}%` }} />}
        </div>
        <span className="bar-label">{displayHp} / {m.maxHP}</span>
      </div>
      <div className="badges">
        {m.shield && <span className="badge shield">🛡 Shield</span>}
        {m.regen > 0 && <span className="badge regen">♻ Regen {m.regen}</span>}
        {m.defense > 0 && <span className="badge defense">🪖 Def {m.defense}</span>}
        {m.id === 'tank' && m.taunt > 0 && <span className="badge taunt">⚔ Taunt {m.taunt}</span>}
      </div>
      {m.id === 'mage' && <div className="charge">⚡ Charge {mageCharge}/{CHARGE_MAX}</div>}
      <div className="ability">{ABILITY[m.id]}</div>
    </div>
  );
}
