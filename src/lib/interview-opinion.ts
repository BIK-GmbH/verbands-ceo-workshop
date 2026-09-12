/**
 * Turns interview transcripts into opinion pictures (per person and for the
 * whole group) via Claude, and writes them into the workshop protocol on
 * slide 01.02 so they show up in /protokoll, PDF/Word and the posters.
 */
import type { Bilingual } from "@/types/slide";
import { completeText } from "@/lib/ai-assist";
import { getEntry, removeEntry, setEntry } from "@/lib/workshop-store";
import type { Interview } from "@/lib/interview-store";
import { parseOpinion, parseScalesOnly, type InterviewScales, type ParsedOpinion } from "@/lib/interview-metrics";

export const INTERVIEW_QUESTIONS: Bilingual[] = [
  { de: "Wie stehst du grundsätzlich zum Thema KI?", en: "What is your basic attitude towards AI?" },
  {
    de: "Welche fünf Begriffe fallen dir spontan zu KI ein?",
    en: "Which five terms come to mind spontaneously when you think of AI?",
  },
  { de: "Wie schätzt du deine eigene KI-Kompetenz ein?", en: "How do you rate your own AI competence?" },
  {
    de: "Wie relevant ist KI für den Verband heute – und wie relevant wird sie morgen sein?",
    en: "How relevant is AI for the association today – and how relevant will it be tomorrow?",
  },
  { de: "Wo siehst du konkrete Einsatzgebiete für KI?", en: "Where do you see concrete areas of application for AI?" },
  {
    de: "Vor welchen Top-Herausforderungen steht der Verband in den nächsten 3–5 Jahren – und wo könnte KI dabei konkret helfen?",
    en: "What top challenges will the association face in the next 3–5 years – and where could AI help concretely?",
  },
];

/** Recommended interview length used for the timer. */
export const TARGET_SECONDS = 5 * 60;

const CONTEXT =
  "Kontext: Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS), Phase 1 „Need to Move“. Vor dem Workshop wurden mit den Teilnehmenden (Vorstand und Mitglieder des Verbands) kurze Einzelinterviews von etwa fünf Minuten zu ihrer Einstellung zu KI und zum Nutzen für den FBS geführt.";

/** Machine-readable part of the answer: one JSON block, parsed by interview-metrics. */
const SCALE_BLOCK = `\`\`\`json
{"haltung": 3, "kompetenz": 2, "relevanzHeute": 2, "relevanzMorgen": 4, "begriffe": ["chatgpt", "automatisierung", "datenschutz"], "einsatzgebiete": ["Angebote schreiben", "Normen recherchieren"]}
\`\`\``;

const SCALE_RULES = `- haltung: 1 skeptisch · 2 abwartend · 3 neugierig · 4 überzeugt
- kompetenz: 1 Einsteiger · 2 Grundkenntnisse · 3 Fortgeschritten · 4 Experte
- relevanzHeute und relevanzMorgen: 1 gering · 2 mittel · 3 hoch · 4 sehr hoch
- Diese vier Werte sind je eine ganze Zahl von 1 bis 4 – oder null, wenn das Transkript dazu nichts hergibt. Nicht raten.
- begriffe: die im Interview genannten Begriffe zu KI, klein geschrieben, höchstens 5, sonst [].
- einsatzgebiete: höchstens 5 Kurzphrasen mit je 1–4 Wörtern, sonst [].
- Keine Namen, keine zusätzlichen Schlüssel, keine Kommentare, gültiges JSON.`;

