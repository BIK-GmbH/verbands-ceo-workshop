import type { Bilingual, Lang } from "@/types/slide";
import { AiAssistError, describeAiError } from "@/lib/ai-assist";
import { TranscribeError, describeTranscribeError } from "@/lib/transcribe";

export type ProcessingStage = "transcribe" | "summarize" | "group";

const FALLBACK: Record<ProcessingStage, Bilingual> = {
  transcribe: { de: "Die Transkription ist fehlgeschlagen. Bitte erneut versuchen.", en: "Transcription failed. Please retry." },
  summarize: {
    de: "Das Meinungsbild konnte nicht erstellt werden. Bitte erneut versuchen.",
    en: "The opinion picture could not be created. Please retry.",
  },
  group: {
    de: "Das gemeinsame Meinungsbild konnte nicht erstellt werden. Bitte erneut versuchen.",
    en: "The group opinion picture could not be created. Please retry.",
  },
};

const NO_CLAUDE_KEY: Bilingual = {
  de: "Kein Claude-API-Schlüssel hinterlegt (siehe Einrichtung).",
  en: "No Claude API key set (see setup).",
};

/** User-facing text for any error of the interview pipeline. */
export function describeProcessingError(err: unknown, stage: ProcessingStage, lang: Lang): string {
  if (err instanceof TranscribeError) return describeTranscribeError(err, lang);
  if (err instanceof AiAssistError) {
    if (err.code === "no-key") return NO_CLAUDE_KEY[lang];
    // ai-assist's generic text talks about rewording; the pipeline has its own.
    if (err.code !== "api") return describeAiError(err, lang);
  }
  return FALLBACK[stage][lang];
}

export function bilingualError(err: unknown, stage: ProcessingStage): Bilingual {
  return { de: describeProcessingError(err, stage, "de"), en: describeProcessingError(err, stage, "en") };
}

/** Errors that will hit every following interview too, so a batch run stops. */
export function isFatal(err: unknown): boolean {
  if (err instanceof TranscribeError) return err.code === "auth" || err.code === "no-key" || err.code === "quota";
  if (err instanceof AiAssistError) return err.code === "auth" || err.code === "no-key";
  return false;
}
