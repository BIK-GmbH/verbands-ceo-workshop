/**
 * Elegant, branded protocol export — PDF (via the browser print dialog) and
 * Word (.doc). Backend-free: both are built from one HTML template so the
 * formatting stays identical. The .doc is HTML-based with the Office namespace
 * header, which Word/LibreOffice open as an editable document.
 *
 * The same template renders the AI results report (see report.ts) instead of
 * the list of contributions.
 */
import type { Lang } from "@/types/slide";
import { getState, downloadFile, type CaptureEntry } from "./workshop-store";
import { findModule } from "./slides";
import { markdownToHtml } from "./markdown";

const STR = {
  de: {
    sub: "Zweitages-Workshop · Fachverband Betonbohren und -sägen Deutschland e. V.",
    date: "Datum",
    participants: "Teilnehmende",
    count: "Erfasste Beiträge",
    exported: "Erzeugt am",
    module: "Modul",
    appendix: "Anhang",
    none: "Noch keine Eingaben erfasst.",
    open: "— offen",
    host: "Innovationswerkstatt & Digital Management School · Harald Ostermann    ·    BIK GmbH · Dr. Stefan Reinheimer",
    report: "Ergebnisbericht",
    reportCount: "Berücksichtigte Beiträge",
    reportCreated: "Erstellt am",
    reportNote:
      "KI-gestützt aus den im Workshop erfassten Beiträgen verdichtet und redaktionell bearbeitbar. Maßgeblich sind die Beiträge im Workshop-Protokoll.",
  },
  en: {
    sub: "Two-day workshop · Fachverband Betonbohren und -sägen Deutschland e. V.",
    date: "Date",
    participants: "Participants",
    count: "Captured input",
    exported: "Generated",
    module: "Module",
    appendix: "Appendix",
    none: "No input captured yet.",
    open: "— open",
    host: "Innovationswerkstatt & Digital Management School · Harald Ostermann    ·    BIK GmbH · Dr. Stefan Reinheimer",
    report: "Results report",
    reportCount: "Contributions considered",
    reportCreated: "Created",
    reportNote:
      "Condensed with AI support from the contributions captured in the workshop; editable. The workshop record remains authoritative.",
  },
} as const;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function valHtml(v: CaptureEntry["value"]): string {
  const s = Array.isArray(v) ? v.join(", ") : v;
  return esc(s).replace(/\n/g, "<br>");
}

