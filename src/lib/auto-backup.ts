/**
 * Automatic backups — nobody in the workshop should have to think about saving.
 *
 * Two layers on top of the manual backup file (backup.ts), both using exactly
 * its file format, so every automatic copy can be read back like a download:
 *
 * 1. Snapshots in the browser ("Zwischenstände"), own IndexedDB database. A
 *    reset of the workshop content never touches it. Taken
 *    - every 15 minutes, but only when the content differs from the newest
 *      snapshot (a content hash, computed once per check — never per keystroke),
 *    - when the page is hidden or left (best effort),
 *    - always before a destructive action (reset, restoring a file or a snapshot).
 * 2. Files on disk (Chrome/Edge, File System Access API): once a folder is
 *    chosen, every new snapshot is also written there with a sortable time
 *    stamp, plus one file per day including the interview recordings.
 *
 * Audio: regular snapshots carry no recordings. They would multiply the
 * interview audio (tens of MB, base64) into every quarter of an hour, and the
 * recordings do not change after they were made. The snapshots taken right
 * before a destructive action do carry them — that is the one moment the
 * recordings could actually be lost.
 *
 * Retention, deliberately small and explainable (see `planRetention`):
 * the newest 12 (≈ 3 hours), the first one of every hour of the last 48 hours,
 * the last one of each of the last 14 days, and the newest 5 taken before a
 * destructive action. Above 200 MB in total the oldest go first; the newest 3
 * and the newest safety snapshot are never removed.
 *
 * API keys and login are not part of backup.ts and therefore never in here.
 */
import { useSyncExternalStore } from "react";
import type { Bilingual, Lang } from "@/types/slide";
import {
  applyBackup,
  collectBackup,
  parseBackup,
  summarize,
  BackupError,
  type BackupFile,
  type BackupSummary,
} from "./backup";
import { downloadFile } from "./workshop-store";
import { getAllInterviews } from "./interview-store";

/* ------------------------------------------------------------------ tuning */

export const SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000;
const POLL_MS = 60 * 1000;
/** First comparison after the app starts — catches work from a session that ended without a snapshot. */
const START_CHECK_MS = 60 * 1000;
const HIDDEN_MIN_GAP_MS = 60 * 1000;

export const KEEP_RECENT = 12;
const HOURLY_WINDOW_MS = 48 * 60 * 60 * 1000;
const DAILY_DAYS = 14;
const KEEP_SAFETY = 5;
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const ALWAYS_KEEP = 3;

/* ------------------------------------------------------------------- types */

export type SnapshotReason = "auto" | "hidden" | "manual" | "before-reset" | "before-restore" | "before-snapshot";

export interface SnapshotMeta {
  /** createdAt plus a short random suffix — unique and sortable */
  id: string;
  createdAt: string;
  reason: SnapshotReason;
  /** Hash of the content without time stamp and audio — the change detection */
  hash: string;
  bytes: number;
  withAudio: boolean;
  summary: BackupSummary;
}

export type ProblemKind = "storage-full" | "storage" | "folder-permission" | "folder-missing" | "disk-full" | "folder-write";

export interface Problem {
  kind: ProblemKind;
  at: string;
}

export interface FolderStatus {
  name: string;
  permission: PermissionState | "unknown";
  lastFileName?: string;
  lastWriteAt?: string;
}

export interface AutoBackupStatus {
  ready: boolean;
  /** newest first */
  snapshots: SnapshotMeta[];
  /** true while a snapshot is being taken */
  busy: boolean;
  /** null = the browser cannot tell */
  persisted: boolean | null;
  storage: { usage: number; quota: number } | null;
  folderSupported: boolean;
  folder: FolderStatus | null;
  snapshotProblem: Problem | null;
  folderProblem: Problem | null;
}

