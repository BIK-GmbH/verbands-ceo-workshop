import { useState } from "react";
import { AlertTriangle, Check, Copy, Eye, FileDown, FileType, Loader2, Pencil, Printer, ScrollText, Sparkles, Trash2 } from "lucide-react";
import type { Lang } from "@/types/slide";
import type { CaptureEntry } from "@/lib/workshop-store";
import { describeAiError, useApiKey } from "@/lib/ai-assist";
import { markdownToHtml } from "@/lib/markdown";
import { downloadReportMarkdown, downloadReportWord, printReportPdf } from "@/lib/protocol-export";
import { clearReport, generateReport, isReportStale, reportEntries, updateReportMarkdown, useReport } from "@/lib/report";
import { AiKeySetup } from "@/components/ProtocolAi";
import { Tooltip } from "@/components/ui/Tooltip";

const ERROR_COLOR = "#dc2626";

// Tailwind's preflight resets headings/lists — restore a readable document style, theme-aware via tokens.
const PROSE =
  "text-sm leading-relaxed " +
  "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-5 [&_h1]:mb-2 " +
  "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-[var(--border)] [&_h2]:text-[var(--workshop-accent)] [&_h2:first-child]:mt-0 " +
  "[&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h4]:font-medium [&_h4]:mt-3 [&_h4]:mb-1 " +
  "[&_p]:mb-2.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:mb-2.5 [&_ol]:mb-2.5 [&_li]:mb-1 " +
  "[&_strong]:font-semibold [&_em]:italic [&_code]:font-mono [&_code]:text-[0.9em] " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--fg-muted)] " +
  "[&_hr]:my-4 [&_hr]:border-[var(--border)] " +
  "[&_table]:w-full [&_table]:mb-3 [&_table]:border-collapse [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_td]:border [&_th]:border-[var(--border)] [&_td]:border-[var(--border)] [&_th]:p-1.5 [&_td]:p-1.5 [&_td]:align-top";

const btn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium disabled:opacity-50";
const outline = { border: "1px solid var(--border)", color: "var(--fg)" } as const;

