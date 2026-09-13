/**
 * Sicherung & Zurücksetzen — the whole content state of the workshop in one file.
 *
 * Everything the two days produce lives in this browser only: five localStorage
 * keys plus the interview database. A cleared cache, a swapped laptop or a
 * mis-clicked reset would cost the day's work, so the facilitator can write it
 * all to a JSON file and read it back.
 *
 * Deliberately NOT in a backup and not touched by a normal reset: the two API
 * keys and the login. A backup file gets handed around, and a reset that took
 * the keys with it would lock the moderation out in the middle of the workshop.
 *
 * The stores keep their own keys, setters and change events; this module only
 * orchestrates them, so restoring a file updates the running UI immediately.
 */
import { clearStoredAuth } from "@/components/LoginGate";
import type { Bilingual, Lang } from "@/types/slide";
import { setApiKey } from "./ai-assist";
import { GLOSSARY_KEY, clearGlossary, replaceGlossary, type GlossaryState } from "./glossary";
import {
  GROUP_OPINION_KEY,
  INTERVIEW_EXPORT_FORMAT,
  INTERVIEW_EXPORT_VERSION,
  clearAllInterviews,
  exportInterviewFile,
  importInterviewFile,
  setGroupOpinion,
  type ExportedInterview,
  type GroupOpinion,
} from "./interview-store";
import { POSTER_KEY, clearPosterState, replacePosterState, type PosterState } from "./poster-store";
import { REPORT_KEY, clearReport, restoreReport, type StoredReport } from "./report";
import { setOpenAiKey } from "./transcribe";
import { WORKSHOP_KEY, clearAll, downloadFile, replaceState, type WorkshopState } from "./workshop-store";

export const BACKUP_FORMAT = "verbands-ceo-backup";
export const BACKUP_VERSION = 1;

/** Raw contents of the content stores, exactly as they sit in localStorage. */
export interface BackupStores {
  workshop?: unknown;
  glossary?: unknown;
  poster?: unknown;
  report?: unknown;
  interviewsGroup?: unknown;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO timestamp (UTC) of the moment the file was written */
  createdAt: string;
  /** false = the interviews were saved without their recordings */
  withAudio: boolean;
  stores: BackupStores;
  interviews: ExportedInterview[];
}

/** What the file holds — shown as a preview before it replaces anything. */
export interface BackupSummary {
  createdAt: string;
  entries: number;
  interviews: number;
  posterFields: number;
  glossaryTerms: number;
  withAudio: boolean;
  hasReport: boolean;
}

/* ------------------------------------------------------------------ errors */

export type BackupErrorCode = "not-json" | "wrong-format" | "version" | "write" | "unknown";

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  constructor(code: BackupErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "BackupError";
    this.code = code;
  }
}

const ERROR_TEXT: Record<BackupErrorCode, Bilingual> = {
  "not-json": { de: "Die Datei ist keine gültige JSON-Datei.", en: "The file is not valid JSON." },
  "wrong-format": {
    de: "Das ist keine Sicherung dieser Workshop-App.",
    en: "This is not a backup file from this workshop app.",
  },
  version: {
    de: "Die Sicherung stammt aus einer neueren Version der App und kann hier nicht eingelesen werden.",
    en: "The backup comes from a newer version of the app and cannot be read here.",
  },
  write: {
    de: "Die Inhalte konnten nicht gespeichert werden (Speicher voll oder blockiert?).",
    en: "The content could not be stored (storage full or blocked?).",
  },
  unknown: {
    de: "Die Sicherung konnte nicht verarbeitet werden. Bitte die Datei prüfen.",
    en: "The backup could not be processed. Please check the file.",
  },
};

export function describeBackupError(err: unknown, lang: Lang): string {
  const code: BackupErrorCode = err instanceof BackupError ? err.code : "unknown";
  return ERROR_TEXT[code][lang];
}

/* ----------------------------------------------------------------- collect */

/** Raw store contents; `undefined` when the key is absent or unreadable — never invented. */
function readJson(key: string): unknown {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Storage blocked (private mode / policy): nothing to back up.
    return undefined;
  }
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    console.error("[backup] skipping unreadable store", { key });
    return undefined;
  }
}

/**
 * Collects every content store of this device. Audio is the bulk of the file
 * size, so recordings only travel when `includeAudio` is set; transcripts,
 * scale values and opinion pictures are always included.
 */
export async function collectBackup({ includeAudio }: { includeAudio: boolean }): Promise<BackupFile> {
  const stores: BackupStores = {};
  const add = (name: keyof BackupStores, key: string) => {
    const value = readJson(key);
    if (value !== undefined) stores[name] = value;
  };
  add("workshop", WORKSHOP_KEY);
  add("glossary", GLOSSARY_KEY);
  add("poster", POSTER_KEY);
  add("report", REPORT_KEY);
  add("interviewsGroup", GROUP_OPINION_KEY);

  let interviews: ExportedInterview[] = [];
  try {
    interviews = (await exportInterviewFile(includeAudio)).interviews;
  } catch (err) {
    // A blocked IndexedDB means this device cannot hold interviews either.
    console.error("[backup] could not read the interview database", err);
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    withAudio: includeAudio,
    stores,
    interviews,
  };
}

/** `workshop-sicherung-2026-09-16-1430.json` — local time, so the name matches the wall clock. */
export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `workshop-sicherung-${stamp}.json`;
}

export interface BackupDownload {
  fileName: string;
  bytes: number;
  summary: BackupSummary;
}

