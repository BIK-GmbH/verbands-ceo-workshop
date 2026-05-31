import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Moon, Sun, X } from "lucide-react";
import { ALL_SLIDES, findSlide, neighbours } from "@/lib/slides";
import { useLang, t, pick } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useKeymap } from "@/lib/keymap";
import { useSwipeNav } from "@/lib/useSwipeNav";
import { useSlideDirection } from "@/lib/useSlideDirection";
import { useMotion } from "@/lib/motion";
import { SlideRenderer } from "@/components/SlideRenderer";
import clsx from "clsx";

const ICON = { strokeWidth: 2.25 } as const;

/**
 * Fullscreen presentation mode — one slide at a time, no sidebar/header chrome.
 *
 * Routes:
 *   /p/:slideId            — present this slide
 *   /p/:slideId?notes=1    — show speaker notes overlay
 *
 * Keyboard:
 *   ←/→/J/K/Space/PageUp/PageDown — navigate
 *   Home/End                       — first/last
 *   N                              — toggle speaker notes
 *   F                              — toggle browser fullscreen
 *   Esc                            — exit to sidebar view
 */
export function Presentation() {
  const params = useParams<{ slideId: string }>();
  const nav = useNavigate();
  const [lang] = useLang();
  const [theme, setTheme] = useTheme();
  const current = findSlide(params.slideId ?? "") ?? ALL_SLIDES[0];
  const { prev, next, index, total } = neighbours(current.id);
  const progress = `${((index + 1) / total) * 100}%`;

  // Initialise from URL or from the data-attribute (in case parent set it)
  const [notesOpen, _setNotesOpen] = useState(() => {
    const sp = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    return sp.has("notes") || sp.has("presenter");
  });

  // Wrapper that updates state AND DOM attribute synchronously, so child components
  // (SpeakerNotes via MutationObserver) get a consistent signal on the same tick.
  function setNotesOpen(next: boolean | ((prev: boolean) => boolean)) {
    _setNotesOpen((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      document.documentElement.dataset.presenter = value ? "1" : "0";
      // Mirror to URL hash so deep-link works
      const h = new URL(window.location.href);
      const [path, search = ""] = h.hash.slice(1).split("?");
      const sp = new URLSearchParams(search);
      if (value) {
        sp.set("notes", "1");
        sp.set("presenter", "1");
      } else {
        sp.delete("notes");
        sp.delete("presenter");
      }
      const qs = sp.toString();
      const newHash = `#${path}${qs ? `?${qs}` : ""}`;
      if (newHash !== h.hash) history.replaceState(null, "", newHash);
      return value;
    });
  }

  // On mount + when slide changes, ensure DOM attribute matches state
  useEffect(() => {
    document.documentElement.dataset.presenter = notesOpen ? "1" : "0";
    return () => {
      // when leaving presentation route entirely, reset
      document.documentElement.dataset.presenter = "0";
    };
  }, [notesOpen, current.id]);

  // Esc → back to docs view of same slide.
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        nav(`/s/${current.id}`);
      }
      if (e.key === "n" || e.key === "N") {
        setNotesOpen((o) => !o);
      }
      if (e.key === "t" || e.key === "T") {
        setTheme(theme === "dark" ? "light" : "dark");
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [nav, current.id, theme, setTheme]);

  useKeymap({
    onPrev: () => prev && nav(`/p/${prev.id}`),
    onNext: () => next && nav(`/p/${next.id}`),
    onFirst: () => nav(`/p/${ALL_SLIDES[0].id}`),
    onLast: () => nav(`/p/${ALL_SLIDES[ALL_SLIDES.length - 1].id}`),
    onToggleFullscreen: () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    },
    onTogglePresenter: () => setNotesOpen((o) => !o),
  });

  const motion = useMotion();
  const direction = useSlideDirection(current.id);
  const notesLabel = lang === "de" ? "Notizen" : "Notes";
  const themeLabel = lang === "de" ? "Design" : "Theme";
  const exitLabel = lang === "de" ? "Zurück" : "Back";
  // Touch-swipe handler for mobile slide nav (shared with WorkshopLayout)
  const swipe = useSwipeNav({
    onSwipeLeft: () => next && nav(`/p/${next.id}`),
    onSwipeRight: () => prev && nav(`/p/${prev.id}`),
    enabled: motion.enabled,
  });

  return (
    <div
      data-presentation
      className="w-screen flex flex-col"
      style={{
        background: theme === "dark" ? "#000" : "#0b1220",
        color: "var(--fg)",
        height: "100svh",
        minHeight: "100svh",
      }}
      {...swipe.handlers}
    >
      {/* Audience-mode toolbar — visible, but deliberately quieter than the slide. */}
      <div
        className="sticky top-0 z-30 flex items-center justify-end px-3 py-2 text-xs no-print"
        style={{ color: "rgba(255,255,255,0.92)" }}
      >
        <div
          className="flex items-center gap-1.5 rounded-lg border px-1.5 py-1 shadow-lg"
          style={{
            background: "rgba(12,17,28,0.78)",
            borderColor: "rgba(255,255,255,0.16)",
            backdropFilter: "blur(14px)",
          }}
        >
          <button
            onClick={() => setNotesOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 h-9 min-w-9 px-2.5 max-[420px]:w-9 max-[420px]:px-0 justify-center rounded-md hover:bg-white/10 active:bg-white/20 transition-colors"
            style={{ background: notesOpen ? "rgba(56,182,171,0.24)" : "rgba(255,255,255,0.08)" }}
            title={`${notesLabel} (N)`}
            aria-label="Toggle speaker notes"
            aria-pressed={notesOpen}
          >
            {notesOpen ? <Eye size={16} {...ICON} /> : <EyeOff size={16} {...ICON} />}
            <span className="max-[420px]:hidden">{notesLabel}</span>
          </button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="inline-flex items-center gap-1.5 h-9 min-w-9 px-2.5 max-[560px]:w-9 max-[560px]:px-0 justify-center rounded-md hover:bg-white/10 active:bg-white/20 transition-colors"
            style={{ background: "rgba(255,255,255,0.08)" }}
            title={`${themeLabel} (T)`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Moon size={18} {...ICON} /> : <Sun size={18} {...ICON} />}
            <span className="max-[560px]:hidden">{themeLabel}</span>
          </button>
          <Link
            to={`/s/${current.id}`}
            className="inline-flex items-center gap-1.5 h-9 min-w-9 px-2.5 max-[420px]:w-9 max-[420px]:px-0 justify-center rounded-md transition-colors"
            style={{
              background: "rgba(255,255,255,0.92)",
              color: "var(--workshop-accent-deep)",
            }}
            title={`${exitLabel} (Esc)`}
            aria-label="Exit presentation"
          >
            <X size={17} {...ICON} />
            <span className="max-[420px]:hidden">{exitLabel}</span>
          </Link>
        </div>
      </div>

      <div className="h-1 shrink-0 no-print" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full transition-[width] duration-300"
          style={{
            width: progress,
            background: "var(--workshop-accent)",
            boxShadow: "0 0 18px rgba(56,182,171,0.45)",
          }}
          aria-hidden
        />
      </div>

      {/* Slide area — 16:9 frame on tablet+, full-bleed on mobile */}
      <div className="relative flex-1 flex items-center justify-center md:p-6 overflow-hidden">
        {prev && (
          <Link
            to={`/p/${prev.id}`}
            className="hidden lg:flex absolute left-0 top-16 bottom-16 z-10 w-20 items-center justify-start pl-4 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity no-print"
            aria-label="Previous slide"
            title={`← ${prev.id}`}
          >
            <span
              className="size-11 grid place-items-center rounded-full border"
              style={{
                color: "rgba(255,255,255,0.9)",
                background: "rgba(12,17,28,0.72)",
                borderColor: "rgba(255,255,255,0.14)",
                backdropFilter: "blur(12px)",
              }}
            >
              <ChevronLeft size={22} {...ICON} />
            </span>
          </Link>
        )}
        {next && (
          <Link
            to={`/p/${next.id}`}
            className="hidden lg:flex absolute right-0 top-16 bottom-16 z-10 w-20 items-center justify-end pr-4 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity no-print"
            aria-label="Next slide"
            title={`${next.id} →`}
          >
            <span
              className="size-11 grid place-items-center rounded-full border"
              style={{
                color: "rgba(255,255,255,0.9)",
                background: "rgba(12,17,28,0.72)",
                borderColor: "rgba(255,255,255,0.14)",
                backdropFilter: "blur(12px)",
              }}
            >
              <ChevronRight size={22} {...ICON} />
            </span>
          </Link>
        )}
        <div
          className="relative w-full md:max-w-[1280px] md:aspect-[16/9] md:rounded-lg overflow-hidden md:shadow-2xl h-full md:h-auto"
          style={{
            background: "var(--bg)",
            color: "var(--fg)",
          }}
        >
          <div
            key={current.id}
            className={clsx(
              "absolute inset-0 overflow-y-auto presentation-slide",
              motion.enabled && direction === "forward" && "slide-enter-forward",
              motion.enabled && direction === "backward" && "slide-enter-backward",
              swipe.dragging ? "slide-dragging" : "slide-snap-back",
            )}
            style={{
              transform: swipe.dragX ? `translate3d(${swipe.dragX}px, 0, 0)` : undefined,
            }}
            data-slide-id={current.id}
            data-notes-open={notesOpen ? "1" : "0"}
          >
            <SlideRenderer slideId={current.id} lang={lang} />
          </div>
        </div>
      </div>

      {/* Bottom bar — sticky so it never scrolls away on mobile. */}
      <div
        className="sticky bottom-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-6 py-2 sm:py-3 text-sm no-print gap-2 shrink-0"
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-self-start">
          <span className="font-mono text-xs shrink-0 opacity-70">{current.id}</span>
          <span className="opacity-50 hidden sm:inline">·</span>
          <span className="hidden sm:inline shrink-0 opacity-90">
            {t("module", lang)} {current.module === 99 ? "Anhang" : current.module}
          </span>
          <span className="opacity-50 hidden md:inline">·</span>
          <span className="truncate hidden md:inline opacity-90">{pick(current.title, lang)}</span>
        </div>

        <div
          className="justify-self-center flex items-center gap-1.5 sm:gap-2 rounded-lg border px-1.5 py-1 font-mono text-xs"
          style={{
            background: "rgba(12,17,28,0.72)",
            borderColor: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
          }}
        >
          {prev ? (
            <Link
              to={`/p/${prev.id}`}
              className="size-9 grid place-items-center rounded-md hover:bg-white/10 active:bg-white/20 transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
              aria-label="Previous slide"
              title={`← ${prev.id}`}
            >
              <ChevronLeft size={18} {...ICON} />
            </Link>
          ) : (
            <span className="size-9 grid place-items-center opacity-30">
              <ChevronLeft size={18} {...ICON} />
            </span>
          )}
          <span className="opacity-80 px-2 tabular-nums">
            {index + 1} / {total}
          </span>
          {next ? (
            <Link
              to={`/p/${next.id}`}
              className="size-9 grid place-items-center rounded-md hover:bg-white/10 active:bg-white/20 transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
              aria-label="Next slide"
              title={`${next.id} →`}
            >
              <ChevronRight size={18} {...ICON} />
            </Link>
          ) : (
            <span className="size-9 grid place-items-center opacity-30">
              <ChevronRight size={18} {...ICON} />
            </span>
          )}
        </div>

        <div className="justify-self-end hidden sm:block font-mono text-xs opacity-70 tabular-nums">
          {Math.round(((index + 1) / total) * 100)}%
        </div>
      </div>
    </div>
  );
}
