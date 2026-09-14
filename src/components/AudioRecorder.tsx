import { Mic, Square, Download, Trash2, AlertTriangle, Pause, RotateCcw, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { localDateStamp } from "@/lib/local-date";
import {
  discardRecording,
  discardRecovery,
  formatBytes,
  formatDuration,
  grantConsent,
  recordingDownloaded,
  restoreRecording,
  startRecording,
  stopRecording,
  useSessionRecorder,
} from "@/lib/session-recorder";
import { useSessionTranscribeEnabled } from "@/lib/session-transcriber";
import { TranscribeOptIn, TranscriptionStatus } from "@/components/SessionTranscription";

/**
 * Opt-in local session recorder. Captures audio via MediaRecorder entirely in
 * the browser — nothing is uploaded. Consent-first by design.
 *
 * The state lives in `session-recorder.ts`, not here: this panel is only one
 * view onto it, so a running recording survives switching to a slide, and the
 * header can show that it is still running. The panel also offers a recording
 * that a crash or a closed tab interrupted — its chunks are still in IndexedDB.
 */
export function AudioRecorder() {
  const [lang] = useLang();
  const de = lang === "de";
  const { supported, consented, recording, paused, seconds, url, extension, recovery, busy, error } =
    useSessionRecorder();
  const stamp = localDateStamp();
  const transcribeOn = useSessionTranscribeEnabled();

  if (!supported) {
    return (
      <div className="my-4 p-3 rounded-md text-sm" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
        {de ? "Audio-Aufnahme wird von diesem Browser nicht unterstützt." : "Audio recording is not supported by this browser."}
      </div>
    );
  }

  const errorText =
    error === "no-access"
      ? de
        ? "Kein Mikrofon-Zugriff. Bitte Berechtigung erlauben."
        : "No microphone access. Please grant permission."
      : error === "unsupported"
        ? de
          ? "Audio-Aufnahme wird von diesem Browser nicht unterstützt."
          : "Audio recording is not supported by this browser."
        : error === "quota"
          ? de
            ? "Der Browser-Speicher ist voll. Die Aufnahme wurde beendet; alles bis dahin Gesicherte liegt bereit. Bitte herunterladen und danach Platz schaffen."
            : "Browser storage is full. The recording was ended; everything saved up to that point is ready. Please download it and then free up space."
          : error === "storage"
            ? de
              ? "Die Aufnahme konnte nicht gesichert werden. Die Aufnahme wurde beendet; bereits gesicherte Teile bleiben erhalten."
              : "The recording could not be saved. Recording was ended; parts already saved are kept."
            : error === "empty"
              ? de
                ? "Es waren keine gesicherten Teilstücke vorhanden."
                : "No saved chunks were available."
              : null;

  const restoreStart = recovery ? new Date(recovery.startedAt) : null;

  return (
    <div className="my-4 rounded-md border p-4 no-print" style={{ borderColor: "var(--border)", background: "var(--bg-elev)" }}>
      <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
        <Mic size={16} style={{ color: "var(--workshop-accent)" }} />
        {de ? "Sitzungs-Rekorder (optional, lokal)" : "Session recorder (optional, local)"}
      </div>

      {recovery && restoreStart && (
        <div
          data-testid="recorder-recovery"
          className="mb-3 rounded-md p-3 text-sm"
          style={{
            border: "1px solid var(--workshop-accent)",
            background: "color-mix(in oklch, var(--workshop-accent) 8%, transparent)",
          }}
        >
          <div className="flex items-center gap-2 font-semibold mb-1" style={{ color: "var(--workshop-accent)" }}>
            <ShieldCheck size={16} />
            {de ? "Unterbrochene Aufnahme gefunden" : "Interrupted recording found"}
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--fg-muted)" }}>
            {de
              ? `Start ${restoreStart.toLocaleString("de-DE")} · ca. ${formatDuration(recovery.seconds)} · ${recovery.chunks} Teilstücke · ${formatBytes(recovery.bytes, "de")}. Die Aufnahme wurde nicht ordentlich beendet (Absturz, geschlossener Tab). Die gesicherten Teile lassen sich zu einer Datei zusammensetzen; nur die letzten Sekunden können fehlen.`
              : `Started ${restoreStart.toLocaleString("en-GB")} · approx. ${formatDuration(recovery.seconds)} · ${recovery.chunks} chunks · ${formatBytes(recovery.bytes, "en")}. The recording was never stopped properly (crash, closed tab). The saved parts can be assembled into a file; only the last few seconds may be missing.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="recorder-restore"
              disabled={busy}
              onClick={() => void restoreRecording()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60"
              style={{ background: "var(--workshop-accent)", color: "white" }}
            >
              <RotateCcw size={15} /> {de ? "Aufnahme wiederherstellen" : "Restore recording"}
            </button>
            <button
              type="button"
              data-testid="recorder-discard-recovery"
              disabled={busy}
              onClick={() => void discardRecovery()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm disabled:opacity-60"
              style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
            >
              <Trash2 size={15} /> {de ? "Verwerfen" : "Discard"}
            </button>
          </div>
        </div>
      )}

      {!consented ? (
        <div className="text-sm space-y-3">
          <div className="flex gap-2 p-2.5 rounded-md text-xs" style={{ background: "rgba(245, 158, 11, 0.10)", color: "#b45309" }}>
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>
              {transcribeOn
                ? de
                  ? "Die Aufnahme selbst bleibt lokal im Browser. Weil laufend transkribiert wird, geht der Ton abschnittsweise an OpenAI; Claude entfernt danach private und unangemessene Passagen. Aufnahme und Transkription nur mit Einverständnis aller Anwesenden."
                  : "The recording itself stays local in the browser. Because it is transcribed as it runs, the audio goes to OpenAI in segments; Claude then removes private and inappropriate passages. Record and transcribe only with the consent of everyone present."
                : de
                  ? "Die Aufnahme bleibt vollständig lokal im Browser (kein Upload). Sie dient als Gedächtnisstütze für das Protokoll und kann nach dem Workshop heruntergeladen werden. Aufnahme nur mit Einverständnis aller Anwesenden."
                  : "The recording stays entirely local in the browser (no upload). It serves as a memory aid for the record and can be downloaded after the workshop. Record only with the consent of everyone present."}
            </span>
          </div>
          <button
            type="button"
            data-testid="recorder-consent"
            onClick={grantConsent}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: "var(--workshop-accent)", color: "white" }}
          >
            {de ? "Einverstanden — Rekorder aktivieren" : "Agreed — enable recorder"}
          </button>
          <TranscribeOptIn lang={lang} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <button
              type="button"
              data-testid="recorder-start"
              disabled={busy}
              onClick={() => void startRecording()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60"
              style={{ background: "var(--workshop-accent)", color: "white" }}
            >
              <Mic size={15} /> {de ? "Aufnahme starten" : "Start recording"}
            </button>
          ) : (
            <button
              type="button"
              data-testid="recorder-stop"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: "#dc2626", color: "white" }}
            >
              <Square size={14} fill="currentColor" /> {de ? "Stoppen" : "Stop"}
            </button>
          )}

          <span
            data-testid="recorder-time"
            className="inline-flex items-center gap-1.5 font-mono text-sm tabular-nums"
            style={{ color: recording ? (paused ? "#b45309" : "#dc2626") : "var(--fg-muted)" }}
          >
            {recording && (paused ? <Pause size={13} /> : "●")}
            {formatDuration(seconds)}
          </span>

          {recording && paused && (
            <span className="text-xs" style={{ color: "#b45309" }}>
              {de ? "pausiert, solange diktiert wird" : "paused while dictation is running"}
            </span>
          )}

          {busy && (
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
              {de ? "Datei wird zusammengesetzt…" : "Assembling the file…"}
            </span>
          )}

        </div>
      )}

      {/*
        Deliberately outside the consent gate: consent is needed to START a
        recording, not to save one that already exists. After a crash the
        module state is reset, so a restored recording would otherwise offer a
        player but no way to keep the file.
      */}
      {url && !recording && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <a
            href={url}
            data-testid="recorder-download"
            onClick={recordingDownloaded}
            download={`workshop-aufnahme-${stamp}.${extension}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            <Download size={15} /> {de ? "Herunterladen" : "Download"}
          </a>
          <button
            type="button"
            data-testid="recorder-discard"
            onClick={discardRecording}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm"
            style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
          >
            <Trash2 size={15} /> {de ? "Verwerfen" : "Discard"}
          </button>
        </div>
      )}

      {consented && !recording && !url && (
        <p className="mt-2 text-xs" style={{ color: "var(--fg-muted)" }}>
          {de
            ? "Die Aufnahme läuft beim Wechsel auf eine Folie weiter und pausiert automatisch, solange in ein Feld diktiert wird. Jedes Teilstück wird sofort im Browser gesichert — stürzt der Browser ab, lässt sich die Aufnahme beim nächsten Start wiederherstellen. In der Kopfzeile siehst du jederzeit, ob sie läuft."
            : "The recording continues when you switch to a slide and pauses automatically while someone dictates into a field. Every chunk is saved in the browser immediately — if the browser crashes, the recording can be restored on the next start. The header shows at any time whether it is running."}
        </p>
      )}

      {consented && !recording && (
        <div className="mt-3">
          <TranscribeOptIn lang={lang} disabled={busy} />
        </div>
      )}
      <div className="mt-3">
        <TranscriptionStatus lang={lang} />
      </div>

      {url && !recording && <audio data-testid="recorder-player" controls src={url} className="mt-3 w-full" />}
      {errorText && <p data-testid="recorder-error" className="mt-2 text-xs" style={{ color: "#dc2626" }}>{errorText}</p>}
    </div>
  );
}
