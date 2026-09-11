/**
 * Interview store — backend-free, IndexedDB-backed.
 *
 * The short AI interviews of phase 1 are recorded or uploaded as audio, which
 * quickly exceeds the few MB localStorage allows. So audio blobs plus
 * transcript and opinion live in IndexedDB (one object store "interviews").
 * The small group opinion text stays in localStorage.
 *
 * Every device keeps its own data; a second laptop (side room) hands its
 * interviews over via JSON export/import.
 */
import { useSyncExternalStore } from "react";
import type { Bilingual } from "@/types/slide";

export type InterviewSource = "recorded" | "uploaded";

export interface QuestionMarker {
  /** 0-based index into the interview guide */
  question: number;
  /** Seconds since the recording started (pauses excluded) */
  atSec: number;
}

export interface InterviewError {
  stage: "transcribe" | "summarize";
  /** Stored in both languages so the language toggle also applies to past errors. */
  message: Bilingual;
}

export interface Interview {
  /** Short random id, also part of the protocol entry id */
  id: string;
  pseudonym: string;
  source: InterviewSource;
  createdAt: string;
  consentAt?: string;
  fileName: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  /** Absent after "delete all audio" or when imported without audio */
  audio?: Blob;
  markers: QuestionMarker[];
  transcript?: string;
  transcriptModel?: string;
  opinion?: string;
  opinionAt?: string;
  /** Opinion text + pseudonym as last written to the workshop protocol */
  protocolText?: string;
  protocolPseudonym?: string;
  error?: InterviewError;
}

const DB_NAME = "verbands-ceo-interviews";
const DB_VERSION = 1;
const STORE = "interviews";
const EVENT = "interview-store-change";
const CHANNEL = "verbands-ceo-interviews";

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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  // A failed open (e.g. blocked storage) may succeed later, so don't cache the rejection.
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
// Snapshot cache for useSyncExternalStore: the array reference only changes
// after a reload from IndexedDB, never between renders.

interface Snapshot {
  ready: boolean;
  error: string | null;
  interviews: Interview[];
}

let snapshot: Snapshot = { ready: false, error: null, interviews: [] };
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let loading: Promise<void> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function reload(): Promise<void> {
  loading = tx<Interview[]>("readonly", (s) => s.getAll() as IDBRequest<Interview[]>)
    .then((list) => {
      const interviews = (list ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      snapshot = { ready: true, error: null, interviews };
    })
    .catch((err: unknown) => {
      console.error("[interview-store] load failed", err);
      snapshot = { ...snapshot, ready: true, error: err instanceof Error ? err.message : String(err) };
    })
    .finally(() => {
      loading = null;
      emit();
      window.dispatchEvent(new CustomEvent(EVENT));
    });
  return loading;
}

/** Called after every write: refresh this tab and tell other tabs. */
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

export function useInterviews(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getInterview(id: string): Interview | undefined {
  return snapshot.interviews.find((i) => i.id === id);
}

// ---------------------------------------------------------------------------
// Writes

export function newInterviewId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveInterview(interview: Interview): Promise<void> {
  await tx("readwrite", (s) => s.put(interview));
  await changed();
}

/** Merges `patch` into the stored record (read-modify-write in one transaction). */
export async function updateInterview(id: string, patch: Partial<Interview>): Promise<Interview | undefined> {
  let updated: Interview | undefined;
  await tx("readwrite", (s) => {
    const req = s.get(id) as IDBRequest<Interview | undefined>;
    req.onsuccess = () => {
      if (!req.result) return;
      updated = { ...req.result, ...patch, id };
      s.put(updated);
    };
  });
  await changed();
  return updated;
}

export async function deleteInterview(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  await changed();
}

/** Removes every audio blob but keeps transcripts and opinions (data minimisation after the workshop). */
export async function deleteAllAudio(): Promise<number> {
  let count = 0;
  await tx("readwrite", (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const value = cursor.value as Interview;
      if (value.audio) {
        const { audio: _dropped, ...rest } = value;
        void _dropped;
        cursor.update(rest);
        count++;
      }
      cursor.continue();
    };
  });
  await changed();
  return count;
}

// ---------------------------------------------------------------------------
// Export / import (hand-over between the side-room laptop and the moderation laptop)

const EXPORT_FORMAT = "verbands-ceo-interviews";
const EXPORT_VERSION = 1;

interface ExportedInterview extends Omit<Interview, "audio" | "protocolText" | "protocolPseudonym" | "error"> {
  audio?: { mimeType: string; base64: string };
}

interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  interviews: ExportedInterview[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read audio"));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function exportInterviews(includeAudio: boolean): Promise<string> {
  const list = snapshot.ready ? snapshot.interviews : ((await tx<Interview[]>("readonly", (s) => s.getAll())) ?? []);
  const interviews: ExportedInterview[] = [];
  for (const iv of list) {
    // The protocol state belongs to this device's protocol, errors are transient.
    const { audio, protocolText: _p, protocolPseudonym: _pp, error: _e, ...rest } = iv;
    void _p;
    void _pp;
    void _e;
    const out: ExportedInterview = { ...rest };
    if (includeAudio && audio) out.audio = { mimeType: audio.type || iv.mimeType, base64: await blobToBase64(audio) };
    interviews.push(out);
  }
  const file: ExportFile = { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), interviews };
  return JSON.stringify(file, null, 2);
}

