import { useState } from "react";
import { Plus, X, Sparkles, Loader2, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useCapture, useWorkshopMeta } from "@/lib/useWorkshop";
import { removeEntry, setEntry, type CaptureEntry, type Participant } from "@/lib/workshop-store";
import { completeText, describeAiError, useApiKey } from "@/lib/ai-assist";
import { AiKeySetup } from "@/components/ProtocolAi";

interface Props {
  /** Slide id this barometer belongs to, e.g. "00.08" */
  slideId: string;
  /** Field key of the result entry, e.g. "barometer-vorher"; single votes go to "<field>-stimmen" */
  field: string;
  /** Question — also the heading of the result in the protocol */
  prompt: string;
  options: string[];
  /** Earlier barometer to take names from and compare against (e.g. "00.08" + "barometer-vorher") */
  compareSlideId?: string;
  compareField?: string;
  /** Print view: result and votes as plain text, no controls */
  readOnly?: boolean;
}

interface Vote {
  option: string;
  /** Participant name, or "" for an anonymous vote */
  name: string;
}

/** Votes are stored as protocol lines "Option — Name" (or just "Option" when anonymous). */
const SEP = " — ";

function parseVotes(value: CaptureEntry["value"] | undefined): Vote[] {
  return (Array.isArray(value) ? value : []).map((line) => {
    const i = line.indexOf(SEP);
    return i === -1 ? { option: line, name: "" } : { option: line.slice(0, i), name: line.slice(i + SEP.length) };
  });
}

const displayName = (p: Participant) => `${p.firstName} ${p.lastName}`.trim() || p.organisation.trim();

function meanPosition(votes: Vote[], options: string[]): number | null {
  const idx = votes.map((v) => options.indexOf(v.option)).filter((i) => i >= 0);
  return idx.length ? idx.reduce((a, b) => a + b, 0) / idx.length : null;
}

const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const ANALYSIS_SYSTEM = `Du bist Moderationsassistenz im Workshop „KI-Geschäftsführer: Fiktion oder Realität?" des Fachverbands Betonbohren und -sägen Deutschland e. V. Zu Beginn (Tag 1) und am Ende (Tag 2) haben die Teilnehmenden ihre Haltung zur Leitfrage auf einer Skala von „Fiktion" bis „Realität" angegeben.

Analysiere die Veränderung nüchtern und wertschätzend:
- Keine Richtung als Erfolg oder Misserfolg werten; auch keine Veränderung ist ein Ergebnis.
- Keine Namen nennen, nichts erfinden, nur die gelieferten Daten und Begründungen verwenden.
- Gliederung in kurzen Absätzen mit diesen Überschriften als eigene Zeile: „Gesamtbild", „Bewegungen", „Gründe", „Kommentar für die Moderation".
- „Kommentar für die Moderation": 2–3 Sätze mit einer möglichen Anschlussfrage an die Gruppe.
- Höchstens 220 Wörter, Deutsch, kein Markdown außer Zeilenumbrüchen.`;

/**
 * One assessment per person for the before/after barometer (00.08, 07.02). Names come
 * from the participant list (or, on the "after" slide, from the earlier votes) and are
 * optional. The protocol gets the distribution as the result, the single votes, and –
 * on the "after" slide – an optional AI analysis of the change.
 */
