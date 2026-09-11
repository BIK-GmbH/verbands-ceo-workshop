/**
 * Word renderer: turns an ExportDoc into a real .docx with the `docx` library.
 * Loaded on demand (dynamic import) so the library stays out of the main bundle.
 *
 * Images come from public/brand at runtime and are re-encoded via canvas to
 * PNG/JPEG, because Word does not reliably show WebP or SVG. A failing image is
 * skipped; the document is still produced.
 */
import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IBorderOptions,
  type ITableBordersOptions,
} from "docx";
import { BRAND, assetUrl, type Block, type ExportChapter, type ExportDoc, type Inline } from "./export-model";

type RunOptions = Exclude<ConstructorParameters<typeof TextRun>[0], string>;
type Child = Paragraph | Table;

const FONT = "Calibri";
const C = { red: "CD184B", ink: "181A27", muted: "5A5E6B", line: "D9DBE1", soft: "F4F5F7", rose: "FBEEF2", roseRow: "FDF3F6" };
const PAGE = { width: 11906, height: 16838 };
const MARGIN_X = 1247;
const CONTENT_W = PAGE.width - 2 * MARGIN_X;
const mmToPx = (mm: number) => Math.round(mm * 3.7795);
const pad = (n: number) => String(n).padStart(2, "0");
/** Word bookmark names: letters, digits and underscores only. */
const bm = (anchor: string) => anchor.replace(/[^A-Za-z0-9_]/g, "_");
/**
 * Separate bookmarks for the pre-filled TOC entries: Word converts every bookmark a TOC
 * hyperlink points to into its own "_Toc…" bookmark on open, so the chapter overview
 * links need bookmarks (`bm`) that the TOC never references.
 */
const tocBm = (anchor: string) => `toc_${bm(anchor)}`;

/* ------------------------------------------------------------------ images */

interface Raster {
  data: Uint8Array;
  width: number;
  height: number;
  type: "png" | "jpg";
}

async function rasterize(path: string, maxPx: number): Promise<Raster | null> {
  const type = path.endsWith(".webp") ? "jpg" : "png";
  try {
    const res = await fetch(assetUrl(path));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w0 = img.naturalWidth || maxPx;
      const h0 = img.naturalHeight || maxPx;
      // Vector logos are drawn at the target size; bitmaps are only ever scaled down.
      const scale = path.endsWith(".svg") ? maxPx / Math.max(w0, h0) : Math.min(1, maxPx / Math.max(w0, h0));
      const width = Math.max(1, Math.round(w0 * scale));
      const height = Math.max(1, Math.round(h0 * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d canvas context");
      if (type === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type === "jpg" ? "image/jpeg" : "image/png", 0.9));
      if (!blob) throw new Error("canvas encoding failed");
      return { data: new Uint8Array(await blob.arrayBuffer()), width, height, type };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.warn(`Word export: image "${path}" skipped`, err);
    return null;
  }
}

async function loadImages(doc: ExportDoc): Promise<Map<string, Raster | null>> {
  const wanted: [string, number][] = [
    [BRAND.fbs, 400],
    [BRAND.keyVisual, 900],
    [BRAND.innovationswerkstatt, 900],
    [BRAND.dms, 300],
    [BRAND.bik, 300],
    ...[...new Set(doc.chapters.flatMap((c) => (c.image ? [c.image] : [])))].map((p): [string, number] => [p, 520]),
  ];
  const loaded = await Promise.all(wanted.map(async ([p, max]) => [p, await rasterize(p, max)] as const));
  return new Map(loaded);
}

/** Image run fitted to a width or height in millimetres, keeping the aspect ratio. */
function imageRun(r: Raster, box: { w: number } | { h: number }, alt: string): ImageRun {
  const ratio = r.height / r.width;
  const width = "w" in box ? mmToPx(box.w) : Math.round(mmToPx(box.h) / ratio);
  const height = "w" in box ? Math.round(mmToPx(box.w) * ratio) : mmToPx(box.h);
  return new ImageRun({ type: r.type, data: r.data, transformation: { width, height }, altText: { name: alt, description: alt, title: alt } });
}

/* ---------------------------------------------------------------- helpers */

function textRuns(list: Inline[], base: RunOptions = {}): TextRun[] {
  const out: TextRun[] = [];
  for (const r of list) {
    r.text.split("\n").forEach((part, i) => {
      out.push(new TextRun({ ...base, text: part, bold: r.bold || base.bold, italics: r.italic || base.italics, break: i > 0 ? 1 : undefined }));
    });
  }
  return out;
}

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const NO_BORDERS: ITableBordersOptions = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const GRID_BORDERS: ITableBordersOptions = { top: NONE, bottom: LINE, left: NONE, right: NONE, insideHorizontal: LINE, insideVertical: NONE };

function table(widths: number[], rows: TableRow[], borders: ITableBordersOptions = GRID_BORDERS): Table {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows,
  });
}

