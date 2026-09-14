import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Check, Loader2, Square, Trash2, Wand2 } from "lucide-react";
import type { Lang } from "@/types/slide";
import { describeAiError, useApiKey } from "@/lib/ai-assist";
import {
  AssignCancelled,
  applyDraft,
  buildAssignDraft,
  clearDraft,
  existingDiscussionEntries,
  loadDraft,
  pointsBySlide,
  rangeLabel,
  saveDraft,
  slideLabel,
  usableSessions,
  type AssignDraft,
  type AssignProgress,
  type DiscussionPoint,
} from "@/lib/discussion-assign";
import { formatOffset, transcriptProgress, useSessionTranscripts, type SessionTranscript } from "@/lib/session-transcript-store";
import { MANIFEST } from "@/lib/slides";
import { AiKeySetup } from "@/components/ProtocolAi";
import { BTN, BTN_SM, ERROR_COLOR, Notice, card, field, muted, outline, primary } from "@/components/interviews/ui";

/** Id of the section, so the live record can jump here. */
export const DISCUSSION_ASSIGN_ANCHOR = "mitschnitt-zuordnen";

function sessionLabel(s: SessionTranscript, n: number, lang: Lang): string {
  const d = new Date(s.startedAt);
  const when = Number.isNaN(d.getTime())
    ? s.startedAt
    : d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const end = s.segments.reduce((m, x) => Math.max(m, x.endSec), 0);
  return `${lang === "de" ? "Aufnahme" : "Recording"} ${n} · ${when} · ${formatOffset(end)}`;
}

/**
 * After the workshop, before the protocol: summarize the recorded discussion
 * and assign it to the matching slides. Claude proposes, the room reviews and
 * edits, and only then the summaries land in the record as `…:mitschnitt`.
 */
