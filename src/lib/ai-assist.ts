/**
 * KI-Assistent für das Live-Protokoll: glättet diktierte Beiträge und
 * formuliert sie auf Zuruf um (knapper, ausführlicher, professioneller …).
 *
 * The app has no backend, so the browser calls the Claude API directly with a
 * key the facilitator enters once per device (localStorage only, never in the
 * repo). Opt-in by design: without a key no text leaves the browser.
 */
import Anthropic from "@anthropic-ai/sdk";
import { useSyncExternalStore } from "react";
import type { Bilingual, Lang } from "@/types/slide";

const STORAGE_KEY = "verbands-ceo.ai.v1";
const EVENT = "ai-settings-change";
const MODEL = "claude-opus-5";

export function getApiKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Storage blocked (private mode / policy): behaves like "no key set".
    return "";
  }
}

/** Stores (or with "" removes) the key. Throws if the browser blocks storage. */
export function setApiKey(key: string) {
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

export function useApiKey(): string {
  return useSyncExternalStore(subscribe, getApiKey, () => "");
}

export const isPlausibleKey = (key: string) => key.startsWith("sk-ant-") && key.length > 20;

export type PresetId = "polish" | "shorter" | "longer" | "professional" | "bullets";

export const PRESETS: { id: PresetId; label: Bilingual; instruction: string }[] = [
  {
    id: "polish",
    label: { de: "Glätten", en: "Polish" },
    instruction:
      "Mach aus dem gesprochenen bzw. diktierten Beitrag einen sauberen, gut lesbaren Protokolltext: vollständige, grammatikalisch korrekte Sätze; Füllwörter, Wiederholungen und Satzabbrüche entfernen; Erkennungsfehler korrigieren; inhaltlich leicht straffen und zusammenfassen, ohne Aussagen zu verlieren.",
  },
  {
    id: "shorter",
    label: { de: "Knapper", en: "Shorter" },
    instruction: "Kürze den Text deutlich auf die Kernaussagen, ohne Wesentliches wegzulassen.",
  },
  {
    id: "longer",
    label: { de: "Ausführlicher", en: "More detail" },
    instruction:
      "Formuliere den Text ausführlicher aus und mache Zusammenhänge und Begründungen, die im Text angelegt sind, klarer. Füge keine neuen Fakten, Zahlen oder Beschlüsse hinzu.",
  },
  {
    id: "professional",
    label: { de: "Professioneller", en: "More professional" },
    instruction: "Formuliere den Text professioneller, im sachlichen Stil eines offiziellen Verbandsprotokolls.",
  },
  {
    id: "bullets",
    label: { de: "Stichpunkte", en: "Bullet points" },
    instruction: "Gliedere den Inhalt in prägnante Stichpunkte, jeder in einer eigenen Zeile beginnend mit „- “.",
  },
];

const SYSTEM = `Du bist Protokoll-Redakteur im Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Die Beiträge wurden live eingetippt oder per Spracherkennung diktiert. Sie enthalten deshalb oft Füllwörter, Wiederholungen, abgebrochene Sätze und falsch erkannte Wörter.

Überarbeite den Beitrag gemäß der Anweisung und halte dich an diese Regeln:
- Inhalt, Haltung und Aussagen bleiben erhalten. Erfinde keine Fakten, Zahlen, Namen, Termine oder Beschlüsse.
- Korrigiere offensichtliche Erkennungsfehler aus dem Kontext. Typische Begriffe: Kernbohrung, Wandsäge, Seilsäge, Betonbohren und -sägen, Bauwerksmechaniker, BG Bau, IG BAU, DIN 18459, VOB, Q-Zeichen, BEBOSA, Geschäftsstelle, Vorstand, Ausschuss, Wilma.
- Ist eine Stelle unverständlich, gib sie sinngemäß wieder, statt zu raten.
- Schreibe klar, sachlich und grammatikalisch korrekt in der Sprache des Beitrags (in der Regel Deutsch, neue Rechtschreibung).
- Antworte ausschließlich mit dem überarbeiteten Text: keine Einleitung, keine Erklärung, keine Anführungszeichen drumherum.`;

export interface RefineRequest {
  text: string;
  instruction: string;
  context: { slideId: string; slideTitle?: string; prompt: string };
}

function buildPrompt({ text, instruction, context }: RefineRequest): string {
  return [
    `Kontext: Folie ${context.slideId}${context.slideTitle ? ` „${context.slideTitle}“` : ""}`,
    `Frage bzw. Feld: ${context.prompt}`,
    `Anweisung: ${instruction}`,
    "",
    "<beitrag>",
    text,
    "</beitrag>",
  ].join("\n");
}

export type AiErrorCode = "no-key" | "auth" | "rate" | "overloaded" | "network" | "refusal" | "empty" | "api";

export class AiAssistError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "AiAssistError";
    this.code = code;
  }
}

