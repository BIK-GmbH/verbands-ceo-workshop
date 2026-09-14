import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Download,
  Mic,
  Pause,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import { SOFT, SOFT_HOVER } from "@/components/ui/soft-control";
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
 * Header control for the session recorder — the single place from which the
 * recorder is operated while walking through the slides. It replaces the old
 * read-only RecordingBadge: starting, stopping, saving and restoring used to be
 * possible only inside the recorder panel on /protokoll, which meant leaving the
 * current slide in the middle of a session.
 *
 * The button itself never records, stops or discards anything — a single click
 * only opens the menu, so a misplaced click during the workshop can never end a
 * running recording. Every action sits behind that one extra, deliberate click.
 *
 * All state and behaviour come from `session-recorder.ts`; this is a view, the
 * same way the recorder panel on /protokoll is (which stays as it is).
 */

/** Same reds and ambers the badge and the recorder panel have always used. */
const RED = "#dc2626";
const AMBER = "#b45309";

const PANEL_WIDTH = 304;
const EDGE = 8;

interface Position {
  top: number;
  left: number;
  width: number;
}

function place(trigger: HTMLElement): Position {
  const r = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const width = Math.min(PANEL_WIDTH, vw - 2 * EDGE);
  // Right-aligned with the button, but never past either edge of the screen.
  const left = Math.max(EDGE, Math.min(r.right - width, vw - width - EDGE));
  return { top: Math.round(r.bottom + 6), left: Math.round(left), width };
}