/** Collects and downloads the backup; returns what ended up in the file. */
export async function downloadBackup(opts: { includeAudio: boolean }): Promise<BackupDownload> {
  const file = await collectBackup(opts);
  const json = JSON.stringify(file);
  const fileName = backupFileName();
  downloadFile(fileName, json, "application/json");
  return { fileName, bytes: new Blob([json]).size, summary: summarize(file) };
}

/* ---------------------------------------------------------------- validate */

function validate(file: unknown): BackupFile {
  if (typeof file !== "object" || file === null || Array.isArray(file)) throw new BackupError("wrong-format");
  const f = file as Record<string, unknown>;
  if (f.format !== BACKUP_FORMAT) throw new BackupError("wrong-format", `format=${String(f.format)}`);
  const version = f.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new BackupError("wrong-format", `version=${String(version)}`);
  }
  if (version > BACKUP_VERSION) throw new BackupError("version", `version=${version}`);
  const stores =
    typeof f.stores === "object" && f.stores !== null && !Array.isArray(f.stores) ? (f.stores as BackupStores) : {};
  return {
    format: BACKUP_FORMAT,
    version,
    createdAt: typeof f.createdAt === "string" ? f.createdAt : "",
    withAudio: f.withAudio === true,
    stores,
    interviews: Array.isArray(f.interviews) ? (f.interviews as ExportedInterview[]) : [],
  };
}

/** Parses a picked file. Throws BackupError with a code the UI can translate. */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("not-json");
  }
  return validate(parsed);
}

const countKeys = (v: unknown): number => (typeof v === "object" && v !== null ? Object.keys(v).length : 0);

export function summarize(file: BackupFile): BackupSummary {
  const workshop = file.stores.workshop as Partial<WorkshopState> | undefined;
  const terms = (file.stores.glossary as Partial<GlossaryState> | undefined)?.terms;
  const poster = file.stores.poster as Partial<PosterState> | undefined;
  const report = file.stores.report as Partial<StoredReport> | undefined;
  return {
    createdAt: file.createdAt,
    entries: countKeys(workshop?.entries),
    interviews: file.interviews.length,
    posterFields: Object.values(poster?.drafts ?? {}).reduce((n, draft) => n + countKeys(draft?.fields), 0),
    glossaryTerms: Array.isArray(terms) ? terms.length : 0,
    withAudio: file.withAudio || file.interviews.some((iv) => Boolean(iv?.audio)),
    hasReport: typeof report?.markdown === "string" && report.markdown.trim() !== "",
  };
}

/* ------------------------------------------------------------------- apply */

function coerceGroupOpinion(raw: unknown): GroupOpinion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const g = raw as Partial<GroupOpinion>;
  if (typeof g.text !== "string" || !g.text.trim()) return null;
  return {
    text: g.text,
    updatedAt: typeof g.updatedAt === "string" ? g.updatedAt : "",
    basedOn: typeof g.basedOn === "string" ? g.basedOn : "",
    count: typeof g.count === "number" ? g.count : 0,
    protocolText: typeof g.protocolText === "string" ? g.protocolText : undefined,
  };
}

/**
 * Replaces the content of this device with the file — replace, not merge, so
 * the device ends up exactly as the backup describes. Writes through the
 * stores' own setters, so every open panel re-renders without a reload.
 */
export async function applyBackup(file: unknown): Promise<BackupSummary> {
  const backup = validate(file);
  const { workshop, glossary, poster, report, interviewsGroup } = backup.stores;

  try {
    // The record goes first: writing the glossary mirrors its terms into it.
    if (workshop !== undefined) replaceState(workshop);
    else clearAll();
    if (glossary !== undefined) replaceGlossary(glossary);
    else clearGlossary();
    if (poster !== undefined) replacePosterState(poster);
    else clearPosterState();
    if (report === undefined || !restoreReport(report)) clearReport();
    setGroupOpinion(coerceGroupOpinion(interviewsGroup));
  } catch (err) {
    console.error("[backup] writing the stores failed", err);
    throw new BackupError("write", err instanceof Error ? err.message : String(err));
  }

  try {
    await clearAllInterviews();
    if (backup.interviews.length) {
      await importInterviewFile({
        format: INTERVIEW_EXPORT_FORMAT,
        version: INTERVIEW_EXPORT_VERSION,
        exportedAt: backup.createdAt,
        interviews: backup.interviews,
      });
    }
  } catch (err) {
    console.error("[backup] restoring the interviews failed", err);
    // Without interviews in the file a blocked database costs nothing.
    if (backup.interviews.length) throw new BackupError("write", err instanceof Error ? err.message : String(err));
  }

  return summarize(backup);
}

/* ------------------------------------------------------------------- reset */

/** One store must not stop the others: a failure is logged, the reset continues. */
function safely(label: string, run: () => void) {
  try {
    run();
  } catch (err) {
    console.error(`[backup] ${label} failed`, err);
  }
}

/**
 * Empties every content store. `alsoKeys` additionally removes the two API keys
 * and the login — off by default, because that is what locks a facilitator out.
 * UI settings (language, theme, panel) are never touched.
 */
export async function resetContents({ alsoKeys }: { alsoKeys: boolean }): Promise<void> {
  safely("clearing the record", clearAll);
  safely("clearing the glossary", clearGlossary);
  safely("clearing the posters", clearPosterState);
  safely("clearing the report", clearReport);
  safely("clearing the group opinion", () => setGroupOpinion(null));
  try {
    await clearAllInterviews();
  } catch (err) {
    console.error("[backup] clearing the interview database failed", err);
  }
  if (!alsoKeys) return;
  safely("removing the Claude key", () => setApiKey(""));
  safely("removing the OpenAI key", () => setOpenAiKey(""));
  safely("removing the login", clearStoredAuth);
}
