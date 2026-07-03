import { CHARGE_MAX, POISON_BASE, POISON_TURNS, TAUNT_TURNS, DEFENSE_AMOUNT, BOLT_BASE, BOLT_CHARGE_MULT } from '../constants';
import type { MemberId } from '../constants';
import type { Member } from '../engine';

// Short flavor of each member's ability, shown on their card.
const ABILITY: Record<MemberId, string> = {
  ranger: `Poison Arrow — Poison ${POISON_BASE}: ${POISON_BASE} damage per turn for ${POISON_TURNS} turns.`,
  tank: `Taunt — pull the enemy onto the Tank and brace (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} turns.`,
  mage: `Lightning Bolt — deal ${BOLT_BASE} + ${BOLT_CHARGE_MULT}×Charge to the enemy.`,
};

interface MemberCardProps {
  member: Member;
  // HP / death the card shows; staged by the animator so the bar and the DEAD
  // overlay land in step with the hit (or heal / resurrect) effect.
  displayHp: number;
  displayDead: boolean;
  mageCharge: number;
  targetedByEnemy: boolean;
  validTarget: boolean;
  onClick: () => void;
}

export function MemberCard({
  member: m, displayHp, displayDead, mageCharge, targetedByEnemy, validTarget, onClick,
}: MemberCardProps) {
  const hpPct = (displayHp / m.maxHP) * 100;
  const cls = ['member', displayDead && 'dead', targetedByEnemy && 'targeted-by-enemy', validTarget && 'valid-target']
    .filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      // A member card is only a control while the player is picking a target;
      // the rest of the time it is a status panel and stays out of the tab order.
      role={validTarget ? 'button' : undefined}
      tabIndex={validTarget ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!validTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
    >
      <div className="atk" title="Attack"><span>{m.damage}</span></div>
      <h3>{m.name}</h3>
      <div className="bar">
        <div className="bar-track">
          <div className="seg hp" style={{ left: 0, width: `${hpPct}%` }} />
        </div>
        <span className="bar-label">{displayHp} / {m.maxHP}</span>
      </div>
      <div className="badges">
        {m.shield && <span className="badge shield">🛡 Shield</span>}
        {m.brace && <span className="badge shield">🧱 Brace</span>}
        {m.regen > 0 && <span className="badge regen">♻ Regen {m.regen}</span>}
        {m.defense > 0 && <span className="badge defense">🪖 Def {m.defenseAmount}·{m.defense}t</span>}
        {m.id === 'tank' && m.taunt > 0 && <span className="badge taunt">⚔ Taunt {m.taunt}</span>}
      </div>
      {m.id === 'mage' && <div className="charge">⚡ Charge {mageCharge}/{CHARGE_MAX}</div>}
      <div className="ability">{ABILITY[m.id]}</div>
    </div>
  );
}
