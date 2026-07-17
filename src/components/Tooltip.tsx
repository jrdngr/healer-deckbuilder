import { useState, useRef, useCallback, useEffect, useLayoutEffect, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, ReactElement, Ref, FocusEvent, KeyboardEvent, MouseEvent } from 'react';
import { TOOLTIP_DELAY_MS, computeTooltipPlacement } from '../tooltip';
import type { Placement } from '../tooltip';

// Themed tooltip primitive (#97). Anchors to a single trigger element (a <button> or
// a <span>/<div>) and renders arbitrary React content in a themed popover — replacing
// the app's native `title=` tooltips.
//
// Interaction (a11y parity with the native `title` it replaces):
//   - hover opens after TOOLTIP_DELAY_MS; leaving before the delay never shows it
//   - keyboard focus on a *focusable* trigger opens immediately (no delay)
//   - mouse-leave / blur / Escape close it
//   - anchored to the trigger (not cursor-following), flips/shifts to stay on-screen
//
// Usage: <Tooltip content={...}><button …/></Tooltip>. The trigger's own
// onMouseEnter/Leave/onFocus/onBlur/onKeyDown/ref are preserved (called first); its
// className / onClick / aria-* pass through untouched. When `content` is null/undefined
// the trigger renders with no tooltip behavior at all (mirrors a `title={undefined}`).
//
// The popover is portalled to <body> so a transformed ancestor (card fan / member-card
// react animations) can't become the containing block for its fixed positioning, and so
// it can't clip inside an overflow-hidden panel. It is pointer-events:none, so it never
// intercepts clicks or the battle screen's drag-and-drop.

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
}

// String tooltips may carry newlines (the card-upgrades tooltip joins upgrades with
// '\n'); render each line separately. Non-string content (#98 rich glosses) passes
// through verbatim.
function renderTooltipContent(content: ReactNode): ReactNode {
  if (typeof content === 'string') {
    return content.split('\n').map((line, i) => (
      <div key={i} className="tooltip-line">{line}</div>
    ));
  }
  return content;
}

// Only wire the focus-open path when the trigger genuinely takes focus, so we never
// have to add tabIndex to something that shouldn't be focusable.
function isFocusable(el: ReactElement): boolean {
  const props = el.props as { tabIndex?: number; disabled?: boolean };
  if (typeof props.tabIndex === 'number') return props.tabIndex >= 0;
  const type = el.type;
  return type === 'button' || type === 'a' || type === 'input'
    || type === 'select' || type === 'textarea';
}

function assignRef<T>(ref: Ref<T> | undefined, node: T): void {
  if (!ref) return;
  if (typeof ref === 'function') ref(node);
  else (ref as { current: T | null }).current = node;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);
  const showNow = useCallback(() => { clearTimer(); setOpen(true); }, [clearTimer]);
  const hide = useCallback(() => { clearTimer(); setOpen(false); }, [clearTimer]);
  const scheduleShow = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => { timerRef.current = null; setOpen(true); }, TOOLTIP_DELAY_MS);
  }, [clearTimer]);

  // Never leak a pending reveal timer past unmount.
  useEffect(() => clearTimer, [clearTimer]);

  // Measure and place once the popover has mounted (and whenever content changes),
  // synchronously before paint so it never flashes at the wrong spot. Reposition on
  // scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) { setPlacement(null); return; }
    const place = () => {
      const trig = triggerRef.current;
      const tip = tipRef.current;
      if (!trig || !tip) return;
      const t = trig.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      setPlacement(computeTooltipPlacement(
        { top: t.top, bottom: t.bottom, left: t.left, right: t.right, width: t.width, height: t.height },
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, content]);

  // A null/undefined tooltip is a no-op wrapper — render the trigger untouched.
  if (content == null) return children;

  const child = children;
  const childProps = child.props as Record<string, unknown>;
  const focusable = isFocusable(child);

  type Handler<E> = ((e: E) => void) | undefined;
  const origEnter = childProps.onMouseEnter as Handler<MouseEvent>;
  const origLeave = childProps.onMouseLeave as Handler<MouseEvent>;
  const origFocus = childProps.onFocus as Handler<FocusEvent>;
  const origBlur = childProps.onBlur as Handler<FocusEvent>;
  const origKeyDown = childProps.onKeyDown as Handler<KeyboardEvent>;
  const origRef = (child as unknown as { ref?: Ref<HTMLElement> }).ref
    ?? (childProps.ref as Ref<HTMLElement> | undefined);

  const injected = {
    ref: (node: HTMLElement | null) => { triggerRef.current = node; assignRef(origRef, node); },
    onMouseEnter: (e: MouseEvent) => { origEnter?.(e); scheduleShow(); },
    onMouseLeave: (e: MouseEvent) => { origLeave?.(e); hide(); },
    onFocus: focusable ? (e: FocusEvent) => { origFocus?.(e); showNow(); } : origFocus,
    onBlur: focusable ? (e: FocusEvent) => { origBlur?.(e); hide(); } : origBlur,
    onKeyDown: (e: KeyboardEvent) => { origKeyDown?.(e); if (e.key === 'Escape') hide(); },
  };

  const style = placement
    ? { left: placement.left, top: placement.top }
    : { left: 0, top: 0, visibility: 'hidden' as const };

  return (
    <>
      {cloneElement(child, injected)}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          className={`tooltip-pop${placement ? ` tooltip-${placement.side}` : ''}`}
          style={style}
        >
          {renderTooltipContent(content)}
        </div>,
        document.body,
      )}
    </>
  );
}
