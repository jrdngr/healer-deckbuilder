// Inline stroke-SVG icon set — the Mendlings theme replaces all battle-screen
// emoji with these (design_handoff/style handoff guide §6). Every glyph is a
// viewBox="0 0 24 24" stroke path in currentColor, so an icon takes its color
// from the surrounding text/badge. `bolt` is the one fill-based glyph.
import type { CSSProperties } from 'react';

export type IconName =
  | 'sword' | 'heart' | 'shield' | 'drop' | 'poison' | 'leaf' | 'bolt'
  | 'plus' | 'target';

// Stroke paths (fill:none, stroke:currentColor, round caps/joins), verbatim from guide §6.
const STROKE_PATHS: Partial<Record<IconName, string>> = {
  sword: 'M19 5 L9 15 M6.5 12.5 L11.5 17.5 M9 15 L5 19',
  heart: 'M12 20 C7 15.5 3.5 12 3.5 8.5 C3.5 6 5.5 4 8 4 C9.6 4 11.1 4.9 12 6.2 C12.9 4.9 14.4 4 16 4 C18.5 4 20.5 6 20.5 8.5 C20.5 12 17 15.5 12 20 Z',
  shield: 'M12 3 L19 6 V11 C19 16.5 15.5 19.5 12 21 C8.5 19.5 5 16.5 5 11 V6 Z',
  drop: 'M12 3 C12 3 6.5 10 6.5 14.5 A5.5 5.5 0 0 0 17.5 14.5 C17.5 10 12 3 12 3 Z',
  poison: 'M12 3 C12 3 6.5 9.5 6.5 14 A5.5 5.5 0 0 0 17.5 14 C17.5 9.5 12 3 12 3 Z M9.5 14 H14.5',
  leaf: 'M5 19 C5 10 10 5 20 4 C20 14 14 19 7 19 Z M5 19 C8 15 11 12 15 9',
  plus: 'M12 5 V19 M5 12 H19',
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
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={STROKE_PATHS[name]} />
    </svg>
  );
}
