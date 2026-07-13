import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { MODIFIERS } from '../constants';
import type { CardId, ResolvedCard } from '../constants';
import { Icon } from './Icon';

// Visual family of each card, for the edge tint: heals green, protective wards
// gold, mana economy blue, aggressive power plays red-purple. Presentation only.
const CARD_FAMILY: Record<CardId, 'heal' | 'ward' | 'mana' | 'power'> = {
  lowHeal: 'heal', highHeal: 'heal', aoeHeal: 'heal',
  regen: 'heal', shield: 'ward', resurrect: 'heal', cleanse: 'heal',
  bloom: 'heal', fontOfMana: 'mana', inspiration: 'mana',
  lifebloom: 'heal', battleHymn: 'power', barrier: 'ward',
  bloodTithe: 'mana', martyrsGift: 'heal',
  phalanx: 'ward', provoke: 'ward',
  // Iron mitigation web (#65): Feint steers the telegraph (ward).
  feint: 'ward',
  // Regen conversions (#66): Sporeburst spends Regen into enemy Poison (power).
  sporeburst: 'power',
  // Status-window management (#67): Hemorrhage cashes out into damage (power),
  // Dread Whisper shaves the telegraph (ward).
  hemorrhage: 'power', dreadWhisper: 'ward',
  // Blood + cycling (#68): Crimson Pact is draw economy (mana), Scarlet Ward a shield
  // (ward), Transfusion a redistribution heal (heal), Blood Banner offense (power).
  crimsonPact: 'mana', scarletWard: 'ward', transfusion: 'heal', bloodBanner: 'power',
  // Holy board-state payoffs (#69): the heals are green.
  sunriseVigil: 'heal', consecration: 'heal',
  // Arcane support (#70): Arcane Lens turns a single-target heal into a splash heal (heal).
  arcaneLens: 'heal',
  // Channeled cards (#64): Sap is aggressive, Mending Stream a heal, Fortify a ward.
  sap: 'power', mendingStream: 'heal', fortify: 'ward',
  // Hero buff card batch (#62): defensive buffs gold, offensive buffs red-purple.
  guard: 'ward', sharpen: 'power', doubleStrike: 'power',
  empower: 'power', riposte: 'power',
  // Per-member ability cards (#44): the healer enabling an aggressive move — power.
  imbuePoison: 'power', bolster: 'ward', unleash: 'power', hex: 'power',
  conduct: 'mana', incite: 'power', beckon: 'ward', stagger: 'ward',
  enGarde: 'ward', // Duelist's Iron Provoke + counter-stance (#74)
  penance: 'power', // Flagellant pays HP for a party-wide +auto (#75)
};

interface CardProps {
  card: ResolvedCard;
  affordable: boolean;
  // Not a legal choice right now (e.g. a modifier that couldn't change it) —
  // distinct from unaffordable so the two reasons read differently.
  ineligible?: boolean;
  selected: boolean;
  onClick: () => void;
  // Begin a potential drag from this card (drag-and-drop targeting). The battle
  // screen decides on pointer-move whether it becomes a drag or falls through to a
  // normal click, so this only starts the gesture.
  onPointerDown?: (e: ReactPointerEvent) => void;
  // This card is the source of an in-progress drag — dim it in place while its
  // ghost follows the cursor.
  dragging?: boolean;
  // A player-cast channel of this card's id is currently running (#78): glow the
  // card and show a "channeling · N left" badge. N is the ticks remaining.
  channelingTurns?: number | null;
  // Stable deck-card identity, exposed as data-uid so the battle screen can
  // measure this card's box when it is played (the fly-to-target ghost).
  uid?: number;
  // Fan layout variables (--i index, --n count) set by the Hand.
  style?: CSSProperties;
}

export function Card({ card, affordable, ineligible = false, selected, onClick, onPointerDown, dragging = false, channelingTurns = null, uid, style }: CardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const disabled = !affordable || ineligible;
  const channeling = channelingTurns != null;
  const cls = ['card', `family-${CARD_FAMILY[card.id]}`,
    !affordable && 'unaffordable', ineligible && 'ineligible', selected && 'selected', dragging && 'dragging',
    channeling && 'channeling']
    .filter(Boolean).join(' ');

  // A click that can't do anything still answers: the card shakes its head.
  const handleClick = () => {
    if (disabled) {
      const el = rootRef.current;
      if (el) {
        el.classList.remove('denied');
        void el.offsetWidth; // reflow so the animation restarts
        el.classList.add('denied');
        setTimeout(() => el.classList.remove('denied'), 380);
      }
    }
    onClick(); // callers guard the actual play themselves (existing contract)
  };

  return (
    <div
      ref={rootRef}
      className={cls}
      style={style}
      data-uid={uid}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || undefined}
      onPointerDown={onPointerDown}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
    >
      {channeling && (
        <div className="channel-badge" title="This card's channel is active — playing any card cancels it.">
          <Icon name="bolt" /> channeling · {channelingTurns} left
        </div>
      )}
      <div className="cost">{card.cost}</div>
      {card.heal != null && <div className="heal" title="Healing"><Icon name="heart" /> {card.heal}</div>}
      <div className="cname">{card.name}</div>
      <div className="cdesc">{card.desc}</div>
      {card.upgrades.length > 0 && (
        <div
          className="card-upgrades"
          title={card.upgrades.map((u) => `${MODIFIERS[u].name} — ${MODIFIERS[u].desc}`).join('\n')}
        >
          {card.upgrades.map((u, i) => <span key={i} className={`upgrade-pip ${u}`} />)}
          <span className="upgrade-names">{card.upgrades.map((u) => MODIFIERS[u].name).join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
