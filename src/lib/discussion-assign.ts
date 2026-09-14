/**
 * Assigns the recorded discussion to slides — after the workshop, before the
 * protocol is generated.
 *
 * Input is the full transcript of every session recording (the transcribed
 * segments in session-transcript-store.ts). Claude summarizes what was said and
 * assigns each point to the slide it belongs to by content; the slide that was
 * open at the time is only a hint, because discussions drift. The result is a
 * draft the room reviews and edits (DiscussionAssign.tsx) before it becomes one
 * record entry per slide, `<slideId>:mitschnitt`, marked everywhere as coming
 * from the recorded discussion.
 *
 * Transcript text only leaves the browser for the Claude call and is never logged.
 */
import { completeText } from "./ai-assist";
import { ALL_SLIDES, findSlide } from "./manifest";
import { DISCUSSION_PROMPT, discussionEntryId, isDiscussionEntry } from "./discussion-entry";
import { formatOffset, type SessionTranscript } from "./session-transcript-store";
import { getAllEntries, getEntry, removeEntry, setEntry } from "./workshop-store";

/* ------------------------------------------------------------------ types */

export interface DiscussionPoint {
  /** Stable key within the draft */
  id: string;
  /** Assigned slide, or null for "nicht zugeordnet" */
  slideId: string | null;
  text: string;
  sessionId: string;
  startSec: number;
  endSec: number;
  include: boolean;
}

export interface AssignDraft {
  createdAt: string;
  /** Sessions the draft was built from — a draft whose sessions are gone (reset) is dropped. */
  sessionIds: string[];
  points: DiscussionPoint[];
  /** Segments that were not transcribed and therefore not considered */
  gaps: { sessionId: string; startSec: number; endSec: number }[];
}

export interface AssignProgress {
  window: number;
  windows: number;
}

/* --------------------------------------------------------------- catalogue */

const slideSources = import.meta.glob<string>("../content/**/*.mdx", { query: "?raw", eager: true, import: "default" });

/** `prompt="…"` of capture blocks; the lookbehind keeps `clusterPrompt=` and friends out. */
const PROMPT_RE = /(?<![\w-])prompt\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** slideId → prompts of the capture fields declared on the slide. */
const DECLARED_PROMPTS: Map<string, string[]> = (() => {
  const out = new Map<string, string[]>();
  for (const [path, source] of Object.entries(slideSources)) {
    const m = /^(\d{2})-(\d{2})/.exec(path.split("/").pop() ?? "");
    if (!m || typeof source !== "string") continue;
    const prompts = [...source.matchAll(PROMPT_RE)].map((x) => (x[1] ?? x[2] ?? "").trim()).filter(Boolean);
    out.set(`${m[1]}.${m[2]}`, [...new Set(prompts)]);
  }
  return out;
})();

/** Deck slides the discussion can belong to: modules 0–7 (the appendix only holds the glossary). */
function catalogue(): string {
  const recorded = new Map<string, string[]>();
  for (const e of getAllEntries()) {
    if (isDiscussionEntry(e.id)) continue;
    recorded.set(e.slideId, [...(recorded.get(e.slideId) ?? []), e.prompt]);
  }
  return ALL_SLIDES.filter((s) => s.module !== 99)
    .map((s) => {
      const prompts = [...new Set([...(DECLARED_PROMPTS.get(s.id) ?? []), ...(recorded.get(s.id) ?? [])])]
        .map((p) => p.replace(/\s+/g, " ").slice(0, 90));
      return `${s.id} · Modul ${s.module} · ${s.title.de}${prompts.length ? ` · Felder: ${prompts.join(" | ")}` : ""}`;
    })
    .join("\n");
}

const VALID_SLIDES = new Set(ALL_SLIDES.filter((s) => s.module !== 99).map((s) => s.id));

/* ------------------------------------------------------------------ prompt */

