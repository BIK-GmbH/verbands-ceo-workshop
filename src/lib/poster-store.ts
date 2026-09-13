/**
 * Poster version ("Posterfassung") — backend-free, localStorage-backed.
 *
 * The poster shows condensed or hand-edited wording that must NOT overwrite the
 * workshop record, so it lives in its own key. Per poster we keep field overrides
 * (entry id → text) and an optional image; plus the last print settings.
 */
import { useSyncExternalStore } from "react";
import { PAPER_MM, type Orientation, type PaperFormat, type PosterKey } from "@/lib/posters";

export interface PosterDraft {
  /** entry id → poster wording. Present (even "") means "use this instead of the record". */
  fields: Record<string, string>;
  /** JPEG data URL (Zielbild poster). */
  image?: string;
  updatedAt: string;
}

export interface PosterPrefs {
  format: PaperFormat;
  orientation: Orientation;
}

export interface PosterState {
  drafts: Partial<Record<PosterKey, PosterDraft>>;
  prefs: PosterPrefs;
}

const KEY = "verbands-ceo.poster.v1";
const EVENT = "poster-store-change";

/** Storage key of the poster version — the backup (backup.ts) reads and restores it. */
export const POSTER_KEY = KEY;
const DEFAULT_PREFS: PosterPrefs = { format: "A3", orientation: "portrait" };
const EMPTY: PosterState = { drafts: {}, prefs: DEFAULT_PREFS };

// useSyncExternalStore needs referentially stable snapshots: cache on the raw string.
let cacheRaw: string | null = null;
let cacheState: PosterState = EMPTY;

function read(): PosterState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private mode / policy): behave like "no poster version yet".
    return EMPTY;
  }
  if (raw === cacheRaw) return cacheState;
  cacheRaw = raw;
  if (!raw) {
    cacheState = EMPTY;
    return cacheState;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PosterState>;
    cacheState = { drafts: parsed.drafts ?? {}, prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) } };
  } catch {
    cacheState = EMPTY;
  }
  return cacheState;
}

/** Throws if the browser refuses to store (e.g. quota exceeded by a large image). */
function write(state: PosterState) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

function updateDraft(key: PosterKey, patch: (d: PosterDraft) => PosterDraft) {
  const state = read();
  const current = state.drafts[key] ?? { fields: {}, updatedAt: "" };
  const next = { ...patch({ ...current, fields: { ...current.fields } }), updatedAt: new Date().toISOString() };
  write({ ...state, drafts: { ...state.drafts, [key]: next } });
}

export function setPosterField(key: PosterKey, entryId: string, value: string) {
  updateDraft(key, (d) => ({ ...d, fields: { ...d.fields, [entryId]: value } }));
}

export function setPosterFields(key: PosterKey, values: Record<string, string>) {
  updateDraft(key, (d) => ({ ...d, fields: { ...d.fields, ...values } }));
}

export function setPosterImage(key: PosterKey, image: string | undefined) {
  updateDraft(key, (d) => ({ ...d, image }));
}

/** Drops the poster wording (not the image) so the poster shows the record again. */
export function resetPosterFields(key: PosterKey) {
  updateDraft(key, (d) => ({ ...d, fields: {} }));
}

export function setPosterPrefs(patch: Partial<PosterPrefs>) {
  const state = read();
  write({ ...state, prefs: { ...state.prefs, ...patch } });
}

/** Tolerates hand-edited or foreign JSON: only string fields and a string image survive. */
function sanitizeDrafts(raw: unknown): PosterState["drafts"] {
  if (typeof raw !== "object" || raw === null) return {};
  const out: PosterState["drafts"] = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const d = value as Record<string, unknown>;
    const fields: Record<string, string> = {};
    if (typeof d.fields === "object" && d.fields !== null) {
      for (const [entryId, text] of Object.entries(d.fields as Record<string, unknown>)) {
        if (typeof text === "string") fields[entryId] = text;
      }
    }
    out[key as PosterKey] = {
      fields,
      image: typeof d.image === "string" ? d.image : undefined,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : "",
    };
  }
  return out;
}

/** Replaces all poster drafts and print settings (restoring a backup). */
export function replacePosterState(raw: unknown) {
  const parsed = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<PosterState>;
  const prefs = (parsed.prefs ?? {}) as Partial<Record<keyof PosterPrefs, unknown>>;
  write({
    drafts: sanitizeDrafts(parsed.drafts),
    prefs: {
      format: typeof prefs.format === "string" && prefs.format in PAPER_MM ? (prefs.format as PaperFormat) : DEFAULT_PREFS.format,
      orientation: prefs.orientation === "landscape" ? "landscape" : "portrait",
    },
  });
}

export function clearPosterState() {
  try {
    window.localStorage.removeItem(KEY);
  } finally {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

const getDrafts = () => read().drafts;
const getPrefs = () => read().prefs;

export function usePosterDrafts(): PosterState["drafts"] {
  return useSyncExternalStore(subscribe, getDrafts, getDrafts);
}

export function usePosterPrefs(): PosterPrefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}
