/**
 * KI-Ergebnisbericht: condenses ALL captured contributions into one structured
 * results report (Claude, opt-in) and keeps it locally so it survives reloads.
 *
 * Only generation sends data to the Claude API (the contributions themselves;
 * the participant list stays local). The report is stored in localStorage and
 * can be edited by hand afterwards.
 */
import { useSyncExternalStore } from "react";
import type { Lang } from "@/types/slide";
import { completeText } from "./ai-assist";
import { MANIFEST, findModule, findSlide } from "./slides";
import { getState, filledParticipants, type CaptureEntry, type CaptureKind } from "./workshop-store";
import { hasValue, isAdHoc } from "./protocol-export";
import { formatCardLine } from "./cards";

/* ------------------------------------------------------------------ prompt */

const HEADINGS: Record<Lang, string[]> = {
  de: [
    "Management Summary",
    "Ausgangslage & Meinungsbild",
    "Phase 1 – Need to Move: Kernproblem",
    "Phase 2 – Möglichkeitsraum & Stoßrichtungen",
    "Phase 3 – Zielbild",
    "Phase 4 – Realitätscheck FBS (eigene Erfahrungen, GO/ADAPT/STOP)",
    "Phase 5 – Wirtschaftlichkeit & Argumentation",
    "Phase 6 – Roadmap",
    "Phase 7 – Commitment & Beschluss",
    "Offene Fragen",
    "Nächste Schritte & Verantwortliche",
  ],
  en: [
    "Management Summary",
    "Starting Point & Opinions",
    "Phase 1 – Need to Move: Core Problem",
    "Phase 2 – Space of Possibilities & Directions",
    "Phase 3 – Target Picture",
    "Phase 4 – FBS Reality Check (own experience, GO/ADAPT/STOP)",
    "Phase 5 – Economics & Argumentation",
    "Phase 6 – Roadmap",
    "Phase 7 – Commitment & Decision",
    "Open Questions",
    "Next Steps & Responsibilities",
  ],
};

const EMPTY_SECTION: Record<Lang, string> = {
  de: "Keine Beiträge erfasst.",
  en: "No contributions recorded.",
};

const KIND_LABEL: Record<CaptureKind, string> = {
  text: "Freitext",
  decision: "Entscheidung",
  vote: "Abstimmung",
  checklist: "Checkliste",
};

