import { useEffect, useState, type ReactNode } from "react";
import { useLang, t } from "@/lib/i18n";

function isPresenterActive(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hash.includes("presenter=1")) return true;
  if (document.documentElement.dataset.presenter === "1") return true;
  return false;
}

/** Speaker notes — visible only in presenter mode (?presenter=1, document data-presenter=1)
 *  or in print view. Subscribes to hashchange so toggling at runtime works. */
export function SpeakerNotes({ children }: { children: ReactNode }) {
  const [lang] = useLang();
  const [active, setActive] = useState(isPresenterActive);

  useEffect(() => {
    const sync = () => setActive(isPresenterActive());
    window.addEventListener("hashchange", sync);
    // Also poll the dataset (it can change without hashchange)
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-presenter"] });
    return () => {
      window.removeEventListener("hashchange", sync);
      obs.disconnect();
    };
  }, []);

  if (!active) {
    return (
      <aside
        data-speaker-notes
        className="hidden print:block mt-6 text-xs border-t pt-3"
        style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
      >
        <strong>{t("speakerNotes", lang)}:</strong> {children}
      </aside>
    );
  }
  return (
    <aside
      data-speaker-notes
      className="mt-8 border-t pt-4 text-sm"
      style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
    >
      <strong className="block mb-1" style={{ color: "var(--fg)" }}>
        {t("speakerNotes", lang)}:
      </strong>
      <div>{children}</div>
    </aside>
  );
}
