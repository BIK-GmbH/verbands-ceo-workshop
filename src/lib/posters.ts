/**
 * The seven phase posters of the workshop. Every phase ends with a poster that is
 * made analogue on the wall; the poster generator (/poster) redraws it from the
 * captured `WorkshopInput` fields. Entry ids are `"<slideId>:<field>"` exactly as
 * used on the slides — keep them in sync with the MDX files.
 */
import type { Bilingual } from "@/types/slide";

export type PosterKey =
  | "need-to-move"
  | "moeglichkeitsraum"
  | "zielbild"
  | "go-adapt-stop"
  | "business-case"
  | "roadmap"
  | "commitment";

export type PosterLayout = "staircase" | "horizons" | "target" | "traffic" | "canvas" | "timeline" | "commitment";

/** How the AI condenses a text field for the poster. */
export type CondenseMode = "sentence" | "bullets" | "short";

export interface PosterField {
  /** Local key the layout uses to place the field. */
  key: string;
  /** Workshop store entry id, `"<slideId>:<field>"`. */
  entryId: string;
  label: Bilingual;
  kind: "text" | "choice";
  /** Answer options of vote/decision fields (as stored, German). */
  options?: string[];
  condense?: CondenseMode;
  /** Ruled writing lines shown when the field is empty (analogue template). */
  lines?: number;
}

export interface PosterDef {
  key: PosterKey;
  phase: number;
  /** The poster slide in the deck. */
  slideId: string;
  title: Bilingual;
  question: Bilingual;
  output: Bilingual;
  layout: PosterLayout;
  motto?: Bilingual;
  fields: PosterField[];
}

const BAROMETER = ["Fiktion", "Eher Fiktion", "Unentschieden", "Eher Realität", "Realität"];
const AMPEL = ["Grün: machbar", "Gelb: mit Anpassungen", "Rot: kritisch"];

