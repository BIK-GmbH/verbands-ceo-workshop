import { useState } from "react";
import { Check, Layers, Mic, MicOff, Minus, Plus, X, PenLine } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useCapture } from "@/lib/useWorkshop";
import { useDictation } from "@/lib/useDictation";
import { getEntry, removeEntry, setEntry, type CaptureEntry } from "@/lib/workshop-store";
import { PolishBar } from "@/components/ProtocolAi";

interface Props {
  /** Slide id the staircases belong to, e.g. "01.05" */
  slideId: string;
  /** Entry id holding the problem areas to adopt, e.g. "01.04:problemfelder" */
  sourceField?: string;
  /** Why-steps per staircase */
  steps?: number;
  /** Maximum number of staircases */
  max?: number;
  /** Print view: all staircases as a plain numbered list, no controls */
  readOnly?: boolean;
}

/*
 * Entry ids stay backwards compatible: the FIRST staircase keeps the ids the
 * "Need to Move" poster reads ("<slideId>:warum-1…5", "<slideId>:ursache").
 * Only its starting problem and every further staircase use new ids.
 */
const problemId = (slideId: string, n: number) => `${slideId}:problem-${n}`;
const whyId = (slideId: string, n: number, step: number) =>
  n === 1 ? `${slideId}:warum-${step}` : `${slideId}:treppe-${n}-warum-${step}`;
const causeId = (slideId: string, n: number) => (n === 1 ? `${slideId}:ursache` : `${slideId}:treppe-${n}-ursache`);

const problemPrompt = (n: number) => (n === 1 ? "Problemfeld / Ausgangsproblem" : `Treppe ${n} · Problemfeld`);
const whyPrompt = (n: number, step: number) =>
  n === 1 ? `Warum? – Stufe ${step}` : `Treppe ${n} · Warum? Stufe ${step}`;
const causePrompt = (n: number) => (n === 1 ? "Die eigentliche Ursache" : `Treppe ${n} · Die eigentliche Ursache`);

const ladderIds = (slideId: string, n: number, steps: number) => [
  problemId(slideId, n),
  ...Array.from({ length: steps }, (_, i) => whyId(slideId, n, i + 1)),
  causeId(slideId, n),
];

const textOf = (entry: CaptureEntry | undefined): string =>
  entry && typeof entry.value === "string" ? entry.value : "";

interface LadderData {
  problem: string;
  whys: string[];
  cause: string;
}

/** Drops list markers, numbering and "Themenfeld 2:" style prefixes from an adopted line. */
const stripMarker = (line: string) =>
  line
    .replace(/^\s*[-*•–—]\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^\s*(?:themenfeld|problemfeld|feld)\s*\d*\s*[:.]\s*/i, "")
    .replace(/\s*:\s*$/, "")
    .trim();

/**
 * Problem areas → one line per staircase. Headline lines (no bullet marker) win
 * when the source is a clustered list, otherwise every line counts.
 */
function parseProblemFields(value: CaptureEntry["value"] | undefined): string[] {
  const raw = Array.isArray(value) ? value : (value ?? "").split(/\n+/);
  const lines = raw.map((l) => l.trim()).filter(Boolean);
  const heads = lines.filter((l) => !/^\s*[-*•–—]/.test(l));
  return (heads.length ? heads : lines).map(stripMarker).filter(Boolean);
}

interface FieldProps {
  slideId: string;
  entryId: string;
  prompt: string;
  /** Visible label; the prompt is what ends up in the protocol */
  label: string;
  rows: number;
  compact: boolean;
  tone?: "accent";
  placeholder?: string;
}

