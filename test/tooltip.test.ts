// Tooltip pure-logic tests (#97). Run with: tsx test/tooltip.test.ts (part of npm test).
// Interaction/visual behavior (hover reveal, focus reveal, Escape, fade) is verified
// manually by the maintainer per CLAUDE.md — here we assert only the extractable pure
// pieces: the delay gate and the viewport-flip DECISION (which side / whether clamped),
// never exact pixel coordinates.
import { computeTooltipPlacement, hoverRevealsAt, TOOLTIP_DELAY_MS, TOOLTIP_MARGIN } from '../src/tooltip';
import { check, eq, finish } from './harness';
import type { Rect, Size, Viewport } from '../src/tooltip';

// --- delay gate ---
eq('reveal delay is 250ms', TOOLTIP_DELAY_MS, 250);
check('a hover-through that leaves before the delay never shows', !hoverRevealsAt(120));
check('a hover held past the delay shows', hoverRevealsAt(300));
check('a hover held exactly to the delay shows', hoverRevealsAt(TOOLTIP_DELAY_MS));

const VP: Viewport = { width: 1000, height: 800 };
const tip: Size = { width: 160, height: 60 };
function rect(top: number, left: number, w = 40, h = 20): Rect {
  return { top, left, bottom: top + h, right: left + w, width: w, height: h };
}

// --- side decision: prefers below when there's room ---
{
  const p = computeTooltipPlacement(rect(100, 480), tip, VP);
  eq('opens below the trigger when there is room', p.side, 'bottom');
  check('the below popover sits under the trigger', p.top >= 120);
}

// --- side decision: flips above when below is cramped but above has room ---
{
  const p = computeTooltipPlacement(rect(760, 480), tip, VP);
  eq('flips above when below is cramped', p.side, 'top');
  check('the above popover sits over the trigger', p.top < 760);
}

// --- side decision: no room either way -> the roomier side (here, below) ---
{
  const tall: Size = { width: 160, height: 700 };
  const p = computeTooltipPlacement(rect(300, 480), tall, VP);
  eq('with no fit either way, takes the roomier side (below)', p.side, 'bottom');
}

// --- horizontal clamp: never clips the left edge ---
{
  const p = computeTooltipPlacement(rect(100, 0, 20), tip, VP);
  check('does not clip past the left viewport edge', p.left >= TOOLTIP_MARGIN);
}

// --- horizontal clamp: never clips the right edge ---
{
  const p = computeTooltipPlacement(rect(100, 990, 10), tip, VP);
  check('does not clip past the right viewport edge', p.left + tip.width <= VP.width - TOOLTIP_MARGIN + 0.001);
}

// --- horizontal: centered on the trigger when there's room on both sides ---
{
  const p = computeTooltipPlacement(rect(100, 480, 40), tip, VP);
  const center = 480 + 40 / 2;
  eq('centers the popover on the trigger when unconstrained', p.left, center - tip.width / 2);
}

finish('tooltip');