function buildSystem(lang: Lang): string {
  const headings = HEADINGS[lang].map((h) => `   ## ${h}`).join("\n");
  const language =
    lang === "en"
      ? "Schreibe den gesamten Bericht auf Englisch (britisches Englisch); übertrage die deutschen Beiträge sinngemäß."
      : "Schreibe den gesamten Bericht auf Deutsch (neue Rechtschreibung).";
  return `Du bist sachlicher Protokoll-Redakteur für den Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS) am 16./17.09.2026. Moderation: Harald Ostermann (Innovationswerkstatt & Digital Management School). Experteninput: Dr. Stefan Reinheimer (BIK GmbH).

Aufgabe: Verdichte die im Workshop erfassten Beiträge zu einem strukturierten, gut lesbaren Ergebnisbericht. Die Beiträge wurden live getippt oder diktiert und sind teils stichwortartig.

Regeln:
- Verwende ausschließlich Inhalte aus den Beiträgen. Erfinde keine Fakten, Zahlen, Termine, Beschlüsse, Verantwortlichen oder Zitate. Was nicht erfasst ist, kommt im Bericht nicht vor.
- Benenne Widersprüche, abweichende Einschätzungen und offene Punkte ausdrücklich, statt sie zu glätten.
- Nenne keine Personennamen außer den Veranstaltern (Harald Ostermann, Dr. Stefan Reinheimer). Stehen Namen in den Beiträgen, umschreibe sie mit Rolle oder Funktion (z. B. „ein Vorstandsmitglied“, „die Geschäftsstelle“).
- Herstellerneutral: keine Produkt-, Anbieter- oder Werkzeugempfehlungen und keine Marken- oder Produktnamen, auch wenn Beiträge solche nennen. Verwende neutrale Begriffe wie „Wissensbasis“, „KI-Assistent“, „KI-Agent“, „Plattform“.
- Frühere Verbandsprojekte (z. B. „Wilma“) nennst du nie in Überschriften und im Fließtext nur, wenn ein Beitrag sie ausdrücklich nennt – nicht aufgrund von Modul- oder Folientiteln.
- Die Antwort auf die Leitfrage gibt die Gruppe. Nimm keine Antwort und keine Empfehlung vorweg, die nicht in den Beiträgen steht.
- Korrigiere offensichtliche Diktat- und Erkennungsfehler sinngemäß (typische Begriffe: Kernbohrung, Wandsäge, Seilsäge, Bauwerksmechaniker, BG Bau, DIN 18459, VOB, Geschäftsstelle, Vorstand, Ausschuss, Wilma), bleibe inhaltlich treu.
- Stil: sachlich, klar, im Ton eines Verbandsprotokolls; Fließtext in vollständigen Sätzen, knappe Aufzählungen, wo sie die Lesbarkeit verbessern.

Zuordnung der Beiträge: Modul 0 = Auftakt (u. a. Barometer vorher, Folie 00.08). Modul 1 = Phase 1 Need to Move (Folie 01.02: KI-Interviews, gemessene Auswertung und gemeinsames Meinungsbild). Modul 2 = Phase 2 Möglichkeitsraum. Modul 3 = Phase 3 Zielbild. Modul 4 = Phase 4 Realitätscheck FBS (eigene Erfahrungen des Verbands) inkl. GO/ADAPT/STOP. Modul 5 = Phase 5 Wirtschaftlichkeit & Argumentation. Modul 6 = Phase 6 Roadmap. Modul 7 = Phase 7 Commitment (u. a. Barometer nachher 07.02, offene Fragen 07.03, Beschluss 07.04). Felder, deren Name mit „poster-“ beginnt, sind die verdichteten Phasenergebnisse (Poster) und tragen die Kernaussage des jeweiligen Abschnitts. Beiträge mit der Antwort „(offen)“ sind eigene Fragen oder Aufgaben ohne Antwort: führe sie unter den offenen Fragen auf.

Format (Markdown):
1. Kein Titel, keine Überschrift erster Ebene, keine Vor- oder Schlussbemerkung außerhalb der Gliederung.
2. Genau diese Abschnitte als Überschriften zweiter Ebene, in dieser Reihenfolge und mit genau diesem Wortlaut:
${headings}
3. Innerhalb der Abschnitte sind Zwischenüberschriften „### “, Absätze, Aufzählungen mit „- “ und **Fettdruck** erlaubt. Keine Tabellen, Links, Bilder, Code oder HTML.
4. Management Summary: 5–8 Sätze Fließtext. Enthält die Antwort der Gruppe auf die Leitfrage (ist keine erfasst, sag das ausdrücklich) und das Barometer vorher/nachher, sofern erfasst.
5. Ausgangslage & Meinungsbild: Anlass, Haltung und KI-Kompetenz der Gruppe. Gibt es den Beitrag „01.02:i7-meinungsbild-gesamt“ (gemeinsames Meinungsbild aus den KI-Interviews), fasse ihn hier zusammen. Die Beiträge „01.02:i1-haltung“ bis „01.02:i6-einsatzgebiete“ und „01.02:i8-gruppenbild-kennzahlen“ sind die gemessene Auswertung der Interviews (Mittelwert Ø, Streuung σ, Spanne, n); übernimm ihre Zahlen unverändert und rechne nichts nach. Ein Wert mit dem Zusatz „von Hand gesetzt“ wurde von der Moderation ergänzt, weil dazu kein Interview vorlag – nenne ihn als Einschätzung der Runde, nicht als Messwert.
6. Nächste Schritte & Verantwortliche: nur Schritte, Termine und Verantwortliche, die in den Beiträgen stehen; Verantwortliche als Rolle, nicht als Name (außer Veranstalter).
7. Gibt es für einen Abschnitt keine passenden Beiträge, steht darunter nur: „${EMPTY_SECTION[lang]}“
8. ${language}`;
}

/** Contributions that go into the report: answered entries plus open ad-hoc questions. */
export function reportEntries(entries: CaptureEntry[]): CaptureEntry[] {
  return entries.filter((e) => hasValue(e) || isAdHoc(e));
}