// Word's HTML engine ignores flex/grid — keep the layout to blocks, tables and
// <br>, which also prints cleanly to PDF from any browser.
const CSS = `
@page { size: A4; margin: 20mm 18mm; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Inter','Segoe UI',-apple-system,Roboto,'Helvetica Neue',Arial,sans-serif; color: #181A27; font-size: 11pt; line-height: 1.5; }
.cover { border-bottom: 3px solid #CD184B; padding-bottom: 12px; margin-bottom: 20px; }
h1 { font-size: 21pt; color: #181A27; margin: 0 0 2px; font-weight: 700; }
.sub { color: #5b6473; font-size: 10.5pt; margin-bottom: 10px; }
table.meta { border-collapse: collapse; font-size: 10pt; }
table.meta td { padding: 1px 0; vertical-align: top; }
table.meta td.k { color: #5b6473; padding-right: 16px; white-space: nowrap; }
section.module { margin-bottom: 14px; }
h2.module { font-size: 12.5pt; color: #CD184B; border-bottom: 1px solid #e5e5e3; padding-bottom: 3px; margin: 20px 0 8px; font-weight: 600; }
h2.module .mt { color: #9a9ca6; font-weight: 400; }
.entry { padding: 7px 0; border-bottom: 1px solid #f0f0ee; page-break-inside: avoid; }
.entry .q { font-weight: 600; color: #181A27; margin: 0 0 2px; font-size: 10.5pt; }
.entry .a { margin: 0; white-space: pre-wrap; }
.entry .a.open { color: #9a9ca6; font-style: italic; }
.entry .ref { margin: 3px 0 0; font-size: 8pt; color: #9a9ca6; font-family: ui-monospace,'Consolas',monospace; }
.empty { color: #9a9ca6; }
footer { margin-top: 22px; border-top: 1px solid #e5e5e3; padding-top: 8px; font-size: 8.5pt; color: #9a9ca6; text-align: center; }
.kicker { font-size: 9pt; letter-spacing: 0.12em; text-transform: uppercase; color: #CD184B; font-weight: 700; margin: 0 0 4px; }
.note { font-size: 9pt; color: #5b6473; font-style: italic; margin: 0 0 16px; }
.report h1 { font-size: 16pt; margin: 18px 0 8px; }
.report h2 { font-size: 13pt; color: #CD184B; border-bottom: 1px solid #e5e5e3; padding-bottom: 3px; margin: 20px 0 8px; font-weight: 600; page-break-after: avoid; }
.report h3 { font-size: 11.5pt; color: #181A27; margin: 12px 0 4px; font-weight: 600; page-break-after: avoid; }
.report h4 { font-size: 10.5pt; color: #181A27; margin: 10px 0 3px; font-weight: 600; page-break-after: avoid; }
.report p { margin: 0 0 8px; }
.report ul, .report ol { margin: 0 0 8px; padding-left: 20px; }
.report li { margin: 0 0 3px; }
.report blockquote { margin: 0 0 8px; padding: 2px 10px; border-left: 3px solid #e5e5e3; color: #5b6473; }
.report table { border-collapse: collapse; width: 100%; margin: 0 0 10px; font-size: 10pt; }
.report th, .report td { border: 1px solid #e5e5e3; padding: 4px 6px; text-align: left; vertical-align: top; }
.report th { background: #f5f5f4; font-weight: 600; }
.report hr { border: 0; border-top: 1px solid #e5e5e3; margin: 14px 0; }
.report code { font-family: ui-monospace,'Consolas',monospace; font-size: 9.5pt; }
`;

export function hasValue(e: CaptureEntry): boolean {
  return Array.isArray(e.value) ? e.value.length > 0 : Boolean(typeof e.value === "string" && e.value.trim());
}

/** Ad-hoc questions/tasks added in the live protocol (field id "q-…") are exported even while unanswered. */
export function isAdHoc(e: CaptureEntry): boolean {
  return (e.id.split(":")[1] ?? "").startsWith("q-");
}

const today = () => new Date().toISOString().slice(0, 10);

/** Branded cover: optional kicker, title, sub line and a key/value meta table. */
function coverHtml(lang: Lang, rows: [string, string | number][], kicker?: string): string {
  const { meta } = getState();
  const t = STR[lang];
  let out = `<header class="cover">`;
  if (kicker) out += `<div class="kicker">${esc(kicker)}</div>`;
  out += `<h1>${esc(meta.title)}</h1>`;
  out += `<div class="sub">${t.sub}</div>`;
  out += `<table class="meta"><tbody>`;
  for (const [k, v] of rows) out += `<tr><td class="k">${k}</td><td>${esc(String(v))}</td></tr>`;
  out += `</tbody></table></header>`;
  return out;
}

const footerHtml = (lang: Lang) => `<footer>${STR[lang].host}</footer>`;

function bodyHtml(lang: Lang): string {
  const { meta, entries } = getState();
  const t = STR[lang];
  const list = Object.values(entries)
    .filter((e) => hasValue(e) || isAdHoc(e))
    .sort((a, b) => a.id.localeCompare(b.id));

  let out = coverHtml(lang, [
    [t.date, meta.date || "—"],
    [t.participants, meta.participants || "—"],
    [t.count, list.length],
    [t.exported, today()],
  ]);

  if (list.length === 0) {
    out += `<p class="empty">${t.none}</p>`;
  } else {
    let mod = -1;
    for (const e of list) {
      if (e.module !== mod) {
        if (mod !== -1) out += `</section>`;
        mod = e.module;
        const m = findModule(mod);
        const label = mod === 99 ? t.appendix : `${t.module} ${mod}`;
        const mt = m ? ` · ${esc(m.title[lang])}` : "";
        out += `<section class="module"><h2 class="module">${label}<span class="mt">${mt}</span></h2>`;
      }
      const answer = hasValue(e) ? `<p class="a">${valHtml(e.value)}</p>` : `<p class="a open">${t.open}</p>`;
      out += `<div class="entry"><p class="q">${esc(e.prompt)}</p>${answer}<p class="ref">${esc(e.slideId)} · ${esc(e.kind)}</p></div>`;
    }
    out += `</section>`;
  }
  out += footerHtml(lang);
  return out;
}