function formatStamp(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * „Ergebnisbericht" on /protokoll: Claude condenses all captured contributions
 * into a structured report, which can be edited and exported (PDF/Word/Markdown).
 */
export function ReportPanel({ entries, lang }: { entries: CaptureEntry[]; lang: Lang }) {
  const de = lang === "de";
  const apiKey = useApiKey();
  const report = useReport();
  const [hints, setHints] = useState(() => report?.hints ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const count = reportEntries(entries).length;
  const stale = report !== null && isReportStale(report, entries);
  const info = report ? { createdAt: report.createdAt, entryCount: report.entryCount } : {};

  const generate = async () => {
    if (busy || count === 0) return;
    if (
      report?.editedAt &&
      !window.confirm(
        de
          ? "Der Bericht wurde von Hand bearbeitet. Beim Aktualisieren werden diese Änderungen überschrieben. Fortfahren?"
          : "The report was edited by hand. Updating will overwrite these edits. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await generateReport(lang, hints);
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof DOMException
          ? de
            ? "Der Bericht konnte in diesem Browser nicht gespeichert werden (Speicher voll oder blockiert)."
            : "The report could not be stored in this browser (storage full or blocked)."
          : describeAiError(err, lang),
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(de ? "Kopieren nicht möglich. Bitte im Bearbeiten-Modus markieren und kopieren." : "Copy failed. Please select the text in edit mode and copy it.");
    }
  };

  const discard = () => {
    if (window.confirm(de ? "Ergebnisbericht wirklich verwerfen?" : "Really discard the results report?")) {
      clearReport();
      setEditing(false);
    }
  };

  const generateLabel = busy
    ? de
      ? "Bericht wird erstellt …"
      : "Creating report …"
    : report
      ? de
        ? "Ergebnisbericht aktualisieren"
        : "Update results report"
      : de
        ? "Ergebnisbericht erstellen"
        : "Create results report";

  return (
    <section
      aria-labelledby="report-heading"
      className="mb-8 rounded-lg p-4 sm:p-5 space-y-4"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3">
        <ScrollText size={22} className="shrink-0 mt-0.5" style={{ color: "var(--workshop-accent)" }} />
        <div>
          <h2 id="report-heading" className="text-lg font-semibold leading-tight">
            {de ? "Ergebnisbericht" : "Results report"}
          </h2>
          <p className="text-xs mt-1 leading-snug" style={{ color: "var(--fg-muted)" }}>
            {de
              ? "Claude verdichtet alle erfassten Beiträge zu einem gegliederten Bericht: Management Summary, Phasen 1–7, offene Fragen, nächste Schritte. Dafür werden die Beiträge an die Claude-API übertragen. Der Bericht wird lokal gespeichert und lässt sich bearbeiten und exportieren."
              : "Claude condenses all captured contributions into a structured report: management summary, phases 1–7, open questions, next steps. The contributions are sent to the Claude API for this. The report is stored locally and can be edited and exported."}
          </p>
        </div>
      </div>

      {apiKey ? (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="block mb-1 text-xs uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
              {de ? "Hinweise für den Bericht (optional)" : "Notes for the report (optional)"}
            </span>
            <textarea
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              rows={2}
              disabled={busy}
              placeholder={
                de
                  ? "z. B. „für die Mitgliederversammlung“, „höchstens zwei Seiten“, „Fokus auf Beschlüsse“"
                  : "e.g. “for the general assembly”, “two pages max.”, “focus on decisions”"
              }
              className="w-full rounded-md p-2 text-sm resize-y"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip
              content={
                de
                  ? "Claude verdichtet alle Beiträge zu einem gegliederten Bericht. Die Hinweise oben steuern Zielgruppe, Umfang und Schwerpunkt. Ein erneuter Lauf ersetzt den bisherigen Bericht."
                  : "Claude condenses all contributions into a structured report. The notes above steer audience, length and focus. Running it again replaces the current report."
              }
            >
              <button
                type="button"
                onClick={generate}
                disabled={busy || count === 0}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                style={{ background: "var(--workshop-accent)", color: "white" }}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generateLabel}
              </button>
            </Tooltip>
            <span className="text-xs" style={{ color: "var(--fg-muted)" }} aria-live="polite">
              {busy
                ? de
                  ? "Das kann bis zu einer Minute dauern."
                  : "This can take up to a minute."
                : count === 0
                  ? de
                    ? "Noch keine Beiträge erfasst."
                    : "No contributions captured yet."
                  : de
                    ? `${count} ${count === 1 ? "Beitrag wird" : "Beiträge werden"} berücksichtigt.`
                    : `${count} ${count === 1 ? "contribution" : "contributions"} will be considered.`}
            </span>
          </div>
        </div>
      ) : (
        <AiKeySetup lang={lang} />
      )}

      {error && (
        <p className="text-xs" role="alert" style={{ color: ERROR_COLOR }}>
          {error}
        </p>
      )}

      {report && stale && !busy && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-xs"
          style={{
            border: "1px solid color-mix(in oklch, #d97706 55%, var(--border))",
            background: "color-mix(in oklch, #d97706 10%, var(--bg))",
          }}
        >
          <AlertTriangle size={14} className="shrink-0" style={{ color: "#d97706" }} />
          <span className="flex-1 min-w-[12rem]">
            {de
              ? `Seit der Erstellung sind Beiträge hinzugekommen oder geändert worden (jetzt ${count}, im Bericht ${report.entryCount}).`
              : `Contributions were added or changed since the report was created (now ${count}, in report ${report.entryCount}).`}
          </span>
          {apiKey && count > 0 && (
            <button type="button" onClick={generate} className={btn} style={{ background: "var(--workshop-accent)", color: "white" }}>
              <Sparkles size={13} /> {de ? "Bericht aktualisieren" : "Update report"}
            </button>
          )}
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tooltip
              content={
                editing
                  ? de ? "Zurück zur formatierten Ansicht" : "Back to the formatted view"
                  : de
                    ? "Bericht als Markdown direkt bearbeiten. Änderungen werden sofort gespeichert und gehen in alle Exporte ein."
                    : "Edit the report directly as Markdown. Changes are saved immediately and go into all exports."
              }
            >
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className={btn}
                style={editing ? { background: "var(--workshop-accent-deep)", color: "white" } : outline}
                aria-pressed={editing}
              >
                {editing ? <Eye size={13} /> : <Pencil size={13} />}
                {editing ? (de ? "Ansicht" : "View") : de ? "Bearbeiten" : "Edit"}
              </button>
            </Tooltip>
            <Tooltip content={de ? "Bericht druckfertig öffnen, drucken oder als PDF speichern" : "Open the report print-ready; print or save as PDF"}>
              <button type="button" onClick={() => printReportPdf(lang, report.markdown, info)} className={btn} style={{ background: "var(--workshop-accent)", color: "white" }}>
                <Printer size={13} /> {de ? "Als PDF" : "As PDF"}
              </button>
            </Tooltip>
            <Tooltip content={de ? "Bericht als Word-Datei (.doc) zum Weiterbearbeiten herunterladen" : "Download the report as a Word file (.doc) for further editing"}>
              <button type="button" onClick={() => downloadReportWord(lang, report.markdown, info)} className={btn} style={{ background: "var(--workshop-accent-deep)", color: "white" }}>
                <FileType size={13} /> {de ? "Als Word" : "As Word"}
              </button>
            </Tooltip>
            <Tooltip content={de ? "Reiner Text mit Überschriften, z. B. für ein Wiki oder eine E-Mail" : "Plain text with headings, e.g. for a wiki or an e-mail"}>
              <button type="button" onClick={() => downloadReportMarkdown(lang, report.markdown, info)} className={btn} style={outline}>
                <FileDown size={13} /> {de ? "Markdown herunterladen" : "Download Markdown"}
              </button>
            </Tooltip>
            <Tooltip content={de ? "Berichtstext (Markdown) in die Zwischenablage kopieren" : "Copy the report text (Markdown) to the clipboard"}>
              <button type="button" onClick={copy} className={btn} style={outline}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? (de ? "Kopiert" : "Copied") : de ? "Kopieren" : "Copy"}
              </button>
            </Tooltip>
            <Tooltip content={de ? "Bericht löschen (mit Rückfrage). Die Beiträge im Protokoll bleiben unberührt." : "Delete the report (asks first). The contributions in the record stay untouched."}>
              <button type="button" onClick={discard} className={`${btn} ml-auto`} style={{ border: "1px solid var(--border)", color: ERROR_COLOR }}>
                <Trash2 size={13} /> {de ? "Verwerfen" : "Discard"}
              </button>
            </Tooltip>
          </div>

          <div className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
            {de ? "Erstellt" : "Created"} {formatStamp(report.createdAt, lang)} · {report.entryCount}{" "}
            {de ? (report.entryCount === 1 ? "Beitrag" : "Beiträge") : report.entryCount === 1 ? "contribution" : "contributions"}
            {report.editedAt && (de ? ` · von Hand bearbeitet ${formatStamp(report.editedAt, lang)}` : ` · edited by hand ${formatStamp(report.editedAt, lang)}`)}
          </div>

          {editing ? (
            <textarea
              value={report.markdown}
              onChange={(e) => updateReportMarkdown(e.target.value)}
              rows={24}
              aria-label={de ? "Ergebnisbericht (Markdown)" : "Results report (Markdown)"}
              spellCheck
              className="w-full rounded-md p-3 text-[13px] leading-relaxed font-mono resize-y"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          ) : (
            <article
              className={`rounded-md p-4 sm:p-6 ${PROSE}`}
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)", opacity: busy ? 0.55 : 1 }}
              // Safe: markdownToHtml escapes all text; only its own tags reach the DOM.
              dangerouslySetInnerHTML={{ __html: markdownToHtml(report.markdown) }}
            />
          )}
        </div>
      )}
    </section>
  );
}