export class InterviewImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterviewImportError";
  }
}

const str = (v: unknown): v is string => typeof v === "string";
const optStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const optNum = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Validates one record from an untrusted file; returns null when it is unusable. */
function parseRecord(raw: unknown): Interview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!str(r.id) || !/^[a-z0-9-]{4,40}$/i.test(r.id) || !str(r.createdAt)) return null;
  const markers = Array.isArray(r.markers)
    ? r.markers.flatMap((m) => {
        const q = optNum((m as QuestionMarker)?.question);
        const at = optNum((m as QuestionMarker)?.atSec);
        return q === undefined || at === undefined ? [] : [{ question: q, atSec: at }];
      })
    : [];
  let audio: Blob | undefined;
  const a = r.audio as { mimeType?: unknown; base64?: unknown } | undefined;
  if (a && str(a.base64) && str(a.mimeType) && /^(audio|video)\//.test(a.mimeType)) {
    try {
      audio = base64ToBlob(a.base64, a.mimeType);
    } catch (err) {
      console.error("[interview-store] skipping corrupt audio in import", { id: r.id, err });
    }
  }
  return {
    id: r.id,
    pseudonym: optStr(r.pseudonym) ?? "Interview",
    source: r.source === "recorded" ? "recorded" : "uploaded",
    createdAt: r.createdAt,
    consentAt: optStr(r.consentAt),
    fileName: optStr(r.fileName) ?? `${r.id}.webm`,
    mimeType: optStr(r.mimeType) ?? audio?.type ?? "",
    size: optNum(r.size) ?? audio?.size ?? 0,
    durationSec: optNum(r.durationSec),
    audio,
    markers,
    transcript: optStr(r.transcript),
    transcriptModel: optStr(r.transcriptModel),
    opinion: optStr(r.opinion),
    opinionAt: optStr(r.opinionAt),
  };
}

export interface ImportResult {
  added: Interview[];
  skipped: number;
}

/** Merges interviews from an export file by id; existing ids are skipped, never overwritten. */
export async function importInterviews(text: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InterviewImportError("not-json");
  }
  const file = parsed as Partial<ExportFile>;
  if (!file || file.format !== EXPORT_FORMAT || !Array.isArray(file.interviews)) {
    throw new InterviewImportError("wrong-format");
  }
  const existing = new Set(
    snapshot.ready ? snapshot.interviews.map((i) => i.id) : ((await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) ?? []).map(String),
  );
  const added: Interview[] = [];
  let skipped = 0;
  for (const raw of file.interviews) {
    const rec = parseRecord(raw);
    if (!rec || existing.has(rec.id)) {
      skipped++;
      continue;
    }
    existing.add(rec.id);
    added.push(rec);
  }
  if (added.length) {
    await tx("readwrite", (s) => {
      added.forEach((rec) => s.put(rec));
    });
    await changed();
  }
  return { added, skipped };
}

// ---------------------------------------------------------------------------
// Group opinion (small text → localStorage, same snapshot pattern as workshop-store)

export interface GroupOpinion {
  text: string;
  updatedAt: string;
  /** Fingerprint of the interview opinions it was built from, to flag it as outdated. */
  basedOn: string;
  count: number;
  protocolText?: string;
}

const GROUP_KEY = "verbands-ceo.interviews.group.v1";
const GROUP_EVENT = "interview-group-change";
let groupRaw: string | null = null;
let groupCache: GroupOpinion | null = null;

export function getGroupOpinion(): GroupOpinion | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(GROUP_KEY);
  } catch {
    return null;
  }
  if (raw === groupRaw) return groupCache;
  groupRaw = raw;
  try {
    groupCache = raw ? (JSON.parse(raw) as GroupOpinion) : null;
  } catch {
    groupCache = null;
  }
  return groupCache;
}

/** Throws if the browser blocks storage. */
export function setGroupOpinion(value: GroupOpinion | null) {
  if (value) window.localStorage.setItem(GROUP_KEY, JSON.stringify(value));
  else window.localStorage.removeItem(GROUP_KEY);
  window.dispatchEvent(new CustomEvent(GROUP_EVENT));
}

function subscribeGroup(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === GROUP_KEY) cb();
  };
  window.addEventListener(GROUP_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GROUP_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useGroupOpinion(): GroupOpinion | null {
  return useSyncExternalStore(subscribeGroup, getGroupOpinion, () => null);
}

/** Stable fingerprint of all interview opinions that feed the group opinion. */
export function opinionFingerprint(interviews: Interview[]): string {
  return interviews
    .filter((i) => i.opinion?.trim())
    .map((i) => `${i.id}@${i.opinionAt ?? ""}`)
    .sort()
    .join("|");
}
