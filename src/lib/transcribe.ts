/**
 * Speech-to-text for the interviews and the session recording via the OpenAI transcription API.
 *
 * Claude cannot take audio, so transcription uses OpenAI. The app has no
 * backend: the browser calls the API directly with a key the facilitator
 * enters once per device (localStorage only, never in the repo, never logged).
 */
import { useSyncExternalStore } from "react";
import type { Bilingual, Lang } from "@/types/slide";

const STORAGE_KEY = "verbands-ceo.openai.v1";
const EVENT = "openai-settings-change";
const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const PRIMARY_MODEL = "gpt-4o-transcribe";
const FALLBACK_MODEL = "whisper-1";
/** A 5-minute interview usually takes well under a minute; beyond this the request is treated as hung. */
const TIMEOUT_MS = 4 * 60 * 1000;

/** Hard upload limit of the OpenAI transcription endpoint. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ["mp3", "m4a", "wav", "webm", "ogg"] as const;
export const ACCEPT_ATTRIBUTE = ".mp3,.m4a,.wav,.webm,.ogg,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,audio/ogg";

// Vocabulary hint: improves recognition of domain terms without changing content.
const INTERVIEW_PROMPT =
  "Kurzinterview im Workshop des Fachverbands Betonbohren und -sägen Deutschland (FBS) über künstliche Intelligenz. Begriffe: KI, ChatGPT, Claude, Copilot, Chatbot, Verband, Geschäftsstelle, Vorstand, Mitgliedsbetriebe, Kernbohrung, Wandsäge, Seilsäge, Bauwerksmechaniker, BG Bau, Fachkräftemangel, Digitalisierung.";

/** Same idea for the session recording: a group discussion across the whole workshop. */
export const SESSION_PROMPT =
  "Mitschnitt einer Diskussion im Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland (FBS), mehrere Sprecherinnen und Sprecher. Begriffe: KI, KI-Geschäftsführer, ChatGPT, Claude, Copilot, Wissensbasis, RAG, Verband, Geschäftsstelle, Geschäftsführung, Vorstand, Mitgliederversammlung, Ausschuss, Mitgliedsbetriebe, Wilma, Kernbohrung, Wandsäge, Seilsäge, Bauwerksmechaniker, BG Bau, IG BAU, DIN 18459, VOB, Merkblätter, Datenschutz, Roadmap.";

export function getOpenAiKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Storage blocked (private mode / policy): behaves like "no key set".
    return "";
  }
}

