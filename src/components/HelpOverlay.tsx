import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import type { Lang } from "@/types/slide";
import { pick, useLang } from "@/lib/i18n";
import { HELP_SECTIONS, type HelpItem, type HelpSection } from "@/lib/help-content";

interface Props {
  /** Section to scroll to when the dialog opens. */
  section?: string;
  onClose: () => void;
  onJump: (to: string) => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Everything of an item a search may match — including terms that are never shown. */
function haystack(item: HelpItem, lang: Lang): string {
  return norm(
    [
      pick(item.title, lang),
      pick(item.body, lang),
      item.keywords ? pick(item.keywords, lang) : "",
      ...(item.keys?.[lang] ?? []),
      ...(item.links ?? []).map((l) => pick(l.label, lang)),
    ].join(" "),
  );
}

function matches(terms: string[], text: string): boolean {
  return terms.every((t) => text.includes(t));
}

/** Marks every search term inside a piece of text without touching its wording. */
function Highlight({ text, terms }: { text: string; terms: string[] }): ReactNode {
  if (terms.length === 0) return text;
  const lower = text.toLowerCase();
  const hits: [number, number][] = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(term, from);
      if (at === -1) break;
      hits.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  if (hits.length === 0) return text;
  hits.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of hits) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const out: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark
        key={i}
        style={{
          background: "color-mix(in oklch, var(--workshop-accent) 26%, transparent)",
          color: "inherit",
          borderRadius: 2,
          padding: "0 1px",
        }}
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono leading-none whitespace-nowrap"
      style={{
        background: "color-mix(in oklch, var(--fg) 8%, transparent)",
        border: "1px solid var(--border)",
        color: "var(--fg)",
      }}
    >
      {children}
    </kbd>
  );
}

function JumpLinks({ item, lang, onJump }: { item: HelpItem; lang: Lang; onJump: (to: string) => void }) {
  if (!item.links?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {item.links.map((l) => (
        <button
          key={l.to + pick(l.label, lang)}
          type="button"
          onClick={() => onJump(l.to)}
          data-help-jump={l.to}
          className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium transition-colors hover:bg-[color-mix(in_oklch,var(--workshop-accent)_12%,transparent)]"
          style={{ border: "1px solid var(--border)", color: "var(--workshop-accent)" }}
        >
          {pick(l.label, lang)}
          <ArrowUpRight size={13} strokeWidth={2.5} />
        </button>
      ))}
    </div>
  );
}

