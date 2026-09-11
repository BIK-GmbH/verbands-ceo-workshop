/**
 * Elegant, branded protocol export — PDF (via the browser print dialog) and
 * Word (.doc). Backend-free: both are built from one HTML template so the
 * formatting stays identical. The .doc is HTML-based with the Office namespace
 * header, which Word/LibreOffice open as an editable document.
 */
import type { Lang } from "@/types/slide";
import { getState, downloadFile, type CaptureEntry } from "./workshop-store";
import { findModule } from "./slides";

const STR = {
  de: {
    sub: "KI – Fiktion oder Realität · „Der KI-augmentierte Verbands-CEO“",
    date: "Datum",
    participants: "Teilnehmende",
    count: "Erfasste Beiträge",
    exported: "Erzeugt am",
    module: "Modul",
    appendix: "Anhang",
    none: "Noch keine Eingaben erfasst.",
    host: "Innovationswerkstatt · Harald Ostermann    ·    BIK GmbH · Dr. Stefan Reinheimer",
  },
  en: {
    sub: "AI – Fiction or Reality · “The AI-Augmented Association CEO”",
    date: "Date",
    participants: "Participants",
    count: "Captured input",
    exported: "Generated",
    module: "Module",
    appendix: "Appendix",
    none: "No input captured yet.",
    host: "Innovationswerkstatt · Harald Ostermann    ·    BIK GmbH · Dr. Stefan Reinheimer",
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
.cover { border-bottom: 3px solid #38B6AB; padding-bottom: 12px; margin-bottom: 20px; }
h1 { font-size: 21pt; color: #13357A; margin: 0 0 2px; font-weight: 700; }
.sub { color: #5b6473; font-size: 10.5pt; margin-bottom: 10px; }
table.meta { border-collapse: collapse; font-size: 10pt; }
table.meta td { padding: 1px 0; vertical-align: top; }
table.meta td.k { color: #5b6473; padding-right: 16px; white-space: nowrap; }
section.module { margin-bottom: 14px; }
h2.module { font-size: 12.5pt; color: #38B6AB; border-bottom: 1px solid #e3e7ee; padding-bottom: 3px; margin: 20px 0 8px; font-weight: 600; }
h2.module .mt { color: #9aa3b2; font-weight: 400; }
.entry { padding: 7px 0; border-bottom: 1px solid #f0f2f6; page-break-inside: avoid; }
.entry .q { font-weight: 600; color: #13357A; margin: 0 0 2px; font-size: 10.5pt; }
.entry .a { margin: 0; white-space: pre-wrap; }
.entry .ref { margin: 3px 0 0; font-size: 8pt; color: #9aa3b2; font-family: ui-monospace,'Consolas',monospace; }
.empty { color: #9aa3b2; }
footer { margin-top: 22px; border-top: 1px solid #e3e7ee; padding-top: 8px; font-size: 8.5pt; color: #9aa3b2; text-align: center; }
`;

function bodyHtml(lang: Lang): string {
  const { meta, entries } = getState();
  const t = STR[lang];
  const list = Object.values(entries)
    .filter((e) =>
      Array.isArray(e.value) ? e.value.length > 0 : Boolean(typeof e.value === "string" && e.value.trim()),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const now = new Date().toISOString().slice(0, 10);

  let out = "";
  out += `<header class="cover">`;
  out += `<h1>${esc(meta.title)}</h1>`;
  out += `<div class="sub">${t.sub}</div>`;
  out += `<table class="meta"><tbody>`;
  out += `<tr><td class="k">${t.date}</td><td>${esc(meta.date || "—")}</td></tr>`;
  out += `<tr><td class="k">${t.participants}</td><td>${esc(meta.participants || "—")}</td></tr>`;
  out += `<tr><td class="k">${t.count}</td><td>${list.length}</td></tr>`;
  out += `<tr><td class="k">${t.exported}</td><td>${now}</td></tr>`;
  out += `</tbody></table></header>`;

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
      out += `<div class="entry"><p class="q">${esc(e.prompt)}</p><p class="a">${valHtml(e.value)}</p><p class="ref">${esc(e.slideId)} · ${esc(e.kind)}</p></div>`;
    }
    out += `</section>`;
  }
  out += `<footer>${t.host}</footer>`;
  return out;
}

function wrap(lang: Lang, forWord: boolean): string {
  const { meta } = getState();
  const htmlOpen = forWord
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`
    : `<html lang="${lang}">`;
  const office = forWord
    ? `<meta name="ProgId" content="Word.Document"><meta name="Originator" content="Microsoft Word">`
    : "";
  return `<!DOCTYPE html>${htmlOpen}<head><meta charset="utf-8">${office}<title>${esc(meta.title)}</title><style>${CSS}</style></head><body>${bodyHtml(lang)}</body></html>`;
}

/** Download the protocol as an editable Word document (.doc). */
export function downloadProtocolWord(lang: Lang) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`workshop-protokoll-${stamp}.doc`, wrap(lang, true), "application/msword");
}

/** Open the print dialog with the branded protocol so the user can "Save as PDF". */
export function printProtocolPdf(lang: Lang) {
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
  win.document.write(wrap(lang, false));
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
