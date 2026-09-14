/**
 * Shared document model for the protocol and results-report exports.
 *
 * Both renderers — Word (.docx, export-docx.ts) and PDF via browser print
 * (export-html.ts) — consume the same `ExportDoc`, so chapters, entries,
 * glossary and labels are prepared exactly once. Everything runs locally in
 * the browser; nothing here talks to a server.
 */
import type { Lang } from "@/types/slide";
import { getState, filledParticipants, type CaptureEntry } from "./workshop-store";
import { MANIFEST, findModule, findSlide } from "./slides";
import { compareEntries } from "./field-order";
import { formatCardLine } from "./cards";
import { DISCUSSION_BADGE, DISCUSSION_NOTE, isDiscussionEntry } from "./discussion-entry";
import glossaryMdx from "@/content/99-01-glossar.mdx?raw";
import { localDateStamp } from "@/lib/local-date";

/* ------------------------------------------------------------------ types */

export interface Inline {
  /** May contain "\n" for a line break inside the paragraph. */
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ListItem {
  level: number;
  runs: Inline[];
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  /** Workshop-added term that was not approved yet ("(nicht freigegeben)"). */
  unapproved?: boolean;
}

export interface BarometerRow {
  option: string;
  count: number;
}

export type Block =
  | { type: "p"; runs: Inline[]; tone?: "note" }
  | { type: "sub"; runs: Inline[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "quote"; runs: Inline[] }
  | { type: "rule" }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] }
  | { type: "facts"; rows: [string, string][] }
  | { type: "people"; cols: string[]; rows: string[][] }
  | { type: "glossary"; terms: GlossaryTerm[] }
  | {
      type: "entry";
      question: string;
      body: Block[];
      /** Ad-hoc question/task without an answer yet */
      open: boolean;
      /** Text was reworded by the AI assistant (original kept as `raw`) */
      polished: boolean;
      /** Votes/decisions are shown as a highlighted result */
      highlight: boolean;
      /** Summary of the recorded discussion (`…:mitschnitt`), not a contribution the room captured itself */
      discussion?: boolean;
      barometer?: { rows: BarometerRow[]; total: number };
    };

export interface ExportSection {
  anchor: string;
  title: string;
  /** Slide reference, e.g. "01.03" (protocol only) */
  ref?: string;
  blocks: Block[];
}

export interface ExportChapter {
  /** HTML id / Word bookmark source, e.g. "kapitel-3" */
  anchor: string;
  number: number;
  title: string;
  /** Small line above the title, e.g. the time slot */
  eyebrow?: string;
  question?: { label: string; text: string };
  /** Path below BASE_URL, e.g. "brand/modules/m1-light.webp" */
  image?: string;
  /** Short info shown in the tables of contents, e.g. "12 Beiträge" */
  tocNote?: string;
  blocks: Block[];
  sections: ExportSection[];
}

export interface ExportDoc {
  kind: "protocol" | "report";
  lang: Lang;
  title: string;
  docType: string;
  /** Running header text */
  shortTitle: string;
  fileBase: string;
  chapters: ExportChapter[];
  labels: Labels;
}

/* ----------------------------------------------------------------- labels */

