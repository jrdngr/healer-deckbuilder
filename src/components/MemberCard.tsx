import {
  CHARGE_MAX, BERSERKER_BAND_BONUS,
  INJURY_NAMES, MEMBER_ABILITY_FLAVOR, injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty,
} from '../constants';
import type { Member } from '../engine';

// One-line summary of the stat penalty a member's scars currently impose (DR1).
export function injuryPenaltyText(injuries: number): string {
  const parts: string[] = [];
  if (injuryMaxHPPenalty(injuries)) parts.push(`Max HP −${injuryMaxHPPenalty(injuries)}`);
  if (injuryDamagePenalty(injuries)) parts.push(`damage −${injuryDamagePenalty(injuries)}`);
  if (injuryAbilityPenalty(injuries)) parts.push(`ability −${injuryAbilityPenalty(injuries)}`);
  return parts.join(', ');
}

interface MemberCardProps {
  member: Member;
  // HP / death the card shows; staged by the animator so the bar and the DEAD
  // overlay land in step with the hit (or heal / resurrect) effect.
  displayHp: number;
  displayDead: boolean;
  mageCharge: number;
  // The member's CURRENT strike (game.memberDamage) — differs from the static base
  // for dynamic members (Skald cards-played, Berserker HP bands, #27/#28).
  liveDamage: number;
  // The Berserker's fight-relative rage thresholds [band1, band2] (#28); null for
  // everyone else. Drives the live-band readout on his card.
  berserkerBands: [number, number] | null;
  targetedByEnemy: boolean;
  validTarget: boolean;
  onClick: () => void;
}

export function MemberCard({
  member: m, displayHp, displayDead, mageCharge, liveDamage, berserkerBands, targetedByEnemy, validTarget, onClick,
}: MemberCardProps) {
  const hpPct = (displayHp / m.maxHP) * 100;
  // Berserker rage tier the card shows live (0 = calm, 1 = past band1, 2 = past band2).
  const rageTier = berserkerBands
    ? (displayHp <= berserkerBands[1] ? 2 : displayHp <= berserkerBands[0] ? 1 : 0)
    : 0;
  // Incapacitated (#33, 'incapacitate' injury mode): the member entered the fight
  // dead from a 4th scar and cannot be Resurrected — a run-layer state distinct from
  // an in-fight death. Only relevant while it starts dead (a normal mid-fight death
  // shows the plain DEAD overlay).
  const incapacitated = m.incapacitated && displayDead;
  const cls = ['member', displayDead && 'dead', incapacitated && 'incapacitated',
    targetedByEnemy && 'targeted-by-enemy', validTarget && 'valid-target']
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
      {incapacitated && (
        <div className="incap-overlay" title="A 4th scar took this member out of the run. Heal a scar at an Infirmary (or Field Hospital / Mending Totem) to restore them.">
          <span className="incap-title">☠ Incapacitated</span>
          <span className="incap-hint">heal a scar to restore</span>
        </div>
      )}
      <div className="atk" title="Attack"><span>{liveDamage}</span></div>
      <h3>{m.name}</h3>
      <div className="bar">
        <div className="bar-track">
          <div className="seg hp" style={{ left: 0, width: `${hpPct}%` }} />
        </div>
        <span className="bar-label">{displayHp} / {m.maxHP}</span>
      </div>
      <div className="badges">
        {m.shield && <span className="badge shield" title={`Shield — fully blocks the next damaging hit; fades unused in ${m.shieldTurns} enemy turn(s).`}>🛡 Shield</span>}
        {m.brace && <span className="badge shield" title={`Brace — the next damaging hit deals 2 less (consumed); fades unused in ${m.braceTurns} enemy turn(s).`}>🧱 Brace</span>}
        {m.ward > 0 && <span className="badge shield" title={`Ward — absorbs the next ${m.ward} damage, point for point.`}>💠 Ward {m.ward}</span>}
        {m.regen > 0 && <span className="badge regen" title={`Regen — heals ${m.regen} at the start of each of your turns for ${m.regenTurns} more turn(s).`}>♻ Regen {m.regen}</span>}
        {m.defense > 0 && <span className="badge defense" title={`Defense — incoming hits reduced by ${m.defenseAmount} for ${m.defense} more enemy turn(s).`}>🪖 Def {m.defenseAmount}·{m.defense}t</span>}
        {m.taunt > 0 && <span className="badge taunt" title={`Taunt — aimed attacks funnel onto this member for ${m.taunt} more enemy turn(s).`}>⚔ Taunt {m.taunt}</span>}
        {m.injuries > 0 && <span className="badge injury" title={`Injuries — ${INJURY_NAMES.slice(0, m.injuries).join(', ')} (${injuryPenaltyText(m.injuries)}). Heal at an Infirmary.`}>🩹 Injured {m.injuries}</span>}
        {m.boarHp > 0 && <span className="badge shield" title={`Boar — soaks every hit aimed at this slot (whole, no spill), for ${m.boarTurns} more enemy turn(s). Unhealable.`}>🐗 Boar {m.boarHp}·{m.boarTurns}t</span>}
      </div>
      {m.id === 'mage' && <div className="charge">⚡ Charge {mageCharge}/{CHARGE_MAX}</div>}
      {berserkerBands && (
        <div className={`charge rage-${rageTier}`} title={`Rage bands: +${BERSERKER_BAND_BONUS} at HP ≤ ${berserkerBands[0]}, +${BERSERKER_BAND_BONUS * 2} at HP ≤ ${berserkerBands[1]}.`}>
          🔥 {rageTier === 0 ? 'Calm' : rageTier === 1 ? 'Enraged' : 'Berserk'} — {liveDamage} dmg
        </div>
      )}
      <div className="ability">{MEMBER_ABILITY_FLAVOR[m.id]}</div>
    </div>
  );
}