/** One capture field of a staircase: dictation, AI polishing and autosave like <WorkshopInput>. */
function LadderField({ slideId, entryId, prompt, label, rows, compact, tone, placeholder }: FieldProps) {
  const [lang] = useLang();
  const module = Number.parseInt(slideId, 10);
  const [value, setValue] = useCapture({
    id: entryId,
    module,
    slideId,
    kind: "text",
    prompt,
    removeWhenEmpty: true,
  });
  const text = typeof value === "string" ? value : "";
  const mic = useDictation((chunk) => setValue((text ? text + " " : "") + chunk));

  // Keep the first typed/dictated version restorable in the protocol.
  const applyAiResult = (next: string, replaced: string) =>
    setEntry({
      id: entryId,
      module,
      slideId,
      kind: "text",
      prompt,
      value: next,
      raw: getEntry(entryId)?.raw ?? replaced,
    });

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="text-[11px] font-medium"
          style={{ color: tone === "accent" ? "var(--workshop-accent)" : "var(--fg-muted)" }}
        >
          {label}
        </span>
        {text.trim() && <Check size={12} strokeWidth={2.5} style={{ color: "var(--workshop-accent)" }} />}
      </div>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          data-entry={entryId}
          aria-label={prompt}
          className="w-full text-sm rounded-md p-2 pr-9 resize-y"
          style={{
            background: "var(--bg)",
            border: tone === "accent" ? "1px solid var(--workshop-accent)" : "1px solid var(--border)",
            color: "var(--fg)",
          }}
        />
        {mic.supported && (
          <button
            type="button"
            onClick={mic.toggle}
            className="absolute top-1.5 right-1.5 size-7 grid place-items-center rounded-md transition-colors no-print"
            style={{
              background: mic.listening ? "var(--workshop-accent)" : "var(--bg-elev)",
              color: mic.listening ? "white" : "var(--fg-muted)",
              border: "1px solid var(--border)",
            }}
            aria-label={mic.listening ? "Stop dictation" : "Dictate"}
            data-mic={entryId}
          >
            {mic.listening ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
        )}
        {/* Always visible, never on focus only: a row appearing/disappearing on focus shifts
            the layout on mousedown and makes the buttons below it miss the click. */}
        {!compact && <PolishBar text={text} slideId={slideId} prompt={prompt} lang={lang} onResult={applyAiResult} />}
      </div>
    </div>
  );
}

/**
 * The five-whys staircase, once per problem area: each staircase captures its own
 * starting problem, the why-steps and the underlying cause. The first staircase
 * writes into the established entry ids, so the "Need to Move" poster keeps working.
 */
