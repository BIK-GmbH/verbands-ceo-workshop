import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Home, ListChecks, Mic, Upload } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ALL_SLIDES } from "@/lib/slides";
import { useInterviews } from "@/lib/interview-store";
import { InterviewSetup } from "@/components/interviews/InterviewSetup";
import { InterviewRecorder } from "@/components/interviews/InterviewRecorder";
import { InterviewUpload } from "@/components/interviews/InterviewUpload";
import { InterviewList } from "@/components/interviews/InterviewList";
import { GroupOpinionPanel } from "@/components/interviews/GroupOpinionPanel";
import { TransferBar } from "@/components/interviews/TransferBar";
import { Notice } from "@/components/interviews/ui";
import { Tooltip } from "@/components/ui/Tooltip";

type Tab = "record" | "upload" | "list";

/**
 * Interview mode for phase 1 (slide 01.02): record or upload short interviews,
 * transcribe them, create an opinion picture per person and a shared one, and
 * write the results into the workshop protocol.
 */
export function Interviews() {
  const [lang] = useLang();
  const de = lang === "de";
  const navigate = useNavigate();
  const { ready, error, interviews } = useInterviews();
  const [tab, setTab] = useState<Tab>("record");
  const nextNumber = interviews.length + 1;

  // Same back behaviour as the protocol page: return to the slide, else deck start.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const goBack = () => (canGoBack ? navigate(-1) : navigate(`/s/${ALL_SLIDES[0].id}`));

  const tabs: { id: Tab; label: string; icon: typeof Mic; hint: string }[] = [
    {
      id: "record",
      label: de ? "Interview führen" : "Conduct interview",
      icon: Mic,
      hint: de
        ? "Geführtes Interview: Leitfragen nacheinander, Aufnahme direkt im Browser"
        : "Guided interview: guide questions one by one, recorded directly in the browser",
    },
    {
      id: "upload",
      label: de ? "Hochladen" : "Upload",
      icon: Upload,
      hint: de
        ? "Anderswo aufgenommene Audiodateien übernehmen, z. B. vom Smartphone"
        : "Take over audio files recorded elsewhere, e.g. on a smartphone",
    },
    {
      id: "list",
      label: `${de ? "Meinungsbilder" : "Opinion pictures"} (${interviews.length})`,
      icon: ListChecks,
      hint: de
        ? "Alle Interviews: transkribieren, Meinungsbild je Person und gemeinsames Meinungsbild erstellen"
        : "All interviews: transcribe, create an opinion picture per person and a group picture",
    },
  ];

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100svh" }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 border-b"
        style={{ height: "var(--header-height)", background: "var(--bg)", color: "var(--fg)", borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_11%,transparent)]"
          style={{ background: "color-mix(in oklch, var(--fg) 6%, transparent)", border: "1px solid var(--border)" }}
        >
          <ArrowLeft size={18} /> {de ? "Zurück" : "Back"}
        </button>
        <Tooltip content={de ? "Zur Startseite des Workshops" : "To the workshop start page"}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_8%,transparent)]"
            aria-label={de ? "Zur Startseite" : "To start"}
          >
            <Home size={16} /> <span className="hidden sm:inline">Start</span>
          </Link>
        </Tooltip>
        <Tooltip content={de ? "Zum Protokoll, dort landen die Meinungsbilder auf Folie 01.02" : "To the record, where the opinion pictures land on slide 01.02"}>
          <Link
            to="/protokoll"
            className="inline-flex items-center gap-2 text-sm rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_8%,transparent)]"
            aria-label={de ? "Zum Protokoll" : "To the record"}
          >
            <FileText size={16} /> <span className="hidden sm:inline">{de ? "Protokoll" : "Record"}</span>
          </Link>
        </Tooltip>
        <div className="ml-auto text-sm font-semibold">{de ? "KI-Interviews" : "AI interviews"}</div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--workshop-accent)" }}>
            {de ? "KI-Interviews" : "AI interviews"}
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {de
              ? "Kurze Einzelinterviews (ca. 5 Minuten) zur Einstellung zu KI und zum Nutzen für den FBS: direkt aufnehmen oder Audiodateien hochladen, transkribieren, pro Person ein Meinungsbild erstellen und daraus das gemeinsame Meinungsbild. Die Ergebnisse landen im Protokoll auf Folie 01.02. Alle Daten bleiben lokal in diesem Browser; nur zum Transkribieren (OpenAI) und Zusammenfassen (Anthropic) werden Audio bzw. Text übertragen."
              : "Short one-to-one interviews (about 5 minutes) on attitudes towards AI and its value for the FBS: record directly or upload audio files, transcribe, create an opinion picture per person and from those the group picture. Results go into the record on slide 01.02. All data stays local in this browser; audio and text are only sent for transcription (OpenAI) and summarisation (Anthropic)."}
          </p>
        </div>

        <InterviewSetup lang={lang} />

        {error && (
          <Notice tone="error">
            {de
              ? "Der lokale Interview-Speicher (IndexedDB) ist in diesem Browser nicht verfügbar, z. B. im privaten Modus. Bitte ein normales Browserfenster verwenden."
              : "The local interview storage (IndexedDB) is not available in this browser, e.g. in private mode. Please use a normal browser window."}
          </Notice>
        )}

        <div>
          <div role="tablist" aria-label={de ? "Interview-Modus" : "Interview mode"} className="flex flex-wrap gap-1 border-b mb-4" style={{ borderColor: "var(--border)" }}>
            {tabs.map(({ id, label, icon: Icon, hint }) => (
              <Tooltip key={id} content={hint}>
                <button
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  onClick={() => setTab(id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
                  style={{
                    borderColor: tab === id ? "var(--workshop-accent)" : "transparent",
                    color: tab === id ? "var(--workshop-accent)" : "var(--fg-muted)",
                  }}
                >
                  <Icon size={15} /> {label}
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Panels stay mounted so a running recording survives a tab switch. */}
          <div role="tabpanel" id="panel-record" aria-labelledby="tab-record" hidden={tab !== "record"}>
            <InterviewRecorder lang={lang} nextNumber={nextNumber} onShowList={() => setTab("list")} />
          </div>
          <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload" hidden={tab !== "upload"}>
            <InterviewUpload lang={lang} nextNumber={nextNumber} onShowList={() => setTab("list")} />
          </div>
          <div role="tabpanel" id="panel-list" aria-labelledby="tab-list" hidden={tab !== "list"} className="space-y-6">
            {ready ? (
              <InterviewList interviews={interviews} lang={lang} />
            ) : (
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                {de ? "Lade Interviews …" : "Loading interviews …"}
              </p>
            )}
            <GroupOpinionPanel interviews={interviews} lang={lang} />
          </div>
        </div>

        <TransferBar interviews={interviews} lang={lang} />
      </main>
    </div>
  );
}