/* File System Access API — not part of the TypeScript DOM typings yet. */
type PermissionDescriptorFs = { mode: "read" | "readwrite" };
interface PermissionAwareHandle {
  queryPermission?: (d: PermissionDescriptorFs) => Promise<PermissionState>;
  requestPermission?: (d: PermissionDescriptorFs) => Promise<PermissionState>;
}
type DirHandle = FileSystemDirectoryHandle & PermissionAwareHandle;
type DirectoryPicker = (opts?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<DirHandle>;

interface StoredFolder {
  handle: DirHandle;
  name: string;
}

interface FolderLog {
  lastFileName?: string;
  lastWriteAt?: string;
  /** hash of the snapshot last written, so a re-granted folder only gets what it is missing */
  lastHash?: string;
  /** local day (yyyy-mm-dd) and recording fingerprint of the day file with audio */
  audioDay?: string;
  audioFingerprint?: string;
}

/* ---------------------------------------------------------------- database */

const DB_NAME = "verbands-ceo-autobackup";
const DB_VERSION = 1;
const META = "snapshots";
const PAYLOAD = "payloads";
const SETTINGS = "settings";
const CHANNEL = "verbands-ceo-autobackup";
const LOCK = "verbands-ceo-autobackup";

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
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      // Payloads apart from the list: showing the list must not load every file.
      if (!db.objectStoreNames.contains(PAYLOAD)) db.createObjectStore(PAYLOAD, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  // A failed open (blocked storage) may succeed later.
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

async function readMetas(): Promise<SnapshotMeta[]> {
  const all = (await tx<SnapshotMeta[]>([META], "readonly", (t) => t.objectStore(META).getAll() as IDBRequest<SnapshotMeta[]>)) ?? [];
  return all.sort((a, b) => b.id.localeCompare(a.id));
}

async function readPayload(id: string): Promise<string | undefined> {
  const row = await tx<{ id: string; json: string } | undefined>([PAYLOAD], "readonly", (t) =>
    t.objectStore(PAYLOAD).get(id) as IDBRequest<{ id: string; json: string } | undefined>,
  );
  return row?.json;
}

async function putSnapshot(meta: SnapshotMeta, json: string): Promise<void> {
  await tx([META, PAYLOAD], "readwrite", (t) => {
    t.objectStore(PAYLOAD).put({ id: meta.id, json });
    t.objectStore(META).put(meta);
  });
}

async function removeSnapshots(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await tx([META, PAYLOAD], "readwrite", (t) => {
    for (const id of ids) {
      t.objectStore(META).delete(id);
      t.objectStore(PAYLOAD).delete(id);
    }
  });
}

async function readSetting<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>([SETTINGS], "readonly", (t) => t.objectStore(SETTINGS).get(key) as IDBRequest<T | undefined>);
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  await tx([SETTINGS], "readwrite", (t) => {
    if (value === undefined) t.objectStore(SETTINGS).delete(key);
    else t.objectStore(SETTINGS).put(value, key);
  });
}

/* ------------------------------------------------------------------- state */

const folderSupported = typeof window !== "undefined" && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

let status: AutoBackupStatus = {
  ready: false,
  snapshots: [],
  busy: false,
  persisted: null,
  storage: null,
  folderSupported,
  folder: null,
  snapshotProblem: null,
  folderProblem: null,
};
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function setStatus(patch: Partial<AutoBackupStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getStatus = () => status;

export function useAutoBackup(): AutoBackupStatus {
  return useSyncExternalStore(subscribe, getStatus, getStatus);
}

const now = () => new Date().toISOString();

function problem(kind: ProblemKind): Problem {
  return { kind, at: now() };
}

function isQuota(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

/* -------------------------------------------------------------- change key */

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** FNV-1a — only where crypto.subtle is missing (plain http on a LAN address). */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv-${(h >>> 0).toString(16)}-${text.length}`;
}

/** Content only: the time stamp and the recordings must not make an unchanged state look new. */
async function contentHash(file: BackupFile): Promise<string> {
  const interviews = file.interviews.map((iv) => {
    const { audio, ...rest } = iv;
    void audio;
    return rest;
  });
  const text = JSON.stringify({ stores: file.stores, interviews });
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
    } catch (err) {
      console.error("[auto-backup] SHA-256 unavailable, using the fallback hash", err);
    }
  }
  return fnv1a(text);
}

/** An empty device has nothing to lose — no snapshot of it. */
function hasContent(file: BackupFile, s: BackupSummary): boolean {
  const workshop = file.stores.workshop as { meta?: { participantsList?: unknown } } | undefined;
  const people = Array.isArray(workshop?.meta?.participantsList) && workshop.meta.participantsList.length > 0;
  const drafts = (file.stores.poster as { drafts?: Record<string, { image?: string } | undefined> } | undefined)?.drafts;
  const posterImage = Object.values(drafts ?? {}).some((d) => Boolean(d?.image));
  return (
    s.entries > 0 ||
    s.interviews > 0 ||
    s.posterFields > 0 ||
    s.glossaryTerms > 0 ||
    s.hasReport ||
    people ||
    posterImage ||
    file.stores.interviewsGroup !== undefined
  );
}

/* --------------------------------------------------------------- retention */

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hourKey = (d: Date) => `${dayKey(d)}T${pad(d.getHours())}`;
const isSafety = (m: SnapshotMeta) => m.reason.startsWith("before-");

/**
 * Which snapshots to delete. `list` newest first. Local time, because
 * "each hour" and "each day" mean the wall clock of the workshop room.
 */
export function planRetention(list: SnapshotMeta[], at = Date.now()): string[] {
  const keep = new Set<string>();
  list.slice(0, KEEP_RECENT).forEach((m) => keep.add(m.id));
  list.filter(isSafety).slice(0, KEEP_SAFETY).forEach((m) => keep.add(m.id));

  const hours = new Set<string>();
  for (const m of [...list].reverse()) {
    const d = new Date(m.createdAt);
    if (at - d.getTime() > HOURLY_WINDOW_MS) continue;
    const key = hourKey(d);
    if (hours.has(key)) continue;
    hours.add(key);
    keep.add(m.id);
  }

  const days = new Set<string>();
  for (const m of list) {
    const key = dayKey(new Date(m.createdAt));
    if (days.has(key)) continue;
    days.add(key);
    if (days.size <= DAILY_DAYS) keep.add(m.id);
  }

  // Size cap: oldest first, never the newest few and never the newest safety net.
  const protectedIds = new Set(list.slice(0, ALWAYS_KEEP).map((m) => m.id));
  const newestSafety = list.find(isSafety);
  if (newestSafety) protectedIds.add(newestSafety.id);
  const kept = list.filter((m) => keep.has(m.id));
  let total = kept.reduce((n, m) => n + m.bytes, 0);
  for (let i = kept.length - 1; i >= 0 && total > MAX_TOTAL_BYTES; i--) {
    if (protectedIds.has(kept[i].id)) continue;
    keep.delete(kept[i].id);
    total -= kept[i].bytes;
  }

  return list.filter((m) => !keep.has(m.id)).map((m) => m.id);
}

/* ------------------------------------------------------------------ helpers */

async function withLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  // Two open tabs must not both take the same snapshot.
  if (locks?.request) return locks.request(LOCK, run) as Promise<T>;
  return run();
}

async function refreshList(): Promise<void> {
  try {
    const snapshots = await readMetas();
    setStatus({ snapshots, ready: true });
  } catch (err) {
    console.error("[auto-backup] reading the snapshot list failed", err);
    setStatus({ ready: true, snapshotProblem: problem("storage") });
  }
}

export async function refreshStorageInfo(): Promise<void> {
  try {
    if (!navigator.storage?.estimate) return;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    setStatus({ storage: { usage, quota } });
  } catch (err) {
    console.error("[auto-backup] storage estimate failed", err);
  }
}

function announce() {
  try {
    channel?.postMessage("changed");
  } catch (err) {
    console.error("[auto-backup] could not notify other tabs", err);
  }
}

/** `fbs-workshop-2026-09-16_10-45.json` — local wall-clock time, sorts by name. */
export function snapshotFileName(date: Date, suffix = ""): string {
  return `fbs-workshop-${dayKey(date)}_${pad(date.getHours())}-${pad(date.getMinutes())}${suffix}.json`;
}

/* ----------------------------------------------------------------- snapshot */

export interface SnapshotOptions {
  includeAudio?: boolean;
  /** take it even when the newest snapshot has the same content */
  force?: boolean;
}

/**
 * Takes a snapshot when there is something new. Returns null for "nothing to
 * save" (empty device or unchanged content). Throws when storing fails — the
 * status carries a readable problem as well.
 */
export async function createSnapshot(reason: SnapshotReason, { includeAudio = false, force = false }: SnapshotOptions = {}): Promise<SnapshotMeta | null> {
  return withLock(async () => {
    setStatus({ busy: true });
    try {
      const file = await collectBackup({ includeAudio });
      const summary = summarize(file);
      if (!hasContent(file, summary)) return null;
      const hash = await contentHash(file);
      const newest = (await readMetas())[0];
      if (!force && newest && newest.hash === hash) return null;

      const json = JSON.stringify(file);
      const createdAt = file.createdAt;
      const meta: SnapshotMeta = {
        id: `${createdAt}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt,
        reason,
        hash,
        bytes: new Blob([json]).size,
        withAudio: includeAudio && file.interviews.some((iv) => Boolean(iv.audio)),
        summary: { ...summary, withAudio: includeAudio && summary.withAudio },
      };

      await storeWithRoom(meta, json);
      try {
        await removeSnapshots(planRetention(await readMetas()));
      } catch (err) {
        console.error("[auto-backup] cleaning up old snapshots failed", err);
      }
      await refreshList();
      setStatus({ snapshotProblem: null });
      announce();
      void refreshStorageInfo();
      void writeSnapshotToFolder(meta, json);
      return meta;
    } catch (err) {
      console.error("[auto-backup] snapshot failed", { reason, includeAudio, err });
      setStatus({ snapshotProblem: problem(isQuota(err) ? "storage-full" : "storage") });
      throw err;
    } finally {
      setStatus({ busy: false });
    }
  });
}

