import { useEffect, useState, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  /** Shown on the button and as the heading of the enlarged view */
  title?: string;
  titleEn?: string;
  children: ReactNode;
}

/**
 * Wraps slide content (e.g. one day of the agenda) and offers a full-screen,
 * enlarged view — readable from the back row of the room.
 */
export function ZoomBox({ title, titleEn, children }: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const [open, setOpen] = useState(false);
  const label = (de ? title : (titleEn ?? title)) ?? "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      // Arrow keys would otherwise page through the deck behind the overlay.
      if (e.key.startsWith("Arrow")) e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <div className="my-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <Tooltip
          content={
            de
              ? "Groß anzeigen: füllt den Bildschirm, gut lesbar auch aus der letzten Reihe. Schließen mit Esc."
              : "Show large: fills the screen, readable from the back row. Close with Esc."
          }
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="no-print inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0"
            style={{ background: "var(--workshop-accent)", color: "white" }}
            aria-label={de ? `${label} groß anzeigen` : `Show ${label} large`}
          >
            <Maximize2 size={14} /> {de ? "Groß" : "Large"}
          </button>
        </Tooltip>
      </div>

      {open && (
        <div
          className="no-print fixed inset-0 z-50 flex flex-col"
          style={{ background: "var(--bg)" }}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div
            className="flex items-center gap-3 px-5 sm:px-8 border-b shrink-0"
            style={{ height: "var(--header-height)", borderColor: "var(--border)" }}
          >
            <span className="text-lg font-semibold" style={{ color: "var(--workshop-accent)" }}>
              {label}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm font-medium"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            >
              <X size={16} /> {de ? "Schließen" : "Close"}
            </button>
          </div>
          <div className="flex-1 overflow-auto px-5 sm:px-10 py-6">
            <div className="max-w-[1600px] mx-auto" style={{ fontSize: "clamp(1rem, 1.9vw, 1.9rem)" }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