const LABELS = {
  de: {
    coverEyebrow: "Zweitages-Workshop",
    protocol: "Protokoll",
    report: "Ergebnisbericht",
    organisationLabel: "Fachverband",
    organisation: "Fachverband Betonbohren und -sägen Deutschland e. V.",
    datesLabel: "Termin",
    dates: "16./17. September 2026",
    moderationLabel: "Moderation",
    hosts: [
      { name: "Harald Ostermann", org: "Innovationswerkstatt & Digital Management School" },
      { name: "Dr. Stefan Reinheimer", org: "BIK GmbH" },
    ],
    partnersLabel: "Moderation & Konzeption",
    footer: "Innovationswerkstatt & Digital Management School · BIK GmbH",
    headerRight: "FBS · 16./17. September 2026",
    page: "Seite",
    of: "von",
    tocEyebrow: "Inhalt",
    tocTitle: "Inhaltsverzeichnis",
    overview: "Kapitel im Überblick · Direktlinks",
    chapter: "Kapitel",
    framing: "Rahmendaten & Teilnehmende",
    participants: "Teilnehmende",
    people: (n: number) => (n === 1 ? "1 Person" : `${n} Personen`),
    cols: ["Name", "Vorname", "Organisation", "Rolle"],
    date: "Datum",
    count: "Erfasste Beiträge",
    generated: "Erzeugt am",
    reportCount: "Berücksichtigte Beiträge",
    reportCreated: "Erstellt am",
    reportNote:
      "KI-gestützt aus den im Workshop erfassten Beiträgen verdichtet und redaktionell bearbeitbar. Maßgeblich sind die Beiträge im Workshop-Protokoll.",
    contributions: (n: number) => (n === 1 ? "1 Beitrag" : `${n} Beiträge`),
    none: "Noch keine Eingaben erfasst.",
    open: "offen",
    openAnswer: "Noch keine Antwort erfasst.",
    polished: "KI-geglättet",
    discussion: DISCUSSION_BADGE.de,
    discussionNote: `${DISCUSSION_NOTE.de.charAt(0).toUpperCase()}${DISCUSSION_NOTE.de.slice(1)}`,
    votes: (n: number) => (n === 1 ? "1 Stimme" : `${n} Stimmen`),
    slide: "Folie",
    phase: "Phase",
    module: "Modul",
    keyQuestion: "Kernfrage",
    leadQuestion: "Leitfrage",
    prelude: "Vorbemerkung",
    glossary: "Glossar",
    glossaryBase: "Grundbegriffe",
    glossaryWorkshop: "Im Workshop ergänzt",
    glossaryCols: ["Begriff", "Erläuterung"],
    terms: (n: number) => (n === 1 ? "1 Begriff" : `${n} Begriffe`),
    unapproved: "nicht freigegeben",
    wordError: "Das Word-Dokument konnte nicht erzeugt werden. Bitte erneut versuchen.",
    pdfError: "Die Druckansicht konnte nicht geöffnet werden. Bitte erneut versuchen.",
  },
  en: {
    coverEyebrow: "Two-day workshop",
    protocol: "Workshop record",
    report: "Results report",
    organisationLabel: "Association",
    organisation: "Fachverband Betonbohren und -sägen Deutschland e. V.",
    datesLabel: "Dates",
    dates: "16/17 September 2026",
    moderationLabel: "Facilitation",
    hosts: [
      { name: "Harald Ostermann", org: "Innovationswerkstatt & Digital Management School" },
      { name: "Dr. Stefan Reinheimer", org: "BIK GmbH" },
    ],
    partnersLabel: "Facilitation & concept",
    footer: "Innovationswerkstatt & Digital Management School · BIK GmbH",
    headerRight: "FBS · 16/17 September 2026",
    page: "Page",
    of: "of",
    tocEyebrow: "Contents",
    tocTitle: "Table of contents",
    overview: "Chapters at a glance · direct links",
    chapter: "Chapter",
    framing: "Key facts & participants",
    participants: "Participants",
    people: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    cols: ["Last name", "First name", "Organisation", "Role"],
    date: "Date",
    count: "Captured input",
    generated: "Generated",
    reportCount: "Contributions considered",
    reportCreated: "Created",
    reportNote:
      "Condensed with AI support from the contributions captured in the workshop; editable. The workshop record remains authoritative.",
    contributions: (n: number) => (n === 1 ? "1 contribution" : `${n} contributions`),
    none: "No input captured yet.",
    open: "open",
    openAnswer: "No answer captured yet.",
    polished: "AI-smoothed",
    discussion: DISCUSSION_BADGE.en,
    discussionNote: `${DISCUSSION_NOTE.en.charAt(0).toUpperCase()}${DISCUSSION_NOTE.en.slice(1)}`,
    votes: (n: number) => (n === 1 ? "1 vote" : `${n} votes`),
    slide: "Slide",
    phase: "Phase",
    module: "Module",
    keyQuestion: "Key question",
    leadQuestion: "Guiding question",
    prelude: "Preliminary remarks",
    glossary: "Glossary",
    glossaryBase: "Core terms",
    glossaryWorkshop: "Added in the workshop",
    glossaryCols: ["Term", "Explanation"],
    terms: (n: number) => (n === 1 ? "1 term" : `${n} terms`),
    unapproved: "not approved",
    wordError: "The Word document could not be created. Please try again.",
    pdfError: "The print view could not be opened. Please try again.",
  },
};

