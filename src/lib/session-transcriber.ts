/**
 * Background transcription of the session recording's segments.
 *
 * Runs while the workshop is going on. Every finished segment (see
 * session-recorder.ts) goes through two steps, one segment after another:
 *   1. speech-to-text at OpenAI → the raw text waits in `rawText`, the audio is dropped,
 *   2. cleaning by Claude (transcript-filter.ts) → only the cleaned `text` stays.
 * Nothing leaves the browser unless the facilitator opted in on this device —
 * the consent of everyone present has to cover that.
 *
 * Failures never lose anything: the audio stays until a raw text exists, the
 * raw text until the cleaning worked. Temporary errors (network, rate limit,
 * timeout, an unusable answer) are retried with a growing pause and whenever
 * the browser comes back online; a missing or rejected key and an exhausted
 * quota pause that step until the key changes or someone retries by hand. The
 * two steps pause independently: without a Claude key, transcription still
 * goes on. With several tabs open, a Web Lock keeps a segment from being sent
 * twice. Transcript text is never logged.
 */
import { useSyncExternalStore } from "react";
import { AiAssistError, getApiKey } from "./ai-assist";
import {
  getAllSessionTranscripts,
  updateSegment,
  type SessionTranscript,
  type TranscriptSegment,
} from "./session-transcript-store";
import { TranscriptFilterError, cleanTranscript } from "./transcript-filter";
import { SESSION_PROMPT, TranscribeError, extensionForMime, getOpenAiKey, transcribeAudio } from "./transcribe";

/* ------------------------------------------------------------------ opt-in */

const OPT_KEY = "verbands-ceo.session-transcribe.v1";
const OPT_EVENT = "session-transcribe-optin-change";

export function isSessionTranscribeEnabled(): boolean {
  try {
    return window.localStorage.getItem(OPT_KEY) === "1";
  } catch {
    return false;
  }
}

/** A device setting like theme or language: not in backups, not cleared by a reset. Throws if storage is blocked. */
export function setSessionTranscribeEnabled(on: boolean) {
  if (on) window.localStorage.setItem(OPT_KEY, "1");
  else window.localStorage.removeItem(OPT_KEY);
  window.dispatchEvent(new CustomEvent(OPT_EVENT));
}

