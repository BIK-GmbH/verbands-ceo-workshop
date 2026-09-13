/**
 * The group picture of slide 01.02 — which protocol entries the AI interviews
 * feed, and how a hand-set value lives next to a measured one.
 *
 * The four dimensions (attitude, competence, relevance today/tomorrow) are
 * measured: they come out of the interview evaluation, not out of a show of
 * hands. A facilitator can still overrule a single value — for someone without
 * an interview, or when transcription fails. A hand-set value is stored with a
 * visible marker so the record says where the number comes from.
 *
 * The entry ids are numbered (i1 … i9) because the record and every export sort
 * contributions alphabetically by id: numbering keeps the record in the order
 * of the slide and of the interview guide.
 */
import {
  AGREEMENT_LABEL,
  SCALE_BY_ID,
  SCALE_MAX,
  SCALE_MIN,
  formatNumber,
  levelLabel,
  scaleRange,
  type GroupMetrics,
  type ScaleId,
  type ScaleStats,
  type TermCount,
} from "@/lib/interview-metrics";
import { getEntry, removeEntry, setEntry, type CaptureEntry } from "@/lib/workshop-store";

export const GROUP_SLIDE_ID = "01.02";
export const GROUP_MODULE = 1;

/** Field keys in the order of the interview guide: attitude first, then terms. */
export const SCALE_FIELD: Record<ScaleId, string> = {
  haltung: "i1-haltung",
  kompetenz: "i3-kompetenz",
  relevanzHeute: "i4-relevanz-heute",
  relevanzMorgen: "i5-relevanz-morgen",
};
export const TERMS_FIELD = "i2-begriffe";
export const AREAS_FIELD = "i6-einsatzgebiete";
export const OPINION_FIELD = "i7-meinungsbild-gesamt";
export const METRICS_FIELD = "i8-gruppenbild-kennzahlen";
export const NOTES_FIELD = "i9-ergaenzungen";

export const groupEntryId = (field: string) => `${GROUP_SLIDE_ID}:${field}`;

/** German headings — they are the headings in /protokoll, PDF and Word. */
export const SCALE_PROMPT: Record<ScaleId, string> = {
  haltung: "Grundhaltung zu KI – aus den Interviews",
  kompetenz: "Eigene KI-Kompetenz – aus den Interviews",
  relevanzHeute: "Relevanz von KI für den Verband heute – aus den Interviews",
  relevanzMorgen: "Relevanz von KI für den Verband morgen – aus den Interviews",
};
export const TERMS_PROMPT = "Unsere Begriffe zu KI – häufigste Nennungen";
export const AREAS_PROMPT = "Einsatzgebiete für KI – häufigste Nennungen";
export const OPINION_PROMPT = "Gemeinsames Meinungsbild aus den KI-Interviews";
export const METRICS_PROMPT = "Gruppenbild: Kennzahlen aus den KI-Interviews";
export const NOTES_PROMPT = "Ergänzungen und Auffälligkeiten aus der Runde";

// ---------------------------------------------------------------------------
// Hand-set values
//
// A hand-set value is stored in the protocol entry itself, marked by a fixed
// suffix, so it is backed up, exported and readable without a second store.
// If someone edits the text by hand in /protokoll the marker no longer parses
// and the measured value simply takes over again.

const MANUAL_MARK = "von Hand gesetzt";
const MANUAL_SUFFIX = ` · ${MANUAL_MARK}`;
const MANUAL_RE = /\s*·\s*von Hand gesetzt\s*$/;
const MANUAL_STEP_RE = /\((\d)\s+von\s+4\)/;

export const MANUAL_LABEL = { de: MANUAL_MARK, en: "set by hand" };

export function isManualValue(value: CaptureEntry["value"] | undefined): boolean {
  return typeof value === "string" && MANUAL_RE.test(value);
}

export function formatManualScale(id: ScaleId, step: number): string {
  return `${levelLabel(id, step, "de")} (${step} von 4)${MANUAL_SUFFIX}`;
}

/** The hand-set step, or null when the entry carries a measured value (or was edited by hand). */
export function parseManualScale(value: CaptureEntry["value"] | undefined): number | null {
  if (!isManualValue(value)) return null;
  const match = MANUAL_STEP_RE.exec(value as string);
  const step = match ? Number(match[1]) : Number.NaN;
  return Number.isInteger(step) && step >= SCALE_MIN && step <= SCALE_MAX ? step : null;
}

