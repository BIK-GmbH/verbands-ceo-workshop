import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

const KEY = "workshop.hint.swipe.seen";
const ICON = { strokeWidth: 2.25 } as const;

/** One-time hint shown on mobile first-visit: "swipe ← → to navigate". */
export function SwipeHint() {
  const [lang] = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY)) return;
    if (!matchMedia("(max-width: 767px)").matches) return;
    if (!("ontouchstart" in window)) return;

    const showTimer = setTimeout(() => setShow(true), 1500);
    const hideTimer = setTimeout(() => dismiss(), 6000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  // Auto-dismiss when the user actually swipes (or taps anywhere)
  useEffect(() => {
    if (!show) return;
    const onTouch = () => dismiss();
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, [show]);

  if (!show) return null;

  return (
    <div
      data-swipe-hint
      className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg max-w-[92vw] no-print pointer-events-auto"
      style={{
        bottom: "calc(var(--footer-height) + env(safe-area-inset-bottom) + 12px)",
        background: "var(--workshop-accent)",
        color: "white",
        animation: "swipeHintFadeIn 320ms ease-out",
      }}
      role="status"
      aria-label={
        lang === "de"
          ? "Tipp: Wische horizontal um zwischen Folien zu navigieren"
          : "Tip: swipe horizontally to navigate slides"
      }
    >
      <ChevronLeft size={16} {...ICON} />
      <span className="text-xs font-medium">
        {lang === "de" ? "Wische zum Navigieren" : "Swipe to navigate"}
      </span>
      <ChevronRight size={16} {...ICON} />
      <button
        onClick={dismiss}
        className="ml-1 size-6 grid place-items-center rounded-full hover:bg-white/15"
        aria-label={lang === "de" ? "Tipp schließen" : "Dismiss tip"}
      >
        <X size={12} {...ICON} />
      </button>
    </div>
  );
}