function subscribeOptIn(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === OPT_KEY) cb();
  };
  window.addEventListener(OPT_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(OPT_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSessionTranscribeEnabled(): boolean {
  return useSyncExternalStore(subscribeOptIn, isSessionTranscribeEnabled, () => false);
}

/* ------------------------------------------------------------------ errors */

/**
 * Stored in `segment.error`: transcription errors as their TranscribeErrorCode
 * ("network", "auth", …), cleaning errors prefixed with "clean:" ("clean:no-key").
 */
export type Step = "transcribe" | "clean";

export function errorStep(code: string | undefined): Step {
  return code?.startsWith("clean:") ? "clean" : "transcribe";
}

/** A retry cannot fix these — the step waits for a new key or a manual retry. */
const PAUSING = new Set(["no-key", "auth", "quota", "clean:no-key", "clean:auth"]);
/** The file itself is the problem — only a manual retry tries again. */
const PERMANENT = new Set(["too-large", "format", "no-audio"]);

function codeOf(err: unknown, step: Step): string {
  if (step === "transcribe") return err instanceof TranscribeError ? err.code : "api";
  if (err instanceof AiAssistError || err instanceof TranscriptFilterError) return `clean:${err.code}`;
  return "clean:api";
}

/* ------------------------------------------------------------------- state */

export interface TranscriberState {
  /** The step a request is on its way for */
  busy: Step | null;
  /** Transcription waits for a human: no key, rejected key, quota */
  transcribePaused: string | null;
  /** Cleaning waits for a human: no Claude key, rejected key */
  cleanPaused: string | null;
  /** Code of the last failed attempt (see Step), for the status line */
  lastError: string | null;
  offline: boolean;
}

let state: TranscriberState = { busy: null, transcribePaused: null, cleanPaused: null, lastError: null, offline: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<TranscriberState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useTranscriberState(): TranscriberState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

/* ------------------------------------------------------------------- queue */

/** Pause before the n-th automatic retry: 1, 5, then 15 minutes. */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];
const LOCK = "verbands-ceo-session-transcriber";

let started = false;
let running = false;
/** Set by a change while the queue runs: look again before stopping. */
let again = false;
/** Manual retry: ignore back-off and permanent errors once. */
let forceNext = false;
let timer: number | null = null;

function backoffFor(attempts: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1];
}

/** The step a segment still needs, or null when there is nothing to do for it. */
export function nextStep(seg: TranscriptSegment): Step | null {
  if (seg.status === "done") return null;
  if (seg.rawText !== undefined) return "clean";
  return seg.audio ? "transcribe" : null;
}

function waitsForRetry(seg: TranscriptSegment, now: number): number | null {
  if (seg.status !== "failed" || !seg.error) return null;
  if (PAUSING.has(seg.error) || PERMANENT.has(seg.error)) return null;
  return (seg.failedAt ? Date.parse(seg.failedAt) : 0) + backoffFor(seg.attempts) - now;
}

function isDue(seg: TranscriptSegment, force: boolean, now: number): boolean {
  const step = nextStep(seg);
  if (!step) return false;
  if (step === "transcribe" ? !getOpenAiKey() || (state.transcribePaused && !force) : !getApiKey() || (state.cleanPaused && !force)) {
    return false;
  }
  if (seg.status !== "failed" || force) return true;
  if (seg.error && (PAUSING.has(seg.error) || PERMANENT.has(seg.error))) return false;
  const wait = waitsForRetry(seg, now);
  return wait === null || wait <= 0;
}

/** The earliest moment a failed segment becomes due again, for the retry timer. */
function nextRetryAt(sessions: SessionTranscript[], now: number): number | null {
  let next: number | null = null;
  for (const t of sessions) {
    for (const seg of t.segments) {
      const wait = nextStep(seg) ? waitsForRetry(seg, now) : null;
      if (wait === null) continue;
      next = next === null ? now + wait : Math.min(next, now + wait);
    }
  }
  return next;
}

function scheduleRetry(at: number | null) {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  if (at === null) return;
  timer = window.setTimeout(() => {
    timer = null;
    kick();
  }, Math.max(1000, at - Date.now()));
}

async function fail(t: SessionTranscript, seg: TranscriptSegment, step: Step, err: unknown) {
  const code = codeOf(err, step);
  console.error("[session-transcriber] segment step failed", { sessionId: t.sessionId, index: seg.index, step, code });
  await updateSegment(t.sessionId, seg.index, {
    status: "failed",
    error: code,
    failedAt: new Date().toISOString(),
    attempts: seg.attempts + 1,
  });
  const patch: Partial<TranscriberState> = { lastError: code };
  if (PAUSING.has(code)) patch[step === "clean" ? "cleanPaused" : "transcribePaused"] = code;
  setState(patch);
}

async function transcribeSegment(t: SessionTranscript, seg: TranscriptSegment): Promise<TranscriptSegment | null> {
  const audio = seg.audio;
  if (!audio) return null;
  await updateSegment(t.sessionId, seg.index, { status: "transcribing" });
  setState({ busy: "transcribe" });
  try {
    const { text, model } = await transcribeAudio(audio, extensionForMime(seg.mimeType || audio.type), `session segment ${seg.index}`, {
      prompt: SESSION_PROMPT,
      fileBase: "sitzung",
    });
    // The audio is no longer needed; the raw text waits for the cleaning.
    const next = await updateSegment(t.sessionId, seg.index, {
      status: "cleaning",
      rawText: text,
      model,
      audio: undefined,
      error: undefined,
      failedAt: undefined,
      attempts: 0,
    });
    setState({ transcribePaused: null, lastError: null });
    return next?.segments.find((x) => x.index === seg.index) ?? null;
  } catch (err) {
    if (err instanceof TranscribeError && err.code === "empty") {
      // Silence (a break): nothing to transcribe, nothing to clean, nothing to retry.
      await updateSegment(t.sessionId, seg.index, {
        status: "done",
        text: "",
        removed: { privat: 0, unangemessen: 0 },
        audio: undefined,
        error: undefined,
        failedAt: undefined,
      });
      return null;
    }
    await fail(t, seg, "transcribe", err);
    return null;
  } finally {
    setState({ busy: null });
  }
}

async function cleanSegment(t: SessionTranscript, seg: TranscriptSegment): Promise<void> {
  const raw = seg.rawText;
  if (raw === undefined) return;
  await updateSegment(t.sessionId, seg.index, { status: "cleaning" });
  setState({ busy: "clean" });
  try {
    const { text, removed } = await cleanTranscript(raw, "session", `session segment ${seg.index}`);
    await updateSegment(t.sessionId, seg.index, {
      status: "done",
      text,
      removed,
      rawText: undefined,
      error: undefined,
      failedAt: undefined,
    });
    setState({ cleanPaused: null, lastError: null });
  } catch (err) {
    await fail(t, seg, "clean", err);
  } finally {
    setState({ busy: null });
  }
}

async function drain(): Promise<void> {
  const force = forceNext;
  forceNext = false;
  // Leftovers of a reload: nobody else holds the lock, so "transcribing" is stale.
  for (const t of await getAllSessionTranscripts()) {
    for (const seg of t.segments) {
      if (seg.status === "transcribing") await updateSegment(t.sessionId, seg.index, { status: "pending" });
    }
  }
  const tried = new Set<string>();
  for (;;) {
    if (!isSessionTranscribeEnabled()) return;
    if (!navigator.onLine) {
      setState({ offline: true });
      return;
    }
    setState({
      offline: false,
      transcribePaused: getOpenAiKey() ? state.transcribePaused : "no-key",
      cleanPaused: getApiKey() ? state.cleanPaused : "clean:no-key",
    });
    const now = Date.now();
    const sessions = await getAllSessionTranscripts();
    let picked: { t: SessionTranscript; seg: TranscriptSegment } | null = null;
    for (const t of sessions) {
      const seg = t.segments.find((x) => !tried.has(`${t.sessionId}#${x.index}`) && isDue(x, force, now));
      if (seg) {
        picked = { t, seg };
        break;
      }
    }
    if (!picked) {
      scheduleRetry(nextRetryAt(sessions, now));
      return;
    }
    tried.add(`${picked.t.sessionId}#${picked.seg.index}`);
    if (nextStep(picked.seg) === "transcribe") {
      const transcribed = await transcribeSegment(picked.t, picked.seg);
      // Straight on to the cleaning, so the raw text is stored as briefly as possible.
      if (transcribed && getApiKey() && !state.cleanPaused) await cleanSegment(picked.t, transcribed);
    } else {
      await cleanSegment(picked.t, picked.seg);
    }
  }
}

async function runQueue(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      if (locks) {
        // ifAvailable: another tab already works through the queue.
        await locks.request(LOCK, { ifAvailable: true }, async (lock) => {
          if (lock) await drain();
        });
      } else {
        await drain();
      }
    } while (again);
  } catch (err) {
    console.error("[session-transcriber] queue stopped", err);
  } finally {
    running = false;
  }
}

