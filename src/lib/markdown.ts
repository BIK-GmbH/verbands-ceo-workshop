/**
 * Minimal Markdown → HTML for AI-generated reports (no dependency): headings,
 * paragraphs, (nested) lists, bold/italic, inline code, rules, quotes and
 * simple pipe tables. All text is escaped first, so the only tags in the output
 * are the ones produced here — safe for innerHTML, print and Word export.
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return escapeHtml(s.trim())
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "$1<em>$2</em>");
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_RE = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;
const RULE_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  const lists: { indent: number; tag: "ul" | "ol" }[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join(" ")}</p>`);
    para = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote><p>${quote.map(inline).join(" ")}</p></blockquote>`);
    quote = [];
  };
  const closeLists = () => {
    while (lists.length) out.push(`</li></${lists.pop()!.tag}>`);
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    closeLists();
  };

  const openItem = (indent: number, tag: "ul" | "ol", text: string) => {
    while (lists.length && lists[lists.length - 1].indent > indent) out.push(`</li></${lists.pop()!.tag}>`);
    const top = lists[lists.length - 1];
    if (top && top.indent === indent && top.tag === tag) {
      out.push("</li>");
    } else {
      if (top && top.indent === indent) out.push(`</li></${lists.pop()!.tag}>`);
      // A deeper indent opens a nested list inside the still-open <li>.
      lists.push({ indent, tag });
      out.push(`<${tag}>`);
    }
    out.push(`<li>${inline(text)}`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      flushPara();
      flushQuote();
      // Keep lists open across blank lines ("loose" lists); any other block closes them.
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (RULE_RE.test(line)) {
      flushAll();
      out.push("<hr>");
      continue;
    }

    const item = LIST_RE.exec(line);
    if (item) {
      flushPara();
      flushQuote();
      openItem(item[1].replace(/\t/g, "  ").length, /\d/.test(item[2]) ? "ol" : "ul", item[3]);
      continue;
    }

    if (lists.length && /^\s+\S/.test(line) && !para.length) {
      out.push(` ${inline(line)}`);
      continue;
    }

    const q = QUOTE_RE.exec(line);
    if (q) {
      flushPara();
      closeLists();
      quote.push(q[1]);
      continue;
    }

    if (line.trim().startsWith("|") && TABLE_SEP_RE.test(lines[i + 1] ?? "")) {
      flushAll();
      const head = tableCells(line);
      let html = `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>`;
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        html += `<tr>${tableCells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
        i++;
      }
      i--;
      out.push(`${html}</tbody></table>`);
      continue;
    }

    flushQuote();
    closeLists();
    para.push(line);
  }
  flushAll();
  return out.join("\n");
}
