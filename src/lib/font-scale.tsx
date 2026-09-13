import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Three font-size steps for the whole app — the projector in the room wants a big
 * step, a small laptop screen wants the normal one. The step is stored per device
 * and applied as `data-font-scale` on <html>; the root font size in globals.css
 * does the actual work, so everything sized in rem grows with it.
 * It takes effect from the desktop layout (768px) upwards — below that the phone
 * layout has its own compact type scale, and the header switch is hidden there too.
 * Print output and the poster sheets keep their fixed layouts (see print.css / poster.css).
 */
export type FontScale = "normal" | "large" | "xlarge";

const KEY = "verbands-ceo.font-scale.v1";

export const FONT_SCALES: FontScale[] = ["normal", "large", "xlarge"];

export const FONT_SCALE_LABEL: Record<FontScale, { de: string; en: string }> = {
  normal: { de: "Normal", en: "Normal" },
  large: { de: "Groß", en: "Large" },
  xlarge: { de: "Sehr groß", en: "Extra large" },
};

export function getInitialFontScale(): FontScale {
  if (typeof window === "undefined") return "normal";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "normal" || stored === "large" || stored === "xlarge") return stored;
  return "normal";
}

/** Next step in the cycle normal → large → xlarge → normal. */
export function nextFontScale(s: FontScale): FontScale {
  return FONT_SCALES[(FONT_SCALES.indexOf(s) + 1) % FONT_SCALES.length];
}

// Applied while the module is evaluated, i.e. before React paints, so a stored
// step never shows up as a jump from the default size.
if (typeof document !== "undefined") {
  document.documentElement.dataset.fontScale = getInitialFontScale();
}

interface FontScaleCtx {
  scale: FontScale;
  setScale: (s: FontScale) => void;
}
const Ctx = createContext<FontScaleCtx | null>(null);

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<FontScale>(getInitialFontScale);

  useEffect(() => {
    document.documentElement.dataset.fontScale = scale;
  }, [scale]);

  function setScale(s: FontScale) {
    window.localStorage.setItem(KEY, s);
    setScaleState(s);
  }
  return <Ctx.Provider value={{ scale, setScale }}>{children}</Ctx.Provider>;
}

export function useFontScale(): [FontScale, (s: FontScale) => void] {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFontScale must be used inside <FontScaleProvider>");
  return [v.scale, v.setScale];
}

/**
 * Holds the document at the normal step for as long as the calling view is mounted.
 * The print view is paper: its pages are laid out for A4, and a larger root font
 * size would reflow them. The chosen step comes back when the view unmounts.
 */
export function useFixedFontScale(): void {
  const [scale] = useFontScale();
  useEffect(() => {
    document.documentElement.dataset.fontScale = "normal";
    return () => {
      document.documentElement.dataset.fontScale = scale;
    };
  }, [scale]);
}
