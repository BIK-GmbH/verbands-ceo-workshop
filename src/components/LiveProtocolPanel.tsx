import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PanelRightClose,
  FileDown,
  FileJson,
  ListChecks,
  Mic,
  MicOff,
  ExternalLink,
  Printer,
  FileType,
  Plus,
  X,
  Pencil,
  Sparkles,
  Loader2,
  Check,
  Search,
  FileText,
} from "lucide-react";
import type { Lang, SlideMeta } from "@/types/slide";
import { useAllEntries, useCapture } from "@/lib/useWorkshop";
import { useDictation } from "@/lib/useDictation";
import {
  exportMarkdown,
  exportJSON,
  downloadFile,
  setEntry,
  getEntry,
  removeEntry,
  type CaptureEntry,
} from "@/lib/workshop-store";
import { describeAiError, useApiKey } from "@/lib/ai-assist";
import { printProtocolPdf, downloadProtocolWord } from "@/lib/protocol-export";
import { MANIFEST, findModule } from "@/lib/slides";
import { BulkPolishButton, EntryEditor, MicButton, isEditableText, polishQuestion } from "@/components/ProtocolAi";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  current: SlideMeta;
}

/** Tooltips for the export buttons (shared with the full record page). */
export const EXPORT_HINTS = {
  pdf: {
    de: "Protokoll druckfertig aufbereiten und über den Druckdialog drucken oder als PDF speichern",
    en: "Prepare the record for printing; print it or save it as PDF from the print dialog",
  },
  word: {
    de: "Protokoll als Word-Datei (.doc) herunterladen, zum Weiterbearbeiten und Versenden",
    en: "Download the record as a Word file (.doc) for further editing and sending",
  },
  markdown: {
    de: "Reiner Text mit Überschriften, z. B. für ein Wiki oder zur Weiterverarbeitung mit KI",
    en: "Plain text with headings, e.g. for a wiki or further processing with AI",
  },
  json: {
    de: "Alle Beiträge als strukturierte Daten, z. B. als Sicherung oder zur technischen Weiterverarbeitung",
    en: "All contributions as structured data, e.g. as a backup or for technical processing",
  },
} as const;

/** Ad-hoc questions get the field prefix "q-" so they can be told apart. */
const isAdhoc = (id: string) => (id.split(":")[1] ?? "").startsWith("q-");

/**
 * A free-text answer field for one ad-hoc question added live during the
 * workshop. Typed or dictated. The question itself (prompt) persists even with
 * an empty answer — removal is explicit via the × button.
 */