/** Stores (or with "" removes) the key. Throws if the browser blocks storage. */
export function setOpenAiKey(key: string) {
  if (key) window.localStorage.setItem(STORAGE_KEY, key);
  else window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useOpenAiKey(): string {
  return useSyncExternalStore(subscribe, getOpenAiKey, () => "");
}

/** OpenAI keys start with "sk-" (incl. "sk-proj-"); a Claude key pasted by mistake is rejected. */
export const isPlausibleOpenAiKey = (key: string) =>
  key.startsWith("sk-") && !key.startsWith("sk-ant-") && key.length > 20 && !/\s/.test(key);

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isAcceptedAudioName(name: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

/** File extension the API needs to detect the container of a recorded blob. */
export function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export type TranscribeErrorCode =
  | "no-key"
  | "auth"
  | "rate"
  | "quota"
  | "too-large"
  | "no-audio"
  | "format"
  | "network"
  | "timeout"
  | "empty"
  | "api";

export class TranscribeError extends Error {
  readonly code: TranscribeErrorCode;
  constructor(code: TranscribeErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "TranscribeError";
    this.code = code;
  }
}

interface ApiErrorBody {
  error?: { message?: string; code?: string | null; type?: string };
}

async function readError(res: Response): Promise<ApiErrorBody["error"]> {
  try {
    return ((await res.json()) as ApiErrorBody).error;
  } catch {
    return undefined;
  }
}

function errorFor(status: number, body: ApiErrorBody["error"]): TranscribeError {
  const detail = `${status} ${body?.message ?? ""}`.trim();
  if (status === 401 || status === 403) return new TranscribeError("auth", detail);
  if (status === 413) return new TranscribeError("too-large", detail);
  if (status === 429) return new TranscribeError(body?.code === "insufficient_quota" ? "quota" : "rate", detail);
  if (status === 400 && /format|decode|unsupported|invalid file/i.test(body?.message ?? "")) {
    return new TranscribeError("format", detail);
  }
  return new TranscribeError("api", detail);
}

async function post(model: string, audio: Blob, fileName: string, apiKey: string, prompt: string): Promise<Response> {
  const form = new FormData();
  form.append("file", audio, fileName);
  form.append("model", model);
  form.append("language", "de");
  form.append("response_format", "json");
  form.append("prompt", prompt);
  try {
    return await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new TranscribeError("timeout");
    }
    throw new TranscribeError("network", err instanceof Error ? err.message : String(err));
  }
}

export interface TranscriptResult {
  text: string;
  model: string;
}

export interface TranscribeOptions {
  /** Vocabulary hint; defaults to the interview vocabulary */
  prompt?: string;
  /** Neutral base name of the uploaded file (never a participant's file name); defaults to "interview" */
  fileBase?: string;
}

/**
 * Transcribes one audio blob (German). Tries gpt-4o-transcribe first and falls
 * back to whisper-1 if the account cannot use that model. Throws TranscribeError.
 */
export async function transcribeAudio(
  audio: Blob,
  extension: string,
  logLabel: string,
  { prompt = INTERVIEW_PROMPT, fileBase = "interview" }: TranscribeOptions = {},
): Promise<TranscriptResult> {
  const apiKey = getOpenAiKey();
  if (!apiKey) throw new TranscribeError("no-key");
  if (audio.size === 0) throw new TranscribeError("no-audio");
  if (audio.size > MAX_AUDIO_BYTES) throw new TranscribeError("too-large");

  // Neutral file name: participant names in original file names never leave the device.
  const fileName = `${fileBase}.${extension || "webm"}`;
  try {
    let model = PRIMARY_MODEL;
    let res = await post(model, audio, fileName, apiKey, prompt);
    if (res.status === 400 || res.status === 404) {
      const firstError = await readError(res);
      console.error("[transcribe] primary model failed, falling back", { feature: logLabel, status: res.status, detail: firstError?.message });
      model = FALLBACK_MODEL;
      res = await post(model, audio, fileName, apiKey, prompt);
    }
    if (!res.ok) throw errorFor(res.status, await readError(res));
    const body = (await res.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) throw new TranscribeError("empty");
    return { text, model };
  } catch (err) {
    const tErr = err instanceof TranscribeError ? err : new TranscribeError("api", err instanceof Error ? err.message : String(err));
    console.error("[transcribe] request failed", { code: tErr.code, feature: logLabel, detail: tErr.message });
    throw tErr;
  }
}

const ERROR_TEXT: Record<TranscribeErrorCode, Bilingual> = {
  "no-key": { de: "Kein OpenAI-API-Schlüssel hinterlegt (siehe Einrichtung).", en: "No OpenAI API key set (see setup)." },
  auth: {
    de: "Der OpenAI-Schlüssel wurde abgelehnt. Bitte in der Einrichtung prüfen oder neu eingeben.",
    en: "The OpenAI key was rejected. Please check or re-enter it in the setup.",
  },
  rate: {
    de: "Gerade zu viele Anfragen an OpenAI. Bitte kurz warten und erneut versuchen.",
    en: "Too many requests to OpenAI right now. Please wait a moment and retry.",
  },
  quota: {
    de: "Das OpenAI-Kontingent ist aufgebraucht. Bitte Guthaben bzw. Limits im OpenAI-Konto prüfen.",
    en: "The OpenAI quota is used up. Please check credit or limits in the OpenAI account.",
  },
  "too-large": {
    de: "Die Datei ist größer als 25 MB und kann nicht transkribiert werden. Bitte eine kürzere Aufnahme verwenden oder als komprimiertes mp3 speichern.",
    en: "The file is larger than 25 MB and cannot be transcribed. Please use a shorter recording or save it as a compressed mp3.",
  },
  "no-audio": {
    de: "Zu diesem Interview ist keine Audiodatei (mehr) gespeichert.",
    en: "No audio file is stored (any more) for this interview.",
  },
  format: {
    de: "Das Audioformat wurde nicht erkannt. Bitte als mp3, m4a, wav, webm oder ogg speichern.",
    en: "The audio format was not recognised. Please save as mp3, m4a, wav, webm or ogg.",
  },
  network: {
    de: "Keine Verbindung zu OpenAI. Bitte die Internetverbindung prüfen.",
    en: "Cannot reach OpenAI. Please check the internet connection.",
  },
  timeout: {
    de: "Die Transkription hat zu lange gedauert. Bitte erneut versuchen.",
    en: "Transcription took too long. Please retry.",
  },
  empty: {
    de: "In der Aufnahme wurde keine Sprache erkannt. Bitte Aufnahme prüfen (Mikrofon, Lautstärke).",
    en: "No speech was recognised in the recording. Please check the recording (microphone, volume).",
  },
  api: { de: "Die Transkription ist fehlgeschlagen. Bitte erneut versuchen.", en: "Transcription failed. Please retry." },
};

export function describeTranscribeError(err: unknown, lang: Lang): string {
  const code: TranscribeErrorCode = err instanceof TranscribeError ? err.code : "api";
  return ERROR_TEXT[code][lang];
}
