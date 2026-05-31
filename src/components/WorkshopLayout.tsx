import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { CommandPalette } from "./CommandPalette";
import { ProgressBar } from "./ProgressBar";
import { PWAUpdatePrompt } from "./PWAUpdatePrompt";
import { SwipeHint } from "./SwipeHint";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useKeymap } from "@/lib/keymap";
import { useSwipeNav } from "@/lib/useSwipeNav";
import { useSlideDirection } from "@/lib/useSlideDirection";
import { useMotion } from "@/lib/motion";
import { ALL_SLIDES, findSlide, neighbours } from "@/lib/slides";
import clsx from "clsx";

export function WorkshopLayout() {
  const [lang, setLang] = useLang();
  const [theme, setTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const nav = useNavigate();
  const params = useParams<{ slideId: string }>();
  const current = findSlide(params.slideId ?? "") ?? ALL_SLIDES[0];

  const { prev, next } = neighbours(current.id);
  const motion = useMotion();
  const direction = useSlideDirection(current.id);

  // Scroll-position memory: remember scrollTop of <main> per slide-id.
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const lastSlideId = useRef<string>(current.id);

  // Save scroll position of OUTGOING slide before id changes; restore on new.
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const prevId = lastSlideId.current;
    if (prevId !== current.id) {
      // We're rendering the new slide now; restore its previous position (or 0).
      el.scrollTop = scrollPositions.current.get(current.id) ?? 0;
      lastSlideId.current = current.id;
    }
  }, [current.id]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        scrollPositions.current.set(lastSlideId.current, el!.scrollTop);
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  const swipe = useSwipeNav({
    onSwipeLeft: () => next && nav(`/s/${next.id}`),
    onSwipeRight: () => prev && nav(`/s/${prev.id}`),
    enabled: motion.enabled,
  });

  useKeymap({
    onPrev: () => prev && nav(`/s/${prev.id}`),
    onNext: () => next && nav(`/s/${next.id}`),
    onFirst: () => nav(`/s/${ALL_SLIDES[0].id}`),
    onLast: () => nav(`/s/${ALL_SLIDES[ALL_SLIDES.length - 1].id}`),
    onTogglePalette: () => setPaletteOpen((o) => !o),
    onTogglePresenter: () => {
      const url = new URL(window.location.href);
      const isOn = url.hash.includes("presenter=1");
      const [path] = url.hash.split("?");
      url.hash = isOn ? path : `${path}?presenter=1`;
      window.location.replace(url.toString());
    },
    onToggleFullscreen: () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    },
  });

  return (
    <div
      className="flex flex-col"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        // 100svh = "small viewport height": stable across initial paint on
        // iOS PWA, where 100dvh occasionally measures 0 before safe-area
        // insets settle, causing the footer to slide off-screen until the
        // first scroll triggers a re-measure.
        height: "100svh",
        minHeight: "100svh",
      }}
    >
      <Header
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleMobileSidebar={() => setMobileSidebarOpen((o) => !o)}
      />
      <ProgressBar slideId={current.id} />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          lang={lang}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <main
          ref={mainRef}
          data-workshop-content
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ background: "var(--bg)" }}
          {...swipe.handlers}
        >
          <div
            key={current.id}
            data-slide-stage
            className={clsx(
              motion.enabled && direction === "forward" && "slide-enter-forward",
              motion.enabled && direction === "backward" && "slide-enter-backward",
              swipe.dragging ? "slide-dragging" : "slide-snap-back",
            )}
            style={{
              transform: swipe.dragX ? `translate3d(${swipe.dragX}px, 0, 0)` : undefined,
            }}
          >
            <Outlet context={{ lang, current }} />
          </div>
        </main>
      </div>

      <Footer lang={lang} current={current} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} lang={lang} />
      <SwipeHint />
      <PWAUpdatePrompt />
    </div>
  );
}