export type Labels = (typeof LABELS)["de"];

export const labelsFor = (lang: Lang): Labels => LABELS[lang];

/** Core question per phase, from docs/workshop-konzept.md. */
const KEY_QUESTIONS: Record<number, Record<Lang, string>> = {
  0: { de: "KI-Geschäftsführer: Fiktion oder Realität?", en: "AI managing director: fiction or reality?" },
  1: {
    de: "Welches Problem wollen wir wirklich lösen? Warum muss sich der Verband überhaupt verändern?",
    en: "Which problem do we really want to solve? Why does the association need to change at all?",
  },
  2: {
    de: "Was wäre möglich, wenn wir dieses Problem völlig neu denken?",
    en: "What would be possible if we rethought this problem completely?",
  },
  3: {
    de: "Wie sieht unser KI-Geschäftsführer konkret aus? Was wollen wir gemeinsam erreichen?",
    en: "What does our AI managing director look like in concrete terms? What do we want to achieve together?",
  },
  4: { de: "Warum sollte es diesmal funktionieren?", en: "Why should it work this time?" },
  5: {
    de: "Wie argumentieren wir eine solche Lösung gegenüber Entscheidern (Vorstand, Mitgliederversammlung)?",
    en: "How do we make the case for such a solution to decision-makers (board, general assembly)?",
  },
  6: { de: "Wie kommen wir vom Zielbild in die Realität?", en: "How do we get from the target picture to reality?" },
  7: { de: "Wozu sagen wir heute gemeinsam Ja?", en: "What do we say yes to together today?" },
};

/* ------------------------------------------------------------------ assets */

export const BRAND = {
  keyVisual: "brand/zukunft-fester-grund-light.webp",
  fbs: "brand/fbs-logo.png",
  innovationswerkstatt: "brand/innovationswerkstatt-dark.png",
  dms: "brand/dms-logo-dark.png",
  bik: "brand/bik-logo-dark.svg",
  hero: "brand/hero-ki-beton.webp",
} as const;

export const moduleImage = (index: number) => `brand/modules/m${index}-light.webp`;

/** Absolute URL of a file in public/ — the print iframe and fetch() both need it unambiguous. */
export function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href;
}

/* ------------------------------------------------------------ entry rules */

export function hasValue(e: CaptureEntry): boolean {
  return Array.isArray(e.value) ? e.value.length > 0 : Boolean(typeof e.value === "string" && e.value.trim());
}

/** Ad-hoc questions/tasks added in the live protocol (field id "q-…") are exported even while unanswered. */
export function isAdHoc(e: CaptureEntry): boolean {
  return (e.id.split(":")[1] ?? "").startsWith("q-");
}

/** Protocol entry holding the terms added to the glossary during the workshop. */
export const WORKSHOP_GLOSSARY_ID = "99.01:glossar-workshop";

/* ---------------------------------------------------------------- markdown */

const INLINE_RE = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|(^|[^*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?!\*)/g;

/** Bold / italic / code spans → runs. Everything else stays literal text. */
export function parseInline(src: string): Inline[] {
  const text = src.trim();
  const out: Inline[] = [];
  const push = (run: Inline) => {
    if (!run.text) return;
    const prev = out[out.length - 1];
    if (prev && Boolean(prev.bold) === Boolean(run.bold) && Boolean(prev.italic) === Boolean(run.italic)) prev.text += run.text;
    else out.push(run);
  };
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    if (m[4] !== undefined) {
      push({ text: text.slice(last, at + m[4].length) });
      push({ text: m[5], italic: true });
    } else {
      push({ text: text.slice(last, at) });
      if (m[1] !== undefined || m[2] !== undefined) push({ text: m[1] ?? m[2], bold: true });
      else push({ text: m[3] });
    }
    last = at + m[0].length;
  }
  push({ text: text.slice(last) });
  return out;
}

