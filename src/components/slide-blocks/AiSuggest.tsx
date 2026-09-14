import { useState } from "react";
import { Check, Loader2, Mic, MicOff, Sparkles, X, PenLine } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useCapture } from "@/lib/useWorkshop";
import { useDictation } from "@/lib/useDictation";
import { getEntry, setEntry, type CaptureEntry } from "@/lib/workshop-store";
import { completeText, describeAiError, useApiKey } from "@/lib/ai-assist";
import { AiKeySetup, PolishBar } from "@/components/ProtocolAi";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  /** Slide id this field belongs to, e.g. "01.04" */
  slideId: string;
  /** Field key of the target entry, unique within the slide, e.g. "problemfelder" */
  field: string;
  /** German heading of the target entry — also the heading in the protocol */
  prompt: string;
  /** Comma-separated entry ids the suggestion is built from, e.g. "01.03:karten-herausforderungen,01.02:meinungsbild" */
  sources: string;
  /** German instruction to the AI, e.g. "Bilde aus den gesammelten Karten 3–5 Problemfelder …" */
  task: string;
  rows?: number;
  buttonLabel?: string;
  buttonLabelEn?: string;
  /** Print view: only the current content of the target field, no controls */
  readOnly?: boolean;
}

const ERROR_COLOR = "#dc2626";

const SUGGEST_SYSTEM = `Du bist Moderationsassistenz im Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Das gelieferte Material wurde live im Workshop erfasst, oft per Spracherkennung diktiert; Erkennungsfehler sind möglich. Typische Begriffe: Kernbohrung, Wandsäge, Seilsäge, Betonbohren und -sägen, Bauwerksmechaniker, BG Bau, IG BAU, DIN 18459, VOB, Geschäftsstelle, Vorstand, Mitgliederversammlung, Ausschuss, Wilma.

Dein Ergebnis ist ein Vorschlag als Grundlage für die gemeinsame Diskussion, keine Entscheidung. Die Gruppe überarbeitet ihn anschließend.
- Verwende ausschließlich das gelieferte Material. Erfinde keine Inhalte, Fakten, Zahlen, Namen, Termine oder Beschlüsse.
- Korrigiere offensichtliche Erkennungsfehler aus dem Kontext. Ist eine Stelle unverständlich, gib sie sinngemäß wieder, statt zu raten.
- Knapp und in Stichpunkten: eine Aussage pro Zeile. Eine Gruppenüberschrift darf als eigene Zeile ohne Spiegelstrich stehen.
- Deutsch, neue Rechtschreibung, sachlich, kein Markdown außer Spiegelstrichen.
- Antworte ausschließlich mit dem Vorschlag: keine Einleitung, keine Erklärung, keine Anführungszeichen drumherum.`;

/** Source entry → readable block for the prompt; empty entries are skipped by the caller. */
function sourceBlock(entry: CaptureEntry): string {
  const body = Array.isArray(entry.value) ? entry.value.map((l) => `- ${l}`).join("\n") : entry.value.trim();
  return `<quelle folie="${entry.slideId}" titel="${entry.prompt}">\n${body}\n</quelle>`;
}

const hasContent = (e: CaptureEntry | undefined): e is CaptureEntry =>
  Boolean(e && (Array.isArray(e.value) ? e.value.length > 0 : e.value.trim().length > 0));

/**
 * AI first draft for one capture field: collects what the group already captured
 * on earlier slides, asks Claude for a proposal and shows it as a *suggestion* —
 * nothing is written until the group accepts it. The target field sits right
 * below so the proposal can be reworked together on the spot.
 */
