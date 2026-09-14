import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { autoSaveSessionRecording, dismissAutoExportProblem, useAutoExportStatus } from "@/lib/auto-export";
import { setFinishedRecordingHandler } from "@/lib/session-recorder";
import { ERROR_COLOR } from "@/components/interviews/ui";

/**
 * Connects the automatic saving of files to the session recorder and shows a
 * failed automatic save on every route (bottom right, the backup notices sit
 * bottom left). Transcripts and interview recordings call auto-export directly.
 */
export function AutoExport() {
  const [lang] = useLang();
  const { pathname } = useLocation();
  const { problem } = useAutoExportStatus();

  useEffect(() => {
    setFinishedRecordingHandler(async (blob, session) => {
      const saved = await autoSaveSessionRecording(blob, session);
      return { onDisk: Boolean(saved?.path) };
    });
    return () => setFinishedRecordingHandler(null);
  }, []);

  if (!problem || pathname.startsWith("/print") || pathname.startsWith("/p/")) return null;
  const bottom = /^\/s\//.test(pathname) ? "calc(var(--footer-height) + 12px)" : "16px";

  return createPortal(
    <div
      role="alert"
      data-testid="auto-export-problem"
      className="no-print fixed right-3 z-40 flex items-start gap-2 rounded-lg pl-3 pr-1.5 py-2 text-xs leading-snug"
      style={{
        bottom,
        maxWidth: "min(360px, calc(100vw - 24px))",
        background: "var(--bg-elev)",
        color: "var(--fg)",
        border: `1px solid ${ERROR_COLOR}`,
        boxShadow: "0 8px 24px color-mix(in oklch, var(--fg) 14%, transparent)",
      }}
    >
      <AlertTriangle size={15} className="mt-px shrink-0" style={{ color: ERROR_COLOR }} aria-hidden />
      <div className="space-y-1">
        <p>{problem.message[lang]}</p>
        {!pathname.startsWith("/einstellungen") && (
          <Link to="/einstellungen" className="font-semibold" style={{ color: "var(--workshop-accent)" }}>
            {lang === "de" ? "Zu den Einstellungen" : "Open settings"}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={dismissAutoExportProblem}
        className="size-6 grid place-items-center rounded shrink-0"
        style={{ color: "var(--fg-muted)" }}
        aria-label={lang === "de" ? "Hinweis schließen" : "Close notice"}
      >
        <X size={13} />
      </button>
    </div>,
    document.body,
  );
}
