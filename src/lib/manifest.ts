import type { ModuleMeta } from "@/types/slide";

/**
 * Single source of truth for module/slide order & IDs.
 * Workshop: "Der KI-augmentierte Verbands-CEO" — Halbtags-Vorstandsworkshop
 * für den Fachverband Betonbohren und -sägen Deutschland e. V. (FBS).
 * Aufgebaut entlang der 6 Konzeptkapitel + Auftakt + Ergebnis-Werkstatt + Anhang.
 */
export const MANIFEST: ModuleMeta[] = [
  {
    index: 0,
    title: { de: "Auftakt", en: "Kickoff" },
    description: { de: "Ziel, Ablauf, Spielregeln", en: "Goal, flow, ground rules" },
    slides: [
      { id: "00.01", module: 0, slide: 1, title: { de: "Cover", en: "Cover" } },
      { id: "00.02", module: 0, slide: 2, title: { de: "Begrüßung & wie dieser Workshop funktioniert", en: "Welcome & how this workshop works" } },
      { id: "00.03", module: 0, slide: 3, title: { de: "Warum wir hier sind", en: "Why we are here" } },
      { id: "00.04", module: 0, slide: 4, title: { de: "Die Idee in einem Satz", en: "The idea in one sentence" } },
      { id: "00.05", module: 0, slide: 5, title: { de: "Agenda — der Halbtag", en: "Agenda — the half day" } },
      { id: "00.06", module: 0, slide: 6, title: { de: "So arbeiten wir heute", en: "How we work today" } },
    ],
  },
  {
    index: 1,
    title: { de: "Ausgangslage & Bedarf", en: "Situation & Need" },
    description: { de: "Was der FBS leistet, wo es klemmt", en: "What the FBS does, where it hurts" },
    slides: [
      { id: "01.01", module: 1, slide: 1, title: { de: "Was der FBS heute leistet", en: "What the FBS does today" } },
      { id: "01.02", module: 1, slide: 2, title: { de: "Wo es heute klemmt", en: "Where it hurts today" } },
      { id: "01.03", module: 1, slide: 3, title: { de: "Drei strukturelle Engpässe", en: "Three structural bottlenecks" } },
      { id: "01.04", module: 1, slide: 4, title: { de: "DSGVO & Datenschutz von Anfang an", en: "GDPR & data protection from day one" } },
      { id: "01.05", module: 1, slide: 5, title: { de: "Erarbeiten: Engpass-Check FBS", en: "Work it out: bottleneck check FBS" } },
    ],
  },
  {
    index: 2,
    title: { de: "Aufgabeninventar & Rollenmodell", en: "Task Inventory & Role Model" },
    slides: [
      { id: "02.01", module: 2, slide: 1, title: { de: "Aufgabeninventar (Bewertungsmatrix)", en: "Task inventory (assessment matrix)" } },
      { id: "02.02", module: 2, slide: 2, title: { de: "Trennlinie: vorbereiten · steuern · entscheiden · vertreten", en: "The dividing line: prepare · steer · decide · represent" } },
      { id: "02.03", module: 2, slide: 3, title: { de: "Rollenmodell — sechs Optionen", en: "Role model — six options" } },
      { id: "02.04", module: 2, slide: 4, title: { de: "Empfehlung: ½ FTE mit KI", en: "Recommendation: ½ FTE with AI" } },
      { id: "02.05", module: 2, slide: 5, title: { de: "Erarbeiten: Aufgaben-Priorisierung", en: "Work it out: task prioritization" } },
    ],
  },
  {
    index: 3,
    title: { de: "Zielarchitektur BIK-Suite", en: "Target Architecture BIK Suite" },
    slides: [
      { id: "03.01", module: 3, slide: 1, title: { de: "Zielbild: CDBrain · PDB · Composer", en: "Target picture: CDBrain · PDB · Composer" } },
      { id: "03.02", module: 3, slide: 2, title: { de: "CDBrain — der Verbandswissensgraph", en: "CDBrain — the association knowledge graph" } },
      { id: "03.03", module: 3, slide: 3, title: { de: "Personal Digital Brain & Composer", en: "Personal Digital Brain & Composer" } },
      { id: "03.04", module: 3, slide: 4, title: { de: "Wirksamkeit im Verbandsalltag", en: "Impact in daily association work" } },
      { id: "03.05", module: 3, slide: 5, title: { de: "Erarbeiten: Wissensquellen-Landkarte", en: "Work it out: knowledge source map" } },
    ],
  },
  {
    index: 4,
    title: { de: "Governance, Risiken & Compliance", en: "Governance, Risks & Compliance" },
    slides: [
      { id: "04.01", module: 4, slide: 1, title: { de: "KI darf vorbereiten — der Mensch entscheidet", en: "AI may prepare — humans decide" } },
      { id: "04.02", module: 4, slide: 2, title: { de: "Entscheidungsmatrix für die KI-Nutzung", en: "Decision matrix for AI use" } },
      { id: "04.03", module: 4, slide: 3, title: { de: "Drei Projektrisiken + organisatorisches Minimum", en: "Three project risks + organizational minimum" } },
      { id: "04.04", module: 4, slide: 4, title: { de: "Erarbeiten: Governance festlegen", en: "Work it out: define governance" } },
    ],
  },
  {
    index: 5,
    title: { de: "Fördermittel, Roadmap & Wirtschaftlichkeit", en: "Funding, Roadmap & Economics" },
    slides: [
      { id: "05.01", module: 5, slide: 1, title: { de: "Fördermittelanalyse", en: "Funding analysis" } },
      { id: "05.02", module: 5, slide: 2, title: { de: "Roadmap in vier Phasen", en: "Roadmap in four phases" } },
      { id: "05.03", module: 5, slide: 3, title: { de: "Wirtschaftlichkeit & Kostenkorridore", en: "Economics & cost corridors" } },
      { id: "05.04", module: 5, slide: 4, title: { de: "Erarbeiten: Pilot-Scoping (90 Tage)", en: "Work it out: pilot scoping (90 days)" } },
    ],
  },
  {
    index: 6,
    title: { de: "Beschluss & offene Fragen", en: "Decision & Open Questions" },
    slides: [
      { id: "06.01", module: 6, slide: 1, title: { de: "Offene Fragen & Grenzen", en: "Open questions & limits" } },
      { id: "06.02", module: 6, slide: 2, title: { de: "Entscheidungsoptionen für den Vorstand", en: "Decision options for the board" } },
      { id: "06.03", module: 6, slide: 3, title: { de: "Erarbeiten: Beschlussvorlage BIK-Pilot", en: "Work it out: BIK pilot resolution draft" } },
    ],
  },
  {
    index: 7,
    title: { de: "Ergebnis: Konzept & Folien", en: "Result: Concept & Slides" },
    description: { de: "Der Composer live — eure Ergebnisse", en: "The Composer live — your results" },
    slides: [
      { id: "07.01", module: 7, slide: 1, title: { de: "Der Composer live — was jetzt entsteht", en: "The Composer live — what gets created now" } },
      { id: "07.02", module: 7, slide: 2, title: { de: "Euer Workshop-Protokoll", en: "Your workshop record" } },
      { id: "07.03", module: 7, slide: 3, title: { de: "Ergebnistypen generieren", en: "Generate result types" } },
      { id: "07.04", module: 7, slide: 4, title: { de: "Nächste Schritte & Verantwortlichkeiten", en: "Next steps & ownership" } },
    ],
  },
  {
    index: 99,
    title: { de: "Anhang", en: "Appendix" },
    slides: [
      { id: "99.01", module: 99, slide: 1, title: { de: "Glossar", en: "Glossary" } },
      { id: "99.02", module: 99, slide: 2, title: { de: "Fördermittel-Steckbriefe", en: "Funding profiles" } },
      { id: "99.03", module: 99, slide: 3, title: { de: "Quellen & Konzeptdokument", en: "Sources & concept document" } },
      { id: "99.04", module: 99, slide: 4, title: { de: "Ergebnistypen-Pipeline (technisch)", en: "Result-type pipeline (technical)" } },
      { id: "99.05", module: 99, slide: 5, title: { de: "Changelog", en: "Changelog" } },
    ],
  },
];

/** Flat list of all slides in canonical order. */
export const ALL_SLIDES = MANIFEST.flatMap((m) => m.slides);

export function findSlide(id: string) {
  return ALL_SLIDES.find((s) => s.id === id);
}

export function findModule(index: number) {
  return MANIFEST.find((m) => m.index === index);
}

export function neighbours(id: string) {
  const i = ALL_SLIDES.findIndex((s) => s.id === id);
  return {
    prev: i > 0 ? ALL_SLIDES[i - 1] : null,
    next: i >= 0 && i < ALL_SLIDES.length - 1 ? ALL_SLIDES[i + 1] : null,
    index: i,
    total: ALL_SLIDES.length,
  };
}
