/**
 * Day 1 recap for the start of day 2 (slide 04.00).
 *
 * Everything here is derived from what already sits in the record: the poster
 * results of phases 1–3 (the poster wording wins over the record, exactly as on
 * the wall), the barometer from the kickoff, a few counts that show how much we
 * worked, and the questions still open. Nothing is stored except the optional AI
 * summary, which lands as a normal record entry and stays editable on the slide.
 */
import { AiAssistError, completeText } from "@/lib/ai-assist";
import { formatCardLine } from "@/lib/cards";
import { findPoster, posterField, posterValues, type PosterKey } from "@/lib/posters";
import type { PosterState } from "@/lib/poster-store";
import { filledParticipants, type CaptureEntry, type Participant } from "@/lib/workshop-store";
import type { Bilingual } from "@/types/slide";

/** Day 1 = modules 0–3 (see docs/workshop-konzept.md, Zeitplan). */
export const DAY1_LAST_MODULE = 3;

const BAROMETER_BEFORE_ID = "00.08:barometer-vorher";
const BAROMETER_VOTES_ID = `${BAROMETER_BEFORE_ID}-stimmen`;
/** „Offen für morgen" from the wrap-up of day 1. */
const OPEN_FOR_TOMORROW_ID = "03.06:tag1-offen";
/** Single barometer votes carry participant names — never shown or sent anywhere from here. */
const VOTES_SUFFIX = "-stimmen";

const isDay1 = (e: CaptureEntry) => e.module >= 0 && e.module <= DAY1_LAST_MODULE;
const fieldOf = (id: string) => id.slice(id.indexOf(":") + 1);
const isAdhocQuestion = (e: CaptureEntry) => fieldOf(e.id).startsWith("q-");

export function hasContent(v: CaptureEntry["value"] | undefined): boolean {
  if (v === undefined) return false;
  return Array.isArray(v) ? v.some((x) => x.trim()) : v.trim().length > 0;
}

/** Entry id → plain text, the shape `posterValues` reads. */
export function recordOf(entries: CaptureEntry[]): Record<string, string> {
  return Object.fromEntries(entries.map((e) => [e.id, Array.isArray(e.value) ? e.value.join(", ") : e.value]));
}

/** Multi-line poster text → lines without bullet markers; a single sentence stays one line. */
export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–•*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

/* ---------------------------------------------------------------- posters */

export interface RecapSlot {
  entryId: string;
  label: Bilingual;
  text: string;
}

export interface RecapPhase {
  key: PosterKey;
  phase: number;
  /** Poster slide the result comes from. */
  slideId: string;
  title: Bilingual;
  slots: RecapSlot[];
  /** Choice field of the poster (confirmation / commitment), if the poster has one. */
  status: RecapSlot | null;
}

/** Which poster fields carry the result of a phase — the rest stays on the poster itself. */
const PHASES: { key: PosterKey; slots: string[]; status?: string }[] = [
  { key: "need-to-move", slots: ["kernproblem"], status: "bestaetigt" },
  { key: "moeglichkeitsraum", slots: ["stossrichtungen"] },
  { key: "zielbild", slots: ["leitsatz", "profil"], status: "commitment" },
];

export function recapPhases(entries: CaptureEntry[], drafts: PosterState["drafts"]): RecapPhase[] {
  const record = recordOf(entries);
  return PHASES.flatMap(({ key, slots, status }) => {
    const def = findPoster(key);
    if (!def) return [];
    const values = posterValues(def, record, drafts[key]?.fields);
    const slot = (fieldKey: string): RecapSlot => {
      const f = posterField(def, fieldKey);
      return { entryId: f.entryId, label: f.label, text: values[f.entryId]?.trim() ?? "" };
    };
    return [{ key, phase: def.phase, slideId: def.slideId, title: def.title, slots: slots.map(slot), status: status ? slot(status) : null }];
  });
}

/* --------------------------------------------------------------- barometer */

export interface MoodPicture {
  options: string[];
  counts: number[];
  total: number;
  /** Mean position on the scale, 0 = first option; null without votes. */
  mean: number | null;
}

/** The barometer scale as defined on the commitment poster (same five steps as 00.08). */
function barometerOptions(): string[] {
  const def = findPoster("commitment");
  return def ? (posterField(def, "vorher").options ?? []) : [];
}

/**
 * Distribution of the kickoff barometer. Reads the single votes ("Option — Name")
 * and falls back to the stored result line ("Fiktion: 2 · Eher Realität: 3 (5 Stimmen)").
 */
