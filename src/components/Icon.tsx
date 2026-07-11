// Inline stroke-SVG icon set — the Mendlings theme replaces all battle-screen
// emoji with these (design_handoff/style handoff guide §6). Every glyph is a
// viewBox="0 0 24 24" stroke path in currentColor, so an icon takes its color
// from the surrounding text/badge. `bolt`, `coin`, and `grid` are fill-based.
import type { CSSProperties } from 'react';

export type IconName =
  | 'sword' | 'heart' | 'shield' | 'drop' | 'poison' | 'leaf' | 'bolt'
  | 'cards' | 'gem' | 'plus' | 'flask' | 'question' | 'target' | 'coin' | 'grid';

// Stroke paths (fill:none, stroke:currentColor, round caps/joins), verbatim from guide §6.
const STROKE_PATHS: Partial<Record<IconName, string>> = {
  sword: 'M19 5 L9 15 M6.5 12.5 L11.5 17.5 M9 15 L5 19',
  heart: 'M12 20 C7 15.5 3.5 12 3.5 8.5 C3.5 6 5.5 4 8 4 C9.6 4 11.1 4.9 12 6.2 C12.9 4.9 14.4 4 16 4 C18.5 4 20.5 6 20.5 8.5 C20.5 12 17 15.5 12 20 Z',
  shield: 'M12 3 L19 6 V11 C19 16.5 15.5 19.5 12 21 C8.5 19.5 5 16.5 5 11 V6 Z',
  drop: 'M12 3 C12 3 6.5 10 6.5 14.5 A5.5 5.5 0 0 0 17.5 14.5 C17.5 10 12 3 12 3 Z',
  poison: 'M12 3 C12 3 6.5 9.5 6.5 14 A5.5 5.5 0 0 0 17.5 14 C17.5 9.5 12 3 12 3 Z M9.5 14 H14.5',
  leaf: 'M5 19 C5 10 10 5 20 4 C20 14 14 19 7 19 Z M5 19 C8 15 11 12 15 9',
  cards: 'M4 7 H15 V20 H4 Z M9 4 H19 V16',
  gem: 'M7 4 H17 L21 9 L12 20 L3 9 Z M3 9 H21',
  plus: 'M12 5 V19 M5 12 H19',
  flask: 'M10 3 H14 M12 3 V9 L18 17.5 C18.6 18.6 17.9 20 16.6 20 H7.4 C6.1 20 5.4 18.6 6 17.5 L12 9',
  question: 'M9 8.5 C9 6.6 10.2 5.2 12 5.2 C13.9 5.2 15 6.6 15 8.2 C15 10.4 12 10.7 12 13 M12 16.6 V17.4',
  target: 'M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5 Z M12 10 A2 2 0 1 0 12 14 A2 2 0 1 0 12 10 Z',
};

interface IconProps {
  name: IconName;
  // Sizes to the surrounding text by default (1em); pass a number/px for a fixed size.
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = '1em', strokeWidth = 2.4, className, style }: IconProps) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    'aria-hidden': true, focusable: false as const, className,
    style: { display: 'inline-block', verticalAlign: '-0.14em', flex: 'none', ...style },
  };
  if (name === 'bolt') {
    return <svg {...common} fill="currentColor"><path d="M13 2 L5 13 H11 L9 22 L19 9 H13 Z" /></svg>;
  }
  if (name === 'coin') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" />
      </svg>
    );
  }
  if (name === 'grid') {
    return (
      <svg {...common} fill="currentColor">
        <rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={STROKE_PATHS[name]} />
    </svg>
  );
}
