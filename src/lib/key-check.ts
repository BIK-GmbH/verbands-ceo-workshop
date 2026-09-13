/**
 * Status of the two API keys, shown in the settings.
 *
 * Two levels, deliberately kept apart: whether a key is *stored* (free, offline,
 * shown immediately) and whether it actually *works* (one request, only on an
 * explicit click). Both checks read the model list instead of sending a prompt —
 * that costs no tokens, so the button can be pressed as often as needed.
 *
 * The key itself is never logged, never put in a URL and never sent anywhere
 * except to its own provider.
 */
import type { Bilingual } from "@/types/slide";
import { isPlausibleKey } from "./ai-assist";
import { isPlausibleOpenAiKey } from "./transcribe";

export type KeyState =
  /** No key stored on this device. */
  | "missing"
  /** Stored, but it does not look like a key of this provider. */
  | "malformed"
  /** Stored and plausible — not verified against the provider yet. */
  | "stored"
  /** Verified: the provider accepted the key. */
  | "valid"
  /** The provider rejected the key (wrong, revoked or from the other provider). */
  | "rejected"
  /** Key is fine, but there is no credit or the quota is used up. */
  | "quota"
  /** Provider not reachable: offline, blocked, or the request timed out. */
  | "unreachable"
  /** Anything else the provider answered. */
  | "error";

export interface KeyStatus {
  state: KeyState;
  /** Short technical detail for the UI (status code or provider message), never the key. */
  detail?: string;
  /** ISO timestamp of the check that produced this status. */
  checkedAt?: string;
}

export const KEY_STATE_LABEL: Record<KeyState, Bilingual> = {
  missing: { de: "nicht hinterlegt", en: "not stored" },
  malformed: { de: "unpassendes Format", en: "unexpected format" },
  stored: { de: "hinterlegt, ungeprüft", en: "stored, unverified" },
  valid: { de: "geprüft: funktioniert", en: "verified: works" },
  rejected: { de: "abgelehnt", en: "rejected" },
  quota: { de: "kein Guthaben", en: "no credit" },
  unreachable: { de: "nicht erreichbar", en: "not reachable" },
  error: { de: "Fehler bei der Prüfung", en: "check failed" },
};

/** How the state should read visually: fine, worth a look, broken. */
export function keyTone(state: KeyState): "ok" | "warn" | "bad" {
  if (state === "valid") return "ok";
  if (state === "stored") return "warn";
  if (state === "missing") return "warn";
  return "bad";
}

/** "sk-ant-…9f2a" — enough to tell two keys apart, not enough to use one. */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  const prefix = trimmed.startsWith("sk-ant-") ? "sk-ant-" : trimmed.startsWith("sk-") ? "sk-" : "";
  return `${prefix}…${trimmed.slice(-4)}`;
}

/** Offline verdict: is a key stored, and does it look like this provider's key? */
export function storedState(key: string, plausible: (k: string) => boolean): KeyStatus {
  if (!key.trim()) return { state: "missing" };
  return plausible(key) ? { state: "stored" } : { state: "malformed" };
}

export const anthropicStoredState = (key: string) => storedState(key, isPlausibleKey);
export const openAiStoredState = (key: string) => storedState(key, isPlausibleOpenAiKey);

const TIMEOUT_MS = 12_000;

/** Provider answers that mean "key is fine, the account is not". */
const QUOTA_HINTS = ["insufficient_quota", "credit balance", "credit_balance", "billing", "quota"];

function quotaFromBody(body: string): boolean {
  const lower = body.toLowerCase();
  return QUOTA_HINTS.some((hint) => lower.includes(hint));
}

function classify(status: number, body: string): KeyStatus {
  const detail = `HTTP ${status}`;
  if (status === 200) return { state: "valid" };
  if (status === 401 || status === 403) return { state: "rejected", detail };
  // 400 with a billing message is the Anthropic shape for an empty balance.
  if ((status === 400 || status === 402 || status === 429) && quotaFromBody(body)) {
    return { state: "quota", detail };
  }
  if (status === 429) return { state: "quota", detail };
  return { state: "error", detail };
}

async function probe(url: string, headers: Record<string, string>): Promise<KeyStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    const body = await res.text().catch(() => "");
    return { ...classify(res.status, body), checkedAt: new Date().toISOString() };
  } catch {
    // Abort, offline, DNS, CORS — indistinguishable here and all mean the same
    // to the facilitator: the provider could not be reached from this browser.
    return { state: "unreachable", checkedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

/** Verifies the Claude key against the Anthropic model list (no tokens used). */
export async function checkAnthropicKey(key: string): Promise<KeyStatus> {
  const stored = anthropicStoredState(key);
  if (stored.state !== "stored") return stored;
  return probe("https://api.anthropic.com/v1/models?limit=1", {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    // Same opt-in the SDK sends; without it the API refuses browser requests.
    "anthropic-dangerous-direct-browser-access": "true",
  });
}

/** Verifies the OpenAI key against the model list (no tokens used). */
export async function checkOpenAiKey(key: string): Promise<KeyStatus> {
  const stored = openAiStoredState(key);
  if (stored.state !== "stored") return stored;
  return probe("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` });
}
