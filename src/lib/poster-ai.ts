/**
 * "Mit KI verdichten": shortens the captured contributions of one poster to
 * poster-ready wording in a single Claude call (one round trip instead of one
 * per field keeps it quick enough for the live session).
 */
import { AiAssistError, completeText } from "@/lib/ai-assist";
import type { CondenseMode, PosterDef } from "@/lib/posters";

const MODE_RULE: Record<CondenseMode, string> = {
  sentence: "ein prägnanter Satz, höchstens 20 Wörter",
  bullets: "3–5 Stichpunkte, jeder höchstens 8 Wörter, jede Zeile beginnt mit „- “",
  short: "eine kurze Zeile, höchstens 8 Wörter, ohne Aufzählungszeichen",
};

const SYSTEM = `Du bist Poster-Redakteur im Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Aus den im Workshop erfassten Beiträgen entsteht ein großformatiges Poster, das man aus drei Metern Entfernung lesen können muss.

Regeln:
- Verdichte jedes Feld auf das vorgegebene Format. Kernaussagen behalten, Füllwörter und Wiederholungen streichen.
- Erfinde nichts: keine neuen Fakten, Zahlen, Namen, Termine oder Beschlüsse. Nutze nur, was im jeweiligen Feld steht.
- Schreibe in der Sprache des Beitrags (in der Regel Deutsch), sachlich, neue Rechtschreibung.
- Antworte ausschließlich mit einem JSON-Objekt, das jede Feld-ID auf den verdichteten Text abbildet, ohne Einleitung und ohne Codeblock.`;

export interface CondenseInput {
  entryId: string;
  text: string;
}

function parseAnswer(answer: string, ids: string[]): Record<string, string> {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiAssistError("api", "poster condense: no JSON object in answer");
  const parsed = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const id of ids) {
    const v = parsed[id];
    if (typeof v === "string" && v.trim()) out[id] = v.trim();
  }
  if (Object.keys(out).length === 0) throw new AiAssistError("empty");
  return out;
}

/** Returns entry id → condensed text for the given (non-empty) text fields. Throws AiAssistError. */
export async function condensePoster(def: PosterDef, inputs: CondenseInput[]): Promise<Record<string, string>> {
  const fields = inputs.map(({ entryId, text }) => {
    const f = def.fields.find((x) => x.entryId === entryId);
    return {
      id: entryId,
      feld: f?.label.de ?? entryId,
      format: MODE_RULE[f?.condense ?? "bullets"],
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
  try {
    return parseAnswer(answer, fields.map((f) => f.id));
  } catch (err) {
    if (err instanceof AiAssistError) throw err;
    console.error("[poster-ai] unparseable answer", { poster: def.key, detail: String(err) });
    throw new AiAssistError("api", "poster condense: invalid JSON");
  }
}