export function DiscussionAssign({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const apiKey = useApiKey();
  const { ready, sessions } = useSessionTranscripts();
  const [draft, setDraftState] = useState<AssignDraft | null>(null);
  const [progress, setProgress] = useState<AssignProgress | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [askMode, setAskMode] = useState(false);
  // Every run gets a number; cancelling moves the counter on, so a late answer of an old run is ignored.
  const runId = useRef(0);
  const restored = useRef(false);

  // Restore a draft of this tab once the sessions are known (a draft of deleted sessions is dropped).
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const kept = loadDraft(sessions.map((s) => s.sessionId));
    if (kept) setDraftState(kept);
  }, [ready, sessions]);

  const setDraft = (next: AssignDraft | null) => {
    setDraftState(next);
    saveDraft(next);
  };

  const usable = usableSessions(sessions);
  const totals = sessions.reduce(
    (acc, s) => {
      const p = transcriptProgress(s);
      return { total: acc.total + p.total, done: acc.done + p.done, failed: acc.failed + p.failed, open: acc.open + p.open };
    },
    { total: 0, done: 0, failed: 0, open: 0 },
  );
  const gapsNow = totals.total - totals.done;

  const slideOptions = useMemo(
    () => MANIFEST.filter((m) => m.index !== 99).map((m) => ({ module: m, slides: m.slides })),
    [],
  );

  if (!ready || (sessions.length === 0 && !draft)) return null;

  const run = async () => {
    if (progress) return;
    setError("");
    setDone("");
    const mine = ++runId.current;
    const stale = () => runId.current !== mine;
    setProgress({ window: 0, windows: 0 });
    try {
      const next = await buildAssignDraft(sessions, (p) => !stale() && setProgress(p), stale);
      setDraft(next);
    } catch (err) {
      if (err instanceof AssignCancelled || stale()) return;
      setError(
        err instanceof Error && err.message === "unreadable"
          ? de
            ? "Die Antwort der KI war nicht lesbar. Bitte erneut versuchen."
            : "The AI answer could not be read. Please try again."
          : describeAiError(err, lang),
      );
    } finally {
      if (!stale()) setProgress(null);
    }
  };

  const updatePoint = (id: string, patch: Partial<DiscussionPoint>) => {
    if (!draft) return;
    setDraft({ ...draft, points: draft.points.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  const setGroupInclude = (slideId: string | null, include: boolean) => {
    if (!draft) return;
    setDraft({ ...draft, points: draft.points.map((p) => (p.slideId === slideId ? { ...p, include } : p)) });
  };

  const apply = (mode: "replace" | "append") => {
    if (!draft) return;
    const slides = applyDraft(draft, mode);
    setAskMode(false);
    setDraft(null);
    clearDraft();
    setDone(
      de
        ? `Ins Protokoll übernommen: Zusammenfassungen auf ${slides} ${slides === 1 ? "Folie" : "Folien"}, gekennzeichnet als „Mitschnitt".`
        : `Added to the record: summaries on ${slides} ${slides === 1 ? "slide" : "slides"}, marked as “Recording”.`,
    );
  };

  const requestApply = () => {
    if (existingDiscussionEntries().length) setAskMode(true);
    else apply("replace");
  };

  const discard = () => {
    setDraft(null);
    setAskMode(false);
  };

  // Review groups: assigned slides in deck order, then the unassigned bucket.
  const groups: { slideId: string | null; points: DiscussionPoint[] }[] = [];
  if (draft) {
    const order = new Map(MANIFEST.flatMap((m) => m.slides).map((s, i) => [s.id, i]));
    const bySlide = new Map<string | null, DiscussionPoint[]>();
    for (const p of draft.points) bySlide.set(p.slideId, [...(bySlide.get(p.slideId) ?? []), p]);
    const assigned = [...bySlide.keys()].filter((k): k is string => k !== null).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    for (const id of assigned) groups.push({ slideId: id, points: bySlide.get(id) ?? [] });
    if (bySlide.has(null)) groups.push({ slideId: null, points: bySlide.get(null) ?? [] });
  }
  const writable = draft ? pointsBySlide(draft) : new Map();
  const writableCount = [...writable.values()].reduce((n, list) => n + list.length, 0);
  const existingCount = askMode ? existingDiscussionEntries().length : 0;

  return (
    <section
      id={DISCUSSION_ASSIGN_ANCHOR}
      aria-labelledby="discussion-assign-heading"
      className="mb-8 rounded-lg p-4 sm:p-5 space-y-4 scroll-mt-20"
      style={card}
      data-testid="discussion-assign"
    >
      <div className="flex items-start gap-3">
        <AudioLines size={22} className="shrink-0 mt-0.5" style={{ color: "var(--workshop-accent)" }} />
        <div className="flex-1 min-w-0">
          <h2 id="discussion-assign-heading" className="text-lg font-semibold">
            {de ? "Mitschnitt den Folien zuordnen" : "Assign the recording to slides"}
          </h2>
          <p className="text-sm mt-1" style={muted}>
            {de
              ? "Vor dem Protokoll: Claude fasst das Transkript der mitgeschnittenen Diskussion zusammen und ordnet die Punkte den inhaltlich passenden Folien zu. Wir prüfen den Vorschlag, dann landet er im Protokoll, gekennzeichnet als „Mitschnitt“. Dafür wird der Transkripttext an die Claude-API übertragen."
              : "Before the record: Claude summarizes the transcript of the recorded discussion and assigns the points to the slides they belong to. We review the proposal, then it goes into the record, marked as “Recording”. The transcript text is sent to the Claude API for this."}
          </p>
        </div>
      </div>

      {/* Sessions and transcription state */}
      <ul className="text-sm space-y-1" data-testid="discussion-sessions">
        {sessions.map((s, i) => {
          const p = transcriptProgress(s);
          return (
            <li key={s.sessionId} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{sessionLabel(s, i + 1, lang)}</span>
              <span style={muted}>
                {de ? `${p.done} von ${p.total} Abschnitten transkribiert` : `${p.done} of ${p.total} segments transcribed`}
                {p.failed > 0 && (de ? ` · ${p.failed} fehlgeschlagen` : ` · ${p.failed} failed`)}
                {!s.closed && (de ? " · Aufnahme läuft noch" : " · still recording")}
              </span>
            </li>
          );
        })}
      </ul>

      {gapsNow > 0 && !draft && (
        <Notice tone="warn">
          {de
            ? `${gapsNow} ${gapsNow === 1 ? "Abschnitt ist" : "Abschnitte sind"} noch nicht transkribiert${totals.failed ? ` (${totals.failed} fehlgeschlagen)` : ""}. Wer jetzt zusammenfasst, bekommt diese Zeiträume nicht mit; die Lücken werden im Vorschlag genannt.`
            : `${gapsNow} ${gapsNow === 1 ? "segment is" : "segments are"} not transcribed yet${totals.failed ? ` (${totals.failed} failed)` : ""}. Summarizing now leaves these periods out; the gaps are listed in the proposal.`}
        </Notice>
      )}

      {!apiKey && <AiKeySetup lang={lang} />}

      {!draft && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={!apiKey || usable.length === 0 || progress !== null}
            className={BTN}
            style={primary}
            data-testid="discussion-assign-run"
          >
            {progress ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {gapsNow > 0
              ? de
                ? "Trotzdem zusammenfassen und Folien zuordnen"
                : "Summarize and assign anyway"
              : de
                ? "Mitschnitt zusammenfassen und Folien zuordnen"
                : "Summarize the recording and assign slides"}
          </button>
          {progress && (
            <>
              <span className="text-sm" style={muted} role="status">
                {progress.windows > 0
                  ? de
                    ? `Teil ${progress.window} von ${progress.windows} …`
                    : `Part ${progress.window} of ${progress.windows} …`
                  : de
                    ? "Wird vorbereitet …"
                    : "Preparing …"}
              </span>
              <button
                type="button"
                onClick={() => {
                  runId.current++;
                  setProgress(null);
                }}
                className={BTN_SM}
                style={outline}
              >
                <Square size={12} /> {de ? "Abbrechen" : "Cancel"}
              </button>
            </>
          )}
          {usable.length === 0 && (
            <span className="text-sm" style={muted}>
              {de ? "Noch kein Abschnitt transkribiert." : "No segment transcribed yet."}
            </span>
          )}
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="ok">{done}</Notice>}

      {/* Review */}
      {draft && (
        <div className="space-y-4" data-testid="discussion-review">
          <p className="text-sm leading-snug" style={muted}>
            {de
              ? "Bitte vor dem Übernehmen gegenlesen: Stimmt die Zuordnung, trifft die Zusammenfassung das Gesagte, und steht nichts Privates oder Persönliches darin, das nicht ins Protokoll gehört? Punkte lassen sich bearbeiten, abwählen oder einer anderen Folie zuordnen."
              : "Please read it before applying: is the assignment right, does the summary match what was said, and is there nothing private or personal in it that does not belong in the record? Points can be edited, deselected or moved to another slide."}
          </p>
          {draft.gaps.length > 0 && (
            <Notice tone="warn">
              {de ? "Nicht berücksichtigt, weil nicht transkribiert: " : "Not considered because not transcribed: "}
              {draft.gaps
                .slice(0, 8)
                .map((g) => rangeLabel(g, draft.sessionIds))
                .join(", ")}
              {draft.gaps.length > 8 && (de ? ` und ${draft.gaps.length - 8} weitere` : ` and ${draft.gaps.length - 8} more`)}
            </Notice>
          )}
          {draft.points.length === 0 && (
            <p className="text-sm" style={muted}>
              {de ? "Die KI hat keine inhaltlichen Punkte gefunden." : "The AI found no points of substance."}
            </p>
          )}

          {groups.map((g) => {
            const allOn = g.points.every((p) => p.include);
            return (
              <div key={g.slideId ?? "none"} className="rounded-md p-3 space-y-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }} data-review-slide={g.slideId ?? "none"}>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => setGroupInclude(g.slideId, e.target.checked)}
                    className="size-4 accent-[var(--workshop-accent)]"
                  />
                  {g.slideId ? slideLabel(g.slideId, lang) : de ? "Nicht zugeordnet" : "Not assigned"}
                  <span className="font-normal text-xs" style={muted}>
                    · {g.points.length} {de ? (g.points.length === 1 ? "Punkt" : "Punkte") : g.points.length === 1 ? "point" : "points"}
                  </span>
                </label>
                {!g.slideId && (
                  <p className="text-xs" style={muted}>
                    {de ? "Diese Punkte kommen nur ins Protokoll, wenn sie einer Folie zugeordnet werden." : "These points only go into the record once they are assigned to a slide."}
                  </p>
                )}
                {g.points.map((p) => (
                  <div key={p.id} className="flex items-start gap-2" style={{ opacity: p.include ? 1 : 0.55 }} data-review-point={p.id}>
                    <input
                      type="checkbox"
                      checked={p.include}
                      onChange={(e) => updatePoint(p.id, { include: e.target.checked })}
                      className="size-4 mt-1.5 shrink-0 accent-[var(--workshop-accent)]"
                      aria-label={de ? "Punkt übernehmen" : "Include point"}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono" style={muted}>
                          {rangeLabel(p, draft.sessionIds)}
                        </span>
                        <select
                          value={p.slideId ?? ""}
                          onChange={(e) => updatePoint(p.id, { slideId: e.target.value || null })}
                          className="text-xs rounded px-1 py-0.5 max-w-full"
                          style={field}
                          aria-label={de ? "Folie zuordnen" : "Assign slide"}
                        >
                          <option value="">{de ? "— nicht zugeordnet" : "— not assigned"}</option>
                          {slideOptions.map(({ module, slides }) => (
                            <optgroup key={module.index} label={`${de ? "Modul" : "Module"} ${module.index} · ${module.title[lang]}`}>
                              {slides.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.id} · {s.title[lang]}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={p.text}
                        onChange={(e) => updatePoint(p.id, { text: e.target.value })}
                        rows={Math.min(6, Math.max(2, Math.ceil(p.text.length / 90)))}
                        className="w-full text-sm rounded-md p-2 resize-y"
                        style={field}
                        aria-label={de ? "Punkt bearbeiten" : "Edit point"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {askMode ? (
            <div className="rounded-md p-3 space-y-2 text-sm" style={{ background: "var(--bg)", border: "1px dashed var(--workshop-accent)" }} role="alertdialog" data-testid="discussion-replace-ask">
              <p>
                {de
                  ? `Im Protokoll stehen schon Mitschnitt-Zusammenfassungen auf ${existingCount} ${existingCount === 1 ? "Folie" : "Folien"}. Ersetzen (der neue Vorschlag deckt das ganze Transkript ab) oder unten ergänzen?`
                  : `The record already holds recording summaries on ${existingCount} ${existingCount === 1 ? "slide" : "slides"}. Replace them (the new proposal covers the whole transcript) or append below?`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => apply("replace")} className={BTN} style={primary} data-testid="discussion-replace">
                  {de ? "Ersetzen" : "Replace"}
                </button>
                <button type="button" onClick={() => apply("append")} className={BTN} style={outline} data-testid="discussion-append">
                  {de ? "Ergänzen" : "Append"}
                </button>
                <button type="button" onClick={() => setAskMode(false)} className={BTN} style={outline}>
                  {de ? "Abbrechen" : "Cancel"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={requestApply}
                disabled={writableCount === 0}
                className={BTN}
                style={primary}
                data-testid="discussion-apply"
              >
                <Check size={16} /> {de ? "Ins Protokoll übernehmen" : "Add to the record"}
              </button>
              <button type="button" onClick={discard} className={BTN} style={{ ...outline, color: ERROR_COLOR }}>
                <Trash2 size={15} /> {de ? "Vorschlag verwerfen" : "Discard proposal"}
              </button>
              <span className="text-xs" style={muted}>
                {de
                  ? `${writableCount} ${writableCount === 1 ? "Punkt" : "Punkte"} für ${writable.size} ${writable.size === 1 ? "Folie" : "Folien"}`
                  : `${writableCount} ${writableCount === 1 ? "point" : "points"} for ${writable.size} ${writable.size === 1 ? "slide" : "slides"}`}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
