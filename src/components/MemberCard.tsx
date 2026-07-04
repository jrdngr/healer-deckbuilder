import { useEffect, useRef } from 'react';
import {
  CHARGE_MAX, BERSERKER_BAND_BONUS,
  INJURY_NAMES, MEMBER_ABILITY_FLAVOR, injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty,
} from '../constants';
import type { Member } from '../engine';
import type { MemberReactKind } from '../animations';
import type { MemberReactState } from '../useGame';

// How long each one-shot reaction class stays on the card (matches the CSS
// animation lengths in styles.css).
const REACT_MS: Record<MemberReactKind, number> = {
  hit: 360, heal: 520, death: 700, block: 400, lunge: 420,
};
const REACT_CLASSES = ['react-hit', 'react-heal', 'react-death', 'react-block', 'react-lunge'];

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
  // The latest one-shot reaction for this card (recoil / heal pulse / collapse);
  // seq bumps on every trigger so repeats restart the animation.
  react: MemberReactState | null;
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
  member: m, displayHp, displayDead, react, mageCharge, liveDamage, berserkerBands, targetedByEnemy, validTarget, onClick,
}: MemberCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Play the one-shot reaction by (re)applying its class — the remove + reflow
  // dance restarts the CSS animation even when the same reaction repeats (same
  // trick the board shake uses in BattleScreen).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !react) return;
    el.classList.remove(...REACT_CLASSES);
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add(`react-${react.kind}`);
    const timer = setTimeout(() => el.classList.remove(`react-${react.kind}`), REACT_MS[react.kind]);
    return () => clearTimeout(timer);
  }, [react?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Low-HP heartbeat: the card's border pulses red under 30% HP and quickens
  // under 15% — a state-driven ambient cue, not tied to any animation sequence.
  const hpFrac = m.maxHP > 0 ? displayHp / m.maxHP : 0;
  const heartbeat = !displayDead && hpFrac > 0 && hpFrac < 0.3
    ? (hpFrac < 0.15 ? 'hp-crit' : 'hp-low') : null;
  const cls = ['member', displayDead && 'dead', incapacitated && 'incapacitated',
    heartbeat,
    targetedByEnemy && 'targeted-by-enemy', validTarget && 'valid-target']
    .filter(Boolean).join(' ');
  // Persistent status auras (visible from across the screen; the pills keep the
  // exact numbers). Suppressed while the card shows as dead.
  const rim = displayDead ? null : m.shield ? 'shield' : m.ward > 0 ? 'ward' : m.brace ? 'brace' : null;
  const showTaunt = !displayDead && m.taunt > 0;
  const showMotes = !displayDead && m.regen > 0;
  const showDefense = !displayDead && m.defense > 0;

  return (
    <div
      ref={rootRef}
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
      {rim && <div className={`aura aura-rim ${rim}`} aria-hidden />}
      {showTaunt && <div className="aura aura-taunt" aria-hidden />}
      {showDefense && <div className="aura aura-defense" aria-hidden />}
      {showMotes && (
        <div className="aura aura-motes" aria-hidden>
          <span /><span /><span />
        </div>
      )}
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
