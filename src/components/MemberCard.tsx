import { useEffect, useRef } from 'react';
import {
  CHARGE_MAX, BOLT_CHARGE_MULT, BERSERKER_BAND_BONUS,
  INJURY_NAMES, injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty,
} from '../constants';
import type { ReactNode } from 'react';
import type { Member } from '../engine';
import type { MemberReactKind } from '../animations';
import type { MemberReactState } from '../useGame';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { CharacterBlob } from './CharacterBlob';
import { StatBar } from './Bars';

// One status/injury pill on a member card. `icon` is omitted for injury scars,
// which show only their tier name.
function StatusBadge({ cls, icon, title, children }: {
  cls: string; icon?: IconName; title: string; children: ReactNode;
}) {
  return (
    <span className={`badge ${cls}`} title={title}>
      {icon ? <><Icon name={icon} /> {children}</> : children}
    </span>
  );
}

// How long each one-shot reaction class stays on the card (matches the CSS
// animation lengths in styles.css).
const REACT_MS: Record<MemberReactKind, number> = {
  hit: 360, heal: 520, death: 700, block: 400, lunge: 420,
};
const REACT_CLASSES = ['react-hit', 'react-heal', 'react-death', 'react-block', 'react-lunge'];

// Per-scar badge descriptors: one entry per scar a member carries, oldest first.
// Each names the scar tier (Cracked / Weakened / Broken / Shattered) and spells out
// the specific penalty THAT scar added — mirroring the buff/debuff pills, one pill
// per status (#49). The penalty tables are cumulative-by-tier, so a tier's own cost
// is its increment over the previous tier. Extracted so the label/detail is unit-testable.
export function injuryBadges(injuries: number): { name: string; detail: string }[] {
  const badges: { name: string; detail: string }[] = [];
  for (let tier = 1; tier <= injuries; tier++) {
    const name = INJURY_NAMES[Math.min(tier - 1, INJURY_NAMES.length - 1)];
    const parts: string[] = [];
    const dHp = injuryMaxHPPenalty(tier) - injuryMaxHPPenalty(tier - 1);
    const dDmg = injuryDamagePenalty(tier) - injuryDamagePenalty(tier - 1);
    const dAbil = injuryAbilityPenalty(tier) - injuryAbilityPenalty(tier - 1);
    if (dHp) parts.push(`Max HP −${dHp}`);
    if (dDmg) parts.push(`damage −${dDmg}`);
    if (dAbil) parts.push(`ability −${dAbil}`);
    const penalty = parts.length ? parts.join(', ') : 'takes this member out of the run';
    badges.push({ name, detail: `${penalty}. Heals at an Infirmary.` });
  }
  return badges;
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
  const rim = displayDead ? null : m.shield ? 'shield' : null;
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
          <span className="incap-title">Incapacitated</span>
          <span className="incap-hint">heal a scar to restore</span>
        </div>
      )}
      <div className="atk" title="Attack"><Icon name="sword" /><span>{liveDamage}</span></div>
      <CharacterBlob id={m.id} size={62} />
      <h3>{m.name}</h3>
      <StatBar label={`${displayHp} / ${m.maxHP}`}>
        {/* Fill shifts warmer as HP drops (gold 25–50%, danger <25%) — presentation only. */}
        <div className={`seg hp${hpFrac <= 0.25 ? ' low' : hpFrac <= 0.5 ? ' mid' : ''}`} style={{ left: 0, width: `${hpPct}%` }} />
      </StatBar>
      <div className="badges">
        {m.shield && <StatusBadge cls="shield" icon="shield" title={`Shield — fully blocks the next damaging hit; fades unused in ${m.shieldTurns} enemy turn(s).`}>Shield</StatusBadge>}
        {m.regen > 0 && <StatusBadge cls="regen" icon="leaf" title={`Regen — heals ${m.regen} at the start of your turn, then decays by 1 each turn (${m.regen} tick(s) left).`}>Regen {m.regen}</StatusBadge>}
        {m.defense > 0 && <StatusBadge cls="defense" icon="shield" title={`Defense — incoming hits reduced by ${m.defenseAmount} for ${m.defense} more enemy turn(s).`}>Def {m.defenseAmount}·{m.defense}t</StatusBadge>}
        {m.taunt > 0 && <StatusBadge cls="taunt" icon="target" title={`Taunt — aimed attacks funnel onto this member for ${m.taunt} more enemy turn(s).`}>Taunt {m.taunt}</StatusBadge>}
        {injuryBadges(m.injuries).map((inj, i) => (
          <StatusBadge key={`injury-${i}`} cls="injury" title={`${inj.name} — ${inj.detail}`}>{inj.name}</StatusBadge>
        ))}
        {m.boarHp > 0 && <StatusBadge cls="shield" icon="shield" title={`Boar — soaks every hit aimed at this slot (whole, no spill), for ${m.boarTurns} more enemy turn(s). Unhealable.`}>Boar {m.boarHp}·{m.boarTurns}t</StatusBadge>}
      </div>
      {m.id === 'mage' && <div className="charge" title={`Charge — builds as the Mage acts (max ${CHARGE_MAX}). Lightning Bolt spends it, adding ${BOLT_CHARGE_MULT} damage per Charge.`}><Icon name="bolt" /> Charge {mageCharge}/{CHARGE_MAX}</div>}
      {berserkerBands && (
        <div className={`charge rage-${rageTier}`} title={`Rage bands: +${BERSERKER_BAND_BONUS} at HP ≤ ${berserkerBands[0]}, +${BERSERKER_BAND_BONUS * 2} at HP ≤ ${berserkerBands[1]}.`}>
          <Icon name="sword" /> {rageTier === 0 ? 'Calm' : rageTier === 1 ? 'Enraged' : 'Berserk'} — {liveDamage} dmg
        </div>
      )}
    </div>
  );
}
