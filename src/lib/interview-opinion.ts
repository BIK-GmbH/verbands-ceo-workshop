/**
 * Turns interview transcripts into opinion pictures (per person and for the
 * whole group) via Claude, and writes them into the workshop protocol on
 * slide 01.02 so they show up in /protokoll, PDF/Word and the posters.
 */
import type { Bilingual } from "@/types/slide";
import { completeText } from "@/lib/ai-assist";
import { removeEntry, setEntry } from "@/lib/workshop-store";
import type { Interview } from "@/lib/interview-store";

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
(1–2 Sätze)`;

const GROUP_SYSTEM = `${CONTEXT}

Du erhältst die Meinungsbilder aller bisher ausgewerteten Einzelinterviews. Erstelle daraus ein gemeinsames Meinungsbild der Gruppe als Diskussionsgrundlage für Phase 1. Regeln:
- Nur auf Basis der Meinungsbilder. Nichts erfinden.
- Verteilungen exakt auszählen und immer als „x von n“ angeben (z. B. „4 von 7 neugierig“); „nicht angesprochen“ gesondert zählen, wenn es relevant ist.
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

/** Opinion picture for one interview. The pseudonym is deliberately not sent. Throws AiAssistError. */
export function summarizeInterview(transcript: string, logLabel: string): Promise<string> {
  const prompt = [
    "Leitfragen des Interviews:",
    ...INTERVIEW_QUESTIONS.map((q, i) => `${i + 1}. ${q.de}`),
    "",
    "<transkript>",
    transcript,
    "</transkript>",
  ].join("\n");
  return completeText({ system: OPINION_SYSTEM, prompt, effort: "medium", logLabel });
}

/** Anonymous group opinion over all per-interview opinions. Throws AiAssistError. */
export function summarizeGroup(opinions: string[]): Promise<string> {
  const prompt = [
    `Anzahl ausgewerteter Interviews: ${opinions.length}`,
    "",
    ...opinions.map((o, i) => `<meinungsbild nr="${i + 1}">\n${o.trim()}\n</meinungsbild>`),
  ].join("\n\n");
  return completeText({ system: GROUP_SYSTEM, prompt, effort: "medium", logLabel: "interview group opinion" });
}

// ---------------------------------------------------------------------------
// Protocol (slide 01.02, module 1)

const SLIDE_ID = "01.02";
export const GROUP_PROTOCOL_ID = `${SLIDE_ID}:meinungsbild-gesamt`;
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

export const isInProtocol = (iv: Interview) =>
  Boolean(iv.opinion) && iv.protocolText === iv.opinion && iv.protocolPseudonym === iv.pseudonym;