interface CellOpts {
  fill?: string;
  header?: boolean;
  valign?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable];
  leftAccent?: boolean;
  tight?: boolean;
}

function cell(children: Child[], width: number, opts: CellOpts = {}): TableCell {
  const borders = opts.header
    ? { bottom: { style: BorderStyle.SINGLE, size: 10, color: C.ink } }
    : opts.leftAccent
      ? { left: { style: BorderStyle.SINGLE, size: 24, color: C.red } }
      : undefined;
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    margins: opts.tight ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 90, bottom: 90, left: 110, right: 110 },
    verticalAlign: opts.valign,
    borders,
  });
}

const para = (children: (TextRun | ImageRun | InternalHyperlink | Bookmark)[], opts: Omit<ConstructorParameters<typeof Paragraph>[0] & object, "children"> = {}) =>
  new Paragraph({ ...opts, children });

function headerRow(cols: string[], widths: number[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) =>
      cell([para([new TextRun({ text: c.toUpperCase(), bold: true, size: 14, color: C.muted, characterSpacing: 20 })], { spacing: { after: 0 } })], widths[i], {
        header: true,
      }),
    ),
  });
}

const spacer = (twips: number) => para([], { spacing: { before: 0, after: twips } });

const eyebrow = (text: string, extra: RunOptions = {}) =>
  new TextRun({ text: text.toUpperCase(), bold: true, size: 15, color: C.red, characterSpacing: 24, ...extra });

/* ----------------------------------------------------------------- blocks */

class BlockRenderer {
  private listInstance = 0;

  constructor(
    private readonly doc: ExportDoc,
  ) {}

  blocks(list: Block[], width = CONTENT_W): Child[] {
    return list.flatMap((b) => this.block(b, width));
  }

