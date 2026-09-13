import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import "@/styles/tooltip.css";

type Side = "top" | "bottom";

interface Props {
  /** Explanation shown in the bubble. Empty content renders the child unchanged. */
  content: ReactNode;
  /** Exactly one element that accepts a ref and DOM event handlers (button, a, Link, span). */
  children: ReactElement;
  /** Preferred side; flips automatically when there is not enough room. */
  side?: Side;
  /**
   * Touch behaviour. "hold" (default, for controls): a normal tap keeps the control's
   * action, a long press shows the explanation. "tap" (for plain terms): a tap toggles it.
   */
  touch?: "hold" | "tap";
  /** Open on keyboard focus (default). Off for text inputs, where the bubble would cover typing. */
  openOnFocus?: boolean;
}

interface Position {
  top: number;
  left: number;
  place: Side;
  arrow: number;
}

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 120;
const HOLD_MS = 450;
/** Moving from one tooltip trigger to the next within this window skips the delay. */
const WARM_MS = 400;
const MARGIN = 8;
const GAP = 8;

let lastClosedAt = 0;

type ChildProps = Record<string, unknown> & { ref?: Ref<HTMLElement> };

function forward(handler: unknown, event: unknown) {
  if (typeof handler === "function") handler(event);
}

function computePosition(trigger: HTMLElement, bubble: HTMLElement, side: Side): Position | null {
  const r = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  if (r.bottom < 0 || r.top > vh || (r.width === 0 && r.height === 0)) return null;
  const b = bubble.getBoundingClientRect();
  const roomAbove = r.top - GAP - MARGIN;
  const roomBelow = vh - r.bottom - GAP - MARGIN;
  let place: Side = side;
  if (place === "top" && b.height > roomAbove && roomBelow > roomAbove) place = "bottom";
  else if (place === "bottom" && b.height > roomBelow && roomAbove > roomBelow) place = "top";
  const rawTop = place === "top" ? r.top - GAP - b.height : r.bottom + GAP;
  const top = Math.max(MARGIN, Math.min(rawTop, vh - b.height - MARGIN));
  const center = r.left + r.width / 2;
  const left = Math.max(MARGIN, Math.min(center - b.width / 2, vw - b.width - MARGIN));
  const arrow = Math.max(12, Math.min(center - left, b.width - 12));
  return { top: Math.round(top), left: Math.round(left), place, arrow: Math.round(arrow) };
}

/**
 * Accessible, dependency-free tooltip. Opens on hover (short delay) and on keyboard
 * focus, closes on leave, blur and Esc; the bubble itself can be hovered. Rendered
 * into document.body with position: fixed so scroll/overflow containers never clip it,
 * and kept inside the viewport (flips top/bottom, clamps left/right).
 */
export function Tooltip({ content, children, side = "top", touch = "hold", openOnFocus = true }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const holdTimer = useRef<number | undefined>(undefined);
  const suppressed = useRef(false);
  const heldOpen = useRef(false);
  const lastPointer = useRef<string>("mouse");

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(holdTimer.current);
  };

  const show = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    if (suppressed.current) return;
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    setOpen((was) => {
      if (was) lastClosedAt = Date.now();
      return false;
    });
    setPos(null);
  }, []);

  const scheduleOpen = () => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    const delay = Date.now() - lastClosedAt < WARM_MS ? 0 : OPEN_DELAY_MS;
    openTimer.current = window.setTimeout(show, delay);
  };

  const scheduleClose = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(hide, CLOSE_DELAY_MS);
  };

  useEffect(() => () => clearTimers(), []);

  // Measure and place the bubble; follow the trigger on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      const bubble = bubbleRef.current;
      if (!trigger || !bubble) return;
      const next = computePosition(trigger, bubble, side);
      if (!next) {
        hide();
        return;
      }
      setPos((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.place === next.place &&
        prev.arrow === next.arrow
          ? prev
          : next,
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, content, side, hide]);

  // While open: Esc closes, a tap outside closes. Esc still reaches the page — a
  // tooltip that merely sits under the mouse must not eat the Esc that ends the
  // presentation or closes a dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      suppressed.current = true;
      hide();
    };
    const onOutside = (e: globalThis.PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      hide();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onOutside, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onOutside, true);
    };
  }, [open, hide]);

  const childProps = (isValidElement(children) ? children.props : {}) as ChildProps;
  const childRef = childProps.ref;

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof childRef === "function") childRef(node);
      else if (childRef && typeof childRef === "object") (childRef as { current: HTMLElement | null }).current = node;
    },
    [childRef],
  );

  if (!isValidElement(children)) return <>{children}</>;
  if (content === null || content === undefined || content === "" || content === false) return children;

  const describedBy = [childProps["aria-describedby"], open ? id : null].filter(Boolean).join(" ") || undefined;

  const trigger = cloneElement(children as ReactElement<ChildProps>, {
    ref: setRef,
    "aria-describedby": describedBy,
    "data-tip-open": open ? "1" : undefined,
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      forward(childProps.onPointerEnter, e);
      if (e.pointerType === "touch") return;
      scheduleOpen();
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      forward(childProps.onPointerLeave, e);
      if (e.pointerType === "touch") return;
      suppressed.current = false;
      scheduleClose();
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      forward(childProps.onPointerDown, e);
      lastPointer.current = e.pointerType;
      if (touch !== "hold") return;
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        heldOpen.current = false;
        window.clearTimeout(holdTimer.current);
        holdTimer.current = window.setTimeout(() => {
          heldOpen.current = true;
          suppressed.current = false;
          show();
        }, HOLD_MS);
      } else {
        // Clicking a control acts; the explanation steps aside until the pointer leaves.
        suppressed.current = true;
        hide();
      }
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      forward(childProps.onPointerUp, e);
      window.clearTimeout(holdTimer.current);
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      forward(childProps.onPointerCancel, e);
      window.clearTimeout(holdTimer.current);
    },
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if (touch === "hold" && lastPointer.current !== "mouse") e.preventDefault();
      forward(childProps.onContextMenu, e);
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (heldOpen.current) {
        // The long press only asked for the explanation, not for the action.
        heldOpen.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (touch === "tap" && lastPointer.current !== "mouse") {
        suppressed.current = false;
        if (open) hide();
        else show();
      }
      forward(childProps.onClick, e);
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      forward(childProps.onFocus, e);
      if (!openOnFocus) return;
      let keyboard = true;
      try {
        keyboard = e.currentTarget.matches(":focus-visible");
      } catch {
        keyboard = true;
      }
      if (keyboard) {
        suppressed.current = false;
        show();
      }
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      forward(childProps.onBlur, e);
      suppressed.current = false;
      if (lastPointer.current === "mouse") hide();
    },
  });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            className="tip-bubble no-print"
            data-ready={pos ? "1" : "0"}
            data-place={pos?.place ?? side}
            style={pos ? { top: pos.top, left: pos.left } : undefined}
            onPointerEnter={(e) => {
              if (e.pointerType !== "touch") window.clearTimeout(closeTimer.current);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") scheduleClose();
            }}
          >
            {content}
            <span className="tip-arrow" style={{ left: pos?.arrow ?? 0 }} aria-hidden />
          </div>,
          document.body,
        )}
    </>
  );
}
