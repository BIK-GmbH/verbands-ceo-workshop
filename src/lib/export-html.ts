/**
 * PDF renderer: turns an ExportDoc into a print-ready HTML document (A4, cover,
 * linked table of contents, one page per chapter, running header/footer via
 * @page margin boxes) and hands it to the browser's print dialog.
 */
import { BRAND, assetUrl, type Block, type ExportChapter, type ExportDoc, type Inline } from "./export-model";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Quoted CSS string for `content:` in @page margin boxes. */
function cssStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/</g, "\\3C ")}"`;
}

const pad = (n: number) => String(n).padStart(2, "0");

function runs(list: Inline[]): string {
  return list
    .map((r) => {
      let html = esc(r.text).replace(/\n/g, "<br>");
      if (r.italic) html = `<em>${html}</em>`;
      if (r.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

function img(path: string, cls: string, alt = ""): string {
  return `<img class="${cls}" src="${esc(assetUrl(path))}" alt="${esc(alt)}">`;
}

function listHtml(b: Extract<Block, { type: "list" }>): string {
  const tag = b.ordered ? "ol" : "ul";
  let out = "";
  let depth = -1;
  for (const item of b.items) {
    if (item.level > depth) {
      // Deeper level: open nested list(s) inside the still-open <li>.
      while (depth < item.level) {
        out += `<${tag}>`;
        depth++;
      }
    } else {
      out += "</li>";
      while (depth > item.level) {
        out += `</${tag}></li>`;
        depth--;
      }
    }
    out += `<li>${runs(item.runs)}`;
  }
  out += "</li>";
  while (depth-- > 0) out += `</${tag}></li>`;
  return `${out}</${tag}>`;
}

function blockHtml(b: Block, doc: ExportDoc): string {
  const L = doc.labels;
  switch (b.type) {
    case "p":
      return `<p${b.tone === "note" ? ' class="note"' : ""}>${runs(b.runs)}</p>`;
    case "sub":
      return `<h3>${runs(b.runs)}</h3>`;
    case "list":
      return listHtml(b);
    case "quote":
      return `<blockquote>${runs(b.runs)}</blockquote>`;
    case "rule":
      return "<hr>";
    case "table":
      return `<table class="grid"><thead><tr>${b.head.map((c) => `<th>${runs(c)}</th>`).join("")}</tr></thead><tbody>${b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${runs(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    case "facts":
      return `<table class="facts"><tbody>${b.rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table>`;
    case "people":
      return `<table class="grid people"><thead><tr>${b.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${b.rows
        .map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="strong"' : ""}>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    case "glossary":
      return `<table class="grid gl"><thead><tr><th>${esc(L.glossaryCols[0])}</th><th>${esc(L.glossaryCols[1])}</th></tr></thead><tbody>${b.terms
        .map(
          (t) =>
            `<tr${t.unapproved ? ' class="unapproved"' : ""}><td class="term">${esc(t.term)}${
              t.unapproved ? `<span class="badge open">(${esc(L.unapproved)})</span>` : ""
            }</td><td>${esc(t.definition) || "—"}</td></tr>`,
        )
        .join("")}</tbody></table>`;
    case "entry": {
      const badges =
        (b.open ? `<span class="badge open">${esc(L.open)}</span>` : "") + (b.polished ? `<span class="badge ai">${esc(L.polished)}</span>` : "");
      let answer: string;
      if (b.open) answer = `<p>${esc(L.openAnswer)}</p>`;
      else if (b.barometer) {
        const max = Math.max(1, ...b.barometer.rows.map((r) => r.count));
        answer =
          `<div class="baro">${b.barometer.rows
            .map(
              (r) =>
                `<div class="row"><span class="opt">${esc(r.option)}</span><span class="bar"><i style="width:${Math.round((r.count / max) * 100)}%"></i></span><span class="n">${r.count}</span></div>`,
            )
            .join("")}` + `<div class="total">${esc(L.votes(b.barometer.total))}</div></div>`;
      } else answer = b.body.map((x) => blockHtml(x, doc)).join("");
      const cls = ["entry", b.open ? "open" : "", b.highlight ? "hl" : ""].filter(Boolean).join(" ");
      return `<div class="${cls}"><div class="q">${esc(b.question)}${badges}</div><div class="a">${answer}</div></div>`;
    }
  }
}

function coverHtml(doc: ExportDoc): string {
  const L = doc.labels;
  const hosts = L.hosts.map((h) => `<dd><strong>${esc(h.name)}</strong><br><span>${esc(h.org)}</span></dd>`).join("");
  return `<section class="cover">
  <div class="band"></div>
  <div class="inner">
    <div class="top">${img(BRAND.fbs, "fbs", "FBS")}<div class="kind">${esc(L.coverEyebrow)}<br>${esc(doc.docType)}</div></div>
    <div class="eyebrow">${esc(doc.docType)}</div>
    <h1>${esc(doc.title)}</h1>
    <div class="org">${esc(L.organisation)}</div>
    <div class="rule"></div>
    <div class="mid">
      <dl>
        <dt>${esc(L.datesLabel)}</dt><dd><strong>${esc(L.dates)}</strong></dd>
        <dt>${esc(L.organisationLabel)}</dt><dd>${esc(L.organisation)}</dd>
        <dt>${esc(L.moderationLabel)}</dt>${hosts}
      </dl>
      ${img(BRAND.keyVisual, "kv", "Zukunft auf festem Grund")}
    </div>
    <div class="logos"><span>${esc(L.partnersLabel)}</span>${img(BRAND.innovationswerkstatt, "iw", "Innovationswerkstatt")}${img(BRAND.dms, "dms", "Digital Management School")}${img(BRAND.bik, "bik", "BIK GmbH")}</div>
  </div>
</section>`;
}

function tocHtml(doc: ExportDoc): string {
  const L = doc.labels;
  const items = doc.chapters
    .map((c) => {
      const secs = c.sections.length
        ? `<ol class="secs">${c.sections.map((s) => `<li><a href="#${s.anchor}">${esc(s.title)}</a></li>`).join("")}</ol>`
        : "";
      const note = c.tocNote ?? c.eyebrow ?? "";
      return `<li class="ch"><a href="#${c.anchor}"><span class="num">${pad(c.number)}</span><span class="t">${esc(c.title)}</span><span class="m">${esc(note)}</span></a>${secs}</li>`;
    })
    .join("");
  return `<nav class="toc"><div class="eyebrow">${esc(L.tocEyebrow)}</div><h1>${esc(L.tocTitle)}</h1><ol>${items}</ol></nav>`;
}

function chapterHtml(c: ExportChapter, doc: ExportDoc): string {
  const L = doc.labels;
  const q = c.question ? `<div class="kq"><b>${esc(c.question.label)}</b><p>${esc(c.question.text)}</p></div>` : "";
  const eyebrow = `${L.chapter} ${pad(c.number)}${c.eyebrow ? ` · ${c.eyebrow}` : ""}`;
  const head = `<header class="ch-head"><div class="ch-text"><div class="ch-num">${pad(c.number)}</div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(c.title)}</h1>${q}</div>${
    c.image ? img(c.image, "ch-img") : ""
  }</header>`;
  const intro = c.blocks.map((b) => blockHtml(b, doc)).join("");
  const secs = c.sections
    .map(
      (s) =>
        `<section class="sec" id="${s.anchor}"><h2><span>${esc(s.title)}</span>${
          s.ref ? `<span class="ref">${esc(L.slide)} ${esc(s.ref)}</span>` : ""
        }</h2>${s.blocks.map((b) => blockHtml(b, doc)).join("")}</section>`,
    )
    .join("");
  return `<section class="chapter${doc.kind === "report" ? " report" : ""}" id="${c.anchor}">${head}${intro}${secs}</section>`;
}

function css(doc: ExportDoc): string {
  const L = doc.labels;
  const font = "Inter,'Segoe UI',-apple-system,Roboto,'Helvetica Neue',Arial,sans-serif";
  const box = `font-family:${font};font-size:7.5pt;color:#5a5e6b;`;
  return `
@page { size: A4; margin: 24mm 18mm 20mm 18mm;
  @top-left { content: ${cssStr(doc.shortTitle)}; ${box} vertical-align: bottom; padding-bottom: 5mm; }
  @top-right { content: ${cssStr(L.headerRight)}; ${box} vertical-align: bottom; padding-bottom: 5mm; }
  @bottom-left { content: ${cssStr(L.footer)}; ${box} vertical-align: top; padding-top: 5mm; }
  @bottom-right { content: ${cssStr(`${L.page} `)} counter(page) ${cssStr(` ${L.of} `)} counter(pages); ${box} color: #181A27; font-weight: 600; vertical-align: top; padding-top: 5mm; }
}
@page :first { margin: 0;
  @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; }
}
:root { --red:#CD184B; --ink:#181A27; --muted:#5a5e6b; --line:#e3e4e8; --soft:#f5f5f7; --rose:#fbeef2; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: ${font}; color: var(--ink); font-size: 10.5pt; line-height: 1.55; }
a { color: inherit; text-decoration: none; }
.eyebrow { font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase; color: var(--red); font-weight: 700; }

/* cover */
.cover { position: relative; width: 210mm; height: 297mm; overflow: hidden; break-after: page; }
.cover .band { position: absolute; left: 0; top: 0; bottom: 0; width: 7mm; background: var(--red); }
.cover .inner { position: absolute; top: 0; right: 0; bottom: 0; left: 7mm; padding: 18mm 18mm 16mm 19mm; display: flex; flex-direction: column; }
.cover .top { display: flex; justify-content: space-between; align-items: flex-start; }
.cover .fbs { width: 34mm; height: auto; }
.cover .kind { text-align: right; font-size: 7.5pt; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); line-height: 1.7; }
.cover .eyebrow { margin-top: 14mm; font-size: 9pt; }
.cover h1 { font-size: 33pt; line-height: 1.08; margin: 3mm 0 0; font-weight: 800; letter-spacing: -.015em; max-width: 160mm; }
.cover .org { margin-top: 4mm; font-size: 12pt; color: var(--muted); font-weight: 400; }
.cover .rule { width: 26mm; height: 1.5mm; background: var(--red); margin-top: 7mm; }
.cover .mid { display: flex; gap: 10mm; margin-top: 10mm; align-items: flex-end; }
.cover dl { flex: 1; margin: 0; }
.cover dt { font-size: 7pt; letter-spacing: .16em; text-transform: uppercase; color: var(--red); font-weight: 700; margin-top: 5mm; }
.cover dt:first-child { margin-top: 0; }
.cover dd { margin: 1mm 0 0; font-size: 10pt; line-height: 1.4; }
.cover dd span { color: var(--muted); font-size: 9pt; }
.cover .kv { width: 86mm; height: auto; border-radius: 3mm; display: block; flex: none; }
.cover .logos { margin-top: auto; border-top: .3mm solid var(--line); padding-top: 6mm; display: flex; align-items: center; gap: 9mm; }
.cover .logos span { font-size: 7pt; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); flex: 1; }
.cover .logos .iw { height: 8.5mm; } .cover .logos .dms { height: 14mm; } .cover .logos .bik { height: 14mm; }

/* table of contents */
.toc { break-after: page; }
.toc h1 { font-size: 24pt; margin: 2mm 0 8mm; font-weight: 800; letter-spacing: -.01em; }
.toc ol { list-style: none; margin: 0; padding: 0; }
.toc .ch { break-inside: avoid; border-bottom: .3mm solid var(--line); padding: 2.4mm 0; }
.toc .ch > a { display: flex; align-items: baseline; gap: 4mm; font-weight: 700; font-size: 11.5pt; }
.toc .num { color: var(--red); font-weight: 800; width: 9mm; flex: none; font-variant-numeric: tabular-nums; }
.toc .t { flex: 1; }
.toc .m { color: var(--muted); font-size: 8.5pt; font-weight: 400; }
.toc .secs { margin-top: 1mm; }
.toc .secs a { display: block; padding: .5mm 0 .5mm 13mm; color: var(--muted); font-size: 9.5pt; }

/* chapters */
.chapter { break-before: page; }
.ch-head { display: flex; gap: 8mm; align-items: flex-start; padding-bottom: 6mm; border-bottom: .6mm solid var(--red); margin-bottom: 7mm; }
.ch-text { flex: 1; }
.ch-num { font-size: 38pt; font-weight: 800; color: var(--red); line-height: 1; letter-spacing: -.02em; margin-bottom: 2mm; }
.ch-head h1 { font-size: 20pt; line-height: 1.18; margin: 1.5mm 0 0; font-weight: 800; }
.kq { margin-top: 5mm; padding: 3mm 4mm; background: var(--soft); border-radius: 2mm; }
.kq b { display: block; font-size: 6.8pt; letter-spacing: .16em; text-transform: uppercase; color: var(--red); }
.kq p { margin: 1mm 0 0; font-style: italic; font-size: 10.5pt; }
.ch-img { width: 44mm; height: 44mm; object-fit: cover; border-radius: 3mm; flex: none; }
.sec { margin-top: 7mm; }
h2 { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; font-size: 13pt; line-height: 1.3; margin: 0 0 2.5mm; padding-left: 3mm; border-left: 1.2mm solid var(--red); break-after: avoid; }
h2 .ref { font-size: 7.5pt; color: var(--muted); font-weight: 400; white-space: nowrap; }
h3 { font-size: 11pt; margin: 5mm 0 1.5mm; break-after: avoid; }
p { margin: 0 0 2mm; }
p.note { color: var(--muted); font-size: 9.5pt; border-left: 1mm solid var(--line); padding-left: 3mm; margin-bottom: 5mm; }
ul, ol { margin: 0 0 2mm; padding-left: 5.5mm; }
li { margin: 0 0 1mm; }
li::marker { color: var(--red); font-weight: 700; }
blockquote { margin: 0 0 2mm; padding: 1mm 4mm; border-left: 1mm solid var(--line); color: var(--muted); font-style: italic; }
hr { border: 0; border-top: .3mm solid var(--line); margin: 5mm 0; }

/* entries */
.entry { padding: 2.6mm 0 2mm; border-bottom: .3mm solid var(--line); break-inside: avoid; }
.entry:last-child { border-bottom: 0; }
.entry .q { font-weight: 700; margin-bottom: 1.2mm; }
.entry .a > :last-child { margin-bottom: 0; }
.entry.open .a { color: var(--muted); font-style: italic; }
.entry.hl .a { background: var(--rose); border-left: 1mm solid var(--red); padding: 2mm 3.5mm; border-radius: 0 1.5mm 1.5mm 0; font-weight: 600; }
.badge { display: inline-block; font-size: 6.3pt; letter-spacing: .1em; text-transform: uppercase; padding: .5mm 1.6mm; border-radius: 1mm; vertical-align: .3mm; margin-left: 2mm; font-weight: 700; font-style: normal; }
.badge.ai { background: #eceef2; color: var(--muted); }
.badge.open { background: var(--rose); color: var(--red); }
.baro { font-weight: 400; }
.baro .row { display: flex; align-items: center; gap: 3mm; margin: .8mm 0; }
.baro .opt { width: 38mm; flex: none; }
.baro .bar { flex: 1; height: 3.2mm; background: #fff; border-radius: 2mm; overflow: hidden; }
.baro .bar i { display: block; height: 100%; background: var(--red); border-radius: 2mm; }
.baro .n { width: 8mm; text-align: right; font-weight: 800; }
.baro .total { margin-top: 1.5mm; font-size: 8.5pt; color: var(--muted); }

/* tables */
table { border-collapse: collapse; width: 100%; margin: 0 0 4mm; }
table.grid { font-size: 9.5pt; }
table.grid th { text-align: left; font-size: 7pt; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); border-bottom: .5mm solid var(--ink); padding: 1.5mm 2mm; }
table.grid td { border-bottom: .3mm solid var(--line); padding: 1.8mm 2mm; vertical-align: top; }
table.grid tr { break-inside: avoid; }
td.strong, td.term { font-weight: 700; }
table.gl td.term { width: 52mm; }
table.gl tr.unapproved td { background: #fdf3f6; }
table.gl .badge { margin-left: 0; margin-top: 1mm; display: table; text-transform: none; letter-spacing: .02em; font-size: 7.5pt; }
table.facts td { padding: 2mm 0; border-bottom: .3mm solid var(--line); }
table.facts td.k { color: var(--muted); width: 55mm; font-size: 9pt; letter-spacing: .02em; }
table.facts td + td { font-weight: 600; }
`;
}

export function renderHtml(doc: ExportDoc): string {
  const body = coverHtml(doc) + tocHtml(doc) + doc.chapters.map((c) => chapterHtml(c, doc)).join("");
  return `<!DOCTYPE html><html lang="${doc.lang}"><head><meta charset="utf-8"><title>${esc(`${doc.docType} · ${doc.title}`)}</title><style>${css(
    doc,
  )}</style></head><body>${body}</body></html>`;
}

/** Resolves once every image in the document has loaded (or failed), capped by a timeout. */
function imagesReady(d: Document, timeoutMs = 10000): Promise<void> {
  const all = Promise.all(Array.from(d.images).map((i) => i.decode().catch(() => undefined))).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([all, timeout]);
}

/** Renders `html` into a hidden iframe, waits for all images and opens the print dialog ("Save as PDF"). */
export async function printHtml(html: string): Promise<void> {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    throw new Error("Print iframe has no window");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  await imagesReady(win.document);
  await win.document.fonts?.ready;
  win.onafterprint = () => setTimeout(() => iframe.remove(), 300);
  win.focus();
  win.print();
  // Fallback removal in case onafterprint never fires (e.g. dialog dismissed).
  setTimeout(() => {
    if (document.body.contains(iframe)) iframe.remove();
  }, 60000);
}
