/**
 * Transcripts of the session recording — IndexedDB, backend-free.
 *
 * A session recording runs for hours; the OpenAI transcription endpoint takes
 * at most 25 MB and a few minutes per request. So the recorder cuts a parallel
 * run of short, individually playable segments (~5 minutes) that are
 * transcribed one by one while the workshop is going on. The main recording in
 * `recording-store.ts` stays one unbroken file; the segments only exist to be
 * transcribed and drop their audio once that worked.
 *
 * The full transcript of a session is simply its segments in order. It is a
 * stand-alone document (download, backup) and the source for assigning the
 * discussion to slides before the protocol is generated — those entries land in
 * the record under `<slideId>:${DISCUSSION_FIELD}` and are marked as coming from
 * the recorded discussion.
 *
 * Own database: a corrupted transcript store must never take the recordings or
 * the interviews with it. Transcript text is never logged.
 */
import { useSyncExternalStore } from "react";

const DB_NAME = "verbands-ceo-session-transcripts";
const DB_VERSION = 1;
const STORE = "sessions";
const EVENT = "session-transcript-store-change";
const CHANNEL = "verbands-ceo-session-transcripts";

/** Record field for discussion content assigned to a slide: entry id `<slideId>:mitschnitt`. */
export const DISCUSSION_FIELD = "mitschnitt";
/** Heading of those entries in the record and every export. */
export const DISCUSSION_PROMPT = "Aus der mitgeschnittenen Diskussion";

export type SegmentStatus = "pending" | "transcribing" | "done" | "failed";

/** Which slide was open from which second of the segment on — a hint for the assignment, not the assignment itself. */
export interface SlideMark {
  slideId: string;
  /** Seconds from the start of the session */
  atSec: number;
}

export interface TranscriptSegment {
  /** 0-based running number within the session */
  index: number;
  /** ISO timestamp (UTC) of the segment start */
  startedAt: string;
  /** Seconds from the start of the session */
  startSec: number;
  endSec: number;
  status: SegmentStatus;
  text?: string;
  model?: string;
  /** Error code of the last failed attempt (TranscribeErrorCode) */
  error?: string;
  attempts: number;
  /** Individually playable audio of this segment; removed once transcribed. */
  audio?: Blob;
  mimeType: string;
  slides: SlideMark[];
}

export interface SessionTranscript {
  /** Same id as the session in recording-store.ts (ISO start timestamp) */
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  segments: TranscriptSegment[];
  /** Set once the recording ended; until then more segments may follow. */
  closed: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "sessionId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  // A failed open (blocked storage, private mode) may succeed later.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error ?? new Error("IndexedDB transaction failed"));
        t.onabort = () => reject(t.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}

// ---------------------------------------------------------------------------
// Snapshot for useSyncExternalStore (reference-stable between reloads)

interface Snapshot {
  ready: boolean;
  error: string | null;
  /** Oldest session first */
  sessions: SessionTranscript[];
}

let snapshot: Snapshot = { ready: false, error: null, sessions: [] };
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let loading: Promise<void> | null = null;

function reload(): Promise<void> {
  loading = tx<SessionTranscript[]>("readonly", (s) => s.getAll() as IDBRequest<SessionTranscript[]>)
    .then((list) => {
      const sessions = (list ?? []).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      snapshot = { ready: true, error: null, sessions };
    })
    .catch((err: unknown) => {
      console.error("[session-transcript-store] load failed", err);
      snapshot = { ...snapshot, ready: true, error: err instanceof Error ? err.message : String(err) };
    })
    .finally(() => {
      loading = null;
      listeners.forEach((l) => l());
      window.dispatchEvent(new CustomEvent(EVENT));
    });
  return loading;
}

async function changed() {
  await reload();
  channel?.postMessage("changed");
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) {
    if (typeof BroadcastChannel !== "undefined" && !channel) {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => void reload();
    }
    if (!snapshot.ready && !loading) void reload();
  }
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => snapshot;

export function useSessionTranscripts(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---------------------------------------------------------------------------
// Reads

/** Straight from the database (audio included), independent of any subscriber. */
export async function getAllSessionTranscripts(): Promise<SessionTranscript[]> {
  const list = (await tx<SessionTranscript[]>("readonly", (s) => s.getAll() as IDBRequest<SessionTranscript[]>)) ?? [];
  return list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export async function getSessionTranscript(sessionId: string): Promise<SessionTranscript | undefined> {
  return tx<SessionTranscript | undefined>("readonly", (s) => s.get(sessionId) as IDBRequest<SessionTranscript | undefined>);
}

// ---------------------------------------------------------------------------
// Writes

/** Read-modify-write of one session in a single transaction; creates it when missing. */
async function modify(
  sessionId: string,
  change: (current: SessionTranscript | undefined) => SessionTranscript | undefined,
): Promise<SessionTranscript | undefined> {
  let result: SessionTranscript | undefined;
  await tx("readwrite", (s) => {
    const req = s.get(sessionId) as IDBRequest<SessionTranscript | undefined>;
    req.onsuccess = () => {
      result = change(req.result);
      if (result) s.put({ ...result, sessionId, updatedAt: new Date().toISOString() });
    };
  });
  await changed();
  return result;
}

/** Adds (or replaces) one segment; creates the session record on the first segment. */
export function putSegment(sessionId: string, startedAt: string, segment: TranscriptSegment): Promise<SessionTranscript | undefined> {
  return modify(sessionId, (current) => {
    const base: SessionTranscript = current ?? { sessionId, startedAt, updatedAt: "", segments: [], closed: false };
    const segments = base.segments.filter((x) => x.index !== segment.index).concat(segment).sort((a, b) => a.index - b.index);
    return { ...base, segments };
  });
}

/** Merges `patch` into one segment. `audio: undefined` in the patch removes the audio. */
export function updateSegment(
  sessionId: string,
  index: number,
  patch: Partial<Omit<TranscriptSegment, "index">>,
): Promise<SessionTranscript | undefined> {
  return modify(sessionId, (current) => {
    if (!current) return undefined;
    return { ...current, segments: current.segments.map((x) => (x.index === index ? { ...x, ...patch, index } : x)) };
  });
}

export function closeSessionTranscript(sessionId: string): Promise<SessionTranscript | undefined> {
  return modify(sessionId, (current) => (current ? { ...current, closed: true } : undefined));
}

export async function deleteSessionTranscript(sessionId: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(sessionId));
  await changed();
}

/** Reset and backup restore. */
export async function clearSessionTranscripts(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
  await changed();
}

// ---------------------------------------------------------------------------
// Derived text

/** "01:05:30" from seconds since the session start. */
export function formatOffset(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export interface TranscriptProgress {
  total: number;
  done: number;
  failed: number;
  open: number;
}

export function transcriptProgress(t: SessionTranscript): TranscriptProgress {
  const done = t.segments.filter((x) => x.status === "done").length;
  const failed = t.segments.filter((x) => x.status === "failed").length;
  return { total: t.segments.length, done, failed, open: t.segments.length - done - failed };
}

/**
 * The full transcript as plain text with a time mark per segment. Segments that
 * are not transcribed (yet) are named as gaps instead of silently missing.
 */
export function fullTranscriptText(t: SessionTranscript): string {
  return t.segments
    .map((x) => {
      const mark = `[${formatOffset(x.startSec)}]`;
      if (x.status === "done" && x.text?.trim()) return `${mark} ${x.text.trim()}`;
      return `${mark} (Abschnitt bis ${formatOffset(x.endSec)} noch nicht transkribiert)`;
    })
    .join("\n\n");
}