/**
 * Stores the snapshot; on a full storage it gives up the oldest unprotected
 * snapshots one by one — a fresh state is worth more than an old one. A
 * snapshot with audio never pushes others out: it fails and the caller falls
 * back to one without audio.
 */
async function storeWithRoom(meta: SnapshotMeta, json: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await putSnapshot(meta, json);
      return;
    } catch (err) {
      if (!isQuota(err) || meta.withAudio || attempt > 50) throw err;
      const list = await readMetas();
      const candidates = list.slice(ALWAYS_KEEP).filter((m) => m !== list.find(isSafety));
      const oldest = candidates[candidates.length - 1];
      if (!oldest) throw err;
      console.error("[auto-backup] storage full, dropping the oldest snapshot", { id: oldest.id });
      await removeSnapshots([oldest.id]);
    }
  }
}

/**
 * The safety net before anything replaces or deletes content: with recordings
 * if possible, without them if the storage cannot take that. Throws only when
 * not even the light version could be stored — the caller must then not delete.
 */
export async function safeguardBefore(reason: Extract<SnapshotReason, `before-${string}`>): Promise<SnapshotMeta | null> {
  try {
    return await createSnapshot(reason, { includeAudio: true, force: true });
  } catch (err) {
    console.error("[auto-backup] safety snapshot with recordings failed, retrying without", { reason, err });
    return createSnapshot(reason, { includeAudio: false, force: true });
  }
}

