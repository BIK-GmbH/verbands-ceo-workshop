import { useEffect, useRef } from "react";

export interface KeymapHandlers {
  onPrev?: () => void;
  onNext?: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  onTogglePresenter?: () => void;
  onToggleFullscreen?: () => void;
  onTogglePalette?: () => void;
}

/** True while the keyboard is busy with a text field — those keys belong to the field. */
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable),
  );
}

/**
 * „?" opens the help — from every route, not just the slide view, which is why it
 * has its own listener instead of riding along in useKeymap (that one also claims
 * the arrow keys for the deck). Registered here so all bindings stay in one file.
 */
export function useHelpKey(onOpen: () => void, enabled = true) {
  const ref = useRef(onOpen);
  ref.current = onOpen;

  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target)) return;
      e.preventDefault();
      ref.current();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}

/** Global keyboard bindings for slide navigation.
 *  Uses a ref so the listener stays stable across re-renders while still
 *  calling the latest handler closures. */
export function useKeymap(h: KeymapHandlers) {
  const ref = useRef(h);
  ref.current = h;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (typing(e.target)) return;

      const cur = ref.current;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cur.onTogglePalette?.();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowRight":
        case "j":
        case "PageDown":
        case " ":
          e.preventDefault();
          cur.onNext?.();
          break;
        case "ArrowLeft":
        case "k":
        case "PageUp":
          e.preventDefault();
          cur.onPrev?.();
          break;
        case "Home":
          e.preventDefault();
          cur.onFirst?.();
          break;
        case "End":
          e.preventDefault();
          cur.onLast?.();
          break;
        case "p":
        case "P":
          cur.onTogglePresenter?.();
          break;
        case "f":
        case "F":
          cur.onToggleFullscreen?.();
          break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
