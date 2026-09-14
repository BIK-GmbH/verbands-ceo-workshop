/**
 * Session recorder state, deliberately kept OUTSIDE React.
 *
 * The recorder used to live inside the /protokoll route, so leaving that page
 * unmounted it, stopped the microphone track and threw the finished recording
 * away — exactly what must not happen while the facilitator walks through the
 * slides. Holding the MediaRecorder and the session handle in this module keeps
 * a recording running across route changes; the recorder panel and the header
 * badge are only views onto this state.
 *
 * Dictation and the recorder never hold the microphone at the same time: while
 * someone dictates into a field, the recording pauses and resumes afterwards
 * (see pauseForDictation/resumeAfterDictation, called from useDictation).
 *
 * Durability: the chunks are NOT kept in an in-memory array any more. Every
 * chunk goes straight into IndexedDB (`recording-store.ts`) and the file is
 * assembled from there — on a normal stop exactly as after a crash, so the
 * recovery path is exercised on every stop instead of only in an emergency.
 * Memory is no longer the only copy of a two-day workshop.
 *
 * Everything stays in the browser: no upload, no server.
 */
import { useSyncExternalStore } from "react";
import {
  appendChunk,
  assembleSession,
  beginSession,
  closeSession,
  deleteAllSessions,
  deleteSession,
  findAbandonedSession,
  isQuotaError,
  type RecordingSession,
} from "@/lib/recording-store";

export type RecorderError = "no-access" | "unsupported" | "quota" | "storage" | "empty";

/** A run that was never stopped properly — offered for recovery after a reload. */
export interface RecoveryOffer {
  id: string;
  startedAt: string;
  /** Recorded seconds up to the last chunk that was saved. */
  seconds: number;
  chunks: number;
  bytes: number;
}

export interface RecorderState {
  /** MediaRecorder + getUserMedia available in this browser. */
  supported: boolean;
  /** The facilitator confirmed that everyone present agreed. */
  consented: boolean;
  recording: boolean;
  /** Paused while a dictation holds the microphone. */
  paused: boolean;
  /** Recorded seconds; does not advance while paused. */
  seconds: number;
  /** Object URL of the finished recording, until it is discarded. */
  url: string | null;
  /** File extension matching the recorded container, for the download name. */
  extension: string;
  /** Interrupted recording found in IndexedDB, waiting for a decision. */
  recovery: RecoveryOffer | null;
  /** An assembly (normal stop or recovery) is running. */
  busy: boolean;
  error: RecorderError | null;
}

const EVENT = "session-recorder-change";

/**
 * MediaRecorder timeslice.
 *
 * 5 s is the balance point: a crash costs at most the five seconds still in
 * flight — nobody misses those in a workshop record — while a full day of
 * recording writes roughly 5,800 rows instead of the 29,000 a one-second slice
 * produced. At ~20 KB per Opus chunk that keeps the write load and the number
 * of IndexedDB transactions during the live session comfortably small.
 */
const TIMESLICE_MS = 5000;

let recorder: MediaRecorder | null = null;
let timer: number | null = null;
/** Number of dictations currently holding the microphone. */
let dictationHolds = 0;

/** Header of the run currently being written. */
let session: RecordingSession | null = null;
/** Chunks are written strictly in order; onstop waits for this chain. */
let writeQueue: Promise<void> = Promise.resolve();
/** Set once a write failed — no further writes, the run is ended. */
let writeBroken = false;
/**
 * Session whose chunks are still in IndexedDB and are only deleted after a
 * download or an explicit discard (that is: a restored recording).
 */
let pendingSessionId: string | null = null;

/** Reference-stable snapshot: useSyncExternalStore compares by identity. */
let snapshot: RecorderState = {
  supported:
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window,
  consented: false,
  recording: false,
  paused: false,
  seconds: 0,
  url: null,
  extension: "webm",
  recovery: null,
  busy: false,
  error: null,
};

function emit(next: Partial<RecorderState>) {
  snapshot = { ...snapshot, ...next };
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  void checkForAbandonedRecording();
  return () => window.removeEventListener(EVENT, cb);
}

export function getRecorderState(): RecorderState {
  return snapshot;
}

export function useSessionRecorder(): RecorderState {
  return useSyncExternalStore(subscribe, getRecorderState, getRecorderState);
}

/** Closing the tab mid-recording would lose the file without a trace. */
function beforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}

function extensionFor(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "mp4";
  return "webm";
}

function startTicking() {
  stopTicking();
  timer = window.setInterval(() => emit({ seconds: snapshot.seconds + 1 }), 1000);
}

function stopTicking() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

export function grantConsent() {
  emit({ consented: true });
}

// ---------------------------------------------------------------------------
// Recovery of an interrupted run

let recoveryChecked = false;

/**
 * Looks once per app load for a run that was never closed properly — the
 * fingerprint of a crash, a closed tab or a reload during the recording.
 */