  private block(b: Block, width: number): Child[] {
    const L = this.doc.labels;
    switch (b.type) {
      case "p":
        return [
          b.tone === "note"
            ? para(textRuns(b.runs, { color: C.muted, italics: true, size: 19 }), {
                border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.line, space: 8 } },
                indent: { left: 170 },
                spacing: { after: 240 },
              })
            : para(textRuns(b.runs), { spacing: { after: 120 } }),
        ];
      case "sub":
        return [para(textRuns(b.runs), { heading: HeadingLevel.HEADING_3 })];
      case "list": {
        const instance = b.ordered ? ++this.listInstance : 0;
        return b.items.map((it) =>
          para(textRuns(it.runs), {
            numbering: { reference: b.ordered ? "numbers" : "bullets", level: Math.min(it.level, 2), instance },
            spacing: { after: 60 },
          }),
        );
      }
      case "quote":
        return [
          para(textRuns(b.runs, { italics: true, color: C.muted }), {
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.line, space: 8 } },
            indent: { left: 170 },
          }),
        ];
      case "rule":
        return [para([], { border: { bottom: LINE }, spacing: { after: 200 } })];
      case "table": {
        const n = Math.max(1, b.head.length);
        const widths = Array.from({ length: n }, () => Math.floor(width / n));
        return [
          table(widths, [
            headerRow(b.head.map((c) => c.map((r) => r.text).join("")), widths),
            ...b.rows.map(
              (r) => new TableRow({ children: widths.map((w, i) => cell([para(textRuns(r[i] ?? []), { spacing: { after: 0 } })], w)) }),
            ),
          ]),
          spacer(160),
        ];
      }
      case "facts": {
        const widths = [3000, width - 3000];
        return [
          table(
            widths,
            b.rows.map(
              ([k, v]) =>
                new TableRow({
                  children: [
                    cell([para([new TextRun({ text: k, size: 18, color: C.muted })], { spacing: { after: 0 } })], widths[0]),
                    cell([para([new TextRun({ text: v, bold: true })], { spacing: { after: 0 } })], widths[1]),
                  ],
                }),
            ),
            { ...GRID_BORDERS, top: LINE },
          ),
          spacer(200),
        ];
      }
      case "people": {
        const widths = [2300, 2000, width - 2300 - 2000 - 2300, 2300];
        return [
          table(widths, [
            headerRow(b.cols, widths),
            ...b.rows.map(
              (r) =>
                new TableRow({
                  children: r.map((v, i) =>
                    cell([para([new TextRun({ text: v, bold: i === 0, size: 19 })], { spacing: { after: 0 } })], widths[i]),
                  ),
                }),
            ),
          ]),
          spacer(160),
        ];
      }
      case "glossary": {
        const widths = [2900, width - 2900];
        return [
          table(widths, [
            headerRow(L.glossaryCols, widths),
            ...b.terms.map((t) => {
              const fill = t.unapproved ? C.roseRow : undefined;
              const term: Child[] = [para([new TextRun({ text: t.term, bold: true, size: 20 })], { spacing: { after: 0 } })];
              if (t.unapproved) {
                term.push(para([new TextRun({ text: `(${L.unapproved})`, italics: true, bold: true, size: 15, color: C.red })], { spacing: { before: 40, after: 0 } }));
              }
              return new TableRow({
                cantSplit: true,
                children: [
                  cell(term, widths[0], { fill }),
                  cell([para([new TextRun({ text: t.definition || "—", size: 20 })], { spacing: { after: 0 } })], widths[1], { fill }),
                ],
              });
            }),
          ]),
          spacer(200),
        ];
      }
      case "entry":
        return this.entry(b, width);
    }
  }

  private entry(b: Extract<Block, { type: "entry" }>, width: number): Child[] {
    const L = this.doc.labels;
    const question = para(
      [
        new TextRun({ text: b.question, bold: true }),
        ...(b.open ? [new TextRun({ text: `   ${L.open.toUpperCase()}`, bold: true, size: 14, color: C.red, characterSpacing: 30 })] : []),
        ...(b.polished ? [new TextRun({ text: `   · ${L.polished}`, italics: true, size: 15, color: C.muted })] : []),
      ],
      { keepNext: true, spacing: { before: 200, after: 60 } },
    );
    if (b.open) return [question, para([new TextRun({ text: L.openAnswer, italics: true, color: C.muted })], { spacing: { after: 160 } })];

    if (b.barometer) {
      const max = Math.max(1, ...b.barometer.rows.map((r) => r.count));
      const widths = [2600, width - 2600 - 700, 700];
      const rows = b.barometer.rows.map(
        (r) =>
          new TableRow({
            children: [
              cell([para([new TextRun({ text: r.option, size: 19 })], { spacing: { after: 0 } })], widths[0], { fill: C.rose }),
              cell(
                [para([new TextRun({ text: "█".repeat(Math.max(1, Math.round((r.count / max) * 18))), color: C.red, size: 16 })], { spacing: { after: 0 } })],
                widths[1],
                { fill: C.rose, valign: VerticalAlignTable.CENTER },
              ),
              cell([para([new TextRun({ text: String(r.count), bold: true })], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } })], widths[2], {
                fill: C.rose,
              }),
            ],
          }),
      );
      return [
        question,
        table(widths, rows, NO_BORDERS),
        para([new TextRun({ text: L.votes(b.barometer.total), size: 17, color: C.muted })], { spacing: { before: 60, after: 160 } }),
      ];
    }

    if (b.highlight) {
      const inner = width - 400;
      return [
        question,
        table([width], [new TableRow({ children: [cell(this.blocks(b.body, inner), width, { fill: C.rose, leftAccent: true })] })], NO_BORDERS),
        spacer(120),
      ];
    }
    return [question, ...this.blocks(b.body, width)];
  }
}

