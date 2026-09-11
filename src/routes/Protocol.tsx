import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown, FileJson, Trash2, FileText, Home, Printer, FileType, Pencil, Search } from "lucide-react";
import { BulkPolishButton, EntryEditor, isEditableText } from "@/components/ProtocolAi";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useWorkshopMeta } from "@/lib/useWorkshop";
import { exportMarkdown, exportJSON, downloadFile, clearAll } from "@/lib/workshop-store";
import { printProtocolPdf, downloadProtocolWord } from "@/lib/protocol-export";
import { AudioRecorder } from "@/components/AudioRecorder";
import { ParticipantsEditor } from "@/components/ParticipantsEditor";
import { ReportPanel } from "@/components/ReportPanel";
import { findModule, ALL_SLIDES } from "@/lib/slides";
import { Tooltip } from "@/components/ui/Tooltip";
import { EXPORT_HINTS } from "@/components/LiveProtocolPanel";

export function Protocol() {
  const [lang] = useLang();
  const navigate = useNavigate();
  const entries = useAllEntries();
  const [meta, setMeta] = useWorkshopMeta();
  const de = lang === "de";
  const stamp = new Date().toISOString().slice(0, 10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Return to the slide the user came from; fall back to the deck start if the
  // protocol was opened directly (no in-app history). React Router tracks the
  // history position in window.history.state.idx.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const goBack = () =>
    canGoBack ? navigate(-1) : navigate(`/s/${ALL_SLIDES[0].id}`);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? entries.filter((e) =>
        `${e.prompt} ${Array.isArray(e.value) ? e.value.join(" ") : e.value}`.toLowerCase().includes(needle),
      )
    : entries;
  const byModule = shown.reduce<Record<number, typeof shown>>((acc, e) => {
    (acc[e.module] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100svh" }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 border-b"
        style={{ height: "var(--header-height)", background: "var(--bg)", color: "var(--fg)", borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_11%,transparent)]"
          style={{ background: "color-mix(in oklch, var(--fg) 6%, transparent)", border: "1px solid var(--border)" }}
        >
          <ArrowLeft size={18} /> {de ? "Zurück zur Folie" : "Back to slide"}
        </button>
        <Tooltip content={de ? "Zur Startseite des Workshops" : "To the workshop start page"}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_8%,transparent)]"
            aria-label={de ? "Zur Startseite" : "To start"}
          >
            <Home size={16} /> <span className="hidden sm:inline">{de ? "Start" : "Start"}</span>
          </Link>
        </Tooltip>
        <div className="ml-auto text-sm font-semibold">
          {de ? "Workshop-Protokoll" : "Workshop record"}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8">
        <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--workshop-accent)" }}>
          {de ? "Euer Workshop-Protokoll" : "Your workshop record"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--fg-muted)" }}>
          {de
            ? "Hier laufen alle Beiträge aus allen Folien zusammen. Mit ✎ lässt sich jeder Freitext von Hand oder per KI überarbeiten; die Exporte enthalten immer die aktuelle, überarbeitete Fassung. Gespeichert wird lokal in eurem Browser. Nur die KI-Überarbeitung (opt-in) überträgt den jeweiligen Text an die Claude-API."
            : "All contributions from all slides come together here. Use ✎ to edit any free text by hand or with AI; exports always contain the current, reworded version. Storage is local in your browser. Only AI rewording (opt-in) sends the text to the Claude API."}
        </p>

        {/* Meta */}
        <section className="mb-6">
          <label className="text-sm block sm:max-w-[33%]">
            <span className="block mb-1 text-xs uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{de ? "Datum" : "Date"}</span>
            <input
              type="date"
              value={meta.date}
              onChange={(e) => setMeta({ date: e.target.value })}
              className="w-full rounded-md p-2 text-sm"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </label>
          <ParticipantsEditor />
        </section>

        <AudioRecorder />

        {/* Export actions */}
        <section className="flex flex-wrap gap-2 my-6">
          <Tooltip content={EXPORT_HINTS.pdf[lang]}>
            <button
              type="button"
              onClick={() => printProtocolPdf(lang)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
              style={{ background: "var(--workshop-accent)", color: "white" }}
            >
              <Printer size={16} /> PDF
            </button>
          </Tooltip>
          <Tooltip content={EXPORT_HINTS.word[lang]}>
            <button
              type="button"
              onClick={() => downloadProtocolWord(lang)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
              style={{ background: "var(--workshop-accent-deep)", color: "white" }}
            >
              <FileType size={16} /> Word
            </button>
          </Tooltip>
          <Tooltip content={EXPORT_HINTS.markdown[lang]}>
            <button
              type="button"
              onClick={() => downloadFile(`workshop-protokoll-${stamp}.md`, exportMarkdown(), "text/markdown")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            >
              <FileDown size={16} /> Markdown
            </button>
          </Tooltip>
          <Tooltip content={EXPORT_HINTS.json[lang]}>
            <button
              type="button"
              onClick={() => downloadFile(`workshop-protokoll-${stamp}.json`, exportJSON(), "application/json")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            >
              <FileJson size={16} /> JSON
            </button>
          </Tooltip>
          <Tooltip
            content={
              de
                ? "Löscht alle Beiträge in diesem Browser unwiderruflich (mit Rückfrage). Vorher am besten als JSON oder Word sichern."
                : "Deletes all contributions in this browser irrevocably (asks first). Best save as JSON or Word beforehand."
            }
          >
            <button
              type="button"
              onClick={() => {
                if (window.confirm(de ? "Alle Eingaben wirklich löschen?" : "Really delete all input?")) clearAll();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm ml-auto"
              style={{ border: "1px solid var(--border)", color: "#dc2626" }}
            >
              <Trash2 size={16} /> {de ? "Zurücksetzen" : "Reset"}
            </button>
          </Tooltip>
        </section>

        <ReportPanel entries={entries} lang={lang} />

        {entries.length > 0 && (
          <div className="mb-6 max-w-md">
            <BulkPolishButton entries={entries} lang={lang} />
          </div>
        )}

        {entries.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[14rem] max-w-md">
              <Search
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--fg-muted)" }}
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={de ? "Im Protokoll suchen…" : "Search the record…"}
                className="w-full text-sm rounded-md py-2 pl-8 pr-2"
                style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--fg)" }}
                aria-label={de ? "Im Protokoll suchen" : "Search the record"}
              />
            </div>
            {needle && (
              <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                {de ? `${shown.length} von ${entries.length} Beiträgen` : `${shown.length} of ${entries.length} items`}
              </span>
            )}
          </div>
        )}

        {/* Entries */}
        {entries.length === 0 ? (
          <div
            className="text-center py-12 rounded-md text-sm"
            style={{ background: "var(--bg-elev)", border: "1px dashed var(--border)", color: "var(--fg-muted)" }}
          >
            <FileText size={28} className="mx-auto mb-2 opacity-50" />
            {de
              ? "Noch keine Eingaben. Die Erarbeiten-Folien in jedem Modul füllen dieses Protokoll."
              : "No input yet. The 'work it out' slides in each module fill this record."}
          </div>
        ) : (
          Object.keys(byModule)
            .map(Number)
            .sort((a, b) => a - b)
            .map((mod) => {
              const m = findModule(mod);
              return (
                <section key={mod} className="mb-7">
                  <h2 className="text-lg font-semibold mb-3 pb-1 border-b" style={{ borderColor: "var(--border)" }}>
                    {mod === 99 ? (de ? "Anhang" : "Appendix") : `${de ? "Modul" : "Module"} ${mod}`}
                    {m && <span className="text-sm font-normal ml-2" style={{ color: "var(--fg-muted)" }}>· {m.title[lang]}</span>}
                  </h2>
                  <div className="space-y-3">
                    {byModule[mod].map((e) => {
                      if (editingId === e.id) {
                        return <EntryEditor key={e.id} entry={e} lang={lang} onClose={() => setEditingId(null)} />;
                      }
                      const val = Array.isArray(e.value) ? e.value.join("\n") : e.value;
                      return (
                        <div key={e.id} className="rounded-md p-3" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
                          <div className="flex items-start gap-2 mb-1">
                            <div className="text-sm font-medium flex-1">{e.prompt}</div>
                            {isEditableText(e) && (
                              <Tooltip
                                content={
                                  de
                                    ? "Von Hand, per Diktat oder mit KI umformulieren (Glätten, Knapper, Stichpunkte …). Das Original bleibt wiederherstellbar."
                                    : "Reword by hand, by dictation or with AI (polish, shorter, bullet points …). The original stays restorable."
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => setEditingId(e.id)}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md shrink-0"
                                  style={{ border: "1px solid var(--border)", color: "var(--workshop-accent)" }}
                                >
                                  <Pencil size={13} /> {de ? "Bearbeiten" : "Edit"}
                                </button>
                              </Tooltip>
                            )}
                          </div>
                          <div className="text-sm whitespace-pre-wrap" style={{ color: val ? "var(--fg)" : "var(--fg-muted)" }}>
                            {val || (de ? "— (keine Eingabe)" : "— (no input)")}
                          </div>
                          <div className="text-[11px] mt-1 font-mono" style={{ color: "var(--fg-muted)" }}>{e.slideId} · {e.kind}{e.raw ? (de ? " · KI-überarbeitet" : " · AI-reworded") : ""}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
        )}
      </main>
    </div>
  );
}