/** Replaces the current content with a snapshot — after saving the current state first. */
export async function restoreSnapshot(id: string): Promise<BackupSummary> {
  const json = await readPayload(id);
  if (!json) throw new BackupError("unknown", `snapshot ${id} has no payload`);
  const file = parseBackup(json);
  await safeguardBefore("before-snapshot");
  return applyBackup(file);
}

export async function downloadSnapshot(id: string): Promise<string> {
  const meta = status.snapshots.find((m) => m.id === id);
  const json = await readPayload(id);
  if (!meta || !json) throw new BackupError("unknown", `snapshot ${id} not found`);
  const name = snapshotFileName(new Date(meta.createdAt), meta.withAudio ? "_mit-audio" : "");
  downloadFile(name, json, "application/json");
  return name;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await removeSnapshots([id]);
  await refreshList();
  announce();
  void refreshStorageInfo();
}

export async function deleteAllSnapshots(): Promise<void> {
  await removeSnapshots((await readMetas()).map((m) => m.id));
  await refreshList();
  announce();
  void refreshStorageInfo();
}

/** Reads a stored snapshot as backup file (for tests and previews). */
export async function readSnapshotFile(id: string): Promise<BackupFile | null> {
  const json = await readPayload(id);
  return json ? parseBackup(json) : null;
}