const OPINION_SYSTEM = `${CONTEXT}

Du erhältst das Transkript eines solchen Interviews. Es stammt aus einer automatischen Spracherkennung, trennt die Sprecher nicht und kann Erkennungsfehler enthalten. Die interviewende Person liest die Leitfragen vor; ihre Worte sind nicht die Meinung der befragten Person.

Erstelle ein Meinungsbild der befragten Person. Regeln:
- Nur was im Transkript steht. Nichts erfinden, nichts aus Allgemeinwissen ergänzen. Fehlt ein Punkt, schreibe „nicht angesprochen“.
- Ordne Haltung, Kompetenz und Relevanz jeweils zuerst einer Stufe zu (fett), aber nur, wenn das Transkript es hergibt, sonst „nicht angesprochen“:
  Haltung: skeptisch · abwartend · neugierig · überzeugt
  Kompetenz: Einsteiger · Grundkenntnisse · Fortgeschritten · Experte
  Relevanz heute und morgen: gering · mittel · hoch · sehr hoch
- Offensichtliche Erkennungsfehler sinngemäß korrigieren (typische Begriffe: KI, ChatGPT, Kernbohrung, Wandsäge, Seilsäge, Geschäftsstelle, Vorstand, BG Bau).
- Keine Personennamen nennen; wenn nötig „die befragte Person“.
- Markante Zitate wörtlich aus dem Transkript (höchstens 3, je höchstens zwei Sätze, in „…“). Gibt es keine, schreibe „keine markanten Zitate“.
- Sachlich und knapp, Deutsch, neue Rechtschreibung, Stichpunkte mit „- “ wo es passt.
- Antworte ausschließlich mit Markdown in genau dieser Gliederung, ohne Einleitung und ohne Schlussbemerkung:

## Haltung zu KI
## Fünf Begriffe
## Selbsteinschätzung KI-Kompetenz
## Relevanz für den FBS heute / morgen
## Konkrete Einsatzgebiete
## Top-Herausforderungen des FBS (3–5 Jahre) und wo KI helfen könnte
## Markante Zitate
## Kurzfazit
(1–2 Sätze)

Hänge danach genau einen Codeblock an und sonst nichts. Er wird maschinell ausgewertet und nicht angezeigt:

${SCALE_BLOCK}

Regeln für den Codeblock:
${SCALE_RULES}`;

const SCALES_SYSTEM = `${CONTEXT}

Du erhältst das Transkript eines solchen Interviews und ordnest es vier Skalen zu. Antworte ausschließlich mit genau diesem Codeblock, ohne Einleitung, ohne Erklärung, ohne weiteren Text:

${SCALE_BLOCK}

Regeln:
${SCALE_RULES}`;

const GROUP_SYSTEM = `${CONTEXT}

Du erhältst die Meinungsbilder aller bisher ausgewerteten Einzelinterviews. Erstelle daraus ein gemeinsames Meinungsbild der Gruppe als Diskussionsgrundlage für Phase 1. Regeln:
- Nur auf Basis der Meinungsbilder. Nichts erfinden.
- Die Kennzahlen (Verteilung, Mittelwert Ø, Streuung σ, Spanne, Lücke heute → morgen) sind bereits ausgezählt und stehen im Abschnitt <kennzahlen>. Übernimm Zahlen ausschließlich von dort, rechne nichts nach und erfinde keine abweichenden Verteilungen.
- Greife Mittelwert und Streuung in Worten auf (einig, gemischt, uneinig) und benenne die Lücke zwischen Relevanz heute und morgen.
- Punkte ohne Kennzahl exakt aus den Meinungsbildern auszählen und als „x von n“ angeben (z. B. „4 von 7 neugierig“); „nicht angesprochen“ gesondert zählen, wenn es relevant ist.
- Streng anonym: keine Namen, keine Pseudonyme, keine Interview-Nummern und keine Details, die eine einzelne Person erkennbar machen.
- Zitate nur wörtlich aus den Meinungsbildern übernehmen, ohne Zuordnung, höchstens 5.
- Sachlich und knapp, Deutsch, neue Rechtschreibung, Stichpunkte mit „- “ wo es passt.
- Antworte ausschließlich mit Markdown in genau dieser Gliederung, ohne Einleitung und ohne Schlussbemerkung:

## Gesamtbild der Haltungen
## Häufigste Begriffe
## KI-Kompetenz in der Gruppe
## Relevanz heute vs. morgen
## Gemeinsame Einsatzgebiete
## Top-Herausforderungen (nach Häufigkeit gerankt)
## Unterschiede und Spannungen
## Drei Kernaussagen als Diskussionsimpuls
(genau drei, nummeriert)
## Ausgewählte Zitate`;

function transcriptPrompt(transcript: string): string {
  return [
    "Leitfragen des Interviews:",
    ...INTERVIEW_QUESTIONS.map((q, i) => `${i + 1}. ${q.de}`),
    "",
    "<transkript>",
    transcript,
    "</transkript>",
  ].join("\n");
}

/**
 * Opinion picture plus scale values for one interview, in a single call. The
 * pseudonym is deliberately not sent. `scales` is null when the model returned
 * no usable JSON block — the text is kept either way. Throws AiAssistError.
 */
