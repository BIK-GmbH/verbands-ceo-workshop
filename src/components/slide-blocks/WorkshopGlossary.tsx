import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, CheckCheck, Loader2, Pencil, Plus, Sparkles, Trash2, X, PenLine } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import { useAllEntries } from "@/lib/useWorkshop";
import { describeAiError, useApiKey } from "@/lib/ai-assist";
import { AiKeySetup } from "@/components/ProtocolAi";
import {
  GlossaryError,
  acceptSuggestions,
  addManualTerm,
  approveAllTerms,
  approveTerm,
  discardSuggestions,
  fetchGlossarySuggestions,
  glossarySourceEntries,
  removeTerm,
  replaceSuggestions,
  updateSuggestion,
  updateTerm,
  useGlossary,
  type GlossaryErrorCode,
  type GlossaryTerm,
} from "@/lib/glossary";

const ERROR_COLOR = "#dc2626";

const TXT = {
  de: {
    input: "Glossar",
    heading: "Begriffe aus diesem Workshop",
    empty:
      "Noch keine Begriffe ergänzt. Am Ende des Workshops Begriffe aus dem Protokoll vorschlagen lassen, prüfen und übernehmen.",
    count: (n: number, open: number) =>
      `${n} ${n === 1 ? "Begriff" : "Begriffe"}${open ? ` · ${open} nicht freigegeben` : ""}`,
    created: "im Workshop erstellt",
    unapproved: "nicht freigegeben",
    approve: "Freigeben",
    approveAll: "Alle freigeben",
    edit: "Bearbeiten",
    remove: "Löschen",
    save: "Speichern",
    cancel: "Abbrechen",
    term: "Begriff",
    definition: "Erläuterung",
    suggest: "Begriffe aus dem Protokoll vorschlagen",
    suggestAgain: "Neue Vorschläge erzeugen",
    suggesting: "Suche Begriffe im Protokoll …",
    privacy:
      "Für die Vorschläge gehen die Protokoll-Beiträge (Fragen und Antworten, ohne Teilnehmerliste) an die Claude-API (Anthropic).",
    noEntries: "Im Protokoll gibt es noch keine Beiträge, aus denen sich Begriffe ableiten lassen.",
    suggestions: (n: number) => `${n} ${n === 1 ? "Vorschlag" : "Vorschläge"} zur Prüfung`,
    selectAll: "Alle auswählen",
    flagHint:
      "Ohne Einzelprüfung übernommene Begriffe sind als „nicht freigegeben“ gekennzeichnet, bis ihr sie freigebt.",
    acceptSelected: (n: number) => `Ausgewählte übernehmen (${n})`,
    acceptAll: "Alle übernehmen",
    acceptApprove: "Übernehmen & freigeben",
    discardOne: "Vorschlag verwerfen",
    discard: "Vorschläge verwerfen",
    manual: "Eigenen Begriff hinzufügen",
    add: "Hinzufügen",
    found: (n: number) => (n === 1 ? "1 Vorschlag gefunden. Bitte prüfen." : `${n} Vorschläge gefunden. Bitte prüfen.`),
    noneFound: "Keine neuen Begriffe gefunden. Das Glossar deckt die Beiträge bereits ab.",
    accepted: (n: number, approved: boolean) =>
      n === 0
        ? "Nichts übernommen: Die Begriffe stehen schon im Glossar oder sind leer."
        : `${n} ${n === 1 ? "Begriff" : "Begriffe"} übernommen${approved ? " und freigegeben" : " (nicht freigegeben)"}.`,
    storage: "Das Glossar konnte in diesem Browser nicht gespeichert werden.",
    glossaryError: {
      "no-entries": "Im Protokoll gibt es noch keine Beiträge, aus denen sich Begriffe ableiten lassen.",
      parse: "Die Antwort der KI war nicht lesbar. Bitte noch einmal vorschlagen lassen.",
    } satisfies Record<GlossaryErrorCode, string>,
    printEmpty: "Im Workshop wurden keine Begriffe ergänzt.",
    status: "Kennzeichnung",
  },
  en: {
    input: "Glossary",
    heading: "Terms from this workshop",
    empty: "No terms added yet. At the end of the workshop, let the AI suggest terms from the protocol, review and adopt them.",
    count: (n: number, open: number) => `${n} ${n === 1 ? "term" : "terms"}${open ? ` · ${open} not approved` : ""}`,
    created: "created in the workshop",
    unapproved: "not approved",
    approve: "Approve",
    approveAll: "Approve all",
    edit: "Edit",
    remove: "Delete",
    save: "Save",
    cancel: "Cancel",
    term: "Term",
    definition: "Explanation",
    suggest: "Suggest terms from the protocol",
    suggestAgain: "Generate new suggestions",
    suggesting: "Searching the protocol for terms …",
    privacy:
      "For the suggestions, the protocol contributions (questions and answers, without the participant list) are sent to the Claude API (Anthropic).",
    noEntries: "The protocol has no contributions yet to derive terms from.",
    suggestions: (n: number) => `${n} ${n === 1 ? "suggestion" : "suggestions"} to review`,
    selectAll: "Select all",
    flagHint: "Terms adopted without individual review are flagged “not approved” until you approve them.",
    acceptSelected: (n: number) => `Adopt selected (${n})`,
    acceptAll: "Adopt all",
    acceptApprove: "Adopt & approve",
    discardOne: "Discard suggestion",
    discard: "Discard suggestions",
    manual: "Add your own term",
    add: "Add",
    found: (n: number) => (n === 1 ? "1 suggestion found. Please review." : `${n} suggestions found. Please review.`),
    noneFound: "No new terms found. The glossary already covers the contributions.",
    accepted: (n: number, approved: boolean) =>
      n === 0
        ? "Nothing adopted: the terms are already in the glossary or empty."
        : `${n} ${n === 1 ? "term" : "terms"} adopted${approved ? " and approved" : " (not approved)"}.`,
    storage: "The glossary could not be stored in this browser.",
    glossaryError: {
      "no-entries": "The protocol has no contributions yet to derive terms from.",
      parse: "The AI answer could not be read. Please try again.",
    } satisfies Record<GlossaryErrorCode, string>,
    printEmpty: "No terms were added in the workshop.",
    status: "Label",
  },
} as const;