/* --------------------------------------------------------------- sections */

function cover(doc: ExportDoc, images: Map<string, Raster | null>): Child[] {
  const L = doc.labels;
  const img = (path: string) => images.get(path) ?? null;
  const fbs = img(BRAND.fbs);
  const kv = img(BRAND.keyVisual);
  const kvW = 4200;
  const leftW = CONTENT_W - kvW;

  const label = (text: string) => para([eyebrow(text, { size: 13 })], { spacing: { before: 220, after: 40 } });
  const facts: Child[] = [
    label(L.datesLabel),
    para([new TextRun({ text: L.dates, bold: true, size: 22 })], { spacing: { after: 0 } }),
    label(L.organisationLabel),
    para([new TextRun({ text: L.organisation, size: 20 })], { spacing: { after: 0 } }),
    label(L.moderationLabel),
    ...L.hosts.flatMap((h) => [
      para([new TextRun({ text: h.name, bold: true, size: 20 })], { spacing: { after: 0 } }),
      para([new TextRun({ text: h.org, size: 18, color: C.muted })], { spacing: { after: 100 } }),
    ]),
  ];

  const logoCells = [
    { path: BRAND.innovationswerkstatt, box: { w: 44 }, alt: "Innovationswerkstatt" },
    { path: BRAND.dms, box: { h: 14 }, alt: "Digital Management School" },
    { path: BRAND.bik, box: { h: 14 }, alt: "BIK GmbH" },
  ] as const;
  const logoW = [CONTENT_W - 3100 - 2 * 1700, 3100, 1700, 1700];

  return [
    fbs ? para([imageRun(fbs, { w: 34 }, "Fachverband Betonbohren und -sägen Deutschland e. V.")], { spacing: { after: 480 } }) : spacer(480),
    para([eyebrow(doc.docType, { size: 18 })], { spacing: { after: 80 } }),
    para([new TextRun({ text: doc.title, bold: true, size: 64, color: C.ink })], { spacing: { after: 120, line: 240 } }),
    para([new TextRun({ text: L.organisation, size: 24, color: C.muted })], { spacing: { after: 200 } }),
    para([], { border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: C.red, space: 1 } }, indent: { right: CONTENT_W - 1500 }, spacing: { after: 360 } }),
    table(
      [leftW, kvW],
      [
        new TableRow({
          children: [
            cell(facts, leftW, { valign: VerticalAlignTable.BOTTOM, tight: true }),
            cell(
              [kv ? para([imageRun(kv, { w: 72 }, "Zukunft auf festem Grund")], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }) : spacer(0)],
              kvW,
              { valign: VerticalAlignTable.BOTTOM, tight: true },
            ),
          ],
        }),
      ],
      NO_BORDERS,
    ),
    spacer(560),
    table(
      logoW,
      [
        new TableRow({
          children: [
            cell([para([eyebrow(L.partnersLabel, { size: 13, color: C.muted })], { spacing: { after: 0 } })], logoW[0], { valign: VerticalAlignTable.CENTER }),
            ...logoCells.map((l, i) => {
              const r = img(l.path);
              return cell(
                [r ? para([imageRun(r, l.box, l.alt)], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }) : spacer(0)],
                logoW[i + 1],
                { valign: VerticalAlignTable.CENTER },
              );
            }),
          ],
        }),
      ],
      { ...NO_BORDERS, top: LINE },
    ),
  ];
}

