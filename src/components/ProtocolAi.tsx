import { useState } from "react";
import { KeyRound, Loader2, Mic, MicOff, RotateCcw, Sparkles, Undo2, Wand2 } from "lucide-react";
import type { Lang } from "@/types/slide";
import { getEntry, setEntry, type CaptureEntry } from "@/lib/workshop-store";
import { useDictation } from "@/lib/useDictation";
import { findSlide } from "@/lib/slides";
import {
  PRESETS,
  describeAiError,
  isPlausibleKey,
  refineText,
  setApiKey,
  useApiKey,
  type RefineRequest,
} from "@/lib/ai-assist";

const ERROR_COLOR = "#dc2626";

function contextFor(entry: CaptureEntry): RefineRequest["context"] {
  return { slideId: entry.slideId, slideTitle: findSlide(entry.slideId)?.title.de, prompt: entry.prompt };
}

/** Writes a new text value while keeping the entry's identity fields. */
function saveText(entry: CaptureEntry, value: string, raw: string | undefined) {
  setEntry({
    id: entry.id,
    module: entry.module,
    slideId: entry.slideId,
    kind: entry.kind,
    prompt: entry.prompt,
    value,
    raw,
  });
}

/** Only free-text contributions can be reworded (votes/checklists are structured). */
export const isEditableText = (e: CaptureEntry) => e.kind === "text" && typeof e.value === "string";

const QUESTION_INSTRUCTION =
  "Formuliere den gesprochenen Beitrag als klare, prägnante Frage bzw. Aufgabe für das Workshop-Protokoll: ein Satz, bei einer Frage mit Fragezeichen. Inhalt nicht verändern, Füllwörter entfernen.";

/** Turns a dictated ad-hoc question/task into one clean sentence. Throws AiAssistError. */
export function polishQuestion(text: string, slideId: string): Promise<string> {
  return refineText({
    text,
    instruction: QUESTION_INSTRUCTION,
    context: { slideId, slideTitle: findSlide(slideId)?.title.de, prompt: "Eigene Frage / Aufgabe" },
  });
}

export function MicButton({ mic, lang }: { mic: ReturnType<typeof useDictation>; lang: Lang }) {
  if (!mic.supported) return null;
  const de = lang === "de";
  return (
    <button
      type="button"
      onClick={mic.toggle}
      className="size-7 grid place-items-center rounded-md shrink-0 transition-colors"
      style={{
        background: mic.listening ? "var(--workshop-accent)" : "var(--bg-elev)",
        color: mic.listening ? "white" : "var(--fg-muted)",
        border: "1px solid var(--border)",
      }}
      title={mic.listening ? (de ? "Diktat stoppen" : "Stop dictation") : de ? "Einsprechen" : "Dictate"}
      aria-label={mic.listening ? (de ? "Diktat stoppen" : "Stop dictation") : de ? "Einsprechen" : "Dictate"}
    >
      {mic.listening ? <MicOff size={13} /> : <Mic size={13} />}
    </button>
  );
}

/** One-time, per-device setup of the Claude API key (opt-in for AI rewording). */
export function AiKeySetup({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const key = value.trim();
    if (!isPlausibleKey(key)) {
      setError(
        de
          ? "Das sieht nicht nach einem Claude-API-Schlüssel aus (beginnt mit „sk-ant-“)."
          : "That doesn't look like a Claude API key (starts with “sk-ant-”).",
      );
      return;
    }
    try {
      setApiKey(key);
      setValue("");
      setError("");
    } catch {
      setError(de ? "Der Schlüssel konnte in diesem Browser nicht gespeichert werden." : "The key could not be stored in this browser.");
    }
  };

  return (
    <div
      className="rounded-md p-2.5 space-y-2 text-xs"
      style={{ background: "var(--bg-elev)", border: "1px dashed var(--border)" }}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <KeyRound size={14} style={{ color: "var(--workshop-accent)" }} />
        {de ? "KI-Assistent einrichten" : "Set up AI assistant"}
      </div>
      <p className="leading-snug" style={{ color: "var(--fg-muted)" }}>
        {de
          ? "Für die KI-Überarbeitung wird ein Claude-API-Schlüssel benötigt. Er wird nur in diesem Browser gespeichert. Beim Überarbeiten wird der jeweilige Beitragstext an die Claude-API (Anthropic) übertragen, deshalb bitte nur auf dem eigenen Gerät einrichten."
          : "AI rewording needs a Claude API key. It is stored in this browser only. When rewording, the contribution text is sent to the Claude API (Anthropic), so please set this up on your own device only."}
      </p>
      <div className="flex gap-1.5">
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="sk-ant-…"
          className="flex-1 min-w-0 rounded-md p-1.5"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
        />
        <button
          type="button"
          onClick={submit}
          className="px-2.5 rounded-md font-medium shrink-0"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          {de ? "Speichern" : "Save"}
        </button>
      </div>
      {error && <p style={{ color: ERROR_COLOR }}>{error}</p>}
    </div>
  );
}

