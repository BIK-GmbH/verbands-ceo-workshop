import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import {
  autoSaveSessionRecording,
  autoSaveSessionTranscript,
  dismissAutoExportProblem,
  isAutoExportEnabled,
  isSessionTranscriptComplete,
  useAutoExportStatus,
} from "@/lib/auto-export";
import { setFinishedRecordingHandler } from "@/lib/session-recorder";
import { useSessionTranscripts } from "@/lib/session-transcript-store";
import { startSessionTranscriber } from "@/lib/session-transcriber";
import { ERROR_COLOR } from "@/components/interviews/ui";

/**
 * Connects the automatic saving of files to the session recorder and shows a
 * failed automatic save on every route (bottom right, the backup notices sit
 * bottom left). Transcripts and interview recordings call auto-export directly.
 *
 * Always mounted, so it also starts the background transcription of the
 * session recording (leftovers of a reload are picked up at once) and saves a
 * session transcript when it becomes final.
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

  useEffect(() => startSessionTranscriber(), []);
  useSessionTranscriptSaving();

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

/**
 * Saves a session transcript automatically: when the recording ends into the
 * backup folder as an interim version (gaps named), and once every segment is
 * transcribed and cleaned as the final file. Sessions that were already final
 * when the app loaded are not saved again.
 */
function useSessionTranscriptSaving() {
  const { ready, sessions } = useSessionTranscripts();
  const seen = useRef<Map<string, { closed: boolean; complete: boolean }> | null>(null);

  useEffect(() => {
    if (!ready) return;
    const first = seen.current === null;
    const known = (seen.current ??= new Map());
    for (const t of sessions) {
      const now = { closed: t.closed, complete: isSessionTranscriptComplete(t) };
      const before = known.get(t.sessionId);
      known.set(t.sessionId, now);
      if (first || !isAutoExportEnabled()) continue;
      if (now.complete && !before?.complete) void autoSaveSessionTranscript(t);
      else if (now.closed && !before?.closed && !now.complete) void autoSaveSessionTranscript(t, "folder"); // no folder: nothing happens
    }
  }, [ready, sessions]);
}
