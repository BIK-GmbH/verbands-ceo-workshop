import { Link } from "react-router-dom";
import { Mic, Pause } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { formatDuration, useSessionRecorder } from "@/lib/session-recorder";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Header badge: the session recorder runs across slides, so the only place to
 * see that it is still recording is the header. Deliberately not a stop button —
 * an accidental click during the workshop would end the recording. It links to
 * the record page, where the recorder panel lives.
 */
export function RecordingBadge() {
  const [lang] = useLang();
  const de = lang === "de";
  const { recording, paused, seconds } = useSessionRecorder();

  if (!recording) return null;

  const color = paused ? "#b45309" : "#dc2626";
  const label = paused
    ? de
      ? "Sitzungsaufnahme pausiert, solange diktiert wird. Klicken führt zum Rekorder."
      : "Session recording paused while dictation is running. Click to go to the recorder."
    : de
      ? "Sitzungsaufnahme läuft. Klicken führt zum Rekorder."
      : "Session recording is running. Click to go to the recorder.";

  return (
    <Tooltip content={label}>
      <Link
        to="/protokoll"
        aria-label={label}
        data-testid="recording-badge"
        className="no-print inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md text-xs font-semibold tabular-nums transition-colors"
        style={{
          color,
          border: `1px solid ${color}`,
          background: "color-mix(in oklch, var(--bg) 88%, transparent)",
          textDecoration: "none",
        }}
      >
        {paused ? (
          <Pause size={13} />
        ) : (
          <span className="size-2 rounded-full animate-pulse" style={{ background: color }} aria-hidden />
        )}
        <Mic size={13} className="hidden sm:block" aria-hidden />
        <span>{formatDuration(seconds)}</span>
      </Link>
    </Tooltip>
  );
}