function tocPage(doc: ExportDoc): Child[] {
  const L = doc.labels;
  const cachedEntries = doc.chapters.flatMap((c) => [
    { title: c.title, level: 1, href: tocBm(c.anchor) },
    ...c.sections.map((s) => ({ title: s.title, level: 2, href: tocBm(s.anchor) })),
  ]);
  const widths = [800, CONTENT_W - 800 - 2400, 2400];
  const overview = table(
    widths,
    doc.chapters.map(
      (c) =>
        new TableRow({
          children: [
            cell([para([new TextRun({ text: pad(c.number), bold: true, color: C.red })], { spacing: { after: 0 } })], widths[0]),
            cell(
              [
                para([new InternalHyperlink({ anchor: bm(c.anchor), children: [new TextRun({ text: c.title, style: "Hyperlink", bold: true })] })], {
                  spacing: { after: 0 },
                }),
              ],
              widths[1],
            ),
            cell(
              [para([new TextRun({ text: c.tocNote ?? c.eyebrow ?? "", size: 17, color: C.muted })], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } })],
              widths[2],
            ),
          ],
        }),
    ),
    { ...GRID_BORDERS, top: LINE },
  );
  return [
    para([eyebrow(L.tocEyebrow)], { spacing: { after: 60 } }),
    para([new TextRun({ text: L.tocTitle, bold: true, size: 48 })], { spacing: { after: 280 } }),
    new TableOfContents(L.tocTitle, { hyperlink: true, headingStyleRange: "1-2", cachedEntries }),
    para([eyebrow(L.overview, { color: C.muted, size: 14 })], { spacing: { before: 480, after: 100 } }),
    overview,
  ];
}

function chapter(c: ExportChapter, doc: ExportDoc, images: Map<string, Raster | null>, render: BlockRenderer): Child[] {
  const L = doc.labels;
  // Target of the chapter overview links (see tocBm for why it is not on the heading).
  const top = para(
    [
      new Bookmark({
        id: bm(c.anchor),
        children: [eyebrow(`${L.chapter} ${pad(c.number)}`), ...(c.eyebrow ? [new TextRun({ text: `   ·   ${c.eyebrow}`, size: 15, color: C.muted })] : [])],
      }),
    ],
    { pageBreakBefore: true, spacing: { after: 60 } },
  );
  const left: Child[] = [
    para([new TextRun({ text: pad(c.number), bold: true, size: 76, color: C.red })], { spacing: { after: 0, line: 240 } }),
    para([new Bookmark({ id: tocBm(c.anchor), children: [new TextRun(c.title)] })], { heading: HeadingLevel.HEADING_1 }),
  ];
  if (c.question) {
    const shade = { type: ShadingType.CLEAR, color: "auto", fill: C.soft };
    left.push(
      para([eyebrow(c.question.label, { size: 13 })], { shading: shade, spacing: { before: 160, after: 20 }, indent: { left: 80, right: 80 } }),
      para([new TextRun({ text: c.question.text, italics: true, size: 21 })], { shading: shade, spacing: { after: 60 }, indent: { left: 80, right: 80 } }),
    );
  }
  const image = c.image ? (images.get(c.image) ?? null) : null;
  const imgW = 2700;
  const head: Child[] = image
    ? [
        table(
          [CONTENT_W - imgW, imgW],
          [
            new TableRow({
              children: [
                cell(left, CONTENT_W - imgW, { tight: true, valign: VerticalAlignTable.TOP }),
                cell([para([imageRun(image, { w: 44 }, c.title)], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } })], imgW, {
                  tight: true,
                  valign: VerticalAlignTable.TOP,
                }),
              ],
            }),
          ],
          NO_BORDERS,
        ),
      ]
    : left;
  const rule = para([], { border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.red, space: 6 } }, spacing: { after: 280 } });

  const sections = c.sections.flatMap((s) => [
    para([new Bookmark({ id: tocBm(s.anchor), children: [new TextRun(s.title)] })], { heading: HeadingLevel.HEADING_2 }),
    ...(s.ref ? [para([new TextRun({ text: `${L.slide} ${s.ref}`, size: 15, color: C.muted })], { spacing: { after: 40 }, indent: { left: 170 } })] : []),
    ...render.blocks(s.blocks),
  ]);
  return [top, ...head, rule, ...render.blocks(c.blocks), ...sections];
}

