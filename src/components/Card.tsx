import type { ResolvedCard } from '../constants';

interface CardProps {
  card: ResolvedCard;
  affordable: boolean;
  // Not a legal choice right now (e.g. a modifier that couldn't change it) —
  // distinct from unaffordable so the two reasons read differently.
  ineligible?: boolean;
  selected: boolean;
  onClick: () => void;
}

export function Card({ card, affordable, ineligible = false, selected, onClick }: CardProps) {
  const disabled = !affordable || ineligible;
  const cls = ['card', !affordable && 'unaffordable', ineligible && 'ineligible', selected && 'selected']
    .filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
    >
      <div className="cost">{card.cost}</div>
      {card.heal != null && <div className="heal" title="Healing">{card.heal}</div>}
      <div className="cname">{card.name}</div>
      <div className="cdesc">{card.desc}</div>
      {card.upgrades.length > 0 && (
        <div className="card-upgrades" title={card.upgrades.join(', ')}>
          {card.upgrades.map((u, i) => <span key={i} className={`upgrade-pip ${u}`} />)}
        </div>
      )}
    </div>
  );
}
