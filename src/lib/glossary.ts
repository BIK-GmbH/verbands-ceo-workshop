/**
 * Adaptive workshop glossary — backend-free, localStorage-backed.
 *
 * At the end of the workshop the facilitator lets Claude (opt-in, on demand)
 * suggest terms from the captured contributions. Suggestions are reviewed and
 * taken over singly, in a selection or all at once. Anything taken over without
 * individual review is flagged `approved: false` until someone approves it.
 *
 * Every change mirrors the adopted terms into the workshop protocol as entry
 * `99.01:glossar-workshop`, so they show up in the live protocol, /protokoll,
 * the PDF/Word export and the AI results report without extra wiring.
 */
import { useSyncExternalStore } from "react";
import staticGlossarySource from "@/content/99-01-glossar.mdx?raw";
import { completeText } from "./ai-assist";
import { getAllEntries, getEntry, removeEntry, setEntry, type CaptureEntry } from "./workshop-store";
import { hasValue, isAdHoc } from "./protocol-export";

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  /** false = taken over without individual review ("nicht freigegeben") */
  approved: boolean;
  /** ISO timestamp (UTC) */
  createdAt: string;
  /** "workshop" = from an AI suggestion, "manual" = typed in by hand */
  source: "workshop" | "manual";
}

export interface GlossarySuggestion {
  id: string;
  term: string;
  definition: string;
}

export interface GlossaryState {
  terms: GlossaryTerm[];
  suggestions: GlossarySuggestion[];
}

export type SuggestionDraft = Omit<GlossarySuggestion, "id">;

const KEY = "verbands-ceo.glossary.v1";
const EVENT = "workshop-glossary-change";
const MAX_SUGGESTIONS = 15;

export const GLOSSARY_ENTRY_ID = "99.01:glossar-workshop";
const GLOSSARY_ENTRY_PROMPT = "Glossar – im Workshop ergänzt";

/* ------------------------------------------------------------ static terms */

/** Bold terms from the German table of the static glossary slide (e.g. „KI / LLM (Sprachmodell)“). */
function extractStaticTerms(source: string): string[] {
  const de = /<De>([\s\S]*?)<\/De>/.exec(source)?.[1] ?? "";
  return [...de.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|/gm)].map((m) => m[1].trim());
}

export const STATIC_TERMS: string[] = extractStaticTerms(staticGlossarySource);

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** All spellings a term covers: „DSGVO / AVV“ → dsgvoavv, dsgvo, avv; „KI (Sprachmodell)“ → ki, sprachmodell … */
function aliases(term: string): string[] {
  const inParens = [...term.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const outside = term.replace(/\([^)]*\)/g, " ");
  return [term, outside, ...outside.split("/"), ...inParens].map(normalize).filter((a) => a.length > 1);
}

/* ----------------------------------------------------------------- storage */

const EMPTY: GlossaryState = { terms: [], suggestions: [] };
let cacheRaw: string | null | undefined;
let cacheState: GlossaryState = EMPTY;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function sanitize(parsed: unknown): GlossaryState {
  if (!isRecord(parsed)) return EMPTY;
  const terms = (Array.isArray(parsed.terms) ? parsed.terms : []).filter(isRecord).map(
    (t, i): GlossaryTerm => ({
      id: str(t.id) || `g-import-${i}`,
      term: str(t.term),
      definition: str(t.definition),
      approved: t.approved === true,
      createdAt: str(t.createdAt),
      source: t.source === "manual" ? "manual" : "workshop",
    }),
  );
  const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).filter(isRecord).map(
    (s, i): GlossarySuggestion => ({ id: str(s.id) || `s-import-${i}`, term: str(s.term), definition: str(s.definition) }),
  );
  return { terms, suggestions };
}

/** Referentially stable snapshot (required by useSyncExternalStore), keyed on the raw string. */
export function getGlossary(): GlossaryState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private mode / policy): behaves like an empty glossary.
    return EMPTY;
  }
  if (raw === cacheRaw) return cacheState;
  cacheRaw = raw;
  try {
    cacheState = raw ? sanitize(JSON.parse(raw)) : EMPTY;
  } catch {
    cacheState = EMPTY;
  }
  return cacheState;
}

const byTerm = (a: GlossaryTerm, b: GlossaryTerm) => a.term.localeCompare(b.term, "de", { sensitivity: "base" });

/** Protocol line per term; unreviewed terms carry the flag so it survives every export. */
export function termLine(t: GlossaryTerm): string {
  return `${t.term.trim()}: ${t.definition.trim()}${t.approved ? "" : " (nicht freigegeben)"}`;
}

