import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { MODIFIERS } from '../constants';
import type { CardId, ResolvedCard } from '../constants';

// Visual family of each card, for the edge tint: heals green, protective wards
// gold, mana economy blue, aggressive power plays red-purple. Presentation only.
const CARD_FAMILY: Record<CardId, 'heal' | 'ward' | 'mana' | 'power'> = {
  lowHeal: 'heal', highHeal: 'heal', aoeHeal: 'heal',
  regen: 'heal', shield: 'ward', resurrect: 'heal', refresh: 'mana', cleanse: 'heal',
  overgrowth: 'heal', cultivate: 'heal', bloom: 'heal', fontOfMana: 'mana', inspiration: 'mana',
  lifebloom: 'heal', surge: 'mana', battleHymn: 'power', barrier: 'ward',
  bloodTithe: 'mana', martyrsGift: 'heal', grimHarvest: 'power',
  phalanx: 'ward', brace: 'ward', provoke: 'ward',
  // Iron mitigation web (#65): Feint steers (ward), Anvil Stance turns blocking into
  // offense (power), Interlock blankets the party in Guard (ward).
  feint: 'ward', anvilStance: 'power', interlock: 'ward',
  // Regen conversions (#66): Thornskin turns Regen into mitigation (ward), Sporeburst
  // spends it into enemy Poison (power).
  thornskin: 'ward', sporeburst: 'power',
  // Shadow cards (#63): direct damage / debuff plays.
  shadowBolt: 'power', siphonLife: 'power', doom: 'power',
  // Status-window management (#67): Hemorrhage/Umbral Feast cash out into damage (power),
  // Dread Whisper shaves the telegraph (ward).
  hemorrhage: 'power', umbralFeast: 'power', dreadWhisper: 'ward',
  // Blood + cycling (#68): Crimson Pact is draw economy (mana), Scarlet Ward a shield
  // (ward), Transfusion a redistribution heal (heal), Open Veins / Blood Banner offense.
  crimsonPact: 'mana', scarletWard: 'ward', openVeins: 'power', transfusion: 'heal', bloodBanner: 'power',
  // Holy overheal & board-state payoffs (#69): the heals are green; Absolution hardens
  // overheal into Brace (ward) and Rootbind extends defensive timers (ward).
  benediction: 'heal', sunriseVigil: 'heal', consecration: 'heal', absolution: 'ward', rootbind: 'ward',
  // Channel archetype rescue + arcane support (#70): Attunement is card-draw economy
  // (mana), Arcane Lens turns a single-target heal into a splash heal (heal).
  attunement: 'mana', arcaneLens: 'heal',
  // Count-based payoff cards (#63): Cascade is card-draw economy, Nightfall a nuke.
  cascade: 'mana', nightfall: 'power',
  // Channeled cards (#64): Drain/Sap are aggressive, Mending Stream a heal, Fortify a ward.
  drain: 'power', sap: 'power', mendingStream: 'heal', fortify: 'ward',
  // Small-party cards (#42).
  rally: 'power', focus: 'heal', channel: 'mana', holdTheLine: 'ward',
  // Hero buff card batch (#62): defensive buffs gold, offensive buffs red-purple.
  guard: 'ward', sharpen: 'power', goad: 'ward', doubleStrike: 'power',
  embolden: 'power', empower: 'power', riposte: 'power',
  // Per-member ability cards (#44): the healer enabling an aggressive move — power.
  imbuePoison: 'power', bolster: 'ward', unleash: 'power', hex: 'power',
  conduct: 'mana', incite: 'power', hush: 'ward', beckon: 'ward', stagger: 'ward',
};

interface CardProps {
  card: ResolvedCard;
  affordable: boolean;
  // Not a legal choice right now (e.g. a modifier that couldn't change it) —
  // distinct from unaffordable so the two reasons read differently.
  ineligible?: boolean;
  selected: boolean;
  onClick: () => void;
  // Stable deck-card identity, exposed as data-uid so the battle screen can
  // measure this card's box when it is played (the fly-to-target ghost).
  uid?: number;
  // Fan layout variables (--i index, --n count) set by the Hand.
  style?: CSSProperties;
}

export function Card({ card, affordable, ineligible = false, selected, onClick, uid, style }: CardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const disabled = !affordable || ineligible;
  const cls = ['card', `family-${CARD_FAMILY[card.id]}`,
    !affordable && 'unaffordable', ineligible && 'ineligible', selected && 'selected']
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
      onClick={handleClick}
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