function AdhocField({
  entry,
  lang,
  onDelete,
}: {
  entry: CaptureEntry;
  lang: Lang;
  onDelete: () => void;
}) {
  const de = lang === "de";
  const [value, setValue] = useCapture({
    id: entry.id,
    module: entry.module,
    slideId: entry.slideId,
    kind: "text",
    prompt: entry.prompt,
  });
  const text = typeof value === "string" ? value : "";
  const { supported, listening, toggle } = useDictation((chunk) =>
    setValue((text ? text + " " : "") + chunk),
  );
  const apiKey = useApiKey();
  const [editing, setEditing] = useState(false);
  const [draftQ, setDraftQ] = useState(entry.prompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const questionMic = useDictation((chunk) => setDraftQ((q) => (q ? q + " " : "") + chunk));

  const saveQuestion = () => {
    const q = draftQ.trim();
    if (!q) return;
    setEntry({ id: entry.id, module: entry.module, slideId: entry.slideId, kind: "text", prompt: q, value: text });
    setEditing(false);
  };

  const polish = async () => {
    if (!draftQ.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      setDraftQ(await polishQuestion(draftQ, entry.slideId));
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-md p-2"
      style={{
        border: "1px solid var(--workshop-accent)",
        background: "color-mix(in oklch, var(--workshop-accent) 5%, var(--bg))",
      }}
    >
      {editing ? (
        <div className="space-y-1.5 mb-1.5">
          <div className="flex items-start gap-1.5">
            <textarea
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveQuestion();
                } else if (e.key === "Escape") {
                  setEditing(false);
                }
              }}
              readOnly={busy}
              rows={2}
              autoFocus
              className="flex-1 min-w-0 text-xs rounded-md p-1.5 resize-y"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
            <MicButton mic={questionMic} lang={lang} />
          </div>
          {error && <p className="text-[11px]" style={{ color: "#dc2626" }}>{error}</p>}
          <div className="flex items-center gap-1.5">
            {apiKey && (
              <Tooltip
                content={
                  de
                    ? "KI bringt die Frage in einen klaren Satz, Inhalt unverändert, Füllwörter raus"
                    : "AI turns the question into one clear sentence, content unchanged, filler words removed"
                }
              >
                <button
                  type="button"
                  onClick={polish}
                  disabled={busy || !draftQ.trim()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium disabled:opacity-50"
                  style={{ background: "var(--workshop-accent)", color: "white" }}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {de ? "Glätten" : "Polish"}
                </button>
              </Tooltip>
            )}
            <button
              type="button"
              onClick={() => {
                setDraftQ(entry.prompt);
                setEditing(false);
              }}
              className="ml-auto px-2 py-1 rounded-md text-[11px]"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            >
              {de ? "Abbrechen" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={saveQuestion}
              disabled={busy || !draftQ.trim()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium disabled:opacity-50"
              style={{ background: "var(--workshop-accent)", color: "white" }}
            >
              <Check size={12} /> {de ? "Übernehmen" : "Apply"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1 mb-1">
          <span className="text-xs font-medium leading-snug flex-1">{entry.prompt}</span>
          <Tooltip content={de ? "Frage umformulieren, tippen oder einsprechen" : "Reword the question, typed or dictated"}>
            <button
              type="button"
              onClick={() => {
                setDraftQ(entry.prompt);
                setEditing(true);
              }}
              className="size-6 grid place-items-center rounded shrink-0 hover:bg-black/5"
              aria-label={de ? "Frage bearbeiten" : "Edit question"}
              style={{ color: "var(--workshop-accent)" }}
            >
              <Pencil size={12} />
            </button>
          </Tooltip>
          <Tooltip content={de ? "Frage samt Antwort aus dem Protokoll löschen" : "Delete the question and its answer from the record"}>
            <button
              type="button"
              onClick={onDelete}
              className="size-6 grid place-items-center rounded shrink-0 hover:bg-black/5"
              aria-label={de ? "Frage löschen" : "Delete question"}
              style={{ color: "var(--fg-muted)" }}
            >
              <X size={13} />
            </button>
          </Tooltip>
        </div>
      )}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          placeholder={de ? "Antwort — tippen oder einsprechen…" : "Answer — type or dictate…"}
          className="w-full text-xs rounded-md p-2 pr-9 resize-y"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
        />
        {supported && (
          <Tooltip
            content={
              listening
                ? de ? "Diktat stoppen" : "Stop dictation"
                : de ? "Antwort einsprechen, der Text wird angehängt" : "Dictate the answer, the text is appended"
            }
          >
            <button
              type="button"
              onClick={toggle}
              className="absolute top-1.5 right-1.5 size-6 grid place-items-center rounded-md"
              style={{
                background: listening ? "var(--workshop-accent)" : "var(--bg-elev)",
                color: listening ? "white" : "var(--fg-muted)",
                border: "1px solid var(--border)",
              }}
              aria-label={listening ? (de ? "Diktat stoppen" : "Stop dictation") : de ? "Einsprechen" : "Dictate"}
            >
              {listening ? <MicOff size={12} /> : <Mic size={12} />}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/**
 * Always-on, right-docked live record. Runs alongside every slide so the board
 * sees the protocol build up in real time — no navigating to a separate page.
 * Holds: progress, a free-text note for the current slide, ad-hoc questions
 * added live, and the live list of every captured contribution (click to jump
 * to its slide, ✎ to edit or let the AI reword it, × to delete). Stored locally;
 * the AI assistant (opt-in, see ai-assist.ts) polishes dictated text in place.
 */
export function LiveProtocolPanel({ open, onClose, lang, current }: Props) {
  const de = lang === "de";
  const navigate = useNavigate();
  const entries = useAllEntries();
  const [newQ, setNewQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [note, setNote] = useCapture({
    id: `${current.id}:notiz`,
    module: current.module,
    slideId: current.id,
    kind: "text",
    prompt: de ? `Notiz · ${current.title.de}` : `Note · ${current.title.en}`,
    removeWhenEmpty: true,
  });
  const noteText = typeof note === "string" ? note : "";
  // Dictation is bound to the slide it was started on, so speech that is still being
  // finalised after a slide change lands on the old slide, not the new one.
  const dictationSlide = useRef<SlideMeta>(current);
  const restartOnNewSlide = useRef(false);
  const noteDictation = useDictation((chunk) => {
    const slide = dictationSlide.current;
    const id = `${slide.id}:notiz`;
    const prev = getEntry(id)?.value;
    const existing = typeof prev === "string" ? prev : "";
    setEntry({
      id,
      module: slide.module,
      slideId: slide.id,
      kind: "text",
      prompt: de ? `Notiz · ${slide.title.de}` : `Note · ${slide.title.en}`,
      value: (existing ? existing + " " : "") + chunk,
    });
  });
  const { listening: noteListening, start: startNoteDictation, stop: stopNoteDictation } = noteDictation;

  // Slide change while dictating: end the running session, then restart it for the new slide.
  useEffect(() => {
    if (dictationSlide.current.id === current.id) return;
    if (!noteListening) {
      dictationSlide.current = current;
      return;
    }
    restartOnNewSlide.current = true;
    stopNoteDictation();
  }, [current, noteListening, stopNoteDictation]);

  useEffect(() => {
    if (noteListening || !restartOnNewSlide.current) return;
    restartOnNewSlide.current = false;
    dictationSlide.current = current;
    startNoteDictation();
  }, [noteListening, current, startNoteDictation]);

  const apiKey = useApiKey();
  const [polishingQ, setPolishingQ] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const newQMic = useDictation((chunk) => setNewQ((q) => (q ? q + " " : "") + chunk));

  const addQuestion = async () => {
    const q = newQ.trim();
    if (!q) return;
    const field = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const base = { id: `${current.id}:${field}`, module: current.module, slideId: current.id, kind: "text" as const };
    setEntry({ ...base, prompt: q, value: "" });
    setNewQ("");
    setQuestionError("");
    if (!apiKey) return;
    // Save the raw question first so nothing is lost, then swap in the polished wording.
    setPolishingQ(true);
    try {
      const polished = await polishQuestion(q, current.id);
      const latest = getEntry(base.id);
      if (latest && latest.prompt === q) setEntry({ ...base, prompt: polished, value: latest.value });
    } catch (err) {
      setQuestionError(describeAiError(err, lang));
    } finally {
      setPolishingQ(false);
    }
  };

  // Ad-hoc questions for the current slide (shown even with an empty answer).
  const adhoc = entries.filter((e) => e.slideId === current.id && isAdhoc(e.id));

  // Contributions that actually carry content (the live protocol).
  const filled = entries.filter((e) =>
    Array.isArray(e.value) ? e.value.length > 0 : Boolean(e.value && e.value.trim()),
  );
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? filled.filter((e) =>
        `${e.prompt} ${Array.isArray(e.value) ? e.value.join(" ") : e.value}`.toLowerCase().includes(needle),
      )
    : filled;
  const byModule = shown.reduce<Record<number, typeof shown>>((acc, e) => {
    (acc[e.module] ??= []).push(e);
    return acc;
  }, {});
  const modulesWithInput = Object.keys(byModule).length;
  const totalModules = MANIFEST.length;
  const pct = totalModules ? Math.round((modulesWithInput / totalModules) * 100) : 0;
  const stamp = new Date().toISOString().slice(0, 10);

  if (!open) {
    // Closing the drawer keeps the dictation running; show where it writes and offer a stop.
    if (!noteListening) return null;
    return (
      <div
        className="no-print fixed bottom-[calc(var(--footer-height)+12px)] right-4 z-40 flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full shadow-lg text-xs font-medium"
        style={{ background: "var(--workshop-accent)", color: "white" }}
        role="status"
      >
        <span className="size-2 rounded-full bg-white animate-pulse" aria-hidden />
        {de ? `Diktat läuft · Notiz ${current.id}` : `Dictating · note ${current.id}`}
        <button
          type="button"
          onClick={stopNoteDictation}
          className="ml-1 inline-flex items-center gap-1 px-2 h-6 rounded-full"
          style={{ background: "rgba(255,255,255,0.22)" }}
        >
          <MicOff size={12} /> {de ? "Stopp" : "Stop"}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile backdrop — on small screens the panel overlays the slide. */}
      <div
        className="sm:hidden fixed inset-0 z-30 bg-black/40 no-print"
        onClick={onClose}
        aria-hidden
      />
      <aside
        data-live-protocol
        className="no-print flex flex-col shrink-0 border-l max-sm:fixed max-sm:inset-y-0 max-sm:right-0 max-sm:z-40 w-full sm:w-[22rem] shadow-2xl sm:shadow-none"
        style={{ background: "var(--bg-elev)", borderColor: "var(--border)" }}
        aria-label={de ? "Live-Protokoll" : "Live record"}
      >
        {/* Panel header */}
        <div
          className="flex items-center gap-2 px-4 h-12 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <ListChecks size={17} style={{ color: "var(--workshop-accent)" }} />
          <span className="text-sm font-semibold">{de ? "Live-Protokoll" : "Live record"}</span>
          <span
            className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: "color-mix(in oklch, var(--workshop-accent) 14%, transparent)",
              color: "var(--workshop-accent)",
            }}
          >
            {filled.length}
          </span>
          <Tooltip
            content={
              de
                ? "Panel schließen. Alles bleibt gespeichert, ein laufendes Diktat läuft weiter."
                : "Close the panel. Everything stays saved, a running dictation continues."
            }
          >
            <button
              type="button"
              onClick={onClose}
              className="ml-auto size-8 grid place-items-center rounded-md transition-colors hover:bg-black/5"
              aria-label={de ? "Schließen" : "Close"}
            >
              <PanelRightClose size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 text-sm">
          {/* Progress */}
          <div>
            <div
              className="flex items-center justify-between text-xs mb-1"
              style={{ color: "var(--fg-muted)" }}
            >
              <span>{de ? "Fortschritt" : "Progress"}</span>
              <span>
                {modulesWithInput}/{totalModules} {de ? "Module" : "modules"} · {filled.length}{" "}
                {de ? "Beiträge" : "items"}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: "var(--workshop-accent)" }}
              />
            </div>
          </div>

          {/* Current-slide note */}
          <div>
            <div
              className="text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--fg-muted)" }}
            >
              {de ? "Notiz zu dieser Folie" : "Note for this slide"}
            </div>
            <div className="text-xs mb-1 font-medium">
              {current.id} · {current.title[lang]}
            </div>
            <div className="relative">
              <textarea
                value={noteText}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={de ? "Was hier gesagt/geändert wird…" : "What is said / changed here…"}
                className="w-full text-sm rounded-md p-2.5 pr-10 resize-y"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
              />
              {noteDictation.supported && (
                <Tooltip
                  content={
                    noteDictation.listening
                      ? de ? "Diktat stoppen" : "Stop dictation"
                      : de
                        ? "Notiz einsprechen. Beim Folienwechsel schreibt das Diktat automatisch bei der neuen Folie weiter, auch bei geschlossenem Panel."
                        : "Dictate a note. On a slide change the dictation continues on the new slide automatically, even with the panel closed."
                  }
                >
                  <button
                    type="button"
                    onClick={noteDictation.toggle}
                    className="absolute top-2 right-2 size-7 grid place-items-center rounded-md transition-colors"
                    style={{
                      background: noteDictation.listening ? "var(--workshop-accent)" : "var(--bg-elev)",
                      color: noteDictation.listening ? "white" : "var(--fg-muted)",
                      border: "1px solid var(--border)",
                    }}
                    aria-label={noteDictation.listening ? "Stop dictation" : "Dictate"}
                  >
                    {noteDictation.listening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                </Tooltip>
              )}
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--fg-muted)" }}>
              {de
                ? "Tipp: Text komplett löschen entfernt die Notiz aus dem Protokoll."
                : "Tip: clearing the text removes the note from the record."}
            </p>
          </div>

          {/* Ad-hoc questions / tasks added live */}
          <div>
            <div
              className="text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--fg-muted)" }}
            >
              {de ? "Eigene Frage / Aufgabe" : "Custom question / task"}
            </div>
            <div className="flex items-start gap-1.5 mb-2">
              <textarea
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds the question; Shift+Enter keeps a line break for longer tasks.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addQuestion();
                  }
                }}
                rows={2}
                placeholder={de ? "Neue Frage zu dieser Folie… (Enter = hinzufügen)" : "New question for this slide… (Enter = add)"}
                className="flex-1 min-w-0 text-xs rounded-md p-2 resize-y"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)", minHeight: "2.5rem" }}
              />
              <MicButton mic={newQMic} lang={lang} />
              <Tooltip
                content={
                  de
                    ? "Frage oder Aufgabe zu dieser Folie hinzufügen (Enter). Darunter entsteht ein Antwortfeld; mit KI-Assistent wird die Frage automatisch sauber formuliert."
                    : "Add a question or task for this slide (Enter). An answer field appears below; with the AI assistant the question is phrased cleanly automatically."
                }
              >
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-medium shrink-0"
                  style={{ background: "var(--workshop-accent)", color: "white" }}
                  aria-label={de ? "Frage hinzufügen" : "Add question"}
                >
                  <Plus size={14} />
                </button>
              </Tooltip>
            </div>
            {(polishingQ || questionError) && (
              <p className="text-[11px] mb-2 flex items-center gap-1" style={{ color: questionError ? "#dc2626" : "var(--fg-muted)" }}>
                {polishingQ && <Loader2 size={12} className="animate-spin" />}
                {questionError || (de ? "Frage wird sauber formuliert …" : "Polishing the question …")}
              </p>
            )}
            {adhoc.length > 0 && (
              <div className="space-y-2">
                {adhoc.map((e) => (
                  <AdhocField key={e.id} entry={e} lang={lang} onDelete={() => removeEntry(e.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Live contributions — click to jump to the slide, × to delete */}
          <div>
            <div
              className="text-xs uppercase tracking-wider mb-2"
              style={{ color: "var(--fg-muted)" }}
            >
              {de ? "Erfasste Beiträge" : "Captured input"}
            </div>
            {filled.length > 0 && (
              <div className="mb-3">
                <BulkPolishButton entries={filled} lang={lang} />
              </div>
            )}
            {filled.length > 0 && (
              <div className="mb-3">
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--fg-muted)" }}
                    aria-hidden
                  />
                  <Tooltip
                    openOnFocus={false}
                    content={
                      de
                        ? "Filtert die erfassten Beiträge nach Stichwort, durchsucht Fragen und Antworten"
                        : "Filters the captured input by keyword, searches questions and answers"
                    }
                  >
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={de ? "Im Protokoll suchen…" : "Search the record…"}
                      className="w-full text-xs rounded-md py-1.5 pl-7 pr-2"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
                      aria-label={de ? "Im Protokoll suchen" : "Search the record"}
                    />
                  </Tooltip>
                </div>
                {needle && (
                  <p className="text-[10px] mt-1" style={{ color: "var(--fg-muted)" }}>
                    {de
                      ? `${shown.length} von ${filled.length} Beiträgen`
                      : `${shown.length} of ${filled.length} items`}
                  </p>
                )}
              </div>
            )}
            {filled.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                {de
                  ? "Noch nichts erfasst. Eingaben und Notizen erscheinen hier sofort."
                  : "Nothing yet. Input and notes appear here instantly."}
              </p>
            ) : (
              <div className="space-y-4">
                {Object.keys(byModule)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((mod) => {
                    const m = findModule(mod);
                    return (
                      <div key={mod}>
                        <div className="text-xs font-semibold mb-1.5">
                          {mod === 99 ? (de ? "Anhang" : "Appendix") : `${de ? "Modul" : "Module"} ${mod}`}
                          {m && (
                            <span className="font-normal" style={{ color: "var(--fg-muted)" }}>
                              {" "}
                              · {m.title[lang]}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {byModule[mod].map((e) => {
                            const isCurrent = e.slideId === current.id;
                            if (editingId === e.id) {
                              return (
                                <EntryEditor
                                  key={e.id}
                                  entry={e}
                                  lang={lang}
                                  onClose={() => setEditingId(null)}
                                />
                              );
                            }
                            const val = Array.isArray(e.value) ? e.value.join("\n") : e.value;
                            return (
                              <div
                                key={e.id}
                                className="rounded-md text-xs flex items-stretch overflow-hidden"
                                style={{
                                  background: isCurrent
                                    ? "color-mix(in oklch, var(--workshop-accent) 8%, var(--bg))"
                                    : "var(--bg)",
                                  border:
                                    "1px solid " +
                                    (isCurrent ? "var(--workshop-accent)" : "var(--border)"),
                                }}
                              >
                                <Tooltip content={de ? `Zur Folie ${e.slideId} springen` : `Jump to slide ${e.slideId}`}>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/s/${e.slideId}`)}
                                  className="flex-1 text-left p-2 min-w-0 hover:bg-black/[0.03]"
                                >
                                  <div className="font-medium mb-0.5 leading-snug">{e.prompt}</div>
                                  <div className="whitespace-pre-wrap" style={{ color: "var(--fg)" }}>
                                    {val}
                                  </div>
                                  <div
                                    className="mt-0.5 font-mono opacity-60"
                                    style={{ fontSize: "10px" }}
                                  >
                                    {e.slideId} · {e.kind}
                                    {e.raw ? (de ? " · KI-überarbeitet" : " · AI-reworded") : ""} →
                                  </div>
                                </button>
                                </Tooltip>
                                {isEditableText(e) && (
                                  <Tooltip
                                    content={
                                      de
                                        ? "Bearbeiten: von Hand, per Diktat oder mit KI umformulieren (Glätten, Knapper, Stichpunkte …)"
                                        : "Edit: by hand, by dictation or reword with AI (polish, shorter, bullet points …)"
                                    }
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setEditingId(e.id)}
                                      className="px-1.5 grid place-items-center shrink-0 hover:bg-black/5"
                                      aria-label={de ? "Bearbeiten" : "Edit"}
                                      style={{ color: "var(--workshop-accent)" }}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                  </Tooltip>
                                )}
                                <Tooltip
                                  content={
                                    de
                                      ? "Beitrag löschen. Er verschwindet aus dem Protokoll und aus dem Eingabefeld der Folie."
                                      : "Delete the contribution. It disappears from the record and from the slide's input field."
                                  }
                                >
                                  <button
                                    type="button"
                                    onClick={() => removeEntry(e.id)}
                                    className="px-1.5 grid place-items-center shrink-0 hover:bg-black/5"
                                    aria-label={de ? "Beitrag löschen" : "Delete contribution"}
                                    style={{ color: "var(--fg-muted)" }}
                                  >
                                    <X size={13} />
                                  </button>
                                </Tooltip>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Footer — export here so the full page is never required mid-session. */}
        <div
          className="border-t px-4 py-3 space-y-2 shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Tooltip content={EXPORT_HINTS.pdf[lang]}>
              <button
                type="button"
                onClick={() => printProtocolPdf(lang)}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
                style={{ background: "var(--workshop-accent)", color: "white" }}
              >
                <Printer size={14} /> PDF
              </button>
            </Tooltip>
            <Tooltip content={EXPORT_HINTS.word[lang]}>
              <button
                type="button"
                onClick={() => downloadProtocolWord(lang)}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
                style={{ background: "var(--workshop-accent-deep)", color: "white" }}
              >
                <FileType size={14} /> Word
              </button>
            </Tooltip>
            <Tooltip content={EXPORT_HINTS.markdown[lang]}>
              <button
                type="button"
                onClick={() =>
                  downloadFile(`workshop-protokoll-${stamp}.md`, exportMarkdown(), "text/markdown")
                }
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                <FileDown size={14} /> Markdown
              </button>
            </Tooltip>
            <Tooltip content={EXPORT_HINTS.json[lang]}>
              <button
                type="button"
                onClick={() =>
                  downloadFile(`workshop-protokoll-${stamp}.json`, exportJSON(), "application/json")
                }
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                <FileJson size={14} /> JSON
              </button>
            </Tooltip>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Tooltip
              content={
                de
                  ? "Vollansicht des Protokolls: Datum, Teilnehmende, Audio-Mitschnitt, Ergebnisbericht und alle Beiträge"
                  : "Full record view: date, participants, audio recording, results report and all contributions"
              }
            >
              <Link
                to="/protokoll"
                className="inline-flex items-center gap-1.5 text-xs hover:underline"
                style={{ color: "var(--fg-muted)" }}
              >
                <FileText size={13} />{" "}
                {de ? "Vollansicht · Audio · Teilnehmende" : "Full view · audio · participants"}
              </Link>
            </Tooltip>
            <Tooltip
              content={
                de
                  ? "Gesamtprotokoll in eigenem Fenster öffnen, z. B. auf dem zweiten Bildschirm. Es aktualisiert sich live mit."
                  : "Open the full record in its own window, e.g. on a second screen. It updates live."
              }
            >
              <button
                type="button"
                onClick={() =>
                  // Same origin and storage: the second window updates live via storage events.
                  window.open(`${window.location.pathname}#/protokoll`, "fbs-protokoll", "width=960,height=1000")
                }
                className="inline-flex items-center gap-1.5 text-xs hover:underline"
                style={{ color: "var(--workshop-accent)" }}
              >
                <ExternalLink size={13} /> {de ? "In eigenem Fenster" : "Own window"}
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>
    </>
  );
}