const plain = (runs: Inline[]) => runs.map((r) => r.text).join("");

type MdNode = { type: "heading"; level: number; runs: Inline[] } | Block;

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_RE = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;
const RULE_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const tableCells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => parseInline(c));

/** Markdown → flat node list (same subset as markdown.ts: headings, paragraphs, lists, quotes, rules, tables). */
export function parseMarkdown(md: string): MdNode[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: MdNode[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: ListItem[]; indents: number[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push({ type: "p", runs: parseInline(para.join(" ")) });
    para = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push({ type: "quote", runs: parseInline(quote.join(" ")) });
    quote = [];
  };
  const flushList = () => {
    if (list) out.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flushPara();
      flushQuote();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushAll();
      out.push({ type: "heading", level: heading[1].length, runs: parseInline(heading[2]) });
      continue;
    }
    if (RULE_RE.test(line)) {
      flushAll();
      out.push({ type: "rule" });
      continue;
    }
    const item = LIST_RE.exec(line);
    if (item) {
      flushPara();
      flushQuote();
      const indent = item[1].replace(/\t/g, "  ").length;
      const ordered = /\d/.test(item[2]);
      if (!list || (indent === 0 && list.ordered !== ordered)) {
        flushList();
        list = { ordered, items: [], indents: [] };
      }
      // Depth = number of distinct smaller indents seen in this list.
      while (list.indents.length && list.indents[list.indents.length - 1] > indent) list.indents.pop();
      if (!list.indents.length || list.indents[list.indents.length - 1] < indent) list.indents.push(indent);
      list.items.push({ level: Math.min(list.indents.length - 1, 2), runs: parseInline(item[3]) });
      continue;
    }
    if (list && /^\s+\S/.test(line) && !para.length) {
      const lastItem = list.items[list.items.length - 1];
      lastItem.runs.push(...parseInline(` ${line.trim()}`).map((r, idx) => (idx === 0 ? { ...r, text: ` ${r.text}` } : r)));
      continue;
    }
    const q = QUOTE_RE.exec(line);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
      continue;
    }
    if (line.trim().startsWith("|") && TABLE_SEP_RE.test(lines[i + 1] ?? "")) {
      flushAll();
      const head = tableCells(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(tableCells(lines[i++]));
      i--;
      out.push({ type: "table", head, rows });
      continue;
    }
    flushQuote();
    flushList();
    para.push(line);
  }
  flushAll();
  return out;
}

/** Free text of a captured answer: paragraphs (line breaks kept) and "- " bullet lines as a list. */
function textBlocks(value: string): Block[] {
  const blocks: Block[] = [];
  let lines: string[] = [];
  let items: ListItem[] = [];
  const flushLines = () => {
    if (lines.length) {
      const runs: Inline[] = [];
      lines.forEach((l, i) => {
        const parsed = parseInline(l);
        if (i > 0 && parsed.length) parsed[0] = { ...parsed[0], text: `\n${parsed[0].text}` };
        runs.push(...parsed);
      });
      blocks.push({ type: "p", runs });
    }
    lines = [];
  };
  const flushItems = () => {
    if (items.length) blocks.push({ type: "list", ordered: false, items });
    items = [];
  };
  for (const line of value.replace(/\r\n?/g, "\n").split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushLines();
      items.push({ level: 0, runs: parseInline(bullet[1]) });
    } else if (!line.trim()) {
      flushLines();
      flushItems();
    } else {
      flushItems();
      lines.push(line);
    }
  }
  flushLines();
  flushItems();
  return blocks;
}

/* ---------------------------------------------------------------- glossary */