export async function summarizeInterview(transcript: string, logLabel: string): Promise<ParsedOpinion> {
  const raw = await completeText({ system: OPINION_SYSTEM, prompt: transcriptPrompt(transcript), effort: "medium", logLabel });
  const parsed = parseOpinion(raw);
  if (!parsed.scales) console.error("[interviews] no usable scale values in the answer", { feature: logLabel });
  return parsed;
}

/** Re-derives only the scale values, e.g. after a failed block. Throws AiAssistError. */
export async function deriveScales(transcript: string, logLabel: string): Promise<InterviewScales | null> {
  const raw = await completeText({ system: SCALES_SYSTEM, prompt: transcriptPrompt(transcript), effort: "low", logLabel });
  return parseScalesOnly(raw);
}

/**
 * Anonymous group opinion over all per-interview opinions. `metrics` is the
 * locally computed summary (see interview-metrics) so the text matches the figures.
 * Throws AiAssistError.
 */
export function summarizeGroup(opinions: string[], metrics: string): Promise<string> {
  const prompt = [
    `Anzahl ausgewerteter Interviews: ${opinions.length}`,
    "",
    "<kennzahlen>",
    metrics.trim() || "Keine Kennzahlen verfügbar.",
    "</kennzahlen>",
    "",
    ...opinions.map((o, i) => `<meinungsbild nr="${i + 1}">\n${o.trim()}\n</meinungsbild>\n`),
  ].join("\n");
  return completeText({ system: GROUP_SYSTEM, prompt, effort: "medium", logLabel: "interview group opinion" });
}

// ---------------------------------------------------------------------------
// Protocol (slide 01.02, module 1)

const SLIDE_ID = "01.02";
export const GROUP_PROTOCOL_ID = `${SLIDE_ID}:meinungsbild-gesamt`;
export const GROUP_METRICS_PROTOCOL_ID = `${SLIDE_ID}:gruppenbild-kennzahlen`;
export const interviewProtocolId = (interviewId: string) => `${SLIDE_ID}:interview-${interviewId}`;

/**
 * The protocol, PDF and Word export show plain text, so Markdown markers are
 * turned into readable plain-text structure.
 */
export function markdownToPlain(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (heading) return `\n${stripInline(heading[1])}:`;
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) return `${bullet[1]}• ${stripInline(bullet[2])}`;
    return stripInline(line.replace(/^\s*>\s?/, ""));
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripInline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/(^|\s)\*(\S.*?)\*/g, "$1$2").trim();
}

/** Writes one interview opinion into the protocol; returns the fields that record the synced state. */
export function writeInterviewToProtocol(iv: Interview): Pick<Interview, "protocolText" | "protocolPseudonym"> {
  const text = iv.opinion ?? "";
  setEntry({
    id: interviewProtocolId(iv.id),
    module: 1,
    slideId: SLIDE_ID,
    kind: "text",
    prompt: `Meinungsbild · ${iv.pseudonym}`,
    value: markdownToPlain(text),
  });
  return { protocolText: text, protocolPseudonym: iv.pseudonym };
}

export function removeInterviewFromProtocol(interviewId: string) {
  removeEntry(interviewProtocolId(interviewId));
}

export function writeGroupToProtocol(text: string) {
  setEntry({
    id: GROUP_PROTOCOL_ID,
    module: 1,
    slideId: SLIDE_ID,
    kind: "text",
    prompt: "Gemeinsames Meinungsbild aus den KI-Interviews",
    value: markdownToPlain(text),
  });
}

/**
 * The locally computed figures, as a second entry next to the AI text. Written
 * on every change, so a corrected scale value lands in the protocol right away.
 */
export function writeGroupMetricsToProtocol(text: string) {
  if (getEntry(GROUP_METRICS_PROTOCOL_ID)?.value === text) return;
  setEntry({
    id: GROUP_METRICS_PROTOCOL_ID,
    module: 1,
    slideId: SLIDE_ID,
    kind: "text",
    prompt: "Gruppenbild: Kennzahlen aus den KI-Interviews",
    value: text,
  });
}

export function removeGroupMetricsFromProtocol() {
  if (getEntry(GROUP_METRICS_PROTOCOL_ID)) removeEntry(GROUP_METRICS_PROTOCOL_ID);
}

export const isInProtocol = (iv: Interview) =>
  Boolean(iv.opinion) && iv.protocolText === iv.opinion && iv.protocolPseudonym === iv.pseudonym;
