import type { ReactNode } from 'react';

// The canonical member stat line (HP · DMG · ABL) shown on every pick-a-member list.
export function MemberStatLine({ maxHP, damage, abilityPower }: {
  maxHP: number; damage: number; abilityPower: number;
}) {
  return <span className="member-stats">HP {maxHP} · DMG {damage} · ABL +{abilityPower}</span>;
}

// One clickable member tile: a name and a stats slot. Callers pass `stats` already
// wrapped (usually a <MemberStatLine/> or a bespoke `member-stats` span), so a list
// can show HP/DMG/ABL, an injury list, or anything else in the same frame.
export function MemberPick({ name, stats, disabled, onClick }: {
  name: ReactNode; stats: ReactNode; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button className="member-pick" disabled={disabled} onClick={onClick}>
      <span className="member-name">{name}</span>
      {stats}
    </button>
  );
}