/* -------------------------------------------------------------- document */

const bulletLevels = ["•", "–", "·"].map((text, level) => ({
  level,
  format: LevelFormat.BULLET,
  text,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } }, run: { color: C.red, bold: true } },
}));

const numberLevels = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN].map((format, level) => ({
  level,
  format,
  text: `%${level + 1}.`,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 400 + level * 360, hanging: 300 } }, run: { color: C.red, bold: true } },
}));

export async function renderDocx(doc: ExportDoc): Promise<Blob> {
  const L = doc.labels;
  const images = await loadImages(doc);
  const render = new BlockRenderer(doc);
  const small = { size: 15, color: C.muted };

  const document = new Document({
    creator: "Workshop-Plattform",
    title: `${doc.docType} · ${doc.title}`,
    description: L.organisation,
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: FONT, size: 21, color: C.ink }, paragraph: { spacing: { after: 120, line: 276 } } },
        heading1: { run: { font: FONT, size: 40, bold: true, color: C.ink }, paragraph: { spacing: { before: 60, after: 120, line: 252 }, keepNext: true } },
        heading2: {
          run: { font: FONT, size: 26, bold: true, color: C.ink },
          paragraph: {
            spacing: { before: 360, after: 60 },
            keepNext: true,
            indent: { left: 170 },
            border: { left: { style: BorderStyle.SINGLE, size: 24, color: C.red, space: 8 } },
          },
        },
        heading3: { run: { font: FONT, size: 22, bold: true, color: C.ink }, paragraph: { spacing: { before: 220, after: 60 }, keepNext: true } },
        hyperlink: { run: { color: C.red, underline: {} } },
      },
      paragraphStyles: [
        { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal", run: { bold: true, size: 22, color: C.ink }, paragraph: { spacing: { before: 140, after: 40 } } },
        { id: "TOC2", name: "toc 2", basedOn: "Normal", next: "Normal", run: { size: 19, color: C.muted }, paragraph: { spacing: { after: 20 }, indent: { left: 420 } } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: bulletLevels },
        { reference: "numbers", levels: numberLevels },
      ],
    },
    sections: [
      {
        properties: { page: { size: PAGE, margin: { top: 1134, bottom: 1000, left: MARGIN_X, right: MARGIN_X } } },
        children: cover(doc, images),
      },
      {
        properties: { page: { size: PAGE, margin: { top: 1420, bottom: 1300, left: MARGIN_X, right: MARGIN_X, header: 620, footer: 620 } } },
        headers: {
          default: new Header({
            children: [
              para([new TextRun({ text: doc.shortTitle, ...small }), new TextRun({ text: `\t${L.headerRight}`, ...small })], {
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.red, space: 4 } },
                spacing: { after: 0 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              para(
                [
                  new TextRun({ text: L.footer, ...small }),
                  new TextRun({ children: ["\t", `${L.page} `, PageNumber.CURRENT, ` ${L.of} `, PageNumber.TOTAL_PAGES], size: 15, bold: true, color: C.ink }),
                ],
                {
                  tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } },
                  spacing: { after: 0 },
                },
              ),
            ],
          }),
        },
        children: [...tocPage(doc), ...doc.chapters.flatMap((c) => chapter(c, doc, images, render))],
      },
    ],
  });
  return Packer.toBlob(document);
}