/* ------------------------------------------------------------------ folder */

async function loadFolder(): Promise<StoredFolder | undefined> {
  try {
    return await readSetting<StoredFolder>("folder");
  } catch (err) {
    console.error("[auto-backup] reading the folder setting failed", err);
    return undefined;
  }
}

async function queryPermission(handle: DirHandle): Promise<PermissionState | "unknown"> {
  if (!handle.queryPermission) return "unknown";
  try {
    return await handle.queryPermission({ mode: "readwrite" });
  } catch (err) {
    console.error("[auto-backup] querying the folder permission failed", err);
    return "unknown";
  }
}

async function publishFolder(stored: StoredFolder | undefined): Promise<PermissionState | "unknown" | null> {
  if (!stored) {
    setStatus({ folder: null });
    return null;
  }
  const permission = await queryPermission(stored.handle);
  let log: FolderLog = {};
  try {
    log = (await readSetting<FolderLog>("folder-log")) ?? {};
  } catch (err) {
    console.error("[auto-backup] reading the folder log failed", err);
  }
  setStatus({
    folder: { name: stored.name, permission, lastFileName: log.lastFileName, lastWriteAt: log.lastWriteAt },
  });
  return permission;
}

function folderProblemFor(err: unknown): ProblemKind {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "folder-permission";
  if (name === "NotFoundError" || name === "InvalidStateError") return "folder-missing";
  if (isQuota(err)) return "disk-full";
  return "folder-write";
}

async function exists(dir: DirHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (err) {
    if (err instanceof DOMException && (err.name === "NotFoundError" || err.name === "TypeMismatchError")) return false;
    throw err;
  }
}

/** Old files are never overwritten: a second file in the same minute gets the seconds. */
async function freeName(dir: DirHandle, date: Date, suffix: string): Promise<string> {
  const base = snapshotFileName(date, suffix);
  if (!(await exists(dir, base))) return base;
  for (let i = 0; i < 100; i++) {
    const name = base.replace(/\.json$/, `-${pad(date.getSeconds())}${i ? `-${i + 1}` : ""}.json`);
    if (!(await exists(dir, name))) return name;
  }
  return base.replace(/\.json$/, `-${Date.now()}.json`);
}

/** createWritable writes into a swap file and swaps on close — a crash leaves no half file. */
async function writeFile(dir: DirHandle, name: string, content: string): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  try {
    await w.write(content);
    await w.close();
  } catch (err) {
    await w.abort().catch((abortErr: unknown) => console.error("[auto-backup] aborting the file write failed", abortErr));
    throw err;
  }
}

async function recordingFingerprint(): Promise<string> {
  const list = await getAllInterviews();
  return list
    .filter((iv) => iv.audio)
    .map((iv) => `${iv.id}:${iv.audio?.size ?? 0}`)
    .sort()
    .join("|");
}

/**
 * One file per day with the recordings, named after the day. It is refreshed
 * when recordings were added or changed that day, so it always holds the day's
 * interviews; the time-stamped files next to it are never touched.
 */
async function writeDayAudio(dir: DirHandle, log: FolderLog): Promise<FolderLog> {
  const fingerprint = await recordingFingerprint();
  if (!fingerprint) return log;
  const today = dayKey(new Date());
  if (log.audioDay === today && log.audioFingerprint === fingerprint) return log;
  const file = await collectBackup({ includeAudio: true });
  const name = `fbs-workshop-${today}_mit-audio.json`;
  await writeFile(dir, name, JSON.stringify(file));
  return { ...log, audioDay: today, audioFingerprint: fingerprint };
}

let folderQueue: Promise<void> = Promise.resolve();

/** Serialised: two snapshots in quick succession must not race for the same file name. */
function writeSnapshotToFolder(meta: SnapshotMeta, json: string): Promise<void> {
  folderQueue = folderQueue.then(() => doWriteToFolder(meta, json));
  return folderQueue;
}

