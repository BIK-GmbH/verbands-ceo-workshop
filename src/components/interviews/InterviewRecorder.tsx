import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import type { Lang } from "@/types/slide";
import { autoSaveInterviewAudio } from "@/lib/auto-export";
import { newInterviewId, saveInterview, type Interview, type QuestionMarker } from "@/lib/interview-store";
import { INTERVIEW_QUESTIONS, TARGET_SECONDS } from "@/lib/interview-opinion";
import { extensionForMime } from "@/lib/transcribe";
import { BTN, ERROR_COLOR, Notice, WARN_COLOR, card, danger, downloadBlob, field, formatDuration, muted, outline, primary } from "./ui";
import { Tooltip } from "@/components/ui/Tooltip";

type Phase = "idle" | "recording" | "paused" | "saving";

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((c) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(c));
}

const isRecorderSupported = () =>
  typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

/**
 * Guided interview: questions one by one, recording with pause, level meter and
 * a time marker per question. Consent is mandatory before the microphone opens.
 */
export function InterviewRecorder({
  lang,
  nextNumber,
  onShowList,
}: {
  lang: Lang;
  nextNumber: number;
  onShowList: () => void;
}) {
  const de = lang === "de";
  const [pseudonym, setPseudonym] = useState("");
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState<Blob | null>(null);
  const [supported] = useState(isRecorderSupported);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const markersRef = useRef<QuestionMarker[]>([]);
  const consentAtRef = useRef<string | null>(null);
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelRef = useRef<HTMLDivElement | null>(null);

  const active = phase === "recording" || phase === "paused";
  const total = INTERVIEW_QUESTIONS.length;

  const currentMs = () =>
    accumulatedRef.current + (segmentStartRef.current === null ? 0 : performance.now() - segmentStartRef.current);

  function teardown() {
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    tickRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    ctx?.close().catch((err: unknown) => console.error("[interview-recorder] closing audio context failed", err));
    if (levelRef.current) levelRef.current.style.transform = "scaleX(0)";
  }

  useEffect(
    () => () => {
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      teardown();
    },
    [],
  );

  // Leaving the page mid-interview would lose the recording.
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  function startMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.fftSize);
      const draw = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
        if (levelRef.current) levelRef.current.style.transform = `scaleX(${level})`;
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (err) {
      // The meter is a nicety; recording works without it.
      console.error("[interview-recorder] level meter unavailable", err);
    }
  }

  async function start() {
    if (!consent || active || phase === "saving") return;
    setError("");
    setSaved(null);
    setUnsaved(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      console.error("[interview-recorder] microphone access failed", err);
      setError(
        de
          ? "Kein Mikrofon-Zugriff. Bitte die Berechtigung im Browser erlauben und prüfen, ob ein Mikrofon angeschlossen ist."
          : "No microphone access. Please allow it in the browser and check that a microphone is connected.",
      );
      return;
    }
    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      // 32 kbit/s is plenty for speech and keeps 5 minutes at about 1.2 MB, far below the 25 MB API limit.
      rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      console.error("[interview-recorder] MediaRecorder could not start", { mimeType, err });
      setError(de ? "Die Aufnahme konnte in diesem Browser nicht gestartet werden." : "Recording could not be started in this browser.");
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start(1000);
    recRef.current = rec;
    streamRef.current = stream;
    accumulatedRef.current = 0;
    segmentStartRef.current = performance.now();
    markersRef.current = [{ question, atSec: 0 }];
    setElapsedMs(0);
    tickRef.current = window.setInterval(() => setElapsedMs(currentMs()), 250);
    startMeter(stream);
    setPhase("recording");
  }

  function pause() {
    const rec = recRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    accumulatedRef.current = currentMs();
    segmentStartRef.current = null;
    setElapsedMs(accumulatedRef.current);
    setPhase("paused");
  }

  function resume() {
    const rec = recRef.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    segmentStartRef.current = performance.now();
    setPhase("recording");
  }

  function goTo(q: number) {
    const next = Math.max(0, Math.min(total - 1, q));
    setQuestion(next);
    if (!active) return;
    if (markersRef.current[markersRef.current.length - 1]?.question !== next) {
      markersRef.current.push({ question: next, atSec: Math.round(currentMs() / 100) / 10 });
    }
  }

  function stopRecorder(): Promise<Blob | null> {
    const rec = recRef.current;
    if (!rec) return Promise.resolve(null);
    accumulatedRef.current = currentMs();
    segmentStartRef.current = null;
    return new Promise((resolve) => {
      const finish = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      if (rec.state === "inactive") finish();
      else {
        rec.onstop = finish;
        rec.stop();
      }
    });
  }

  async function stopAndSave() {
    if (!active) return;
    setPhase("saving");
    const blob = await stopRecorder();
    recRef.current = null;
    teardown();
    const durationSec = Math.round(accumulatedRef.current / 1000);
    if (!blob || blob.size === 0) {
      setError(de ? "Die Aufnahme ist leer. Bitte Mikrofon prüfen und erneut aufnehmen." : "The recording is empty. Please check the microphone and record again.");
      setPhase("idle");
      return;
    }
    const id = newInterviewId();
    const name = pseudonym.trim() || `Teilnehmer ${nextNumber}`;
    const mimeType = blob.type || "audio/webm";
    try {
      const interview: Interview = {
        id,
        pseudonym: name,
        source: "recorded",
        createdAt: new Date().toISOString(),
        consentAt: consentAtRef.current ?? new Date().toISOString(),
        fileName: `interview-${id}.${extensionForMime(mimeType)}`,
        mimeType,
        size: blob.size,
        durationSec,
        audio: blob,
        markers: markersRef.current,
      };
      await saveInterview(interview);
      void autoSaveInterviewAudio(interview);
      setSaved(name);
      setPseudonym("");
      setConsent(false);
      consentAtRef.current = null;
      setQuestion(0);
      setElapsedMs(0);
    } catch (err) {
      console.error("[interview-recorder] saving the recording failed", { id, size: blob.size, err });
      setUnsaved(blob);
      setError(
        de
          ? "Die Aufnahme konnte nicht gespeichert werden (Speicher voll oder blockiert). Bitte jetzt als Datei sichern und später hochladen."
          : "The recording could not be saved (storage full or blocked). Please save it as a file now and upload it later.",
      );
    }
    setPhase("idle");
  }

  async function discard() {
    if (!active) return;
    if (!window.confirm(de ? "Aufnahme wirklich verwerfen? Sie wird nicht gespeichert." : "Really discard the recording? It will not be saved.")) return;
    await stopRecorder();
    recRef.current = null;
    teardown();
    setElapsedMs(0);
    setPhase("idle");
  }

  const seconds = elapsedMs / 1000;
  const overTime = seconds >= TARGET_SECONDS;
  const q = INTERVIEW_QUESTIONS[question];

  if (!supported) {
    return (
      <Notice tone="warn">
        {de
          ? "Dieser Browser unterstützt keine Audio-Aufnahme. Bitte aktuelles Chrome, Edge, Firefox oder Safari verwenden oder vorhandene Aufnahmen hochladen."
          : "This browser does not support audio recording. Please use a current Chrome, Edge, Firefox or Safari, or upload existing recordings."}
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm block">
          <span className="block mb-1 text-xs uppercase tracking-wider" style={muted}>
            {de ? "Pseudonym (optional)" : "Pseudonym (optional)"}
          </span>
          <input
            type="text"
            value={pseudonym}
            maxLength={60}
            onChange={(e) => setPseudonym(e.target.value)}
            placeholder={`Teilnehmer ${nextNumber}`}
            className="w-full rounded-md p-2 text-sm"
            style={field}
          />
        </label>
        <p className="text-xs self-end leading-snug" style={muted}>
          {de
            ? "Bitte keine Klarnamen verwenden. Das Pseudonym erscheint nur im Protokoll-Titel, nicht in den KI-Anfragen."
            : "Please avoid real names. The pseudonym only appears in the record heading, not in the AI requests."}
        </p>
      </div>

      <label
        className="flex items-start gap-2.5 rounded-md p-3 text-sm cursor-pointer"
        style={{ ...card, borderColor: consent ? "var(--workshop-accent)" : "var(--border)" }}
      >
        <input
          type="checkbox"
          checked={consent}
          disabled={active || phase === "saving"}
          onChange={(e) => {
            setConsent(e.target.checked);
            consentAtRef.current = e.target.checked ? new Date().toISOString() : null;
          }}
          className="mt-0.5 size-4 shrink-0 accent-[var(--workshop-accent)]"
        />
        <span className="leading-snug">
          <strong>{de ? "Einwilligung (Pflicht): " : "Consent (required): "}</strong>
          {de
            ? "Die befragte Person ist einverstanden, dass das Interview aufgezeichnet und lokal auf diesem Gerät gespeichert wird, dass die Aufnahme zur Transkription an OpenAI und das Transkript zur Bereinigung von privaten und unangemessenen Passagen sowie zur Zusammenfassung an Anthropic (Claude) übertragen wird und dass Aufnahme und Transkript nach dem Workshop gelöscht werden. Die Einwilligung kann jederzeit widerrufen werden."
            : "The interviewee agrees that the interview is recorded and stored locally on this device, that the recording is sent to OpenAI for transcription and the transcript to Anthropic (Claude) for removing private and inappropriate passages and for summarisation, and that recording and transcript are deleted after the workshop. Consent can be withdrawn at any time."}
        </span>
      </label>

      <div className="rounded-lg p-4 sm:p-6" style={{ ...card, background: "var(--bg)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--workshop-accent)" }}>
            {de ? `Frage ${question + 1} von ${total}` : `Question ${question + 1} of ${total}`}
          </span>
          <div className="flex gap-1 ml-auto" role="tablist" aria-label={de ? "Leitfragen" : "Guide questions"}>
            {INTERVIEW_QUESTIONS.map((iq, i) => (
              <Tooltip key={i} content={iq[lang]}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === question}
                  onClick={() => goTo(i)}
                  className="size-7 rounded-full text-xs font-semibold"
                  style={
                    i === question
                      ? { background: "var(--workshop-accent)", color: "white" }
                      : { border: "1px solid var(--border)", color: "var(--fg-muted)" }
                  }
                  aria-label={de ? `Frage ${i + 1}` : `Question ${i + 1}`}
                >
                  {i + 1}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-semibold leading-snug min-h-[5.5rem]" aria-live="polite">
          {q[lang]}
        </p>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => goTo(question - 1)} disabled={question === 0} className={BTN} style={outline}>
            <ChevronLeft size={16} /> {de ? "Zurück" : "Back"}
          </button>
          <button
            type="button"
            onClick={() => goTo(question + 1)}
            disabled={question === total - 1}
            className={`${BTN} ml-auto`}
            style={outline}
          >
            {de ? "Weiter" : "Next"} <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="rounded-md p-3 space-y-3" style={card}>
        <div className="flex flex-wrap items-center gap-2">
          {!active ? (
            <Tooltip
              content={
                !consent
                  ? de ? "Erst die Einwilligung bestätigen" : "Confirm consent first"
                  : de
                    ? "Mikrofon öffnen und aufnehmen. Beim Wechsel der Leitfrage wird eine Zeitmarke gesetzt."
                    : "Open the microphone and record. Switching the guide question sets a time mark."
              }
            >
              <button
                type="button"
                onClick={start}
                disabled={!consent || phase === "saving"}
                className={BTN}
                style={primary}
              >
                {phase === "saving" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                {phase === "saving" ? (de ? "Speichere …" : "Saving …") : de ? "Aufnahme starten" : "Start recording"}
              </button>
            </Tooltip>
          ) : (
            <>
              {phase === "recording" ? (
                <button type="button" onClick={pause} className={BTN} style={outline}>
                  <Pause size={16} /> {de ? "Pause" : "Pause"}
                </button>
              ) : (
                <button type="button" onClick={resume} className={BTN} style={primary}>
                  <Play size={16} /> {de ? "Fortsetzen" : "Resume"}
                </button>
              )}
              <Tooltip
                content={
                  de
                    ? "Aufnahme beenden und lokal in diesem Browser speichern. Transkript und Meinungsbild entstehen danach unter „Meinungsbilder“."
                    : "End the recording and store it locally in this browser. Transcript and opinion picture follow under “Opinion pictures”."
                }
              >
                <button type="button" onClick={stopAndSave} className={BTN} style={{ background: ERROR_COLOR, color: "white" }}>
                  <Square size={14} fill="currentColor" /> {de ? "Stopp & speichern" : "Stop & save"}
                </button>
              </Tooltip>
              <Tooltip content={de ? "Aufnahme abbrechen, nichts wird gespeichert" : "Cancel the recording, nothing is stored"}>
                <button type="button" onClick={discard} className={BTN} style={danger}>
                  <Trash2 size={15} /> {de ? "Verwerfen" : "Discard"}
                </button>
              </Tooltip>
            </>
          )}
          <span
            className="ml-auto font-mono text-lg tabular-nums"
            style={{ color: phase === "recording" ? ERROR_COLOR : overTime ? WARN_COLOR : "var(--fg-muted)" }}
            aria-label={de ? "Dauer" : "Duration"}
          >
            {phase === "recording" && "● "}
            {formatDuration(seconds)} <span className="text-sm" style={muted}>/ {formatDuration(TARGET_SECONDS)}</span>
          </span>
        </div>

        <div className="grid gap-1.5">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }} aria-hidden>
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.min(100, (seconds / TARGET_SECONDS) * 100)}%`,
                background: overTime ? WARN_COLOR : "var(--workshop-accent)",
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-[11px]" style={muted}>
            <span className="w-14 shrink-0">{de ? "Pegel" : "Level"}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }} aria-hidden>
              <div
                ref={levelRef}
                className="h-full w-full origin-left"
                style={{ transform: "scaleX(0)", background: "linear-gradient(90deg, #16a34a, #eab308 70%, #dc2626)" }}
              />
            </div>
          </div>
          {overTime && active && (
            <p className="text-xs" style={{ color: WARN_COLOR }}>
              {de ? "Richtwert von 5 Minuten erreicht – bitte zum Ende kommen." : "5-minute guideline reached – please wrap up."}
            </p>
          )}
        </div>
      </div>

      {saved && (
        <Notice tone="ok">
          {de ? `Interview „${saved}“ gespeichert. ` : `Interview “${saved}” saved. `}
          <button type="button" onClick={onShowList} className="underline font-medium">
            {de ? "Zu den Meinungsbildern" : "Go to opinion pictures"}
          </button>
        </Notice>
      )}
      {error && (
        <div className="space-y-2">
          <Notice tone="error">
            <AlertTriangle size={13} className="inline mr-1 -mt-0.5" />
            {error}
          </Notice>
          {unsaved && (
            <button
              type="button"
              onClick={() => downloadBlob(unsaved, `interview-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${extensionForMime(unsaved.type)}`)}
              className={BTN}
              style={outline}
            >
              <Download size={15} /> {de ? "Aufnahme als Datei sichern" : "Save recording as file"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
