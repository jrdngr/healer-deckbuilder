import type { ResolvedCard } from '../constants';

interface CardProps {
  card: ResolvedCard;
  affordable: boolean;
  selected: boolean;
  onClick: () => void;
}

export function Card({ card, affordable, selected, onClick }: CardProps) {
  const cls = ['card', !affordable && 'unaffordable', selected && 'selected']
    .filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={onClick}>
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