type Strings = (typeof TXT)[Lang];

const fieldStyle: CSSProperties = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" };
const ghostStyle: CSSProperties = { border: "1px solid var(--border)", color: "var(--fg)" };
const accentStyle: CSSProperties = { background: "var(--workshop-accent)", color: "white" };
const outlineAccentStyle: CSSProperties = { border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)" };
const btn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium disabled:opacity-50";

function Badge({ tone, children }: { tone: "accent" | "warn"; children: ReactNode }) {
  const style: CSSProperties =
    tone === "accent"
      ? { background: "color-mix(in oklch, var(--workshop-accent) 15%, transparent)", color: "var(--workshop-accent)" }
      : {
          background: "color-mix(in oklch, #f59e0b 18%, transparent)",
          color: "color-mix(in oklch, #d97706 70%, var(--fg))",
        };
  return (
    <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded whitespace-nowrap" style={style}>
      {children}
    </span>
  );
}

/** Term + explanation inputs, shared by suggestions, editing and the manual form. */
function TermFields({
  term,
  definition,
  onTerm,
  onDefinition,
  t,
  autoFocus = false,
}: {
  term: string;
  definition: string;
  onTerm: (v: string) => void;
  onDefinition: (v: string) => void;
  t: Strings;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 space-y-1.5">
      <input
        type="text"
        value={term}
        onChange={(e) => onTerm(e.target.value)}
        placeholder={t.term}
        aria-label={t.term}
        autoFocus={autoFocus}
        className="w-full rounded-md px-2 py-1.5 text-sm font-semibold"
        style={fieldStyle}
      />
      <textarea
        value={definition}
        onChange={(e) => onDefinition(e.target.value)}
        placeholder={t.definition}
        aria-label={t.definition}
        rows={2}
        className="w-full rounded-md px-2 py-1.5 text-sm leading-snug resize-y"
        style={fieldStyle}
      />
    </div>
  );
}

function TermRow({ term, t, act }: { term: GlossaryTerm; t: Strings; act: (fn: () => string | void) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ term: term.term, definition: term.definition });

  if (editing) {
    const valid = draft.term.trim() && draft.definition.trim();
    return (
      <li className="py-2.5 space-y-2">
        <TermFields
          term={draft.term}
          definition={draft.definition}
          onTerm={(v) => setDraft({ ...draft, term: v })}
          onDefinition={(v) => setDraft({ ...draft, definition: v })}
          t={t}
          autoFocus
        />
        <div className="flex flex-wrap justify-end gap-1.5">
          <button type="button" className={btn} style={ghostStyle} onClick={() => setEditing(false)}>
            {t.cancel}
          </button>
          <button
            type="button"
            className={btn}
            style={accentStyle}
            disabled={!valid}
            onClick={() =>
              act(() => {
                updateTerm(term.id, { term: draft.term.trim(), definition: draft.definition.trim() });
                setEditing(false);
              })
            }
          >
            {t.save}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-2" data-glossary-term={term.term}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold">{term.term}</span>
          <Badge tone="accent">{t.created}</Badge>
          {!term.approved && <Badge tone="warn">{t.unapproved}</Badge>}
        </div>
        <p className="text-sm leading-snug mt-0.5" style={{ color: "var(--fg-muted)" }}>
          {term.definition}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!term.approved && (
          <button type="button" className={btn} style={outlineAccentStyle} onClick={() => act(() => approveTerm(term.id))}>
            <Check size={13} /> {t.approve}
          </button>
        )}
        <button
          type="button"
          className="size-8 grid place-items-center rounded-md hover:bg-black/5"
          style={{ color: "var(--fg-muted)" }}
          title={t.edit}
          aria-label={`${t.edit}: ${term.term}`}
          onClick={() => {
            setDraft({ term: term.term, definition: term.definition });
            setEditing(true);
          }}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="size-8 grid place-items-center rounded-md hover:bg-black/5"
          style={{ color: "var(--fg-muted)" }}
          title={t.remove}
          aria-label={`${t.remove}: ${term.term}`}
          onClick={() => act(() => removeTerm(term.id))}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}