const SYSTEM = `Du bereitest das Protokoll des Zweitages-Workshops „KI-Geschäftsführer: Fiktion oder Realität?" des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS) vor. Grundlage ist das automatische Transkript der mitgeschnittenen Diskussion. Es enthält Erkennungsfehler, Füllwörter und abgebrochene Sätze.

Deine Aufgabe:
1. Fasse zusammen, was tatsächlich gesagt wurde: Aussagen, Argumente, Beispiele, Einwände, offene Fragen, Vereinbarungen. Nichts erfinden, nichts ergänzen, nicht bewerten, keine Empfehlungen. Unklares weglassen statt raten.
2. Unterschiedliche Sichtweisen und Widersprüche bleiben sichtbar („Einerseits … andererseits …", „offen blieb, ob …"). Nicht glätten.
3. Formuliere knapp, sachlich und im gemeinsamen „wir" der Gruppe („wir sehen …", „offen ist für uns …"). Keine Personennamen, keine Zuordnung zu Personen. Keine Produkt- oder Anbieternamen; nennt jemand eines, neutral umschreiben.
4. Ordne jeden Punkt der Folie zu, zu der er inhaltlich passt (Folienkatalog). Die Folie, die beim Sprechen offen war, ist nur ein Hinweis: Diskussionen schweifen ab. Passt ein Punkt zu keiner Folie (Organisatorisches, Pausen, Technik), setze "folie": null. Reines Organisatorisches ohne inhaltlichen Wert ganz weglassen.
5. Jeder Punkt trägt den Zeitraum, aus dem er stammt, als "von"/"bis" im Format hh:mm:ss (Zeit ab Beginn der Aufnahme, wie in den Abschnitten angegeben) und die Nummer der Aufnahme.
6. Ein Punkt = ein Gedanke, ein bis drei Sätze. Wiederholungen zu einem Punkt zusammenfassen.

Was nie ins Protokoll gehört, auch nicht umschrieben oder angedeutet:
- Private und persönliche Angelegenheiten (Gesundheit, Familie, Privatleben, Klatsch über Einzelne).
- Beleidigungen, herabsetzende oder ehrverletzende Aussagen über Personen, diskriminierende, rassistische, sexistische oder sonst moralisch verwerfliche Äußerungen.
- Markierungen wie „[Passage entfernt: …]" ignorierst du vollständig: nicht erwähnen, dass etwas entfernt wurde, nicht erschließen, was dort stand.
Sachliche Kritik bleibt dagegen erhalten: an Projekten, Abläufen, dem Verband, früheren Vorhaben wie Wilma, an Werkzeugen oder Entscheidungen, ebenso Widerspruch, Skepsis und offene Fragen. Formuliere sie neutral und ohne Schuldzuweisung an benannte Personen.

Antworte ausschließlich mit JSON ohne Einleitung und ohne Code-Block:
{"punkte":[{"folie":"01.03","text":"…","aufnahme":1,"von":"00:12:30","bis":"00:15:10"}]}`;

interface Piece {
  session: number;
  sessionId: string;
  startSec: number;
  endSec: number;
  text: string;
  slides: string;
}

/** ~50k characters of transcript per call: well within the model's context, short enough for a quick answer. */
const WINDOW_CHARS = 50_000;

function windowsOf(pieces: Piece[]): Piece[][] {
  const out: Piece[][] = [];
  let current: Piece[] = [];
  let size = 0;
  for (const p of pieces) {
    if (current.length && size + p.text.length > WINDOW_CHARS) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(p);
    size += p.text.length;
  }
  if (current.length) out.push(current);
  return out;
}

function windowPrompt(pieces: Piece[], sessionCount: number, index: number, total: number): string {
  const body = pieces
    .map(
      (p) =>
        `<abschnitt aufnahme="${p.session}" von="${formatOffset(p.startSec)}" bis="${formatOffset(p.endSec)}"${p.slides ? ` offene_folien="${p.slides}"` : ""}>\n${p.text}\n</abschnitt>`,
    )
    .join("\n\n");
  return [
    `Folienkatalog (Kennung · Modul · Titel · Eingabefelder):`,
    catalogue(),
    "",
    `Transkript, Teil ${index + 1} von ${total}${sessionCount > 1 ? ` (${sessionCount} Aufnahmen)` : ""}:`,
    body,
  ].join("\n");
}