function SectionBody({
  section,
  items,
  lang,
  terms,
  onJump,
}: {
  section: HelpSection;
  items: HelpItem[];
  lang: Lang;
  terms: string[];
  onJump: (to: string) => void;
}) {
  const title = (item: HelpItem) => <Highlight text={pick(item.title, lang)} terms={terms} />;
  const body = (item: HelpItem) => <Highlight text={pick(item.body, lang)} terms={terms} />;

  if (section.kind === "lead") {
    return (
      <dl className="grid gap-2.5 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg px-3.5 py-3"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
          >
            <dt className="text-[13px] font-semibold leading-snug">{title(item)}</dt>
            <dd className="text-[12.5px] leading-snug mt-1" style={{ color: "var(--fg-muted)" }}>
              {body(item)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (section.kind === "keys") {
    return (
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-2.5 py-1">
            <span className="flex flex-wrap gap-1 shrink-0 w-[136px]">
              {(item.keys?.[lang] ?? []).map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
            <span className="text-[13px] leading-snug">
              {title(item)}
              {pick(item.body, lang) && (
                <span style={{ color: "var(--fg-muted)" }}> · {body(item)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (section.kind === "notes") {
    return (
      <ul className="grid gap-2.5">
        {items.map((item) => (
          <li key={item.id} className="pl-3" style={{ borderLeft: "2px solid var(--border)" }}>
            <div className="text-[13px] font-semibold leading-snug">{title(item)}</div>
            <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {body(item)}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  if (section.kind === "tasks") {
    return (
      <ol className="grid gap-px" style={{ background: "var(--border)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {items.map((item) => (
          <li key={item.id} className="grid gap-1 sm:grid-cols-[210px_1fr] px-3.5 py-3" style={{ background: "var(--bg)" }}>
            <h4 className="text-[13.5px] font-semibold leading-snug" style={{ color: "var(--fg)" }}>
              {title(item)}
            </h4>
            <div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                {body(item)}
              </p>
              <JumpLinks item={item} lang={lang} onJump={onJump} />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg px-3.5 py-3"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
        >
          <h4 className="text-[13.5px] font-semibold leading-snug flex items-baseline gap-2">
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full shrink-0"
              style={{ background: "var(--workshop-accent)", transform: "translateY(-2px)" }}
            />
            <span>{title(item)}</span>
          </h4>
          <p className="text-[13px] leading-relaxed mt-1" style={{ color: "var(--fg-muted)" }}>
            {body(item)}
          </p>
          <JumpLinks item={item} lang={lang} onJump={onJump} />
        </div>
      ))}
    </div>
  );
}

/**
 * The help — a dialog over whatever is on screen, reachable with „?" from anywhere
 * and under its own link (#/hilfe). Starts with what the app is and what it does
 * well, then the tasks, the shortcuts and the honest notes; a search runs over all
 * of it. Keyboard: Esc closes and gives the focus back, Tab stays inside.
 */
export function HelpOverlay({ section, onClose, onJump }: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(section ?? HELP_SECTIONS[0].id);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const terms = useMemo(() => norm(query).split(" ").filter(Boolean), [query]);

  const visible = useMemo(() => {
    if (terms.length === 0) return HELP_SECTIONS.map((s) => ({ section: s, items: s.items }));
    return HELP_SECTIONS.map((s) => {
      const lead = s.lead ? norm(pick(s.lead, lang)) : "";
      const headline = `${norm(pick(s.title, lang))} ${lead}`;
      const items = s.items.filter((i) => matches(terms, `${haystack(i, lang)} ${headline}`));
      return { section: s, items };
    }).filter((s) => s.items.length > 0);
  }, [terms, lang]);

  const hits = visible.reduce((n, s) => n + s.items.length, 0);

  // Focus starts in the search field and returns to the trigger on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = body;
      before?.focus?.();
    };
  }, []);

  // While a navigation click scrolls smoothly, the scroll events pass over the
  // sections in between — the scroll spy must not overrule the section just chosen.
  const spyPausedUntil = useRef(0);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current.get(id);
    const box = scrollRef.current;
    if (!el || !box) return;
    spyPausedUntil.current = Date.now() + 1000;
    box.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: "smooth" });
    setActive(id);
  }, []);

  // Opening on a named section (e.g. from a "shortcuts" link) starts there.
  useEffect(() => {
    if (!section) return;
    const el = sectionRefs.current.get(section);
    const box = scrollRef.current;
    if (el && box) box.scrollTop = Math.max(0, el.offsetTop - 8);
  }, [section]);

  const onScroll = () => {
    const box = scrollRef.current;
    if (!box || Date.now() < spyPausedUntil.current) return;
    // The last sections are often shorter than the box and can never reach the
    // top edge — at the end of the scroll the last one is what the reader sees.
    const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
    let current = atEnd ? visible[visible.length - 1]?.section.id : visible[0]?.section.id;
    if (!atEnd) {
      for (const { section: s } of visible) {
        const el = sectionRefs.current.get(s.id);
        if (el && el.offsetTop - box.scrollTop <= 72) current = s.id;
      }
    }
    if (current && current !== active) setActive(current);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (n) => n.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print"
      style={{ background: "rgba(9,10,14,0.55)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        data-help-dialog
        onKeyDown={onKeyDown}
        className="flex flex-col w-full overflow-hidden rounded-xl shadow-2xl"
        style={{
          maxWidth: 1100,
          height: "min(880px, 88vh)",
          background: "var(--bg)",
          color: "var(--fg)",
          border: "1px solid var(--border)",
        }}
      >
        {/* ── Head: what this is, and the search over everything in it ── */}
        <div
          className="flex flex-wrap items-center gap-3 px-5 sm:px-7 py-3.5 shrink-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elev)" }}
        >
          <div className="min-w-0">
            <h2 id="help-title" className="text-[17px] font-semibold leading-tight">
              {de ? "Hilfe" : "Help"}
            </h2>
            <p className="text-[11.5px] leading-tight mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {de ? "Was diese App leistet – und wie man sie bedient" : "What this app does – and how to work it"}
            </p>
          </div>

          <div
            className="flex items-center gap-2 px-3 h-9 rounded-md ml-auto order-last sm:order-none w-full sm:w-auto sm:min-w-[300px]"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
          >
            <Search size={15} strokeWidth={2.25} style={{ color: "var(--fg-muted)" }} aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-help-search
              placeholder={de ? "In der Hilfe suchen …" : "Search the help …"}
              aria-label={de ? "In der Hilfe suchen" : "Search the help"}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm"
              style={{ color: "var(--fg)" }}
            />
            {query && (
              <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--fg-muted)" }} data-help-hits>
                {hits}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            data-help-close
            className="size-9 grid place-items-center rounded-md transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_10%,transparent)]"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            aria-label={de ? "Hilfe schließen" : "Close help"}
          >
            <X size={17} strokeWidth={2.25} />
          </button>
        </div>

        {/* ── Body: quiet navigation on the left, the content on the right ── */}
        <div className="flex flex-1 min-h-0">
          <nav
            aria-label={de ? "Abschnitte der Hilfe" : "Help sections"}
            className="hidden md:flex flex-col gap-0.5 w-[212px] shrink-0 py-4 px-3 overflow-y-auto"
            style={{ borderRight: "1px solid var(--border)", background: "var(--bg-elev)" }}
          >
            {HELP_SECTIONS.map((s) => {
              const shown = visible.find((v) => v.section.id === s.id);
              const isActive = active === s.id && Boolean(shown);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  disabled={!shown}
                  aria-current={isActive ? "true" : undefined}
                  className="text-left px-2.5 py-2 rounded-md text-[13px] leading-snug transition-colors disabled:opacity-40 hover:bg-[color-mix(in_oklch,var(--fg)_7%,transparent)]"
                  style={
                    isActive
                      ? {
                          background: "color-mix(in oklch, var(--workshop-accent) 12%, transparent)",
                          color: "var(--workshop-accent)",
                          fontWeight: 600,
                        }
                      : { color: "var(--fg)" }
                  }
                >
                  {pick(s.nav, lang)}
                  {terms.length > 0 && shown && (
                    <span className="ml-1.5 text-[11px] tabular-nums" style={{ color: "var(--fg-muted)" }}>
                      {shown.items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 min-w-0 overflow-y-auto px-5 sm:px-7 py-5">
            {visible.length === 0 && (
              <p className="text-sm py-10 text-center" style={{ color: "var(--fg-muted)" }}>
                {de
                  ? "Dazu steht hier nichts. Andere Wörter probieren – gesucht wird über Überschriften, Texte und Tastenkürzel."
                  : "Nothing here on that. Try other words – the search runs over headings, texts and shortcuts."}
              </p>
            )}

            {visible.map(({ section: s, items }, i) => (
              <section
                key={s.id}
                ref={(el) => {
                  if (el) sectionRefs.current.set(s.id, el);
                  else sectionRefs.current.delete(s.id);
                }}
                aria-labelledby={`help-section-${s.id}`}
                data-help-section={s.id}
                className={i === 0 ? "mb-9" : "mb-9 pt-7"}
                style={i === 0 ? undefined : { borderTop: "1px solid var(--border)" }}
              >
                <h3
                  id={`help-section-${s.id}`}
                  className="text-[16.5px] font-semibold leading-tight mb-1.5 flex items-center gap-2.5"
                  style={{ color: "var(--fg)" }}
                >
                  <span
                    aria-hidden
                    className="inline-block rounded-full shrink-0"
                    style={{ width: 3, height: 16, background: "var(--workshop-accent)" }}
                  />
                  <Highlight text={pick(s.title, lang)} terms={terms} />
                </h3>
                {s.lead && (
                  <p
                    className="text-[13.5px] leading-relaxed mb-3.5 max-w-[78ch] pl-[13px]"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    <Highlight text={pick(s.lead, lang)} terms={terms} />
                  </p>
                )}
                <SectionBody section={s} items={items} lang={lang} terms={terms} onJump={onJump} />
              </section>
            ))}
          </div>
        </div>

        {/* ── Foot: how to get back here ── */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 sm:px-7 py-2.5 text-[11.5px] shrink-0"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--fg-muted)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Kbd>?</Kbd> {de ? "öffnet die Hilfe" : "opens the help"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Esc</Kbd> {de ? "schließt sie" : "closes it"}
          </span>
          <span className="ml-auto">
            {de ? "Weitergeben als Link: " : "Share as a link: "}
            <code className="font-mono" style={{ color: "var(--fg)" }}>
              #/hilfe
            </code>
          </span>
        </div>
      </div>
    </div>
  );
}
