import { useRef } from "react";
import { ALL_SLIDES } from "@/lib/slides";

export type Direction = "forward" | "backward" | "none";

/**
 * Returns the navigation direction (forward / backward / none) compared to
 * the previously-rendered slide. Used to drive enter-animations.
 *
 * Compares ordinal index in ALL_SLIDES — sidebar jumps work too.
 */
export function useSlideDirection(currentId: string): Direction {
  const prev = useRef<string | null>(null);
  let dir: Direction = "none";
  if (prev.current && prev.current !== currentId) {
    const a = ALL_SLIDES.findIndex((s) => s.id === prev.current);
    const b = ALL_SLIDES.findIndex((s) => s.id === currentId);
    if (a >= 0 && b >= 0) dir = b > a ? "forward" : "backward";
  }
  prev.current = currentId;
  return dir;
}
