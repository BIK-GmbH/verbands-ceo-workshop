import { Link } from "react-router-dom";
import { Loader2, RotateCcw } from "lucide-react";
import type { Lang } from "@/types/slide";
import { AiAssistError, describeAiError, type AiErrorCode } from "@/lib/ai-assist";
import { useSessionTranscripts } from "@/lib/session-transcript-store";
import {
  errorStep,
  nextStep,
  retrySessionTranscription,
  setSessionTranscribeEnabled,
  useSessionTranscribeEnabled,
  useTranscriberState,
} from "@/lib/session-transcriber";
import { removedLabel } from "@/lib/transcript-filter";
import { TranscribeError, describeTranscribeError, type TranscribeErrorCode } from "@/lib/transcribe";

const MUTED = { color: "var(--fg-muted)" } as const;
const RED = "#dc2626";
const AMBER = "#b45309";

/**
 * Opt-in for the live transcription of the session recording. A device
 * setting: shown before a recording starts, since it decides whether segments
 * are cut at all.
 */
export function TranscribeOptIn({ lang, disabled = false }: { lang: Lang; disabled?: boolean }) {
  const de = lang === "de";
  const on = useSessionTranscribeEnabled();
  return (
    <label className="flex items-start gap-2 text-xs cursor-pointer" data-testid="session-transcribe-optin">
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => {
          try {
            setSessionTranscribeEnabled(e.target.checked);
          } catch (err) {
            console.error("[session-transcription] storing the opt-in failed", err);
          }
        }}
        className="size-4 accent-[var(--workshop-accent)] shrink-0 mt-px"
      />
      <span>
        <span className="font-medium">{de ? "Mitschnitt laufend transkribieren" : "Transcribe the recording as it runs"}</span>
        <span className="block leading-snug mt-0.5" style={MUTED}>
          {de
            ? "Der Ton geht abschnittsweise an OpenAI; die Einwilligung der Anwesenden muss das abdecken. Claude entfernt danach private und unangemessene Passagen, bevor ein Transkript gespeichert wird. Die Aufnahme selbst bleibt lokal."
            : "The audio goes to OpenAI in segments; the consent of everyone present must cover that. Claude then removes private and inappropriate passages before a transcript is stored. The recording itself stays local."}
        </span>
      </span>
    </label>
  );
}

function describe(code: string, lang: Lang): string {
  if (errorStep(code) === "clean") {
    const c = code.slice("clean:".length);
    if (c === "parse" || c === "suspect") {
      return lang === "de"
        ? "Die Bereinigung lieferte kein verwertbares Ergebnis; sie wird wiederholt."
        : "The cleaning returned no usable result; it will be retried.";
    }
    return describeAiError(new AiAssistError(c as AiErrorCode), lang);
  }
  if (code === "no-audio") {
    return lang === "de"
      ? "Für einen Abschnitt ist kein Ton mehr gespeichert (z. B. aus einer Sicherung ohne Aufnahmen) – er bleibt eine Lücke im Transkript."
      : "No audio is stored for a segment any more (e.g. from a backup without recordings) – it stays a gap in the transcript.";
  }
  return describeTranscribeError(new TranscribeError(code as TranscribeErrorCode), lang);
}

/**
 * "12 von 14 Abschnitten transkribiert · 1 fehlgeschlagen" plus the reason a
 * step waits and a retry. Renders nothing while there is nothing to report.
 */