export function WhyLadder({ slideId, sourceField, steps = 5, max = 5, readOnly = false }: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const module = Number.parseInt(slideId, 10);
  const entries = useAllEntries();
  const [added, setAdded] = useState(1);
  const [compact, setCompact] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const has = (id: string) => entries.some((e) => e.id === id && textOf(e).trim());
  // Staircases already in the store decide the count; "+ Treppe" can add empty ones on top.
  let stored = 1;
  for (let n = max; n > 1; n--) {
    if (ladderIds(slideId, n, steps).some(has)) {
      stored = n;
      break;
    }
  }
  const count = Math.min(max, Math.max(stored, added));
  const ladders = Array.from({ length: count }, (_, i) => i + 1);

  const source = sourceField ? entries.find((e) => e.id === sourceField) : undefined;
  const problemFields = parseProblemFields(source?.value);

  const put = (id: string, prompt: string, value: string) => {
    if (value.trim()) setEntry({ id, module, slideId, kind: "text", prompt, value });
    else removeEntry(id);
  };

  const readLadder = (n: number): LadderData => ({
    problem: textOf(getEntry(problemId(slideId, n))),
    whys: Array.from({ length: steps }, (_, i) => textOf(getEntry(whyId(slideId, n, i + 1)))),
    cause: textOf(getEntry(causeId(slideId, n))),
  });

  const writeLadder = (n: number, d: LadderData) => {
    put(problemId(slideId, n), problemPrompt(n), d.problem);
    d.whys.forEach((w, i) => put(whyId(slideId, n, i + 1), whyPrompt(n, i + 1), w));
    put(causeId(slideId, n), causePrompt(n), d.cause);
  };

  /** Removing a staircase closes the gap, so the first one always stays the poster's staircase. */
  const removeLadder = (n: number) => {
    const kept = ladders.filter((i) => i !== n).map(readLadder);
    ladders.forEach((i) => ladderIds(slideId, i, steps).forEach(removeEntry));
    kept.forEach((d, i) => writeLadder(i + 1, d));
    setAdded(Math.max(1, count - 1));
    setConfirmRemove(null);
  };

  const adopt = () => {
    const fields = problemFields.slice(0, max);
    fields.forEach((value, i) => {
      const id = problemId(slideId, i + 1);
      if (textOf(getEntry(id)).trim()) return; // never overwrite a staircase already worked on
      setEntry({ id, module, slideId, kind: "text", prompt: problemPrompt(i + 1), value });
    });
    setAdded(Math.max(count, Math.min(max, fields.length)));
  };

  if (readOnly) {
    const filled = ladders.filter((n) => ladderIds(slideId, n, steps).some(has));
    const shown = filled.length ? filled : [1];
    return (
      <div className="my-4 space-y-3">
        {shown.map((n) => {
          const d = readLadder(n);
          return (
            <div key={n}>
              <p className="text-sm font-medium mb-1">
                {de ? "Treppe" : "Staircase"} {n}
                {d.problem ? `: ${d.problem}` : ""}
              </p>
              <ol className="text-xs list-decimal pl-5 space-y-0.5">
                {d.whys.map((w, i) => (
                  <li key={i}>
                    {de ? "Warum?" : "Why?"} {i + 1}: {w || "—"}
                  </li>
                ))}
              </ol>
              <p className="text-xs mt-1">
                <strong>{de ? "Die eigentliche Ursache" : "The real cause"}:</strong> {d.cause || "—"}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  const smallBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50";

  return (
    <div
      className="ws-input-block my-4 rounded-md p-4"
      data-why-ladder={slideId}
    >
      <div className="flex flex-wrap items-start gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          <PenLine size={11} aria-hidden />
          {de ? "Eingabe" : "Input"}
        </span>
        <span className="text-sm font-medium leading-snug flex-1 min-w-[12rem]">
          {de
            ? "Warum-Treppe je Problemfeld: oben das Ausgangsproblem, darunter die Stufen bis zur Ursache."
            : "One why-staircase per problem area: the starting problem on top, the steps down to the cause below."}
        </span>
        <button
          type="button"
          onClick={() => setCompact(!compact)}
          className="text-[11px] px-2 py-1 rounded-md shrink-0 no-print"
          style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
          data-toggle-compact
          aria-pressed={compact}
        >
          {compact ? (de ? "Ausführlich" : "Detailed") : de ? "Kompakt" : "Compact"}
        </button>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: count > 1 ? "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" : "1fr" }}
      >
        {ladders.map((n) => (
          <div
            key={n}
            className="rounded-md p-3"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
            data-ladder={n}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: "var(--workshop-accent)", color: "white" }}
              >
                {de ? "Treppe" : "Staircase"} {n}
              </span>
              <span className="flex-1" />
              {count > 1 && (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(n)}
                  className="size-6 grid place-items-center rounded no-print"
                  style={{ color: "var(--fg-muted)" }}
                  aria-label={de ? `Treppe ${n} entfernen` : `Remove staircase ${n}`}
                  title={de ? "Diese Treppe mit allen Eingaben löschen" : "Delete this staircase and all its input"}
                  data-remove-ladder={n}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {confirmRemove === n && (
              <div
                className="rounded-md p-2 mb-2 text-xs space-y-2 no-print"
                style={{ background: "var(--bg)", border: "1px dashed var(--workshop-accent)" }}
                role="alertdialog"
                data-confirm-remove={n}
              >
                <p>
                  {de
                    ? `Treppe ${n} mit allen Eingaben löschen?`
                    : `Delete staircase ${n} including all its input?`}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => removeLadder(n)}
                    className="px-2.5 py-1 rounded-md font-medium"
                    style={{ background: "var(--workshop-accent)", color: "white" }}
                    data-confirm-remove-yes
                  >
                    {de ? "Löschen" : "Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(null)}
                    className="px-2.5 py-1 rounded-md"
                    style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                  >
                    {de ? "Abbrechen" : "Cancel"}
                  </button>
                </div>
              </div>
            )}

            <LadderField
              slideId={slideId}
              entryId={problemId(slideId, n)}
              prompt={problemPrompt(n)}
              label={de ? "Problemfeld / Ausgangsproblem" : "Problem area / starting problem"}
              placeholder={de ? "Das Problem, das wir hier verfolgen…" : "The problem we follow here…"}
              rows={compact ? 1 : 2}
              compact={compact}
              tone="accent"
            />

            <div className="mt-3 space-y-2">
              {Array.from({ length: steps }, (_, i) => i + 1).map((step) => (
                <div
                  key={step}
                  style={{
                    paddingLeft: `min(${(step - 1) * 10}px, 40px)`,
                    borderLeft: "2px solid color-mix(in oklch, var(--workshop-accent) 35%, transparent)",
                    marginLeft: `min(${(step - 1) * 6}px, 24px)`,
                  }}
                >
                  <LadderField
                    slideId={slideId}
                    entryId={whyId(slideId, n, step)}
                    prompt={whyPrompt(n, step)}
                    label={`${de ? "Warum?" : "Why?"} ${de ? "Stufe" : "step"} ${step}`}
                    rows={compact ? 1 : 2}
                    compact={compact}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3">
              <LadderField
                slideId={slideId}
                entryId={causeId(slideId, n)}
                prompt={causePrompt(n)}
                label={de ? "Die eigentliche Ursache" : "The real cause"}
                placeholder={de ? "Die Struktur dahinter, keine Person…" : "The structure behind it, not a person…"}
                rows={compact ? 1 : 2}
                compact={compact}
                tone="accent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 no-print">
        <button
          type="button"
          onClick={() => setAdded(Math.min(max, count + 1))}
          disabled={count >= max}
          className={smallBtn}
          style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)", background: "var(--bg)" }}
          data-add-ladder
        >
          <Plus size={14} /> {de ? "Treppe hinzufügen" : "Add staircase"}
        </button>
        {count > 1 && (
          <button
            type="button"
            onClick={() => setAdded(Math.max(1, count - 1))}
            disabled={stored >= count}
            className={smallBtn}
            style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
            title={de ? "Leere Treppe wieder ausblenden" : "Hide the empty staircase again"}
          >
            <Minus size={14} /> {de ? "Leere Treppe ausblenden" : "Hide empty staircase"}
          </button>
        )}
        {sourceField && (
          /* title instead of <Tooltip>: a bubble clamped over its own trigger swallows the click. */
          <button
            type="button"
            onClick={adopt}
            disabled={problemFields.length === 0}
            className={smallBtn}
            style={{ background: "var(--workshop-accent-deep)", color: "white" }}
            title={
              de
                ? "Legt je Problemfeld eine Treppe an und trägt es oben ein. Bereits befüllte Treppen bleiben unverändert."
                : "Creates one staircase per problem area and fills it in on top. Staircases already worked on stay untouched."
            }
            data-adopt
          >
            <Layers size={14} /> {de ? "Problemfelder übernehmen" : "Adopt problem areas"}
          </button>
        )}
        {sourceField && problemFields.length === 0 && (
          <span className="text-[11px]" style={{ color: "var(--fg-muted)" }} data-no-source>
            {de
              ? `Noch keine Problemfelder erfasst (${sourceField}).`
              : `No problem areas captured yet (${sourceField}).`}
          </span>
        )}
      </div>
    </div>
  );
}
