/**
 * Transcripts and recordings as plain files — readable without the app.
 *
 * Two ways out of the browser:
 * - by hand: the download list in the settings (one file or all of a kind),
 * - automatically: with the toggle on, every newly created interview transcript,
 *   interview recording and finished session recording is saved the moment it
 *   exists. With a connected backup folder (auto-backup.ts) it lands in the
 *   subfolders `transkripte/` and `aufnahmen/`; otherwise it is a normal download.
 *
 * The toggle is a device setting like theme or language: not part of a backup,
 * not touched by a reset. Transcript text is never logged.
 */
import { useSyncExternalStore } from "react";
import type { Bilingual } from "@/types/slide";
import { downloadBlob, formatDate, formatDuration, safeFileName } from "@/components/interviews/ui";
import { writeToBackupFolder } from "./auto-backup";
import type { Interview } from "./interview-store";
import { localDateStamp } from "./local-date";
import type { RecordingSession } from "./recording-store";
import { extensionForMime, fileExtension, isAcceptedAudioName } from "./transcribe";

export const TRANSCRIPT_FOLDER = "transkripte";
export const AUDIO_FOLDER = "aufnahmen";

/* ------------------------------------------------------------------- files */

const pad = (n: number) => String(n).padStart(2, "0");

function localTimeStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return localDateStamp();
  return `${localDateStamp(d)}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

export function transcriptFileName(iv: Interview): string {
  return `transkript-${localTimeStamp(iv.createdAt)}-${safeFileName(iv.pseudonym)}-${iv.id}.md`;
}

export function interviewAudioExtension(iv: Interview): string {
  return isAcceptedAudioName(iv.fileName) ? fileExtension(iv.fileName) : extensionForMime(iv.audio?.type || iv.mimeType);
}

export function interviewAudioFileName(iv: Interview): string {
  return `interview-${localTimeStamp(iv.createdAt)}-${safeFileName(iv.pseudonym)}-${iv.id}.${interviewAudioExtension(iv)}`;
}

export function sessionFileName(s: RecordingSession): string {
  return `workshop-aufnahme-${localTimeStamp(s.startedAt)}.${s.extension || extensionForMime(s.mimeType)}`;
}

export function allTranscriptsFileName(): string {
  return `transkripte-${localDateStamp()}.md`;
}

/** One interview as Markdown: the facts first, then transcript and opinion picture. */
export function transcriptMarkdown(iv: Interview, heading = "#"): string {
  const lines = [
    `${heading} Transkript: ${iv.pseudonym}`,
    "",
    `- Datum: ${formatDate(iv.createdAt, "de")}`,
    `- Dauer: ${formatDuration(iv.durationSec)}`,
    `- Quelle: ${iv.source === "recorded" ? "Aufnahme in der App" : `hochgeladene Datei (${iv.fileName})`}`,
    `- Transkription: ${iv.transcriptModel ?? "—"}`,
    "",
    `${heading}# Wortlaut`,
    "",
    iv.transcript?.trim() || "_(noch kein Transkript)_",
  ];
  if (iv.opinion?.trim()) lines.push("", `${heading}# Meinungsbild`, "", iv.opinion.trim());
  return lines.join("\n") + "\n";
}

export function allTranscriptsMarkdown(list: Interview[]): string {
  const withText = list.filter((iv) => iv.transcript?.trim());
  const head = [
    "# Transkripte der KI-Interviews",
    "",
    `- Workshop: KI-Geschäftsführer: Fiktion oder Realität?`,
    `- Exportiert: ${formatDate(new Date().toISOString(), "de")}`,
    `- Interviews: ${withText.length}`,
    "",
  ].join("\n");
  return head + withText.map((iv) => `\n---\n\n${transcriptMarkdown(iv, "##")}`).join("");
}

/* ------------------------------------------------------------------ toggle */

const KEY = "verbands-ceo.auto-export.v1";
const EVENT = "auto-export-change";

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function isAutoExportEnabled(): boolean {
  return readEnabled();
}