export const formatManualText = (text: string) => `${text.trim()}${MANUAL_SUFFIX}`;

export const parseManualText = (value: CaptureEntry["value"] | undefined) =>
  isManualValue(value) ? (value as string).replace(MANUAL_RE, "").trim() : "";

// ---------------------------------------------------------------------------
// Measured values

/** One line per scale for the record: mean, spread, range and how many interviews carry the value. */
export function measuredScaleText(stat: ScaleStats): string {
  if (!stat.count || stat.mean === null) return "";
  const spread =
    stat.sd === null
      ? "Streuung erst ab zwei Angaben"
      : `σ ${formatNumber(stat.sd, "de", 2)} (${AGREEMENT_LABEL[stat.agreement ?? "mixed"].de})`;
  return `Ø ${formatNumber(stat.mean, "de")} von 4 (${scaleRange(stat.id, "de")}) · ${spread} · Spanne ${stat.min}–${stat.max} · n = ${stat.count}`;
}

export const termListText = (terms: TermCount[]) => terms.map((t) => `${t.term} (${t.count})`).join(" · ");

// ---------------------------------------------------------------------------
// The picture the slide shows

export type ValueSource = "measured" | "manual" | "none";

export interface ScaleValue {
  id: ScaleId;
  stat: ScaleStats;
  source: ValueSource;
  /** Hand-set step 1–4; null unless `source` is "manual". */
  manual: number | null;
  /** What stands (or would stand) in the record. */
  text: string;
}

export interface ListValue {
  field: string;
  prompt: string;
  source: ValueSource;
  /** Hand-written text; empty unless `source` is "manual". */
  manual: string;
  /** The counted mentions behind the measured value. */
  terms: TermCount[];
  text: string;
}

export interface GroupPicture {
  scales: ScaleValue[];
  begriffe: ListValue;
  einsatzgebiete: ListValue;
  /** True while no dimension carries a value at all. */
  empty: boolean;
}

function listValue(field: string, prompt: string, terms: TermCount[], stored: CaptureEntry["value"] | undefined): ListValue {
  const manual = parseManualText(stored);
  if (manual) return { field, prompt, source: "manual", manual, terms, text: formatManualText(manual) };
  const text = termListText(terms);
  return { field, prompt, source: text ? "measured" : "none", manual: "", terms, text };
}

/** Merges the measured figures with the hand-set corrections stored in the record. */
export function groupPicture(metrics: GroupMetrics, entries: CaptureEntry[]): GroupPicture {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const valueOf = (field: string) => byId.get(groupEntryId(field))?.value;

  const scales = metrics.scales.map<ScaleValue>((stat) => {
    const manual = parseManualScale(valueOf(SCALE_FIELD[stat.id]));
    if (manual !== null) {
      return { id: stat.id, stat, source: "manual", manual, text: formatManualScale(stat.id, manual) };
    }
    const text = measuredScaleText(stat);
    return { id: stat.id, stat, source: text ? "measured" : "none", manual: null, text };
  });

  const begriffe = listValue(TERMS_FIELD, TERMS_PROMPT, metrics.begriffe, valueOf(TERMS_FIELD));
  const einsatzgebiete = listValue(AREAS_FIELD, AREAS_PROMPT, metrics.einsatzgebiete, valueOf(AREAS_FIELD));
  const empty = scales.every((s) => s.source === "none") && begriffe.source === "none" && einsatzgebiete.source === "none";
  return { scales, begriffe, einsatzgebiete, empty };
}

// ---------------------------------------------------------------------------
// Writing into the record

/** Writes only on a real change, so the entry timestamps stay meaningful. */
function writeField(field: string, prompt: string, value: string) {
  const id = groupEntryId(field);
  const current = getEntry(id);
  if (!value) {
    if (current) removeEntry(id);
    return;
  }
  if (current?.value === value && current.prompt === prompt) return;
  setEntry({ id, module: GROUP_MODULE, slideId: GROUP_SLIDE_ID, kind: "text", prompt, value });
}

/**
 * Keeps the record in step with the slide: measured values are written as they
 * are computed, hand-set ones stay untouched, and a dimension without any value
 * carries no entry.
 */