/**
 * Inline editor for one captured contribution: edit by hand, dictate more, or
 * let the AI reword it (presets or a free instruction, typed or spoken).
 * The first dictated version is kept as `raw` so it can always be restored.
 */
export function EntryEditor({
  entry,
  lang,
  onClose,
}: {
  entry: CaptureEntry;
  lang: Lang;
  onClose: () => void;
}) {
  const de = lang === "de";
  const apiKey = useApiKey();
  const initial = typeof entry.value === "string" ? entry.value : entry.value.join(", ");
  const [draft, setDraft] = useState(initial);
  const [history, setHistory] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const draftMic = useDictation((chunk) => setDraft((d) => (d ? d + " " : "") + chunk));
  const instructionMic = useDictation((chunk) => setInstruction((i) => (i ? i + " " : "") + chunk));

  const replaceDraft = (next: string) => {
    setHistory((h) => [...h, draft]);
    setDraft(next);
  };

  const run = async (id: string, text: string) => {
    if (busy || !draft.trim() || !text.trim()) return;
    setBusy(id);
    setError("");
    try {
      replaceDraft(await refineText({ text: draft, instruction: text, context: contextFor(entry) }));
      setAiUsed(true);
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setBusy(null);
    }
  };

  const undo = () => {
    setDraft(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const save = () => {
    // Keep the very first dictated version so it can always be restored.
    const raw = entry.raw ?? (aiUsed && draft !== initial ? initial : undefined);
    saveText(entry, draft, raw);
    onClose();
  };

  return (
    <div
      className="rounded-md p-2.5 space-y-2 text-xs"
      style={{
        border: "1px solid var(--workshop-accent)",
        background: "color-mix(in oklch, var(--workshop-accent) 5%, var(--bg))",
      }}
    >
      <div className="font-medium leading-snug">{entry.prompt}</div>

      <div className="flex items-start gap-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          readOnly={busy !== null}
          rows={6}
          autoFocus
          className="flex-1 min-w-0 rounded-md p-2 text-sm leading-relaxed resize-y"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
            opacity: busy ? 0.6 : 1,
          }}
        />
        <MicButton mic={draftMic} lang={lang} />
      </div>

      {apiKey ? (
        <>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => run(p.id, p.instruction)}
                disabled={busy !== null || !draft.trim()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors disabled:opacity-50"
                style={
                  p.id === "polish"
                    ? { background: "var(--workshop-accent)", color: "white" }
                    : { border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)" }
                }
              >
                {busy === p.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : p.id === "polish" ? (
                  <Sparkles size={12} />
                ) : null}
                {p.label[lang]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  run("custom", instruction);
                }
              }}
              placeholder={de ? "Eigene Anweisung, z. B. „als Beschluss formulieren“" : "Own instruction, e.g. “phrase as a resolution”"}
              className="flex-1 min-w-0 rounded-md p-1.5"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
            <MicButton mic={instructionMic} lang={lang} />
            <button
              type="button"
              onClick={() => run("custom", instruction)}
              disabled={busy !== null || !instruction.trim() || !draft.trim()}
              className="size-7 grid place-items-center rounded-md shrink-0 disabled:opacity-50"
              style={{ background: "var(--workshop-accent-deep)", color: "white" }}
              title={de ? "Anweisung anwenden" : "Apply instruction"}
              aria-label={de ? "Anweisung anwenden" : "Apply instruction"}
            >
              {busy === "custom" ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            </button>
          </div>
        </>
      ) : (
        <AiKeySetup lang={lang} />
      )}

      {error && <p style={{ color: ERROR_COLOR }}>{error}</p>}

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {history.length > 0 && (
          <button
            type="button"
            onClick={undo}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md"
            style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
          >
            <Undo2 size={12} /> {de ? "Rückgängig" : "Undo"}
          </button>
        )}
        {entry.raw && draft !== entry.raw && (
          <button
            type="button"
            onClick={() => replaceDraft(entry.raw ?? "")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md"
            style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
            title={de ? "Ursprünglich diktierten Text wiederherstellen" : "Restore the originally dictated text"}
          >
            <RotateCcw size={12} /> {de ? "Original" : "Original"}
          </button>
        )}
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-md"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            {de ? "Abbrechen" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy !== null}
            className="px-2.5 py-1 rounded-md font-medium disabled:opacity-50"
            style={{ background: "var(--workshop-accent)", color: "white" }}
            title={de ? "Übernehmen (Strg+Enter)" : "Apply (Ctrl+Enter)"}
          >
            {de ? "Übernehmen" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Polishes every free-text contribution that has not been reworded yet. */
export function BulkPolishButton({ entries, lang }: { entries: CaptureEntry[]; lang: Lang }) {
  const de = lang === "de";
  const apiKey = useApiKey();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const polish = PRESETS[0];
  const pending = entries.filter((e) => isEditableText(e) && (e.value as string).trim() && !e.raw);

  const run = async () => {
    const queue = pending;
    setError("");
    setProgress({ done: 0, total: queue.length });
    try {
      for (let i = 0; i < queue.length; i++) {
        const e = queue[i];
        const original = e.value as string;
        const out = await refineText({ text: original, instruction: polish.instruction, context: contextFor(e) });
        // Skip entries that changed meanwhile (e.g. typed on the slide): never overwrite fresh input.
        const current = getEntry(e.id);
        if (current && current.value === original) saveText(current, out, original);
        setProgress({ done: i + 1, total: queue.length });
      }
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setProgress(null);
    }
  };

  if (!apiKey) {
    return setupOpen ? (
      <AiKeySetup lang={lang} />
    ) : (
      <button
        type="button"
        onClick={() => setSetupOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs"
        style={{ border: "1px dashed var(--workshop-accent)", color: "var(--workshop-accent)" }}
      >
        <Sparkles size={14} /> {de ? "KI-Überarbeitung einrichten" : "Set up AI rewording"}
      </button>
    );
  }

  const label = progress
    ? de
      ? `Glätte ${Math.min(progress.done + 1, progress.total)} von ${progress.total} …`
      : `Polishing ${Math.min(progress.done + 1, progress.total)} of ${progress.total} …`
    : pending.length === 0
      ? de
        ? "Alle Freitexte sind geglättet"
        : "All free texts are polished"
      : de
        ? `${pending.length} ${pending.length === 1 ? "Freitext" : "Freitexte"} mit KI glätten`
        : `Polish ${pending.length} free ${pending.length === 1 ? "text" : "texts"} with AI`;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={run}
        disabled={progress !== null || pending.length === 0}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
        style={{ background: "var(--workshop-accent)", color: "white" }}
      >
        {progress ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {label}
      </button>
      {error && (
        <p className="text-[11px]" style={{ color: ERROR_COLOR }}>
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 text-[10px]" style={{ color: "var(--fg-muted)" }}>
        <span>{de ? "KI-Assistent aktiv · Einzelbeiträge über ✎ bearbeiten" : "AI assistant active · edit single items via ✎"}</span>
        <button type="button" className="underline hover:no-underline shrink-0" onClick={() => setApiKey("")}>
          {de ? "Schlüssel entfernen" : "Remove key"}
        </button>
      </div>
    </div>
  );
}