export const POSTERS: PosterDef[] = [
  {
    key: "need-to-move",
    phase: 1,
    slideId: "01.06",
    title: { de: "Need to Move", en: "Need to move" },
    question: {
      de: "Welches Problem wollen wir wirklich lösen?",
      en: "Which problem do we really want to solve?",
    },
    output: {
      de: "Ein gemeinsam bestätigtes, klar formuliertes Kernproblem.",
      en: "A jointly confirmed, clearly worded core problem.",
    },
    layout: "staircase",
    fields: [
      { key: "kernproblem", entryId: "01.06:poster-kernproblem", label: { de: "Unser Kernproblem", en: "Our core problem" }, kind: "text", condense: "sentence", lines: 3 },
      { key: "bestaetigt", entryId: "01.06:poster-bestaetigt", label: { de: "Ist das unser Kernproblem?", en: "Is this our core problem?" }, kind: "choice", options: ["Gemeinsam bestätigt", "Nachschärfen nötig"] },
      { key: "symptom", entryId: "01.04:prioritaet", label: { de: "Priorisiertes Problemfeld", en: "Prioritised problem area" }, kind: "text", condense: "short", lines: 1 },
      { key: "warum-1", entryId: "01.05:warum-1", label: { de: "Warum? 1", en: "Why? 1" }, kind: "text", condense: "short", lines: 1 },
      { key: "warum-2", entryId: "01.05:warum-2", label: { de: "Warum? 2", en: "Why? 2" }, kind: "text", condense: "short", lines: 1 },
      { key: "warum-3", entryId: "01.05:warum-3", label: { de: "Warum? 3", en: "Why? 3" }, kind: "text", condense: "short", lines: 1 },
      { key: "warum-4", entryId: "01.05:warum-4", label: { de: "Warum? 4", en: "Why? 4" }, kind: "text", condense: "short", lines: 1 },
      { key: "warum-5", entryId: "01.05:warum-5", label: { de: "Warum? 5", en: "Why? 5" }, kind: "text", condense: "short", lines: 1 },
      { key: "ursache", entryId: "01.05:ursache", label: { de: "Die eigentliche Ursache", en: "The real cause" }, kind: "text", condense: "sentence", lines: 1 },
      { key: "problemfelder", entryId: "01.06:poster-problemfelder", label: { de: "Die Problemfelder", en: "The problem areas" }, kind: "text", condense: "bullets", lines: 5 },
      { key: "ursachen", entryId: "01.06:poster-ursachen", label: { de: "Ursachen-Treppe in Kurzform", en: "Cause staircase in brief" }, kind: "text", condense: "bullets", lines: 5 },
    ],
  },
  {
    key: "moeglichkeitsraum",
    phase: 2,
    slideId: "02.08",
    title: { de: "Möglichkeitsraum & Stoßrichtungen", en: "Possibilities & directions" },
    question: {
      de: "Was wäre möglich, wenn wir dieses Problem völlig neu denken?",
      en: "What would be possible if we rethought this problem completely?",
    },
    output: {
      de: "3–5 Stoßrichtungen für unseren KI-Geschäftsführer.",
      en: "3–5 directions for our AI managing director.",
    },
    layout: "horizons",
    fields: [
      { key: "kernproblem", entryId: "01.06:poster-kernproblem", label: { de: "Ausgangspunkt: unser Kernproblem", en: "Starting point: our core problem" }, kind: "text", condense: "sentence", lines: 1 },
      { key: "heute", entryId: "02.08:poster-heute", label: { de: "Heute", en: "Today" }, kind: "text", condense: "bullets", lines: 6 },
      { key: "morgen", entryId: "02.08:poster-morgen", label: { de: "Morgen", en: "Tomorrow" }, kind: "text", condense: "bullets", lines: 6 },
      { key: "uebermorgen", entryId: "02.08:poster-uebermorgen", label: { de: "Übermorgen", en: "The day after" }, kind: "text", condense: "bullets", lines: 6 },
      { key: "stossrichtungen", entryId: "02.08:poster-stossrichtungen", label: { de: "Unsere Stoßrichtungen", en: "Our directions" }, kind: "text", condense: "bullets", lines: 5 },
      { key: "weiter", entryId: "02.08:poster-weiter-in-phase-3", label: { de: "Das nehmen wir mit in Phase 3", en: "Taken into phase 3" }, kind: "text", condense: "bullets", lines: 2 },
    ],
  },
  {
    key: "zielbild",
    phase: 3,
    slideId: "03.05",
    title: { de: "Zielbild 2029: Unser KI-Geschäftsführer", en: "Target picture 2029: our AI managing director" },
    question: {
      de: "Wie sieht unser KI-Geschäftsführer konkret aus?",
      en: "What does our AI managing director look like in concrete terms?",
    },
    output: {
      de: "Ein Bild, ein Profil, ein Satz.",
      en: "An image, a profile, a sentence.",
    },
    layout: "target",
    fields: [
      { key: "leitsatz", entryId: "03.05:poster-leitsatz", label: { de: "Unser Leitsatz", en: "Our guiding sentence" }, kind: "text", condense: "sentence", lines: 2 },
      { key: "bild", entryId: "03.05:poster-bild", label: { de: "Unser Bild", en: "Our image" }, kind: "text", condense: "sentence", lines: 3 },
      { key: "profil", entryId: "03.05:poster-profil", label: { de: "Profil", en: "Profile" }, kind: "text", condense: "bullets", lines: 6 },
      { key: "use-cases", entryId: "03.04:erste-use-cases", label: { de: "Erste Use Cases", en: "First use cases" }, kind: "text", condense: "bullets", lines: 4 },
      {
        key: "commitment",
        entryId: "03.05:poster-commitment",
        label: { de: "Ist das die Zukunft, die wir gemeinsam verfolgen wollen?", en: "Is this the future we want to pursue together?" },
        kind: "choice",
        options: ["Ja, das ist die Zukunft, die wir verfolgen wollen", "Ja, mit Vorbehalt", "Noch nicht"],
      },
    ],
  },
  {
    key: "go-adapt-stop",
    phase: 4,
    slideId: "04.06",
    title: { de: "Diesmal anders, weil …", en: "This time different, because …" },
    question: { de: "Warum sollte es diesmal funktionieren?", en: "Why should it work this time?" },
    output: {
      de: "Was wir aus unseren Erfahrungen lernen: GO · ADAPT · STOP.",
      en: "What we learn from our own experience: GO · ADAPT · STOP.",
    },
    layout: "traffic",
    motto: {
      de: "Wir entscheiden bewusst, realistisch und mutig.",
      en: "We decide deliberately, realistically and boldly.",
    },
    fields: [
      { key: "diesmal", entryId: "04.06:poster-diesmal-anders", label: { de: "Diesmal anders, weil …", en: "This time different, because …" }, kind: "text", condense: "sentence", lines: 2 },
      { key: "go", entryId: "04.06:poster-go", label: { de: "Setzen wir 1:1 um", en: "We implement 1:1" }, kind: "text", condense: "bullets", lines: 7 },
      { key: "adapt", entryId: "04.06:poster-adapt", label: { de: "Passen wir an", en: "We adapt" }, kind: "text", condense: "bullets", lines: 7 },
      { key: "stop", entryId: "04.06:poster-stop", label: { de: "Lassen wir bewusst weg", en: "We deliberately leave out" }, kind: "text", condense: "bullets", lines: 7 },
      { key: "ampel-technisch", entryId: "04.03:ampel-technisch", label: { de: "Technisch", en: "Technical" }, kind: "choice", options: AMPEL },
      { key: "ampel-organisatorisch", entryId: "04.03:ampel-organisatorisch", label: { de: "Organisatorisch", en: "Organisational" }, kind: "choice", options: AMPEL },
      { key: "ampel-mitglieder", entryId: "04.03:ampel-mitglieder", label: { de: "Mitglieder & Verband", en: "Members & association" }, kind: "choice", options: AMPEL },
      { key: "erfahrungen", entryId: "04.02:wilma-lernen", label: { de: "Was wir aus unseren Erfahrungen lernen", en: "What we learn from our own experience" }, kind: "text", condense: "bullets", lines: 3 },
    ],
  },
  {
    key: "business-case",
    phase: 5,
    slideId: "05.05",
    title: { de: "Business Case", en: "Business case" },
    question: {
      de: "Wie argumentieren wir die Lösung gegenüber Entscheidern?",
      en: "How do we argue the solution to decision-makers?",
    },
    output: {
      de: "Nutzen, Kosten, Break-even-Hypothese, Mehrwert, Einwände & Antworten.",
      en: "Benefit, cost, break-even hypothesis, added value, objections & answers.",
    },
    layout: "canvas",
    fields: [
      { key: "nutzen", entryId: "05.05:poster-nutzen", label: { de: "Nutzen", en: "Benefit" }, kind: "text", condense: "bullets", lines: 7 },
      { key: "kosten", entryId: "05.05:poster-kosten", label: { de: "Kosten (Bandbreite)", en: "Cost (range)" }, kind: "text", condense: "bullets", lines: 7 },
      { key: "hypothese", entryId: "05.05:poster-hypothese", label: { de: "Break-even-Hypothese", en: "Break-even hypothesis" }, kind: "text", condense: "bullets", lines: 3 },
      {
        key: "hypothese-check",
        entryId: "05.03:hypothese",
        label: { de: "„Rechnet sich in drei Jahren“ – hält das?", en: "“Pays off within three years” – does it hold?" },
        kind: "choice",
        options: ["Hält", "Hält eher", "Unklar", "Hält nicht"],
      },
      { key: "strategie", entryId: "05.05:poster-strategie", label: { de: "Strategischer Mehrwert", en: "Strategic added value" }, kind: "text", condense: "bullets", lines: 3 },
      { key: "einwaende", entryId: "05.05:poster-einwaende", label: { de: "Einwände & unsere Antworten", en: "Objections & our answers" }, kind: "text", condense: "bullets", lines: 4 },
      { key: "pitch", entryId: "05.05:poster-pitch", label: { de: "Unser Argument für den Vorstand", en: "Our argument for the board" }, kind: "text", condense: "sentence", lines: 3 },
    ],
  },
  {
    key: "roadmap",
    phase: 6,
    slideId: "06.05",
    title: { de: "Roadmap", en: "Roadmap" },
    question: {
      de: "Wie kommen wir vom Zielbild in die Realität?",
      en: "How do we get from the target picture to reality?",
    },
    output: {
      de: "Ein Zeitstrahl, vier Horizonte, an jedem Meilenstein ein Name.",
      en: "One timeline, four horizons, a name at every milestone.",
    },
    layout: "timeline",
    motto: { de: "Konsequent umsetzen. Gemeinsam wirken.", en: "Implement consistently. Make an impact together." },
    fields: [
      { key: "100-tage", entryId: "06.05:poster-100-tage", label: { de: "100 Tage", en: "100 days" }, kind: "text", condense: "bullets", lines: 4 },
      { key: "12-monate", entryId: "06.05:poster-12-monate", label: { de: "12 Monate", en: "12 months" }, kind: "text", condense: "bullets", lines: 4 },
      { key: "24-monate", entryId: "06.05:poster-24-monate", label: { de: "24 Monate", en: "24 months" }, kind: "text", condense: "bullets", lines: 4 },
      { key: "36-monate", entryId: "06.05:poster-36-monate", label: { de: "36 Monate", en: "36 months" }, kind: "text", condense: "bullets", lines: 4 },
      { key: "handlungsfelder", entryId: "06.02:handlungsfelder", label: { de: "Handlungsfelder", en: "Fields of action" }, kind: "text", condense: "bullets", lines: 3 },
      { key: "quick-wins", entryId: "06.02:quick-wins", label: { de: "Quick Wins", en: "Quick wins" }, kind: "text", condense: "bullets", lines: 3 },
      { key: "verantwortliche", entryId: "06.05:poster-verantwortliche", label: { de: "Verantwortliche", en: "Owners" }, kind: "text", condense: "bullets", lines: 3 },
    ],
  },
  {
    key: "commitment",
    phase: 7,
    slideId: "07.06",
    title: { de: "Commitment: Fiktion oder Realität?", en: "Commitment: fiction or reality?" },
    question: { de: "Wozu sagen wir heute gemeinsam Ja?", en: "What do we say yes to together today?" },
    output: {
      de: "Unsere Antwort, unsere Beschlüsse, die nächsten Schritte.",
      en: "Our answer, our decisions, the next steps.",
    },
    layout: "commitment",
    motto: {
      de: "Die Antwort liegt nicht in der Technik, sondern in dem, was wir gemeinsam daraus machen.",
      en: "The answer does not lie in the technology, but in what we make of it together.",
    },
    fields: [
      { key: "antwort", entryId: "07.06:poster-antwort", label: { de: "Unsere Antwort auf die Leitfrage", en: "Our answer to the key question" }, kind: "text", condense: "sentence", lines: 2 },
      { key: "vorher", entryId: "00.08:barometer-vorher", label: { de: "Vorher · Tag 1", en: "Before · day 1" }, kind: "choice", options: BAROMETER },
      { key: "nachher", entryId: "07.02:barometer-nachher", label: { de: "Nachher · Tag 2", en: "After · day 2" }, kind: "choice", options: BAROMETER },
      {
        key: "naechster-schritt",
        entryId: "07.04:naechster-schritt",
        label: { de: "Unser nächster Schritt", en: "Our next step" },
        kind: "choice",
        options: [
          "Zielbild weiterverfolgen und Umsetzung vorbereiten",
          "Arbeitsgruppe einsetzen, die das Zielbild konkretisiert",
          "Im Vorstand vertiefen und erneut beraten",
          "Vertagen – offene Fragen zuerst klären",
          "Nicht weiterverfolgen",
        ],
      },
      { key: "beschluesse", entryId: "07.06:poster-beschluesse", label: { de: "Unsere Beschlüsse", en: "Our decisions" }, kind: "text", condense: "bullets", lines: 4 },
      { key: "owner", entryId: "07.06:owner", label: { de: "Wer koordiniert – bis wann?", en: "Who coordinates – by when?" }, kind: "text", condense: "short", lines: 2 },
      { key: "termin", entryId: "07.06:naechster-termin", label: { de: "Nächster Termin", en: "Next date" }, kind: "text", condense: "short", lines: 1 },
    ],
  },
];

export function findPoster(key: string | undefined): PosterDef | undefined {
  return POSTERS.find((p) => p.key === key);
}

export function posterField(def: PosterDef, key: string): PosterField {
  const f = def.fields.find((x) => x.key === key);
  if (!f) throw new Error(`Poster ${def.key} has no field "${key}"`);
  return f;
}

export const WORKSHOP_TITLE: Bilingual = {
  de: "KI-Geschäftsführer: Fiktion oder Realität?",
  en: "AI managing director: fiction or reality?",
};

export type PaperFormat = "A4" | "A3" | "A2" | "A1" | "A0";
export type Orientation = "portrait" | "landscape";

/** ISO 216 portrait dimensions in millimetres. */
export const PAPER_MM: Record<PaperFormat, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

/**
 * The sheet is always laid out at A3 size in CSS px (96 dpi) and zoomed to the
 * chosen format, so every format looks identical — only larger.
 */
export const SHEET_PX: Record<Orientation, [number, number]> = {
  portrait: [1123, 1587],
  landscape: [1587, 1123],
};

export function pageMm(format: PaperFormat, orientation: Orientation): [number, number] {
  const [w, h] = PAPER_MM[format];
  return orientation === "portrait" ? [w, h] : [h, w];
}
