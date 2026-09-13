/**
 * Crash-proof storage for the session recording — IndexedDB, backend-free.
 *
 * The recorder used to keep its chunks in a `Blob[]` in memory and only built
 * the file when someone pressed stop. A crashed tab, a closed window or a
 * memory shortage during a two-day workshop destroyed the whole recording.
 * Here every chunk lands in IndexedDB the moment MediaRecorder hands it over,
 * so the worst case is the few seconds that were still in flight.
 *
 * Own database, deliberately separate from the interviews
 * (`interview-store.ts`, same style): a wiped or corrupted recording database
 * must never take the interview audio with it.
 *
 * IMPORTANT — how the chunks fit together:
 * The chunks of a MediaRecorder run are NOT individually playable. Only the
 * first one carries the container header (WebM/Matroska EBML head, or the MP4
 * init segment); every later chunk is a bare continuation of that byte stream.
 * So a file is always assembled as the unbroken chain starting at chunk 1. If
 * the tail is missing because the tab died, the result is still playable — just
 * cut short at the end. For the same reason there is deliberately NO rotation
 * into fresh recorder runs: restarting MediaRecorder drops audio at every seam.
 *
 * Nothing leaves the browser: no upload, no server.
 */

const DB_NAME = "verbands-ceo-recordings";
const DB_VERSION = 1;
const SESSIONS = "sessions";
const CHUNKS = "chunks";

export interface RecordingSession {
  /** ISO timestamp of the start — unique, sortable, and readable in the recovery offer. */
  id: string;
  startedAt: string;
  /** Container as reported by MediaRecorder, needed to reassemble a valid file. */
  mimeType: string;
  /** File extension matching the container, for the download name. */
  extension: string;
  /** false while the recorder is running — that is exactly what marks a crashed run. */
  closed: boolean;
  chunkCount: number;
  bytes: number;
  /** Recorded seconds as counted by the recorder (dictation pauses excluded). */
  seconds: number;
  updatedAt: string;
}

interface StoredChunk {
  sessionId: string;
  /** 1-based running number; the chain is always assembled from 1. */
  seq: number;
  blob: Blob;
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
      if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { keyPath: "id" });
      // Compound key [sessionId, seq]: getAll over a range returns the chunks
      // of one session already in recording order — no sorting needed.
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: ["sessionId", "seq"] });
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

function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        const req = run(t);
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error ?? new Error("IndexedDB transaction failed"));
        t.onabort = () => reject(t.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}

/**
 * All chunks of one session. `[id]` sorts before `[id, 0]` and `[id, []]` after
 * every `[id, <number>]`, because IndexedDB orders arrays after numbers.
 */
function rangeFor(sessionId: string): IDBKeyRange {
  return IDBKeyRange.bound([sessionId], [sessionId, []]);
}

/** True for the one failure that must stop the recording instead of being swallowed. */
export function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

// ---------------------------------------------------------------------------
// Writes

/** Header record for a fresh run, written before the first chunk can arrive. */
export async function beginSession(mimeType: string, extension: string): Promise<RecordingSession> {
  const startedAt = new Date().toISOString();
  const session: RecordingSession = {
    id: startedAt,
    startedAt,
    mimeType,
    extension,
    closed: false,
    chunkCount: 0,
    bytes: 0,
    seconds: 0,
    updatedAt: startedAt,
  };
  await tx([SESSIONS], "readwrite", (t) => t.objectStore(SESSIONS).put(session));
  return session;
}

/**
 * Stores one chunk plus the refreshed header in a single transaction: either
 * both land or neither, so the counters can never promise audio that is missing.
 * Rejects on QuotaExceededError — the caller must end the recording then.
 */
export async function appendChunk(
  session: RecordingSession,
  seq: number,
  blob: Blob,
  seconds: number,
): Promise<RecordingSession> {
  const next: RecordingSession = {
    ...session,
    chunkCount: seq,
    bytes: session.bytes + blob.size,
    seconds,
    updatedAt: new Date().toISOString(),
    // The container type is only reliable once data flows in some browsers.
    mimeType: session.mimeType || blob.type || "audio/webm",
  };
  const chunk: StoredChunk = { sessionId: session.id, seq, blob };
  await tx([CHUNKS, SESSIONS], "readwrite", (t) => {
    t.objectStore(CHUNKS).put(chunk);
    t.objectStore(SESSIONS).put(next);
  });
  return next;
}

/**
 * Marks a run as properly ended. The chunks stay until the file is downloaded
 * or discarded — stopping and reloading without saving must not lose the
 * recording — but a closed session is no longer offered as a crashed one.
 */
export async function closeSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  await tx([SESSIONS], "readwrite", (t) =>
    t.objectStore(SESSIONS).put({ ...session, closed: true, updatedAt: new Date().toISOString() }),
  );
}

/** Removes header and every chunk — only after a download or an explicit discard. */
export async function deleteSession(sessionId: string): Promise<void> {
  await tx([CHUNKS, SESSIONS], "readwrite", (t) => {
    t.objectStore(CHUNKS).delete(rangeFor(sessionId));
    t.objectStore(SESSIONS).delete(sessionId);
  });
}

// ---------------------------------------------------------------------------
// Reads

export async function getSession(sessionId: string): Promise<RecordingSession | undefined> {
  return tx<RecordingSession | undefined>([SESSIONS], "readonly", (t) =>
    t.objectStore(SESSIONS).get(sessionId) as IDBRequest<RecordingSession | undefined>,
  );
}

export async function countChunks(sessionId: string): Promise<number> {
  return (await tx<number>([CHUNKS], "readonly", (t) => t.objectStore(CHUNKS).count(rangeFor(sessionId)))) ?? 0;
}

/**
 * Builds the file from the stored chain, starting at chunk 1 — the same path
 * for a normal stop and for a recovery, so the recovery path is exercised on
 * every single stop instead of only after a crash.
 *
 * A gap would make everything after it unusable (see the header note), so the
 * chain is cut at the first missing number rather than glued over the hole.
 */
export async function assembleSession(
  sessionId: string,
): Promise<{ blob: Blob; session: RecordingSession } | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  const chunks = (await tx<StoredChunk[]>([CHUNKS], "readonly", (t) =>
    t.objectStore(CHUNKS).getAll(rangeFor(sessionId)) as IDBRequest<StoredChunk[]>,
  )) ?? [];
  const parts: Blob[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].seq !== i + 1) {
      console.error("[recording-store] chunk chain breaks", { sessionId, expected: i + 1, found: chunks[i].seq });
      break;
    }
    parts.push(chunks[i].blob);
  }
  if (!parts.length) return null;
  return { blob: new Blob(parts, { type: session.mimeType || "audio/webm" }), session };
}

/**
 * The newest run that was never closed properly — i.e. a crashed or closed tab.
 * `excludeId` keeps a currently running recording out of its own offer.
 */
export async function findAbandonedSession(excludeId?: string): Promise<RecordingSession | null> {
  const all = (await tx<RecordingSession[]>([SESSIONS], "readonly", (t) =>
    t.objectStore(SESSIONS).getAll() as IDBRequest<RecordingSession[]>,
  )) ?? [];
  const open = all
    .filter((s) => !s.closed && s.chunkCount > 0 && s.id !== excludeId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return open.length ? open[open.length - 1] : null;
}