function toAiError(err: unknown): AiAssistError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiAssistError("auth", err.message);
  }
  if (err instanceof Anthropic.RateLimitError) return new AiAssistError("rate", err.message);
  if (err instanceof Anthropic.InternalServerError) return new AiAssistError("overloaded", err.message);
  if (err instanceof Anthropic.APIConnectionError) return new AiAssistError("network", err.message);
  if (err instanceof Anthropic.APIError) return new AiAssistError("api", `${err.status ?? ""} ${err.message}`.trim());
  return new AiAssistError("api", err instanceof Error ? err.message : String(err));
}

/** Rewrites one contribution according to `instruction`. Throws AiAssistError. */
export async function refineText(req: RefineRequest): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new AiAssistError("no-key");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.beta.messages
    .create({
      model: MODEL,
      max_tokens: 16000,
      // Server-side fallback: a policy decline is retried on Anthropic's recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Rewording is light work; low effort keeps the round trip short during a live session.
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(req) }],
    })
    .catch((err: unknown) => {
      const aiErr = toAiError(err);
      console.error("[ai-assist] refine failed", { code: aiErr.code, slideId: req.context.slideId, detail: aiErr.message });
      throw aiErr;
    });

  if (response.stop_reason === "refusal") throw new AiAssistError("refusal");
  const out = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
  if (!out) throw new AiAssistError("empty");
  return out;
}

const ERROR_TEXT: Record<AiErrorCode, Bilingual> = {
  "no-key": { de: "Kein API-Schlüssel hinterlegt.", en: "No API key set." },
  auth: {
    de: "Der API-Schlüssel wurde abgelehnt. Bitte prüfen oder neu eingeben.",
    en: "The API key was rejected. Please check or re-enter it.",
  },
  rate: {
    de: "Gerade zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
    en: "Too many requests right now. Please wait a moment and retry.",
  },
  overloaded: {
    de: "Der KI-Dienst ist gerade ausgelastet. Bitte gleich noch einmal versuchen.",
    en: "The AI service is busy. Please try again shortly.",
  },
  network: {
    de: "Keine Verbindung zum KI-Dienst. Bitte die Internetverbindung prüfen.",
    en: "Cannot reach the AI service. Please check the internet connection.",
  },
  refusal: {
    de: "Die KI hat diese Anfrage abgelehnt. Bitte den Text von Hand bearbeiten.",
    en: "The AI declined this request. Please edit the text manually.",
  },
  empty: { de: "Die KI hat keinen Text geliefert. Bitte erneut versuchen.", en: "The AI returned no text. Please retry." },
  api: { de: "Die Überarbeitung ist fehlgeschlagen. Bitte erneut versuchen.", en: "Rewording failed. Please retry." },
};

export function describeAiError(err: unknown, lang: Lang): string {
  const code: AiErrorCode = err instanceof AiAssistError ? err.code : "api";
  return ERROR_TEXT[code][lang];
}
