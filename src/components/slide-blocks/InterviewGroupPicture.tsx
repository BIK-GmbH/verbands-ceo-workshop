import { useEffect, useMemo, useState } from "react";
import { FileAudio, Mic, Pencil, RotateCcw, Share2, X, PenLine } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAllEntries } from "@/lib/useWorkshop";
import { useInterviews } from "@/lib/interview-store";
import {
  GAP_LABEL,
  SCALE_BY_ID,
  aggregateScales,
  formatNumber,
  formatSigned,
  metricsProtocolText,
  scaleRange,
  type GroupMetrics,
  type ScaleId,
} from "@/lib/interview-metrics";
import {
  GROUP_SLIDE_ID,
  groupPicture,
  migrateLegacyGroupEntries,
  setManualList,
  setManualScale,
  syncGroupProtocol,
  type ListValue,
  type ScaleValue,
} from "@/lib/interview-group";
import { removeGroupMetricsFromProtocol, writeGroupMetricsToProtocol } from "@/lib/interview-opinion";
import { InterviewRecorder } from "@/components/interviews/InterviewRecorder";
import { InterviewUpload } from "@/components/interviews/InterviewUpload";
import { TransferBar } from "@/components/interviews/TransferBar";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Lang } from "@/types/slide";

interface Props {
  /** Slide id this block belongs to — always "01.02", kept for the MDX convention. */
  slideId?: string;
  /** Print view: values and no controls. */
  readOnly?: boolean;
}

const BTN_GHOST =
  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors disabled:opacity-50";
const muted = { color: "var(--fg-muted)" } as const;
const cell = { background: "var(--bg)", border: "1px solid var(--border)" } as const;

/**
 * The group picture of slide 01.02: the four dimensions of the AI interviews as
 * measured values (mean, spread, n) plus the terms and areas of application
 * that were named — read straight from the interview store, so the slide shows
 * them without anyone having opened the interview page first.
 *
 * Every dimension can be overruled by hand for someone without an interview or
 * when transcription fails. A hand-set value says so and can be reset; the
 * measured value then takes over again.
 */
