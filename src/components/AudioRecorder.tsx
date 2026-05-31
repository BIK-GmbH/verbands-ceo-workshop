import { useEffect, useRef, useState } from "react";
import { Mic, Square, Download, Trash2, AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Opt-in local session recorder. Captures audio via MediaRecorder entirely in
 * the browser — nothing is uploaded. The downloaded file is later processed by
 * the `audio` skill (transcription + minutes + keyword extraction) to feed
 * relevant content into the concept. Consent-first by design (the concept
 * itself stresses GDPR / data minimisation).
 */
export function AudioRecorder() {
  const [lang] = useLang();
  const [consented, setConsented] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (url) URL.revokeObjectURL(url);
        setUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(1000);
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError(
        lang === "de"
          ? "Kein Mikrofon-Zugriff. Bitte Berechtigung erlauben."
          : "No microphone access. Please grant permission.",
      );
    }
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }

  function discard() {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setSeconds(0);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const stamp = new Date().toISOString().slice(0, 10);

  if (!supported) {
    return (
      <div className="my-4 p-3 rounded-md text-sm" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
        {lang === "de"
          ? "Audio-Aufnahme wird von diesem Browser nicht unterstützt."
          : "Audio recording is not supported by this browser."}
      </div>
    );
  }

  return (
    <div
      className="my-4 rounded-md border p-4 no-print"
      style={{ borderColor: "var(--border)", background: "var(--bg-elev)" }}
    >
      <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
        <Mic size={16} style={{ color: "var(--workshop-accent)" }} />
        {lang === "de" ? "Sitzungs-Rekorder (optional, lokal)" : "Session recorder (optional, local)"}
      </div>

      {!consented ? (
        <div className="text-sm space-y-3">
          <div
            className="flex gap-2 p-2.5 rounded-md text-xs"
            style={{ background: "rgba(245, 158, 11, 0.10)", color: "#b45309" }}
          >
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>
              {lang === "de"
                ? "Die Aufnahme bleibt vollständig lokal im Browser (kein Upload). Sie dient als Gedächtnisstütze und wird nachträglich mit dem audio-Skill ausgewertet. Aufnahme nur mit Einverständnis aller Anwesenden."
                : "The recording stays entirely local in the browser (no upload). It serves as a memory aid and is processed afterwards with the audio skill. Record only with the consent of everyone present."}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setConsented(true)}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: "var(--workshop-accent)", color: "white" }}
          >
            {lang === "de" ? "Einverstanden — Rekorder aktivieren" : "Agreed — enable recorder"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: "var(--workshop-accent)", color: "white" }}
            >
              <Mic size={15} /> {lang === "de" ? "Aufnahme starten" : "Start recording"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: "#dc2626", color: "white" }}
            >
              <Square size={14} fill="currentColor" /> {lang === "de" ? "Stoppen" : "Stop"}
            </button>
          )}

          <span className="font-mono text-sm tabular-nums" style={{ color: recording ? "#dc2626" : "var(--fg-muted)" }}>
            {recording && "● "}{mm}:{ss}
          </span>

          {url && !recording && (
            <>
              <a
                href={url}
                download={`workshop-aufnahme-${stamp}.webm`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                <Download size={15} /> {lang === "de" ? "Herunterladen" : "Download"}
              </a>
              <button
                type="button"
                onClick={discard}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
              >
                <Trash2 size={15} /> {lang === "de" ? "Verwerfen" : "Discard"}
              </button>
            </>
          )}
        </div>
      )}

      {url && !recording && (
        <audio controls src={url} className="mt-3 w-full" />
      )}
      {error && <p className="mt-2 text-xs" style={{ color: "#dc2626" }}>{error}</p>}
    </div>
  );
}