/** Static glossary from 99-01-glossar.mdx: rows "| **Begriff** | Erklärung |" of the DE or EN table. */
function staticGlossary(lang: Lang): GlossaryTerm[] {
  const tag = lang === "en" ? "En" : "De";
  const block = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(glossaryMdx)?.[1] ?? "";
  const terms: GlossaryTerm[] = [];
  for (const line of block.split(/\r?\n/)) {
    const m = /^\s*\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m) terms.push({ term: m[1].trim(), definition: m[2].trim() });
  }
  return terms;
}

const UNAPPROVED_RE = /\(\s*nicht freigegeben\s*\)/gi;

/** Workshop additions: one line per term, "Begriff: Erläuterung", optionally marked "(nicht freigegeben)". */
function workshopGlossary(entry: CaptureEntry | undefined): GlossaryTerm[] {
  if (!entry || !hasValue(entry)) return [];
  const lines = Array.isArray(entry.value) ? entry.value : entry.value.split(/\r?\n/);
  return lines
    .map((l) => l.replace(/^\s*[-*•]\s+/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const unapproved = UNAPPROVED_RE.test(line);
      UNAPPROVED_RE.lastIndex = 0;
      const clean = line.replace(UNAPPROVED_RE, " ").replace(/\s{2,}/g, " ").trim();
      const i = clean.indexOf(":");
      const term = (i > 0 ? clean.slice(0, i) : clean).replace(/\*\*/g, "").trim();
      const definition = i > 0 ? clean.slice(i + 1).trim() : "";
      return { term, definition, unapproved };
    });
}

function glossaryChapter(lang: Lang, number: number, entries: Record<string, CaptureEntry>): ExportChapter {
  const L = LABELS[lang];
  const anchor = `kapitel-${number}`;
  const base = staticGlossary(lang);
  const added = workshopGlossary(entries[WORKSHOP_GLOSSARY_ID]);
  const sections: ExportSection[] = [];
  if (base.length) sections.push({ anchor: `${anchor}-1`, title: L.glossaryBase, blocks: [{ type: "glossary", terms: base }] });
  if (added.length) {
    sections.push({ anchor: `${anchor}-${sections.length + 1}`, title: L.glossaryWorkshop, blocks: [{ type: "glossary", terms: added }] });
  }
  return {
    anchor,
    number,
    title: L.glossary,
    eyebrow: findModule(99)?.title[lang],
    image: moduleImage(99),
    tocNote: L.terms(base.length + added.length),
    blocks: [],
    sections,
  };
}

/* ------------------------------------------------------------------ helpers */

const today = () => localDateStamp();

function formatDate(iso: string, lang: Lang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatStamp(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { dateStyle: "long", timeStyle: "short" });
}

/** Chapter 1: key facts, optional note and the participant table. */
function framingChapter(lang: Lang, facts: [string, string][], note?: string): ExportChapter {
  const L = LABELS[lang];
  const { meta } = getState();
  const people = filledParticipants(meta.participantsList);
  const blocks: Block[] = [];
  if (note) blocks.push({ type: "p", runs: [{ text: note, italic: true }], tone: "note" });
  blocks.push({ type: "facts", rows: facts });
  const sections: ExportSection[] = [];
  if (people.length) {
    sections.push({
      anchor: "kapitel-1-1",
      title: L.participants,
      blocks: [
        {
          type: "people",
          cols: L.cols,
          rows: people.map((p) => [p.lastName, p.firstName, p.organisation, p.role].map((v) => v.trim() || "—")),
        },
      ],
    });
  }
  return {
    anchor: "kapitel-1",
    number: 1,
    title: L.framing,
    eyebrow: L.organisation,
    tocNote: people.length ? L.people(people.length) : undefined,
    blocks,
    sections,
  };
}

function participantFact(lang: Lang): [string, string] {
  const { meta } = getState();
  const L = LABELS[lang];
  const people = filledParticipants(meta.participantsList);
  return [L.participants, people.length ? L.people(people.length) : meta.participants.trim() || "—"];
}