export function InterviewGroupPicture({ slideId = GROUP_SLIDE_ID, readOnly = false }: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const entries = useAllEntries();
  const { interviews } = useInterviews();

  const metrics = useMemo(() => aggregateScales(interviews.map((iv) => iv.scales)), [interviews]);
  const metricsText = useMemo(() => metricsProtocolText(metrics), [metrics]);
  const picture = useMemo(() => groupPicture(metrics, entries), [metrics, entries]);

  // Records from before the fields were numbered keep their content.
  useEffect(() => {
    if (readOnly) return;
    try {
      migrateLegacyGroupEntries();
    } catch (err) {
      console.error("[interviews] carrying older group entries over failed", err);
    }
  }, [readOnly]);

  // The values are derived data: they follow every change into the record on
  // their own, so the slide never disagrees with /protokoll.
  useEffect(() => {
    if (readOnly) return;
    try {
      syncGroupProtocol(picture);
      if (metrics.withScales > 0) writeGroupMetricsToProtocol(metricsText);
      else removeGroupMetricsFromProtocol();
    } catch (err) {
      console.error("[interviews] writing the group picture to the record failed", err);
    }
  }, [readOnly, picture, metrics.withScales, metricsText]);

  if (readOnly) return <PrintPicture picture={picture} metrics={metrics} lang={lang} />;

  const evaluated = interviews.filter((iv) => iv.opinion?.trim()).length;
  const withoutScales = Math.max(0, evaluated - metrics.withScales);

  return (
    <section
      className="ws-input-block my-4 rounded-md p-4"
      data-testid="interview-group-picture"
      data-slide={slideId}
    >
      <div className="flex flex-wrap items-start gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          <PenLine size={11} aria-hidden />
          {de ? "Auswertung" : "Evaluation"}
        </span>
        <span className="text-sm font-medium leading-snug flex-1 basis-40">
          {de ? "Unser Gruppenbild aus den Interviews" : "Our group picture from the interviews"}
        </span>
        <span className="text-[11px] mt-0.5" style={muted} data-testid="group-basis">
          {de
            ? `${metrics.withScales} von ${interviews.length} ${interviews.length === 1 ? "Interview" : "Interviews"} · im Browser gerechnet, ohne KI`
            : `${metrics.withScales} of ${interviews.length} ${interviews.length === 1 ? "interview" : "interviews"} · computed in the browser, no AI`}
        </span>
      </div>

      {picture.empty && (
        <p className="text-sm rounded-md px-2.5 py-2 mb-3" style={{ ...cell }} data-testid="group-empty">
          {de
            ? "Noch keine Interviews ausgewertet. Sobald Interviews aufgenommen und im Interview-Modus ausgewertet sind, stehen hier je Dimension Mittelwert, Streuung und Anzahl. Einzelne Werte können wir auch von Hand setzen."
            : "No interviews evaluated yet. As soon as interviews are recorded and evaluated in interview mode, each dimension shows its mean, spread and count here. Single values can also be set by hand."}
        </p>
      )}

      {metrics.thin && (
        <p className="text-xs rounded-md px-2.5 py-2 mb-3" style={{ ...cell, color: "var(--fg-muted)" }}>
          {de
            ? "Bislang nur ein oder zwei Angaben je Dimension – die Werte sind ein Eindruck, keine Statistik."
            : "Only one or two values per dimension so far – these figures are an impression, not statistics."}
        </p>
      )}

      {/* Order of the interview guide: attitude, terms, competence, relevance, areas. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <ScaleCell value={findScale(picture.scales, "haltung")} lang={lang} />
        <ListCell list={picture.begriffe} title={de ? "Häufigste Begriffe" : "Most frequent terms"} lang={lang} accent />
        <ScaleCell value={findScale(picture.scales, "kompetenz")} lang={lang} />
        <ScaleCell value={findScale(picture.scales, "relevanzHeute")} lang={lang} />
        <ScaleCell value={findScale(picture.scales, "relevanzMorgen")} lang={lang} />
        <ListCell
          list={picture.einsatzgebiete}
          title={de ? "Meistgenannte Einsatzgebiete" : "Most named areas of application"}
          lang={lang}
        />
      </div>

      <div className="rounded-md p-2.5 mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1" style={cell} data-testid="group-gap">
        <span className="text-sm font-medium">{de ? "Lücke Relevanz heute → morgen" : "Gap relevance today → tomorrow"}</span>
        {metrics.gap === null || metrics.gapTrend === null ? (
          <span className="text-xs" style={muted}>
            {de ? "noch nicht berechenbar" : "cannot be computed yet"}
          </span>
        ) : (
          <>
            <span className="text-base font-semibold" style={{ color: "var(--workshop-accent)" }}>
              {formatSigned(metrics.gap, lang)} {de ? "Stufen" : "steps"}
            </span>
            <span className="text-[11px]" style={muted}>
              {GAP_LABEL[metrics.gapTrend][lang]}
            </span>
          </>
        )}
      </div>

      <InterviewTools
        lang={lang}
        total={interviews.length}
        evaluated={evaluated}
        withoutScales={withoutScales}
      />
    </section>
  );
}

const findScale = (scales: ScaleValue[], id: ScaleId) => scales.find((s) => s.id === id);

/** One dimension: the measured figures, or the value we set by hand instead. */
function ScaleCell({ value, lang }: { value?: ScaleValue; lang: Lang }) {
  const de = lang === "de";
  const [editing, setEditing] = useState(false);
  if (!value) return null;
  const def = SCALE_BY_ID[value.id];
  const { stat } = value;
  const manual = value.source === "manual";

  const save = (raw: string) => {
    setManualScale(value.id, raw ? Number(raw) : null);
    setEditing(false);
  };

  return (
    <div className="rounded-md p-2.5 space-y-1.5" style={cell} data-testid={`group-${value.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">{def.label[lang]}</span>
        <span className="text-[11px]" style={muted}>
          {scaleRange(value.id, lang)}
        </span>
        {manual && <ManualBadge lang={lang} />}
      </div>

      {manual && value.manual !== null ? (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold" style={{ color: "var(--workshop-accent)" }}>
            {def.levels[value.manual - 1][lang]}
          </span>
          <span className="text-[11px]" style={muted}>
            {value.manual} {de ? "von 4" : "of 4"} ·{" "}
            {stat.mean === null
              ? de
                ? "keine Auswertung vorhanden"
                : "no evaluation available"
              : `${de ? "Auswertung" : "evaluation"}: Ø ${formatNumber(stat.mean, lang)} (n = ${stat.count})`}
          </span>
        </p>
      ) : stat.mean === null ? (
        <p className="text-xs" style={muted}>
          {de ? "noch nicht ausgewertet" : "not evaluated yet"}
        </p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-semibold" style={{ color: "var(--workshop-accent)" }}>
              Ø {formatNumber(stat.mean, lang)}
            </span>
            <span className="text-[11px]" style={muted}>
              {de ? "von 4" : "of 4"}
            </span>
            <span className="text-[11px]" style={muted}>
              ·{" "}
              {stat.sd === null
                ? de
                  ? "Streuung erst ab zwei Angaben"
                  : "spread needs two values"
                : `σ ${formatNumber(stat.sd, lang, 2)}`}
            </span>
            <span className="text-[11px]" style={muted}>
              · {de ? "Spanne" : "range"} {stat.min}–{stat.max}
            </span>
            <span className="text-[11px]" style={muted}>
              · n = {stat.count}
            </span>
          </p>
          <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]" style={muted}>
            {def.levels.map((level, i) => (
              <span key={level.de} style={stat.distribution[i] ? { color: "var(--fg)" } : undefined}>
                {level[lang]} <span className="tabular-nums">{stat.distribution[i]}</span>
              </span>
            ))}
          </p>
        </>
      )}

      {editing ? (
        <div className="flex flex-wrap items-center gap-1.5 no-print">
          <select
            defaultValue={value.manual ?? ""}
            onChange={(e) => save(e.target.value)}
            autoFocus
            className="rounded-md p-1 text-xs"
            style={{ ...cell, color: "var(--fg)" }}
            aria-label={`${def.label[lang]} · ${de ? "von Hand setzen" : "set by hand"}`}
            data-testid={`set-${value.id}`}
          >
            <option value="">{de ? "— Auswertung verwenden —" : "— use the evaluation —"}</option>
            {def.levels.map((level, i) => (
              <option key={level.de} value={i + 1}>
                {i + 1} · {level[lang]}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setEditing(false)} className={BTN_GHOST} style={muted}>
            <X size={11} /> {de ? "Abbrechen" : "Cancel"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 no-print">
          <Tooltip
            content={
              de
                ? "Wert von Hand setzen – für Personen ohne Interview oder wenn die Transkription ausfällt. Der Wert wird als von Hand gesetzt gekennzeichnet."
                : "Set the value by hand – for people without an interview or when transcription fails. The value is marked as set by hand."
            }
          >
            <button type="button" onClick={() => setEditing(true)} className={BTN_GHOST} style={muted}>
              <Pencil size={11} /> {de ? "von Hand setzen" : "set by hand"}
            </button>
          </Tooltip>
          {manual && <ResetButton lang={lang} onReset={() => setManualScale(value.id, null)} />}
        </div>
      )}
    </div>
  );
}

/** Terms and areas of application: the counted mentions, or our own wording. */
function ListCell({ list, title, lang, accent }: { list: ListValue; title: string; lang: Lang; accent?: boolean }) {
  const de = lang === "de";
  const [draft, setDraft] = useState<string | null>(null);
  const manual = list.source === "manual";

  return (
    <div className="rounded-md p-2.5 space-y-1.5" style={cell} data-testid={`group-${list.field}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">{title}</span>
        {manual && <ManualBadge lang={lang} />}
      </div>

      {manual ? (
        <p className="text-sm leading-snug whitespace-pre-wrap">{list.manual}</p>
      ) : list.terms.length ? (
        <p className="flex flex-wrap gap-1">
          {list.terms.map((t) => (
            <span
              key={t.term}
              className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={
                accent
                  ? { background: "color-mix(in oklch, var(--workshop-accent) 12%, transparent)", color: "var(--workshop-accent)" }
                  : { border: "1px solid var(--border)", color: "var(--fg-muted)" }
              }
            >
              {t.term} <span className="tabular-nums opacity-70">{t.count}</span>
            </span>
          ))}
        </p>
      ) : (
        <p className="text-xs" style={muted}>
          {de ? "noch nicht ausgewertet" : "not evaluated yet"}
        </p>
      )}

      {draft !== null ? (
        <div className="space-y-1.5 no-print">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            className="w-full text-sm rounded-md p-2"
            style={{ ...cell, color: "var(--fg)" }}
            aria-label={`${title} · ${de ? "von Hand setzen" : "set by hand"}`}
            data-testid={`set-${list.field}`}
          />
          <div className="flex flex-wrap gap-1.5 justify-end">
            <button type="button" onClick={() => setDraft(null)} className={BTN_GHOST} style={muted}>
              {de ? "Abbrechen" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => {
                setManualList(list, draft);
                setDraft(null);
              }}
              className={BTN_GHOST}
              style={{ background: "var(--workshop-accent)", color: "white" }}
            >
              {de ? "Übernehmen" : "Apply"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 no-print">
          <Tooltip
            content={
              de
                ? "Eigene Fassung eintragen – etwa wenn Begriffe aus der Runde fehlen. Sie wird als von Hand gesetzt gekennzeichnet."
                : "Enter your own version – for instance when terms from the round are missing. It is marked as set by hand."
            }
          >
            <button type="button" onClick={() => setDraft(manual ? list.manual : "")} className={BTN_GHOST} style={muted}>
              <Pencil size={11} /> {de ? "von Hand setzen" : "set by hand"}
            </button>
          </Tooltip>
          {manual && <ResetButton lang={lang} onReset={() => setManualList(list, "")} />}
        </div>
      )}
    </div>
  );
}

function ManualBadge({ lang }: { lang: Lang }) {
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full"
      style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)" }}
      data-testid="manual-badge"
    >
      {lang === "de" ? "von Hand gesetzt" : "set by hand"}
    </span>
  );
}

function ResetButton({ lang, onReset }: { lang: Lang; onReset: () => void }) {
  return (
    <Tooltip
      content={
        lang === "de"
          ? "Eigenen Wert verwerfen – danach gilt wieder die Auswertung der Interviews."
          : "Discard the hand-set value – the interview evaluation applies again."
      }
    >
      <button type="button" onClick={onReset} className={BTN_GHOST} style={{ color: "var(--workshop-accent)" }}>
        <RotateCcw size={11} /> {lang === "de" ? "zurücksetzen" : "reset"}
      </button>
    </Tooltip>
  );
}

type Tool = "record" | "upload" | "transfer";

/**
 * Interview mode without leaving the slide — the same components the interview
 * page uses. Panels stay mounted once opened so a running recording survives a
 * switch.
 */
function InterviewTools({
  lang,
  total,
  evaluated,
  withoutScales,
}: {
  lang: Lang;
  total: number;
  evaluated: number;
  withoutScales: number;
}) {
  const de = lang === "de";
  const { interviews } = useInterviews();
  const [open, setOpen] = useState<Tool | null>(null);
  const [seen, setSeen] = useState<Tool[]>([]);

  const show = (tool: Tool) => {
    setOpen((cur) => (cur === tool ? null : tool));
    setSeen((list) => (list.includes(tool) ? list : [...list, tool]));
  };

  const toolButton = (tool: Tool, label: string, hint: string, Icon: typeof Mic) => (
    <Tooltip content={hint}>
      <button
        type="button"
        onClick={() => show(tool)}
        aria-expanded={open === tool}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
        style={
          open === tool
            ? { background: "var(--workshop-accent)", color: "white", border: "1px solid var(--workshop-accent)" }
            : { ...cell, color: "var(--fg)" }
        }
        data-testid={`tool-${tool}`}
      >
        <Icon size={13} /> {label}
      </button>
    </Tooltip>
  );

  return (
    <div className="no-print mt-4 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">{de ? "Interview-Modus" : "Interview mode"}</span>
        <span className="text-[11px]" style={muted} data-testid="tool-status">
          {de
            ? `${total} aufgenommen · ${evaluated} ausgewertet${withoutScales ? ` · ${withoutScales} ohne Skalenwerte` : ""}`
            : `${total} recorded · ${evaluated} evaluated${withoutScales ? ` · ${withoutScales} without scale values` : ""}`}
        </span>
        <a href="#/interviews" className="text-[11px] underline sm:ml-auto" style={{ color: "var(--workshop-accent)" }}>
          {de ? "Interviews auswerten" : "Evaluate interviews"}
        </a>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {toolButton(
          "record",
          de ? "Interview aufnehmen" : "Record interview",
          de ? "Geführtes Interview mit Leitfragen, direkt hier aufgenommen" : "Guided interview with the guide questions, recorded right here",
          Mic,
        )}
        {toolButton(
          "upload",
          de ? "Audio hochladen" : "Upload audio",
          de ? "Anderswo aufgenommene Audiodateien übernehmen, etwa vom Smartphone" : "Take over audio files recorded elsewhere, e.g. on a smartphone",
          FileAudio,
        )}
        {toolButton(
          "transfer",
          de ? "Übertragen" : "Transfer",
          de ? "Interviews vom zweiten Rechner importieren oder für ihn exportieren" : "Import interviews from the second computer or export them for it",
          Share2,
        )}
      </div>

      {seen.includes("record") && (
        <div hidden={open !== "record"} className="pt-1">
          <InterviewRecorder lang={lang} nextNumber={interviews.length + 1} onShowList={goToInterviews} />
        </div>
      )}
      {seen.includes("upload") && (
        <div hidden={open !== "upload"} className="pt-1">
          <InterviewUpload lang={lang} nextNumber={interviews.length + 1} onShowList={goToInterviews} />
        </div>
      )}
      {seen.includes("transfer") && (
        <div hidden={open !== "transfer"} className="pt-1">
          <TransferBar interviews={interviews} lang={lang} />
        </div>
      )}
    </div>
  );
}

/** Evaluation itself stays on the interview page — that is where transcript and opinion picture live. */
function goToInterviews() {
  window.location.hash = "#/interviews";
}

/** Print: the values as plain lines, no controls. */
function PrintPicture({ picture, metrics, lang }: { picture: ReturnType<typeof groupPicture>; metrics: GroupMetrics; lang: Lang }) {
  const de = lang === "de";
  const none = de ? "noch nicht ausgewertet" : "not evaluated yet";
  const manualNote = de ? " (von Hand gesetzt)" : " (set by hand)";
  const rows: { label: string; text: string }[] = [];
  for (const scale of picture.scales) {
    rows.push({
      label: SCALE_BY_ID[scale.id].label[lang],
      text: scale.source === "none" ? none : scale.text.replace(/\s*·\s*von Hand gesetzt\s*$/, manualNote),
    });
  }
  rows.splice(1, 0, {
    label: de ? "Häufigste Begriffe" : "Most frequent terms",
    text: picture.begriffe.source === "none" ? none : picture.begriffe.text.replace(/\s*·\s*von Hand gesetzt\s*$/, manualNote),
  });
  rows.push({
    label: de ? "Meistgenannte Einsatzgebiete" : "Most named areas of application",
    text:
      picture.einsatzgebiete.source === "none"
        ? none
        : picture.einsatzgebiete.text.replace(/\s*·\s*von Hand gesetzt\s*$/, manualNote),
  });

  return (
    <div className="my-4">
      <p className="text-sm font-medium mb-1">
        {de ? "Unser Gruppenbild aus den Interviews" : "Our group picture from the interviews"}
        <span className="text-xs font-normal ml-2">
          {de
            ? `(${metrics.withScales} von ${metrics.interviews} Interviews)`
            : `(${metrics.withScales} of ${metrics.interviews} interviews)`}
        </span>
      </p>
      <ul className="text-sm list-disc pl-5 space-y-0.5">
        {rows.map((row) => (
          <li key={row.label}>
            <strong>{row.label}:</strong> {row.text}
          </li>
        ))}
        <li>
          <strong>{de ? "Lücke Relevanz heute → morgen" : "Gap relevance today → tomorrow"}:</strong>{" "}
          {metrics.gap === null || metrics.gapTrend === null
            ? none
            : `${formatSigned(metrics.gap, lang)} ${de ? "Stufen" : "steps"} (${GAP_LABEL[metrics.gapTrend][lang]})`}
        </li>
      </ul>
    </div>
  );
}