export async function checkForAbandonedRecording(): Promise<void> {
  if (recoveryChecked) return;
  recoveryChecked = true;
  try {
    const found = await findAbandonedSession(session?.id);
    if (!found) return;
    emit({
      recovery: {
        id: found.id,
        startedAt: found.startedAt,
        seconds: found.seconds,
        chunks: found.chunkCount,
        bytes: found.bytes,
      },
    });
  } catch (err) {
    console.error("[session-recorder] recovery check failed", err);
  }
}

// At app load, not only once the recorder panel happens to be mounted.
if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
  void checkForAbandonedRecording();
}

/** Rebuilds the interrupted recording and offers it for download and playback. */
export async function restoreRecording(): Promise<void> {
  const offer = snapshot.recovery;
  if (!offer || snapshot.busy) return;
  emit({ busy: true, error: null });
  try {
    const result = await assembleSession(offer.id);
    if (!result) {
      emit({ busy: false, recovery: null, error: "empty" });
      return;
    }
    if (snapshot.url) URL.revokeObjectURL(snapshot.url);
    // The chunks stay until the file is downloaded or discarded — nothing is
    // thrown away behind the user's back. The session also stays open on
    // purpose: whoever restores but reloads before saving gets the offer again.
    pendingSessionId = offer.id;
    emit({
      busy: false,
      recovery: null,
      seconds: result.session.seconds,
      url: URL.createObjectURL(result.blob),
      extension: result.session.extension || extensionFor(result.blob.type),
    });
  } catch (err) {
    console.error("[session-recorder] restore failed", err);
    emit({ busy: false, error: "storage" });
  }
}

/** Explicitly discards the interrupted recording — only on the user's word. */
export async function discardRecovery(): Promise<void> {
  const offer = snapshot.recovery;
  if (!offer) return;
  emit({ recovery: null });
  try {
    await deleteSession(offer.id);
  } catch (err) {
    console.error("[session-recorder] discarding the recovery failed", err);
  }
}

// ---------------------------------------------------------------------------
// Recording

/** A write failed: end the run cleanly so everything saved so far survives. */
function handleWriteFailure(err: unknown) {
  if (writeBroken) return;
  writeBroken = true;
  console.error("[session-recorder] chunk could not be stored", err);
  emit({ error: isQuotaError(err) ? "quota" : "storage" });
  try {
    // Stopping takes the normal path: what is already in IndexedDB becomes a
    // file. Silently recording on would only pretend to be recording.
    if (recorder && recorder.state !== "inactive") recorder.stop();
  } catch {
    /* nothing left to do — the error is already on screen */
  }
}

export async function startRecording(): Promise<void> {
  if (snapshot.recording) return;
  if (!snapshot.supported) {
    emit({ error: "unsupported" });
    return;
  }
  let media: MediaStream;
  try {
    media = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    emit({ error: "no-access", recording: false });
    return;
  }
  try {
    const rec = new MediaRecorder(media);
    const type = rec.mimeType || "audio/webm";
    // The header must exist before the first chunk can arrive.
    session = await beginSession(type, extensionFor(type));
    writeQueue = Promise.resolve();
    writeBroken = false;
    let seq = 0;

    rec.ondataavailable = (e) => {
      if (e.data.size === 0 || writeBroken) return;
      const mySeq = ++seq;
      const blob = e.data;
      const at = snapshot.seconds;
      // Persist first, strictly in order. onstop waits for this chain, so a
      // stop never assembles a file that is still missing its last chunk.
      writeQueue = writeQueue.then(async () => {
        if (writeBroken || !session) return;
        try {
          session = await appendChunk(session, mySeq, blob, at);
        } catch (err) {
          handleWriteFailure(err);
        }
      });
    };

    rec.onstop = () => {
      media.getTracks().forEach((t) => t.stop());
      recorder = null;
      dictationHolds = 0;
      stopTicking();
      window.removeEventListener("beforeunload", beforeUnload);
      emit({ recording: false, paused: false, busy: true });
      void finishRecording();
    };

    // One chunk every TIMESLICE_MS, each stored immediately. Deliberately no
    // rotation into fresh recorder runs: restarting MediaRecorder would drop
    // audio at every seam (see the note in recording-store.ts).
    rec.start(TIMESLICE_MS);
    recorder = rec;
    if (snapshot.url) URL.revokeObjectURL(snapshot.url);
    dictationHolds = 0;
    emit({ recording: true, paused: false, seconds: 0, url: null, error: null });
    window.addEventListener("beforeunload", beforeUnload);
    startTicking();
  } catch (err) {
    console.error("[session-recorder] start failed", err);
    media.getTracks().forEach((t) => t.stop());
    session = null;
    emit({ error: "storage", recording: false });
  }
}

/**
 * Assembles the file from IndexedDB — never from memory, so a normal stop runs
 * exactly the same code as a recovery after a crash.
 */