async function doWriteToFolder(meta: SnapshotMeta, json: string): Promise<void> {
  const stored = await loadFolder();
  if (!stored) return;
  const permission = await publishFolder(stored);
  // Without permission the hint asks for a click; the snapshot is safe in the browser meanwhile.
  if (permission !== "granted" && permission !== "unknown") return;
  try {
    let log = (await readSetting<FolderLog>("folder-log")) ?? {};
    if (log.lastHash !== meta.hash || meta.withAudio) {
      const name = await freeName(stored.handle, new Date(meta.createdAt), meta.withAudio ? "_mit-audio" : "");
      await writeFile(stored.handle, name, json);
      log = { ...log, lastFileName: name, lastWriteAt: now(), lastHash: meta.hash };
    }
    log = await writeDayAudio(stored.handle, log);
    await writeSetting("folder-log", log);
    setStatus({ folderProblem: null });
    await publishFolder(stored);
  } catch (err) {
    const kind = folderProblemFor(err);
    console.error("[auto-backup] writing to the backup folder failed", { folder: stored.name, snapshot: meta.id, kind, err });
    setStatus({ folderProblem: problem(kind) });
    await publishFolder(stored);
  }
}

/** Writes the newest snapshot if the folder does not have it yet (after connecting or re-granting). */
async function syncFolder(): Promise<void> {
  const newest = (await readMetas())[0];
  if (!newest) {
    // Nothing stored yet — take one now, which writes itself to the folder.
    await createSnapshot("manual").catch((err: unknown) => console.error("[auto-backup] first snapshot for the folder failed", err));
    return;
  }
  const json = await readPayload(newest.id);
  if (json) await writeSnapshotToFolder(newest, json);
}

/** Opens the folder picker. false = the user cancelled. */
export async function chooseFolder(): Promise<boolean> {
  const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  if (!picker) return false;
  let handle: DirHandle;
  try {
    handle = await picker({ id: "fbs-workshop-sicherung", mode: "readwrite", startIn: "documents" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    console.error("[auto-backup] choosing the folder failed", err);
    setStatus({ folderProblem: problem(folderProblemFor(err)) });
    throw err;
  }
  if (handle.requestPermission) {
    const granted = await handle.requestPermission({ mode: "readwrite" });
    if (granted !== "granted") {
      setStatus({ folderProblem: problem("folder-permission") });
      return false;
    }
  }
  const stored: StoredFolder = { handle, name: handle.name };
  await writeSetting("folder", stored);
  // A new folder starts its own log, so it receives the current state right away.
  await writeSetting("folder-log", {});
  setStatus({ folderProblem: null });
  await publishFolder(stored);
  await syncFolder();
  return true;
}

/** Must run inside a click: Chrome asks again after every browser restart. */
export async function regrantFolder(): Promise<boolean> {
  const stored = await loadFolder();
  if (!stored?.handle.requestPermission) return false;
  let result: PermissionState;
  try {
    result = await stored.handle.requestPermission({ mode: "readwrite" });
  } catch (err) {
    console.error("[auto-backup] re-granting the folder failed", err);
    setStatus({ folderProblem: problem(folderProblemFor(err)) });
    return false;
  }
  await publishFolder(stored);
  if (result !== "granted") return false;
  setStatus({ folderProblem: null });
  await syncFolder();
  return true;
}

export async function disconnectFolder(): Promise<void> {
  await writeSetting("folder", undefined);
  await writeSetting("folder-log", undefined);
  setStatus({ folder: null, folderProblem: null });
}

/* ------------------------------------------------------------- persistence */

const PERSIST_KEY = "verbands-ceo.autobackup.persist.v1";

/** Asks the browser not to evict this site's data under storage pressure. */
export async function requestPersistence(): Promise<boolean | null> {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.persisted) {
    setStatus({ persisted: null });
    return null;
  }
  try {
    let persisted = await storage.persisted();
    if (!persisted && storage.persist) persisted = await storage.persist();
    setStatus({ persisted });
    try {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify({ persisted, checkedAt: now() }));
    } catch (err) {
      console.error("[auto-backup] remembering the persistence status failed", err);
    }
    return persisted;
  } catch (err) {
    console.error("[auto-backup] requesting persistent storage failed", err);
    setStatus({ persisted: null });
    return null;
  }
}

