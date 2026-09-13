import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHelpKey } from "@/lib/keymap";
import { lastSlidePath } from "@/lib/last-slide";
import { HelpOverlay } from "@/components/HelpOverlay";

/** Shareable link to the help: everything else opens the same dialog on top of the page. */
export const HELP_PATH = "/hilfe";

interface HelpApi {
  isOpen: boolean;
  /** Opens the dialog, optionally scrolled to a section id. */
  open: (sectionId?: string) => void;
  close: () => void;
  /** Follows a jump target from inside the help and closes it. */
  jump: (to: string) => void;
}

const Ctx = createContext<HelpApi | null>(null);

/**
 * Help state for the whole app. Lives inside the router because every jump target
 * is a route, and outside the slide layout because the help must also work on the
 * record, poster, interview and settings pages.
 */
export function HelpProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [overlay, setOverlay] = useState(false);
  const [section, setSection] = useState<string | undefined>(undefined);

  // The print view is a paper snapshot — no dialog, not even by keyboard.
  const printing = pathname.startsWith("/print");
  const viaRoute = pathname === HELP_PATH;
  const isOpen = !printing && (overlay || viaRoute);

  const open = useCallback((sectionId?: string) => {
    setSection(sectionId);
    setOverlay(true);
  }, []);

  const close = useCallback(() => {
    setOverlay(false);
    if (!viaRoute) return;
    // Opened by link: leave the help route behind, back where the reader came from.
    const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
    if (canGoBack) navigate(-1);
    else navigate(lastSlidePath());
  }, [navigate, viaRoute]);

  const jump = useCallback(
    (to: string) => {
      setOverlay(false);
      navigate(to);
    },
    [navigate],
  );

  useHelpKey(() => open(), !printing);

  const api = useMemo<HelpApi>(() => ({ isOpen, open, close, jump }), [isOpen, open, close, jump]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {isOpen && <HelpOverlay section={section} onClose={close} onJump={jump} />}
    </Ctx.Provider>
  );
}

export function useHelp(): HelpApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHelp must be used inside <HelpProvider>");
  return v;
}

/** Page behind the dialog when the help is opened through its own link. */
export function HelpRoute() {
  return <div style={{ background: "var(--bg)", minHeight: "100svh" }} />;
}