/* ------------------------------------------------------------------- parse */

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function parseTime(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const m = TIME_RE.exec(v.trim());
  if (!m) return null;
  return m[3] === undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Model output → points. Tolerates code fences and prose around the JSON; drops what does not validate. */
function parsePoints(out: string, pieces: Piece[], sessionIds: string[], idPrefix: string): DiscussionPoint[] {
  const cleaned = out.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the answer");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { punkte?: unknown };
  if (!Array.isArray(parsed.punkte)) throw new Error("answer has no punkte array");

  const bounds = new Map<number, { min: number; max: number }>();
  for (const p of pieces) {
    const b = bounds.get(p.session) ?? { min: p.startSec, max: p.endSec };
    bounds.set(p.session, { min: Math.min(b.min, p.startSec), max: Math.max(b.max, p.endSec) });
  }
  const fallbackSession = pieces[0]?.session ?? 1;

  const points: DiscussionPoint[] = [];
  parsed.punkte.forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null) return;
    const r = raw as Record<string, unknown>;
    const text = typeof r.text === "string" ? r.text.replace(/\s+/g, " ").trim() : "";
    if (!text) return;
    const slide = typeof r.folie === "string" && VALID_SLIDES.has(r.folie.trim()) ? r.folie.trim() : null;
    const session = typeof r.aufnahme === "number" && bounds.has(r.aufnahme) ? r.aufnahme : fallbackSession;
    const b = bounds.get(session) ?? { min: 0, max: 0 };
    let from = parseTime(r.von) ?? b.min;
    let to = parseTime(r.bis) ?? from;
    // Times outside the window are model slips: clamp them into what was actually sent.
    from = Math.min(Math.max(from, b.min), b.max);
    to = Math.min(Math.max(to, from), b.max);
    points.push({
      id: `${idPrefix}-${i}`,
      slideId: slide,
      text,
      sessionId: sessionIds[session - 1] ?? sessionIds[0] ?? "",
      startSec: from,
      endSec: to,
      include: true,
    });
  });
  return points;
}

/* --------------------------------------------------------------------- run */

export class AssignCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "AssignCancelled";
  }
}

/** Sessions with at least one transcribed segment, oldest first. */
export function usableSessions(sessions: SessionTranscript[]): SessionTranscript[] {
  return sessions.filter((s) => s.segments.some((x) => x.status === "done" && x.text?.trim()));
}

/**
 * Summarizes and assigns the whole transcript, window by window. `isCancelled`
 * is checked between the calls; a cancelled run throws AssignCancelled and
 * returns nothing, so a half result never looks complete.
 */
export async function buildAssignDraft(
  sessions: SessionTranscript[],
  onProgress: (p: AssignProgress) => void,
  isCancelled: () => boolean,
): Promise<AssignDraft> {
  const used = usableSessions(sessions);
  const sessionIds = used.map((s) => s.sessionId);
  const pieces: Piece[] = [];
  const gaps: AssignDraft["gaps"] = [];
  used.forEach((s, i) => {
    for (const seg of s.segments) {
      if (seg.status === "done" && seg.text?.trim()) {
        pieces.push({
          session: i + 1,
          sessionId: s.sessionId,
          startSec: seg.startSec,
          endSec: seg.endSec,
          text: seg.text.trim(),
          slides: [...new Set(seg.slides.map((m) => m.slideId))].join(", "),
        });
      } else {
        gaps.push({ sessionId: s.sessionId, startSec: seg.startSec, endSec: seg.endSec });
      }
    }
  });

  const windows = windowsOf(pieces);
  const points: DiscussionPoint[] = [];
  for (const [i, win] of windows.entries()) {
    if (isCancelled()) throw new AssignCancelled();
    onProgress({ window: i + 1, windows: windows.length });
    const out = await completeText({
      system: SYSTEM,
      prompt: windowPrompt(win, used.length, i, windows.length),
      effort: "medium",
      logLabel: `discussion-assign window ${i + 1}/${windows.length}`,
    });
    if (isCancelled()) throw new AssignCancelled();
    try {
      points.push(...parsePoints(out, win, sessionIds, `w${i}`));
    } catch (err) {
      // Log only the shape of the problem, never the transcript or the answer.
      console.error("[discussion-assign] unreadable answer", { window: i + 1, windows: windows.length, chars: out.length, err: String(err) });
      throw new Error("unreadable");
    }
  }

  return { createdAt: new Date().toISOString(), sessionIds, points, gaps };
}