function kick() {
  void runQueue();
}

/** Manual "transcribe now / retry": lifts both pauses and ignores the back-off once. */
export function retrySessionTranscription() {
  forceNext = true;
  setState({ transcribePaused: null, cleanPaused: null });
  kick();
}

/**
 * Starts listening once per app load: new segments, a new key, the opt-in and
 * the connection coming back all look at the queue again.
 */
export function startSessionTranscriber() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("session-transcript-store-change", kick);
  window.addEventListener("online", () => {
    setState({ offline: false });
    kick();
  });
  window.addEventListener("offline", () => setState({ offline: true }));
  // A changed key may fix "auth"/"quota": give it a fresh try.
  window.addEventListener("openai-settings-change", () => {
    setState({ transcribePaused: null });
    forceNext = true;
    kick();
  });
  window.addEventListener("ai-settings-change", () => {
    setState({ cleanPaused: null });
    forceNext = true;
    kick();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "verbands-ceo.openai.v1") setState({ transcribePaused: null });
    if (e.key === "verbands-ceo.ai.v1") setState({ cleanPaused: null });
    if (e.key === "verbands-ceo.openai.v1" || e.key === "verbands-ceo.ai.v1" || e.key === OPT_KEY) kick();
  });
  window.addEventListener(OPT_EVENT, kick);
  kick();
}
