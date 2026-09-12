/**
 * Structured evaluation of the AI interviews (phase 1, slide 01.02).
 *
 * Besides the free-text opinion picture, Claude returns four 1–4 scale values
 * plus the terms and areas of application it heard. Everything in this module
 * is computed locally in the browser — no AI, no network — so the group figures
 * (distribution, mean, spread) are reproducible and cannot be hallucinated.
 */
import type { Bilingual, Lang } from "@/types/slide";

export type ScaleId = "haltung" | "kompetenz" | "relevanzHeute" | "relevanzMorgen";

/** Values a scale can take: 1 (lowest) … 4 (highest); `null` = not covered by the interview. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 4;

export interface InterviewScales {
  haltung: number | null;
  kompetenz: number | null;
  relevanzHeute: number | null;
  relevanzMorgen: number | null;
  /** Terms named for AI, lower case, at most 5. */
  begriffe: string[];
  /** Short phrases naming areas of application, at most 5. */
  einsatzgebiete: string[];
}

export const EMPTY_SCALES: InterviewScales = {
  haltung: null,
  kompetenz: null,
  relevanzHeute: null,
  relevanzMorgen: null,
  begriffe: [],
  einsatzgebiete: [],
};

export interface ScaleDef {
  id: ScaleId;
  label: Bilingual;
  /** Four step labels, index 0 = value 1. */
  levels: Bilingual[];
}

export const SCALES: ScaleDef[] = [
  {
    id: "haltung",
    label: { de: "Haltung zu KI", en: "Attitude towards AI" },
    levels: [
      { de: "Skeptisch", en: "Sceptical" },
      { de: "Abwartend", en: "Wait and see" },
      { de: "Neugierig", en: "Curious" },
      { de: "Überzeugt", en: "Convinced" },
    ],
  },
  {
    id: "kompetenz",
    label: { de: "KI-Kompetenz", en: "AI competence" },
    levels: [
      { de: "Einsteiger", en: "Beginner" },
      { de: "Grundkenntnisse", en: "Basic knowledge" },
      { de: "Fortgeschritten", en: "Advanced" },
      { de: "Experte", en: "Expert" },
    ],
  },
  {
    id: "relevanzHeute",
    label: { de: "Relevanz heute", en: "Relevance today" },
    levels: [
      { de: "gering", en: "low" },
      { de: "mittel", en: "medium" },
      { de: "hoch", en: "high" },
      { de: "sehr hoch", en: "very high" },
    ],
  },
  {
    id: "relevanzMorgen",
    label: { de: "Relevanz morgen", en: "Relevance tomorrow" },
    levels: [
      { de: "gering", en: "low" },
      { de: "mittel", en: "medium" },
      { de: "hoch", en: "high" },
      { de: "sehr hoch", en: "very high" },
    ],
  },
];

export const SCALE_BY_ID: Record<ScaleId, ScaleDef> = Object.fromEntries(SCALES.map((s) => [s.id, s])) as Record<ScaleId, ScaleDef>;

// ---------------------------------------------------------------------------
// Thresholds (named constants so the wording in the UI and the protocol match)

/** Standard deviation below this: the group agrees. */
export const SD_AGREE = 0.6;
/** Up to this: mixed picture. Above it: the group disagrees. */
export const SD_MIXED = 1.0;
/** Difference of the means (steps) from which the jump today → tomorrow counts as clear. */
export const GAP_STRONG = 1.0;
/** Below this the two means are treated as practically equal. */
export const GAP_NOTICEABLE = 0.4;
/** Fewer values than this: the figures are only an impression. */
export const MIN_MEANINGFUL = 3;
/** How many terms / areas of application the top list shows. */
export const TOP_TERMS = 8;
export const TOP_AREAS = 5;

export type Agreement = "agree" | "mixed" | "split";

export const AGREEMENT_LABEL: Record<Agreement, Bilingual> = {
  agree: { de: "einig", en: "agreed" },
  mixed: { de: "gemischt", en: "mixed" },
  split: { de: "uneinig", en: "split" },
};

export function agreementFor(sd: number): Agreement {
  if (sd < SD_AGREE) return "agree";
  if (sd <= SD_MIXED) return "mixed";
  return "split";
}

export type GapTrend = "jump" | "rise" | "flat" | "drop";

export const GAP_LABEL: Record<GapTrend, Bilingual> = {
  jump: { de: "deutlicher Sprung", en: "clear jump" },
  rise: { de: "spürbarer Anstieg", en: "noticeable rise" },
  flat: { de: "kaum Unterschied", en: "hardly any difference" },
  drop: { de: "rückläufig", en: "declining" },
};

export function gapTrendFor(gap: number): GapTrend {
  if (gap <= -GAP_NOTICEABLE) return "drop";
  if (gap < GAP_NOTICEABLE) return "flat";
  if (gap < GAP_STRONG) return "rise";
  return "jump";
}

// ---------------------------------------------------------------------------
// Parsing the JSON block Claude appends to the opinion picture

function scaleValue(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= SCALE_MIN && rounded <= SCALE_MAX ? rounded : null;
}

