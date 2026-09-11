import { useState } from "react";
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
} from "lucide-react";
import type { Lang, SlideMeta } from "@/types/slide";
import { useAllEntries, useCapture } from "@/lib/useWorkshop";
import { useDictation } from "@/lib/useDictation";
import {
  exportMarkdown,
  exportJSON,
  downloadFile,
  setEntry,
  removeEntry,
  type CaptureEntry,
} from "@/lib/workshop-store";
import { printProtocolPdf, downloadProtocolWord } from "@/lib/protocol-export";
import { MANIFEST, findModule } from "@/lib/slides";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  current: SlideMeta;
}

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
  return (
    <div
      className="rounded-md p-2"
      style={{
        border: "1px solid var(--workshop-accent)",
        background: "color-mix(in oklch, var(--workshop-accent) 5%, var(--bg))",
      }}
    >
      <div className="flex items-start gap-2 mb-1">
        <span className="text-xs font-medium leading-snug flex-1">{entry.prompt}</span>
        <button
          type="button"
          onClick={onDelete}
          className="size-6 grid place-items-center rounded shrink-0 hover:bg-black/5"
          title={de ? "Frage löschen" : "Delete question"}
          style={{ color: "var(--fg-muted)" }}
        >
          <X size={13} />
        </button>
      </div>
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
          <button
            type="button"
            onClick={toggle}
            className="absolute top-1.5 right-1.5 size-6 grid place-items-center rounded-md"
            style={{
              background: listening ? "var(--workshop-accent)" : "var(--bg-elev)",
              color: listening ? "white" : "var(--fg-muted)",
              border: "1px solid var(--border)",
            }}
            title={listening ? (de ? "Diktat stoppen" : "Stop dictation") : de ? "Einsprechen" : "Dictate"}
          >
            {listening ? <MicOff size={12} /> : <Mic size={12} />}
          </button>
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
 * to its slide, × to delete). Local-only (localStorage); the AI summary is
 * produced downstream by the /konzept-neu skill on export.
 */
export function LiveProtocolPanel({ open, onClose, lang, current }: Props) {
  const de = lang === "de";
  const navigate = useNavigate();
  const entries = useAllEntries();
  const [newQ, setNewQ] = useState("");

  const [note, setNote] = useCapture({
    id: `${current.id}:notiz`,
    module: current.module,
    slideId: current.id,
    kind: "text",
    prompt: de ? `Notiz · ${current.title.de}` : `Note · ${current.title.en}`,
    removeWhenEmpty: true,
  });
  const noteText = typeof note === "string" ? note : "";
  const noteDictation = useDictation((chunk) => setNote((noteText ? noteText + " " : "") + chunk));

  const addQuestion = () => {
    const q = newQ.trim();
    if (!q) return;
    const field = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setEntry({
      id: `${current.id}:${field}`,
      module: current.module,
      slideId: current.id,
      kind: "text",
      prompt: q,
      value: "",
    });
    setNewQ("");
  };

  // Ad-hoc questions for the current slide (shown even with an empty answer).
  const adhoc = entries.filter((e) => e.slideId === current.id && isAdhoc(e.id));

  // Contributions that actually carry content (the live protocol).
  const filled = entries.filter((e) =>
    Array.isArray(e.value) ? e.value.length > 0 : Boolean(e.value && e.value.trim()),
  );
  const byModule = filled.reduce<Record<number, typeof filled>>((acc, e) => {
    (acc[e.module] ??= []).push(e);
    return acc;
  }, {});
  const modulesWithInput = Object.keys(byModule).length;
  const totalModules = MANIFEST.length;
  const pct = totalModules ? Math.round((modulesWithInput / totalModules) * 100) : 0;
  const stamp = new Date().toISOString().slice(0, 10);

  if (!open) return null;

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
          <button
            type="button"
            onClick={onClose}
            className="ml-auto size-8 grid place-items-center rounded-md transition-colors hover:bg-black/5"
            title={de ? "Panel schließen" : "Close panel"}
            aria-label={de ? "Schließen" : "Close"}
          >
            <PanelRightClose size={18} />
          </button>
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
                <button
                  type="button"
                  onClick={noteDictation.toggle}
                  className="absolute top-2 right-2 size-7 grid place-items-center rounded-md transition-colors"
                  style={{
                    background: noteDictation.listening ? "var(--workshop-accent)" : "var(--bg-elev)",
                    color: noteDictation.listening ? "white" : "var(--fg-muted)",
                    border: "1px solid var(--border)",
                  }}
                  title={
                    noteDictation.listening
                      ? de ? "Diktat stoppen" : "Stop dictation"
                      : de ? "Einsprechen" : "Dictate"
                  }
                  aria-label={noteDictation.listening ? "Stop dictation" : "Dictate"}
                >
                  {noteDictation.listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
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
            <div className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addQuestion();
                  }
                }}
                placeholder={de ? "Neue Frage zu dieser Folie…" : "New question for this slide…"}
                className="flex-1 text-xs rounded-md p-2"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
              />
              <button
                type="button"
                onClick={addQuestion}
                className="inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-medium shrink-0"
                style={{ background: "var(--workshop-accent)", color: "white" }}
                title={de ? "Frage hinzufügen" : "Add question"}
              >
                <Plus size={14} />
              </button>
            </div>
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
                            const val = Array.isArray(e.value) ? e.value.join(", ") : e.value;
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
                                <button
                                  type="button"
                                  onClick={() => navigate(`/s/${e.slideId}`)}
                                  className="flex-1 text-left p-2 min-w-0 hover:bg-black/[0.03]"
                                  title={de ? "Zur Folie springen" : "Jump to slide"}
                                >
                                  <div className="font-medium mb-0.5 leading-snug">{e.prompt}</div>
                                  <div className="whitespace-pre-wrap" style={{ color: "var(--fg)" }}>
                                    {val}
                                  </div>
                                  <div
                                    className="mt-0.5 font-mono opacity-60"
                                    style={{ fontSize: "10px" }}
                                  >
                                    {e.slideId} · {e.kind} →
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeEntry(e.id)}
                                  className="px-1.5 grid place-items-center shrink-0 hover:bg-black/5"
                                  title={de ? "Beitrag löschen" : "Delete contribution"}
                                  style={{ color: "var(--fg-muted)" }}
                                >
                                  <X size={13} />
                                </button>
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
            <button
              type="button"
              onClick={() => printProtocolPdf(lang)}
              className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
              style={{ background: "var(--workshop-accent)", color: "white" }}
            >
              <Printer size={14} /> PDF
            </button>
            <button
              type="button"
              onClick={() => downloadProtocolWord(lang)}
              className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
              style={{ background: "var(--workshop-accent-deep)", color: "white" }}
            >
              <FileType size={14} /> Word
            </button>
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
          </div>
          <Link
            to="/protokoll"
            className="inline-flex items-center gap-1.5 text-xs hover:underline"
            style={{ color: "var(--fg-muted)" }}
          >
            <ExternalLink size={13} />{" "}
            {de ? "Vollansicht · Audio · Teilnehmende" : "Full view · audio · participants"}
          </Link>
        </div>
      </aside>
    </>
  );
}