function GlossaryEditor({ lang }: { lang: Lang }) {
  const t = TXT[lang];
  const { terms, suggestions } = useGlossary();
  const entries = useAllEntries();
  const apiKey = useApiKey();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ term: "", definition: "" });

  const sourceCount = glossarySourceEntries(entries).length;
  const openCount = terms.filter((x) => !x.approved).length;
  const selectedIds = suggestions.filter((s) => selected.has(s.id)).map((s) => s.id);
  const allSelected = suggestions.length > 0 && selectedIds.length === suggestions.length;

  /** Runs a store mutation; storage failures become a visible message instead of a crash. */
  const act = (fn: () => string | void) => {
    try {
      const msg = fn();
      setError("");
      setNotice(msg ?? "");
    } catch (err) {
      console.error("[glossary] could not save", err);
      setError(t.storage);
    }
  };

  const accept = (ids: string[], approved: boolean) =>
    act(() => {
      const n = acceptSuggestions(ids, approved);
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      return t.accepted(n, approved);
    });

  const generate = async () => {
    if (busy) return;
    if (!apiKey) {
      setShowKeySetup(true);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const list = await fetchGlossarySuggestions();
      act(() => {
        replaceSuggestions(list);
        setSelected(new Set());
        return list.length ? t.found(list.length) : t.noneFound;
      });
    } catch (err) {
      setError(err instanceof GlossaryError ? t.glossaryError[err.code] : describeAiError(err, lang));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className="ws-input-block my-4 rounded-md p-4 space-y-4 not-prose"
      data-testid="workshop-glossary"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={accentStyle}>
          <PenLine size={11} aria-hidden />
          {t.input}
        </span>
        <span className="text-sm font-medium flex-1 min-w-[12rem]">{t.heading}</span>
        {terms.length > 0 && (
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            {t.count(terms.length, openCount)}
          </span>
        )}
      </div>

      {/* Adopted terms */}
      {terms.length > 0 ? (
        <div>
          <ul className="divide-y divide-[var(--border)]">
            {terms.map((term) => (
              <TermRow key={term.id} term={term} t={t} act={act} />
            ))}
          </ul>
          {openCount > 0 && (
            <button type="button" className={`${btn} mt-2`} style={outlineAccentStyle} onClick={() => act(approveAllTerms)}>
              <CheckCheck size={14} /> {t.approveAll}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {t.empty}
        </p>
      )}

      {/* Generate suggestions */}
      <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={generate}
          disabled={busy || sourceCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: "var(--workshop-accent-deep)", color: "white" }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy ? t.suggesting : suggestions.length ? t.suggestAgain : t.suggest}
        </button>
        <p className="text-[11px] leading-snug" style={{ color: "var(--fg-muted)" }}>
          {sourceCount === 0 ? t.noEntries : t.privacy}
        </p>
        {showKeySetup && !apiKey && <AiKeySetup lang={lang} />}
        {error && (
          <p className="text-xs" style={{ color: ERROR_COLOR }} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--fg)" }} role="status">
            <Check size={13} className="shrink-0" style={{ color: "var(--workshop-accent)" }} />
            {notice}
          </p>
        )}
      </div>

      {/* Suggestions to review */}
      {suggestions.length > 0 && (
        <div className="rounded-md p-3 space-y-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(suggestions.map((s) => s.id)))}
                style={{ accentColor: "var(--workshop-accent)" }}
              />
              {t.selectAll}
            </label>
            <span className="text-sm font-semibold ml-auto">{t.suggestions(suggestions.length)}</span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {suggestions.map((s) => (
              <li key={s.id} className="py-2.5 flex items-start gap-2" data-glossary-suggestion={s.term}>
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={s.term}
                  className="mt-2.5 size-4 shrink-0"
                  style={{ accentColor: "var(--workshop-accent)" }}
                />
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2">
                  <TermFields
                    term={s.term}
                    definition={s.definition}
                    onTerm={(v) => act(() => updateSuggestion(s.id, { term: v }))}
                    onDefinition={(v) => act(() => updateSuggestion(s.id, { definition: v }))}
                    t={t}
                  />
                  <div className="flex sm:flex-col items-center sm:items-stretch gap-1 shrink-0">
                    <button
                      type="button"
                      className={btn}
                      style={outlineAccentStyle}
                      disabled={!s.term.trim() || !s.definition.trim()}
                      onClick={() => accept([s.id], true)}
                    >
                      <Check size={13} /> {t.acceptApprove}
                    </button>
                    <button
                      type="button"
                      className="size-8 grid place-items-center rounded-md hover:bg-black/5 sm:self-end"
                      style={{ color: "var(--fg-muted)" }}
                      title={t.discardOne}
                      aria-label={`${t.discardOne}: ${s.term}`}
                      onClick={() => act(() => discardSuggestions([s.id]))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-snug" style={{ color: "var(--fg-muted)" }}>
            {t.flagHint}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={btn}
              style={accentStyle}
              disabled={selectedIds.length === 0}
              onClick={() => accept(selectedIds, false)}
            >
              <Check size={13} /> {t.acceptSelected(selectedIds.length)}
            </button>
            <button
              type="button"
              className={btn}
              style={outlineAccentStyle}
              onClick={() => accept(suggestions.map((s) => s.id), false)}
            >
              <CheckCheck size={13} /> {t.acceptAll}
            </button>
            <button
              type="button"
              className={`${btn} sm:ml-auto`}
              style={ghostStyle}
              onClick={() =>
                act(() => {
                  discardSuggestions();
                  setSelected(new Set());
                })
              }
            >
              <X size={13} /> {t.discard}
            </button>
          </div>
        </div>
      )}

      {/* Manual term */}
      {manualOpen ? (
        <div className="rounded-md p-3 space-y-2" style={{ background: "var(--bg)", border: "1px dashed var(--border)" }}>
          <div className="text-xs font-semibold">{t.manual}</div>
          <TermFields
            term={manual.term}
            definition={manual.definition}
            onTerm={(v) => setManual({ ...manual, term: v })}
            onDefinition={(v) => setManual({ ...manual, definition: v })}
            t={t}
            autoFocus
          />
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              className={btn}
              style={ghostStyle}
              onClick={() => {
                setManualOpen(false);
                setManual({ term: "", definition: "" });
              }}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className={btn}
              style={accentStyle}
              disabled={!manual.term.trim() || !manual.definition.trim()}
              onClick={() =>
                act(() => {
                  addManualTerm(manual.term, manual.definition);
                  setManual({ term: "", definition: "" });
                  setManualOpen(false);
                })
              }
            >
              <Plus size={13} /> {t.add}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={btn} style={ghostStyle} onClick={() => setManualOpen(true)}>
          <Plus size={13} /> {t.manual}
        </button>
      )}
    </div>
  );
}

/** Print/PDF: only the adopted terms, as a plain table with their labels. */
function GlossaryPrintTable({ lang }: { lang: Lang }) {
  const t = TXT[lang];
  const { terms } = useGlossary();
  if (terms.length === 0) return <p className="my-3 text-sm italic text-gray-500">{t.printEmpty}</p>;
  return (
    <table className="min-w-full text-sm border-collapse my-4">
      <thead>
        <tr>
          {[t.term, t.definition, t.status].map((h) => (
            <th key={h} className="text-left font-semibold border-b border-gray-300 px-3 py-1.5">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {terms.map((term) => (
          <tr key={term.id}>
            <td className="border-b border-gray-200 px-3 py-1.5 align-top font-semibold">{term.term}</td>
            <td className="border-b border-gray-200 px-3 py-1.5 align-top">{term.definition}</td>
            <td className="border-b border-gray-200 px-3 py-1.5 align-top text-xs text-gray-600 whitespace-nowrap">
              {t.created}
              {!term.approved && (
                <>
                  <br />
                  <strong className="text-amber-700">{t.unapproved}</strong>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Props {
  /** Print view: adopted terms as a table, no controls */
  readOnly?: boolean;
}

/**
 * MDX block `<WorkshopGlossary />` on the glossary slide (99.01): terms adopted
 * in the workshop, AI suggestions from the protocol on demand, and manual terms.
 */
export function WorkshopGlossary({ readOnly = false }: Props) {
  const [lang] = useLang();
  return readOnly ? <GlossaryPrintTable lang={lang} /> : <GlossaryEditor lang={lang} />;
}