function parseBarometer(value: string): { rows: BarometerRow[]; total: number } | null {
  const m = /^(.*?)\s*\((\d+)\s+\S+\)\s*$/.exec(value.trim());
  if (!m) return null;
  const rows = m[1]
    .split(/\s+·\s+/)
    .map((part) => {
      const i = part.lastIndexOf(":");
      return i > 0 ? { option: part.slice(0, i).trim(), count: Number(part.slice(i + 1)) } : null;
    })
    .filter((r): r is BarometerRow => r !== null && Number.isFinite(r.count));
  return rows.length ? { rows, total: Number(m[2]) } : null;
}

function entryBlock(e: CaptureEntry): Block {
  const field = e.id.split(":")[1] ?? "";
  const question = e.prompt.trim() || field;
  if (!hasValue(e)) return { type: "entry", question, body: [], open: true, polished: false, highlight: false };
  const polished = Boolean(e.raw);
  if (/^barometer-(vorher|nachher)$/.test(field) && typeof e.value === "string") {
    const barometer = parseBarometer(e.value);
    if (barometer) return { type: "entry", question, body: [], open: false, polished, highlight: true, barometer };
  }
  const body: Block[] = Array.isArray(e.value)
    ? [
        {
          type: "list",
          ordered: false,
          items: e.value.filter((v) => v.trim()).map((v) => ({ level: 0, runs: parseInline(formatCardLine(v)) })),
        },
      ]
    : textBlocks(e.value);
  const discussion = isDiscussionEntry(e.id);
  return { type: "entry", question, body, open: false, polished, highlight: !discussion && (e.kind === "vote" || e.kind === "decision"), discussion };
}

function moduleTitle(index: number, lang: Lang): string {
  const L = LABELS[lang];
  const m = findModule(index);
  if (!m) return `${L.module} ${index}`;
  return index >= 1 && index <= 7 ? `${L.phase} ${index} · ${m.title[lang]}` : m.title[lang];
}

/* -------------------------------------------------------------- protocol */