function stringList(raw: unknown, max: number, lower: boolean): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!value) continue;
    const normalized = lower ? value.toLowerCase() : value;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= max) break;
  }
  return out;
}

/** Normalises one parsed object; returns null when it carries no usable information. */
export function sanitizeScales(raw: unknown): InterviewScales | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const scales: InterviewScales = {
    haltung: scaleValue(r.haltung),
    kompetenz: scaleValue(r.kompetenz),
    relevanzHeute: scaleValue(r.relevanzHeute),
    relevanzMorgen: scaleValue(r.relevanzMorgen),
    begriffe: stringList(r.begriffe, 5, true),
    einsatzgebiete: stringList(r.einsatzgebiete, 5, false),
  };
  return hasContent(scales) ? scales : null;
}

export function hasScaleValues(scales?: InterviewScales | null): boolean {
  if (!scales) return false;
  return SCALES.some((s) => scales[s.id] !== null);
}

function hasContent(scales: InterviewScales): boolean {
  return hasScaleValues(scales) || scales.begriffe.length > 0 || scales.einsatzgebiete.length > 0;
}

export interface ParsedOpinion {
  /** The opinion picture without the JSON block. */
  text: string;
  /** null when the model returned no (usable) block — the UI then marks the interview. */
  scales: InterviewScales | null;
}

const FENCE = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
const TRAILING_OBJECT = /\{[\s\S]*\}\s*$/;