function documentHtml(lang: Lang, forWord: boolean, title: string, body: string): string {
  const htmlOpen = forWord
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`
    : `<html lang="${lang}">`;
  const office = forWord
    ? `<meta name="ProgId" content="Word.Document"><meta name="Originator" content="Microsoft Word">`
    : "";
  return `<!DOCTYPE html>${htmlOpen}<head><meta charset="utf-8">${office}<title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function wrap(lang: Lang, forWord: boolean): string {
  return documentHtml(lang, forWord, getState().meta.title, bodyHtml(lang));
}

/** Renders `html` into a hidden iframe and opens the browser print dialog ("Save as PDF"). */
function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = () => setTimeout(() => iframe.remove(), 300);
  setTimeout(() => {
    win.focus();
    win.print();
  }, 350);
  // Fallback removal in case onafterprint never fires (e.g. dialog dismissed).
  setTimeout(() => {
    if (document.body.contains(iframe)) iframe.remove();
  }, 60000);
}

/** Download the protocol as an editable Word document (.doc). */
export function downloadProtocolWord(lang: Lang) {
  downloadFile(`workshop-protokoll-${today()}.doc`, wrap(lang, true), "application/msword");
}

/** Open the print dialog with the branded protocol so the user can "Save as PDF". */
export function printProtocolPdf(lang: Lang) {
  printHtml(wrap(lang, false));
}

/** Provenance shown in the report header; defaults to "now" / unknown count. */
export interface ReportInfo {
  /** ISO timestamp of the generation run */
  createdAt?: string;
  /** Number of contributions the report was generated from */
  entryCount?: number;
}

function reportHtml(lang: Lang, forWord: boolean, markdown: string, info: ReportInfo): string {
  const { meta } = getState();
  const t = STR[lang];
  const rows: [string, string | number][] = [
    [t.date, meta.date || "—"],
    [t.participants, meta.participants || "—"],
  ];
  if (info.entryCount !== undefined) rows.push([t.reportCount, info.entryCount]);
  rows.push([t.reportCreated, (info.createdAt ?? new Date().toISOString()).slice(0, 10)]);
  const body =
    coverHtml(lang, rows, t.report) +
    `<p class="note">${t.reportNote}</p>` +
    `<div class="report">${markdownToHtml(markdown)}</div>` +
    footerHtml(lang);
  return documentHtml(lang, forWord, `${t.report} · ${meta.title}`, body);
}

/** Download the AI results report as an editable Word document (.doc). */
export function downloadReportWord(lang: Lang, markdown: string, info: ReportInfo = {}) {
  downloadFile(`workshop-ergebnisbericht-${today()}.doc`, reportHtml(lang, true, markdown, info), "application/msword");
}

/** Open the print dialog with the branded results report so the user can "Save as PDF". */
export function printReportPdf(lang: Lang, markdown: string, info: ReportInfo = {}) {
  printHtml(reportHtml(lang, false, markdown, info));
}

/** Download the results report as Markdown, with a title line and provenance. */
export function downloadReportMarkdown(lang: Lang, markdown: string, info: ReportInfo = {}) {
  const { meta } = getState();
  const t = STR[lang];
  const head = [
    `# ${t.report} – ${meta.title}`,
    "",
    `- **${t.date}:** ${meta.date || "—"}`,
    ...(info.entryCount !== undefined ? [`- **${t.reportCount}:** ${info.entryCount}`] : []),
    `- **${t.reportCreated}:** ${(info.createdAt ?? new Date().toISOString()).slice(0, 10)}`,
    "",
    `_${t.reportNote}_`,
    "",
  ];
  downloadFile(`workshop-ergebnisbericht-${today()}.md`, `${head.join("\n")}\n${markdown.trim()}\n`, "text/markdown");
}
