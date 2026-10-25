// Pure, DOM-free tooltip logic shared by the Tooltip component and its tests.
// Keeping the delay constant and the viewport-flip math here (rather than inline in
// the React component) lets the hard-to-eyeball decisions be unit-tested without a
// browser — the component only wires these to real DOM measurements.

// Hover reveal delay. One obvious module const (native title is ~1s; the maintainer
// wants this snappier). Focus reveals immediately and does not use this.
export const TOOLTIP_DELAY_MS = 250;

// Touch has no hover, so a press held this long opens the tooltip instead. Short
// enough to feel deliberate, long enough that an ordinary tap never trips it.
export const LONG_PRESS_MS = 450;
// A finger that drifts further than this (px) is scrolling or dragging, not holding.
export const LONG_PRESS_SLOP = 10;
// Mobile browsers replay a tap as mouseenter/mouseleave; hover events this soon (ms)
// after a touch on the same trigger are that replay and are ignored.
export const TOUCH_MOUSE_GHOST_MS = 800;

// Has a held finger moved far enough from where it went down to stop being a press?
export function longPressBroken(dx: number, dy: number, slop: number = LONG_PRESS_SLOP): boolean {
  return Math.hypot(dx, dy) > slop;
}

// Gap between the trigger and the popover, and the minimum margin the popover keeps
// from each viewport edge.
export const TOOLTIP_GAP = 8;
export const TOOLTIP_MARGIN = 8;

export interface Rect {
  top: number; bottom: number; left: number; right: number; width: number; height: number;
}
export interface Size { width: number; height: number; }
export interface Viewport { width: number; height: number; }
export type TooltipSide = 'top' | 'bottom';
export interface Placement { side: TooltipSide; left: number; top: number; }

// Would a hover that dwelt `dwellMs` over the trigger have revealed the tooltip? A
// quick hover-through that leaves before the delay never shows (the component clears
// its timer on leave); this is the same gate expressed purely so it can be asserted.
export function hoverRevealsAt(dwellMs: number, delayMs: number = TOOLTIP_DELAY_MS): boolean {
  return dwellMs >= delayMs;
}

// Decide which side of the trigger the popover sits on and its viewport (fixed-
// position) coordinates. Prefers below; flips above when below is too cramped and
// above has room; otherwise takes whichever side has more space. Horizontally centers
// on the trigger, then clamps so the popover never clips a viewport edge.
export function computeTooltipPlacement(
  trigger: Rect,
  tip: Size,
  vp: Viewport,
  gap: number = TOOLTIP_GAP,
  margin: number = TOOLTIP_MARGIN,
): Placement {
  const spaceBelow = vp.height - trigger.bottom;
  const spaceAbove = trigger.top;
  const needed = tip.height + gap;

  let side: TooltipSide;
  if (spaceBelow >= needed) side = 'bottom';
  else if (spaceAbove >= needed) side = 'top';
  else side = spaceBelow >= spaceAbove ? 'bottom' : 'top';

  const top = side === 'bottom'
    ? trigger.bottom + gap
    : trigger.top - gap - tip.height;

  const center = trigger.left + trigger.width / 2;
  let left = center - tip.width / 2;
  const maxLeft = vp.width - margin - tip.width;
  const minLeft = margin;
  // If the tip is wider than the viewport, favour the left margin (avoids negative).
  if (left > maxLeft) left = maxLeft;
  if (left < minLeft) left = minLeft;

  return { side, left, top };
}