export function syncGroupProtocol(picture: GroupPicture) {
  for (const scale of picture.scales) writeField(SCALE_FIELD[scale.id], SCALE_PROMPT[scale.id], scale.text);
  writeField(picture.begriffe.field, picture.begriffe.prompt, picture.begriffe.text);
  writeField(picture.einsatzgebiete.field, picture.einsatzgebiete.prompt, picture.einsatzgebiete.text);
}

/** Sets one scale by hand; `null` drops the correction and the measured value returns. */
export function setManualScale(id: ScaleId, step: number | null) {
  const entryId = groupEntryId(SCALE_FIELD[id]);
  if (step === null) {
    if (getEntry(entryId)) removeEntry(entryId);
    return;
  }
  setEntry({
    id: entryId,
    module: GROUP_MODULE,
    slideId: GROUP_SLIDE_ID,
    kind: "text",
    prompt: SCALE_PROMPT[id],
    value: formatManualScale(id, step),
  });
}

/** Sets terms or areas of application by hand; empty text drops the correction. */
export function setManualList(list: ListValue, text: string) {
  const entryId = groupEntryId(list.field);
  if (!text.trim()) {
    if (getEntry(entryId)) removeEntry(entryId);
    return;
  }
  setEntry({
    id: entryId,
    module: GROUP_MODULE,
    slideId: GROUP_SLIDE_ID,
    kind: "text",
    prompt: list.prompt,
    value: formatManualText(text),
  });
}

// ---------------------------------------------------------------------------
// Older records

interface LegacyField {
  from: string;
  to: string;
  prompt: string;
  convert: (value: string) => string;
}

const asManualStep = (id: ScaleId) => (value: string) => {
  const index = SCALE_BY_ID[id].levels.findIndex((l) => l.de.toLowerCase() === value.trim().toLowerCase());
  return index === -1 ? formatManualText(value) : formatManualScale(id, index + 1);
};

/** The un-numbered fields this slide used before the interview evaluation replaced the show of hands. */
const LEGACY: LegacyField[] = [
  { from: "ki-haltung", to: SCALE_FIELD.haltung, prompt: SCALE_PROMPT.haltung, convert: asManualStep("haltung") },
  { from: "ki-begriffe", to: TERMS_FIELD, prompt: TERMS_PROMPT, convert: formatManualText },
  { from: "ki-kompetenz", to: SCALE_FIELD.kompetenz, prompt: SCALE_PROMPT.kompetenz, convert: asManualStep("kompetenz") },
  {
    from: "relevanz-heute",
    to: SCALE_FIELD.relevanzHeute,
    prompt: SCALE_PROMPT.relevanzHeute,
    convert: asManualStep("relevanzHeute"),
  },
  {
    from: "relevanz-morgen",
    to: SCALE_FIELD.relevanzMorgen,
    prompt: SCALE_PROMPT.relevanzMorgen,
    convert: asManualStep("relevanzMorgen"),
  },
  { from: "ki-einsatzgebiete", to: AREAS_FIELD, prompt: AREAS_PROMPT, convert: formatManualText },
  { from: "meinungsbild-gesamt", to: OPINION_FIELD, prompt: OPINION_PROMPT, convert: (v) => v },
  { from: "gruppenbild-kennzahlen", to: METRICS_FIELD, prompt: METRICS_PROMPT, convert: (v) => v },
];

/**
 * Carries entries from an earlier session over to the numbered ids. The old
 * votes were the group's own estimate, so they arrive as hand-set values.
 * Idempotent: once moved, nothing is left to move.
 */
export function migrateLegacyGroupEntries(): number {
  let moved = 0;
  for (const legacy of LEGACY) {
    const oldId = groupEntryId(legacy.from);
    const old = getEntry(oldId);
    if (!old) continue;
    const value = typeof old.value === "string" ? old.value.trim() : old.value.join(", ").trim();
    const target = groupEntryId(legacy.to);
    if (value && !getEntry(target)) {
      setEntry({
        id: target,
        module: GROUP_MODULE,
        slideId: GROUP_SLIDE_ID,
        kind: "text",
        prompt: legacy.prompt,
        value: legacy.convert(value),
      });
    }
    removeEntry(oldId);
    moved++;
  }
  return moved;
}