/* ----------------------------------------------------------------- draft */

const DRAFT_KEY = "verbands-ceo.discussion-draft.v1";

/**
 * The draft survives a reload during the review, but only in this tab
 * (sessionStorage): it is never part of the device's lasting content.
 */
export function loadDraft(existingSessionIds: string[]): AssignDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as AssignDraft;
    if (!Array.isArray(draft.points) || !Array.isArray(draft.sessionIds)) return null;
    // Sessions gone (reset, other backup restored): the draft would bring back deleted content.
    if (!draft.sessionIds.every((id) => existingSessionIds.includes(id))) {
      clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: AssignDraft | null) {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    // Only the reload protection is lost; the draft on screen stays usable.
    console.error("[discussion-assign] keeping the draft failed", { err: String(err) });
  }
}

export const clearDraft = () => saveDraft(null);

/* ------------------------------------------------------------------- apply */

/** "[00:12:30–00:15:10]", with the recording number when there are several. */
export function rangeLabel(p: Pick<DiscussionPoint, "sessionId" | "startSec" | "endSec">, sessionIds: string[]): string {
  const n = sessionIds.indexOf(p.sessionId) + 1;
  const range = `${formatOffset(p.startSec)}–${formatOffset(p.endSec)}`;
  return sessionIds.length > 1 && n > 0 ? `[Aufnahme ${n}, ${range}]` : `[${range}]`;
}

function bullets(points: DiscussionPoint[], sessionIds: string[]): string {
  return [...points]
    .sort((a, b) => sessionIds.indexOf(a.sessionId) - sessionIds.indexOf(b.sessionId) || a.startSec - b.startSec)
    .map((p) => `- ${rangeLabel(p, sessionIds)} ${p.text.trim()}`)
    .join("\n");
}

/** Points that would be written: included, assigned, with text — grouped by slide in deck order. */
export function pointsBySlide(draft: AssignDraft): Map<string, DiscussionPoint[]> {
  const order = new Map(ALL_SLIDES.map((s, i) => [s.id, i]));
  const map = new Map<string, DiscussionPoint[]>();
  for (const p of draft.points) {
    if (!p.include || !p.slideId || !p.text.trim()) continue;
    map.set(p.slideId, [...(map.get(p.slideId) ?? []), p]);
  }
  return new Map([...map.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0)));
}

/** Discussion entries already in the record. */
export function existingDiscussionEntries() {
  return getAllEntries().filter((e) => isDiscussionEntry(e.id));
}

/**
 * Writes the draft into the record. `replace` removes every earlier discussion
 * entry first (a new run covers the whole transcript again); `append` adds the
 * new bullets below what a slide already has. Returns the number of slides written.
 */
export function applyDraft(draft: AssignDraft, mode: "replace" | "append"): number {
  const grouped = pointsBySlide(draft);
  if (mode === "replace") for (const e of existingDiscussionEntries()) removeEntry(e.id);
  for (const [slideId, points] of grouped) {
    const id = discussionEntryId(slideId);
    const text = bullets(points, draft.sessionIds);
    const previous = mode === "append" ? getEntry(id)?.value : undefined;
    const before = typeof previous === "string" ? previous.trim() : "";
    setEntry({
      id,
      module: Number.parseInt(slideId, 10),
      slideId,
      kind: "text",
      prompt: DISCUSSION_PROMPT,
      value: before ? `${before}\n${text}` : text,
    });
  }
  return grouped.size;
}

export function slideLabel(slideId: string, lang: "de" | "en"): string {
  const s = findSlide(slideId);
  return s ? `${slideId} · ${s.title[lang]}` : slideId;
}
