import { useState } from "react";
import { Check, Layers, Loader2, Mic, MicOff, Plus, Sparkles, Undo2, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useCapture } from "@/lib/useWorkshop";
import { useDictation } from "@/lib/useDictation";
import { getEntry, setEntry } from "@/lib/workshop-store";
import { completeText, describeAiError, useApiKey } from "@/lib/ai-assist";
import { AiKeySetup } from "@/components/ProtocolAi";

interface Props {
  /** Slide id this card wall belongs to, e.g. "01.03" */
  slideId: string;
  /** Field key, unique within the slide, e.g. "karten-herausforderungen" */
  field: string;
  /** Heading of the card list — also the heading in the protocol */
  prompt: string;
  /** Optional small groups, e.g. ["Gruppe 1", "Gruppe 2"]; stored as prefix "[Gruppe 1] Text" */
  groups?: string[];
  /** Entry id ("<slideId>:<field>") the AI clustering is written to, e.g. "01.04:problemfelder" */
  clusterTarget?: string;
  /** Prompt for the target entry if it does not exist yet (should match the target slide's field) */
  clusterPrompt?: string;
  placeholder?: string;
  /** Print view: cards as a plain list, no controls */
  readOnly?: boolean;
}

interface Card {
  group: string;
  text: string;
}

const GROUP_PREFIX = /^\[([^\]]+)\]\s*/;
const ERROR_COLOR = "#dc2626";

function parseCard(line: string, withGroups: boolean): Card {
  const m = withGroups ? GROUP_PREFIX.exec(line) : null;
  return m ? { group: m[1], text: line.slice(m[0].length) } : { group: "", text: line };
}