export function BarometerVotes({ slideId, field, prompt, options, compareSlideId, compareField, readOnly = false }: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const module = Number.parseInt(slideId, 10);
  const resultId = `${slideId}:${field}`;
  const analysisId = `${slideId}:${field}-analyse`;
  const [storedVotes, setStoredVotes] = useCapture({
    id: `${slideId}:${field}-stimmen`,
    module,
    slideId,
    kind: "checklist",
    prompt: `${prompt} – Einzelstimmen`,
    removeWhenEmpty: true,
  });
  const votes = parseVotes(storedVotes);
  const entries = useAllEntries();
  const [meta] = useWorkshopMeta();
  const apiKey = useApiKey();

  const comparing = Boolean(compareSlideId && compareField);
  const earlierVotes = comparing
    ? parseVotes(entries.find((e) => e.id === `${compareSlideId}:${compareField}-stimmen`)?.value)
    : [];
  const analysis = entries.find((e) => e.id === analysisId)?.value;

  const names = [...new Set([...meta.participantsList.map(displayName), ...earlierVotes.map((v) => v.name)])].filter(Boolean);

  // Unsaved rows: a vote is only stored once an option is picked.
  const [drafts, setDrafts] = useState<Vote[]>([]);
  // Prefilled rows from the earlier barometer that the facilitator skipped (person absent).
  const [skippedNames, setSkippedNames] = useState<string[]>([]);
  const [skippedAnonymous, setSkippedAnonymous] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [showKeySetup, setShowKeySetup] = useState(false);

  const votedNames = new Set(votes.map((v) => v.name).filter(Boolean));
  const pendingNames = comparing
    ? [...new Set(earlierVotes.map((v) => v.name))].filter((n) => n && !votedNames.has(n) && !skippedNames.includes(n))
    : [];
  const pendingAnonymous = comparing
    ? Math.max(0, earlierVotes.filter((v) => !v.name).length - votes.filter((v) => !v.name).length - skippedAnonymous)
    : 0;

  const writeVotes = (next: Vote[]) => {
    setStoredVotes(next.map((v) => (v.name ? `${v.option}${SEP}${v.name}` : v.option)));
    if (next.length === 0) {
      removeEntry(resultId);
      return;
    }
    const counts = options
      .map((o) => [o, next.filter((v) => v.option === o).length] as const)
      .filter(([, n]) => n > 0);
    setEntry({
      id: resultId,
      module,
      slideId,
      kind: "vote",
      prompt,
      value: `${counts.map(([o, n]) => `${o}: ${n}`).join(" · ")} (${next.length} ${next.length === 1 ? "Stimme" : "Stimmen"})`,
    });
  };

  const counts = options.map((o) => ({ option: o, n: votes.filter((v) => v.option === o).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));

  // Comparison: per named person and overall mean position on the scale (0 = first option).
  const shifts = comparing
    ? votes
        .filter((v) => v.name)
        .map((v) => {
          const before = earlierVotes.find((e) => e.name === v.name);
          if (!before) return null;
          return { name: v.name, before: before.option, after: v.option, delta: options.indexOf(v.option) - options.indexOf(before.option) };
        })
        .filter((s): s is { name: string; before: string; after: string; delta: number } => s !== null)
    : [];
  const meanBefore = meanPosition(earlierVotes, options);
  const meanAfter = meanPosition(votes, options);
  const canCompare = comparing && earlierVotes.length > 0 && votes.length > 0;

  const analyse = async () => {
    if (analysing) return;
    setAnalysing(true);
    setAnalysisError("");
    const dist = (vs: Vote[]) => options.map((o) => `${o}: ${vs.filter((v) => v.option === o).length}`).join(", ");
    const reasons = entries
      .filter((e) => (e.slideId === slideId || e.slideId === compareSlideId) && e.kind === "text" && e.id !== analysisId)
      .map((e) => `- ${e.prompt}: ${typeof e.value === "string" ? e.value : e.value.join(", ")}`)
      .filter((l) => l.trim().length > 0);
    const prompt = [
      `Skala (von links nach rechts): ${options.join(" → ")}`,
      `Vorher (Tag 1, ${earlierVotes.length} Stimmen): ${dist(earlierVotes)}`,
      `Nachher (Tag 2, ${votes.length} Stimmen): ${dist(votes)}`,
      meanBefore !== null && meanAfter !== null
        ? `Mittlere Position (0 = ${options[0]}, ${options.length - 1} = ${options[options.length - 1]}): vorher ${fmt(meanBefore)}, nachher ${fmt(meanAfter)}`
        : "",
      shifts.length
        ? `Bewegungen einzelner Personen (anonymisiert):\n${shifts.map((s, i) => `- Person ${i + 1}: ${s.before} → ${s.after} (${s.delta > 0 ? "+" : ""}${s.delta})`).join("\n")}`
        : "Keine Zuordnung einzelner Personen möglich (ohne Namen abgestimmt).",
      reasons.length ? `Begründungen und Notizen aus der Runde:\n${reasons.join("\n")}` : "Keine Begründungen erfasst.",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const out = await completeText({ system: ANALYSIS_SYSTEM, prompt, effort: "medium", logLabel: `barometer-analyse ${slideId}` });
      setEntry({
        id: analysisId,
        module,
        slideId,
        kind: "text",
        prompt: "Analyse: Veränderung der Haltung (vorher → nachher)",
        value: out,
      });
    } catch (err) {
      setAnalysisError(describeAiError(err, lang));
    } finally {
      setAnalysing(false);
    }
  };

  const nameSelect = (current: string, onChange: (name: string) => void) => {
    // Keep a name that is no longer in the list selectable, so editing never drops it.
    const choices = current && !names.includes(current) ? [current, ...names] : names;
    return (
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm rounded-md px-2 py-1.5 min-w-0 sm:w-48"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
        aria-label={de ? "Name (optional)" : "Name (optional)"}
      >
        <option value="">{de ? "— ohne Namen —" : "— no name —"}</option>
        {choices.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );
  };

  const optionButtons = (current: string, onPick: (option: string) => void) => (
    <div className="flex flex-wrap gap-1.5 flex-1">
      {options.map((o) => {
        const active = current === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            className="text-xs px-2.5 py-1.5 rounded-md transition-colors"
            style={{
              background: active ? "var(--workshop-accent)" : "var(--bg)",
              color: active ? "white" : "var(--fg)",
              border: "1px solid " + (active ? "var(--workshop-accent)" : "var(--border)"),
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );

  const deleteButton = (onDelete: () => void, label?: string) => (
    <button
      type="button"
      onClick={onDelete}
      className="size-8 grid place-items-center rounded-md shrink-0 hover:bg-black/5"
      title={label ?? (de ? "Zeile löschen" : "Delete row")}
      aria-label={label ?? (de ? "Zeile löschen" : "Delete row")}
      style={{ color: "var(--fg-muted)" }}
    >
      <X size={14} />
    </button>
  );

  const distribution = (
    <div className="space-y-1.5">
      {counts.map(({ option, n }) => (
        <div key={option} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0">{option}</span>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(n / max) * 100}%`, background: "var(--workshop-accent)", opacity: n ? 1 : 0 }}
            />
          </div>
          <span className="w-6 text-right tabular-nums" style={{ color: "var(--fg-muted)" }}>
            {n}
          </span>
        </div>
      ))}
      <p className="text-[11px] pt-0.5" style={{ color: "var(--fg-muted)" }}>
        {votes.length} {de ? (votes.length === 1 ? "Stimme" : "Stimmen") : votes.length === 1 ? "vote" : "votes"}
      </p>
    </div>
  );

  const comparison = canCompare && (
    <div className="mt-4 pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
      <div className="text-sm font-semibold">{de ? "Vorher · nachher" : "Before · after"}</div>
      <div className="overflow-x-auto">
        <table className="text-xs min-w-full">
          <thead>
            <tr style={{ color: "var(--fg-muted)" }}>
              <th className="text-left font-medium pr-3 py-1" />
              {options.map((o) => (
                <th key={o} className="font-medium px-2 py-1 text-center">
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: de ? `Vorher (${compareSlideId})` : `Before (${compareSlideId})`, vs: earlierVotes },
              { label: de ? `Nachher (${slideId})` : `After (${slideId})`, vs: votes },
            ].map(({ label, vs }) => (
              <tr key={label} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="pr-3 py-1.5 font-medium whitespace-nowrap">{label}</td>
                {options.map((o) => (
                  <td key={o} className="px-2 py-1.5 text-center tabular-nums">
                    {vs.filter((v) => v.option === o).length || "·"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meanBefore !== null && meanAfter !== null && (
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          {de ? "Mittlere Position" : "Mean position"} ({options[0]} = 0 … {options[options.length - 1]} = {options.length - 1}):{" "}
          <strong style={{ color: "var(--fg)" }}>{fmt(meanBefore)}</strong> → <strong style={{ color: "var(--fg)" }}>{fmt(meanAfter)}</strong>
          {" "}({meanAfter - meanBefore >= 0 ? "+" : ""}
          {fmt(meanAfter - meanBefore)})
        </p>
      )}
      {shifts.length > 0 && (
        <ul className="text-xs space-y-1">
          {shifts.map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              <span
                className="size-5 grid place-items-center rounded-full shrink-0"
                style={{
                  background: s.delta === 0 ? "var(--border)" : "color-mix(in oklch, var(--workshop-accent) 18%, transparent)",
                  color: s.delta === 0 ? "var(--fg-muted)" : "var(--workshop-accent)",
                }}
                aria-hidden
              >
                {s.delta > 0 ? <ArrowUp size={12} /> : s.delta < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
              </span>
              <span className="font-medium">{s.name}</span>
              <span style={{ color: "var(--fg-muted)" }}>
                {s.before} → {s.after}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 no-print">
        <button
          type="button"
          onClick={() => (apiKey ? analyse() : setShowKeySetup(true))}
          disabled={analysing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: "var(--workshop-accent-deep)", color: "white" }}
        >
          {analysing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {typeof analysis === "string" && analysis
            ? de ? "Analyse aktualisieren" : "Update analysis"
            : de ? "Veränderung analysieren" : "Analyse the change"}
        </button>
        {analysisError && (
          <span className="text-[11px]" style={{ color: "#dc2626" }}>
            {analysisError}
          </span>
        )}
      </div>
      {showKeySetup && !apiKey && <AiKeySetup lang={lang} />}
      {typeof analysis === "string" && analysis && (
        <div
          className="rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
        >
          {analysis}
        </div>
      )}
    </div>
  );

  if (readOnly) {
    return (
      <div className="my-4">
        <p className="text-sm font-medium mb-2">{prompt}</p>
        {distribution}
        {votes.length > 0 && (
          <ul className="mt-2 text-xs list-disc pl-5">
            {votes.map((v, i) => (
              <li key={i}>
                {v.option}
                {v.name ? ` — ${v.name}` : ""}
              </li>
            ))}
          </ul>
        )}
        {typeof analysis === "string" && analysis && <p className="mt-3 text-xs whitespace-pre-wrap">{analysis}</p>}
      </div>
    );
  }

  return (
    <div
      className="my-4 rounded-md border p-4"
      style={{ borderColor: "var(--workshop-accent)", background: "color-mix(in oklch, var(--workshop-accent) 4%, transparent)" }}
    >
      <div className="flex items-start gap-2 mb-3">
        <span
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          {de ? "Eingabe" : "Input"}
        </span>
        <span className="text-sm font-medium leading-snug flex-1">{prompt}</span>
      </div>

      {comparing && (pendingNames.length > 0 || pendingAnonymous > 0) && (
        <p className="text-[11px] mb-2" style={{ color: "var(--fg-muted)" }}>
          {de
            ? `Aus dem Vorher-Barometer (${compareSlideId}) übernommen: nur noch die Einschätzung anklicken. Wer nicht mehr da ist, mit × überspringen.`
            : `Taken over from the before barometer (${compareSlideId}): just click the assessment. Skip anyone no longer present with ×.`}
        </p>
      )}

      <div className="space-y-2">
        {votes.map((v, i) => (
          <div key={`v-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-2">
            {nameSelect(v.name, (name) => writeVotes(votes.map((x, j) => (j === i ? { ...x, name } : x))))}
            {optionButtons(v.option, (option) => writeVotes(votes.map((x, j) => (j === i ? { ...x, option } : x))))}
            {deleteButton(() => writeVotes(votes.filter((_, j) => j !== i)))}
          </div>
        ))}
        {pendingNames.map((name) => (
          <div key={`p-${name}`} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span
              className="text-sm rounded-md px-2 py-1.5 sm:w-48 truncate"
              style={{ border: "1px dashed var(--border)", color: "var(--fg)" }}
              title={name}
            >
              {name}
            </span>
            {optionButtons("", (option) => writeVotes([...votes, { option, name }]))}
            {deleteButton(() => setSkippedNames([...skippedNames, name]), de ? "Überspringen" : "Skip")}
          </div>
        ))}
        {Array.from({ length: pendingAnonymous }, (_, i) => (
          <div key={`pa-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span
              className="text-sm rounded-md px-2 py-1.5 sm:w-48"
              style={{ border: "1px dashed var(--border)", color: "var(--fg-muted)" }}
            >
              {de ? "— ohne Namen —" : "— no name —"}
            </span>
            {optionButtons("", (option) => writeVotes([...votes, { option, name: "" }]))}
            {deleteButton(() => setSkippedAnonymous(skippedAnonymous + 1), de ? "Überspringen" : "Skip")}
          </div>
        ))}
        {drafts.map((d, i) => (
          <div key={`d-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-2">
            {nameSelect(d.name, (name) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, name } : x))))}
            {optionButtons("", (option) => {
              writeVotes([...votes, { option, name: d.name }]);
              setDrafts(drafts.filter((_, j) => j !== i));
            })}
            {deleteButton(() => setDrafts(drafts.filter((_, j) => j !== i)))}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDrafts([...drafts, { option: "", name: "" }])}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
        style={{ background: "var(--workshop-accent)", color: "white" }}
      >
        <Plus size={14} /> {de ? "Einschätzung hinzufügen" : "Add assessment"}
      </button>
      {names.length === 0 && (
        <p className="text-[11px] mt-2" style={{ color: "var(--fg-muted)" }}>
          {de
            ? "Namen erscheinen zur Auswahl, sobald die Teilnehmerliste in der Vorstellungsrunde (00.04) ausgefüllt ist. Ohne Namen geht es immer."
            : "Names become selectable once the participant list in the round of introductions (00.04) is filled in. Voting without a name always works."}
        </p>
      )}

      {votes.length > 0 && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          {distribution}
        </div>
      )}

      {comparison}
    </div>
  );
}