export function TranscriptionStatus({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const enabled = useSessionTranscribeEnabled();
  const { sessions } = useSessionTranscripts();
  const st = useTranscriberState();

  const segments = sessions.flatMap((t) => t.segments);
  if (!segments.length) return null;
  const done = segments.filter((x) => x.status === "done").length;
  const failed = segments.filter((x) => x.status === "failed").length;
  // A segment without audio and without raw text (restored from a backup without recordings) cannot be retried.
  const retryable = segments.filter((x) => x.status === "failed" && nextStep(x)).length;
  const waitingForCleaning = segments.filter((x) => x.status !== "done" && nextStep(x) === "clean").length;
  const open = segments.length - done;
  const removed = segments.reduce(
    (acc, x) => ({ privat: acc.privat + (x.removed?.privat ?? 0), unangemessen: acc.unangemessen + (x.removed?.unangemessen ?? 0) }),
    { privat: 0, unangemessen: 0 },
  );
  const removedText = removedLabel(removed, lang);

  const hints: { text: string; tone: "warn" | "error"; settings?: boolean }[] = [];
  if (!enabled && open > 0) {
    hints.push({
      tone: "warn",
      text: de ? "Laufende Transkription ist ausgeschaltet – offene Abschnitte warten." : "Live transcription is switched off – open segments wait.",
    });
  }
  if (st.offline && open > 0) {
    hints.push({ tone: "warn", text: de ? "Offline – es geht weiter, sobald die Verbindung zurück ist." : "Offline – it continues as soon as the connection is back." });
  }
  if (st.transcribePaused && open > waitingForCleaning) {
    hints.push({
      tone: "error",
      settings: st.transcribePaused === "no-key" || st.transcribePaused === "auth",
      text:
        st.transcribePaused === "no-key"
          ? de
            ? "Zum Transkribieren fehlt der OpenAI-Schlüssel – die Abschnitte warten und werden danach transkribiert."
            : "The OpenAI key for transcription is missing – the segments wait and are transcribed afterwards."
          : describe(st.transcribePaused, lang),
    });
  }
  if (st.cleanPaused && waitingForCleaning > 0) {
    hints.push({
      tone: "error",
      settings: true,
      text:
        st.cleanPaused === "clean:no-key"
          ? de
            ? `Zum Bereinigen fehlt der Claude-Schlüssel – ${waitingForCleaning} transkribierte ${waitingForCleaning === 1 ? "Abschnitt wartet" : "Abschnitte warten"}. Es werden beide Schlüssel gebraucht.`
            : `The Claude key for cleaning is missing – ${waitingForCleaning} transcribed ${waitingForCleaning === 1 ? "segment waits" : "segments wait"}. Both keys are needed.`
          : describe(st.cleanPaused, lang),
    });
  }
  if (!hints.length && retryable > 0 && st.lastError) hints.push({ tone: "error", text: describe(st.lastError, lang) });
  if (failed > retryable) hints.push({ tone: "warn", text: describe("no-audio", lang) });

  const busyText = st.busy === "clean" ? (de ? "bereinigt …" : "cleaning …") : st.busy === "transcribe" ? (de ? "transkribiert …" : "transcribing …") : "";
  const canRetry = !st.busy && (retryable > 0 || (open > 0 && Boolean(st.transcribePaused || st.cleanPaused)));

  return (
    <div className="space-y-1.5 text-xs" data-testid="session-transcription-status">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-medium tabular-nums">
          {de
            ? `${done} von ${segments.length} ${segments.length === 1 ? "Abschnitt" : "Abschnitten"} transkribiert`
            : `${done} of ${segments.length} ${segments.length === 1 ? "segment" : "segments"} transcribed`}
        </span>
        {failed > 0 && <span style={{ color: RED }}>· {de ? `${failed} fehlgeschlagen` : `${failed} failed`}</span>}
        {removedText && <span style={MUTED}>· {removedText}</span>}
        {busyText && (
          <span className="inline-flex items-center gap-1" style={MUTED}>
            · <Loader2 size={11} className="animate-spin" aria-hidden /> {busyText}
          </span>
        )}
      </p>
      {hints.map((h) => (
        <p key={h.text} style={{ color: h.tone === "error" ? RED : AMBER }}>
          {h.text}{" "}
          {h.settings && (
            <Link to="/einstellungen" className="font-semibold underline" style={{ color: "var(--workshop-accent)" }}>
              {de ? "Zu den Einstellungen" : "Open settings"}
            </Link>
          )}
        </p>
      ))}
      {canRetry && (
        <button
          type="button"
          onClick={retrySessionTranscription}
          data-testid="session-transcription-retry"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
          style={{ border: "1px solid var(--border)", color: "var(--fg)", background: "var(--bg)" }}
        >
          <RotateCcw size={12} aria-hidden /> {de ? "Jetzt transkribieren / erneut versuchen" : "Transcribe now / retry"}
        </button>
      )}
    </div>
  );
}
