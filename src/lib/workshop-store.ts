/**
 * Workshop capture store — backend-free, localStorage-backed.
 *
 * Captures board decisions, votes, free-text annotations and checklist
 * answers per slide during the live workshop. The accumulated state is the
 * "Konzept-Delta" that the /konzept-neu skill turns into an adapted concept
 * PDF + updated slides (the "Composer" from the concept, demonstrated live).
 *
 * No personal data leaves the browser. Everything is local and deletable.
 */

export type CaptureKind = "text" | "decision" | "vote" | "checklist";

export interface CaptureEntry {
  /** Stable key, e.g. "01.05-engpaesse" */
  id: string;
  module: number;
  slideId: string;
  kind: CaptureKind;
  /** Human-readable German label, used as heading in the exported protocol */
  prompt: string;
  /** text/decision/vote → string · checklist → string[] */
  value: string | string[];
  updatedAt: string;
}

export interface WorkshopMeta {
  title: string;
  /** ISO date (yyyy-mm-dd) of the workshop session */
  date: string;
  participants: string;
}

interface WorkshopState {
  meta: WorkshopMeta;
  entries: Record<string, CaptureEntry>;
}

const KEY = "verbands-ceo.workshop.v1";
const EVENT = "workshop-store-change";

const DEFAULT_META: WorkshopMeta = {
  title: "Vorstands-Workshop — KI-augmentierter Verbands-CEO",
  date: "",
  participants: "",
};

// Snapshot cache — useSyncExternalStore requires referentially stable
// snapshots between renders when the underlying data has not changed.
// We key the cache on the raw localStorage string.
const EMPTY: WorkshopState = { meta: { ...DEFAULT_META }, entries: {} };
let cacheRaw: string | null = null;
let cacheState: WorkshopState = EMPTY;
let entriesCacheFor: WorkshopState | null = null;
let entriesCache: CaptureEntry[] = [];

function read(): WorkshopState {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY);
  if (raw === cacheRaw) return cacheState;
  cacheRaw = raw;
  if (!raw) {
    cacheState = EMPTY;
    return cacheState;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WorkshopState>;
    cacheState = {
      meta: { ...DEFAULT_META, ...(parsed.meta ?? {}) },
      entries: parsed.entries ?? {},
    };
  } catch {
    cacheState = EMPTY;
  }
  return cacheState;
}

function write(state: WorkshopState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getState(): WorkshopState {
  return read();
}

export function getMeta(): WorkshopMeta {
  return read().meta;
}

export function setMeta(patch: Partial<WorkshopMeta>) {
  const state = read();
  state.meta = { ...state.meta, ...patch };
  write(state);
}

export function getEntry(id: string): CaptureEntry | undefined {
  return read().entries[id];
}

export function setEntry(entry: Omit<CaptureEntry, "updatedAt">) {
  const state = read();
  state.entries[entry.id] = { ...entry, updatedAt: new Date().toISOString() };
  write(state);
}

export function removeEntry(id: string) {
  const state = read();
  delete state.entries[id];
  write(state);
}

export function getAllEntries(): CaptureEntry[] {
  const state = read();
  if (state === entriesCacheFor) return entriesCache;
  entriesCacheFor = state;
  entriesCache = Object.values(state.entries).sort((a, b) => a.id.localeCompare(b.id));
  return entriesCache;
}

export function entryCount(): number {
  return Object.keys(read().entries).length;
}

export function clearAll() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Subscribe to any store change (same tab + cross tab). Returns unsubscribe. */
export function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

function valueToText(v: CaptureEntry["value"]): string {
  return Array.isArray(v) ? v.join(", ") : v;
}

/** Structured Markdown protocol — input for the /konzept-neu regeneration skill. */
export function exportMarkdown(): string {
  const { meta, entries } = read();
  const list = Object.values(entries).sort((a, b) => a.id.localeCompare(b.id));
  const lines: string[] = [];
  lines.push(`# Workshop-Protokoll — ${meta.title}`, "");
  lines.push(`- **Datum:** ${meta.date || "—"}`);
  lines.push(`- **Teilnehmende:** ${meta.participants || "—"}`);
  lines.push(`- **Erfasste Beiträge:** ${list.length}`);
  lines.push(`- **Exportiert:** ${new Date().toISOString()}`, "");

  let currentModule = -1;
  for (const e of list) {
    if (e.module !== currentModule) {
      currentModule = e.module;
      lines.push("", `## Modul ${e.module === 99 ? "Anhang" : e.module}`, "");
    }
    lines.push(`### ${e.prompt}`);
    lines.push(`*(Folie ${e.slideId} · ${e.kind})*`, "");
    const val = valueToText(e.value).trim();
    lines.push(val ? val : "_(keine Eingabe)_", "");
  }
  return lines.join("\n");
}

export function exportJSON(): string {
  return JSON.stringify(read(), null, 2);
}

export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