export function RecorderMenu() {
  const [lang] = useLang();
  const de = lang === "de";
  const { supported, consented, recording, paused, seconds, url, extension, recovery, busy, error } =
    useSessionRecorder();
  const transcribeOn = useSessionTranscribeEnabled();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const stamp = localDateStamp();

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setPos(null);
    if (refocus) btnRef.current?.focus();
  }, []);

  // Follow the button while the menu is open (scroll, resize, font-size change).
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = btnRef.current;
      if (!trigger) return;
      const next = place(trigger);
      setPos((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.width === next.width ? prev : next,
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Esc closes (without reaching page-level Esc handlers), a click outside closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(true);
    };
    const onOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onOutside, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onOutside, true);
    };
  }, [open, close]);

  // Opening moves the focus into the menu, so it can be used from the keyboard.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    (first ?? panelRef.current)?.focus();
  }, [open, consented, recording, url, recovery]);

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
  const color = paused ? AMBER : RED;

  const buttonLabel = recording
    ? paused
      ? de
        ? `Sitzungs-Rekorder, pausiert bei ${formatDuration(seconds)}. Menü öffnen.`
        : `Session recorder, paused at ${formatDuration(seconds)}. Open the menu.`
      : de
        ? `Sitzungsaufnahme läuft seit ${formatDuration(seconds)}. Menü öffnen.`
        : `Session recording running for ${formatDuration(seconds)}. Open the menu.`
    : recovery
      ? de
        ? "Sitzungs-Rekorder — unterbrochene Aufnahme gefunden. Menü öffnen."
        : "Session recorder — interrupted recording found. Open the menu."
      : de
        ? "Sitzungs-Rekorder: Menü öffnen"
        : "Session recorder: open the menu";

  const tip = recording
    ? paused
      ? de
        ? "Sitzungsaufnahme pausiert, solange diktiert wird. Klicken öffnet das Menü (Stoppen, zum Rekorder)."
        : "Session recording paused while dictation is running. Click opens the menu (stop, go to the recorder)."
      : de
        ? "Sitzungsaufnahme läuft. Klicken öffnet nur das Menü — gestoppt wird erst mit dem Knopf darin."
        : "Session recording is running. Clicking only opens the menu — it stops only via the button inside."
    : de
      ? "Sitzungs-Rekorder: Aufnahme starten, stoppen und sichern — von jeder Folie aus."
      : "Session recorder: start, stop and save a recording — from any slide.";

  /** Actions inside the menu share one look; the primary one carries the accent. */
  const item = "w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium text-left disabled:opacity-60";
  const quiet = { border: "1px solid var(--border)", color: "var(--fg)", background: "var(--bg)" } as const;

  return (
    <>
      <Tooltip content={tip}>
        <button
          ref={btnRef}
          type="button"
          data-testid="recorder-menu-button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={buttonLabel}
          onClick={() => {
            if (open) {
              close();
              return;
            }
            // Placed before the first paint: a panel that renders unplaced would
            // have to be hidden, and a hidden element cannot take the focus.
            if (btnRef.current) setPos(place(btnRef.current));
            setOpen(true);
          }}
          className={
            recording
              ? "no-print relative inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md text-xs font-semibold tabular-nums transition-colors shrink-0"
              : // Idle: a plain icon button in the style of its neighbours. Below `sm`
                // it stays hidden — the header already overflows on a phone, and the
                // recorder is a facilitator tool used on the presenting machine.
                `no-print relative hidden sm:grid size-9 place-items-center rounded-md transition-colors shrink-0 ${SOFT_HOVER}`
          }
          style={
            recording
              ? {
                  color,
                  border: `1px solid ${color}`,
                  background: "color-mix(in oklch, var(--bg) 88%, transparent)",
                }
              : { ...SOFT, color: "inherit" }
          }
        >
          {recording ? (
            <>
              {paused ? (
                <Pause size={13} aria-hidden />
              ) : (
                <span className="size-2 rounded-full animate-pulse" style={{ background: color }} aria-hidden />
              )}
              <Mic size={13} className="hidden sm:block" aria-hidden />
              <span data-testid="recorder-menu-time">{formatDuration(seconds)}</span>
            </>
          ) : (
            <Mic size={18} strokeWidth={2.25} aria-hidden />
          )}
          {/* A crash left something behind — easy to miss without a marker. */}
          {recovery && (
            <span
              data-testid="recorder-menu-recovery-dot"
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full"
              style={{ background: "var(--workshop-accent)" }}
              aria-hidden
            />
          )}
        </button>
      </Tooltip>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={de ? "Sitzungs-Rekorder" : "Session recorder"}
            data-testid="recorder-menu-panel"
            tabIndex={-1}
            className="no-print fixed z-50 rounded-lg shadow-xl p-3 space-y-2.5 outline-none"
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: pos?.width ?? PANEL_WIDTH,
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
            }}
            onBlur={(e) => {
              // Tabbing out of the menu closes it; clicks inside keep it open.
              const next = e.relatedTarget as Node | null;
              if (!next) return;
              if (panelRef.current?.contains(next) || btnRef.current?.contains(next)) return;
              close();
            }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mic size={15} style={{ color: "var(--workshop-accent)" }} aria-hidden />
              {de ? "Sitzungs-Rekorder" : "Session recorder"}
            </div>

            {!supported ? (
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                {de
                  ? "Audio-Aufnahme wird von diesem Browser nicht unterstützt."
                  : "Audio recording is not supported by this browser."}
              </p>
            ) : (
              <>
                {recovery && restoreStart && (
                  <div
                    data-testid="recorder-menu-recovery"
                    className="rounded-md p-2.5 space-y-2"
                    style={{
                      border: "1px solid var(--workshop-accent)",
                      background: "color-mix(in oklch, var(--workshop-accent) 8%, transparent)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--workshop-accent)" }}>
                      <ShieldCheck size={15} aria-hidden />
                      {de ? "Unterbrochene Aufnahme gefunden" : "Interrupted recording found"}
                    </div>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                      {de
                        ? `Start ${restoreStart.toLocaleString("de-DE")} · ca. ${formatDuration(recovery.seconds)} · ${recovery.chunks} Teilstücke · ${formatBytes(recovery.bytes, "de")}. Die gesicherten Teile lassen sich zu einer Datei zusammensetzen; nur die letzten Sekunden können fehlen.`
                        : `Started ${restoreStart.toLocaleString("en-GB")} · approx. ${formatDuration(recovery.seconds)} · ${recovery.chunks} chunks · ${formatBytes(recovery.bytes, "en")}. The saved parts can be assembled into a file; only the last few seconds may be missing.`}
                    </p>
                    <button
                      type="button"
                      data-autofocus
                      data-testid="recorder-menu-restore"
                      disabled={busy}
                      onClick={() => void restoreRecording()}
                      className={item}
                      style={{ background: "var(--workshop-accent)", color: "white" }}
                    >
                      <RotateCcw size={15} aria-hidden /> {de ? "Aufnahme wiederherstellen" : "Restore recording"}
                    </button>
                    <button
                      type="button"
                      data-testid="recorder-menu-discard-recovery"
                      disabled={busy}
                      onClick={() => void discardRecovery()}
                      className={item}
                      style={quiet}
                    >
                      <Trash2 size={15} aria-hidden /> {de ? "Verwerfen" : "Discard"}
                    </button>
                  </div>
                )}

                {!consented ? (
                  <>
                    <div
                      className="flex gap-2 p-2.5 rounded-md text-xs"
                      style={{ background: "rgba(245, 158, 11, 0.10)", color: AMBER }}
                    >
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden />
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
                      data-autofocus={recovery ? undefined : true}
                      data-testid="recorder-menu-consent-start"
                      disabled={busy}
                      onClick={() => {
                        grantConsent();
                        void startRecording();
                      }}
                      className={item}
                      style={{ background: "var(--workshop-accent)", color: "white" }}
                    >
                      <Mic size={15} aria-hidden /> {de ? "Einverstanden — Aufnahme starten" : "Agreed — start recording"}
                    </button>
                    <TranscribeOptIn lang={lang} disabled={busy} />
                  </>
                ) : recording ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-mono tabular-nums" style={{ color }}>
                      {paused ? <Pause size={14} aria-hidden /> : <span aria-hidden>●</span>}
                      {formatDuration(seconds)}
                      {paused && (
                        <span className="font-sans text-xs" style={{ color: AMBER }}>
                          {de ? "pausiert, solange diktiert wird" : "paused while dictation is running"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                      {de
                        ? "Die Aufnahme läuft beim Wechsel auf eine andere Folie weiter und pausiert automatisch, solange in ein Feld diktiert wird."
                        : "The recording continues when you switch to another slide and pauses automatically while someone dictates into a field."}
                    </p>
                    <button
                      type="button"
                      // No data-autofocus on purpose: when the recording starts,
                      // the focus must not land on the stop button — a second
                      // Enter would then end what was just started.
                      data-testid="recorder-menu-stop"
                      onClick={stopRecording}
                      className={item}
                      style={{ background: RED, color: "white" }}
                    >
                      <Square size={14} fill="currentColor" aria-hidden /> {de ? "Aufnahme stoppen" : "Stop recording"}
                    </button>
                  </>
                ) : (
                  !url && (
                    <>
                      <button
                        type="button"
                        data-autofocus={recovery ? undefined : true}
                        data-testid="recorder-menu-start"
                        disabled={busy}
                        onClick={() => void startRecording()}
                        className={item}
                        style={{ background: "var(--workshop-accent)", color: "white" }}
                      >
                        <Mic size={15} aria-hidden /> {de ? "Aufnahme starten" : "Start recording"}
                      </button>
                      <TranscribeOptIn lang={lang} disabled={busy} />
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        {de
                          ? "Die Aufnahme läuft beim Wechsel auf eine Folie weiter und pausiert automatisch, solange in ein Feld diktiert wird. Jedes Teilstück wird sofort im Browser gesichert."
                          : "The recording continues when you switch to a slide and pauses automatically while someone dictates into a field. Every chunk is saved in the browser immediately."}
                      </p>
                    </>
                  )
                )}

                {/*
                  Deliberately outside the consent gate, as in the recorder panel:
                  consent is needed to START a recording, not to save one that
                  already exists — after a crash the module state is reset.
                */}
                {url && !recording && (
                  <>
                    <a
                      href={url}
                      data-autofocus={recovery ? undefined : true}
                      data-testid="recorder-menu-download"
                      onClick={recordingDownloaded}
                      download={`workshop-aufnahme-${stamp}.${extension}`}
                      className={item}
                      style={{ ...quiet, textDecoration: "none" }}
                    >
                      <Download size={15} aria-hidden /> {de ? "Herunterladen" : "Download"}
                    </a>
                    <button
                      type="button"
                      data-testid="recorder-menu-discard"
                      onClick={discardRecording}
                      className={item}
                      style={{ ...quiet, color: "var(--fg-muted)" }}
                    >
                      <Trash2 size={15} aria-hidden /> {de ? "Verwerfen" : "Discard"}
                    </button>
                  </>
                )}

                {busy && (
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    {de ? "Datei wird zusammengesetzt…" : "Assembling the file…"}
                  </p>
                )}

                <TranscriptionStatus lang={lang} />

                {errorText && (
                  <p data-testid="recorder-menu-error" className="text-xs" style={{ color: RED }}>
                    {errorText}
                  </p>
                )}
              </>
            )}

            <Link
              to="/protokoll"
              data-testid="recorder-menu-link"
              onClick={() => close()}
              className="inline-flex items-center gap-1.5 text-xs font-medium pt-0.5"
              style={{ color: "var(--workshop-accent)", textDecoration: "none" }}
            >
              {de ? "Zum Rekorder" : "To the recorder"} <ArrowRight size={13} aria-hidden />
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}