async function finishRecording(): Promise<void> {
  const current = session;
  session = null;
  if (!current) {
    emit({ busy: false });
    return;
  }
  try {
    await writeQueue; // the last chunk may still be on its way into the store
    const result = await assembleSession(current.id);
    if (!result) {
      emit({ busy: false, error: snapshot.error ?? "empty" });
      await deleteSession(current.id).catch(() => {});
      return;
    }
    if (snapshot.url) URL.revokeObjectURL(snapshot.url);
    emit({
      busy: false,
      url: URL.createObjectURL(result.blob),
      extension: result.session.extension,
      seconds: result.session.seconds || snapshot.seconds,
    });
    // The file is in hand, but only as an object URL in memory: stopping and
    // reloading without downloading would lose the recording — the very thing
    // the chunks exist to prevent. So they stay until the file is downloaded or
    // discarded; closing the session keeps it out of the crash-recovery offer.
    pendingSessionId = current.id;
    await closeSession(current.id);
    await handOver(result.blob, { ...result.session, closed: true }, current.id);
  } catch (err) {
    console.error("[session-recorder] assembling failed", err);
    // Nothing is deleted here: the chunks stay and are offered as a recovery
    // on the next load.
    emit({ busy: false, error: "storage" });
  }
}

export function stopRecording() {
  if (!recorder) return;
  // The finished blob is published from rec.onstop / finishRecording above.
  recorder.stop();
}

/**
 * Receives every finished recording (the automatic saving of files registers
 * here; kept as a hook so this module does not depend on the folder logic).
 * Resolves `onDisk: true` only when the file verifiably landed on disk — then
 * the stored chunks are no longer the only copy and are cleaned up like after
 * a download. A browser download cannot be verified, so its chunks stay.
 */
export type FinishedRecordingHandler = (blob: Blob, session: RecordingSession) => Promise<{ onDisk: boolean }>;
let finishedHandler: FinishedRecordingHandler | null = null;

export function setFinishedRecordingHandler(handler: FinishedRecordingHandler | null) {
  finishedHandler = handler;
}

async function handOver(blob: Blob, finished: RecordingSession, id: string) {
  if (!finishedHandler) return;
  try {
    const { onDisk } = await finishedHandler(blob, finished);
    if (onDisk && pendingSessionId === id) recordingDownloaded();
  } catch (err) {
    // The recording itself is fine and still offered for download.
    console.error("[session-recorder] handing the finished recording over failed", { id, err });
  }
}

/** Id of the run currently being written — not downloadable yet. */
export function runningSessionId(): string | null {
  return snapshot.recording ? (session?.id ?? null) : null;
}

/**
 * Removes one stored run from the download list. Goes through the same paths as
 * the recorder panel, so its offer or finished file disappears there as well.
 */
export async function deleteStoredRecording(id: string): Promise<void> {
  if (id === runningSessionId()) return;
  if (id === pendingSessionId) {
    discardRecording();
    return;
  }
  if (snapshot.recovery?.id === id) {
    await discardRecovery();
    return;
  }
  await deleteSession(id);
}

/** Called once the user actually downloaded a restored file. */
export function recordingDownloaded() {
  const id = pendingSessionId;
  pendingSessionId = null;
  if (id) void deleteSession(id).catch((err) => console.error("[session-recorder] cleanup failed", err));
}

export function discardRecording() {
  if (snapshot.url) URL.revokeObjectURL(snapshot.url);
  const id = pendingSessionId;
  pendingSessionId = null;
  if (id) void deleteSession(id).catch((err) => console.error("[session-recorder] cleanup failed", err));
  emit({ url: null, seconds: 0 });
}

/**
 * Reset of all workshop content: drops the finished recording, the recovery
 * offer and every stored run. A recording that is still running keeps going —
 * the reset must not silently switch off the microphone.
 */
export async function clearRecordings(): Promise<void> {
  if (snapshot.url) URL.revokeObjectURL(snapshot.url);
  pendingSessionId = null;
  emit({ url: null, recovery: null, error: null, ...(snapshot.recording ? {} : { seconds: 0 }) });
  await deleteAllSessions(snapshot.recording ? session?.id : undefined);
}

/**
 * A dictation is about to take the microphone. Counted, because several fields
 * could hold it in sequence — the recording only resumes once the last one ends.
 */
export function pauseForDictation() {
  dictationHolds += 1;
  if (dictationHolds > 1) return;
  if (!recorder || recorder.state !== "recording") return;
  try {
    recorder.pause();
  } catch {
    return; // Pausing is a convenience; a failure must not break the recording.
  }
  stopTicking();
  emit({ paused: true });
}

/** The dictation released the microphone: continue the recording. */
export function resumeAfterDictation() {
  if (dictationHolds > 0) dictationHolds -= 1;
  if (dictationHolds > 0) return;
  if (!recorder || recorder.state !== "paused") return;
  try {
    recorder.resume();
  } catch {
    return;
  }
  startTicking();
  emit({ paused: false });
}

/** "12:34" for the badge and the panel. */
export function formatDuration(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** "3,4 MB" / "780 KB" — rough size for the recovery offer. */
export function formatBytes(bytes: number, lang: "de" | "en"): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${lang === "de" ? mb.toFixed(1).replace(".", ",") : mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
