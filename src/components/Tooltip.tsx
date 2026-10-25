import { useState, useRef, useCallback, useEffect, useLayoutEffect, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, ReactElement, Ref, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { TOOLTIP_DELAY_MS, LONG_PRESS_MS, TOUCH_MOUSE_GHOST_MS, computeTooltipPlacement, longPressBroken } from '../tooltip';
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
//   - touch: a press held for LONG_PRESS_MS opens it, and the tap that would otherwise
//     follow (playing a card, picking a target) is swallowed; the next touch anywhere
//     closes it. The mouse events a phone replays after a tap are ignored, so an
//     ordinary tap never opens a tooltip.
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
  // The touch press being held on the trigger, its start point, and when the last
  // touch landed here (to ignore the replayed mouse events that follow a tap).
  const pressRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastTouchAtRef = useRef(0);
  // The tooltip was opened by a long-press: swallow the click that ends the press and
  // close on the next touch anywhere, since there is no mouse-leave to close it.
  const [touchOpened, setTouchOpened] = useState(false);
  const swallowClickRef = useRef(false);

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

  // A long-press tooltip stays up after the finger lifts; the next touch closes it.
  useEffect(() => {
    if (!open || !touchOpened) return;
    const close = () => { setOpen(false); setTouchOpened(false); };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open, touchOpened]);

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
  const origPointerDown = childProps.onPointerDown as Handler<PointerEvent>;
  const origPointerMove = childProps.onPointerMove as Handler<PointerEvent>;
  const origPointerUp = childProps.onPointerUp as Handler<PointerEvent>;
  const origPointerCancel = childProps.onPointerCancel as Handler<PointerEvent>;
  const origClickCapture = childProps.onClickCapture as Handler<MouseEvent>;
  const origContextMenu = childProps.onContextMenu as Handler<MouseEvent>;
  const origRef = (child as unknown as { ref?: Ref<HTMLElement> }).ref
    ?? (childProps.ref as Ref<HTMLElement> | undefined);

  const recentTouch = () => Date.now() - lastTouchAtRef.current < TOUCH_MOUSE_GHOST_MS;
  const endPress = (e: PointerEvent) => {
    if (pressRef.current?.id !== e.pointerId) return;
    pressRef.current = null;
    if (!swallowClickRef.current) clearTimer(); // lifted before the hold completed
  };

  const injected = {
    ref: (node: HTMLElement | null) => { triggerRef.current = node; assignRef(origRef, node); },
    onMouseEnter: (e: MouseEvent) => { origEnter?.(e); if (!recentTouch()) scheduleShow(); },
    onMouseLeave: (e: MouseEvent) => { origLeave?.(e); if (!recentTouch()) hide(); },
    onPointerDown: (e: PointerEvent) => {
      origPointerDown?.(e);
      if (e.pointerType !== 'touch') return;
      lastTouchAtRef.current = Date.now();
      swallowClickRef.current = false;
      pressRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        swallowClickRef.current = true;
        setTouchOpened(true);
        setOpen(true);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      origPointerMove?.(e);
      const p = pressRef.current;
      if (!p || p.id !== e.pointerId || swallowClickRef.current) return;
      if (longPressBroken(e.clientX - p.x, e.clientY - p.y)) { pressRef.current = null; clearTimer(); }
    },
    onPointerUp: (e: PointerEvent) => { origPointerUp?.(e); lastTouchAtRef.current = Date.now(); endPress(e); },
    onPointerCancel: (e: PointerEvent) => { origPointerCancel?.(e); endPress(e); },
    // Capture phase, so the trigger's own onClick (and any ancestor's) never sees the
    // click that ends a long-press.
    onClickCapture: (e: MouseEvent) => {
      origClickCapture?.(e);
      if (!swallowClickRef.current) return;
      swallowClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    // A long-press would otherwise also raise the phone's context menu.
    onContextMenu: (e: MouseEvent) => { origContextMenu?.(e); if (recentTouch()) e.preventDefault(); },
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