export function buildProtocolModel(lang: Lang): ExportDoc {
  const L = LABELS[lang];
  const { meta, entries } = getState();
  const list = Object.values(entries)
    .filter((e) => e.id !== WORKSHOP_GLOSSARY_ID && (hasValue(e) || isAdHoc(e)))
    .sort(compareEntries);
  const glossaryEntry = entries[WORKSHOP_GLOSSARY_ID];
  const total = list.length + (glossaryEntry && hasValue(glossaryEntry) ? 1 : 0);

  const chapters: ExportChapter[] = [
    framingChapter(lang, [
      [L.date, formatDate(meta.date, lang)],
      participantFact(lang),
      [L.count, String(total)],
      [L.generated, formatStamp(new Date().toISOString(), lang)],
    ]),
  ];

  const byModule = new Map<number, CaptureEntry[]>();
  for (const e of list) byModule.set(e.module, [...(byModule.get(e.module) ?? []), e]);
  const order = [
    ...MANIFEST.map((m) => m.index).filter((i) => byModule.has(i)),
    ...[...byModule.keys()].filter((k) => !findModule(k)).sort((a, b) => a - b),
  ];

  for (const index of order) {
    const items = byModule.get(index) ?? [];
    const number = chapters.length + 1;
    const anchor = `kapitel-${number}`;
    const m = findModule(index);
    const slideOrder = (id: string) => {
      const i = m?.slides.findIndex((s) => s.id === id) ?? -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const slideIds = [...new Set(items.map((e) => e.slideId))].sort((a, b) => slideOrder(a) - slideOrder(b) || a.localeCompare(b));
    const kq = KEY_QUESTIONS[index];
    chapters.push({
      anchor,
      number,
      title: moduleTitle(index, lang),
      eyebrow: m?.description?.[lang],
      question: kq ? { label: index === 0 ? L.leadQuestion : L.keyQuestion, text: kq[lang] } : undefined,
      image: m ? moduleImage(index) : undefined,
      tocNote: L.contributions(items.length),
      blocks: [],
      sections: slideIds.map((slideId, j) => ({
        anchor: `${anchor}-${j + 1}`,
        title: findSlide(slideId)?.title[lang] ?? slideId,
        ref: slideId,
        blocks: items.filter((e) => e.slideId === slideId).map(entryBlock),
      })),
    });
  }

  if (chapters.length === 1) chapters[0].blocks.push({ type: "p", runs: [{ text: L.none, italic: true }], tone: "note" });
  chapters.push(glossaryChapter(lang, chapters.length + 1, entries));

  return {
    kind: "protocol",
    lang,
    title: meta.title || "KI-Geschäftsführer: Fiktion oder Realität?",
    docType: L.protocol,
    shortTitle: `${meta.title || "KI-Geschäftsführer"} · ${L.protocol}`,
    fileBase: `workshop-protokoll-${today()}`,
    chapters,
    labels: L,
  };
}

/* ---------------------------------------------------------------- report */

/** Provenance shown in the report header; defaults to "now" / unknown count. */
export interface ReportInfo {
  /** ISO timestamp of the generation run */
  createdAt?: string;
  /** Number of contributions the report was generated from */
  entryCount?: number;
}

/** Picture + core question for a report section, derived from its heading. */
function reportDecor(title: string, lang: Lang): Pick<ExportChapter, "image" | "question"> {
  const L = LABELS[lang];
  const phase = /Phase\s*(\d)/i.exec(title);
  if (phase) {
    const n = Number(phase[1]);
    const kq = KEY_QUESTIONS[n];
    return { image: moduleImage(n), question: kq ? { label: L.keyQuestion, text: kq[lang] } : undefined };
  }
  if (/summary/i.test(title)) return { image: BRAND.hero };
  if (/ausgangslage|starting point/i.test(title)) return { image: moduleImage(0) };
  if (/offene fragen|open questions|nächste schritte|next steps/i.test(title)) return { image: moduleImage(7) };
  return {};
}

export function buildReportModel(lang: Lang, markdown: string, info: ReportInfo = {}): ExportDoc {
  const L = LABELS[lang];
  const { meta, entries } = getState();
  const facts: [string, string][] = [[L.date, formatDate(meta.date, lang)], participantFact(lang)];
  if (info.entryCount !== undefined) facts.push([L.reportCount, String(info.entryCount)]);
  facts.push([L.reportCreated, formatStamp(info.createdAt ?? new Date().toISOString(), lang)]);
  const chapters: ExportChapter[] = [framingChapter(lang, facts, L.reportNote)];

  // The shallowest heading level becomes the chapter, the next one the section; deeper ones are sub-headings.
  const nodes = parseMarkdown(markdown);
  const levels = nodes.flatMap((n) => (n.type === "heading" ? [n.level] : []));
  const top = levels.length ? Math.min(...levels) : 2;

  const newChapter = (title: string): ExportChapter => {
    const number = chapters.length + 1;
    const ch: ExportChapter = { anchor: `kapitel-${number}`, number, title, blocks: [], sections: [], ...reportDecor(title, lang) };
    chapters.push(ch);
    return ch;
  };
  let chapter: ExportChapter | undefined;
  let section: ExportSection | undefined;
  for (const node of nodes) {
    if (node.type === "heading" && node.level === top) {
      chapter = newChapter(plain(node.runs));
      section = undefined;
      continue;
    }
    chapter ??= newChapter(L.prelude);
    if (node.type === "heading" && node.level === top + 1) {
      section = { anchor: `${chapter.anchor}-${chapter.sections.length + 1}`, title: plain(node.runs), blocks: [] };
      chapter.sections.push(section);
      continue;
    }
    (section ?? chapter).blocks.push(node.type === "heading" ? { type: "sub", runs: node.runs } : node);
  }

  chapters.push(glossaryChapter(lang, chapters.length + 1, entries));
  return {
    kind: "report",
    lang,
    title: meta.title || "KI-Geschäftsführer: Fiktion oder Realität?",
    docType: L.report,
    shortTitle: `${meta.title || "KI-Geschäftsführer"} · ${L.report}`,
    fileBase: `workshop-ergebnisbericht-${today()}`,
    chapters,
    labels: L,
  };
}
