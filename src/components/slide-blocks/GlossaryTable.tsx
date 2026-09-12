import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import { staticGlossaryTerms, useGlossary, type StaticGlossaryTerm } from "@/lib/glossary";

const TXT = {
  de: {
    cols: ["Begriff", "Bedeutung"],
    label: "Glossar durchsuchen",
    placeholder: "Begriff oder Bedeutung suchen …",
    clear: "Suche leeren",
    clearTitle: "Suche leeren (Esc)",
    all: (n: number) => `${n} ${n === 1 ? "Begriff" : "Begriffe"}`,
    some: (n: number, total: number) => `${n} von ${total} ${total === 1 ? "Begriff" : "Begriffen"}`,
    empty: (q: string) => `Kein Begriff passt zu „${q}“. Mit einem anderen Wort suchen oder die Suche leeren.`,
    alsoBelow: (n: number) =>
      n === 1 ? "1 weiterer Treffer unter „Im Workshop ergänzt“." : `${n} weitere Treffer unter „Im Workshop ergänzt“.`,
  },
  en: {
    cols: ["Term", "Meaning"],
    label: "Search the glossary",
    placeholder: "Search term or meaning …",
    clear: "Clear search",
    clearTitle: "Clear search (Esc)",
    all: (n: number) => `${n} ${n === 1 ? "term" : "terms"}`,
    some: (n: number, total: number) => `${n} of ${total} ${total === 1 ? "term" : "terms"}`,
    empty: (q: string) => `No term matches “${q}”. Try another word or clear the search.`,
    alsoBelow: (n: number) =>
      n === 1 ? "1 more match under “Added in the workshop”." : `${n} more matches under “Added in the workshop”.`,
  },
} as const;

/* ------------------------------------------------------------------ folding */

/** Umlauts and ß, so that „für“ is found by typing "fuer" and vice versa. */
const EXPAND: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

interface Folded {
  /** Lower case, umlauts expanded, accents dropped, punctuation collapsed to single spaces. */
  text: string;
  /** For every character of `text` the index of the source character it came from. */
  map: number[];
}

/**
 * Search form of a string, keeping a back-reference per character so a hit can
 * be highlighted in the original text even though folding changes its length
 * (ä → ae, "KI / LLM" → "ki llm").
 */