/** Throws if the browser blocks storage. */
export function setAutoExportEnabled(on: boolean) {
  if (on) window.localStorage.setItem(KEY, "1");
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribeToggle(cb: () => void): () => void {
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

export function useAutoExportEnabled(): boolean {
  return useSyncExternalStore(subscribeToggle, readEnabled, () => false);
}

/* ------------------------------------------------------------------ status */

export interface SavedFile {
  name: string;
  /** folder path when written to the backup folder, otherwise a browser download */
  path?: string;
  at: string;
}

export interface AutoExportStatus {
  last: SavedFile | null;
  problem: { message: Bilingual; at: string } | null;
}

let status: AutoExportStatus = { last: null, problem: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<AutoExportStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function dismissAutoExportProblem() {
  setStatus({ problem: null });
}

export function useAutoExportStatus(): AutoExportStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => status,
  );
}

/* -------------------------------------------------------------------- save */

export type SaveTarget = "auto" | "download" | "folder";

/**
 * Saves one file. `auto` = backup folder when connected and allowed, otherwise
 * a download; `folder` = only the backup folder (returns null when there is
 * none or it is not allowed). Resolves to what was saved.
 */
export async function saveFile(subfolder: string, name: string, content: Blob, target: SaveTarget = "auto"): Promise<SavedFile | null> {
  if (target !== "download") {
    const res = await writeToBackupFolder(subfolder, name, content);
    if (res.written) return { name, path: res.path, at: new Date().toISOString() };
    if (target === "folder") return null;
  }
  downloadBlob(content, name);
  return { name, at: new Date().toISOString() };
}

export const markdownBlob = (text: string) => new Blob([text], { type: "text/markdown;charset=utf-8" });

/** Spacing between several downloads — Chrome drops clicks that come too fast. */
export const DOWNLOAD_GAP_MS = 700;
export const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

async function autoSave(kind: "transcript" | "audio", label: string, run: () => Promise<SavedFile | null>): Promise<SavedFile | null> {
  if (!readEnabled()) return null;
  try {
    const saved = await run();
    if (saved) setStatus({ last: saved, problem: null });
    return saved;
  } catch (err) {
    console.error("[auto-export] saving automatically failed", { kind, label, err });
    setStatus({
      problem: {
        message:
          kind === "transcript"
            ? { de: `Das Transkript „${label}“ konnte nicht automatisch gespeichert werden. Bitte in den Einstellungen unter „Transkripte & Aufnahmen“ herunterladen.`, en: `The transcript “${label}” could not be saved automatically. Please download it in the settings under “Transcripts & recordings”.` }
            : { de: `Die Aufnahme „${label}“ konnte nicht automatisch gespeichert werden. Bitte in den Einstellungen unter „Transkripte & Aufnahmen“ herunterladen.`, en: `The recording “${label}” could not be saved automatically. Please download it in the settings under “Transcripts & recordings”.` },
        at: new Date().toISOString(),
      },
    });
    return null;
  }
}

/** After a (re-)transcription. */
export function autoSaveTranscript(iv: Interview): Promise<SavedFile | null> {
  if (!iv.transcript?.trim()) return Promise.resolve(null);
  return autoSave("transcript", iv.pseudonym, () => saveFile(TRANSCRIPT_FOLDER, transcriptFileName(iv), markdownBlob(transcriptMarkdown(iv))));
}

/** After an interview was recorded in the app or uploaded. */
export function autoSaveInterviewAudio(iv: Interview): Promise<SavedFile | null> {
  const audio = iv.audio;
  if (!audio) return Promise.resolve(null);
  return autoSave("audio", iv.pseudonym, () => saveFile(AUDIO_FOLDER, interviewAudioFileName(iv), audio));
}

/** After a session recording was stopped. */
export function autoSaveSessionRecording(blob: Blob, session: RecordingSession): Promise<SavedFile | null> {
  const name = sessionFileName(session);
  return autoSave("audio", name, () => saveFile(AUDIO_FOLDER, name, blob));
}

export function downloadTranscript(iv: Interview) {
  downloadBlob(markdownBlob(transcriptMarkdown(iv)), transcriptFileName(iv));
}

export function downloadAllTranscripts(list: Interview[]) {
  downloadBlob(markdownBlob(allTranscriptsMarkdown(list)), allTranscriptsFileName());
}

