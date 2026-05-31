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

/** Global keyboard bindings for slide navigation.
 *  Uses a ref so the listener stays stable across re-renders while still
 *  calling the latest handler closures. */
export function useKeymap(h: KeymapHandlers) {
  const ref = useRef(h);
  ref.current = h;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

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
