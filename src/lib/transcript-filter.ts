/**
 * Cleaning step between speech-to-text and every stored transcript.
 *
 * OpenAI transcribes whatever is said, so a transcript can contain private
 * matters, insults or discriminatory remarks that must not end up in the
 * workshop documents. Claude removes exactly those passages and replaces each
 * one with a neutral marker — no paraphrase, no hint at what was said, no other
 * edit. Factual criticism stays: the workshop depends on it.
 *
 * A transcript is only stored once this step succeeded; if it fails, the
 * uncleaned text is thrown away and the audio stays for a retry. Transcript
 * text is never logged.
 */
import { completeText } from "./ai-assist";

export const MARKER_PRIVATE = "[Passage entfernt: privat]";
export const MARKER_INAPPROPRIATE = "[Passage entfernt: unangemessen]";

export interface RemovedCounts {
  privat: number;
  unangemessen: number;
}

export interface CleanResult {
  text: string;
  removed: RemovedCounts;
}

/** The content rules as the facilitation communicates them — reused wherever transcripts are described. */
export const CONTENT_RULES_DE = `Entfernt werden – und nur diese – Passagen mit:
1. privaten oder persönlichen Angelegenheiten ohne Bezug zum Workshop-Thema: Gesundheit, Familie, Beziehungen, finanzielle Verhältnisse einzelner Personen, Klatsch über Personen, persönliche Daten wie Telefonnummern oder Adressen → ${MARKER_PRIVATE}
2. Verleumdungen oder Beleidigungen von Personen oder Gruppen → ${MARKER_INAPPROPRIATE}
3. rassistischen, sexistischen, diskriminierenden oder anderweitig moralisch verwerflichen Aussagen → ${MARKER_INAPPROPRIATE}

Ausdrücklich NICHT entfernt werden:
- sachliche Kritik an Projekten, Abläufen, dem Verband, Wilma, Werkzeugen oder Entscheidungen,
- Widerspruch und Meinungsverschiedenheiten,
- Frust oder Ärger, solange niemand persönlich angegriffen wird,
- Namen von Personen in ihrer beruflichen Rolle.`;

const SYSTEM = `Du bereinigst Transkripte aus dem Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Die Transkripte entstehen per Spracherkennung aus Diskussionen und Einzelinterviews.

${CONTENT_RULES_DE}

Arbeitsweise:
- Gib das Transkript wortwörtlich zurück. Einzige Änderung: Jede zu entfernende Passage wird vollständig durch die passende Markierung ersetzt, genau so geschrieben: ${MARKER_PRIVATE} oder ${MARKER_INAPPROPRIATE}.
- Entferne die ganze betroffene Passage (Satz oder Satzteil), aber nicht mehr als nötig.
- Umschreibe, kürze oder deute den entfernten Inhalt nie an – auch nicht in der Umgebung der Markierung.
- Keine sonstigen Änderungen: nicht glätten, nicht korrigieren, nicht zusammenfassen, keine Zeitmarken oder Absätze verändern.
- Ist nichts zu entfernen, gib den Text unverändert zurück.

Antworte ausschließlich mit einem JSON-Objekt ohne Codeblock und ohne weiteren Text:
{"text": "<bereinigtes Transkript>", "removed": {"privat": <Anzahl>, "unangemessen": <Anzahl>}}`;

export type FilterErrorCode = "parse" | "suspect";

export class TranscriptFilterError extends Error {
  readonly code: FilterErrorCode;
  constructor(code: FilterErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "TranscriptFilterError";
    this.code = code;
  }
}

const occurrences = (text: string, marker: string) => text.split(marker).length - 1;

/** Tolerates a code fence or stray words around the object; anything else is a failure. */
function parse(out: string): CleanResult {
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start < 0 || end <= start) throw new TranscriptFilterError("parse", "no JSON object");
  let data: unknown;
  try {
    data = JSON.parse(out.slice(start, end + 1));
  } catch {
    throw new TranscriptFilterError("parse", "invalid JSON");
  }
  const obj = data as { text?: unknown };
  if (typeof obj?.text !== "string") throw new TranscriptFilterError("parse", "text missing");
  const text = obj.text;
  // Counted from the markers in the text, not from the reported numbers: those can disagree.
  return { text, removed: { privat: occurrences(text, MARKER_PRIVATE), unangemessen: occurrences(text, MARKER_INAPPROPRIATE) } };
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Removes private and inappropriate passages. Throws AiAssistError (no key,
 * network, …) or TranscriptFilterError when the answer is unusable — in both
 * cases the caller must not store the uncleaned text.
 */
export async function cleanTranscript(text: string, context: "session" | "interview", logLabel: string): Promise<CleanResult> {
  if (!text.trim()) return { text, removed: { privat: 0, unangemessen: 0 } };
  const out = await completeText({
    system: SYSTEM,
    prompt: `Art des Transkripts: ${context === "session" ? "Mitschnitt einer Gruppendiskussion (Abschnitt)" : "Einzelinterview"}\n\n<transkript>\n${text}\n</transkript>`,
    logLabel: `transcript-clean ${logLabel}`,
  });
  const result = parse(out);
  // Without a single marker the text must come back essentially unchanged —
  // a much shorter answer means the model summarised instead of cleaning.
  const total = result.removed.privat + result.removed.unangemessen;
  if (total === 0 && normalize(result.text).length < normalize(text).length * 0.8) {
    throw new TranscriptFilterError("suspect", "shortened without markers");
  }
  return result;
}

export function removedTotal(r?: RemovedCounts): number {
  return r ? r.privat + r.unangemessen : 0;
}

/** "2 Passagen entfernt" — discreet note for cards and status lines. */
export function removedLabel(r: RemovedCounts | undefined, lang: "de" | "en"): string {
  const n = removedTotal(r);
  if (!n) return "";
  return lang === "de" ? `${n} ${n === 1 ? "Passage" : "Passagen"} entfernt` : `${n} ${n === 1 ? "passage" : "passages"} removed`;
}