export function AiSuggest({
  slideId,
  field,
  prompt,
  sources,
  task,
  rows = 5,
  buttonLabel,
  buttonLabelEn,
  readOnly = false,
}: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const module = Number.parseInt(slideId, 10);
  const id = `${slideId}:${field}`;
  const [value, setValue] = useCapture({ id, module, slideId, kind: "text", prompt, removeWhenEmpty: true });
  const text = typeof value === "string" ? value : "";

  const entries = useAllEntries();
  const apiKey = useApiKey();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);

  const sourceIds = sources
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const available = sourceIds.map((sid) => entries.find((e) => e.id === sid)).filter(hasContent);
  const hasBasis = available.length > 0;

  const mic = useDictation((chunk) => setValue((text ? text + " " : "") + chunk));

  // Keep the first typed/dictated version restorable in the protocol, like the ✎ editor does.
  const applyAiResult = (next: string, replaced: string) =>
    setEntry({ id, module, slideId, kind: "text", prompt, value: next, raw: getEntry(id)?.raw ?? replaced });

  const generate = async () => {
    if (busy || !hasBasis) return;
    if (!apiKey) {
      setShowKeySetup(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const out = await completeText({
        system: SUGGEST_SYSTEM,
        prompt: [
          `Ziel-Eintrag: ${prompt}`,
          `Auftrag: ${task}`,
          "",
          "Material aus dem bisherigen Workshop:",
          available.map(sourceBlock).join("\n\n"),
        ].join("\n"),
        logLabel: `ai-suggest ${id}`,
      });
      setSuggestion(out);
      setConfirmApply(false);
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setBusy(false);
    }
  };

  const accept = (mode: "replace" | "append") => {
    if (!suggestion) return;
    const current = typeof getEntry(id)?.value === "string" ? (getEntry(id)!.value as string) : "";
    setValue(mode === "append" && current.trim() ? `${current.trim()}\n${suggestion}` : suggestion);
    setSuggestion(null);
    setConfirmApply(false);
  };

  const requestAccept = () => {
    if (text.trim()) setConfirmApply(true);
    else accept("replace");
  };

  if (readOnly) {
    return (
      <div className="my-4">
        <p className="text-sm font-medium mb-1">{prompt}</p>
        {text.trim() ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
        ) : (
          <p className="text-xs italic">{de ? "(noch keine Eingabe)" : "(no input yet)"}</p>
        )}
      </div>
    );
  }

  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50";

  return (
    <div
      className="ws-input-block my-4 rounded-md p-4"
      data-ai-suggest={id}
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          <PenLine size={11} aria-hidden />
          {de ? "Eingabe" : "Input"}
        </span>
        <label className="text-sm font-medium leading-snug flex-1">{prompt}</label>
        {text.trim() && (
          <Tooltip
            content={
              de
                ? "Automatisch gespeichert (lokal in diesem Browser). Der Beitrag steht sofort im Live-Protokoll."
                : "Saved automatically (locally in this browser). The contribution appears in the live record right away."
            }
          >
            <span
              className="inline-flex items-center gap-1 text-[11px] shrink-0 mt-0.5 cursor-help"
              style={{ color: "var(--workshop-accent)" }}
            >
              <Check size={13} strokeWidth={2.5} />
              {de ? "erfasst" : "saved"}
            </span>
          </Tooltip>
        )}
      </div>

      <div className="no-print space-y-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* title instead of <Tooltip>: a bubble over its own trigger swallows the click (see CardCollector). */}
          <button
            type="button"
            onClick={generate}
            disabled={busy || !hasBasis}
            className={btn}
            style={{ background: "var(--workshop-accent-deep)", color: "white" }}
            title={
              de
                ? "Die KI liest die bereits erfassten Beiträge und macht daraus einen Vorschlag. Er wird erst übernommen, wenn ihr zustimmt."
                : "The AI reads the contributions captured so far and turns them into a proposal. Nothing is applied until you accept it."
            }
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {suggestion
              ? de
                ? "Neu erzeugen"
                : "Regenerate"
              : de
                ? (buttonLabel ?? "KI-Vorschlag erzeugen")
                : (buttonLabelEn ?? "Generate AI suggestion")}
          </button>
          {hasBasis ? (
            <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
              {de ? "Grundlage: " : "Based on: "}
              {available.map((e) => `${e.slideId} · ${e.prompt}`).join(" · ")}
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: "var(--fg-muted)" }} data-no-basis>
              {de
                ? `Noch keine Grundlage erfasst (erwartet: ${sourceIds.join(", ") || "—"}).`
                : `No basis captured yet (expected: ${sourceIds.join(", ") || "—"}).`}
            </span>
          )}
          {error && (
            <span className="text-[11px] w-full" style={{ color: ERROR_COLOR }}>
              {error}
            </span>
          )}
        </div>

        {showKeySetup && !apiKey && <AiKeySetup lang={lang} />}

        {suggestion && (
          <div
            className="rounded-md p-2.5 space-y-2"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--workshop-accent)" }}
            data-suggestion
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: "var(--workshop-accent)" }} />
              <span className="text-xs font-semibold flex-1">{de ? "Vorschlag der KI" : "AI suggestion"}</span>
              <button
                type="button"
                onClick={() => {
                  setSuggestion(null);
                  setConfirmApply(false);
                }}
                className="size-6 grid place-items-center rounded"
                style={{ color: "var(--fg-muted)" }}
                aria-label={de ? "Vorschlag verwerfen" : "Discard suggestion"}
              >
                <X size={13} />
              </button>
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{suggestion}</div>
            {confirmApply ? (
              <div
                className="rounded-md p-2 text-xs space-y-2"
                style={{ background: "var(--bg)", border: "1px dashed var(--workshop-accent)" }}
                role="alertdialog"
              >
                <p>
                  {de
                    ? "Das Feld enthält schon Text. Überschreiben oder den Vorschlag anhängen?"
                    : "The field already contains text. Overwrite or append the suggestion?"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => accept("replace")}
                    className="px-2.5 py-1 rounded-md font-medium"
                    style={{ background: "var(--workshop-accent)", color: "white" }}
                  >
                    {de ? "Überschreiben" : "Overwrite"}
                  </button>
                  <button
                    type="button"
                    onClick={() => accept("append")}
                    className="px-2.5 py-1 rounded-md"
                    style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)" }}
                  >
                    {de ? "Anhängen" : "Append"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmApply(false)}
                    className="px-2.5 py-1 rounded-md"
                    style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                  >
                    {de ? "Abbrechen" : "Cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={requestAccept}
                  className="px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{ background: "var(--workshop-accent)", color: "white" }}
                >
                  {de ? "Übernehmen" : "Apply"}
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestion(null)}
                  className="px-2.5 py-1 rounded-md text-xs"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                >
                  {de ? "Verwerfen" : "Discard"}
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy}
                  className="px-2.5 py-1 rounded-md text-xs disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                >
                  {de ? "Neu erzeugen" : "Regenerate"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          placeholder={de ? "Hier eintippen oder einsprechen…" : "Type or dictate here…"}
          className="w-full text-sm rounded-md p-2.5 pr-11 resize-y"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
          aria-label={prompt}
        />
        {mic.supported && (
          <Tooltip
            content={
              mic.listening
                ? de
                  ? "Diktat stoppen. Der gesprochene Text steht bereits im Feld."
                  : "Stop dictation. The spoken text is already in the field."
                : de
                  ? "Einsprechen statt tippen: Der Text wird fortlaufend angehängt."
                  : "Dictate instead of typing: the text is appended continuously."
            }
          >
            <button
              type="button"
              onClick={mic.toggle}
              className="absolute top-2 right-2 size-8 grid place-items-center rounded-md transition-colors no-print"
              style={{
                background: mic.listening ? "var(--workshop-accent)" : "var(--bg-elev)",
                color: mic.listening ? "white" : "var(--fg-muted)",
                border: "1px solid var(--border)",
              }}
              aria-label={mic.listening ? "Stop dictation" : "Dictate"}
            >
              {mic.listening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </Tooltip>
        )}
        <PolishBar text={text} slideId={slideId} prompt={prompt} lang={lang} onResult={applyAiResult} />
      </div>

      <p className="text-[11px] mt-2 no-print" style={{ color: "var(--fg-muted)" }}>
        {de
          ? "Der Vorschlag ist Diskussionsgrundlage. Das letzte Wort hat die Gruppe: hier direkt ändern, ergänzen oder streichen."
          : "The suggestion is a basis for discussion. The group has the final say: edit, extend or delete it right here."}
      </p>
    </div>
  );
}
