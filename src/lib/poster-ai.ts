/**
 * Poster AI — two steps, one Claude call each (one round trip is quick enough for
 * the live session):
 * - `condensePoster` ("Mit KI verdichten") shortens what is already written in the
 *   poster's own fields to poster-ready wording.
 * - `draftPoster` ("Aus dem Protokoll vorschlagen") proposes a complete first
 *   version of the poster from everything captured up to this phase, so nobody
 *   has to formulate it all over again while standing at the wall.
 */
import { AiAssistError, completeText } from "@/lib/ai-assist";
import { formatCardLine } from "@/lib/cards";
import type { CondenseMode, PosterDef } from "@/lib/posters";
import type { CaptureEntry } from "@/lib/workshop-store";

const MODE_RULE: Record<CondenseMode, string> = {
  sentence: "ein prägnanter Satz, höchstens 20 Wörter",
  bullets: "3–5 Stichpunkte, jeder höchstens 8 Wörter, jede Zeile beginnt mit „- “",
  short: "eine kurze Zeile, höchstens 8 Wörter, ohne Aufzählungszeichen",
  tagline: "eine zugespitzte Filmplakat-Tagline, ein Satz, höchstens 12 Wörter, ohne Anführungszeichen",
};

/**
 * „Unser Bild“ auf dem Zielbild-Poster (Folie 03.05) ist kein Satz, sondern die
 * Beschreibung einer Szene. Sie soll aus Leitsatz, Profil, Use Cases,
 * Stoßrichtungen und Kernproblem entstehen, damit sie am Poster nicht neu
 * erfunden werden muss.
 */
const IMAGE_FIELD_ID = "03.05:poster-bild";
const IMAGE_RULE =
  "eine anschauliche Bildbeschreibung in 2–3 Sätzen, höchstens 45 Wörter: Was wäre auf dem Bild zu sehen? Ort, beteiligte Personen, was der KI-Geschäftsführer dort tut und woran man den Nutzen erkennt. Nur Motive verwenden, die sich aus Leitsatz, Profil, ersten Use Cases, Stoßrichtungen und Kernproblem ergeben.";

function fieldRule(entryId: string, condense: CondenseMode | undefined): string {
  return entryId === IMAGE_FIELD_ID ? IMAGE_RULE : MODE_RULE[condense ?? "bullets"];
}

const WORKSHOP_ROLE = `Du bist Poster-Redakteur im Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Aus den im Workshop erfassten Beiträgen entsteht ein großformatiges Poster, das man aus drei Metern Entfernung lesen können muss.`;

const SYSTEM = `${WORKSHOP_ROLE}

Regeln:
- Verdichte jedes Feld auf das vorgegebene Format. Kernaussagen behalten, Füllwörter und Wiederholungen streichen.
- Erfinde nichts: keine neuen Fakten, Zahlen, Namen, Termine oder Beschlüsse. Nutze nur, was im jeweiligen Feld steht.
- Schreibe in der Sprache des Beitrags (in der Regel Deutsch), sachlich, neue Rechtschreibung.
- Antworte ausschließlich mit einem JSON-Objekt, das jede Feld-ID auf den verdichteten Text abbildet, ohne Einleitung und ohne Codeblock.`;

const DRAFT_SYSTEM = `${WORKSHOP_ROLE}

Du lieferst einen Vorentwurf: Die Teilnehmenden stehen am Poster und sollen ihn nur noch feinjustieren, statt alles neu zu formulieren. Das Material sind die Beiträge, die in dieser und in den vorherigen Phasen erfasst wurden.

Regeln:
- Quelle ist ausschließlich das gelieferte Material. Erfinde nichts: keine Fakten, Zahlen, Namen, Termine, Beschlüsse, keine Produkt- oder Anbieternamen.
- Verdichte und führe zusammen, was inhaltlich zusammengehört; bleib dabei nah an den Formulierungen der Gruppe.
- Jedes Feld genau in seinem vorgegebenen Format.
- Gibt das Material für ein Feld nichts Belastbares her, lass die Feld-ID weg. Ein leeres Feld ist besser als eine Erfindung.
- Steht bei einem Feld schon eine Fassung („bisher“), nimm sie als Ausgangspunkt und ergänze sie aus dem Material, statt sie zu ersetzen.
- Schreibe aus der gemeinsamen Perspektive („wir“), sachlich, auf Deutsch, neue Rechtschreibung.
- Antworte ausschließlich mit einem JSON-Objekt, das jede Feld-ID auf den Text abbildet, ohne Einleitung und ohne Codeblock.`;

export interface CondenseInput {
  entryId: string;
  text: string;
}