function syncProtocol(terms: GlossaryTerm[]) {
  if (terms.length === 0) {
    if (getEntry(GLOSSARY_ENTRY_ID)) removeEntry(GLOSSARY_ENTRY_ID);
    return;
  }
  const value = terms.map(termLine).join("\n");
  if (getEntry(GLOSSARY_ENTRY_ID)?.value === value) return;
  setEntry({ id: GLOSSARY_ENTRY_ID, module: 99, slideId: "99.01", kind: "text", prompt: GLOSSARY_ENTRY_PROMPT, value });
}

/** Persists the state and mirrors the terms into the protocol. Throws if the browser blocks storage. */
function write(next: GlossaryState) {
  const state = { ...next, terms: [...next.terms].sort(byTerm) };
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT));
  syncProtocol(state.terms);
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useGlossary(): GlossaryState {
  return useSyncExternalStore(subscribe, getGlossary, () => EMPTY);
}

function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/* ----------------------------------------------------------------- actions */

export function replaceSuggestions(list: SuggestionDraft[]) {
  write({ ...getGlossary(), suggestions: list.map((s) => ({ id: newId("s"), ...s })) });
}

export function updateSuggestion(id: string, patch: Partial<SuggestionDraft>) {
  const state = getGlossary();
  write({ ...state, suggestions: state.suggestions.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}

/** Removes the given suggestions, or all of them without `ids`. */
export function discardSuggestions(ids?: string[]) {
  const state = getGlossary();
  write({ ...state, suggestions: ids ? state.suggestions.filter((s) => !ids.includes(s.id)) : [] });
}

/**
 * Moves suggestions into the glossary. Bulk takeovers pass `approved: false`
 * (not individually reviewed). Empty rows and terms already in the glossary
 * are dropped. Returns how many terms were added.
 */
export function acceptSuggestions(ids: string[], approved = false): number {
  const state = getGlossary();
  const known = new Set(state.terms.map((t) => normalize(t.term)));
  const createdAt = new Date().toISOString();
  const added: GlossaryTerm[] = [];
  for (const s of state.suggestions) {
    if (!ids.includes(s.id)) continue;
    const term = s.term.trim();
    const definition = s.definition.trim();
    if (!term || !definition || known.has(normalize(term))) continue;
    known.add(normalize(term));
    added.push({ id: newId("g"), term, definition, approved, createdAt, source: "workshop" });
  }
  write({ terms: [...state.terms, ...added], suggestions: state.suggestions.filter((s) => !ids.includes(s.id)) });
  return added.length;
}

export function approveTerm(id: string) {
  const state = getGlossary();
  write({ ...state, terms: state.terms.map((t) => (t.id === id ? { ...t, approved: true } : t)) });
}

export function approveAllTerms() {
  const state = getGlossary();
  write({ ...state, terms: state.terms.map((t) => ({ ...t, approved: true })) });
}

export function updateTerm(id: string, patch: Partial<Pick<GlossaryTerm, "term" | "definition">>) {
  const state = getGlossary();
  write({ ...state, terms: state.terms.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
}

export function removeTerm(id: string) {
  const state = getGlossary();
  write({ ...state, terms: state.terms.filter((t) => t.id !== id) });
}

/** Manually added terms were written by the facilitator and count as approved. */
export function addManualTerm(term: string, definition: string) {
  const state = getGlossary();
  const entry: GlossaryTerm = {
    id: newId("g"),
    term: term.trim(),
    definition: definition.trim(),
    approved: true,
    createdAt: new Date().toISOString(),
    source: "manual",
  };
  write({ ...state, terms: [...state.terms, entry] });
}

/* ------------------------------------------------------------- suggestions */

export type GlossaryErrorCode = "no-entries" | "parse";

export class GlossaryError extends Error {
  readonly code: GlossaryErrorCode;
  constructor(code: GlossaryErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "GlossaryError";
    this.code = code;
  }
}

/**
 * Contributions that feed the suggestions: everything with content plus open
 * ad-hoc questions. Left out: the glossary mirror itself and the single votes
 * of the barometer ("Option — Name"), so no participant names leave the browser.
 */
export function glossarySourceEntries(entries: CaptureEntry[]): CaptureEntry[] {
  return entries.filter(
    (e) => e.id !== GLOSSARY_ENTRY_ID && !e.id.endsWith("-stimmen") && (hasValue(e) || isAdHoc(e)),
  );
}

const SYSTEM = `Du bist Redakteur für das Glossar des Workshops „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Teilnehmende sind Vorstand und Mitglieder eines Fachverbands, keine KI-Fachleute.

Aufgabe: Finde in den Workshop-Beiträgen Fachbegriffe, Abkürzungen und workshopspezifische Begriffe, die in den Beiträgen tatsächlich vorkommen und für die Teilnehmenden erklärungsbedürftig sind, vor allem aus Verbandsarbeit, Betonbohren und -sägen sowie künstlicher Intelligenz. Schreibe zu jedem Begriff eine Erläuterung.

Regeln:
- Nur Begriffe, die in den Beiträgen vorkommen. Erfinde keine Begriffe und keine Bedeutungen. Ist die Bedeutung weder allgemein bekannt noch aus dem Kontext eindeutig, lass den Begriff weg.
- Keine Dubletten zu den vorhandenen Glossarbegriffen, auch nicht in anderer Schreibweise, als Abkürzung oder als Langform. Keine Dubletten untereinander.
- Keine Produkt-, Marken-, Anbieter- oder Werkzeugnamen als Begriffe und keine Personennamen.
- Erläuterung: 1–2 Sätze, allgemein verständlich, sachlich und neutral, ohne Wertung und ohne Bezug auf einzelne Beiträge oder Personen.
- Begriff in gebräuchlicher Schreibweise; bei Abkürzungen die Langform in Klammern, z. B. „BIM (Building Information Modeling)“.
- Höchstens ${MAX_SUGGESTIONS} Vorschläge, die wichtigsten zuerst. Deutsch, neue Rechtschreibung.

Format: Antworte ausschließlich mit einem JSON-Array, ohne Einleitung, Erklärung oder Codeblock:
[{"term": "…", "definition": "…"}]
Findest du keine passenden Begriffe, antworte mit [].`;

function entryBlock(e: CaptureEntry): string {
  const answer = !hasValue(e)
    ? "(offen)"
    : Array.isArray(e.value)
      ? e.value.map((v) => `\n- ${v}`).join("")
      : e.value.trim();
  return [`<beitrag folie="${e.slideId}">`, `Frage: ${e.prompt.trim()}`, `Antwort: ${answer}`, "</beitrag>"].join("\n");
}

function existingTerms(state: GlossaryState): string[] {
  return [...STATIC_TERMS, ...state.terms.map((t) => t.term)];
}

function buildPrompt(entries: CaptureEntry[], existing: string[]): string {
  return [
    "<beitraege>",
    entries.map(entryBlock).join("\n\n"),
    "</beitraege>",
    "",
    "<vorhandene_begriffe>",
    existing.map((t) => `- ${t}`).join("\n"),
    "</vorhandene_begriffe>",
    "",
    "Liefere jetzt die Glossar-Vorschläge als JSON-Array.",
  ].join("\n");
}

/** Extracts the first `[` … last `]` and keeps only well-formed items. Throws GlossaryError("parse"). */
export function parseSuggestions(text: string): SuggestionDraft[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) throw new GlossaryError("parse", "no JSON array in answer");
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    throw new GlossaryError("parse", err instanceof Error ? err.message : String(err));
  }
  if (!Array.isArray(data)) throw new GlossaryError("parse", "answer is not an array");
  return data
    .filter(isRecord)
    .map((item) => ({ term: str(item.term).trim(), definition: str(item.definition).trim() }))
    .filter((s) => s.term && s.definition);
}

/** Drops suggestions that duplicate an existing term (any spelling) or each other; caps the list. */
function dedupe(list: SuggestionDraft[], existing: string[]): SuggestionDraft[] {
  const seen = new Set(existing.flatMap(aliases));
  const out: SuggestionDraft[] = [];
  for (const s of list) {
    const own = aliases(s.term);
    if (own.length === 0 || own.some((a) => seen.has(a))) continue;
    own.forEach((a) => seen.add(a));
    out.push(s);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Asks Claude for glossary terms found in the protocol. Sends only the
 * contributions (question + answer) and the list of existing terms, never the
 * participant list. Throws GlossaryError or AiAssistError.
 */
export async function fetchGlossarySuggestions(): Promise<SuggestionDraft[]> {
  const entries = glossarySourceEntries(getAllEntries());
  if (entries.length === 0) throw new GlossaryError("no-entries");
  const existing = existingTerms(getGlossary());
  const answer = await completeText({
    system: SYSTEM,
    prompt: buildPrompt(entries, existing),
    effort: "medium",
    logLabel: "glossary",
  });
  try {
    // Re-read the terms: some may have been added while the request was running.
    return dedupe(parseSuggestions(answer), existingTerms(getGlossary()));
  } catch (err) {
    console.error("[glossary] could not parse suggestions", { detail: err instanceof Error ? err.message : err });
    throw err;
  }
}
