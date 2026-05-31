import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type MotionMode = "auto" | "on" | "off";

const KEY = "workshop.motion";

function getInitialMotion(): MotionMode {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "auto" || stored === "on" || stored === "off") return stored;
  return "auto";
}

function isReducedPref(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface Ctx {
  mode: MotionMode;
  setMode: (m: MotionMode) => void;
  /** Effective: true if animations should play */
  enabled: boolean;
  /** Cycle through auto → on → off → auto */
  cycle: () => void;
}
const C = createContext<Ctx | null>(null);

function effective(mode: MotionMode): boolean {
  if (mode === "off") return false;
  if (mode === "on") return true;
  return !isReducedPref();
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<MotionMode>(getInitialMotion);
  const [enabled, setEnabled] = useState<boolean>(() => effective(getInitialMotion()));

  // Apply the effective state to the <html> element so CSS can react globally
  useEffect(() => {
    const e = effective(mode);
    setEnabled(e);
    document.documentElement.dataset.motion = e ? "on" : "off";
    document.documentElement.dataset.motionMode = mode;
  }, [mode]);

  // React to OS-level prefers-reduced-motion changes when in "auto"
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const sync = () => {
      const e = !mq.matches;
      setEnabled(e);
      document.documentElement.dataset.motion = e ? "on" : "off";
    };
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, [mode]);

  function setMode(m: MotionMode) {
    window.localStorage.setItem(KEY, m);
    setModeState(m);
  }
  function cycle() {
    setMode(mode === "auto" ? "on" : mode === "on" ? "off" : "auto");
  }

  return (
    <C.Provider value={{ mode, setMode, enabled, cycle }}>{children}</C.Provider>
  );
}

export function useMotion(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("useMotion must be used inside <MotionProvider>");
  return v;
}