const attr = (s: string) => s.replace(/["<>\n]/g, " ").trim();

function answerText(e: CaptureEntry): string {
  if (!hasValue(e)) return "(offen)";
  if (Array.isArray(e.value)) return e.value.map((v) => `\n- ${formatCardLine(v)}`).join("");
  return e.value.trim();
}

function entryBlock(e: CaptureEntry): string {
  const field = e.id.split(":")[1] ?? e.id;
  const slideTitle = findSlide(e.slideId)?.title.de ?? "";
  return [
    `<beitrag id="${attr(e.id)}" folie="${attr(e.slideId)}" folientitel="${attr(slideTitle)}" feld="${attr(field)}" art="${KIND_LABEL[e.kind] ?? e.kind}">`,
    `Frage: ${e.prompt.trim()}`,
    `Antwort: ${answerText(e)}`,
    `</beitrag>`,
  ].join("\n");
}

export interface ReportRequest {
  system: string;
  prompt: string;
  /** Number of contributions included */
  count: number;
}

/** Builds the Claude request from the current store: all modules in manifest order, entries grouped per module. */
export function buildReportRequest(lang: Lang, hints: string): ReportRequest {
  const { meta, entries } = getState();
  const list = reportEntries(Object.values(entries)).sort((a, b) => a.id.localeCompare(b.id));
  const people = filledParticipants(meta.participantsList).length;

  const byModule = new Map<number, CaptureEntry[]>();
  for (const e of list) byModule.set(e.module, [...(byModule.get(e.module) ?? []), e]);
  // Manifest modules first (also empty ones, so the model can mark them), then any unknown module numbers.
  const order = [...MANIFEST.map((m) => m.index), ...[...byModule.keys()].filter((k) => !findModule(k)).sort((a, b) => a - b)];

  const modules = order.map((index) => {
    const title = findModule(index)?.title.de ?? `Modul ${index}`;
    const items = byModule.get(index) ?? [];
    const body = items.length ? items.map(entryBlock).join("\n\n") : "(keine Beiträge erfasst)";
    return `<modul nr="${index}" titel="${attr(title)}">\n${body}\n</modul>`;
  });

  const parts = [
    `Workshop: ${meta.title}`,
    `Termin: ${meta.date || "16./17.09.2026"}`,
    `Anzahl erfasster Beiträge: ${list.length}`,
    // Only the head count — names, organisations and roles never leave the browser.
    ...(people ? [`Anzahl Teilnehmende: ${people}`] : []),
    "",
    "<beitraege>",
    modules.join("\n\n"),
    "</beitraege>",
  ];
  const note = hints.trim();
  if (note) {
    parts.push(
      "",
      "Hinweise der Moderation zu Form, Zielgruppe oder Länge des Berichts (die Regeln oben gelten weiterhin):",
      "<hinweise>",
      note,
      "</hinweise>",
    );
  }
  parts.push("", "Schreibe jetzt den Ergebnisbericht in der vorgegebenen Gliederung.");
  return { system: buildSystem(lang), prompt: parts.join("\n"), count: list.length };
}

/* ----------------------------------------------------------------- storage */

export interface StoredReport {
  markdown: string;
  /** ISO timestamp taken when generation started (later edits to entries make the report stale) */
  createdAt: string;
  /** Number of contributions the report was generated from */
  entryCount: number;
  lang: Lang;
  hints: string;
  /** Set once the report text was edited by hand */
  editedAt?: string;
}

/** Storage key of the results report — the backup (backup.ts) reads and restores it. */
export const REPORT_KEY = "verbands-ceo.report.v1";
const REPORT_EVENT = "workshop-report-change";

// Referentially stable snapshot for useSyncExternalStore, keyed on the raw string.
let cacheRaw: string | null | undefined;
let cacheReport: StoredReport | null = null;

/** Validates one stored/imported report object; null when it is unusable. */
function coerceReport(raw: unknown): StoredReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<StoredReport>;
  if (typeof r.markdown !== "string" || typeof r.createdAt !== "string" || typeof r.entryCount !== "number") return null;
  return {
    markdown: r.markdown,
    createdAt: r.createdAt,
    entryCount: r.entryCount,
    lang: r.lang === "en" ? "en" : "de",
    hints: typeof r.hints === "string" ? r.hints : "",
    editedAt: typeof r.editedAt === "string" ? r.editedAt : undefined,
  };
}

function parseReport(raw: string | null): StoredReport | null {
  if (!raw) return null;
  try {
    return coerceReport(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Restores a report from a backup file. Returns false when the file carries none. */
export function restoreReport(raw: unknown): boolean {
  const report = coerceReport(raw);
  if (!report) return false;
  saveReport(report);
  return true;
}

export function getReport(): StoredReport | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(REPORT_KEY);
  } catch {
    return null;
  }
  if (raw === cacheRaw) return cacheReport;
  cacheRaw = raw;
  cacheReport = parseReport(raw);
  return cacheReport;
}

/** Throws if the browser blocks storage (quota / policy). */
function saveReport(report: StoredReport) {
  window.localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  window.dispatchEvent(new CustomEvent(REPORT_EVENT));
}

/** Replaces the report text after a manual edit. */
export function updateReportMarkdown(markdown: string) {
  const current = getReport();
  if (!current) return;
  saveReport({ ...current, markdown, editedAt: new Date().toISOString() });
}

export function clearReport() {
  try {
    window.localStorage.removeItem(REPORT_KEY);
  } finally {
    window.dispatchEvent(new CustomEvent(REPORT_EVENT));
  }
}

function subscribeReport(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === REPORT_KEY) cb();
  };
  window.addEventListener(REPORT_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(REPORT_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useReport(): StoredReport | null {
  return useSyncExternalStore(subscribeReport, getReport, () => null);
}

/** True when contributions were added, removed or changed since the report was generated. */
export function isReportStale(report: StoredReport, entries: CaptureEntry[]): boolean {
  const relevant = reportEntries(entries);
  return relevant.length !== report.entryCount || relevant.some((e) => e.updatedAt > report.createdAt);
}

/** Strips a wrapping ```markdown fence the model may add despite the instructions. */
function unfence(text: string): string {
  const m = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/.exec(text.trim());
  return (m ? m[1] : text).trim();
}

/** Generates the report with Claude and stores it. Throws AiAssistError (or a storage error). */
export async function generateReport(lang: Lang, hints: string): Promise<StoredReport> {
  const createdAt = new Date().toISOString();
  const { system, prompt, count } = buildReportRequest(lang, hints);
  const markdown = await completeText({ system, prompt, effort: "medium", logLabel: "report" });
  const report: StoredReport = { markdown: unfence(markdown), createdAt, entryCount: count, lang, hints: hints.trim() };
  saveReport(report);
  return report;
}
