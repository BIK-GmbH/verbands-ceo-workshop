/**
 * Protocol & results-report exports, backend-free:
 * - PDF: a designed HTML document (cover, linked contents, one page per chapter,
 *   glossary) printed via the browser dialog ("Save as PDF") — export-html.ts.
 * - Word: a real .docx (TOC field, bookmarks, header/footer, images, glossary)
 *   built with the `docx` library, loaded only when needed — export-docx.ts.
 * Both render the same model from export-model.ts.
 */
import type { Lang } from "@/types/slide";
import { getState, downloadFile } from "./workshop-store";
import { buildProtocolModel, buildReportModel, labelsFor, type ExportDoc, type ReportInfo } from "./export-model";
import { printHtml, renderHtml } from "./export-html";

export { hasValue, isAdHoc, type ReportInfo } from "./export-model";

const today = () => new Date().toISOString().slice(0, 10);

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke later: some browsers read the blob asynchronously after click().
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function saveDocx(doc: ExportDoc): Promise<void> {
  try {
    const { renderDocx } = await import("./export-docx");
    downloadBlob(`${doc.fileBase}.docx`, await renderDocx(doc));
  } catch (err) {
    console.error(`Word export failed (${doc.kind})`, err);
    window.alert(doc.labels.wordError);
  }
}

async function printDoc(doc: ExportDoc): Promise<void> {
  try {
    await printHtml(renderHtml(doc));
  } catch (err) {
    console.error(`PDF export failed (${doc.kind})`, err);
    window.alert(doc.labels.pdfError);
  }
}

/** Download the protocol as a Word document (.docx). */
export function downloadProtocolWord(lang: Lang): Promise<void> {
  return saveDocx(buildProtocolModel(lang));
}

/** Open the print dialog with the designed protocol so the user can "Save as PDF". */
export function printProtocolPdf(lang: Lang): Promise<void> {
  return printDoc(buildProtocolModel(lang));
}

/** Download the AI results report as a Word document (.docx). */
export function downloadReportWord(lang: Lang, markdown: string, info: ReportInfo = {}): Promise<void> {
  return saveDocx(buildReportModel(lang, markdown, info));
}

/** Open the print dialog with the designed results report so the user can "Save as PDF". */
export function printReportPdf(lang: Lang, markdown: string, info: ReportInfo = {}): Promise<void> {
  return printDoc(buildReportModel(lang, markdown, info));
}

/** Download the results report as Markdown, with a title line and provenance. */
export function downloadReportMarkdown(lang: Lang, markdown: string, info: ReportInfo = {}) {
  const { meta } = getState();
  const t = labelsFor(lang);
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
