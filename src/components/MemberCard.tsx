import {
  CHARGE_MAX, POISON_BASE, POISON_TURNS, TAUNT_TURNS, DEFENSE_AMOUNT, BOLT_BASE, BOLT_CHARGE_MULT,
  TITHE_AMOUNT, BARGAIN_HP_BASE, BARGAIN_HP_GROWTH, BARGAIN_MP, SKALD_DMG_PER_CARD, SKALD_DMG_CAP, CRESCENDO_DRAW,
  BERSERKER_BAND_BONUS, RAMPAGE_SELF_DMG, GRAVE_CHILL_REDUCTION,
  BOAR_HP, BOAR_TURNS, BOAR_STRIKE_BONUS,
  INJURY_NAMES, injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty,
} from '../constants';
import type { MemberId } from '../constants';
import type { Member } from '../engine';

// One-line summary of the stat penalty a member's scars currently impose (DR1).
export function injuryPenaltyText(injuries: number): string {
  const parts: string[] = [];
  if (injuryMaxHPPenalty(injuries)) parts.push(`Max HP −${injuryMaxHPPenalty(injuries)}`);
  if (injuryDamagePenalty(injuries)) parts.push(`damage −${injuryDamagePenalty(injuries)}`);
  if (injuryAbilityPenalty(injuries)) parts.push(`ability −${injuryAbilityPenalty(injuries)}`);
  return parts.join(', ');
}

// Short flavor of each member's ability, shown on their card.
const ABILITY: Record<MemberId, string> = {
  ranger: `Poison Arrow — Poison ${POISON_BASE}: ${POISON_BASE} damage per turn for ${POISON_TURNS} turns.`,
  tank: `Taunt — pull the enemy onto the Tank and brace (Defense ${DEFENSE_AMOUNT}) for ${TAUNT_TURNS} turns.`,
  mage: `Lightning Bolt — deal ${BOLT_BASE} + ${BOLT_CHARGE_MULT}×Charge to the enemy.`,
  warlock: `Dark Bargain — lose ${BARGAIN_HP_BASE}+${BARGAIN_HP_GROWTH}/cast HP for +${BARGAIN_MP} MP. Soul Tithe: −${TITHE_AMOUNT} HP each turn.`,
  skald: `Crescendo — draw ${CRESCENDO_DRAW}. Strikes for ${SKALD_DMG_PER_CARD}×cards played (cap ${SKALD_DMG_CAP}).`,
  berserker: `Rampage — strike for 2× current damage, then −${RAMPAGE_SELF_DMG} HP. Hits +${BERSERKER_BAND_BONUS}/+${BERSERKER_BAND_BONUS * 2} harder at low HP.`,
  graveAugur: `Grave Chill — shave ${GRAVE_CHILL_REDUCTION} damage per target off the enemy's telegraphed attack.`,
  beastWarden: `Call Boar — summon a ${BOAR_HP} HP Boar for ${BOAR_TURNS} turns; it soaks whole hits aimed at her and adds +${BOAR_STRIKE_BONUS} to her strike.`,
};

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
      <div className="ability">{ABILITY[m.id]}</div>
    </div>
  );
}