export function moodBefore(entries: CaptureEntry[]): MoodPicture {
  const options = barometerOptions();
  const counts = options.map(() => 0);
  const votes = entries.find((e) => e.id === BAROMETER_VOTES_ID)?.value;
  if (Array.isArray(votes) && votes.length > 0) {
    for (const line of votes) {
      const option = line.split(" — ")[0].trim();
      const i = options.indexOf(option);
      if (i >= 0) counts[i] += 1;
    }
  } else {
    const result = entries.find((e) => e.id === BAROMETER_BEFORE_ID)?.value;
    if (typeof result === "string") {
      // Split on the separators first: "Fiktion" is also part of "Eher Fiktion".
      for (const part of result.replace(/\s*\(.*\)\s*$/, "").split("·")) {
        const m = /^\s*(.+?):\s*(\d+)\s*$/.exec(part);
        const i = m ? options.indexOf(m[1]) : -1;
        if (m && i >= 0) counts[i] = Number(m[2]);
      }
    }
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const mean = total ? counts.reduce((sum, n, i) => sum + n * i, 0) / total : null;
  return { options, counts, total, mean };
}

/* ------------------------------------------------------------------ counts */

export interface RecapCounts {
  /** Day 1 entries that carry content. */
  contributions: number;
  /** Cards read out in card mode (every `karten-…` field). */
  cards: number;
  participants: number;
}

export function recapCounts(entries: CaptureEntry[], participants: Participant[]): RecapCounts {
  const day1 = entries.filter((e) => isDay1(e) && hasContent(e.value));
  const cards = day1
    .filter((e) => fieldOf(e.id).startsWith("karten-") && Array.isArray(e.value))
    .reduce((n, e) => n + (e.value as string[]).filter((l) => l.trim()).length, 0);
  return { contributions: day1.length, cards, participants: filledParticipants(participants).length };
}

/* ---------------------------------------------------------- open questions */

export interface OpenQuestion {
  id: string;
  slideId: string;
  question: string;
}

/** Own questions from the live record on day 1 that nobody has answered yet. */
export function openQuestions(entries: CaptureEntry[]): OpenQuestion[] {
  return entries
    .filter((e) => isDay1(e) && isAdhocQuestion(e) && e.prompt.trim() && !hasContent(e.value))
    .map((e) => ({ id: e.id, slideId: e.slideId, question: e.prompt.trim() }));
}

export function openForTomorrow(entries: CaptureEntry[]): string {
  const v = entries.find((e) => e.id === OPEN_FOR_TOMORROW_ID)?.value;
  return typeof v === "string" ? v.trim() : "";
}

/* ------------------------------------------------------- AI: five sentences */

const MAX_CONTRIBUTION_CHARS = 1200;

const RECAP_SYSTEM = `Du bist Moderationsassistenz im Zweitages-Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Tag 2 beginnt. Zum Einstieg fasst du zusammen, was die Gruppe an Tag 1 gemeinsam erarbeitet hat, damit alle mit demselben Stand in den Tag starten.

Regeln:
- Höchstens fünf Sätze, jeder Satz in einer eigenen Zeile, ohne Aufzählungszeichen, ohne Nummern, höchstens 25 Wörter pro Satz.
- Reihenfolge: Stimmung und Erwartungen zu Beginn · unser Kernproblem · Möglichkeitsraum und Stoßrichtungen · unser Zielbild · was für heute offen ist.
- Gibt das Material zu einem Punkt nichts her, lass ihn weg. Ein Satz weniger ist besser als eine Erfindung.
- Quelle ist ausschließlich das gelieferte Material. Erfinde keine Fakten, Zahlen, Namen, Termine oder Beschlüsse, keine Produkt- oder Anbieternamen. Nenne keine Personen.
- Poster-Ergebnisse haben Vorrang vor Zwischenständen der Arbeitsfolien.
- Bleib nah an den Formulierungen der Gruppe. Bewerte nichts und nimm nicht vorweg, wie Tag 2 ausgeht.
- Frühere Verbandsprojekte (z. B. „Wilma“) nur nennen, wenn ein Beitrag sie ausdrücklich nennt.
- Gemeinsame Perspektive („wir“), sachlich, Deutsch, neue Rechtschreibung.
- Antworte ausschließlich mit den Sätzen: keine Überschrift, keine Einleitung, keine Anführungszeichen drumherum.`;

function entryText(value: CaptureEntry["value"]): string {
  const text = (Array.isArray(value) ? value.map(formatCardLine).join("\n") : value).trim();
  return text.length > MAX_CONTRIBUTION_CHARS ? `${text.slice(0, MAX_CONTRIBUTION_CHARS)} …` : text;
}

/** True as soon as day 1 left anything the summary could be built from. */
export function hasRecapMaterial(entries: CaptureEntry[]): boolean {
  return entries.some((e) => isDay1(e) && !e.id.endsWith(VOTES_SUFFIX) && hasContent(e.value));
}

/**
 * Asks Claude for the day 1 recap in (at most) five sentences. Material: the
 * poster results as they hang on the wall, then every day 1 contribution in deck
 * order — prompts and answers, never participant names. Throws AiAssistError.
 */
export async function draftDayRecap(entries: CaptureEntry[], drafts: PosterState["drafts"]): Promise<string> {
  const posters = recapPhases(entries, drafts).map((p) => ({
    poster: `Phase ${p.phase} · ${p.title.de} (Folie ${p.slideId})`,
    felder: Object.fromEntries(
      [...p.slots, ...(p.status ? [p.status] : [])].filter((s) => s.text).map((s) => [s.label.de, s.text]),
    ),
  }));
  const material = entries
    .filter((e) => isDay1(e) && !e.id.endsWith(VOTES_SUFFIX) && hasContent(e.value))
    .map((e) => ({ folie: e.slideId, frage: e.prompt, beitrag: entryText(e.value) }));
  if (material.length === 0) throw new AiAssistError("empty", "day recap: no day 1 material");

  const prompt = [
    "<poster>",
    JSON.stringify(posters, null, 2),
    "</poster>",
    "",
    "<material>",
    JSON.stringify(material, null, 2),
    "</material>",
  ].join("\n");

  const answer = await completeText({ system: RECAP_SYSTEM, prompt, effort: "medium", logLabel: "day-recap 04.00" });
  return toLines(answer).join("\n");
}