const serialize = (c: Card) => (c.group ? `[${c.group}] ${c.text}` : c.text);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Model output → card lines (tolerates bullets or numbering the model may add). */
function parseLines(out: string): string[] {
  return out
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

const CONTEXT = `Du bist Moderationsassistenz im Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Die Teilnehmenden haben in Stillarbeit oder Kleingruppen Karten geschrieben und reihum vorgelesen; die Moderation hat sie per Spracherkennung oder Tastatur erfasst. Deshalb können Erkennungsfehler vorkommen. Typische Begriffe: Kernbohrung, Wandsäge, Seilsäge, Betonbohren und -sägen, Bauwerksmechaniker, BG Bau, IG BAU, DIN 18459, VOB, Geschäftsstelle, Vorstand, Mitgliederversammlung, Ausschuss, Wilma.`;

const POLISH_SYSTEM = `${CONTEXT}

Bereinige die Kartenliste:
- Korrigiere Rechtschreibung und offensichtliche Erkennungsfehler aus dem Kontext.
- Führe inhaltsgleiche Karten (Dubletten) zu einer Karte zusammen und hänge die Anzahl an, z. B. „(2×)“. Ähnliche, aber verschiedene Aussagen bleiben getrennt.
- Kurz und prägnant wie auf einer Karte. Sinn und Haltung bleiben unverändert. Erfinde nichts, lass keine Aussage weg.
- Steht vor einer Karte ein Präfix in eckigen Klammern (z. B. „[Gruppe 2]“), übernimm es unverändert. Dubletten nur innerhalb derselben Gruppe zusammenführen.
- Antworte ausschließlich mit der Kartenliste: eine Karte pro Zeile, ohne Aufzählungszeichen, ohne Einleitung, ohne Erklärung.`;

const CLUSTER_SYSTEM = `${CONTEXT}

Ordne die Karten 3 bis 5 Themenfeldern zu:
- Verwende ausschließlich die gelieferten Karten. Erfinde keine Karten, Themen, Fakten oder Zahlen.
- Jede Karte genau einem Themenfeld zuordnen. Karten nahezu wörtlich übernehmen, offensichtliche Erkennungsfehler korrigieren, Präfixe in eckigen Klammern weglassen. Inhaltsgleiche Karten nur einmal aufführen und die Anzahl anhängen, z. B. „(2×)“.
- Titel kurz und sachlich; geht es um Probleme, den Titel als Problem formulieren, nicht als Lösung.
- Format, reiner Text ohne Markdown außer Spiegelstrichen, keine Einleitung, kein Schlusssatz:
Themenfeld 1: Titel
- Karte
- Karte

Themenfeld 2: Titel
- Karte`;

/**
 * Card mode for silent work and small groups: participants read their cards
 * aloud, the facilitator dictates (every pause in speech becomes one card) or
 * types them. Cards are one protocol entry (checklist, one line per card), so
 * they flow into the live record, /protokoll and all exports. Optional AI:
 * polish/deduplicate the cards and cluster them into a text field of another slide.
 */
export function CardCollector({
  slideId,
  field,
  prompt,
  groups = [],
  clusterTarget,
  clusterPrompt,
  placeholder,
  readOnly = false,
}: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const module = Number.parseInt(slideId, 10);
  const id = `${slideId}:${field}`;
  const withGroups = groups.length > 0;
  const [value, setValue] = useCapture({ id, module, slideId, kind: "checklist", prompt, removeWhenEmpty: true });
  const lines = Array.isArray(value) ? value : [];
  const cards = lines.map((l) => parseCard(l, withGroups));

  const [activeGroup, setActiveGroup] = useState(groups[0] ?? "");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);

  const apiKey = useApiKey();
  const entries = useAllEntries();
  const [busy, setBusy] = useState<"polish" | "cluster" | null>(null);
  const [aiError, setAiError] = useState("");
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [polishPreview, setPolishPreview] = useState<{ sent: string[]; proposed: string[] } | null>(null);
  const [undoLines, setUndoLines] = useState<string[] | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [clusterResult, setClusterResult] = useState<string | null>(null);

  const targetSlideId = clusterTarget ? clusterTarget.slice(0, clusterTarget.indexOf(":")) : "";
  const targetEntry = clusterTarget ? entries.find((e) => e.id === clusterTarget) : undefined;
  const targetHasContent = Boolean(
    targetEntry && (Array.isArray(targetEntry.value) ? targetEntry.value.length : targetEntry.value.trim()),
  );

  // Read the store directly: several dictation results can arrive before React re-renders.
  const currentLines = (): string[] => {
    const v = getEntry(id)?.value;
    return Array.isArray(v) ? v : [];
  };

  const addCards = (texts: string[]) => {
    const fresh = texts.map((t) => capitalize(t.trim())).filter(Boolean);
    if (!fresh.length) return;
    setValue([...currentLines(), ...fresh.map((text) => serialize({ group: withGroups ? activeGroup : "", text }))]);
    setUndoLines(null);
  };

  const mic = useDictation((chunk) => addCards([chunk]));

  const submitDraft = () => {
    addCards([draft]);
    setDraft("");
  };

  const commitEdit = () => {
    if (!editing) return;
    const next = currentLines().map((l) => parseCard(l, withGroups));
    const text = editing.text.trim();
    const updated = text
      ? next.map((c, i) => (i === editing.index ? { ...c, text } : c))
      : next.filter((_, i) => i !== editing.index);
    setValue(updated.map(serialize));
    setEditing(null);
  };

  const removeCard = (index: number) => {
    setValue(currentLines().filter((_, i) => i !== index));
    setEditing(null);
  };

  const needKey = () => {
    if (apiKey) return false;
    setShowKeySetup(true);
    return true;
  };

  const polish = async () => {
    if (busy || needKey()) return;
    const sent = currentLines();
    if (!sent.length) return;
    setBusy("polish");
    setAiError("");
    try {
      const out = await completeText({
        system: POLISH_SYSTEM,
        prompt: `Aufgabe der Karten: ${prompt}\n\n<karten>\n${sent.join("\n")}\n</karten>`,
        logLabel: `cards-polish ${id}`,
      });
      setPolishPreview({ sent, proposed: parseLines(out) });
    } catch (err) {
      setAiError(describeAiError(err, lang));
    } finally {
      setBusy(null);
    }
  };

  const acceptPolish = () => {
    if (!polishPreview) return;
    // Cards added or edited while the AI was working are kept, never dropped.
    const extra = currentLines().filter((l) => !polishPreview.sent.includes(l));
    setUndoLines(currentLines());
    setValue([...polishPreview.proposed, ...extra]);
    setPolishPreview(null);
  };

  const cluster = async () => {
    if (!clusterTarget || busy) return;
    setConfirmOverwrite(false);
    setBusy("cluster");
    setAiError("");
    try {
      const out = await completeText({
        system: CLUSTER_SYSTEM,
        prompt: `Aufgabe der Karten: ${prompt}\n\n<karten>\n${currentLines().join("\n")}\n</karten>`,
        effort: "medium",
        logLabel: `cards-cluster ${id}`,
      });
      const existing = getEntry(clusterTarget);
      setEntry({
        id: clusterTarget,
        module: Number.parseInt(targetSlideId, 10),
        slideId: targetSlideId,
        kind: "text",
        prompt: existing?.prompt ?? clusterPrompt ?? "Themenfelder aus den Karten",
        value: out,
      });
      setClusterResult(out);
    } catch (err) {
      setAiError(describeAiError(err, lang));
    } finally {
      setBusy(null);
    }
  };

  const requestCluster = () => {
    if (busy || needKey()) return;
    if (targetHasContent) setConfirmOverwrite(true);
    else void cluster();
  };

  // Display order: configured groups, then groups only found in the data, then cards without group.
  const indexed = cards.map((card, index) => ({ card, index }));
  const sections = withGroups
    ? [...new Set([...groups, ...cards.map((c) => c.group)])]
        .map((g) => ({ group: g, items: indexed.filter((x) => x.card.group === g) }))
        .filter((s) => s.items.length > 0 || groups.includes(s.group))
    : [{ group: "", items: indexed }];
  const countLabel = (n: number) => (de ? `${n} ${n === 1 ? "Karte" : "Karten"}` : `${n} ${n === 1 ? "card" : "cards"}`);
  const groupLabel = (g: string) => g || (de ? "Ohne Gruppe" : "No group");

  if (readOnly) {
    return (
      <div className="my-4">
        <p className="text-sm font-medium mb-2">
          {prompt} ({countLabel(cards.length)})
        </p>
        {cards.length === 0 ? (
          <p className="text-xs italic">{de ? "(noch keine Karten)" : "(no cards yet)"}</p>
        ) : (
          sections
            .filter((s) => s.items.length > 0)
            .map((s) => (
              <div key={s.group || "-"} className="mb-2">
                {withGroups && <p className="text-xs font-semibold">{groupLabel(s.group)}</p>}
                <ul className="text-xs list-disc pl-5">
                  {s.items.map(({ card, index }) => (
                    <li key={index}>{card.text}</li>
                  ))}
                </ul>
              </div>
            ))
        )}
      </div>
    );
  }

  const tile = ({ card, index }: { card: Card; index: number }) => {
    const isEditing = editing?.index === index;
    return (
      <div
        key={index}
        className="relative rounded-md p-2.5 pr-8 text-sm leading-snug min-h-[3.5rem]"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--workshop-accent)",
        }}
        data-card
      >
        <span className="block text-[10px] tabular-nums mb-0.5" style={{ color: "var(--fg-muted)" }}>
          #{index + 1}
        </span>
        {isEditing ? (
          <textarea
            value={editing.text}
            onChange={(e) => setEditing({ index, text: e.target.value })}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                setEditing(null);
              }
            }}
            rows={2}
            autoFocus
            className="w-full text-sm rounded p-1 resize-y"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--fg)" }}
            aria-label={de ? "Karte bearbeiten" : "Edit card"}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing({ index, text: card.text })}
            className="block w-full text-left cursor-text"
            title={de ? "Klicken zum Bearbeiten" : "Click to edit"}
          >
            {card.text}
          </button>
        )}
        <button
          type="button"
          onClick={() => removeCard(index)}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-1.5 right-1.5 size-6 grid place-items-center rounded no-print"
          style={{ color: "var(--fg-muted)" }}
          title={de ? "Karte löschen" : "Delete card"}
          aria-label={de ? "Karte löschen" : "Delete card"}
        >
          <X size={13} />
        </button>
      </div>
    );
  };

  const secondaryBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50";

  return (
    <div
      className="my-4 rounded-md border p-4"
      style={{ borderColor: "var(--workshop-accent)", background: "color-mix(in oklch, var(--workshop-accent) 4%, transparent)" }}
      data-card-collector={id}
    >
      <div className="flex items-start gap-2 mb-3">
        <span
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          {de ? "Karten" : "Cards"}
        </span>
        <span className="text-sm font-medium leading-snug flex-1">{prompt}</span>
        <span className="inline-flex items-center gap-1 text-[11px] shrink-0 mt-0.5 tabular-nums" style={{ color: "var(--workshop-accent)" }}>
          {cards.length > 0 && <Check size={13} strokeWidth={2.5} />}
          {countLabel(cards.length)}
        </span>
      </div>

      <div className="no-print space-y-3">
        {withGroups && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span style={{ color: "var(--fg-muted)" }}>{de ? "Karten gehören zu:" : "Cards belong to:"}</span>
            {groups.map((g) => {
              const active = g === activeGroup;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setActiveGroup(g)}
                  className="px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: active ? "var(--workshop-accent)" : "var(--bg)",
                    color: active ? "white" : "var(--fg)",
                    border: "1px solid " + (active ? "var(--workshop-accent)" : "var(--border)"),
                  }}
                  aria-pressed={active}
                >
                  {g}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {mic.supported ? (
            <button
              type="button"
              onClick={mic.toggle}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: mic.listening ? "var(--workshop-accent-deep)" : "var(--workshop-accent)", color: "white" }}
            >
              {mic.listening ? <MicOff size={18} /> : <Mic size={18} />}
              {mic.listening ? (de ? "Diktat stoppen" : "Stop dictation") : de ? "Karten vorlesen" : "Read cards aloud"}
            </button>
          ) : (
            <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
              {de
                ? "Diktat wird in diesem Browser nicht unterstützt (Chrome oder Edge verwenden). Karten einfach eintippen."
                : "Dictation is not supported in this browser (use Chrome or Edge). Just type the cards."}
            </span>
          )}
          {mic.listening && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium" role="status" style={{ color: "var(--workshop-accent)" }}>
              <span className="size-2 rounded-full animate-pulse" style={{ background: "var(--workshop-accent)" }} aria-hidden />
              {de ? "Diktat läuft · jede Sprechpause wird eine Karte" : "Dictation running · every pause becomes one card"}
              {withGroups && ` · ${activeGroup}`}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitDraft();
              }
            }}
            placeholder={placeholder ?? (de ? "Karte eintippen, Enter = neue Karte …" : "Type a card, Enter = new card …")}
            className="flex-1 min-w-0 text-sm rounded-md px-2.5 py-2"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}
            aria-label={de ? "Neue Karte" : "New card"}
          />
          <button
            type="button"
            onClick={submitDraft}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 px-3 rounded-md text-xs font-medium shrink-0 disabled:opacity-50"
            style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)", background: "var(--bg)" }}
          >
            <Plus size={14} /> {de ? "Karte" : "Card"}
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="mt-3 text-xs" style={{ color: "var(--fg-muted)" }}>
          {de
            ? "Noch keine Karten. „Karten vorlesen“ drücken und pro Karte kurz absetzen, oder eintippen."
            : "No cards yet. Press “Read cards aloud” and pause briefly after each card, or type them."}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {sections.map((s) => (
            <div key={s.group || "-"}>
              {withGroups && (
                <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                  {groupLabel(s.group)}
                  <span className="font-normal" style={{ color: "var(--fg-muted)" }}>
                    · {countLabel(s.items.length)}
                  </span>
                </div>
              )}
              {s.items.length > 0 ? (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}>
                  {s.items.map(tile)}
                </div>
              ) : (
                <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                  —
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <div className="mt-4 pt-3 border-t space-y-2 no-print" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={polish}
              disabled={busy !== null}
              className={secondaryBtn}
              style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)", background: "var(--bg)" }}
              title={de ? "Rechtschreibung und Erkennungsfehler korrigieren, Dubletten zusammenführen (KI)" : "Fix spelling and recognition errors, merge duplicates (AI)"}
            >
              {busy === "polish" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {de ? "Karten glätten" : "Polish cards"}
            </button>
            {clusterTarget && (
              <button
                type="button"
                onClick={requestCluster}
                disabled={busy !== null}
                className={secondaryBtn}
                style={{ background: "var(--workshop-accent-deep)", color: "white" }}
                title={de ? `3–5 Themenfelder bilden und in Folie ${targetSlideId} eintragen (KI)` : `Build 3–5 topic areas and fill them into slide ${targetSlideId} (AI)`}
              >
                {busy === "cluster" ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                {de ? "Zu Themenfeldern clustern" : "Cluster into topic areas"}
              </button>
            )}
            {undoLines && (
              <button
                type="button"
                onClick={() => {
                  setValue(undoLines);
                  setUndoLines(null);
                }}
                className={secondaryBtn}
                style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
              >
                <Undo2 size={13} /> {de ? "Glättung rückgängig" : "Undo polish"}
              </button>
            )}
            {aiError && (
              <span className="text-[11px]" style={{ color: ERROR_COLOR }}>
                {aiError}
              </span>
            )}
          </div>

          {showKeySetup && !apiKey && <AiKeySetup lang={lang} />}

          {confirmOverwrite && (
            <div className="rounded-md p-2.5 text-xs space-y-2" style={{ background: "var(--bg-elev)", border: "1px dashed var(--workshop-accent)" }} role="alertdialog">
              <p>
                {de
                  ? `Das Feld „${targetEntry?.prompt ?? clusterTarget}“ auf Folie ${targetSlideId} enthält schon Text. Überschreiben?`
                  : `The field “${targetEntry?.prompt ?? clusterTarget}” on slide ${targetSlideId} already contains text. Overwrite?`}
              </p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => void cluster()} className="px-2.5 py-1 rounded-md font-medium" style={{ background: "var(--workshop-accent)", color: "white" }}>
                  {de ? "Überschreiben" : "Overwrite"}
                </button>
                <button type="button" onClick={() => setConfirmOverwrite(false)} className="px-2.5 py-1 rounded-md" style={{ border: "1px solid var(--border)", color: "var(--fg)" }}>
                  {de ? "Abbrechen" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {polishPreview && (
            <div className="rounded-md p-2.5 text-xs space-y-2" style={{ background: "var(--bg-elev)", border: "1px solid var(--workshop-accent)" }} data-polish-preview>
              <p className="font-semibold">
                {de ? "Vorschlag der KI" : "AI suggestion"}: {countLabel(polishPreview.sent.length)} → {countLabel(polishPreview.proposed.length)}
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-sm">
                {polishPreview.proposed.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              <div className="flex gap-1.5">
                <button type="button" onClick={acceptPolish} className="px-2.5 py-1 rounded-md font-medium" style={{ background: "var(--workshop-accent)", color: "white" }}>
                  {de ? "Übernehmen" : "Apply"}
                </button>
                <button type="button" onClick={() => setPolishPreview(null)} className="px-2.5 py-1 rounded-md" style={{ border: "1px solid var(--border)", color: "var(--fg)" }}>
                  {de ? "Verwerfen" : "Discard"}
                </button>
              </div>
            </div>
          )}

          {clusterResult && (
            <div className="rounded-md p-2.5 text-xs space-y-1.5" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }} data-cluster-result>
              <div className="flex items-center gap-2">
                <Check size={14} style={{ color: "var(--workshop-accent)" }} />
                <span className="font-semibold flex-1">
                  {de ? "Themenfelder eingetragen in Folie " : "Topic areas filled into slide "}
                  <a href={`#/s/${targetSlideId}`} style={{ color: "var(--workshop-accent)" }}>
                    {targetSlideId}
                  </a>
                </span>
                <button type="button" onClick={() => setClusterResult(null)} className="size-6 grid place-items-center rounded" style={{ color: "var(--fg-muted)" }} aria-label={de ? "Schließen" : "Close"}>
                  <X size={13} />
                </button>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{clusterResult}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