function fold(src: string): Folded {
  let text = "";
  const map: number[] = [];
  let atSeparator = true; // suppresses a leading space
  for (let i = 0; i < src.length; i++) {
    const lower = src[i].toLowerCase();
    const rep = EXPAND[lower] ?? lower.normalize("NFD").replace(/\p{M}/gu, "");
    if (!/[\p{L}\p{N}]/u.test(rep)) {
      if (!atSeparator) {
        text += " ";
        map.push(i);
        atSeparator = true;
      }
      continue;
    }
    for (const ch of rep) {
      text += ch;
      map.push(i);
    }
    atSeparator = false;
  }
  if (atSeparator && text) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

/** Search words: folded, split on everything that is not a letter or digit. */
function tokenize(query: string): string[] {
  return fold(query).text.split(" ").filter(Boolean);
}

/** All words must occur somewhere in term or meaning — order does not matter. */
function matches(term: Folded, definition: Folded, tokens: string[]): boolean {
  const hay = `${term.text} ${definition.text}`;
  return tokens.every((token) => hay.includes(token));
}

/** Merged hit ranges as indexes into the original (unfolded) string. */
function hitRanges(folded: Folded, tokens: string[]): Array<[number, number]> {
  const hits: Array<[number, number]> = [];
  for (const token of tokens) {
    for (let from = 0; ; ) {
      const at = folded.text.indexOf(token, from);
      if (at === -1) break;
      hits.push([folded.map[at], folded.map[at + token.length - 1] + 1]);
      from = at + 1;
    }
  }
  hits.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of hits) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

const markStyle: CSSProperties = {
  background: "color-mix(in oklch, var(--workshop-accent) 25%, transparent)",
  color: "var(--fg)",
  borderRadius: "2px",
  padding: "0 0.1em",
};

function Highlight({ text, folded, tokens }: { text: string; folded: Folded; tokens: string[] }) {
  const parts = useMemo<ReactNode[]>(() => {
    const ranges = tokens.length ? hitRanges(folded, tokens) : [];
    if (ranges.length === 0) return [text];
    const out: ReactNode[] = [];
    let at = 0;
    ranges.forEach(([start, end], i) => {
      if (start > at) out.push(text.slice(at, start));
      out.push(
        <mark key={i} style={markStyle}>
          {text.slice(start, end)}
        </mark>,
      );
      at = end;
    });
    out.push(text.slice(at));
    return out;
  }, [text, folded, tokens]);
  return <>{parts}</>;
}

/* -------------------------------------------------------------------- views */

interface Row extends StaticGlossaryTerm {
  term_: Folded;
  definition_: Folded;
}

const cellStyle: CSSProperties = { borderColor: "var(--border)" };

function SearchableTable({ lang }: { lang: Lang }) {
  const t = TXT[lang];
  const [query, setQuery] = useState("");
  const rows = useMemo<Row[]>(
    () => staticGlossaryTerms(lang).map((r) => ({ ...r, term_: fold(r.term), definition_: fold(r.definition) })),
    [lang],
  );
  const tokens = useMemo(() => tokenize(query), [query]);
  const shown = useMemo(
    () => (tokens.length ? rows.filter((r) => matches(r.term_, r.definition_, tokens)) : rows),
    [rows, tokens],
  );

  // Terms added during the workshop live in their own section below; the search
  // never hides them, it only says how many of them match as well.
  const { terms: workshopTerms } = useGlossary();
  const alsoBelow = tokens.length
    ? workshopTerms.filter((w) => matches(fold(w.term), fold(w.definition), tokens)).length
    : 0;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Escape" || !query) return;
    e.preventDefault();
    e.stopPropagation();
    setQuery("");
  };

  return (
    <div className="my-4 not-prose">
      <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <div className="relative flex-1 min-w-[11rem]">
          <Search
            size={15}
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--fg-muted)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            aria-label={t.label}
            aria-controls="glossar-ergebnis"
            className="w-full rounded-md pl-8 pr-9 py-2 text-sm"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              title={t.clearTitle}
              aria-label={t.clear}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md"
              style={{ color: "var(--fg-muted)" }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--fg-muted)" }} role="status" aria-live="polite">
          {tokens.length ? t.some(shown.length, rows.length) : t.all(rows.length)}
        </span>
      </div>

      <div id="glossar-ergebnis">
        {shown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {t.cols.map((col) => (
                    <th key={col} className="text-left font-semibold border-b px-3 py-1.5" style={cellStyle}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.term}>
                    <td className="border-b px-3 py-1.5 align-top font-semibold" style={cellStyle}>
                      <Highlight text={row.term} folded={row.term_} tokens={tokens} />
                    </td>
                    <td className="border-b px-3 py-1.5 align-top" style={cellStyle}>
                      <Highlight text={row.definition} folded={row.definition_} tokens={tokens} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="rounded-md px-3 py-4 text-sm flex flex-wrap items-center gap-x-3 gap-y-2"
            style={{ border: "1px dashed var(--border)", color: "var(--fg-muted)" }}
          >
            <span className="flex-1 min-w-[12rem]">{t.empty(query.trim())}</span>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0"
              style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)" }}
            >
              <X size={13} /> {t.clear}
            </button>
          </div>
        )}
      </div>

      {alsoBelow > 0 && (
        <p className="no-print text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
          {t.alsoBelow(alsoBelow)}
        </p>
      )}
    </div>
  );
}

/** Print/PDF: the complete list, alphabetical, without any controls. */
function PrintTable({ lang }: { lang: Lang }) {
  const t = TXT[lang];
  return (
    <table className="min-w-full text-sm border-collapse my-4">
      <thead>
        <tr>
          {t.cols.map((col) => (
            <th key={col} className="text-left font-semibold border-b border-gray-300 px-3 py-1.5">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {staticGlossaryTerms(lang).map((row) => (
          <tr key={row.term}>
            <td className="border-b border-gray-200 px-3 py-1.5 align-top font-semibold">{row.term}</td>
            <td className="border-b border-gray-200 px-3 py-1.5 align-top">{row.definition}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Props {
  /** Print view: full list as a plain table, no search field */
  readOnly?: boolean;
  /**
   * The `<De>`/`<En>` tables of the slide. They are deliberately not rendered:
   * they are the source the terms are parsed from (here and in the PDF/Word
   * export), so the table structure in 99-01-glossar.mdx must stay intact.
   */
  children?: ReactNode;
}

/**
 * MDX block `<GlossaryTable>` on the glossary slide (99.01): the fixed terms,
 * alphabetically sorted, searchable across term and meaning.
 */
export function GlossaryTable({ readOnly = false }: Props) {
  const [lang] = useLang();
  return readOnly ? <PrintTable lang={lang} /> : <SearchableTable lang={lang} />;
}