function tryParse(text: string): InterviewScales | null {
  try {
    return sanitizeScales(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Splits the model answer into the readable opinion picture and the scale
 * values. Robust on purpose: a missing, truncated or invalid block only costs
 * the figures, never the text.
 */
export function parseOpinion(raw: string): ParsedOpinion {
  const text = raw.replace(/\r\n/g, "\n");
  // Last fenced block wins: the model may quote an example earlier on.
  const fences = [...text.matchAll(FENCE)];
  for (let i = fences.length - 1; i >= 0; i--) {
    const scales = tryParse(fences[i][1]);
    if (scales) {
      const cleaned = (text.slice(0, fences[i].index ?? 0) + text.slice((fences[i].index ?? 0) + fences[i][0].length)).trim();
      return { text: cleaned, scales };
    }
  }
  const trailing = TRAILING_OBJECT.exec(text);
  if (trailing) {
    const scales = tryParse(trailing[0]);
    if (scales) return { text: text.slice(0, trailing.index).trim(), scales };
  }
  return { text: text.trim(), scales: null };
}

/** Parses an answer that is expected to contain nothing but the JSON block. */
export function parseScalesOnly(raw: string): InterviewScales | null {
  return parseOpinion(raw).scales;
}

// ---------------------------------------------------------------------------
// Aggregation over all interviews (local, no AI)

export interface ScaleStats {
  id: ScaleId;
  /** Interviews that carry a value for this scale. */
  count: number;
  /** Counts per step, index 0 = value 1. */
  distribution: number[];
  mean: number | null;
  /** Population standard deviation over the values present; null for fewer than two. */
  sd: number | null;
  min: number | null;
  max: number | null;
  agreement: Agreement | null;
}

export interface TermCount {
  term: string;
  count: number;
}

export interface GroupMetrics {
  /** Interviews handed in. */
  interviews: number;
  /** Interviews with at least one scale value or term. */
  withScales: number;
  scales: ScaleStats[];
  /** Mean relevance tomorrow minus mean relevance today, in steps. */
  gap: number | null;
  gapTrend: GapTrend | null;
  begriffe: TermCount[];
  einsatzgebiete: TermCount[];
  /** True while too few values have come in for the figures to mean much. */
  thin: boolean;
}

function statsFor(id: ScaleId, values: number[]): ScaleStats {
  const distribution = [0, 0, 0, 0];
  values.forEach((v) => distribution[v - 1]++);
  if (!values.length) {
    return { id, count: 0, distribution, mean: null, sd: null, min: null, max: null, agreement: null };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // Population SD: the interviews are the whole group, not a sample drawn from one.
  const sd = values.length > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) : null;
  return {
    id,
    count: values.length,
    distribution,
    mean,
    sd,
    min: Math.min(...values),
    max: Math.max(...values),
    agreement: sd === null ? null : agreementFor(sd),
  };
}

/** Folds case, umlauts and a trailing plural ending so "Prozesse" and "Prozessen" land in one bucket. */
export function termKey(term: string): string {
  let key = term
    .toLowerCase()
    .replace(/[.,;:!?"'„“”()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
  for (const suffix of ["innen", "en", "er", "e", "n", "s"]) {
    if (key.endsWith(suffix) && key.length - suffix.length >= 5) {
      key = key.slice(0, -suffix.length);
      break;
    }
  }
  return key;
}

function countTerms(lists: string[][], limit: number): TermCount[] {
  const buckets = new Map<string, { count: number; forms: Map<string, number> }>();
  for (const list of lists) {
    // One mention per interview: repeating a word does not make it more common in the group.
    const seen = new Set<string>();
    for (const raw of list) {
      const key = termKey(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const bucket = buckets.get(key) ?? { count: 0, forms: new Map<string, number>() };
      bucket.count++;
      bucket.forms.set(raw, (bucket.forms.get(raw) ?? 0) + 1);
      buckets.set(key, bucket);
    }
  }
  return [...buckets.values()]
    .map((bucket) => {
      const forms = [...bucket.forms.entries()];
      // Most common spelling wins; ties keep the one seen first.
      const term = forms.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
      return { term, count: bucket.count };
    })
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, "de"))
    .slice(0, limit);
}

/** Everything the group panel and the protocol figures need, computed from the stored scale values. */
export function aggregateScales(list: (InterviewScales | undefined | null)[]): GroupMetrics {
  const present = list.filter((s): s is InterviewScales => Boolean(s) && hasContent(s as InterviewScales));
  const scales = SCALES.map((def) =>
    statsFor(
      def.id,
      present.map((s) => s[def.id]).filter((v): v is number => typeof v === "number"),
    ),
  );
  const heute = scales.find((s) => s.id === "relevanzHeute")?.mean ?? null;
  const morgen = scales.find((s) => s.id === "relevanzMorgen")?.mean ?? null;
  const gap = heute !== null && morgen !== null ? morgen - heute : null;
  const valueCount = Math.max(...scales.map((s) => s.count), 0);
  return {
    interviews: list.length,
    withScales: present.length,
    scales,
    gap,
    gapTrend: gap === null ? null : gapTrendFor(gap),
    begriffe: countTerms(
      present.map((s) => s.begriffe),
      TOP_TERMS,
    ),
    einsatzgebiete: countTerms(
      present.map((s) => s.einsatzgebiete),
      TOP_AREAS,
    ),
    thin: valueCount > 0 && valueCount < MIN_MEANINGFUL,
  };
}

// ---------------------------------------------------------------------------
// Formatting

/** One decimal, German comma where the UI is German. */
export function formatNumber(value: number, lang: Lang, digits = 1): string {
  const text = value.toFixed(digits);
  return lang === "de" ? text.replace(".", ",") : text;
}

export function formatSigned(value: number, lang: Lang, digits = 1): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${formatNumber(Math.abs(value), lang, digits)}`;
}

export function levelLabel(id: ScaleId, value: number | null, lang: Lang): string {
  if (value === null || value < SCALE_MIN || value > SCALE_MAX) return lang === "de" ? "keine Angabe" : "not stated";
  return SCALE_BY_ID[id].levels[value - 1][lang];
}

/** "1 Skeptisch … 4 Überzeugt" — the legend that makes a mean of 2,8 readable. */
export function scaleRange(id: ScaleId, lang: Lang): string {
  const levels = SCALE_BY_ID[id].levels;
  return `1 ${levels[0][lang]} … 4 ${levels[3][lang]}`;
}

/**
 * Compact, readable summary of the figures for the workshop protocol.
 * German only, like every other protocol entry.
 */
export function metricsProtocolText(m: GroupMetrics): string {
  const lines: string[] = [];
  lines.push(
    `Grundlage: ${m.withScales} von ${m.interviews} ${m.interviews === 1 ? "Interview" : "Interviews"} mit Skalenwerten. Lokal berechnet aus den Einzel-Meinungsbildern, ohne KI.`,
  );
  if (m.thin) lines.push("Hinweis: Bei weniger als drei Angaben je Skala ist die Aussagekraft gering – die Werte sind ein Eindruck, keine Statistik.");
  lines.push("");

  for (const stat of m.scales) {
    const def = SCALE_BY_ID[stat.id];
    const head = `${def.label.de} (${scaleRange(stat.id, "de")})`;
    if (!stat.count || stat.mean === null) {
      lines.push(`${head}: keine Angaben`);
      continue;
    }
    const spread =
      stat.sd === null
        ? "Streuung nicht berechenbar (nur eine Angabe)"
        : `Streuung σ ${formatNumber(stat.sd, "de", 2)} (${AGREEMENT_LABEL[stat.agreement ?? "mixed"].de})`;
    lines.push(
      `${head}: Ø ${formatNumber(stat.mean, "de")} von 4 · ${spread} · Spanne ${stat.min}–${stat.max} · ${stat.count} ${stat.count === 1 ? "Angabe" : "Angaben"}`,
    );
    lines.push(`  ${def.levels.map((l, i) => `${l.de} ${stat.distribution[i]}`).join(" · ")}`);
  }

  lines.push("");
  if (m.gap === null || m.gapTrend === null) {
    lines.push("Lücke Relevanz heute → morgen: nicht berechenbar (Angaben fehlen)");
  } else {
    lines.push(`Lücke Relevanz heute → morgen: ${formatSigned(m.gap, "de")} Stufen (${GAP_LABEL[m.gapTrend].de})`);
  }
  if (m.begriffe.length) {
    lines.push(`Häufigste Begriffe: ${m.begriffe.map((t) => `${t.term} (${t.count})`).join(" · ")}`);
  }
  if (m.einsatzgebiete.length) {
    lines.push(`Meistgenannte Einsatzgebiete: ${m.einsatzgebiete.map((t) => `${t.term} (${t.count})`).join(" · ")}`);
  }
  return lines.join("\n").trim();
}
