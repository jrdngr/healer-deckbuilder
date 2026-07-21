import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { MODIFIERS, CARD_FAMILY } from '../constants';
import type { ResolvedCard } from '../constants';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';
import { KeywordText } from './KeywordText';

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
        <Tooltip content="This card's channel is active — playing any card cancels it.">
          <div className="channel-badge">
            <Icon name="bolt" /> channeling · {channelingTurns} left
          </div>
        </Tooltip>
      )}
      <div className="cost">{card.cost}</div>
      {card.heal != null && <Tooltip content="Healing"><div className="heal"><Icon name="heart" /> {card.heal}</div></Tooltip>}
      <div className="cname">{card.name}</div>
      <div className="cdesc"><KeywordText>{card.desc}</KeywordText></div>
      {card.upgrades.length > 0 && (
        <Tooltip content={card.upgrades.map((u) => `${MODIFIERS[u].name} — ${MODIFIERS[u].desc}`).join('\n')}>
          <div className="card-upgrades">
            {card.upgrades.map((u, i) => <span key={i} className={`upgrade-pip ${u}`} />)}
            <span className="upgrade-names">{card.upgrades.map((u) => MODIFIERS[u].name).join(' · ')}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
