import { useCallback, useEffect, useState } from "react";

/**
 * User-chosen widths of the two side bars (slide overview left, live record
 * right). A UI setting like theme or language: stored per device, not part of
 * a backup and untouched by the reset. `undefined` means "default width", so
 * the stylesheet default (which grows with the font-size step) stays in charge
 * until someone actually drags.
 */
export type PanelKey = "sidebar" | "protocol";

const KEY = "verbands-ceo.layout.widths.v1";

/** Neither bar may take more than this share of the window, so the slide keeps room even with both wide. */
const MAX_VIEWPORT_SHARE = 0.4;

function readAll(): Partial<Record<PanelKey, number>> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Partial<Record<PanelKey, number>> = {};
    for (const k of ["sidebar", "protocol"] as const) {
      const v = (parsed as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.round(v);
    }
    return out;
  } catch {
    // Garbage or blocked storage: fall back to the default widths.
    return {};
  }
}

function writeOne(key: PanelKey, width: number | undefined) {
  try {
    const all = readAll();
    if (width === undefined) delete all[key];
    else all[key] = Math.round(width);
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Not persisting a width is harmless; the bar still resizes for this session.
  }
}

export function clampWidth(width: number, min: number, max: number): number {
  const viewportMax = typeof window === "undefined" ? max : Math.floor(window.innerWidth * MAX_VIEWPORT_SHARE);
  const upper = Math.max(min, Math.min(max, viewportMax));
  return Math.min(upper, Math.max(min, Math.round(width)));
}

/**
 * Returns the effective width in px (clamped to the current window) or
 * `undefined` for the default, a setter (`persist` = write to storage) and a
 * reset back to the default.
 */
export function usePanelWidth(key: PanelKey, min: number, max: number) {
  const [stored, setStored] = useState<number | undefined>(() =>
    typeof window === "undefined" ? undefined : readAll()[key],
  );

  // Re-clamp when the window shrinks (or the beamer resolution changes).
  const [, setViewport] = useState(0);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const setWidth = useCallback(
    (px: number, persist: boolean) => {
      const next = clampWidth(px, min, max);
      setStored(next);
      if (persist) writeOne(key, next);
    },
    [key, min, max],
  );

  const reset = useCallback(() => {
    setStored(undefined);
    writeOne(key, undefined);
  }, [key]);

  const width = stored === undefined ? undefined : clampWidth(stored, min, max);
  return { width, setWidth, reset };
}