/** The answer's JSON object, reduced to the requested field ids with non-empty text. */
function pickFields(answer: string, ids: string[], label: string): Record<string, string> {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiAssistError("api", `${label}: no JSON object in answer`);
  const parsed = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const id of ids) {
    const v = parsed[id];
    if (typeof v === "string" && v.trim()) out[id] = v.trim();
  }
  return out;
}

function parseOrThrow(answer: string, ids: string[], label: string, poster: string): Record<string, string> {
  try {
    return pickFields(answer, ids, label);
  } catch (err) {
    if (err instanceof AiAssistError) throw err;
    console.error("[poster-ai] unparseable answer", { poster, feature: label, detail: String(err) });
    throw new AiAssistError("api", `${label}: invalid JSON`);
  }
}

/** Returns entry id → condensed text for the given (non-empty) text fields. Throws AiAssistError. */
export async function condensePoster(def: PosterDef, inputs: CondenseInput[]): Promise<Record<string, string>> {
  const fields = inputs.map(({ entryId, text }) => {
    const f = def.fields.find((x) => x.entryId === entryId);
    return {
      id: entryId,
      feld: f?.label.de ?? entryId,
      format: fieldRule(entryId, f?.condense),
      text,
    };
  });
  const prompt = [
    `Poster: Phase ${def.phase} · ${def.title.de}`,
    `Kernfrage: ${def.question.de}`,
    "",
    "<felder>",
    JSON.stringify(fields, null, 2),
    "</felder>",
  ].join("\n");

  const answer = await completeText({ system: SYSTEM, prompt, effort: "low", logLabel: `poster ${def.key}` });
  const out = parseOrThrow(
    answer,
    fields.map((f) => f.id),
    "poster condense",
    def.key,
  );
  if (Object.keys(out).length === 0) throw new AiAssistError("empty");
  return out;
}

/* ------------------------------------------------- draft from the record */

export interface DraftPosterOptions {
  /**
   * What the poster currently shows per field (entry id → text). Goes into the
   * material as the wording to build on; fields left out are drafted from scratch.
   */
  current?: Record<string, string>;
}

/** Long contributions are cut: the material must stay readable for one call. */
const MAX_CONTRIBUTION_CHARS = 1500;

function entryText(value: CaptureEntry["value"]): string {
  const text = (Array.isArray(value) ? value.map(formatCardLine).join("\n") : value).trim();
  return text.length > MAX_CONTRIBUTION_CHARS ? `${text.slice(0, MAX_CONTRIBUTION_CHARS)} …` : text;
}

interface Source {
  folie: string;
  frage: string;
  beitrag: string;
}

/**
 * The material for one poster: every captured contribution from this phase and
 * the phases before it — prompts and answers, never participant names.
 */
export function draftSources(def: PosterDef, entries: CaptureEntry[]): Source[] {
  return entries
    .filter((e) => e.module <= def.phase)
    .map((e) => ({ folie: e.slideId, frage: e.prompt, beitrag: entryText(e.value) }))
    .filter((s) => s.beitrag);
}

/**
 * Proposes one text per poster field from everything captured so far — a draft
 * the group only fine-tunes. Choice fields (votes, traffic lights, barometer)
 * are never proposed: they come from the record as they were decided.
 *
 * Returns entry id → proposed text; fields without usable material are left out
 * (an empty object means the record does not carry the poster yet).
 * Throws AiAssistError.
 */
export async function draftPoster(
  def: PosterDef,
  entries: CaptureEntry[],
  options: DraftPosterOptions = {},
): Promise<Record<string, string>> {
  const material = draftSources(def, entries);
  if (material.length === 0) return {};

  const fields = def.fields
    .filter((f) => f.kind === "text")
    .map((f) => {
      const current = options.current?.[f.entryId]?.trim();
      return {
        id: f.entryId,
        feld: f.label.de,
        format: fieldRule(f.entryId, f.condense),
        ...(current ? { bisher: current } : {}),
      };
    });
  if (fields.length === 0) return {};

  const prompt = [
    def.special ? `Poster: ${def.title.de}` : `Poster: Phase ${def.phase} · ${def.title.de}`,
    `Kernfrage: ${def.question.de}`,
    `Ergebnis dieser Phase: ${def.output.de}`,
    "",
    "<material>",
    JSON.stringify(material, null, 2),
    "</material>",
    "",
    "<felder>",
    JSON.stringify(fields, null, 2),
    "</felder>",
  ].join("\n");

  const answer = await completeText({
    system: DRAFT_SYSTEM,
    prompt,
    // A synthesis across several phases, not a one-field rewording.
    effort: "medium",
    logLabel: `poster-draft ${def.key}`,
  });
  return parseOrThrow(
    answer,
    fields.map((f) => f.id),
    "poster draft",
    def.key,
  );
}
