import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown, FileJson, Trash2, FileText, Home, Printer, FileType } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useWorkshopMeta } from "@/lib/useWorkshop";
import { exportMarkdown, exportJSON, downloadFile, clearAll } from "@/lib/workshop-store";
import { printProtocolPdf, downloadProtocolWord } from "@/lib/protocol-export";
import { AudioRecorder } from "@/components/AudioRecorder";
import { findModule, ALL_SLIDES } from "@/lib/slides";

export function Protocol() {
  const [lang] = useLang();
  const navigate = useNavigate();
  const entries = useAllEntries();
  const [meta, setMeta] = useWorkshopMeta();
  const de = lang === "de";
  const stamp = new Date().toISOString().slice(0, 10);

  // Return to the slide the user came from; fall back to the deck start if the
  // protocol was opened directly (no in-app history). React Router tracks the
  // history position in window.history.state.idx.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const goBack = () =>
    canGoBack ? navigate(-1) : navigate(`/s/${ALL_SLIDES[0].id}`);

  const byModule = entries.reduce<Record<number, typeof entries>>((acc, e) => {
    (acc[e.module] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100svh" }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 border-b"
        style={{ height: "var(--header-height)", background: "var(--workshop-accent)", color: "white", borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-md px-2.5 h-9 hover:bg-white/20 active:bg-white/30 transition-colors"
          style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.5)" }}
        >
          <ArrowLeft size={18} /> {de ? "Zurück zur Folie" : "Back to slide"}
        </button>
        <Link
          to={`/s/${ALL_SLIDES[0].id}`}
          className="inline-flex items-center gap-2 text-sm rounded-md px-2.5 h-9 hover:bg-white/15 active:bg-white/25 transition-colors"
          title={de ? "Zur Startseite" : "To start"}
        >
          <Home size={16} /> <span className="hidden sm:inline">{de ? "Start" : "Start"}</span>
        </Link>
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
            ? "Alle Eingaben werden lokal in eurem Browser gespeichert. Exportiert das Protokoll und lasst daraus mit dem /konzept-neu-Skill ein angepasstes Konzept + neue Folien erzeugen."
            : "All input is stored locally in your browser. Export the record and turn it into an adapted concept + new slides with the /konzept-neu skill."}
        </p>

        {/* Meta */}
        <section className="grid sm:grid-cols-3 gap-3 mb-6">
          <label className="text-sm">
            <span className="block mb-1 text-xs uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{de ? "Datum" : "Date"}</span>
            <input
              type="date"
              value={meta.date}
              onChange={(e) => setMeta({ date: e.target.value })}
              className="w-full rounded-md p-2 text-sm"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block mb-1 text-xs uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{de ? "Teilnehmende" : "Participants"}</span>
            <input
              type="text"
              value={meta.participants}
              onChange={(e) => setMeta({ participants: e.target.value })}
              placeholder={de ? "Namen / Rollen…" : "Names / roles…"}
              className="w-full rounded-md p-2 text-sm"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </label>
        </section>

        <AudioRecorder />

        {/* Export actions */}
        <section className="flex flex-wrap gap-2 my-6">
          <button
            type="button"
            onClick={() => printProtocolPdf(lang)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
            style={{ background: "var(--workshop-accent)", color: "white" }}
          >
            <Printer size={16} /> PDF
          </button>
          <button
            type="button"
            onClick={() => downloadProtocolWord(lang)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
            style={{ background: "var(--workshop-accent-deep)", color: "white" }}
          >
            <FileType size={16} /> Word
          </button>
          <button
            type="button"
            onClick={() => downloadFile(`workshop-protokoll-${stamp}.md`, exportMarkdown(), "text/markdown")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            <FileDown size={16} /> Markdown
          </button>
          <button
            type="button"
            onClick={() => downloadFile(`workshop-protokoll-${stamp}.json`, exportJSON(), "application/json")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            <FileJson size={16} /> JSON
          </button>
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
        </section>

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
                      const val = Array.isArray(e.value) ? e.value.join(", ") : e.value;
                      return (
                        <div key={e.id} className="rounded-md p-3" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
                          <div className="text-sm font-medium mb-1">{e.prompt}</div>
                          <div className="text-sm whitespace-pre-wrap" style={{ color: val ? "var(--fg)" : "var(--fg-muted)" }}>
                            {val || (de ? "— (keine Eingabe)" : "— (no input)")}
                          </div>
                          <div className="text-[11px] mt-1 font-mono" style={{ color: "var(--fg-muted)" }}>{e.slideId} · {e.kind}</div>
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