/* ------------------------------------------------------------------ engine */

let started = false;
let lastCheckAt = 0;
let lastHiddenAt = 0;

function check(reason: SnapshotReason) {
  lastCheckAt = Date.now();
  createSnapshot(reason).catch(() => {
    // Already logged and published as a problem by createSnapshot.
  });
}

/**
 * Starts the automatic snapshots for this tab. Idempotent — safe under React
 * StrictMode and when mounted more than once. Runs for the lifetime of the app.
 */
export function startAutoBackup(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  lastCheckAt = Date.now();

  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => void refreshList();
  }

  void refreshList();
  void requestPersistence();
  void refreshStorageInfo();
  void loadFolder().then(publishFolder);

  window.setTimeout(() => check("auto"), START_CHECK_MS);
  // Polling the clock instead of one long interval: a sleeping laptop or a
  // throttled background tab catches up on the next minute.
  window.setInterval(() => {
    if (Date.now() - lastCheckAt >= SNAPSHOT_INTERVAL_MS) check("auto");
  }, POLL_MS);

  const onLeave = () => {
    if (Date.now() - lastHiddenAt < HIDDEN_MIN_GAP_MS) return;
    lastHiddenAt = Date.now();
    check("hidden");
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onLeave();
    // Back in the tab: Chrome may have revoked the folder permission meanwhile.
    else void loadFolder().then(publishFolder);
  });
  window.addEventListener("pagehide", onLeave);
}

/* ------------------------------------------------------------------- texts */

const PROBLEM_TEXT: Record<ProblemKind, Bilingual> = {
  "storage-full": {
    de: "Der Browser-Speicher ist voll: Es kann kein Zwischenstand mehr angelegt werden. Bitte jetzt eine Sicherung herunterladen und alte Zwischenstände löschen.",
    en: "Browser storage is full: no more snapshots can be taken. Please download a backup now and delete old snapshots.",
  },
  storage: {
    de: "Der Zwischenstand konnte nicht im Browser gespeichert werden. Bitte eine Sicherung herunterladen.",
    en: "The snapshot could not be stored in the browser. Please download a backup.",
  },
  "folder-permission": {
    de: "Die App darf gerade nicht in den Sicherungsordner schreiben. Bitte den Ordner wieder freigeben.",
    en: "The app may not write to the backup folder right now. Please grant access to the folder again.",
  },
  "folder-missing": {
    de: "Der Sicherungsordner ist nicht mehr erreichbar (verschoben, gelöscht oder USB-Stick abgezogen?). Bitte den Ordner neu wählen.",
    en: "The backup folder can no longer be reached (moved, deleted or USB stick removed?). Please choose the folder again.",
  },
  "disk-full": {
    de: "Auf dem Laufwerk des Sicherungsordners ist kein Platz mehr. Bitte Platz schaffen oder einen anderen Ordner wählen.",
    en: "The drive of the backup folder is full. Please free up space or choose another folder.",
  },
  "folder-write": {
    de: "Die Sicherungsdatei konnte nicht in den Ordner geschrieben werden. Die Zwischenstände im Browser laufen weiter.",
    en: "The backup file could not be written to the folder. Snapshots in the browser continue.",
  },
};

export function describeProblem(p: Problem, lang: Lang): string {
  return PROBLEM_TEXT[p.kind][lang];
}

export const REASON_LABEL: Record<SnapshotReason, Bilingual> = {
  auto: { de: "automatisch", en: "automatic" },
  hidden: { de: "beim Verlassen der Seite", en: "when leaving the page" },
  manual: { de: "von Hand", en: "manual" },
  "before-reset": { de: "vor dem Zurücksetzen", en: "before the reset" },
  "before-restore": { de: "vor dem Einlesen einer Datei", en: "before restoring a file" },
  "before-snapshot": { de: "vor dem Wiederherstellen", en: "before restoring a snapshot" },
};
