import { Mic, MicOff, Check, PenLine } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useCapture } from "@/lib/useWorkshop";
import { useDictation } from "@/lib/useDictation";
import { getEntry, setEntry, type CaptureKind } from "@/lib/workshop-store";
import { PolishBar } from "@/components/ProtocolAi";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  /** Slide id this field belongs to, e.g. "01.05" */
  slideId: string;
  /** Short field key, unique within the slide, e.g. "engpaesse" */
  field: string;
  /** Question / label — also the heading in the exported protocol */
  prompt: string;
  kind?: CaptureKind;
  /** Options for decision / vote / checklist */
  options?: string[];
  placeholder?: string;
  rows?: number;
}

/**
 * Live capture block used inside MDX exercise slides. Persists board input to
 * the workshop store (localStorage). Free-text supports voice dictation.
 * Everything captured here flows into the Workshop-Protokoll and downstream
 * concept regeneration.
 */
export function WorkshopInput({
  slideId,
  field,
  prompt,
  kind = "text",
  options = [],
  placeholder,
  rows = 3,
}: Props) {
  const [lang] = useLang();
  const module = Number.parseInt(slideId, 10);
  const id = `${slideId}:${field}`;
  const [value, setValue] = useCapture({ id, module, slideId, kind, prompt, removeWhenEmpty: true });

  const text = typeof value === "string" ? value : "";
  const selected = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];

  const { supported, listening, toggle } = useDictation((chunk) => {
    setValue((text ? text + " " : "") + chunk);
  });

  const saved = Array.isArray(value) ? value.length > 0 : Boolean(value);

  // Keep the first dictated version restorable in the protocol, like the ✎ editor does.
  const applyAiResult = (next: string, replaced: string) =>
    setEntry({ id, module, slideId, kind, prompt, value: next, raw: getEntry(id)?.raw ?? replaced });

  return (
    <div className="ws-input-block my-4 rounded-md p-4">
      <div className="flex items-start gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          <PenLine size={11} aria-hidden />
          {lang === "de" ? "Eingabe" : "Input"}
        </span>
        <label className="text-sm font-medium leading-snug flex-1">{prompt}</label>
        {saved && (
          <Tooltip
            content={
              lang === "de"
                ? "Automatisch gespeichert (lokal in diesem Browser). Der Beitrag steht sofort im Live-Protokoll."
                : "Saved automatically (locally in this browser). The contribution appears in the live record right away."
            }
          >
            <span
              className="inline-flex items-center gap-1 text-[11px] shrink-0 mt-0.5 cursor-help"
              style={{ color: "var(--workshop-accent)" }}
            >
              <Check size={13} strokeWidth={2.5} />
              {lang === "de" ? "erfasst" : "saved"}
            </span>
          </Tooltip>
        )}
      </div>

      {kind === "text" && (
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setValue(e.target.value)}
            rows={rows}
            placeholder={placeholder ?? (lang === "de" ? "Hier eintippen oder einsprechen…" : "Type or dictate here…")}
            className="w-full text-sm rounded-md p-2.5 pr-11 resize-y"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
            }}
          />
          {supported && (
            <Tooltip
              content={
                listening
                  ? lang === "de"
                    ? "Diktat stoppen. Der gesprochene Text steht bereits im Feld."
                    : "Stop dictation. The spoken text is already in the field."
                  : lang === "de"
                    ? "Einsprechen statt tippen: Der Text wird fortlaufend angehängt. Diktierfehler lassen sich danach mit „Glätten“ bereinigen."
                    : "Dictate instead of typing: the text is appended continuously. Dictation errors can be cleaned up afterwards with “Polish”."
              }
            >
              <button
                type="button"
                onClick={toggle}
                className="absolute top-2 right-2 size-8 grid place-items-center rounded-md transition-colors no-print"
                style={{
                  background: listening ? "var(--workshop-accent)" : "var(--bg-elev)",
                  color: listening ? "white" : "var(--fg-muted)",
                  border: "1px solid var(--border)",
                }}
                aria-label={listening ? "Stop dictation" : "Dictate"}
              >
                {listening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            </Tooltip>
          )}
          <PolishBar text={text} slideId={slideId} prompt={prompt} lang={lang} onResult={applyAiResult} />
        </div>
      )}

      {(kind === "decision" || kind === "vote") && (
        <div className={kind === "vote" ? "flex flex-wrap gap-2" : "space-y-1.5"}>
          {options.map((opt) => {
            const active = text === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setValue(active ? "" : opt)}
                className="text-sm px-3 py-1.5 rounded-md text-left transition-colors"
                style={{
                  background: active
                    ? "var(--workshop-accent)"
                    : "var(--bg)",
                  color: active ? "white" : "var(--fg)",
                  border: "1px solid " + (active ? "var(--workshop-accent)" : "var(--border)"),
                  display: kind === "vote" ? "inline-block" : "block",
                  width: kind === "vote" ? "auto" : "100%",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {kind === "checklist" && (
        <div className="space-y-1.5">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  setValue(
                    active ? selected.filter((o) => o !== opt) : [...selected, opt],
                  )
                }
                className="flex items-center gap-2 text-sm w-full text-left px-2.5 py-1.5 rounded-md transition-colors"
                style={{ background: active ? "color-mix(in oklch, var(--workshop-accent) 12%, transparent)" : "transparent" }}
              >
                <span
                  className="size-4 rounded grid place-items-center shrink-0"
                  style={{
                    background: active ? "var(--workshop-accent)" : "var(--bg)",
                    border: "1px solid " + (active ? "var(--workshop-accent)" : "var(--border)"),
                  }}
                >
                  {active && <Check size={12} strokeWidth={3} color="white" />}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
