import type { CardDef } from '../constants';

interface CardProps {
  card: CardDef;
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
    </div>
  );
}
