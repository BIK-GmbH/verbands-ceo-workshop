/**
 * Workshop capture store — backend-free, localStorage-backed.
 *
 * Captures board decisions, votes, free-text annotations and checklist
 * answers per slide during the live workshop. The accumulated state is the
 * "Konzept-Delta" that the /konzept-neu skill turns into an adapted concept
 * PDF + updated slides (the "Composer" from the concept, demonstrated live).
 *
 * Everything is stored locally and deletable. Text only leaves the browser when
 * the facilitator opts into the AI assistant (see ai-assist.ts).
 */

import { formatCardLine } from "./cards";

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
  /** The originally dictated/typed text, kept once the AI assistant rewrote `value`. */
  raw?: string;
  updatedAt: string;
}

export interface Participant {
  /** Stable, locally generated key (never shown, survives reordering/edits). */
  id: string;
  lastName: string;
  firstName: string;
  organisation: string;
  role: string;
}

export interface WorkshopMeta {
  title: string;
  /** ISO date (yyyy-mm-dd) of the workshop session */
  date: string;
  /**
   * Legacy free-text participants field. Kept for older data: the UI offers to
   * split it into `participantsList`, and exports fall back to it while the
   * list is empty.
   */
  participants: string;
  /** Structured participant list (captured on slide 00.02 and in /protokoll). */
  participantsList: Participant[];
}

interface WorkshopState {
  meta: WorkshopMeta;
  entries: Record<string, CaptureEntry>;
}

const KEY = "verbands-ceo.workshop.v1";
const EVENT = "workshop-store-change";

const DEFAULT_META: WorkshopMeta = {
  title: "KI-Geschäftsführer: Fiktion oder Realität?",
  date: "",
  participants: "",
  participantsList: [],
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Tolerates missing/corrupt lists from older versions or hand-edited JSON. */
function sanitizeParticipants(v: unknown): Participant[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p, i) => ({
      id: str(p.id) || `p-import-${i}`,
      lastName: str(p.lastName),
      firstName: str(p.firstName),
      organisation: str(p.organisation),
      role: str(p.role),
    }));
}

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
    const meta = (parsed.meta ?? {}) as Partial<Record<keyof WorkshopMeta, unknown>>;
    cacheState = {
      meta: {
        ...DEFAULT_META,
        ...(parsed.meta ?? {}),
        participants: str(meta.participants),
        participantsList: sanitizeParticipants(meta.participantsList),
      },
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

/* ------------------------------------------------------------ participants */

function newParticipantId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `p-${Date.now().toString(36)}-${rand}`;
}

/** True when at least one field of the person is filled in. */
export function isFilledParticipant(p: Participant): boolean {
  return Boolean(p.lastName.trim() || p.firstName.trim() || p.organisation.trim() || p.role.trim());
}

/** Rows with content — blank rows (just added, never typed into) are ignored in counts and exports. */
export function filledParticipants(list: Participant[]): Participant[] {
  return list.filter(isFilledParticipant);
}

/** Appends a person and returns it (the UI focuses the new row by id). */
export function addParticipant(fields: Partial<Omit<Participant, "id">> = {}): Participant {
  const p: Participant = { id: newParticipantId(), lastName: "", firstName: "", organisation: "", role: "", ...fields };
  setMeta({ participantsList: [...read().meta.participantsList, p] });
  return p;
}

export function updateParticipant(id: string, patch: Partial<Omit<Participant, "id">>) {
  setMeta({
    participantsList: read().meta.participantsList.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function removeParticipant(id: string) {
  setMeta({ participantsList: read().meta.participantsList.filter((p) => p.id !== id) });
}

/**
 * Naive split of the legacy free-text field into list rows: one person per
 * comma/semicolon/line; the last word becomes the last name, the rest the
 * first name. Meant as a starting point the facilitator corrects by hand.
 */
export function importLegacyParticipants() {
  const pieces = read()
    .meta.participants.split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const imported: Participant[] = pieces.map((piece) => {
    const words = piece.split(/\s+/);
    const lastName = words.pop() ?? "";
    return { id: newParticipantId(), lastName, firstName: words.join(" "), organisation: "", role: "" };
  });
  setMeta({ participantsList: [...read().meta.participantsList, ...imported] });
}

/* ----------------------------------------------------------------- entries */

export function getEntry(id: string): CaptureEntry | undefined {
  return read().entries[id];
}

export function setEntry(entry: Omit<CaptureEntry, "updatedAt">) {
  const state = read();
  // Slide inputs don't know about `raw`; keep it so the original stays restorable.
  const raw = entry.raw ?? state.entries[entry.id]?.raw;
  state.entries[entry.id] = { ...entry, raw, updatedAt: new Date().toISOString() };
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
  return Array.isArray(v) ? v.map(formatCardLine).join(", ") : v;
}

/** Structured Markdown protocol — input for the /konzept-neu regeneration skill. */
export function exportMarkdown(): string {
  const { meta, entries } = read();
  const list = Object.values(entries).sort((a, b) => a.id.localeCompare(b.id));
  const lines: string[] = [];
  lines.push(`# Workshop-Protokoll — ${meta.title}`, "");
  const people = filledParticipants(meta.participantsList);
  lines.push(`- **Datum:** ${meta.date || "—"}`);
  lines.push(`- **Teilnehmende:** ${people.length ? people.length : meta.participants || "—"}`);
  lines.push(`- **Erfasste Beiträge:** ${list.length}`);
  lines.push(`- **Exportiert:** ${new Date().toISOString()}`, "");

  if (people.length) {
    const cell = (s: string) => s.trim().replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ") || "—";
    lines.push("## Teilnehmende", "", "| Name | Vorname | Organisation | Rolle |", "|---|---|---|---|");
    for (const p of people) {
      lines.push(`| ${cell(p.lastName)} | ${cell(p.firstName)} | ${cell(p.organisation)} | ${cell(p.role)} |`);
    }
    lines.push("");
  }

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
