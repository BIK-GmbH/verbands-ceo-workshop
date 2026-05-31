import { useRef, useState, type TouchEvent } from "react";

interface Options {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Min horizontal distance in px to trigger nav (default 60) */
  threshold?: number;
  /** Max gesture duration in ms to count as swipe (default 800) */
  maxDuration?: number;
  /** Live drag-feedback factor: how far slide visually follows finger.
   *  0 = no movement, 1 = 1:1 follow. Default 0.35 (rubber-band feel). */
  followFactor?: number;
  /** When false, no live drag preview (still detects the gesture for nav) */
  enabled?: boolean;
  /** Vibrate (ms) on successful swipe trigger. 0 disables. Default 10. */
  haptic?: number;
}

function buzz(ms: number) {
  if (ms <= 0) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* iOS Safari ignores — fine */
  }
}

interface Handlers {
  onTouchStart: (e: TouchEvent<HTMLElement>) => void;
  onTouchMove: (e: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (e: TouchEvent<HTMLElement>) => void;
}

interface Result {
  handlers: Handlers;
  /** translateX in px during live drag (0 when idle) */
  dragX: number;
  /** True while finger is down and a horizontal drag is in progress */
  dragging: boolean;
}

/**
 * Touch-swipe with optional live drag-feedback for slide navigation.
 *
 * - Horizontal swipe with |dx| > threshold and within maxDuration triggers nav.
 * - Vertical-dominant swipes are ignored so users can scroll long slides.
 * - During the drag, returns dragX so the consumer can apply translateX
 *   to the slide for visual feedback (rubber-band effect via followFactor).
 */
export function useSwipeNav({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
  maxDuration = 800,
  followFactor = 0.35,
  enabled = true,
  haptic = 10,
}: Options): Result {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const isHorizontal = useRef<boolean | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  return {
    dragX,
    dragging,
    handlers: {
      onTouchStart(e) {
        const t0 = e.touches[0];
        start.current = { x: t0.clientX, y: t0.clientY, t: Date.now() };
        isHorizontal.current = null;
        setDragX(0);
      },
      onTouchMove(e) {
        const s = start.current;
        if (!s) return;
        const t = e.touches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;

        // Lock direction once the user moves a few pixels
        if (isHorizontal.current === null) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          isHorizontal.current = Math.abs(dx) > Math.abs(dy);
        }
        if (!isHorizontal.current) return;
        if (!enabled) return;
        setDragging(true);
        setDragX(dx * followFactor);
      },
      onTouchEnd(e) {
        const s = start.current;
        const locked = isHorizontal.current;
        start.current = null;
        isHorizontal.current = null;
        setDragging(false);
        setDragX(0);
        if (!s) return;
        const t1 = e.changedTouches[0];
        const dx = t1.clientX - s.x;
        const dy = t1.clientY - s.y;
        const dt = Date.now() - s.t;
        // If touchmove never fired (e.g. fast flick or tests), derive direction here.
        const horizontal =
          locked === true || (locked === null && Math.abs(dx) > Math.abs(dy));
        if (!horizontal) return;
        if (Math.abs(dx) < threshold) return;
        if (dt > maxDuration) return;
        buzz(haptic);
        if (dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
      },
    },
  };
}
